const KEY = 'pb-book-library'

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getAllBooks() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function _persist(books) {
  localStorage.setItem(KEY, JSON.stringify(books))
  window.dispatchEvent(new CustomEvent('pb-book-library-updated'))
}

export function saveBook(book) {
  const books = getAllBooks()
  books[book.id] = book
  _persist(books)
}

export function deleteBook(id) {
  const books = getAllBooks()
  delete books[id]
  _persist(books)
}

export async function searchBookCovers(title, author = '') {
  const q = [title.trim(), author.trim()].filter(Boolean).map(s => encodeURIComponent(s)).join('+')
  if (!q) return []
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6&fields=items(id,volumeInfo(title,authors,imageLinks))`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || [])
      .filter(item => item.volumeInfo?.imageLinks)
      .map(item => ({
        id: item.id,
        title: item.volumeInfo.title || '',
        authors: (item.volumeInfo.authors || []).join(', '),
        coverUrl: (item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail || '')
          .replace(/^http:/, 'https:')
          .replace('&zoom=1', '&zoom=2'),
      }))
  } catch { return [] }
}
