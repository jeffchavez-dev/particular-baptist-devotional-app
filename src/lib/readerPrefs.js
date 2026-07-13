/**
 * readerPrefs.js
 *
 * Persistent user preferences for the Bible reader.
 *
 * Keys:
 *   'pb-default-version'   — which version opens by default
 *   'pb-visible-versions'  — array of version IDs shown in the picker
 */

const KEY = 'pb-default-version'
const VISIBLE_KEY = 'pb-visible-versions'

export const DEFAULT_VISIBLE_VERSIONS = ['kjv', 'hebrew', 'greek', 'abab']

/**
 * Available default reader options shown in Settings.
 *   'kjv'      — King James Version (English)
 *   'abab'     — Ang Bagong Ang Biblia (Tagalog)
 *   'original' — HOT for OT books, GNT for NT books
 */
export const DEFAULT_VERSION_OPTIONS = [
  { id: 'kjv',      label: 'KJV',      full: 'King James Version' },
  { id: 'abab',     label: 'ABAB',     full: 'Ang Bagong Ang Biblia' },
  { id: 'ceb',      label: 'CEBug',    full: 'Cebuano Ang Biblia (Bugna/Pinadayag)' },
  { id: 'ilocano',  label: 'ILO',      full: 'Ti Biblia — Ilocano ULB' },
  { id: 'nasb',     label: 'NASB',     full: 'New American Standard Bible 1995' },
  { id: 'bsb',      label: 'BSB',      full: 'Berean Standard Bible' },
  { id: 'gnv',      label: 'GNV',      full: 'Geneva Bible (1599)' },
  { id: 'rv',       label: 'RV',       full: 'Revised Version (1895)' },
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

/**
 * Return the set of version IDs the user wants visible in the picker.
 * Falls back to DEFAULT_VISIBLE_VERSIONS for new/guest users.
 */
export function getVisibleVersions() {
  try {
    const raw = localStorage.getItem(VISIBLE_KEY)
    if (!raw) return DEFAULT_VISIBLE_VERSIONS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VISIBLE_VERSIONS
  } catch {
    return DEFAULT_VISIBLE_VERSIONS
  }
}

/**
 * Persist the user's chosen visible version set.
 * @param {string[]} ids
 */
export function setVisibleVersions(ids) {
  try { localStorage.setItem(VISIBLE_KEY, JSON.stringify(ids)) } catch {}
}
