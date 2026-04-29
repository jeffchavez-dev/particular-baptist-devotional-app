import React, { useEffect } from 'react'

const SRC_META = {
  '2LBCF':    { badge:'#3d2b6b', badgeText:'#c4a8ff', fullName:'2nd London Baptist Confession (1689)' },
  'Catechism':{ badge:'#1a3a38', badgeText:'#7ecfc8', fullName:"Keach's Catechism (1693)" },
  '1LBCF':    { badge:'#4a2e0a', badgeText:'#d4a84c', fullName:'1st London Baptist Confession (1644)' },
  'Orthodox': { badge:'#0c4a6e', badgeText:'#bae6fd', fullName:'An Orthodox Catechism (1680)' },
}

/**
 * ConfessionModal — bottom-sheet popup showing a confession/catechism paragraph.
 *
 * Props:
 *   src      — '2LBCF' | '1LBCF' | 'Catechism' | 'Orthodox'
 *   label    — section label, e.g. "Ch. 1 §3" or "Q&A #7"
 *   text     — body text
 *   refs     — proof text string (raw)
 *   onClose  — fn called to dismiss
 *   onGoTo   — optional fn called to navigate to this item in ConfessionsPage
 */
export default function ConfessionModal({ src, label, text, refs, onClose, onGoTo }) {
  const meta = SRC_META[src] || { badge:'#333', badgeText:'#fff', fullName: src }

  /* Escape key */
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* Body scroll lock */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div style={m.backdrop} onClick={onClose}>
      <div style={m.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={m.header}>
          <div style={m.headerLeft}>
            <span style={{ ...m.srcBadge, background: meta.badge, color: meta.badgeText }}>
              {src}
            </span>
            <div style={m.headerTitles}>
              <span style={m.labelText}>{label}</span>
              <span style={m.srcName}>{meta.fullName}</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {onGoTo && (
              <button
                style={m.goToBtn}
                onClick={() => { onGoTo(); onClose() }}
                title="View in Confessions page"
                aria-label="View in Confessions page"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
                  <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 4h6M3 6.5h4M3 9h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                View in Confessions
              </button>
            )}
            <button style={m.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={m.body}>
          {text.split(/\n+/).map((para, i) => (
            <p key={i} style={{ ...m.confText, marginBottom: i < text.split(/\n+/).length - 1 ? '0.8em' : 0 }}>
              {para}
            </p>
          ))}
          {refs && (
            <div style={m.refsBlock}>
              <div style={m.refsLabel}>Scripture Proofs</div>
              <p style={m.refsText}>{refs}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

const m = {
  backdrop: {
    position:'fixed', inset:0, zIndex:1100,
    background:'rgba(0,0,0,0.55)', backdropFilter:'blur(2px)',
    display:'flex', alignItems:'flex-end', justifyContent:'center',
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
    flexShrink:0, gap:10,
  },
  headerLeft: {
    display:'flex', alignItems:'flex-start', gap:10, flex:1, minWidth:0,
  },
  srcBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.08em',
    padding:'3px 7px', borderRadius:99, flexShrink:0, marginTop:3,
  },
  headerTitles: {
    display:'flex', flexDirection:'column', gap:2, minWidth:0,
  },
  labelText: {
    fontSize:15, fontWeight:700,
    fontFamily:"'Cormorant Garamond',serif", color:'var(--ink)',
  },
  srcName: {
    fontSize:11, color:'var(--ink-faint)',
  },
  goToBtn: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:11, fontWeight:600, padding:'5px 10px',
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:'var(--radius)', cursor:'pointer', color:'var(--ink-muted)',
    fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
    transition:'background 0.12s',
  },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', padding:4, flexShrink:0,
  },
  body: {
    flex:1, overflowY:'auto', padding:'20px 16px',
  },
  confText: {
    fontSize:15, lineHeight:1.85, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif",
    margin:0,
  },
  refsBlock: {
    marginTop:18, paddingTop:14,
    borderTop:'1px solid var(--border)',
  },
  refsLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:6,
  },
  refsText: {
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.7, margin:0,
  },
}
