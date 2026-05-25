/**
 * ConfessionTrackerSection
 * Two-tab layout:
 *   Tab A — "My Plans"          : plan cards (select, advance, stop)
 *   Tab B — "Confession Tracker": per-source progress bars (2LBCF, Catechism, 1LBCF, Orthodox)
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
import { getLocalProgress, buildSchedule, getOrthodoxForDay, ORTHODOX_Q_COUNT } from '../lib/supabase'

const SCHEDULE = buildSchedule()
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
}

/* ══════════════════════════════════════════════
   Confession tracker data + card
   ══════════════════════════════════════════════ */
const CONF_META = {
  '2LBCF':    { label:'2LBCF',    fullName:'2nd London Baptist Confession', color:'var(--purple-ink)', bg:'var(--purple-soft)', border:'rgba(93,63,155,0.25)' },
  'Catechism':{ label:'Catechism',fullName:"Keach's Baptist Catechism",      color:'var(--teal)',       bg:'var(--teal-light)',  border:'rgba(29,107,90,0.25)' },
  '1LBCF':    { label:'1LBCF',    fullName:'1st London Baptist Confession',  color:'var(--amber-ink)', bg:'var(--amber-soft)', border:'rgba(163,107,42,0.25)' },
  'Orthodox': { label:'Orthodox', fullName:'An Orthodox Catechism',          color:'var(--sky)',        bg:'var(--sky-light)',  border:'rgba(14,116,144,0.25)' },
}

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
    for (const src of ['2LBCF', 'Catechism', '1LBCF']) {
      const days = SCHEDULE.filter(e => e.src === src)
      const done = days.filter(e => completedDays.has(e.day)).length
      stats[src] = { total: days.length, done, pct: days.length ? Math.round(done / days.length * 100) : 0 }
    }

    // Orthodox Catechism — always shown; tracked via modular day mapping
    const covered = new Set()
    completedDays.forEach(day => covered.add(getOrthodoxForDay(day)))
    stats['Orthodox'] = {
      total: ORTHODOX_Q_COUNT,
      done:  covered.size,
      pct:   Math.round(covered.size / ORTHODOX_Q_COUNT * 100),
    }

    const activeKeys = ['2LBCF', 'Catechism', '1LBCF', 'Orthodox']

    const complete = activeKeys.filter(k => {
      const s = stats[k]; return s && s.total > 0 && s.done === s.total
    }).length

    return { stats, activeKeys, complete }
  }, [supabaseProgress])
}

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
      {done && (
        <div style={{ fontSize:11, color:meta.color, fontWeight:600 }}>🏅 Complete!</div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Single plan card (no embedded settings)
   ══════════════════════════════════════════════ */
function PlanCard({ plan, isActive, isGuest, config, progress, onSelect, onAdvance, onRetreat, onStop }) {
  const preset = CONF_PLAN_BY_ID[plan.id]
  const [confirmStop, setConfirmStop] = useState(false)

  const todayStr  = new Date().toISOString().slice(0, 10)
  const doneToday = isActive && progress?.lastAdvancedDate === todayStr
  const isRest    = isActive && config ? isTodayConfRestDay(config) : false
  const complete  = isActive && config ? isConfPlanComplete(config, progress) : false
  const todayItem = (isActive && !complete && !isRest && config) ? getCurrentConfItem(config, progress) : null
  const stats     = isActive && config ? getConfPlanStats(config, progress) : null

  const itemCount = useMemo(() => computeConfItems(plan.id).length, [plan.id])

  function handleSelect() {
    if (isGuest) return
    const newConfig = {
      planId:      plan.id,
      mode:        plan.defaultMode || 'once',
      restDays:    [],
      startedDate: new Date().toISOString().slice(0, 10),
    }
    onSelect(newConfig)
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
            {plan.description} · {itemCount} items
            {plan.cyclic && <span style={{ marginLeft:5 }}>· yearly cycle</span>}
          </div>
        </div>
      </div>

      {/* ── Active plan expanded section ── */}
      {isActive && !isGuest && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginLeft:25 }}>

          {/* Meta badges */}
          {(config?.mode || config?.restDays?.length > 0 || config?.startedDate) && (
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
              <button
                onClick={e => { e.preventDefault(); resetConfPlanProgress(); window.dispatchEvent(new CustomEvent('pb-conf-plan-changed')) }}
                style={c.readAgainBtn}
              >
                Read again
              </button>
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
                  <button onClick={onRetreat} style={c.undoBtn}>Undo</button>
                </div>
              ) : (
                <button onClick={onAdvance} className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px', marginTop:8 }}>
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
                <button
                  onClick={e => { e.preventDefault(); onStop(); setConfirmStop(false) }}
                  className="btn btn-outline"
                  style={{ fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'4px 10px' }}
                >
                  Yes, stop
                </button>
                <button
                  onClick={e => { e.preventDefault(); setConfirmStop(false) }}
                  className="btn btn-ghost"
                  style={{ fontSize:12, padding:'4px 10px' }}
                >
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
export default function ConfessionTrackerSection({ supabaseProgress = null }) {
  const { session } = useAuth()
  const isGuest = !session

  const [config,    setConfig]    = useState(() => getConfPlanConfig())
  const [progress,  setProgress]  = useState(() => getConfPlanProgress())
  const [activeTab, setActiveTab] = useState('plans')

  /* ── Global settings state ── */
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftMode,    setDraftMode]    = useState(() => getConfPlanConfig()?.mode     || 'once')
  const [draftRest,    setDraftRest]    = useState(() => getConfPlanConfig()?.restDays || [])

  /* Confession tracker stats */
  const { stats: confStats, activeKeys, complete: confComplete } = useConfessionStats(supabaseProgress)

  /* Sync when config changes externally */
  useEffect(() => {
    function onChanged() {
      const cfg = getConfPlanConfig()
      setConfig(cfg)
      setProgress(getConfPlanProgress())
      if (cfg) {
        setDraftMode(cfg.mode     || 'once')
        setDraftRest(cfg.restDays || [])
      }
    }
    window.addEventListener('pb-conf-plan-changed', onChanged)
    return () => window.removeEventListener('pb-conf-plan-changed', onChanged)
  }, [])

  const activePlan = config ? CONF_PLAN_BY_ID[config.planId] : null

  function handleSelect(newConfig) {
    const switchingPlan = newConfig.planId !== config?.planId
    saveConfPlanConfig(newConfig)
    if (switchingPlan) {
      resetConfPlanProgress()
      setProgress({ currentIndex: 0, lastAdvancedDate: null })
    }
    setConfig(newConfig)
    setDraftMode(newConfig.mode     || 'once')
    setDraftRest(newConfig.restDays || [])
    setSettingsOpen(false)
  }


  function handleApplySettings(e) {
    e.preventDefault()
    if (!config) return
    const newConfig = {
      ...config,
      mode:     activePlan?.cyclic ? draftMode : 'once',
      restDays: draftRest,
    }
    saveConfPlanConfig(newConfig)
    setConfig(newConfig)
    setSettingsOpen(false)
  }

  function handleAdvance(e) {
    e.preventDefault()
    if (!config || !progress) return
    const { progress: newProg } = advanceConfPlan(config, progress)
    saveConfPlanProgress(newProg)
    setProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  function handleRetreat(e) {
    if (e) e.preventDefault()
    if (!progress) return
    const newProg = retreatConfPlan(progress)
    saveConfPlanProgress(newProg)
    setProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  function handleStop() {
    clearConfPlanConfig()
    resetConfPlanProgress()
    setConfig(null)
    setProgress({ currentIndex: 0, lastAdvancedDate: null })
    setSettingsOpen(false)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Tab switcher ── */}
      <div style={c.tabs}>
        {[['plans','My Plans'],['tracker','Confession Tracker']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{ ...c.tab, ...(activeTab === id ? c.tabActive : {}) }}
          >{label}</button>
        ))}
      </div>

      {/* ══ MY PLANS TAB ══ */}
      {activeTab === 'plans' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {isGuest && (
            <div style={c.guestNote}>
              🔒 Sign in to start and track your daily reading. Below is a preview of available plans.
            </div>
          )}

          {/* ── Global Settings Panel ── */}
          {config && !isGuest && (
            <div style={c.settingsWrap}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' }}>
                  Reading Settings
                </div>
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  style={c.settingsToggleBtn}
                >
                  {settingsOpen ? 'Close ↑' : 'Edit settings ↓'}
                </button>
              </div>

              {settingsOpen && (
                <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
                  {/* Reading mode (only for cyclic plans) */}
                  {activePlan?.cyclic && (
                    <div>
                      <div style={c.settingsLabel}>Reading mode</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                        {[
                          { v:'once', label:'Read through once',  hint:'One item per day until finished' },
                          { v:'year', label:'Complete in 1 year', hint:'Repeats items to fill all reading days in a year' },
                        ].map(opt => {
                          const selected = draftMode === opt.v
                          return (
                            <button
                              key={opt.v}
                              onClick={e => { e.preventDefault(); setDraftMode(opt.v) }}
                              style={{
                                display:'flex', alignItems:'flex-start', gap:10,
                                background: selected ? 'rgba(29,107,90,0.07)' : 'var(--surface)',
                                border: `1.5px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
                                borderRadius:8, padding:'10px 12px', cursor:'pointer',
                                textAlign:'left', width:'100%', transition:'all 0.15s',
                                fontFamily:"'DM Sans',sans-serif",
                              }}
                            >
                              <span style={{
                                width:18, height:18, borderRadius:'50%', flexShrink:0, marginTop:1,
                                border: `2px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
                                background: selected ? 'var(--teal)' : 'transparent',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                transition:'all 0.15s',
                              }}>
                                {selected && (
                                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                    <polyline points="1.5,4.5 3.5,6.5 7.5,2" stroke="white" strokeWidth="1.8"
                                      strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', lineHeight:1.3 }}>{opt.label}</div>
                                <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:2 }}>{opt.hint}</div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rest days */}
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

                  <div style={{ display:'flex', gap:8, marginTop:2 }}>
                    <button onClick={handleApplySettings} className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px' }}>Apply</button>
                    <button onClick={e => { e.preventDefault(); setSettingsOpen(false) }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Plan cards ── */}
          {CONF_PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isActive={config?.planId === plan.id}
              isGuest={isGuest}
              config={config?.planId === plan.id ? config   : null}
              progress={config?.planId === plan.id ? progress : null}
              onSelect={handleSelect}
              onAdvance={handleAdvance}
              onRetreat={handleRetreat}
              onStop={handleStop}
            />
          ))}
        </div>
      )}

      {/* ══ CONFESSION TRACKER TAB ══ */}
      {activeTab === 'tracker' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Summary row */}
          <div style={c.trackerSummary}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>
              Reading Progress
            </span>
            <span style={c.trackerBadge}>
              {confComplete} / {activeKeys.length} complete
            </span>
          </div>

          <p style={{ fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, margin:0 }}>
            Tracks how many items in each confession you've read through the daily devotional schedule.
          </p>

          {/* ConfCards */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {activeKeys.map(src => (
              <ConfCard key={src} src={src} stats={confStats[src] || { done:0, total:1, pct:0 }} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Styles ── */
const c = {
  /* Tab switcher — matches BibleTrackerSection style */
  tabs: {
    display:'flex', gap:4,
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:10, padding:3,
  },
  tab: {
    flex:1, padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer',
    fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
    color:'var(--ink-faint)', background:'none', transition:'all 0.15s',
  },
  tabActive: { background:'var(--surface)', color:'var(--teal)', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' },

  /* Tracker tab */
  trackerSummary: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
  },
  trackerBadge: {
    fontSize:11, fontWeight:700, background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'2px 9px',
  },

  /* Plan cards */
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

  /* Global settings panel */
  settingsWrap: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:8, padding:'10px 14px', marginBottom:4,
  },
  settingsToggleBtn: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'none', border:'1px solid rgba(29,107,90,0.3)',
    borderRadius:6, padding:'3px 8px', cursor:'pointer', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
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
    fontFamily:"'DM Sans',sans-serif",
  },
  guestNote: {
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:8, padding:'10px 14px', fontSize:12,
    color:'var(--ink-muted)', lineHeight:1.5,
  },
}
