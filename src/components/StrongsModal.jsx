import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { loadStrongs, lookupStrongs, strongsNum, getCachedStrongs } from '../lib/strongs'
import { searchGreekByStrongs } from '../lib/greek'
import { searchHebrewByStrongs } from '../lib/hebrew'
import { loadLxxWords, searchLxxByStrongs } from '../lib/lxx'
import { getGreekFontCss, getHebrewFontCss } from './FontPrefsPanel'

/* ── BibleHub fallback URL ─────────────────────────────────────────── */
function bibleHubUrl(lang, id) {
  const num = strongsNum(id)
  return num ? `https://biblehub.com/${lang}/${num}.htm` : null
}

/* ── Entry detail panel (shared between single & list view) ────────── */
function EntryDetail({ lang, id, entry, scriptFont, onBrowse, onFindInScripture, onFindInLxx }) {
  const prefix = lang === 'greek' ? 'G' : 'H'
  const num    = strongsNum(id)
  const bhUrl  = bibleHubUrl(lang, id)

  if (!entry) {
    return (
      <div style={m.noEntry}>
        <span style={m.noEntryCode}>{id}</span>
        <span style={m.noEntryHint}>Entry not found in local lexicon.</span>
        {bhUrl && (
          <a href={bhUrl} target="_blank" rel="noopener noreferrer" style={m.bhLink}>
            View on BibleHub
            <ExternalIcon />
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={m.detailWrap}>
      {/* Lemma + badge */}
      <div style={m.lemmaRow}>
        <span style={{ ...m.lemma, fontFamily: scriptFont }}>
          {entry.l || id}
        </span>
        <span style={m.strongsBadge}>{prefix}{num}</span>
      </div>

      {/* Transliteration + pronunciation */}
      {(entry.x || entry.p) && (
        <div style={m.subRow}>
          {entry.x && <span style={m.translit}>{entry.x}</span>}
          {entry.x && entry.p && <span style={m.subDot}>·</span>}
          {entry.p && <span style={m.pron}>/{entry.p}/</span>}
        </div>
      )}

      {/* Definition */}
      {entry.d && (
        <p style={m.def}>{entry.d}</p>
      )}

      {/* Footer row */}
      <div style={m.footRow}>
        <button style={m.browseBtn} onClick={onBrowse}>
          <GridIcon />
          Browse lexicon
        </button>
        <button style={m.findBtn} onClick={onFindInScripture}>
          <SearchAllIcon />
          Find in {lang === 'greek' ? 'GNT' : 'HOT'}
        </button>
        {lang === 'greek' && onFindInLxx && (
          <button style={m.findLxxBtn} onClick={onFindInLxx}>
            <SearchAllIcon />
            Find in LXX
          </button>
        )}
        {bhUrl && (
          <a href={bhUrl} target="_blank" rel="noopener noreferrer" style={m.bhLink}>
            BibleHub
            <ExternalIcon />
          </a>
        )}
      </div>
    </div>
  )
}

/* ── List / browse view ─────────────────────────────────────────────── */
function BrowseView({ lang, data, currentId, scriptFont, onSelect }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const prefix = lang === 'greek' ? 'G' : 'H'

  const entries = useMemo(() => {
    if (!data) return []
    return Object.entries(data)
      .map(([num, e]) => ({ num: Number(num), id: `${prefix}${num}`, ...e }))
      .sort((a, b) => a.num - b.num)
  }, [data, prefix])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      e.id.toLowerCase().includes(q) ||
      (e.l  || '').toLowerCase().includes(q) ||
      (e.x  || '').toLowerCase().includes(q) ||
      (e.d  || '').toLowerCase().includes(q)
    )
  }, [entries, query])

  const currentNum = strongsNum(currentId)

  return (
    <div style={m.browseWrap}>
      {/* Search input */}
      <div style={m.browseSearchWrap}>
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${entries.length.toLocaleString()} entries…`}
          style={m.browseSearch}
        />
        {query && (
          <button style={m.browseSearchClear} onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {/* Count */}
      <div style={m.browseCount}>
        {query
          ? `${filtered.length.toLocaleString()} match${filtered.length === 1 ? '' : 'es'}`
          : `${entries.length.toLocaleString()} entries`}
      </div>

      {/* List */}
      <div style={m.browseList}>
        {filtered.map(e => {
          const isActive = e.num === currentNum
          return (
            <button
              key={e.num}
              style={{
                ...m.browseRow,
                ...(isActive ? m.browseRowActive : {}),
              }}
              onClick={() => onSelect(e.id)}
            >
              <span style={{ ...m.browseCode, ...(isActive ? { color:'var(--teal)' } : {}) }}>
                {e.id}
              </span>
              <span style={{ ...m.browseLemma, fontFamily: scriptFont }}>{e.l}</span>
              <span style={m.browseGloss} title={e.d}>
                {e.x ? `${e.x} — ` : ''}{(e.d || '').slice(0, 60)}{(e.d || '').length > 60 ? '…' : ''}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={m.browseEmpty}>No entries match "{query}"</div>
        )}
      </div>
    </div>
  )
}

/* ── Scope picker ───────────────────────────────────────────────────── */
function ScopePicker({ currentBook, corpus, onPickBook, onPickAll }) {
  return (
    <div style={m.scopeWrap}>
      <p style={m.scopeLabel}>Search where?</p>
      <button style={m.scopeBookBtn} onClick={onPickBook}>
        <BookScopeIcon />
        <span>
          <span style={m.scopeBtnTitle}>In {currentBook}</span>
          <span style={m.scopeBtnSub}>Results from this book only</span>
        </span>
      </button>
      <button style={m.scopeAllBtn} onClick={onPickAll}>
        <AllScopeIcon />
        <span>
          <span style={m.scopeBtnTitle}>All books</span>
          <span style={m.scopeBtnSub}>Search the entire {corpus}</span>
        </span>
      </button>
    </div>
  )
}

/* ── Scripture search results view ─────────────────────────────────── */
function ScriptureResultsView({ lang, id, scriptFont, onNavigate, initialScope = 'all', currentBook }) {
  const [loading,   setLoading]   = useState(true)
  const [allResults, setAllResults] = useState([])
  const [total,     setTotal]     = useState(0)
  const [capped,    setCapped]    = useState(false)
  const [openBooks, setOpenBooks] = useState(new Set())
  const [scope,     setScope]     = useState(initialScope)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      const out = lang === 'greek'
        ? searchGreekByStrongs(id)
        : searchHebrewByStrongs(id)
      setAllResults(out.results)
      setTotal(out.total)
      setCapped(out.capped)
      setLoading(false)
    }, 0)
    return () => clearTimeout(t)
  }, [lang, id])

  const results = useMemo(() => {
    if (scope === 'book' && currentBook) {
      return allResults.filter(r => r.book === currentBook)
    }
    return allResults
  }, [allResults, scope, currentBook])

  // Auto-expand first book whenever results change
  useEffect(() => {
    if (results.length > 0) setOpenBooks(new Set([results[0].book]))
  }, [results])

  const langLabel = lang === 'greek' ? 'GNT' : 'HOT'
  const isHeb     = lang === 'hebrew'

  // Group results by book, preserving canonical order
  const grouped = useMemo(() => {
    const map = new Map()
    for (const r of results) {
      if (!map.has(r.book)) map.set(r.book, [])
      map.get(r.book).push(r)
    }
    return Array.from(map.entries()) // [[bookName, [rows]], ...]
  }, [results])

  const allBooks   = grouped.map(([b]) => b)
  const allOpen    = openBooks.size === allBooks.length
  const toggleBook = (book) => setOpenBooks(prev => {
    const next = new Set(prev)
    next.has(book) ? next.delete(book) : next.add(book)
    return next
  })

  const countLabel = loading ? 'Searching…' : scope === 'book' && currentBook
    ? `${results.length.toLocaleString()} verse${results.length !== 1 ? 's' : ''} in ${currentBook} · ${langLabel}`
    : `${total.toLocaleString()} verse${total !== 1 ? 's' : ''}${capped ? ` (showing first ${allResults.length})` : ''} in ${grouped.length} book${grouped.length !== 1 ? 's' : ''} · ${langLabel}`

  return (
    <div style={m.browseWrap}>
      {/* Count bar */}
      <div style={m.browseCount}>
        {countLabel}
        {!loading && scope === 'book' && (
          <button style={m.srWidenBtn} onClick={() => setScope('all')}>
            All books →
          </button>
        )}
        {!loading && scope === 'all' && grouped.length > 1 && (
          <button
            style={m.srExpandBtn}
            onClick={() => setOpenBooks(allOpen ? new Set() : new Set(allBooks))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {loading && (
        <div style={m.loadingWrap}>
          <div className="spinner" />
          <span style={m.loadingText}>Searching {langLabel}…</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={m.browseEmpty}>No occurrences found in {langLabel}.</div>
      )}

      {/* Results grouped by book */}
      {!loading && grouped.length > 0 && (
        <div style={m.browseList}>
          {grouped.map(([book, rows]) => {
            const isOpen = openBooks.has(book)
            return (
              <div key={book} style={m.srBookGroup}>
                {/* Book header / toggle */}
                <button style={m.srBookHeader} onClick={() => toggleBook(book)}>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10"
                    style={{ flexShrink:0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.15s', color:'var(--ink-faint)' }}
                  >
                    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <span style={m.srBookName}>{book}</span>
                  <span style={m.srBookCount}>{rows.length}</span>
                </button>

                {/* Verse rows */}
                {isOpen && (
                  <div style={m.srBookRows}>
                    {rows.map((r, i) => (
                      <button
                        key={i}
                        style={m.srRow}
                        onClick={() => onNavigate(r.book, r.chapter, r.verse)}
                      >
                        <span style={m.srRef}>{r.chapter}:{r.verse}</span>
                        <span style={{ ...m.srWord, fontFamily: scriptFont, direction: isHeb ? 'rtl' : 'ltr' }}>
                          {r.w}
                        </span>
                        <span style={m.srTranslit}>{r.t}</span>
                        <span style={m.srGloss}>"{r.g}"</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {capped && scope === 'all' && (
            <div style={m.browseEmpty}>
              Showing first {allResults.length} of {total.toLocaleString()} occurrences.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── LXX Scripture search results view ─────────────────────────────── */
function LxxScriptureResultsView({ id, scriptFont, onNavigate, initialScope = 'all', currentBook }) {
  const [loading,    setLoading]    = useState(true)
  const [allResults, setAllResults] = useState([])
  const [total,      setTotal]      = useState(0)
  const [capped,     setCapped]     = useState(false)
  const [openBooks,  setOpenBooks]  = useState(new Set())
  const [scope,      setScope]      = useState(initialScope)

  useEffect(() => {
    setLoading(true)
    // Ensure LXX data is loaded, then run the search
    loadLxxWords().then(() => {
      const out = searchLxxByStrongs(id)
      setAllResults(out.results)
      setTotal(out.total)
      setCapped(out.capped)
      setLoading(false)
    }).catch(() => {
      setAllResults([])
      setTotal(0)
      setCapped(false)
      setLoading(false)
    })
  }, [id])

  const results = useMemo(() => {
    if (scope === 'book' && currentBook) {
      return allResults.filter(r => r.book === currentBook)
    }
    return allResults
  }, [allResults, scope, currentBook])

  useEffect(() => {
    if (results.length > 0) setOpenBooks(new Set([results[0].book]))
  }, [results])

  // Group results by book
  const grouped = useMemo(() => {
    const map = new Map()
    for (const r of results) {
      if (!map.has(r.book)) map.set(r.book, [])
      map.get(r.book).push(r)
    }
    return Array.from(map.entries())
  }, [results])

  const allBooks = grouped.map(([b]) => b)
  const allOpen  = openBooks.size === allBooks.length
  const toggleBook = (book) => setOpenBooks(prev => {
    const next = new Set(prev)
    next.has(book) ? next.delete(book) : next.add(book)
    return next
  })

  const countLabel = loading ? 'Searching LXX…' : scope === 'book' && currentBook
    ? `${results.length.toLocaleString()} verse${results.length !== 1 ? 's' : ''} in ${currentBook} · LXX`
    : `${total.toLocaleString()} verse${total !== 1 ? 's' : ''}${capped ? ` (showing first ${allResults.length})` : ''} in ${grouped.length} book${grouped.length !== 1 ? 's' : ''} · LXX`

  return (
    <div style={m.browseWrap}>
      {/* Count bar */}
      <div style={m.browseCount}>
        {countLabel}
        {!loading && scope === 'book' && (
          <button style={m.srWidenBtn} onClick={() => setScope('all')}>
            All books →
          </button>
        )}
        {!loading && scope === 'all' && grouped.length > 1 && (
          <button
            style={m.srExpandBtn}
            onClick={() => setOpenBooks(allOpen ? new Set() : new Set(allBooks))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {loading && (
        <div style={m.loadingWrap}>
          <div className="spinner" />
          <span style={m.loadingText}>Loading LXX data…</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={m.browseEmpty}>No occurrences found in LXX.</div>
      )}

      {!loading && grouped.length > 0 && (
        <div style={m.browseList}>
          {grouped.map(([book, rows]) => {
            const isOpen = openBooks.has(book)
            return (
              <div key={book} style={m.srBookGroup}>
                <button style={m.srBookHeader} onClick={() => toggleBook(book)}>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10"
                    style={{ flexShrink:0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.15s', color:'var(--ink-faint)' }}
                  >
                    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <span style={m.srBookName}>{book}</span>
                  <span style={{ ...m.srBookCount, background:'#0c4a6e' }}>{rows.length}</span>
                </button>
                {isOpen && (
                  <div style={m.srBookRows}>
                    {rows.map((r, i) => (
                      <button
                        key={i}
                        style={m.srRow}
                        onClick={() => onNavigate(r.book, r.chapter, r.verse)}
                      >
                        <span style={m.srRef}>{r.chapter}:{r.verse}</span>
                        <span style={{ ...m.srWord, fontFamily: scriptFont }}>
                          {r.w}
                        </span>
                        <span style={m.srGloss}>LXX Septuagint</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {capped && scope === 'all' && (
            <div style={m.browseEmpty}>
              Showing first {allResults.length} of {total.toLocaleString()} occurrences.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main modal ─────────────────────────────────────────────────────── */
/**
 * Props:
 *   strongsId      — e.g. "G1161" or "H7225G"
 *   lang           — 'greek' | 'hebrew'
 *   greekFontId    — from prefs
 *   hebrewFontId   — from prefs
 *   onClose        — () => void
 *   onNavigate     — (book, chapter, verse) => void  called when user taps a GNT/HOT scripture result
 *   onNavigateLxx  — (book, chapter, verse) => void  called when user taps an LXX scripture result
 */
export default function StrongsModal({ strongsId, lang, greekFontId, hebrewFontId, onClose, onNavigate, onNavigateLxx, initialView = 'detail', currentBook }) {
  const [view,    setView]    = useState(initialView)  // 'detail' | 'browse' | 'scripture' | 'scripture-lxx' | 'scripture-scope' | 'scripture-lxx-scope'
  const [data,    setData]    = useState(() => getCachedStrongs(lang))
  const [loading, setLoading] = useState(!getCachedStrongs(lang))
  const [error,   setError]   = useState(null)
  const [activeId, setActiveId] = useState(strongsId)
  const [scope,   setScope]   = useState('all')  // 'all' | 'book'

  /* Determine script font */
  const scriptFont = lang === 'hebrew'
    ? getHebrewFontCss(hebrewFontId)
    : getGreekFontCss(greekFontId)

  /* Load data */
  useEffect(() => {
    let cancelled = false
    if (data) return
    setLoading(true)
    loadStrongs(lang)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Close on Escape */
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const entry = data ? lookupStrongs(lang, activeId) : null

  const langLabel = lang === 'greek' ? 'Greek NT' : 'Hebrew OT'

  function handleSelectFromList(id) {
    setActiveId(id)
    setView('detail')
  }

  return (
    /* Backdrop */
    <div style={m.backdrop} onClick={onClose}>
      {/* Modal card */}
      <div style={m.card} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Strong's Lexicon">

        {/* ── Header ── */}
        <div style={m.header}>
          <div style={m.headerLeft}>
            {view !== 'detail' ? (
              <button style={m.backBtn} onClick={() => setView('detail')}>
                <BackIcon />
                {(view === 'scripture' || view === 'scripture-lxx' || view === 'scripture-scope' || view === 'scripture-lxx-scope') ? 'Back to entry' : 'Back'}
              </button>
            ) : (
              <span style={m.headerTitle}>Strong's Lexicon</span>
            )}
            <span style={m.headerLang}>{langLabel}</span>
            {(view === 'scripture-lxx' || view === 'scripture-lxx-scope') && (
              <span style={{ ...m.headerLang, background:'rgba(12,74,110,0.12)', color:'#0c4a6e', border:'1px solid rgba(12,74,110,0.2)' }}>LXX</span>
            )}
          </div>
          <button style={m.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Body ── */}
        <div style={m.body}>
          {loading && (
            <div style={m.loadingWrap}>
              <div className="spinner" />
              <span style={m.loadingText}>Loading {langLabel} lexicon…</span>
            </div>
          )}

          {error && !loading && (
            <div style={m.errorWrap}>
              <p style={m.errorText}>{error}</p>
              <p style={m.errorHint}>Run: <code>npm run process:strongs</code></p>
            </div>
          )}

          {!loading && !error && data && view === 'detail' && (
            <EntryDetail
              lang={lang}
              id={activeId}
              entry={entry}
              scriptFont={scriptFont}
              onBrowse={() => setView('browse')}
              onFindInScripture={() => {
                window.dispatchEvent(new CustomEvent('pb-strongs-find', {
                  detail: { id: activeId, lang, corpus: lang === 'greek' ? 'GNT' : 'HOT', label: entry?.l }
                }))
                if (currentBook) {
                  setView('scripture-scope')
                } else {
                  setScope('all')
                  setView('scripture')
                }
              }}
              onFindInLxx={lang === 'greek' ? () => {
                window.dispatchEvent(new CustomEvent('pb-strongs-find', {
                  detail: { id: activeId, lang: 'greek', corpus: 'LXX', label: entry?.l }
                }))
                if (currentBook) {
                  setView('scripture-lxx-scope')
                } else {
                  setScope('all')
                  setView('scripture-lxx')
                }
              } : undefined}
            />
          )}

          {!loading && !error && data && view === 'browse' && (
            <BrowseView
              lang={lang}
              data={data}
              currentId={activeId}
              scriptFont={scriptFont}
              onSelect={handleSelectFromList}
            />
          )}

          {(view === 'scripture-scope') && (
            <ScopePicker
              currentBook={currentBook}
              corpus={lang === 'greek' ? 'GNT' : 'HOT'}
              onPickBook={() => { setScope('book'); setView('scripture') }}
              onPickAll={() => { setScope('all'); setView('scripture') }}
            />
          )}

          {(view === 'scripture-lxx-scope') && (
            <ScopePicker
              currentBook={currentBook}
              corpus="LXX"
              onPickBook={() => { setScope('book'); setView('scripture-lxx') }}
              onPickAll={() => { setScope('all'); setView('scripture-lxx') }}
            />
          )}

          {view === 'scripture' && (
            <ScriptureResultsView
              lang={lang}
              id={activeId}
              scriptFont={scriptFont}
              initialScope={scope}
              currentBook={currentBook}
              onNavigate={(book, chapter, verse) => {
                onClose()
                onNavigate?.(book, chapter, verse)
              }}
            />
          )}

          {view === 'scripture-lxx' && (
            <LxxScriptureResultsView
              id={activeId}
              scriptFont={scriptFont}
              initialScope={scope}
              currentBook={currentBook}
              onNavigate={(book, chapter, verse) => {
                onClose()
                // Use dedicated LXX navigation callback if provided, else fall back to onNavigate
                if (onNavigateLxx) {
                  onNavigateLxx(book, chapter, verse)
                } else {
                  onNavigate?.(book, chapter, verse)
                }
              }}
            />
          )}
        </div>

        {/* ── Footer note ── */}
        <div style={m.footer}>
          Strong's Exhaustive Concordance — James Strong, 1890 (Public Domain)
        </div>
      </div>
    </div>
  )
}

/* ── Tiny SVG icons ─────────────────────────────────────────────────── */
function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft:3, flexShrink:0 }}>
      <path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3M9 1L5 5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function BackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <rect x="1" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="7" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="7" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="7" y="7" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink:0, color:'var(--ink-faint)' }}>
      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function SearchAllIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M1 8.5h4M1 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function BookScopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0 }}>
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function AllScopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0 }}>
      <rect x="1" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="11" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="13" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="11" y="13" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────── */
const m = {
  backdrop: {
    position:'fixed', inset:0, zIndex:1000,
    background:'rgba(0,0,0,0.45)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'16px',
  },
  card: {
    width:'100%', maxWidth:480,
    maxHeight:'min(600px, 88vh)',
    background:'var(--surface)',
    borderRadius:'var(--radius-lg)',
    boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
    display:'flex', flexDirection:'column',
    overflow:'hidden',
  },

  /* Header */
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px 12px',
    borderBottom:'1px solid var(--border)',
    flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },
  headerLeft: {
    display:'flex', alignItems:'center', gap:8, minWidth:0,
  },
  headerTitle: {
    fontSize:14, fontWeight:700, color:'var(--ink)',
  },
  headerLang: {
    fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
    color:'var(--ink-faint)', background:'var(--parchment)',
    padding:'2px 7px', borderRadius:99,
    border:'1px solid var(--border)',
  },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    fontSize:20, lineHeight:1, color:'var(--ink-faint)',
    padding:'0 2px', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },
  backBtn: {
    display:'flex', alignItems:'center', gap:4,
    background:'none', border:'none', cursor:'pointer',
    fontSize:12, fontWeight:600, color:'var(--teal)',
    padding:0, fontFamily:"'DM Sans',sans-serif",
  },

  /* Body */
  body: {
    flex:1, overflowY:'auto',
  },

  /* Footer */
  footer: {
    padding:'8px 16px',
    borderTop:'1px solid var(--border)',
    fontSize:9, color:'var(--ink-faint)',
    fontFamily:"'DM Sans',sans-serif",
    textAlign:'center', flexShrink:0,
    letterSpacing:'0.02em',
  },

  /* Loading / error */
  loadingWrap: {
    display:'flex', flexDirection:'column', alignItems:'center',
    justifyContent:'center', gap:12, padding:'3rem 1.5rem',
    fontFamily:"'DM Sans',sans-serif",
  },
  loadingText: { fontSize:13, color:'var(--ink-muted)' },
  errorWrap: {
    padding:'2rem', textAlign:'center', fontFamily:"'DM Sans',sans-serif",
  },
  errorText: { fontSize:13, color:'var(--ink-muted)', marginBottom:8 },
  errorHint: { fontSize:12, color:'var(--ink-faint)' },

  /* Detail view */
  detailWrap: {
    padding:'18px 20px 16px',
    display:'flex', flexDirection:'column', gap:10,
    fontFamily:"'DM Sans',sans-serif",
  },
  lemmaRow: {
    display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
  },
  lemma: {
    fontSize:32, fontWeight:400, color:'var(--ink)', lineHeight:1.1,
    fontFamily:"'Palatino Linotype','Palatino',serif",
  },
  strongsBadge: {
    fontSize:11, fontWeight:700, letterSpacing:'0.05em',
    color:'var(--teal)', background:'var(--teal-light)',
    padding:'3px 10px', borderRadius:99,
    fontFamily:"'DM Sans',sans-serif",
  },
  subRow: {
    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
  },
  translit: {
    fontSize:15, fontStyle:'italic', color:'var(--ink-muted)',
    fontFamily:"'Cormorant Garamond',Georgia,serif", letterSpacing:'0.01em',
  },
  subDot: { fontSize:12, color:'var(--ink-faint)' },
  pron: {
    fontSize:13, color:'var(--ink-faint)',
    fontFamily:"'DM Sans',sans-serif",
  },
  def: {
    fontSize:14, color:'var(--ink)', lineHeight:1.7,
    margin:0,
    paddingTop:6, paddingBottom:2,
    borderTop:'1px solid var(--border)',
    fontFamily:"'Georgia','Times New Roman',serif",
  },
  footRow: {
    display:'flex', alignItems:'center', gap:10,
    paddingTop:6, flexWrap:'wrap',
  },
  browseBtn: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:11, fontWeight:600, color:'var(--ink-muted)',
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', padding:'5px 12px',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.12s',
  },
  bhLink: {
    display:'inline-flex', alignItems:'center',
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', border:'none',
    borderRadius:99, padding:'4px 10px',
    textDecoration:'none', fontFamily:"'DM Sans',sans-serif",
  },
  findBtn: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:11, fontWeight:600, color:'var(--purple-ink)',
    background:'var(--purple-soft)', border:'1px solid transparent',
    borderRadius:'var(--radius)', padding:'5px 12px',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.12s',
  },
  findLxxBtn: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:11, fontWeight:600, color:'#0c4a6e',
    background:'rgba(12,74,110,0.10)', border:'1px solid rgba(12,74,110,0.2)',
    borderRadius:'var(--radius)', padding:'5px 12px',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
    transition:'all 0.12s',
  },

  /* Scope picker */
  scopeWrap: {
    padding:'28px 20px 24px',
    display:'flex', flexDirection:'column', gap:12,
    fontFamily:"'DM Sans',sans-serif",
  },
  scopeLabel: {
    fontSize:13, fontWeight:700, color:'var(--ink-muted)',
    letterSpacing:'0.03em', margin:'0 0 4px',
    textTransform:'uppercase',
  },
  scopeBookBtn: {
    display:'flex', alignItems:'center', gap:14,
    padding:'14px 16px',
    border:'1.5px solid var(--border)', borderRadius:'var(--radius-lg)',
    background:'var(--surface)', cursor:'pointer',
    textAlign:'left', transition:'border-color 0.15s, background 0.15s',
    color:'var(--teal)',
  },
  scopeAllBtn: {
    display:'flex', alignItems:'center', gap:14,
    padding:'14px 16px',
    border:'1.5px solid var(--border)', borderRadius:'var(--radius-lg)',
    background:'var(--surface)', cursor:'pointer',
    textAlign:'left', transition:'border-color 0.15s, background 0.15s',
    color:'var(--ink-muted)',
  },
  scopeBtnTitle: {
    display:'block', fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:2,
  },
  scopeBtnSub: {
    display:'block', fontSize:11, color:'var(--ink-faint)',
  },

  /* Widen scope button */
  srWidenBtn: {
    marginLeft:'auto', background:'none', border:'none', cursor:'pointer',
    fontSize:10, fontWeight:700, letterSpacing:'0.05em',
    color:'var(--teal)', fontFamily:"'DM Sans',sans-serif", padding:'0 2px',
  },

  /* Scripture results */
  srRow: {
    display:'grid',
    gridTemplateColumns:'56px 1fr',
    gridTemplateRows:'auto auto',
    columnGap:10,
    width:'100%', padding:'7px 16px 7px 28px',
    border:'none', borderBottom:'1px solid var(--border)',
    background:'none', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  srRef: {
    gridColumn:'1', gridRow:'1 / 3', alignSelf:'center',
    fontSize:11, fontWeight:700, color:'var(--teal)',
    letterSpacing:'0.02em',
    fontFamily:"'DM Sans',sans-serif",
  },
  srWord: {
    gridColumn:'2', gridRow:'1',
    fontSize:16, fontWeight:400, color:'var(--ink)', lineHeight:1.2,
    fontFamily:"'Palatino Linotype','Palatino',serif",
  },
  srTranslit: {
    display:'none',  // tucked into gloss line to save space
  },
  srGloss: {
    gridColumn:'2', gridRow:'2',
    fontSize:11, color:'var(--ink-faint)', lineHeight:1.3,
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Scripture results — book grouping */
  srExpandBtn: {
    marginLeft:'auto', background:'none', border:'none', cursor:'pointer',
    fontSize:10, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase',
    color:'var(--teal)', fontFamily:"'DM Sans',sans-serif", padding:'0 2px',
  },
  srBookGroup: {
    borderBottom:'1px solid var(--border)',
  },
  srBookHeader: {
    display:'flex', alignItems:'center', gap:7,
    width:'100%', padding:'8px 16px',
    border:'none', borderBottom:'none',
    background:'var(--parchment)', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  srBookName: {
    flex:1, fontSize:12, fontWeight:700, color:'var(--ink)',
    letterSpacing:'0.01em',
  },
  srBookCount: {
    fontSize:10, fontWeight:700, letterSpacing:'0.04em',
    color:'white', background:'var(--teal)',
    borderRadius:20, padding:'1px 7px',
    fontFamily:"'DM Sans',sans-serif",
  },
  srBookRows: {
    background:'var(--surface)',
  },

  /* No-entry state */
  noEntry: {
    padding:'2rem 1.5rem', display:'flex', flexDirection:'column',
    alignItems:'center', gap:10, textAlign:'center',
    fontFamily:"'DM Sans',sans-serif",
  },
  noEntryCode: {
    fontSize:22, fontWeight:700, color:'var(--ink-faint)',
    letterSpacing:'0.04em',
  },
  noEntryHint: { fontSize:13, color:'var(--ink-faint)' },

  /* Browse view */
  browseWrap: {
    display:'flex', flexDirection:'column', height:'100%',
  },
  browseSearchWrap: {
    display:'flex', alignItems:'center', gap:8,
    padding:'10px 16px',
    borderBottom:'1px solid var(--border)',
    flexShrink:0,
    background:'var(--parchment)',
  },
  browseSearch: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif",
    padding:'2px 0',
  },
  browseSearchClear: {
    background:'none', border:'none', cursor:'pointer',
    fontSize:17, color:'var(--ink-faint)', lineHeight:1, padding:'0 2px',
  },
  browseCount: {
    padding:'5px 16px',
    fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
    color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
    borderBottom:'1px solid var(--border)',
    flexShrink:0,
    display:'flex', alignItems:'center', gap:8,
  },
  browseList: {
    overflowY:'auto',
    flex:1,
  },
  browseRow: {
    display:'grid',
    gridTemplateColumns:'60px 1fr',
    gridTemplateRows:'auto auto',
    columnGap:10,
    width:'100%', padding:'8px 16px',
    border:'none', borderBottom:'1px solid var(--border)',
    background:'none', cursor:'pointer',
    textAlign:'left', fontFamily:"'DM Sans',sans-serif",
    transition:'background 0.1s',
  },
  browseRowActive: {
    background:'var(--teal-light)',
  },
  browseCode: {
    gridRow:'1 / 3', alignSelf:'center',
    fontSize:11, fontWeight:700, letterSpacing:'0.04em',
    color:'var(--ink-faint)',
    fontFamily:"'DM Sans',sans-serif",
  },
  browseLemma: {
    fontSize:15, fontWeight:400, color:'var(--ink)',
    fontFamily:"'Palatino Linotype','Palatino',serif",
    lineHeight:1.2, gridColumn:2,
  },
  browseGloss: {
    fontSize:10, color:'var(--ink-faint)', lineHeight:1.4,
    gridColumn:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  browseEmpty: {
    padding:'2rem', textAlign:'center',
    fontSize:13, color:'var(--ink-faint)',
    fontFamily:"'DM Sans',sans-serif",
  },
}
