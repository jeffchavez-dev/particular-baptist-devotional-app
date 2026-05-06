/**
 * Bible-to-Bible cross-reference lookup.
 *
 * Returns parsed cross-references for a given verse from bundled static data.
 * Fully offline — no network requests.
 *
 * Usage:
 *   import { getBibleXrefs, getBibleBackRefs } from '../lib/bibleXrefs'
 *
 *   // Forward: which passages does Matthew 1:2 reference?
 *   const refs = getBibleXrefs('Matthew', 1, 2)
 *   // → [{ book, chapter, verse, display }, ...]
 *
 *   // Backward: which Matthew verses reference Genesis 21:3?
 *   const backRefs = getBibleBackRefs('Genesis', 21, 3)
 *   // → [{ book: 'Matthew', chapter: 1, verse: 2 }, ...]
 */

import { MATTHEW_XREFS } from '../data/matthewCrossRefs'
import { parseRefs } from './parseRefs'

/* ── Forward cache: 'matthew:ch:v' → parsed ref array ── */
const _fwdCache = {}

/**
 * Forward lookup — which passages does a Matthew verse reference?
 */
export function getBibleXrefs(book, chapter, verse) {
  if (book !== 'Matthew') return []

  const key = `${chapter}:${verse}`
  if (!MATTHEW_XREFS[key]) return []

  const cacheKey = `matthew:${key}`
  if (_fwdCache[cacheKey]) return _fwdCache[cacheKey]

  const parsed = parseRefs(MATTHEW_XREFS[key])
  _fwdCache[cacheKey] = parsed
  return parsed
}

/* ── Reverse index: 'Book:ch:v' → [{ book, chapter, verse }, ...] ── */
let _reverseIndex = null

function buildReverseIndex() {
  if (_reverseIndex) return _reverseIndex
  _reverseIndex = {}

  for (const [key, refStr] of Object.entries(MATTHEW_XREFS)) {
    const [chStr, vStr] = key.split(':')
    const matChapter = parseInt(chStr, 10)
    const matVerse   = parseInt(vStr,  10)

    const refs = parseRefs(refStr)
    for (const ref of refs) {
      // Only index verse-exact back-refs (skip chapter-only refs to avoid noise)
      if (!ref.book || !ref.chapter || !ref.verse) continue
      const tgtKey = `${ref.book}:${ref.chapter}:${ref.verse}`
      if (!_reverseIndex[tgtKey]) _reverseIndex[tgtKey] = []
      _reverseIndex[tgtKey].push({ book: 'Matthew', chapter: matChapter, verse: matVerse })
    }
  }

  return _reverseIndex
}

/**
 * Reverse lookup — which static Bible xref passages point TO a given verse?
 * (Currently covers Matthew → rest of Bible.)
 *
 * @param {string} book    - book name, e.g. 'Genesis'
 * @param {number} chapter - chapter number
 * @param {number} verse   - verse number
 * @returns {{ book: string, chapter: number, verse: number }[]}
 */
export function getBibleBackRefs(book, chapter, verse) {
  if (!verse) return []
  const idx = buildReverseIndex()
  return idx[`${book}:${chapter}:${verse}`] || []
}
