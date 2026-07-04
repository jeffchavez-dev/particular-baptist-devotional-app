import React, { useState, useEffect, useRef } from 'react'
import { COMMENTARIES, getCommentary, isCommentaryCached } from '../lib/commentary'

const COMMENTARY_IDS = Object.keys(COMMENTARIES)

export default function CommentaryPanel({ book, chapter, prefs }) {
  const [selectedId,  setSelectedId]  = useState('mhc')
  const [data,        setData]        = useState(null)   // { sections }
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [cached,      setCached]      = useState(false)
  const [expanded,    setExpanded]    = useState({})     // { sectionIndex: bool }
  const fetchKey = useRef(null)

  useEffect(() => {
    if (!book || !chapter) return
    const key = `${selectedId}|${book}|${chapter}`
    fetchKey.current = key
    setData(null)
    setError(null)
    setExpanded({})

    isCommentaryCached(selectedId, book, chapter).then(setCached)

    setLoading(true)
    getCommentary(selectedId, book, chapter).then(result => {
      if (fetchKey.current !== key) return // stale
      setLoading(false)
      if (!result) {
        setError('Commentary not available for this chapter.')
        return
      }
      setData(result)
      setCached(true)
      // Auto-expand first section
      setExpanded({ 0: true })
    }).catch(() => {
      if (fetchKey.current !== key) return
      setLoading(false)
      setError('Failed to load. Check your connection.')
    })
  }, [selectedId, book, chapter])

  const commentary = COMMENTARIES[selectedId]
  const fontSize   = prefs?.sizePx ?? 15

  return (
    <div style={s.wrap}>
      {/* Header row */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="var(--gold)" strokeWidth="1.3"/>
            <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={s.headerTitle}>Commentary</span>
          {cached && (
            <span style={s.offlineBadge} title="Available offline">✓ offline</span>
          )}
        </div>

        {/* Commentary selector — shows when more than one is registered */}
        {COMMENTARY_IDS.length > 1 && (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={s.select}
          >
            {COMMENTARY_IDS.map(id => (
              <option key={id} value={id}>{COMMENTARIES[id].shortName}</option>
            ))}
          </select>
        )}
        {COMMENTARY_IDS.length === 1 && (
          <span style={s.commentaryLabel}>{commentary.name}</span>
        )}
      </div>

      {/* Body */}
      {loading && (
        <div style={s.state}>
          <div style={s.spinner} />
          <span style={s.stateText}>Loading{cached ? ' from cache' : ' from network'}…</span>
        </div>
      )}

      {error && !loading && (
        <div style={s.state}>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{error}</span>
        </div>
      )}

      {data && !loading && (
        <div style={s.sections}>
          {data.sections.map((sec, i) => {
            const open = !!expanded[i]
            return (
              <div key={i} style={s.section}>
                <button
                  style={s.sectionBtn}
                  onClick={() => setExpanded(prev => ({ ...prev, [i]: !open }))}
                >
                  <span style={s.sectionHeading}>{sec.heading || `Section ${i + 1}`}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="var(--ink-faint)" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
                {open && (
                  <div style={s.sectionBody}>
                    {sec.paragraphs.map((html, j) => (
                      <p
                        key={j}
                        style={{ ...s.para, fontSize }}
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
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

const s = {
  wrap: {
    borderTop: '1px solid var(--border)',
    paddingTop: 12,
    marginTop: 8,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, gap: 8,
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  headerTitle: {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
    color: 'var(--ink-muted)', textTransform: 'uppercase',
    fontFamily: "'DM Sans', sans-serif",
  },
  offlineBadge: {
    fontSize: 10, fontWeight: 600, color: 'var(--teal)',
    background: 'var(--teal-light)', borderRadius: 99,
    padding: '1px 6px', fontFamily: "'DM Sans', sans-serif",
  },
  commentaryLabel: {
    fontSize: 11, color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
  },
  select: {
    fontSize: 11, padding: '3px 6px', borderRadius: 6,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
  },
  state: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '16px 0', justifyContent: 'center',
  },
  stateText: {
    fontSize: 13, color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid var(--border-strong)',
    borderTopColor: 'var(--gold)',
    animation: 'spin 0.7s linear infinite',
  },
  sections: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  section: {
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  sectionBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '8px 12px',
    background: 'var(--parchment-dark)', border: 'none', cursor: 'pointer',
    textAlign: 'left',
  },
  sectionHeading: {
    fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4,
  },
  sectionBody: {
    padding: '10px 14px 12px',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
  },
  para: {
    margin: '0 0 10px',
    color: 'var(--ink)',
    lineHeight: 1.75,
    fontFamily: "'Georgia', serif",
  },
}
