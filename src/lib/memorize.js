/**
 * memorize.js
 *
 * Two memory slots:
 *   pb-memorize-verse  — a single scripture verse
 *   pb-memorize-note   — a single book note or quote
 *
 * Shape:
 *   verse: { verseKey, ref, text, version, savedAt }
 *   note:  { noteId, bookId, bookTitle, bookAuthor, type, text, page, percent, savedAt }
 *
 * Any component that writes a slot dispatches 'pb-memorize-changed' so the
 * Dashboard can refresh without a page reload.
 */

const VERSE_KEY = 'pb-memorize-verse'
const NOTE_KEY  = 'pb-memorize-note'

function dispatch() {
  window.dispatchEvent(new Event('pb-memorize-changed'))
}

// ── Verse slot ────────────────────────────────────────────────────────────
export function getMemorizeVerse() {
  try {
    const raw = localStorage.getItem(VERSE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** @param {{ verseKey, ref, text, version }} verse */
export function setMemorizeVerse(verse) {
  try {
    localStorage.setItem(VERSE_KEY, JSON.stringify({ ...verse, savedAt: new Date().toISOString() }))
    dispatch()
  } catch {}
}

export function clearMemorizeVerse() {
  try { localStorage.removeItem(VERSE_KEY); dispatch() } catch {}
}

// ── Note slot ─────────────────────────────────────────────────────────────
export function getMemorizeNote() {
  try {
    const raw = localStorage.getItem(NOTE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** @param {{ noteId, bookId, bookTitle, bookAuthor, type, text, page, percent }} note */
export function setMemorizeNote(note) {
  try {
    localStorage.setItem(NOTE_KEY, JSON.stringify({ ...note, savedAt: new Date().toISOString() }))
    dispatch()
  } catch {}
}

export function clearMemorizeNote() {
  try { localStorage.removeItem(NOTE_KEY); dispatch() } catch {}
}
