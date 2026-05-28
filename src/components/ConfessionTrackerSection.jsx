/**
 * ConfessionTrackerSection
 * Two-tab layout:
 *   Tab A — "My Plans"          : plan editor + locked active plan card
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
import { localDateStr } from '../lib/dateUtils'

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
   Guest locked state for My Plans tab
   ══════════════════════════════════════════════ */
function ConfPlanTabGuest() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:14,
      padding:'28px 16px', textAlign:'center',
    }}>
      <div style={{ fontSize:36 }}>🔒</div>
      <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' }}>
        Sign in to use My Plans
      </div>
      <div style={{ fontSize:12, color:'var(--ink-faint)', maxWidth:300, lineHeight:1.6 }}>
        Choose a confession reading plan, set your pace, and track daily progress. Sign in to unlock.
      </div>
      <div style={{
        background:'var(--parchment)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 16px', width:'100%', maxWidth:300,
        display:'flex', flexDirection:'column', gap:6, textAlign:'left',
      }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' }}>
          Available plans
        </div>
        {CONF_PLANS.map(plan => (
          <div key={plan.id}>
            <span style={{ fontSize:13, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' }}>
              {plan.label}
            </span>
            <span style={{ fontSize:11, color:'var(--ink-faint)', marginLeft:6 }}>
              — {plan.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Plan editor / selector
   (shown when no plan set yet, or when user clicks "Edit plan")
   ══════════════════════════════════════════════ */
function ConfPlanEditorView({
  draftPlanId, setDraftPlanId,
  draftMode,   setDraftMode,
  draftRest,   setDraftRest,
  isNew, onSave, onCancel,
}) {
  const selectedPlan = CONF_PLAN_BY_ID[draftPlanId]
  const isCyclic     = selectedPlan?.cyclic

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {!isNew && (
        <button onClick={onCancel} style={c.backBtn}>← Back to plan</button>
      )}

      <div style={c.editorCard}>

        {/* ── Plan selection ── */}
        <div>
          <div style={c.editorLabel}>Choose a plan</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
            {CONF_PLANS.map(plan => {
              const itemCount  = computeConfItems(plan.id).length
              const isSelected = draftPlanId === plan.id
              return (
                <label key={plan.id} style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  background: isSelected ? 'rgba(29,107,90,0.06)' : 'var(--surface)',
                  border: `1.5px solid ${isSelected ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius:8, padding:'12px 12px', cursor:'pointer',
                  transition:'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="conf-plan-draft"
                    value={plan.id}
                    checked={isSelected}
                    onChange={() => {
                      setDraftPlanId(plan.id)
                      // Default mode for the newly selected plan
                      const p = CONF_PLAN_BY_ID[plan.id]
                      if (p?.cyclic) setDraftMode(p.defaultMode || 'year')
                      else setDraftMode('once')
                    }}
                    style={{ accentColor:'var(--teal)', width:15, height:15, marginTop:2, flexShrink:0, cursor:'pointer' }}
                  />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' }}>
                      {plan.label}
                    </div>
                    <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:2, lineHeight:1.5 }}>
                      {plan.description} · {itemCount} items
                      {plan.cyclic && <span> · yearly cycle</span>}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* ── Reading mode (cyclic plans only) ── */}
        {isCyclic && (
          <div>
            <div style={c.editorLabel}>Reading mode</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
              {[
                { v:'year', label:'Complete in 1 year', hint:'Repeats items to fill all reading days in a year' },
                { v:'once', label:'Read through once',  hint:'One item per day until finished' },
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

        {/* ── Rest days ── */}
        <div>
          <div style={c.editorLabel}>
            Rest days{' '}
            <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>
              (no reading)
            </span>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
            {DAY_NAMES.map((d, i) => {
              const on = draftRest.includes(i)
              return (
                <button key={i} onClick={e => {
                  e.preventDefault()
                  setDraftRest(prev => on ? prev.filter(x => x !== i) : [...prev, i])
                }} style={{
                  ...c.dayBtn,
                  background:  on ? 'var(--teal)' : 'var(--surface)',
                  color:       on ? 'white'       : 'var(--ink-muted)',
                  borderColor: on ? 'var(--teal)' : 'var(--border)',
                }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={onSave} className="btn btn-primary" style={{ fontSize:13, padding:'8px 18px' }}>
            {isNew ? 'Start plan' : 'Save changes'}
          </button>
          {!isNew && (
            <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize:13, padding:'8px 14px' }}>
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Active locked plan card
   (shown after plan is saved / locked in)
   ══════════════════════════════════════════════ */
function ConfActivePlanCard({ config, progress, onEdit, onAdvance, onRetreat, onStop }) {
  const preset       = CONF_PLAN_BY_ID[config.planId]
  const [confirmStop, setConfirmStop] = useState(false)

  const todayStr  = localDateStr()
  const doneToday = progress?.lastAdvancedDate === todayStr
  const isRest    = isTodayConfRestDay(config)
  const complete  = isConfPlanComplete(config, progress)
  const stats     = getConfPlanStats(config, progress)

  // When done today, currentIndex has already advanced to the next item.
  // Resolve back to the item that was actually completed today so the card
  // shows "Today's reading ✓ Done — Article 1" rather than "✓ Done — Article 2".
  const todayItem = useMemo(() => {
    if (complete || isRest) return null
    if (doneToday && (progress?.currentIndex ?? 0) > 0) {
      const items = computeConfItems(config.planId)
      const completedIdx = (progress?.currentIndex ?? 0) - 1
      if (config.mode === 'year') return items[completedIdx % items.length] || null
      return items[completedIdx] || null
    }
    return getCurrentConfItem(config, progress)
  }, [config, progress, complete, isRest, doneToday])

  return (
    <div style={{ ...c.card, ...c.cardActive }}>

      {/* ── Header row ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={c.planName}>{preset?.label || config.planId}</span>
        <span style={c.activeBadge}>ACTIVE</span>
        <button onClick={onEdit} style={{ marginLeft:'auto', ...c.editBtn }}>Edit plan</button>
      </div>

      {/* ── Meta tags ── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
        {preset?.cyclic && (
          <span style={c.metaTag}>{config.mode === 'year' ? '1-year cycle' : 'Read once'}</span>
        )}
        {config.restDays?.length > 0 && (
          <span style={c.metaTag}>Rest: {config.restDays.map(d => DAY_NAMES[d]).join(', ')}</span>
        )}
        {config.startedDate && (
          <span style={c.metaTag}>Started {fmtDate(config.startedDate)}</span>
        )}
      </div>

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
  )
}

/* ══════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════ */
export default function ConfessionTrackerSection({ supabaseProgress = null }) {
  const { session } = useAuth()
  const isGuest = !session

  /* ── Core config / progress ── */
  const [config,   setConfig]   = useState(() => getConfPlanConfig())
  const [progress, setProgress] = useState(() => getConfPlanProgress())

  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState('plans')

  /* ── Editor state ── */
  const [editorOpen,   setEditorOpen]   = useState(() => !getConfPlanConfig())
  const [draftPlanId,  setDraftPlanId]  = useState(() => getConfPlanConfig()?.planId || CONF_PLANS[0]?.id)
  const [draftMode,    setDraftMode]    = useState(() => getConfPlanConfig()?.mode     || 'year')
  const [draftRest,    setDraftRest]    = useState(() => getConfPlanConfig()?.restDays || [])

  /* ── Confession tracker stats ── */
  const { stats: confStats, activeKeys, complete: confComplete } = useConfessionStats(supabaseProgress)

  /* ── Sync when config changes externally (other tabs, Dashboard retreat, etc.) ── */
  useEffect(() => {
    function onChanged() {
      const cfg = getConfPlanConfig()
      setConfig(cfg)
      setProgress(getConfPlanProgress())
      if (!cfg) {
        // Plan was cleared externally — reopen editor
        setEditorOpen(true)
        setDraftPlanId(CONF_PLANS[0]?.id)
        setDraftMode('year')
        setDraftRest([])
      }
    }
    window.addEventListener('pb-conf-plan-changed', onChanged)
    return () => window.removeEventListener('pb-conf-plan-changed', onChanged)
  }, [])

  /* ── Save / lock in the drafted plan ── */
  function handleSave() {
    const selectedPlan  = CONF_PLAN_BY_ID[draftPlanId]
    const switchingPlan = draftPlanId !== config?.planId
    const newConfig = {
      planId:      draftPlanId,
      mode:        selectedPlan?.cyclic ? draftMode : 'once',
      restDays:    draftRest,
      startedDate: (switchingPlan || !config?.startedDate)
        ? localDateStr()
        : config.startedDate,
    }
    saveConfPlanConfig(newConfig)
    if (switchingPlan) {
      resetConfPlanProgress()
      setProgress({ currentIndex: 0, lastAdvancedDate: null })
    }
    setConfig(newConfig)
    setEditorOpen(false)
  }

  /* ── Open editor pre-filled with current plan ── */
  function openEditor() {
    if (config) {
      setDraftPlanId(config.planId)
      setDraftMode(config.mode     || 'year')
      setDraftRest(config.restDays || [])
    }
    setEditorOpen(true)
  }

  /* ── Advance / retreat ── */
  function handleAdvance(e) {
    if (e) e.preventDefault()
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

  /* ── Stop / clear plan ── */
  function handleStop() {
    clearConfPlanConfig()
    resetConfPlanProgress()
    setConfig(null)
    setProgress({ currentIndex: 0, lastAdvancedDate: null })
    setEditorOpen(true)
    setDraftPlanId(CONF_PLANS[0]?.id)
    setDraftMode('year')
    setDraftRest([])
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

          {isGuest ? (
            /* ── Guest locked state ── */
            <ConfPlanTabGuest />

          ) : editorOpen ? (
            /* ── Editor / selector view ── */
            <ConfPlanEditorView
              draftPlanId={draftPlanId}  setDraftPlanId={setDraftPlanId}
              draftMode={draftMode}      setDraftMode={setDraftMode}
              draftRest={draftRest}      setDraftRest={setDraftRest}
              isNew={!config}
              onSave={handleSave}
              onCancel={() => setEditorOpen(false)}
            />

          ) : config ? (
            /* ── Locked active plan card ── */
            <ConfActivePlanCard
              config={config}
              progress={progress}
              onEdit={openEditor}
              onAdvance={handleAdvance}
              onRetreat={handleRetreat}
              onStop={handleStop}
            />

          ) : (
            /* ── No plan yet (edge case, editor should open by default) ── */
            <div style={{ textAlign:'center', padding:'28px 16px', color:'var(--ink-faint)', fontSize:13 }}>
              <div style={{ marginBottom:12 }}>No active plan. Choose one to start reading.</div>
              <button onClick={() => setEditorOpen(true)} className="btn btn-primary" style={{ fontSize:13 }}>
                Choose a plan
              </button>
            </div>
          )}

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
            Tracks how many items in each confession you&apos;ve read through the daily devotional schedule.
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
  /* Tab switcher */
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
  trackerSummary: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  trackerBadge: {
    fontSize:11, fontWeight:700, background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'2px 9px',
  },

  /* Active plan card */
  card: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:10,
    transition:'border-color 0.15s',
  },
  cardActive: { borderColor:'var(--teal)' },
  planName: {
    fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  activeBadge: {
    fontSize:9, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'white', background:'var(--teal)', borderRadius:99, padding:'2px 7px', flexShrink:0,
  },
  editBtn: {
    fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
    background:'var(--parchment)', border:'1px solid var(--border)', cursor:'pointer',
    color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
  },
  metaTag: {
    fontSize:11, color:'var(--ink-faint)', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:99, padding:'2px 8px',
  },

  /* Editor */
  backBtn: {
    fontSize:12, fontWeight:600, color:'var(--teal)', background:'none', border:'none',
    cursor:'pointer', padding:'0 0 4px', textDecoration:'underline', textDecorationColor:'var(--teal)',
    fontFamily:"'DM Sans',sans-serif", textAlign:'left',
  },
  editorCard: {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'16px',
    display:'flex', flexDirection:'column', gap:18,
  },
  editorLabel: {
    fontSize:11, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.07em', color:'var(--ink-faint)',
  },
  dayBtn: {
    width:38, height:30, borderRadius:8, border:'1.5px solid',
    fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Progress */
  barBg:   { height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' },
  barFill: { height:'100%', borderRadius:99, background:'var(--teal)', transition:'width 0.4s ease' },

  /* Status boxes */
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
}
