import React, { useState, useEffect, useMemo } from 'react'
import { getLocalProgress, buildSchedule } from '../lib/supabase'

const SCHEDULE = buildSchedule()

/* ── Scripture completion log ── */
const COMP_KEY = 'pb-scripture-completions'

function getCompletions() {
  try { return JSON.parse(localStorage.getItem(COMP_KEY) || '[]') } catch { return [] }
}
function addCompletion() {
  const all = getCompletions()
  all.push({ id: Date.now(), completedAt: new Date().toISOString() })
  try { localStorage.setItem(COMP_KEY, JSON.stringify(all)) } catch {}
  return all
}
function removeCompletion(id) {
  const all = getCompletions().filter(c => c.id !== id)
  try { localStorage.setItem(COMP_KEY, JSON.stringify(all)) } catch {}
  return all
}

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/* ── Confession meta ── */
const CONF_META = {
  '2LBCF': {
    label: '2LBCF', fullName: '2nd London Baptist Confession',
    color: 'var(--purple-ink)', bg: 'var(--purple-soft)', border: 'rgba(93,63,155,0.25)',
  },
  'Catechism': {
    label: 'Catechism', fullName: "Keach's Baptist Catechism",
    color: 'var(--teal)', bg: 'var(--teal-light)', border: 'rgba(29,107,90,0.25)',
  },
  '1LBCF': {
    label: '1LBCF', fullName: '1st London Baptist Confession',
    color: 'var(--amber-ink)', bg: 'var(--amber-soft)', border: 'rgba(163,107,42,0.25)',
  },
  'Orthodox': {
    label: 'Orthodox', fullName: 'An Orthodox Catechism',
    color: 'var(--sky)', bg: 'var(--sky-light)', border: 'rgba(14,116,144,0.25)',
  },
}

const CONF_KEYS = ['2LBCF', 'Catechism', '1LBCF', 'Orthodox']

/* ── Compute confession stats ── */
function useConfessionStats(supabaseProgress) {
  return useMemo(() => {
    const completedDays = new Set()
    if (supabaseProgress) {
      supabaseProgress.forEach(r => { if (r.completed) completedDays.add(r.day_number) })
    } else {
      const local = getLocalProgress()
      Object.entries(local).forEach(([day, d]) => { if (d.completed) completedDays.add(parseInt(day)) })
    }

    const stats = {}
    for (const src of CONF_KEYS) {
      const days = SCHEDULE.filter(e => e.src === src)
      if (days.length === 0) {
        stats[src] = { total: 0, done: 0, pct: 0 }
        continue
      }
      const done = days.filter(e => completedDays.has(e.day)).length
      stats[src] = { total: days.length, done, pct: Math.round(done / days.length * 100) }
    }
    return stats
  }, [supabaseProgress])
}

/* ── Wide confession progress card ── */
function ConfCard({ src, stats }) {
  const meta = CONF_META[src]
  if (!meta || stats.total === 0) return null
  const done = stats.done === stats.total
  const pct  = stats.pct

  return (
    <div style={{
      background: done ? meta.bg : 'var(--surface)',
      border: `1.5px solid ${done ? meta.border : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'all 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{
          fontSize:10, fontWeight:700, letterSpacing:'0.06em',
          color: meta.color, background: meta.bg,
          border: `1px solid ${meta.border}`,
          padding:'2px 8px', borderRadius:99,
        }}>{meta.label}</span>
        <span style={{ fontSize:12, color:'var(--ink-muted)', flex:1 }}>{meta.fullName}</span>
        {done && <span style={{ fontSize:14 }}>✓</span>}
        <span style={{ fontSize:12, fontWeight:700, color: meta.color, fontVariantNumeric:'tabular-nums' }}>
          {stats.done}/{stats.total}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:99, background: meta.color,
          width:`${pct}%`, transition:'width 0.4s', opacity: done ? 1 : 0.8,
        }} />
      </div>
    </div>
  )
}

/* ── Completion trophy card ── */
function CompletionCard({ completion, index, onRemove }) {
  const TROPHIES = ['🏆','🥈','📖','📖','📖','📖','📖','📖','📖','📖']
  const trophy = TROPHIES[index] || '📖'
  const date = new Date(completion.completedAt)
  const dateStr = date.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      background: index === 0 ? 'var(--teal-light)' : index === 1 ? 'var(--amber-soft)' : 'var(--parchment)',
      border: `2px solid ${index === 0 ? 'var(--teal)' : index === 1 ? 'var(--amber-ink)' : 'var(--border)'}`,
      borderRadius:'var(--radius-lg)', padding:'12px 14px',
      transition:'all 0.15s',
    }}>
      <span style={{ fontSize:28, flexShrink:0, lineHeight:1 }}>{trophy}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:13, fontWeight:700,
          color: index === 0 ? 'var(--teal)' : index === 1 ? 'var(--amber-ink)' : 'var(--ink)',
        }}>
          {ordinal(index + 1)} Reading of the Bible
        </div>
        <div style={{ fontSize:11, color:'var(--ink-muted)', marginTop:2 }}>
          Completed {dateStr}
        </div>
      </div>
      <button
        onClick={onRemove}
        title="Remove"
        style={{
          background:'none', border:'none', cursor:'pointer',
          color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'2px 4px',
          borderRadius:4, flexShrink:0,
        }}
      >×</button>
    </div>
  )
}

/* ── Main component ── */
export default function AchievementsSection({ supabaseProgress, hideHeader = false }) {
  const [open,        setOpen]        = useState(false)
  const [completions, setCompletions] = useState(() => getCompletions())
  const confStats = useConfessionStats(supabaseProgress)

  const confComplete = CONF_KEYS.filter(src => {
    const s = confStats[src]; return s && s.total > 0 && s.done === s.total
  }).length

  const totalEarned = confComplete + completions.length

  function handleAddCompletion() {
    setCompletions(addCompletion())
  }
  function handleRemoveCompletion(id) {
    setCompletions(removeCompletion(id))
  }

  const content = (
    <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

      {/* ── Confession Reading Progress ── */}
      <div>
        <div style={a.groupLabel}>
          Confession Reading
          <span style={a.groupSub}>{confComplete} / {CONF_KEYS.length} complete</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {CONF_KEYS.map(src => (
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

        {completions.length === 0 ? (
          <p style={{ fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, marginBottom:12 }}>
            Log each time you finish reading the whole Bible. Each completion is celebrated here as a milestone.
          </p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
            {completions.map((c, i) => (
              <CompletionCard
                key={c.id}
                completion={c}
                index={i}
                onRemove={() => handleRemoveCompletion(c.id)}
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
            fontFamily:"'DM Sans',sans-serif", width:'100%',
            transition:'background 0.12s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 4v6M4 7h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Record a Bible completion
        </button>
      </div>

    </div>
  )

  /* When used inside an outer collapsible (hideHeader=true), render content directly */
  if (hideHeader) {
    return content
  }

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
          {totalEarned > 0 && (
            <span style={a.countBadge}>{totalEarned}</span>
          )}
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

const a = {
  section: {
    marginBottom:'2rem', paddingBottom:'2rem',
    borderBottom:'1px solid var(--border)',
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', background:'none', border:'none', cursor:'pointer',
    padding:'4px 0', textAlign:'left', color:'var(--ink)',
  },
  title: {
    fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--teal)', margin:0,
  },
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
    color:'var(--teal)', background:'var(--teal-light)', borderRadius:99,
    padding:'1px 7px',
  },
}
