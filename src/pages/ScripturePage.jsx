import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import KjvReader from '../components/KjvReader'
import { buildSchedule, getBibleProgress, setBibleChapter, getTodayDayNum } from '../lib/supabase'
import { LBCF2 }     from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 }     from '../data/lbcf1'
import { DAY_BIBLE } from '../data/readingPlan'
import { BIBLE_BOOKS, TOTAL_CHAPTERS } from '../lib/bibleBooks'
import { buildScriptureIndex, BOOK_MAP } from '../lib/scriptureParser'
import { saveState, loadState, saveScroll, restoreScroll } from '../lib/pageState'

const SCHEDULE = buildSchedule()

/* ── Book name → { order, testament, chapters } — use array index for canonical order ── */
const BOOK_META = Object.fromEntries(
  BIBLE_BOOKS.map((b, i) => [b.name, { order: i, testament: b.testament, chapters: b.chapters }])
)

/* ── Build plan index: book → sorted chapter numbers (from reading plan) ── */
const PLAN_BY_BOOK = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([dayStr, chStr]) => {
    const match = chStr.match(/^(.+?)\s+(\d+)$/)
    if (!match) return
    const book = match[1], ch = parseInt(match[2])
    if (!m[book]) m[book] = []
    if (!m[book].includes(ch)) m[book].push(ch)
  })
  Object.keys(m).forEach(b => m[b].sort((a, z) => a - z))
  return m
})()

/* ── Plan books sorted canonically ── */
const PLAN_BOOKS_ORDERED = Object.keys(PLAN_BY_BOOK)
  .filter(b => BOOK_META[b])
  .sort((a, z) => (BOOK_META[a]?.order ?? 999) - (BOOK_META[z]?.order ?? 999))

const PLAN_OT_BOOKS = PLAN_BOOKS_ORDERED.filter(b => BOOK_META[b]?.testament === 'OT')
const PLAN_NT_BOOKS = PLAN_BOOKS_ORDERED.filter(b => BOOK_META[b]?.testament === 'NT')

const PLAN_TOTAL = Object.values(PLAN_BY_BOOK).reduce((s, chs) => s + chs.length, 0)
const PLAN_OT_TOTAL = PLAN_OT_BOOKS.reduce((s, b) => s + PLAN_BY_BOOK[b].length, 0)
const PLAN_NT_TOTAL = PLAN_NT_BOOKS.reduce((s, b) => s + PLAN_BY_BOOK[b].length, 0)

/* ── Map chapter string → day numbers ── */
const CHAPTER_TO_DAYS = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([d, ch]) => {
    if (!m[ch]) m[ch] = []
    m[ch].push(parseInt(d))
  })
  return m
})()

/* ── Bible totals by testament ── */
const BIBLE_OT_TOTAL = BIBLE_BOOKS.filter(b => b.testament === 'OT').reduce((s, b) => s + b.chapters, 0)
const BIBLE_NT_TOTAL = BIBLE_BOOKS.filter(b => b.testament === 'NT').reduce((s, b) => s + b.chapters, 0)

/* ── Proof-text helpers ── */
const BOOK_NAMES_ORDERED = Array.from(
  new Map(Object.values(BOOK_MAP).map(b => [b.order, b])).values()
).sort((a, b) => a.order - b.order)
const OT_BOOKS = new Set(BOOK_NAMES_ORDERED.filter(b => b.order <= 39).map(b => b.name))
const NT_BOOKS = new Set(BOOK_NAMES_ORDERED.filter(b => b.order >= 40).map(b => b.name))

function srcBadge(src) {
  if (src === '2LBCF')     return { bg:'var(--purple-soft)', color:'var(--purple-ink)' }
  if (src === 'Catechism') return { bg:'var(--teal-light)',  color:'var(--teal)' }
  return                          { bg:'var(--amber-soft)',  color:'var(--amber-ink)' }
}

/* ── Small chapter checkbox block (Full Bible only) ── */
function ChapterBlock({ chId, done, inPlan, onToggle, label }) {
  return (
    <button
      onClick={() => onToggle(chId, !done)}
      title={`${chId}${inPlan ? ' · in reading plan' : ''}${done ? ' · read' : ''}`}
      style={{
        width: 32, height: 32, borderRadius: 6,
        border: `1.5px solid ${done ? 'var(--teal)' : inPlan ? 'rgba(29,107,90,0.35)' : 'var(--border)'}`,
        background: done ? 'var(--teal)' : inPlan ? 'var(--teal-light)' : 'var(--surface)',
        color: done ? 'white' : inPlan ? 'var(--teal)' : 'var(--ink-faint)',
        fontSize: 10, fontWeight: done ? 700 : inPlan ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans',sans-serif", flexShrink: 0,
      }}
    >
      {label ?? chId.split(' ').pop()}
    </button>
  )
}

/* ── Mini progress bar ── */
function MiniBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ height:5, borderRadius:99, background:'var(--border)', overflow:'hidden', width:60, flexShrink:0 }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--teal)', width:`${pct}%`, transition:'width 0.3s' }} />
      </div>
      <span style={{ fontSize:10, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums' }}>{done}/{total}</span>
    </div>
  )
}

/* ── Big progress bar ── */
function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)' }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif" }}>
          <strong>{done}</strong> / {total} <span style={{fontWeight:400,color:'var(--ink-faint)'}}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height:8, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--teal)', width:`${pct}%`, transition:'width 0.3s' }} />
      </div>
    </div>
  )
}

/* ── Bible category groupings ── */
const OT_CATEGORIES = [
  { id:'law',     label:'The Law',        color:'#7c5230', bg:'#fdf3e3', books:['Genesis','Exodus','Leviticus','Numbers','Deuteronomy'] },
  { id:'history', label:'History',        color:'#5a3e8c', bg:'#f0ecfa', books:['Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther'] },
  { id:'wisdom',  label:'Psalms & Wisdom',color:'#1d6b5a', bg:'#e4f0ec', books:['Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon'] },
  { id:'major',   label:'Major Prophets', color:'#8c3e3e', bg:'#faeaea', books:['Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel'] },
  { id:'minor',   label:'Minor Prophets', color:'#3e5a8c', bg:'#e8eefa', books:['Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'] },
]
const NT_CATEGORIES = [
  { id:'gospels', label:'Gospels',         color:'#1d6b5a', bg:'#e4f0ec', books:['Matthew','Mark','Luke','John'] },
  { id:'acts',    label:'History',         color:'#5a3e8c', bg:'#f0ecfa', books:['Acts'] },
  { id:'pauline', label:'Pauline Letters', color:'#7c5230', bg:'#fdf3e3', books:['Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon'] },
  { id:'general', label:'General Epistles',color:'#3e5a8c', bg:'#e8eefa', books:['Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'] },
]

/* ── Category box component (used in both plan + bible modes) ──
   In plan mode: pass planByBook, navigate.
   In bible mode: pass bibBooks, onToggle. ── */
function CategoryBox({ cat, planByBook, bibBooks, progress, mode, onToggle, onNavigate, isOpen, onOpenToggle }) {
  // Filter to books in this category that actually have data
  const bookNames = mode === 'plan'
    ? cat.books.filter(b => planByBook[b])
    : cat.books.filter(b => bibBooks.find(bk => bk.name === b))

  const { total, done } = bookNames.reduce((acc, name) => {
    if (mode === 'plan') {
      const chs = planByBook[name] || []
      acc.total += chs.length
      acc.done  += chs.filter(ch => progress[`${name} ${ch}`]).length
    } else {
      const bk = bibBooks.find(b => b.name === name)
      if (bk) {
        acc.total += bk.chapters
        acc.done  += Array.from({length: bk.chapters}, (_, i) => i+1).filter(ch => progress[`${name} ${ch}`]).length
      }
    }
    return acc
  }, { total: 0, done: 0 })

  if (total === 0) return null

  return (
    <div style={{...s.catBox, borderColor: isOpen ? cat.color : 'var(--border)'}}>
      <button
        style={{...s.catHeader, background: isOpen ? cat.bg : 'var(--surface)'}}
        onClick={onOpenToggle}
      >
        <div style={{flex:1, minWidth:0}}>
          <div style={{...s.catLabel, color: cat.color}}>{cat.label}</div>
          <div style={{fontSize:10, color:'var(--ink-faint)', marginTop:2}}>{bookNames.length} book{bookNames.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
          <MiniBar done={done} total={total} />
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0, transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)'}}>
            <path d="M4 2.5l4.5 4.5L4 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div style={s.catBody}>
          {bookNames.map(name => {
            const planChs = planByBook[name] || []
            const bk = bibBooks?.find(b => b.name === name)
            const chList = mode === 'plan'
              ? planChs.map(ch => ({ ch, chId:`${name} ${ch}`, isDone: !!progress[`${name} ${ch}`] }))
              : Array.from({length: bk?.chapters || 0}, (_, i) => i+1).map(ch => ({
                  ch, chId:`${name} ${ch}`,
                  isDone: !!progress[`${name} ${ch}`],
                  inPlan: planChs.includes(ch),
                }))
            const doneCnt = chList.filter(c => c.isDone).length
            return (
              <div key={name} style={s.catBookRow}>
                <div style={s.catBookHead}>
                  <span style={s.catBookName}>{name}</span>
                  <span style={s.catBookProgress}>{doneCnt}/{chList.length}</span>
                </div>
                {mode === 'plan' ? (
                  <div style={s.dayLinks}>
                    {chList.map(({ ch, chId, isDone }) =>
                      (CHAPTER_TO_DAYS[chId] || []).map(d => (
                        <button
                          key={`${ch}-${d}`}
                          onClick={() => onNavigate(d)}
                          style={{...s.dayLink, ...(isDone ? {background:'var(--teal)',color:'white',borderColor:'var(--teal)'} : {})}}
                          title={`Go to Day ${d}`}
                        >
                          {isDone && <span style={{marginRight:2}}>✓</span>}Ch.{ch} · Day {d}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={s.chGrid}>
                    {chList.map(({ ch, chId, isDone, inPlan }) => (
                      <ChapterBlock
                        key={ch}
                        chId={chId}
                        done={isDone}
                        inPlan={inPlan}
                        onToggle={onToggle}
                        label={ch}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Testament section with category grid ── */
function TestamentSection({ testament, categories, planByBook, bibBooks, progress, mode, onToggle, onNavigate, openCats, setOpenCat }) {
  const isOT = testament === 'OT'
  const badgeBg    = isOT ? 'var(--amber-soft)'  : 'var(--purple-soft)'
  const badgeColor = isOT ? 'var(--amber-ink)'   : 'var(--purple-ink)'

  const { total, done } = mode === 'plan'
    ? Object.keys(planByBook)
        .filter(b => { const meta = bibBooks.find(bk => bk.name === b); return meta?.testament === testament })
        .reduce((acc, b) => {
          const chs = planByBook[b]
          acc.total += chs.length
          acc.done  += chs.filter(ch => progress[`${b} ${ch}`]).length
          return acc
        }, { total: 0, done: 0 })
    : bibBooks.filter(b => b.testament === testament)
        .reduce((acc, bk) => {
          acc.total += bk.chapters
          acc.done  += Array.from({length:bk.chapters},(_, i)=>i+1).filter(ch => progress[`${bk.name} ${ch}`]).length
          return acc
        }, { total: 0, done: 0 })

  return (
    <div style={s.testamentSection}>
      <div style={s.testamentHeader}>
        <span style={{...s.testBadge, background: badgeBg, color: badgeColor}}>{testament}</span>
        <span style={s.testamentLabel}>{isOT ? 'Old Testament' : 'New Testament'}</span>
        <MiniBar done={done} total={total} />
      </div>
      <div style={s.catGrid}>
        {categories.map(cat => (
          <CategoryBox
            key={cat.id}
            cat={cat}
            planByBook={planByBook}
            bibBooks={bibBooks}
            progress={progress}
            mode={mode}
            onToggle={onToggle}
            onNavigate={onNavigate}
            isOpen={openCats.has(cat.id)}
            onOpenToggle={() => setOpenCat(cat.id)}
          />
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ScripturePage() {
  const navigate = useNavigate()
  const { state: locationState } = useLocation()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  /* Restore saved state — but if coming from Settings deep-link, force 'read' mode */
  const _saved = loadState('scripture', { mode: 'read' })
  const [mode,    setMode]    = useState(locationState?.book ? 'read' : _saved.mode)
  const [progress, setProgress] = useState(() => getBibleProgress())
  /* Open/closed category boxes */
  const [openCats, setOpenCats] = useState(new Set())

  /* Proof-text state */
  const [search,    setSearch]    = useState('')
  const [filterSrc, setFilterSrc] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [expanded,  setExpanded]  = useState(null)

  /* Persist state on change */
  useEffect(() => { saveState('scripture', { mode }) }, [mode])

  /* Toggle a category box open/closed */
  function setOpenCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /* Save scroll on unmount, restore on mount */
  useEffect(() => {
    restoreScroll('scripture')
    return () => saveScroll('scripture')
  }, [])

  const index = useMemo(() => buildScriptureIndex(LBCF2, CATECHISM, LBCF1, SCHEDULE), [])
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return index.filter(entry => {
      if (filterSrc && !entry.citations.some(c => c.src === filterSrc)) return false
      if (filterDiv === 'OT' && !OT_BOOKS.has(entry.bookInfo.name)) return false
      if (filterDiv === 'NT' && !NT_BOOKS.has(entry.bookInfo.name)) return false
      if (q) {
        const inRef   = entry.refStr.toLowerCase().includes(q)
        const inBook  = entry.bookInfo.name.toLowerCase().includes(q)
        const inLabel = entry.citations.some(c => c.label.toLowerCase().includes(q))
        if (!inRef && !inBook && !inLabel) return false
      }
      return true
    })
  }, [index, search, filterSrc, filterDiv])

  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach(entry => {
      const name = entry.bookInfo.name
      if (!groups.has(name)) groups.set(name, { bookInfo: entry.bookInfo, entries: [] })
      groups.get(name).entries.push(entry)
    })
    return Array.from(groups.values()).sort((a, b) => a.bookInfo.order - b.bookInfo.order)
  }, [filtered])

  /* Toggle a chapter — updates state + localStorage + Supabase */
  const toggleChapter = useCallback((chId, done) => {
    setBibleChapter(chId, done, userId)
    setProgress(prev => {
      const next = { ...prev }
      if (done) next[chId] = true
      else delete next[chId]
      return next
    })
  }, [userId])

  /* Counts for tab badges */
  const planDone  = useMemo(() => PLAN_BOOKS_ORDERED.reduce((s, b) =>
    s + PLAN_BY_BOOK[b].filter(ch => progress[`${b} ${ch}`]).length, 0), [progress])
  const bibleDone = Object.keys(progress).length

  /* Today's Bible chapter (for KJV reader "Today" badge) */
  const todayBibleChapter = useMemo(() => {
    const today = Math.min(getTodayDayNum(), 365)
    return DAY_BIBLE[today] || null
  }, [])

  const kjvRef = useRef(null)
  const [readBook, setReadBook] = useState('Genesis')
  const [readChapter, setReadChapter] = useState(1)
  const [readSearch, setReadSearch] = useState('')
  const [readVersion, setReadVersion] = useState(() => {
    try { return sessionStorage.getItem('reader-version') || 'kjv' } catch { return 'kjv' }
  })

  const [sidebarOpen, setSidebarOpen] = useState(false)

  /* Deep-link from Settings: navigate to specific book/chapter/verse */
  const pendingDeepLinkRef = useRef(locationState?.book ? locationState : null)
  useEffect(() => {
    if (!pendingDeepLinkRef.current) return
    const { book: b, chapter: ch, verse: v } = pendingDeepLinkRef.current
    pendingDeepLinkRef.current = null
    /* KjvReader may not have mounted yet — give it one frame then call navigateTo */
    const timer = setTimeout(() => {
      kjvRef.current?.navigateTo(b, ch, v)
    }, 150)
    return () => clearTimeout(timer)
  }, [mode]) // fires when mode becomes 'read'

  /* Close sidebar on Escape */
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* Mode tabs */
  const tabs = [
    { id: 'read',       label: '📖 Read KJV',    hint: null },
    { id: 'plan',       label: 'Reading Plan',   hint: `${planDone}/${PLAN_TOTAL}` },
    { id: 'bible',      label: 'Full Bible',     hint: `${bibleDone}/${TOTAL_CHAPTERS}` },
    { id: 'prooftexts', label: 'Proof Texts',    hint: null },
  ]

  const currentTab = tabs.find(t => t.id === mode)

  return (
    <div style={s.page}>

      {/* ── Compact Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={s.menuBtn}
            aria-label="Open navigation"
            title="Navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3.5" width="14" height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="8.1" width="10"  height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="12.7" width="12" height="1.8" rx="0.9" fill="currentColor"/>
            </svg>
          </button>
          {mode === 'read' ? (
            <>
              {/* Book/chapter pill */}
              <button
                style={s.readBookPill}
                onClick={() => kjvRef.current?.openSidebar()}
                title="Select book & chapter"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink:0, opacity:0.5 }}>
                  <rect x="1" y="1" width="9" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 3.5h5M3 5.5h5M3 7.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                <span style={s.readBookName}>{readBook}</span>
                <span style={s.readBookCh}>Ch. {readChapter}</span>
              </button>
              {/* Inline search */}
              <div style={s.readSearchWrap}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
                  <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  style={s.readSearchInput}
                  value={readSearch}
                  onChange={e => {
                    setReadSearch(e.target.value)
                    kjvRef.current?.setSearchQuery(e.target.value)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') kjvRef.current?.submitSearch(readSearch)
                    if (e.key === 'Escape') { kjvRef.current?.clearSearch(); setReadSearch('') }
                  }}
                  placeholder="Search Bible…"
                />
                {readSearch && (
                  <button
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px', flexShrink:0 }}
                    onClick={() => { setReadSearch(''); kjvRef.current?.clearSearch() }}
                  >×</button>
                )}
              </div>
            </>
          ) : (
            <>
              <span style={s.headerMode}>{currentTab?.label}</span>
              {currentTab?.hint && (
                <span style={s.headerBadge}>{currentTab.hint}</span>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── Sidebar backdrop ── */}
      {sidebarOpen && (
        <div style={s.backdrop} onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* ── Sidebar ── */}
      <aside style={{...s.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'}}>
        <div style={s.sidebarHead}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <img src="/pb-icon.svg" alt="P.B." style={{width:22, height:22, opacity:0.7}} />
            <span style={s.sidebarTitle}>Scripture</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={s.sidebarClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={s.sidebarBody}>
          <p style={s.sidebarHint}>Choose a mode</p>
          <div style={s.navList}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { setMode(t.id); setSidebarOpen(false) }}
                style={{
                  ...s.navBtn,
                  ...(mode === t.id ? s.navBtnActive : {}),
                }}
              >
                <span style={{flex:1, textAlign:'left'}}>{t.label}</span>
                {t.hint && (
                  <span style={{
                    ...s.navBadge,
                    background: mode === t.id ? 'var(--teal)' : 'var(--border)',
                    color:      mode === t.id ? 'white'       : 'var(--ink-faint)',
                  }}>{t.hint}</span>
                )}
                {mode === t.id && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0}}>
                    <polyline points="1.5,6 4.5,9 10.5,3" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ══ KJV READER ══ */}
      {mode === 'read' && (
        <KjvReader
          ref={kjvRef}
          version={readVersion}
          onVersionChange={v => {
            setReadVersion(v)
            try { sessionStorage.setItem('reader-version', v) } catch {}
          }}
          todayChapter={todayBibleChapter}
          onNavChange={(b, c) => { setReadBook(b); setReadChapter(c) }}
          onSearchChange={q => setReadSearch(q)}
        />
      )}

      {/* ══ READING PLAN MODE ══ */}
      {mode === 'plan' && (
        <div style={s.body}>
          <div style={s.progressCard}>
            <ProgressBar done={planDone} total={PLAN_TOTAL} label="Reading plan progress" />
            <p style={s.progressNote}>
              One chapter per devotional day (360 total). Click a day chip to jump to that devotional.
            </p>
          </div>
          <TestamentSection
            testament="OT" categories={OT_CATEGORIES}
            planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
            progress={progress} mode="plan"
            onNavigate={d => navigate(`/day/${d}`)}
            openCats={openCats} setOpenCat={setOpenCat}
          />
          <TestamentSection
            testament="NT" categories={NT_CATEGORIES}
            planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
            progress={progress} mode="plan"
            onNavigate={d => navigate(`/day/${d}`)}
            openCats={openCats} setOpenCat={setOpenCat}
          />
        </div>
      )}

      {/* ══ FULL BIBLE TRACKER ══ */}
      {mode === 'bible' && (
        <div style={s.body}>
          <div style={s.progressCard}>
            <ProgressBar done={bibleDone} total={TOTAL_CHAPTERS} label="Bible chapters read" />
            <p style={s.progressNote}>
              Track your personal Bible reading progress across all {TOTAL_CHAPTERS} chapters.
              <span style={{marginLeft:10}}>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal)'}} />Read</span>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal-light)', border:'1.5px solid rgba(29,107,90,0.35)'}} />In plan</span>
                <span style={s.legend}><span style={{...s.dot, background:'var(--surface)', border:'1.5px solid var(--border)'}} />Unread</span>
              </span>
            </p>
          </div>
          <TestamentSection
            testament="OT" categories={OT_CATEGORIES}
            planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
            progress={progress} mode="bible"
            onToggle={toggleChapter}
            openCats={openCats} setOpenCat={setOpenCat}
          />
          <TestamentSection
            testament="NT" categories={NT_CATEGORIES}
            planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
            progress={progress} mode="bible"
            onToggle={toggleChapter}
            openCats={openCats} setOpenCat={setOpenCat}
          />
        </div>
      )}

      {/* ══ PROOF TEXTS ══ */}
      {mode === 'prooftexts' && (
        <>
          {/* Controls */}
          <div style={s.controls}>
            <div style={s.controlsInner}>
              <div style={s.searchWrap}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{color:'var(--ink-faint)',flexShrink:0,marginRight:6}}>
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  style={s.searchInput}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search passage, book, or confession…"
                />
                {search && (
                  <button onClick={() => setSearch('')} style={s.clearBtn}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)} style={s.select}>
                <option value="">All Scripture</option>
                <option value="OT">Old Testament</option>
                <option value="NT">New Testament</option>
              </select>
              <select value={filterSrc} onChange={e => setFilterSrc(e.target.value)} style={s.select}>
                <option value="">All confessions</option>
                <option value="2LBCF">2LBCF only</option>
                <option value="Catechism">Catechism only</option>
                <option value="1LBCF">1LBCF only</option>
              </select>
            </div>
          </div>

          <div style={{...s.body, paddingTop:'1rem'}}>
            <p style={{fontSize:13, color:'var(--ink-muted)', fontStyle:'italic', marginBottom:'1.5rem', lineHeight:1.7}}>
              Every Scripture proof text cited across the confessions and catechism — in canonical order, linked to the devotional day.
            </p>
            {grouped.length === 0 ? (
              <div style={s.empty}>No passages found.</div>
            ) : (
              grouped.map(({ bookInfo, entries }) => {
                const isOpen = expanded === bookInfo.name || search.trim() !== ''
                const isOT   = OT_BOOKS.has(bookInfo.name)
                return (
                  <div key={bookInfo.name} style={s.ptBookSection}>
                    <button
                      style={s.bookHeading}
                      onClick={() => setExpanded(e => e === bookInfo.name ? null : bookInfo.name)}
                    >
                      <span style={{...s.testBadge, background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)', color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)'}}>
                        {isOT ? 'OT' : 'NT'}
                      </span>
                      <span style={s.bookName}>{bookInfo.name}</span>
                      <span style={{fontSize:11,color:'var(--ink-faint)',marginLeft:4}}>{entries.length} passage{entries.length !== 1 ? 's' : ''}</span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{marginLeft:'auto',transition:'transform 0.2s',transform: isOpen ? 'rotate(90deg)' : 'rotate(0)'}}>
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {isOpen && (
                      <div style={s.entryList}>
                        {entries.map(entry => (
                          <div key={entry.refStr} style={s.entryRow}>
                            <span style={s.refStr}>{entry.refStr}</span>
                            <span style={{fontSize:13,color:'var(--ink-faint)',flexShrink:0,paddingTop:1}}>—</span>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center',flex:1}}>
                              {entry.citations.map((c, i) => {
                                const badge = srcBadge(c.src)
                                return (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span style={{fontSize:12,color:'var(--ink-faint)'}}>,</span>}
                                    <button
                                      style={{...s.citeBtn, background: badge.bg, color: badge.color}}
                                      onClick={() => navigate(`/day/${c.day}`)}
                                    >
                                      {c.label}<span style={{fontSize:10,fontWeight:400,opacity:0.7,marginLeft:2}}> · Day {c.day}</span>
                                    </button>
                                  </React.Fragment>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif" },

  /* header */
  header: { position:'sticky', top:0, zIndex:20, background:'var(--surface)', borderBottom:'1px solid var(--border)', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' },
  headerInner: { maxWidth:'100%', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 },
  menuBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:36, height:36, borderRadius:'var(--radius)', border:'1px solid var(--border)',
    background:'var(--surface)', cursor:'pointer', flexShrink:0,
    color:'var(--ink-muted)', transition:'background 0.15s',
  },
  headerMode: { fontSize:14, fontWeight:600, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif" },
  headerBadge: {
    fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
    background:'var(--teal-light)', color:'var(--teal)',
  },

  /* sidebar */
  backdrop: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.35)',
    zIndex:40, backdropFilter:'blur(2px)',
  },
  sidebar: {
    position:'fixed', top:0, left:0, bottom:0, width:'clamp(240px,80vw,300px)',
    background:'var(--surface)', borderRight:'1px solid var(--border)',
    boxShadow:'4px 0 24px rgba(0,0,0,0.12)',
    zIndex:50, display:'flex', flexDirection:'column',
    transition:'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
    overflowY:'auto',
  },
  sidebarHead: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 20px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'var(--surface)', zIndex:5, gap:8,
  },
  sidebarTitle: { fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' },
  sidebarClose: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:6, borderRadius:'var(--radius)', flexShrink:0,
  },
  sidebarBody: { padding:'16px 14px', flex:1 },
  sidebarHint: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:8,
  },
  navList: { display:'flex', flexDirection:'column', gap:4 },
  navBtn: {
    display:'flex', alignItems:'center', gap:8,
    padding:'11px 14px', borderRadius:'var(--radius-lg)',
    border:'1.5px solid transparent', background:'var(--parchment)',
    fontSize:13, fontWeight:500, color:'var(--ink-muted)', cursor:'pointer',
    transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif", width:'100%',
  },
  navBtnActive: {
    borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)', fontWeight:700,
  },
  navBadge: { fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99, transition:'all 0.15s', flexShrink:0 },

  body: { maxWidth:1100, margin:'0 auto', padding:'1.5rem 20px 1.5rem' },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },

  /* progress */
  progressCard: {
    background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'16px 20px', marginBottom:'1rem', display:'flex', flexDirection:'column', gap:10,
  },
  progressNote: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, margin:0, display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 },
  legend: { display:'inline-flex', alignItems:'center', gap:4, marginRight:8, fontSize:11, color:'var(--ink-faint)' },
  dot: { display:'inline-block', width:12, height:12, borderRadius:3, flexShrink:0 },

  /* accordion */
  accordWrap: { marginBottom:8 },
  accordHeader: {
    display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
    padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  accordLabel: { fontSize:14, fontWeight:600, color:'var(--ink)', flex:1, fontFamily:"'Cormorant Garamond',serif" },
  accordBody: { borderLeft:'3px solid var(--border)', marginLeft:8, paddingLeft:12, paddingTop:8, paddingBottom:4 },

  /* book block */
  bookBlock: {
    background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'10px 14px', marginBottom:6,
  },
  bookHead: { display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' },
  bookName: { fontSize:14, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', flex:1 },
  bookProgress: { fontSize:11, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums' },
  testBadge: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },
  planIndicator: { fontSize:10, color:'var(--teal)', background:'var(--teal-light)', padding:'1px 6px', borderRadius:99, fontWeight:600 },

  chGrid: { display:'flex', flexWrap:'wrap', gap:4 },

  /* day links */
  dayLinks: { display:'flex', flexWrap:'wrap', gap:4 },
  dayLink: {
    fontSize:10, color:'var(--teal)', background:'var(--teal-light)',
    border:'1px solid rgba(29,107,90,0.2)', borderRadius:99,
    padding:'3px 9px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    fontWeight:500, transition:'all 0.1s', display:'flex', alignItems:'center',
  },

  /* proof texts */
  controls: { background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'12px 20px' },
  controlsInner: { maxWidth:1100, margin:'0 auto', display:'flex', gap:8, flexWrap:'wrap' },
  searchWrap: {
    flex:1, minWidth:180, display:'flex', alignItems:'center',
    border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--parchment)',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'8px 0', fontFamily:"'DM Sans',sans-serif",
  },
  clearBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:4 },
  select: {
    padding:'8px 12px', fontSize:13, border:'1px solid var(--border-strong)',
    borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--ink)', cursor:'pointer',
  },

  ptBookSection: { marginBottom:4 },
  bookHeading: {
    display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
    padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', marginBottom:2, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
  },
  entryList: {
    border:'1px solid var(--border)', borderTop:'none', background:'var(--surface)',
    borderRadius:'0 0 var(--radius) var(--radius)', marginBottom:8,
  },
  entryRow: {
    display:'flex', alignItems:'flex-start', gap:10, padding:'8px 14px',
    borderBottom:'1px solid var(--border)', flexWrap:'wrap',
  },
  refStr: {
    fontSize:13, fontWeight:600, color:'var(--ink)',
    fontVariantNumeric:'tabular-nums', minWidth:90, flexShrink:0,
  },
  citeBtn: {
    display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:600,
    padding:'2px 8px', borderRadius:99, border:'none', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'opacity 0.1s', whiteSpace:'nowrap',
  },

  /* ── Category-box layout ── */
  testamentSection: { marginBottom:'1.5rem' },
  testamentHeader: {
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 0 8px', marginBottom:10,
    borderBottom:'2px solid var(--border)',
  },
  testamentLabel: {
    fontSize:15, fontWeight:600, fontFamily:"'Cormorant Garamond',serif",
    color:'var(--ink)', flex:1,
  },
  catGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',
    gap:10,
  },
  catBox: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', overflow:'hidden',
    transition:'border-color 0.15s',
  },
  catHeader: {
    display:'flex', alignItems:'center', gap:10,
    padding:'12px 14px', width:'100%', textAlign:'left',
    border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.15s',
  },
  catLabel: {
    fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
    letterSpacing:'0.01em',
  },
  catBody: {
    borderTop:'1px solid var(--border)',
    padding:'10px 12px', display:'flex', flexDirection:'column', gap:10,
  },
  catBookRow: {},
  catBookHead: {
    display:'flex', alignItems:'center', gap:8, marginBottom:6,
  },
  catBookName: {
    fontSize:13, fontFamily:"'Cormorant Garamond',serif", fontWeight:600,
    color:'var(--ink)', flex:1,
  },
  catBookProgress: { fontSize:11, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums' },

  /* ── Read mode header controls ── */
  readBookPill: {
    display:'flex', alignItems:'center', gap:6, flexShrink:0,
    padding:'5px 10px', borderRadius:'var(--radius-lg)',
    border:'1.5px solid var(--border)', background:'var(--parchment)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'border-color 0.15s',
  },
  readBookName: {
    fontSize:13, fontWeight:700,
    fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
    whiteSpace:'nowrap', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis',
  },
  readBookCh: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', borderRadius:99,
    padding:'1px 7px', flexShrink:0,
  },
  readSearchWrap: {
    flex:1, display:'flex', alignItems:'center', gap:6,
    border:'1.5px solid var(--border)', borderRadius:'var(--radius)',
    padding:'0 8px', background:'var(--parchment)',
    minWidth:0,
  },
  readSearchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:12, color:'var(--ink)', padding:'6px 0',
    fontFamily:"'DM Sans',sans-serif", minWidth:0,
  },
}
