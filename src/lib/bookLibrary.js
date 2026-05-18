const KEY = 'pb-book-library'

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getAllBooks() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function _persist(books) {
  const json = JSON.stringify(books)
  localStorage.setItem(KEY, json)      // throws QuotaExceededError if storage is full
  window.dispatchEvent(new CustomEvent('pb-book-library-updated'))
}

export function saveBook(book) {
  const books = getAllBooks()
  books[book.id] = book
  _persist(books)                      // let the error propagate to the UI caller
}

export function deleteBook(id) {
  const books = getAllBooks()
  delete books[id]
  _persist(books)
}

export async function searchBookCovers(title, author = '') {
  const parts = [title.trim(), author.trim()].filter(Boolean)
  if (!parts.length) return []
  const q = parts.map(s => encodeURIComponent(s)).join('+')
  try {
    // No `fields` mask — simpler request is more reliable across API versions
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10&printType=books&langRestrict=en`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || [])
      .filter(item => item.volumeInfo?.imageLinks)
      .map(item => {
        const links = item.volumeInfo.imageLinks
        const raw = links.thumbnail || links.smallThumbnail || links.small || ''
        return {
          id: item.id,
          title: item.volumeInfo.title || '',
          authors: (item.volumeInfo.authors || []).join(', '),
          // Force HTTPS, bump zoom for better quality
          coverUrl: raw.replace(/^http:/, 'https:').replace(/&zoom=\d/, '&zoom=2'),
        }
      })
      .filter(item => item.coverUrl) // drop any that ended up with an empty URL
  } catch { return [] }
}
