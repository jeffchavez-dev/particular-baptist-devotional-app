/**
 * BibleTrackerSection
 * Two-tab layout:
 *   Tab A — "My Plan"    : configure and track the flexible reading plan
 *   Tab B — "Tracker"    : per-chapter checkboxes across all 1,189 chapters
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import BookCelebration from './BookCelebration'
import { BIBLE_BOOKS, TOTAL_CHAPTERS } from '../lib/bibleBooks'
import { getBibleProgress, setBibleChapter, BIBLE_KEY } from '../lib/supabase'
import { DAY_BIBLE } from '../data/readingPlan'
import { READING_PLANS, PLAN_BY_ID } from '../data/bibleReadingPlans'
import {
  getPlanConfig, getPlanProgress, savePlanProgress,
  computePlanChapters, getCurrentPlanChapters,
  isTodayRestDay, isPlanComplete, getPlanStats, getPlanCompletions,
  advancePlan, retreatPlan,
} from '../lib/biblePlan'
import {
  getAllPlans, getActivePlanId,
  createPlan, updatePlan, deletePlan,
  setActivePlan as setActivePlanFn,
  syncActivePlanFromLegacy,
} from '../lib/multiPlan'
import { useAuth } from '../App'

/* ── PLAN_BY_BOOK: books from the 365-day devotional schedule ── */
const PLAN_BY_BOOK = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([, chStr]) => {
    const match = chStr.match(/^(.+?)\s+(\d+)$/)
    if (!match) return
    const book = match[1], ch = parseInt(match[2])
    if (!m[book]) m[book] = []
    if (!m[book].includes(ch)) m[book].push(ch)
  })
  Object.keys(m).forEach(b => m[b].sort((a, z) => a - z))
  return m
})()

const BOOK_META = Object.fromEntries(BIBLE_BOOKS.map((b, i) => [b.name, { order: i, testament: b.testament, chapters: b.chapters }]))

const OT_CATEGORIES = [
  { id:'law',     label:'The Law',         color:'#7c5230', bg:'#fdf3e3', books:['Genesis','Exodus','Leviticus','Numbers','Deuteronomy'] },
  { id:'history', label:'History',         color:'#5a3e8c', bg:'#f0ecfa', books:['Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther'] },
  { id:'wisdom',  label:'Psalms & Wisdom', color:'#1d6b5a', bg:'#e4f0ec', books:['Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon'] },
  { id:'major',   label:'Major Prophets',  color:'#8c3e3e', bg:'#faeaea', books:['Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel'] },
  { id:'minor',   label:'Minor Prophets',  color:'#3e5a8c', bg:'#e8eefa', books:['Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'] },
]
const NT_CATEGORIES = [
  { id:'gospels', label:'Gospels',          color:'#1d6b5a', bg:'#e4f0ec', books:['Matthew','Mark','Luke','John'] },
  { id:'acts',    label:'History',          color:'#5a3e8c', bg:'#f0ecfa', books:['Acts'] },
  { id:'pauline', label:'Pauline Letters',  color:'#7c5230', bg:'#fdf3e3', books:['Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews'] },
  { id:'general', label:'General Epistles', color:'#3e5a8c', bg:'#e8eefa', books:['James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'] },
]

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
}

/* ─────────────── helpers ─────────────────────────────────── */
const DEFAULT_DRAFT = {
  name: 'My Plan',
  planId: 'whole-canonical',
  chaptersPerDay: 1,
  restDays: [],
  startBook: 'Genesis', startChapter: 1,
  endBook:   'Revelation', endChapter: 22,
  duration: 1,
}

function planToConfig(plan) {
  // Strip multi-plan metadata; keep config fields that biblePlan understands
  const { id: _i, name: _n, currentIndex: _c, lastAdvancedDate: _l, startedDate: _s, ...cfg } = plan
  return cfg
}
function planToProgress(plan) {
  return { currentIndex: plan.currentIndex ?? 0, lastAdvancedDate: plan.lastAdvancedDate ?? null }
}

/* ══════════════════════════════════════════════
   Guest locked state for Plan tab
   ══════════════════════════════════════════════ */
function PlanTabGuest() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:14,
      padding:'28px 16px', textAlign:'center',
    }}>
      <div style={{ fontSize:36 }}>🔒</div>
      <div style={{ fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' }}>
        Sign in to use My Plan
      </div>
      <div style={{ fontSize:12, color:'var(--ink-faint)', maxWidth:280, lineHeight:1.6 }}>
        Create named reading plans, track daily progress, and sync across devices. Sign in to unlock.
      </div>
      <div style={{
        background:'var(--parchment)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 16px', width:'100%', maxWidth:280,
        display:'flex', flexDirection:'column', gap:4, textAlign:'left',
      }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' }}>Default plan (guest)</div>
        <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' }}>Whole Bible</div>
        <div style={{ fontSize:11, color:'var(--ink-faint)' }}>All 1,189 chapters · 1 chapter / day · ~3.3 years</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Single plan card
   ══════════════════════════════════════════════ */
function PlanCard({
  plan, isActive, config, progress,
  todayChapters, isRest, isComplete, stats,
  confirmDel, onConfirmDel,
  onEdit, onDelete, onSetActive, onMarkDone, onRetreat, onReset,
}) {
  const preset    = PLAN_BY_ID[plan.planId]
  const today     = new Date().toISOString().slice(0, 10)
  const doneToday = progress?.lastAdvancedDate === today

  return (
    <div style={{ ...p.planCard, ...(isActive ? p.planCardActive : {}) }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={p.planName}>{plan.name}</span>
        {isActive && <span style={p.activeBadge}>ACTIVE</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
          {!isActive && (
            <button onClick={onSetActive} style={p.setActiveBtn}>Set active</button>
          )}
          <button onClick={onEdit} style={p.editBtn}>Edit</button>
          {confirmDel ? (
            <>
              <button onClick={onDelete}
                style={{ ...p.editBtn, color:'#b33', borderColor:'rgba(180,50,50,0.4)' }}>
                Delete?
              </button>
              <button onClick={() => onConfirmDel(null)} style={p.editBtn}>No</button>
            </>
          ) : (
            <button onClick={() => onConfirmDel(plan.id)}
              style={{ ...p.editBtn, color:'var(--ink-faint)' }}>✕</button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, fontSize:11, color:'var(--ink-faint)' }}>
        <span style={p.tag}>{preset?.label || 'Custom'}</span>
        <span style={p.tag}>{plan.chaptersPerDay} ch/day</span>
        {plan.restDays?.length > 0 && (
          <span style={p.tag}>Rest: {plan.restDays.map(d => DAY_NAMES[d]).join(', ')}</span>
        )}
        {plan.startedDate && (
          <span style={p.tag}>Started {fmtDate(plan.startedDate)}</span>
        )}
      </div>

      {/* Progress bar */}
      {stats && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontSize:11, color:'var(--ink-faint)' }}>{stats.done} / {stats.total} chapters</span>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--teal)' }}>{stats.pct}%</span>
          </div>
          <div style={{ height:6, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, background:'var(--teal)', width:`${stats.pct}%`, transition:'width 0.4s' }} />
          </div>
          {stats.projectedEnd && !isComplete && (
            <div style={{ fontSize:11, color:'var(--ink-faint)', textAlign:'right' }}>
              Est. finish: {fmtDate(stats.projectedEnd)}
            </div>
          )}
        </div>
      )}

      {/* Active plan: today's reading + mark done */}
      {isActive && (
        <>
          {isComplete && (
            <div style={p.completeBox}>🎉 Plan complete! {stats?.total} chapters finished.</div>
          )}
          {isRest && !isComplete && (
            <div style={p.restBox}>🛌 Rest day · No reading today</div>
          )}
          {!isComplete && !isRest && todayChapters && (
            <div style={p.todayBox}>
              <div style={p.todayLabel}>Today&apos;s reading</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4, marginBottom:8 }}>
                {todayChapters.map(ch => (
                  <span key={ch} style={p.todayChip}>{ch}</span>
                ))}
              </div>
              {doneToday ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>✓ Marked done</span>
                  <button onClick={onRetreat} style={p.undoBtn}>Undo</button>
                </div>
              ) : (
                <button onClick={onMarkDone} className="btn btn-primary" style={{ fontSize:12, padding:'6px 14px' }}>
                  Mark done ✓
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Reset link */}
      {isActive && !isComplete && (plan.currentIndex ?? 0) > 0 && (
        <button onClick={onReset} style={p.resetLink}>Reset progress</button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Plan editor panel (new or edit)
   ══════════════════════════════════════════════ */
function PlanEditorView({ draft, setDraft, duration, setDuration, isNew, onSave, onCancel }) {
  function patch(obj) { setDraft(prev => ({ ...prev, ...obj })) }

  const draftChapters  = useMemo(() => computePlanChapters(draft), [draft])
  const isPresetPlan   = draft.planId !== 'custom'
  const allBooks       = BIBLE_BOOKS.map(b => b.name)
  const startBookObj   = BIBLE_BOOKS.find(b => b.name === draft.startBook) || BIBLE_BOOKS[0]
  const endBookObj     = BIBLE_BOOKS.find(b => b.name === draft.endBook)   || BIBLE_BOOKS[BIBLE_BOOKS.length - 1]

  function calcCPD(total, years, restDays) {
    const rpw = 7 - (restDays || []).length
    if (rpw === 0 || years === 0) return 1
    const totalDays = Math.round(365 * rpw / 7) * years
    return Math.max(1, Math.ceil(total / totalDays))
  }
  function selectDuration(yr) {
    setDuration(yr)
    if (yr !== null && draftChapters.length > 0) {
      patch({ chaptersPerDay: calcCPD(draftChapters.length, yr, draft.restDays), duration: yr })
    }
  }

  /* Auto-recalc CPD when duration / rest days change */
  useEffect(() => {
    if (!isPresetPlan || duration === null) return
    patch({ chaptersPerDay: calcCPD(draftChapters.length, duration, draft.restDays), duration })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, draft.restDays?.join(','), draftChapters.length, isPresetPlan])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {!isNew && (
        <button onClick={onCancel} style={p.backBtn}>← Back to plans</button>
      )}

      <div style={p.editorCard}>
        {/* Plan name */}
        <div style={p.section}>
          <div style={p.sectionLabel}>Plan name</div>
          <input
            value={draft.name || ''}
            onChange={e => patch({ name: e.target.value })}
            placeholder="e.g. Family Reading, Personal Plan…"
            style={{ ...p.select, padding:'8px 10px' }}
          />
        </div>

        {/* Reading plan preset */}
        <div style={p.section}>
          <div style={p.sectionLabel}>Reading Plan</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {READING_PLANS.map(plan => (
              <label key={plan.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer' }}>
                <input
                  type="radio" name="planId" value={plan.id}
                  checked={draft.planId === plan.id}
                  onChange={() => {
                    patch({ planId: plan.id })
                    if (plan.id !== 'custom') setDuration(prev => prev ?? 1)
                    else setDuration(null)
                  }}
                  style={{ accentColor:'var(--teal)', flexShrink:0, width:15, height:15 }}
                />
                <span style={{ fontSize:13, fontWeight: draft.planId === plan.id ? 600 : 400, color: draft.planId === plan.id ? 'var(--ink)' : 'var(--ink-muted)' }}>
                  {plan.label}
                </span>
                <span style={{ fontSize:11, color:'var(--ink-faint)' }}>— {plan.description}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom range */}
        {draft.planId === 'custom' && (
          <div style={p.section}>
            <div style={p.sectionLabel}>Range</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'end', gap:10 }}>
              <div>
                <div style={p.fieldLabel}>Start book</div>
                <select value={draft.startBook} onChange={e => patch({ startBook: e.target.value, startChapter: 1 })} style={p.select}>
                  {allBooks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div style={{ marginTop:6 }}>
                  <div style={p.fieldLabel}>Chapter</div>
                  <select value={draft.startChapter} onChange={e => patch({ startChapter: parseInt(e.target.value) })} style={p.select}>
                    {Array.from({ length: startBookObj.chapters }, (_, i) => i + 1).map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>
              <span style={{ fontSize:18, color:'var(--ink-faint)', paddingBottom:4 }}>→</span>
              <div>
                <div style={p.fieldLabel}>End book</div>
                <select value={draft.endBook} onChange={e => patch({ endBook: e.target.value, endChapter: BIBLE_BOOKS.find(b => b.name === e.target.value)?.chapters || 1 })} style={p.select}>
                  {allBooks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div style={{ marginTop:6 }}>
                  <div style={p.fieldLabel}>Chapter</div>
                  <select value={draft.endChapter} onChange={e => patch({ endChapter: parseInt(e.target.value) })} style={p.select}>
                    {Array.from({ length: endBookObj.chapters }, (_, i) => i + 1).map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {draftChapters.length > 0 && (
              <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:6 }}>
                {draftChapters.length.toLocaleString()} chapters in this range
              </div>
            )}
          </div>
        )}

        {/* Duration / Pace */}
        <div style={p.section}>
          <div style={p.sectionLabel}>{isPresetPlan ? 'Duration' : 'Reading Pace'}</div>
          {isPresetPlan ? (
            <>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[1, 2, 3].map(yr => {
                  const cpd    = draftChapters.length > 0 ? calcCPD(draftChapters.length, yr, draft.restDays) : null
                  const active = duration === yr
                  return (
                    <button key={yr} onClick={() => selectDuration(yr)} style={{
                      ...p.durationBtn,
                      background:  active ? 'var(--teal)' : 'var(--surface)',
                      color:       active ? 'white' : 'var(--ink)',
                      borderColor: active ? 'var(--teal)' : 'var(--border)',
                    }}>
                      <span style={{ fontWeight:700 }}>{yr} yr{yr > 1 ? 's' : ''}</span>
                      {cpd && <span style={{ fontSize:10, opacity: active ? 0.85 : 0.6, display:'block' }}>~{cpd} ch/day</span>}
                    </button>
                  )
                })}
                <button onClick={() => selectDuration(null)} style={{
                  ...p.durationBtn,
                  background:  duration === null ? 'var(--teal)' : 'var(--surface)',
                  color:       duration === null ? 'white' : 'var(--ink)',
                  borderColor: duration === null ? 'var(--teal)' : 'var(--border)',
                }}>
                  <span style={{ fontWeight:700 }}>Custom</span>
                  <span style={{ fontSize:10, opacity: duration === null ? 0.85 : 0.6, display:'block' }}>set pace</span>
                </button>
              </div>
              {duration === null && (
                <select value={draft.chaptersPerDay} onChange={e => patch({ chaptersPerDay: parseInt(e.target.value) })} style={{ ...p.select, marginTop:4 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} chapter{n > 1 ? 's' : ''} / day</option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <select value={draft.chaptersPerDay} onChange={e => patch({ chaptersPerDay: parseInt(e.target.value) })} style={p.select}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} chapter{n > 1 ? 's' : ''} / day</option>
              ))}
            </select>
          )}
        </div>

        {/* Rest days */}
        <div style={p.section}>
          <div style={p.sectionLabel}>Rest Days</div>
          <div style={{ fontSize:11, color:'var(--ink-faint)', lineHeight:1.5 }}>
            Days when no reading is assigned. The plan skips these when calculating your daily chapter.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {DAY_NAMES.map((name, idx) => {
              const active = draft.restDays?.includes(idx)
              return (
                <button key={idx} onClick={() => {
                  const curr = draft.restDays || []
                  patch({ restDays: active ? curr.filter(d => d !== idx) : [...curr, idx] })
                }} style={{
                  ...p.dayBtn,
                  background:  active ? 'var(--border)' : 'var(--surface)',
                  color:       active ? 'var(--ink)' : 'var(--ink-faint)',
                  borderColor: active ? 'var(--ink-faint)' : 'var(--border)',
                  fontWeight:  active ? 700 : 400,
                }}>{name}</button>
              )
            })}
          </div>
        </div>

        {/* Duration estimate */}
        {draftChapters.length > 0 && (() => {
          const cpd        = draft.chaptersPerDay || 1
          const rest       = (draft.restDays || []).length
          const rpw        = 7 - rest
          const daysNeeded = rpw > 0 ? Math.ceil(draftChapters.length / (cpd * rpw) * 7) : 0
          const months     = daysNeeded > 0 ? (daysNeeded / 30).toFixed(1) : '—'
          return (
            <div style={p.estimate}>
              <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Estimated duration:</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>~{daysNeeded} days ({months} months)</span>
              <span style={{ fontSize:11, color:'var(--ink-faint)' }}>
                {draftChapters.length.toLocaleString()} chapters · {cpd} ch/day · {rpw} reading days/week
              </span>
            </div>
          )
        })()}

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button
            onClick={onSave}
            disabled={draftChapters.length === 0}
            style={{ ...p.startBtn, opacity: draftChapters.length === 0 ? 0.4 : 1 }}
          >
            {isNew ? 'Add plan' : 'Save changes'}
          </button>
          <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize:14 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Multi-plan PlanTab — splits guest vs. auth to
   avoid calling hooks conditionally (hooks rules).
   ══════════════════════════════════════════════ */
function PlanTab({ userId }) {
  // Keep PlanTab itself hook-free so the early branch never violates hook order.
  if (!userId) return <PlanTabGuest />
  return <PlanTabAuth userId={userId} />
}

function PlanTabAuth({ userId }) {
  /* ── State ── */
  const [plans,      setPlans]      = useState(() => getAllPlans())
  const [activeId,   setActiveId]   = useState(() => getActivePlanId())
  const [editorOpen, setEditorOpen] = useState(() => !getAllPlans().length)
  const [editingId,  setEditingId]  = useState(null) // null=creating new, string=editing existing
  const [draft,      setDraft]      = useState({ ...DEFAULT_DRAFT })
  const [duration,   setDuration]   = useState(1)
  const [confirmDel, setConfirmDel] = useState(null)
  const completions = useMemo(() => getPlanCompletions(), [plans])

  /* ── Sync: when devotional/scripture advance the plan, pull back into array ── */
  useEffect(() => {
    function onPlanChanged() {
      syncActivePlanFromLegacy()
      setPlans(getAllPlans())
      setActiveId(getActivePlanId())
    }
    function onPlansChanged() {
      setPlans(getAllPlans())
      setActiveId(getActivePlanId())
    }
    window.addEventListener('pb-plan-changed',  onPlanChanged)
    window.addEventListener('pb-plans-changed', onPlansChanged)
    return () => {
      window.removeEventListener('pb-plan-changed',  onPlanChanged)
      window.removeEventListener('pb-plans-changed', onPlansChanged)
    }
  }, [])

  /* ── Derived from active plan ── */
  const effectiveActiveId = activeId || plans[0]?.id || null
  const activePlan        = plans.find(p => p.id === effectiveActiveId) || plans[0] || null
  const activeConfig      = activePlan ? planToConfig(activePlan) : null
  const activeProgress    = activePlan ? planToProgress(activePlan) : null
  const todayChapters     = activeConfig ? getCurrentPlanChapters(activeConfig, activeProgress) : null
  const isRest            = activeConfig ? isTodayRestDay(activeConfig) : false
  const isComplete        = activeConfig ? isPlanComplete(activeConfig, activeProgress) : false

  /* ── Actions ── */
  function refresh() {
    setPlans(getAllPlans())
    setActiveId(getActivePlanId())
  }

  function openNewEditor() {
    setEditingId(null)
    setDraft({ ...DEFAULT_DRAFT })
    setDuration(1)
    setEditorOpen(true)
  }

  function openEditEditor(plan) {
    setEditingId(plan.id)
    const { id: _i, name: _n, currentIndex: _c, lastAdvancedDate: _l, startedDate: _s, ...cfg } = plan
    setDraft({ name: plan.name, ...cfg })
    setDuration(cfg.duration ?? (cfg.planId !== 'custom' ? 1 : null))
    setEditorOpen(true)
  }

  function handleSave() {
    const { name, ...cfg } = draft
    if (editingId) {
      updatePlan(editingId, { name: name || 'My Plan', ...cfg })
    } else {
      createPlan({ ...cfg }, name || 'My Plan')
    }
    setEditorOpen(false)
    setEditingId(null)
    refresh()
  }

  function handleDelete(id) {
    deletePlan(id)
    setConfirmDel(null)
    refresh()
  }

  function handleSetActive(id) {
    setActivePlanFn(id)
    refresh()
  }

  function handleMarkDone() {
    if (!activeConfig || !activeProgress) return
    const { progress: newProg } = advancePlan(activeConfig, activeProgress, userId)
    savePlanProgress(newProg)
    syncActivePlanFromLegacy()
    refresh()
  }

  function handleRetreat() {
    if (!activeConfig || !activeProgress) return
    const newProg = retreatPlan(activeConfig, activeProgress, userId)
    savePlanProgress(newProg)
    syncActivePlanFromLegacy()
    refresh()
  }

  function handleReset(planId) {
    updatePlan(planId, { currentIndex: 0, lastAdvancedDate: null })
    if (planId === effectiveActiveId) savePlanProgress({ currentIndex: 0, lastAdvancedDate: null })
    refresh()
  }

  /* ── Editor view ── */
  if (editorOpen) {
    return (
      <PlanEditorView
        draft={draft}
        setDraft={setDraft}
        duration={duration}
        setDuration={setDuration}
        isNew={!editingId}
        onSave={handleSave}
        onCancel={() => {
          setEditorOpen(false)
          setEditingId(null)
          if (!plans.length) setEditorOpen(true) // stay open if no plans
        }}
      />
    )
  }

  /* ── Plan list view ── */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {plans.length === 0 && (
        <div style={{ textAlign:'center', padding:'24px 16px', color:'var(--ink-faint)', fontSize:13 }}>
          No plans yet. Add your first reading plan below.
        </div>
      )}

      {plans.map(plan => {
        const isPlanActive = plan.id === effectiveActiveId
        const planConfig   = planToConfig(plan)
        const planProgress = planToProgress(plan)
        const planStats    = getPlanStats(planConfig, planProgress)
        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            isActive={isPlanActive}
            config={planConfig}
            progress={planProgress}
            todayChapters={isPlanActive ? todayChapters : null}
            isRest={isPlanActive ? isRest : false}
            isComplete={isPlanActive ? isComplete : false}
            stats={planStats}
            confirmDel={confirmDel === plan.id}
            onConfirmDel={setConfirmDel}
            onEdit={() => openEditEditor(plan)}
            onDelete={() => handleDelete(plan.id)}
            onSetActive={() => handleSetActive(plan.id)}
            onMarkDone={handleMarkDone}
            onRetreat={handleRetreat}
            onReset={() => handleReset(plan.id)}
          />
        )
      })}

      <button onClick={openNewEditor} style={p.addPlanBtn}>
        + Add reading plan
      </button>

      {/* Completion log */}
      {completions.length > 0 && (
        <div style={p.compLog}>
          <div style={p.compLogLabel}>Plan completions</div>
          {completions.map((c, i) => (
            <div key={c.id} style={p.compRow}>
              <span style={{ fontSize:18, flexShrink:0 }}>{i === 0 ? '🏆' : '📖'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--ink)' }}>{c.label}</div>
                {c.startedDate && (
                  <div style={{ fontSize:11, color:'var(--ink-faint)' }}>
                    {fmtDate(c.startedDate)} → {fmtDate(c.completedDate)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Tracker tab (existing chapter grid)
   ══════════════════════════════════════════════ */

function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)' }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif" }}>
          <strong>{done}</strong> / {total} <span style={{fontWeight:400, color:'var(--ink-faint)'}}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height:8, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--teal)', width:`${pct}%`, transition:'width 0.3s' }} />
      </div>
    </div>
  )
}

function ChBar({ done, total, color }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ height:5, borderRadius:99, background:'rgba(0,0,0,0.08)', overflow:'hidden', flex:1 }}>
      <div style={{ height:'100%', borderRadius:99, background: color, width:`${pct}%`, transition:'width 0.3s', opacity:0.85 }} />
    </div>
  )
}

function ChapterBlock({ chId, done, inPlan, onToggle }) {
  return (
    <button
      onClick={() => onToggle(chId, !done)}
      title={`${chId}${inPlan ? ' · in reading plan' : ''}${done ? ' · read' : ''}`}
      style={{
        width:30, height:30, borderRadius:5,
        border:`1.5px solid ${done ? 'var(--teal)' : inPlan ? 'rgba(29,107,90,0.35)' : 'var(--border)'}`,
        background: done ? 'var(--teal)' : inPlan ? 'var(--teal-light)' : 'var(--surface)',
        color: done ? 'white' : inPlan ? 'var(--teal)' : 'var(--ink-faint)',
        fontSize:10, fontWeight: done ? 700 : inPlan ? 600 : 400,
        cursor:'pointer', transition:'all 0.12s',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'DM Sans',sans-serif", flexShrink:0,
      }}
    >
      {chId.split(' ').pop()}
    </button>
  )
}

function CategoryBox({ cat, planByBook, bibBooks, progress, onToggle, isOpen, onOpenToggle }) {
  const bookNames = cat.books.filter(b => bibBooks.find(bk => bk.name === b))

  const { total, done, booksDone } = bookNames.reduce((acc, name) => {
    const bk = bibBooks.find(b => b.name === name)
    if (bk) {
      const doneChs = Array.from({length: bk.chapters}, (_, i) => i + 1)
        .filter(ch => progress[`${name} ${ch}`]).length
      acc.total += bk.chapters
      acc.done  += doneChs
      if (doneChs === bk.chapters) acc.booksDone += 1
    }
    return acc
  }, { total:0, done:0, booksDone:0 })

  if (total === 0) return null
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{...t.catBox, borderColor: isOpen ? cat.color : 'var(--border)', borderLeftColor: cat.color, borderLeftWidth: 3}}>
      <button style={{...t.catHeader, background: isOpen ? cat.bg : 'var(--surface)'}} onClick={onOpenToggle}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{...t.catLabel, color: cat.color}}>{cat.label}</span>
            <span style={{ fontSize:10, color:'var(--ink-faint)', flexShrink:0 }}>{bookNames.length} book{bookNames.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize:10, fontWeight:700, color: cat.color, flexShrink:0 }}>· {booksDone}/{bookNames.length} completed</span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ marginLeft:'auto', flexShrink:0, transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)' }}>
              <path d="M4 2.5l4.5 4.5L4 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
            <ChBar done={done} total={total} color={cat.color} />
            <span style={{ fontSize:9, color:'var(--ink-faint)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{pct}%</span>
          </div>
        </div>
      </button>
      {isOpen && (
        <div style={t.catBody}>
          {bookNames.map(name => {
            const planChs = planByBook[name] || []
            const bk = bibBooks.find(b => b.name === name)
            const chList = Array.from({length: bk?.chapters || 0}, (_, i) => i + 1).map(ch => ({
              ch, chId:`${name} ${ch}`,
              isDone: !!progress[`${name} ${ch}`],
              inPlan: planChs.includes(ch),
            }))
            const doneCnt = chList.filter(c => c.isDone).length
            return (
              <div key={name} style={t.catBookRow}>
                <div style={t.catBookHead}>
                  <span style={t.catBookName}>{name}</span>
                  <span style={t.catBookProgress}>{doneCnt}/{chList.length}</span>
                </div>
                <div style={t.chGrid}>
                  {chList.map(({ ch, chId, isDone, inPlan }) => (
                    <ChapterBlock key={ch} chId={chId} done={isDone} inPlan={inPlan} onToggle={onToggle} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TestamentSection({ testament, categories, bibBooks, progress, onToggle, openCats, setOpenCat }) {
  const isOT = testament === 'OT'
  const { total, done } = bibBooks.filter(b => b.testament === testament).reduce((acc, bk) => {
    acc.total += bk.chapters
    acc.done  += Array.from({length:bk.chapters},(_, i) => i + 1).filter(ch => progress[`${bk.name} ${ch}`]).length
    return acc
  }, { total:0, done:0 })

  const allBooks  = bibBooks.filter(b => b.testament === testament)
  const booksDone = allBooks.reduce((n, bk) => {
    const all = Array.from({length:bk.chapters},(_, i)=>i+1).every(ch=>progress[`${bk.name} ${ch}`])
    return n + (all ? 1 : 0)
  }, 0)

  const chPct    = total > 0 ? Math.round((done / total) * 100) : 0
  const barColor = isOT ? 'var(--amber-ink)' : 'var(--purple-ink)'

  return (
    <div style={t.testamentSection}>
      <div style={t.testamentHeader}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{
            ...t.testBadge,
            background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)',
            color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)',
          }}>{testament}</span>
          <span style={t.testamentLabel}>{isOT ? 'Old Testament' : 'New Testament'}</span>
          <span style={{ fontSize:12, fontWeight:700, color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)' }}>
            ({booksDone}/{allBooks.length})
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1, height:7, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, background:barColor, width:`${chPct}%`, transition:'width 0.3s', opacity:0.8 }} />
          </div>
          <span style={{ fontSize:10, color:'var(--ink-faint)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>
            {done}/{total} ch.
          </span>
        </div>
      </div>
      <div style={t.catGrid}>
        {categories.map(cat => (
          <CategoryBox
            key={cat.id} cat={cat}
            planByBook={PLAN_BY_BOOK} bibBooks={bibBooks}
            progress={progress}
            onToggle={onToggle}
            isOpen={openCats.has(cat.id)}
            onOpenToggle={() => setOpenCat(cat.id)}
          />
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════ */
export const PLAN_TOTAL = Object.values(PLAN_BY_BOOK).reduce((s, chs) => s + chs.length, 0)

export default function BibleTrackerSection() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [activeTab, setActiveTab] = useState(() => getPlanConfig() ? 'plan' : 'tracker')
  const [progress,  setProgress]  = useState(() => getBibleProgress())
  const [openCats,  setOpenCats]  = useState(new Set())
  const [celebration, setCelebration] = useState(null)

  useEffect(() => {
    function onStorage(e) {
      if (e.key === BIBLE_KEY) setProgress(getBibleProgress())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function setOpenCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  const toggleChapter = useCallback((chId, done) => {
    setBibleChapter(chId, done, userId)
    if (done) {
      const bookName = BIBLE_BOOKS.find(b => chId.startsWith(b.name + ' '))?.name
      if (bookName) {
        const bk = BIBLE_BOOKS.find(b => b.name === bookName)
        const fresh = getBibleProgress()
        const allDone = Array.from({ length: bk.chapters }, (_, i) => `${bookName} ${i + 1}`).every(id => fresh[id])
        if (allDone) setCelebration(bookName)
      }
    }
    setProgress(prev => { const next = { ...prev }; if (done) next[chId] = true; else delete next[chId]; return next })
  }, [userId])

  const bibleDone = Object.keys(progress).length

  return (
    <div style={t.wrap}>
      {celebration && <BookCelebration bookName={celebration} onClose={() => setCelebration(null)} />}

      {/* Tab switcher */}
      <div style={t.tabs}>
        {[['plan','My Plan'],['tracker','Chapter Tracker']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{ ...t.tab, ...(activeTab === id ? t.tabActive : {}) }}
          >{label}</button>
        ))}
      </div>

      {activeTab === 'plan' ? (
        <PlanTab userId={userId} />
      ) : (
        <div style={t.section}>
          <div style={t.progressCard}>
            <ProgressBar done={bibleDone} total={TOTAL_CHAPTERS} label="Bible chapters read" />
            <p style={t.progressNote}>
              Track your personal Bible reading progress across all {TOTAL_CHAPTERS} chapters.
              <span style={{marginLeft:8, display:'inline-flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
                <span style={t.legend}><span style={{...t.dot, background:'var(--teal)'}} />Read</span>
                <span style={t.legend}><span style={{...t.dot, background:'var(--teal-light)', border:'1.5px solid rgba(29,107,90,0.35)'}} />In plan</span>
                <span style={t.legend}><span style={{...t.dot, background:'var(--surface)', border:'1.5px solid var(--border)'}} />Unread</span>
              </span>
            </p>
          </div>
          <TestamentSection
            testament="OT" categories={OT_CATEGORIES} bibBooks={BIBLE_BOOKS}
            progress={progress} onToggle={toggleChapter}
            openCats={openCats} setOpenCat={setOpenCat}
          />
          <TestamentSection
            testament="NT" categories={NT_CATEGORIES} bibBooks={BIBLE_BOOKS}
            progress={progress} onToggle={toggleChapter}
            openCats={openCats} setOpenCat={setOpenCat}
          />
        </div>
      )}
    </div>
  )
}

/* ── Plan tab styles ── */
const p = {
  /* Multi-plan list */
  planCard: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:10,
  },
  planCardActive: {
    borderColor:'var(--teal)',
  },
  planName: {
    fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  activeBadge: {
    fontSize:9, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'white', background:'var(--teal)', borderRadius:99, padding:'2px 7px', flexShrink:0,
  },
  setActiveBtn: {
    fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
    background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.35)',
    cursor:'pointer', color:'var(--teal)', fontFamily:"'DM Sans',sans-serif",
  },
  addPlanBtn: {
    width:'100%', padding:'11px', borderRadius:8,
    background:'var(--parchment)', border:'1.5px dashed var(--border)',
    color:'var(--teal)', fontWeight:700, fontSize:13, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s',
  },
  undoBtn: {
    fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
    background:'var(--parchment)', border:'1px solid var(--border)',
    cursor:'pointer', color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
  },
  resetLink: {
    fontSize:11, color:'var(--ink-faint)', background:'none', border:'none',
    cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dashed',
    padding:0, fontFamily:"'DM Sans',sans-serif", alignSelf:'flex-start',
  },
  /* Legacy (still used by PlanCard actions) */
  editBtn: {
    fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6,
    background:'var(--parchment)', border:'1px solid var(--border)', cursor:'pointer',
    color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
  },
  todayBox: {
    background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.25)',
    borderRadius:8, padding:'10px 12px',
  },
  todayLabel: { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--teal)' },
  todayChip: {
    fontSize:14, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--teal)',
    background:'white', border:'1px solid rgba(29,107,90,0.2)', borderRadius:6, padding:'2px 10px',
  },
  restBox: {
    background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px',
    fontSize:13, color:'var(--ink-muted)', fontStyle:'italic',
  },
  completeBox: {
    background:'var(--teal-light)', border:'1.5px solid var(--teal)', borderRadius:8, padding:'10px 12px',
    fontSize:13, color:'var(--teal)', fontWeight:600,
  },
  tag: {
    fontSize:11, fontWeight:600, color:'var(--ink-faint)',
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:99, padding:'2px 8px',
  },
  stopBtn: {
    fontSize:11, fontWeight:600, color:'var(--rose)', background:'var(--rose-light)',
    border:'1px solid rgba(225,72,72,0.3)', borderRadius:6, padding:'6px 14px',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif", alignSelf:'flex-start',
  },
  compLog: {
    background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'12px 14px', display:'flex', flexDirection:'column', gap:10,
  },
  compLogLabel: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)' },
  compRow: { display:'flex', alignItems:'center', gap:10 },
  backBtn: {
    fontSize:12, fontWeight:600, color:'var(--teal)', background:'none', border:'none',
    cursor:'pointer', padding:'0 0 4px', textDecoration:'underline', textDecorationColor:'var(--teal)',
    fontFamily:"'DM Sans',sans-serif", textAlign:'left',
  },
  editorCard: {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'16px', display:'flex', flexDirection:'column', gap:18,
  },
  section: { display:'flex', flexDirection:'column', gap:10 },
  sectionLabel: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' },
  fieldLabel: { fontSize:11, color:'var(--ink-faint)', marginBottom:4 },
  select: {
    width:'100%', padding:'7px 10px', borderRadius:6, fontSize:12, fontWeight:500,
    border:'1.5px solid var(--border)', background:'var(--parchment)', color:'var(--ink)',
    fontFamily:"'DM Sans',sans-serif", outline:'none', cursor:'pointer',
  },
  durationBtn: {
    flex:1, minWidth:64, padding:'8px 10px', borderRadius:8, border:'1.5px solid', cursor:'pointer',
    fontSize:13, fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s',
    textAlign:'center', lineHeight:1.3,
  },
  dayBtn: {
    padding:'5px 10px', borderRadius:99, border:'1.5px solid', cursor:'pointer',
    fontSize:12, fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s',
  },
  estimate: {
    display:'flex', flexDirection:'column', gap:4,
    background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px',
  },
  startBtn: {
    padding:'11px', borderRadius:8, background:'var(--teal)', color:'white',
    border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
    fontFamily:"'DM Sans',sans-serif", transition:'opacity 0.15s',
  },
}

/* ── Tracker tab styles ── */
const t = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
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

  section: { display:'flex', flexDirection:'column', gap:16 },
  progressCard: {
    background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'14px 16px', display:'flex', flexDirection:'column', gap:10,
  },
  progressNote: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, margin:0, display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 },
  legend: { display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--ink-faint)' },
  dot: { display:'inline-block', width:11, height:11, borderRadius:3, flexShrink:0 },
  testamentSection: { marginBottom:8 },
  testamentHeader: { padding:'10px 0 10px', marginBottom:10, borderBottom:'2px solid var(--border)' },
  testamentLabel: { fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', flex:1 },
  testBadge: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },
  catGrid: { display:'flex', flexDirection:'column', gap:8 },
  catBox: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'border-color 0.15s',
  },
  catHeader: {
    display:'flex', alignItems:'stretch', padding:'10px 12px', width:'100%', textAlign:'left',
    border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'background 0.15s',
  },
  catLabel: { fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif", letterSpacing:'0.01em' },
  catBody: { padding:'8px 12px 12px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 },
  catBookRow: { display:'flex', flexDirection:'column', gap:6 },
  catBookHead: { display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 },
  catBookName: { fontSize:13, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  catBookProgress: { fontSize:10, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums', flexShrink:0 },
  chGrid: { display:'flex', flexWrap:'wrap', gap:4 },
}
