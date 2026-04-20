import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, buildSchedule, getLocalProgress, setLocalProgress } from '../lib/supabase'
import { useAuth } from '../App'
import { LBCF2 } from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 } from '../data/lbcf1'
import { QUOTES } from '../data/quotes'

const SCHEDULE = buildSchedule()

function badgeClass(src) {
  if (src === '2LBCF')    return 'badge badge-2lbcf'
  if (src === 'Catechism') return 'badge badge-cat'
  if (src === '1LBCF')    return 'badge badge-1lbcf'
  return 'badge badge-review'
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <polyline points="2,6.5 5.5,10 11,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function getContent(entry) {
  if (!entry) return null
  if (entry.src === '2LBCF') {
    const m = entry.reading.match(/Ch\.\s*(\d+)\s*§(\d+)/)
    if (!m) return null
    const key = `${m[1]}.${m[2]}`
    const item = LBCF2[key]
    if (!item) return null
    return { type: '2lbcf', text: item.text, refs: item.refs, quoteKey: key }
  }
  if (entry.src === 'Catechism') {
    const m = entry.reading.match(/Q&A\s*#(\d+)/)
    if (!m) return null
    const item = CATECHISM[parseInt(m[1])]
    if (!item) return null
    return { type: 'catechism', q: item.q, a: item.a, refs: item.refs }
  }
  if (entry.src === '1LBCF') {
    const m = entry.reading.match(/Article\s*(\d+)/)
    if (!m) return null
    const item = LBCF1[parseInt(m[1])]
    if (!item) return null
    return { type: '1lbcf', title: item.title, text: item.text, refs: item.refs }
  }
  return null
}

function BodyText({ text }) {
  const lines = text.split('\\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    return <p style={s.bodyText}>{text}</p>
  }
  return (
    <div style={s.bodyText}>
      {lines.map((line, i) => <p key={i} style={{ marginBottom: i < lines.length - 1 ? '0.6em' : 0 }}>{line}</p>)}
    </div>
  )
}

function QuoteBlock({ quoteKey }) {
  const q = QUOTES[quoteKey]
  if (!q) return null
  return (
    <div style={s.quoteCard}>
      <div style={s.quoteHeading}>{q.heading}</div>
      <div style={s.quoteMark}>&ldquo;</div>
      <blockquote style={s.quoteText}>{q.quote}</blockquote>
      <div style={s.quoteAttrib}>
        — {q.author}<span style={s.quoteWork}>, {q.work}</span>
      </div>
    </div>
  )
}

function ContentBlock({ content }) {
  if (!content) return null
  return (
    <div className="card" style={s.contentCard}>
      <div style={s.contentHeader}>
        <span style={s.contentLabel}>
          {content.type === 'catechism' ? "Today's Reading" : 'Confession Text'}
        </span>
      </div>

      {content.type === 'catechism' && (
        <div style={s.catWrap}>
          <p style={s.catQ}><em>Q.</em> {content.q}</p>
          <p style={s.catA}><em>A.</em> {content.a}</p>
        </div>
      )}

      {(content.type === '2lbcf' || content.type === '1lbcf') && (
        <BodyText text={content.text} />
      )}

      {content.refs && (
        <div style={s.refsBlock}>
          <div style={s.refsLabel}>Scripture Proofs</div>
          <p style={s.refsText}>{content.refs}</p>
        </div>
      )}

      {content.type === '2lbcf' && content.quoteKey && (
        <QuoteBlock quoteKey={content.quoteKey} />
      )}
    </div>
  )
}

export default function ReadingPage() {
  const { dayNum } = useParams()
  const day = parseInt(dayNum)
  const navigate = useNavigate()
  const { session } = useAuth()

  const entry = SCHEDULE.find(r => r.day === day)
  const prev  = SCHEDULE.find(r => r.day === day - 1)
  const next  = SCHEDULE.find(r => r.day === day + 1)
  const content = getContent(entry)

  const [completed, setCompleted] = useState(false)
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!entry) return
    if (session) {
      async function load() {
        setLoading(true)
        const { data } = await supabase
          .from('progress')
          .select('completed, notes')
          .eq('user_id', session.user.id)
          .eq('day_number', day)
          .single()
        if (data) {
          setCompleted(!!data.completed)
          setNotes(data.notes || '')
          setSavedNotes(data.notes || '')
        } else {
          setCompleted(false); setNotes(''); setSavedNotes('')
        }
        setLoading(false)
      }
      load()
    } else {
      const local = getLocalProgress()
      const d = local[day] || {}
      setCompleted(!!d.completed)
      setNotes(d.notes || '')
      setSavedNotes(d.notes || '')
      setLoading(false)
    }
  }, [day, session])

  async function toggleComplete() {
    const newVal = !completed
    setCompleted(newVal)
    if (session) {
      await supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: day,
        completed: newVal,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' })
    } else {
      setLocalProgress(day, { completed: newVal, notes })
    }
  }

  async function saveNotes() {
    setSaving(true)
    if (session) {
      await supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: day,
        completed,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' })
    } else {
      setLocalProgress(day, { completed, notes })
    }
    setSavedNotes(notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!entry) {
    return <div style={{padding:'3rem',textAlign:'center'}}>Day not found. <button onClick={()=>navigate('/')} className="btn btn-ghost">Go home</button></div>
  }

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
        <div className="spinner" />
      </div>
    )
  }

  const hasUnsaved = notes !== savedNotes

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <button onClick={()=>navigate('/')} className="btn btn-ghost" style={{gap:4}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            All days
          </button>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:13,color:'var(--ink-faint)'}}>Day {day} of 365</span>
            {!session && (
              <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{fontSize:12, padding:'5px 12px'}}>Sign in</button>
            )}
          </div>
        </div>
      </header>

      <main style={s.main} className="fade-in">
        {/* Day header */}
        <div style={s.dayHeader}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span className={badgeClass(entry.src)}>{entry.src}</span>
            <span style={{fontSize:13,color:'var(--ink-faint)'}}>Day {day} · {entry.date}</span>
          </div>
          <h2 style={s.readingTitle}>{entry.reading}</h2>
          <p style={s.readingDetail}>{entry.detail}</p>

          {entry.link && (
            <a href={entry.link} target="_blank" rel="noopener noreferrer" style={s.readLink}>
              Read online
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:4}}>
                <path d="M3 9L9 3M9 3H5M9 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
          )}
        </div>

        {/* Inline confession / catechism text */}
        <ContentBlock content={content} />

        {/* Complete toggle */}
        <div className="card" style={s.completeCard} onClick={toggleComplete}>
          <div style={{...s.cb, ...(completed ? s.cbDone : {})}}>
            {completed && <CheckIcon />}
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--ink)'}}>
              {completed ? 'Completed' : 'Mark as complete'}
            </div>
            <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:1}}>
              {completed ? 'Click to undo' : 'Click when you have finished this reading'}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={s.notesCard}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <h3 style={{fontSize:15,fontFamily:"'Cormorant Garamond',serif",fontWeight:600}}>
              My notes &amp; reflections
            </h3>
            {hasUnsaved && (
              <span style={{fontSize:11,color:'var(--ink-faint)'}}>Unsaved changes</span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What stood out to you? What questions arose? How does this apply to your life?"
            style={{...s.textarea}}
            rows={6}
          />
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:10,gap:8,alignItems:'center'}}>
            {saved && <span style={{fontSize:12,color:'var(--teal)'}}>Saved ✓</span>}
            <button
              className="btn btn-primary"
              onClick={saveNotes}
              disabled={saving || !hasUnsaved}
              style={{opacity: (!hasUnsaved && !saving) ? 0.5 : 1}}
            >
              {saving ? <span className="spinner" style={{width:14,height:14}} /> : 'Save notes'}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div style={s.nav}>
          <div>
            {prev && (
              <button onClick={()=>navigate(`/day/${prev.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-start',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>← Previous</span>
                <span style={{fontSize:13}}>Day {prev.day} · {prev.reading}</span>
              </button>
            )}
          </div>
          <div>
            {next && (
              <button onClick={()=>navigate(`/day/${next.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-end',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>Next →</span>
                <span style={{fontSize:13}}>Day {next.day} · {next.reading}</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)' },
  header: { borderBottom:'1px solid var(--border)', background:'white', position:'sticky', top:0, zIndex:10 },
  headerInner: { maxWidth:680, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  main: { maxWidth:680, margin:'0 auto', padding:'2.5rem 24px', display:'flex', flexDirection:'column', gap:20 },
  dayHeader: { paddingBottom:4 },
  readingTitle: { fontSize:32, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', marginBottom:6 },
  readingDetail: { fontSize:15, color:'var(--ink-muted)', lineHeight:1.6 },
  readLink: {
    display:'inline-flex', alignItems:'center', marginTop:12,
    fontSize:13, color:'var(--teal)', fontWeight:500,
    border:'1px solid var(--teal)', borderRadius:'var(--radius)',
    padding:'5px 12px', textDecoration:'none',
  },
  contentCard: { padding:'24px' },
  contentHeader: { marginBottom:16 },
  contentLabel: {
    fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)',
  },
  bodyText: {
    fontSize:16, lineHeight:1.85, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", fontWeight:400,
    margin: 0,
  },
  catWrap: { display:'flex', flexDirection:'column', gap:14 },
  catQ: {
    fontSize:16, lineHeight:1.8, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", margin:0,
  },
  catA: {
    fontSize:16, lineHeight:1.8, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", margin:0,
  },
  refsBlock: {
    marginTop:20, paddingTop:16,
    borderTop:'1px solid var(--border)',
  },
  refsLabel: {
    fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:6,
  },
  refsText: {
    fontSize:13, color:'var(--ink-muted)', lineHeight:1.7, margin:0,
  },
  quoteCard: {
    marginTop:20, paddingTop:20,
    borderTop:'1px solid var(--border)',
  },
  quoteHeading: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--gold)', marginBottom:10,
  },
  quoteMark: {
    fontSize:52, lineHeight:1, color:'var(--gold)', opacity:0.4,
    fontFamily:"'Cormorant Garamond',serif", marginBottom:-8, display:'block',
  },
  quoteText: {
    fontSize:15, lineHeight:1.85, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
    margin:'0 0 12px 0', paddingLeft:4,
  },
  quoteAttrib: {
    fontSize:12, color:'var(--ink-muted)', fontWeight:500,
  },
  quoteWork: {
    fontStyle:'italic', fontWeight:400,
  },
  completeCard: {
    display:'flex', alignItems:'center', gap:14, padding:'16px 20px', cursor:'pointer',
    transition:'background 0.15s',
  },
  cb: {
    width:24, height:24, borderRadius:6, border:'1.5px solid var(--border-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.2s', background:'white',
  },
  cbDone: { background:'var(--teal)', borderColor:'var(--teal)' },
  notesCard: { padding:'20px' },
  textarea: { resize:'vertical', minHeight:120, lineHeight:1.7 },
  nav: { display:'flex', justifyContent:'space-between', gap:12, marginTop:8 },
}
