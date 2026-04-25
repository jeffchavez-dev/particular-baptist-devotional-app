/**
 * Reverse cross-reference index.
 *
 * Maps each (book, chapter, verse) triple → array of confession/catechism entries
 * that cite it as a proof text.
 *
 * verse = 0 means the ref cited the whole chapter without a specific verse.
 * Built once lazily on first call; all subsequent lookups are O(1).
 */
import { LBCF2 }     from '../data/lbcf2'
import { LBCF1 }     from '../data/lbcf1'
import { CATECHISM } from '../data/catechism'
import { parseRefs } from './parseRefs'

let _idx = null

function buildIndex() {
  const idx = {}

  function add(book, ch, verse, entry) {
    // verse=null → treat as chapter-level (key ending |0)
    const k = `${book}|${ch}|${verse ?? 0}`
    if (!idx[k]) idx[k] = []
    if (!idx[k].some(e => e.key === entry.key)) idx[k].push(entry)
  }

  /* ── 2nd London Baptist Confession ── */
  for (const [key, item] of Object.entries(LBCF2)) {
    if (!item.refs) continue
    const [ch, par] = key.split('.')
    const entry = {
      src: '2LBCF', key,
      label: `Ch. ${ch} §${par}`,
      detail: item.text?.slice(0, 60) + '…',
      text: item.text,
      refs: item.refs,
    }
    for (const { book, chapter, verse } of parseRefs(item.refs)) {
      add(book, chapter, verse, entry)
    }
  }

  /* ── 1st London Baptist Confession ── */
  for (const [num, item] of Object.entries(LBCF1)) {
    if (!item.refs) continue
    const entry = {
      src: '1LBCF', key: `lbcf1.${num}`,
      label: `Article ${num}${item.title ? ` — ${item.title}` : ''}`,
      detail: item.text?.slice(0, 60) + '…',
      text: item.text,
      refs: item.refs,
    }
    for (const { book, chapter, verse } of parseRefs(item.refs)) {
      add(book, chapter, verse, entry)
    }
  }

  /* ── Keach's Catechism ── */
  for (const [num, item] of Object.entries(CATECHISM)) {
    if (!item.refs) continue
    const entry = {
      src: 'Catechism', key: `cat.${num}`,
      label: `Q&A #${num}`,
      detail: item.q?.slice(0, 60) + '…',
      text: `Q. ${item.q}\n\nA. ${item.a}`,
      refs: item.refs,
    }
    for (const { book, chapter, verse } of parseRefs(item.refs)) {
      add(book, chapter, verse, entry)
    }
  }

  return idx
}

/**
 * Get cross-references for a specific verse within a chapter.
 *
 * Returns confession/catechism entries that cite this exact verse,
 * plus any entries that cite the whole chapter (verse=0) without specifying a verse.
 *
 * If verse is omitted, returns ALL entries that cite any verse of the chapter.
 */
export function getCrossRefs(book, chapter, verse = null) {
  if (!_idx) _idx = buildIndex()

  if (verse !== null) {
    // Verse-specific lookup: exact verse match + chapter-level (verse=0) entries
    const byVerse   = _idx[`${book}|${chapter}|${verse}`] || []
    const byChapter = _idx[`${book}|${chapter}|0`]         || []
    // Merge, deduplicate by key
    const all  = [...byVerse]
    const seen = new Set(byVerse.map(e => e.key))
    for (const e of byChapter) {
      if (!seen.has(e.key)) { seen.add(e.key); all.push(e) }
    }
    return all
  }

  // Chapter-level: collect everything under book|chapter|*
  const prefix = `${book}|${chapter}|`
  const all  = []
  const seen = new Set()
  for (const [k, entries] of Object.entries(_idx)) {
    if (!k.startsWith(prefix)) continue
    for (const e of entries) {
      if (!seen.has(e.key)) { seen.add(e.key); all.push(e) }
    }
  }
  return all
}
