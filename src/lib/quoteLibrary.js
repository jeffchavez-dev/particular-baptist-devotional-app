/**
 * Quote Library — localStorage CRUD for standalone book quotes.
 *
 * Quote shape:
 *   { id, text, bookTitle, author, page, coverUrl, coverData, labels[], createdAt, shareToken? }
 */

import { supabase } from './supabase'

const KEY = 'pb-quote-library'

export function generateQuoteId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getAllQuotes() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function _persist(quotes) {
  localStorage.setItem(KEY, JSON.stringify(quotes))
  window.dispatchEvent(new CustomEvent('pb-quote-library-updated'))
}

export function saveQuote(quote, userId) {
  const quotes = getAllQuotes()
  quotes[quote.id] = quote
  _persist(quotes)

  if (userId) {
    ;(async () => {
      try {
        await supabase.from('pb_book_library').upsert(
          { user_id: userId, book_id: quote.id, book_data: quote, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,book_id' }
        )
      } catch (e) { console.warn('[saveQuote] upsert failed:', e?.message) }
    })()
  }
}

export function deleteQuote(id, userId) {
  const quotes = getAllQuotes()
  delete quotes[id]
  _persist(quotes)

  if (userId) {
    ;(async () => {
      try {
        await supabase.from('pb_book_library').delete().match({ user_id: userId, book_id: id })
      } catch (e) { console.warn('[deleteQuote] delete failed:', e?.message) }
    })()
  }
}

export async function syncQuotesUp(userId) {
  const quotes = getAllQuotes()
  const rows = Object.values(quotes).map(q => ({
    user_id:    userId,
    book_id:    q.id,
    book_data:  q,
    updated_at: q.createdAt || new Date().toISOString(),
  }))
  if (!rows.length) return { success: true, count: 0 }
  try {
    const { error } = await supabase
      .from('pb_book_library')
      .upsert(rows, { onConflict: 'user_id,book_id' })
    if (error) throw error
    return { success: true, count: rows.length }
  } catch (e) {
    console.warn('[quoteLibrary] syncQuotesUp:', e?.message)
    return { success: false, message: e?.message }
  }
}

export async function syncQuotesDown(userId) {
  try {
    const { data, error } = await supabase
      .from('pb_book_library')
      .select('book_id,book_data')
      .eq('user_id', userId)
    if (error) throw error
    if (!data || !data.length) return { success: true, count: 0 }
    // Only merge entries that are quotes (have `text` field, not legacy book entries)
    const merged = getAllQuotes()
    data.forEach(row => {
      if (row.book_data?.text !== undefined) merged[row.book_id] = row.book_data
    })
    localStorage.setItem(KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent('pb-quote-library-updated'))
    return { success: true, count: data.length }
  } catch (e) {
    console.warn('[quoteLibrary] syncQuotesDown:', e?.message)
    return { success: false, message: e?.message }
  }
}
