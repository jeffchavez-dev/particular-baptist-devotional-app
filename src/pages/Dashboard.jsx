import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBibleProgress, setBibleChapter, BIBLE_KEY, getTodayDayNum, setLocalProgress, supabase } from '../lib/supabase'
import { getPlanConfig, getPlanProgress, getCurrentPlanChapters, computePlanChapters, isTodayRestDay } from '../lib/biblePlan'
import {
  getConfPlanConfig, getConfPlanProgress,
  getCurrentConfItem, isConfPlanComplete, advanceConfPlan, retreatConfPlan,
  saveConfPlanProgress, isTodayConfRestDay, computeConfItems,
} from '../lib/confessionPlan'
import { LBCF2 }             from '../data/lbcf2'
import { CATECHISM }         from '../data/catechism'
import { LBCF1 }             from '../data/lbcf1'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import { useAuth, usePrefs } from '../App'
import { getFontCss }        from '../components/FontPrefsPanel'
import { saveScroll, restoreScroll } from '../lib/pageState'
import { localDateStr } from '../lib/dateUtils'
import { getMemorizeVerse, getMemorizeNote, clearMemorizeVerse, clearMemorizeNote,
         getMemorizeConf, clearMemorizeConf } from '../lib/memorize'
import { parseRefs } from '../lib/parseRefs'
import KjvModal from '../components/KjvModal'
import ShareCardModal from '../components/ShareCardModal'

/* ── Reflection localStorage ── */
const REFLECT_PREFIX = 'pb-reflection-'
function getTodayKey() { return REFLECT_PREFIX + localDateStr() }
function loadReflection() {
  try { return localStorage.getItem(getTodayKey()) || '' } catch { return '' }
}
function saveReflection(text) {
  try { localStorage.setItem(getTodayKey(), text) } catch {}
}

/* ── Full text resolver for a confession item ── */
function getConfItemText(item) {
  if (!item) return null
  if (item.planId === '2lbcf') {
    return LBCF2[item.key]?.text || null
  }
  if (item.planId === 'catechism') {
    const entry = CATECHISM[item.key]
    return entry ? `Q. ${entry.q}\n\nA. ${entry.a}` : null
  }
  if (item.planId === '1lbcf') {
    const entry = LBCF1[parseInt(item.key)]
    return entry?.text || null
  }
  if (item.planId === 'orthodox') {
    const entry = ORTHODOX_CATECHISM[item.key]
    return entry ? `Q. ${entry.q}\n\nA. ${entry.a}` : null
  }
  return null
}

/* ── Proof refs resolver for a confession item ── */
function getConfItemRefs(item) {
  if (!item) return null
  if (item.planId === '2lbcf')     return LBCF2[item.key]?.refs     || null
  if (item.planId === 'catechism') return CATECHISM[item.key]?.refs  || null
  if (item.planId === '1lbcf')     return LBCF1[parseInt(item.key)]?.refs || null
  if (item.planId === 'orthodox')  return ORTHODOX_CATECHISM[item.key]?.refs || null
  return null
}

/* ── Default items shown to guests / no-plan users ── */
const GUEST_SCRIPTURE = 'Genesis 1'
const GUEST_CONF_ITEM = { planId:'2lbcf', key:'1.1', label:'Ch. 1 §1' }
const GUEST_CONF_TEXT = LBCF2['1.1']?.text || ''

/* ── Small icon ── */
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="white" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════════════ */
export default function Dashboard() {
  const { session } = useAuth()
  const { prefs }   = usePrefs()
  const navigate    = useNavigate()
  const userId      = session?.user?.id ?? null

  /* ── Scroll save/restore ── */
  useEffect(() => {
    restoreScroll('dashboard')
    return () => saveScroll('dashboard')
  }, [])

  /* ── Bible plan ── */
  const [bibleConfig,   setBibleConfig]   = useState(() => getPlanConfig())
  const [bibleProgress, setBibleProgress] = useState(() => getPlanProgress())
  const [bibleProgress2, setBibleProgress2] = useState(() => getBibleProgress()) // chapter done map

  /* ── Confession plan ── */
  const [confConfig,   setConfConfig]   = useState(() => getConfPlanConfig())
  const [confProgress, setConfProgress] = useState(() => getConfPlanProgress())

  /* ── Memory slots ── */
  const [memorizeVerse, setMemorizeVerseState] = useState(() => getMemorizeVerse())
  const [memorizeNote,  setMemorizeNoteState]  = useState(() => getMemorizeNote())
  const [memorizeConf,  setMemorizeConfState]  = useState(() => getMemorizeConf())
  const [shareMemVerse, setShareMemVerse] = useState(false)
  const [shareMemNote,  setShareMemNote]  = useState(false)

  /* ── Reflection ── */
  const [reflection,    setReflection]    = useState(() => loadReflection())
  const reflectTimer = useRef(null)
  function onReflectionChange(text) {
    setReflection(text)
    clearTimeout(reflectTimer.current)
    reflectTimer.current = setTimeout(() => saveReflection(text), 600)
  }

  /* ── UI state ── */
  const [confTextExpanded, setConfTextExpanded] = useState(false)
  const [reflectionSaved, setReflectionSaved] = useState(false)
  const [kjvModal, setKjvModal] = useState(null)   // { book, chapter, verse, refDisplay }

  /* ── Navigate to a specific scripture chapter ── */
  function goToScripture(ch) {
    // ch may be "Genesis 1" or "1 Kings 5" — use lastIndexOf to split
    const spaceIdx = ch.lastIndexOf(' ')
    const book    = ch.slice(0, spaceIdx)
    const chapter = parseInt(ch.slice(spaceIdx + 1), 10)
    navigate('/scripture', { state: { book, chapter } })
  }

  /* ── Save today's reflection to Devotional Notes ── */
  function handleSaveReflection() {
    if (!reflection.trim()) return
    const dayNum = getTodayDayNum()
    const text   = reflection.trim()
    // Save locally first — instant, works offline
    setLocalProgress(dayNum, { notes: text })
    // Notify LibraryPage to refresh its devNotes list
    window.dispatchEvent(new CustomEvent('pb-progress-updated'))
    // Sync to Supabase if signed in
    if (session) {
      supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: dayNum,
        notes: text,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' }).catch(() => {})
    }
    setReflectionSaved(true)
    setTimeout(() => setReflectionSaved(false), 3000)
  }

  /* ── Open a Settings CollapseSection ── */
  function openSettingsSection(id) {
    try { sessionStorage.setItem(`pb-settings-${id}`, '1') } catch {}
    navigate('/about')
  }

  /* ── Sync plan changes fired by BibleTrackerSection / App bridge ── */
  useEffect(() => {
    function onPlanChanged() {
      setBibleConfig(getPlanConfig())
      setBibleProgress(getPlanProgress())
    }
    function onBibleKey(e) {
      if (e.key === BIBLE_KEY)                setBibleProgress2(getBibleProgress())
      if (e.key === 'pb-conf-plan-progress')  setConfProgress(getConfPlanProgress())
      if (e.key === 'pb-conf-plan-config')    setConfConfig(getConfPlanConfig())
    }
    function onConfChanged() {
      setConfConfig(getConfPlanConfig())
      setConfProgress(getConfPlanProgress())
    }
    window.addEventListener('pb-plan-changed',      onPlanChanged)
    window.addEventListener('pb-plans-changed',     onPlanChanged)
    window.addEventListener('storage',              onBibleKey)
    window.addEventListener('pb-conf-plan-changed', onConfChanged)
    return () => {
      window.removeEventListener('pb-plan-changed',      onPlanChanged)
      window.removeEventListener('pb-plans-changed',     onPlanChanged)
      window.removeEventListener('storage',              onBibleKey)
      window.removeEventListener('pb-conf-plan-changed', onConfChanged)
    }
  }, [])

  /* Keep memorize slots in sync */
  useEffect(() => {
    function sync() {
      setMemorizeVerseState(getMemorizeVerse())
      setMemorizeNoteState(getMemorizeNote())
      setMemorizeConfState(getMemorizeConf())
    }
    window.addEventListener('pb-memorize-changed', sync)
    return () => window.removeEventListener('pb-memorize-changed', sync)
  }, [])

  /* ── Shared date string (local timezone, not UTC) ── */
  const todayStr = localDateStr()

  /* ── Derived: scripture ── */
  const todayChapters  = bibleConfig ? getCurrentPlanChapters(bibleConfig, bibleProgress) : null
  const bibleDoneToday = bibleProgress?.lastAdvancedDate === todayStr
  const cpd            = bibleConfig?.chaptersPerDay || 1

  /**
   * When the user just checked all today's chapters, bibleProgress.currentIndex
   * has already advanced to the NEXT day's reading. bibleDisplayChapters resolves
   * back to the chapters that were completed today so the view stays on
   * "Day 1 ✓ done" rather than jumping to "Day 2" immediately.
   * The day resets to the new assignment when the calendar date changes.
   */
  const bibleDisplayChapters = useMemo(() => {
    if (!bibleConfig) return null
    if (bibleDoneToday) {
      const completedStartIdx = (bibleProgress?.currentIndex ?? 0) - cpd
      if (completedStartIdx < 0) return null
      const allChapters = computePlanChapters(bibleConfig)
      const result = []
      for (let i = 0; i < cpd; i++) {
        const ch = allChapters[completedStartIdx + i]
        if (ch) result.push(ch)
      }
      return result.length ? result : null
    }
    return todayChapters
  }, [bibleConfig, bibleDoneToday, bibleProgress?.currentIndex, cpd, todayChapters])

  const bibleRestDay    = bibleConfig ? isTodayRestDay(bibleConfig) : false
  const hasActiveBible  = !!bibleConfig && !!bibleDisplayChapters && !bibleRestDay
  // Display index = first chapter index of the day being shown (today or just-completed day)
  const bibleDisplayIdx = bibleDoneToday
    ? Math.max(0, (bibleProgress?.currentIndex ?? 0) - cpd)
    : (bibleProgress?.currentIndex ?? 0)
  // Day number = which reading day we're on (1-based, accounts for multi-chapter days)
  const bibleDay       = bibleConfig ? Math.floor(bibleDisplayIdx / cpd) + 1 : 1
  // Total days = total chapters ÷ chapters-per-day
  const bibleTotalDays = bibleConfig ? Math.ceil(computePlanChapters(bibleConfig).length / cpd) : 0

  /* ── Derived: confession ── */
  const confComplete  = confConfig ? isConfPlanComplete(confConfig, confProgress) : false
  const confRestDay   = confConfig ? isTodayConfRestDay(confConfig) : false
  const confItem      = (confConfig && !confComplete && !confRestDay) ? getCurrentConfItem(confConfig, confProgress) : null
  const hasActiveConf = !!confConfig && !confComplete && !confRestDay && !!confItem
  const confDoneToday = confProgress?.lastAdvancedDate === todayStr
  // When done today, show the day that was just completed (currentIndex − 1), not the next day
  const confDay       = confDoneToday
    ? (confProgress?.currentIndex ?? 0)
    : (confProgress?.currentIndex ?? 0) + 1

  /**
   * When the user just marked today's item done, confItem points to the NEXT
   * unread item (currentIndex already incremented), which would wrongly appear
   * as "already done". confDisplayItem resolves to the item that was actually
   * completed today (currentIndex − 1) so the UI stays in sync.
   */
  const confDisplayItem = useMemo(() => {
    if (!confConfig || confComplete || confRestDay) return null
    if (confDoneToday && (confProgress?.currentIndex ?? 0) > 0) {
      const items = computeConfItems(confConfig.planId)
      const completedIdx = (confProgress?.currentIndex ?? 0) - 1
      if (confConfig.mode === 'year') return items[completedIdx % items.length] || null
      return items[completedIdx] || null
    }
    return confItem
  }, [confConfig, confComplete, confRestDay, confDoneToday, confProgress?.currentIndex, confItem])

  const confText     = confDisplayItem ? getConfItemText(confDisplayItem) : null
  const confItemRefs = confDisplayItem ? getConfItemRefs(confDisplayItem) : null

  /* ── Toggle a Bible chapter done/undone ── */
  const toggleChapter = useCallback((ch) => {
    const done = !!bibleProgress2[ch]
    setBibleChapter(ch, !done, userId)
    setBibleProgress2(prev => {
      const next = { ...prev }
      if (!done) next[ch] = true
      else delete next[ch]
      return next
    })
  }, [bibleProgress2, userId])

  /* ── Confession: mark done / undo ── */
  function handleConfAdvance() {
    if (!confConfig || !confProgress) return
    const { progress: newProg } = advanceConfPlan(confConfig, confProgress)
    saveConfPlanProgress(newProg)
    setConfProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }
  function handleConfRetreat() {
    if (!confProgress) return
    const newProg = retreatConfPlan(confProgress)
    saveConfPlanProgress(newProg)
    setConfProgress(newProg)
    window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
  }

  /* ── Guest default text expanded ── */
  const [guestTextExpanded, setGuestTextExpanded] = useState(false)

  return (
    <>
    <div style={s.page}>
      <main style={s.main}>

        {/* ════════════════════════════════════════
            TODAY'S READING header
            ════════════════════════════════════════ */}
        <div style={s.todayHeader}>
          <span style={s.todayHeaderLabel}>Today&apos;s Reading</span>
          <span style={s.todayHeaderDate}>{new Date().toLocaleDateString(undefined, { weekday:'short', month:'long', day:'numeric' })}</span>
        </div>

        {/* ════════════════════════════════════════
            SCRIPTURE section
            ════════════════════════════════════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>📖</span>
            <span style={s.sectionTitle}>Scripture</span>
            {hasActiveBible && (
              <span style={s.sectionMeta}>Day {bibleDay}{bibleTotalDays ? ` of ${bibleTotalDays}` : ''}</span>
            )}
          </div>

          {bibleRestDay ? (
            <div style={s.readingCard}>
              <div style={s.restNote}>🛌 Rest day — no reading today</div>
            </div>
          ) : hasActiveBible ? (
            <div style={s.readingCard}>
              {bibleDisplayChapters.map(ch => {
                const done = !!bibleProgress2[ch]
                return (
                  <div key={ch} style={s.assignedRow}>
                    <button
                      onClick={() => toggleChapter(ch)}
                      style={{ ...s.checkBtn, ...(done ? s.checkBtnDone : {}) }}
                      aria-label={done ? 'Mark unread' : 'Mark read'}
                    >
                      {done && <CheckIcon />}
                    </button>
                    <span style={{ ...s.chapterName, ...(done ? s.chapterDone : {}) }}>{ch}</span>
                    <button
                      onClick={() => goToScripture(ch)}
                      style={s.readLink}
                    >
                      Read →
                    </button>
                  </div>
                )
              })}
              {bibleDoneToday && (
                <div style={{ fontSize:11, color:'var(--teal)', fontWeight:600, paddingTop:2 }}>
                  ✓ All done for today — next reading shows tomorrow
                </div>
              )}
            </div>
          ) : (
            <div style={s.noPlanCard}>
              {/* Guest / no plan default */}
              <div style={s.assignedRow}>
                <div style={{ ...s.checkBtn, cursor:'default', opacity:0.4 }} />
                <span style={s.chapterName}>{GUEST_SCRIPTURE}</span>
                <button
                  onClick={() => navigate('/scripture', { state: { book: 'Genesis', chapter: 1 } })}
                  style={s.readLink}
                >
                  Read →
                </button>
              </div>
              <div style={s.noPlanNote}>
                {session
                  ? 'No active reading plan. Set one up in '
                  : 'Sign in to track progress. Default showing — '}
                {session
                  ? <button onClick={() => openSettingsSection('bible-tracker')} style={s.inlineLink}>Settings → Bible Tracker</button>
                  : <button onClick={() => navigate('/auth')} style={s.inlineLink}>sign in</button>
                }
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            CONFESSION / CATECHISM section
            ════════════════════════════════════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>📜</span>
            <span style={s.sectionTitle}>Confession &amp; Catechism</span>
            {hasActiveConf && (
              <span style={s.sectionMeta}>Day {confDay}</span>
            )}
          </div>

          {hasActiveConf ? (
            <div style={s.readingCard}>
              {/* Item row */}
              <div style={s.assignedRow}>
                <button
                  onClick={confDoneToday ? handleConfRetreat : handleConfAdvance}
                  style={{ ...s.checkBtn, ...(confDoneToday ? s.checkBtnDone : {}) }}
                  aria-label={confDoneToday ? 'Mark unread' : 'Mark read'}
                >
                  {confDoneToday && <CheckIcon />}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ ...s.chapterName, ...(confDoneToday ? s.chapterDone : {}) }}>
                    {confDisplayItem?.label}
                  </span>
                  {confDisplayItem?.title && (
                    <div style={{ fontSize:12, color:'var(--ink-faint)', fontStyle:'italic', marginTop:1 }}>
                      {confDisplayItem.title}
                    </div>
                  )}
                  {confDisplayItem?.q && (
                    <div style={{ fontSize:12, color:'var(--ink-muted)', marginTop:2, lineHeight:1.45 }}>
                      Q: {confDisplayItem.q}
                    </div>
                  )}
                </div>
                {confDoneToday && (
                  <span style={{ fontSize:11, color:'var(--teal)', fontWeight:600, flexShrink:0 }}>✓ Done</span>
                )}
              </div>

              {/* Full text */}
              {confText && (
                <div style={s.confTextWrap}>
                  <p style={{
                    ...s.confText,
                    fontSize: prefs.sizePx,
                    fontFamily: getFontCss(prefs.fontId),
                    WebkitLineClamp: confTextExpanded ? 'unset' : 5,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    overflow: confTextExpanded ? 'visible' : 'hidden',
                  }}>
                    {confText}
                  </p>
                  <button onClick={() => setConfTextExpanded(e => !e)} style={s.seeMoreBtn}>
                    {confTextExpanded ? 'Show less ↑' : 'Show more ↓'}
                  </button>
                  {confItemRefs && (
                    <div style={s.proofsWrap}>
                      <span style={s.proofsLabel}>Proof texts:</span>
                      <div style={s.proofsChips}>
                        {parseRefs(confItemRefs).map(({ book, chapter, verse, display }) => (
                          <button
                            key={`${book}|${chapter}|${verse ?? 0}`}
                            style={s.proofChip}
                            onClick={() => setKjvModal({ book, chapter, verse: verse ?? null, refDisplay: display })}
                          >
                            {display}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : confComplete ? (
            <div style={s.readingCard}>
              <div style={s.completeNote}>🎉 Confession plan complete!</div>
            </div>
          ) : confRestDay ? (
            <div style={s.readingCard}>
              <div style={s.restNote}>📅 Rest day — no confession reading today</div>
            </div>
          ) : (
            /* Guest / no confession plan */
            <div style={s.noPlanCard}>
              <div style={s.assignedRow}>
                <div style={{ ...s.checkBtn, cursor:'default', opacity:0.4 }} />
                <span style={s.chapterName}>{GUEST_CONF_ITEM.label} — 2nd London Confession</span>
              </div>
              {/* Full text preview */}
              {GUEST_CONF_TEXT && (
                <div style={s.confTextWrap}>
                  <p style={{
                    ...s.confText,
                    fontSize: prefs.sizePx,
                    fontFamily: getFontCss(prefs.fontId),
                    WebkitLineClamp: guestTextExpanded ? 'unset' : 5,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    overflow: guestTextExpanded ? 'visible' : 'hidden',
                  }}>
                    {GUEST_CONF_TEXT}
                  </p>
                  <button onClick={() => setGuestTextExpanded(e => !e)} style={s.seeMoreBtn}>
                    {guestTextExpanded ? 'Show less ↑' : 'Show more ↓'}
                  </button>
                </div>
              )}
              <div style={s.noPlanNote}>
                {session
                  ? <>Set up a plan in <button onClick={() => openSettingsSection('confession-tracker')} style={s.inlineLink}>Settings → Confession Tracker</button></>
                  : <><button onClick={() => navigate('/auth')} style={s.inlineLink}>Sign in</button> to track your confession reading</>
                }
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            REFLECTION box
            ════════════════════════════════════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>✍</span>
            <span style={s.sectionTitle}>Reflection</span>
            {reflection.trim() && (
              <button onClick={handleSaveReflection} style={s.saveReflectBtn}>
                {reflectionSaved ? '✓ Saved to Library' : '+ Save to Library'}
              </button>
            )}
          </div>
          <textarea
            value={reflection}
            onChange={e => onReflectionChange(e.target.value)}
            placeholder="What did today's reading stir in you? Jot a prayer, question, or insight..."
            style={{ ...s.reflectBox, fontFamily: getFontCss(prefs.fontId), fontSize: prefs.sizePx }}
          />
        </div>

        {/* ════════════════════════════════════════
            TRACKER LINKS (signed-in only)
            ════════════════════════════════════════ */}
        {session && (
          <div style={s.trackerLinks}>
            <button onClick={() => openSettingsSection('bible-tracker')} style={s.trackerLink}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0 }}>
                <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 6.5h5M7 4.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Bible Reading Plans
            </button>
            <button onClick={() => openSettingsSection('confession-tracker')} style={s.trackerLink}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0 }}>
                <path d="M2 2.5A1 1 0 013 1.5h7a1 1 0 011 1v9l-4.5-2-4.5 2V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              Confession Tracker
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════
            MEMORY section (unchanged)
            ════════════════════════════════════════ */}
        {(memorizeVerse || memorizeNote || memorizeConf) && (
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
                  <button style={s.memorizeShareBtn} onClick={() => setShareMemVerse(true)} title="Share">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="3"  cy="6.5"  r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M4.4 5.8l4.2-2.8M4.4 7.2l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button style={s.memorizeClearBtn} onClick={() => { clearMemorizeVerse(); setMemorizeVerseState(null) }} title="Remove">×</button>
                </div>
                <p style={{ ...s.memorizeText, fontFamily: getFontCss(prefs.fontId), fontSize: prefs.sizePx }}>
                  {memorizeVerse.text}
                </p>
              </div>
            )}

            {memorizeNote && (
              <div style={{ ...s.memorizeCard, borderLeftColor: memorizeNote.type === 'quote' ? '#d4a84c' : 'var(--teal)' }}>
                <div style={s.memorizeCardTop}>
                  <span style={{ ...s.memorizeTypeBadge,
                    color:      memorizeNote.type === 'quote' ? '#b8860b' : 'var(--teal)',
                    background: memorizeNote.type === 'quote' ? 'rgba(212,168,76,0.1)' : 'rgba(0,139,139,0.08)',
                  }}>
                    {memorizeNote.type === 'quote' ? '❝ Quote' : '✍ Note'}
                  </span>
                  <span style={s.memorizeRef}>{memorizeNote.bookTitle}</span>
                  {memorizeNote.bookAuthor && <span style={s.memorizeVersion}>{memorizeNote.bookAuthor}</span>}
                  <button style={s.memorizeShareBtn} onClick={() => setShareMemNote(true)} title="Share">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="10" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="10" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <circle cx="3"  cy="6.5"  r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M4.4 5.8l4.2-2.8M4.4 7.2l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button style={s.memorizeClearBtn} onClick={() => { clearMemorizeNote(); setMemorizeNoteState(null) }} title="Remove">×</button>
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

            {memorizeConf && (
              <div style={{ ...s.memorizeCard, borderLeftColor: '#7c5cbf' }}>
                <div style={s.memorizeCardTop}>
                  <span style={{ ...s.memorizeTypeBadge, color:'#7c5cbf', background:'rgba(124,92,191,0.1)' }}>
                    📜 Confession
                  </span>
                  <span style={s.memorizeRef}>{memorizeConf.label}</span>
                  {memorizeConf.source && (
                    <span style={s.memorizeVersion}>{memorizeConf.source}</span>
                  )}
                  <button style={s.memorizeClearBtn} onClick={() => { clearMemorizeConf(); setMemorizeConfState(null) }} title="Remove">×</button>
                </div>
                <p style={{ ...s.memorizeText, fontFamily: getFontCss(prefs.fontId), fontSize: prefs.sizePx, whiteSpace:'pre-wrap' }}>
                  {memorizeConf.text}
                </p>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerText}>Created by Jeff Chavez with Claude Code</span>
          <span style={s.footerDot}>·</span>
          <a href="https://theologycheck.blog" target="_blank" rel="noopener noreferrer" style={s.footerLink}>
            <img src="https://theologycheckblog.wordpress.com/wp-content/uploads/2022/02/tc-logo.png"
              alt="TheologyCheck" style={{ height:18, verticalAlign:'middle', marginRight:5 }} />
            theologycheck.blog
          </a>
        </div>
      </footer>
    </div>

    {shareMemVerse && memorizeVerse && (
      <ShareCardModal isOpen onClose={() => setShareMemVerse(false)}
        card={{ type:'reading', title:memorizeVerse.ref, subtitle:memorizeVerse.version,
          source:memorizeVerse.version, text:memorizeVerse.text, label:'' }} />
    )}
    {shareMemNote && memorizeNote && (
      <ShareCardModal isOpen onClose={() => setShareMemNote(false)}
        card={{ type: memorizeNote.type === 'quote' ? 'book_quote' : 'book_note',
          noteType:memorizeNote.type, text:memorizeNote.text, bookTitle:memorizeNote.bookTitle,
          bookAuthor:memorizeNote.bookAuthor, bookLabels:null,
          page:memorizeNote.page, percent:memorizeNote.percent }} />
    )}
    {kjvModal && (
      <KjvModal
        book={kjvModal.book}
        chapter={kjvModal.chapter}
        verse={kjvModal.verse}
        refDisplay={kjvModal.refDisplay}
        onClose={() => setKjvModal(null)}
      />
    )}
    </>
  )
}

/* ── Styles ── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", paddingTop:'env(safe-area-inset-top)' },
  main: { maxWidth:720, margin:'0 auto', padding:'2rem 20px 3rem' },

  /* Today header */
  todayHeader: { display:'flex', alignItems:'baseline', gap:10, marginBottom:'1.5rem' },
  todayHeaderLabel: { fontSize:20, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)' },
  todayHeaderDate:  { fontSize:13, color:'var(--ink-faint)' },

  /* Section */
  section: { marginBottom:'1.25rem' },
  sectionHeader: {
    display:'flex', alignItems:'center', gap:7, marginBottom:8,
  },
  sectionIcon:  { fontSize:15, flexShrink:0 },
  sectionTitle: { fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--ink-faint)', flex:1 },
  sectionMeta:  { fontSize:11, color:'var(--ink-faint)', background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 8px' },

  /* Reading card */
  readingCard: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:10,
  },
  noPlanCard: {
    background:'var(--surface)', border:'1.5px dashed var(--border)',
    borderRadius:'var(--radius-lg)', padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:10,
    opacity:0.85,
  },

  /* Assigned reading row */
  assignedRow: { display:'flex', alignItems:'flex-start', gap:10 },
  checkBtn: {
    width:20, height:20, borderRadius:5, border:'1.5px solid var(--border-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.15s', background:'var(--surface)',
    cursor:'pointer', marginTop:1,
  },
  checkBtnDone: { background:'var(--teal)', borderColor:'var(--teal)' },
  chapterName: { fontSize:15, fontWeight:600, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', flex:1 },
  chapterDone: { textDecoration:'line-through', opacity:0.5 },
  readLink: {
    fontSize:12, color:'var(--teal)', fontWeight:600, background:'none',
    border:'none', cursor:'pointer', padding:0, flexShrink:0, marginTop:2,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Confession text */
  confTextWrap: { borderTop:'1px solid var(--border)', paddingTop:10 },
  confText: {
    fontSize:15, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.85,
    color:'var(--ink)', margin:'0 0 8px', whiteSpace:'pre-wrap',
  },
  seeMoreBtn: {
    background:'none', border:'none', cursor:'pointer', fontSize:12,
    color:'var(--teal)', fontWeight:600, padding:0,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Proof texts */
  proofsWrap:  { display:'flex', alignItems:'flex-start', gap:6, flexWrap:'wrap', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' },
  proofsLabel: { fontSize:10, fontWeight:700, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0, paddingTop:4 },
  proofsChips: { display:'flex', flexWrap:'wrap', gap:4 },
  proofChip: {
    fontSize:11, fontWeight:500, color:'var(--teal)',
    background:'var(--teal-light)', border:'1px solid transparent',
    borderRadius:99, padding:'3px 9px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.4,
  },

  /* Status notices */
  completeNote: { fontSize:13, color:'var(--teal)', fontWeight:600 },
  restNote:     { fontSize:13, color:'var(--ink-muted)', fontStyle:'italic' },
  noPlanNote:   { fontSize:12, color:'var(--ink-faint)', lineHeight:1.6 },
  inlineLink: {
    background:'none', border:'none', color:'var(--teal)', fontWeight:600,
    cursor:'pointer', padding:0, fontSize:12, fontFamily:"'DM Sans',sans-serif",
    textDecoration:'underline',
  },

  /* Save reflection button */
  saveReflectBtn: {
    marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'none', border:'1px solid rgba(29,107,90,0.3)',
    borderRadius:6, padding:'3px 8px', cursor:'pointer', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Reflection */
  reflectBox: {
    width:'100%', minHeight:110, padding:'12px 14px',
    border:'1.5px solid var(--border)', borderRadius:'var(--radius-lg)',
    background:'var(--surface)', color:'var(--ink)',
    fontSize:14, lineHeight:1.7, resize:'vertical',
    outline:'none', boxSizing:'border-box',
    fontFamily:"'Cormorant Garamond',serif",
    transition:'border-color 0.15s',
  },

  /* Tracker links */
  trackerLinks: {
    display:'flex', gap:8, flexWrap:'wrap', marginBottom:'1.5rem',
  },
  trackerLink: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:12, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', border:'1px solid rgba(29,107,90,0.25)',
    borderRadius:8, padding:'7px 13px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'opacity 0.12s',
  },

  /* Memory section */
  memorizeSection: { marginBottom:'1.25rem' },
  memorizeHeader:  { display:'flex', alignItems:'center', gap:6, marginBottom:8 },
  memorizeHeaderText: { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--teal)' },
  memorizeCard: {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderLeft:'3px solid var(--teal)',
    borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:8,
  },
  memorizeCardTop:  { display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:6 },
  memorizeTypeBadge: {
    fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99,
    background:'rgba(0,139,139,0.08)', color:'var(--teal)',
    textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0,
  },
  memorizeRef:     { fontSize:12, fontWeight:600, color:'var(--ink)', flexShrink:0 },
  memorizeVersion: { fontSize:11, color:'var(--ink-faint)', flexShrink:0 },
  memorizeShareBtn: {
    marginLeft:'auto', background:'none', border:'1px solid var(--border)', cursor:'pointer',
    color:'var(--ink-muted)', padding:'3px 6px', borderRadius:6, lineHeight:1,
    display:'flex', alignItems:'center', flexShrink:0,
  },
  memorizeClearBtn: { background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--ink-faint)', padding:'0 2px', lineHeight:1, flexShrink:0 },
  memorizeText:     { margin:0, color:'var(--ink)', lineHeight:1.6 },
  memorizeLocation: { margin:'6px 0 0', fontSize:11, color:'var(--ink-faint)' },

  /* Footer */
  footer:      { borderTop:'1px solid var(--border)', background:'var(--surface)', padding:'20px 24px' },
  footerInner: { maxWidth:720, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexWrap:'wrap' },
  footerText:  { fontSize:13, color:'var(--ink-faint)' },
  footerDot:   { color:'var(--border-strong)' },
  footerLink:  { display:'inline-flex', alignItems:'center', color:'var(--ink-muted)', textDecoration:'none', fontWeight:500, fontSize:13 },
}
