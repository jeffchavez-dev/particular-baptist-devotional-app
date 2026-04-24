/**
 * Reverse cross-reference index.
 *
 * Maps each (book, chapter) pair → array of confession/catechism entries
 * that cite it as a proof text.
 *
 * Built once lazily on first call; all subsequent lookups are O(1).
 */
import { LBCF2 }     from '../data/lbcf2'
import { LBCF1 }     from '../data/lbcf1'
import { CATECHISM } from '../data/catechism'
import { parseRefs } from './parseRefs'

let _idx = null

function buildIndex() {
  const idx = {}

  function add(book, ch, entry) {
    const k = `${book}|${ch}`
    if (!idx[k]) idx[k] = []
    if (!idx[k].some(e => e.key === entry.key)) idx[k].push(entry)
  }

  /* ── 2nd London Baptist Confession ── */
  for (const [key, item] of Object.entries(LBCF2)) {
    if (!item.refs) continue
    const [ch, par] = key.split('.')
    for (const { book, chapter } of parseRefs(item.refs)) {
      add(book, chapter, {
        src: '2LBCF', key,
        label: `Ch. ${ch} §${par}`,
        detail: item.text?.slice(0, 60) + '…',
        text: item.text,
        refs: item.refs,
      })
    }
  }

  /* ── 1st London Baptist Confession ── */
  for (const [num, item] of Object.entries(LBCF1)) {
    if (!item.refs) continue
    for (const { book, chapter } of parseRefs(item.refs)) {
      add(book, chapter, {
        src: '1LBCF', key: `lbcf1.${num}`,
        label: `Article ${num}${item.title ? ` — ${item.title}` : ''}`,
        detail: item.text?.slice(0, 60) + '…',
        text: item.text,
        refs: item.refs,
      })
    }
  }

  /* ── Keach's Catechism ── */
  for (const [num, item] of Object.entries(CATECHISM)) {
    if (!item.refs) continue
    for (const { book, chapter } of parseRefs(item.refs)) {
      add(book, chapter, {
        src: 'Catechism', key: `cat.${num}`,
        label: `Q&A #${num}`,
        detail: item.q?.slice(0, 60) + '…',
        text: `Q. ${item.q}\n\nA. ${item.a}`,
        refs: item.refs,
      })
    }
  }

  return idx
}

/** Returns cross-refs for a given canonical book name + chapter number. */
export function getCrossRefs(book, chapter) {
  if (!_idx) _idx = buildIndex()
  return _idx[`${book}|${chapter}`] || []
}
