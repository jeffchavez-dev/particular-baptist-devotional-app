import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import KjvReader from '../components/KjvReader'
import { getTodayDayNum } from '../lib/supabase'
import { DAY_BIBLE } from '../data/readingPlan'
import { saveScroll, restoreScroll } from '../lib/pageState'
import { getDefaultReaderVersion, originalVersionForBook, setDefaultReaderVersion } from '../lib/readerPrefs'
import { BIBLE_VERSIONS } from '../lib/bibleVersions'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { addSearchHistory, getSearchHistory, clearSearchHistory } from '../lib/annotations'

/* ══════════════════════════════════════════════════════════════════ */
export default function ScripturePage() {
  const { state: locationState } = useLocation()
  const { session } = useAuth()

  const kjvRef    = useRef(null)
  const [readBook,    setReadBook]    = useState('Genesis')
  const [readChapter, setReadChapter] = useState(1)
  const [readSearch,  setReadSearch]  = useState('')
  const [readVersion, setReadVersion] = useState(() => {
    // Session override > user preference > 'kjv'
    // 'original' is a meta-preference: resolve to 'hebrew' on first load
    // (the reader starts at Genesis which is OT; switches happen via navigation)
    try {
      const session = sessionStorage.getItem('reader-version')
      // sessionStorage stores concrete version IDs only ('kjv','abab','hebrew','greek','lxx')
      if (session && session !== 'original') return session
      const pref = getDefaultReaderVersion()
      // 'original' resolves to 'hebrew' on cold start (reader opens at Genesis by default)
      return pref === 'original' ? 'hebrew' : pref
    } catch { return 'kjv' }
  })
  const [canGoBack,    setCanGoBack]    = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  // Show version picker on first launch (no saved preference)
  const [showVersionPicker, setShowVersionPicker] = useState(() => {
    try { return !localStorage.getItem('pb-default-version') } catch { return false }
  })
  // Search history (shared key with KjvReader via annotations lib)
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory('kjv'))
  // Search results shown in the side panel
  const [searchResults,      setSearchResults]      = useState(null)   // null=no search, []|[…]=results
  const [searchResultsTotal, setSearchResultsTotal] = useState(0)
  const [searchResultsCapped,setSearchResultsCapped] = useState(false)
  const [panelQuery,         setPanelQuery]         = useState('')
  const [panelSearching,     setPanelSearching]     = useState(false)

  /* Deep-link from devotional/confessional: navigate to specific book/chapter/verse.
     If the link also specifies a version (e.g. from KjvModal), switch to it first. */
  const pendingDeepLinkRef = useRef(locationState?.book ? locationState : null)
  useEffect(() => {
    if (!pendingDeepLinkRef.current) return
    const { book: b, chapter: ch, verse: v, version: ver } = pendingDeepLinkRef.current
    pendingDeepLinkRef.current = null

    // Resolve 'original' → 'hebrew' (OT) or 'greek' (NT) from the target book
    const resolvedVer = ver === 'original'
      ? originalVersionForBook(b, BIBLE_BOOKS)
      : ver

    // Switch version if the deep-link requests one different from the current session
    const needsVersionSwitch = resolvedVer && resolvedVer !== readVersion
    if (needsVersionSwitch) {
      setReadVersion(resolvedVer)
      try { sessionStorage.setItem('reader-version', resolvedVer) } catch {}
      // parallel mode is now managed inside KjvReader
    }

    const timer = setTimeout(() => {
      kjvRef.current?.navigateTo(b, ch, v)
    }, needsVersionSwitch ? 250 : 150) // extra time when version is also switching
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Save/restore scroll on mount/unmount */
  useEffect(() => {
    restoreScroll('scripture')
    return () => saveScroll('scripture')
  }, [])

  function saveSearchHistory(q) {
    if (!q.trim()) return
    addSearchHistory('kjv', q.trim())
    setSearchHistory(getSearchHistory('kjv'))
  }

  /* Today's Bible chapter (for KJV reader "Today" badge) */
  const todayBibleChapter = useMemo(() => {
    const today = Math.min(getTodayDayNum(), 365)
    return DAY_BIBLE[today] || null
  }, [])

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          {/* Hamburger → opens KjvReader's internal book/version sidebar */}
          <button
            onClick={() => kjvRef.current?.openSidebar()}
            style={s.menuBtn}
            aria-label="Browse books & versions"
            title="Browse books & versions"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3.5" width="14" height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="8.1" width="10"  height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="12.7" width="12" height="1.8" rx="0.9" fill="currentColor"/>
            </svg>
          </button>

          {/* History back / forward */}
          <div style={s.historyBtns}>
            <button
              style={{ ...s.histBtn, opacity: canGoBack ? 1 : 0.3 }}
              disabled={!canGoBack}
              onClick={() => kjvRef.current?.goBack()}
              title="Go back"
              aria-label="Go back"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L5 7l4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              style={{ ...s.histBtn, opacity: canGoForward ? 1 : 0.3 }}
              disabled={!canGoForward}
              onClick={() => kjvRef.current?.goForward()}
              title="Go forward"
              aria-label="Go forward"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2l4 5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Book / chapter pill */}
          <button
            style={s.readBookPill}
            onClick={() => kjvRef.current?.openSidebar()}
            title="Select book & chapter"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink:0, opacity:0.5 }}>
              <rect x="1" y="1" width="9" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 3.5h5M3 5.5h5M3 7.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span style={s.readBookName}>{readBook}</span>
            <span style={s.readBookCh}>Ch. {readChapter}</span>
          </button>

          {/* Search icon button */}
          <button
            style={{ ...s.menuBtn, marginLeft:'auto' }}
            onClick={() => setSearchPanelOpen(p => !p)}
            aria-label="Search Bible"
            title="Search Bible"
            aria-pressed={searchPanelOpen}
          >
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Search Panel (right drawer) ── */}
      {searchPanelOpen && (
        <div style={sp.backdrop} onClick={() => setSearchPanelOpen(false)} />
      )}
      <div style={{ ...sp.panel, transform: searchPanelOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div style={sp.panelHeader}>
          <span style={sp.panelTitle}>Search Bible</span>
          <button style={sp.closeBtn} onClick={() => setSearchPanelOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div style={sp.searchRow}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            autoFocus
            style={sp.searchInput}
            value={readSearch}
            onChange={e => {
              setReadSearch(e.target.value)
              kjvRef.current?.setSearchQuery(e.target.value)
              if (!e.target.value.trim()) { setSearchResults(null); setPanelQuery('') }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const q = readSearch.trim()
                if (!q) return
                saveSearchHistory(q)
                setPanelQuery(q)
                setPanelSearching(true)
                setSearchResults(null)
                kjvRef.current?.submitSearch(q)
              }
              if (e.key === 'Escape') { setSearchPanelOpen(false) }
            }}
            placeholder="Search all books…"
          />
          {readSearch && (
            <button style={sp.clearBtn} onClick={() => {
              setReadSearch('')
              setSearchResults(null)
              setPanelQuery('')
              kjvRef.current?.clearSearch()
            }}>×</button>
          )}
        </div>

        {/* Results area */}
        {searchResults !== null ? (
          <div style={sp.resultsArea}>
            {/* Results header */}
            <div style={sp.resultsHeader}>
              <div>
                <span style={sp.resultsTitle}>
                  {panelSearching ? 'Searching…'
                    : searchResults.length === 0 ? `No results for "${panelQuery}"`
                    : searchResultsCapped
                      ? `${searchResults.length.toLocaleString()} of ${searchResultsTotal.toLocaleString()} verses`
                      : `${searchResultsTotal.toLocaleString()} verse${searchResultsTotal !== 1 ? 's' : ''} found`}
                </span>
                {!panelSearching && searchResults.length > 0 && (
                  <div style={sp.resultsSubtitle}>
                    {(() => {
                      const books = new Set(searchResults.map(r => r.book))
                      return `${books.size} book${books.size !== 1 ? 's' : ''} — "${panelQuery}"`
                    })()}
                  </div>
                )}
              </div>
              {searchResultsCapped && !panelSearching && (
                <button style={sp.loadAllBtn} onClick={() => {
                  setPanelSearching(true)
                  kjvRef.current?.loadAllResults()
                }}>
                  Load all {searchResultsTotal.toLocaleString()}
                </button>
              )}
            </div>

            {/* Result rows */}
            {!panelSearching && searchResults.length > 0 && (() => {
              const q = panelQuery.toLowerCase()
              const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              function hlText(text) {
                try {
                  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
                  if (parts.length === 1) return text
                  return parts.map((p, i) =>
                    p.toLowerCase() === q
                      ? <mark key={i} style={{ background:'#fef08a', color:'inherit', borderRadius:2, padding:'0 1px' }}>{p}</mark>
                      : p
                  )
                } catch { return text }
              }
              return (
                <div style={sp.resultsList}>
                  {searchResults.map((hit, i) => (
                    <button
                      key={i}
                      style={sp.resultItem}
                      onClick={() => {
                        kjvRef.current?.navigateTo(hit.book, hit.chapter, hit.verse)
                        setSearchPanelOpen(false)
                      }}
                    >
                      <span style={sp.resultRef}>{hit.book} {hit.chapter}:{hit.verse}</span>
                      <span style={sp.resultText}>{hlText(hit.text)}</span>
                    </button>
                  ))}
                </div>
              )
            })()}

            {!panelSearching && searchResults.length === 0 && (
              <p style={sp.noResults}>Try a different word or phrase.</p>
            )}
          </div>
        ) : (
          /* History (shown when no active search results) */
          searchHistory.length > 0 && (
            <div style={sp.section}>
              <div style={sp.sectionLabel}>Recent searches</div>
              {searchHistory.map(q => (
                <button key={q} style={sp.histItem} onClick={() => {
                  setReadSearch(q)
                  kjvRef.current?.setSearchQuery(q)
                  saveSearchHistory(q)
                  setPanelQuery(q)
                  setPanelSearching(true)
                  setSearchResults(null)
                  kjvRef.current?.submitSearch(q)
                }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M5.5 3.5v2l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ flex:1 }}>{q}</span>
                </button>
              ))}
              <button style={sp.clearHistBtn} onClick={() => {
                clearSearchHistory('kjv')
                setSearchHistory([])
              }}>Clear history</button>
            </div>
          )
        )}
      </div>

      {/* ══ KJV / Greek / Hebrew Reader ══ */}
      <KjvReader
        ref={kjvRef}
        version={readVersion}
        onVersionChange={v => {
          setReadVersion(v)
          try { sessionStorage.setItem('reader-version', v) } catch {}
        }}
        todayChapter={todayBibleChapter}
        onNavChange={(b, c) => { setReadBook(b); setReadChapter(c) }}
        onSearchChange={q => setReadSearch(q)}
        onHistoryChange={({ canGoBack: b, canGoForward: f }) => {
          setCanGoBack(b)
          setCanGoForward(f)
        }}
        onSearchResults={(hits, total, capped, q) => {
          setSearchResults(hits)
          setSearchResultsTotal(total)
          setSearchResultsCapped(capped)
          setPanelQuery(q)
          setPanelSearching(false)
        }}
      />

      {/* ── First-open version picker ── */}
      {showVersionPicker && (
        <div style={vp.backdrop}>
          <div style={vp.sheet}>
            <div style={vp.hero}>
              <div style={vp.heroIcon}>📖</div>
              <h2 style={vp.heroTitle}>Choose your Bible</h2>
              <p style={vp.heroSub}>Pick a translation to start reading. You can change this anytime in Settings.</p>
            </div>
            <div style={vp.grid}>
              {BIBLE_VERSIONS.filter(v => !v.hidden).map(v => (
                <button
                  key={v.id}
                  style={vp.card}
                  onClick={() => {
                    setDefaultReaderVersion(['kjv','abab'].includes(v.id) ? v.id : 'kjv')
                    setReadVersion(v.id)
                    try { sessionStorage.setItem('reader-version', v.id) } catch {}
                    setShowVersionPicker(false)
                  }}
                >
                  <span style={vp.abbr}>{v.abbreviation}</span>
                  <span style={vp.lang}>{v.language}{v.scope ? ` · ${v.scope}` : ''}</span>
                  <span style={vp.name}>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  /* Lock the page to viewport height so the sidebar never scrolls with bible content */
  page: { height:'100vh', overflow:'hidden', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", display:'flex', flexDirection:'column' },

  /* header */
  header: {
    position:'sticky', top:0, zIndex:20, flexShrink:0,
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerInner: { maxWidth:'100%', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 },

  menuBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:36, height:36, borderRadius:'var(--radius)', border:'1px solid var(--border)',
    background:'var(--surface)', cursor:'pointer', flexShrink:0,
    color:'var(--ink-muted)', transition:'background 0.15s',
  },

  /* history back/forward */
  historyBtns: {
    display:'flex', alignItems:'center', gap:1, flexShrink:0,
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    background:'var(--surface)', overflow:'hidden',
  },
  histBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:30, height:30, border:'none', background:'none',
    cursor:'pointer', color:'var(--ink-muted)', transition:'background 0.15s, opacity 0.15s',
    padding:0,
  },

  /* parallel toggle */
  parallelBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:34, height:34, borderRadius:'var(--radius)', border:'1px solid var(--border)',
    background:'var(--surface)', cursor:'pointer', flexShrink:0,
    color:'var(--ink-muted)', transition:'background 0.15s, color 0.15s, border-color 0.15s',
  },
  parallelBtnActive: {
    background:'var(--teal-light)', borderColor:'var(--teal)', color:'var(--teal)',
  },

  /* book pill */
  readBookPill: {
    display:'flex', alignItems:'center', gap:5,
    padding:'5px 10px', borderRadius:'var(--radius-lg)',
    border:'1px solid var(--border)', background:'var(--parchment)',
    cursor:'pointer', flexShrink:0, fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.15s',
  },
  readBookName: { fontSize:13, fontWeight:600, color:'var(--ink)' },
  readBookCh:   { fontSize:11, color:'var(--ink-faint)' },

}

const sp = {
  backdrop: {
    position:'fixed', inset:0, zIndex:90,
    background:'rgba(0,0,0,0.3)',
  },
  panel: {
    position:'fixed', top:0, right:0, bottom:0, zIndex:100,
    width: 320, maxWidth:'90vw',
    background:'var(--surface)', borderLeft:'1px solid var(--border)',
    boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',
    display:'flex', flexDirection:'column',
    transition:'transform 0.25s', fontFamily:"'DM Sans',sans-serif",
    overflow:'hidden',
  },
  panelHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 16px 12px', borderBottom:'1px solid var(--border)', flexShrink:0,
  },
  panelTitle: { fontSize:15, fontWeight:700, color:'var(--ink)' },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', padding:4,
  },
  searchRow: {
    display:'flex', alignItems:'center', gap:8,
    margin:'12px 16px', padding:'0 10px',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    background:'var(--parchment)',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:14, color:'var(--ink)', padding:'10px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
  clearBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:18, lineHeight:1, padding:'0 2px',
  },
  section: { padding:'4px 16px 16px' },
  sectionLabel: {
    fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
    color:'var(--ink-faint)', marginBottom:8,
  },
  histItem: {
    display:'flex', alignItems:'center', gap:8, width:'100%',
    padding:'8px 10px', borderRadius:'var(--radius)', border:'none',
    background:'none', cursor:'pointer', fontSize:13, color:'var(--ink)',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  clearHistBtn: {
    marginTop:8, padding:'5px 10px', borderRadius:99, border:'1px solid var(--border)',
    background:'none', cursor:'pointer', fontSize:11, color:'var(--ink-faint)',
    fontFamily:"'DM Sans',sans-serif",
  },
  // Results area
  resultsArea: {
    flex:1, display:'flex', flexDirection:'column', overflowY:'auto',
  },
  resultsHeader: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
    padding:'12px 16px 8px', borderBottom:'1px solid var(--border)',
    flexShrink:0, gap:8,
  },
  resultsTitle: {
    fontSize:13, fontWeight:700, color:'var(--ink)',
    display:'block', marginBottom:2,
  },
  resultsSubtitle: {
    fontSize:11, color:'var(--ink-faint)', fontStyle:'italic',
  },
  loadAllBtn: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', border:'none', borderRadius:99,
    padding:'4px 10px', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
    fontFamily:"'DM Sans',sans-serif",
  },
  resultsList: {
    display:'flex', flexDirection:'column', padding:'8px 0',
    flex:1, overflowY:'auto',
  },
  resultItem: {
    display:'flex', flexDirection:'column', gap:3, textAlign:'left',
    padding:'9px 16px', border:'none', background:'none', cursor:'pointer',
    borderBottom:'1px solid var(--border)', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  resultRef: {
    fontSize:11, fontWeight:700, color:'var(--teal)', letterSpacing:'0.02em',
  },
  resultText: {
    fontSize:13, color:'var(--ink)', lineHeight:1.6,
    fontFamily:"'Georgia','Times New Roman',serif",
  },
  noResults: {
    fontSize:13, color:'var(--ink-faint)', textAlign:'center',
    padding:'3rem 1rem', margin:0, fontFamily:"'DM Sans',sans-serif",
  },
}

const vp = {
  backdrop: {
    position:'fixed', inset:0, zIndex:300,
    background:'var(--parchment)', display:'flex',
    alignItems:'flex-end', justifyContent:'center',
  },
  sheet: {
    width:'100%', maxWidth:600,
    background:'var(--surface)',
    borderRadius:'20px 20px 0 0',
    boxShadow:'0 -8px 40px rgba(0,0,0,0.15)',
    padding:'28px 20px 36px',
    fontFamily:"'DM Sans',sans-serif",
    maxHeight:'90vh', overflowY:'auto',
  },
  hero: { textAlign:'center', marginBottom:24 },
  heroIcon: { fontSize:40, marginBottom:10 },
  heroTitle: {
    fontSize:22, fontWeight:700, color:'var(--ink)', margin:'0 0 8px',
    fontFamily:"'Cormorant Garamond',serif",
  },
  heroSub: { fontSize:13, color:'var(--ink-muted)', margin:0, lineHeight:1.6 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10 },
  card: {
    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
    padding:'14px 8px', borderRadius:'var(--radius-lg)',
    border:'1.5px solid var(--border)',
    background:'var(--parchment)', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'border-color 0.15s, background 0.15s',
  },
  abbr: { fontSize:18, fontWeight:800, color:'var(--ink)', letterSpacing:'-0.01em' },
  lang: { fontSize:10, color:'var(--ink-faint)', fontWeight:500 },
  name: {
    fontSize:10, color:'var(--ink-muted)', textAlign:'center',
    lineHeight:1.3, marginTop:2,
  },
}
