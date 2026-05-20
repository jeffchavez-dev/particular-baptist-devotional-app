import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, buildSchedule, getLocalProgress, setLocalProgress, getTodayDayNum, getBookmarks, toggleBookmark } from '../lib/supabase'
import { useAuth, usePrefs } from '../App'
import { getFontCss } from '../components/FontPrefsPanel'
import { saveScroll, restoreScroll } from '../lib/pageState'
import { getMemorizeVerse, getMemorizeNote, clearMemorizeVerse, clearMemorizeNote } from '../lib/memorize'
import ShareCardModal from '../components/ShareCardModal'

/* ── Progress sessionStorage cache ─────────────────────────────────── */
const DASH_CACHE_KEY = 'pb-dash-progress'
function saveDashProgress(map) {
  try { sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify(map)) } catch {}
}
function loadDashProgress() {
  try {
    const raw = sessionStorage.getItem(DASH_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
import { QUOTES } from '../data/quotes'
import { LBCF2 } from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 } from '../data/lbcf1'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import { getOrthodoxForDay } from '../lib/supabase'

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
  if (src === 'Orthodox')   return 'badge badge-orthodox'
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
  { label:'Orthodox', name:'An Orthodox Catechism',             year:'1680',
    internalHref:'/confessions?t=orthodox',
    href:'https://1689.com/an-orthodox-catechism/', color:'#0c4a6e', bg:'rgba(12,74,110,0.12)' },
]

/* ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { session }  = useAuth()
  const { prefs }    = usePrefs()
  const navigate     = useNavigate()

  /* Seed from sessionStorage (fast) or fall back to localStorage (persistent) — never blank */
  const _cached = loadDashProgress() ?? (() => {
    const local = getLocalProgress()
    const map = {}
    Object.entries(local).forEach(([d, v]) => { map[parseInt(d)] = !!v.completed })
    return Object.keys(map).length ? map : null
  })()
  const [progress, setProgress] = useState(_cached || {})
  const [loading,  setLoading]  = useState(false)  // no spinner — content renders from cache
  const [search,       setSearch]       = useState('')
  const [filterSrc,    setFilterSrc]    = useState('')
  const [filterStatus, setFilterStatus] = useState(() => {
    try { return localStorage.getItem('pb-show-completed') === '1' ? '' : 'todo' } catch { return 'todo' }
  })
  const [page,         setPage]         = useState(() => Math.ceil(TODAY_DAY / PAGE))
  const [toggling,     setToggling]     = useState(new Set())
  const [bookmarks,    setBookmarks]    = useState(() => getBookmarks())
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const [todaySeeMore, setTodaySeeMore] = useState(false)

  /* ── Memory slots ── */
  const [memorizeVerse, setMemorizeVerseState] = useState(() => getMemorizeVerse())
  const [memorizeNote,  setMemorizeNoteState]  = useState(() => getMemorizeNote())
  const [shareMemVerse, setShareMemVerse] = useState(false)   // open ShareCardModal for verse
  const [shareMemNote,  setShareMemNote]  = useState(false)   // open ShareCardModal for note

  // Keep in sync when other pages write to the slots
  useEffect(() => {
    function sync() {
      setMemorizeVerseState(getMemorizeVerse())
      setMemorizeNoteState(getMemorizeNote())
    }
    window.addEventListener('pb-memorize-changed', sync)
    return () => window.removeEventListener('pb-memorize-changed', sync)
  }, [])

  /* search: user's notes + quote data */
  const [userNotes,    setUserNotes]    = useState([])         // [{day_number, notes}] from progress table
  const [dbQuotes,     setDbQuotes]     = useState([])         // [{quote_key, quote, author, heading}]

  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0]
    || session?.user?.email?.split('@')[0]
    || 'friend'

  /* ── track mobile resize ── */
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* ── Save scroll on unmount, restore on mount ── */
  useEffect(() => {
    restoreScroll('dashboard')
    return () => saveScroll('dashboard')
  }, [])

  /* ── Keep sessionStorage cache in sync with progress state ── */
  useEffect(() => {
    saveDashProgress(progress)
  }, [progress])

  /* ── Background sync: render cached progress immediately, update from Supabase quietly ── */
  useEffect(() => {
    if (session) {
      supabase.from('progress').select('day_number, completed, notes').eq('user_id', session.user.id)
        .then(({ data }) => {
          if (!data) return
          const map = {}
          const notes = []
          data.forEach(r => {
            map[r.day_number] = r.completed
            if (r.notes && r.notes.trim()) notes.push({ day_number: r.day_number, notes: r.notes })
          })
          setProgress(map)
          setUserNotes(notes)
          // Mirror back to localStorage so offline / next cold-start reads are current
          const lp = {}
          data.forEach(r => { if (r.completed || r.notes) lp[r.day_number] = { completed: r.completed, notes: r.notes || '' } })
          try { localStorage.setItem('devotional_guest_progress', JSON.stringify(lp)) } catch {}
        })
        .catch(() => {}) // silently stay offline-friendly
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
    }
  }, [session])

  /* ── load quote overrides for search ── */
  useEffect(() => {
    supabase.from('quotes').select('quote_key, heading, quote, author, work')
      .then(({ data }) => { if (data) setDbQuotes(data) })
      .catch(() => {})
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

  /* ── refresh bookmarks on focus (picks up changes from ReadingPage) ── */
  useEffect(() => {
    const handler = () => setBookmarks(getBookmarks())
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

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

  return (
    <>
    <div style={s.page}>

      <main style={s.main}>

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
                {prefs.includeOrthodox && (() => {
                  const qNum = getOrthodoxForDay(TODAY_DAY)
                  const item = ORTHODOX_CATECHISM[qNum]
                  return item ? (
                    <div style={{...s.todayReading, marginTop:4}}>
                      <span className="badge badge-orthodox">Orthodox</span>
                      <span style={{...s.todayReadingText, fontSize:13}}>Q&A #{qNum}</span>
                    </div>
                  ) : null
                })()}
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

        {/* ── Memory section ── */}
        {(memorizeVerse || memorizeNote) && (
          <div style={s.memorizeSection}>
            <div style={s.memorizeHeader}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
                <path d="M8 2C5.24 2 3 4.24 3 7c0 1.85 1.01 3.47 2.5 4.34V13h5v-1.66A5 5 0 0013 7c0-2.76-2.24-5-5-5z"
                  stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(0,139,139,0.1)"/>
                <path d="M5.5 13h5M6.5 15h3" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span style={s.memorizeHeaderText}>Memory</span>
            </div>

            {memorizeVerse && (
              <div style={s.memorizeCard}>
                <div style={s.memorizeCardTop}>
                  <span style={s.memorizeTypeBadge}>✦ Scripture</span>
                  <span style={s.memorizeRef}>{memorizeVerse.ref}</span>
                  <span style={s.memorizeVersion}>{memorizeVerse.version}</span>
                  <button
                    style={s.memorizeShareBtn}
                    onClick={() => setShareMemVerse(true)}
                    title="Share this verse"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="3" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M4.4 5.8l4.2-2.8M4.4 7.2l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    style={s.memorizeClearBtn}
                    onClick={() => { clearMemorizeVerse(); setMemorizeVerseState(null) }}
                    title="Remove from memory"
                  >×</button>
                </div>
                <p style={{ ...s.memorizeText, fontFamily: getFontCss(prefs.fontId), fontSize: prefs.sizePx }}>
                  {memorizeVerse.text}
                </p>
              </div>
            )}

            {memorizeNote && (
              <div style={{ ...s.memorizeCard, borderLeftColor: memorizeNote.type === 'quote' ? '#d4a84c' : 'var(--teal)' }}>
                <div style={s.memorizeCardTop}>
                  <span style={{ ...s.memorizeTypeBadge, color: memorizeNote.type === 'quote' ? '#b8860b' : 'var(--teal)',
                    background: memorizeNote.type === 'quote' ? 'rgba(212,168,76,0.1)' : 'rgba(0,139,139,0.08)' }}>
                    {memorizeNote.type === 'quote' ? '❝ Quote' : '✍ Note'}
                  </span>
                  <span style={s.memorizeRef}>{memorizeNote.bookTitle}</span>
                  {memorizeNote.bookAuthor && <span style={s.memorizeVersion}>{memorizeNote.bookAuthor}</span>}
                  <button
                    style={s.memorizeShareBtn}
                    onClick={() => setShareMemNote(true)}
                    title="Share this note"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="3" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M4.4 5.8l4.2-2.8M4.4 7.2l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    style={s.memorizeClearBtn}
                    onClick={() => { clearMemorizeNote(); setMemorizeNoteState(null) }}
                    title="Remove from memory"
                  >×</button>
                </div>
                <p style={{ ...s.memorizeText, fontStyle: memorizeNote.type === 'quote' ? 'italic' : 'normal',
                  fontFamily: getFontCss(prefs.fontId), fontSize: prefs.sizePx }}>
                  {memorizeNote.type === 'quote' && <span style={{ color:'var(--ink-faint)', marginRight:2 }}>"</span>}
                  {memorizeNote.text}
                  {memorizeNote.type === 'quote' && <span style={{ color:'var(--ink-faint)', marginLeft:2 }}>"</span>}
                </p>
                {(memorizeNote.page || memorizeNote.percent != null) && (
                  <p style={s.memorizeLocation}>
                    {memorizeNote.page ? `p. ${memorizeNote.page}` : `${memorizeNote.percent}%`}
                  </p>
                )}
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

        {/* Filters */}
        <div style={s.controls}>
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
                  {prefs.includeOrthodox && (
                    <div style={{...s.rowReading, marginTop:2}}>
                      <span className="badge badge-orthodox">Orthodox</span>
                      <span style={{fontSize:11, color:'var(--ink-faint)'}}>Q&A #{getOrthodoxForDay(r.day)}</span>
                    </div>
                  )}
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

    </div>

    {/* ── Share memorized verse ── */}
    {shareMemVerse && memorizeVerse && (
      <ShareCardModal
        isOpen
        onClose={() => setShareMemVerse(false)}
        card={{
          type: 'reading',
          title: memorizeVerse.ref,
          subtitle: memorizeVerse.version,
          source: memorizeVerse.version,
          text: memorizeVerse.text,
          label: '',
        }}
      />
    )}

    {/* ── Share memorized note ── */}
    {shareMemNote && memorizeNote && (
      <ShareCardModal
        isOpen={shareMemNote && !!memorizeNote}
        onClose={() => setShareMemNote(false)}
        card={{
          type:       memorizeNote.type === 'quote' ? 'book_quote' : 'book_note',
          noteType:   memorizeNote.type,
          text:       memorizeNote.text,
          bookTitle:  memorizeNote.bookTitle,
          bookAuthor: memorizeNote.bookAuthor,
          bookLabels: null,
          page:       memorizeNote.page,
          percent:    memorizeNote.percent,
        }}
      />
    )}
    </>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", paddingTop:'env(safe-area-inset-top)' },

  /* header */
  header: { borderBottom:'1px solid var(--border)', background:'var(--surface)', position:'sticky', top:0, zIndex:30 },
  headerInner: { maxWidth:900, margin:'0 auto', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  siteTitle: { fontSize:20, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  siteGreeting: { fontSize:12, color:'var(--ink-faint)', marginTop:1 },

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

  /* memory */
  memorizeSection: {
    marginBottom:'1.25rem',
  },
  memorizeHeader: {
    display:'flex', alignItems:'center', gap:6,
    marginBottom:8,
  },
  memorizeHeaderText: {
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.09em', color:'var(--teal)',
  },
  memorizeCard: {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderLeft:'3px solid var(--teal)',
    borderRadius:'var(--radius)', padding:'12px 14px',
    marginBottom:8,
  },
  memorizeCardTop: {
    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:6,
  },
  memorizeTypeBadge: {
    fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99,
    background:'rgba(0,139,139,0.08)', color:'var(--teal)',
    textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0,
  },
  memorizeRef: {
    fontSize:12, fontWeight:600, color:'var(--ink)', flexShrink:0,
  },
  memorizeVersion: {
    fontSize:11, color:'var(--ink-faint)', flexShrink:0,
  },
  memorizeShareBtn: {
    marginLeft:'auto', background:'none', border:'1px solid var(--border)', cursor:'pointer',
    color:'var(--ink-muted)', padding:'3px 6px', borderRadius:6, lineHeight:1,
    display:'flex', alignItems:'center', flexShrink:0,
  },
  memorizeClearBtn: {
    background:'none', border:'none', cursor:'pointer',
    fontSize:16, color:'var(--ink-faint)', padding:'0 2px', lineHeight:1, flexShrink:0,
  },
  memorizeText: {
    margin:0, color:'var(--ink)', lineHeight:1.6,
  },
  memorizeLocation: {
    margin:'6px 0 0', fontSize:11, color:'var(--ink-faint)',
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
}
