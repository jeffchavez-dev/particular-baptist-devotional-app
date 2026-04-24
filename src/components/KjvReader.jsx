import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BIBLE_BOOKS } from '../lib/bibleBooks'

/* ── Module-level chapter cache (persists across re-renders) ── */
const KJV_CACHE = new Map()

/* ── Book display name → API slug ── */
function bookSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

/* ── Fetch a chapter; returns array of {verse, text} ── */
async function fetchKjvChapter(bookName, ch) {
  const key = `${bookSlug(bookName)}/${ch}`
  if (KJV_CACHE.has(key)) return KJV_CACHE.get(key)
  const url = `https://raw.githubusercontent.com/wldeh/bible-api/main/bibles/en-kjv/books/${bookSlug(bookName)}/chapters/${ch}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${bookName} ${ch}`)
  const json = await res.json()
  const verses = (json.data || []).map(v => ({ verse: parseInt(v.verse), text: v.text }))
  KJV_CACHE.set(key, verses)
  return verses
}

/* ── Bible category structure (mirrors ScripturePage) ── */
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

/* ── Sidebar book picker ── */
function BookSidebar({ selectedBook, onSelect, onClose, isMobile, selectedChapter, onChapterSelect }) {
  const [openCats, setOpenCats] = useState(() => {
    // Auto-open the category that contains the selected book
    const allCats = [...OT_CATS, ...NT_CATS]
    const cat = allCats.find(c => c.books.includes(selectedBook))
    return new Set(cat ? [cat.id] : ['law'])
  })

  function toggleCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const renderTestament = (label, cats, badgeBg, badgeColor, testId) => (
    <div style={sb.testSection} key={testId}>
      <div style={sb.testHeader}>
        <span style={{...sb.testBadge, background:badgeBg, color:badgeColor}}>{testId}</span>
        <span style={sb.testLabel}>{label}</span>
      </div>
      {cats.map(cat => (
        <div key={cat.id}>
          <button
            style={{...sb.catBtn, background: openCats.has(cat.id) ? cat.bg : 'transparent'}}
            onClick={() => toggleCat(cat.id)}
          >
            <span style={{...sb.catLabel, color: cat.color}}>{cat.label}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{flexShrink:0, transition:'transform 0.18s', transform: openCats.has(cat.id) ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)'}}>
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {openCats.has(cat.id) && (
            <div style={sb.bookList}>
              {cat.books.filter(b => BOOK_META[b]).map(b => {
                const bookChapterCount = BOOK_META[b]?.chapters || 1
                const isSelected = selectedBook === b
                return (
                  <div key={b}>
                    <button
                      style={{
                        ...sb.bookBtn,
                        ...(isSelected ? {background: cat.bg, color: cat.color, fontWeight:700, borderLeft:`3px solid ${cat.color}`} : {}),
                      }}
                      onClick={() => { onSelect(b); if (isMobile && onClose) onClose() }}
                    >
                      {b}
                      <span style={sb.bookChCount}>{bookChapterCount}ch</span>
                    </button>
                    {/* Show chapters when book is selected */}
                    {isSelected && (
                      <div style={sb.chapterGrid}>
                        {Array.from({length: bookChapterCount}, (_, i) => i+1).map(ch => (
                          <button
                            key={ch}
                            style={{
                              ...sb.chapterBtn,
                              ...(selectedChapter === ch ? {background: cat.color, color: 'white', fontWeight:700} : {}),
                            }}
                            onClick={() => { onChapterSelect(ch); if (isMobile && onClose) onClose() }}
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
export default function KjvReader({ todayChapter }) {
  const [book,      setBook]      = useState('Genesis')
  const [chapter,   setChapter]   = useState(1)
  const [verses,    setVerses]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [sideOpen,  setSideOpen]  = useState(false) // mobile sidebar
  const [fontSize,  setFontSize]  = useState(() => {
    try { return parseInt(localStorage.getItem('kjv-fontsize') || '17') } catch { return 17 }
  })
  const readerRef = useRef(null)
  const [isMobile,  setIsMobile]  = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const bookInfo   = BOOK_META[book] || { chapters: 1 }
  const totalChs   = bookInfo.chapters

  /* Load chapter */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setVerses([])
    fetchKjvChapter(book, chapter)
      .then(v => { if (!cancelled) { setVerses(v); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    // Scroll reader to top
    if (readerRef.current) readerRef.current.scrollTop = 0
    return () => { cancelled = true }
  }, [book, chapter])

  /* Prefetch next chapter */
  useEffect(() => {
    if (chapter < totalChs) fetchKjvChapter(book, chapter + 1).catch(() => {})
  }, [book, chapter, totalChs])

  function selectBook(b) {
    setBook(b)
    setChapter(1)
    // Only close on mobile
    if (isMobile) setSideOpen(false)
  }

  function handleChapterSelect(ch) {
    setChapter(ch)
    // Close sidebar on mobile after selection
    if (isMobile) setSideOpen(false)
  }

  function changeFontSize(delta) {
    setFontSize(prev => {
      const next = Math.min(24, Math.max(13, prev + delta))
      try { localStorage.setItem('kjv-fontsize', String(next)) } catch {}
      return next
    })
  }

  /* ── Today's reading link ── */
  const todayLink = todayChapter // e.g. "Genesis 1"
  const isTodayChapter = todayLink && todayLink === `${book} ${chapter}`

  const canPrev = chapter > 1
  const canNext = chapter < totalChs

  /* Find prev/next book for cross-book navigation */
  const bookIdx = BIBLE_BOOKS.findIndex(b => b.name === book)
  const prevBook = chapter === 1 && bookIdx > 0 ? BIBLE_BOOKS[bookIdx - 1] : null
  const nextBook = chapter === totalChs && bookIdx < BIBLE_BOOKS.length - 1 ? BIBLE_BOOKS[bookIdx + 1] : null

  return (
    <div style={r.wrap}>

      {/* ── Mobile sidebar backdrop ── */}
      {isMobile && sideOpen && (
        <div style={r.backdrop} onClick={() => setSideOpen(false)} />
      )}

      {/* ── Book sidebar ── */}
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
            <span style={{fontSize:13, fontWeight:700}}>Select Book</span>
            <button onClick={() => setSideOpen(false)} style={r.closeBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        <BookSidebar
          selectedBook={book}
          onSelect={selectBook}
          onClose={() => setSideOpen(false)}
          isMobile={isMobile}
          selectedChapter={chapter}
          onChapterSelect={handleChapterSelect}
        />
      </aside>

      {/* ── Reader panel ── */}
      <div style={r.readerWrap} ref={readerRef}>

        {/* ── Reader toolbar ── */}
        <div style={r.toolbar}>
          <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0}}>
            {/* Mobile: book picker button */}
            {isMobile && (
              <button style={r.toolBtn} onClick={() => setSideOpen(true)}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="1" y="2" width="13" height="1.5" rx=".75" fill="currentColor"/>
                  <rect x="1" y="6.75" width="8" height="1.5" rx=".75" fill="currentColor"/>
                  <rect x="1" y="11.5" width="10" height="1.5" rx=".75" fill="currentColor"/>
                </svg>
              </button>
            )}
            {/* Book + chapter display */}
            <div style={r.bookTitle}>
              <span style={r.bookName}>{book}</span>
              <span style={{color:'var(--ink-faint)', margin:'0 4px'}}>·</span>
              <span style={r.chapterDisplay}>Ch. {chapter}</span>
            </div>
            {isTodayChapter && (
              <span style={r.todayBadge}>Today</span>
            )}
          </div>

          {/* Font size controls */}
          <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0}}>
            <button style={r.toolBtn} onClick={() => changeFontSize(-1)} title="Smaller text">A−</button>
            <button style={r.toolBtn} onClick={() => changeFontSize(+1)} title="Larger text">A+</button>
          </div>
        </div>

        {/* ── Chapter content ── */}
        <div style={r.content}>
          {loading && (
            <div style={r.loadingState}>
              <div className="spinner" />
              <p style={{color:'var(--ink-muted)',fontSize:14,marginTop:12}}>Loading {book} {chapter}…</p>
            </div>
          )}
          {error && !loading && (
            <div style={r.errorState}>
              <p style={{color:'var(--ink-muted)',fontSize:14}}>Could not load chapter. Check your connection and try again.</p>
              <button style={{...r.navBtn, marginTop:12}} onClick={() => { setLoading(true); fetchKjvChapter(book, chapter).then(v => { setVerses(v); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) }) }}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && verses.length > 0 && (
            <>
              {/* Chapter heading */}
              <h2 style={r.chapterHeading}>{book} {chapter}</h2>
              {/* Verses */}
              <div style={r.verseList}>
                {verses.map(({ verse, text }) => (
                  <div key={verse} style={r.verseRow} id={`v${verse}`}>
                    <span style={r.verseNum}>{verse}</span>
                    <span style={{...r.verseText, fontSize: fontSize}}>{text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Chapter navigation ── */}
        <div style={r.navBar}>
          <button
            style={{...r.navBtn, opacity: (!canPrev && !prevBook) ? 0.35 : 1}}
            disabled={!canPrev && !prevBook}
            onClick={() => {
              if (canPrev) setChapter(c => c - 1)
              else if (prevBook) { setBook(prevBook.name); setChapter(prevBook.chapters) }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {canPrev ? `Ch. ${chapter - 1}` : prevBook ? prevBook.name : 'Prev'}
          </button>

          <div style={{textAlign:'center', fontSize:11, color:'var(--ink-faint)'}}>
            {chapter} / {totalChs}
          </div>

          <button
            style={{...r.navBtn, opacity: (!canNext && !nextBook) ? 0.35 : 1}}
            disabled={!canNext && !nextBook}
            onClick={() => {
              if (canNext) setChapter(c => c + 1)
              else if (nextBook) { setBook(nextBook.name); setChapter(1) }
            }}
          >
            {canNext ? `Ch. ${chapter + 1}` : nextBook ? nextBook.name : 'Next'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
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
  bookChCount: { fontSize:10, color:'var(--ink-faint)', marginLeft:4, flexShrink:0 },
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
    display:'flex', height:'calc(100vh - 120px)', // leave room for header + bottom nav
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

  /* Toolbar */
  toolbar: {
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 16px', background:'var(--surface)',
    borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, zIndex:10,
    fontFamily:"'DM Sans',sans-serif",
  },
  bookTitle: { display:'flex', alignItems:'center', flexWrap:'wrap', gap:4, minWidth:0 },
  bookName: { fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', whiteSpace:'nowrap' },
  chapterDisplay: { fontSize:13, fontWeight:600, color:'var(--teal)' },
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
    transition:'background 0.12s',
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
    display:'flex', gap:12, padding:'4px 0',
    lineHeight:1.8,
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
