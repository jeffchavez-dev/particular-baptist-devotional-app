/**
 * Shared LXX word+Strongs cache and search utilities.
 *
 * lxx-words.json format:
 *   { [bookSlug]: { [chapter]: [ { v: N, words: [ { w: "Greek", s: "G1234" } ] } ] } }
 *
 * This module is imported by KjvReader (reader mode + parallel mode) and
 * StrongsModal ("Find in LXX" results view).
 */

import { BIBLE_BOOKS } from './bibleBooks'

/* ── Module-level cache — shared across all consumers ── */
let _lxxWordsCache   = null
let _lxxWordsPromise = null

/* ── KJV book name → LXX JSON slug overrides ── */
export const LXX_SLUG_OVERRIDES = {
  'songofsolomon': 'songofsongs',
}

/** Normalise a KJV book name to the slug used in lxx-words.json */
export function bookToLxxSlug(bookName) {
  const raw = bookName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  return LXX_SLUG_OVERRIDES[raw] || raw
}

/** Load the full lxx-words.json (lazy, cached, shared promise). */
export function loadLxxWords() {
  if (_lxxWordsCache) return Promise.resolve(_lxxWordsCache)
  if (!_lxxWordsPromise) {
    _lxxWordsPromise = fetch('/lxx-words.json')
      .then(r => { if (!r.ok) throw new Error(`LXX fetch failed: ${r.status}`); return r.json() })
      .then(d => { _lxxWordsCache = d; return d })
      .catch(err => { _lxxWordsPromise = null; throw err }) // allow retry on failure
  }
  return _lxxWordsPromise
}

/** Synchronously return cached data (null if not yet loaded). */
export function getCachedLxxWords() {
  return _lxxWordsCache
}

/**
 * Get the word array for one chapter (synchronous — requires loadLxxWords() to have resolved).
 * Returns array of { v: N, words: [{w, s}] } or null if not found.
 */
export function getLxxChapter(bookName, chapter) {
  if (!_lxxWordsCache) return null
  const slug = bookToLxxSlug(bookName)
  return _lxxWordsCache[slug]?.[String(chapter)] ?? null
}

/**
 * Search all LXX books for verses containing a given Strong's ID.
 * Returns { results: [{book, chapter, verse, w}], total, capped }.
 * Iterates in canonical Bible order (OT only — LXX is OT-only in this dataset).
 */
export function searchLxxByStrongs(strongsId, maxResults = 300) {
  if (!_lxxWordsCache) return { results: [], total: 0, capped: false }
  // Normalize the search ID to a plain integer so zero-padding differences
  // ("G746" vs "G0746") and letter suffixes ("G746a") don't prevent matches.
  // This mirrors the same normalization used by searchGreekByStrongs in greek.js.
  const targetNum = parseInt(
    strongsId.replace(/^[GgHh]/, '').replace(/[A-Za-z]+$/, ''),
    10
  )
  if (isNaN(targetNum)) return { results: [], total: 0, capped: false }

  const results = []
  let total = 0

  for (const book of BIBLE_BOOKS) {
    if (book.testament !== 'OT') continue // LXX covers OT (+ Deuterocanon in data)
    const slug     = bookToLxxSlug(book.name)
    const bookData = _lxxWordsCache[slug]
    if (!bookData) continue

    const chNums = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chNums) {
      const chArr = bookData[String(ch)]
      if (!chArr) continue
      for (const vObj of chArr) {
        const verseNum = vObj.v ?? vObj.verse
        const words    = vObj.words || []
        for (const wd of words) {
          const n = parseInt(
            (wd.s || '').replace(/^[GgHh]/, '').replace(/[A-Za-z]+$/, ''),
            10
          )
          if (n === targetNum) {
            total++
            if (results.length < maxResults) {
              results.push({ book: book.name, chapter: ch, verse: verseNum, w: wd.w })
            }
          }
        }
      }
    }
  }

  return { results, total, capped: total > maxResults }
}
