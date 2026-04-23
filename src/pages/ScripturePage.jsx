import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildSchedule, getBibleProgress, setBibleChapter } from '../lib/supabase'
import { LBCF2 }     from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 }     from '../data/lbcf1'
import { DAY_BIBLE } from '../data/readingPlan'
import { BIBLE_BOOKS, TOTAL_CHAPTERS } from '../lib/bibleBooks'
import { buildScriptureIndex, BOOK_MAP } from '../lib/scriptureParser'

const SCHEDULE = buildSchedule()

/* ── Book name → { order, testament } for quick lookup ── */
const BOOK_META = Object.fromEntries(
  BIBLE_BOOKS.map(b => [b.name, { order: b.order, testament: b.testament, chapters: b.chapters }])
)

/* ── Build plan index: book → sorted chapter numbers (from reading plan) ── */
const PLAN_BY_BOOK = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([dayStr, chStr]) => {
    const day = parseInt(dayStr)
    // Parse "Book Chapter" → book name + chapter number
    const match = chStr.match(/^(.+?)\s+(\d+)$/)
    if (!match) return
    const book = match[1], ch = parseInt(match[2])
    if (!m[book]) m[book] = []
    if (!m[book].includes(ch)) m[book].push(ch)
  })
  Object.keys(m).forEach(b => m[b].sort((a, z) => a - z))
  return m
})()

/* ── Plan chapters sorted by canonical order ── */
const PLAN_BOOKS_ORDERED = Object.keys(PLAN_BY_BOOK)
  .filter(b => BOOK_META[b])
  .sort((a, z) => (BOOK_META[a]?.order ?? 999) - (BOOK_META[z]?.order ?? 999))

const PLAN_TOTAL = Object.values(PLAN_BY_BOOK).reduce((s, chs) => s + chs.length, 0)

/* ── Map chapter string → day numbers ── */
const CHAPTER_TO_DAYS = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([d, ch]) => {
    if (!m[ch]) m[ch] = []
    m[ch].push(parseInt(d))
  })
  return m
})()

/* ── Proof-text helpers (existing) ── */
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

/* ── Small chapter checkbox block ── */
function ChapterBlock({ chId, done, inPlan, onToggle, label }) {
  return (
    <button
      onClick={() => onToggle(chId, !done)}
      title={`${chId}${inPlan ? ' · in reading plan' : ''}${done ? ' · read' : ''}`}
      style={{
        width: 32, height: 32, borderRadius: 6,
        border: `1.5px solid ${done ? 'var(--teal)' : inPlan ? 'rgba(29,107,90,0.35)' : 'var(--border)'}`,
        background: done ? 'var(--teal)' : inPlan ? 'var(--teal-light)' : 'white',
        color: done ? 'white' : inPlan ? 'var(--teal)' : 'var(--ink-faint)',
        fontSize: 10, fontWeight: done ? 700 : inPlan ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans',sans-serif",
        flexShrink: 0,
      }}
    >
      {label ?? chId.split(' ').pop()}
    </button>
  )
}

/* ── Progress bar ── */
function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={pb.wrap}>
      <div style={pb.top}>
        <span style={pb.label}>{label}</span>
        <span style={pb.count}><strong>{done}</strong> / {total} <span style={{fontWeight:400,color:'var(--ink-faint)'}}>({pct}%)</span></span>
      </div>
      <div style={pb.track}>
        <div style={{ ...pb.fill, width: `${pct}%` }} />
      </div>
    </div>
  )
}
const pb = {
  wrap:  { display:'flex', flexDirection:'column', gap:6 },
  top:   { display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 },
  label: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)' },
  count: { fontSize:13, fontWeight:600, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif" },
  track: { height:8, borderRadius:99, background:'var(--border)', overflow:'hidden' },
  fill:  { height:'100%', borderRadius:99, background:'var(--teal)', transition:'width 0.3s' },
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ScripturePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('plan')   // 'plan' | 'bible' | 'prooftexts'
  const [progress, setProgress] = useState(() => getBibleProgress())

  /* Proof-text state */
  const [search,    setSearch]    = useState('')
  const [filterSrc, setFilterSrc] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [expanded,  setExpanded]  = useState(null)

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

  /* Toggle a chapter — updates state + localStorage */
  const toggleChapter = useCallback((chId, done) => {
    setBibleChapter(chId, done)
    setProgress(prev => {
      const next = { ...prev }
      if (done) next[chId] = true
      else delete next[chId]
      return next
    })
  }, [])

  /* Counts */
  const planDone  = useMemo(() => PLAN_BOOKS_ORDERED.reduce((s, b) =>
    s + PLAN_BY_BOOK[b].filter(ch => progress[`${b} ${ch}`]).length, 0), [progress])
  const bibleDone = Object.keys(progress).length

  /* Mode tabs */
  const tabs = [
    { id: 'plan',       label: 'Reading Plan',  hint: `${planDone}/${PLAN_TOTAL}` },
    { id: 'bible',      label: 'Full Bible',    hint: `${bibleDone}/${TOTAL_CHAPTERS}` },
    { id: 'prooftexts', label: 'Proof Texts',   hint: null },
  ]

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <img src="/pb-icon.svg" alt="P.B." style={{width:28,height:28,cursor:'pointer'}} onClick={() => navigate('/')} />
            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{gap:5, fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Dashboard
            </button>
          </div>

          {/* Mode tabs */}
          <div style={s.tabs}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                style={{ ...s.tab, ...(mode === t.id ? s.tabActive : {}) }}
              >
                {t.label}
                {t.hint && (
                  <span style={{
                    ...s.tabBadge,
                    background: mode === t.id ? 'var(--teal)' : 'var(--border)',
                    color: mode === t.id ? 'white' : 'var(--ink-faint)',
                  }}>{t.hint}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ READING PLAN MODE ══ */}
      {mode === 'plan' && (
        <div style={s.body}>
          {/* Progress */}
          <div style={s.progressCard}>
            <ProgressBar done={planDone} total={PLAN_TOTAL} label="Reading plan chapters read" />
            <p style={s.progressNote}>
              One chapter per devotional day (360 total). Chapters auto-check when you mark the devotional day complete — or tap any block to check manually.
              <span style={{marginLeft:10}}>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal)'}} />Read</span>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal-light)', border:'1.5px solid rgba(29,107,90,0.35)'}} />In plan</span>
              </span>
            </p>
          </div>

          {/* Chapters by book */}
          {PLAN_BOOKS_ORDERED.map(bookName => {
            const meta = BOOK_META[bookName]
            const chapters = PLAN_BY_BOOK[bookName]
            const doneChs = chapters.filter(ch => progress[`${bookName} ${ch}`]).length
            const isOT = meta?.testament === 'OT'
            return (
              <div key={bookName} style={s.bookBlock}>
                <div style={s.bookHead}>
                  <span style={{...s.testBadge, background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)', color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)'}}>
                    {isOT ? 'OT' : 'NT'}
                  </span>
                  <span style={s.bookName}>{bookName}</span>
                  <span style={s.bookProgress}>{doneChs}/{chapters.length}</span>
                </div>
                <div style={s.chGrid}>
                  {chapters.map(ch => {
                    const chId = `${bookName} ${ch}`
                    return (
                      <ChapterBlock
                        key={ch}
                        chId={chId}
                        done={!!progress[chId]}
                        inPlan={true}
                        onToggle={toggleChapter}
                        label={ch}
                      />
                    )
                  })}
                </div>
                {/* Day links */}
                <div style={s.dayLinks}>
                  {chapters.map(ch => {
                    const chId = `${bookName} ${ch}`
                    const days = CHAPTER_TO_DAYS[chId] || []
                    return days.map(d => (
                      <button
                        key={`${ch}-${d}`}
                        onClick={() => navigate(`/day/${d}`)}
                        style={s.dayLink}
                        title={`Go to Day ${d}`}
                      >
                        Ch.{ch} · Day {d}
                      </button>
                    ))
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ FULL BIBLE TRACKER ══ */}
      {mode === 'bible' && (
        <div style={s.body}>
          {/* Progress */}
          <div style={s.progressCard}>
            <ProgressBar done={bibleDone} total={TOTAL_CHAPTERS} label="Bible chapters read" />
            <p style={s.progressNote}>
              Track your personal Bible reading progress across all {TOTAL_CHAPTERS} chapters.
              Chapters assigned to the devotional reading plan are highlighted.
              <span style={{marginLeft:10}}>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal)'}} />Read</span>
                <span style={s.legend}><span style={{...s.dot, background:'var(--teal-light)', border:'1.5px solid rgba(29,107,90,0.35)'}} />In plan</span>
                <span style={s.legend}><span style={{...s.dot, background:'white', border:'1.5px solid var(--border)'}} />Unread</span>
              </span>
            </p>
          </div>

          {/* OT / NT sections */}
          {['OT', 'NT'].map(testament => (
            <div key={testament} style={s.testSection}>
              <h2 style={s.testHeading}>
                {testament === 'OT' ? 'Old Testament' : 'New Testament'}
              </h2>
              {BIBLE_BOOKS.filter(b => b.testament === testament).map(book => {
                const doneChs = Array.from({length: book.chapters}, (_, i) => i + 1)
                  .filter(ch => progress[`${book.name} ${ch}`]).length
                const planChs = PLAN_BY_BOOK[book.name] || []
                return (
                  <div key={book.name} style={s.bookBlock}>
                    <div style={s.bookHead}>
                      <span style={s.bookName}>{book.name}</span>
                      <span style={s.bookProgress}>{doneChs}/{book.chapters}</span>
                      {planChs.length > 0 && (
                        <span style={s.planIndicator}>{planChs.length} in plan</span>
                      )}
                    </div>
                    <div style={s.chGrid}>
                      {Array.from({length: book.chapters}, (_, i) => i + 1).map(ch => {
                        const chId = `${book.name} ${ch}`
                        return (
                          <ChapterBlock
                            key={ch}
                            chId={chId}
                            done={!!progress[chId]}
                            inPlan={planChs.includes(ch)}
                            onToggle={toggleChapter}
                            label={ch}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ══ PROOF TEXTS (existing) ══ */}
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
  header: { position:'sticky', top:0, zIndex:20, background:'white', borderBottom:'1px solid var(--border)', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' },
  headerInner: { maxWidth:1100, margin:'0 auto', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' },

  tabs: { display:'flex', gap:4, flexWrap:'wrap' },
  tab: {
    display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
    borderRadius:'var(--radius)', border:'1.5px solid var(--border)',
    background:'var(--parchment)', fontSize:12, fontWeight:600,
    cursor:'pointer', color:'var(--ink-muted)', transition:'all 0.15s',
    fontFamily:"'DM Sans',sans-serif",
  },
  tabActive: { borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)' },
  tabBadge: { fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, transition:'all 0.15s' },

  body: { maxWidth:1100, margin:'0 auto', padding:'1.5rem 20px 5rem' },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },

  /* progress */
  progressCard: {
    background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'16px 20px', marginBottom:'1.5rem', display:'flex', flexDirection:'column', gap:10,
  },
  progressNote: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, margin:0, display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 },
  legend: { display:'inline-flex', alignItems:'center', gap:4, marginRight:8, fontSize:11, color:'var(--ink-faint)' },
  dot: { display:'inline-block', width:12, height:12, borderRadius:3, flexShrink:0 },

  /* book block */
  bookBlock: {
    background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'12px 16px', marginBottom:8,
  },
  bookHead: { display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' },
  bookName: { fontSize:14, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', flex:1 },
  bookProgress: { fontSize:11, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums' },
  testBadge: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },
  planIndicator: { fontSize:10, color:'var(--teal)', background:'var(--teal-light)', padding:'1px 6px', borderRadius:99, fontWeight:600 },

  chGrid: { display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 },

  /* day links */
  dayLinks: { display:'flex', flexWrap:'wrap', gap:4, marginTop:4 },
  dayLink: {
    fontSize:10, color:'var(--teal)', background:'var(--teal-light)',
    border:'1px solid rgba(29,107,90,0.2)', borderRadius:99,
    padding:'2px 8px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    fontWeight:500, transition:'opacity 0.1s',
  },

  /* testament section (Full Bible) */
  testSection: { marginBottom:'2rem' },
  testHeading: {
    fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:'0.75rem', paddingBottom:6,
    borderBottom:'2px solid var(--border)',
  },

  /* proof texts */
  controls: { background:'white', borderBottom:'1px solid var(--border)', padding:'12px 20px' },
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
    borderRadius:'var(--radius)', background:'white', color:'var(--ink)', cursor:'pointer',
  },

  ptBookSection: { marginBottom:4 },
  bookHeading: {
    display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
    padding:'10px 14px', background:'white', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', marginBottom:2, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
  },
  entryList: {
    border:'1px solid var(--border)', borderTop:'none', background:'white',
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
}
