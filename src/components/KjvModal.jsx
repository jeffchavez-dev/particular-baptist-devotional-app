import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchKjvChapter } from './KjvReader'

/**
 * KjvModal — inline popup for reading a KJV chapter directly from any page.
 *
 * Props:
 *   book       string      — full book name, e.g. "Romans"
 *   chapter    number      — chapter number
 *   verse      number|null — specific verse to scroll to on open (optional)
 *   refDisplay string      — original ref string shown in header, e.g. "Rom 8:28"
 *   onClose    fn          — called when user dismisses the modal
 */
export default function KjvModal({ book, chapter, verse, refDisplay, onClose }) {
  const navigate   = useNavigate()
  const [verses,   setVerses]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const bodyRef    = useRef(null)

  /* Load chapter */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchKjvChapter(book, chapter)
      .then(v => { if (!cancelled) { setVerses(v); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [book, chapter])

  /* Scroll to target verse after verses load */
  useEffect(() => {
    if (loading || !verse || !bodyRef.current) return
    // Small delay to let the DOM render the verse list
    const t = setTimeout(() => {
      const el = bodyRef.current?.querySelector(`#mv${verse}`)
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
        // Nudge up slightly so the verse number isn't cut off by padding
        if (bodyRef.current) bodyRef.current.scrollTop -= 12
      }
    }, 60)
    return () => clearTimeout(t)
  }, [loading, verse])

  /* Close on Escape */
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* Lock body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function goToScripture() {
    try {
      sessionStorage.setItem('kjv-book', book)
      sessionStorage.setItem('kjv-chapter', String(chapter))
    } catch {}
    onClose()
    navigate('/scripture')
  }

  return (
    <div style={m.backdrop} onClick={onClose}>
      <div style={m.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={m.header}>
          <div style={m.headerLeft}>
            <span style={m.bookLabel}>{book} {chapter}</span>
            {refDisplay && refDisplay !== `${book} ${chapter}` && (
              <span style={m.refLabel}>{refDisplay}</span>
            )}
            <span style={m.kjvBadge}>KJV</span>
          </div>
          <div style={m.headerRight}>
            <button style={m.goBtn} onClick={goToScripture} title="Open in Scripture reader">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M3 10L10 3M10 3H6M10 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Open in Scripture
            </button>
            <button style={m.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={m.body} ref={bodyRef}>
          {loading && (
            <div style={m.center}>
              <div className="spinner" />
              <p style={{color:'var(--ink-muted)',fontSize:14,marginTop:12}}>Loading {book} {chapter}…</p>
            </div>
          )}
          {error && !loading && (
            <div style={m.center}>
              <p style={{color:'var(--ink-muted)',fontSize:14}}>{error}</p>
            </div>
          )}
          {!loading && !error && verses.length > 0 && (
            <div style={m.verseList}>
              {verses.map(({ verse: v, text }) => (
                <div
                  key={v}
                  id={`mv${v}`}
                  style={{
                    ...m.verseRow,
                    ...(verse && v === verse ? m.verseHighlight : {}),
                  }}
                >
                  <span style={m.verseNum}>{v}</span>
                  <span style={m.verseText}>{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

const m = {
  backdrop: {
    position:'fixed', inset:0, zIndex:1000,
    background:'rgba(0,0,0,0.55)', backdropFilter:'blur(2px)',
    display:'flex', alignItems:'flex-end', justifyContent:'center',
    padding:'0',
  },
  panel: {
    width:'100%', maxWidth:680,
    background:'var(--surface)',
    borderRadius:'16px 16px 0 0',
    boxShadow:'0 -8px 40px rgba(0,0,0,0.2)',
    display:'flex', flexDirection:'column',
    maxHeight:'82vh',
    fontFamily:"'DM Sans',sans-serif",
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px 12px', borderBottom:'1px solid var(--border)',
    flexShrink:0, gap:8, flexWrap:'wrap',
  },
  headerLeft: { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1, minWidth:0 },
  headerRight: { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  bookLabel: {
    fontSize:16, fontWeight:700,
    fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  refLabel: { fontSize:12, color:'var(--ink-faint)' },
  kjvBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.08em',
    background:'var(--gold-faint)', color:'var(--gold)',
    padding:'2px 6px', borderRadius:99,
  },
  goBtn: {
    display:'flex', alignItems:'center', gap:5,
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'var(--teal-light)', border:'none',
    borderRadius:99, padding:'5px 10px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif",
  },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', padding:4,
  },
  body: {
    flex:1, overflowY:'auto', padding:'16px',
  },
  center: {
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    padding:'3rem', gap:8,
  },
  verseList: { display:'flex', flexDirection:'column', gap:2 },
  verseRow: {
    display:'flex', gap:10, padding:'3px 0', lineHeight:1.8,
    borderRadius:4,
  },
  verseHighlight: {
    background:'var(--teal-light)',
    marginLeft:-6, paddingLeft:6,
    marginRight:-6, paddingRight:6,
    borderLeft:'2px solid var(--teal)',
  },
  verseNum: {
    fontSize:10, fontWeight:700, color:'var(--teal)',
    minWidth:20, paddingTop:5, flexShrink:0,
    fontVariantNumeric:'tabular-nums',
  },
  verseText: {
    fontSize:15, color:'var(--ink)', lineHeight:1.85,
    fontFamily:"'Georgia','Times New Roman',serif",
  },
}
