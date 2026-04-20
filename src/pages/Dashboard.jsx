import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, buildSchedule } from '../lib/supabase'
import { useAuth } from '../App'

const SCHEDULE = buildSchedule()

function badgeClass(src) {
  if (src === '2LBCF')    return 'badge badge-2lbcf'
  if (src === 'Catechism') return 'badge badge-cat'
  if (src === '1LBCF')    return 'badge badge-1lbcf'
  return 'badge badge-review'
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const PAGE = 30

export default function Dashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSrc, setFilterSrc] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [toggling, setToggling] = useState(new Set())

  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'friend'

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('progress')
        .select('day_number, completed')
        .eq('user_id', session.user.id)
      const map = {}
      data?.forEach(r => { map[r.day_number] = r.completed })
      setProgress(map)
      setLoading(false)
    }
    load()
  }, [session])

  const toggleDay = useCallback(async (day) => {
    const newVal = !progress[day]
    setProgress(p => ({ ...p, [day]: newVal }))
    setToggling(s => new Set(s).add(day))
    await supabase.from('progress').upsert({
      user_id: session.user.id,
      day_number: day,
      completed: newVal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_number' })
    setToggling(s => { const ns=new Set(s); ns.delete(day); return ns })
  }, [progress, session])

  const completedCount = useMemo(() => Object.values(progress).filter(Boolean).length, [progress])
  const pct = Math.round(completedCount / 365 * 100)

  const streak = useMemo(() => {
    let best = 0, cur = 0
    SCHEDULE.forEach(r => { if(progress[r.day]){cur++;best=Math.max(best,cur);}else cur=0; })
    return best
  }, [progress])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return SCHEDULE.filter(r => {
      const mQ = !q || r.day.toString().includes(q) || r.date.toLowerCase().includes(q) ||
                 r.reading.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) ||
                 r.src.toLowerCase().includes(q)
      const mS = !filterSrc || r.src === filterSrc
      const done = !!progress[r.day]
      const mSt = !filterStatus || (filterStatus==='done'&&done) || (filterStatus==='todo'&&!done)
      return mQ && mS && mSt
    })
  }, [search, filterSrc, filterStatus, progress])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageItems = filtered.slice((page-1)*PAGE, page*PAGE)

  useEffect(() => { setPage(1) }, [search, filterSrc, filterStatus])

  async function signOut() {
    await supabase.auth.signOut()
  }

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
      <header style={s.header}>
        <div style={s.headerInner}>
          <div>
            <h1 style={s.siteTitle}>365 Devotional</h1>
            <p style={s.siteGreeting}>Welcome back, {userName}</p>
          </div>
          <button onClick={signOut} className="btn btn-ghost" style={{fontSize:13}}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        {/* Stats */}
        <div style={s.statsGrid}>
          {[
            {label:'Completed', value:completedCount, color:'var(--teal)'},
            {label:'Remaining', value:365-completedCount, color:'var(--ink)'},
            {label:'Progress',  value:pct+'%',          color:'var(--gold)'},
            {label:'Best streak', value:streak,          color:'var(--ink)'},
          ].map(st => (
            <div key={st.label} className="card" style={s.statCard}>
              <div style={s.statLabel}>{st.label}</div>
              <div style={{...s.statValue, color:st.color}}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={s.barWrap}>
          <div style={s.bar}>
            <div style={{...s.barFill, width: pct+'%'}} />
          </div>
          <span style={s.barLabel}>{pct}% complete</span>
        </div>

        {/* Controls */}
        <div style={s.controls}>
          <input
            style={{flex:1,minWidth:160}}
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search day, reading, or topic…"
          />
          <select value={filterSrc} onChange={e=>setFilterSrc(e.target.value)} style={{minWidth:140}}>
            <option value="">All sources</option>
            <option value="2LBCF">2LBCF</option>
            <option value="Catechism">Catechism</option>
            <option value="1LBCF">1LBCF</option>
            <option value="Review">Review</option>
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{minWidth:130}}>
            <option value="">All days</option>
            <option value="done">Completed</option>
            <option value="todo">To do</option>
          </select>
        </div>

        {/* List */}
        <div style={s.listWrap}>
          {pageItems.map(r => {
            const done = !!progress[r.day]
            const busy = toggling.has(r.day)
            return (
              <div key={r.day} style={{...s.row, ...(done ? s.rowDone : {})}}
                onClick={() => navigate(`/day/${r.day}`)}>
                <button
                  style={{...s.cb, ...(done ? s.cbDone : {})}}
                  onClick={e => { e.stopPropagation(); toggleDay(r.day) }}
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                  disabled={busy}
                >
                  {done && <CheckIcon />}
                </button>
                <div style={s.dayNum}>Day {r.day}</div>
                <div style={s.rowMain}>
                  <div style={s.rowReading}>
                    <span className={badgeClass(r.src)}>{r.src}</span>
                    <span style={done ? {textDecoration:'line-through', opacity:.5} : {}}>{r.reading}</span>
                  </div>
                  <div style={s.rowDetail}>{r.detail}</div>
                </div>
                <div style={s.rowMeta}>
                  <span style={s.rowDate}>{r.date}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{opacity:.3}}>
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            )
          })}
          {pageItems.length === 0 && (
            <div style={{textAlign:'center',padding:'3rem',color:'var(--ink-faint)'}}>
              No days match your filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div style={s.pag}>
          <button className="btn btn-outline" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Prev</button>
          <span style={{fontSize:13,color:'var(--ink-muted)'}}>Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} entries</span>
          <button className="btn btn-outline" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Next →</button>
        </div>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)' },
  header: { borderBottom:'1px solid var(--border)', background:'white', position:'sticky', top:0, zIndex:10 },
  headerInner: { maxWidth:860, margin:'0 auto', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  siteTitle: { fontSize:20, fontFamily:"'Cormorant Garamond', serif", fontWeight:600, color:'var(--ink)' },
  siteGreeting: { fontSize:12, color:'var(--ink-faint)', marginTop:1 },
  main: { maxWidth:860, margin:'0 auto', padding:'2rem 24px' },
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:'1.25rem' },
  statCard: { padding:'14px 16px' },
  statLabel: { fontSize:11, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 },
  statValue: { fontSize:26, fontFamily:"'Cormorant Garamond',serif", fontWeight:600 },
  barWrap: { display:'flex', alignItems:'center', gap:12, marginBottom:'1.5rem' },
  bar: { flex:1, height:5, background:'var(--parchment-dark)', borderRadius:99, overflow:'hidden' },
  barFill: { height:'100%', background:'var(--teal)', borderRadius:99, transition:'width 0.4s ease' },
  barLabel: { fontSize:12, color:'var(--ink-faint)', whiteSpace:'nowrap' },
  controls: { display:'flex', gap:8, flexWrap:'wrap', marginBottom:'1rem' },
  listWrap: { display:'flex', flexDirection:'column', gap:0, borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--border)', background:'white' },
  row: {
    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
    borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s',
  },
  rowDone: { background:'#fafaf8' },
  cb: {
    width:20, height:20, borderRadius:5, border:'1.5px solid var(--border-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.15s', background:'white',
  },
  cbDone: { background:'var(--teal)', borderColor:'var(--teal)' },
  dayNum: { fontSize:11, color:'var(--ink-faint)', fontWeight:500, minWidth:38, flexShrink:0 },
  rowMain: { flex:1, minWidth:0 },
  rowReading: { fontSize:14, color:'var(--ink)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' },
  rowDetail: { fontSize:12, color:'var(--ink-faint)', marginTop:2 },
  rowMeta: { display:'flex', alignItems:'center', gap:4, flexShrink:0 },
  rowDate: { fontSize:12, color:'var(--ink-faint)', whiteSpace:'nowrap' },
  pag: { display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:'1.5rem', flexWrap:'wrap' },
}
