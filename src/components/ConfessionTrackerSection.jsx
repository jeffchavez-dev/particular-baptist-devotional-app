/**
 * ConfessionTrackerSection
 * Daily reading tracker for confessions and catechisms.
 *
 * Guest  : Shows all-4 default plan stats (474 items, ~1.3 yrs)
 * Signed-in: Full plan configurator + today's reading card
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { CONF_PLANS, CONF_PLAN_BY_ID } from '../data/confessionPlans'
import {
  getConfPlanConfig, saveConfPlanConfig, clearConfPlanConfig,
  getConfPlanProgress, saveConfPlanProgress, resetConfPlanProgress,
  getCurrentConfItem, isConfPlanComplete, advanceConfPlan, retreatConfPlan,
  getConfPlanStats, getGuestDefaultStats, isTodayConfRestDay,
} from '../lib/confessionPlan'

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
}

/* ══════════════════════════════════════════════
   Guest view
   ══════════════════════════════════════════════ */
function GuestView() {
  const { total, projectedEnd, daysLeft } = getGuestDefaultStats()
  const years  = (daysLeft / 365).toFixed(1)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'4px 0 8px' }}>
      <div style={{
        background:'var(--parchment)', border:'1px solid var(--border)',
        borderRadius:10, padding:'14px 16px',
      }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)', marginBottom:4 }}>
          Default plan (guest)
        </div>
        <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', marginBottom:2 }}>
          All Confessions &amp; Catechisms
        </div>
        <div style={{ fontSize:12, color:'var(--ink-muted)', lineHeight:1.6, marginBottom:10 }}>
          2LBCF → Baptist Catechism → 1LBCF → Orthodox Catechism
        </div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          <div style={g.stat}>
            <span style={g.statNum}>{total}</span>
            <span style={g.statLabel}>total items</span>
          </div>
          <div style={g.stat}>
            <span style={g.statNum}>{years} yrs</span>
            <span style={g.statLabel}>to complete</span>
          </div>
          <div style={g.stat}>
            <span style={g.statNum}>{fmtDate(projectedEnd)}</span>
            <span style={g.statLabel}>est. finish</span>
          </div>
        </div>
      </div>
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
        padding:'18px 16px', textAlign:'center',
        background:'var(--teal-light)', borderRadius:10,
        border:'1px solid rgba(29,107,90,0.15)',
      }}>
        <div style={{ fontSize:28 }}>🔒</div>
        <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--teal)' }}>
          Sign in to customize your plan
        </div>
        <div style={{ fontSize:12, color:'var(--teal)', opacity:0.8, maxWidth:280, lineHeight:1.6 }}>
          Choose a single confession, set rest days, and track your daily readings. Sign in to unlock.
        </div>
      </div>
    </div>
  )
}

const g = {
  stat:      { display:'flex', flexDirection:'column', gap:1 },
  statNum:   { fontSize:14, fontWeight:700, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif" },
  statLabel: { fontSize:10, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.05em' },
}

/* ══════════════════════════════════════════════
   Logged-in view
   ══════════════════════════════════════════════ */
function LoggedInView() {
  /* ── Load state from storage ── */
  const [config,   setConfig]   = useState(() => getConfPlanConfig())
  const [progress, setProgress] = useState(() => getConfPlanProgress())

  /* ── Plan-editor draft ── */
  const [editing,       setEditing]       = useState(!config)
  const [draftPlan,     setDraftPlan]     = useState(() => config?.planId || 'all')
  const [draftMode,     setDraftMode]     = useState(() => config?.mode || 'once')
  const [draftRest,     setDraftRest]     = useState(() => config?.restDays || [])
  const [confirmStop,   setConfirmStop]   = useState(false)
  const [advancedToday, setAdvancedToday] = useState(false)

  /* Sync if another tab changed storage */
  useEffect(() => {
    function onChanged() {
      setConfig(getConfPlanConfig())
      setProgress(getConfPlanProgress())
    }
    window.addEventListener('pb-conf-plan-changed', onChanged)
    return () => window.removeEventListener('pb-conf-plan-changed', onChanged)
  }, [])

  /* When plan resets, re-open editor */
  useEffect(() => {
    if (!config) setEditing(true)
  }, [config])

  /* ── Derived ── */
  const preset     = config ? CONF_PLAN_BY_ID[config.planId] : null
  const isRestDay  = config ? isTodayConfRestDay(config) : false
  const complete   = config ? isConfPlanComplete(config, progress) : false
  const todayItem  = (!complete && !isRestDay && config) ? getCurrentConfItem(config, progress) : null
  const stats      = config ? getConfPlanStats(config, progress) : null

  /* ── Save / start plan ── */
  function handleSave() {
    const newConfig = {
      planId:      draftPlan,
      mode:        CONF_PLAN_BY_ID[draftPlan]?.cyclic ? draftMode : 'once',
      restDays:    draftRest,
      startedDate: new Date().toISOString().slice(0, 10),
    }
    saveConfPlanConfig(newConfig)
    resetConfPlanProgress()
    setConfig(newConfig)
    setProgress({ currentIndex: 0, lastAdvancedDate: null })
    setEditing(false)
    setConfirmStop(false)
    setAdvancedToday(false)
  }

  /* ── Stop plan ── */
  function handleStop() {
    clearConfPlanConfig()
    resetConfPlanProgress()
    setConfig(null)
    setProgress({ currentIndex: 0, lastAdvancedDate: null })
    setEditing(true)
    setConfirmStop(false)
    setAdvancedToday(false)
  }

  /* ── Advance ── */
  function handleAdvance() {
    if (!config) return
    const { progress: newProg, completed } = advanceConfPlan(config, progress)
    saveConfPlanProgress(newProg)
    setProgress(newProg)
    setAdvancedToday(true)
    if (completed) setAdvancedToday(false)
  }

  /* ── Retreat ── */
  function handleRetreat() {
    if (!config) return
    const newProg = retreatConfPlan(progress)
    saveConfPlanProgress(newProg)
    setProgress(newProg)
    setAdvancedToday(false)
  }

  /* ── Toggle rest day ── */
  function toggleRest(d) {
    setDraftRest(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  /* ── Already advanced today? ── */
  const lastDate = progress?.lastAdvancedDate
  const todayStr = new Date().toISOString().slice(0, 10)
  const doneToday = lastDate === todayStr

  /* ═══════════════════════════════ EDITOR ═══════════════════════════════ */
  if (editing) {
    const selectedPreset = CONF_PLAN_BY_ID[draftPlan]
    const cyclic = selectedPreset?.cyclic
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* Plan selector */}
        <div>
          <div style={p.label}>Choose a confession</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {CONF_PLANS.map(plan => (
              <label key={plan.id} style={p.radioRow}>
                <input
                  type="radio"
                  name="conf-plan"
                  value={plan.id}
                  checked={draftPlan === plan.id}
                  onChange={() => {
                    setDraftPlan(plan.id)
                    if (!CONF_PLAN_BY_ID[plan.id]?.cyclic) setDraftMode('once')
                  }}
                  style={{ accentColor:'var(--teal)', marginTop:2, flexShrink:0 }}
                />
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  <span style={p.radioLabel}>{plan.label}</span>
                  <span style={p.radioHint}>{plan.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Mode — only for cyclic plans */}
        {cyclic && (
          <div>
            <div style={p.label}>Reading mode</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
              <label style={p.radioRow}>
                <input
                  type="radio" name="conf-mode" value="once"
                  checked={draftMode === 'once'}
                  onChange={() => setDraftMode('once')}
                  style={{ accentColor:'var(--teal)', marginTop:2, flexShrink:0 }}
                />
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  <span style={p.radioLabel}>Read through once</span>
                  <span style={p.radioHint}>One item per day until finished</span>
                </div>
              </label>
              <label style={p.radioRow}>
                <input
                  type="radio" name="conf-mode" value="year"
                  checked={draftMode === 'year'}
                  onChange={() => setDraftMode('year')}
                  style={{ accentColor:'var(--teal)', marginTop:2, flexShrink:0 }}
                />
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  <span style={p.radioLabel}>Complete in 1 year</span>
                  <span style={p.radioHint}>
                    Cycles through items repeatedly to fill all reading days in a year
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Rest days */}
        <div>
          <div style={p.label}>Rest days <span style={p.labelHint}>(no reading assigned)</span></div>
          <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
            {DAY_NAMES.map((d, i) => (
              <button
                key={i}
                onClick={() => toggleRest(i)}
                style={{
                  ...p.dayBtn,
                  background: draftRest.includes(i) ? 'var(--teal)' : 'var(--surface)',
                  color:      draftRest.includes(i) ? 'white' : 'var(--ink-muted)',
                  borderColor: draftRest.includes(i) ? 'var(--teal)' : 'var(--border)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:5, lineHeight:1.5 }}>
            Reading is assigned every day except the selected rest days.
          </div>
        </div>

        {/* Action row */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', paddingTop:4 }}>
          <button onClick={handleSave} className="btn btn-primary" style={{ fontSize:13 }}>
            {config ? 'Update Plan' : 'Start Plan'}
          </button>
          {config && (
            <button
              onClick={() => setEditing(false)}
              className="btn btn-ghost"
              style={{ fontSize:13 }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════ ACTIVE PLAN VIEW ═══════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Plan header pill */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={p.planBadge}>{preset?.short || preset?.label || config.planId}</span>
        <span style={p.modeBadge}>
          {config.mode === 'year' ? '1-year cycle' : 'Read once'}
        </span>
        {config.restDays?.length > 0 && (
          <span style={p.restBadge}>
            Rest: {config.restDays.map(d => DAY_NAMES[d]).join(', ')}
          </span>
        )}
        <button
          onClick={() => { setEditing(true); setConfirmStop(false) }}
          style={p.editBtn}
        >
          Edit
        </button>
      </div>

      {/* Progress bar */}
      {stats && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
            <span style={{ fontSize:12, color:'var(--ink-muted)' }}>
              {stats.done} / {stats.total} reading days
            </span>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--teal)' }}>{stats.pct}%</span>
          </div>
          <div style={p.barBg}>
            <div style={{ ...p.barFill, width:`${stats.pct}%` }} />
          </div>
          {stats.mode === 'year' && stats.cyclesDone > 0 && (
            <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:4 }}>
              Cycled through {stats.cyclesDone}× · item {(stats.itemPos + 1)} of {stats.itemsCount}
            </div>
          )}
          {stats.mode === 'once' && stats.projectedEnd && !complete && (
            <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:4 }}>
              Est. finish: {fmtDate(stats.projectedEnd)} · {stats.remaining} items left
            </div>
          )}
        </div>
      )}

      {/* Complete banner */}
      {complete && (
        <div style={{
          background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.2)',
          borderRadius:10, padding:'14px 16px', textAlign:'center',
        }}>
          <div style={{ fontSize:22, marginBottom:6 }}>🎉</div>
          <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--teal)' }}>
            Plan complete!
          </div>
          <div style={{ fontSize:12, color:'var(--teal)', opacity:0.8, marginTop:4, marginBottom:12 }}>
            You finished <strong>{preset?.label || config.planId}</strong>.
          </div>
          <button onClick={() => { resetConfPlanProgress(); setProgress({ currentIndex:0, lastAdvancedDate:null }); setAdvancedToday(false) }}
            className="btn btn-primary" style={{ fontSize:13 }}>
            Read again
          </button>
        </div>
      )}

      {/* Rest day notice */}
      {isRestDay && !complete && (
        <div style={{
          background:'var(--parchment)', border:'1px solid var(--border)',
          borderRadius:10, padding:'14px 16px',
        }}>
          <div style={{ fontSize:13, color:'var(--ink-muted)' }}>
            📅 Today is a rest day — no reading assigned.
          </div>
        </div>
      )}

      {/* Today's reading card */}
      {todayItem && !complete && (
        <div style={{
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:10, padding:'16px',
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--teal)', marginBottom:6 }}>
            Today&apos;s reading
          </div>
          <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', marginBottom:3 }}>
            {todayItem.label}
          </div>
          {todayItem.title && (
            <div style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:6, fontStyle:'italic' }}>
              {todayItem.title}
            </div>
          )}
          {todayItem.q && (
            <div style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:6, lineHeight:1.5 }}>
              Q: {todayItem.q}
            </div>
          )}

          {doneToday ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
              <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>
                ✓ Marked done for today
              </span>
              <button onClick={handleRetreat} style={p.undoBtn}>Undo</button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              <button onClick={handleAdvance} className="btn btn-primary" style={{ fontSize:13 }}>
                Mark done ✓
              </button>
              {(progress?.currentIndex ?? 0) > 0 && (
                <button onClick={handleRetreat} className="btn btn-ghost" style={{ fontSize:13 }}>
                  ← Previous
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stop plan */}
      <div style={{ paddingTop:4 }}>
        {!confirmStop ? (
          <button
            onClick={() => setConfirmStop(true)}
            style={{ fontSize:12, color:'var(--ink-faint)', background:'none', border:'none', cursor:'pointer', padding:0, textDecoration:'underline' }}
          >
            Stop plan
          </button>
        ) : (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--ink-muted)' }}>Stop and clear progress?</span>
            <button onClick={handleStop} className="btn btn-outline"
              style={{ fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'4px 10px' }}>
              Yes, stop
            </button>
            <button onClick={() => setConfirmStop(false)} className="btn btn-ghost"
              style={{ fontSize:12, padding:'4px 10px' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* Styles shared by LoggedInView */
const p = {
  label:     { fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)' },
  labelHint: { fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 },
  radioRow:  { display:'flex', gap:10, alignItems:'flex-start', cursor:'pointer' },
  radioLabel: { fontSize:14, fontWeight:600, color:'var(--ink)' },
  radioHint:  { fontSize:12, color:'var(--ink-faint)', lineHeight:1.4 },

  dayBtn: {
    width:40, height:32, borderRadius:8, border:'1.5px solid',
    fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
    fontFamily:"'DM Sans',sans-serif",
  },

  planBadge: {
    fontSize:11, fontWeight:700, letterSpacing:'0.04em',
    background:'var(--teal-light)', color:'var(--teal)',
    padding:'3px 9px', borderRadius:99,
    border:'1px solid rgba(29,107,90,0.15)',
  },
  modeBadge: {
    fontSize:11, color:'var(--ink-faint)',
    background:'var(--parchment)', border:'1px solid var(--border)',
    padding:'3px 9px', borderRadius:99,
  },
  restBadge: {
    fontSize:11, color:'var(--ink-faint)',
    background:'var(--parchment)', border:'1px solid var(--border)',
    padding:'3px 9px', borderRadius:99,
  },
  editBtn: {
    marginLeft:'auto', fontSize:12, fontWeight:600, color:'var(--teal)',
    background:'none', border:'none', cursor:'pointer', padding:0,
  },

  barBg:   { height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' },
  barFill: { height:'100%', borderRadius:99, background:'var(--teal)', transition:'width 0.4s ease' },

  undoBtn: {
    fontSize:11, color:'var(--ink-faint)', background:'none',
    border:'1px solid var(--border)', borderRadius:6,
    cursor:'pointer', padding:'3px 8px',
  },
}

/* ══════════════════════════════════════════════
   Export
   ══════════════════════════════════════════════ */
export default function ConfessionTrackerSection() {
  const { session } = useAuth()
  if (!session) return <GuestView />
  return <LoggedInView />
}
