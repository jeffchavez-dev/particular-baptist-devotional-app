import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, buildSchedule, getLocalProgress, setLocalProgress, getTodayDayNum, getBookmarks, toggleBookmark } from '../lib/supabase'
import { useAuth, usePrefs } from '../App'
import { getFontCss } from '../components/FontPrefsPanel'
import { QUOTES } from '../data/quotes'
import { LBCF2 } from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 } from '../data/lbcf1'
import ShareCardModal from '../components/ShareCardModal'

const SCHEDULE  = buildSchedule()
const TODAY_DAY = Math.min(getTodayDayNum(), 365)
const PAGE      = 30

/* ── derive quote key per schedule entry ── */
function getQuoteKey(entry) {
  if (entry.src === '2LBCF') {
    const m = entry.reading.match(/Ch\.\s*(\d+)\s*§(\d+)/)
    return m ? `${m[1]}.${m[2]}` : null
  }
  if (entry.src === '1LBCF') {
    const m = entry.reading.match(/Article\s*(\d+)/)
    return m ? `lbcf1.${parseInt(m[1])}` : null
  }
  return null
}

/* ── precompute static quote search text per day ── */
const STATIC_QUOTE_SEARCH = {}
SCHEDULE.forEach(r => {
  const key = getQuoteKey(r)
  if (key && QUOTES[key]) {
    const q = QUOTES[key]
    STATIC_QUOTE_SEARCH[r.day] = `${q.heading||''} ${q.quote||''} ${q.author||''} ${q.work||''}`.toLowerCase()
  }
})

function highlight(text, q) {
  if (!q || !text) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'))
    if (parts.length === 1) return text
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{background:'var(--gold-light)',color:'var(--ink)',borderRadius:2,padding:'0 1px',opacity:0.8}}>{p}</mark>
        : p
    )
  } catch { return text }
}

function badgeClass(src) {
  if (src === '2LBCF')     return 'badge badge-2lbcf'
  if (src === 'Catechism')  return 'badge badge-cat'
  if (src === '1LBCF')     return 'badge badge-1lbcf'
  return 'badge badge-review'
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="white" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const SOURCES = [
  { label:'2LBCF',     name:'Second London Baptist Confession', year:'1689',
    internalHref:'/confessions?t=2lbcf',
    href:'https://www.the1689confession.com/', color:'var(--purple-ink)', bg:'var(--purple-soft)' },
  { label:'Catechism', name:"Keach's Baptist Catechism",        year:'1693',
    internalHref:'/confessions?t=catechism',
    href:'https://baptistcatechism.org/', color:'var(--teal)', bg:'var(--teal-light)' },
  { label:'1LBCF',    name:'First London Baptist Confession',   year:'1644',
    internalHref:'/confessions?t=1lbcf',
    href:'https://london1644.info/en/fulltext.html', color:'var(--amber-ink)', bg:'var(--amber-soft)' },
]

/* ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { session }  = useAuth()
  const { prefs }    = usePrefs()
  const navigate     = useNavigate()

  const [progress,     setProgress]     = useState({})   // { day_number: completed, _notes_N: text }
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterSrc,    setFilterSrc]    = useState('')
  const [filterStatus, setFilterStatus] = useState(() => {
    try { return localStorage.getItem('pb-show-completed') === '1' ? '' : 'todo' } catch { return 'todo' }
  })
  const [page,         setPage]         = useState(() => Math.ceil(TODAY_DAY / PAGE))
  const [toggling,     setToggling]     = useState(new Set())
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [sidebarTab,   setSidebarTab]   = useState('sources') // 'sources' | 'notes' | 'bookmarks'
  const [bookmarks,    setBookmarks]    = useState(() => getBookmarks())
  const [shareCard,    setShareCard]    = useState(null)
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const [todaySeeMore, setTodaySeeMore] = useState(false)

  /* sidebar: user's own notes + quote search data */
  const [userNotes,    setUserNotes]    = useState([])         // [{day_number, notes}] from progress table
  const [dbQuotes,     setDbQuotes]     = useState([])         // [{quote_key, quote, author, heading}]
  const [notesLoading, setNotesLoading] = useState(false)

  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0]
    || session?.user?.email?.split('@')[0]
    || 'friend'

  /* ── track mobile resize ── */
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* ── load progress (includes user's personal notes) ── */
  useEffect(() => {
    if (session) {
      supabase.from('progress').select('day_number, completed, notes').eq('user_id', session.user.id)
        .then(({ data }) => {
          const map = {}
          const notes = []
          data?.forEach(r => {
            map[r.day_number] = r.completed
            if (r.notes && r.notes.trim()) notes.push({ day_number: r.day_number, notes: r.notes })
          })
          setProgress(map)
          setUserNotes(notes)
          setLoading(false)
        })
    } else {
      const local = getLocalProgress()
      const map = {}
      const notes = []
      Object.entries(local).forEach(([day, d]) => {
        map[parseInt(day)] = !!d.completed
        if (d.notes && d.notes.trim()) notes.push({ day_number: parseInt(day), notes: d.notes })
      })
      setProgress(map)
      setUserNotes(notes)
      setLoading(false)
    }
  }, [session])

  /* ── load quote overrides for search ── */
  useEffect(() => {
    setNotesLoading(true)
    supabase.from('quotes').select('quote_key, heading, quote, author, work')
      .then(({ data }) => {
        if (data) setDbQuotes(data)
        setNotesLoading(false)
      }).catch(() => setNotesLoading(false))
  }, [])

  /* ── build note + quote search index ── */
  const noteIndex  = useMemo(() => {
    const idx = {}
    userNotes.forEach(n => { idx[n.day_number] = n.notes.toLowerCase() })
    return idx
  }, [userNotes])

  const dbQuoteIndex = useMemo(() => {
    const idx = {}
    dbQuotes.forEach(q => {
      const dayEntry = SCHEDULE.find(r => getQuoteKey(r) === q.quote_key)
      if (dayEntry) {
        idx[dayEntry.day] = `${q.heading||''} ${q.quote||''} ${q.author||''} ${q.work||''}`.toLowerCase()
      }
    })
    return idx
  }, [dbQuotes])

  /* ── toggle completion ── */
  const toggleDay = useCallback(async (day) => {
    const newVal = !progress[day]
    setProgress(p => ({ ...p, [day]: newVal }))
    if (session) {
      setToggling(s => new Set(s).add(day))
      await supabase.from('progress').upsert({
        user_id: session.user.id, day_number: day,
        completed: newVal, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' })
      setToggling(s => { const ns = new Set(s); ns.delete(day); return ns })
    } else {
      setLocalProgress(day, { completed: newVal })
    }
  }, [progress, session])

  /* ── stats ── */
  const completedCount = useMemo(() => Object.values(progress).filter(Boolean).length, [progress])
  const pct = Math.round(completedCount / 365 * 100)
  const streak = useMemo(() => {
    let best = 0, cur = 0
    SCHEDULE.forEach(r => { if (progress[r.day]) { cur++; best = Math.max(best, cur) } else cur = 0 })
    return best
  }, [progress])

  /* ── filtered list (includes quotes + notes in search) ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return SCHEDULE.filter(r => {
      if (q) {
        const baseMatch = r.day.toString().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.reading.toLowerCase().includes(q) ||
          r.detail.toLowerCase().includes(q) ||
          r.src.toLowerCase().includes(q)
        const quoteMatch = (STATIC_QUOTE_SEARCH[r.day] || '').includes(q) ||
                           (dbQuoteIndex[r.day] || '').includes(q)
        const noteMatch  = (noteIndex[r.day] || '').includes(q)
        if (!baseMatch && !quoteMatch && !noteMatch) return false
      }
      if (filterSrc    && r.src !== filterSrc) return false
      const done = !!progress[r.day]
      if (filterStatus && ((filterStatus === 'done' && !done) || (filterStatus === 'todo' && done))) return false
      return true
    })
  }, [search, filterSrc, filterStatus, progress, noteIndex, dbQuoteIndex])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageItems  = filtered.slice((page - 1) * PAGE, page * PAGE)

  useEffect(() => { setPage(1) }, [search, filterSrc])
  /* When status filter changes, if showing all days jump to today's page */
  useEffect(() => {
    setPage(filterStatus === 'todo' ? 1 : Math.ceil(TODAY_DAY / PAGE))
  }, [filterStatus])

  /* ── close sidebar on ESC ── */
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── refresh bookmarks when sidebar opens (picks up changes from ReadingPage) ── */
  useEffect(() => {
    if (sidebarOpen) setBookmarks(getBookmarks())
  }, [sidebarOpen])

  /* ── user's own notes sorted by day, with schedule info ── */
  const enrichedNotes = useMemo(() => {
    return userNotes
      .map(n => ({ ...n, entry: SCHEDULE.find(r => r.day === n.day_number) }))
      .filter(n => n.entry)
      .sort((a, b) => a.day_number - b.day_number)
  }, [userNotes])

  /* ── bookmarked entries sorted by day ── */
  const bookmarkedEntries = useMemo(() => {
    return Object.keys(bookmarks)
      .map(d => SCHEDULE.find(r => r.day === parseInt(d)))
      .filter(Boolean)
      .sort((a, b) => a.day - b.day)
  }, [bookmarks])

  function handleRemoveBookmark(day, e) {
    e.stopPropagation()
    toggleBookmark(day)
    setBookmarks(prev => { const next = {...prev}; delete next[day]; return next })
  }

  /* ── today entry ── */
  const todayEntry = SCHEDULE.find(r => r.day === TODAY_DAY)

  /* ── today confession snippet ── */
  const todayConfession = useMemo(() => {
    if (!todayEntry) return null
    if (todayEntry.src === '2LBCF') {
      const m = todayEntry.reading.match(/Ch\.\s*(\d+)\s*§(\d+)/)
      if (!m) return null
      const item = LBCF2[`${m[1]}.${m[2]}`]
      return item ? item.text : null
    }
    if (todayEntry.src === 'Catechism') {
      const m = todayEntry.reading.match(/Q&A\s*#(\d+)/)
      if (!m) return null
      const item = CATECHISM[parseInt(m[1])]
      return item ? `Q. ${item.q}\n\nA. ${item.a}` : null
    }
    if (todayEntry.src === '1LBCF') {
      const m = todayEntry.reading.match(/Article\s*(\d+)/)
      if (!m) return null
      const item = LBCF1[parseInt(m[1])]
      return item ? item.text : null
    }
    return null
  }, [todayEntry])

  async function signOut() { await supabase.auth.signOut() }

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}>
        <div className="spinner" />
        <p style={{color:'var(--ink-muted)',fontSize:14}}>Loading your progress…</p>
      </div>
    )
  }

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <img
              src="/pb-icon.svg" alt="P.B."
              style={{width:36, height:36, flexShrink:0, cursor:'pointer'}}
              onClick={() => navigate('/')}
              title="Home"
            />
            <div>
              <h1 style={{...s.siteTitle, display: isMobile ? 'none' : 'block'}}>Particular Baptist Devotional</h1>
              {session && <p style={s.siteGreeting}>Welcome back, {userName}</p>}
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {session
              ? <button onClick={signOut} className="btn btn-ghost" style={{fontSize:13}}>Sign out</button>
              : <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{fontSize:13}}>Sign in</button>
            }
            {/* Notes / Resources sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="btn btn-ghost"
              style={s.sidebarToggle}
              aria-label="Open resources"
              title="Resources & Notes"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="8" width="9"  height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="13" width="11" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={s.main}>
        {/* Guest banner */}
        {!session && (
          <div style={s.guestBanner}>
            <span>Browsing as guest — progress is saved locally.</span>
            <button onClick={() => navigate('/auth')} style={s.guestBannerLink}>
              Sign in to sync across devices →
            </button>
          </div>
        )}

        {/* Today's Reading */}
        {todayEntry && (
          <div style={s.todayWrap}>
            {/* Header row — always clickable to navigate */}
            <div style={s.todayCard} onClick={() => navigate(`/day/${TODAY_DAY}`)}>
              <div style={s.todayLeft}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                  <span style={s.todayLabel}>Today's Reading</span>
                  <span style={{fontSize:12, color:'var(--ink-faint)'}}>Day {TODAY_DAY} · {todayEntry.date}</span>
                </div>
                <div style={s.todayReading}>
                  <span className={badgeClass(todayEntry.src)}>{todayEntry.src}</span>
                  <span style={s.todayReadingText}>{todayEntry.reading}</span>
                </div>
                <div style={s.todayDetail}>{todayEntry.detail}</div>
              </div>
              <div style={s.todayArrow}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M6 4l5 5-5 5" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* Inline confession preview — only for confession entries */}
            {todayConfession && (
              <div style={s.confessionPreview}>
                <p style={{
                  ...s.confessionText,
                  fontSize: prefs.sizePx,
                  fontFamily: getFontCss(prefs.fontId),
                  WebkitLineClamp: todaySeeMore ? 'unset' : 4,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  overflow: todaySeeMore ? 'visible' : 'hidden',
                }}>
                  {todayConfession}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); setTodaySeeMore(m => !m) }}
                  style={s.seeMoreBtn}
                >
                  {todaySeeMore ? 'See less ↑' : 'See more ↓'}
                </button>
                <button
                  onClick={() => navigate(`/day/${TODAY_DAY}`)}
                  style={s.readFullBtn}
                >
                  Open full reading →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={s.statsGrid}>
          {[
            { label:'Completed',   value: completedCount, color:'var(--teal)' },
            { label:'Remaining',   value: 365 - completedCount, color:'var(--ink)' },
            { label:'Progress',    value: pct + '%', color:'var(--gold)' },
            { label:'Best streak', value: streak, color:'var(--ink)' },
          ].map(st => (
            <div key={st.label} className="card" style={s.statCard}>
              <div style={s.statLabel}>{st.label}</div>
              <div style={{...s.statValue, color: st.color}}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={s.barWrap}>
          <div style={s.bar}>
            <div style={{...s.barFill, width: pct + '%'}} />
          </div>
          <span style={s.barLabel}>{pct}% complete</span>
        </div>

        {/* Search + filters */}
        <div style={s.controls}>
          <div style={s.searchWrap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={s.searchIcon}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              style={s.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search readings, quotes, or notes…"
            />
            {search && (
              <button onClick={() => setSearch('')} style={s.searchClear} aria-label="Clear">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          <select value={filterSrc} onChange={e => setFilterSrc(e.target.value)} style={s.select}>
            <option value="">All sources</option>
            <option value="2LBCF">2LBCF</option>
            <option value="Catechism">Catechism</option>
            <option value="1LBCF">1LBCF</option>
            <option value="Review">Review</option>
          </select>
          <button
            style={{
              ...s.select, cursor:'pointer', background:'white',
              display:'flex', alignItems:'center', gap:6,
              color: filterStatus === '' ? 'var(--teal)' : 'var(--ink-muted)',
              borderColor: filterStatus === '' ? 'var(--teal)' : 'var(--border-strong)',
            }}
            onClick={() => {
              const next = filterStatus === 'todo' ? '' : 'todo'
              setFilterStatus(next)
              try { localStorage.setItem('pb-show-completed', next === '' ? '1' : '0') } catch {}
            }}
            title={filterStatus === 'todo' ? 'Completed days are hidden — click to show' : 'Click to hide completed days'}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              {filterStatus === '' ? (
                <><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><polyline points="3.5,6.5 5.5,8.5 9.5,4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>
              ) : (
                <><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2"/></>
              )}
            </svg>
            {filterStatus === '' ? `Showing completed (${completedCount})` : `Show completed (${completedCount})`}
          </button>
        </div>

        {/* Search hint */}
        {search && (
          <div style={s.searchHint}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for
            <em style={{color:'var(--ink)',marginLeft:4}}>"{search}"</em>
            <span style={{marginLeft:4,color:'var(--ink-faint)'}}>— including quotes &amp; notes</span>
          </div>
        )}

        {/* Day list */}
        <div style={s.listWrap}>
          {pageItems.map(r => {
            const done = !!progress[r.day]
            const busy = toggling.has(r.day)
            const hasNote  = !!noteIndex[r.day]
            const hasQuote = !!(STATIC_QUOTE_SEARCH[r.day] || dbQuoteIndex[r.day])
            const isMarked = !!bookmarks[r.day]
            const isToday  = r.day === TODAY_DAY
            return (
              <div
                key={r.day}
                style={{
                  ...s.row,
                  ...(done ? s.rowDone : {}),
                  ...(isToday ? s.rowToday : {}),
                }}
                onClick={() => navigate(`/day/${r.day}`)}
              >
                <button
                  style={{...s.cb, ...(done ? s.cbDone : {})}}
                  onClick={e => { e.stopPropagation(); toggleDay(r.day) }}
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                  disabled={busy}
                >
                  {done && <CheckIcon />}
                </button>
                <div style={{...s.dayNum, ...(isToday ? {color:'var(--teal)', fontWeight:700} : {})}}>
                  Day {r.day}
                  {isToday && <span style={{fontSize:9, background:'var(--teal)', color:'white', borderRadius:4, padding:'1px 4px', marginLeft:4, verticalAlign:'middle', fontWeight:700, letterSpacing:'0.04em'}}>TODAY</span>}
                </div>
                <div style={s.rowMain}>
                  <div style={s.rowReading}>
                    <span className={badgeClass(r.src)}>{r.src}</span>
                    <span style={done ? {textDecoration:'line-through', opacity:.45} : {}}>{highlight(r.reading, search)}</span>
                  </div>
                  <div style={s.rowDetail}>
                    {highlight(r.detail, search)}
                    {hasNote && (
                      <span style={s.rowPip} title="Has author's note">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1 1.5h7M1 4.5h5M1 7.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </span>
                    )}
                    {hasQuote && (
                      <span style={{...s.rowPip, color:'var(--gold)'}} title="Has quote">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1 2c0-.6.4-1 1-1h1c.6 0 1 .4 1 1v1.5c0 1-.6 1.8-1.5 2.5M5 2c0-.6.4-1 1-1h1c.6 0 1 .4 1 1v1.5c0 1-.6 1.8-1.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
                <div style={s.rowMeta}>
                  {isMarked && (
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" title="Bookmarked" style={{color:'var(--teal)', flexShrink:0}}>
                      <path d="M2.5 2A1.5 1.5 0 014 .5h6A1.5 1.5 0 0111.5 2v11L7 10.5 2.5 13V2z"
                        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
                        fill="currentColor" fillOpacity="0.2"/>
                    </svg>
                  )}
                  <span style={s.rowDate}>{r.date}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{opacity:.3}}>
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            )
          })}
          {pageItems.length === 0 && (
            <div style={{textAlign:'center', padding:'3rem', color:'var(--ink-faint)'}}>
              No days match your search.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div style={s.pag}>
          <button className="btn btn-outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <span style={{fontSize:13,color:'var(--ink-muted)'}}>Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} entries</span>
            {!search && !filterSrc && (
              <button
                onClick={() => {
                  setPage(Math.ceil(TODAY_DAY / PAGE))
                }}
                style={{
                  fontSize:11, color:'var(--teal)', background:'none', border:'none',
                  cursor:'pointer', padding:'0 4px', fontFamily:"'DM Sans',sans-serif",
                  textDecoration:'underline', opacity: page === Math.ceil(TODAY_DAY / PAGE) ? 0.4 : 1,
                }}
                disabled={page === Math.ceil(TODAY_DAY / PAGE)}
              >
                Jump to Day {TODAY_DAY}
              </button>
            )}
          </div>
          <button className="btn btn-outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
        </div>
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerText}>Created by Jeff Chavez with Claude Code</span>
          <span style={s.footerDot}>·</span>
          <a href="https://theologycheck.blog" target="_blank" rel="noopener noreferrer" style={s.footerLink}>
            <img src="https://theologycheckblog.wordpress.com/wp-content/uploads/2022/02/tc-logo.png"
              alt="TheologyCheck" style={{height:18, verticalAlign:'middle', marginRight:5}} />
            theologycheck.blog
          </a>
        </div>
      </footer>

      {/* ── Modals ── */}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />

      {/* ── Sidebar backdrop ── */}
      {sidebarOpen && (
        <div style={s.backdrop} onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* ── Sidebar ── */}
      <aside style={{...s.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)'}}>
        {/* Sidebar header */}
        <div style={s.sidebarHead}>
          <div style={s.sidebarTabs}>
            <button
              style={{...s.sidebarTabBtn, ...(sidebarTab==='sources' ? s.sidebarTabActive : {})}}
              onClick={() => setSidebarTab('sources')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <line x1="4.5" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="4.5" y1="10" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              Sources
            </button>
            <button
              style={{...s.sidebarTabBtn, ...(sidebarTab==='notes' ? s.sidebarTabActive : {})}}
              onClick={() => setSidebarTab('notes')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2.5h10M2 5.5h7M2 8.5h9M2 11.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Notes
              {enrichedNotes.length > 0 && (
                <span style={s.notesBadge}>{enrichedNotes.length}</span>
              )}
            </button>
            <button
              style={{...s.sidebarTabBtn, ...(sidebarTab==='bookmarks' ? s.sidebarTabActive : {})}}
              onClick={() => setSidebarTab('bookmarks')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 2A1.5 1.5 0 014 .5h6A1.5 1.5 0 0111.5 2v11L7 10.5 2.5 13V2z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
                  fill={sidebarTab==='bookmarks' ? 'currentColor' : 'none'}
                  fillOpacity={sidebarTab==='bookmarks' ? 0.15 : 0}
                />
              </svg>
              Saved
              {bookmarkedEntries.length > 0 && (
                <span style={{...s.notesBadge, background:'var(--teal)'}}>{bookmarkedEntries.length}</span>
              )}
            </button>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={s.sidebarClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={s.sidebarBody}>

          {/* ── Sources tab ── */}
          {sidebarTab === 'sources' && (
            <div>
              <p style={s.sidebarDesc}>
                The three primary sources used in this 365-day devotional plan.
              </p>
              <div style={s.sidebarSources}>
                {SOURCES.map(src => (
                  <div key={src.label} style={s.sidebarSourceCard}>
                    <div style={s.sidebarSourceTop}>
                      <span style={{...s.sourceBadge, background:src.bg, color:src.color}}>{src.label}</span>
                      <span style={s.sidebarSourceYear}>{src.year}</span>
                    </div>
                    <div style={s.sidebarSourceName}>{src.name}</div>
                  </div>
                ))}
              </div>

              <div style={s.sidebarDivider} />

              <div style={s.sidebarSection}>
                <div style={s.sidebarSectionTitle}>Tools</div>
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  <button
                    onClick={() => { navigate('/scripture'); setSidebarOpen(false) }}
                    className="btn btn-outline"
                    style={{width:'100%', justifyContent:'center', fontSize:13}}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{marginRight:6}}>
                      <rect x="2" y="1" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    Scripture Proof Text Index →
                  </button>
                  <button
                    onClick={() => { navigate('/quiz'); setSidebarOpen(false) }}
                    className="btn btn-outline"
                    style={{width:'100%', justifyContent:'center', fontSize:13}}
                  >
                    How Particular Baptist Are You? →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes tab ── */}
          {sidebarTab === 'notes' && (
            <div>
              {!session ? (
                <div style={s.emptyNotes}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{opacity:.3, marginBottom:10}}>
                    <path d="M6 4h20v24H6z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 11h10M11 16h7M11 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{fontSize:13, color:'var(--ink-faint)', margin:'0 0 1rem', textAlign:'center'}}>
                    Sign in to sync and view all your notes here.
                  </p>
                  <button
                    onClick={() => { navigate('/auth'); setSidebarOpen(false) }}
                    className="btn btn-primary"
                    style={{fontSize:13}}
                  >
                    Sign in →
                  </button>
                </div>
              ) : enrichedNotes.length === 0 ? (
                <div style={s.emptyNotes}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{opacity:.3, marginBottom:10}}>
                    <path d="M6 4h20v24H6z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 11h10M11 16h7M11 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{fontSize:13, color:'var(--ink-faint)', margin:0, textAlign:'center'}}>
                    You haven't written any notes yet. Open a day's reading to add reflections.
                  </p>
                </div>
              ) : (
                <>
                  <p style={s.sidebarDesc}>
                    {enrichedNotes.length} day{enrichedNotes.length !== 1 ? 's' : ''} with your notes.
                    Click any to return to that reading.
                  </p>
                  <div style={s.notesList}>
                    {enrichedNotes.map(n => (
                      <div key={n.day_number} style={s.noteItemWrap}>
                        <button
                          style={s.noteItem}
                          onClick={() => { navigate(`/day/${n.day_number}`); setSidebarOpen(false) }}
                        >
                          <div style={s.noteItemTop}>
                            <span style={s.noteItemDay}>Day {n.day_number}</span>
                            <span style={s.noteItemDate}>{n.entry.date}</span>
                            <span className={badgeClass(n.entry.src)} style={{fontSize:9}}>{n.entry.src}</span>
                          </div>
                          <div style={s.noteItemReading}>{n.entry.reading}</div>
                          <div style={s.noteItemPreview}>
                            {n.notes.length > 100 ? n.notes.slice(0, 100) + '…' : n.notes}
                          </div>
                        </button>
                        {/* Share / Copy action row */}
                        <div style={s.noteActions}>
                          <button
                            style={s.noteActionBtn}
                            title="Copy note"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(n.notes) } catch {}
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                              <rect x="4" y="1.5" width="7.5" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.2"/>
                              <path d="M1.5 4v7a1.3 1.3 0 001.3 1.3H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                            Copy
                          </button>
                          <button
                            style={{...s.noteActionBtn, color:'var(--purple-ink)'}}
                            title="Create share image"
                            onClick={() => {
                              setShareCard({
                                type: 'note',
                                day: n.day_number,
                                title: n.entry.reading,
                                subtitle: `Day ${n.day_number} · ${n.entry.date}`,
                                source: n.entry.src,
                                text: n.notes,
                                label: 'My Reflection',
                              })
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                              <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                              <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                              <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                              <path d="M4 5.8l5-2.8M4 7.2l5 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                            Share
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* ── Bookmarks tab ── */}
          {sidebarTab === 'bookmarks' && (
            <div>
              {bookmarkedEntries.length === 0 ? (
                <div style={s.emptyNotes}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{opacity:.3, marginBottom:10}}>
                    <path d="M6 4A2 2 0 018 2h16a2 2 0 012 2v26L16 23 6 30V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  <p style={{fontSize:13, color:'var(--ink-faint)', margin:0, textAlign:'center'}}>
                    No bookmarks yet. Open any devotional and tap the
                    bookmark icon beside "My notes &amp; reflections".
                  </p>
                </div>
              ) : (
                <>
                  <p style={s.sidebarDesc}>
                    {bookmarkedEntries.length} saved day{bookmarkedEntries.length !== 1 ? 's' : ''}.
                    Click any to return to that reading.
                  </p>
                  <div style={s.notesList}>
                    {bookmarkedEntries.map(r => (
                      <div key={r.day} style={s.noteItemWrap}>
                        <button
                          style={{...s.noteItem, borderRadius:'var(--radius-lg)'}}
                          onClick={() => { navigate(`/day/${r.day}`); setSidebarOpen(false) }}
                        >
                          <div style={s.noteItemTop}>
                            <span style={s.noteItemDay}>Day {r.day}</span>
                            <span style={s.noteItemDate}>{r.date}</span>
                            <span className={badgeClass(r.src)} style={{fontSize:9}}>{r.src}</span>
                          </div>
                          <div style={s.noteItemReading}>{r.reading}</div>
                          <div style={{...s.noteItemPreview, fontStyle:'normal'}}>{r.detail}</div>
                        </button>
                        <button
                          style={{...s.noteActionBtn, display:'flex', alignItems:'center', gap:4, marginTop:2, color:'var(--ink-faint)', fontSize:11, padding:'2px 4px'}}
                          title="Remove bookmark"
                          onClick={e => handleRemoveBookmark(r.day, e)}
                        >
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 2A1.5 1.5 0 014 .5h6A1.5 1.5 0 0111.5 2v11L7 10.5 2.5 13V2z"
                              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                          </svg>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </aside>
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif" },

  /* header */
  header: { borderBottom:'1px solid var(--border)', background:'var(--surface)', position:'sticky', top:0, zIndex:30 },
  headerInner: { maxWidth:900, margin:'0 auto', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  siteTitle: { fontSize:20, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  siteGreeting: { fontSize:12, color:'var(--ink-faint)', marginTop:1 },
  sidebarToggle: { display:'flex', alignItems:'center', justifyContent:'center', padding:'7px', borderRadius:'var(--radius)' },

  /* main */
  main: { maxWidth:900, margin:'0 auto', padding:'2rem 24px' },

  guestBanner: {
    display:'flex', alignItems:'center', flexWrap:'wrap', gap:8,
    background:'var(--gold-faint)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:'1.25rem',
    fontSize:13, color:'var(--ink-muted)',
  },
  guestBannerLink: { background:'none', border:'none', padding:0, color:'var(--gold)', fontWeight:500, fontSize:13, cursor:'pointer' },

  /* today */
  todayWrap: { marginBottom:'1.25rem', border:'1.5px solid var(--teal)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'0 1px 4px rgba(68,153,136,0.10)' },
  todayCard: {
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
    background:'var(--surface)', padding:'16px 20px', cursor:'pointer',
    transition:'background 0.15s',
  },
  todayLeft: { flex:1, minWidth:0 },
  todayLabel: { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--teal)' },
  todayReading: { display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 },
  todayReadingText: { fontSize:15, fontWeight:500, color:'var(--ink)' },
  todayDetail: { fontSize:12, color:'var(--ink-faint)' },
  todayArrow: { flexShrink:0 },
  confessionPreview: {
    borderTop:'1px solid var(--border)', background:'var(--parchment)',
    padding:'14px 20px 12px',
  },
  confessionText: {
    fontSize:15, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.85,
    color:'var(--ink)', margin:'0 0 10px',
  },
  seeMoreBtn: {
    background:'none', border:'none', cursor:'pointer', fontSize:12,
    color:'var(--teal)', fontWeight:600, padding:0, marginRight:16,
    fontFamily:"'DM Sans',sans-serif",
  },
  readFullBtn: {
    background:'none', border:'none', cursor:'pointer', fontSize:12,
    color:'var(--ink-faint)', padding:0, fontFamily:"'DM Sans',sans-serif",
  },

  /* stats */
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:'1.25rem' },
  statCard: { padding:'14px 16px' },
  statLabel: { fontSize:11, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 },
  statValue: { fontSize:26, fontFamily:"'Cormorant Garamond',serif", fontWeight:600 },

  barWrap: { display:'flex', alignItems:'center', gap:12, marginBottom:'1.5rem' },
  bar: { flex:1, height:5, background:'var(--parchment-dark)', borderRadius:99, overflow:'hidden' },
  barFill: { height:'100%', background:'var(--teal)', borderRadius:99, transition:'width 0.4s ease' },
  barLabel: { fontSize:12, color:'var(--ink-faint)', whiteSpace:'nowrap' },

  /* controls */
  controls: { display:'flex', gap:8, flexWrap:'wrap', marginBottom:'0.5rem' },
  searchWrap: {
    flex:1, minWidth:200, position:'relative', display:'flex', alignItems:'center',
    background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px',
  },
  searchIcon: { color:'var(--ink-faint)', flexShrink:0, marginRight:6 },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:14, color:'var(--ink)', padding:'9px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
  searchClear: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', padding:4, borderRadius:4,
  },
  select: {
    padding:'9px 12px', fontSize:13, border:'1px solid var(--border-strong)',
    borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--ink)',
    cursor:'pointer', minWidth:130,
  },

  searchHint: { fontSize:12, color:'var(--ink-faint)', marginBottom:'0.75rem' },

  /* list */
  listWrap: { display:'flex', flexDirection:'column', gap:0, borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--border)', background:'var(--surface)' },
  row: {
    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
    borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s',
  },
  rowDone:  { background:'var(--parchment-dark)' },
  rowToday: { borderColor:'var(--teal)', boxShadow:'inset 3px 0 0 var(--teal)' },
  cb: {
    width:20, height:20, borderRadius:5, border:'1.5px solid var(--border-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.15s', background:'var(--surface)', cursor:'pointer',
  },
  cbDone: { background:'var(--teal)', borderColor:'var(--teal)' },
  dayNum: { fontSize:11, color:'var(--ink-faint)', fontWeight:500, minWidth:38, flexShrink:0 },
  rowMain: { flex:1, minWidth:0 },
  rowReading: { fontSize:14, color:'var(--ink)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' },
  rowDetail: { fontSize:12, color:'var(--ink-faint)', marginTop:2, display:'flex', alignItems:'center', gap:5 },
  rowPip: { display:'inline-flex', alignItems:'center', color:'var(--teal)', opacity:.7 },
  rowMeta: { display:'flex', alignItems:'center', gap:4, flexShrink:0 },
  rowDate: { fontSize:12, color:'var(--ink-faint)', whiteSpace:'nowrap' },

  /* pagination */
  pag: { display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:'1.5rem', flexWrap:'wrap' },

  /* footer */
  footer: { borderTop:'1px solid var(--border)', background:'var(--surface)', marginTop:'3rem', padding:'20px 24px' },
  footerInner: { maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexWrap:'wrap' },
  footerText: { fontSize:13, color:'var(--ink-faint)' },
  footerDot:  { color:'var(--border-strong)' },
  footerLink: { display:'inline-flex', alignItems:'center', color:'var(--ink-muted)', textDecoration:'none', fontWeight:500, fontSize:13 },

  /* ── Sidebar ── */
  backdrop: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
    zIndex:40, backdropFilter:'blur(2px)',
  },
  sidebar: {
    position:'fixed', top:0, right:0, bottom:0, width:'clamp(300px,90vw,360px)',
    background:'var(--surface)', borderLeft:'1px solid var(--border)',
    boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',
    zIndex:50, display:'flex', flexDirection:'column',
    transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    overflowY:'auto',
  },
  sidebarHead: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 20px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'var(--surface)', zIndex:5,
    gap:8,
  },
  sidebarTabs: { display:'flex', gap:4 },
  sidebarTabBtn: {
    display:'flex', alignItems:'center', gap:6,
    background:'none', border:'none', cursor:'pointer',
    fontSize:13, fontWeight:500, color:'var(--ink-muted)',
    padding:'5px 10px', borderRadius:'var(--radius)',
    transition:'background 0.1s, color 0.1s',
  },
  sidebarTabActive: { background:'var(--parchment)', color:'var(--ink)' },
  sidebarClose: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:6, borderRadius:'var(--radius)', flexShrink:0,
    transition:'background 0.1s',
  },
  sidebarBody: { padding:'20px', flex:1 },
  sidebarDesc: { fontSize:12.5, color:'var(--ink-muted)', lineHeight:1.65, marginBottom:'1rem' },
  sidebarDivider: { height:1, background:'var(--border)', margin:'1.5rem 0' },
  sidebarSection: { marginBottom:4 },
  sidebarSectionTitle: {
    fontSize:11, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.08em', color:'var(--ink-faint)', marginBottom:'0.75rem',
  },

  /* sidebar sources */
  sidebarSources: { display:'flex', flexDirection:'column', gap:8, marginBottom:4 },
  sidebarSourceCard: {
    display:'flex', flexDirection:'column', gap:5, padding:'14px 16px',
    background:'var(--parchment)', borderRadius:'var(--radius-lg)',
    border:'1px solid var(--border)', textDecoration:'none',
    transition:'box-shadow 0.15s',
  },
  sidebarSourceTop: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  sidebarSourceYear: { fontSize:11, color:'var(--ink-faint)' },
  sidebarSourceName: { fontSize:14, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.3 },
  sidebarSourceLink: { fontSize:11, color:'var(--teal)', fontWeight:500, display:'flex', alignItems:'center' },
  sourceBadge: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:'0.04em' },

  /* notes */
  notesBadge: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    background:'var(--teal)', color:'white', fontSize:10, fontWeight:700,
    borderRadius:99, minWidth:16, height:16, padding:'0 4px', lineHeight:1,
  },
  emptyNotes: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem 1rem', textAlign:'center' },
  notesList: { display:'flex', flexDirection:'column', gap:6 },
  noteItemWrap: { display:'flex', flexDirection:'column' },
  noteItem: {
    display:'block', width:'100%', textAlign:'left',
    padding:'12px 14px', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',
    borderBottom:'none',
    cursor:'pointer', transition:'box-shadow 0.15s', fontFamily:"'DM Sans',sans-serif",
  },
  noteItemTop: { display:'flex', alignItems:'center', gap:6, marginBottom:4 },
  noteItemDay:  { fontSize:11, fontWeight:700, color:'var(--ink-faint)' },
  noteItemDate: { fontSize:11, color:'var(--ink-faint)' },
  noteItemReading: { fontSize:13, fontWeight:500, color:'var(--ink)', marginBottom:4, lineHeight:1.3 },
  noteItemPreview: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.55, fontStyle:'italic' },
  noteActions: {
    display:'flex', gap:6, padding:'6px 14px 8px',
    background:'var(--parchment-dark)',
    border:'1px solid var(--border)', borderRadius:'0 0 var(--radius-lg) var(--radius-lg)',
  },
  noteActionBtn: {
    display:'inline-flex', alignItems:'center', gap:4,
    background:'none', border:'none', cursor:'pointer',
    fontSize:11, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
    padding:'2px 6px', borderRadius:4, transition:'color 0.1s',
  },
}
