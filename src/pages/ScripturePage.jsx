import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildSchedule } from '../lib/supabase'
import { LBCF2 }     from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 }     from '../data/lbcf1'
import { buildScriptureIndex, BOOK_MAP } from '../lib/scriptureParser'

const SCHEDULE = buildSchedule()

const BOOK_NAMES_ORDERED = Array.from(
  new Map(Object.values(BOOK_MAP).map(b => [b.order, b])).values()
).sort((a, b) => a.order - b.order)

const OT_BOOKS = new Set(BOOK_NAMES_ORDERED.filter(b => b.order <= 39).map(b => b.name))
const NT_BOOKS = new Set(BOOK_NAMES_ORDERED.filter(b => b.order >= 40).map(b => b.name))

function srcBadge(src) {
  if (src === '2LBCF')     return { bg:'var(--purple-soft)', color:'var(--purple-ink)' }
  if (src === 'Catechism') return { bg:'var(--teal-light)',  color:'var(--teal)' }
  return                          { bg:'var(--amber-soft)',  color:'var(--amber-ink)' }
}

export default function ScripturePage() {
  const navigate = useNavigate()
  const [search,    setSearch]    = useState('')
  const [filterSrc, setFilterSrc] = useState('')   // '2LBCF' | 'Catechism' | '1LBCF' | ''
  const [filterDiv, setFilterDiv] = useState('')   // 'OT' | 'NT' | ''
  const [expanded,  setExpanded]  = useState(null) // book name

  /* Build full index once */
  const index = useMemo(() => buildScriptureIndex(LBCF2, CATECHISM, LBCF1, SCHEDULE), [])

  /* Filtered index */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return index.filter(entry => {
      if (filterSrc && !entry.citations.some(c => c.src === filterSrc)) return false
      if (filterDiv === 'OT' && !OT_BOOKS.has(entry.bookInfo.name)) return false
      if (filterDiv === 'NT' && !NT_BOOKS.has(entry.bookInfo.name)) return false
      if (q) {
        const inRef  = entry.refStr.toLowerCase().includes(q)
        const inBook = entry.bookInfo.name.toLowerCase().includes(q)
        const inLabel = entry.citations.some(c => c.label.toLowerCase().includes(q))
        if (!inRef && !inBook && !inLabel) return false
      }
      return true
    })
  }, [index, search, filterSrc, filterDiv])

  /* Group by book */
  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach(entry => {
      const name = entry.bookInfo.name
      if (!groups.has(name)) groups.set(name, { bookInfo: entry.bookInfo, entries: [] })
      groups.get(name).entries.push(entry)
    })
    return Array.from(groups.values()).sort((a, b) => a.bookInfo.order - b.bookInfo.order)
  }, [filtered])

  const totalRefs = filtered.length
  const totalCitations = filtered.reduce((s, e) => s + e.citations.length, 0)

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <img
              src="/pb-icon.svg"
              alt="P.B."
              style={{width:28, height:28, cursor:'pointer'}}
              onClick={() => navigate('/')}
            />
            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{gap:5, fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Dashboard
            </button>
          </div>
          <div style={s.navCenter}>
           
          </div>
          <span style={{fontSize:12, color:'var(--ink-faint)', whiteSpace:'nowrap'}}>
            {totalRefs.toLocaleString()} passages · {totalCitations.toLocaleString()} citations
          </span>
        </div>
      </nav>

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.controlsInner}>
          <div style={s.searchWrap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{color:'var(--ink-faint)',flexShrink:0,marginRight:6}}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              style={s.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search passage, book, or confession…"
            />
            {search && (
              <button onClick={() => setSearch('')} style={s.clearBtn}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)} style={s.select}>
            <option value="">All Scripture</option>
            <option value="OT">Old Testament</option>
            <option value="NT">New Testament</option>
          </select>

          <select value={filterSrc} onChange={e => setFilterSrc(e.target.value)} style={s.select}>
            <option value="">All confessions</option>
            <option value="2LBCF">2LBCF only</option>
            <option value="Catechism">Catechism only</option>
            <option value="1LBCF">1LBCF only</option>
          </select>
        </div>
      </div>

      {/* Intro */}
      <div style={s.intro}>
        <div style={s.introInner}>
          <p style={s.introText}>
            Every Scripture proof text cited in the Second London Baptist Confession,
            Keach's Baptist Catechism, and the First London Baptist Confession —
            arranged in canonical order with links to the devotional day that covers each article.
          </p>
        </div>
      </div>

      {/* Index */}
      <div style={s.body}>
        {grouped.length === 0 ? (
          <div style={s.empty}>No passages found for that filter.</div>
        ) : (
          grouped.map(({ bookInfo, entries }) => {
            const isOpen = expanded === bookInfo.name || search.trim() !== ''
            const isOT   = OT_BOOKS.has(bookInfo.name)
            return (
              <div key={bookInfo.name} style={s.bookSection}>
                {/* Book heading */}
                <button
                  style={s.bookHeading}
                  onClick={() => setExpanded(e => e === bookInfo.name ? null : bookInfo.name)}
                >
                  <span style={{...s.testament, background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)', color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)'}}>
                    {isOT ? 'OT' : 'NT'}
                  </span>
                  <span style={s.bookName}>{bookInfo.name}</span>
                  <span style={s.bookCount}>{entries.length} passage{entries.length !== 1 ? 's' : ''}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                    style={{marginLeft:'auto', transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)'}}
                  >
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* Entries */}
                {isOpen && (
                  <div style={s.entryList}>
                    {entries.map(entry => (
                      <div key={entry.refStr} style={s.entryRow}>
                        <span style={s.refStr}>{entry.refStr}</span>
                        <span style={s.dash}>—</span>
                        <div style={s.citations}>
                          {entry.citations.map((c, i) => {
                            const badge = srcBadge(c.src)
                            return (
                              <React.Fragment key={i}>
                                {i > 0 && <span style={s.citeSep}>,</span>}
                                <button
                                  style={{...s.citeBtn, background: badge.bg, color: badge.color}}
                                  onClick={() => navigate(`/day/${c.day}`)}
                                  title={`Go to Day ${c.day}`}
                                >
                                  {c.label}
                                  <span style={s.dayHint}> · Day {c.day}</span>
                                </button>
                              </React.Fragment>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={{fontSize:12, color:'var(--ink-faint)'}}>
            {index.length.toLocaleString()} total passages · {index.reduce((s,e) => s + e.citations.length, 0).toLocaleString()} total citations
          </span>
        </div>
      </footer>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif" },

  nav: { borderBottom:'1px solid var(--border)', background:'white', position:'sticky', top:0, zIndex:20 },
  navInner: { maxWidth:1000, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 },
  navCenter: { flex:1, textAlign:'center' },
  navTitle: { fontSize:15, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },

  controls: { background:'white', borderBottom:'1px solid var(--border)', padding:'12px 24px' },
  controlsInner: { maxWidth:1000, margin:'0 auto', display:'flex', gap:8, flexWrap:'wrap' },
  searchWrap: {
    flex:1, minWidth:200, display:'flex', alignItems:'center',
    border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--parchment)',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'8px 0', fontFamily:"'DM Sans',sans-serif",
  },
  clearBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:4 },
  select: {
    padding:'8px 12px', fontSize:13, border:'1px solid var(--border-strong)',
    borderRadius:'var(--radius)', background:'white', color:'var(--ink)', cursor:'pointer',
  },

  intro: { borderBottom:'1px solid var(--border)', padding:'1rem 24px', background:'var(--parchment-dark)' },
  introInner: { maxWidth:1000, margin:'0 auto' },
  introText: { fontSize:13, color:'var(--ink-muted)', lineHeight:1.7, margin:0, fontStyle:'italic' },

  body: { maxWidth:1000, margin:'0 auto', padding:'1.5rem 24px 4rem' },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },

  bookSection: { marginBottom:4 },

  bookHeading: {
    display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
    padding:'10px 14px', background:'white', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', marginBottom:2, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
  },
  testament: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, letterSpacing:'0.06em', flexShrink:0 },
  bookName:  { fontSize:15, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  bookCount: { fontSize:11, color:'var(--ink-faint)', marginLeft:4 },

  entryList: {
    display:'flex', flexDirection:'column', gap:0,
    borderLeft:'2px solid var(--border)', marginLeft:14, marginBottom:8,
    paddingLeft:0, background:'white', borderRadius:'0 0 var(--radius) var(--radius)',
    border:'1px solid var(--border)', borderTop:'none',
  },
  entryRow: {
    display:'flex', alignItems:'flex-start', gap:10,
    padding:'8px 14px', borderBottom:'1px solid var(--border)',
    flexWrap:'wrap',
  },
  refStr: {
    fontSize:13, fontWeight:600, color:'var(--ink)',
    fontVariantNumeric:'tabular-nums', minWidth:90, flexShrink:0,
  },
  dash:   { fontSize:13, color:'var(--ink-faint)', flexShrink:0, paddingTop:1 },
  citations: { display:'flex', flexWrap:'wrap', gap:4, alignItems:'center', flex:1 },
  citeSep:   { fontSize:12, color:'var(--ink-faint)' },
  citeBtn: {
    display:'inline-flex', alignItems:'center',
    fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99,
    border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'opacity 0.1s', whiteSpace:'nowrap',
  },
  dayHint: { fontSize:10, fontWeight:400, opacity:0.7, marginLeft:2 },

  footer: { borderTop:'1px solid var(--border)', background:'white', padding:'16px 24px' },
  footerInner: { maxWidth:1000, margin:'0 auto', textAlign:'center' },
}
