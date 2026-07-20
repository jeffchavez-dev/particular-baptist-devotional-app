import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSharedNote } from '../lib/noteShare'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

/* ── Scoped styles for rich content rendering ── */
const RICH_STYLES = `
  .pb-rich-note h1 { font-size:1.35em; font-weight:700; margin:0.4em 0 0.2em; font-family:'Cormorant Garamond',serif; }
  .pb-rich-note h2 { font-size:1.1em; font-weight:700; margin:0.4em 0 0.15em; font-family:'Cormorant Garamond',serif; }
  .pb-rich-note p  { margin:0.2em 0; }
  .pb-rich-note ul, .pb-rich-note ol { padding-left:1.4em; margin:0.3em 0; }
  .pb-rich-note li { margin:0.15em 0; padding-left:0.2em; }
  .pb-rich-note blockquote, .pb-rich-note .sc-quote {
    border-left:3px solid #1d6b5a; margin:8px 0; padding:8px 12px;
    background:rgba(29,107,90,0.06); border-radius:0 8px 8px 0;
    font-style:italic; color:#2c2417;
  }
  .pb-rich-note blockquote em, .pb-rich-note .sc-quote em { font-style:normal; }
  .pb-rich-note strong { font-weight:700; }
  .pb-rich-note em { font-style:italic; }
  .pb-rich-note a { color:#1d6b5a; }
`

export default function SharedNotePage() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // 'loading' | 'found' | 'notfound' | 'error'
  const [data,  setData]  = useState(null)

  useEffect(() => {
    if (!token) { setState('notfound'); return }
    getSharedNote(token)
      .then(d  => { setData(d); setState('found') })
      .catch(() => setState('notfound'))
  }, [token])

  /* ── Loading ── */
  if (state === 'loading') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ color:'var(--ink-faint)', fontSize:14 }}>Loading…</div>
        </div>
      </div>
    )
  }

  /* ── Not found ── */
  if (state === 'notfound') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.notFoundIcon}>🔍</div>
          <div style={s.notFoundTitle}>Note not found</div>
          <div style={s.notFoundSub}>This shared note may have been removed or the link is invalid.</div>
          <Link to="/" style={s.homeLink}>← Go to Particular Baptist Devotional</Link>
        </div>
      </div>
    )
  }

  const note      = data.note_data  || {}
  const isQuote   = note.type === 'quote'
  const updatedAt = data.updated_at || note.updatedAt || note.createdAt
  const noteText  = note.text || ''
  const isRich    = noteText.startsWith('<!RICH>')

  // Rich notes are stored as <!RICH>{"title":"…","body":"<html>…",…}
  let richTitle = null
  let richHtml  = null
  if (isRich) {
    try {
      const parsed = JSON.parse(noteText.slice(7))
      richTitle = parsed.title || null
      richHtml  = parsed.body  || ''
    } catch {
      richHtml = noteText.slice(7) // fallback for legacy plain-HTML format
    }
  }

  return (
    <div style={s.page}>
      {isRich && <style>{RICH_STYLES}</style>}

      {/* App branding header */}
      <div style={s.header}>
        <Link to="/" style={s.brandLink}>
          <img src="/pwa-192.png" alt="Particular Baptist Devotional" style={s.brandLogo} />
          <span style={s.brandName}>Particular Baptist Devotional</span>
        </Link>
      </div>

      {/* Note card */}
      <div style={s.card}>
        {/* Book info */}
        {data.book_title && (
          <div style={s.bookInfo}>
            <span style={s.bookIcon}>📖</span>
            <div>
              <div style={s.bookTitle}>{data.book_title}</div>
              {data.book_author && <div style={s.bookAuthor}>{data.book_author}</div>}
            </div>
          </div>
        )}

        {/* Type badge (only for non-rich notes) */}
        {!isRich && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <span style={{
              ...s.typeBadge,
              background: isQuote ? 'rgba(212,168,76,0.12)' : 'rgba(29,107,90,0.1)',
              color:       isQuote ? '#b8860b' : '#1d6b5a',
            }}>
              {isQuote ? '❝ Quote' : '✍ Note'}
            </span>
            {(note.page || note.percent != null) && (
              <span style={s.locLabel}>
                {[note.page && `p. ${note.page}`, note.percent != null && `${note.percent}%`].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* Rich note content */}
        {isRich ? (
          <>
            {richTitle && <div style={s.richTitle}>{richTitle}</div>}
            <div
              className="pb-rich-note"
              style={s.richContent}
              dangerouslySetInnerHTML={{ __html: richHtml }}
            />
          </>
        ) : (
          /* Plain text note */
          <div style={{ ...s.noteText, fontStyle: isQuote ? 'italic' : 'normal' }}>
            {isQuote && <span style={s.openQuote}>"</span>}
            {noteText}
            {isQuote && <span style={s.closeQuote}>"</span>}
          </div>
        )}

        {/* Updated at */}
        {updatedAt && (
          <div style={s.updatedAt}>Last updated {formatDate(updatedAt)}</div>
        )}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <Link to="/" style={s.footerLink}>Made with Particular Baptist Devotional</Link>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--parchment, #faf7f2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px 40px',
  },
  header: {
    width: '100%',
    maxWidth: 600,
    padding: '20px 0 16px',
    borderBottom: '1px solid var(--border, #e8e2d8)',
    marginBottom: 24,
  },
  brandLink: {
    display: 'flex', alignItems: 'center', gap: 10,
    textDecoration: 'none', color: 'inherit',
  },
  brandLogo: { width: 32, height: 32, borderRadius: 8 },
  brandName: {
    fontSize: 16, fontWeight: 700,
    fontFamily: "'Cormorant Garamond', serif",
    color: 'var(--ink, #2c2417)',
  },
  card: {
    width: '100%', maxWidth: 600,
    background: 'var(--surface, white)',
    border: '1px solid var(--border, #e8e2d8)',
    borderRadius: 16, padding: '24px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  bookInfo: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '0 0 16px',
    borderBottom: '1px solid var(--border, #e8e2d8)',
    marginBottom: 8,
  },
  bookIcon: { fontSize: 20, flexShrink: 0, marginTop: 1 },
  bookTitle: {
    fontSize: 16, fontWeight: 700,
    fontFamily: "'Cormorant Garamond', serif",
    color: 'var(--ink, #2c2417)',
  },
  bookAuthor: { fontSize: 12, color: 'var(--ink-faint, #9c8c72)', marginTop: 2 },
  typeBadge: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px',
    borderRadius: 99, letterSpacing: '0.03em',
  },
  locLabel: { fontSize: 11, color: 'var(--ink-faint, #9c8c72)' },
  noteText: {
    fontSize: 17, lineHeight: 1.75,
    fontFamily: "'Cormorant Garamond', serif",
    color: 'var(--ink, #2c2417)',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    padding: '8px 0',
  },
  richTitle: {
    fontSize: 20, fontWeight: 700,
    fontFamily: "'Cormorant Garamond', serif",
    color: 'var(--ink, #2c2417)',
    marginBottom: 12,
  },
  richContent: {
    fontSize: 16, lineHeight: 1.8,
    fontFamily: "'Cormorant Garamond', serif",
    color: 'var(--ink, #2c2417)',
    wordBreak: 'break-word',
  },
  openQuote:  { fontSize: 28, color: '#d4a84c', lineHeight: 1, marginRight: 2, fontFamily: 'Georgia, serif' },
  closeQuote: { fontSize: 28, color: '#d4a84c', lineHeight: 1, marginLeft:  2, fontFamily: 'Georgia, serif' },
  updatedAt: { fontSize: 11, color: 'var(--ink-faint, #9c8c72)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, #e8e2d8)' },
  notFoundIcon:  { fontSize: 40, textAlign: 'center' },
  notFoundTitle: { fontSize: 18, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: 'var(--ink, #2c2417)', textAlign: 'center' },
  notFoundSub:   { fontSize: 13, color: 'var(--ink-faint, #9c8c72)', textAlign: 'center', lineHeight: 1.6 },
  homeLink: { fontSize: 13, color: '#1d6b5a', textDecoration: 'none', textAlign: 'center', marginTop: 8 },
  footer: { marginTop: 24 },
  footerLink: { fontSize: 12, color: 'var(--ink-faint, #9c8c72)', textDecoration: 'none' },
}
