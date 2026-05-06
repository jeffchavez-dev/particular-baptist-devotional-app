/**
 * authorContent.js
 *
 * Supabase CRUD for author-curated scripture content:
 *   • author_scripture_notes  — verse-level commentary visible to all users
 *   • author_cross_refs       — author-defined passage links (e.g. John 3:16 → Num 15)
 *
 * RLS: all authenticated and anonymous users can SELECT.
 *      Only the author account (by email) can INSERT / UPDATE / DELETE.
 *
 * Required SQL (run once in Supabase dashboard — see bottom of this file).
 */

import { supabase } from './supabase'

export const AUTHOR_EMAIL = 'jeffchavez0828@gmail.com'

/** Returns true when the current session belongs to the author. */
export function isAuthor(session) {
  return session?.user?.email === AUTHOR_EMAIL
}

// ─────────────────────────────────────────────
//  Per-chapter localStorage cache (legacy fallback)
// ─────────────────────────────────────────────

const CACHE_PREFIX = 'authorContent:'

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value))
  } catch { /* storage full or unavailable — ignore */ }
}

// ─────────────────────────────────────────────
//  Bulk in-memory cache (populated at startup)
//
//  After the first successful online prefetch, ALL rows are saved to a
//  single localStorage key.  On subsequent loads (including offline),
//  the maps are rebuilt from localStorage instantly — no network needed.
//
//  Maps:
//    _xrefsMap    – 'src_book:src_chapter'  → raw xref rows[]
//    _backRefsMap – 'tgt_book:tgt_chapter'  → raw xref rows[]
//    _notesMap    – 'book:chapter'           → raw note rows[]
// ─────────────────────────────────────────────

const BULK_CACHE_KEY = 'authorContent:bulk_v2'

// Re-fetch from network at most once every 6 hours.
// Offline sessions always use the localStorage cache; the TTL only applies
// when the device is online and the cache is older than this threshold.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000   // 6 hours

let _xrefsMap    = null   // null = not yet loaded from storage
let _backRefsMap = null
let _notesMap    = null
let _bulkReady   = false  // true once maps are populated from storage or network

/** Build in-memory maps from raw row arrays. */
function buildMaps(xrefs, notes) {
  _xrefsMap    = {}
  _backRefsMap = {}
  _notesMap    = {}
  for (const r of (xrefs || [])) {
    const sk = `${r.src_book}:${r.src_chapter}`
    if (!_xrefsMap[sk])    _xrefsMap[sk]    = []
    _xrefsMap[sk].push(r)
    const tk = `${r.tgt_book}:${r.tgt_chapter}`
    if (!_backRefsMap[tk]) _backRefsMap[tk] = []
    _backRefsMap[tk].push(r)
  }
  for (const n of (notes || [])) {
    const k = `${n.book}:${n.chapter}`
    if (!_notesMap[k]) _notesMap[k] = []
    _notesMap[k].push(n)
  }
  _bulkReady = true
}

/**
 * Attempt to load the bulk cache from localStorage into memory (synchronous).
 * Returns { loaded: bool, stale: bool }.
 * stale = true when the cache is older than CACHE_TTL_MS (needs a network refresh).
 */
function loadBulkFromStorage() {
  if (_bulkReady) return { loaded: true, stale: false }
  try {
    const raw = localStorage.getItem(BULK_CACHE_KEY)
    if (!raw) return { loaded: false, stale: true }
    const { xrefs, notes, savedAt } = JSON.parse(raw)
    buildMaps(xrefs, notes)
    const age = Date.now() - (savedAt || 0)
    return { loaded: true, stale: age > CACHE_TTL_MS }
  } catch { return { loaded: false, stale: true } }
}

/**
 * Fetch ALL rows from a Supabase table, paginating past the 1,000-row default cap.
 */
async function fetchAllRows(table) {
  const PAGE = 1000
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break   // reached last page
    from += PAGE
  }
  return rows
}

/**
 * Fetch ALL author content from Supabase, save to localStorage, rebuild maps.
 *
 * Strategy — offline-first with TTL-based background revalidation:
 *   • Always loads the localStorage cache instantly (fast first render, works offline).
 *   • Only hits the network when the cache is missing or older than CACHE_TTL_MS.
 *   • If the network fetch fails (offline), the existing cache is kept and used silently.
 *   • After a successful fetch, dispatches 'pb-author-content-ready' so components
 *     that rendered before fresh data arrived can re-render.
 */
let _prefetchInFlight = false
export async function prefetchAllAuthorContent() {
  // 1. Load cache immediately — instant render, works offline
  const { loaded: hadCache, stale } = loadBulkFromStorage()

  // 2. If cache is fresh enough, nothing more to do
  if (hadCache && !stale) return

  // 3. Cache is missing or stale — do a background network refresh
  if (_prefetchInFlight) return
  _prefetchInFlight = true

  try {
    const [xrefs, notes] = await Promise.all([
      fetchAllRows('author_cross_refs'),
      fetchAllRows('author_scripture_notes'),
    ])
    buildMaps(xrefs, notes)

    try {
      localStorage.setItem(BULK_CACHE_KEY, JSON.stringify({ xrefs, notes, savedAt: Date.now() }))
    } catch { /* storage quota exceeded — ignore */ }

    // Tell components to re-render with fresh data
    window.dispatchEvent(new CustomEvent('pb-author-content-ready'))
  } catch (e) {
    // Network failed (offline) — silently keep using whatever cache we have
    console.warn('[authorContent] network refresh skipped (offline?):', e?.message)
  } finally {
    _prefetchInFlight = false
  }
}

/**
 * Invalidate the in-memory bulk cache (e.g. after an author upsert/delete).
 * Forces the next prefetch to re-download from Supabase.
 */
export function invalidateBulkCache() {
  _bulkReady    = false
  _xrefsMap     = null
  _backRefsMap  = null
  _notesMap     = null
  try { localStorage.removeItem(BULK_CACHE_KEY) } catch {}
}

// ─────────────────────────────────────────────
//  Author Scripture Notes
// ─────────────────────────────────────────────

/**
 * Fetch all author notes for a given book + chapter.
 * Returns an array of { id, book, chapter, verse, note, updated_at }
 * Serves from the bulk in-memory cache when available (instant, offline-safe).
 * Falls back to a per-chapter Supabase query → localStorage cache.
 */
export async function fetchAuthorNotes(book, chapter) {
  loadBulkFromStorage()
  if (_bulkReady) {
    return (_notesMap[`${book}:${chapter}`] || [])
      .slice()
      .sort((a, b) => a.verse - b.verse)
  }
  const cacheKey = `notes:${book}:${chapter}`
  try {
    const { data, error } = await supabase
      .from('author_scripture_notes')
      .select('*')
      .eq('book', book)
      .eq('chapter', Number(chapter))
      .order('verse', { ascending: true })
    if (error) throw error
    const result = data || []
    cacheSet(cacheKey, result)
    return result
  } catch (e) {
    console.warn('[authorContent] fetchAuthorNotes:', e?.message)
    return cacheGet(cacheKey) || []
  }
}

/**
 * Create or update an author note.
 * Conflict key: (book, chapter, verse)
 */
export async function upsertAuthorNote({ book, chapter, verse, note }) {
  const { error } = await supabase
    .from('author_scripture_notes')
    .upsert(
      { book, chapter: Number(chapter), verse: Number(verse), note, updated_at: new Date().toISOString() },
      { onConflict: 'book,chapter,verse' }
    )
  if (error) throw error
}

/**
 * Delete an author note by its primary key id.
 */
export async function deleteAuthorNote(id) {
  const { error } = await supabase
    .from('author_scripture_notes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────
//  Author Cross-References
// ─────────────────────────────────────────────

/**
 * Fetch all author cross-refs where the SOURCE is the given book + chapter.
 * Returns an array of:
 *   { id, src_book, src_chapter, src_verse,
 *       tgt_book, tgt_chapter, tgt_verse, label, updated_at }
 * Serves from the bulk in-memory cache when available (instant, offline-safe).
 */
export async function fetchAuthorCrossRefs(book, chapter) {
  loadBulkFromStorage()
  if (_bulkReady) {
    return (_xrefsMap[`${book}:${chapter}`] || [])
      .slice()
      .sort((a, b) => a.src_verse - b.src_verse)
  }
  const cacheKey = `xrefs:${book}:${chapter}`
  try {
    const { data, error } = await supabase
      .from('author_cross_refs')
      .select('*')
      .eq('src_book', book)
      .eq('src_chapter', Number(chapter))
      .order('src_verse', { ascending: true })
    if (error) throw error
    const result = data || []
    cacheSet(cacheKey, result)
    return result
  } catch (e) {
    console.warn('[authorContent] fetchAuthorCrossRefs:', e?.message)
    return cacheGet(cacheKey) || []
  }
}

/**
 * Fetch all author cross-refs where the TARGET is the given book + chapter.
 * Used to display automatic back-references (reverse links) on the target passage.
 * Returns an array of:
 *   { id, src_book, src_chapter, src_verse,
 *       tgt_book, tgt_chapter, tgt_verse, label, updated_at }
 * Serves from the bulk in-memory cache when available (instant, offline-safe).
 */
export async function fetchAuthorBackRefs(book, chapter) {
  loadBulkFromStorage()
  if (_bulkReady) {
    return (_backRefsMap[`${book}:${chapter}`] || [])
      .slice()
      .sort((a, b) => a.src_verse - b.src_verse)
  }
  const cacheKey = `backrefs:${book}:${chapter}`
  try {
    const { data, error } = await supabase
      .from('author_cross_refs')
      .select('*')
      .eq('tgt_book', book)
      .eq('tgt_chapter', Number(chapter))
      .order('src_verse', { ascending: true })
    if (error) throw error
    const result = data || []
    cacheSet(cacheKey, result)
    return result
  } catch (e) {
    console.warn('[authorContent] fetchAuthorBackRefs:', e?.message)
    return cacheGet(cacheKey) || []
  }
}

/**
 * Create or update an author cross-ref.
 * Conflict key: (src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse)
 */
export async function upsertAuthorCrossRef({ src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse, label }) {
  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(
      {
        src_book,
        src_chapter: Number(src_chapter),
        src_verse:   Number(src_verse),
        tgt_book,
        tgt_chapter: Number(tgt_chapter),
        tgt_verse:   tgt_verse != null ? Number(tgt_verse) : null,
        label:       label || null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse' }
    )
  if (error) throw error
}

/**
 * Delete an author cross-ref by its primary key id.
 */
export async function deleteAuthorCrossRef(id) {
  const { error } = await supabase
    .from('author_cross_refs')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────
//  Author Chapter Descriptions
// ─────────────────────────────────────────────

/**
 * Fetch all author chapter descriptions for a given source.
 * Returns an array of { id, source, chapter_key, description, updated_at }
 * `source` is one of: '2lbcf', '1lbcf', 'catechism', 'orthodox'
 * `chapter_key` is the chapter/article/question identifier (string).
 */
export async function fetchChapterDescs(source) {
  const cacheKey = `chdescs:${source}`
  try {
    const { data, error } = await supabase
      .from('author_chapter_descs')
      .select('*')
      .eq('source', source)
    if (error) throw error
    const result = data || []
    cacheSet(cacheKey, result)
    return result
  } catch (e) {
    console.warn('[authorContent] fetchChapterDescs:', e?.message)
    return cacheGet(cacheKey) || []
  }
}

/**
 * Create or update a chapter description.
 * Conflict key: (source, chapter_key)
 */
export async function upsertChapterDesc({ source, chapter_key, description }) {
  const { error } = await supabase
    .from('author_chapter_descs')
    .upsert(
      { source, chapter_key, description, updated_at: new Date().toISOString() },
      { onConflict: 'source,chapter_key' }
    )
  if (error) throw error
}

/**
 * Delete a chapter description by its primary key id.
 */
export async function deleteChapterDesc(id) {
  const { error } = await supabase
    .from('author_chapter_descs')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/* ──────────────────────────────────────────────────────────────────────────────
   SQL MIGRATION — run once in the Supabase SQL editor
   ──────────────────────────────────────────────────────────────────────────────

-- 1) Author scripture notes (verse-level commentary)
create table if not exists author_scripture_notes (
  id          uuid        default gen_random_uuid() primary key,
  book        text        not null,
  chapter     int         not null,
  verse       int         not null,
  note        text        not null default '',
  updated_at  timestamptz default now(),
  unique(book, chapter, verse)
);
alter table author_scripture_notes enable row level security;

-- Everyone can read
create policy "public read author notes"
  on author_scripture_notes for select using (true);

-- Only the author can write (insert / update / delete)
create policy "author write notes"
  on author_scripture_notes for all
  using  (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com')
  with check (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com');

-- 2) Author cross-references (passage links)
create table if not exists author_cross_refs (
  id          uuid        default gen_random_uuid() primary key,
  src_book    text        not null,
  src_chapter int         not null,
  src_verse   int         not null,
  tgt_book    text        not null,
  tgt_chapter int         not null,
  tgt_verse   int,
  label       text,
  updated_at  timestamptz default now(),
  unique(src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse)
);
alter table author_cross_refs enable row level security;

-- Everyone can read
create policy "public read author xrefs"
  on author_cross_refs for select using (true);

-- Only the author can write
create policy "author write xrefs"
  on author_cross_refs for all
  using  (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com')
  with check (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com');

-- 3) Author chapter descriptions (heading-level commentary per chapter/article)
create table if not exists author_chapter_descs (
  id          uuid        default gen_random_uuid() primary key,
  source      text        not null,       -- '2lbcf' | '1lbcf' | 'catechism' | 'orthodox'
  chapter_key text        not null,       -- chapter number / article number / etc. as string
  description text        not null default '',
  updated_at  timestamptz default now(),
  unique(source, chapter_key)
);
alter table author_chapter_descs enable row level security;

-- Everyone can read
create policy "public read chapter descs"
  on author_chapter_descs for select using (true);

-- Only the author can write
create policy "author write chapter descs"
  on author_chapter_descs for all
  using  (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com')
  with check (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com');

   ────────────────────────────────────────────────────────────────────────────── */
