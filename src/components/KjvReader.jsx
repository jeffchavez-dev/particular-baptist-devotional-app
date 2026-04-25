import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { getCrossRefs } from '../lib/crossRef'
import ShareCardModal from './ShareCardModal'
import ConfessionModal from './ConfessionModal'
import {
  HIGHLIGHT_COLORS, getHlStyle,
  loadHighlights, loadItemNotes,
  setHighlight, setItemNote,
  addSearchHistory, getSearchHistory, clearSearchHistory, removeSearchEntry,
} from '../lib/annotations'

/* ── Module-level KJV data singleton — loaded once, all chapters in memory ── */
let _kjvData = null
let _kjvPromise = null

function bookSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

async function loadKjv() {
  if (_kjvData) return _kjvData
  if (!_kjvPromise) {
    _kjvPromise = fetch('/kjv.json')
      .then(r => { if (!r.ok) throw new Error('KJV data unavailable'); return r.json() })
      .then(d => { _kjvData = d; return d })
      .catch(e => { _kjvPromise = null; throw e })
  }
  return _kjvPromise
}

function stripFootnotes(text, chapter) {
  return text.replace(new RegExp(`\\.${chapter}\\.\\d+[\\s\\S]*$`), '.').trim()
}

function getChapterVerses(bookName, ch) {
  if (!_kjvData) return null
  const slug = bookSlug(bookName)
  const raw = _kjvData[slug]?.[ch]
  if (!raw) return null
  const seen = new Set()
  return raw
    .filter(v => {
      if (seen.has(v.v)) return false
      seen.add(v.v)
      return true
    })
    .map(v => ({ verse: v.v, text: stripFootnotes(v.t, ch) }))
}

export async function fetchKjvChapter(bookName, ch) {
  await loadKjv()
  const verses = getChapterVerses(bookName, ch)
  if (!verses) throw new Error(`${bookName} ${ch} not found in KJV data`)
  return verses
}

/* ── Slug → canonical book name map (built once) ── */
const SLUG_TO_BOOK = Object.fromEntries(
  BIBLE_BOOKS.map(b => [b.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''), b.name])
)

/** Search the full KJV — returns up to maxResults matches in canonical order */
function searchBible(query, maxResults = 200) {
  if (!_kjvData || !query.trim()) return []
  const q = query.trim().toLowerCase()
  const hits = []
  for (const book of BIBLE_BOOKS) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const bookData = _kjvData[slug]
    if (!bookData) continue
    const chapterNums = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chapterNums) {
      const verses = bookData[ch]
      if (!verses) continue
      for (const v of verses) {
        if (v.t && v.t.toLowerCase().includes(q)) {
          hits.push({ book: book.name, chapter: ch, verse: v.v, text: stripFootnotes(v.t, ch) })
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

/* ── Sidebar ── */
function BookSidebar({ selectedBook, selectedChapter, onNavigate, onClose, isMobile }) {
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
      {renderTestament('Old Testament', OT_CATS, 'var(--amber-soft)', 'var(--amber-ink)', 'OT')}
      {renderTestament('New Testament', NT_CATS, 'var(--purple-soft)', 'var(--purple-ink)', 'NT')}
    </div>
  )
}

/* ── Main KJV Reader ── */
export default function KjvReader({ todayChapter, initialBook, initialChapter }) {
  const [book, setBook] = useState(() => {
    if (initialBook) return initialBook
    try { return sessionStorage.getItem('kjv-book') || 'Genesis' } catch { return 'Genesis' }
  })
  const [chapter, setChapter] = useState(() => {
    if (initialChapter) return initialChapter
    try { return parseInt(sessionStorage.getItem('kjv-chapter') || '1') } catch { return 1 }
  })

  const [verses,    setVerses]    = useState(() => getChapterVerses(book, chapter) || [])
  const [loading,   setLoading]   = useState(!_kjvData)
  const [dataReady, setDataReady] = useState(!!_kjvData)
  const [error,     setError]     = useState(null)
  const [sideOpen,  setSideOpen]  = useState(false)
  const [fontSize,  setFontSize]  = useState(() => {
    try { return parseInt(localStorage.getItem('kjv-fontsize') || '17') } catch { return 17 }
  })

  /* Share + confession modals */
  const [shareCard,       setShareCard]       = useState(null)
  const [confessionModal, setConfessionModal] = useState(null)

  /* Annotations */
  const [highlights,  setHighlightsState] = useState(() => loadHighlights())
  const [itemNotes,   setItemNotesState]  = useState(() => loadItemNotes())
  const [editingNote, setEditingNote]     = useState(null)
  const [noteDraft,   setNoteDraft]       = useState('')
  const [colorPicker, setColorPicker]     = useState(null) // verseKey

  /* Search — full-Bible mode */
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchFocus,  setSearchFocus]  = useState(0)   // index within chapter matches (when results=null)
  const [bibleResults, setBibleResults] = useState(null) // null = no search; [] = no matches; [{book,ch,verse,text}] = matches
  const [searching,    setSearching]    = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory('kjv'))
  const [showHistDrop,  setShowHistDrop]  = useState(false)
  const searchInputRef = useRef(null)

  /* Text selection */
  const [selection, setSelection] = useState('')
  const verseListRef = useRef(null)
  const readerRef    = useRef(null)

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  /* Persist position */
  useEffect(() => {
    try {
      sessionStorage.setItem('kjv-book', book)
      sessionStorage.setItem('kjv-chapter', String(chapter))
    } catch {}
  }, [book, chapter])

  /* Clear state when chapter changes */
  useEffect(() => {
    setSelection('')
    setEditingNote(null)
    setColorPicker(null)
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

  /* Focus search input when opened */
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60)
    }
  }, [searchOpen])

  /* Chapter-level matches (used for in-chapter highlighting only when no Bible results) */
  const chapterMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || bibleResults !== null || !verses.length) return []
    return verses
      .map((v, idx) => ({ idx, verse: v.verse, match: v.text.toLowerCase().includes(q) }))
      .filter(v => v.match)
  }, [searchQuery, verses, bibleResults])

  /* Scroll to focused match within current chapter */
  useEffect(() => {
    if (!chapterMatches.length) return
    const safeIdx = Math.min(searchFocus, chapterMatches.length - 1)
    const verseNum = chapterMatches[safeIdx]?.verse
    if (!verseNum || !readerRef.current) return
    const el = readerRef.current.querySelector(`#v${verseNum}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [searchFocus, chapterMatches])

  const bookInfo = BOOK_META[book] || { chapters: 1 }
  const totalChs = bookInfo.chapters

  /* First-mount: load KJV bundle */
  useEffect(() => {
    let cancelled = false
    if (!_kjvData) {
      setLoading(true)
      loadKjv()
        .then(() => {
          if (cancelled) return
          setDataReady(true)
          setLoading(false)
          const v = getChapterVerses(book, chapter)
          if (v) setVerses(v)
        })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Chapter change — instant from memory */
  useEffect(() => {
    if (!dataReady) return
    const v = getChapterVerses(book, chapter)
    if (v) { setVerses(v); setError(null) }
    if (readerRef.current) readerRef.current.scrollTop = 0
  }, [book, chapter, dataReady])

  /* ── Highlight handler ── */
  const handleHighlight = useCallback((verseKey, colorId) => {
    const next = setHighlight(verseKey, colorId)
    setHighlightsState({ ...next })
  }, [])

  /* ── Note handlers ── */
  function openNoteEditor(verseKey) {
    if (editingNote === verseKey) { setEditingNote(null); return }
    setNoteDraft(itemNotes[verseKey] || '')
    setEditingNote(verseKey)
    setColorPicker(null)
  }

  function saveNote(verseKey) {
    const next = setItemNote(verseKey, noteDraft)
    setItemNotesState({ ...next })
    setEditingNote(null)
  }

  function deleteNote(verseKey) {
    const next = setItemNote(verseKey, '')
    setItemNotesState({ ...next })
    setEditingNote(null)
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
    const chText = verses.map(v => `${v.verse} ${v.text}`).join('\n')
    setShareCard({
      type: 'reading',
      title: `${book} ${chapter}`,
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
        const hits = searchBible(trimmed)
        setBibleResults(hits)
        setSearching(false)
      }, 0)
    }
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setBibleResults(null)
    setSearchFocus(0)
  }

  function navigate(newBook, newChapter) {
    setBook(newBook)
    setChapter(newChapter)
  }

  function changeFontSize(delta) {
    setFontSize(prev => {
      const next = Math.min(24, Math.max(13, prev + delta))
      try { localStorage.setItem('kjv-fontsize', String(next)) } catch {}
      return next
    })
  }

  const todayLink      = todayChapter
  const isTodayChapter = todayLink && todayLink === `${book} ${chapter}`
  const canPrev        = chapter > 1
  const canNext        = chapter < totalChs
  const bookIdx        = BIBLE_BOOKS.findIndex(b => b.name === book)
  const prevBook       = chapter === 1 && bookIdx > 0 ? BIBLE_BOOKS[bookIdx - 1] : null
  const nextBook       = chapter === totalChs && bookIdx < BIBLE_BOOKS.length - 1 ? BIBLE_BOOKS[bookIdx + 1] : null

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
        <BookSidebar
          selectedBook={book}
          selectedChapter={chapter}
          onNavigate={navigate}
          onClose={() => setSideOpen(false)}
          isMobile={isMobile}
        />
      </aside>

      {/* Reader panel */}
      <div style={r.readerWrap} ref={readerRef}>

        {/* Toolbar */}
        <div style={r.toolbar}>
          <button
            style={r.bookPill}
            onClick={() => isMobile && setSideOpen(true)}
            title={isMobile ? 'Select book' : undefined}
            disabled={!isMobile}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0, opacity:0.5 }}>
              <rect x="1" y="1" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4 4h5M4 6.5h5M4 9h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span style={r.bookPillName}>{book}</span>
            <span style={r.bookPillCh}>Ch. {chapter}</span>
            {isTodayChapter && <span style={r.todayBadge}>Today</span>}
            {isMobile && (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginLeft:'auto', flexShrink:0, opacity:0.4 }}>
                <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0, marginLeft:'auto' }}>
            {/* Search toggle */}
            <button
              style={{ ...r.toolBtn, ...(searchOpen ? { borderColor:'var(--teal)', color:'var(--teal)', background:'var(--teal-light)' } : {}) }}
              onClick={() => { if (searchOpen) { closeSearch() } else { setSearchOpen(true) } }}
              title="Search in chapter"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Share selection / chapter */}
            {selection ? (
              <button style={{ ...r.toolBtn, color:'var(--teal)', borderColor:'var(--teal)' }} onClick={handleShareSelection} title="Share selected text">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="9.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="9.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 5.4l4.2-2.8M4 6.6l4.2 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Share
              </button>
            ) : (
              <button style={r.toolBtn} onClick={handleShareChapter} title="Share this chapter">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="9.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="9.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 5.4l4.2-2.8M4 6.6l4.2 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Share
              </button>
            )}
            <button style={r.toolBtn} onClick={() => changeFontSize(-1)} title="Smaller text">A−</button>
            <button style={r.toolBtn} onClick={() => changeFontSize(+1)} title="Larger text">A+</button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div style={r.searchBar} onClick={e => e.stopPropagation()}>
            <div style={r.searchInputWrap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchInputRef}
                style={r.searchInput}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchFocus(0); setShowHistDrop(!!e.target.value === false && searchHistory.length > 0) }}
                onFocus={() => { if (!searchQuery && searchHistory.length) setShowHistDrop(true) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitSearch(searchQuery)
                  if (e.key === 'Escape') closeSearch()
                  if (e.key === 'ArrowDown' && !bibleResults) setSearchFocus(f => Math.min(f + 1, chapterMatches.length - 1))
                  if (e.key === 'ArrowUp'   && !bibleResults) setSearchFocus(f => Math.max(f - 1, 0))
                }}
                placeholder={`Search in ${book} ${chapter}…`}
              />
              {searchQuery && (
                <button style={r.searchClear} onClick={() => { setSearchQuery(''); setSearchFocus(0) }}>×</button>
              )}
            </div>

            {/* Match count / status */}
            {searchQuery.trim() && (
              <div style={r.searchResults}>
                {searching ? (
                  <span style={{fontSize:12, color:'var(--ink-faint)'}}>Searching…</span>
                ) : bibleResults !== null ? (
                  bibleResults.length === 0 ? (
                    <span style={{fontSize:12, color:'var(--ink-faint)'}}>No matches in Bible</span>
                  ) : (
                    <span style={{fontSize:12, color:'var(--teal)', fontWeight:600}}>
                      {bibleResults.length}{bibleResults.length === 200 ? '+' : ''} verse{bibleResults.length !== 1 ? 's' : ''} found
                    </span>
                  )
                ) : chapterMatches.length === 0 ? (
                  <span style={{fontSize:12, color:'var(--ink-faint)'}}>
                    Not in this chapter —{' '}
                    <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--teal)',fontSize:12,fontWeight:600,padding:0,fontFamily:"'DM Sans',sans-serif"}}
                      onClick={() => submitSearch(searchQuery)}>
                      Search Bible ↵
                    </button>
                  </span>
                ) : (
                  <>
                    <span style={{fontSize:12, color:'var(--teal)', fontWeight:600}}>
                      {searchFocus + 1} / {chapterMatches.length} in chapter
                    </span>
                    <button style={r.searchNavBtn} onClick={() => setSearchFocus(f => Math.max(0, f - 1))}>↑</button>
                    <button style={r.searchNavBtn} onClick={() => setSearchFocus(f => Math.min(chapterMatches.length - 1, f + 1))}>↓</button>
                    <button
                      style={{...r.searchNavBtn, color:'var(--teal)', borderColor:'var(--teal)', fontWeight:600}}
                      onClick={() => submitSearch(searchQuery)}
                      title="Search whole Bible"
                    >
                      Search Bible
                    </button>
                  </>
                )}
              </div>
            )}

            {/* History dropdown */}
            {showHistDrop && searchHistory.length > 0 && (
              <div style={{position:'relative'}}>
                <SearchHistoryDropdown
                  history={searchHistory}
                  onSelect={q => { setSearchQuery(q); setSearchFocus(0); setShowHistDrop(false) }}
                  onRemove={q => {
                    removeSearchEntry('kjv', q)
                    setSearchHistory(getSearchHistory('kjv'))
                  }}
                  onClear={() => {
                    clearSearchHistory('kjv')
                    setSearchHistory([])
                    setShowHistDrop(false)
                  }}
                  onClose={() => setShowHistDrop(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Selection hint bar */}
        {selection && !searchOpen && (
          <div style={r.selectionBar}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
              <path d="M2 4h8M2 8h5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={r.selectionText}>
              {selection.length > 80 ? selection.slice(0, 80) + '…' : selection}
            </span>
            <button style={r.selectionClear} onClick={() => { try { window.getSelection().removeAllRanges() } catch {} setSelection('') }}>✕</button>
          </div>
        )}

        {/* Chapter content */}
        <div style={r.content}>
          {loading && (
            <div style={r.loadingState}>
              <div className="spinner" />
              <p style={{ color:'var(--ink-muted)', fontSize:14, marginTop:12 }}>Loading {book} {chapter}…</p>
            </div>
          )}
          {error && !loading && (
            <div style={r.errorState}>
              <p style={{ color:'var(--ink-muted)', fontSize:14 }}>Could not load chapter. Check your connection and try again.</p>
              <button style={{ ...r.navBtn, marginTop:12 }} onClick={() => {
                setLoading(true)
                fetchKjvChapter(book, chapter)
                  .then(v => { setVerses(v); setLoading(false) })
                  .catch(e => { setError(e.message); setLoading(false) })
              }}>Retry</button>
            </div>
          )}
          {/* ── Bible-wide search results ── */}
          {bibleResults !== null && (
            <div>
              <div style={r.srHeader}>
                <span style={r.srTitle}>
                  {bibleResults.length === 0
                    ? `No results for "${searchQuery}"`
                    : `${bibleResults.length}${bibleResults.length === 200 ? '+' : ''} results for "${searchQuery}"`
                  }
                </span>
                <button style={r.srClose} onClick={() => { setBibleResults(null); setSearchQuery('') }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Close
                </button>
              </div>
              {bibleResults.length === 0 ? (
                <p style={{fontSize:13, color:'var(--ink-faint)', textAlign:'center', padding:'2rem'}}>
                  Try a different word or phrase.
                </p>
              ) : (
                <div style={r.srList}>
                  {bibleResults.map(hit => {
                    const q = searchQuery.trim()
                    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    let textEl = hit.text
                    try {
                      const parts = hit.text.split(new RegExp(`(${escaped})`, 'gi'))
                      if (parts.length > 1) textEl = parts.map((p, i) =>
                        p.toLowerCase() === q.toLowerCase()
                          ? <mark key={i} style={{background:'#fef08a',color:'inherit',borderRadius:2,padding:'0 1px'}}>{p}</mark>
                          : p
                      )
                    } catch {}
                    return (
                      <button
                        key={`${hit.book}|${hit.chapter}|${hit.verse}`}
                        style={r.srRow}
                        onClick={() => {
                          navigate(hit.book, hit.chapter)
                          setBibleResults(null)
                          setSearchQuery('')
                          /* Scroll to verse after navigation */
                          setTimeout(() => {
                            const el = readerRef.current?.querySelector(`#v${hit.verse}`)
                            if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
                          }, 200)
                        }}
                      >
                        <span style={r.srRef}>{hit.book} {hit.chapter}:{hit.verse}</span>
                        <span style={r.srText}>{textEl}</span>
                      </button>
                    )
                  })}
                  {bibleResults.length === 200 && (
                    <p style={{fontSize:11, color:'var(--ink-faint)', textAlign:'center', padding:'8px 0'}}>
                      Showing first 200 results — try a more specific phrase.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && !error && verses.length > 0 && bibleResults === null && (
            <>
              <h2 style={r.chapterHeading}>{book} {chapter}</h2>

              {/* Verses */}
              <div style={r.verseList} ref={verseListRef}>
                {verses.map(({ verse, text }) => {
                  const verseKey      = `kjv|${book}|${chapter}|${verse}`
                  const hlColorId     = highlights[verseKey] || null
                  const hlStyle       = hlColorId ? getHlStyle(hlColorId) : null
                  const note          = itemNotes[verseKey]
                  const isEditing     = editingNote === verseKey
                  const showPicker    = colorPicker === verseKey
                  const verseRefs     = getCrossRefs(book, chapter, verse)
                  const isSearchMatch = !bibleResults && searchQuery.trim() && text.toLowerCase().includes(searchQuery.trim().toLowerCase())
                  const isFocusMatch  = !bibleResults && chapterMatches[searchFocus]?.verse === verse

                  return (
                    <div
                      key={verse}
                      id={`v${verse}`}
                      style={{
                        ...r.verseOuter,
                        ...(hlColorId ? {
                          background: hlStyle.rowBg,
                          borderLeftColor: hlStyle.border,
                        } : {}),
                        ...(isFocusMatch ? { outline:'2px solid var(--teal)', outlineOffset:2, borderRadius:6 } : {}),
                        ...(isSearchMatch && !isFocusMatch ? { background:'rgba(254,240,138,0.25)' } : {}),
                      }}
                    >
                      {/* ── main verse row ── */}
                      <div style={r.verseRow}>
                        {/* Verse number — click to open colour picker */}
                        <button
                          style={{
                            ...r.verseNum,
                            ...(hlColorId ? {
                              color: hlStyle.numClr,
                              background: hlStyle.numBg,
                            } : {}),
                          }}
                          onClick={() => {
                            setColorPicker(prev => prev === verseKey ? null : verseKey)
                            setEditingNote(null)
                          }}
                          title="Highlight verse"
                        >
                          {verse}
                        </button>

                        <span style={r.verseBody}>
                          <span style={{ ...r.verseText, fontSize }}>{highlightSearchInText(text)}</span>

                          {/* Confession cross-ref chips */}
                          {verseRefs.length > 0 && (
                            <span style={r.inlineCrossRefs}>
                              {verseRefs.map(ref => {
                                const chip = SRC_CHIP[ref.src] || {}
                                return (
                                  <button
                                    key={ref.key}
                                    style={{ ...r.inlineChip, background: chip.bg, color: chip.color, borderColor: chip.border }}
                                    onClick={() => setConfessionModal(ref)}
                                  >
                                    <span style={{ ...r.inlineChipSrc, background: chip.color }}>{ref.src}</span>
                                    <span style={r.inlineChipLabel}>{ref.label}</span>
                                  </button>
                                )
                              })}
                            </span>
                          )}

                          {/* Note icon button */}
                          <button
                            onClick={() => { openNoteEditor(verseKey); setColorPicker(null) }}
                            style={{
                              ...r.noteIconBtn,
                              ...(note ? r.noteIconBtnActive : {}),
                            }}
                            title={note ? 'View / edit note' : 'Add note'}
                          >
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M1.5 9L2 7 7 2l2 2-5 4.5L1.5 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                              <line x1="6" y1="2.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                          </button>
                        </span>
                      </div>

                      {/* Colour picker */}
                      {showPicker && (
                        <div style={{ marginLeft:34, marginBottom:4 }}>
                          <ColorPicker
                            currentColor={hlColorId}
                            onSelect={colorId => handleHighlight(verseKey, colorId)}
                            onClose={() => setColorPicker(null)}
                          />
                        </div>
                      )}

                      {/* Saved note display */}
                      {note && !isEditing && (
                        <div style={r.noteDisplay} onClick={() => openNoteEditor(verseKey)}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, marginTop:2, opacity:0.5 }}>
                            <path d="M1 9l.5-2L6 2.5l2 2L3.5 9 1 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                            <line x1="5.5" y1="3" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.2"/>
                          </svg>
                          <span style={{flex:1}}>{note}</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleShareNote(verseKey, note, text) }}
                            style={r.noteShareBtn}
                            title="Share note"
                          >
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <circle cx="8.5" cy="2" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                              <circle cx="8.5" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                              <circle cx="2.5" cy="5.5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
                              <path d="M3.8 4.9l3.5-2.4M3.8 6.1l3.5 2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Inline note editor */}
                      {isEditing && (
                        <div style={r.noteEditorWrap}>
                          <textarea
                            value={noteDraft}
                            onChange={e => setNoteDraft(e.target.value)}
                            placeholder={`Note on ${book} ${chapter}:${verse}…`}
                            style={r.noteTextarea}
                            autoFocus
                            rows={3}
                          />
                          <div style={r.noteEditorActions}>
                            <button onClick={() => saveNote(verseKey)} style={r.noteSaveBtn}>Save</button>
                            <button onClick={() => setEditingNote(null)} style={r.noteCancelBtn}>Cancel</button>
                            {note && (
                              <button onClick={() => deleteNote(verseKey)} style={r.noteDeleteBtn}>Delete</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Chapter navigation */}
        <div style={r.navBar}>
          <button
            style={{ ...r.navBtn, opacity: (!canPrev && !prevBook) ? 0.35 : 1 }}
            disabled={!canPrev && !prevBook}
            onClick={() => {
              if (canPrev) navigate(book, chapter - 1)
              else if (prevBook) navigate(prevBook.name, prevBook.chapters)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {canPrev ? `Ch. ${chapter - 1}` : prevBook ? prevBook.name : 'Prev'}
          </button>

          <div style={{ textAlign:'center', fontSize:11, color:'var(--ink-faint)' }}>
            {chapter} / {totalChs}
          </div>

          <button
            style={{ ...r.navBtn, opacity: (!canNext && !nextBook) ? 0.35 : 1 }}
            disabled={!canNext && !nextBook}
            onClick={() => {
              if (canNext) navigate(book, chapter + 1)
              else if (nextBook) navigate(nextBook.name, 1)
            }}
          >
            {canNext ? `Ch. ${chapter + 1}` : nextBook ? nextBook.name : 'Next'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

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
}

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
    height:'calc(100vh - 130px)',
    overflow:'hidden', position:'relative',
  },
  backdrop: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:199 },
  sidebar: {
    width:220, flexShrink:0, background:'var(--surface)',
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
    padding:'10px 16px', background:'var(--surface)',
    borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, zIndex:10,
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

  /* Search bar */
  searchBar: {
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
    padding:'8px 16px', display:'flex', flexDirection:'column', gap:6,
    position:'sticky', top:49, zIndex:9,
  },
  searchInputWrap: {
    display:'flex', alignItems:'center', gap:6,
    border:'1.5px solid var(--teal)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--parchment)',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'7px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
  searchClear: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    fontSize:16, lineHeight:1, padding:'0 2px', flexShrink:0,
  },
  searchResults: {
    display:'flex', alignItems:'center', gap:6,
  },
  searchNavBtn: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:4, padding:'3px 7px', cursor:'pointer', fontSize:12,
    color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif",
  },
  searchSaveBtn: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', padding:4, marginLeft:'auto',
    title: 'Save to history',
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
    flex:1, padding:'1.5rem 1.5rem 2rem',
    maxWidth:720, margin:'0 auto', width:'100%',
  },
  loadingState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:8 },
  errorState:   { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:8, textAlign:'center' },
  chapterHeading: {
    fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:500,
    color:'var(--ink)', marginBottom:'1.5rem', letterSpacing:'-0.01em',
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
  },
  verseNum: {
    fontSize:10, fontWeight:700, color:'var(--teal)',
    minWidth:22, flexShrink:0,
    fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em',
    fontFamily:"'DM Sans',sans-serif",
    background:'none', border:'none', cursor:'pointer',
    borderRadius:4, padding:'4px 2px',
    transition:'background 0.12s, color 0.12s',
    paddingTop:4,
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
    marginBottom:16, gap:10, flexWrap:'wrap',
  },
  srTitle: {
    fontSize:14, fontWeight:600, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif",
  },
  srClose: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:12, fontWeight:600, color:'var(--ink-muted)',
    background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'5px 10px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  srList: {
    display:'flex', flexDirection:'column', gap:2,
    borderRadius:'var(--radius-lg)', overflow:'hidden',
    border:'1px solid var(--border)',
  },
  srRow: {
    display:'flex', flexDirection:'column', gap:3,
    padding:'10px 14px', background:'var(--surface)',
    border:'none', borderBottom:'1px solid var(--border)',
    cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  srRef: {
    fontSize:11, fontWeight:700, color:'var(--teal)',
    letterSpacing:'0.02em',
  },
  srText: {
    fontSize:14, color:'var(--ink)', lineHeight:1.6,
    fontFamily:"'Georgia','Times New Roman',serif",
  },

  /* Nav bar */
  navBar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', background:'var(--surface)',
    borderTop:'1px solid var(--border)',
    position:'sticky', bottom:0, zIndex:10,
    fontFamily:"'DM Sans',sans-serif",
  },
  navBtn: {
    display:'flex', alignItems:'center', gap:6,
    padding:'8px 14px', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', background:'white',
    color:'var(--ink)', fontSize:12, fontWeight:600,
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.12s',
  },
}
