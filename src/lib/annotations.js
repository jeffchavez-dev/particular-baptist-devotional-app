/**
 * Unified annotations library
 *
 * Covers: highlights (multi-color), item notes, and search history
 * for all pages (Scripture/KJV, Confessions, Devotional).
 *
 * Key format:
 *   KJV verse:       "kjv|<Book>|<ch>|<verse>"      e.g.  "kjv|Romans|8|28"
 *   Confession para: "conf|2lbcf|<ch.para>"          e.g.  "conf|2lbcf|1.1"
 *   Catechism Q:     "conf|catechism|<num>"           e.g.  "conf|catechism|3"
 *   1LBCF article:   "conf|1lbcf|<num>"               e.g.  "conf|1lbcf|1"
 *   Devotional note: "dev|<day>"                      e.g.  "dev|42"
 *
 * Supabase tables (run this SQL once in your Supabase project):
 *
 *   create table pb_highlights (
 *     id uuid default gen_random_uuid() primary key,
 *     user_id uuid references auth.users(id) on delete cascade not null,
 *     item_key text not null,
 *     color text not null,
 *     updated_at timestamptz default now(),
 *     unique(user_id, item_key)
 *   );
 *   alter table pb_highlights enable row level security;
 *   create policy "own highlights" on pb_highlights for all using (auth.uid() = user_id);
 *
 *   create table pb_item_notes (
 *     id uuid default gen_random_uuid() primary key,
 *     user_id uuid references auth.users(id) on delete cascade not null,
 *     item_key text not null,
 *     note_text text not null,
 *     updated_at timestamptz default now(),
 *     unique(user_id, item_key)
 *   );
 *   alter table pb_item_notes enable row level security;
 *   create policy "own notes" on pb_item_notes for all using (auth.uid() = user_id);
 */

import { supabase } from './supabase'

// ── Local storage keys ──────────────────────────────────────────────────────
const HL_KEY   = 'pb-highlights'      // { key: colorId }
const NOTE_KEY = 'pb-item-notes'      // { key: note_text }
const HIST_KEY = 'pb-search-history'  // { page: [query, ...] }

// ── Retry helper for Supabase operations ─────────────────────────────────────
async function _retrySupabaseOp(fn, maxAttempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const backoff = 500 * Math.pow(2, attempt - 1) // exponential: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, backoff))
      }
    }
  }
  console.error('[annotations] Supabase operation failed after', maxAttempts, 'attempts:', lastError?.message)
  throw lastError
}

// ── Highlight colour palette ─────────────────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  {
    id: 'yellow', label: 'Yellow',
    dot:    '#b88800',
    rowBg:  'rgba(210,155,0,0.35)',
    border: 'rgba(160,110,0,0.90)',
    numBg:  'rgba(210,155,0,0.50)',
    numClr: 'rgba(110,72,0,1)',
  },
  {
    id: 'green', label: 'Green',
    dot:    '#1f8a50',
    rowBg:  'rgba(28,140,65,0.32)',
    border: 'rgba(18,100,44,0.88)',
    numBg:  'rgba(28,140,65,0.46)',
    numClr: 'rgba(12,72,30,1)',
  },
  {
    id: 'blue', label: 'Blue',
    dot:    '#1a62c0',
    rowBg:  'rgba(28,95,195,0.32)',
    border: 'rgba(16,65,160,0.88)',
    numBg:  'rgba(28,95,195,0.46)',
    numClr: 'rgba(10,48,130,1)',
  },
  {
    id: 'pink', label: 'Pink',
    dot:    '#b82060',
    rowBg:  'rgba(185,30,90,0.30)',
    border: 'rgba(148,16,68,0.88)',
    numBg:  'rgba(185,30,90,0.44)',
    numClr: 'rgba(118,10,52,1)',
  },
  {
    id: 'purple', label: 'Purple',
    dot:    '#5c28c8',
    rowBg:  'rgba(92,38,195,0.30)',
    border: 'rgba(68,22,155,0.88)',
    numBg:  'rgba(92,38,195,0.44)',
    numClr: 'rgba(52,14,125,1)',
  },
]

export function getHlStyle(colorId) {
  return HIGHLIGHT_COLORS.find(c => c.id === colorId) || HIGHLIGHT_COLORS[0]
}

// ── Local storage helpers ─────────────────────────────────────────────────────

function _migrateKjv(data) {
  // One-time migration of old per-app keys
  let dirty = false
  try {
    const oldHl = JSON.parse(localStorage.getItem('kjv-highlights') || '{}')
    Object.entries(oldHl).forEach(([k, v]) => {
      const newKey = `kjv|${k}`
      if (!data[newKey]) { data[newKey] = 'yellow'; dirty = true }
    })
    if (Object.keys(oldHl).length) localStorage.removeItem('kjv-highlights')
  } catch {}
  return dirty
}

export function loadHighlights() {
  try {
    const data = JSON.parse(localStorage.getItem(HL_KEY) || '{}')
    if (_migrateKjv(data)) localStorage.setItem(HL_KEY, JSON.stringify(data))
    return data
  } catch { return {} }
}

function _migrateKjvNotes(data) {
  let dirty = false
  try {
    const old = JSON.parse(localStorage.getItem('kjv-verse-notes') || '{}')
    Object.entries(old).forEach(([k, v]) => {
      const newKey = `kjv|${k}`
      if (!data[newKey]) { data[newKey] = v; dirty = true }
    })
    if (Object.keys(old).length) localStorage.removeItem('kjv-verse-notes')
  } catch {}
  return dirty
}

export function loadItemNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(NOTE_KEY) || '{}')
    if (_migrateKjvNotes(data)) localStorage.setItem(NOTE_KEY, JSON.stringify(data))
    return data
  } catch { return {} }
}

function _persist(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)) } catch {}
}

// ── Highlight operations ──────────────────────────────────────────────────────

/** colorId: one of HIGHLIGHT_COLORS ids, or null to remove */
export function setHighlight(key, colorId, userId) {
  const all = loadHighlights()
  if (colorId === null || colorId === undefined) delete all[key]
  else all[key] = colorId
  _persist(HL_KEY, all)
  
  // Dispatch event for immediate UI updates
  window.dispatchEvent(new CustomEvent('pb-highlight-changed', {
    detail: { key, colorId, highlights: all },
  }))
  
  // Async Supabase sync with retry (fire-and-forget, but with proper error handling)
  if (userId) {
    if (colorId === null || colorId === undefined) {
      _retrySupabaseOp(
        () => supabase.from('pb_highlights').delete().match({ user_id: userId, item_key: key })
      ).catch(e => console.warn('[setHighlight] delete failed:', e?.message))
    } else {
      _retrySupabaseOp(
        () => supabase.from('pb_highlights').upsert(
          { user_id: userId, item_key: key, color: colorId, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,item_key' }
        )
      ).catch(e => console.warn('[setHighlight] upsert failed:', e?.message))
    }
  }
  return all
}

export function getHighlight(key) {
  return loadHighlights()[key] || null
}

// ── Note operations ──────────────────────────────────────────────────────────

export function setItemNote(key, text, userId) {
  const all = loadItemNotes()
  if (text && text.trim()) all[key] = text.trim()
  else delete all[key]
  _persist(NOTE_KEY, all)
  
  // Dispatch event for immediate UI updates
  window.dispatchEvent(new CustomEvent('pb-note-changed', {
    detail: { key, text: text?.trim() || null, notes: all },
  }))
  
  // Async Supabase sync with retry (fire-and-forget, but with proper error handling)
  if (userId) {
    if (!text || !text.trim()) {
      _retrySupabaseOp(
        () => supabase.from('pb_item_notes').delete().match({ user_id: userId, item_key: key })
      ).catch(e => console.warn('[setItemNote] delete failed:', e?.message))
    } else {
      _retrySupabaseOp(
        () => supabase.from('pb_item_notes').upsert(
          { user_id: userId, item_key: key, note_text: text.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,item_key' }
        )
      ).catch(e => console.warn('[setItemNote] upsert failed:', e?.message))
    }
  }
  return all
}

export function getItemNote(key) {
  return loadItemNotes()[key] || null
}

// ── Search history ────────────────────────────────────────────────────────────
const MAX_HIST = 12

export function loadSearchHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '{}') } catch { return {} }
}

export function addSearchHistory(page, query) {
  if (!query?.trim()) return
  const all = loadSearchHistory()
  const list = (all[page] || []).filter(q => q !== query.trim())
  all[page] = [query.trim(), ...list].slice(0, MAX_HIST)
  _persist(HIST_KEY, all)
}

export function getSearchHistory(page) {
  return loadSearchHistory()[page] || []
}

export function clearSearchHistory(page) {
  const all = loadSearchHistory()
  delete all[page]
  _persist(HIST_KEY, all)
}

export function removeSearchEntry(page, query) {
  const all = loadSearchHistory()
  all[page] = (all[page] || []).filter(q => q !== query)
  _persist(HIST_KEY, all)
}

// ── Supabase sync ─────────────────────────────────────────────────────────────
// Gracefully no-ops if the pb_highlights / pb_item_notes tables don't exist.

export async function syncAnnotationsUp(userId) {
  const highlights = loadHighlights()
  const notes      = loadItemNotes()
  const ts = new Date().toISOString()
  try {
    const hlRows = Object.entries(highlights).map(([item_key, color]) => ({
      user_id: userId, item_key, color, updated_at: ts,
    }))
    if (hlRows.length) {
      await supabase.from('pb_highlights').upsert(hlRows, { onConflict: 'user_id,item_key' })
    }
  } catch (e) { console.warn('[annotations] highlights sync up:', e?.message) }

  try {
    const noteRows = Object.entries(notes).map(([item_key, note_text]) => ({
      user_id: userId, item_key, note_text, updated_at: ts,
    }))
    if (noteRows.length) {
      await supabase.from('pb_item_notes').upsert(noteRows, { onConflict: 'user_id,item_key' })
    }
  } catch (e) { console.warn('[annotations] notes sync up:', e?.message) }
}

export async function syncAnnotationsDown(userId) {
  let hlMerged  = loadHighlights()
  let noteMerged = loadItemNotes()
  let changed = false

  try {
    const { data, error } = await supabase
      .from('pb_highlights').select('item_key,color').eq('user_id', userId)
    if (!error && data && data.length > 0) {
      // Merge: Supabase wins for items it knows about; local-only items survive
      data.forEach(r => { hlMerged[r.item_key] = r.color })
      _persist(HL_KEY, hlMerged)
      changed = true
    }
  } catch (e) { console.warn('[annotations] highlights sync down:', e?.message) }

  try {
    const { data, error } = await supabase
      .from('pb_item_notes').select('item_key,note_text').eq('user_id', userId)
    if (!error && data && data.length > 0) {
      data.forEach(r => { noteMerged[r.item_key] = r.note_text })
      _persist(NOTE_KEY, noteMerged)
      changed = true
    }
  } catch (e) { console.warn('[annotations] notes sync down:', e?.message) }

  // Notify any open components to refresh their state from localStorage
  if (changed) {
    window.dispatchEvent(new CustomEvent('pb-annotations-updated', {
      detail: { highlights: hlMerged, notes: noteMerged },
    }))
  }
}

// ── Derived helpers for the Settings/About page ───────────────────────────────

/** Return all KJV highlights as [{ key, colorId, book, chapter, verse }] */
export function getAllKjvHighlights() {
  const all = loadHighlights()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('kjv|'))
    .map(([k, colorId]) => {
      const [, book, chapter, verse] = k.split('|')
      return { key: k, colorId, book, chapter: parseInt(chapter), verse: parseInt(verse) }
    })
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse)
}

/** Return all KJV notes as [{ key, note, book, chapter, verse, createdAt }]
 *  createdAt is extracted from rich-note JSON when present (library-tagged notes),
 *  or null for plain inline scripture notes. */
export function getAllKjvNotes() {
  const all = loadItemNotes()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('kjv|'))
    .map(([k, note]) => {
      const [, book, chapter, verse] = k.split('|')
      let createdAt = null
      try {
        if (note && note.startsWith('<!RICH>'))
          createdAt = JSON.parse(note.slice(7)).createdAt || null
      } catch {}
      return { key: k, note, book, chapter: parseInt(chapter), verse: parseInt(verse), createdAt }
    })
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse)
}

/** Return all confession highlights as [{ key, colorId, source, itemKey }] */
export function getAllConfHighlights() {
  const all = loadHighlights()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('conf|'))
    .map(([k, colorId]) => {
      const [, source, itemKey] = k.split('|')
      return { key: k, colorId, source, itemKey }
    })
}

/** Return all personal (library) notes as [{ key, note, createdAt }] */
export function getAllLibNotes() {
  const all = loadItemNotes()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('lib|'))
    .map(([k, note]) => {
      // key format: "lib|{isoTimestamp}"
      return { key: k, note, createdAt: k.slice(4) }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Return all confession notes as [{ key, note, source, itemKey }] */
export function getAllConfNotes() {
  const all = loadItemNotes()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('conf|'))
    .map(([k, note]) => {
      const [, source, itemKey] = k.split('|')
      return { key: k, note, source, itemKey }
    })
}

// ── Scripture chapter bookmarks ───────────────────────────────────────────────
const SC_BM_KEY = 'pb-scripture-bookmarks'  // { "Book|ch": isoTimestamp }

export function getScriptureBookmarks() {
  try { return JSON.parse(localStorage.getItem(SC_BM_KEY) || '{}') } catch { return {} }
}

export function toggleScriptureBookmark(book, chapter) {
  const all = getScriptureBookmarks()
  const key = `${book}|${chapter}`
  if (all[key]) delete all[key]
  else all[key] = new Date().toISOString()
  try { localStorage.setItem(SC_BM_KEY, JSON.stringify(all)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-sc-bookmark-changed', {
    detail: { book, chapter, bookmarks: all },
  }))
  return all
}

export function isScriptureBookmarked(book, chapter) {
  return !!(getScriptureBookmarks()[`${book}|${chapter}`])
}

export function getAllScriptureBookmarks() {
  const all = getScriptureBookmarks()
  return Object.entries(all)
    .map(([k, ts]) => {
      const [book, ch] = k.split('|')
      return { key: k, book, chapter: parseInt(ch), savedAt: ts }
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt)) // newest first
}

// ── Clear all highlights and notes ───────────────────────────────────────────

/** Clear all highlights from localStorage and Supabase (if userId provided) */
export async function clearAllHighlights(userId) {
  try {
    _persist(HL_KEY, {})
    
    // Dispatch event for immediate UI update
    window.dispatchEvent(new CustomEvent('pb-highlight-changed', {
      detail: { key: null, colorId: null, highlights: {} },
    }))
    
    if (userId) {
      await _retrySupabaseOp(
        () => supabase.from('pb_highlights').delete().eq('user_id', userId)
      ).catch(e => console.warn('[clearAllHighlights] failed:', e?.message))
    }
    
    return { success: true }
  } catch (e) {
    console.error('[clearAllHighlights]', e?.message)
    throw e
  }
}

/** Clear all notes from localStorage and Supabase (if userId provided) */
export async function clearAllNotes(userId) {
  try {
    _persist(NOTE_KEY, {})
    
    // Dispatch event for immediate UI update
    window.dispatchEvent(new CustomEvent('pb-note-changed', {
      detail: { key: null, text: null, notes: {} },
    }))
    
    if (userId) {
      await _retrySupabaseOp(
        () => supabase.from('pb_item_notes').delete().eq('user_id', userId)
      ).catch(e => console.warn('[clearAllNotes] failed:', e?.message))
    }
    
    return { success: true }
  } catch (e) {
    console.error('[clearAllNotes]', e?.message)
    throw e
  }
}
