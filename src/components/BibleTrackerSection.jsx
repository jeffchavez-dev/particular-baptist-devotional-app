/**
 * BibleTrackerSection
 * Moved from ScripturePage — used in Settings (AboutPage) under "Bible Tracker".
 */
import React, { useState, useCallback, useEffect } from 'react'
import { BIBLE_BOOKS, TOTAL_CHAPTERS } from '../lib/bibleBooks'
import { getBibleProgress, setBibleChapter, BIBLE_KEY } from '../lib/supabase'
import { DAY_BIBLE } from '../data/readingPlan'
import { useAuth } from '../App'

/* ── Plan index: book → sorted chapter numbers ── */
const PLAN_BY_BOOK = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([dayStr, chStr]) => {
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

const PLAN_BOOKS_ORDERED = Object.keys(PLAN_BY_BOOK)
  .filter(b => BOOK_META[b])
  .sort((a, z) => (BOOK_META[a]?.order ?? 999) - (BOOK_META[z]?.order ?? 999))

export const PLAN_TOTAL = Object.values(PLAN_BY_BOOK).reduce((s, chs) => s + chs.length, 0)

const CHAPTER_TO_DAYS = (() => {
  const m = {}
  Object.entries(DAY_BIBLE).forEach(([d, ch]) => {
    if (!m[ch]) m[ch] = []
    m[ch].push(parseInt(d))
  })
  return m
})()

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

/* ── Big progress bar (overall) ── */
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

/* ── Inline chapter progress bar ── */
function ChBar({ done, total, color }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ height:5, borderRadius:99, background:'rgba(0,0,0,0.08)', overflow:'hidden', flex:1 }}>
      <div style={{ height:'100%', borderRadius:99, background: color, width:`${pct}%`, transition:'width 0.3s', opacity:0.85 }} />
    </div>
  )
}

/* ── Small chapter checkbox ── */
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

/* ── Category accordion ── */
function CategoryBox({ cat, planByBook, bibBooks, progress, mode, onToggle, onNavigate, isOpen, onOpenToggle }) {
  const bookNames = mode === 'plan'
    ? cat.books.filter(b => planByBook[b])
    : cat.books.filter(b => bibBooks.find(bk => bk.name === b))

  const { total, done, booksDone } = bookNames.reduce((acc, name) => {
    if (mode === 'plan') {
      const chs = planByBook[name] || []
      acc.total += chs.length
      acc.done  += chs.filter(ch => progress[`${name} ${ch}`]).length
      if (chs.length > 0 && chs.every(ch => progress[`${name} ${ch}`])) acc.booksDone += 1
    } else {
      const bk = bibBooks.find(b => b.name === name)
      if (bk) {
        const doneChs = Array.from({length: bk.chapters}, (_, i) => i + 1)
          .filter(ch => progress[`${name} ${ch}`]).length
        acc.total += bk.chapters
        acc.done  += doneChs
        if (doneChs === bk.chapters) acc.booksDone += 1
      }
    }
    return acc
  }, { total:0, done:0, booksDone:0 })

  if (total === 0) return null

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{...t.catBox, borderColor: isOpen ? cat.color : 'var(--border)', borderLeftColor: cat.color, borderLeftWidth: 3}}>
      <button style={{...t.catHeader, background: isOpen ? cat.bg : 'var(--surface)'}} onClick={onOpenToggle}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Row 1: label + books count + arrow */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{...t.catLabel, color: cat.color}}>{cat.label}</span>
            <span style={{ fontSize:10, color:'var(--ink-faint)', flexShrink:0 }}>
              {bookNames.length} book{bookNames.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize:10, fontWeight:700, color: cat.color, flexShrink:0 }}>
              · {booksDone}/{bookNames.length} completed
            </span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ marginLeft:'auto', flexShrink:0, transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)' }}>
              <path d="M4 2.5l4.5 4.5L4 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          {/* Row 2: chapter progress bar */}
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
            const bk = bibBooks?.find(b => b.name === name)
            const chList = mode === 'plan'
              ? planChs.map(ch => ({ ch, chId:`${name} ${ch}`, isDone: !!progress[`${name} ${ch}`] }))
              : Array.from({length: bk?.chapters || 0}, (_, i) => i + 1).map(ch => ({
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
                {mode === 'plan' ? (
                  <div style={t.dayLinks}>
                    {chList.map(({ ch, chId, isDone }) =>
                      (CHAPTER_TO_DAYS[chId] || []).map(d => (
                        <button
                          key={`${ch}-${d}`}
                          onClick={() => onNavigate(d)}
                          style={{...t.dayLink, ...(isDone ? {background:'var(--teal)', color:'white', borderColor:'var(--teal)'} : {})}}
                          title={`Go to Day ${d}`}
                        >
                          {isDone && <span style={{marginRight:2}}>✓</span>}Ch.{ch} · Day {d}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={t.chGrid}>
                    {chList.map(({ ch, chId, isDone, inPlan }) => (
                      <ChapterBlock key={ch} chId={chId} done={isDone} inPlan={inPlan} onToggle={onToggle} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Testament section ── */
function TestamentSection({ testament, categories, planByBook, bibBooks, progress, mode, onToggle, onNavigate, openCats, setOpenCat }) {
  const isOT = testament === 'OT'

  /* Chapter counts */
  const { total, done } = mode === 'plan'
    ? Object.keys(planByBook)
        .filter(b => { const meta = bibBooks.find(bk => bk.name === b); return meta?.testament === testament })
        .reduce((acc, b) => {
          const chs = planByBook[b]
          acc.total += chs.length
          acc.done  += chs.filter(ch => progress[`${b} ${ch}`]).length
          return acc
        }, { total:0, done:0 })
    : bibBooks.filter(b => b.testament === testament)
        .reduce((acc, bk) => {
          acc.total += bk.chapters
          acc.done  += Array.from({length:bk.chapters},(_, i) => i + 1).filter(ch => progress[`${bk.name} ${ch}`]).length
          return acc
        }, { total:0, done:0 })

  /* Book counts */
  const allBooks = bibBooks.filter(b => b.testament === testament)
  const booksTotal = allBooks.length
  const booksDone  = allBooks.reduce((n, bk) => {
    const all = Array.from({length:bk.chapters},(_, i)=>i+1).every(ch=>progress[`${bk.name} ${ch}`])
    return n + (all ? 1 : 0)
  }, 0)

  const chPct = total > 0 ? Math.round((done / total) * 100) : 0
  const barColor = isOT ? 'var(--amber-ink)' : 'var(--purple-ink)'

  return (
    <div style={t.testamentSection}>
      {/* Testament header */}
      <div style={t.testamentHeader}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{
            ...t.testBadge,
            background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)',
            color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)',
          }}>{testament}</span>
          <span style={t.testamentLabel}>{isOT ? 'Old Testament' : 'New Testament'}</span>
          <span style={{ fontSize:12, fontWeight:700, color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)' }}>
            ({booksDone}/{booksTotal})
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
            planByBook={planByBook} bibBooks={bibBooks}
            progress={progress} mode={mode}
            onToggle={onToggle} onNavigate={onNavigate}
            isOpen={openCats.has(cat.id)}
            onOpenToggle={() => setOpenCat(cat.id)}
          />
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════════════════════════ */
export default function BibleTrackerSection() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [progress, setProgress] = useState(() => getBibleProgress())
  const [openCats, setOpenCats] = useState(new Set())

  /* Sync progress when any other part of the app marks a chapter */
  useEffect(() => {
    function onStorage(e) {
      if (e.key === BIBLE_KEY) setProgress(getBibleProgress())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function setOpenCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleChapter = useCallback((chId, done) => {
    setBibleChapter(chId, done, userId)
    setProgress(prev => {
      const next = { ...prev }
      if (done) next[chId] = true
      else delete next[chId]
      return next
    })
  }, [userId])

  const bibleDone = Object.keys(progress).length

  return (
    <div style={t.wrap}>
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
          testament="OT" categories={OT_CATEGORIES}
          planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
          progress={progress} mode="bible"
          onToggle={toggleChapter}
          openCats={openCats} setOpenCat={setOpenCat}
        />
        <TestamentSection
          testament="NT" categories={NT_CATEGORIES}
          planByBook={PLAN_BY_BOOK} bibBooks={BIBLE_BOOKS}
          progress={progress} mode="bible"
          onToggle={toggleChapter}
          openCats={openCats} setOpenCat={setOpenCat}
        />
      </div>
    </div>
  )
}

/* ── Styles ── */
const t = {
  wrap: { display:'flex', flexDirection:'column', gap:0 },

  section: { display:'flex', flexDirection:'column', gap:16 },
  progressCard: {
    background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    padding:'14px 16px', display:'flex', flexDirection:'column', gap:10,
  },
  progressNote: { fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, margin:0, display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 },
  legend: { display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--ink-faint)' },
  dot: { display:'inline-block', width:11, height:11, borderRadius:3, flexShrink:0 },

  testamentSection: { marginBottom:8 },
  testamentHeader: {
    padding:'10px 0 10px',
    marginBottom:10,
    borderBottom:'2px solid var(--border)',
  },
  testamentLabel: { fontSize:15, fontWeight:700, fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)', flex:1 },
  testBadge: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },

  /* Categories — vertical list instead of grid */
  catGrid: { display:'flex', flexDirection:'column', gap:8 },
  catBox: {
    background:'var(--surface)', border:'1.5px solid var(--border)',
    borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'border-color 0.15s',
  },
  catHeader: {
    display:'flex', alignItems:'stretch',
    padding:'10px 12px', width:'100%', textAlign:'left',
    border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'background 0.15s',
  },
  catLabel: { fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif", letterSpacing:'0.01em' },
  catBody: { padding:'8px 12px 12px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 },
  catBookRow: { display:'flex', flexDirection:'column', gap:6 },
  catBookHead: { display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 },
  catBookName: { fontSize:13, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  catBookProgress: { fontSize:10, color:'var(--ink-faint)', fontVariantNumeric:'tabular-nums', flexShrink:0 },
  chGrid: { display:'flex', flexWrap:'wrap', gap:4 },
  dayLinks: { display:'flex', flexWrap:'wrap', gap:4 },
  dayLink: {
    fontSize:10, color:'var(--teal)', background:'var(--teal-light)',
    border:'1px solid rgba(29,107,90,0.2)', borderRadius:99,
    padding:'3px 8px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    fontWeight:500, transition:'all 0.1s', display:'flex', alignItems:'center',
  },
}
