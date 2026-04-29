import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import KjvReader from '../components/KjvReader'
import { getTodayDayNum } from '../lib/supabase'
import { DAY_BIBLE } from '../data/readingPlan'
import { saveScroll, restoreScroll } from '../lib/pageState'

/* ══════════════════════════════════════════════════════════════════ */
export default function ScripturePage() {
  const { state: locationState } = useLocation()
  const { session } = useAuth()

  const kjvRef    = useRef(null)
  const [readBook,    setReadBook]    = useState('Genesis')
  const [readChapter, setReadChapter] = useState(1)
  const [readSearch,  setReadSearch]  = useState('')
  const [readVersion, setReadVersion] = useState(() => {
    try { return sessionStorage.getItem('reader-version') || 'kjv' } catch { return 'kjv' }
  })
  const [canGoBack,    setCanGoBack]    = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [parallelMode, setParallelMode] = useState(false)

  // Parallel only makes sense on text versions; reset when switching to GNT/HOT
  const isOriginalLang = readVersion === 'greek' || readVersion === 'hebrew'

  /* Deep-link from devotional/settings: navigate to specific book/chapter/verse */
  const pendingDeepLinkRef = useRef(locationState?.book ? locationState : null)
  useEffect(() => {
    if (!pendingDeepLinkRef.current) return
    const { book: b, chapter: ch, verse: v } = pendingDeepLinkRef.current
    pendingDeepLinkRef.current = null
    const timer = setTimeout(() => {
      kjvRef.current?.navigateTo(b, ch, v)
    }, 150)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Save/restore scroll on mount/unmount */
  useEffect(() => {
    restoreScroll('scripture')
    return () => saveScroll('scripture')
  }, [])

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

          {/* Parallel view toggle (text versions only) */}
          {!isOriginalLang && (
            <button
              style={{ ...s.parallelBtn, ...(parallelMode ? s.parallelBtnActive : {}) }}
              onClick={() => setParallelMode(v => !v)}
              title={parallelMode ? 'Hide original language' : 'Show parallel original (GNT for NT · HOT for OT)'}
              aria-label="Toggle parallel original language"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="2" width="5.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="8.5" y="2" width="5.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <line x1="3.5" y1="5" x2="5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <line x1="3.5" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <line x1="10" y1="5" x2="12.5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <line x1="10" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Inline search */}
          <div style={s.readSearchWrap}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              style={s.readSearchInput}
              value={readSearch}
              onChange={e => {
                setReadSearch(e.target.value)
                kjvRef.current?.setSearchQuery(e.target.value)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') kjvRef.current?.submitSearch(readSearch)
                if (e.key === 'Escape') { kjvRef.current?.clearSearch(); setReadSearch('') }
              }}
              placeholder="Search Bible…"
            />
            {readSearch && (
              <button
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px', flexShrink:0 }}
                onClick={() => { setReadSearch(''); kjvRef.current?.clearSearch() }}
              >×</button>
            )}
          </div>
        </div>
      </header>

      {/* ══ KJV / Greek / Hebrew Reader ══ */}
      <KjvReader
        ref={kjvRef}
        version={readVersion}
        onVersionChange={v => {
          setReadVersion(v)
          if (v === 'greek' || v === 'hebrew') setParallelMode(false)
          try { sessionStorage.setItem('reader-version', v) } catch {}
        }}
        todayChapter={todayBibleChapter}
        onNavChange={(b, c) => { setReadBook(b); setReadChapter(c) }}
        onSearchChange={q => setReadSearch(q)}
        onHistoryChange={({ canGoBack: b, canGoForward: f }) => {
          setCanGoBack(b)
          setCanGoForward(f)
        }}
        parallelMode={parallelMode}
      />
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

  /* search */
  readSearchWrap: {
    flex:1, display:'flex', alignItems:'center', gap:6,
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'0 8px', background:'var(--parchment)',
    minWidth:0,
  },
  readSearchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'7px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
}
