/**
 * Bible-to-Bible cross-reference lookup.
 *
 * Returns parsed cross-references for a given verse from bundled static data.
 * Fully offline — no network requests.
 *
 * Usage:
 *   import { getBibleXrefs } from '../lib/bibleXrefs'
 *   const refs = getBibleXrefs('Matthew', 5, 3)
 *   // → [{ book, chapter, verse, display }, ...]
 */

import { MATTHEW_XREFS } from '../data/matthewCrossRefs'
import { parseRefs } from './parseRefs'

/* ── Parsed cache so we don't re-parse on every render ── */
const _cache = {}

/**
 * Look up cross-references for a Bible verse.
 *
 * @param {string} book     - canonical book name, e.g. 'Matthew'
 * @param {number} chapter  - chapter number
 * @param {number} verse    - verse number
 * @returns {{ book: string, chapter: number, verse: number|null, display: string }[]}
 */
export function getBibleXrefs(book, chapter, verse) {
  if (book !== 'Matthew') return []

  const key = `${chapter}:${verse}`
  if (!MATTHEW_XREFS[key]) return []

  const cacheKey = `matthew:${key}`
  if (_cache[cacheKey]) return _cache[cacheKey]

  const parsed = parseRefs(MATTHEW_XREFS[key])
  _cache[cacheKey] = parsed
  return parsed
}
