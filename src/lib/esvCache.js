/**
 * ESV chapter cache — localStorage, permanent, per-user device.
 * Key format: esv-{bookSlug}-{chapter}
 * Value: JSON array of {verse, text}
 */

function cacheKey(book, chapter) {
  const slug = book.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  return `esv-${slug}-${chapter}`
}

function readCache(book, chapter) {
  try {
    const raw = localStorage.getItem(cacheKey(book, chapter))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(book, chapter, verses) {
  try {
    localStorage.setItem(cacheKey(book, chapter), JSON.stringify(verses))
  } catch {
    // localStorage full — silently skip, will re-fetch next time
  }
}

/**
 * Returns [{verse, text}] for the given book/chapter.
 * Hits localStorage first; fetches from /api/esv on miss.
 */
export async function getEsvChapter(book, chapter) {
  const cached = readCache(book, chapter)
  if (cached) return cached

  const res = await fetch(`/api/esv?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}`)
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    throw new Error(error || `ESV API error ${res.status}`)
  }

  const { verses } = await res.json()
  if (verses?.length) writeCache(book, chapter, verses)
  return verses ?? []
}

/** How many chapters are cached locally for the given book */
export function esvCachedChapterCount(book) {
  const slug = book.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  const prefix = `esv-${slug}-`
  let count = 0
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i)?.startsWith(prefix)) count++
  }
  return count
}
