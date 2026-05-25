/**
 * ConfessionTrackerSection
 * Card-list UI similar to BibleTrackerSection.
 * Each preset confession plan is shown as a selectable card.
 * The active plan card shows settings, progress, and today's reading inline.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../App'
import { CONF_PLANS, CONF_PLAN_BY_ID } from '../data/confessionPlans'
import {
  getConfPlanConfig, saveConfPlanConfig, clearConfPlanConfig,
  getConfPlanProgress, saveConfPlanProgress, resetConfPlanProgress,
  getCurrentConfItem, isConfPlanComplete, advanceConfPlan, retreatConfPlan,
  getConfPlanStats, isTodayConfRestDay, computeConfItems,
} from '../lib/confessionPlan'

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
}

/* ══════════════════════════════════════════════
   Single plan card
   ══════════════════════════════════════════════ */
function PlanCard({ plan, isActive, isGuest, config, progress, onSelect, onSaveSettings }) {
  const preset = CONF_PLAN_BY_ID[plan.id]

  /* Local draft state for settings panel */
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftMode,    setDraftMode]    = useState(config?.mode     || 'once')
  const [draftRest,    setDraftRest]    = useState(config?.restDays || [])
  const [confirmStop,  setConfirmStop]  = useState(false)

  /* Re-sync drafts when config changes (e.g. after switching active plan) */
  useEffect(() => {
    if (isActive && config) {
      setDraftMode(config.mode     || 'once')
      setDraftRest(config.restDays || [])
    }
  }, [isActive, config])

  /* Derived */
  const todayStr  = new Date().toISOString().slice(0, 10)
  const doneToday = isActive && progress?.lastAdvancedDate === todayStr
  const isRest    = isActive && config ? isTodayConfRestDay(config) : false
  const complete  = isActive && config ? isConfPlanComplete(config, progress)  : false
  const todayItem = (isActive && !complete && !isRest && config) ? getCurrentConfItem(config, progress) : null
  const stats     = isActive && config ? getConfPlanStats(config, progress) : null

  /* Item count for description augmentation */
  const itemCount = useMemo(() => computeConfItems(plan.id).length, [plan.id])

  /* ── Handlers ── */
  function handleSelect() {
    if (isGuest) return
    const newConfig = {
      planId:      plan.id,
      mode:        preset?.cyclic ? 'once' : 'once',
      restDays:    [],
      startedDate: new Date().toISOString().slice(0, 10),
    }
    onSelect(newConfig)
  }

  function handleApplySettings(e) {
    e.preventDefault()
    const newConfig = {
      planId:      plan.id,
      mode:        preset?.cyclic ? draftMode : 'once',
      restDays:    draftRest,
      startedDate: config?.startedDate || new Date().toISOString().slice(0, 10),
    }
    onSaveSettings(newConfig)
    setSettingsOpen(false)
  }

  function handleAdvance(e) {
    e.preventDefault()
    if (!config || !progress) return
    const { progress: newProg } = advanceConfPlan(config, progress)
    saveConfPlanProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  function handleRetreat(e) {
    e.preventDefault()
    if (!progress) return
    const newProg = retreatConfPlan(progress)
    saveConfPlanProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  function handleStop(e) {
    e.preventDefault()
    clearConfPlanConfig()
    resetConfPlanProgress()
    setConfirmStop(false)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  function handleReadAgain(e) {
    e.preventDefault()
    resetConfPlanProgress()
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  return (
    <div style={{ ...c.card, ...(isActive ? c.cardActive : {}), ...(isGuest ? { opacity:0.75 } : {}) }}>

      {/* ── Header row ── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ paddingTop:2, flexShrink:0 }}>
          <input
            type="radio"
            name="conf-plan-select"
            checked={isActive}
            onChange={handleSelect}
            disabled={isGuest}
            style={{ accentColor:'var(--teal)', width:15, height:15, cursor: isGuest ? 'default' : 'pointer' }}
          />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={c.planName}>{plan.label}</span>
            {isActive && <span style={c.activeBadge}>ACTIVE</span>}
            {plan.short && !isActive && <span style={c.shortBadge}>{plan.short}</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:2, lineHeight:1.5 }}>
            {plan.description}
            {plan.cyclic && <span style={{ marginLeft:5 }}>· yearly cycle supported</span>}
          </div>
        </div>
      </div>

      {/* ── Active plan expanded section ── */}
      {isActive && !isGuest && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginLeft:25 }}>

          {/* Meta badges + Settings button */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {config && preset?.cyclic && (
              <span style={c.metaTag}>{config.mode === 'year' ? '1-year cycle' : 'Read once'}</span>
            )}
            {config?.restDays?.length > 0 && (
              <span style={c.metaTag}>Rest: {config.restDays.map(d => DAY_NAMES[d]).join(', ')}</span>
            )}
            {config?.startedDate && (
              <span style={c.metaTag}>Started {fmtDate(config.startedDate)}</span>
            )}
            <button onClick={e => { e.preventDefault(); setSettingsOpen(o => !o) }} style={c.settingsBtn}>
              {settingsOpen ? 'Close' : 'Settings'}
            </button>
          </div>

          {/* ── Settings panel ── */}
          {settingsOpen && (
            <div style={c.settingsPanel}>
              {preset?.cyclic && (
                <div>
                  <div style={c.settingsLabel}>Reading mode</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                    {[
                      { v:'once', label:'Read through once',    hint:'One item per day until finished' },
                      { v:'year', label:'Complete in 1 year',   hint:'Repeats items to fill all reading days in a year' },
                    ].map(opt => (
                      <label key={opt.v} style={{ display:'flex', gap:8, cursor:'pointer', alignItems:'flex-start' }}>
                        <input
                          type="radio" name={`cmode-${plan.id}`}
                          value={opt.v} checked={draftMode === opt.v}
                          onChange={() => setDraftMode(opt.v)}
                          style={{ accentColor:'var(--teal)', marginTop:2, flexShrink:0 }}
                        />
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:'var(--ink-faint)' }}>{opt.hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={c.settingsLabel}>Rest days <span style={{ fontWeight:400, fontSize:11 }}>(no reading)</span></div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
                  {DAY_NAMES.map((d, i) => {
                    const on = draftRest.includes(i)
                    return (
                      <button key={i} onClick={e => {
                        e.preventDefault()
                        setDraftRest(prev => on ? prev.filter(x => x !== i) : [...prev, i])
                      }} style={{ ...c.dayBtn, background: on ? 'var(--teal)' : 'var(--surface)', color: on ? 'white' : 'var(--ink-muted)', borderColor: on ? 'var(--teal)' : 'var(--border)' }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={handleApplySettings} className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px' }}>Apply</button>
                <button onClick={e => { e.preventDefault(); setSettingsOpen(false) }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── Progress bar ── */}
          {stats && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                <span style={{ fontSize:11, color:'var(--ink-faint)' }}>
                  {stats.done} / {stats.total} {config.mode === 'year' ? 'days' : 'items'}
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--teal)' }}>{stats.pct}%</span>
              </div>
              <div style={c.barBg}><div style={{ ...c.barFill, width:`${stats.pct}%` }} /></div>
              {stats.projectedEnd && !complete && config.mode === 'once' && (
                <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:3, textAlign:'right' }}>
                  Est. finish: {fmtDate(stats.projectedEnd)} · {stats.remaining} items left
                </div>
              )}
            </div>
          )}

          {/* ── Complete banner ── */}
          {complete && (
            <div style={c.completeBox}>
              <span>🎉 Plan complete!</span>
              <button onClick={handleReadAgain} style={c.readAgainBtn}>Read again</button>
            </div>
          )}

          {/* ── Rest day notice ── */}
          {isRest && !complete && (
            <div style={c.restBox}>📅 Rest day — no reading today</div>
          )}

          {/* ── Today's reading ── */}
          {todayItem && !complete && (
            <div style={c.todayBox}>
              <div style={c.todayLabel}>Today&apos;s reading</div>
              <div style={c.todayItem}>{todayItem.label}</div>
              {todayItem.title && (
                <div style={{ fontSize:12, color:'var(--ink-muted)', fontStyle:'italic', marginTop:2, marginBottom:2 }}>
                  {todayItem.title}
                </div>
              )}
              {todayItem.q && (
                <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2, marginBottom:2, lineHeight:1.5 }}>
                  Q: {todayItem.q}
                </div>
              )}
              {doneToday ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                  <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>✓ Done for today</span>
                  <button onClick={handleRetreat} style={c.undoBtn}>Undo</button>
                </div>
              ) : (
                <button onClick={handleAdvance} className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px', marginTop:8 }}>
                  Mark done ✓
                </button>
              )}
            </div>
          )}

          {/* ── Stop plan ── */}
          <div>
            {!confirmStop ? (
              <button onClick={e => { e.preventDefault(); setConfirmStop(true) }} style={c.stopLink}>
                Stop plan
              </button>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'var(--ink-muted)' }}>Stop and clear progress?</span>
                <button onClick={handleStop}
                  className="btn btn-outline"
                  style={{ fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'4px 10px' }}>
                  Yes, stop
                </button>
                <button onClick={e => { e.preventDefault(); setConfirmStop(false) }}
                  className="btn btn-ghost"
                  style={{ fontSize:12, padding:'4px 10px' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════ */
export default function ConfessionTrackerSection() {
  const { session } = useAuth()
  const isGuest = !session

  const [config,   setConfig]   = useState(() => getConfPlanConfig())
  const [progress, setProgress] = useState(() => getConfPlanProgress())

  useEffect(() => {
    function onChanged() {
      setConfig(getConfPlanConfig())
      setProgress(getConfPlanProgress())
    }
    window.addEventListener('pb-conf-plan-changed', onChanged)
    return () => window.removeEventListener('pb-conf-plan-changed', onChanged)
  }, [])

  function handleSelect(newConfig) {
    /* Reset progress when switching to a different plan */
    const switchingPlan = newConfig.planId !== config?.planId
    saveConfPlanConfig(newConfig)
    if (switchingPlan) {
      resetConfPlanProgress()
      setProgress({ currentIndex: 0, lastAdvancedDate: null })
    }
    setConfig(newConfig)
  }

  function handleSaveSettings(newConfig) {
    saveConfPlanConfig(newConfig)
    setConfig(newConfig)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {isGuest && (
        <div style={c.guestNote}>
          🔒 Sign in to start and track your daily reading. Below is a preview of available plans.
        </div>
      )}

      {CONF_PLANS.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isActive={config?.planId === plan.id}
          isGuest={isGuest}
          config={config?.planId === plan.id ? config   : null}
          progress={config?.planId === plan.id ? progress : null}
          onSelect={handleSelect}
          onSaveSettings={handleSaveSettings}
        />
      ))}
    </div>
  )
}

/* ── Styles ── */
const c = {
  card: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:8,
    transition:'border-color 0.15s',
  },
  cardActive: { borderColor:'var(--teal)' },
  planName: {
    fontSize:14, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  activeBadge: {
    fontSize:9, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'white', background:'var(--teal)', borderRadius:99, padding:'2px 7px', flexShrink:0,
  },
  shortBadge: {
    fontSize:10, color:'var(--ink-faint)', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:99, padding:'1px 6px', flexShrink:0,
  },
  metaTag: {
    fontSize:11, color:'var(--ink-faint)', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:99, padding:'2px 8px',
  },
  settingsBtn: {
    marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'none', border:'1px solid rgba(29,107,90,0.3)',
    borderRadius:6, padding:'3px 8px', cursor:'pointer', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },
  settingsPanel: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:12,
  },
  settingsLabel: {
    fontSize:11, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.06em', color:'var(--ink-faint)',
  },
  dayBtn: {
    width:38, height:30, borderRadius:8, border:'1.5px solid',
    fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
    fontFamily:"'DM Sans',sans-serif",
  },
  barBg:   { height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' },
  barFill: { height:'100%', borderRadius:99, background:'var(--teal)', transition:'width 0.4s ease' },
  completeBox: {
    background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.2)',
    borderRadius:8, padding:'10px 12px', fontSize:13, color:'var(--teal)',
    fontWeight:600, display:'flex', alignItems:'center', gap:10,
  },
  readAgainBtn: {
    fontSize:12, fontWeight:600, color:'var(--teal)', background:'none',
    border:'1px solid rgba(29,107,90,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer',
  },
  restBox: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:8, padding:'10px 12px', fontSize:13, color:'var(--ink-muted)', fontStyle:'italic',
  },
  todayBox: {
    background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.2)',
    borderRadius:8, padding:'12px 14px',
  },
  todayLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.07em', color:'var(--teal)', marginBottom:4,
  },
  todayItem: {
    fontSize:16, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  undoBtn: {
    fontSize:11, color:'var(--ink-faint)', background:'none',
    border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', padding:'3px 8px',
    fontFamily:"'DM Sans',sans-serif",
  },
  stopLink: {
    fontSize:11, color:'var(--ink-faint)', background:'none', border:'none',
    cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dashed',
    padding:0, fontFamily:"'DM Sans',sans-serif",
  },
  guestNote: {
    fontSize:12, color:'var(--ink-muted)', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', lineHeight:1.6,
  },
}
