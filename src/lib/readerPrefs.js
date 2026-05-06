/**
 * readerPrefs.js
 *
 * Persistent user preference for the default Bible reader version
 * (KJV or ABAB). Stored in localStorage so it survives sessions.
 *
 * Key: 'pb-default-version'
 * Values: 'kjv' | 'abab'
 */

const KEY = 'pb-default-version'

/**
 * Available default reader options shown in Settings.
 *   'kjv'      — King James Version (English)
 *   'abab'     — Ang Bagong Ang Biblia (Tagalog)
 *   'original' — HOT for OT books, GNT for NT books
 */
export const DEFAULT_VERSION_OPTIONS = [
  { id: 'kjv',      label: 'KJV',      full: 'King James Version' },
  { id: 'abab',     label: 'ABAB',     full: 'Ang Bagong Ang Biblia' },
  { id: 'nasb',     label: 'NASB',     full: 'New American Standard Bible 1995' },
  { id: 'original', label: 'Original', full: 'HOT (OT) · GNT (NT)' },
]

const VALID_IDS = DEFAULT_VERSION_OPTIONS.map(v => v.id)

/**
 * Given a book name, return the correct original-language version ID.
 * Requires BIBLE_BOOKS to be available in scope where this is used.
 * Returns 'hebrew' for OT, 'greek' for NT.
 */
export function originalVersionForBook(bookName, bibleBooks) {
  if (!bibleBooks) return 'hebrew'
  const found = bibleBooks.find(b => b.name.toLowerCase() === bookName.toLowerCase())
  return found?.testament === 'NT' ? 'greek' : 'hebrew'
}

/**
 * Resolve the effective KjvReader version for a given book when the
 * preference is 'original' (HOT for OT, GNT for NT).
 *
 * @param {'kjv'|'abab'|'original'} pref
 * @param {string} bookName
 * @param {Array}  bibleBooks — BIBLE_BOOKS array
 */
export function resolveVersion(pref, bookName, bibleBooks) {
  if (pref === 'original') return originalVersionForBook(bookName, bibleBooks)
  return pref
}

/**
 * Read the stored default version.
 * Returns 'kjv' if nothing has been saved yet or the value is invalid.
 */
export function getDefaultReaderVersion() {
  try {
    const v = localStorage.getItem(KEY)
    return VALID_IDS.includes(v) ? v : 'kjv'
  } catch {
    return 'kjv'
  }
}

/**
 * Persist the chosen default version preference.
 * @param {'kjv'|'abab'|'original'} version
 */
export function setDefaultReaderVersion(version) {
  if (!VALID_IDS.includes(version)) return
  try { localStorage.setItem(KEY, version) } catch {}
}
