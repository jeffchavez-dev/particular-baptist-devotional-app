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

// ── Highlight colour palette ─────────────────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  {
    id: 'yellow', label: 'Yellow',
    dot:    '#f0c040',
    rowBg:  'rgba(255,210,0,0.10)',
    border: 'rgba(200,160,0,0.55)',
    numBg:  'rgba(255,210,0,0.22)',
    numClr: 'rgba(160,120,0,0.9)',
  },
  {
    id: 'green', label: 'Green',
    dot:    '#3db87a',
    rowBg:  'rgba(50,185,100,0.09)',
    border: 'rgba(35,145,70,0.50)',
    numBg:  'rgba(50,185,100,0.20)',
    numClr: 'rgba(25,110,55,0.9)',
  },
  {
    id: 'blue', label: 'Blue',
    dot:    '#4a90e2',
    rowBg:  'rgba(60,130,225,0.09)',
    border: 'rgba(40,100,190,0.50)',
    numBg:  'rgba(60,130,225,0.20)',
    numClr: 'rgba(25,80,165,0.9)',
  },
  {
    id: 'pink', label: 'Pink',
    dot:    '#e25c8a',
    rowBg:  'rgba(225,75,130,0.09)',
    border: 'rgba(185,50,100,0.50)',
    numBg:  'rgba(225,75,130,0.20)',
    numClr: 'rgba(165,40,90,0.9)',
  },
  {
    id: 'purple', label: 'Purple',
    dot:    '#8a5ce2',
    rowBg:  'rgba(130,80,225,0.09)',
    border: 'rgba(100,55,185,0.50)',
    numBg:  'rgba(130,80,225,0.20)',
    numClr: 'rgba(90,40,165,0.9)',
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
export function setHighlight(key, colorId) {
  const all = loadHighlights()
  if (colorId === null || colorId === undefined) delete all[key]
  else all[key] = colorId
  _persist(HL_KEY, all)
  return all
}

export function getHighlight(key) {
  return loadHighlights()[key] || null
}

// ── Note operations ──────────────────────────────────────────────────────────

export function setItemNote(key, text) {
  const all = loadItemNotes()
  if (text && text.trim()) all[key] = text.trim()
  else delete all[key]
  _persist(NOTE_KEY, all)
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
  try {
    const { data, error } = await supabase
      .from('pb_highlights').select('item_key,color').eq('user_id', userId)
    if (!error && data) {
      const obj = {}
      data.forEach(r => { obj[r.item_key] = r.color })
      _persist(HL_KEY, obj)
    }
  } catch (e) { console.warn('[annotations] highlights sync down:', e?.message) }

  try {
    const { data, error } = await supabase
      .from('pb_item_notes').select('item_key,note_text').eq('user_id', userId)
    if (!error && data) {
      const obj = {}
      data.forEach(r => { obj[r.item_key] = r.note_text })
      _persist(NOTE_KEY, obj)
    }
  } catch (e) { console.warn('[annotations] notes sync down:', e?.message) }
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

/** Return all KJV notes as [{ key, note, book, chapter, verse }] */
export function getAllKjvNotes() {
  const all = loadItemNotes()
  return Object.entries(all)
    .filter(([k]) => k.startsWith('kjv|'))
    .map(([k, note]) => {
      const [, book, chapter, verse] = k.split('|')
      return { key: k, note, book, chapter: parseInt(chapter), verse: parseInt(verse) }
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
