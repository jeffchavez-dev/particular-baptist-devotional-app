import { supabase } from './supabase'

/**
 * Local book library — localStorage + Supabase sync.
 *
 * Supabase table (run once in your Supabase SQL editor):
 *
 *   create table pb_book_library (
 *     id         uuid default gen_random_uuid() primary key,
 *     user_id    uuid references auth.users(id) on delete cascade not null,
 *     book_id    text not null,
 *     book_data  jsonb not null,
 *     updated_at timestamptz default now(),
 *     unique(user_id, book_id)
 *   );
 *   alter table pb_book_library enable row level security;
 *   create policy "own books" on pb_book_library for all using (auth.uid() = user_id);
 */

const KEY = 'pb-book-library'

/* ── Retry helper ─────────────────────────────────────────────────────────── */
async function _retryOp(fn, maxAttempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() } catch (err) {
      lastError = err
      if (attempt < maxAttempts)
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)))
    }
  }
  console.error('[bookLibrary] Supabase op failed after', maxAttempts, 'attempts:', lastError?.message)
  throw lastError
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getAllBooks() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function _persist(books) {
  const json = JSON.stringify(books)
  localStorage.setItem(KEY, json)      // throws QuotaExceededError if storage is full
  window.dispatchEvent(new CustomEvent('pb-book-library-updated'))
}

/**
 * Save (add or update) a book.
 * Pass userId to also write-through to Supabase (fire-and-forget with retry).
 */
export function saveBook(book, userId) {
  const books = getAllBooks()
  books[book.id] = book
  _persist(books)                      // let QuotaExceededError propagate to the UI caller

  if (userId) {
    _retryOp(() =>
      supabase.from('pb_book_library').upsert(
        { user_id: userId, book_id: book.id, book_data: book, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,book_id' }
      )
    ).catch(e => console.warn('[saveBook] upsert failed:', e?.message))
  }
}

/**
 * Delete a book by id.
 * Pass userId to also write-through to Supabase (fire-and-forget with retry).
 */
export function deleteBook(id, userId) {
  const books = getAllBooks()
  delete books[id]
  _persist(books)

  if (userId) {
    _retryOp(() =>
      supabase.from('pb_book_library').delete().match({ user_id: userId, book_id: id })
    ).catch(e => console.warn('[deleteBook] delete failed:', e?.message))
  }
}

export async function searchBookCovers(title, author = '') {
  const parts = [title.trim(), author.trim()].filter(Boolean)
  if (!parts.length) return []
  const q = parts.map(s => encodeURIComponent(s)).join('+')
  try {
    // No `fields` mask — simpler request is more reliable across API versions
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10&printType=books&langRestrict=en`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || [])
      .filter(item => item.volumeInfo?.imageLinks)
      .map(item => {
        const links = item.volumeInfo.imageLinks
        const raw = links.thumbnail || links.smallThumbnail || links.small || ''
        return {
          id: item.id,
          title: item.volumeInfo.title || '',
          authors: (item.volumeInfo.authors || []).join(', '),
          // Force HTTPS, bump zoom for better quality
          coverUrl: raw.replace(/^http:/, 'https:').replace(/&zoom=\d/, '&zoom=2'),
        }
      })
      .filter(item => item.coverUrl) // drop any that ended up with an empty URL
  } catch { return [] }
}

/* ── Supabase sync ─────────────────────────────────────────────────────────── */

/**
 * Push all local books to Supabase.
 * Called on login to ensure the server has the latest local data.
 */
export async function syncBooksUp(userId) {
  const books = getAllBooks()
  const rows = Object.values(books).map(book => ({
    user_id:    userId,
    book_id:    book.id,
    book_data:  book,
    updated_at: book.addedAt || new Date().toISOString(),
  }))
  if (!rows.length) return { success: true, count: 0 }
  try {
    const { error } = await supabase
      .from('pb_book_library')
      .upsert(rows, { onConflict: 'user_id,book_id' })
    if (error) throw error
    return { success: true, count: rows.length }
  } catch (e) {
    console.warn('[bookLibrary] syncBooksUp:', e?.message)
    return { success: false, message: e?.message }
  }
}

/**
 * Pull books from Supabase and merge into localStorage.
 * Called on login and on tab-focus for cross-device sync.
 * Merge strategy: Supabase wins for any book it knows about; local-only books survive.
 */
export async function syncBooksDown(userId) {
  try {
    const { data, error } = await supabase
      .from('pb_book_library')
      .select('book_id,book_data')
      .eq('user_id', userId)
    if (error) throw error
    if (!data || !data.length) return { success: true, count: 0 }
    const merged = getAllBooks()
    data.forEach(row => { merged[row.book_id] = row.book_data })
    localStorage.setItem(KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent('pb-book-library-updated'))
    return { success: true, count: data.length }
  } catch (e) {
    console.warn('[bookLibrary] syncBooksDown:', e?.message)
    return { success: false, message: e?.message }
  }
}
