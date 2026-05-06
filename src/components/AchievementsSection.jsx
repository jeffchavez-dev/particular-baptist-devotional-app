import React, { useState, useEffect, useRef, useMemo } from 'react'
import { getLocalProgress, buildSchedule, getBibleProgress, getOrthodoxForDay, ORTHODOX_Q_COUNT, BIBLE_KEY } from '../lib/supabase'
import { TOTAL_CHAPTERS } from '../lib/bibleBooks'
import { loadPrefs } from '../components/FontPrefsPanel'

const SCHEDULE = buildSchedule()

/* ════════════════════════════════════════════════════════════
   Scripture completion log (localStorage)
   ════════════════════════════════════════════════════════════ */
const COMP_KEY = 'pb-scripture-completions'

function getCompletions() {
  try { return JSON.parse(localStorage.getItem(COMP_KEY) || '[]') } catch { return [] }
}

/** Add a new completion record. endDate defaults to today. */
function addCompletion({ label = null, startDate = null, endDate = null, autoRecorded = false } = {}) {
  const all = getCompletions()
  all.push({
    id: Date.now(),
    label,
    startDate: startDate || null,
    endDate:   endDate   || new Date().toISOString().slice(0, 10),
    autoRecorded,
  })
  try { localStorage.setItem(COMP_KEY, JSON.stringify(all)) } catch {}
  return all
}

function updateCompletion(id, updates) {
  const all = getCompletions().map(c => c.id === id ? { ...c, ...updates } : c)
  try { localStorage.setItem(COMP_KEY, JSON.stringify(all)) } catch {}
  return all
}

function removeCompletion(id) {
  const all = getCompletions().filter(c => c.id !== id)
  try { localStorage.setItem(COMP_KEY, JSON.stringify(all)) } catch {}
  return all
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmtDate(isoStr) {
  if (!isoStr) return ''
  // Add noon to avoid timezone offset flipping the date
  return new Date(isoStr + 'T12:00:00').toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
}

/* ── Confession meta ── */
const CONF_META = {
  '2LBCF':    { label:'2LBCF',    fullName:'2nd London Baptist Confession', color:'var(--purple-ink)', bg:'var(--purple-soft)', border:'rgba(93,63,155,0.25)' },
  'Catechism':{ label:'Catechism',fullName:"Keach's Baptist Catechism",      color:'var(--teal)',       bg:'var(--teal-light)',  border:'rgba(29,107,90,0.25)' },
  '1LBCF':    { label:'1LBCF',    fullName:'1st London Baptist Confession',  color:'var(--amber-ink)', bg:'var(--amber-soft)', border:'rgba(163,107,42,0.25)' },
  'Orthodox': { label:'Orthodox', fullName:'An Orthodox Catechism',          color:'var(--sky)',        bg:'var(--sky-light)',  border:'rgba(14,116,144,0.25)' },
}

/* ── Compute confession stats ── */
function useConfessionStats(supabaseProgress) {
  return useMemo(() => {
    const prefs = loadPrefs()
    const includeOrthodox = !!prefs.includeOrthodox

    const completedDays = new Set()
    if (supabaseProgress) {
      supabaseProgress.forEach(r => { if (r.completed) completedDays.add(r.day_number) })
    } else {
      const local = getLocalProgress()
      Object.entries(local).forEach(([day, d]) => { if (d.completed) completedDays.add(parseInt(day)) })
    }

    const stats = {}

    for (const src of ['2LBCF', 'Catechism', '1LBCF']) {
      const days = SCHEDULE.filter(e => e.src === src)
      const done = days.filter(e => completedDays.has(e.day)).length
      stats[src] = { total: days.length, done, pct: days.length ? Math.round(done / days.length * 100) : 0 }
    }

    if (includeOrthodox) {
      // Map completed days → unique Orthodox Q&A numbers covered
      const covered = new Set()
      completedDays.forEach(day => covered.add(getOrthodoxForDay(day)))
      stats['Orthodox'] = {
        total: ORTHODOX_Q_COUNT,
        done:  covered.size,
        pct:   Math.round(covered.size / ORTHODOX_Q_COUNT * 100),
      }
    }

    const activeKeys = includeOrthodox
      ? ['2LBCF', 'Catechism', '1LBCF', 'Orthodox']
      : ['2LBCF', 'Catechism', '1LBCF']

    const complete = activeKeys.filter(k => {
      const s = stats[k]; return s && s.total > 0 && s.done === s.total
    }).length

    return { stats, activeKeys, complete }
  }, [supabaseProgress])
}

/* ── Confession progress card ── */
function ConfCard({ src, stats }) {
  const meta = CONF_META[src]
  if (!meta || stats.total === 0) return null
  const done = stats.done === stats.total
  return (
    <div style={{
      background: done ? meta.bg : 'var(--surface)',
      border: `1.5px solid ${done ? meta.border : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)', padding:'12px 14px',
      display:'flex', flexDirection:'column', gap:8, transition:'all 0.15s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{
          fontSize:10, fontWeight:700, letterSpacing:'0.06em', color:meta.color,
          background:meta.bg, border:`1px solid ${meta.border}`,
          padding:'2px 8px', borderRadius:99,
        }}>{meta.label}</span>
        <span style={{ fontSize:12, color:'var(--ink-muted)', flex:1 }}>{meta.fullName}</span>
        {done && <span style={{ fontSize:14 }}>✓</span>}
        <span style={{ fontSize:12, fontWeight:700, color:meta.color, fontVariantNumeric:'tabular-nums' }}>
          {stats.done}/{stats.total}
        </span>
      </div>
      <div style={{ height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:meta.color, width:`${stats.pct}%`, transition:'width 0.4s', opacity: done ? 1 : 0.8 }} />
      </div>
    </div>
  )
}

/* ── Edit completion form ── */
function EditCompletionForm({ completion, onSave, onCancel }) {
  const fallbackEnd = completion.endDate || completion.completedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const [label,     setLabel]     = useState(completion.label     || '')
  const [startDate, setStartDate] = useState(completion.startDate || '')
  const [endDate,   setEndDate]   = useState(fallbackEnd)

  return (
    <div style={a.editForm}>
      <div style={a.editRow}>
        <label style={a.editLabel}>Title / Year</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={`e.g. ${new Date().getFullYear() - 1}–${new Date().getFullYear()}`}
          style={a.editInput}
        />
      </div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <div style={a.editRow}>
          <label style={a.editLabel}>Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={a.editInput} />
        </div>
        <div style={a.editRow}>
          <label style={a.editLabel}>End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={a.editInput} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={a.cancelBtn}>Cancel</button>
        <button
          onClick={() => onSave({ label: label.trim() || null, startDate: startDate || null, endDate: endDate || null })}
          style={a.saveBtn}
        >Save</button>
      </div>
    </div>
  )
}

/* ── Completion trophy card ── */
function CompletionCard({ completion, index, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const TROPHIES = ['🏆','🥈','📖','📖','📖','📖','📖','📖','📖','📖']
  const trophy = TROPHIES[index] || '📖'

  const title = completion.label || `${ordinal(index + 1)} Reading of the Bible`

  const endDisplay   = fmtDate(completion.endDate || completion.completedAt?.slice(0, 10))
  const startDisplay = fmtDate(completion.startDate)
  const dateDisplay  = startDisplay ? `${startDisplay} → ${endDisplay}` : endDisplay

  if (editing) {
    return (
      <EditCompletionForm
        completion={completion}
        onSave={updates => { onUpdate(updates); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      background: index === 0 ? 'var(--teal-light)' : index === 1 ? 'var(--amber-soft)' : 'var(--parchment)',
      border: `2px solid ${index === 0 ? 'var(--teal)' : index === 1 ? 'var(--amber-ink)' : 'var(--border)'}`,
      borderRadius:'var(--radius-lg)', padding:'12px 14px',
    }}>
      <span style={{ fontSize:28, flexShrink:0, lineHeight:1 }}>{trophy}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color: index === 0 ? 'var(--teal)' : index === 1 ? 'var(--amber-ink)' : 'var(--ink)' }}>
          {title}
          {completion.autoRecorded && (
            <span style={{ fontSize:9, fontWeight:600, color:'var(--ink-faint)', marginLeft:6,
              background:'var(--border)', borderRadius:99, padding:'1px 5px', letterSpacing:'0.04em' }}>
              AUTO
            </span>
          )}
        </div>
        {dateDisplay && (
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:2 }}>{dateDisplay}</div>
        )}
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer',
            color:'var(--ink-faint)', fontSize:10, fontWeight:600, padding:'3px 8px',
            fontFamily:"'DM Sans',sans-serif" }}
        >Edit</button>
        <button
          onClick={onRemove}
          title="Remove"
          style={{ background:'none', border:'none', cursor:'pointer',
            color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'2px 4px', borderRadius:4 }}
        >×</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════ */
export default function AchievementsSection({ supabaseProgress, hideHeader = false }) {
  const [open,        setOpen]        = useState(false)
  const [completions, setCompletions] = useState(() => getCompletions())

  // Track total bible chapters for auto-completion detection
  const [bibleDone, setBibleDone] = useState(() => Object.keys(getBibleProgress()).length)
  const prevBibleDone = useRef(bibleDone)

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== BIBLE_KEY) return
      const done = Object.keys(getBibleProgress()).length
      // Auto-record when user marks the final chapter
      if (done === TOTAL_CHAPTERS && prevBibleDone.current < TOTAL_CHAPTERS) {
        setCompletions(addCompletion({ autoRecorded: true }))
      }
      prevBibleDone.current = done
      setBibleDone(done)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const { stats: confStats, activeKeys, complete: confComplete } = useConfessionStats(supabaseProgress)
  const totalEarned = confComplete + completions.length

  function handleAddCompletion() {
    setCompletions(addCompletion())
  }
  function handleRemoveCompletion(id) {
    setCompletions(removeCompletion(id))
  }
  function handleUpdateCompletion(id, updates) {
    setCompletions(updateCompletion(id, updates))
  }

  const isAllBibleDone = bibleDone >= TOTAL_CHAPTERS

  const content = (
    <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

      {/* ── Confession Reading Progress ── */}
      <div>
        <div style={a.groupLabel}>
          Confession Reading
          <span style={a.groupSub}>{confComplete} / {activeKeys.length} complete</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {activeKeys.map(src => (
            <ConfCard key={src} src={src} stats={confStats[src] || { done:0, total:1, pct:0 }} />
          ))}
        </div>
      </div>

      {/* ── Scripture Completions ── */}
      <div>
        <div style={a.groupLabel}>
          Scripture Completions
          {completions.length > 0 && (
            <span style={a.groupSub}>{completions.length} time{completions.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Auto-complete banner */}
        {isAllBibleDone && completions.length === 0 && (
          <div style={{
            background:'var(--teal-light)', border:'1.5px solid var(--teal)',
            borderRadius:'var(--radius-lg)', padding:'10px 14px', marginBottom:12,
            fontSize:12, color:'var(--teal)', fontWeight:600, lineHeight:1.5,
          }}>
            🎉 You've checked all {TOTAL_CHAPTERS} chapters! A completion has been automatically recorded below.
          </div>
        )}

        {completions.length === 0 ? (
          <p style={{ fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, marginBottom:12 }}>
            Each time you finish reading through the whole Bible, a completion is recorded here — automatically when you check the last chapter, or manually with the button below.
          </p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
            {completions.map((c, i) => (
              <CompletionCard
                key={c.id}
                completion={c}
                index={i}
                onRemove={() => handleRemoveCompletion(c.id)}
                onUpdate={updates => handleUpdateCompletion(c.id, updates)}
              />
            ))}
          </div>
        )}

        <button
          onClick={handleAddCompletion}
          style={{
            display:'flex', alignItems:'center', gap:8,
            background:'var(--teal-light)', border:'1.5px dashed var(--teal)',
            borderRadius:'var(--radius-lg)', padding:'10px 14px',
            cursor:'pointer', color:'var(--teal)', fontSize:12, fontWeight:700,
            fontFamily:"'DM Sans',sans-serif", width:'100%', transition:'background 0.12s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 4v6M4 7h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Record a Bible completion manually
        </button>
      </div>

    </div>
  )

  if (hideHeader) return content

  return (
    <section style={a.section}>
      <button onClick={() => setOpen(o => !o)} style={a.header} aria-expanded={open}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5l1.5 4.5H14l-3.8 2.8 1.5 4.5L8 10.7l-3.7 2.6 1.5-4.5L2 6h4.5z"
              stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round"
              fill="var(--teal)" fillOpacity="0.15"/>
          </svg>
          <h2 style={a.title}>Achievements</h2>
          {totalEarned > 0 && <span style={a.countBadge}>{totalEarned}</span>}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transition:'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink:0 }}>
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
      {open && <div style={{ marginTop:16 }}>{content}</div>}
    </section>
  )
}

/* ── Styles ── */
const a = {
  section: { marginBottom:'2rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', background:'none', border:'none', cursor:'pointer',
    padding:'4px 0', textAlign:'left', color:'var(--ink)',
  },
  title: { fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--teal)', margin:0 },
  countBadge: {
    fontSize:10, fontWeight:700, background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'1px 7px', letterSpacing:'0.03em',
  },
  groupLabel: {
    fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:10,
    display:'flex', alignItems:'center', gap:8,
  },
  groupSub: {
    fontSize:10, fontWeight:500, textTransform:'none', letterSpacing:0,
    color:'var(--teal)', background:'var(--teal-light)', borderRadius:99, padding:'1px 7px',
  },

  /* Edit form */
  editForm: {
    background:'var(--surface)', border:'1.5px solid var(--teal)',
    borderRadius:'var(--radius-lg)', padding:'14px',
    display:'flex', flexDirection:'column', gap:10,
  },
  editRow:  { display:'flex', flexDirection:'column', gap:4, flex:1 },
  editLabel:{ fontSize:10, fontWeight:700, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.06em' },
  editInput:{
    border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px',
    fontSize:13, color:'var(--ink)', background:'var(--parchment)',
    fontFamily:"'DM Sans',sans-serif", outline:'none', width:'100%', boxSizing:'border-box',
  },
  cancelBtn:{
    background:'none', border:'1px solid var(--border)', borderRadius:8,
    padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:600,
    color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif",
  },
  saveBtn:{
    background:'var(--teal)', border:'none', borderRadius:8,
    padding:'6px 16px', cursor:'pointer', fontSize:12, fontWeight:700,
    color:'#fff', fontFamily:"'DM Sans',sans-serif",
  },
}
