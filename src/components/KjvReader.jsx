import React, { useState, useEffect, useRef, useMemo } from 'react'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { getCrossRefs } from '../lib/crossRef'
import ShareCardModal from './ShareCardModal'
import ConfessionModal from './ConfessionModal'

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

function getChapterVerses(bookName, ch) {
  if (!_kjvData) return null
  const slug = bookSlug(bookName)
  const raw = _kjvData[slug]?.[ch]
  if (!raw) return null
  return raw.map(v => ({ verse: v.v, text: v.t }))
}

export async function fetchKjvChapter(bookName, ch) {
  await loadKjv()
  const verses = getChapterVerses(bookName, ch)
  if (!verses) throw new Error(`${bookName} ${ch} not found in KJV data`)
  return verses
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

/* ── Sidebar ── */
function BookSidebar({ selectedBook, selectedChapter, onNavigate, onClose, isMobile }) {
  /* Start with all categories collapsed */
  const [openCats, setOpenCats] = useState(() => new Set())
  /* Track which book is expanded to show chapters (separate from current reading) */
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
      /* Single-chapter book → navigate immediately */
      onNavigate(bookName, 1)
      if (isMobile && onClose) onClose()
    } else {
      /* Multi-chapter → expand chapter grid; don't navigate yet */
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

                    {/* Chapter grid — shown for expanded book */}
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
  const [shareCard,      setShareCard]      = useState(null)
  const [confessionModal, setConfessionModal] = useState(null)

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

  /* Clear selection when chapter changes */
  useEffect(() => {
    setSelection('')
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

  /* Cross-references for current chapter */
  const crossRefs = useMemo(() => getCrossRefs(book, chapter), [book, chapter])

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

  const todayLink     = todayChapter
  const isTodayChapter = todayLink && todayLink === `${book} ${chapter}`
  const canPrev       = chapter > 1
  const canNext       = chapter < totalChs
  const bookIdx       = BIBLE_BOOKS.findIndex(b => b.name === book)
  const prevBook      = chapter === 1 && bookIdx > 0 ? BIBLE_BOOKS[bookIdx - 1] : null
  const nextBook      = chapter === totalChs && bookIdx < BIBLE_BOOKS.length - 1 ? BIBLE_BOOKS[bookIdx + 1] : null

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
          {/* Book pill — tap on mobile to open sidebar */}
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

          {/* Right toolbar controls */}
          <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0, marginLeft:'auto' }}>
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

        {/* Selection hint bar */}
        {selection && (
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
          {!loading && !error && verses.length > 0 && (
            <>
              <h2 style={r.chapterHeading}>{book} {chapter}</h2>

              {/* Verses */}
              <div style={r.verseList} ref={verseListRef}>
                {verses.map(({ verse, text }) => (
                  <div key={verse} style={r.verseRow} id={`v${verse}`}>
                    <span style={r.verseNum}>{verse}</span>
                    <span style={{ ...r.verseText, fontSize }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Cross-references */}
              {crossRefs.length > 0 && (
                <div style={r.crossRefSection}>
                  <div style={r.crossRefHeader}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0, opacity:0.6 }}>
                      <path d="M1.5 6.5h10M6.5 1.5v10" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <span style={r.crossRefTitle}>Referenced in Confession &amp; Catechism</span>
                  </div>
                  <div style={r.crossRefList}>
                    {crossRefs.map(ref => {
                      const chip = SRC_CHIP[ref.src] || {}
                      return (
                        <button
                          key={ref.key}
                          style={{ ...r.crossRefChip, background: chip.bg, color: chip.color, borderColor: chip.border }}
                          onClick={() => setConfessionModal(ref)}
                        >
                          <span style={{ ...r.crossRefSrcBadge, background: chip.color, color:'white' }}>{ref.src}</span>
                          <span style={r.crossRefLabel}>{ref.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
  verseRow: {
    display:'flex', gap:12, padding:'4px 0', lineHeight:1.8,
  },
  verseNum: {
    fontSize:10, fontWeight:700, color:'var(--teal)',
    minWidth:22, paddingTop:6, flexShrink:0,
    fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em',
    fontFamily:"'DM Sans',sans-serif",
  },
  verseText: {
    color:'var(--ink)', lineHeight:1.85,
    fontFamily:"'Georgia', 'Times New Roman', serif",
  },

  /* Cross-references */
  crossRefSection: {
    marginTop:'2.5rem', paddingTop:'1.5rem',
    borderTop:'1px solid var(--border)',
  },
  crossRefHeader: {
    display:'flex', alignItems:'center', gap:6, marginBottom:12,
  },
  crossRefTitle: {
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.08em', color:'var(--ink-faint)',
  },
  crossRefList: {
    display:'flex', flexDirection:'column', gap:8,
  },
  crossRefChip: {
    display:'flex', alignItems:'flex-start', gap:8,
    padding:'10px 12px', border:'1px solid',
    borderRadius:'var(--radius)', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'opacity 0.12s',
    width:'100%',
  },
  crossRefSrcBadge: {
    fontSize:8, fontWeight:700, letterSpacing:'0.07em',
    padding:'2px 6px', borderRadius:99, flexShrink:0, marginTop:2,
  },
  crossRefLabel: {
    fontSize:13, fontWeight:500, lineHeight:1.4,
    fontFamily:"'Cormorant Garamond',serif",
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
