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
import { addSearchHistory, getSearchHistory, clearSearchHistory, isScriptureBookmarked, toggleScriptureBookmark } from '../lib/annotations'
import { isAuthor } from '../lib/authorContent'

/* ══════════════════════════════════════════════════════════════════ */
export default function ScripturePage() {
  const { state: locationState } = useLocation()
  const { session } = useAuth()

  const kjvRef             = useRef(null)
  const versionDropdownRef = useRef(null)
  const [readBook,    setReadBook]    = useState('Genesis')
  const [readChapter, setReadChapter] = useState(1)
  const [readSearch,  setReadSearch]  = useState('')
  const [readVersion, setReadVersion] = useState(() => {
    // Session override > user preference > 'kjv'
    // 'original' is a meta-preference: resolve to 'hebrew' on first load
    // (the reader starts at Genesis which is OT; switches happen via navigation)
    try {
      const session = localStorage.getItem('reader-version')
      // sessionStorage stores concrete version IDs only ('kjv','abab','hebrew','greek','lxx')
      if (session && session !== 'original') return session
      const pref = getDefaultReaderVersion()
      // 'original' resolves to 'hebrew' on cold start (reader opens at Genesis by default)
      return pref === 'original' ? 'hebrew' : pref
    } catch { return 'kjv' }
  })
  const [navHistory,    setNavHistory]    = useState([])
  const [navHistoryIdx, setNavHistoryIdx] = useState(0)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  // Show version picker on first launch (no saved preference)
  const [showVersionPicker, setShowVersionPicker] = useState(() => {
    try { return !localStorage.getItem('pb-default-version') } catch { return false }
  })
  // Search history (shared key with KjvReader via annotations lib)
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory('kjv'))
  // Lexicon (Strong's) find-in-GNT/HOT/LXX history
  const [strongsHistory, setStrongsHistory] = useState(() => getSearchHistory('strongs'))
  // Search results shown in the side panel
  const [searchResults,      setSearchResults]      = useState(null)   // null=no search, []|[…]=results
  const [searchResultsTotal, setSearchResultsTotal] = useState(0)
  const [searchResultsCapped,setSearchResultsCapped] = useState(false)
  const [panelQuery,         setPanelQuery]         = useState('')
  const [panelSearching,     setPanelSearching]     = useState(false)
  // Which book groups are expanded in the results list
  const [openBooks, setOpenBooks] = useState(new Set())
  // Scripture chapter bookmark state
  const [isBookmarked, setIsBookmarked] = useState(() => isScriptureBookmarked('Genesis', 1))
  useEffect(() => {
    setIsBookmarked(isScriptureBookmarked(readBook, readChapter))
  }, [readBook, readChapter])
  useEffect(() => {
    const handler = e => {
      if (e.detail.book === readBook && e.detail.chapter === readChapter) {
        setIsBookmarked(!!e.detail.bookmarks[`${readBook}|${readChapter}`])
      }
    }
    window.addEventListener('pb-sc-bookmark-changed', handler)
    return () => window.removeEventListener('pb-sc-bookmark-changed', handler)
  }, [readBook, readChapter])

  // Listen for "Find in GNT/HOT/LXX" events from StrongsModal and save to strongs history
  useEffect(() => {
    function handler(e) {
      const { id, lang, corpus, label } = e.detail || {}
      if (!id) return
      addSearchHistory('strongs', JSON.stringify({ id, lang, corpus, label }))
      setStrongsHistory(getSearchHistory('strongs'))
    }
    window.addEventListener('pb-strongs-find', handler)
    return () => window.removeEventListener('pb-strongs-find', handler)
  }, [])

  // Author-only edit mode for study notes / cross-refs
  const isAuthorUser = isAuthor(session)
  const [authorEditMode, setAuthorEditMode] = useState(false)
  // Study mode: show/hide all notes and cross-reference chips (off by default for clean reading)
  const [studyMode, setStudyMode] = useState(false)
  // Ref for search input (avoid autoFocus keyboard-on-load on mobile)
  const searchInputRef = useRef(null)
  useEffect(() => {
    if (searchPanelOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchPanelOpen])

  // Close version dropdown on outside click
  useEffect(() => {
    if (!showVersionDropdown) return
    function onOutside(e) {
      if (!versionDropdownRef.current?.contains(e.target)) setShowVersionDropdown(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showVersionDropdown])

  // Auto-hide header on scroll-down, show on scroll-up.
  // The header uses transform-only (no marginBottom) so the flex layout never
  // changes when the header hides → no scroll-position side-effects, no
  // oscillation.  The distToBottom guard is a UX nicety: keep the header
  // visible near the chapter end so the "mark as read" button stays reachable.
  const headerRef      = useRef(null)
  const headerHRef     = useRef(57)    // mutable ref — read inside scroll handler
  const [headerH,    setHeaderH]   = useState(57)
  const [chromeVis,  setChromeVis] = useState(true)
  // Timestamp until which we ignore scroll events — prevents the single
  // layout-snap event (caused by paddingTop toggling) from re-triggering the header.
  const suppressUntil = useRef(0)

  useEffect(() => {
    if (headerRef.current) {
      const h = headerRef.current.offsetHeight
      headerHRef.current = h
      setHeaderH(h)
    }
  }, [])

  // Register the scroll-direction handler ONCE (empty deps).
  // Header hides on scroll-down (past 80px); reappears on ANY upward scroll.
  // paddingTop is now constant (= headerH), so there is no layout recalculation
  // when the header hides — the reader scroll container never changes size.
  // suppressUntil prevents an immediate re-hide right after the header becomes visible.
  useEffect(() => {
    function handler(e) {
      const { direction, scrollTop, scrollHeight, clientHeight } = e.detail
      if (direction === 'down') {
        if (Date.now() < suppressUntil.current) return
        // Stay visible near the top and near the chapter end
        if (scrollTop < 80) return
        const distToBottom = (scrollHeight ?? 0) - (clientHeight ?? 0) - scrollTop
        if (distToBottom < headerHRef.current + 40) return
        setChromeVis(false)
        suppressUntil.current = Date.now() + 150
      } else {
        // Reveal on ANY upward scroll — no scrollTop gate
        setChromeVis(v => {
          if (v) return v // already visible, skip re-render
          suppressUntil.current = Date.now() + 150 // brief suppress so a flick-up doesn't instantly re-hide
          return true
        })
      }
    }
    window.addEventListener('pb-scroll-dir', handler)
    return () => window.removeEventListener('pb-scroll-dir', handler)
  }, []) // intentionally empty — all values accessed via refs

  /* Deep-link from devotional/confessional: navigate to specific book/chapter/verse.
     If the link also specifies a version (e.g. from KjvModal), switch to it first. */
  const pendingDeepLinkRef = useRef(locationState?.book ? locationState : null)
  useEffect(() => {
    if (!pendingDeepLinkRef.current) return
    const { book: b, chapter: ch, verse: v, version: ver } = pendingDeepLinkRef.current
    pendingDeepLinkRef.current = null

    // Auto-enable study mode when deep-linked to a specific verse
    // (so the user's note on that verse is immediately visible)
    if (v) setStudyMode(true)

    // Resolve 'original' → 'hebrew' (OT) or 'greek' (NT) from the target book
    const resolvedVer = ver === 'original'
      ? originalVersionForBook(b, BIBLE_BOOKS)
      : ver

    // Switch version if the deep-link requests one different from the current session
    const needsVersionSwitch = resolvedVer && resolvedVer !== readVersion
    if (needsVersionSwitch) {
      setReadVersion(resolvedVer)
      try { localStorage.setItem('reader-version', resolvedVer) } catch {}
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

  /** Kick off a panel search without touching KjvReader's internal state. */
  function runPanelSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    saveSearchHistory(trimmed)
    setPanelQuery(trimmed)
    setPanelSearching(true)
    setSearchResults(null)
    setOpenBooks(new Set())
    kjvRef.current?.runSearch(trimmed)
  }

  /* Today's Bible chapter (for KJV reader "Today" badge) */
  const todayBibleChapter = useMemo(() => {
    const today = Math.min(getTodayDayNum(), 365)
    return DAY_BIBLE[today] || null
  }, [])

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header
        ref={headerRef}
        style={{
          ...s.header,
          transform:  chromeVis ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.28s ease',
        }}
      >
        <div style={s.headerInner}>
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

          {/* Version dropdown */}
          <div ref={versionDropdownRef} style={{ position:'relative', flexShrink:0 }}>
            <button
              style={s.versionBtn}
              onClick={() => setShowVersionDropdown(d => !d)}
              aria-label="Select Bible translation"
              title="Select Bible translation"
            >
              <span style={s.versionBtnLabel}>
                {BIBLE_VERSIONS.find(v => v.id === readVersion)?.abbreviation || readVersion.toUpperCase()}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, opacity:0.6 }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showVersionDropdown && (
              <div style={s.versionDropdown}>
                {BIBLE_VERSIONS.map(v => (
                  <button
                    key={v.id}
                    style={{
                      ...s.versionDropdownItem,
                      ...(v.id === readVersion ? s.versionDropdownItemActive : {}),
                    }}
                    onClick={() => {
                      setReadVersion(v.id)
                      try { localStorage.setItem('reader-version', v.id) } catch {}
                      setDefaultReaderVersion(v.id)
                      setShowVersionDropdown(false)
                    }}
                  >
                    <span style={s.versionDropdownAbbr}>{v.abbreviation}</span>
                    <span style={s.versionDropdownName}>{v.label}</span>
                    {v.id === readVersion && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginLeft:'auto', flexShrink:0 }}>
                        <path d="M2 5.5l3 3 4-5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Author edit-mode toggle — only visible to the author */}
          {isAuthorUser && (
            <button
              style={{
                ...s.menuBtn,
                marginLeft:'auto',
                ...(authorEditMode ? { color:'var(--teal)', borderColor:'var(--teal)', background:'var(--teal-light)' } : {}),
              }}
              onClick={() => setAuthorEditMode(m => !m)}
              aria-label="Toggle author edit mode"
              title={authorEditMode ? 'Exit edit mode' : 'Enter edit mode (author)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"
                  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Study mode toggle — show/hide all notes and reference chips */}
          <button
            style={{
              ...s.menuBtn,
              ...(isAuthorUser ? {} : { marginLeft:'auto' }),
              ...(studyMode ? { color:'var(--teal)', borderColor:'var(--teal)', background:'var(--teal-light)' } : {}),
            }}
            onClick={() => setStudyMode(m => !m)}
            aria-label={studyMode ? 'Hide notes & references' : 'Show notes & references'}
            title={studyMode ? 'Hide notes & references' : 'Show notes & references'}
          >
            {/* Open book icon */}
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <path d="M2 3.5C2 3.5 4 3 8.5 3C13 3 15 3.5 15 3.5V13.5C15 13.5 13 13 8.5 13C4 13 2 13.5 2 13.5V3.5Z"
                stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8.5 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M5 5.5C5 5.5 6.5 5.2 8.5 5.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <path d="M5 7.5C5 7.5 6.5 7.2 8.5 7.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Search icon button */}
          <button
            style={s.menuBtn}
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

        {/* Header */}
        <div style={sp.panelHeader}>
          <span style={sp.panelTitle}>Search Bible</span>
          <button style={sp.closeBtn} onClick={() => setSearchPanelOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search input + Submit button */}
        <div style={sp.searchBox}>
          <div style={sp.searchRow}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchInputRef}
              style={sp.searchInput}
              value={readSearch}
              onChange={e => {
                setReadSearch(e.target.value)
                // If cleared, reset results — but don't touch KjvReader state
                if (!e.target.value.trim()) { setSearchResults(null); setPanelQuery('') }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') runPanelSearch(readSearch)
                if (e.key === 'Escape') setSearchPanelOpen(false)
              }}
              placeholder="Search all books…"
            />
            {readSearch && (
              <button style={sp.clearBtn} onClick={() => {
                setReadSearch('')
                setSearchResults(null)
                setPanelQuery('')
              }}>×</button>
            )}
          </div>
          <button
            style={sp.searchSubmitBtn}
            onClick={() => runPanelSearch(readSearch)}
            disabled={!readSearch.trim() || panelSearching}
          >
            {panelSearching ? 'Searching…' : 'Search Bible'}
          </button>
        </div>

        {/* ── Results ── */}
        {searchResults !== null ? (
          <div style={sp.resultsArea}>

            {/* Summary bar */}
            <div style={sp.resultsHeader}>
              <div>
                {panelSearching ? (
                  <span style={sp.resultsTitle}>Searching…</span>
                ) : searchResults.length === 0 ? (
                  <span style={sp.resultsTitle}>No results for "{panelQuery}"</span>
                ) : (
                  <>
                    <span style={sp.resultsTitle}>
                      {searchResultsCapped
                        ? `First ${searchResults.length.toLocaleString()} of ${searchResultsTotal.toLocaleString()} verses`
                        : `${searchResultsTotal.toLocaleString()} verse${searchResultsTotal !== 1 ? 's' : ''}`}
                    </span>
                    <div style={sp.resultsSubtitle}>
                      {(() => {
                        const books = new Set(searchResults.map(r => r.book))
                        return `${books.size} book${books.size !== 1 ? 's' : ''} · "${panelQuery}"`
                      })()}
                    </div>
                  </>
                )}
              </div>
              {/* Expand/collapse all */}
              {!panelSearching && searchResults.length > 0 && (
                <button style={sp.expandAllBtn} onClick={() => {
                  const books = [...new Set(searchResults.map(r => r.book))]
                  const allOpen = books.every(b => openBooks.has(b))
                  setOpenBooks(allOpen ? new Set() : new Set(books))
                }}>
                  {(() => {
                    const books = [...new Set(searchResults.map(r => r.book))]
                    return books.every(b => openBooks.has(b)) ? 'Collapse all' : 'Expand all'
                  })()}
                </button>
              )}
            </div>

            {/* Load-all banner */}
            {searchResultsCapped && !panelSearching && (
              <div style={sp.loadAllBar}>
                <span style={sp.loadAllNote}>Showing first {searchResults.length.toLocaleString()} of {searchResultsTotal.toLocaleString()}</span>
                <button style={sp.loadAllBtn} onClick={() => {
                  setPanelSearching(true)
                  kjvRef.current?.loadAllResults(panelQuery)
                }}>Load all</button>
              </div>
            )}

            {/* Grouped results */}
            {!panelSearching && searchResults.length > 0 && (() => {
              // Group by book in canonical order
              const map = new Map()
              for (const hit of searchResults) {
                if (!map.has(hit.book)) map.set(hit.book, [])
                map.get(hit.book).push(hit)
              }
              const grouped = BIBLE_BOOKS.filter(b => map.has(b.name)).map(b => ({ book: b.name, hits: map.get(b.name) }))

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
                <div style={sp.groupList}>
                  {grouped.map(({ book, hits }) => {
                    const isOpen = openBooks.has(book)
                    return (
                      <div key={book} style={sp.bookGroup}>
                        {/* Book header row — click to expand/collapse */}
                        <button
                          style={sp.bookHeader}
                          onClick={() => setOpenBooks(prev => {
                            const next = new Set(prev)
                            next.has(book) ? next.delete(book) : next.add(book)
                            return next
                          })}
                        >
                          <svg
                            width="10" height="10" viewBox="0 0 10 10" fill="none"
                            style={{ flexShrink:0, transition:'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', color:'var(--ink-faint)' }}
                          >
                            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          <span style={sp.bookName}>{book}</span>
                          <span style={sp.bookCount}>{hits.length}</span>
                        </button>

                        {/* Verse rows — only when expanded */}
                        {isOpen && (
                          <div style={sp.verseRows}>
                            {hits.map((hit, i) => (
                              <button
                                key={i}
                                style={sp.verseRow}
                                onClick={() => {
                                  kjvRef.current?.navigateTo(hit.book, hit.chapter, hit.verse)
                                  kjvRef.current?.setSearchQuery(panelQuery)
                                  setSearchPanelOpen(false)
                                }}
                              >
                                <span style={sp.verseRef}>{hit.chapter}:{hit.verse}</span>
                                <span style={sp.verseText}>{hlText(hit.text)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {!panelSearching && searchResults.length === 0 && (
              <p style={sp.noResults}>Try a different word or phrase.</p>
            )}
          </div>

        ) : (
          /* Shown when no active search */
          <div style={{ flex:1, overflowY:'auto' }}>
            {/* Recent searches */}
            {searchHistory.length > 0 && (
              <div style={sp.section}>
                <div style={sp.sectionLabel}>Recent searches</div>
                {searchHistory.map(q => (
                  <button key={q} style={sp.histItem} onClick={() => {
                    setReadSearch(q)
                    runPanelSearch(q)
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
            )}

            {/* Lexicon searches — Find in GNT / HOT / LXX */}
            {strongsHistory.length > 0 && (
              <div style={{ ...sp.section, borderTop: searchHistory.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: searchHistory.length > 0 ? 16 : 4 }}>
                <div style={sp.sectionLabel}>Lexicon searches</div>
                {strongsHistory.map((raw, i) => {
                  let parsed = null
                  try { parsed = JSON.parse(raw) } catch { return null }
                  if (!parsed) return null
                  const { id, lang, corpus, label } = parsed
                  return (
                    <button
                      key={i}
                      style={sp.histItem}
                      onClick={() => kjvRef.current?.openStrongs(id, lang)}
                      title={`Reopen ${corpus} search for ${id}`}
                    >
                      {/* Greek/Hebrew icon */}
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color:'var(--ink-faint)', flexShrink:0 }}>
                        <rect x="1" y="1" width="9" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M3 4h2M3 6.5h5M6 4c0 0 1 0 1 1.5S6 7 6 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      <span style={{ flex:1 }}>{id}{label ? ` — ${label}` : ''}</span>
                      <span style={sp.histVersionBadge}>{corpus}</span>
                    </button>
                  )
                })}
                <button style={sp.clearHistBtn} onClick={() => {
                  clearSearchHistory('strongs')
                  setStrongsHistory([])
                }}>Clear lexicon history</button>
              </div>
            )}

            {/* Chapter navigation history */}
            {navHistory.length > 0 && (
              <div style={{ ...sp.section, borderTop: searchHistory.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: searchHistory.length > 0 ? 16 : 4 }}>
                <div style={sp.sectionLabel}>Chapters visited</div>
                {[...navHistory].reverse().map((entry, i) => {
                  const origIdx = navHistory.length - 1 - i
                  const isCurrent = origIdx === navHistoryIdx
                  return (
                    <button
                      key={i}
                      style={{
                        ...sp.histItem,
                        ...(isCurrent ? { background:'var(--teal-light)', color:'var(--teal)', fontWeight:600 } : {}),
                      }}
                      onClick={() => {
                        kjvRef.current?.navigateTo(entry.book, entry.chapter)
                        setSearchPanelOpen(false)
                      }}
                    >
                      {/* Book icon */}
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color: isCurrent ? 'var(--teal)' : 'var(--ink-faint)', flexShrink:0 }}>
                        <rect x="1" y="1" width="9" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M3 3.5h5M3 5.5h5M3 7.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      <span style={{ flex:1 }}>{entry.book} {entry.chapter}</span>
                      {isCurrent && (
                        <span style={{ fontSize:10, color:'var(--teal)', fontWeight:700, letterSpacing:'0.04em' }}>NOW</span>
                      )}
                    </button>
                  )
                })}
                <button style={sp.clearHistBtn} onClick={() => {
                  kjvRef.current?.clearNavHistory()
                  setNavHistory(h => h.length > 0 ? [h[navHistoryIdx]] : [])
                  setNavHistoryIdx(0)
                }}>Clear chapters visited</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ KJV / Greek / Hebrew Reader ══
          paddingTop is constant (= headerH) so the scroll container never
          changes size when the header hides or shows.  A changing size was
          the root cause of iOS Safari freezing the scroll container and the
          "stuck scroll" bug.  When the header slides off-screen the top
          headerH px of content become visible through the vacated space — the
          same standard mobile-chrome pattern used by most reading apps. */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <KjvReader
          ref={kjvRef}
          version={readVersion}
          topInset={headerH}
          onVersionChange={v => {
            setReadVersion(v)
            try { localStorage.setItem('reader-version', v) } catch {}
          }}
          todayChapter={todayBibleChapter}
          onNavChange={(b, c) => { setReadBook(b); setReadChapter(c) }}
          onSearchChange={q => setReadSearch(q)}
          onHistoryChange={({ entries, currentIdx }) => {
            if (entries) setNavHistory([...entries])
            if (currentIdx != null) setNavHistoryIdx(currentIdx)
          }}
          authorEditMode={authorEditMode}
          studyMode={studyMode}
          onSearchResults={(hits, total, capped, q) => {
            setSearchResults(hits)
            setSearchResultsTotal(total)
            setSearchResultsCapped(capped)
            setPanelQuery(q)
            setPanelSearching(false)
            setOpenBooks(new Set()) // always start collapsed on new search
          }}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => {
            const result = toggleScriptureBookmark(readBook, readChapter)
            setIsBookmarked(!!result[`${readBook}|${readChapter}`])
          }}
        />
      </div>

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
                    setDefaultReaderVersion(['kjv','abab','nasb'].includes(v.id) ? v.id : 'kjv')
                    setReadVersion(v.id)
                    try { localStorage.setItem('reader-version', v.id) } catch {}
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

  /* header — fixed so hiding it doesn't leave a gap in the flex layout */
  header: {
    position:'fixed', top:0, left:0, right:0, zIndex:20,
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

  /* version dropdown button */
  versionBtn: {
    display:'flex', alignItems:'center', gap:4,
    padding:'5px 8px', borderRadius:'var(--radius)',
    border:'1px solid var(--border)', background:'var(--surface)',
    cursor:'pointer', flexShrink:0, fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.15s',
    height:36,
  },
  versionBtnLabel: {
    fontSize:11, fontWeight:700, color:'var(--ink-muted)',
    letterSpacing:'0.04em', textTransform:'uppercase',
  },
  versionDropdown: {
    position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:200,
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
    minWidth:180, overflow:'hidden',
    display:'flex', flexDirection:'column',
  },
  versionDropdownItem: {
    display:'flex', alignItems:'center', gap:8,
    padding:'9px 12px', border:'none', background:'none',
    cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s', width:'100%',
  },
  versionDropdownItemActive: {
    background:'var(--teal-light)',
  },
  versionDropdownAbbr: {
    fontSize:11, fontWeight:700, color:'var(--ink)',
    letterSpacing:'0.04em', textTransform:'uppercase', minWidth:32,
  },
  versionDropdownName: {
    fontSize:12, color:'var(--ink-muted)', flex:1,
  },

}

const sp = {
  backdrop: {
    position:'fixed', inset:0, zIndex:150,
    background:'rgba(0,0,0,0.3)',
  },
  panel: {
    position:'fixed', top:0, right:0, bottom:0, zIndex:160,
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
    padding:'0 10px',
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
  histVersionBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
    color:'var(--teal)', background:'var(--teal-light)', borderRadius:99,
    padding:'2px 6px', flexShrink:0,
  },

  /* Search box row (input + submit button) */
  searchBox: {
    display:'flex', flexDirection:'column', gap:8, padding:'0 16px 12px',
    borderBottom:'1px solid var(--border)', flexShrink:0,
  },
  searchSubmitBtn: {
    padding:'8px 0', borderRadius:'var(--radius)', border:'none',
    background:'var(--teal)', color:'white', fontWeight:600, fontSize:13,
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    opacity:1, transition:'opacity 0.1s',
  },

  /* Results container */
  resultsArea: {
    flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
  },
  resultsHeader: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
    padding:'10px 16px 8px', borderBottom:'1px solid var(--border)',
    flexShrink:0, gap:8,
  },
  resultsTitle: {
    fontSize:13, fontWeight:700, color:'var(--ink)',
    display:'block', marginBottom:2,
  },
  resultsSubtitle: {
    fontSize:11, color:'var(--ink-faint)',
  },
  expandAllBtn: {
    fontSize:10, fontWeight:600, color:'var(--ink-faint)',
    background:'none', border:'1px solid var(--border)', borderRadius:99,
    padding:'3px 8px', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Load-all banner */
  loadAllBar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'6px 16px', background:'var(--parchment)',
    borderBottom:'1px solid var(--border)', flexShrink:0, gap:8,
  },
  loadAllNote: { fontSize:11, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif" },
  loadAllBtn: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', border:'none', borderRadius:99,
    padding:'4px 10px', cursor:'pointer', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Grouped results list */
  groupList: {
    flex:1, overflowY:'auto', padding:'4px 0',
  },
  bookGroup: {
    borderBottom:'1px solid var(--border)',
  },
  bookHeader: {
    display:'flex', alignItems:'center', gap:8, width:'100%',
    padding:'9px 16px', border:'none', background:'none',
    cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  bookName: {
    fontSize:13, fontWeight:700, color:'var(--ink)', flex:1,
  },
  bookCount: {
    fontSize:10, fontWeight:700, color:'var(--teal)',
    background:'var(--teal-light)', borderRadius:99,
    padding:'1px 7px', flexShrink:0,
  },
  verseRows: {
    display:'flex', flexDirection:'column',
    borderTop:'1px solid var(--border)',
  },
  verseRow: {
    display:'flex', gap:10, alignItems:'flex-start', textAlign:'left',
    padding:'7px 16px 7px 28px', border:'none', background:'none',
    cursor:'pointer', borderBottom:'1px solid rgba(0,0,0,0.04)',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
    width:'100%',
  },
  verseRef: {
    fontSize:10, fontWeight:800, color:'var(--teal)',
    flexShrink:0, minWidth:36, paddingTop:2,
    letterSpacing:'0.02em', fontVariantNumeric:'tabular-nums',
  },
  verseText: {
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.6, flex:1,
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
