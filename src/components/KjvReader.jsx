import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle } from 'react'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { getCrossRefs } from '../lib/crossRef'
import { loadBibleVersion, getVersionMetadata, BIBLE_VERSIONS } from '../lib/bibleVersions'
import { loadGreek, getGreekChapter, parseGrammar, getMsMarker, NT_BOOKS } from '../lib/greek'
import ShareCardModal from './ShareCardModal'
import ConfessionModal from './ConfessionModal'
import { usePrefs, useAuth } from '../App'
import { getFontCss } from './FontPrefsPanel'
import {
  HIGHLIGHT_COLORS, getHlStyle,
  loadHighlights, loadItemNotes,
  setHighlight, setItemNote,
  addSearchHistory, getSearchHistory, clearSearchHistory, removeSearchEntry,
} from '../lib/annotations'

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

/** Search a specific Bible version — returns up to maxResults matches in canonical order */
function searchBibleVersion(versionData, query, version = 'kjv', maxResults = 200) {
  if (!versionData || !query.trim()) return []
  const q = query.trim().toLowerCase()
  const hits = []
  for (const book of BIBLE_BOOKS) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const bookData = versionData[slug]
    if (!bookData) continue
    const chapterNums = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chapterNums) {
      const verses = bookData[ch]
      if (!verses) continue
      for (const v of verses) {
        if (v.t && v.t.toLowerCase().includes(q)) {
          hits.push({ book: book.name, chapter: ch, verse: v.v, text: stripFootnotes(v.t, ch, version) })
          if (hits.length >= maxResults) return hits
        }
      }
    }
  }
  return hits
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

/** Stable DOM id for a given verse (book/chapter/verse) */
function verseId(bookName, ch, verse) {
  return `v-${bookName.replace(/\s+/g, '')}-${ch}-${verse}`
}

/* ── Source chip colours for cross-references ── */
const SRC_CHIP = {
  '2LBCF':    { bg:'rgba(61,43,107,0.10)', color:'#3d2b6b', border:'rgba(61,43,107,0.2)' },
  'Catechism':{ bg:'rgba(29,107,90,0.10)', color:'#1d6b5a', border:'rgba(29,107,90,0.2)' },
  '1LBCF':    { bg:'rgba(124,82,48,0.10)', color:'#7c5230', border:'rgba(124,82,48,0.2)' },
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
function BibleResultsPanel({ bibleResults, searchQuery, onNavigate, onClose, readerRef }) {
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
              : `${bibleResults.length}${bibleResults.length === 200 ? '+' : ''} verse${bibleResults.length !== 1 ? 's' : ''} found`
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

          {bibleResults.length === 200 && (
            <p style={{ fontSize:11, color:'var(--ink-faint)', textAlign:'center', padding:'8px 0' }}>
              Showing first 200 results — try a more specific phrase.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Sidebar ── */
function BookSidebar({ selectedBook, selectedChapter, onNavigate, onClose, isMobile, ntOnly }) {
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
      {renderTestament('New Testament', NT_CATS, 'var(--purple-soft)', 'var(--purple-ink)', 'NT')}
    </div>
  )
}

/* ── Main Bible Reader (KJV, ABAB, etc.) ── */
const KjvReader = React.forwardRef(function KjvReader({ version = 'kjv', onVersionChange, todayChapter, onNavChange, onSearchChange }, ref) {
  const { prefs } = usePrefs()

  const [book, setBook] = useState(() => {
    try { return sessionStorage.getItem(`bible-book-${version}`) || 'Genesis' } catch { return 'Genesis' }
  })
  const [chapter, setChapter] = useState(() => {
    try { return parseInt(sessionStorage.getItem(`bible-chapter-${version}`) || '1') } catch { return 1 }
  })

  /* segments = [{book, chapter, verses[]}] — first entry is navigated chapter, rest are auto-loaded */
  const [segments,      setSegments]      = useState([])
  const [versionData,   setVersionData]   = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [dataReady,     setDataReady]     = useState(false)
  const [error,         setError]         = useState(null)
  const [sideOpen,      setSideOpen]      = useState(false)
  const sentinelRef     = useRef(null)

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
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchFocus,  setSearchFocus]  = useState(0)   // index within chapter matches (when results=null)
  const [bibleResults, setBibleResults] = useState(null) // null = no search; [] = no matches; [{book,ch,verse,text}] = matches
  const [searching,    setSearching]    = useState(false)
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

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  /* Pending verse scroll after navigateTo() call from outside */
  const pendingVerseRef = useRef(null)

  /* ── Greek NT state ── */
  const [greekLoading,  setGreekLoading]  = useState(false)
  const [greekError,    setGreekError]    = useState(null)
  const [greekReady,    setGreekReady]    = useState(false)
  const [greekSegments, setGreekSegments] = useState([])   // [{book, chapter, verses:[{verse,words}]}]
  const [selectedWord,  setSelectedWord]  = useState(null) // {verseKey, wordIdx}
  const [displayMode,   setDisplayMode]   = useState('greek') // 'greek'|'translit'|'gloss'

  useImperativeHandle(ref, () => ({
    openSidebar:    () => setSideOpen(true),
    setSearchQuery: (q) => { setSearchQuery(q); setSearchFocus(0); setBibleResults(null) },
    submitSearch:   (q) => submitSearch(q),
    clearSearch:    () => closeSearch(),
    navigateTo:     (newBook, newChapter, verse) => {
      navigate(newBook, newChapter)
      if (verse) pendingVerseRef.current = { book: newBook, chapter: newChapter, verse }
    },
  }))

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  /* Notify parent of book/chapter changes */
  useEffect(() => { onNavChange?.(book, chapter) }, [book, chapter]) // eslint-disable-line
  /* Notify parent of search query changes */
  useEffect(() => { onSearchChange?.(searchQuery) }, [searchQuery]) // eslint-disable-line

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
      sessionStorage.setItem(`bible-book-${version}`, book)
      sessionStorage.setItem(`bible-chapter-${version}`, String(chapter))
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
    const firstVerses = segments[0]?.verses || []
    if (!q || bibleResults !== null || !firstVerses.length) return []
    return firstVerses
      .map((v, idx) => ({ idx, verse: v.verse, match: v.text.toLowerCase().includes(q) }))
      .filter(v => v.match)
  }, [searchQuery, segments, bibleResults])

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

  /* Load Bible version or Greek NT whenever the version prop changes */
  useEffect(() => {
    let cancelled = false

    if (version === 'greek') {
      // ── Greek mode ──
      setLoading(false)
      setError(null)
      setDataReady(false)
      setVersionData(null)
      setSegments([])
      setGreekLoading(true)
      setGreekError(null)
      setGreekReady(false)
      setGreekSegments([])
      setSelectedWord(null)

      loadGreek()
        .then(() => {
          if (cancelled) return
          setGreekReady(true)
          setGreekLoading(false)
          // If currently on an OT book, jump to Matthew
          if (!NT_BOOKS.has(book)) {
            setBook('Matthew')
            setChapter(1)
          }
        })
        .catch(e => {
          if (!cancelled) { setGreekError(e.message); setGreekLoading(false) }
        })
    } else {
      // ── Text version (KJV, ABAB, …) ──
      setVersionData(null)
      setDataReady(false)
      setLoading(true)
      setError(null)
      setGreekReady(false)
      setGreekLoading(false)
      setGreekSegments([])
      setSelectedWord(null)

      loadBibleData(version)
        .then(data => {
          if (cancelled) return
          setVersionData(data)
          setDataReady(true)
          setLoading(false)
        })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }

    return () => { cancelled = true }
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Chapter navigation — reset to single segment, scroll to top */
  useEffect(() => {
    if (!dataReady) return
    const v = getChapterVerses(versionData, book, chapter, version)
    if (v) { setSegments([{ book, chapter, verses: v }]); setError(null) }
    else    { setError('Chapter not found') }
    if (readerRef.current) readerRef.current.scrollTop = 0
  }, [book, chapter, dataReady, versionData, version])

  /* Append next chapter when sentinel becomes visible */
  useEffect(() => {
    if (!dataReady || !sentinelRef.current) return
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
      { rootMargin: '300px' }
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [dataReady, segments, versionData, version])

  /* Load a Greek chapter whenever book / chapter changes while in Greek mode */
  useEffect(() => {
    if (version !== 'greek' || !greekReady) return
    const chData = getGreekChapter(book, chapter)
    if (chData) {
      setGreekSegments([{ book, chapter, verses: chData }])
      setGreekError(null)
    } else {
      setGreekError('Chapter not found in Greek NT')
    }
    if (readerRef.current) readerRef.current.scrollTop = 0
    setSelectedWord(null)
  }, [book, chapter, version, greekReady]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Greek infinite-scroll — append next NT chapter when sentinel becomes visible */
  useEffect(() => {
    if (version !== 'greek' || !greekReady || !sentinelRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setGreekSegments(prev => {
          if (!prev.length) return prev
          const last = prev[prev.length - 1]
          const next = getNextChapter(last.book, last.chapter)
          if (!next || !NT_BOOKS.has(next.book)) return prev
          if (prev.some(s => s.book === next.book && s.chapter === next.chapter)) return prev
          const chData = getGreekChapter(next.book, next.chapter)
          if (!chData) return prev
          return [...prev, { book: next.book, chapter: next.chapter, verses: chData }]
        })
      },
      { rootMargin: '300px' }
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [version, greekReady, greekSegments]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const lines = []
    const isGreek = version === 'greek'
    const pool = isGreek ? greekSegments : segments
    const versionLabel = isGreek ? 'GNT (TAGNT)' : (BIBLE_VERSIONS.find(v2 => v2.id === version)?.abbreviation || 'KJV')
    selectedVerses.forEach(vk => {
      const [, b, ch, v] = vk.split('|')
      for (const seg of pool) {
        if (seg.book === b && String(seg.chapter) === ch) {
          if (isGreek) {
            const vObj = seg.verses.find(ve => String(ve.verse) === v)
            if (vObj) {
              // Build text: Greek words separated by spaces
              const gkText = vObj.words.map(w => w.w).join(' ')
              lines.push(`${b} ${ch}:${v} — ${gkText}`)
            }
          } else {
            const vObj = seg.verses.find(ve => String(ve.verse) === v)
            if (vObj) lines.push(`${b} ${ch}:${v} — ${vObj.text}`)
          }
        }
      }
    })
    return { lines, versionLabel }
  }

  function shareSelection() {
    const { lines, versionLabel } = buildSelectionLines()
    const versMeta = BIBLE_VERSIONS.find(v2 => v2.id === version)
    setShareCard({
      type:'reading',
      title:`${book} ${chapter}`,
      subtitle: versMeta?.label || 'King James Version',
      source: versMeta?.abbreviation || 'KJV',
      text: lines.join('\n\n'),
      label: '',
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
      title: `${book} ${chapter}`,
      subtitle: 'King James Version',
      source: 'KJV',
      text: selection,
      label: '',
    })
  }

  function handleShareChapter() {
    const firstSeg = segments[0]
    if (!firstSeg) return
    const chText = firstSeg.verses.map(v => `${v.verse} ${v.text}`).join('\n')
    setShareCard({
      type: 'reading',
      title: `${firstSeg.book} ${firstSeg.chapter}`,
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
        const hits = searchBibleVersion(versionData, trimmed, version)
        setBibleResults(hits)
        setSearching(false)
      }, 0)
    }
  }

  function closeSearch() {
    setSearchQuery('')
    setBibleResults(null)
    setSearchFocus(0)
  }

  function navigate(newBook, newChapter) {
    setBook(newBook)
    setChapter(newChapter)
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
            {BIBLE_VERSIONS.map(v2 => {
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

        <BookSidebar
          selectedBook={book}
          selectedChapter={chapter}
          onNavigate={(b, ch) => {
            if (version === 'greek' && !NT_BOOKS.has(b)) {
              navigate('Matthew', 1)
            } else {
              navigate(b, ch)
            }
          }}
          onClose={() => setSideOpen(false)}
          isMobile={isMobile}
          ntOnly={version === 'greek'}
        />
      </aside>

      {/* Reader panel */}
      <div style={r.readerWrap} ref={readerRef}>

        <div style={r.content}>
          {/* ── Search status bar (text versions only) ── */}
          {version !== 'greek' && searchQuery.trim() && (
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
              GREEK NT MODE
              ══════════════════════════════════════════════ */}
          {version === 'greek' && (
            <>
              {greekLoading && (
                <div style={r.loadingState}>
                  <div className="spinner" />
                  <p style={{ color:'var(--ink-muted)', fontSize:14, marginTop:12 }}>Loading Greek New Testament…</p>
                </div>
              )}
              {greekError && !greekLoading && (
                <div style={r.errorState}>
                  <p style={{ color:'var(--ink-muted)', fontSize:14 }}>{greekError}</p>
                  <p style={{ color:'var(--ink-faint)', fontSize:12, marginTop:8 }}>Run: <code>npm run process:greek</code></p>
                </div>
              )}
              {greekReady && !greekLoading && (
                <>
                  {/* Display-mode toggle bar */}
                  <div style={r.displayModeBar}>
                    <span style={r.displayModeLabel}>Display</span>
                    {[
                      { id:'greek',   label:'Greek' },
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
                      TAGNT · STEPBible CC BY 4.0
                    </span>
                  </div>

                  {/* Greek chapter segments */}
                  <div ref={verseListRef}>
                    {greekSegments.map((seg, segIdx) => (
                      <div key={`${seg.book}|${seg.chapter}`}>
                        {segIdx === 0
                          ? <h2 style={r.chapterHeading}>{seg.book} {seg.chapter}</h2>
                          : <div style={r.chapterDivider}>
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
                                  <div style={r.greekWordWrap}>
                                    {words.map((wd, wi) => {
                                      const msMarker = getMsMarker(wd.ms)
                                      const isSel    = isWordVerse && selectedWord?.wordIdx === wi
                                      const lbl      = displayMode === 'greek'   ? wd.w
                                                     : displayMode === 'translit' ? wd.t
                                                     : wd.g
                                      return (
                                        <span
                                          key={wi}
                                          style={{
                                            ...r.greekToken,
                                            ...(displayMode === 'greek' ? r.greekTokenGk : {}),
                                            ...(isSel ? r.greekTokenSel : {}),
                                          }}
                                          onClick={e => { e.stopPropagation(); handleWordTap(verseKey, wi) }}
                                          title={`${wd.w}  ${wd.t}  "${wd.g}"  ${wd.s}`}
                                        >
                                          {lbl}
                                          {msMarker && (
                                            <sup style={{
                                              fontSize:'0.58em', marginLeft:1, fontFamily:"'DM Sans',sans-serif",
                                              color: msMarker === 'TR' ? '#7c5230' : '#3e5a8c',
                                            }}>
                                              {msMarker}
                                            </sup>
                                          )}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* ── Word info strip (appears when a word in this verse is selected) ── */}
                                {isWordVerse && selectedWord && (() => {
                                  const wd = words[selectedWord.wordIdx]
                                  if (!wd) return null
                                  const msMarker = getMsMarker(wd.ms)
                                  return (
                                    <div style={r.wordInfoStrip} onClick={e => e.stopPropagation()}>
                                      <div style={r.wordInfoRow}>
                                        <span style={r.wordInfoGreek}>{wd.w}</span>
                                        <span style={r.wordInfoTranslit}>{wd.t}</span>
                                        <span style={r.wordInfoStrong}>{wd.s}</span>
                                      </div>
                                      <div style={r.wordInfoGloss}>"{wd.g}"</div>
                                      {wd.r && <div style={r.wordInfoGrammar}>{parseGrammar(wd.r)}</div>}
                                      {msMarker && (
                                        <div style={{ ...r.wordInfoMs, color: msMarker === 'TR' ? '#7c5230' : '#3e5a8c' }}>
                                          {msMarker === 'TR'
                                            ? '† TR only — Textus Receptus / KJV tradition'
                                            : '† NA only — modern critical text'}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* ── Note display ── */}
                                {note && !isEditing && (
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

                    {/* Sentinel for Greek infinite scroll */}
                    {!greekLoading && <div ref={sentinelRef} style={{ height:40 }} />}
                  </div>
                </>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════
              TEXT VERSION MODE (KJV, ABAB, …)
              ══════════════════════════════════════════════ */}
          {version !== 'greek' && (
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
              {/* ── Bible-wide search results ── */}
              {bibleResults !== null && (
                <BibleResultsPanel
                  bibleResults={bibleResults}
                  searchQuery={searchQuery}
                  onNavigate={navigate}
                  onClose={() => { setBibleResults(null); setSearchQuery('') }}
                  readerRef={readerRef}
                />
              )}

              {/* ── Continuous chapter segments ── */}
              <div ref={verseListRef}>
                {!loading && !error && segments.length > 0 && bibleResults === null && segments.map((seg, segIdx) => (
                  <div key={`${seg.book}|${seg.chapter}`}>
                    {segIdx === 0
                      ? <h2 style={r.chapterHeading}>{seg.book} {seg.chapter}</h2>
                      : <div style={r.chapterDivider}>
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
                        const isSearchMatch = segIdx === 0 && !bibleResults && searchQuery.trim() && text.toLowerCase().includes(searchQuery.trim().toLowerCase())
                        const isFocusMatch  = segIdx === 0 && !bibleResults && chapterMatches[searchFocus]?.verse === verse

                        return (
                          <div
                            key={verse}
                            id={verseId(seg.book, seg.chapter, verse)}
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
                                <span style={{ ...r.verseText, fontSize: prefs.sizePx, fontFamily: getFontCss(prefs.fontId) }}>{highlightSearchInText(text)}</span>

                                {verseRefs.length > 0 && (
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

                            {note && !isEditing && (
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
        />
      )}
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
}

/* ── Reader styles ── */
const r = {
  wrap: {
    display:'flex',
    flexDirection:'column',
    height:'100%',
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

  /* Word info strip */
  wordInfoStrip: {
    marginLeft:34, marginTop:2, marginBottom:8,
    padding:'9px 12px',
    background:'rgba(29,107,90,0.06)',
    border:'1px solid rgba(29,107,90,0.18)',
    borderRadius:'var(--radius)',
    fontFamily:"'DM Sans',sans-serif",
    display:'flex', flexDirection:'column', gap:5,
  },
  wordInfoRow: {
    display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap',
  },
  wordInfoGreek: {
    fontSize:20, fontWeight:500,
    fontFamily:"'Palatino Linotype','Palatino','Book Antiqua','Times New Roman',serif",
    color:'var(--ink)',
  },
  wordInfoTranslit: {
    fontSize:13, color:'var(--ink-muted)', fontStyle:'italic',
  },
  wordInfoStrong: {
    fontSize:10, fontWeight:700, letterSpacing:'0.05em',
    color:'var(--teal)', background:'var(--teal-light)',
    borderRadius:99, padding:'1px 8px',
    fontFamily:"'DM Sans',sans-serif",
  },
  wordInfoGloss: {
    fontSize:13, fontWeight:600, color:'var(--ink)',
    fontStyle:'italic',
  },
  wordInfoGrammar: {
    fontSize:11, color:'var(--ink-muted)',
    fontFamily:"'DM Sans',sans-serif",
  },
  wordInfoMs: {
    fontSize:10, fontWeight:600,
    fontFamily:"'DM Sans',sans-serif",
  },
}
