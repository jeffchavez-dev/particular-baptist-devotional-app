import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useTheme } from '../App'
import { usePrefs } from '../App'
import { FontDropdown, FONT_OPTIONS, FONT_SIZES, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP, GREEK_FONTS, HEBREW_FONTS } from '../components/FontPrefsPanel'
import { supabase, getLocalProgress, syncAll } from '../lib/supabase'
import ExportModal from '../components/ExportModal'
import NotificationSettings from '../components/NotificationSettings'
import AchievementsSection from '../components/AchievementsSection'
import BibleTrackerSection from '../components/BibleTrackerSection'
import {
  clearAllHighlights, clearAllNotes,
} from '../lib/annotations'
import {
  getDefaultReaderVersion, setDefaultReaderVersion, DEFAULT_VERSION_OPTIONS,
} from '../lib/readerPrefs'

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
  { title: 'Pastoral Quotes', body: 'Keach, Coxe, Knollys, Owen, Renihan — historical voices illuminate each reading with theological depth alongside the primary confession text.' },
  { title: 'Progress & Streaks', body: 'Mark days complete, build streaks, earn achievements, and sync your progress across devices when signed in.' },
  { title: 'Personal Notes & Highlights', body: 'Write reflections for any devotional day or confession paragraph. Highlight in five colors. Everything syncs to your account.' },
  { title: 'Quiz', body: '"How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and church history.' },
]

const SCRIPTURE_FEATURES = [
  { title: 'King James Version', body: 'Full KJV Bible with continuous infinite-scroll reading. Tap any word to search it across the whole Bible instantly.' },
  { title: 'New American Standard Bible 1995 (NASB)', body: 'Full NASB 1995 Bible with continuous reading, search, parallel mode, verse highlighting, notes, and chapter progress tracking — the same full feature set as KJV. The NASB is widely regarded for its literal accuracy and faithfulness to the original languages.' },
  { title: 'Greek New Testament (GNT)', body: 'Read the Translators Amalgamated GNT (TAGNT) word-by-word. Tap any word to see its Robinson morphology, Strong\'s number, gloss, and transliteration.' },
  { title: 'Hebrew Old Testament (HOT)', body: 'Read the TAHOT with full Masoretic pointing and cantillation. Each word displays ETCBC morphology — stem, aspect, person, gender, and number.' },
  { title: 'Greek Septuagint (LXX)', body: 'Read the Greek Old Testament (Septuagint) word-by-word. Tap any word to see its Strong\'s number and gloss in an inline strip. Enable LXX alongside the Hebrew OT in parallel mode to compare the two side-by-side. Jump to any LXX occurrence from the Strong\'s lexicon using "Find in LXX."' },
  { title: 'In-App Strong\'s Lexicon', body: 'Tap a Strong\'s number to open a full lexicon entry — lemma, transliteration, pronunciation, and definition — without leaving the app. Browse all 8,600+ entries.' },
  { title: 'Find in GNT / HOT', body: 'From any lexicon entry, search every occurrence of a word across the Greek NT or Hebrew OT. Results navigate to the exact verse with the matching word auto-highlighted.' },
  { title: 'Scroll-Synced Navigation', body: 'The chapter indicator in the header always reflects which chapter you\'re currently reading as you scroll through continuous chapters.' },
  { title: 'Verse Highlighting & Notes', body: 'Highlight individual verses in five colors and attach personal notes. Annotations are stored locally and sync to your account.' },
  { title: 'Offline Ready (PWA)', body: 'Install as a Progressive Web App. All Bible data — KJV, GNT, HOT, and lexicons — caches on first load and reads fully offline thereafter.' },
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
    name: 'NASB 1995 Bible JSON — GitHub',
    href: 'https://github.com/Amosamevor/Bible-json/tree/main/versions/en',
    desc: 'NASB 1995 text in JSON format used for the in-app Scripture reader. The New American Standard Bible 1995 is © The Lockman Foundation.',
    badge: 'Copyright',
  },
]

/* ── Collapsible section wrapper ── */
function CollapseSection({ id, icon, title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section style={cs.section}>
      <button
        onClick={() => setOpen(o => !o)}
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

  const [defaultVersion, setDefaultVersion] = useState(() => getDefaultReaderVersion())

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

  useEffect(() => {
    if (!session) return
    supabase.from('progress').select('day_number, completed, notes')
      .eq('user_id', session.user.id)
      .then(({ data }) => setProgressData(data || []))
  }, [session])

  const handleReset = useCallback(async () => {
    setResetting(true)
    try {
      localStorage.removeItem('pb-bible-progress')
      if (session) {
        await supabase.from('progress')
          .update({ completed: false, updated_at: new Date().toISOString() })
          .eq('user_id', session.user.id)
      } else {
        const local = getLocalProgress()
        const cleaned = {}
        Object.entries(local).forEach(([day, d]) => {
          if (d.notes && d.notes.trim()) cleaned[day] = { notes: d.notes }
        })
        localStorage.setItem('devotional_guest_progress', JSON.stringify(cleaned))
      }
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
      const result = await syncAll(session.user.id)
      setSyncMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      })
      setTimeout(() => setSyncMessage(null), 4000)
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
          <BibleTrackerSection />
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
          <AchievementsSection supabaseProgress={session ? progressData : null} hideHeader />
        </CollapseSection>

        {/* ════ 2. MY LIBRARY — direct link, no expand needed ════ */}
        <button
          onClick={() => navigate('/library')}
          style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            width:'100%', background:'var(--teal-light)', border:'1.5px solid var(--teal)',
            borderRadius:'var(--radius-lg)', padding:'14px 16px',
            cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
            transition:'background 0.12s',
          }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="2.5"
                stroke="var(--teal)" strokeWidth="1.5"
                fill="var(--teal)" fillOpacity="0.15"/>
              <path d="M6 7h8M6 10.5h5M6 14h6" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M13 2v4l-1.5-1-1.5 1V2" stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--teal)' }}>My Library</div>
              <div style={{ fontSize:12, color:'var(--teal)', opacity:0.8, marginTop:2 }}>
                Access notes, bookmarks, highlights &amp; more
              </div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
            <path d="M4 3l5 4-5 4" stroke="var(--teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* ════ 3. SETTINGS ════ */}
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

            {/* Orthodox Catechism in Daily Reading */}
            <div style={s.settingRow}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Include Orthodox Catechism</span>
                <span style={s.settingHint}>Add "An Orthodox Catechism" (1680) to your daily devotional alongside the 2LBCF, Keach, and 1LBCF readings</span>
              </div>
              <button
                onClick={() => updatePrefs({ ...prefs, includeOrthodox: !prefs.includeOrthodox })}
                style={{
                  position:'relative', width:44, height:24, borderRadius:12, flexShrink:0,
                  background: prefs.includeOrthodox ? '#0c4a6e' : 'var(--border-strong)',
                  border:'none', cursor:'pointer', padding:0, transition:'background 0.2s',
                }}
                role="switch"
                aria-checked={prefs.includeOrthodox}
                title={prefs.includeOrthodox ? 'Disable Orthodox Catechism' : 'Enable Orthodox Catechism'}
              >
                <span style={{
                  position:'absolute', top:3, left: prefs.includeOrthodox ? 23 : 3,
                  width:18, height:18, borderRadius:'50%',
                  background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
                  transition:'left 0.2s',
                }} />
              </button>
            </div>

            {/* Default Bible Translation */}
            <div style={{...s.settingRow, alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
              <div style={s.settingLabel}>
                <span style={s.settingName}>Default Bible Translation</span>
                <span style={s.settingHint}>Used when opening Scripture from devotionals and confession proof texts</span>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {DEFAULT_VERSION_OPTIONS.map(opt => {
                  const active = defaultVersion === opt.id
                  return (
                    <button
                      key={opt.id}
                      title={opt.full}
                      onClick={() => {
                        setDefaultVersion(opt.id)
                        setDefaultReaderVersion(opt.id)
                        // For concrete versions, update sessionStorage immediately so the
                        // Scripture page picks it up. For 'original', clear the session key
                        // so ScripturePage resolves HOT/GNT from the book context.
                        try {
                          if (opt.id === 'original') {
                            sessionStorage.removeItem('reader-version')
                          } else {
                            sessionStorage.setItem('reader-version', opt.id)
                          }
                        } catch {}
                      }}
                      style={{
                        padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:700,
                        fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
                        border: active ? '1.5px solid var(--teal)' : '1.5px solid var(--border-strong)',
                        background: active ? 'var(--teal-light)' : 'var(--surface)',
                        color: active ? 'var(--teal)' : 'var(--ink-muted)',
                        transition:'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
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
            A <strong>Particular Baptist study companion</strong> — daily devotional readings through the foundational
            confessions and catechisms, paired with a full Scripture study suite in KJV, Greek NT, and Hebrew OT.
          </p>
          <p style={{fontSize:13, color:'var(--ink-muted)', lineHeight:1.8, marginBottom:20}}>
            Walk through Reformed doctrine with historical voices, pastoral quotes, and personal annotations.
            Then open the same passage in the original languages, tap any word for morphology and lexicon data,
            and trace every Strong's number across the whole Bible — all in one app, fully offline-capable.
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
