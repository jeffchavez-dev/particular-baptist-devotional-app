import React from 'react'

/**
 * Sticky controls bar for Scripture reading mode.
 * Shows book/chapter selector and search input.
 * Positioned above the bottom nav so it doesn't scroll with content.
 */
export default function ScriptureControls({
  book,
  chapter,
  searchQuery,
  onBook,
  onChapter,
  onSearch,
  onSearchFocus,
  onSearchSubmit,
  isMobile,
}) {
  return (
    <div style={s.bar}>
      {/* Book pill — shows current book */}
      <div style={s.bookPill}>
        <span style={s.bookName}>{book}</span>
        <span style={s.chapterNum}>Ch. {chapter}</span>
      </div>

      {/* Search input */}
      <div style={s.searchWrap}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          style={s.searchInput}
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          onFocus={() => onSearchFocus && onSearchFocus(true)}
          onBlur={() => onSearchFocus && onSearchFocus(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSearchSubmit && onSearchSubmit(searchQuery)
            if (e.key === 'Escape') onSearch('')
          }}
          placeholder="Search Bible…"
        />
        {searchQuery && (
          <button
            style={s.clearBtn}
            onClick={() => onSearch('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  bar: {
    position: 'sticky',
    bottom: 'calc(64px + env(safe-area-inset-bottom))',
    zIndex: 95,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'DM Sans', sans-serif",
  },
  bookPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'var(--parchment)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    flexShrink: 0,
  },
  bookName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink)',
    fontFamily: "'Cormorant Garamond', serif",
  },
  chapterNum: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--teal)',
    background: 'var(--teal-light)',
    padding: '1px 6px',
    borderRadius: '99px',
  },
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '0 8px',
    background: 'var(--parchment)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: 12,
    color: 'var(--ink)',
    padding: '6px 0',
    fontFamily: "'DM Sans', sans-serif",
    minWidth: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink-faint)',
    fontSize: 16,
    lineHeight: 1,
    padding: '0 2px',
    flexShrink: 0,
  },
}
