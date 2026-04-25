import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useTheme } from '../App'
import { usePrefs } from '../App'
import { FONT_OPTIONS, FONT_SIZES } from '../components/FontPrefsPanel'
import { supabase, getLocalProgress, getBookmarks, toggleBookmark, buildSchedule } from '../lib/supabase'
import ExportModal from '../components/ExportModal'
import NotificationSettings from '../components/NotificationSettings'
import AchievementsSection from '../components/AchievementsSection'

const SCHEDULE = buildSchedule()

const SOURCES = [
  {
    label: '2LBCF', name: 'Second London Baptist Confession', year: '1689',
    color: 'var(--purple-ink)', bg: 'var(--purple-soft)',
    chapters: '32 chapters',
    desc: 'The doctrinal standard of Particular Baptists — a thorough statement of Reformed theology grounded in Scripture, closely following the Westminster Confession with key Baptist modifications.',
    route: '2lbcf',
    href: 'https://www.the1689confession.com/',
  },
  {
    label: 'Catechism', name: "Keach's Baptist Catechism", year: '1693',
    color: 'var(--teal)', bg: 'var(--teal-light)',
    chapters: '114 questions',
    desc: 'One hundred and fourteen questions and answers teaching the essentials of Christian doctrine — designed by Benjamin Keach for instruction in faith and practice for all ages.',
    route: 'catechism',
    href: 'https://baptistcatechism.org/',
  },
  {
    label: '1LBCF', name: 'First London Baptist Confession', year: '1644',
    color: 'var(--amber-ink)', bg: 'var(--amber-soft)',
    chapters: '52 articles',
    desc: 'The founding document of the Particular Baptist movement — fifty-two articles affirming biblical faith, distinguishing these congregations from General Baptists and Anabaptists.',
    route: '1lbcf',
    href: 'https://london1644.info/en/fulltext.html',
  },
]

const FEATURES = [
  { title: 'Full Confession Texts', body: 'Read each paragraph of the 2LBCF, Keach\'s Catechism, and the 1LBCF inline — no external sites required.' },
  { title: 'Scripture Proof Texts', body: 'Every article is grounded in Scripture. See the proof texts that anchor each doctrinal statement to God\'s Word.' },
  { title: 'Pastoral Quotes', body: 'Keach, Coxe, Knollys, Owen, Renihan — historical voices illuminate each reading with theological depth.' },
  { title: 'Progress Tracking', body: 'Mark days complete, build streaks, and sync your progress across devices when you sign in.' },
  { title: 'Personal Notes', body: 'Write reflections for any day. Your notes are saved privately and sync to your account.' },
  { title: 'Quiz', body: '"How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and history.' },
]

export default function AboutPage() {
  const navigate    = useNavigate()
  const { session } = useAuth()
  const { dark, toggleDark } = useTheme()
  const { prefs, updatePrefs } = usePrefs()

  const [progressData, setProgressData] = useState(null)
  const [exportOpen,   setExportOpen]   = useState(false)
  const [resetDone,    setResetDone]    = useState(false)
  const [resetting,    setResetting]    = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  /* ── Notes & Bookmarks ── */
  const [userNotes,  setUserNotes]  = useState([])
  const [bookmarks,  setBookmarks]  = useState(() => getBookmarks())
  const [notesTabOpen, setNotesTabOpen] = useState(true)
  const [bmTabOpen,    setBmTabOpen]    = useState(true)

  /* Load notes + progress (for achievements) */
  useEffect(() => {
    if (session) {
      supabase.from('progress').select('day_number, completed, notes')
        .eq('user_id', session.user.id)
        .then(({ data }) => {
          const rows = data || []
          const notes = rows.filter(r => r.notes && r.notes.trim())
          setUserNotes(notes)
          setProgressData(rows)
        })
    } else {
      const local = getLocalProgress()
      const notes = Object.entries(local)
        .filter(([, d]) => d.notes && d.notes.trim())
        .map(([day, d]) => ({ day_number: parseInt(day), notes: d.notes }))
      setUserNotes(notes)
      setProgressData(null) // AchievementsSection reads localStorage itself
    }
  }, [session])

  /* Refresh bookmarks whenever the page is focused */
  useEffect(() => {
    const handler = () => setBookmarks(getBookmarks())
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  const enrichedNotes = useMemo(() =>
    userNotes
      .map(n => ({ ...n, entry: SCHEDULE.find(r => r.day === n.day_number) }))
      .filter(n => n.entry)
      .sort((a, b) => a.day_number - b.day_number),
    [userNotes]
  )

  const bookmarkedEntries = useMemo(() =>
    Object.keys(bookmarks)
      .map(d => SCHEDULE.find(r => r.day === parseInt(d)))
      .filter(Boolean)
      .sort((a, b) => a.day - b.day),
    [bookmarks]
  )

  function handleRemoveBookmark(day, e) {
    e.stopPropagation()
    toggleBookmark(day)
    setBookmarks(prev => { const next = { ...prev }; delete next[day]; return next })
  }

  /* ── Reset all progress (preserve notes) ── */
  const handleReset = useCallback(async () => {
    setResetting(true)
    try {
      // Clear bible reading progress
      localStorage.removeItem('pb-bible-progress')

      if (session) {
        // Supabase: reset completed=false but keep notes
        await supabase.from('progress')
          .update({ completed: false, updated_at: new Date().toISOString() })
          .eq('user_id', session.user.id)
      } else {
        // Local: clear completed flag per day, keep notes
        const local = getLocalProgress()
        const cleaned = {}
        Object.entries(local).forEach(([day, d]) => {
          if (d.notes && d.notes.trim()) cleaned[day] = { notes: d.notes }
          // else omit entirely (no notes, no completed)
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

  const activeFont = FONT_OPTIONS.find(f => f.id === prefs.fontId) || FONT_OPTIONS[0]

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <img src="/pb-icon.svg" alt="P.B." style={{width:28, height:28}} />
            <h1 style={s.headerTitle}>Settings &amp; About</h1>
          </div>
        </div>
      </header>

      <main style={s.main}>

        {/* ════════════════════════════════ SETTINGS ════════════════════════════════ */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Settings</h2>

          {/* ── Dark Mode ── */}
          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <span style={s.settingName}>Dark Mode</span>
              <span style={s.settingHint}>Easier on the eyes in low-light</span>
            </div>
            <button
              onClick={toggleDark}
              style={{
                ...s.toggle,
                background: dark ? 'var(--teal)' : 'var(--border-strong)',
              }}
              aria-pressed={dark}
              aria-label="Toggle dark mode"
            >
              <span style={{
                ...s.toggleKnob,
                transform: dark ? 'translateX(20px)' : 'translateX(2px)',
              }} />
            </button>
          </div>

          {/* ── Notifications ── */}
          <NotificationSettings userId={session?.user?.id} />

          {/* ── Font Size ── */}
          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <span style={s.settingName}>Reading Font Size</span>
              <span style={s.settingHint}>Applies to confession &amp; reading text</span>
            </div>
            <div style={s.sizeRow}>
              {FONT_SIZES.map(sz => {
                const active = prefs.sizePx === sz.px
                return (
                  <button
                    key={sz.id}
                    onClick={() => updatePrefs({ ...prefs, sizePx: sz.px })}
                    style={{
                      ...s.sizeBtn,
                      fontSize: sz.px * 0.8,
                      fontFamily: activeFont.css,
                      color: active ? 'var(--teal)' : 'var(--ink-muted)',
                      borderColor: active ? 'var(--teal)' : 'var(--border-strong)',
                      background: active ? 'var(--teal-light)' : 'var(--surface)',
                      fontWeight: active ? 700 : 400,
                    }}
                  >A</button>
                )
              })}
            </div>
          </div>

          {/* ── Font Style ── */}
          <div style={{...s.settingRow, alignItems:'flex-start', flexWrap:'wrap', gap:12}}>
            <div style={s.settingLabel}>
              <span style={s.settingName}>Reading Font Style</span>
              <span style={s.settingHint}>Typeface for confession &amp; reading text</span>
            </div>
            <div style={s.fontGrid}>
              {FONT_OPTIONS.map(f => {
                const active = prefs.fontId === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => updatePrefs({ ...prefs, fontId: f.id })}
                    style={{
                      ...s.fontBtn,
                      fontFamily: f.css,
                      background: active ? 'var(--teal-light)' : 'var(--surface)',
                      borderColor: active ? 'var(--teal)' : 'var(--border-strong)',
                      color: active ? 'var(--teal)' : 'var(--ink)',
                    }}
                  >
                    <span style={{fontSize:15, lineHeight:1.2}}>The fear of the Lord</span>
                    <span style={{fontSize:10, fontFamily:"'DM Sans',sans-serif", fontWeight:600, color: active ? 'var(--teal)' : 'var(--ink-faint)'}}>
                      {f.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Backup / Export ── */}
          <div style={s.settingRow}>
            <div style={s.settingLabel}>
              <span style={s.settingName}>Backup &amp; Export</span>
              <span style={s.settingHint}>Download your progress and notes as JSON or Markdown</span>
            </div>
            <button
              onClick={() => setExportOpen(true)}
              className="btn btn-outline"
              style={{fontSize:13, flexShrink:0}}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{marginRight:4}}>
                <path d="M7 1v8M4.5 6l2.5 4 2.5-4M2 10.5v1A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download Backup
            </button>
          </div>

          {/* ── Reset Progress ── */}
          <div style={{...s.settingRow, borderBottom:'none', paddingBottom:0}}>
            <div style={s.settingLabel}>
              <span style={s.settingName}>Reset All Progress</span>
              <span style={s.settingHint}>Clears devotional &amp; Bible checkboxes — your notes are kept</span>
            </div>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="btn btn-outline"
                style={{fontSize:13, color:'#b33', borderColor:'rgba(180,50,50,0.3)', flexShrink:0}}
              >
                Reset Progress
              </button>
            ) : (
              <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap'}}>
                <span style={{fontSize:12, color:'var(--ink-muted)'}}>Are you sure?</span>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="btn btn-outline"
                  style={{fontSize:12, color:'#b33', borderColor:'rgba(180,50,50,0.4)', padding:'5px 12px'}}
                >
                  {resetting ? 'Resetting…' : 'Yes, reset'}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="btn btn-ghost"
                  style={{fontSize:12, padding:'5px 10px'}}
                >Cancel</button>
              </div>
            )}
            {resetDone && (
              <span style={{fontSize:12, color:'var(--teal)', fontWeight:600, marginLeft:8}}>✓ Progress cleared</span>
            )}
          </div>
        </section>

        {/* ════════════════════════════════ ACHIEVEMENTS ════════════════════════ */}
        <AchievementsSection supabaseProgress={session ? progressData : null} />

        {/* ════════════════════════════════ MY NOTES ════════════════════════════════ */}
        <section style={s.section}>
          <button
            onClick={() => setNotesTabOpen(o => !o)}
            style={s.collapsibleHeader}
            aria-expanded={notesTabOpen}
          >
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2.5h12M2 5.5h8M2 8.5h10M2 11.5h6" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <h2 style={{...s.sectionTitle, margin:0}}>My Notes</h2>
              {enrichedNotes.length > 0 && (
                <span style={s.countBadge}>{enrichedNotes.length}</span>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{transition:'transform 0.2s', transform: notesTabOpen ? 'rotate(180deg)' : 'none', flexShrink:0}}>
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>

          {notesTabOpen && (
            <div style={{marginTop:12}}>
              {!session ? (
                <div style={s.emptyState}>
                  <p style={s.emptyText}>Sign in to sync and view all your notes here.</p>
                  <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{fontSize:13}}>
                    Sign in →
                  </button>
                </div>
              ) : enrichedNotes.length === 0 ? (
                <div style={s.emptyState}>
                  <p style={s.emptyText}>No notes yet. Open any reading day to add your reflections.</p>
                </div>
              ) : (
                <div style={s.notesList}>
                  {enrichedNotes.map(n => (
                    <div
                      key={n.day_number}
                      style={s.noteCard}
                      onClick={() => navigate(`/day/${n.day_number}`)}
                    >
                      <div style={s.noteCardHeader}>
                        <span style={s.noteDay}>Day {n.day_number}</span>
                        <span style={s.noteDate}>{n.entry.date}</span>
                        <span style={{...s.noteSrc, background:
                          n.entry.src==='2LBCF' ? 'var(--purple-soft)' :
                          n.entry.src==='Catechism' ? 'var(--teal-light)' : 'var(--amber-soft)',
                          color:
                          n.entry.src==='2LBCF' ? 'var(--purple-ink)' :
                          n.entry.src==='Catechism' ? 'var(--teal)' : 'var(--amber-ink)',
                        }}>{n.entry.src}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:'auto', opacity:.35}}>
                          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <p style={s.noteReading}>{n.entry.reading}</p>
                      <p style={s.notePreview}>{n.notes.slice(0, 120)}{n.notes.length > 120 ? '…' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ════════════════════════════════ BOOKMARKS ════════════════════════════════ */}
        <section style={s.section}>
          <button
            onClick={() => setBmTabOpen(o => !o)}
            style={s.collapsibleHeader}
            aria-expanded={bmTabOpen}
          >
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 2A1.5 1.5 0 014.5 .5h7A1.5 1.5 0 0113 2v13l-5-3-5 3V2z"
                  stroke="var(--teal)" strokeWidth="1.4" strokeLinejoin="round" fill="var(--teal)" fillOpacity="0.15"/>
              </svg>
              <h2 style={{...s.sectionTitle, margin:0}}>Saved Days</h2>
              {bookmarkedEntries.length > 0 && (
                <span style={s.countBadge}>{bookmarkedEntries.length}</span>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{transition:'transform 0.2s', transform: bmTabOpen ? 'rotate(180deg)' : 'none', flexShrink:0}}>
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>

          {bmTabOpen && (
            <div style={{marginTop:12}}>
              {bookmarkedEntries.length === 0 ? (
                <div style={s.emptyState}>
                  <p style={s.emptyText}>No saved days yet. Tap the bookmark icon on any reading day to save it here.</p>
                </div>
              ) : (
                <div style={s.notesList}>
                  {bookmarkedEntries.map(entry => (
                    <div
                      key={entry.day}
                      style={s.noteCard}
                      onClick={() => navigate(`/day/${entry.day}`)}
                    >
                      <div style={s.noteCardHeader}>
                        <span style={s.noteDay}>Day {entry.day}</span>
                        <span style={s.noteDate}>{entry.date}</span>
                        <span style={{...s.noteSrc,
                          background: entry.src==='2LBCF' ? 'var(--purple-soft)' :
                            entry.src==='Catechism' ? 'var(--teal-light)' : 'var(--amber-soft)',
                          color: entry.src==='2LBCF' ? 'var(--purple-ink)' :
                            entry.src==='Catechism' ? 'var(--teal)' : 'var(--amber-ink)',
                        }}>{entry.src}</span>
                        <button
                          onClick={(e) => handleRemoveBookmark(entry.day, e)}
                          style={s.removeBtn}
                          title="Remove bookmark"
                        >
                          ×
                        </button>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{opacity:.35}}>
                          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <p style={s.noteReading}>{entry.reading}</p>
                      <p style={{...s.notePreview, color:'var(--ink-faint)', fontStyle:'italic'}}>{entry.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ════════════════════════════════ SOURCES ════════════════════════════════ */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>The Confessions</h2>
          <p style={s.sectionDesc}>Three historical Baptist documents used in this 365-day plan.</p>
          <div style={s.sourceGrid}>
            {SOURCES.map(src => (
              <div key={src.label} style={{...s.sourceCard, borderColor: src.color, background: src.bg}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                  <span style={{...s.sourceBadge, color: src.color}}>{src.label}</span>
                  <span style={{fontSize:11, color: src.color, opacity:0.7}}>{src.year}</span>
                  <span style={{marginLeft:'auto', fontSize:11, color: src.color, opacity:0.7}}>{src.chapters}</span>
                </div>
                <h4 style={{fontSize:15, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color: src.color, marginBottom:6}}>
                  {src.name}
                </h4>
                <p style={{fontSize:12, color:'var(--ink-muted)', lineHeight:1.6, marginBottom:10}}>{src.desc}</p>
                <div style={{display:'flex', gap:12, alignItems:'center'}}>
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
        </section>

        {/* ════════════════════════════════ ABOUT ════════════════════════════════ */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>About this App</h2>
          <p style={s.sectionDesc}>
            A year of daily reading through the foundational confessions and catechism of Particular Baptist theology.
            Walk through Scripture doctrine with historical voices, pastoral quotes, and space for your own reflections.
          </p>
          <div style={s.featureGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={s.featureDot} />
                <div>
                  <div style={s.featureName}>{f.title}</div>
                  <div style={s.featureBody}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quick nav ── */}
        <section style={{...s.section, borderBottom:'none', paddingBottom:0}}>
          <h2 style={s.sectionTitle}>Navigate</h2>
          <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
            {[
              {label:'Devotional', path:'/'},
              {label:'Confessions', path:'/confessions'},
              {label:'Scripture', path:'/scripture'},
              {label:'Quiz', path:'/quiz'},
            ].map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="btn btn-outline"
                style={{fontSize:13}}
              >
                {link.label}
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerText}>Created by Jeff Chavez with Claude Code</span>
          <span style={s.footerDot}>·</span>
          <a href="https://theologycheck.blog" target="_blank" rel="noopener noreferrer" style={s.footerLink}>
            <img src="https://theologycheckblog.wordpress.com/wp-content/uploads/2022/02/tc-logo.png"
              alt="TheologyCheck" style={{height:16, verticalAlign:'middle', marginRight:4}} />
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

  header: { position:'sticky', top:0, zIndex:20, background:'var(--surface)', borderBottom:'1px solid var(--border)', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' },
  headerInner: { maxWidth:800, margin:'0 auto', padding:'12px 20px', display:'flex', alignItems:'center' },
  headerTitle: { fontSize:17, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },

  main: { maxWidth:800, margin:'0 auto', padding:'1.5rem 20px 4rem' },

  section: {
    marginBottom:'2rem', paddingBottom:'2rem',
    borderBottom:'1px solid var(--border)',
  },
  sectionTitle: {
    fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--teal)', marginBottom:'0.5rem',
  },
  sectionDesc: { fontSize:13, color:'var(--ink-muted)', lineHeight:1.7, marginBottom:'1.25rem' },

  /* ── Settings rows ── */
  settingRow: {
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
    paddingBottom:16, marginBottom:16, borderBottom:'1px solid var(--border)',
    flexWrap:'wrap',
  },
  settingLabel: { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:180 },
  settingName: { fontSize:14, fontWeight:600, color:'var(--ink)' },
  settingHint: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5 },

  /* Toggle switch */
  toggle: {
    width:44, height:24, borderRadius:99, border:'none', cursor:'pointer',
    position:'relative', transition:'background 0.2s', flexShrink:0, padding:0,
  },
  toggleKnob: {
    position:'absolute', top:2, width:20, height:20,
    borderRadius:'50%', background:'var(--parchment)', transition:'transform 0.2s',
    boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
  },

  /* Size buttons */
  sizeRow: { display:'flex', gap:6, flexShrink:0 },
  sizeBtn: {
    width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid',
    cursor:'pointer', transition:'all 0.12s', display:'flex', alignItems:'center',
    justifyContent:'center', fontFamily:"'Cormorant Garamond',serif",
  },

  /* Font buttons */
  fontGrid: { display:'flex', flexDirection:'column', gap:5, flex:1, minWidth:200 },
  fontBtn: {
    display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10,
    padding:'8px 12px', border:'1.5px solid', borderRadius:'var(--radius)',
    cursor:'pointer', transition:'all 0.12s', width:'100%', textAlign:'left',
  },

  /* Sources */
  sourceGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 },
  sourceCard: {
    padding:'16px', borderRadius:'var(--radius-lg)', border:'1.5px solid',
    display:'flex', flexDirection:'column',
  },
  sourceBadge: { fontSize:11, fontWeight:700, letterSpacing:'0.05em' },

  /* Features */
  featureGrid: { display:'flex', flexDirection:'column', gap:10 },
  featureItem: { display:'flex', gap:12, alignItems:'flex-start' },
  featureDot: { width:6, height:6, borderRadius:'50%', background:'var(--teal)', flexShrink:0, marginTop:6 },
  featureName: { fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:2 },
  featureBody: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.6 },

  /* Footer */
  footer: { borderTop:'1px solid var(--border)', background:'var(--surface)', marginTop:'2rem', padding:'16px 20px' },
  footerInner: { maxWidth:800, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexWrap:'wrap' },
  footerText: { fontSize:12, color:'var(--ink-faint)' },
  footerDot:  { color:'var(--border-strong)' },
  footerLink: { display:'inline-flex', alignItems:'center', color:'var(--ink-muted)', textDecoration:'none', fontWeight:500, fontSize:12 },

  /* Notes & Bookmarks */
  collapsibleHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', background:'none', border:'none', cursor:'pointer',
    padding:'4px 0', textAlign:'left', color:'var(--ink)',
  },
  countBadge: {
    fontSize:10, fontWeight:700, background:'var(--teal-light)', color:'var(--teal)',
    borderRadius:99, padding:'1px 7px', letterSpacing:'0.03em',
  },
  emptyState: {
    padding:'20px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:10,
  },
  emptyText: { fontSize:13, color:'var(--ink-faint)', textAlign:'center', margin:0 },
  notesList: { display:'flex', flexDirection:'column', gap:8 },
  noteCard: {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'12px 14px',
    cursor:'pointer', transition:'border-color 0.15s',
  },
  noteCardHeader: { display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' },
  noteDay:  { fontSize:11, fontWeight:700, color:'var(--teal)' },
  noteDate: { fontSize:11, color:'var(--ink-faint)' },
  noteSrc:  { fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, letterSpacing:'0.04em' },
  noteReading: { fontSize:13, fontWeight:600, color:'var(--ink)', margin:'0 0 4px', fontFamily:"'Cormorant Garamond',serif" },
  notePreview: { fontSize:12, color:'var(--ink-muted)', margin:0, lineHeight:1.55 },
  removeBtn: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    fontSize:16, lineHeight:1, padding:'0 2px', marginLeft:'auto',
  },
}
