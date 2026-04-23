import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FontPrefsPanel, { loadPrefs, savePrefs, getFontCss } from '../components/FontPrefsPanel'
import { LBCF2 }     from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 }     from '../data/lbcf1'

/* ── 2LBCF chapter titles ── */
const CHAPTER_TITLES = {
  1: 'Of the Holy Scriptures',
  2: 'Of God and of the Holy Trinity',
  3: "Of God's Decree",
  4: 'Of Creation',
  5: 'Of Divine Providence',
  6: 'Of the Fall of Man, Of Sin, and of the Punishment Thereof',
  7: "Of God's Covenant",
  8: 'Of Christ the Mediator',
  9: 'Of Free Will',
  10: 'Of Effectual Calling',
  11: 'Of Justification',
  12: 'Of Adoption',
  13: 'Of Sanctification',
  14: 'Of Saving Faith',
  15: 'Of Repentance unto Life and Salvation',
  16: 'Of Good Works',
  17: 'Of the Perseverance of the Saints',
  18: 'Of the Assurance of Grace and Salvation',
  19: 'Of the Law of God',
  20: 'Of the Gospel and of the Extent of the Grace Thereof',
  21: 'Of Christian Liberty and Liberty of Conscience',
  22: 'Of Religious Worship and the Sabbath Day',
  23: 'Of Lawful Oaths and Vows',
  24: 'Of the Civil Magistrate',
  25: 'Of Marriage',
  26: 'Of the Church',
  27: 'Of the Communion of Saints',
  28: 'Of Baptism and the Lord\'s Supper',
  29: 'Of Baptism',
  30: "Of the Lord's Supper",
  31: 'Of the State of Man After Death and of the Resurrection of the Dead',
  32: 'Of the Last Judgment',
}

/* ── group 2LBCF entries by chapter ── */
function buildChapters() {
  const chapters = {}
  Object.entries(LBCF2).forEach(([key, item]) => {
    const parts = key.split('.')
    const ch = parseInt(parts[0])
    const para = parseInt(parts[1])
    if (!chapters[ch]) chapters[ch] = []
    chapters[ch].push({ key, para, text: item.text, refs: item.refs })
  })
  Object.keys(chapters).forEach(ch => chapters[ch].sort((a, b) => a.para - b.para))
  return chapters
}

const LBCF2_CHAPTERS = buildChapters()

/* ── Strip leading footnote markers (single lowercase letter) from refs ── */
function cleanRefs(refs) {
  if (!refs) return ''
  return refs.replace(/\b[a-z](?=[A-Z1-9])/g, '').replace(/\s+/g, ' ').trim()
}

/* ── Strip inline footnote markers from body text ── */
function cleanText(text) {
  // Remove single lowercase letters used as superscript footnote markers
  // Pattern: a lowercase letter directly before an uppercase letter or digit mid-word
  return text.replace(/(?<=[a-z,;. ])([a-z])(?=[A-Z])/g, '').trim()
}

const SOURCES = {
  '2lbcf':     { label: '2LBCF', name: 'Second London Baptist Confession (1677/1689)', color: 'var(--purple-ink)', bg: 'var(--purple-soft)', href: 'https://www.the1689confession.com/' },
  'catechism': { label: 'Catechism', name: "Keach's Baptist Catechism (1693)", color: 'var(--teal)', bg: 'var(--teal-light)', href: 'https://baptistcatechism.org/' },
  '1lbcf':     { label: '1LBCF', name: 'First London Baptist Confession (1644)', color: 'var(--amber-ink)', bg: 'var(--amber-soft)', href: 'https://london1644.info/en/fulltext.html' },
}

export default function ConfessionsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('t') || '2lbcf'
  const [activeChapter, setActiveChapter] = useState(null)
  const [search, setSearch] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [prefs, setPrefsState] = useState(() => loadPrefs())
  const contentRef = useRef(null)

  function updatePrefs(p) { setPrefsState(p); savePrefs(p) }

  /* Compute text style from prefs */
  const textStyle = { fontSize: prefs.sizePx, fontFamily: getFontCss(prefs.fontId) }

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setNavOpen(false) // close overlay when resizing to desktop
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const src = SOURCES[tab] || SOURCES['2lbcf']

  function setTab(t) {
    setSearchParams({ t })
    setActiveChapter(null)
    setSearch('')
    setNavOpen(false)
    window.scrollTo({ top: 0 })
  }

  function scrollToChapter(id) {
    const el = document.getElementById(id)
    if (el) {
      const offset = 120
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
    setActiveChapter(id)
    if (isMobile) setNavOpen(false) // close overlay after selection on mobile
  }

  /* ─── Chapter list for nav ─── */
  const chapterNav = useMemo(() => {
    if (tab === '2lbcf') {
      return Object.keys(LBCF2_CHAPTERS).map(ch => ({
        id: `ch-${ch}`,
        label: `Ch. ${ch}`,
        title: CHAPTER_TITLES[parseInt(ch)],
      }))
    }
    if (tab === '1lbcf') {
      return Object.entries(LBCF1).map(([num, item]) => ({
        id: `art-${num}`,
        label: `Art. ${num}`,
        title: item.title,
      }))
    }
    return []
  }, [tab])

  /* ─── Filtered content ─── */
  const q = search.toLowerCase().trim()

  return (
    <div style={s.page}>

      {/* ── Sticky header ── */}
      <header style={s.header}>
        <div style={s.headerTop}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <img
              src="/pb-icon.svg" alt="P.B."
              style={{width:28, height:28, cursor:'pointer'}}
              onClick={() => navigate('/')}
              title="Home"
            />
            <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{gap:5, fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Dashboard
            </button>
          </div>

          <div style={s.tabs}>
            {Object.entries(SOURCES).map(([key, info]) => (
              <button
                key={key}
                style={{...s.tab, ...(tab === key ? {...s.tabActive, background: info.bg, color: info.color, borderColor: info.color} : {})}}
                onClick={() => setTab(key)}
              >
                {info.label}
              </button>
            ))}
          </div>

          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={s.searchBox}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                style={s.searchInput}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
              />
              {search && (
                <button onClick={() => setSearch('')} style={s.clearBtn}>×</button>
              )}
            </div>
            <FontPrefsPanel prefs={prefs} onUpdate={updatePrefs} />
          </div>
        </div>

        {/* Confession title + source link + chapter toggle */}
        <div style={s.confessionBar}>
          <div style={s.confessionBarInner}>
            <span style={{...s.confessionBadge, background: src.bg, color: src.color}}>{src.label}</span>
            <span style={s.confessionName}>{src.name}</span>

            {/* Chapter toggle — always visible when there's a nav */}
            {chapterNav.length > 0 && (
              <button
                onClick={() => setNavOpen(o => !o)}
                className="btn btn-ghost"
                style={{fontSize:12, gap:5, padding:'5px 10px', marginLeft:4, flexShrink:0}}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="2" width="11" height="1.5" rx=".75" fill="currentColor"/>
                  <rect x="1" y="5.75" width="7"  height="1.5" rx=".75" fill="currentColor"/>
                  <rect x="1" y="9.5"  width="9"  height="1.5" rx=".75" fill="currentColor"/>
                </svg>
                {navOpen ? 'Close' : 'Chapters'}
              </button>
            )}

            <a href={src.href} target="_blank" rel="noopener noreferrer" style={s.sourceLink}>
              Source ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Mobile chapter overlay backdrop ── */}
      {isMobile && navOpen && chapterNav.length > 0 && (
        <div
          style={s.backdrop}
          onClick={() => setNavOpen(false)}
        />
      )}

      <div style={s.layout}>

        {/* ── Chapter nav ── */}
        {chapterNav.length > 0 && (
          <nav style={isMobile
            ? { ...s.chapNavMobile, transform: navOpen ? 'translateX(0)' : 'translateX(-100%)' }
            : { ...s.chapNav, display: navOpen ? 'block' : 'none' }
          }>
            {/* Mobile header */}
            {isMobile && (
              <div style={s.mobileNavHeader}>
                <span style={{fontSize:13, fontWeight:600, color:'var(--ink)'}}>Chapters</span>
                <button onClick={() => setNavOpen(false)} style={s.mobileNavClose}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
            <div style={isMobile ? s.chapNavInnerMobile : s.chapNavInner}>
              {chapterNav.map(ch => (
                <button
                  key={ch.id}
                  style={{...s.chapNavBtn, ...(activeChapter === ch.id ? s.chapNavBtnActive : {})}}
                  onClick={() => scrollToChapter(ch.id)}
                  title={ch.title}
                >
                  <span style={s.chapNavLabel}>{ch.label}</span>
                  <span style={s.chapNavTitle}>{ch.title}</span>
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* ── Main content ── */}
        <main style={s.main} ref={contentRef}>

          {/* ── 2LBCF ── */}
          {tab === '2lbcf' && (
            <div>
              {Object.entries(LBCF2_CHAPTERS).map(([chNum, paras]) => {
                const chTitle = CHAPTER_TITLES[parseInt(chNum)]
                const chId = `ch-${chNum}`
                // Filter
                if (q) {
                  const hasMatch = paras.some(p =>
                    p.text.toLowerCase().includes(q) || (p.refs || '').toLowerCase().includes(q)
                  ) || chTitle.toLowerCase().includes(q)
                  if (!hasMatch) return null
                }
                return (
                  <section key={chNum} id={chId} style={s.chapter}>
                    <div style={s.chapterHeader}>
                      <span style={s.chapterNum}>Chapter {chNum}</span>
                      <h2 style={s.chapterTitle}>{chTitle}</h2>
                    </div>
                    {paras.map(p => {
                      if (q && !p.text.toLowerCase().includes(q) && !(p.refs||'').toLowerCase().includes(q)) return null
                      return (
                        <div key={p.key} style={s.paragraph} id={`p-${p.key}`}>
                          <div style={s.paraNum}>§{p.para}</div>
                          <div style={s.paraBody}>
                            <p style={{...s.paraText, ...textStyle}}>{p.text}</p>
                            {p.refs && (
                              <div style={s.refs}>
                                <span style={s.refsLabel}>Proof texts: </span>
                                {cleanRefs(p.refs)}
                              </div>
                            )}
                          </div>
                          <div style={s.paraActions}>
                            <CopyBtn getText={() => {
                              let t = p.text
                              if (p.refs) t += '\n\nScripture proofs: ' + cleanRefs(p.refs)
                              return t
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}

          {/* ── Catechism ── */}
          {tab === 'catechism' && (
            <div style={s.catechismList}>
              {Object.entries(CATECHISM).map(([num, item]) => {
                if (q) {
                  const matches = item.q.toLowerCase().includes(q) ||
                    item.a.toLowerCase().includes(q) ||
                    (item.refs||'').toLowerCase().includes(q)
                  if (!matches) return null
                }
                return (
                  <div key={num} style={s.qaBlock} id={`qa-${num}`}>
                    <div style={s.qaNum}>Q.{num}</div>
                    <div style={s.qaBody}>
                      <p style={{...s.qaQuestion, ...textStyle}}>{item.q}</p>
                      <p style={{...s.qaAnswer, ...textStyle}}><strong style={{fontWeight:600}}>A.</strong> {item.a}</p>
                      {item.refs && (
                        <div style={s.refs}>
                          <span style={s.refsLabel}>Proof texts: </span>
                          {cleanRefs(item.refs)}
                        </div>
                      )}
                    </div>
                    <div style={s.qaActions}>
                      <CopyBtn getText={() => {
                        let t = `Q. ${item.q}\n\nA. ${item.a}`
                        if (item.refs) t += '\n\nScripture proofs: ' + cleanRefs(item.refs)
                        return t
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 1LBCF ── */}
          {tab === '1lbcf' && (
            <div>
              {Object.entries(LBCF1).map(([num, item]) => {
                const artId = `art-${num}`
                if (q) {
                  const matches = item.title.toLowerCase().includes(q) ||
                    item.text.toLowerCase().includes(q) ||
                    (item.refs||'').toLowerCase().includes(q)
                  if (!matches) return null
                }
                // Split text on \n and numbered lines
                const lines = item.text.split('\n').filter(l => l.trim())
                return (
                  <section key={num} id={artId} style={s.article}>
                    <div style={{...s.articleHeader, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                      <div>
                        <span style={s.articleNum}>Article {num}</span>
                        <h2 style={s.articleTitle}>{item.title}</h2>
                      </div>
                      <div style={s.articleActions}>
                        <CopyBtn getText={() => {
                          let t = `${item.title}\n\n${item.text}`
                          if (item.refs) t += '\n\nScripture proofs: ' + cleanRefs(item.refs)
                          return t
                        }} />
                      </div>
                    </div>
                    <div style={s.articleBody}>
                      {lines.map((line, i) => {
                        // Lines may start with a digit — strip it for display
                        const clean = line.replace(/^\d+\s+/, '').trim()
                        if (!clean) return null
                        return (
                          <p key={i} style={{...s.articleLine, ...textStyle}}>{clean}</p>
                        )
                      })}
                      {item.refs && (
                        <div style={s.refs}>
                          <span style={s.refsLabel}>Proof texts: </span>
                          {cleanRefs(item.refs)}
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* Empty search state */}
          {q && tab === '2lbcf' && Object.values(LBCF2_CHAPTERS).every(paras =>
            !paras.some(p => p.text.toLowerCase().includes(q) || (p.refs||'').toLowerCase().includes(q))
          ) && (
            <div style={s.empty}>No results for "{search}"</div>
          )}

        </main>
      </div>
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif" },

  /* header */
  header: {
    position:'sticky', top:0, zIndex:30,
    background:'white', borderBottom:'1px solid var(--border)',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerTop: {
    maxWidth:1200, margin:'0 auto',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 24px', gap:12, flexWrap:'wrap',
  },

  tabs: { display:'flex', gap:4 },
  tab: {
    padding:'6px 14px', borderRadius:'var(--radius)',
    border:'1.5px solid var(--border)', background:'var(--parchment)',
    fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink-muted)',
    transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif",
  },
  tabActive: { fontWeight:700 },

  searchBox: {
    display:'flex', alignItems:'center', gap:6,
    border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--parchment)', minWidth:160,
  },
  searchInput: {
    border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'7px 0',
    fontFamily:"'DM Sans',sans-serif", width:130,
  },
  clearBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px',
  },

  confessionBar: { borderTop:'1px solid var(--border)', padding:'8px 24px', background:'var(--parchment)' },
  confessionBarInner: {
    maxWidth:1200, margin:'0 auto',
    display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
  },
  confessionBadge: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:'0.05em', flexShrink:0 },
  confessionName: { fontSize:13, color:'var(--ink)', fontFamily:"'Cormorant Garamond',serif", fontWeight:600, flex:1 },
  sourceLink: {
    display:'inline-flex', alignItems:'center', fontSize:12, color:'var(--teal)',
    textDecoration:'none', fontWeight:500, whiteSpace:'nowrap', marginLeft:'auto',
  },

  /* layout */
  layout: { display:'flex', maxWidth:1200, margin:'0 auto', padding:'0 24px' },

  /* chapter sidebar nav */
  chapNav: {
    width:220, flexShrink:0, paddingTop:'1.5rem',
    '@media(max-width:768px)': { display:'none' },
  },
  chapNavInner: {
    position:'sticky', top:120, maxHeight:'calc(100vh - 140px)',
    overflowY:'auto', paddingRight:8,
    borderRight:'1px solid var(--border)',
  },
  chapNavBtn: {
    display:'flex', flexDirection:'column', alignItems:'flex-start',
    width:'100%', textAlign:'left', padding:'6px 10px', marginBottom:2,
    background:'none', border:'none', cursor:'pointer', borderRadius:'var(--radius)',
    transition:'background 0.1s', fontFamily:"'DM Sans',sans-serif",
  },
  chapNavBtnActive: { background:'var(--parchment-dark)' },
  chapNavLabel: { fontSize:11, fontWeight:700, color:'var(--teal)', letterSpacing:'0.04em' },
  chapNavTitle: { fontSize:11, color:'var(--ink-muted)', lineHeight:1.4, marginTop:1 },

  /* main reading area */
  main: { flex:1, padding:'2rem 0 4rem 2rem', maxWidth:760 },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },

  /* 2LBCF chapters */
  chapter: { marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  chapterHeader: { marginBottom:'1.5rem' },
  chapterNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--teal)', display:'block', marginBottom:4 },
  chapterTitle: { fontSize:26, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.2 },

  paragraph: { display:'flex', gap:16, marginBottom:'1.5rem', alignItems:'flex-start' },
  paraNum: {
    fontSize:12, fontWeight:700, color:'var(--ink-faint)', flexShrink:0,
    minWidth:28, paddingTop:3, fontVariantNumeric:'tabular-nums',
  },
  paraBody: { flex:1 },
  paraActions: { display:'flex', gap:8, flexShrink:0, alignItems:'flex-start' },
  paraText: {
    fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9,
    color:'var(--ink)', margin:'0 0 8px',
  },

  /* Catechism */
  catechismList: {},
  qaBlock: { display:'flex', gap:16, marginBottom:'1.75rem', paddingBottom:'1.75rem', borderBottom:'1px solid var(--border)', alignItems:'flex-start' },
  qaNum: {
    fontSize:12, fontWeight:700, color:'var(--teal)', flexShrink:0,
    minWidth:32, paddingTop:2, fontVariantNumeric:'tabular-nums',
  },
  qaBody: { flex:1 },
  qaActions: { display:'flex', gap:8, flexShrink:0, alignItems:'flex-start' },
  qaQuestion: {
    fontSize:17, fontFamily:"'Cormorant Garamond',serif", fontWeight:600,
    color:'var(--ink)', lineHeight:1.55, margin:'0 0 8px',
  },
  qaAnswer: {
    fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.85,
    color:'var(--ink)', margin:'0 0 8px',
  },

  /* 1LBCF */
  article: { marginBottom:'2.5rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  articleHeader: { marginBottom:'1rem' },
  articleActions: { display:'flex', gap:8, flexShrink:0, alignItems:'flex-start' },
  articleNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--amber-ink)', display:'block', marginBottom:4 },
  articleTitle: { fontSize:24, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.25 },
  articleBody: { paddingLeft:4 },
  articleLine: {
    fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9,
    color:'var(--ink)', margin:'0 0 6px',
  },

  /* Proof texts (shared) */
  refs: {
    fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, marginTop:8,
    borderLeft:'2px solid var(--border)', paddingLeft:10,
    fontFamily:"'DM Sans',sans-serif",
  },
  refsLabel: { fontWeight:600, color:'var(--ink-muted)' },

  /* Mobile chapter nav overlay */
  backdrop: {
    position:'fixed', inset:0, background:'rgba(30,24,16,0.45)',
    zIndex:40, backdropFilter:'blur(2px)',
  },
  chapNavMobile: {
    position:'fixed', top:0, left:0, bottom:0, width:280,
    background:'white', borderRight:'1px solid var(--border)',
    boxShadow:'4px 0 24px rgba(0,0,0,0.12)',
    zIndex:50, display:'flex', flexDirection:'column',
    transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
  },
  mobileNavHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'white', flexShrink:0,
  },
  mobileNavClose: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    justifyContent:'center', padding:6, borderRadius:'var(--radius)',
  },
  chapNavInnerMobile: {
    flex:1, overflowY:'auto', padding:'8px',
  },
}
