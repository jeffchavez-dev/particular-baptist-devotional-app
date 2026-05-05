import React, { useState, useEffect, useMemo } from 'react'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { getBibleProgress, getLocalProgress, buildSchedule } from '../lib/supabase'

const SCHEDULE = buildSchedule()

/* ── Confession meta ── */
const CONF_META = {
  '2LBCF': {
    label: '2LBCF', fullName: '2nd London Baptist Confession',
    color: 'var(--purple-ink)', bg: 'var(--purple-soft)', border: 'rgba(93,63,155,0.25)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="11" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M6 6h5M6 9h5M6 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M14 9c1.5 0 3 .8 3 2.5S15.5 14 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  'Catechism': {
    label: 'Catechism', fullName: "Keach's Catechism",
    color: 'var(--teal)', bg: 'var(--teal-light)', border: 'rgba(29,107,90,0.25)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M10 7v4M10 13v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  '1LBCF': {
    label: '1LBCF', fullName: '1st London Baptist Confession',
    color: 'var(--amber-ink)', bg: 'var(--amber-soft)', border: 'rgba(163,107,42,0.25)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2l1.8 5.5H17l-4.7 3.4 1.8 5.5L10 13l-4.1 3.4 1.8-5.5L3 7.5h5.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
}

/* ── Bible categories ── */
const BIBLE_CATS = [
  { id:'law',     label:'The Law',         testament:'OT', books:['Genesis','Exodus','Leviticus','Numbers','Deuteronomy'] },
  { id:'hist',    label:'History',         testament:'OT', books:['Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther'] },
  { id:'wisdom',  label:'Psalms & Wisdom', testament:'OT', books:['Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon'] },
  { id:'major',   label:'Major Prophets',  testament:'OT', books:['Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel'] },
  { id:'minor',   label:'Minor Prophets',  testament:'OT', books:['Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'] },
  { id:'gospels', label:'Gospels',         testament:'NT', books:['Matthew','Mark','Luke','John'] },
  { id:'acts',    label:'Acts',            testament:'NT', books:['Acts'] },
  { id:'pauline', label:'Pauline Letters', testament:'NT', books:['Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews'] },
  { id:'general', label:'General Epistles',testament:'NT', books:['James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'] },
]

const BOOK_META = Object.fromEntries(BIBLE_BOOKS.map(b => [b.name, b]))

/* Short abbreviations for small badges */
const SHORT = {
  'Genesis':'Gen','Exodus':'Exo','Leviticus':'Lev','Numbers':'Num','Deuteronomy':'Deu',
  'Joshua':'Jos','Judges':'Jdg','Ruth':'Rut','1 Samuel':'1Sa','2 Samuel':'2Sa',
  '1 Kings':'1Ki','2 Kings':'2Ki','1 Chronicles':'1Ch','2 Chronicles':'2Ch',
  'Ezra':'Ezr','Nehemiah':'Neh','Esther':'Est','Job':'Job','Psalms':'Psa',
  'Proverbs':'Pro','Ecclesiastes':'Ecc','Song of Solomon':'SoS',
  'Isaiah':'Isa','Jeremiah':'Jer','Lamentations':'Lam','Ezekiel':'Eze','Daniel':'Dan',
  'Hosea':'Hos','Joel':'Joe','Amos':'Amo','Obadiah':'Oba','Jonah':'Jon',
  'Micah':'Mic','Nahum':'Nah','Habakkuk':'Hab','Zephaniah':'Zep','Haggai':'Hag',
  'Zechariah':'Zec','Malachi':'Mal','Matthew':'Mat','Mark':'Mrk','Luke':'Luk',
  'John':'Jhn','Acts':'Act','Romans':'Rom','1 Corinthians':'1Co','2 Corinthians':'2Co',
  'Galatians':'Gal','Ephesians':'Eph','Philippians':'Php','Colossians':'Col',
  '1 Thessalonians':'1Th','2 Thessalonians':'2Th','1 Timothy':'1Ti','2 Timothy':'2Ti',
  'Titus':'Tit','Philemon':'Phm','Hebrews':'Heb','James':'Jas','1 Peter':'1Pe',
  '2 Peter':'2Pe','1 John':'1Jn','2 John':'2Jn','3 John':'3Jn','Jude':'Jud','Revelation':'Rev',
}

/* ── Compute confession stats ── */
function useConfessionStats(supabaseProgress) {
  return useMemo(() => {
    // Build day→completed map
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
      const done  = days.filter(e => completedDays.has(e.day)).length
      stats[src] = { total: days.length, done, pct: days.length ? Math.round(done / days.length * 100) : 0 }
    }
    return stats
  }, [supabaseProgress])
}

/* ── Compute Bible book stats ── */
function useBibleStats() {
  const [bibleProgress, setBibleProgress] = useState(() => getBibleProgress())

  useEffect(() => {
    // Refresh on focus (user may have read chapters)
    const handler = () => setBibleProgress(getBibleProgress())
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  return useMemo(() => {
    const bookStats = {}
    for (const { name, chapters } of BIBLE_BOOKS) {
      let done = 0
      for (let ch = 1; ch <= chapters; ch++) {
        if (bibleProgress[`${name} ${ch}`]) done++
      }
      bookStats[name] = { total: chapters, done, complete: done === chapters }
    }
    return bookStats
  }, [bibleProgress])
}

/* ── Confession chip (compact, like Bible book chips) ── */
function ConfChip({ src, stats }) {
  const meta = CONF_META[src]
  const done = stats.total > 0 && stats.done === stats.total
  return (
    <div
      title={`${meta.fullName}: ${stats.done}/${stats.total} readings completed`}
      style={{
        ...a.confChip,
        background:   done ? meta.bg : stats.pct > 0 ? meta.bg : 'var(--parchment)',
        borderColor:  done ? meta.border : stats.pct > 0 ? meta.border : 'var(--border)',
        color:        done ? meta.color : stats.pct > 0 ? meta.color : 'var(--ink-faint)',
      }}
    >
      <span style={{ fontWeight:700, color: meta.color }}>{meta.label}</span>
      <span style={{ opacity:0.4 }}>·</span>
      {done
        ? <span style={{ fontSize:10 }}>✓</span>
        : <span style={{ fontSize:10, fontWeight:500 }}>{stats.done}/{stats.total}</span>
      }
    </div>
  )
}

/* ── Main component ── */
export default function AchievementsSection({ supabaseProgress, hideHeader = false }) {
  const [open, setOpen] = useState(false)
  const confStats  = useConfessionStats(supabaseProgress)
  const bibleStats = useBibleStats()

  const totalBooksComplete = Object.values(bibleStats).filter(b => b.complete).length
  const otComplete = BIBLE_BOOKS.filter(b => b.testament === 'OT').every(b => bibleStats[b.name]?.complete)
  const ntComplete = BIBLE_BOOKS.filter(b => b.testament === 'NT').every(b => bibleStats[b.name]?.complete)

  const totalEarned =
    (confStats['2LBCF']?.done  === confStats['2LBCF']?.total  ? 1 : 0) +
    (confStats['Catechism']?.done === confStats['Catechism']?.total ? 1 : 0) +
    (confStats['1LBCF']?.done  === confStats['1LBCF']?.total  ? 1 : 0) +
    totalBooksComplete

  const content = (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* ── Confession Progress — compact chips ── */}
          <div>
            <div style={a.groupLabel}>
              Confession Reading
              <span style={a.groupSub}>
                {['2LBCF','Catechism','1LBCF'].filter(src => {
                  const s = confStats[src]; return s && s.total > 0 && s.done === s.total
                }).length} / 3 complete
              </span>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['2LBCF','Catechism','1LBCF'].map(src => (
                <ConfChip key={src} src={src} stats={confStats[src] || { done:0, total:1, pct:0 }} />
              ))}
            </div>
          </div>

          {/* ── Bible Books ── */}
          <div>
            <div style={a.groupLabel}>
              Bible Books
              <span style={a.groupSub}>{totalBooksComplete} / 66 complete</span>
            </div>

            {/* Testament summary badges */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <div style={{
                ...a.testamentBadge,
                background: otComplete ? 'var(--amber-soft)' : 'var(--surface)',
                borderColor: otComplete ? 'var(--amber-ink)' : 'var(--border)',
                color: otComplete ? 'var(--amber-ink)' : 'var(--ink-faint)',
              }}>
                {otComplete && '✓ '} Old Testament
                {!otComplete && <span style={{ fontSize:10, opacity:0.6 }}> · {BIBLE_BOOKS.filter(b=>b.testament==='OT' && bibleStats[b.name]?.complete).length}/39</span>}
              </div>
              <div style={{
                ...a.testamentBadge,
                background: ntComplete ? 'var(--purple-soft)' : 'var(--surface)',
                borderColor: ntComplete ? 'var(--purple-ink)' : 'var(--border)',
                color: ntComplete ? 'var(--purple-ink)' : 'var(--ink-faint)',
              }}>
                {ntComplete && '✓ '} New Testament
                {!ntComplete && <span style={{ fontSize:10, opacity:0.6 }}> · {BIBLE_BOOKS.filter(b=>b.testament==='NT' && bibleStats[b.name]?.complete).length}/27</span>}
              </div>
            </div>

            {/* Book badges by category */}
            {BIBLE_CATS.map(cat => {
              const catDone = cat.books.filter(b => bibleStats[b]?.complete).length
              return (
                <div key={cat.id} style={a.catRow}>
                  <div style={a.catLabel}>
                    {cat.label}
                    <span style={a.catCount}>{catDone}/{cat.books.length}</span>
                  </div>
                  <div style={a.bookGrid}>
                    {cat.books.map(bookName => {
                      const stats = bibleStats[bookName] || { done:0, total:1, complete:false }
                      const pct   = Math.round(stats.done / stats.total * 100)
                      return (
                        <div
                          key={bookName}
                          title={`${bookName}: ${stats.done}/${stats.total} chapters read`}
                          style={{
                            ...a.bookChip,
                            background: stats.complete ? 'var(--teal)' : pct > 0 ? 'var(--teal-light)' : 'var(--parchment)',
                            color:      stats.complete ? 'white' : pct > 0 ? 'var(--teal)' : 'var(--ink-faint)',
                            borderColor:stats.complete ? 'var(--teal)' : pct > 0 ? 'var(--teal)' : 'var(--border)',
                          }}
                        >
                          {SHORT[bookName] || bookName.slice(0,3)}
                          {stats.complete && (
                            <span style={a.bookCheck}>✓</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
  )

  /* When used inside an outer collapsible (hideHeader=true), render content directly */
  if (hideHeader) {
    return content
  }

  return (
    <section style={a.section}>
      {/* Collapsible header */}
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

  /* Confession chips — compact, like Bible book chips */
  confChip: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:11, fontWeight:500, padding:'6px 13px',
    border:'1.5px solid', borderRadius:99,
    transition:'all 0.15s', cursor:'default',
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Testament badges */
  testamentBadge: {
    fontSize:12, fontWeight:600, padding:'6px 14px',
    border:'1.5px solid', borderRadius:99, display:'flex', alignItems:'center', gap:4,
    transition:'all 0.2s',
  },

  /* Bible category rows */
  catRow:   { marginBottom:12 },
  catLabel: {
    fontSize:10, fontWeight:700, letterSpacing:'0.05em', color:'var(--ink-muted)',
    marginBottom:5, display:'flex', alignItems:'center', gap:6,
  },
  catCount: {
    fontSize:9, fontWeight:600, color:'var(--teal)', background:'var(--teal-light)',
    borderRadius:99, padding:'1px 5px',
  },
  bookGrid: { display:'flex', flexWrap:'wrap', gap:4 },
  bookChip: {
    fontSize:9, fontWeight:700, letterSpacing:'0.03em',
    padding:'4px 7px', borderRadius:6, border:'1px solid',
    fontFamily:"'DM Sans',sans-serif", cursor:'default',
    display:'flex', alignItems:'center', gap:3,
    transition:'all 0.15s',
    minWidth:32, textAlign:'center', justifyContent:'center',
  },
  bookCheck: { fontSize:8, fontWeight:900 },
}
