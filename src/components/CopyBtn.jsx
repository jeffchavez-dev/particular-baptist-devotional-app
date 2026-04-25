import React, { useState, useRef } from 'react'

export default function CopyBtn({ getText, label = 'Copy', title = 'Copy to clipboard' }) {
  const [copied, setCopied] = useState(false)
  const timeout = useRef(null)

  function doCopy() {
    const text = getText()
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setCopied(false), 1200)
  }

  const iconOnly = label === ''

  return (
    <button
      onClick={doCopy}
      className={iconOnly ? undefined : 'btn btn-ghost'}
      style={iconOnly
        ? { display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color: copied ? 'var(--teal)' : 'var(--ink-muted)', background: copied ? 'var(--teal-light)' : 'var(--parchment)', border: copied ? '1px solid var(--teal)' : '1px solid var(--border)', borderRadius:99, padding:'6px 8px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s' }
        : { fontSize:13, gap:5, padding:'5px 10px' }
      }
      title={title}
    >
      {copied ? (
        <svg width={iconOnly ? 13 : 13} height={iconOnly ? 13 : 13} viewBox="0 0 13 13" fill="none">
          <polyline points="2,7 5,10 11,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="1" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M4 4V2.5a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      )}
      {!iconOnly && (copied ? 'Copied!' : label)}
    </button>
  )
}
