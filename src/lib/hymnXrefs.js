import { HYMN_REFS } from '../data/hymnRefs'

export function getHymnRefs(book, chapter, verse) {
  const results = new Set()
  const chKey = `${book}|${chapter}|0`
  const verKey = `${book}|${chapter}|${verse}`
  // Chapter-level refs only shown on verse 1 to avoid repeating on every verse
  const chHymns = verse === 1 ? (HYMN_REFS[chKey] || []) : []
  const verHymns = verse ? (HYMN_REFS[verKey] || []) : []
  for (const id of [...chHymns, ...verHymns]) results.add(id)
  return [...results]
}
