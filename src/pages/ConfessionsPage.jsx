import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import FontPrefsPanel, { getFontCss } from '../components/FontPrefsPanel'
import { usePrefs } from '../App'
import CopyBtn from '../components/CopyBtn'
import { LBCF2 }     from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 }     from '../data/lbcf1'
import { saveState, loadState, saveScroll, restoreScroll } from '../lib/pageState'
import { parseRefs } from '../lib/parseRefs'
import KjvModal from '../components/KjvModal'

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
    const ch  = parseInt(parts[0])
    const para = parseInt(parts[1])
    if (!chapters[ch]) chapters[ch] = []
    chapters[ch].push({ key, para, text: item.text, refs: item.refs })
  })
  Object.keys(chapters).forEach(ch => chapters[ch].sort((a, b) => a.para - b.para))
  return chapters
}

const LBCF2_CHAPTERS = buildChapters()

function cleanRefs(refs) {
  if (!refs) return ''
  return refs.replace(/\b[a-z](?=[A-Z1-9])/g, '').replace(/\s+/g, ' ').trim()
}

function makeSearchable(text) {
  if (!text) return ''
  return text
    .replace(/(\w)-\s+/g, '$1')
    .replace(/\b[a-z](?=[A-Z])/g, '')
    .replace(/\b([a-z])([a-z]{3,})\b/g, (_, _m, word) => word)
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildSearchIndex() {
  const idx = { lbcf2: {}, catechism: {}, lbcf1: {} }
  Object.entries(LBCF2).forEach(([key, item]) => {
    idx.lbcf2[key] = makeSearchable((item.text || '') + ' ' + (item.refs || ''))
  })
  Object.entries(CATECHISM).forEach(([num, item]) => {
    idx.catechism[num] = makeSearchable((item.q || '') + ' ' + (item.a || '') + ' ' + (item.refs || ''))
  })
  Object.entries(LBCF1).forEach(([num, item]) => {
    idx.lbcf1[num] = makeSearchable((item.title || '') + ' ' + (item.text || '') + ' ' + (item.refs || ''))
  })
  return idx
}

const SEARCH_IDX = buildSearchIndex()

function textMatches(rawText, rawRefs, normIndexed, q) {
  if (!q) return true
  const raw = ((rawText || '') + ' ' + (rawRefs || '')).toLowerCase()
  return raw.includes(q) || normIndexed.includes(q)
}

function highlight(text, q) {
  if (!q || !text) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'))
    if (parts.length === 1) return text
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{background:'#fef08a',color:'inherit',borderRadius:2,padding:'0 1px'}}>{p}</mark>
        : p
    )
  } catch { return text }
}

const SOURCES = {
  '2lbcf':     { label: '2LBCF',     name: 'Second London Baptist Confession (1677/1689)', color: 'var(--purple-ink)', bg: 'var(--purple-soft)', href: 'https://www.the1689confession.com/' },
  'catechism': { label: 'Catechism', name: "Keach's Baptist Catechism (1693)",            color: 'var(--teal)',       bg: 'var(--teal-light)',  href: 'https://baptistcatechism.org/' },
  '1lbcf':     { label: '1LBCF',     name: 'First London Baptist Confession (1644)',       color: 'var(--amber-ink)', bg: 'var(--amber-soft)',  href: 'https://london1644.info/en/fulltext.html' },
}

/* ── Clickable scripture-proof chips ── */
function RefChips({ refs, onOpen }) {
  const parsed = parseRefs(refs)
  if (!parsed.length) return <span style={{ fontSize:13, color:'var(--ink-muted)' }}>{refs}</span>
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:2 }}>
      {parsed.map(({ book, chapter, display }) => (
        <button
          key={`${book}|${chapter}`}
          style={rc.chip}
          onClick={() => onOpen({ book, chapter, refDisplay: display })}
        >
          {display}
        </button>
      ))}
    </div>
  )
}
const rc = {
  chip: {
    fontSize:11, fontWeight:500, color:'var(--teal)',
    background:'var(--teal-light)', border:'1px solid transparent',
    borderRadius:99, padding:'3px 9px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.4,
  },
}

export default function ConfessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { prefs, updatePrefs } = usePrefs()

  /* ── Restore saved state ── */
  const _saved = loadState('conf', { tab: '2lbcf', search: '' })
  const tab    = searchParams.get('t') || _saved.tab

  const [activeChapter, setActiveChapter] = useState(null)
  const [search,        setSearch]        = useState(_saved.search)
  const [navOpen,       setNavOpen]       = useState(false)
  const [kjvModal,      setKjvModal]      = useState(null)
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768)
  /* sidebarConf tracks which confession's chapters are shown in the sidebar,
     independently of the currently displayed confession (tab).
     Changing sidebarConf never touches the main content. */
  const [sidebarConf,   setSidebarConf]   = useState(tab)
  const pendingScrollRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => { saveState('conf', { tab, search }) }, [tab, search])
  useEffect(() => {
    restoreScroll('conf')
    return () => saveScroll('conf')
  }, [])

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setNavOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* When tab changes (content switches), execute any pending chapter scroll */
  useEffect(() => {
    if (!pendingScrollRef.current) return
    const id = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
          setActiveChapter(id)
        }
      }, 60)
    })
  }, [tab])

  const src = SOURCES[tab] || SOURCES['2lbcf']
  const sidebarSrc = SOURCES[sidebarConf] || SOURCES['2lbcf']
  const textStyle = { fontSize: prefs.sizePx, fontFamily: getFontCss(prefs.fontId) }

  /* Switch the displayed confession (main content) */
  function setTab(t) {
    setSearchParams({ t })
    setActiveChapter(null)
    setSearch('')
    setNavOpen(false)
  }

  /* Scroll to a chapter within the currently displayed confession */
  function scrollToChapter(id) {
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
    }
    setActiveChapter(id)
    if (isMobile) setNavOpen(false)
  }

  /* Called when user clicks a chapter in the sidebar.
     If the sidebar confession differs from the main tab, switch first then scroll. */
  function handleChapterClick(chId) {
    if (sidebarConf !== tab) {
      pendingScrollRef.current = chId
      setTab(sidebarConf)
    } else {
      scrollToChapter(chId)
      if (isMobile) setNavOpen(false)
    }
  }

  /* ─── Chapter list for nav — driven by sidebarConf, not tab ─── */
  const chapterNav = useMemo(() => {
    if (sidebarConf === '2lbcf') {
      return Object.keys(LBCF2_CHAPTERS).map(ch => ({
        id: `ch-${ch}`, label: `Ch. ${ch}`, title: CHAPTER_TITLES[parseInt(ch)],
      }))
    }
    if (sidebarConf === '1lbcf') {
      return Object.entries(LBCF1).map(([num, item]) => ({
        id: `art-${num}`, label: `Art. ${num}`, title: item.title,
      }))
    }
    return []
  }, [sidebarConf])

  /* ─── Search counts ─── */
  const q = search.toLowerCase().trim()

  const resultCounts = useMemo(() => {
    if (!q) return null
    let lbcf2Count = 0, catCount = 0, lbcf1Count = 0
    Object.entries(LBCF2_CHAPTERS).forEach(([chNum, paras]) => {
      const chTitle = (CHAPTER_TITLES[parseInt(chNum)] || '').toLowerCase()
      const chMatch = chTitle.includes(q)
      paras.forEach(p => {
        if (chMatch || textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)) lbcf2Count++
      })
    })
    Object.entries(CATECHISM).forEach(([num, item]) => {
      if (textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.catechism[num] || '', q)) catCount++
    })
    Object.entries(LBCF1).forEach(([num, item]) => {
      if (textMatches(item.title + ' ' + item.text, item.refs, SEARCH_IDX.lbcf1[num] || '', q)) lbcf1Count++
    })
    return { lbcf2: lbcf2Count, catechism: catCount, lbcf1: lbcf1Count }
  }, [q])

  /* ── Sidebar content (shared between desktop panel and mobile drawer) ── */
  const SidebarContent = (
    <div style={s.sidebarContent}>
      {/* Confession selector — only updates sidebarConf; never refreshes main content */}
      <div style={s.confSelector}>
        <div style={s.confSelectorLabel}>Browse</div>
        {Object.entries(SOURCES).map(([key, info]) => (
          <button
            key={key}
            style={{
              ...s.confSelectorBtn,
              ...(sidebarConf === key ? {
                background: info.bg, color: info.color,
                borderColor: info.color, fontWeight: 700,
              } : {}),
            }}
            onClick={() => {
              setSidebarConf(key)
              /* Catechism has no chapter list — switch content immediately */
              if (key === 'catechism') setTab(key)
            }}
          >
            <span style={{...s.confBadgeDot, background: sidebarConf === key ? info.color : 'var(--border-strong)'}} />
            <span style={{flex:1, textAlign:'left'}}>{info.label}</span>
            <span style={{fontSize:10, opacity:0.6, fontWeight:400}}>
              {key === '2lbcf' ? '1689' : key === 'catechism' ? '1693' : '1644'}
            </span>
          </button>
        ))}
        {/* Hint when sidebar and main content are out of sync */}
        {sidebarConf !== tab && sidebarConf !== 'catechism' && (
          <p style={{fontSize:10, color:'var(--ink-faint)', margin:'6px 4px 0', lineHeight:1.5}}>
            Select a chapter below to open it
          </p>
        )}
      </div>

      {/* Chapter list — tap a chapter to navigate (switches confession if needed) */}
      {chapterNav.length > 0 && (
        <>
          <div style={s.sidebarDivider} />
          <div style={s.chapterListLabel}>Chapters</div>
          <div style={s.chapterList}>
            {chapterNav.map(ch => (
              <button
                key={ch.id}
                style={{
                  ...s.chapBtn,
                  ...(activeChapter === ch.id && sidebarConf === tab ? s.chapBtnActive : {}),
                }}
                onClick={() => handleChapterClick(ch.id)}
                title={ch.title}
              >
                <span style={{...s.chapLabel, color: sidebarSrc.color}}>{ch.label}</span>
                <span style={s.chapTitle}>{ch.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div style={s.page}>

      {/* ── Sticky header: search only ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          {/* Mobile sidebar toggle */}
          {isMobile && (
            <button
              onClick={() => setNavOpen(o => !o)}
              className="btn btn-ghost"
              style={{gap:5, fontSize:12, padding:'5px 10px', flexShrink:0}}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2.5" width="14" height="1.5" rx=".75" fill="currentColor"/>
                <rect x="1" y="7"   width="9"  height="1.5" rx=".75" fill="currentColor"/>
                <rect x="1" y="11.5" width="11" height="1.5" rx=".75" fill="currentColor"/>
              </svg>
              {src.label}
            </button>
          )}

          {/* Source name (desktop) */}
          {!isMobile && (
            <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={s.srcName}>{src.name}</span>
            </div>
          )}

          {/* Search */}
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
            {search && <button onClick={() => setSearch('')} style={s.clearBtn}>×</button>}
          </div>
          <FontPrefsPanel prefs={prefs} onUpdate={updatePrefs} />
        </div>
      </header>

      {/* ── Mobile drawer backdrop ── */}
      {isMobile && navOpen && (
        <div style={s.backdrop} onClick={() => setNavOpen(false)} />
      )}

      <div style={s.layout}>

        {/* ── Desktop sidebar (always visible) ── */}
        {!isMobile && (
          <aside style={s.desktopSidebar}>
            {SidebarContent}
          </aside>
        )}

        {/* ── Mobile sidebar drawer ── */}
        {isMobile && (
          <aside style={{
            ...s.mobileSidebar,
            transform: navOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}>
            <div style={s.mobileNavHeader}>
              <span style={{fontSize:13, fontWeight:600, color:'var(--ink)'}}>Navigate</span>
              <button onClick={() => setNavOpen(false)} style={s.mobileNavClose}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {SidebarContent}
          </aside>
        )}

        {/* ── Main content ── */}
        <main style={s.main} ref={contentRef}>

          {/* Search result banner */}
          {q && resultCounts && (() => {
            const count = resultCounts[tab === '2lbcf' ? 'lbcf2' : tab === 'catechism' ? 'catechism' : 'lbcf1']
            if (count === 0) return <div style={s.empty}>No results for "{search}"</div>
            return (
              <div style={s.resultBanner}>
                {count} {tab === 'catechism' ? 'Q&A' : 'section'}{count !== 1 ? 's' : ''} matched "{search}"
              </div>
            )
          })()}

          {/* Mobile: source link */}
          {isMobile && (
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:'1rem', flexWrap:'wrap'}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={{fontSize:12, color:'var(--ink-muted)', flex:1, fontFamily:"'Cormorant Garamond',serif"}}>{src.name}</span>
            </div>
          )}

          {/* ── 2LBCF ── */}
          {tab === '2lbcf' && (
            <div>
              {Object.entries(LBCF2_CHAPTERS).map(([chNum, paras]) => {
                const chTitle = CHAPTER_TITLES[parseInt(chNum)] || ''
                const chId    = `ch-${chNum}`
                const chTitleMatches = q && chTitle.toLowerCase().includes(q)

                if (q) {
                  const hasMatch = chTitleMatches || paras.some(p =>
                    textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)
                  )
                  if (!hasMatch) return null
                }
                return (
                  <section key={chNum} id={chId} style={s.chapter}>
                    <div style={s.chapterHeader}>
                      <span style={s.chapterNum}>Chapter {chNum}</span>
                      <h2 style={s.chapterTitle}>{chTitle}</h2>
                    </div>
                    {paras.map(p => {
                      const paraMatches = !q || chTitleMatches ||
                        textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)
                      if (!paraMatches) return null
                      return (
                        <div key={p.key} style={s.paragraph} id={`p-${p.key}`}>
                          <div style={s.paraNum}>§{p.para}</div>
                          <div style={s.paraBody}>
                            <p style={{...s.paraText, ...textStyle}}>{highlight(p.text, q)}</p>
                            {p.refs && (
                              <div style={s.refs}>
                                <span style={s.refsLabel}>Proof texts: </span>
                                <RefChips refs={p.refs} onOpen={setKjvModal} />
                              </div>
                            )}
                            <div style={s.paraActions}>
                              <CopyBtn getText={() => {
                                let t = p.text
                                if (p.refs) t += '\n\nScripture proofs: ' + cleanRefs(p.refs)
                                return t
                              }} />
                            </div>
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
                if (q && !textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.catechism[num] || '', q)) return null
                return (
                  <div key={num} style={s.qaBlock} id={`qa-${num}`}>
                    <div style={s.qaNum}>Q.{num}</div>
                    <div style={s.qaBody}>
                      <p style={{...s.qaQuestion, ...textStyle}}>{highlight(item.q, q)}</p>
                      <p style={{...s.qaAnswer, ...textStyle}}><strong style={{fontWeight:600}}>A.</strong> {highlight(item.a, q)}</p>
                      {item.refs && (
                        <div style={s.refs}>
                          <span style={s.refsLabel}>Proof texts: </span>
                          <RefChips refs={item.refs} onOpen={setKjvModal} />
                        </div>
                      )}
                      <div style={s.paraActions}>
                        <CopyBtn getText={() => {
                          let t = `Q. ${item.q}\n\nA. ${item.a}`
                          if (item.refs) t += '\n\nScripture proofs: ' + cleanRefs(item.refs)
                          return t
                        }} />
                      </div>
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
                if (q && !textMatches(item.title + ' ' + item.text, item.refs, SEARCH_IDX.lbcf1[num] || '', q)) return null
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
                        const clean = line.replace(/^\d+\s+/, '').trim()
                        if (!clean) return null
                        return <p key={i} style={{...s.articleLine, ...textStyle}}>{highlight(clean, q)}</p>
                      })}
                      {item.refs && (
                        <div style={s.refs}>
                          <span style={s.refsLabel}>Proof texts: </span>
                          <RefChips refs={item.refs} onOpen={setKjvModal} />
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

        </main>
      </div>

      {/* KJV scripture modal */}
      {kjvModal && (
        <KjvModal
          book={kjvModal.book}
          chapter={kjvModal.chapter}
          refDisplay={kjvModal.refDisplay}
          onClose={() => setKjvModal(null)}
        />
      )}
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", paddingBottom:'env(safe-area-inset-bottom)' },

  /* header */
  header: {
    position:'sticky', top:0, zIndex:30,
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerInner: {
    maxWidth:1200, margin:'0 auto',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'8px 16px', gap:10,
  },

  /* source info in header */
  srcBadge: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:'0.05em', flexShrink:0 },
  srcName:  { fontSize:13, color:'var(--ink)', fontFamily:"'Cormorant Garamond',serif", fontWeight:600, flex:1, minWidth:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' },
  srcLink:  { display:'inline-flex', alignItems:'center', fontSize:11, color:'var(--teal)', textDecoration:'none', fontWeight:500, whiteSpace:'nowrap', flexShrink:0 },

  searchBox: {
    display:'flex', alignItems:'center', gap:6,
    border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--parchment)', minWidth:140, maxWidth:240, flex:1,
  },
  searchInput: {
    border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'7px 0',
    fontFamily:"'DM Sans',sans-serif", width:'100%',
  },
  clearBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px',
  },

  /* layout */
  layout: { display:'flex', maxWidth:1200, margin:'0 auto' },

  /* Desktop sidebar */
  desktopSidebar: {
    width:240, flexShrink:0,
    position:'sticky', top:53, alignSelf:'flex-start',
    height:'calc(100vh - 53px)', overflowY:'auto',
    borderRight:'1px solid var(--border)',
    background:'var(--surface)',
  },

  /* sidebar shared content */
  sidebarContent: { padding:'12px 8px 24px' },

  /* Confession selector */
  confSelector: { marginBottom:4 },
  confSelectorLabel: {
    fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
    color:'var(--ink-faint)', padding:'0 8px', marginBottom:4,
  },
  confSelectorBtn: {
    display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left',
    padding:'8px 10px', marginBottom:3, background:'none', border:'1.5px solid transparent',
    borderRadius:'var(--radius)', cursor:'pointer', fontSize:13, fontWeight:600,
    color:'var(--ink)', fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s',
  },
  confBadgeDot: { width:8, height:8, borderRadius:'50%', flexShrink:0, transition:'background 0.15s' },

  sidebarDivider: { height:1, background:'var(--border)', margin:'10px 4px' },

  /* Chapter list */
  chapterListLabel: {
    fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
    color:'var(--ink-faint)', padding:'0 8px', marginBottom:4,
  },
  chapterList: { display:'flex', flexDirection:'column', gap:1 },
  chapBtn: {
    display:'flex', flexDirection:'column', alignItems:'flex-start',
    width:'100%', textAlign:'left', padding:'5px 8px',
    background:'none', border:'none', cursor:'pointer',
    borderRadius:'var(--radius)', transition:'background 0.1s',
    fontFamily:"'DM Sans',sans-serif",
  },
  chapBtnActive: { background:'var(--parchment-dark)' },
  chapLabel: { fontSize:10, fontWeight:700, letterSpacing:'0.04em' },
  chapTitle: { fontSize:10, color:'var(--ink-muted)', lineHeight:1.35, marginTop:1 },

  /* Mobile sidebar */
  backdrop: {
    position:'fixed', inset:0, background:'rgba(30,24,16,0.45)',
    zIndex:40, backdropFilter:'blur(2px)',
  },
  mobileSidebar: {
    position:'fixed', top:0, left:0, bottom:0, width:280,
    background:'var(--surface)', borderRight:'1px solid var(--border)',
    boxShadow:'4px 0 24px rgba(0,0,0,0.12)',
    zIndex:50, display:'flex', flexDirection:'column',
    transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    overflowY:'auto',
  },
  mobileNavHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'var(--surface)', flexShrink:0,
  },
  mobileNavClose: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    justifyContent:'center', padding:6, borderRadius:'var(--radius)',
  },

  /* main reading area */
  main: { flex:1, padding:'1.5rem 1.5rem 5rem', maxWidth:760, minWidth:0 },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },
  resultBanner: {
    fontSize:12, color:'var(--teal)', background:'var(--teal-light)',
    border:'1px solid rgba(29,107,90,0.2)', borderRadius:'var(--radius)',
    padding:'8px 14px', marginBottom:'1.5rem', fontWeight:500,
  },

  /* 2LBCF */
  chapter: { marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  chapterHeader: { marginBottom:'1.5rem' },
  chapterNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--teal)', display:'block', marginBottom:4 },
  chapterTitle: { fontSize:26, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.2 },

  paragraph: { display:'flex', gap:12, marginBottom:'1.5rem', alignItems:'flex-start' },
  paraNum: { fontSize:12, fontWeight:700, color:'var(--ink-faint)', flexShrink:0, minWidth:24, paddingTop:3, fontVariantNumeric:'tabular-nums' },
  paraBody: { flex:1, minWidth:0 },
  paraActions: { display:'flex', gap:8, alignItems:'flex-start', marginTop:6 },
  paraText: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9, color:'var(--ink)', margin:'0 0 8px' },

  /* Catechism */
  catechismList: {},
  qaBlock: { display:'flex', gap:14, marginBottom:'1.75rem', paddingBottom:'1.75rem', borderBottom:'1px solid var(--border)', alignItems:'flex-start' },
  qaNum: { fontSize:12, fontWeight:700, color:'var(--teal)', flexShrink:0, minWidth:30, paddingTop:2, fontVariantNumeric:'tabular-nums' },
  qaBody: { flex:1, minWidth:0 },
  qaQuestion: { fontSize:17, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.55, margin:'0 0 8px' },
  qaAnswer: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.85, color:'var(--ink)', margin:'0 0 8px' },

  /* 1LBCF */
  article: { marginBottom:'2.5rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  articleHeader: { marginBottom:'1rem' },
  articleActions: { display:'flex', gap:8, flexShrink:0, alignItems:'flex-start' },
  articleNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--amber-ink)', display:'block', marginBottom:4 },
  articleTitle: { fontSize:24, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.25 },
  articleBody: { paddingLeft:4 },
  articleLine: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9, color:'var(--ink)', margin:'0 0 6px' },

  /* Proof texts */
  refs: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, marginTop:8, borderLeft:'2px solid var(--border)', paddingLeft:10, fontFamily:"'DM Sans',sans-serif" },
  refsLabel: { fontWeight:600, color:'var(--ink-muted)' },
}
