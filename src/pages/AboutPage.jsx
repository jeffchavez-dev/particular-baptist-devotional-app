import React, { Component, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveScroll, restoreScroll } from '../lib/pageState'
import { useAuth } from '../App'
import { useTheme } from '../App'
import { usePrefs } from '../App'
import { useOnboardingCtx } from '../App'
import { FontDropdown, FONT_OPTIONS, FONT_SIZES, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP, GREEK_FONTS, HEBREW_FONTS } from '../components/FontPrefsPanel'
import { supabase, getLocalProgress, syncAll, syncBibleProgressDown } from '../lib/supabase'
import { syncBooksUp, syncBooksDown } from '../lib/bookLibrary'
import { syncMultiPlansUp, syncMultiPlansDown } from '../lib/multiPlan'
import ExportModal from '../components/ExportModal'
import NotificationSettings from '../components/NotificationSettings'
import AchievementsSection from '../components/AchievementsSection'
import BibleTrackerSection from '../components/BibleTrackerSection'
import ConfessionTrackerSection from '../components/ConfessionTrackerSection'
import {
  clearAllHighlights, clearAllNotes,
  syncAnnotationsUp, syncAnnotationsDown,
} from '../lib/annotations'
import {
  getDefaultReaderVersion, setDefaultReaderVersion, DEFAULT_VERSION_OPTIONS,
} from '../lib/readerPrefs'
import {
  clearPlanConfig, resetPlanProgress,
} from '../lib/biblePlan'
import {
  clearConfPlanConfig, resetConfPlanProgress,
} from '../lib/confessionPlan'
import {
  fetchRemoteVersion, getInstalledVersion, setInstalledVersion,
} from '../lib/versionCheck'

/* ── Error boundary: catches crashes inside tracker sections ── */
class SectionErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(err) { return { error: err } }
  componentDidCatch(err, info) {
    console.error('[SectionErrorBoundary]', err, info?.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:'16px', color:'var(--ink-muted)', fontSize:13, lineHeight:1.6 }}>
          <strong>Something went wrong</strong> loading this section.
          <span style={{ display:'block', fontSize:11, color:'var(--ink-faint)', marginTop:4, fontFamily:'monospace', wordBreak:'break-all' }}>
            {this.state.error?.message}
          </span>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop:8, fontSize:12, color:'var(--teal)', background:'none', border:'none', cursor:'pointer', padding:0, textDecoration:'underline' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const CONFESSIONS = [
  {
    label: '2LBCF', name: 'Second London Baptist Confession', year: '1689',
    color: 'var(--purple-ink)', bg: 'var(--purple-soft)',
    chapters: '32 chapters',
    desc: 'The doctrinal standard of Particular Baptists — a thorough statement of Reformed theology grounded in Scripture, closely following the Westminster Confession with key Baptist modifications on the church and ordinances.',
    route: '2lbcf',
    href: 'https://www.the1689confession.com/',
  },
  {
    label: 'Catechism', name: "Keach's Baptist Catechism", year: '1693',
    color: 'var(--teal)', bg: 'var(--teal-light)',
    chapters: '114 questions',
    desc: 'One hundred and fourteen questions and answers teaching the essentials of Christian doctrine — designed by Benjamin Keach for instruction in faith and practice for all ages, grounded in the 1689 Confession.',
    route: 'catechism',
    href: 'https://baptistcatechism.org/',
  },
  {
    label: '1LBCF', name: 'First London Baptist Confession', year: '1644',
    color: 'var(--amber-ink)', bg: 'var(--amber-soft)',
    chapters: '52 articles',
    desc: 'The founding document of the Particular Baptist movement — fifty-two articles affirming biblical faith and believer\'s baptism, carefully distinguishing these congregations from General Baptists and Anabaptists.',
    route: '1lbcf',
    href: 'https://london1644.info/en/fulltext.html',
  },
  {
    label: 'Orthodox', name: 'An Orthodox Catechism', year: '1680',
    color: 'var(--sky)', bg: 'var(--sky-light)',
    chapters: '196 questions',
    desc: 'Composed by Hercules Collins for Baptist congregations, this catechism follows the structure of the Heidelberg Catechism while affirming Particular Baptist distinctives — a devotional and doctrinal masterwork.',
    route: 'orthodox',
    href: 'https://1689.com/an-orthodox-catechism/',
  },
]

const DEVOTIONAL_FEATURES = [
  { title: '365-Day Reading Plan', body: 'Walk through the 2LBCF, Keach\'s Catechism, and 1LBCF in one year — one chapter per day, with Scripture readings assigned for each day.' },
  { title: 'Scripture Proof Texts', body: 'Every article is grounded in Scripture. Tap any proof-text reference to open it in an inline modal — then jump directly to the full reader.' },
  { title: 'Progress & Streaks', body: 'Mark days complete, build streaks, earn achievements, and sync your progress across devices when signed in.' },
  { title: 'Personal Notes & Highlights', body: 'Write reflections for any devotional day or confession paragraph. Highlight in five colors. Everything syncs to your account.' },
  { title: 'Quiz', body: '"How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and church history.' },
]

const SCRIPTURE_FEATURES = [
  { title: 'King James Version', body: 'Full KJV Bible with continuous infinite-scroll reading. Tap any word to search it across the whole Bible instantly.' },
  { title: 'Cebuano Ang Biblia (CEBug)', body: 'Full Cebuano Bible — the Bugna/Pinadayag translation (1917, public domain), also called the Cebuano King James Version for its closeness to the KJV text. All 66 books with full verse highlighting, notes, search, parallel mode, and chapter progress tracking.' },
  { title: 'Geneva Bible (1599)', body: 'Read the 1599 Geneva Bible — the translation of the Reformers and the Puritans, predating the KJV. Includes the original marginal notes that shaped Reformed theology for generations.' },
  { title: 'New American Standard Bible 1995 (NASB)', body: 'Full NASB 1995 Bible with continuous reading, search, parallel mode, verse highlighting, notes, and chapter progress tracking — the same full feature set as KJV. The NASB is widely regarded for its literal accuracy and faithfulness to the original languages.' },
  { title: 'Greek New Testament (GNT)', body: 'Read the Translators Amalgamated GNT (TAGNT) word-by-word. Tap any word to see its Robinson morphology, Strong\'s number, gloss, and transliteration.' },
  { title: 'Hebrew Old Testament (HOT)', body: 'Read the TAHOT with full Masoretic pointing and cantillation. Each word displays ETCBC morphology — stem, aspect, person, gender, and number.' },
  { title: 'Greek Septuagint (LXX)', body: 'Read the Greek Old Testament (Septuagint) word-by-word. Tap any word to see its Strong\'s number and gloss in an inline strip. Enable LXX alongside the Hebrew OT in parallel mode to compare the two side-by-side. Jump to any LXX occurrence from the Strong\'s lexicon using "Find in LXX."' },
  { title: 'In-App Strong\'s Lexicon', body: 'Tap a Strong\'s number to open a full lexicon entry — lemma, transliteration, pronunciation, and definition — without leaving the app. Browse all 8,600+ entries.' },
  { title: 'Find in GNT / HOT', body: 'From any lexicon entry, search every occurrence of a word across the Greek NT or Hebrew OT. Results navigate to the exact verse with the matching word auto-highlighted.' },
  { title: 'Scroll-Synced Navigation', body: 'The chapter indicator in the header always reflects which chapter you\'re currently reading as you scroll through continuous chapters.' },
  { title: 'Smart Book Sidebar', body: 'The book navigation sidebar always opens to the category and chapter grid for the book you\'re currently reading, with the active chapter highlighted and scrolled into view — making it quick to switch chapters within the same book.' },
  { title: 'Verse Highlighting & Notes', body: 'Highlight individual verses in five colors and attach personal notes. Annotations are stored locally and sync to your account.' },
  { title: 'Offline Ready (PWA)', body: 'Install as a Progressive Web App. All Bible data — KJV, GNT, HOT, and lexicons — caches on first load and reads fully offline thereafter.' },
  { title: 'Matthew Henry\'s Commentary (MHC)', body: 'The classic verse-by-verse commentary from Matthew Henry (1662–1714), shown inline above each verse in study mode. Covers the entire Bible with pastoral warmth and Reformed precision.' },
  { title: 'John Gill\'s Exposition', body: 'John Gill\'s exhaustive Exposition of the Bible (1746–1763), a Particular Baptist landmark. Shown per-verse inline in study mode, covering every verse of both Testaments with meticulous exegesis.' },
  { title: 'John Calvin\'s Commentaries', body: 'Calvin\'s Commentaries displayed per-verse in study mode, drawn from his complete works. Each verse\'s commentary appears as its own chip — the implicit verse divisions in Calvin\'s text are detected and split automatically.' },
]

const DATA_SOURCES = [
  {
    name: 'STEPBible (Tyndale House)',
    href: 'https://stepbible.org/',
    desc: 'Source for TAGNT (Greek NT) and TAHOT (Hebrew OT) morphological data, licensed CC BY 4.0.',
    badge: 'CC BY 4.0',
  },
  {
    name: 'Translators Amalgamated NT/OT — GitHub',
    href: 'https://github.com/STEPBible/STEPBible-Data',
    desc: 'Raw TAGNT and TAHOT data files from the STEPBible-Data repository used to build the in-app word-level Greek and Hebrew reader.',
    badge: 'Open Data',
  },
  {
    name: 'BibleHub Strong\'s Lexicon',
    href: 'https://biblehub.com/',
    desc: 'Strong\'s Exhaustive Concordance lexicon data (James Strong, 1890, Public Domain) referenced for lemma, transliteration, pronunciation, and definitions in the in-app lexicon.',
    badge: 'Public Domain',
  },
  {
    name: 'King James Version (KJV)',
    href: 'https://github.com/christos-c/bible-corpus',
    desc: 'Public domain KJV text used for the Scripture reader and all proof-text references throughout the devotional.',
    badge: 'Public Domain',
  },
  {
    name: 'Cebuano Ang Biblia — Bugna/Pinadayag (1917)',
    href: 'https://github.com/scrollmapper/bible_databases',
    desc: 'Public domain Cebuano Bible (Bugna/Pinadayag, 1917) via scrollmapper/bible_databases. All 66 books in verse-level JSON format.',
    badge: 'Public Domain',
  },
  {
    name: 'NASB 1995 Bible JSON — GitHub',
    href: 'https://github.com/Amosamevor/Bible-json/tree/main/versions/en',
    desc: 'NASB 1995 text in JSON format used for the in-app Scripture reader. The New American Standard Bible 1995 is © The Lockman Foundation.',
    badge: 'Copyright',
  },
]

/* ── Collapsible section wrapper — state persisted so back-nav restores it ── */
function CollapseSection({ id, icon, title, badge, defaultOpen = false, children }) {
  const sk = `pb-settings-${id}`
  const [open, setOpen] = useState(() => {
    try {
      const raw = sessionStorage.getItem(sk)
      return raw !== null ? raw === '1' : defaultOpen
    } catch { return defaultOpen }
  })
  function toggle() {
    const next = !open
    setOpen(next)
    try { sessionStorage.setItem(sk, next ? '1' : '0') } catch {}
  }
  return (
    <section style={cs.section}>
      <button
        onClick={toggle}
        style={cs.header}
        aria-expanded={open}
        id={id}
      >
        <div style={cs.headerLeft}>
          {icon}
          <span style={cs.title}>{title}</span>
          {badge != null && badge !== 0 && (
            <span style={cs.badge}>{badge}</span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transition:'transform 0.22s', transform: open ? 'rotate(180deg)' : 'none', flexShrink:0, color:'var(--ink-faint)' }}
        >
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
      {open && <div style={cs.body}>{children}</div>}
    </section>
  )
}

const cs = {
  section: {
    borderBottom: '1px solid var(--border)',
    fontFamily: "'DM Sans',sans-serif",
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', background:'none', border:'none', cursor:'pointer',
    padding:'16px 20px', textAlign:'left', color:'var(--ink)',
    transition:'background 0.12s',
  },
  headerLeft: { display:'flex', alignItems:'center', gap:10 },
  title: { fontSize:14, fontWeight:700, color:'var(--ink)' },
  badge: {
    fontSize:10, fontWeight:700, background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'1px 7px', letterSpacing:'0.03em',
  },
  body: { padding:'0 20px 20px' },
}


/* ══════════════════════════════════════════════════════════════ */
export default function AboutPage() {
  const navigate    = useNavigate()
  const { session } = useAuth()
  const { dark, toggleDark } = useTheme()
  const { prefs, updatePrefs } = usePrefs()
  const { startTour } = useOnboardingCtx()

  const [defaultVersion, setDefaultVersion] = useState(() => getDefaultReaderVersion())

  /* ── Wake Lock ("Keep screen on") ── */
  const WAKE_LOCK_KEY = 'pb-keep-awake'
  const [keepAwake, setKeepAwakeRaw] = useState(() => {
    try { return localStorage.getItem(WAKE_LOCK_KEY) === '1' } catch { return false }
  })
  const wakeLockRef = useRef(null)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  function setKeepAwake(val) {
    setKeepAwakeRaw(val)
    try {
      if (val) localStorage.setItem(WAKE_LOCK_KEY, '1')
      else     localStorage.removeItem(WAKE_LOCK_KEY)
    } catch {}
  }

  useEffect(() => {
    if (!wakeLockSupported) return

    async function acquireLock() {
      if (!keepAwake) return
      try {
        if (wakeLockRef.current) { try { await wakeLockRef.current.release() } catch {} }
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
      } catch {}
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && keepAwake) acquireLock()
    }

    if (keepAwake) {
      acquireLock()
      document.addEventListener('visibilitychange', onVisibilityChange)
    } else {
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release() } catch {}
        wakeLockRef.current = null
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [keepAwake, wakeLockSupported])

  const [exportOpen,   setExportOpen]   = useState(false)
  const [resetDone,    setResetDone]    = useState(false)
  const [resetting,    setResetting]    = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [clearHlDone,  setClearHlDone]  = useState(false)
  const [clearingHl,   setClearingHl]   = useState(false)
  const [confirmClearHl, setConfirmClearHl] = useState(false)
  const [clearNotesDone, setClearNotesDone] = useState(false)
  const [clearingNotes, setClearingNotes] = useState(false)
  const [confirmClearNotes, setConfirmClearNotes] = useState(false)
  const [progressData, setProgressData] = useState(null)
  const [syncMessage, setSyncMessage] = useState(null)
  const [syncing, setSyncing] = useState(false)

  /* ── App version / update detection ── */
  const [installedVersion,  setInstalledVersionState] = useState(() => getInstalledVersion())
  const [remoteVersion,     setRemoteVersion]     = useState(null)   // { version, date, changelog }
  const [checkingUpdate,    setCheckingUpdate]     = useState(false)
  const [updateCheckMsg,    setUpdateCheckMsg]     = useState(null)   // 'up-to-date' | null
  const [swUpdateReady,     setSwUpdateReady]      = useState(false)  // new SW waiting

  // Check for update: force the SW to re-check, then compare version.json
  const checkForUpdate = useCallback(async () => {
    setCheckingUpdate(true)
    setUpdateCheckMsg(null)

    // 1. Check if a new SW is already waiting (downloaded but not yet active)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
      if (reg?.waiting) {
        setSwUpdateReady(true)
        setCheckingUpdate(false)
        return
      }
      // 2. Tell the active SW to check the server for a new version now
      if (reg) {
        try { await reg.update() } catch {}
      }
    }

    const data = await fetchRemoteVersion()
    setCheckingUpdate(false)
    if (!data) {
      setUpdateCheckMsg('offline')
      return
    }
    const current = getInstalledVersion() || '1.0'
    if (data.version !== current) {
      setRemoteVersion(data)
    } else {
      setUpdateCheckMsg('up-to-date')
      setTimeout(() => setUpdateCheckMsg(null), 3000)
    }
  }, [])

  // Apply update: wake any waiting SW, then reload so the new version is served
  const applyUpdate = useCallback(async () => {
    if (remoteVersion) {
      setInstalledVersion(remoteVersion.version)
      setInstalledVersionState(remoteVersion.version)
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
      if (reg?.waiting) {
        // Signal the waiting SW to skip its waiting phase and take control
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        await new Promise(resolve =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
        )
      }
    }
    window.location.reload()
  }, [remoteVersion])

  // Auto-check on mount + listen for SW controller change (new SW activated in background)
  useEffect(() => {
    checkForUpdate()

    function onControllerChange() {
      // A new service worker silently took control — fetch the new version info
      setSwUpdateReady(true)
      fetchRemoteVersion().then(data => {
        if (data) {
          const current = getInstalledVersion() || '1.0'
          if (data.version !== current) setRemoteVersion(data)
        }
      })
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Restore scroll on mount, save on unmount — so back-navigation returns to same spot */
  useEffect(() => {
    restoreScroll('settings')
    return () => saveScroll('settings')
  }, [])

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    // Pull latest confession progress from Supabase every time Settings opens
    supabase.from('progress').select('day_number, completed, notes')
      .eq('user_id', uid)
      .then(({ data }) => setProgressData(data || []))
    // Pull latest Bible chapter progress so tracker matches other devices
    syncBibleProgressDown(uid)
  }, [session])

  const handleReset = useCallback(async () => {
    setResetting(true)
    try {
      // ── Local storage ──────────────────────────────────────────────────────
      // Bible chapter tracker (chapter-level checkmarks)
      localStorage.removeItem('pb-bible-progress')
      // Bible reading plans (multi-plan array + active-plan pointer)
      localStorage.removeItem('pb-bible-plans')
      localStorage.removeItem('pb-plan-active-id')
      clearPlanConfig()
      resetPlanProgress()
      // Confession tracker progress
      clearConfPlanConfig()
      resetConfPlanProgress()

      // ── Cloud (Supabase) ───────────────────────────────────────────────────
      if (session) {
        await Promise.all([
          // Devotional day checkmarks — mark uncompleted (keep notes)
          supabase.from('progress')
            .update({ completed: false, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id),
          // Bible chapter tracker — delete all rows so syncDown won't restore them
          supabase.from('pb_bible_progress')
            .delete()
            .eq('user_id', session.user.id),
          // Bible reading plans — delete so syncMultiPlansDown won't restore old progress
          supabase.from('pb_bible_plans')
            .delete()
            .eq('user_id', session.user.id),
        ])
      } else {
        // Guest: strip completed flags but keep any written notes
        const local = getLocalProgress()
        const cleaned = {}
        Object.entries(local).forEach(([day, d]) => {
          if (d.notes && d.notes.trim()) cleaned[day] = { notes: d.notes }
        })
        localStorage.setItem('devotional_guest_progress', JSON.stringify(cleaned))
      }

      // Notify open pages to refresh their state
      window.dispatchEvent(new CustomEvent('pb-plans-changed'))
      window.dispatchEvent(new StorageEvent('storage', { key: 'pb-bible-progress' }))

      setResetDone(true)
      setConfirmReset(false)
      setTimeout(() => setResetDone(false), 3500)
    } finally {
      setResetting(false)
    }
  }, [session])

  const handleSync = useCallback(async () => {
    if (!session?.user?.id) {
      setSyncMessage({ type: 'error', text: 'Sign in required to sync' })
      return
    }
    setSyncing(true)
    setSyncMessage(null)
    try {
      const uid = session.user.id
      // Run all syncs in parallel — devotional + bible + user data + books + annotations + plans
      const [baseResult, , annotResult] = await Promise.all([
        syncAll(uid),                                                          // devotional + bible + bookmarks/completions
        syncBooksUp(uid).then(() => syncBooksDown(uid)),                       // book library
        syncAnnotationsUp(uid).then(() => syncAnnotationsDown(uid)).then(() => ({ success: true })), // highlights + notes
        syncMultiPlansUp(uid).then(() => syncMultiPlansDown(uid)),             // named reading plans
      ])

      const success = baseResult.success
      const c = baseResult.counts || {}
      const parts = []
      if ((c.devotional || 0) > 0)  parts.push(`${c.devotional} devotional`)
      if ((c.bible || 0) > 0)       parts.push(`${c.bible} Bible chapters`)
      if ((c.userData || 0) > 0)    parts.push(`${c.userData} bookmarks/records`)

      setSyncMessage({
        type: success ? 'success' : 'error',
        text: success
          ? `All data synced${parts.length ? ` · ${parts.join(', ')} updated` : ' · everything up to date'}`
          : baseResult.message || 'Sync completed with some errors',
      })
      // Re-fetch confession progress so tracker UI reflects what was just pulled from Supabase
      supabase.from('progress').select('day_number, completed, notes')
        .eq('user_id', uid)
        .then(({ data }) => { if (data) setProgressData(data) })
      setTimeout(() => setSyncMessage(null), 5000)
    } catch (e) {
      setSyncMessage({ type: 'error', text: e?.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }, [session?.user?.id])

  const handleClearHighlights = useCallback(async () => {
    setClearingHl(true)
    try {
      await clearAllHighlights(session?.user?.id)
      setClearHlDone(true)
      setConfirmClearHl(false)
      setTimeout(() => setClearHlDone(false), 3500)
    } finally {
      setClearingHl(false)
    }
  }, [session?.user?.id])

  const handleClearNotes = useCallback(async () => {
    setClearingNotes(true)
    try {
      await clearAllNotes(session?.user?.id)
      setClearNotesDone(true)
      setConfirmClearNotes(false)
      setTimeout(() => setClearNotesDone(false), 3500)
    } finally {
      setClearingNotes(false)
    }
  }, [session?.user?.id])

  const activeFont = FONT_OPTIONS.find(f => f.id === prefs.fontId) || FONT_OPTIONS[0]


  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <img src="/pb-icon.png" alt="P.B." style={{width:36, height:36, borderRadius:'50%'}} />
          {session ? (
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span style={s.signedIn}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="var(--teal)" strokeWidth="1.2"/>
                  <path d="M3.5 6l2 2 3-3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {session.user.email?.split('@')[0]}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="btn btn-ghost"
                style={{fontSize:12, padding:'4px 10px'}}
              >Sign out</button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="btn btn-outline"
              style={{fontSize:13, padding:'5px 12px'}}
            >Sign in</button>
          )}
        </div>
      </header>

      <main style={s.main}>

        {/* ════ 0. BIBLE TRACKER ════ */}
        <CollapseSection
          id="bible-tracker"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="var(--teal)" strokeWidth="1.3"/>
              <path d="M5 2v12M1.5 6h13M1.5 10h13" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          }
          title="Bible Tracker"
          defaultOpen={false}
        >
          <SectionErrorBoundary>
            <BibleTrackerSection />
          </SectionErrorBoundary>
        </CollapseSection>

        {/* ════ 0b. CONFESSION TRACKER ════ */}
        <CollapseSection
          id="confession-tracker"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="1.5" width="9" height="12" rx="1.3" stroke="var(--teal)" strokeWidth="1.3"/>
              <path d="M5 5h5M5 8h5M5 11h3" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
              <path d="M11 9l1.5 1.5L15 8" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="Confession Tracker"
          defaultOpen={false}
        >
          <SectionErrorBoundary>
            <ConfessionTrackerSection supabaseProgress={session ? progressData : null} />
          </SectionErrorBoundary>
        </CollapseSection>

        {/* ════ 1. ACHIEVEMENTS ════ */}
        <CollapseSection
          id="achievements"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.8 3.6L14 5.4l-3 2.9.7 4.1L8 10.4 5.3 12.4l.7-4.1-3-2.9 4.2-.8L8 1Z"
                stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round" fill="var(--teal)" fillOpacity="0.12"/>
            </svg>
          }
          title="Achievements"
          defaultOpen={false}
        >
          <AchievementsSection hideHeader />
        </CollapseSection>

        {/* ════ 2. SETTINGS ════ */}
        <CollapseSection
          id="settings"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="var(--ink-muted)" strokeWidth="1.3"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M11.5 4.5l-1.4 1.4M4.9 11.5l-1.4 1.4"
                stroke="var(--ink-muted)" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          }
          title="Settings"
          defaultOpen={false}
        >
          <div style={s.settingsInner}>

            {/* Dark Mode */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Dark Mode</span>
                <span style={s.settingHint}>Easier on the eyes in low-light</span>
              </div>
              <button
                onClick={toggleDark}
                style={{ ...s.toggle, background: dark ? 'var(--teal)' : 'var(--border-strong)' }}
                aria-pressed={dark}
              >
                <span style={{ ...s.toggleKnob, transform: dark ? 'translateX(20px)' : 'translateX(2px)' }} />
              </button>
            </div>

            {/* Keep Screen On */}
            {wakeLockSupported && (
              <div style={s.settingRow}>
                <div style={s.settingLabel}>
                  <span style={s.settingName}>Keep Screen On</span>
                  <span style={s.settingHint}>Prevents the screen from sleeping while reading — uses more battery</span>
                </div>
                <button
                  onClick={() => setKeepAwake(!keepAwake)}
                  style={{ ...s.toggle, background: keepAwake ? 'var(--teal)' : 'var(--border-strong)' }}
                  aria-pressed={keepAwake}
                  role="switch"
                  title={keepAwake ? 'Disable keep screen on' : 'Enable keep screen on'}
                >
                  <span style={{ ...s.toggleKnob, transform: keepAwake ? 'translateX(20px)' : 'translateX(2px)' }} />
                </button>
              </div>
            )}

            {/* Notifications */}
            <NotificationSettings userId={session?.user?.id} />

            {/* Font Size */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Reading Font Size</span>
                <span style={s.settingHint}>Applies to confession &amp; reading text</span>
              </div>
              <div style={s.sizeRow}>
                <button
                  onClick={() => updatePrefs({ ...prefs, sizePx: Math.max(FONT_SIZE_MIN, prefs.sizePx - FONT_SIZE_STEP) })}
                  disabled={prefs.sizePx <= FONT_SIZE_MIN}
                  title="Decrease font size"
                  style={{ ...s.sizeStepBtn, opacity: prefs.sizePx <= FONT_SIZE_MIN ? 0.35 : 1 }}
                >A<sup style={{fontSize:'0.6em',lineHeight:1}}>−</sup></button>
                <span style={s.sizeCurrent}>{prefs.sizePx}px</span>
                <button
                  onClick={() => updatePrefs({ ...prefs, sizePx: Math.min(FONT_SIZE_MAX, prefs.sizePx + FONT_SIZE_STEP) })}
                  disabled={prefs.sizePx >= FONT_SIZE_MAX}
                  title="Increase font size"
                  style={{ ...s.sizeStepBtn, fontSize: prefs.sizePx * 0.8, fontFamily: activeFont.css, opacity: prefs.sizePx >= FONT_SIZE_MAX ? 0.35 : 1 }}
                >A<sup style={{fontSize:'0.6em',lineHeight:1}}>+</sup></button>
              </div>
            </div>

            {/* Font Style */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Reading Font Style</span>
                <span style={s.settingHint}>Typeface for confession &amp; reading text</span>
              </div>
              <div style={s.fontDropdownWrap}>
                <FontDropdown
                  value={prefs.fontId}
                  options={FONT_OPTIONS}
                  onChange={id => updatePrefs({ ...prefs, fontId: id })}
                  sampleKey="sample"
                />
              </div>
            </div>

            {/* Greek Script Font */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Greek NT Font</span>
                <span style={s.settingHint}>Typeface for Greek New Testament text</span>
              </div>
              <div style={s.fontDropdownWrap}>
                <FontDropdown
                  value={prefs.greekFontId}
                  options={GREEK_FONTS}
                  onChange={id => updatePrefs({ ...prefs, greekFontId: id })}
                  sampleKey="sample"
                />
              </div>
            </div>

            {/* Hebrew Script Font */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Hebrew OT Font</span>
                <span style={s.settingHint}>Typeface for Hebrew Old Testament text</span>
              </div>
              <div style={s.fontDropdownWrap}>
                <FontDropdown
                  value={prefs.hebrewFontId}
                  options={HEBREW_FONTS}
                  onChange={id => updatePrefs({ ...prefs, hebrewFontId: id })}
                  sampleKey="sample"
                />
              </div>
            </div>

            {/* Default Bible Translation */}
            <div style={{...s.settingRow, alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Default Bible Translation</span>
                <span style={s.settingHint}>Used when opening Scripture from devotionals and confession proof texts</span>
              </div>
              <select
                value={defaultVersion}
                onChange={e => {
                  const id = e.target.value
                  setDefaultVersion(id)
                  setDefaultReaderVersion(id)
                  try {
                    if (id === 'original') {
                      sessionStorage.removeItem('reader-version')
                    } else {
                      sessionStorage.setItem('reader-version', id)
                    }
                  } catch {}
                }}
                style={{
                  appearance:'none', WebkitAppearance:'none',
                  padding:'8px 36px 8px 14px', borderRadius:99,
                  fontSize:13, fontWeight:700,
                  fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
                  border:'1.5px solid var(--teal)',
                  background:`var(--teal-light) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231d6b5a' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 14px center`,
                  color:'var(--teal)',
                  minWidth:160, flexShrink:0,
                  outline:'none',
                }}
              >
                {DEFAULT_VERSION_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} — {opt.full}
                  </option>
                ))}
              </select>
            </div>

            {/* Backup */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Backup &amp; Export</span>
                <span style={s.settingHint}>Download your progress and notes as JSON or Markdown</span>
              </div>
              <button onClick={() => setExportOpen(true)} className="btn btn-outline" style={{fontSize:13, flexShrink:0}}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{marginRight:4}}>
                  <path d="M6.5 1v7M4 6l2.5 3.5L9 6M2 10.5v1A1.5 1.5 0 003.5 13h6A1.5 1.5 0 0011 11.5v-1"
                    stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download Backup
              </button>
            </div>

            {/* Sync to Cloud */}
            {session && (
              <div style={s.settingRow}>
                <div style={s.settingLabel}>
                  <span style={s.settingName}>Sync Progress</span>
                  <span style={s.settingHint}>Save your progress to cloud and sync across devices</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
                  {syncing && <span style={{fontSize:12, color:'var(--ink-faint)'}}>Syncing…</span>}
                  <button 
                    onClick={handleSync} 
                    disabled={syncing}
                    className="btn btn-outline" 
                    style={{fontSize:13, flexShrink:0}}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{marginRight:4}}>
                      <path d="M2.5 6.5c0-2 1.5-3.5 3.5-3.5s3 1 3 2.5M10.5 6.5c0 2-1.5 3.5-3.5 3.5s-3-1-3-2.5"
                        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M6 2v2.5M6 10.5v-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Sync Now
                  </button>
                </div>
              </div>
            )}

            {syncMessage && (
              <div style={{
                padding:'10px 14px',
                borderRadius:'var(--radius)',
                background: syncMessage.type === 'success' ? 'var(--teal-light)' : 'rgba(255, 100, 100, 0.1)',
                color: syncMessage.type === 'success' ? 'var(--teal)' : '#b33',
                fontSize:12,
                border: `1px solid ${syncMessage.type === 'success' ? 'rgba(29,107,90,0.2)' : 'rgba(180,50,50,0.2)'}`,
                marginBottom: 12,
              }}>
                {syncMessage.text}
              </div>
            )}

            {/* App Version / Update */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>App Version</span>
                <span style={s.settingHint}>
                  {remoteVersion
                    ? `v${installedVersion || '1.0'} installed · v${remoteVersion.version} available`
                    : `v${installedVersion || '1.0'}`}
                </span>
                {remoteVersion && (
                  <span style={{
                    display:'block', marginTop:4, fontSize:11,
                    color:'var(--ink-faint)', fontStyle:'italic', lineHeight:1.5,
                  }}>
                    {remoteVersion.changelog}
                  </span>
                )}
                {(swUpdateReady && !remoteVersion) && (
                  <span style={{ display:'block', marginTop:3, fontSize:11, color:'var(--teal)' }}>
                    New version ready — click Update to apply
                  </span>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                {checkingUpdate && (
                  <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Checking…</span>
                )}
                {updateCheckMsg === 'up-to-date' && (
                  <span style={{ fontSize:12, color:'var(--teal)' }}>✓ Up to date</span>
                )}
                {updateCheckMsg === 'offline' && (
                  <span style={{ fontSize:12, color:'var(--ink-faint)' }}>Offline</span>
                )}
                {(remoteVersion || swUpdateReady) ? (
                  <button
                    onClick={applyUpdate}
                    className="btn btn-outline"
                    style={{ fontSize:13, flexShrink:0, color:'var(--teal)', borderColor:'var(--teal)', fontWeight:700 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight:4, flexShrink:0 }}>
                      <path d="M6 1v7M3.5 5.5L6 8.5l2.5-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Update
                  </button>
                ) : (
                  <button
                    onClick={checkForUpdate}
                    disabled={checkingUpdate}
                    className="btn btn-outline"
                    style={{ fontSize:13, flexShrink:0, opacity: checkingUpdate ? 0.5 : 1 }}
                  >
                    Check for Updates
                  </button>
                )}
              </div>
            </div>

            {/* App Tour */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>App Tour</span>
                <span style={s.settingHint}>Replay the guided walkthrough of the main features</span>
              </div>
              <button
                onClick={startTour}
                className="btn btn-outline"
                style={{ fontSize:13, flexShrink:0 }}
              >
                Take Tour
              </button>
            </div>

            {/* Reset */}
            <div style={{...s.settingRow, borderBottom:'none', paddingBottom:0}}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Reset All Progress</span>
                <span style={s.settingHint}>Clears devotional &amp; Bible checkboxes — your notes are kept</span>
              </div>
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)} className="btn btn-outline"
                  style={{fontSize:13, color:'#b33', borderColor:'rgba(180,50,50,0.3)', flexShrink:0}}>
                  Reset Progress
                </button>
              ) : (
                <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap'}}>
                  <span style={{fontSize:12, color:'var(--ink-muted)'}}>Are you sure?</span>
                  <button onClick={handleReset} disabled={resetting} className="btn btn-outline"
                    style={{fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'5px 12px'}}>
                    {resetting ? 'Resetting…' : 'Yes, reset'}
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="btn btn-ghost" style={{fontSize:12, padding:'5px 10px'}}>
                    Cancel
                  </button>
                </div>
              )}
              {resetDone && <span style={{fontSize:12, color:'var(--teal)', fontWeight:600, marginLeft:8}}>✓ Progress cleared</span>}
            </div>

            {/* Clear Highlights */}
            <div style={{...s.settingRow, borderBottom:'none', paddingBottom:0}}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Clear All Highlights</span>
                <span style={s.settingHint}>Removes all color highlights from scripture &amp; confessions</span>
              </div>
              {!confirmClearHl ? (
                <button onClick={() => setConfirmClearHl(true)} className="btn btn-outline"
                  style={{fontSize:13, color:'#b33', borderColor:'rgba(180,50,50,0.3)', flexShrink:0}}>
                  Clear Highlights
                </button>
              ) : (
                <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap'}}>
                  <span style={{fontSize:12, color:'var(--ink-muted)'}}>Are you sure?</span>
                  <button onClick={handleClearHighlights} disabled={clearingHl} className="btn btn-outline"
                    style={{fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'5px 12px'}}>
                    {clearingHl ? 'Clearing…' : 'Yes, clear'}
                  </button>
                  <button onClick={() => setConfirmClearHl(false)} className="btn btn-ghost" style={{fontSize:12, padding:'5px 10px'}}>
                    Cancel
                  </button>
                </div>
              )}
              {clearHlDone && <span style={{fontSize:12, color:'var(--teal)', fontWeight:600, marginLeft:8}}>✓ Highlights cleared</span>}
            </div>

            {/* Clear Notes */}
            <div style={{...s.settingRow, borderBottom:'none', paddingBottom:0}}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Clear All Notes</span>
                <span style={s.settingHint}>Removes all text notes from scripture, confessions &amp; devotional</span>
              </div>
              {!confirmClearNotes ? (
                <button onClick={() => setConfirmClearNotes(true)} className="btn btn-outline"
                  style={{fontSize:13, color:'#b33', borderColor:'rgba(180,50,50,0.3)', flexShrink:0}}>
                  Clear Notes
                </button>
              ) : (
                <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap'}}>
                  <span style={{fontSize:12, color:'var(--ink-muted)'}}>Are you sure?</span>
                  <button onClick={handleClearNotes} disabled={clearingNotes} className="btn btn-outline"
                    style={{fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'5px 12px'}}>
                    {clearingNotes ? 'Clearing…' : 'Yes, clear'}
                  </button>
                  <button onClick={() => setConfirmClearNotes(false)} className="btn btn-ghost" style={{fontSize:12, padding:'5px 10px'}}>
                    Cancel
                  </button>
                </div>
              )}
              {clearNotesDone && <span style={{fontSize:12, color:'var(--teal)', fontWeight:600, marginLeft:8}}>✓ Notes cleared</span>}
            </div>
          </div>
        </CollapseSection>

        {/* ════ 4. QUIZ ════ */}
        <CollapseSection
          id="quiz"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="var(--ink-muted)" strokeWidth="1.3"/>
              <path d="M6.5 6C6.5 5.2 7.2 4.5 8 4.5s1.5.6 1.5 1.5c0 1-1 1.2-1.5 2" stroke="var(--ink-muted)" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r=".7" fill="var(--ink-muted)"/>
            </svg>
          }
          title="Quiz"
          defaultOpen={false}
        >
          <p style={{fontSize:13, color:'var(--ink-muted)', lineHeight:1.7, marginBottom:16}}>
            "How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and Baptist history.
            A fun way to examine your convictions and learn what Particular Baptists have historically believed.
          </p>
          <button onClick={() => navigate('/quiz')} className="btn btn-primary" style={{fontSize:13}}>
            Take the Quiz →
          </button>
        </CollapseSection>

        {/* ════ 5. ABOUT ════ */}
        <CollapseSection
          id="about"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="var(--ink-muted)" strokeWidth="1.3"/>
              <path d="M8 7v5M8 5h.01" stroke="var(--ink-muted)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          }
          title="About"
          defaultOpen={false}
        >
          {/* App intro */}
          <p style={{fontSize:13, color:'var(--ink-muted)', lineHeight:1.8, marginBottom:4}}>
            A <strong>Particular Baptist study companion</strong> — walk through the <strong>2nd London Baptist Confession, Keach's Catechism,
            and 1st London Baptist Confession</strong> in a 365-day plan, with every article anchored to its Scripture proof texts
            and set alongside the Reformed confessions of the church.
          </p>
          <p style={{fontSize:13, color:'var(--ink-muted)', lineHeight:1.8, marginBottom:20}}>
            Study each passage with inline commentaries from <strong>Matthew Henry, John Calvin, and John Gill</strong> — three
            pillars of the Reformed tradition — plus the full KJV, Geneva Bible (1599), Greek NT, and Hebrew OT.
            Tap any word for morphology and lexicon data, trace every Strong's number across the whole Bible,
            and annotate with personal highlights and notes — all in one app, fully offline-capable.
          </p>

          {/* ── Devotional features ── */}
          <div style={{...s.sectionTitle, marginBottom:10}}>📖 Devotional</div>
          <div style={s.featureGrid}>
            {DEVOTIONAL_FEATURES.map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={s.featureDot} />
                <div>
                  <div style={s.featureName}>{f.title}</div>
                  <div style={s.featureBody}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Scripture study features ── */}
          <div style={{...s.sectionTitle, marginTop:22, marginBottom:10}}>🔍 Scripture Study Tools</div>
          <div style={s.featureGrid}>
            {SCRIPTURE_FEATURES.map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={{...s.featureDot, background:'var(--purple-ink)'}} />
                <div>
                  <div style={s.featureName}>{f.title}</div>
                  <div style={s.featureBody}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── The Confessions ── */}
          <div style={{marginTop:24}}>
            <div style={{...s.sectionTitle, marginBottom:12}}>The Confessions &amp; Catechisms</div>
            <div style={s.sourceGrid}>
              {CONFESSIONS.map(src => (
                <div key={src.label} style={{...s.sourceCard, borderColor: src.color, background: src.bg}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                    <span style={{...s.sourceBadge, color: src.color}}>{src.label}</span>
                    <span style={{fontSize:10, color: src.color, opacity:0.7}}>{src.year}</span>
                    <span style={{marginLeft:'auto', fontSize:10, color: src.color, opacity:0.7}}>{src.chapters}</span>
                  </div>
                  <h4 style={{fontSize:14, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color: src.color, marginBottom:5}}>
                    {src.name}
                  </h4>
                  <p style={{fontSize:11, color:'var(--ink-muted)', lineHeight:1.65, marginBottom:8}}>{src.desc}</p>
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <button
                      onClick={() => navigate(`/confessions?t=${src.route}`)}
                      style={{fontSize:12, fontWeight:600, color: src.color, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'DM Sans',sans-serif"}}
                    >
                      Read in app →
                    </button>
                    <a href={src.href} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11, color:'var(--ink-faint)', textDecoration:'none'}}>
                      Source ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Data sources ── */}
          <div style={{marginTop:24}}>
            <div style={{...s.sectionTitle, marginBottom:10}}>Data Sources &amp; Licenses</div>
            <p style={{fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, marginBottom:12}}>
              This app is built on open, high-quality biblical scholarship data. All sources are credited below.
            </p>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {DATA_SOURCES.map((src, i) => (
                <div key={i} style={s.dataSourceRow}>
                  <div style={{display:'flex', alignItems:'flex-start', gap:8, flex:1, minWidth:0}}>
                    <span style={s.dataBullet}>▸</span>
                    <div style={{minWidth:0}}>
                      <a
                        href={src.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{fontSize:13, fontWeight:600, color:'var(--teal)', textDecoration:'none', fontFamily:"'DM Sans',sans-serif"}}
                      >
                        {src.name} ↗
                      </a>
                      <p style={{fontSize:11, color:'var(--ink-muted)', lineHeight:1.6, margin:'2px 0 0'}}>{src.desc}</p>
                    </div>
                  </div>
                  <span style={s.dataBadge}>{src.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Navigate ── */}
          <div style={{marginTop:24}}>
            <div style={{...s.sectionTitle, marginBottom:12}}>Navigate</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
              {[
                {label:'Devotional', path:'/'},
                {label:'Confessions', path:'/confessions'},
                {label:'Scripture', path:'/scripture'},
              ].map(link => (
                <button key={link.path} onClick={() => navigate(link.path)} className="btn btn-outline" style={{fontSize:12}}>
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </CollapseSection>

      </main>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerText}>Created by Jeff Chavez with Claude Code</span>
          <span style={s.footerDot}>·</span>
          <a href="https://theologycheck.blog" target="_blank" rel="noopener noreferrer" style={s.footerLink}>
            <img src="https://theologycheckblog.wordpress.com/wp-content/uploads/2022/02/tc-logo.png"
              alt="TheologyCheck" style={{height:14, verticalAlign:'middle', marginRight:4}} />
            theologycheck.blog
          </a>
          <span style={s.footerDot}>·</span>
          <span style={s.footerText}>© 2026 · CC BY-NC-SA 4.0</span>
        </div>
      </footer>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        userNotes={[]}
        progress={{}}
        session={session}
      />
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", paddingBottom:'env(safe-area-inset-bottom)' },

  header: {
    position:'sticky', top:0, zIndex:20,
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerInner: {
    maxWidth:800, margin:'0 auto', padding:'12px 20px',
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
  },
  headerTitle: { fontSize:17, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  signedIn: {
    display:'flex', alignItems:'center', gap:5,
    fontSize:11, color:'var(--teal)', fontWeight:600,
    background:'var(--teal-light)', padding:'4px 10px', borderRadius:99,
  },

  main: { maxWidth:800, margin:'0 auto', paddingBottom:'4rem' },

  settingsInner: { display:'flex', flexDirection:'column' },

  settingRow: {
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
    paddingBottom:16, marginBottom:16, borderBottom:'1px solid var(--border)',
    flexWrap:'wrap',
  },
  settingLabel: { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:180 },
  settingName: { fontSize:14, fontWeight:600, color:'var(--ink)' },
  settingHint: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5 },

  toggle: {
    width:44, height:24, borderRadius:99, border:'none', cursor:'pointer',
    position:'relative', transition:'background 0.2s', flexShrink:0, padding:0,
  },
  toggleKnob: {
    position:'absolute', top:2, width:20, height:20,
    borderRadius:'50%', background:'var(--parchment)', transition:'transform 0.2s',
    boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
  },

  sizeRow: { display:'flex', gap:6, flexShrink:0, alignItems:'center' },
  sizeStepBtn: {
    width:40, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border-strong)',
    cursor:'pointer', transition:'all 0.12s', display:'flex', alignItems:'center',
    justifyContent:'center', background:'var(--surface)', color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", fontSize:14, lineHeight:1, flexShrink:0,
  },
  sizeCurrent: {
    width:38, textAlign:'center', fontSize:12, color:'var(--ink-muted)',
    fontFamily:"'DM Sans',sans-serif", fontWeight:600,
  },
  sizeBtnLEGACY: {
    width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid',
    cursor:'pointer', transition:'all 0.12s', display:'flex', alignItems:'center',
    justifyContent:'center', fontFamily:"'Cormorant Garamond',serif",
  },

  fontDropdownWrap: { flex:1, minWidth:160, maxWidth:260 },

  sectionTitle: {
    fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--teal)',
  },

  featureGrid: { display:'flex', flexDirection:'column', gap:10 },
  featureItem: { display:'flex', gap:12, alignItems:'flex-start' },
  featureDot: { width:6, height:6, borderRadius:'50%', background:'var(--teal)', flexShrink:0, marginTop:6 },
  featureName: { fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:2 },
  featureBody: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.6 },

  sourceGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:10 },
  sourceCard: {
    padding:'14px', borderRadius:'var(--radius-lg)', border:'1.5px solid',
    display:'flex', flexDirection:'column',
  },
  sourceBadge: { fontSize:11, fontWeight:700, letterSpacing:'0.05em' },

  dataSourceRow: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12,
    padding:'10px 12px', background:'var(--parchment)',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
  },
  dataBullet: { color:'var(--teal)', fontSize:11, flexShrink:0, marginTop:2 },
  dataBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
    padding:'2px 7px', borderRadius:99,
    background:'var(--teal-light)', color:'var(--teal)',
    border:'1px solid rgba(29,107,90,0.2)', flexShrink:0, alignSelf:'flex-start', marginTop:1,
  },

  footer: { borderTop:'1px solid var(--border)', background:'var(--surface)', marginTop:'2rem', padding:'16px 20px' },
  footerInner: { maxWidth:800, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexWrap:'wrap' },
  footerText: { fontSize:12, color:'var(--ink-faint)' },
  footerDot:  { color:'var(--border-strong)' },
  footerLink: { display:'inline-flex', alignItems:'center', color:'var(--ink-muted)', textDecoration:'none', fontWeight:500, fontSize:12 },
}
