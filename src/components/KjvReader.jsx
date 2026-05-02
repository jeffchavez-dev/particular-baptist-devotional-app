import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle } from 'react'
import { useNavigate } from 'react-router-dom'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { getCrossRefs } from '../lib/crossRef'
import { loadBibleVersion, getVersionMetadata, BIBLE_VERSIONS } from '../lib/bibleVersions'
import { loadGreek, getGreekChapter, parseGrammar, parseMorphDetails, getMsMarker, NT_BOOKS } from '../lib/greek'
import { loadHebrew, getHebrewChapter, parseHebrewMorph, parseHebrewMorphDetails, getHebMsMarker, OT_BOOKS } from '../lib/hebrew'
import { loadLxxWords, bookToLxxSlug } from '../lib/lxx'
import ShareCardModal from './ShareCardModal'
import ConfessionModal from './ConfessionModal'
import StrongsModal from './StrongsModal'
import { usePrefs, useAuth } from '../App'
import { getFontCss, getGreekFontCss, getHebrewFontCss } from './FontPrefsPanel'
import {
  HIGHLIGHT_COLORS, getHlStyle,
  loadHighlights, loadItemNotes,
  setHighlight, setItemNote,
  addSearchHistory, getSearchHistory, clearSearchHistory, removeSearchEntry,
} from '../lib/annotations'
import {
  isAuthor,
  fetchAuthorNotes, upsertAuthorNote, deleteAuthorNote,
  fetchAuthorCrossRefs, upsertAuthorCrossRef, deleteAuthorCrossRef,
  fetchAuthorBackRefs,
} from '../lib/authorContent'
import { saveElementScroll, restoreElementScroll } from '../lib/pageState'

/* ── Module-level version data cache — per version ── */
const _versionDataCache = {}

function bookSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

async function loadBibleData(version = 'kjv') {
  return await loadBibleVersion(version)
}

function stripFootnotes(text, chapter, version = 'kjv') {
  // Only KJV has footnotes in this format
  if (version !== 'kjv') return text
  return text.replace(new RegExp(`\\.${chapter}\\.\\d+[\\s\\S]*$`), '.').trim()
}

function getChapterVerses(versionData, bookName, ch, version = 'kjv') {
  if (!versionData) return null
  const slug = bookSlug(bookName)
  const raw = versionData[slug]?.[ch]
  if (!raw) return null
  const seen = new Set()
  return raw
    .filter(v => {
      if (seen.has(v.v)) return false
      seen.add(v.v)
      return true
    })
    .map(v => ({ verse: v.v, text: stripFootnotes(v.t, ch, version) }))
}

export async function fetchKjvChapter(bookName, ch, version = 'kjv') {
  const versionData = await loadBibleData(version)
  const verses = getChapterVerses(versionData, bookName, ch, version)
  if (!verses) throw new Error(`${bookName} ${ch} not found in ${version} data`)
  return verses
}

/* ── Slug → canonical book name map (built once) ── */
const SLUG_TO_BOOK = Object.fromEntries(
  BIBLE_BOOKS.map(b => [b.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''), b.name])
)

/**
 * Search a specific Bible version — returns up to maxResults matches in canonical order.
 * Returns { hits, total, capped } where total is the actual count across the whole Bible.
 * Pass maxResults = Infinity to load everything.
 */
function searchBibleVersion(versionData, query, version = 'kjv', maxResults = 200) {
  if (!versionData || !query.trim()) return { hits: [], total: 0, capped: false }
  const q = query.trim().toLowerCase()
  const hits = []
  let total = 0
  for (const book of BIBLE_BOOKS) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const bookData = versionData[slug]
    if (!bookData) continue
    const chapterNums = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chapterNums) {
      const verses = bookData[ch]
      if (!verses) continue
      const seen = new Set()
      for (const v of verses) {
        if (seen.has(v.v)) continue
        seen.add(v.v)
        if (v.t && v.t.toLowerCase().includes(q)) {
          total++
          if (hits.length < maxResults) {
            hits.push({ book: book.name, chapter: ch, verse: v.v, text: stripFootnotes(v.t, ch, version) })
          }
        }
      }
    }
  }
  return { hits, total, capped: total > maxResults }
}

/* ── Bible category structure ── */
const OT_CATS = [
  { id:'law',    label:'The Law',          color:'#7c5230', bg:'#fdf3e3', books:['Genesis','Exodus','Leviticus','Numbers','Deuteronomy'] },
  { id:'hist1',  label:'History',          color:'#5a3e8c', bg:'#f0ecfa', books:['Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther'] },
  { id:'wisdom', label:'Psalms & Wisdom',  color:'#1d6b5a', bg:'#e4f0ec', books:['Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon'] },
  { id:'major',  label:'Major Prophets',   color:'#8c3e3e', bg:'#faeaea', books:['Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel'] },
  { id:'minor',  label:'Minor Prophets',   color:'#3e5a8c', bg:'#e8eefa', books:['Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'] },
]
const NT_CATS = [
  { id:'gospels',label:'Gospels',          color:'#1d6b5a', bg:'#e4f0ec', books:['Matthew','Mark','Luke','John'] },
  { id:'acts',   label:'History',          color:'#5a3e8c', bg:'#f0ecfa', books:['Acts'] },
  { id:'pauline',label:'Pauline Letters',  color:'#7c5230', bg:'#fdf3e3', books:['Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon'] },
  { id:'general',label:'General Epistles', color:'#3e5a8c', bg:'#e8eefa', books:['Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'] },
]

const BOOK_META = Object.fromEntries(BIBLE_BOOKS.map(b => [b.name, b]))

/** Get the chapter that follows a given book/chapter (or null at end of Bible) */
function getNextChapter(bookName, ch) {
  const meta = BOOK_META[bookName]
  if (!meta) return null
  if (ch < meta.chapters) return { book: bookName, chapter: ch + 1 }
  const idx = BIBLE_BOOKS.findIndex(b => b.name === bookName)
  if (idx >= 0 && idx < BIBLE_BOOKS.length - 1) return { book: BIBLE_BOOKS[idx + 1].name, chapter: 1 }
  return null
}

function getPrevChapter(bookName, ch) {
  if (ch > 1) return { book: bookName, chapter: ch - 1 }
  const idx = BIBLE_BOOKS.findIndex(b => b.name === bookName)
  if (idx > 0) {
    const prevBook = BIBLE_BOOKS[idx - 1]
    const prevMeta = BOOK_META[prevBook.name]
    return { book: prevBook.name, chapter: prevMeta?.chapters || 1 }
  }
  return null // Genesis 1 — nothing before
}

/** Stable DOM id for a given verse (book/chapter/verse) */
function verseId(bookName, ch, verse) {
  return `v-${bookName.replace(/\s+/g, '')}-${ch}-${verse}`
}

function loadReaderPosition(version) {
  try {
    const saved = JSON.parse(localStorage.getItem(`bible-reader-${version}`) || 'null')
    if (saved?.book && saved?.chapter) {
      return { book: saved.book, chapter: parseInt(saved.chapter, 10) || 1 }
    }
    return {
      book: localStorage.getItem(`bible-book-${version}`) || 'Genesis',
      chapter: parseInt(localStorage.getItem(`bible-chapter-${version}`) || '1', 10) || 1,
    }
  } catch {
    return { book: 'Genesis', chapter: 1 }
  }
}

function saveReaderAnchor(version, root) {
  if (!root) return
  try {
    const rootTop = root.getBoundingClientRect().top
    const verses = root.querySelectorAll('[data-anchor-book][data-anchor-chapter][data-anchor-verse]')
    let target = null
    for (const el of verses) {
      if (el.getBoundingClientRect().bottom >= rootTop + 8) {
        target = el
        break
      }
    }
    if (!target) return
    const rect = target.getBoundingClientRect()
    const payload = {
      book: target.dataset.anchorBook,
      chapter: parseInt(target.dataset.anchorChapter, 10) || 1,
      verse: parseInt(target.dataset.anchorVerse, 10) || null,
      offset: Math.round(rect.top - rootTop),
    }
    localStorage.setItem(`bible-reader-${version}`, JSON.stringify(payload))
  } catch {}
}

function restoreReaderAnchor(version, root) {
  if (!root) return false
  try {
    const saved = JSON.parse(localStorage.getItem(`bible-reader-${version}`) || 'null')
    if (!saved?.book || !saved?.chapter || !saved?.verse) return false
    requestAnimationFrame(() => {
      const selector = `[data-anchor-book="${CSS.escape(saved.book)}"][data-anchor-chapter="${saved.chapter}"][data-anchor-verse="${saved.verse}"]`
      const el = root.querySelector(selector)
      if (!el) return
      const rootTop = root.getBoundingClientRect().top
      const rect = el.getBoundingClientRect()
      root.scrollTop += rect.top - rootTop - (saved.offset || 0)
    })
    return true
  } catch {
    return false
  }
}

/* ── Source chip colours for cross-references ── */
const SRC_CHIP = {
  '2LBCF':    { bg:'rgba(61,43,107,0.10)',  color:'#3d2b6b', border:'rgba(61,43,107,0.2)'  },
  'Catechism':{ bg:'rgba(29,107,90,0.10)',  color:'#1d6b5a', border:'rgba(29,107,90,0.2)'  },
  '1LBCF':    { bg:'rgba(124,82,48,0.10)', color:'#7c5230', border:'rgba(124,82,48,0.2)' },
  'Orthodox': { bg:'rgba(12,74,110,0.10)', color:'#0c4a6e', border:'rgba(12,74,110,0.2)' },
}

/* ── Highlight colour picker popup ── */
function ColorPicker({ currentColor, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  return (
    <div ref={ref} style={r.colorPicker}>
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c.id}
          title={c.label}
          onClick={() => { onSelect(currentColor === c.id ? null : c.id); onClose() }}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: c.dot, border: 'none', cursor: 'pointer', padding: 0,
            outline: currentColor === c.id ? `3px solid ${c.border}` : '2px solid transparent',
            outlineOffset: 1, transition: 'outline 0.1s, transform 0.1s',
            transform: currentColor === c.id ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
      {currentColor && (
        <button
          title="Remove highlight"
          onClick={() => { onSelect(null); onClose() }}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: 'var(--border-strong)',
            border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  )
}

/* ── Search history dropdown ── */
function SearchHistoryDropdown({ history, onSelect, onRemove, onClear, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  if (!history.length) return null
  return (
    <div ref={ref} style={r.histDropdown}>
      <div style={r.histHeader}>
        <span style={r.histTitle}>Recent searches</span>
        <button style={r.histClearAll} onClick={() => { onClear(); onClose() }}>Clear all</button>
      </div>
      {history.map(q => (
        <div key={q} style={r.histRow}>
          <button style={r.histItem} onClick={() => { onSelect(q); onClose() }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{flexShrink:0, opacity:0.4}}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5.5 3v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={r.histItemText}>{q}</span>
          </button>
          <button style={r.histRemove} onClick={() => onRemove(q)} title="Remove">×</button>
        </div>
      ))}
    </div>
  )
}

/* ── Bible search results panel — grouped by book, collapsible ── */
function BibleResultsPanel({ bibleResults, searchQuery, onNavigate, onClose, readerRef, total, capped, onLoadMore, searching }) {
  const [openBooks, setOpenBooks] = useState(() => new Set())

  function toggleBook(bookName) {
    setOpenBooks(prev => {
      const next = new Set(prev)
      next.has(bookName) ? next.delete(bookName) : next.add(bookName)
      return next
    })
  }

  function expandAll() {
    setOpenBooks(new Set(grouped.map(g => g.book)))
  }
  function collapseAll() {
    setOpenBooks(new Set())
  }

  /* Group by book, preserving canonical order */
  const grouped = useMemo(() => {
    const map = new Map()
    for (const hit of bibleResults) {
      if (!map.has(hit.book)) map.set(hit.book, [])
      map.get(hit.book).push(hit)
    }
    return BIBLE_BOOKS
      .filter(b => map.has(b.name))
      .map(b => ({ book: b.name, hits: map.get(b.name) }))
  }, [bibleResults])

  const q = searchQuery.trim()
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  function hlText(text) {
    try {
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
      if (parts.length === 1) return text
      return parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} style={{ background:'#fef08a', color:'inherit', borderRadius:2, padding:'0 1px' }}>{p}</mark>
          : p
      )
    } catch { return text }
  }

  const allOpen = grouped.every(g => openBooks.has(g.book))

  return (
    <div>
      {/* Results header */}
      <div style={r.srHeader}>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={r.srTitle}>
            {bibleResults.length === 0
              ? `No results for "${q}"`
              : capped
                ? `${bibleResults.length.toLocaleString()} of ${total.toLocaleString()} verse${total !== 1 ? 's' : ''} found`
                : `${total.toLocaleString()} verse${total !== 1 ? 's' : ''} found`
            }
          </span>
          {bibleResults.length > 0 && (
            <span style={{ fontSize:12, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif" }}>
              across {grouped.length} book{grouped.length !== 1 ? 's' : ''} — <em>"{q}"</em>
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {bibleResults.length > 0 && (
            <button
              style={{ ...r.srClose, fontSize:11, padding:'4px 8px' }}
              onClick={allOpen ? collapseAll : expandAll}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
          <button style={r.srClose} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            Close
          </button>
        </div>
      </div>

      {/* Load-all banner — shown when results are capped */}
      {capped && (
        <div style={r.srLoadMoreBar}>
          <span style={{ fontSize:12, color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif" }}>
            Showing first {bibleResults.length.toLocaleString()} of {total.toLocaleString()} matches
          </span>
          <button
            style={r.srLoadMoreBtn}
            onClick={onLoadMore}
            disabled={searching}
          >
            {searching ? 'Loading…' : `Load all ${total.toLocaleString()} results`}
          </button>
        </div>
      )}

      {bibleResults.length === 0 ? (
        <p style={{ fontSize:13, color:'var(--ink-faint)', textAlign:'center', padding:'2rem' }}>
          Try a different word or phrase.
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {grouped.map(({ book: bookName, hits }) => {
            const isOpen = openBooks.has(bookName)
            return (
              <div key={bookName} style={r.srBookGroup}>
                {/* Book header — click to expand/collapse */}
                <button style={r.srBookHeader} onClick={() => toggleBook(bookName)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    style={{
                      flexShrink:0, transition:'transform 0.18s',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      color:'var(--ink-faint)',
                    }}>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={r.srBookName}>{bookName}</span>
                  <span style={r.srBookCount}>
                    {hits.length} verse{hits.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Verse rows — shown when open */}
                {isOpen && (
                  <div style={r.srVerseList}>
                    {hits.map(hit => (
                      <button
                        key={`${hit.book}|${hit.chapter}|${hit.verse}`}
                        style={r.srRow}
                        onClick={() => {
                          onNavigate(hit.book, hit.chapter)
                          onClose()
                          setTimeout(() => {
                            const el = readerRef.current?.querySelector(`#${verseId(hit.book, hit.chapter, hit.verse)}`)
                            if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
                          }, 200)
                        }}
                      >
                        <span style={r.srRef}>{hit.book} {hit.chapter}:{hit.verse}</span>
                        <span style={r.srText}>{hlText(hit.text)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {capped && (
            <p style={{ fontSize:11, color:'var(--ink-faint)', textAlign:'center', padding:'8px 0', fontFamily:"'DM Sans',sans-serif" }}>
              Use the "Load all" button above to see all {total.toLocaleString()} results.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Sidebar ── */
function BookSidebar({ selectedBook, selectedChapter, onNavigate, onClose, isMobile, ntOnly, otOnly }) {
  const [openCats, setOpenCats] = useState(() => new Set())
  const [expandedBook, setExpandedBook] = useState(selectedBook)

  function toggleCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBookClick(bookName) {
    const meta = BOOK_META[bookName]
    const chCount = meta?.chapters || 1
    if (chCount === 1) {
      onNavigate(bookName, 1)
      if (isMobile && onClose) onClose()
    } else {
      setExpandedBook(prev => prev === bookName ? null : bookName)
    }
  }

  function handleChapterClick(bookName, ch) {
    onNavigate(bookName, ch)
    if (isMobile && onClose) onClose()
  }

  const renderTestament = (label, cats, badgeBg, badgeColor, testId) => (
    <div style={sb.testSection} key={testId}>
      <div style={sb.testHeader}>
        <span style={{ ...sb.testBadge, background:badgeBg, color:badgeColor }}>{testId}</span>
        <span style={sb.testLabel}>{label}</span>
      </div>
      {cats.map(cat => (
        <div key={cat.id}>
          <button
            style={{ ...sb.catBtn, background: openCats.has(cat.id) ? cat.bg : 'transparent' }}
            onClick={() => toggleCat(cat.id)}
          >
            <span style={{ ...sb.catLabel, color: cat.color }}>{cat.label}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ flexShrink:0, transition:'transform 0.18s', transform: openCats.has(cat.id) ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)' }}>
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {openCats.has(cat.id) && (
            <div style={sb.bookList}>
              {cat.books.filter(b => BOOK_META[b]).map(b => {
                const chCount = BOOK_META[b]?.chapters || 1
                const isReading  = selectedBook === b
                const isExpanded = expandedBook === b
                return (
                  <div key={b}>
                    <button
                      style={{
                        ...sb.bookBtn,
                        ...(isReading ? { background: cat.bg, color: cat.color, fontWeight:700, borderLeft:`3px solid ${cat.color}` } : {}),
                      }}
                      onClick={() => handleBookClick(b)}
                    >
                      <span>{b}</span>
                      <span style={sb.bookMeta}>
                        {chCount === 1 ? '1 ch' : `${chCount} ch`}
                        {chCount > 1 && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                            style={{ marginLeft:3, transition:'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', opacity:0.5 }}>
                            <path d="M3 2l3.5 3L3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        )}
                      </span>
                    </button>
                    {isExpanded && chCount > 1 && (
                      <div style={sb.chapterGrid}>
                        {Array.from({ length: chCount }, (_, i) => i + 1).map(ch => (
                          <button
                            key={ch}
                            style={{
                              ...sb.chapterBtn,
                              ...(isReading && selectedChapter === ch
                                ? { background: cat.color, color:'white', fontWeight:700, borderColor: cat.color }
                                : {}),
                            }}
                            onClick={() => handleChapterClick(b, ch)}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div style={sb.sidebar}>
      <div style={sb.sidebarTitle}>Books</div>
      {!ntOnly && renderTestament('Old Testament', OT_CATS, 'var(--amber-soft)', 'var(--amber-ink)', 'OT')}
      {!otOnly && renderTestament('New Testament', NT_CATS, 'var(--purple-soft)', 'var(--purple-ink)', 'NT')}
    </div>
  )
}

/* ── Main Bible Reader (KJV, ABAB, etc.) ── */
const KjvReader = React.forwardRef(function KjvReader({ version = 'kjv', onVersionChange, todayChapter, onNavChange, onSearchChange, onHistoryChange, onSearchResults, authorEditMode = false, studyMode = true }, ref) {
  const { prefs, updatePrefs } = usePrefs()
  const routerNavigate = useNavigate()

  const [book, setBook] = useState(() => {
    return loadReaderPosition(version).book
  })
  const [chapter, setChapter] = useState(() => {
    return loadReaderPosition(version).chapter
  })

  /* ── Passage history (back / forward navigation) ── */
  const navHistoryRef = useRef(null)
  if (!navHistoryRef.current) {
    // Lazy-init: seed history with whatever the reader opens to (matches book/chapter init)
    try {
      const savedHistory = JSON.parse(localStorage.getItem('bible-nav-history') || 'null')
      if (Array.isArray(savedHistory?.entries) && savedHistory.entries.length) {
        navHistoryRef.current = savedHistory.entries
      } else {
        const init = loadReaderPosition(version)
        navHistoryRef.current = [{ book: init.book, chapter: init.chapter, version }]
      }
    } catch {
      const init = loadReaderPosition(version)
      navHistoryRef.current = [{ book: init.book, chapter: init.chapter, version }]
    }
  }
  const [histIdx, setHistIdx] = useState(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem('bible-nav-history') || 'null')
      const idx = parseInt(savedHistory?.idx, 10)
      return Number.isFinite(idx) ? Math.max(0, Math.min(idx, navHistoryRef.current.length - 1)) : 0
    } catch { return 0 }
  })
  // Ref used to suppress version-sync during history navigation (avoids the race where
  // histIdx and version both change in the same flush and the effect mis-updates history)
  const histNavVersionRef = useRef(null)

  /* segments = [{book, chapter, verses[]}] — first entry is navigated chapter, rest are auto-loaded */
  const [segments,      setSegments]      = useState([])
  const [versionData,   setVersionData]   = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [dataReady,     setDataReady]     = useState(false)
  const [error,         setError]         = useState(null)
  const [sideOpen,      setSideOpen]      = useState(false)
  const sentinelRef     = useRef(null)
  const topSentinelRef  = useRef(null)

  /* Refs so imperative handle methods always see the latest values without recreating the handle */
  const versionDataRef = useRef(null)
  const dataReadyRef   = useRef(false)
  const versionRef     = useRef(version)
  /* Stable ref to current font size — used by pinch-to-zoom without stale closures */
  const prefsSizeRef   = useRef(prefs.sizePx)
  useEffect(() => { versionDataRef.current = versionData }, [versionData])
  useEffect(() => { dataReadyRef.current   = dataReady   }, [dataReady])
  useEffect(() => { versionRef.current     = version     }, [version])
  useEffect(() => { prefsSizeRef.current   = prefs.sizePx }, [prefs.sizePx])

  /* Share + confession modals */
  const [shareCard,       setShareCard]       = useState(null)
  const [confessionModal, setConfessionModal] = useState(null)

  /* Annotations — plain state, always written by reading fresh from localStorage */
  const [highlights, setHighlights] = useState(() => loadHighlights())
  const [itemNotes,  setItemNotes]  = useState(() => loadItemNotes())

  const [editingNote, setEditingNote]     = useState(null)
  const [noteDraft,   setNoteDraft]       = useState('')
  const [selectedVerses, setSelectedVerses] = useState(() => new Set())
  const [colorBarOpen,   setColorBarOpen]   = useState(false)

  /* Search — full-Bible mode (inline in toolbar, always visible) */
  const [searchQuery,       setSearchQuery]       = useState('')
  const [searchFocus,       setSearchFocus]       = useState(0)   // index within chapter matches (when results=null)
  const [bibleResults,      setBibleResults]      = useState(null) // null = no search; [] = no matches; [{book,ch,verse,text}] = matches
  const [bibleResultsTotal, setBibleResultsTotal] = useState(0)   // true total (may exceed bibleResults.length)
  const [bibleResultsCapped,setBibleResultsCapped]= useState(false)
  const [searching,         setSearching]         = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory(`bible-${version}`))
  const [showHistDrop,  setShowHistDrop]  = useState(false)
  const searchInputRef = useRef(null)
  const searchWrapRef  = useRef(null)

  /* Copy feedback */
  const [copiedKey, setCopiedKey] = useState(null)

  /* Text selection */
  const [selection, setSelection] = useState('')
  const verseListRef = useRef(null)
  const readerRef    = useRef(null)
  const restoreReaderScrollRef = useRef(true)
  const skipNextTopScrollRef   = useRef(false)
  const suppressTopPrependRef  = useRef(true)
  const pendingChapterScrollRef = useRef(false)
  const pendingVisibleTargetRef = useRef(null)
  const prependAdjustRef       = useRef(null)
  /* Timestamp of the last explicit navigation — used to suppress scroll-spy
     for ~400 ms after a sidebar/history navigation so we don't flash wrong chapter */
  const lastNavMsRef           = useRef(0)

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  /* Pending verse scroll after navigateTo() call from outside */
  const pendingVerseRef = useRef(null)

  /* ── Morphological reader state (Greek NT + Hebrew OT) ── */
  const [morphLoading,  setMorphLoading]  = useState(false)
  const [morphError,    setMorphError]    = useState(null)
  const [morphReady,    setMorphReady]    = useState(false)
  const [morphSegments, setMorphSegments] = useState([])   // [{book, chapter, verses:[{verse,words}]}]
  const [selectedWord,  setSelectedWord]  = useState(null) // {verseKey, wordIdx}
  const [displayMode,   setDisplayMode]   = useState('orig') // 'orig'|'translit'|'gloss'
  const [strongsModal,  setStrongsModal]  = useState(null)  // { strongsId, lang, initialView? } | null
  const [wordSearchModal, setWordSearchModal] = useState(null) // { word } | null  (KJV word tap)

  /* Lexicon back-navigation: remember last scripture-results search so user can return */
  const [lexReturn, setLexReturn] = useState(null) // { strongsId, lang } | null
  /* Pending word highlight after navigating from lexicon results (morph mode) */
  const pendingLexHighlightRef = useRef(null) // { book, chapter, verse, strongsId } | null
  /* Pending word highlight after navigating from LXX lexicon results (LXX reader mode) */
  const pendingLxxHighlightRef = useRef(null) // { book, chapter, verse, strongsId } | null
  /* Set to the target version when a lexicon result navigation triggers a version switch.
     Prevents the version load effect from clearing lexReturn + pendingLexHighlightRef. */
  const lexNavVersionRef = useRef(null)

  /* Parallel original-language overlay (GNT for NT, HOT+LXX for OT) */
  const [parallelData,    setParallelData]    = useState({}) // { 'Book:ch': [{verse, words:[{w,t,g,s,r,ms}]}] }
  const [parallelLxxData, setParallelLxxData] = useState({}) // { 'Book:ch': [{verse, words:[{w,s}]}] }
  const parallelLoadedRef    = useRef(new Set()) // GNT/HOT — prevents duplicate fetches
  const parallelLxxLoadedRef = useRef(new Set()) // LXX — prevents duplicate fetches

  /* Which word is selected/expanded inside the parallel section */
  const [parallelWord, setParallelWord] = useState(null) // {verseKey, lang, wordIdx} | null

  // parallelVersions: Set of version IDs to show as parallel panels
  // e.g. new Set(['abab', 'gnt']) means show ABAB text + GNT morph
  const [parallelVersions, setParallelVersions] = useState(() => {
    try {
      const saved = sessionStorage.getItem('parallel-versions')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

  // Data for text-version parallels (KJV, ABAB)
  const [parallelTextData, setParallelTextData] = useState({}) // { 'Book:ch:version': [{verse,text}] }
  const parallelTextLoadedRef = useRef(new Set())

  /* ── Author content (notes + cross-refs) ── */
  const isAuthorUser = isAuthor(session)
  // canEdit is true only when the author has explicitly toggled edit mode on
  const canEdit = isAuthorUser && authorEditMode
  // { 'Book:ch': { verseNum: { id, note } } }
  const [authorNotes, setAuthorNotes] = useState({})
  // { 'Book:ch': { verseNum: [{id, src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse, label}] } }
  const [authorCrossRefs, setAuthorCrossRefs] = useState({})
  // Back-refs: keyed by tgt_verse — passages that link TO this chapter's verses
  // { 'Book:ch': { verseNum: [ref, ...] } }
  const [authorBackRefs, setAuthorBackRefs] = useState({})
  const authorContentLoadedRef = useRef(new Set())
  // Author note editing
  const [editingAuthorNote, setEditingAuthorNote] = useState(null) // verseKey 'book:ch:v'
  const [authorNoteDraft,   setAuthorNoteDraft]   = useState('')
  // Author cross-ref adding
  const [addingCrossRefTo, setAddingCrossRefTo] = useState(null)  // verseKey 'book:ch:v'
  const [crossRefDraft, setCrossRefDraft] = useState({ tgt_book: '', tgt_chapter: '', tgt_verse: '', label: '' })
  // Author cross-ref verse preview modal
  const [authorRefModal, setAuthorRefModal] = useState(null)      // { ref } | null
  const [authorRefModalText, setAuthorRefModalText] = useState(null) // fetched verse text

  /* ── LXX reader mode word data (version === 'lxx') ── */
  const [lxxReaderWords,   setLxxReaderWords]   = useState({}) // 'Book:ch' → [{v, words:[{w,s}]}]
  const [lxxReaderWord,    setLxxReaderWord]     = useState(null) // {verseKey, wordIdx} | null
  const lxxReaderLoadedRef = useRef(new Set())

  function toggleParallel(versionId) {
    setParallelVersions(prev => {
      const next = new Set(prev)
      if (next.has(versionId)) next.delete(versionId)
      else next.add(versionId)
      try { sessionStorage.setItem('parallel-versions', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Derived: any original-language parallel selected
  const parallelMode = parallelVersions.has('gnt') || parallelVersions.has('hot') || parallelVersions.has('lxx')
  // Which text-version parallel is selected (if any)
  const textParallelVersion = version === 'kjv' && parallelVersions.has('abab') ? 'abab'
    : version === 'abab' && parallelVersions.has('kjv') ? 'kjv'
    : null

  useImperativeHandle(ref, () => ({
    openSidebar:    () => setSideOpen(true),
    setSearchQuery: (q) => { setSearchQuery(q); setSearchFocus(0); setBibleResults(null) },
    submitSearch:   (q) => submitSearch(q),
    clearSearch:    () => closeSearch(),
    /** Run a Bible-wide search and deliver results ONLY to the onSearchResults callback.
     *  Uses refs so it always searches the currently-loaded version without needing the
     *  handle to be recreated on every version change. */
    runSearch: (q) => {
      const trimmed = q?.trim()
      if (!trimmed) return
      if (!dataReadyRef.current || !versionDataRef.current) {
        onSearchResults?.([], 0, false, trimmed)
        return
      }
      setTimeout(() => {
        const { hits, total, capped } = searchBibleVersion(versionDataRef.current, trimmed, versionRef.current)
        onSearchResults?.(hits, total, capped, trimmed)
      }, 0)
    },
    /** Load ALL results for a given query into the onSearchResults callback. */
    loadAllResults: (q) => {
      const trimmed = q?.trim()
      if (!trimmed || !dataReadyRef.current || !versionDataRef.current) return
      setTimeout(() => {
        const { hits, total } = searchBibleVersion(versionDataRef.current, trimmed, versionRef.current, Infinity)
        onSearchResults?.(hits, total, false, trimmed)
      }, 0)
    },
    navigateTo:     (newBook, newChapter, verse) => {
      navigate(newBook, newChapter)
      if (verse) pendingVerseRef.current = { book: newBook, chapter: newChapter, verse }
    },
    goBack:         () => goBack(),
    goForward:      () => goForward(),
    canGoBack:      histIdx > 0,
    canGoForward:   histIdx < navHistoryRef.current.length - 1,
  }), [histIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  /* ── Dispatch scroll direction so header/nav can auto-hide ── */
  useEffect(() => {
    const el = readerRef.current
    if (!el) return
    let lastY = 0
    const handler = () => {
      const y = el.scrollTop
      if (y > 80) suppressTopPrependRef.current = false
      const delta = y - lastY
      if (Math.abs(delta) < 8) return
      lastY = y
      window.dispatchEvent(new CustomEvent('pb-scroll-dir', {
        detail: { direction: delta > 0 ? 'down' : 'up', scrollTop: y },
      }))
      saveElementScroll(`scripture-${versionRef.current}`, el)
      saveReaderAnchor(versionRef.current, el)
      // Keep chapter indicator in sync.
      // Skip for ~400 ms after an explicit navigation so we don't flash the wrong chapter
      // while the reader is programmatically scrolling to the target heading.
      if (Date.now() - lastNavMsRef.current > 400) {
        const headings = el.querySelectorAll('[data-seg-book]')
        if (headings.length) {
          // A heading is "current" when it has entered the top 80 % of the reader
          // (switches as soon as the next chapter heading is clearly in view).
          const elTop  = el.getBoundingClientRect().top
          const cutoff = el.clientHeight * 0.8
          let current = headings[0]
          for (const h of headings) {
            if (h.getBoundingClientRect().top - elTop < cutoff) current = h
          }
          const b  = current.dataset.segBook
          const ch = parseInt(current.dataset.segChapter, 10)
          if (b && ch) { setVisBook(b); setVisChapter(ch) }
        }
      }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, []) // eslint-disable-line

  useEffect(() => {
    return () => {
      saveElementScroll(`scripture-${versionRef.current}`, readerRef.current)
      saveReaderAnchor(versionRef.current, readerRef.current)
    }
  }, [])

  /* ── Pinch-to-zoom: two-finger spread/pinch adjusts font size ── */
  useEffect(() => {
    const el = readerRef.current
    if (!el) return
    const pinch = { active: false, dist: 0, startSize: 16 }

    function getDist(t0, t1) {
      return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
    }
    function onTouchStart(e) {
      if (e.touches.length === 2) {
        pinch.active    = true
        pinch.dist      = getDist(e.touches[0], e.touches[1])
        pinch.startSize = prefsSizeRef.current
      } else {
        pinch.active = false
      }
    }
    function onTouchMove(e) {
      if (!pinch.active || e.touches.length !== 2) return
      e.preventDefault()
      const d    = getDist(e.touches[0], e.touches[1])
      const next = Math.round(Math.min(28, Math.max(12, pinch.startSize * (d / pinch.dist))))
      if (next !== prefsSizeRef.current) updatePrefs({ sizePx: next })
    }
    function onTouchEnd() { pinch.active = false }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, []) // eslint-disable-line

  /* Visible book/chapter — updated by explicit navigation AND by scroll-spy.
     Kept separate from book/chapter so updating it never resets segments. */
  const [visBook,    setVisBook]    = useState(book)
  const [visChapter, setVisChapter] = useState(chapter)
  /* Always-current refs so share/copy functions don't capture stale closure values */
  const visBookRef    = useRef(book)
  const visChapterRef = useRef(chapter)
  visBookRef.current    = visBook
  visChapterRef.current = visChapter

  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(`bible-reader-${version}`) || 'null') || {}
      localStorage.setItem(`bible-reader-${version}`, JSON.stringify({ ...existing, book: visBook, chapter: visChapter }))
      localStorage.setItem(`bible-book-${version}`, visBook)
      localStorage.setItem(`bible-chapter-${version}`, String(visChapter))
    } catch {}
  }, [visBook, visChapter, version])

  /* Notify parent whenever the visible chapter changes (scroll or explicit nav) */
  useEffect(() => { onNavChange?.(visBook, visChapter) }, [visBook, visChapter]) // eslint-disable-line
  /* Notify parent of search query changes */
  useEffect(() => { onSearchChange?.(searchQuery) }, [searchQuery]) // eslint-disable-line
  /* Notify parent of history state changes so it can enable/disable back/forward buttons */
  useEffect(() => {
    onHistoryChange?.({
      canGoBack:    histIdx > 0,
      canGoForward: histIdx < navHistoryRef.current.length - 1,
    })
    try {
      localStorage.setItem('bible-nav-history', JSON.stringify({
        entries: navHistoryRef.current,
        idx: histIdx,
      }))
    } catch {}
  }, [histIdx]) // eslint-disable-line

  /* Clear the history-nav suppression flag once the version restored by goBack/goForward takes effect.
     NOTE: We intentionally do NOT overwrite the history entry's version here. Each history entry
     preserves the translation that was active when navigate() pushed it, so going back/forward
     reliably restores both the passage AND the translation. Overwriting here caused the bug where
     switching translations on Psalm 23 (HOT) would corrupt the entry to GNT, making it
     impossible to return to HOT via history. */
  useEffect(() => {
    if (histNavVersionRef.current === version) {
      histNavVersionRef.current = null
    }
  }, [version]) // eslint-disable-line

  /* Load GNT/HOT parallel word data for each visible segment */
  useEffect(() => {
    if (!(parallelVersions.has('gnt') || parallelVersions.has('hot')) || version === 'greek' || version === 'hebrew' || version === 'lxx') return
    for (const seg of segments) {
      const key = `${seg.book}:${seg.chapter}`
      if (parallelLoadedRef.current.has(key)) continue
      parallelLoadedRef.current.add(key)

      const isNT   = NT_BOOKS.has(seg.book)
      const loader = isNT ? loadGreek() : loadHebrew()
      const getter = isNT ? getGreekChapter : getHebrewChapter

      loader.then(() => {
        const chData = getter(seg.book, seg.chapter)
        if (!chData) return
        // Store FULL word objects (not joined strings) so the parallel view can render chips
        setParallelData(prev => ({ ...prev, [key]: chData }))
      }).catch(() => { parallelLoadedRef.current.delete(key) })
    }
  }, [parallelVersions, segments, version]) // eslint-disable-line

  /* Load LXX parallel word+Strongs data for OT segments */
  useEffect(() => {
    if (!parallelVersions.has('lxx') || version === 'greek' || version === 'hebrew' || version === 'lxx') return
    for (const seg of segments) {
      if (NT_BOOKS.has(seg.book)) continue // LXX is OT only
      const key = `lxx:${seg.book}:${seg.chapter}`
      if (parallelLxxLoadedRef.current.has(key)) continue
      parallelLxxLoadedRef.current.add(key)

      const bookKey = seg.book
      const chKey   = seg.chapter
      loadLxxWords().then(data => {
        const bs     = bookToLxxSlug(bookKey)
        const chData = data[bs]?.[String(chKey)]
        if (!chData) return
        setParallelLxxData(prev => ({ ...prev, [`${bookKey}:${chKey}`]: chData }))
      }).catch(() => { parallelLxxLoadedRef.current.delete(key) })
    }
  }, [parallelVersions, segments, version]) // eslint-disable-line

  /* Load text-parallel data when textParallelVersion is set */
  useEffect(() => {
    if (!textParallelVersion || !segments.length) return
    for (const seg of segments) {
      const key = `${seg.book}:${seg.chapter}:${textParallelVersion}`
      if (parallelTextLoadedRef.current.has(key)) continue
      parallelTextLoadedRef.current.add(key)
      loadBibleVersion(textParallelVersion)
        .then(data => {
          const verses = getChapterVerses(data, seg.book, seg.chapter)
          if (verses) setParallelTextData(prev => ({ ...prev, [key]: verses }))
        })
        .catch(() => { parallelTextLoadedRef.current.delete(key) })
    }
  }, [textParallelVersion, segments]) // eslint-disable-line

  /* Load author notes + cross-refs for each visible segment */
  useEffect(() => {
    for (const seg of segments) {
      const key = `${seg.book}:${seg.chapter}`
      if (authorContentLoadedRef.current.has(key)) continue
      authorContentLoadedRef.current.add(key)
      const { book: b, chapter: ch } = seg
      Promise.all([fetchAuthorNotes(b, ch), fetchAuthorCrossRefs(b, ch), fetchAuthorBackRefs(b, ch)])
        .then(([notes, refs, backRefs]) => {
          const noteMap = {}
          notes.forEach(n => { noteMap[n.verse] = { id: n.id, note: n.note } })
          setAuthorNotes(prev => ({ ...prev, [key]: noteMap }))
          const refMap = {}
          refs.forEach(r => {
            if (!refMap[r.src_verse]) refMap[r.src_verse] = []
            refMap[r.src_verse].push(r)
          })
          setAuthorCrossRefs(prev => ({ ...prev, [key]: refMap }))
          // Back-refs: keyed by tgt_verse so they appear on the correct verse
          const backRefMap = {}
          backRefs.filter(r => r.tgt_verse).forEach(r => {
            if (!backRefMap[r.tgt_verse]) backRefMap[r.tgt_verse] = []
            backRefMap[r.tgt_verse].push(r)
          })
          setAuthorBackRefs(prev => ({ ...prev, [key]: backRefMap }))
        })
        .catch(() => { authorContentLoadedRef.current.delete(key) })
    }
  }, [segments]) // eslint-disable-line

  /* Fetch verse text for author cross-ref preview modal */
  useEffect(() => {
    if (!authorRefModal) { setAuthorRefModalText(null); return }
    const { ref } = authorRefModal
    if (!ref.tgt_verse) { setAuthorRefModalText(null); return }
    // Try current versionData first (works when same testament / version loaded)
    const localVerses = versionData
      ? getChapterVerses(versionData, ref.tgt_book, ref.tgt_chapter, version)
      : null
    const localVerse = localVerses?.find(v => v.verse === ref.tgt_verse)
    if (localVerse) { setAuthorRefModalText(localVerse.text); return }
    // Fall back to KJV fetch
    setAuthorRefModalText(null)
    fetchKjvChapter(ref.tgt_book, ref.tgt_chapter, 'kjv')
      .then(verses => {
        const v = verses.find(v => v.verse === ref.tgt_verse)
        setAuthorRefModalText(v?.text || null)
      })
      .catch(() => setAuthorRefModalText(null))
  }, [authorRefModal]) // eslint-disable-line

  /* Load LXX word+Strongs data in reader mode (version === 'lxx') */
  useEffect(() => {
    if (version !== 'lxx' || !segments.length) return
    for (const seg of segments) {
      const key = `${seg.book}:${seg.chapter}`
      if (lxxReaderLoadedRef.current.has(key)) continue
      lxxReaderLoadedRef.current.add(key)
      const bookKey = seg.book
      const chKey   = seg.chapter
      loadLxxWords().then(data => {
        const bs     = bookToLxxSlug(bookKey)
        const chData = data[bs]?.[String(chKey)]
        if (!chData) return
        setLxxReaderWords(prev => ({ ...prev, [key]: chData }))
      }).catch(() => { lxxReaderLoadedRef.current.delete(key) })
    }
  }, [version, segments]) // eslint-disable-line

  /* Scroll-spy: update visBook/visChapter as chapter headings enter the top zone */
  useEffect(() => {
    const root = readerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const b  = entry.target.dataset.segBook
          const ch = parseInt(entry.target.dataset.segChapter, 10)
          const pending = pendingVisibleTargetRef.current
          if (pending && (pending.book !== b || pending.chapter !== ch)) continue
          if (b && ch) { setVisBook(b); setVisChapter(ch) }
        }
      },
      { root, rootMargin: '0px 0px -30% 0px', threshold: 0 }
    )
    root.querySelectorAll('[data-seg-book]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [segments, morphSegments])

  /* Refresh highlights + notes when a cross-device sync completes */
  useEffect(() => {
    function onSync() {
      setHighlights(loadHighlights())
      setItemNotes(loadItemNotes())
    }
    
    function onHighlightChanged(evt) {
      setHighlights(evt.detail.highlights)
    }
    
    function onNoteChanged(evt) {
      setItemNotes(evt.detail.notes)
    }
    
    window.addEventListener('pb-annotations-updated', onSync)
    window.addEventListener('pb-highlight-changed', onHighlightChanged)
    window.addEventListener('pb-note-changed', onNoteChanged)
    return () => {
      window.removeEventListener('pb-annotations-updated', onSync)
      window.removeEventListener('pb-highlight-changed', onHighlightChanged)
      window.removeEventListener('pb-note-changed', onNoteChanged)
    }
  }, [])

  /* Persist position per version */
  useEffect(() => {
    try {
      localStorage.setItem(`bible-book-${version}`, book)
      localStorage.setItem(`bible-chapter-${version}`, String(chapter))
    } catch {}
  }, [book, chapter, version])

  /* Clear state when chapter changes */
  useEffect(() => {
    setSelection('')
    setEditingNote(null)
    setSelectedVerses(new Set())
    setColorBarOpen(false)
    setSearchFocus(0)
    setBibleResults(null)  // close search results when navigating
    setBibleResultsTotal(0)
    setBibleResultsCapped(false)
    setParallelWord(null)  // dismiss open parallel word card
    setLxxReaderWord(null) // dismiss open LXX word info strip
    setEditingAuthorNote(null) // dismiss author note editor
    setAddingCrossRefTo(null)  // dismiss cross-ref form
    try { window.getSelection()?.removeAllRanges() } catch {}
  }, [book, chapter])

  /* Track text selection within verse list */
  useEffect(() => {
    function onSelChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) { setSelection(''); return }
      const text = sel.toString().trim()
      if (!text || !verseListRef.current) { setSelection(''); return }
      try {
        const range = sel.getRangeAt(0)
        if (verseListRef.current.contains(range.commonAncestorContainer)) {
          setSelection(text)
        } else {
          setSelection('')
        }
      } catch { setSelection('') }
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [])

  /* (search input is always visible in toolbar — no open/close toggle needed) */

  /* Chapter-level matches — only against the first (navigated) segment */
  const chapterMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const activeVerses = segments.find(s => s.book === book && s.chapter === chapter)?.verses || []
    if (!q || bibleResults !== null || !activeVerses.length) return []
    return activeVerses
      .map((v, idx) => ({ idx, verse: v.verse, match: v.text.toLowerCase().includes(q) }))
      .filter(v => v.match)
  }, [searchQuery, segments, bibleResults, book, chapter])

  /* Scroll to focused match within navigated chapter */
  useEffect(() => {
    if (!chapterMatches.length) return
    const safeIdx = Math.min(searchFocus, chapterMatches.length - 1)
    const verseNum = chapterMatches[safeIdx]?.verse
    if (!verseNum || !readerRef.current) return
    const el = readerRef.current.querySelector(`#${verseId(book, chapter, verseNum)}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [searchFocus, chapterMatches, book, chapter])

  /* Scroll to a specific verse after navigateTo() from Settings deep-link */
  useEffect(() => {
    if (!pendingVerseRef.current) return
    const { book: b, chapter: ch, verse: v } = pendingVerseRef.current
    if (b !== book || ch !== chapter) return   // wait for the right chapter to be active
    pendingVerseRef.current = null
    setTimeout(() => {
      const el = readerRef.current?.querySelector(`#${verseId(b, ch, v)}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)
  }, [book, chapter])

  /* Load Bible version / Greek NT / Hebrew OT whenever the version prop changes */
  useEffect(() => {
    let cancelled = false
    // If this version change was triggered by a lexicon result navigation (e.g. LXX→GNT),
    // preserve the back-pill and pending highlights so the user can return to results.
    // For all other version switches (manual translation toggle), clear them.
    const isLexNav = lexNavVersionRef.current === version
    lexNavVersionRef.current = null  // consume the flag regardless
    if (!isLexNav) {
      setLexReturn(null)
      pendingLexHighlightRef.current = null
    }
    // Always reset LXX reader per-chapter data on version change (pendingLxxHighlightRef is
    // intentionally NOT cleared here — if switching TO 'lxx', the auto-highlight needs it)
    setLxxReaderWords({})
    setLxxReaderWord(null)
    lxxReaderLoadedRef.current = new Set()
    const isMorph = version === 'greek' || version === 'hebrew'

    if (isMorph) {
      // ── Morphological mode (Greek NT or Hebrew OT) ──
      setLoading(false)
      setError(null)
      setDataReady(false)
      setVersionData(null)
      setSegments([])
      setMorphLoading(true)
      setMorphError(null)
      setMorphReady(false)
      setMorphSegments([])
      setSelectedWord(null)
      setDisplayMode('orig')

      const loader = version === 'greek' ? loadGreek() : loadHebrew()
      loader
        .then(() => {
          if (cancelled) return
          setMorphReady(true)
          setMorphLoading(false)
          // Navigate to correct testament if needed
          if (version === 'greek' && !NT_BOOKS.has(book)) {
            setBook('Matthew'); setChapter(1)
          } else if (version === 'hebrew' && !OT_BOOKS.has(book)) {
            setBook('Genesis'); setChapter(1)
          }
        })
        .catch(e => {
          if (!cancelled) { setMorphError(e.message); setMorphLoading(false) }
        })
    } else {
      // ── Text version (KJV, ABAB, …) ──
      setVersionData(null)
      setDataReady(false)
      setLoading(true)
      setError(null)
      setMorphReady(false)
      setMorphLoading(false)
      setMorphSegments([])
      setSelectedWord(null)

      loadBibleData(version)
        .then(data => {
          if (cancelled) return
          setVersionData(data)
          setDataReady(true)
          setLoading(false)
          // LXX is OT-only — if currently on a NT book, jump to Genesis
          if (version === 'lxx' && NT_BOOKS.has(book)) {
            setBook('Genesis'); setChapter(1)
          }
        })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }

    return () => { cancelled = true }
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Chapter navigation — reset to single segment, scroll to top */
  useEffect(() => {
    if (!dataReady) return
    const v = getChapterVerses(versionData, book, chapter, version)
    if (v) {
      lastNavMsRef.current = Date.now()
      pendingVisibleTargetRef.current = { book, chapter }
      setSegments([{ book, chapter, verses: v }])
      setError(null)
    }
    else    { setError('Chapter not found') }
    if (readerRef.current) {
      if (restoreReaderScrollRef.current) {
        restoreReaderScrollRef.current = false
        if (!restoreReaderAnchor(version, readerRef.current)) {
          restoreElementScroll(`scripture-${version}`, readerRef.current)
        }
        setTimeout(() => {
          const pending = pendingVisibleTargetRef.current
          if (pending?.book === book && pending?.chapter === chapter) {
            pendingVisibleTargetRef.current = null
          }
        }, 350)
      } else if (skipNextTopScrollRef.current) {
        skipNextTopScrollRef.current = false
      } else {
        pendingChapterScrollRef.current = true
      }
    }
  }, [book, chapter, dataReady, versionData, version])

  /* Keep scroll anchored after a previous chapter is prepended above the viewport */
  useEffect(() => {
    const pending = prependAdjustRef.current
    const el = readerRef.current
    if (!pending || !el) return
    prependAdjustRef.current = null
    requestAnimationFrame(() => {
      el.scrollTop = pending.scrollTop + (el.scrollHeight - pending.scrollHeight)
    })
  }, [segments, morphSegments])

  useEffect(() => {
    if (!pendingChapterScrollRef.current) return
    const root = readerRef.current
    if (!root) return
    pendingChapterScrollRef.current = false
    requestAnimationFrame(() => {
      const selector = `[data-seg-book="${CSS.escape(book)}"][data-seg-chapter="${chapter}"]`
      const el = root.querySelector(selector)
      if (!el) {
        root.scrollTop = 0
        return
      }
      const rootTop = root.getBoundingClientRect().top
      const rect = el.getBoundingClientRect()
      root.scrollTop += rect.top - rootTop
      setVisBook(book)
      setVisChapter(chapter)
      setTimeout(() => {
        const pending = pendingVisibleTargetRef.current
        if (pending?.book === book && pending?.chapter === chapter) {
          pendingVisibleTargetRef.current = null
        }
      }, 250)
    })
  }, [segments, morphSegments, book, chapter])

  /* Prepend previous chapter when the top sentinel becomes visible */
  useEffect(() => {
    const root = readerRef.current
    if (!dataReady || !root || !topSentinelRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        if (suppressTopPrependRef.current && root.scrollTop < 80) return
        setSegments(prev => {
          if (!prev.length) return prev
          const first = prev[0]
          const prevChapter = getPrevChapter(first.book, first.chapter)
          if (!prevChapter) return prev
          const alreadyLoaded = prev.some(s => s.book === prevChapter.book && s.chapter === prevChapter.chapter)
          if (alreadyLoaded) return prev
          const v = getChapterVerses(versionData, prevChapter.book, prevChapter.chapter, version)
          if (!v) return prev
          prependAdjustRef.current = { scrollTop: root.scrollTop, scrollHeight: root.scrollHeight }
          return [{ book: prevChapter.book, chapter: prevChapter.chapter, verses: v }, ...prev]
        })
      },
      { root, rootMargin: '300px 0px 0px 0px' }
    )
    obs.observe(topSentinelRef.current)
    return () => obs.disconnect()
  }, [dataReady, segments, versionData, version])

  /* Append next chapter when sentinel becomes visible */
  useEffect(() => {
    const root = readerRef.current
    if (!dataReady || !root || !sentinelRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSegments(prev => {
          if (!prev.length) return prev
          const last = prev[prev.length - 1]
          const next = getNextChapter(last.book, last.chapter)
          if (!next) return prev
          // Avoid double-loading
          const alreadyLoaded = prev.some(s => s.book === next.book && s.chapter === next.chapter)
          if (alreadyLoaded) return prev
          const v = getChapterVerses(versionData, next.book, next.chapter, version)
          if (!v) return prev
          return [...prev, { book: next.book, chapter: next.chapter, verses: v }]
        })
      },
      { root, rootMargin: '0px 0px 300px 0px' }
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [dataReady, segments, versionData, version])

  /* Load a morph chapter whenever book / chapter changes in Greek or Hebrew mode */
  useEffect(() => {
    const isMorph = version === 'greek' || version === 'hebrew'
    if (!isMorph || !morphReady) return
    const chData = version === 'greek'
      ? getGreekChapter(book, chapter)
      : getHebrewChapter(book, chapter)
    if (chData) {
      lastNavMsRef.current = Date.now()
      pendingVisibleTargetRef.current = { book, chapter }
      setMorphSegments([{ book, chapter, verses: chData }])
      setMorphError(null)
    } else {
      setMorphError(`Chapter not found in ${version === 'greek' ? 'Greek NT' : 'Hebrew OT'}`)
    }
    if (readerRef.current) {
      if (restoreReaderScrollRef.current) {
        restoreReaderScrollRef.current = false
        if (!restoreReaderAnchor(version, readerRef.current)) {
          restoreElementScroll(`scripture-${version}`, readerRef.current)
        }
        setTimeout(() => {
          const pending = pendingVisibleTargetRef.current
          if (pending?.book === book && pending?.chapter === chapter) {
            pendingVisibleTargetRef.current = null
          }
        }, 350)
      } else if (skipNextTopScrollRef.current) {
        skipNextTopScrollRef.current = false
      } else {
        pendingChapterScrollRef.current = true
      }
    }
    setSelectedWord(null)
  }, [book, chapter, version, morphReady]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Morph infinite-scroll - prepend previous chapter when top sentinel is visible */
  useEffect(() => {
    const isMorph = version === 'greek' || version === 'hebrew'
    const root = readerRef.current
    if (!isMorph || !morphReady || !root || !topSentinelRef.current) return
    const allowedBooks = version === 'greek' ? NT_BOOKS : OT_BOOKS
    const getChFn     = version === 'greek' ? getGreekChapter : getHebrewChapter
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        if (suppressTopPrependRef.current && root.scrollTop < 80) return
        setMorphSegments(prev => {
          if (!prev.length) return prev
          const first = prev[0]
          const prevChapter = getPrevChapter(first.book, first.chapter)
          if (!prevChapter || !allowedBooks.has(prevChapter.book)) return prev
          if (prev.some(s => s.book === prevChapter.book && s.chapter === prevChapter.chapter)) return prev
          const chData = getChFn(prevChapter.book, prevChapter.chapter)
          if (!chData) return prev
          prependAdjustRef.current = { scrollTop: root.scrollTop, scrollHeight: root.scrollHeight }
          return [{ book: prevChapter.book, chapter: prevChapter.chapter, verses: chData }, ...prev]
        })
      },
      { root, rootMargin: '300px 0px 0px 0px' }
    )
    obs.observe(topSentinelRef.current)
    return () => obs.disconnect()
  }, [version, morphReady, morphSegments]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Morph infinite-scroll — append next chapter when sentinel becomes visible */
  useEffect(() => {
    const isMorph = version === 'greek' || version === 'hebrew'
    const root = readerRef.current
    if (!isMorph || !morphReady || !root || !sentinelRef.current) return
    const allowedBooks = version === 'greek' ? NT_BOOKS : OT_BOOKS
    const getChFn     = version === 'greek' ? getGreekChapter : getHebrewChapter
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setMorphSegments(prev => {
          if (!prev.length) return prev
          const last = prev[prev.length - 1]
          const next = getNextChapter(last.book, last.chapter)
          if (!next || !allowedBooks.has(next.book)) return prev
          if (prev.some(s => s.book === next.book && s.chapter === next.chapter)) return prev
          const chData = getChFn(next.book, next.chapter)
          if (!chData) return prev
          return [...prev, { book: next.book, chapter: next.chapter, verses: chData }]
        })
      },
      { root, rootMargin: '0px 0px 300px 0px' }
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [version, morphReady, morphSegments]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-select the matched word after navigating from lexicon scripture results (morph mode) */
  useEffect(() => {
    const p = pendingLexHighlightRef.current
    if (!p || !morphSegments.length) return
    const seg = morphSegments.find(s => s.book === p.book && s.chapter === p.chapter)
    if (!seg) return
    const vd = seg.verses.find(ve => ve.verse === p.verse)
    if (!vd) return
    pendingLexHighlightRef.current = null
    const targetNum = parseInt(p.strongsId.replace(/^[GHgh]/, '').replace(/[A-Za-z]+$/, ''), 10)
    const wi = vd.words.findIndex(wd => {
      const n = parseInt((wd.s || '').replace(/^[GHgh]/, '').replace(/[A-Za-z]+$/, ''), 10)
      return n === targetNum
    })
    if (wi >= 0) {
      const verseKey = `kjv|${p.book}|${p.chapter}|${p.verse}`
      setSelectedWord({ verseKey, wordIdx: wi })
      setSelectedVerses(prev => { const next = new Set(prev); next.add(verseKey); return next })
    }
  }, [morphSegments]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-select the matched word after navigating from LXX lexicon results (LXX reader mode) */
  useEffect(() => {
    const p = pendingLxxHighlightRef.current
    if (!p || !Object.keys(lxxReaderWords).length) return
    const pKey = `${p.book}:${p.chapter}`
    const chArr = lxxReaderWords[pKey]
    if (!chArr) return
    const vObj = chArr.find(pv => (pv.v ?? pv.verse) === p.verse)
    if (!vObj?.words) return
    pendingLxxHighlightRef.current = null
    const targetNum = parseInt(
      p.strongsId.replace(/^[GHgh]/, '').replace(/[A-Za-z]+$/, ''), 10
    )
    const wi = vObj.words.findIndex(wd => {
      const n = parseInt((wd.s || '').replace(/^[GHgh]/, '').replace(/[A-Za-z]+$/, ''), 10)
      return n === targetNum
    })
    if (wi >= 0) {
      const verseKey = `kjv|${p.book}|${p.chapter}|${p.verse}`
      setLxxReaderWord({ verseKey, wordIdx: wi })
      setSelectedVerses(prev => { const next = new Set(prev); next.add(verseKey); return next })
      setTimeout(() => {
        const el = readerRef.current?.querySelector(`#${verseId(p.book, p.chapter, p.verse)}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }, [lxxReaderWords]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Highlight handler ── */
  const handleHighlight = useCallback((verseKey, colorId) => {
    setHighlight(verseKey, colorId, userId)
    setHighlights(loadHighlights())
  }, [userId])

  /* ── Note handlers ── */
  function openNoteEditor(verseKey) {
    if (editingNote === verseKey) { setEditingNote(null); return }
    setNoteDraft(itemNotes[verseKey] || '')
    setEditingNote(verseKey)
  }

  function saveNote(verseKey) {
    setItemNote(verseKey, noteDraft.trim(), userId)
    setItemNotes(loadItemNotes())
    setEditingNote(null)
  }

  function deleteNote(verseKey) {
    setItemNote(verseKey, '', userId)
    setItemNotes(loadItemNotes())
    setEditingNote(null)
  }

  /* ── Author note helpers ── */
  function openAuthorNoteEditor(book, chapter, verse) {
    const vk = `${book}:${chapter}:${verse}`
    if (editingAuthorNote === vk) { setEditingAuthorNote(null); return }
    const key = `${book}:${chapter}`
    const existing = authorNotes[key]?.[verse]?.note || ''
    setAuthorNoteDraft(existing)
    setEditingAuthorNote(vk)
    setAddingCrossRefTo(null)
  }

  async function saveAuthorNote(book, chapter, verse) {
    const note = authorNoteDraft.trim()
    const key  = `${book}:${chapter}`
    try {
      if (!note) {
        // Delete if blank
        const id = authorNotes[key]?.[verse]?.id
        if (id) {
          await deleteAuthorNote(id)
          setAuthorNotes(prev => {
            const chMap = { ...(prev[key] || {}) }
            delete chMap[verse]
            return { ...prev, [key]: chMap }
          })
        }
      } else {
        await upsertAuthorNote({ book, chapter, verse, note })
        // Re-fetch to get the id
        const fresh = await fetchAuthorNotes(book, chapter)
        const noteMap = {}
        fresh.forEach(n => { noteMap[n.verse] = { id: n.id, note: n.note } })
        setAuthorNotes(prev => ({ ...prev, [key]: noteMap }))
      }
    } catch(e) {
      console.error('[authorNote] save failed:', e?.message)
    }
    setEditingAuthorNote(null)
  }

  async function removeAuthorNote(book, chapter, verse) {
    const key = `${book}:${chapter}`
    const id  = authorNotes[key]?.[verse]?.id
    if (!id) return
    try {
      await deleteAuthorNote(id)
      setAuthorNotes(prev => {
        const chMap = { ...(prev[key] || {}) }
        delete chMap[verse]
        return { ...prev, [key]: chMap }
      })
    } catch(e) {
      console.error('[authorNote] delete failed:', e?.message)
    }
    setEditingAuthorNote(null)
  }

  /* ── Author cross-ref helpers ── */
  async function saveAuthorCrossRef(src_book, src_chapter, src_verse) {
    const { tgt_book, tgt_chapter, tgt_verse, label } = crossRefDraft
    if (!tgt_book.trim() || !tgt_chapter.trim()) return
    // Validate book name
    const matched = BIBLE_BOOKS.find(b => b.name.toLowerCase() === tgt_book.trim().toLowerCase())
    if (!matched) { alert(`Book not found: "${tgt_book}". Use the full book name (e.g. Numbers).`); return }
    try {
      await upsertAuthorCrossRef({
        src_book, src_chapter, src_verse,
        tgt_book: matched.name,
        tgt_chapter: parseInt(tgt_chapter, 10),
        tgt_verse: tgt_verse.trim() ? parseInt(tgt_verse, 10) : null,
        label: label.trim() || null,
      })
      const tgtBook = matched.name
      const tgtCh   = parseInt(tgt_chapter, 10)
      const [fresh, freshBackRefs] = await Promise.all([
        fetchAuthorCrossRefs(src_book, src_chapter),
        fetchAuthorBackRefs(tgtBook, tgtCh),
      ])
      const refMap = {}
      fresh.forEach(r => {
        if (!refMap[r.src_verse]) refMap[r.src_verse] = []
        refMap[r.src_verse].push(r)
      })
      setAuthorCrossRefs(prev => ({ ...prev, [`${src_book}:${src_chapter}`]: refMap }))
      // Immediately update back-refs for the target chapter so the link appears right away
      // if the user navigates there without a full reload.
      const backRefMap = {}
      freshBackRefs.filter(r => r.tgt_verse).forEach(r => {
        if (!backRefMap[r.tgt_verse]) backRefMap[r.tgt_verse] = []
        backRefMap[r.tgt_verse].push(r)
      })
      setAuthorBackRefs(prev => ({ ...prev, [`${tgtBook}:${tgtCh}`]: backRefMap }))
      // Allow the target chapter to re-fetch fresh data next time it loads
      authorContentLoadedRef.current.delete(`${tgtBook}:${tgtCh}`)
      setAddingCrossRefTo(null)
      setCrossRefDraft({ tgt_book: '', tgt_chapter: '', tgt_verse: '', label: '' })
    } catch(e) {
      console.error('[authorCrossRef] save failed:', e?.message)
    }
  }

  async function removeAuthorCrossRef(ref) {
    const srcKey = `${ref.src_book}:${ref.src_chapter}`
    const tgtKey = `${ref.tgt_book}:${ref.tgt_chapter}`
    try {
      await deleteAuthorCrossRef(ref.id)
      // Remove from forward refs (source chapter)
      setAuthorCrossRefs(prev => {
        const chMap = { ...(prev[srcKey] || {}) }
        chMap[ref.src_verse] = (chMap[ref.src_verse] || []).filter(r => r.id !== ref.id)
        if (!chMap[ref.src_verse].length) delete chMap[ref.src_verse]
        return { ...prev, [srcKey]: chMap }
      })
      // Remove from back-refs (target chapter) so the link disappears immediately
      if (ref.tgt_verse) {
        setAuthorBackRefs(prev => {
          const chMap = { ...(prev[tgtKey] || {}) }
          chMap[ref.tgt_verse] = (chMap[ref.tgt_verse] || []).filter(r => r.id !== ref.id)
          if (!chMap[ref.tgt_verse].length) delete chMap[ref.tgt_verse]
          return { ...prev, [tgtKey]: chMap }
        })
      }
      // Allow target chapter to re-fetch fresh data next time it loads
      authorContentLoadedRef.current.delete(tgtKey)
    } catch(e) {
      console.error('[authorCrossRef] delete failed:', e?.message)
    }
  }

  /* ── Verse tap-to-select ── */
  function toggleVerse(verseKey) {
    setSelectedVerses(prev => {
      const next = new Set(prev)
      if (next.has(verseKey)) next.delete(verseKey)
      else next.add(verseKey)
      if (next.size === 0) setColorBarOpen(false)
      return next
    })
  }

  function clearSelection() {
    setSelectedVerses(new Set())
    setColorBarOpen(false)
    setEditingNote(null)
    setSelectedWord(null)
  }

  /* ── Greek word tap ── */
  function handleWordTap(verseKey, wordIdx) {
    const isSame = selectedWord?.verseKey === verseKey && selectedWord?.wordIdx === wordIdx
    if (isSame) {
      setSelectedWord(null)   // tap same word → hide info strip (verse stays selected)
    } else {
      setSelectedWord({ verseKey, wordIdx })
      // Ensure the verse is in selectedVerses so the floating bar appears
      setSelectedVerses(prev => {
        const next = new Set(prev)
        next.add(verseKey)
        return next
      })
    }
  }

  function applyHighlightToSelection(colorId) {
    selectedVerses.forEach(vk => setHighlight(vk, colorId, userId))
    setHighlights(loadHighlights())   // explicit fresh read → all selected verses highlighted
    setColorBarOpen(false)
    setSelectedVerses(new Set())
  }

  function openNoteForSelection() {
    if (selectedVerses.size !== 1) return
    const [verseKey] = [...selectedVerses]
    setNoteDraft(itemNotes[verseKey] || '')
    setEditingNote(verseKey)
    setColorBarOpen(false)
    setSelectedVerses(new Set())
  }

  function buildSelectionLines() {
    const lines     = []   // full text lines for copy
    const hebrewRefs = [] // verse refs kept separate so share card body stays pure RTL
    const isMorphVers = version === 'greek' || version === 'hebrew'
    const isGreek   = version === 'greek'
    const isHebrew  = version === 'hebrew'
    const pool = isMorphVers ? morphSegments : segments
    const versionLabel = isGreek  ? 'GNT (TAGNT)'
                       : isHebrew ? 'HOT (TAHOT)'
                       : (BIBLE_VERSIONS.find(v2 => v2.id === version)?.abbreviation || 'KJV')

    selectedVerses.forEach(vk => {
      const [, b, ch, v] = vk.split('|')
      for (const seg of pool) {
        if (seg.book === b && String(seg.chapter) === ch) {
          const vObj = seg.verses.find(ve => String(ve.verse) === v)
          if (vObj) {
            const scriptText = isMorphVers ? vObj.words.map(w => w.w).join(' ') : null
            if (isHebrew) {
              // Keep the verse ref separate: body will be pure RTL script text
              hebrewRefs.push(`${b} ${ch}:${v}`)
              lines.push(`${b} ${ch}:${v} — ${scriptText}`)   // for copy
            } else if (isGreek) {
              lines.push(`${b} ${ch}:${v} — ${scriptText}`)
            } else {
              lines.push(`${b} ${ch}:${v} — ${vObj.text}`)
            }
          }
        }
      }
    })
    return {
      lines,
      hebrewRefs,
      versionLabel,
      script: isHebrew ? 'hebrew' : isGreek ? 'greek' : null,
    }
  }

  function shareSelection() {
    const { lines, hebrewRefs, script } = buildSelectionLines()
    const versMeta = BIBLE_VERSIONS.find(v2 => v2.id === version)
    const isHebrew = script === 'hebrew'

    // For Hebrew: body = pure script text (no mixed LTR ref), refs go into label
    // This lets the canvas render the body cleanly RTL without bidi fighting
    const shareText = isHebrew
      ? lines.map(l => {
          // Strip the "Book Ch:V — " prefix that was added for copy; keep only script
          const dashIdx = l.indexOf(' — ')
          return dashIdx >= 0 ? l.slice(dashIdx + 3) : l
        }).join('\n')
      : lines.join('\n\n')

    setShareCard({
      type:     'reading',
      title:    `${visBookRef.current} ${visChapterRef.current}`,
      subtitle: versMeta?.label || 'King James Version',
      source:   versMeta?.abbreviation || 'KJV',
      text:     shareText,
      label:    isHebrew ? hebrewRefs.join('  ·  ') : '',
      script,
    })
    setSelectedVerses(new Set())
  }

  function copySelection() {
    const { lines } = buildSelectionLines()
    navigator.clipboard.writeText(lines.join('\n\n')).catch(() => {})
    setCopiedKey('selection')
    setTimeout(() => { setCopiedKey(null); setSelectedVerses(new Set()) }, 1500)
  }

  /* ── Share helpers ── */
  function handleShareSelection() {
    setShareCard({
      type: 'reading',
      title: `${visBookRef.current} ${visChapterRef.current}`,
      subtitle: 'King James Version',
      source: 'KJV',
      text: selection,
      label: '',
    })
  }

  function handleShareChapter() {
    const vb = visBookRef.current
    const vc = visChapterRef.current
    // Find the segment for the currently visible chapter (may differ from segments[0] when
    // the user has scrolled into a chapter loaded via infinite scroll)
    const seg = segments.find(s => s.book === vb && s.chapter === vc)
             || morphSegments.find(s => s.book === vb && s.chapter === vc)
             || segments[0]
    if (!seg) return
    const chText = seg.verses.map(v => `${v.verse} ${v.text ?? v.words?.map(w => w.w).join(' ') ?? ''}`).join('\n')
    setShareCard({
      type: 'reading',
      title: `${seg.book} ${seg.chapter}`,
      subtitle: 'King James Version',
      source: 'KJV',
      text: chText.slice(0, 1200),
      label: '',
    })
  }

  function handleShareNote(verseKey, note, verseText) {
    const [, b, ch, v] = verseKey.split('|')
    setShareCard({
      type: 'reading',
      title: `${b} ${ch}:${v}`,
      subtitle: 'King James Version',
      source: 'KJV',
      text: `"${verseText}"\n\n— My reflection:\n${note}`,
      label: '',
    })
  }

  /* ── Search handlers ── */
  function submitSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    setSearchQuery(trimmed)
    setSearchFocus(0)
    addSearchHistory('kjv', trimmed)
    setSearchHistory(getSearchHistory('kjv'))
    setShowHistDrop(false)
    // Run full-Bible search
    if (dataReady) {
      setSearching(true)
      // Run in a microtask so the UI updates first
      setTimeout(() => {
        const { hits, total, capped } = searchBibleVersion(versionData, trimmed, version)
        setBibleResults(hits)
        setBibleResultsTotal(total)
        setBibleResultsCapped(capped)
        setSearching(false)
        // If caller wants results in their own panel, notify them
        onSearchResults?.(hits, total, capped, trimmed)
      }, 0)
    }
  }

  function loadAllSearchResults() {
    if (!dataReady) return
    setSearching(true)
    setTimeout(() => {
      const { hits, total } = searchBibleVersion(versionData, searchQuery.trim(), version, Infinity)
      setBibleResults(hits)
      setBibleResultsTotal(total)
      setBibleResultsCapped(false)
      setSearching(false)
    }, 0)
  }

  function closeSearch() {
    setSearchQuery('')
    setBibleResults(null)
    setBibleResultsTotal(0)
    setBibleResultsCapped(false)
    setSearchFocus(0)
  }

  function navigate(newBook, newChapter) {
    suppressTopPrependRef.current = true
    lastNavMsRef.current = Date.now()
    pendingVisibleTargetRef.current = { book: newBook, chapter: newChapter }
    // Push to history — include current version so back/forward can restore it
    const current = navHistoryRef.current[histIdx]
    if (!current || current.book !== newBook || current.chapter !== newChapter) {
      navHistoryRef.current = [
        ...navHistoryRef.current.slice(0, histIdx + 1),
        { book: newBook, chapter: newChapter, version },
      ]
      setHistIdx(navHistoryRef.current.length - 1)
    }
    setBook(newBook)
    setChapter(newChapter)
    setVisBook(newBook)
    setVisChapter(newChapter)
  }

  function goBack() {
    if (histIdx <= 0) return
    suppressTopPrependRef.current = true
    lastNavMsRef.current = Date.now()
    const newIdx = histIdx - 1
    const entry  = navHistoryRef.current[newIdx]
    pendingVisibleTargetRef.current = { book: entry.book, chapter: entry.chapter }
    setHistIdx(newIdx)
    setBook(entry.book); setChapter(entry.chapter)
    setVisBook(entry.book); setVisChapter(entry.chapter)
    // Restore translation if it differs
    if (entry.version && entry.version !== version) {
      histNavVersionRef.current = entry.version  // suppress the version-sync effect
      onVersionChange?.(entry.version)
    }
  }

  function goForward() {
    if (histIdx >= navHistoryRef.current.length - 1) return
    suppressTopPrependRef.current = true
    lastNavMsRef.current = Date.now()
    const newIdx = histIdx + 1
    const entry  = navHistoryRef.current[newIdx]
    pendingVisibleTargetRef.current = { book: entry.book, chapter: entry.chapter }
    setHistIdx(newIdx)
    setBook(entry.book); setChapter(entry.chapter)
    setVisBook(entry.book); setVisChapter(entry.chapter)
    // Restore translation if it differs
    if (entry.version && entry.version !== version) {
      histNavVersionRef.current = entry.version  // suppress the version-sync effect
      onVersionChange?.(entry.version)
    }
  }

  const isTodayChapter = todayChapter && todayChapter === `${book} ${chapter}`

  /* Highlight text in verse for search */
  function highlightSearchInText(text) {
    const q = searchQuery.trim()
    if (!q) return text
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
      if (parts.length === 1) return text
      return parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} style={{ background:'#fef08a', color:'inherit', borderRadius:2, padding:'0 1px' }}>{p}</mark>
          : p
      )
    } catch { return text }
  }

  return (
    <div style={r.wrap}>

      {/* Mobile sidebar backdrop */}
      {isMobile && sideOpen && (
        <div style={r.backdrop} onClick={() => setSideOpen(false)} />
      )}

      {/* Book sidebar */}
      <aside style={{
        ...r.sidebar,
        ...(isMobile ? {
          position:'fixed', left:0, top:0, bottom:0, zIndex:200,
          transform: sideOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:'transform 0.25s',
          boxShadow: sideOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
          width: 240,
        } : {}),
      }}>
        {isMobile && (
          <div style={r.mobileNavHeader}>
            <span style={{ fontSize:13, fontWeight:700 }}>Select Book</span>
            <button onClick={() => setSideOpen(false)} style={r.closeBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Version picker ── */}
        <div style={sb.versionSection}>
          <div style={sb.versionSectionTitle}>Translation</div>
          <div style={sb.versionList}>
            {BIBLE_VERSIONS.filter(v2 => !v2.hidden).map(v2 => {
              const isActive = version === v2.id
              return (
                <button
                  key={v2.id}
                  style={{ ...sb.versionBtn, ...(isActive ? sb.versionBtnActive : {}) }}
                  onClick={() => onVersionChange?.(v2.id)}
                  title={v2.description}
                >
                  <span style={{ ...sb.versionAbbr, ...(isActive ? { color:'white' } : {}) }}>{v2.abbreviation}</span>
                  <span style={{ ...sb.versionLang, ...(isActive ? { color:'rgba(255,255,255,0.75)' } : {}) }}>
                    {v2.language}{v2.scope ? ` · ${v2.scope}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Parallel section ── */}
        {(version === 'kjv' || version === 'abab') && (
          <div style={sb.parallelSection}>
            <div style={sb.versionSectionTitle}>Parallel</div>
            <div style={sb.parallelPills}>
              {[
                { id: version === 'kjv' ? 'abab' : 'kjv', label: version === 'kjv' ? 'ABAB' : 'KJV', title: version === 'kjv' ? 'Ang Bagong Ang Biblia' : 'King James Version' },
                { id: 'gnt', label: 'GNT', title: 'Greek New Testament (NT books)' },
                { id: 'hot', label: 'HOT', title: 'Hebrew Old Testament (OT books)' },
                { id: 'lxx', label: 'LXX', title: 'Greek Septuagint (OT books)' },
              ].map(({ id, label, title }) => {
                const active = parallelVersions.has(id)
                return (
                  <button
                    key={id}
                    title={title}
                    onClick={() => toggleParallel(id)}
                    style={{
                      ...sb.parallelPill,
                      ...(active ? sb.parallelPillActive : {}),
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <BookSidebar
          selectedBook={book}
          selectedChapter={chapter}
          onNavigate={(b, ch) => {
            if (version === 'greek'  && !NT_BOOKS.has(b)) { navigate('Matthew', 1); return }
            if ((version === 'hebrew' || version === 'lxx') && !OT_BOOKS.has(b)) { navigate('Genesis', 1); return }
            navigate(b, ch)
          }}
          onClose={() => setSideOpen(false)}
          isMobile={isMobile}
          ntOnly={version === 'greek'}
          otOnly={version === 'hebrew' || version === 'lxx'}
        />
      </aside>

      {/* Reader panel */}
      <div style={r.readerWrap} ref={readerRef}>

        <div style={r.content}>
          <div ref={topSentinelRef} style={{ height: 1 }} />
          {/* ── Search status bar (text versions only) ── */}
          {version !== 'greek' && version !== 'hebrew' && searchQuery.trim() && (
            <div style={r.searchStatusBar}>
              {searching ? (
                <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Searching…</span>
              ) : bibleResults !== null ? (
                bibleResults.length === 0 ? (
                  <span style={{ fontSize:12, color:'var(--ink-faint)' }}>No matches in Bible</span>
                ) : (
                  <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>
                    {bibleResults.length}{bibleResults.length === 200 ? '+' : ''} verse{bibleResults.length !== 1 ? 's' : ''} found
                  </span>
                )
              ) : chapterMatches.length === 0 ? (
                <span style={{ fontSize:12, color:'var(--ink-faint)' }}>
                  Not in {book} {chapter} —{' '}
                  <button
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--teal)', fontSize:12, fontWeight:600, padding:0, fontFamily:"'DM Sans',sans-serif" }}
                    onClick={() => submitSearch(searchQuery)}
                  >
                    Search whole Bible ↵
                  </button>
                </span>
              ) : (
                <>
                  <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>
                    {searchFocus + 1} / {chapterMatches.length} in chapter
                  </span>
                  <button style={r.searchNavBtn} onClick={() => setSearchFocus(f => Math.max(0, f - 1))}>↑</button>
                  <button style={r.searchNavBtn} onClick={() => setSearchFocus(f => Math.min(chapterMatches.length - 1, f + 1))}>↓</button>
                  <button
                    style={{ ...r.searchNavBtn, color:'var(--teal)', borderColor:'var(--teal)', fontWeight:600 }}
                    onClick={() => submitSearch(searchQuery)}
                    title="Search whole Bible"
                  >
                    Search Bible
                  </button>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════
              MORPHOLOGICAL MODE (GREEK NT / HEBREW OT)
              ══════════════════════════════════════════════ */}
          {(version === 'greek' || version === 'hebrew') && (() => {
            const isHeb        = version === 'hebrew'
            const langLabel    = isHeb ? 'Hebrew' : 'Greek'
            const scriptLabel  = isHeb ? 'HOT' : 'GNT'
            const datasetLabel = isHeb ? 'TAHOT · STEPBible CC BY 4.0' : 'TAGNT · STEPBible CC BY 4.0'
            const parseMarker      = isHeb ? getHebMsMarker : getMsMarker
            const parseMorph       = isHeb ? parseHebrewMorph : parseGrammar
            const parseMorphDetail = isHeb ? parseHebrewMorphDetails : parseMorphDetails

            const getWordLabel = (wd) =>
              displayMode === 'orig'    ? wd.w
              : displayMode === 'translit' ? wd.t
              : wd.g

            // Font preferences applied to script chips
            const origScriptFont = isHeb
              ? getHebrewFontCss(prefs.hebrewFontId)
              : getGreekFontCss(prefs.greekFontId)
            const chipFontFamily = displayMode === 'orig' ? origScriptFont : getFontCss(prefs.fontId)
            const chipFontSize   = displayMode === 'orig'
              ? prefs.sizePx * (isHeb ? 1.3 : 1.15)
              : prefs.sizePx

            return (
            <>
              {morphLoading && (
                <div style={r.loadingState}>
                  <div className="spinner" />
                  <p style={{ color:'var(--ink-muted)', fontSize:14, marginTop:12 }}>Loading {langLabel} {isHeb ? 'Old' : 'New'} Testament…</p>
                </div>
              )}
              {morphError && !morphLoading && (
                <div style={r.errorState}>
                  <p style={{ color:'var(--ink-muted)', fontSize:14 }}>{morphError}</p>
                  <p style={{ color:'var(--ink-faint)', fontSize:12, marginTop:8 }}>
                    Run: <code>npm run process:{isHeb ? 'hebrew' : 'greek'}</code>
                  </p>
                </div>
              )}
              {morphReady && !morphLoading && (
                <>
                  {/* Display-mode toggle bar */}
                  <div style={r.displayModeBar}>
                    <span style={r.displayModeLabel}>Display</span>
                    {[
                      { id:'orig',    label: isHeb ? 'Hebrew' : 'Greek' },
                      { id:'translit',label:'Translit.' },
                      { id:'gloss',   label:'Gloss' },
                    ].map(m => (
                      <button
                        key={m.id}
                        style={{ ...r.displayModeBtn, ...(displayMode === m.id ? r.displayModeBtnActive : {}) }}
                        onClick={() => setDisplayMode(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                    <span style={{ marginLeft:'auto', fontSize:10, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif" }}>
                      {datasetLabel}
                    </span>
                  </div>


                  {/* Greek chapter segments */}
                  <div ref={verseListRef}>
                    {morphSegments.map((seg, segIdx) => (
                      <div key={`${seg.book}|${seg.chapter}`}>
                        {seg.book === book && seg.chapter === chapter
                          ? <h2
                              data-seg-book={seg.book}
                              data-seg-chapter={String(seg.chapter)}
                              style={r.chapterHeading}
                            >{seg.book} {seg.chapter}</h2>
                          : <div
                              data-seg-book={seg.book}
                              data-seg-chapter={String(seg.chapter)}
                              style={r.chapterDivider}
                            >
                              <span style={r.chapterDividerLine} />
                              <span style={r.chapterDividerLabel}>{seg.book} {seg.chapter}</span>
                              <span style={r.chapterDividerLine} />
                            </div>
                        }

                        <div style={r.verseList}>
                          {seg.verses.map(({ verse, words }) => {
                            const verseKey    = `kjv|${seg.book}|${seg.chapter}|${verse}`
                            const hlColorId   = highlights[verseKey] || null
                            const hlSt        = hlColorId ? getHlStyle(hlColorId) : null
                            const note        = itemNotes[verseKey]
                            const isEditing   = editingNote === verseKey
                            const isSelected  = selectedVerses.has(verseKey)
                            const isWordVerse = selectedWord?.verseKey === verseKey

                            return (
                              <div
                                key={verse}
                                id={verseId(seg.book, seg.chapter, verse)}
                                data-anchor-book={seg.book}
                                data-anchor-chapter={seg.chapter}
                                data-anchor-verse={verse}
                                style={{
                                  ...r.verseOuter,
                                  ...(isSelected ? { background:'var(--teal-light)', borderLeftColor:'var(--teal)' } :
                                      hlColorId  ? { background: hlSt.rowBg, borderLeftColor: hlSt.border } : {}),
                                }}
                              >
                                {/* ── Verse number + word chips ── */}
                                <div style={r.greekVerseRow} onClick={() => toggleVerse(verseKey)}>
                                  <span style={{ ...r.verseNum, ...(hlColorId ? { color: hlSt.numClr, background: hlSt.numBg } : {}) }}>
                                    {verse}
                                  </span>
                                  <div style={{ ...r.greekWordWrap, ...(isHeb ? { direction:'rtl' } : {}) }}>
                                    {words.map((wd, wi) => {
                                      const msMarker = parseMarker(wd.ms)
                                      const isSel    = isWordVerse && selectedWord?.wordIdx === wi
                                      const lbl      = getWordLabel(wd)
                                      return (
                                        <span
                                          key={wi}
                                          style={{
                                            ...r.greekToken,
                                            ...(displayMode === 'orig' ? (isHeb ? r.hebrewTokenOrig : r.greekTokenGk) : {}),
                                            ...(isSel ? r.greekTokenSel : {}),
                                            fontSize: chipFontSize,
                                            fontFamily: chipFontFamily,
                                          }}
                                          onClick={e => { e.stopPropagation(); handleWordTap(verseKey, wi) }}
                                          title={`${wd.w}  ${wd.t}  "${wd.g}"  ${wd.s}`}
                                        >
                                          {lbl}
                                          {msMarker && (
                                            <sup style={{
                                              fontSize:'0.55em', marginLeft:1, fontFamily:"'DM Sans',sans-serif",
                                              color: isHeb
                                                ? (msMarker === 'Q' ? '#5a3e8c' : '#1d6b5a')
                                                : (msMarker === 'TR' ? '#7c5230' : '#3e5a8c'),
                                            }}>
                                              {msMarker}
                                            </sup>
                                          )}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* ── Word info strip ── */}
                                {isWordVerse && selectedWord && (() => {
                                  const wd = words[selectedWord.wordIdx]
                                  if (!wd) return null
                                  const msMarker  = parseMarker(wd.ms)
                                  const msColor   = isHeb
                                    ? (msMarker === 'Q' ? '#5a3e8c' : '#1d6b5a')
                                    : (msMarker === 'TR' ? '#7c5230' : '#3e5a8c')
                                  const msDesc = isHeb
                                    ? { Q:'Qere — scribal correction (the spoken text)', R:'Restored — reconstructed from a parallel passage', X:'Extra — word preserved in the Septuagint (LXX)' }[msMarker]
                                    : { TR:'Textus Receptus only — present in the KJV tradition but absent from modern critical texts', NA:'Modern critical text only — absent from the Textus Receptus / KJV tradition' }[msMarker]
                                  const detail   = parseMorphDetail(wd.r)
                                  return (
                                    <div style={r.wordInfoStrip} onClick={e => e.stopPropagation()}>

                                      {/* ① Script word + transliteration */}
                                      <div style={r.wiScriptRow}>
                                        <span style={{
                                          ...(isHeb ? r.hebrewInfoWord : r.wordInfoGreek),
                                          fontSize: prefs.sizePx * (isHeb ? 1.55 : 1.4),
                                          fontFamily: origScriptFont,
                                        }}>{wd.w}</span>
                                        <span style={r.wiTranslit}>{wd.t}</span>
                                      </div>

                                      {/* ② Gloss */}
                                      <div style={r.wiGloss}>"{wd.g}"</div>

                                      {/* ③ Strong's row */}
                                      <div style={r.wiStrongsRow}>
                                        <span style={r.wiStrongsLabel}>Strong's</span>
                                        {wd.s ? (
                                          <button
                                            style={r.wiStrongsBtn}
                                            onClick={e => {
                                              e.stopPropagation()
                                              const sLang = wd.s[0].toUpperCase() === 'H' ? 'hebrew' : 'greek'
                                              setLexReturn(null)
                                              setStrongsModal({ strongsId: wd.s, lang: sLang })
                                            }}
                                            title="Open in-app lexicon"
                                          >
                                            {wd.s}
                                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{marginLeft:3,flexShrink:0}}>
                                              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                                              <path d="M4.5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                              <circle cx="4.5" cy="6.8" r="0.5" fill="currentColor"/>
                                            </svg>
                                          </button>
                                        ) : (
                                          <span style={r.wiStrongsNum}>—</span>
                                        )}
                                        <span style={r.wiStrongsHint}>tap to open lexicon</span>
                                      </div>

                                      {/* ④ Morphology breakdown table */}
                                      {detail && (
                                        <div style={r.wiMorphBlock}>
                                          <div style={r.wiMorphRow}>
                                            <span style={r.wiMorphLabel}>Part of Speech</span>
                                            <span style={r.wiMorphValue}>{detail.pos}</span>
                                          </div>
                                          {detail.items.map(it => (
                                            <div key={it.label} style={r.wiMorphRow}>
                                              <span style={r.wiMorphLabel}>{it.label}</span>
                                              <span style={r.wiMorphValue}>{it.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* ⑤ Manuscript note */}
                                      {msDesc && (
                                        <div style={{ ...r.wiMsNote, borderColor: msColor, color: msColor }}>
                                          <span style={{ fontWeight:700, marginRight:4 }}>{msMarker}</span>
                                          {msDesc}
                                        </div>
                                      )}

                                    </div>
                                  )
                                })()}

                                {/* ── Note display ── */}
                                {studyMode && note && !isEditing && (
                                  <div style={r.noteDisplay} onClick={e => { e.stopPropagation(); openNoteEditor(verseKey) }}>
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, marginTop:2, opacity:0.5 }}>
                                      <path d="M1 9l.5-2L6 2.5l2 2L3.5 9 1 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                                      <line x1="5.5" y1="3" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.2"/>
                                    </svg>
                                    <span style={{flex:1}}>{note}</span>
                                  </div>
                                )}

                                {/* ── Note editor ── */}
                                {isEditing && (
                                  <div style={r.noteEditorWrap} onClick={e => e.stopPropagation()}>
                                    <textarea
                                      value={noteDraft}
                                      onChange={e => setNoteDraft(e.target.value)}
                                      placeholder={`Note on ${seg.book} ${seg.chapter}:${verse}…`}
                                      style={r.noteTextarea}
                                      autoFocus rows={3}
                                    />
                                    <div style={r.noteEditorActions}>
                                      <button onClick={() => saveNote(verseKey)} style={r.noteSaveBtn}>Save</button>
                                      <button onClick={() => setEditingNote(null)} style={r.noteCancelBtn}>Cancel</button>
                                      {note && <button onClick={() => deleteNote(verseKey)} style={r.noteDeleteBtn}>Delete</button>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Sentinel for morph infinite scroll */}
                    {!morphLoading && <div ref={sentinelRef} style={{ height:40 }} />}
                  </div>
                </>
              )}
            </>
            )
          })()}

          {/* ══════════════════════════════════════════════
              TEXT VERSION MODE (KJV, ABAB, …)
              ══════════════════════════════════════════════ */}
          {version !== 'greek' && version !== 'hebrew' && (
            <>
              {loading && (
                <div style={r.loadingState}>
                  <div className="spinner" />
                  <p style={{ color:'var(--ink-muted)', fontSize:14, marginTop:12 }}>Loading {book} {chapter}…</p>
                </div>
              )}
              {error && !loading && (
                <div style={r.errorState}>
                  <p style={{ color:'var(--ink-muted)', fontSize:14 }}>Could not load chapter. Check your connection and try again.</p>
                </div>
              )}
              {/* ── Bible-wide search results (only when not delegated to external panel) ── */}
              {bibleResults !== null && !onSearchResults && (
                <BibleResultsPanel
                  bibleResults={bibleResults}
                  searchQuery={searchQuery}
                  onNavigate={navigate}
                  onClose={() => { setBibleResults(null); setSearchQuery(''); setBibleResultsTotal(0); setBibleResultsCapped(false) }}
                  readerRef={readerRef}
                  total={bibleResultsTotal}
                  capped={bibleResultsCapped}
                  searching={searching}
                  onLoadMore={loadAllSearchResults}
                />
              )}

              {/* ── Continuous chapter segments ── */}
              <div ref={verseListRef}>
                {!loading && !error && segments.length > 0 && bibleResults === null && segments.map((seg, segIdx) => (
                  <div key={`${seg.book}|${seg.chapter}`}>
                    {seg.book === book && seg.chapter === chapter
                      ? <h2
                          data-seg-book={seg.book}
                          data-seg-chapter={String(seg.chapter)}
                          style={r.chapterHeading}
                        >{seg.book} {seg.chapter}</h2>
                      : <div
                          data-seg-book={seg.book}
                          data-seg-chapter={String(seg.chapter)}
                          style={r.chapterDivider}
                        >
                          <span style={r.chapterDividerLine} />
                          <span style={r.chapterDividerLabel}>{seg.book} {seg.chapter}</span>
                          <span style={r.chapterDividerLine} />
                        </div>
                    }

                    <div style={r.verseList}>
                      {seg.verses.map(({ verse, text }) => {
                        const verseKey      = `kjv|${seg.book}|${seg.chapter}|${verse}`
                        const hlColorId     = highlights[verseKey] || null
                        const hlStyle       = hlColorId ? getHlStyle(hlColorId) : null
                        const note          = itemNotes[verseKey]
                        const isEditing     = editingNote === verseKey
                        const isSelected    = selectedVerses.has(verseKey)
                        const verseRefs     = getCrossRefs(seg.book, seg.chapter, verse)
                        const isActiveSegment = seg.book === book && seg.chapter === chapter
                        const isSearchMatch = isActiveSegment && !bibleResults && searchQuery.trim() && text.toLowerCase().includes(searchQuery.trim().toLowerCase())
                        const isFocusMatch  = isActiveSegment && !bibleResults && chapterMatches[searchFocus]?.verse === verse

                        // LXX word chips
                        const lxxPKey       = `${seg.book}:${seg.chapter}`
                        const lxxVerseWords = version === 'lxx'
                          ? lxxReaderWords[lxxPKey]?.find(pv => (pv.v ?? pv.verse) === verse)?.words
                          : null
                        const isLxxWordVerse = lxxReaderWord?.verseKey === verseKey

                        return (
                          <div
                            key={verse}
                            id={verseId(seg.book, seg.chapter, verse)}
                            data-anchor-book={seg.book}
                            data-anchor-chapter={seg.chapter}
                            data-anchor-verse={verse}
                            style={{
                              ...r.verseOuter,
                              ...(isSelected ? { background:'var(--teal-light)', borderLeftColor:'var(--teal)' } :
                                  hlColorId ? { background: hlStyle.rowBg, borderLeftColor: hlStyle.border } : {}),
                              ...(isFocusMatch ? { outline:'2px solid var(--teal)', outlineOffset:2, borderRadius:6 } : {}),
                              ...(isSearchMatch && !isFocusMatch && !isSelected ? { background:'rgba(254,240,138,0.25)' } : {}),
                            }}
                          >
                            {/* ── main verse row — tap to select ── */}
                            <div style={r.verseRow} onClick={() => toggleVerse(verseKey)}>
                              <span
                                style={{ ...r.verseNum, ...(hlColorId ? { color: hlStyle.numClr, background: hlStyle.numBg } : {}) }}
                              >
                                {verse}
                              </span>

                              <span style={r.verseBody}>
                                {version === 'lxx' && lxxVerseWords ? (
                                  /* ── LXX clickable word chips ── */
                                  <span style={{ display:'inline-flex', flexWrap:'wrap', gap:'2px 4px', alignItems:'baseline' }}>
                                    {lxxVerseWords.map((wd, wi) => {
                                      const isSel = isLxxWordVerse && lxxReaderWord?.wordIdx === wi
                                      return (
                                        <span
                                          key={wi}
                                          style={{
                                            ...r.greekToken,
                                            ...r.greekTokenGk,
                                            ...(isSel ? r.greekTokenSel : {}),
                                            fontSize: prefs.sizePx * 1.15,
                                            fontFamily: getGreekFontCss(prefs.greekFontId),
                                            cursor: wd.s ? 'pointer' : 'default',
                                          }}
                                          onClick={e => {
                                            e.stopPropagation()
                                            const same = lxxReaderWord?.verseKey === verseKey && lxxReaderWord?.wordIdx === wi
                                            if (same) {
                                              setLxxReaderWord(null)
                                            } else {
                                              setLxxReaderWord({ verseKey, wordIdx: wi })
                                              setSelectedVerses(prev => { const next = new Set(prev); next.add(verseKey); return next })
                                            }
                                          }}
                                          title={wd.s || ''}
                                        >
                                          {wd.w}
                                        </span>
                                      )
                                    })}
                                  </span>
                                ) : (
                                  /* ── Plain text (all non-LXX versions, and LXX fallback while loading) ── */
                                  <span
                                    style={{
                                      ...r.verseText,
                                      fontSize: prefs.sizePx,
                                      fontFamily: version === 'lxx'
                                        ? getGreekFontCss(prefs.greekFontId)
                                        : getFontCss(prefs.fontId),
                                    }}
                                  >{highlightSearchInText(text)}</span>
                                )}

                                {studyMode && verseRefs.length > 0 && (
                                  <span style={r.inlineCrossRefs}>
                                    {verseRefs.map(ref => {
                                      const chip = SRC_CHIP[ref.src] || {}
                                      return (
                                        <button
                                          key={ref.key}
                                          style={{ ...r.inlineChip, background: chip.bg, color: chip.color, borderColor: chip.border }}
                                          onClick={(e) => { e.stopPropagation(); setConfessionModal(ref) }}
                                        >
                                          <span style={{ ...r.inlineChipSrc, background: chip.color }}>{ref.src}</span>
                                          <span style={r.inlineChipLabel}>{ref.label}</span>
                                        </button>
                                      )
                                    })}
                                  </span>
                                )}

                              </span>
                            </div>

                            {/* ── LXX reader word info strip ── */}
                            {version === 'lxx' && isLxxWordVerse && lxxReaderWord && (() => {
                              const wd = lxxVerseWords?.[lxxReaderWord.wordIdx]
                              if (!wd) return null
                              const grFont = getGreekFontCss(prefs.greekFontId)
                              return (
                                <div style={r.wordInfoStrip} onClick={e => e.stopPropagation()}>
                                  <div style={r.wiScriptRow}>
                                    <span style={{ ...r.wordInfoGreek, fontSize: prefs.sizePx * 1.4, fontFamily: grFont }}>{wd.w}</span>
                                    <span style={{ fontSize:11, color:'#0c4a6e', fontStyle:'italic', marginLeft:6, fontFamily:"'DM Sans',sans-serif" }}>LXX Septuagint</span>
                                  </div>
                                  <div style={r.wiStrongsRow}>
                                    <span style={r.wiStrongsLabel}>Strong's</span>
                                    {wd.s ? (
                                      <button
                                        style={r.wiStrongsBtn}
                                        onClick={e => {
                                          e.stopPropagation()
                                          setStrongsModal({ strongsId: wd.s, lang: 'greek' })
                                        }}
                                        title="Open in-app lexicon"
                                      >
                                        {wd.s}
                                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{marginLeft:3,flexShrink:0}}>
                                          <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                                          <path d="M4.5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                          <circle cx="4.5" cy="6.8" r="0.5" fill="currentColor"/>
                                        </svg>
                                      </button>
                                    ) : (
                                      <span style={r.wiStrongsNum}>—</span>
                                    )}
                                    <span style={r.wiStrongsHint}>tap to open lexicon</span>
                                  </div>
                                </div>
                              )
                            })()}

                            {/* ── Parallel original-language section ── */}
                            {parallelMode && (() => {
                              const pKey    = `${seg.book}:${seg.chapter}`
                              const isNT    = NT_BOOKS.has(seg.book)
                              const isHeb   = !isNT
                              const lang    = isNT ? 'GNT' : 'HOT'

                              // GNT/HOT data — only show for the relevant testament
                              const showMorph = (isNT && parallelVersions.has('gnt')) || (isHeb && parallelVersions.has('hot'))
                              const morphCh   = showMorph ? parallelData[pKey] : null
                              const morphVerse = morphCh?.find(pv => pv.verse === verse)

                              // LXX data (OT only) — lxx-words.json uses 'v' key (not 'verse')
                              const lxxCh    = (isHeb && parallelVersions.has('lxx')) ? parallelLxxData[pKey] : null
                              const lxxVerse = lxxCh?.find(pv => (pv.v ?? pv.verse) === verse)

                              if (!morphVerse && !lxxVerse) return null

                              const grFont  = getGreekFontCss(prefs.greekFontId)
                              const hebFont = getHebrewFontCss(prefs.hebrewFontId)
                              const grSize  = prefs.sizePx * 1.15
                              const hebSize = prefs.sizePx * 1.3

                              // Parallel word selection keys
                              const morphVK = `par|${lang}|${seg.book}|${seg.chapter}|${verse}`
                              const lxxVK   = `par|LXX|${seg.book}|${seg.chapter}|${verse}`
                              const pW      = parallelWord
                              const morphWordSel = pW?.verseKey === morphVK ? pW.wordIdx : -1
                              const lxxWordSel   = pW?.verseKey === lxxVK   ? pW.wordIdx : -1

                              // Shared morph helpers (mirrors full mode)
                              const parseMarkerFn      = isHeb ? getHebMsMarker : getMsMarker
                              const parseMorphDetailFn = isHeb ? parseHebrewMorphDetails : parseMorphDetails

                              return (
                                <div style={r.parallelBlock}>

                                  {/* ── GNT / HOT word chips ── */}
                                  {morphVerse && (
                                    <>
                                      <div style={r.parallelLine}>
                                        <span style={{
                                          ...r.parallelBadge,
                                          background: isNT ? 'rgba(61,43,107,0.10)' : 'rgba(29,107,90,0.10)',
                                          color:      isNT ? '#3d2b6b' : '#1d6b5a',
                                        }}>{lang}</span>
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:'2px 4px', direction: isHeb ? 'rtl' : 'ltr', flex:1 }}>
                                          {morphVerse.words.map((wd, wi) => {
                                            const isSel = wi === morphWordSel
                                            return (
                                              <span
                                                key={wi}
                                                style={{
                                                  ...r.greekToken,
                                                  ...(isHeb ? r.hebrewTokenOrig : r.greekTokenGk),
                                                  ...(isSel ? r.greekTokenSel : {}),
                                                  fontSize: isHeb ? hebSize : grSize,
                                                  fontFamily: isHeb ? hebFont : grFont,
                                                  cursor:'pointer',
                                                }}
                                                onClick={e => {
                                                  e.stopPropagation()
                                                  setParallelWord(isSel ? null : { verseKey: morphVK, lang, wordIdx: wi })
                                                }}
                                                title={`${wd.w}  ${wd.t}  "${wd.g}"  ${wd.s || ''}`}
                                              >
                                                {wd.w}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>

                                      {/* GNT/HOT word info strip */}
                                      {morphWordSel >= 0 && (() => {
                                        const wd = morphVerse.words[morphWordSel]
                                        if (!wd) return null
                                        const msMarker = parseMarkerFn(wd.ms)
                                        const msColor  = isHeb
                                          ? (msMarker === 'Q' ? '#5a3e8c' : '#1d6b5a')
                                          : (msMarker === 'TR' ? '#7c5230' : '#3e5a8c')
                                        const msDesc = isHeb
                                          ? { Q:'Qere — scribal correction', R:'Restored — reconstructed from parallel', X:'Extra — preserved in the LXX' }[msMarker]
                                          : { TR:'Textus Receptus only', NA:'Modern critical text only' }[msMarker]
                                        const detail = parseMorphDetailFn(wd.r)
                                        return (
                                          <div style={{ ...r.wordInfoStrip, marginLeft:28 }} onClick={e => e.stopPropagation()}>
                                            <div style={r.wiScriptRow}>
                                              <span style={{
                                                ...(isHeb ? r.hebrewInfoWord : r.wordInfoGreek),
                                                fontSize: prefs.sizePx * (isHeb ? 1.55 : 1.4),
                                                fontFamily: isHeb ? hebFont : grFont,
                                              }}>{wd.w}</span>
                                              <span style={r.wiTranslit}>{wd.t}</span>
                                            </div>
                                            <div style={r.wiGloss}>"{wd.g}"</div>
                                            <div style={r.wiStrongsRow}>
                                              <span style={r.wiStrongsLabel}>Strong's</span>
                                              {wd.s ? (
                                                <button style={r.wiStrongsBtn} onClick={e => {
                                                  e.stopPropagation()
                                                  setStrongsModal({ strongsId: wd.s, lang: wd.s[0].toUpperCase() === 'H' ? 'hebrew' : 'greek' })
                                                }}>
                                                  {wd.s}
                                                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{marginLeft:3}}>
                                                    <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                                                    <path d="M4.5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                                    <circle cx="4.5" cy="6.8" r="0.5" fill="currentColor"/>
                                                  </svg>
                                                </button>
                                              ) : <span style={r.wiStrongsNum}>—</span>}
                                              <span style={r.wiStrongsHint}>tap to open lexicon</span>
                                            </div>
                                            {detail && (
                                              <div style={r.wiMorphBlock}>
                                                <div style={r.wiMorphRow}>
                                                  <span style={r.wiMorphLabel}>Part of Speech</span>
                                                  <span style={r.wiMorphValue}>{detail.pos}</span>
                                                </div>
                                                {detail.items.map(it => (
                                                  <div key={it.label} style={r.wiMorphRow}>
                                                    <span style={r.wiMorphLabel}>{it.label}</span>
                                                    <span style={r.wiMorphValue}>{it.value}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {msDesc && (
                                              <div style={{ ...r.wiMsNote, borderColor: msColor, color: msColor }}>
                                                <span style={{ fontWeight:700, marginRight:4 }}>{msMarker}</span>{msDesc}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </>
                                  )}

                                  {/* ── LXX word chips (OT only) ── */}
                                  {isHeb && lxxVerse && (
                                    <>
                                      <div style={r.parallelLine}>
                                        <span style={{
                                          ...r.parallelBadge,
                                          background: 'rgba(12,74,110,0.10)',
                                          color: '#0c4a6e',
                                        }}>LXX</span>
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:'2px 4px', flex:1 }}>
                                          {lxxVerse.words.map((lw, wi) => {
                                            const isSel = wi === lxxWordSel
                                            return (
                                              <span
                                                key={wi}
                                                style={{
                                                  ...r.greekToken,
                                                  ...r.greekTokenGk,
                                                  ...(isSel ? r.greekTokenSel : {}),
                                                  fontSize: grSize,
                                                  fontFamily: grFont,
                                                  cursor: lw.s ? 'pointer' : 'default',
                                                }}
                                                onClick={e => {
                                                  e.stopPropagation()
                                                  setParallelWord(isSel ? null : { verseKey: lxxVK, lang: 'LXX', wordIdx: wi })
                                                }}
                                                title={lw.s || ''}
                                              >
                                                {lw.w}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>

                                      {/* LXX word Strongs info */}
                                      {lxxWordSel >= 0 && (() => {
                                        const lw = lxxVerse.words[lxxWordSel]
                                        if (!lw) return null
                                        return (
                                          <div style={{ ...r.wordInfoStrip, marginLeft:28 }} onClick={e => e.stopPropagation()}>
                                            <div style={r.wiScriptRow}>
                                              <span style={{ ...r.wordInfoGreek, fontSize: prefs.sizePx * 1.4, fontFamily: grFont }}>{lw.w}</span>
                                              <span style={{ fontSize:11, color:'var(--ink-faint)', fontStyle:'italic', marginLeft:6 }}>LXX Septuagint</span>
                                            </div>
                                            <div style={r.wiStrongsRow}>
                                              <span style={r.wiStrongsLabel}>Strong's</span>
                                              {lw.s ? (
                                                <button style={r.wiStrongsBtn} onClick={e => {
                                                  e.stopPropagation()
                                                  setStrongsModal({ strongsId: lw.s, lang: 'greek' })
                                                }}>
                                                  {lw.s}
                                                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{marginLeft:3}}>
                                                    <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                                                    <path d="M4.5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                                    <circle cx="4.5" cy="6.8" r="0.5" fill="currentColor"/>
                                                  </svg>
                                                </button>
                                              ) : <span style={r.wiStrongsNum}>—</span>}
                                              <span style={r.wiStrongsHint}>tap to open lexicon</span>
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </>
                                  )}

                                </div>
                              )
                            })()}

                            {/* ── Text parallel (ABAB/KJV) ── */}
                            {textParallelVersion && (() => {
                              const tKey    = `${seg.book}:${seg.chapter}:${textParallelVersion}`
                              const tVData  = parallelTextData[tKey]
                              const tVerse  = tVData?.find(tv => tv.verse === verse)
                              if (!tVerse) return null
                              const tLabel  = textParallelVersion === 'abab' ? 'ABAB' : 'KJV'
                              const morphVerse = parallelData[`${seg.book}:${seg.chapter}`]?.find(pv => pv.verse === verse)
                              const lxxVerse = parallelLxxData[`${seg.book}:${seg.chapter}`]?.find(pv => (pv.v ?? pv.verse) === verse)
                              return (
                                <div style={{ ...r.parallelBlock, borderTop: morphVerse || lxxVerse ? 'none' : '1px solid var(--border)', paddingTop: morphVerse || lxxVerse ? 0 : 8 }}>
                                  <div style={r.parallelLine}>
                                    <span style={{ ...r.parallelBadge, background:'rgba(120,80,20,0.10)', color:'var(--amber-ink)' }}>
                                      {tLabel}
                                    </span>
                                    <span style={{ fontSize: prefs.sizePx * 0.92, color:'var(--ink-muted)', lineHeight:1.7, flex:1 }}>
                                      {tVerse.text}
                                    </span>
                                  </div>
                                </div>
                              )
                            })()}

                            {studyMode && note && !isEditing && (
                              <div style={r.noteDisplay} onClick={(e) => { e.stopPropagation(); openNoteEditor(verseKey) }}>
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, marginTop:2, opacity:0.5 }}>
                                  <path d="M1 9l.5-2L6 2.5l2 2L3.5 9 1 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                                  <line x1="5.5" y1="3" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.2"/>
                                </svg>
                                <span style={{flex:1}}>{note}</span>
                                <button onClick={e => { e.stopPropagation(); handleShareNote(verseKey, note, text) }} style={r.noteShareBtn} title="Share note">
                                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                    <circle cx="8.5" cy="2" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                                    <circle cx="8.5" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                                    <circle cx="2.5" cy="5.5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                                    <path d="M3.8 4.9l3.5-2.4M3.8 6.1l3.5 2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                  </svg>
                                </button>
                              </div>
                            )}

                            {isEditing && (
                              <div style={r.noteEditorWrap} onClick={(e) => e.stopPropagation()}>
                                <textarea
                                  value={noteDraft}
                                  onChange={e => setNoteDraft(e.target.value)}
                                  placeholder={`Note on ${seg.book} ${seg.chapter}:${verse}…`}
                                  style={r.noteTextarea}
                                  autoFocus rows={3}
                                />
                                <div style={r.noteEditorActions}>
                                  <button onClick={() => saveNote(verseKey)} style={r.noteSaveBtn}>Save</button>
                                  <button onClick={() => setEditingNote(null)} style={r.noteCancelBtn}>Cancel</button>
                                  {note && <button onClick={() => deleteNote(verseKey)} style={r.noteDeleteBtn}>Delete</button>}
                                </div>
                              </div>
                            )}

                            {/* ── Author cross-refs (forward links + automatic back-refs) ── */}
                            {(() => {
                              const chKey    = `${seg.book}:${seg.chapter}`
                              const xrefs    = authorCrossRefs[chKey]?.[verse] || []
                              const backRefs = authorBackRefs[chKey]?.[verse]  || []
                              const avk      = `${seg.book}:${seg.chapter}:${verse}`
                              const isAddingHere = addingCrossRefTo === avk
                              // Show row if: editing (canEdit), or study mode with refs to display
                              if (!canEdit && !isAddingHere && (!studyMode || (!xrefs.length && !backRefs.length))) return null
                              return (
                                <div style={r.authorXrefRow} onClick={e => e.stopPropagation()}>
                                  <span style={r.authorXrefIcon}>↗</span>
                                  {/* Forward links (author-added from this verse) */}
                                  {xrefs.map(ref => {
                                    const tgt = `${ref.tgt_book} ${ref.tgt_chapter}${ref.tgt_verse ? ':' + ref.tgt_verse : ''}`
                                    const shortLabel = ref.label ? ref.label.split(' - ')[0] : null
                                    const chipLabel = shortLabel || tgt
                                    return (
                                      <span key={ref.id} style={r.authorXrefChipWrap}>
                                        <button
                                          style={r.authorXrefChip}
                                          onClick={e => {
                                            e.stopPropagation()
                                            // Show verse preview modal instead of navigating directly
                                            setAuthorRefModal({ ref })
                                          }}
                                          title={`Author link → ${tgt}`}
                                        >{chipLabel}</button>
                                        {canEdit && (
                                          <button style={r.authorXrefDeleteBtn}
                                            onClick={e => { e.stopPropagation(); removeAuthorCrossRef(ref) }}
                                            title="Remove link">×</button>
                                        )}
                                      </span>
                                    )
                                  })}
                                  {/* Back-references — automatically shown when another passage links here */}
                                  {backRefs.map(ref => {
                                    const src = `${ref.src_book} ${ref.src_chapter}:${ref.src_verse}`
                                    const shortLabel = ref.label ? ref.label.split(' - ')[0] : null
                                    const chipLabel = shortLabel || src
                                    const syntheticRef = {
                                      id:          ref.id,
                                      tgt_book:    ref.src_book,
                                      tgt_chapter: ref.src_chapter,
                                      tgt_verse:   ref.src_verse,
                                      label:       ref.label,
                                    }
                                    return (
                                      <span key={`back-${ref.id}`} style={r.authorXrefChipWrap}>
                                        <button
                                          style={{ ...r.authorXrefChip, borderRadius: 99 }}
                                          onClick={e => {
                                            e.stopPropagation()
                                            setAuthorRefModal({ ref: syntheticRef })
                                          }}
                                          title={`Back-link from ${src}`}
                                        >↩ {chipLabel}</button>
                                      </span>
                                    )
                                  })}
                                  {canEdit && !isAddingHere && (
                                    <button style={r.authorXrefAddBtn}
                                      onClick={e => {
                                        e.stopPropagation()
                                        setAddingCrossRefTo(avk)
                                        setCrossRefDraft({ tgt_book: '', tgt_chapter: '', tgt_verse: '', label: '' })
                                        setEditingAuthorNote(null)
                                      }}
                                      title="Add passage link">+ link</button>
                                  )}
                                  {canEdit && isAddingHere && (
                                    <div style={r.authorXrefForm}>
                                      <div style={r.authorXrefFormRow}>
                                        <input
                                          style={r.authorXrefInput}
                                          placeholder="Book (e.g. Numbers)"
                                          value={crossRefDraft.tgt_book}
                                          onChange={e => setCrossRefDraft(d => ({ ...d, tgt_book: e.target.value }))}
                                          list="author-xref-book-list"
                                        />
                                        <datalist id="author-xref-book-list">
                                          {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name} />)}
                                        </datalist>
                                        <input
                                          style={{ ...r.authorXrefInput, width: 48 }}
                                          placeholder="Ch"
                                          value={crossRefDraft.tgt_chapter}
                                          onChange={e => setCrossRefDraft(d => ({ ...d, tgt_chapter: e.target.value }))}
                                          type="number" min="1"
                                        />
                                        <input
                                          style={{ ...r.authorXrefInput, width: 48 }}
                                          placeholder="Vs"
                                          value={crossRefDraft.tgt_verse}
                                          onChange={e => setCrossRefDraft(d => ({ ...d, tgt_verse: e.target.value }))}
                                          type="number" min="1"
                                        />
                                      </div>
                                      <div style={r.authorXrefFormRow}>
                                        <input
                                          style={{ ...r.authorXrefInput, flex: 1 }}
                                          placeholder="Label (optional)"
                                          value={crossRefDraft.label}
                                          onChange={e => setCrossRefDraft(d => ({ ...d, label: e.target.value }))}
                                        />
                                        <button style={r.noteSaveBtn}
                                          onClick={e => { e.stopPropagation(); saveAuthorCrossRef(seg.book, seg.chapter, verse) }}>
                                          Save
                                        </button>
                                        <button style={r.noteCancelBtn}
                                          onClick={e => { e.stopPropagation(); setAddingCrossRefTo(null) }}>
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* ── Author study note (visible to all in study mode) ── */}
                            {(() => {
                              const chKey    = `${seg.book}:${seg.chapter}`
                              const authorNoteObj = authorNotes[chKey]?.[verse]
                              const avk      = `${seg.book}:${seg.chapter}:${verse}`
                              const isEditingAuthor = editingAuthorNote === avk
                              // Show if canEdit (author can manage), or if studyMode and note exists
                              if (!canEdit && (!studyMode || !authorNoteObj)) return null
                              return (
                                <div style={r.authorNoteBlock} onClick={e => e.stopPropagation()}>
                                  {/* Display mode (all users see this when a note exists) */}
                                  {authorNoteObj && !isEditingAuthor && (
                                    <div style={r.authorNoteDisplay}>
                                      <div style={r.authorNoteHeader}>
                                        <span style={r.authorNoteLabel}>Study Note</span>
                                        {canEdit && (
                                          <button style={r.authorEditBtn}
                                            onClick={() => openAuthorNoteEditor(seg.book, seg.chapter, verse)}
                                            title="Edit study note">
                                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                              <path d="M2 9l.5-2L7.5 1.5l2 2L4.5 9 2 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                                              <line x1="7" y1="2" x2="9" y2="4" stroke="currentColor" strokeWidth="1.2"/>
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                      <p style={r.authorNoteText}>{authorNoteObj.note}</p>
                                    </div>
                                  )}
                                  {/* Author edit / add controls — only in edit mode */}
                                  {canEdit && !isEditingAuthor && !authorNoteObj && (
                                    <button style={r.authorAddNoteBtn}
                                      onClick={() => openAuthorNoteEditor(seg.book, seg.chapter, verse)}
                                      title="Add study note">
                                      + Study Note
                                    </button>
                                  )}
                                  {canEdit && isEditingAuthor && (
                                    <div style={r.noteEditorWrap}>
                                      <div style={r.authorNoteHeader}>
                                        <span style={r.authorNoteLabel}>Study Note</span>
                                      </div>
                                      <textarea
                                        value={authorNoteDraft}
                                        onChange={e => setAuthorNoteDraft(e.target.value)}
                                        placeholder={`Study note for ${seg.book} ${seg.chapter}:${verse}…`}
                                        style={{ ...r.noteTextarea, minHeight: 72 }}
                                        autoFocus rows={4}
                                      />
                                      <div style={r.noteEditorActions}>
                                        <button onClick={() => saveAuthorNote(seg.book, seg.chapter, verse)} style={r.noteSaveBtn}>Save</button>
                                        <button onClick={() => setEditingAuthorNote(null)} style={r.noteCancelBtn}>Cancel</button>
                                        {authorNoteObj && <button onClick={() => removeAuthorNote(seg.book, seg.chapter, verse)} style={r.noteDeleteBtn}>Delete</button>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Sentinel — IntersectionObserver triggers next chapter load here */}
                {!loading && !bibleResults && <div ref={sentinelRef} style={{ height:40 }} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Floating action bar — tap to select verses, then act ── */}
      {selectedVerses.size > 0 && (
        <div style={r.floatingBar}>
          <div style={r.floatingBarMain}>
            {/* Deselect */}
            <button style={r.floatingDeselect} onClick={clearSelection} title="Deselect all">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
            <span style={r.floatingCount}>{selectedVerses.size} verse{selectedVerses.size !== 1 ? 's' : ''}</span>

            {/* Highlight */}
            <button
              style={{ ...r.floatingBtn, ...(colorBarOpen ? { color:'var(--teal)', borderColor:'var(--teal)', background:'var(--teal-light)' } : {}) }}
              onClick={() => setColorBarOpen(o => !o)}
              title="Highlight"
            >
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                <path d="M2 11h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 8.5L8.5 4 10 5.5 5.5 10 3.5 10.5 4 8.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Note — single verse only */}
            <button
              style={{ ...r.floatingBtn, ...(selectedVerses.size !== 1 ? { opacity:0.35, cursor:'default' } : {}) }}
              onClick={openNoteForSelection}
              title={selectedVerses.size !== 1 ? 'Select a single verse to add a note' : 'Add / edit note'}
            >
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                <path d="M2 11l.6-2.4L8 3l2 2-5.4 5.6L2 11Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <line x1="7" y1="3.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            </button>

            {/* Share */}
            <button style={r.floatingBtn} onClick={shareSelection} title="Share selected">
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                <circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <circle cx="3" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M4.4 5.8l4.2-2.8M4.4 7.2l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Copy */}
            <button
              style={{ ...r.floatingBtn, ...(copiedKey === 'selection' ? { color:'var(--teal)', borderColor:'var(--teal)', background:'var(--teal-light)' } : {}) }}
              onClick={copySelection}
              title={copiedKey === 'selection' ? 'Copied!' : 'Copy selected'}
            >
              {copiedKey === 'selection' ? (
                <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                  <polyline points="2,7 5,10 11,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                  <rect x="4.5" y="4.5" width="7" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1.5" y="2" width="7" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              )}
            </button>
          </div>

          {/* Color picker row — shown when highlight is tapped */}
          {colorBarOpen && (
            <div style={r.floatingColorRow}>
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => applyHighlightToSelection(c.id)}
                  style={{
                    width:26, height:26, borderRadius:'50%',
                    background:c.dot, border:'none', cursor:'pointer', padding:0,
                    transition:'transform 0.1s', flexShrink:0,
                  }}
                />
              ))}
              <button
                title="Remove highlight"
                onClick={() => applyHighlightToSelection(null)}
                style={{
                  width:26, height:26, borderRadius:'50%', background:'var(--border-strong)',
                  border:'none', cursor:'pointer', fontSize:15, color:'var(--ink-muted)',
                  display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0,
                }}
              >×</button>
            </div>
          )}
        </div>
      )}

      {/* Share card modal */}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />

      {/* Confession modal */}
      {confessionModal && (
        <ConfessionModal
          src={confessionModal.src}
          label={confessionModal.label}
          text={confessionModal.text}
          refs={confessionModal.refs}
          onClose={() => setConfessionModal(null)}
          onGoTo={() => {
            // Compute target tab + itemKey for deep-linking into ConfessionsPage
            const { src, key } = confessionModal
            let tab = '2lbcf', itemKey = key, source = '2lbcf'
            if (src === 'Catechism') {
              tab = 'catechism'; source = 'catechism'
              itemKey = key.replace(/^cat\./, '')
            } else if (src === '1LBCF') {
              tab = '1lbcf'; source = '1lbcf'
              itemKey = key.replace(/^lbcf1\./, '')
            } else if (src === 'Orthodox') {
              tab = 'orthodox'; source = 'orthodox'
              itemKey = key.replace(/^orthodox\./, '')
            }
            routerNavigate(`/confessions?t=${tab}`, { state: { itemKey, source } })
          }}
        />
      )}

      {/* Strong's lexicon modal */}
      {strongsModal && (
        <StrongsModal
          strongsId={strongsModal.strongsId}
          lang={strongsModal.lang}
          initialView={strongsModal.initialView || 'detail'}
          greekFontId={prefs.greekFontId}
          hebrewFontId={prefs.hebrewFontId}
          onClose={() => setStrongsModal(null)}
          onNavigate={(b, ch, v) => {
            // Save return context so user can go back to results
            const { strongsId: sid, lang: slang } = strongsModal
            setLexReturn({ strongsId: sid, lang: slang })
            // After morph chapter loads, auto-select the matched word
            if (v) pendingLexHighlightRef.current = { book: b, chapter: ch, verse: v, strongsId: sid }
            setStrongsModal(null)
            // Switch to the correct morphological version matching the corpus:
            // GNT results require Greek mode; HOT results require Hebrew mode.
            // Set lexNavVersionRef so the version load effect knows NOT to clear
            // lexReturn / pendingLexHighlightRef (they must survive the version switch).
            if (slang === 'greek' && version !== 'greek') {
              lexNavVersionRef.current = 'greek'
              onVersionChange?.('greek')
            } else if (slang === 'hebrew' && version !== 'hebrew') {
              lexNavVersionRef.current = 'hebrew'
              onVersionChange?.('hebrew')
            }
            navigate(b, ch)
            // Scroll to the target verse after morph data loads (longer delay for version switch)
            if (v) {
              setTimeout(() => {
                const el = readerRef.current?.querySelector(`#${verseId(b, ch, v)}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }, 500)
            }
          }}
          onNavigateLxx={(b, ch, v) => {
            // Navigate to a verse in LXX reader mode, then auto-highlight the matched word
            const { strongsId: sid } = strongsModal
            setLexReturn({ strongsId: sid, lang: 'greek' })
            if (v) pendingLxxHighlightRef.current = { book: b, chapter: ch, verse: v, strongsId: sid }
            setStrongsModal(null)
            navigate(b, ch)
            // Switch to LXX version if not already.
            // Set lexNavVersionRef so the version load effect doesn't clear pendingLxxHighlightRef.
            if (version !== 'lxx') {
              lexNavVersionRef.current = 'lxx'
              onVersionChange?.('lxx')
            }
          }}
        />
      )}

      {/* Floating "Back to Lexicon" pill — shown after navigating from scripture results */}
      {lexReturn && !strongsModal && (
        <div style={r.lexBackPill}>
          <button
            style={r.lexBackBtn}
            onClick={() => {
              setStrongsModal({ strongsId: lexReturn.strongsId, lang: lexReturn.lang, initialView: 'scripture' })
              setLexReturn(null) // pill is consumed — don't show again after modal closes
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to lexicon results
          </button>
          <button style={r.lexBackDismiss} onClick={() => setLexReturn(null)} title="Dismiss">×</button>
        </div>
      )}

      {/* Author cross-ref verse preview modal */}
      {authorRefModal && (() => {
        const ref = authorRefModal.ref
        const tgtRef = `${ref.tgt_book} ${ref.tgt_chapter}${ref.tgt_verse ? ':' + ref.tgt_verse : ''}`

        function doNavigate() {
          const tgtIsNT = NT_BOOKS.has(ref.tgt_book)
          const tgtIsOT = !tgtIsNT
          const needsSwitch =
            (tgtIsNT && (version === 'lxx' || version === 'hebrew')) ||
            (tgtIsOT && version === 'greek')
          setAuthorRefModal(null)
          if (needsSwitch) {
            const isOrigLang = version === 'hebrew' || version === 'greek' || version === 'lxx'
            const nextVer = isOrigLang ? (tgtIsNT ? 'greek' : 'hebrew') : 'kjv'
            onVersionChange?.(nextVer)
            try { sessionStorage.setItem('reader-version', nextVer) } catch {}
            setTimeout(() => {
              navigate(ref.tgt_book, ref.tgt_chapter)
              if (ref.tgt_verse) pendingVerseRef.current = { book: ref.tgt_book, chapter: ref.tgt_chapter, verse: ref.tgt_verse }
            }, 120)
          } else {
            navigate(ref.tgt_book, ref.tgt_chapter)
            if (ref.tgt_verse) pendingVerseRef.current = { book: ref.tgt_book, chapter: ref.tgt_chapter, verse: ref.tgt_verse }
          }
        }

        return (
          <div style={r.modalBackdrop} onClick={() => setAuthorRefModal(null)}>
            <div style={r.authorRefModalBox} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={r.authorRefModalHeader}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={r.authorRefModalRef}>{tgtRef}</span>
                  {ref.label && <span style={r.authorRefModalLabel}>{ref.label}</span>}
                </div>
                <button style={r.confCloseBtn} onClick={() => setAuthorRefModal(null)}>✕</button>
              </div>

              {/* Verse text */}
              <div style={r.authorRefModalBody}>
                {ref.tgt_verse ? (
                  authorRefModalText
                    ? <p style={r.authorRefModalVerseText}>
                        <span style={r.authorRefModalVerseNum}>{ref.tgt_verse}</span>
                        {authorRefModalText}
                      </p>
                    : <p style={{ color:'var(--ink-faint)', fontSize:13, fontFamily:"'DM Sans',sans-serif", margin:0 }}>Loading…</p>
                ) : (
                  <p style={{ color:'var(--ink-faint)', fontSize:13, fontFamily:"'DM Sans',sans-serif", margin:0 }}>
                    Navigate to read {ref.tgt_book} {ref.tgt_chapter}
                  </p>
                )}
              </div>

              {/* Footer action */}
              <div style={r.authorRefModalFooter}>
                <button style={r.authorRefModalGoBtn} onClick={doNavigate}>
                  Go to {tgtRef}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginLeft:5, flexShrink:0 }}>
                    <path d="M3 6.5h7M7 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* KJV word-tap search modal — disabled; use the search panel (magnifying glass) instead */}
    </div>
  )
})

export default KjvReader

/* ── Sidebar styles ── */
const sb = {
  sidebar: {
    height:'100%', overflowY:'auto', padding:'8px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
  sidebarTitle: {
    fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'var(--ink-faint)', padding:'8px 14px 4px',
  },
  testSection: { marginBottom:4 },
  testHeader: {
    display:'flex', alignItems:'center', gap:6,
    padding:'6px 14px 4px', borderBottom:'1px solid var(--border)',
  },
  testBadge: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },
  testLabel: { fontSize:11, fontWeight:600, color:'var(--ink-muted)', fontFamily:"'Cormorant Garamond',serif" },
  catBtn: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', padding:'7px 14px', border:'none', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.15s',
  },
  catLabel: { fontSize:11, fontWeight:700, letterSpacing:'0.02em' },
  bookList: { paddingLeft:0, paddingBottom:4 },
  bookBtn: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', padding:'5px 14px 5px 22px',
    border:'none', borderLeft:'3px solid transparent',
    background:'transparent', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", fontSize:12.5, color:'var(--ink)',
    transition:'all 0.12s', textAlign:'left',
  },
  bookMeta: { display:'flex', alignItems:'center', fontSize:10, color:'var(--ink-faint)', marginLeft:4, flexShrink:0 },

  /* ── Version picker ── */
  versionSection: {
    padding:'8px 14px 10px',
    borderBottom:'1px solid var(--border)',
    marginBottom:4,
  },
  versionSectionTitle: {
    fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'var(--ink-faint)', marginBottom:6,
    fontFamily:"'DM Sans',sans-serif",
  },
  versionList: {
    display:'flex', flexDirection:'column', gap:4,
  },
  versionBtn: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'6px 10px', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', cursor:'pointer',
    background:'none', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.12s', textAlign:'left', width:'100%',
  },
  versionBtnActive: {
    background:'var(--teal)', borderColor:'var(--teal)',
  },
  versionAbbr: {
    fontSize:12, fontWeight:700, color:'var(--ink)',
  },
  versionLang: {
    fontSize:10, color:'var(--ink-faint)',
  },
  chapterGrid: {
    display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4,
    padding:'8px 14px 4px 22px', background:'rgba(0,0,0,0.02)',
  },
  chapterBtn: {
    padding:'4px 6px', border:'1px solid var(--border)', borderRadius:4,
    background:'white', color:'var(--ink)', fontSize:10, fontWeight:500,
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.1s',
  },
  parallelSection: {
    padding:'12px 12px 10px',
    borderTop:'1px solid var(--border)',
  },
  parallelPills: {
    display:'flex', flexWrap:'wrap', gap:6, marginTop:8,
  },
  parallelPill: {
    padding:'4px 11px', borderRadius:99, fontSize:11, fontWeight:700,
    border:'1.5px solid var(--border-strong)', background:'var(--surface)',
    color:'var(--ink-muted)', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.15s', letterSpacing:'0.02em',
  },
  parallelPillActive: {
    background:'var(--teal-light)', borderColor:'var(--teal)', color:'var(--teal)',
  },
}

/* ── Reader styles ── */
const r = {
  wrap: {
    display:'flex',
    flexDirection:'column',
    flex:1,
    minHeight:0,
    overflow:'hidden', position:'relative',
  },
  backdrop: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:199 },
  sidebar: {
    position:'absolute', left:0, top:0, bottom:0,
    width:220, background:'var(--surface)',
    borderRight:'1px solid var(--border)', overflowY:'auto',
  },
  mobileNavHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 14px', borderBottom:'1px solid var(--border)',
    fontFamily:"'DM Sans',sans-serif",
  },
  closeBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', padding:4 },

  readerWrap: {
    flex:1, display:'flex', flexDirection:'column', overflowY:'auto',
    background:'var(--parchment)',
  },

  toolbar: {
    display:'flex', alignItems:'center', gap:8,
    padding:'8px 12px', background:'var(--surface)',
    fontFamily:"'DM Sans',sans-serif",
  },
  bookPill: {
    display:'flex', alignItems:'center', gap:8, flex:1,
    padding:'7px 12px', borderRadius:'var(--radius-lg)',
    border:'1.5px solid var(--border)', background:'var(--parchment)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    textAlign:'left', minWidth:0, transition:'border-color 0.15s',
  },
  bookPillName: {
    fontSize:15, fontWeight:700,
    fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
  },
  bookPillCh: {
    fontSize:12, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', borderRadius:99,
    padding:'1px 8px', flexShrink:0,
  },
  todayBadge: {
    fontSize:9, fontWeight:700, background:'var(--teal)', color:'white',
    borderRadius:99, padding:'2px 6px', letterSpacing:'0.04em',
  },
  toolBtn: {
    background:'transparent', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', padding:'5px 9px',
    cursor:'pointer', color:'var(--ink-muted)',
    fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
    display:'flex', alignItems:'center', gap:4,
    transition:'all 0.12s',
  },

  /* Search — inline in toolbar */
  searchInputWrap: {
    display:'flex', alignItems:'center', gap:6,
    border:'1.5px solid var(--border)', borderRadius:'var(--radius)',
    padding:'0 8px', background:'var(--parchment)',
    transition:'border-color 0.15s',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:12, color:'var(--ink)', padding:'6px 0',
    fontFamily:"'DM Sans',sans-serif", minWidth:0,
  },
  searchClear: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    fontSize:16, lineHeight:1, padding:'0 2px', flexShrink:0,
  },
  /* Status bar — sticky just below the page header */
  searchStatusBar: {
    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
    padding:'5px 14px', background:'var(--surface)',
    borderBottom:'1px solid var(--border)',
    position:'sticky', top:56, zIndex:9,
    fontFamily:"'DM Sans',sans-serif",
  },
  searchNavBtn: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:4, padding:'3px 7px', cursor:'pointer', fontSize:12,
    color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif",
  },

  /* History dropdown */
  histDropdown: {
    position:'absolute', top:0, left:0, right:0, zIndex:20,
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
    overflow:'hidden', fontFamily:"'DM Sans',sans-serif",
  },
  histHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'8px 12px', borderBottom:'1px solid var(--border)',
  },
  histTitle: { fontSize:10, fontWeight:700, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.06em' },
  histClearAll: { fontSize:11, fontWeight:600, color:'var(--teal)', background:'none', border:'none', cursor:'pointer', padding:0 },
  histRow: { display:'flex', alignItems:'center' },
  histItem: {
    display:'flex', alignItems:'center', gap:8, flex:1,
    padding:'8px 12px', background:'none', border:'none', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
  },
  histItemText: { fontSize:13, color:'var(--ink)', flex:1 },
  histRemove: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    fontSize:16, padding:'0 12px', flexShrink:0,
  },

  /* Selection hint */
  selectionBar: {
    display:'flex', alignItems:'center', gap:8,
    padding:'8px 16px', background:'var(--teal-light)',
    borderBottom:'1px solid var(--teal)',
    fontFamily:"'DM Sans',sans-serif",
  },
  selectionText: {
    flex:1, fontSize:12, color:'var(--teal)', overflow:'hidden',
    textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  selectionClear: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--teal)', fontSize:12, padding:'0 2px', flexShrink:0,
  },

  /* Content */
  content: {
    flex:1, padding:'1.5rem 1.5rem 8rem',
    maxWidth:720, margin:'0 auto', width:'100%',
  },
  loadingState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:8 },
  errorState:   { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:8, textAlign:'center' },
  chapterHeading: {
    fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:500,
    color:'var(--ink)', marginBottom:'1.5rem', letterSpacing:'-0.01em',
  },
  chapterDivider: {
    display:'flex', alignItems:'center', gap:12,
    margin:'2.5rem 0 1.5rem',
  },
  chapterDividerLine: {
    flex:1, height:1, background:'var(--border)',
  },
  chapterDividerLabel: {
    fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:500,
    color:'var(--ink-muted)', letterSpacing:'0.01em', flexShrink:0,
  },
  verseList: { display:'flex', flexDirection:'column', gap:0 },

  /* ── Verse outer wrapper ── */
  verseOuter: {
    display:'flex', flexDirection:'column',
    borderRadius:6, marginLeft:-8, paddingLeft:8,
    borderLeft:'3px solid transparent',
    transition:'background 0.15s, border-color 0.15s',
  },

  /* ── Inner flex row ── */
  verseRow: {
    display:'flex', gap:12, padding:'4px 0', lineHeight:1.8, alignItems:'flex-start',
    cursor:'pointer', userSelect:'none',
  },
  verseNum: {
    fontSize:10, fontWeight:700, color:'var(--teal)',
    minWidth:22, flexShrink:0,
    fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em',
    fontFamily:"'DM Sans',sans-serif",
    borderRadius:4, padding:'4px 2px',
    transition:'background 0.12s, color 0.12s',
    paddingTop:4, userSelect:'none',
  },
  verseBody: {
    flex:1, minWidth:0,
  },
  verseText: {
    color:'var(--ink)', lineHeight:1.85,
    fontFamily:"'Georgia', 'Times New Roman', serif",
  },

  /* ── Parallel original-language overlay ── */
  parallelBlock: {
    borderTop:'1px solid var(--border)',
    marginTop:3,
  },
  parallelLine: {
    display:'flex', alignItems:'flex-start', gap:8,
    padding:'4px 0 4px 28px',  // indent past verse number
  },
  parallelBadge: {
    flexShrink:0,
    fontSize:8, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
    borderRadius:3, padding:'2px 4px',
    fontFamily:"'DM Sans',sans-serif",
    marginTop:5,
  },

  /* ── Colour picker ── */
  colorPicker: {
    display:'flex', alignItems:'center', gap:6,
    padding:'6px 10px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', boxShadow:'0 2px 12px rgba(0,0,0,0.12)',
    width:'fit-content',
  },

  /* ── Note icon button ── */
  noteIconBtn: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:18, height:18, background:'none',
    border:'1px solid transparent', borderRadius:4,
    cursor:'pointer', color:'var(--ink-faint)',
    marginLeft:5, verticalAlign:'middle', flexShrink:0,
    transition:'all 0.12s',
  },
  noteIconBtnActive: {
    color:'rgba(150,110,0,0.9)',
    borderColor:'rgba(200,150,0,0.35)',
    background:'rgba(210,160,0,0.14)',
  },

  /* ── Floating selection action bar ── */
  floatingBar: {
    position:'fixed',
    bottom:'calc(64px + env(safe-area-inset-bottom, 0px))',
    left:'50%', transform:'translateX(-50%)',
    zIndex:300,
    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
    padding:'10px 16px',
    background:'var(--surface)',
    border:'1px solid var(--border)',
    borderRadius:20,
    boxShadow:'0 4px 24px rgba(0,0,0,0.18)',
    fontFamily:"'DM Sans',sans-serif",
    maxWidth:'calc(100vw - 32px)',
    minWidth:240,
  },
  floatingBarMain: {
    display:'flex', alignItems:'center', gap:8, width:'100%', justifyContent:'center',
  },
  floatingDeselect: {
    background:'none', border:'1px solid var(--border)', borderRadius:'50%',
    width:28, height:28, cursor:'pointer', color:'var(--ink-muted)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:0,
    flexShrink:0,
  },
  floatingCount: {
    fontSize:12, fontWeight:700, color:'var(--teal)',
    background:'var(--teal-light)', borderRadius:99, padding:'3px 10px',
    whiteSpace:'nowrap', flexShrink:0,
  },
  floatingBtn: {
    background:'none', border:'1px solid var(--border)', borderRadius:8,
    width:36, height:36, cursor:'pointer', color:'var(--ink-muted)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:0,
    flexShrink:0, transition:'all 0.12s',
  },
  floatingColorRow: {
    display:'flex', alignItems:'center', gap:8,
    paddingTop:6, borderTop:'1px solid var(--border)',
    width:'100%', justifyContent:'center',
  },

  /* ── Saved note display bar ── */
  noteDisplay: {
    display:'flex', gap:6, alignItems:'flex-start',
    marginLeft:34, marginTop:1, marginBottom:4,
    padding:'5px 10px',
    background:'rgba(210,160,0,0.08)',
    borderLeft:'2px solid rgba(200,150,0,0.35)',
    borderRadius:'0 4px 4px 0',
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.6,
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.12s',
  },
  noteShareBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    padding:'2px 4px', borderRadius:4, flexShrink:0,
    transition:'color 0.12s',
  },

  /* ── Inline note editor ── */
  noteEditorWrap: {
    marginLeft:34, marginTop:4, marginBottom:6,
    display:'flex', flexDirection:'column', gap:6,
  },
  noteTextarea: {
    width:'100%', padding:'8px 10px',
    border:'1.5px solid var(--teal)', borderRadius:'var(--radius)',
    fontSize:13, color:'var(--ink)', lineHeight:1.6,
    fontFamily:"'DM Sans',sans-serif",
    background:'var(--surface)', resize:'vertical',
    outline:'none', boxSizing:'border-box',
  },
  noteEditorActions: { display:'flex', gap:6, alignItems:'center' },
  noteSaveBtn: {
    fontSize:11, fontWeight:700, padding:'5px 12px',
    background:'var(--teal)', color:'white',
    border:'none', borderRadius:'var(--radius)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  noteCancelBtn: {
    fontSize:11, fontWeight:500, padding:'5px 10px',
    background:'none', color:'var(--ink-muted)',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  noteDeleteBtn: {
    fontSize:11, fontWeight:500, padding:'5px 10px',
    background:'none', color:'#b33',
    border:'1px solid rgba(180,50,50,0.3)', borderRadius:'var(--radius)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    marginLeft:'auto',
  },

  /* ── Author cross-ref row ── */
  authorXrefRow: {
    display:'flex', flexWrap:'wrap', alignItems:'center',
    gap:4, paddingLeft:28, paddingTop:4, paddingBottom:2,
  },
  authorXrefIcon: {
    fontSize:10, color:'var(--teal)', opacity:0.7, flexShrink:0,
  },
  authorXrefChipWrap: {
    display:'inline-flex', alignItems:'center', gap:0,
  },
  authorXrefChip: {
    fontSize:10, fontWeight:600,
    background:'var(--teal-light)', color:'var(--teal)',
    border:'1px solid var(--teal)', borderRadius:'99px 0 0 99px',
    padding:'2px 7px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.5,
  },
  authorXrefDeleteBtn: {
    fontSize:11, fontWeight:700,
    background:'var(--teal-light)', color:'var(--teal)',
    border:'1px solid var(--teal)', borderLeft:'none',
    borderRadius:'0 99px 99px 0',
    padding:'2px 6px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.5,
  },
  authorXrefAddBtn: {
    fontSize:10, fontWeight:600, color:'var(--ink-faint)',
    background:'none', border:'1px dashed var(--border)',
    borderRadius:99, padding:'2px 8px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
  },
  authorXrefForm: {
    display:'flex', flexDirection:'column', gap:4,
    marginTop:4, width:'100%',
  },
  authorXrefFormRow: {
    display:'flex', gap:4, flexWrap:'wrap', alignItems:'center',
  },
  authorXrefInput: {
    fontSize:12, padding:'4px 8px',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    background:'var(--surface)', color:'var(--ink)',
    fontFamily:"'DM Sans',sans-serif",
    outline:'none', flex:1, minWidth:100,
  },

  /* ── Author study note block ── */
  authorNoteBlock: {
    paddingLeft:28, paddingTop:4, paddingBottom:4,
  },
  authorNoteDisplay: {
    background:'linear-gradient(135deg, rgba(var(--teal-rgb,45,127,120),0.06) 0%, rgba(var(--gold-rgb,180,140,60),0.06) 100%)',
    border:'1px solid rgba(var(--teal-rgb,45,127,120),0.15)',
    borderLeft:'3px solid var(--teal)',
    borderRadius:'0 6px 6px 0',
    padding:'8px 12px',
  },
  authorNoteHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    marginBottom:4,
  },
  authorNoteLabel: {
    fontSize:9, fontWeight:800, letterSpacing:'0.1em',
    color:'var(--teal)', textTransform:'uppercase',
    fontFamily:"'DM Sans',sans-serif",
  },
  authorEditBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', padding:2, display:'flex',
    alignItems:'center',
  },
  authorNoteText: {
    margin:0, fontSize:13, color:'var(--ink)', lineHeight:1.7,
    fontFamily:"'Georgia','Times New Roman',serif",
    fontStyle:'italic',
  },
  authorAddNoteBtn: {
    fontSize:10, fontWeight:600, color:'var(--ink-faint)',
    background:'none', border:'1px dashed var(--border)',
    borderRadius:99, padding:'2px 10px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Inline confession cross-reference chips */
  inlineCrossRefs: {
    display:'inline-flex', flexWrap:'wrap', gap:4,
    marginLeft:6, verticalAlign:'middle',
  },
  inlineChip: {
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'1px 6px 1px 3px', border:'1px solid',
    borderRadius:99, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
    fontSize:9, lineHeight:1.6,
    transition:'opacity 0.12s',
    verticalAlign:'middle',
  },
  inlineChipSrc: {
    fontSize:7, fontWeight:800, letterSpacing:'0.06em',
    color:'white', padding:'1px 4px', borderRadius:99,
    lineHeight:1.5,
  },
  inlineChipLabel: {
    fontSize:9, fontWeight:600, lineHeight:1.4,
  },

  /* ── Bible search results panel ── */
  srHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    marginBottom:14, gap:10, flexWrap:'wrap',
  },
  srTitle: {
    fontSize:15, fontWeight:700, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif",
  },
  srClose: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:12, fontWeight:600, color:'var(--ink-muted)',
    background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'5px 10px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    whiteSpace:'nowrap',
  },
  /* Load-more banner */
  srLoadMoreBar: {
    display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8,
    padding:'10px 16px',
    background:'var(--amber-soft)', borderBottom:'1px solid var(--border)',
    fontFamily:"'DM Sans',sans-serif",
  },
  srLoadMoreBtn: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:12, fontWeight:700, color:'var(--amber-ink)',
    background:'transparent', border:'1px solid var(--amber-ink)',
    borderRadius:'var(--radius)', padding:'5px 12px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
    transition:'background 0.15s',
  },
  /* Per-book collapsible group */
  srBookGroup: {
    border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)',
    overflow:'hidden',
    background:'var(--surface)',
  },
  srBookHeader: {
    display:'flex', alignItems:'center', gap:8,
    width:'100%', padding:'10px 14px',
    background:'var(--surface)', border:'none', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.12s',
  },
  srBookName: {
    flex:1, fontSize:14, fontWeight:700, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif",
  },
  srBookCount: {
    fontSize:10, fontWeight:700,
    background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'2px 9px',
    fontFamily:"'DM Sans',sans-serif", flexShrink:0,
  },
  srVerseList: {
    display:'flex', flexDirection:'column',
    borderTop:'1px solid var(--border)',
  },
  srRow: {
    display:'flex', flexDirection:'column', gap:3,
    padding:'10px 14px 10px 34px', background:'var(--parchment)',
    border:'none', borderBottom:'1px solid var(--border)',
    cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  srRef: {
    fontSize:11, fontWeight:700, color:'var(--teal)',
    letterSpacing:'0.02em',
  },
  srText: {
    fontSize:13, color:'var(--ink)', lineHeight:1.65,
    fontFamily:"'Georgia','Times New Roman',serif",
  },

  /* ── Greek NT reader ── */
  displayModeBar: {
    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
    padding:'6px 0 12px', fontFamily:"'DM Sans',sans-serif",
  },
  displayModeLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
    color:'var(--ink-faint)', marginRight:2,
  },
  displayModeBtn: {
    fontSize:11, fontWeight:600, padding:'3px 11px',
    border:'1px solid var(--border)', borderRadius:99,
    background:'none', color:'var(--ink-muted)', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s',
  },
  displayModeBtnActive: {
    background:'var(--teal)', color:'white', borderColor:'var(--teal)',
  },
  greekVerseRow: {
    display:'flex', gap:8, padding:'5px 0', alignItems:'flex-start', cursor:'pointer',
  },
  greekWordWrap: {
    flex:1, display:'flex', flexWrap:'wrap', gap:'3px 2px',
    lineHeight:2, alignItems:'baseline',
  },
  greekToken: {
    display:'inline-flex', alignItems:'baseline',
    padding:'2px 5px 2px 4px', borderRadius:5,
    cursor:'pointer', userSelect:'none',
    transition:'background 0.1s, color 0.1s, outline 0.1s',
    fontFamily:"'Palatino Linotype','Palatino','Book Antiqua','Times New Roman',serif",
    fontSize:'1em', color:'var(--ink)',
  },
  greekTokenGk: {
    fontSize:'1.1em', letterSpacing:'0.01em',
  },
  greekTokenSel: {
    background:'var(--teal-light)', color:'var(--teal)',
    outline:'1.5px solid var(--teal)', outlineOffset:0,
  },

  /* ── Word info strip ── */
  wordInfoStrip: {
    marginLeft:34, marginTop:2, marginBottom:8,
    padding:'10px 14px',
    background:'rgba(29,107,90,0.05)',
    border:'1px solid rgba(29,107,90,0.16)',
    borderRadius:'var(--radius)',
    fontFamily:"'DM Sans',sans-serif",
    display:'flex', flexDirection:'column', gap:8,
  },

  /* ① Script word row */
  wiScriptRow: {
    display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap',
  },
  wordInfoGreek: {          // reused for both Greek and Hebrew sizing anchor
    fontSize:20, fontWeight:500,
    fontFamily:"'Palatino Linotype','Palatino','Book Antiqua','Times New Roman',serif",
    color:'var(--ink)',
  },

  /* ② Gloss */
  wiGloss: {
    fontSize:14, fontWeight:600, color:'var(--ink)',
    fontStyle:'italic', lineHeight:1.3,
  },

  /* ③ Transliteration (within script row) */
  wiTranslit: {
    fontSize:13, color:'var(--ink-muted)', fontStyle:'italic', letterSpacing:'0.01em',
  },

  /* ③ Strong's row */
  wiStrongsRow: {
    display:'flex', alignItems:'center', gap:7, flexWrap:'wrap',
  },
  wiStrongsLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
    color:'var(--ink-faint)',
  },
  wiStrongsLink: {
    display:'inline-flex', alignItems:'center',
    fontSize:12, fontWeight:700, letterSpacing:'0.04em',
    color:'var(--teal)', background:'var(--teal-light)',
    borderRadius:99, padding:'2px 9px',
    textDecoration:'none',
  },
  wiStrongsBtn: {
    display:'inline-flex', alignItems:'center',
    fontSize:12, fontWeight:700, letterSpacing:'0.04em',
    color:'var(--teal)', background:'var(--teal-light)',
    borderRadius:99, padding:'2px 9px',
    border:'none', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
    transition:'opacity 0.12s',
  },
  wiStrongsNum: {
    fontSize:12, fontWeight:700, letterSpacing:'0.04em',
    color:'var(--teal)', background:'var(--teal-light)',
    borderRadius:99, padding:'2px 9px',
  },
  wiStrongsHint: {
    fontSize:10, color:'var(--ink-faint)', fontStyle:'italic',
  },

  /* ④ Morphology breakdown table */
  wiMorphBlock: {
    display:'flex', flexDirection:'column', gap:3,
    paddingTop:6,
    borderTop:'1px solid rgba(29,107,90,0.12)',
  },
  wiMorphRow: {
    display:'flex', alignItems:'baseline', gap:8,
  },
  wiMorphLabel: {
    fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
    color:'var(--ink-faint)', width:90, flexShrink:0,
  },
  wiMorphValue: {
    fontSize:13, color:'var(--ink)', fontWeight:500,
  },

  /* ⑤ Manuscript note */
  wiMsNote: {
    fontSize:11, lineHeight:1.5,
    borderLeft:'2px solid', paddingLeft:8,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* ── KJV word-tap search modal ── */
  wordSearchBackdrop: {
    position:'fixed', inset:0, zIndex:500,
    background:'rgba(0,0,0,0.35)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:24,
  },
  wordSearchCard: {
    background:'var(--surface)',
    borderRadius:'var(--radius-lg)',
    boxShadow:'0 12px 40px rgba(0,0,0,0.2)',
    padding:'20px 24px',
    minWidth:220, maxWidth:340, width:'100%',
    fontFamily:"'DM Sans',sans-serif",
    display:'flex', flexDirection:'column', gap:14,
  },
  wordSearchWord: {
    fontSize:20, fontWeight:700, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif",
    textAlign:'center', letterSpacing:'0.01em',
  },
  wordSearchActions: {
    display:'flex', flexDirection:'column', gap:8,
  },
  wordSearchBtn: {
    width:'100%', padding:'10px 0',
    background:'var(--teal)', color:'white',
    border:'none', borderRadius:'var(--radius)',
    fontSize:14, fontWeight:700, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
    transition:'opacity 0.12s',
  },
  wordSearchCancel: {
    width:'100%', padding:'8px 0',
    background:'none', color:'var(--ink-muted)',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    fontSize:13, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
  },

  /* ── Lexicon back pill ── */
  lexBackPill: {
    position:'fixed', bottom:76, left:'50%', transform:'translateX(-50%)',
    zIndex:400,
    display:'flex', alignItems:'center', gap:0,
    background:'var(--ink)', borderRadius:99,
    boxShadow:'0 4px 16px rgba(0,0,0,0.25)',
    overflow:'hidden',
    fontFamily:"'DM Sans',sans-serif",
  },
  lexBackBtn: {
    display:'flex', alignItems:'center', gap:6,
    padding:'9px 14px 9px 12px',
    background:'none', border:'none', cursor:'pointer',
    color:'white', fontSize:13, fontWeight:600,
    whiteSpace:'nowrap',
  },
  lexBackDismiss: {
    padding:'9px 12px 9px 4px',
    background:'none', border:'none', cursor:'pointer',
    color:'rgba(255,255,255,0.55)', fontSize:16, lineHeight:1,
    transition:'color 0.1s',
  },

  /* ── Hebrew-specific overrides ── */
  hebrewTokenOrig: {
    fontSize:'1.25em',
    fontFamily:"'SBL Hebrew','David','Arial Hebrew','Times New Roman',serif",
    letterSpacing:'0.02em',
    direction:'rtl',
  },
  hebrewInfoWord: {
    fontSize:24, fontWeight:400,
    fontFamily:"'SBL Hebrew','David','Arial Hebrew','Times New Roman',serif",
    color:'var(--ink)', direction:'rtl',
    letterSpacing:'0.02em',
  },

  /* ── Shared modal backdrop ── */
  modalBackdrop: {
    position:'fixed', inset:0, zIndex:500,
    background:'rgba(0,0,0,0.45)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:20,
  },

  /* ── Author cross-ref verse preview modal ── */
  authorRefModalBox: {
    background:'var(--surface)',
    borderRadius:'var(--radius-lg)',
    boxShadow:'0 16px 48px rgba(0,0,0,0.22)',
    width:'100%', maxWidth:420,
    display:'flex', flexDirection:'column',
    overflow:'hidden',
    fontFamily:"'DM Sans',sans-serif",
  },
  authorRefModalHeader: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
    padding:'16px 18px 12px',
    borderBottom:'1px solid var(--border)',
    gap:10,
  },
  authorRefModalRef: {
    fontSize:17, fontWeight:700,
    fontFamily:"'Cormorant Garamond',serif",
    color:'var(--ink)', lineHeight:1.25,
  },
  authorRefModalLabel: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', borderRadius:99,
    padding:'2px 9px', display:'inline-block',
    letterSpacing:'0.02em',
  },
  confCloseBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, lineHeight:1,
    padding:'2px 4px', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },
  authorRefModalBody: {
    padding:'16px 18px',
    minHeight:60,
  },
  authorRefModalVerseText: {
    margin:0, fontSize:15, lineHeight:1.8, color:'var(--ink)',
    fontFamily:"'Georgia','Times New Roman',serif",
  },
  authorRefModalVerseNum: {
    fontWeight:700, color:'var(--teal)',
    marginRight:7, fontSize:12,
    fontFamily:"'DM Sans',sans-serif",
    verticalAlign:'super',
  },
  authorRefModalFooter: {
    padding:'12px 18px 16px',
    borderTop:'1px solid var(--border)',
    display:'flex', justifyContent:'flex-end',
  },
  authorRefModalGoBtn: {
    display:'inline-flex', alignItems:'center',
    padding:'9px 18px',
    background:'var(--teal)', color:'white',
    border:'none', borderRadius:'var(--radius)',
    fontSize:13, fontWeight:700, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
    transition:'opacity 0.15s',
    letterSpacing:'0.01em',
  },
}
