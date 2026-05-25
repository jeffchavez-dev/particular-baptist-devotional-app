import React, { useState, useEffect, useRef, useCallback } from 'react'
import { generateId, getAllBooks, saveBook, deleteBook, searchBookCovers } from '../lib/bookLibrary'
import { useAuth } from '../App'
import BookCelebration from './BookCelebration'
import { getMemorizeNote, setMemorizeNote } from '../lib/memorize'
import ShareCardModal from './ShareCardModal'
import { shareNote, syncSharedNote, unshareNote, noteShareUrl } from '../lib/noteShare'

/* ── Logo preloader (shared cache) ── */
let _logoImg = null
function getLogoImg() {
  return new Promise(resolve => {
    if (_logoImg) { resolve(_logoImg); return }
    const img = new Image()
    img.onload  = () => { _logoImg = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = '/pwa-192.png'
  })
}

/*
  Book: { id, title, author, isEbook, totalPages, coverUrl, coverData, addedAt, notes[], completed, labels[] }
  Note: { id, type ('note'|'quote'), text, page, percent, createdAt, updatedAt }
*/

/* Inject spinner keyframes once */
;(function injectSpinKf() {
  const id = 'bl-spin-kf'
  if (document.getElementById(id)) return
  const s = document.createElement('style')
  s.id = id
  s.textContent = '@keyframes spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(s)
})()

/* ── Date helpers ───────────────────────────────────────────────────────────── */

/** ISO string → "YYYY-MM-DD" for <input type="date"> */
function isoToDateInput(iso) {
  if (!iso) return ''
  return (iso.length > 10 ? iso : iso + 'T12:00:00').split('T')[0]
}

/** "YYYY-MM-DD" from <input type="date"> → full ISO string (local noon to avoid UTC date shift) */
function dateInputToISO(val) {
  if (!val) return new Date().toISOString()
  return new Date(val + 'T12:00:00').toISOString()
}

/** Today as "YYYY-MM-DD" */
function todayDateInput() {
  return new Date().toISOString().split('T')[0]
}

/** Display a date from ISO or YYYY-MM-DD */
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ── AddBookModal ───────────────────────────────────────────────────────────── */

function AddBookModal({ book, onSave, onClose }) {
  const [title, setTitle] = useState(book?.title || '')
  const [author, setAuthor] = useState(book?.author || '')
  const [isEbook, setIsEbook] = useState(book?.isEbook ?? false)
  const [totalPages, setTotalPages] = useState(book?.totalPages ? String(book.totalPages) : '')
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl || '')
  const [coverData, setCoverData] = useState(book?.coverData || null)
  const [coverSuggestions, setCoverSuggestions] = useState([])
  const [coverLoading,   setCoverLoading]   = useState(false)
  const [fetchingCover,  setFetchingCover]  = useState(false) // converting selected suggestion to base64
  const [searchTouched, setSearchTouched] = useState(false)
  const [selectedCoverId, setSelectedCoverId] = useState(null)
  const [labels, setLabels] = useState(book?.labels || [])
  const [labelInput, setLabelInput] = useState('')
  const [startedAt, setStartedAt] = useState(
    book?.startedAt ? isoToDateInput(book.startedAt) : todayDateInput()
  )
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)
  const debounceRef = useRef(null)

  function addLabel(raw) {
    const tag = raw.trim().toLowerCase().replace(/[,;]+$/, '')
    if (!tag || labels.includes(tag)) { setLabelInput(''); return }
    setLabels(prev => [...prev, tag])
    setLabelInput('')
  }
  function removeLabel(tag) { setLabels(prev => prev.filter(l => l !== tag)) }
  function handleLabelKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(labelInput) }
    if (e.key === 'Backspace' && !labelInput && labels.length) {
      setLabels(prev => prev.slice(0, -1))
    }
  }

  useEffect(() => {
    if (!title.trim()) { setCoverSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchTouched(true)
      setCoverLoading(true)
      const results = await searchBookCovers(title, author)
      setCoverSuggestions(results)
      setCoverLoading(false)
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [title, author])

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCoverData(ev.target.result)
      setCoverUrl('')
      setSelectedCoverId(null)
    }
    reader.readAsDataURL(file)
  }

  /* Fetch the chosen Google Books cover and convert to base64 so it is
     stored locally and works offline (just like a manually uploaded image).
     Falls back to storing the URL only if CORS/network prevents the fetch. */
  async function handleSelectSuggestion(suggestion) {
    setSelectedCoverId(suggestion.id)
    setFetchingCover(true)
    try {
      const res = await fetch(suggestion.coverUrl, { mode: 'cors' })
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      setCoverData(dataUrl)
      setCoverUrl('')
    } catch {
      /* CORS or offline — store URL as best-effort; image won't show offline */
      setCoverUrl(suggestion.coverUrl)
      setCoverData(null)
    } finally {
      setFetchingCover(false)
    }
  }

  function handleSave() {
    setSaveError('')
    const t = title.trim()
    if (!t) { setSaveError('Please enter a book title.'); return }
    try {
      const bookData = {
        id: book?.id || generateId(),
        title: t,
        author: author.trim(),
        isEbook,
        totalPages: isEbook ? null : (parseInt(totalPages) || null),
        coverUrl,
        coverData,
        addedAt: book?.addedAt || new Date().toISOString(),
        notes: book?.notes || [],
        completed: book?.completed || false,
        completedAt: book?.completedAt || null,
        labels,
        startedAt: startedAt ? dateInputToISO(startedAt) : new Date().toISOString(),
      }
      onSave(bookData)
    } catch (err) {
      setSaveError(err?.message || 'Could not save. Storage may be full.')
    }
  }

  const previewSrc = coverData || coverUrl

  return (
    <div style={addbook.overlay} onClick={onClose}>
      <div style={addbook.modal} onClick={e => e.stopPropagation()}>
        <div style={addbook.header}>
          <span style={addbook.headerTitle}>{book ? 'Edit Book' : 'Add Book'}</span>
          <button style={addbook.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={addbook.body}>
          {/* Cover preview + upload */}
          <div style={addbook.coverRow}>
            <div style={addbook.coverPreview}>
              {previewSrc
                ? <img src={previewSrc} alt="cover" style={addbook.coverImg} />
                : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                )
              }
            </div>
            <div style={{ flex: 1 }}>
              <button style={addbook.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                Upload Cover Image
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              {previewSrc && (
                <button style={addbook.clearCoverBtn} onClick={() => { setCoverData(null); setCoverUrl(''); setSelectedCoverId(null) }}>
                  Remove cover
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={addbook.field}>
            <label style={addbook.label}>Title <span style={{ color: 'var(--teal)' }}>*</span></label>
            <input
              style={{ ...addbook.input, ...(saveError && !title.trim() ? { borderColor: '#e53e3e' } : {}) }}
              value={title}
              onChange={e => { setTitle(e.target.value); setSaveError('') }}
              onInput={e => { setTitle(e.currentTarget.value); setSaveError('') }}
              placeholder="Book title"
              autoFocus
            />
          </div>

          {/* Author */}
          <div style={addbook.field}>
            <label style={addbook.label}>Author</label>
            <input
              style={addbook.input}
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </div>

          {/* Cover suggestions — shown as soon as title is non-empty */}
          {title.trim() && (
            <div style={addbook.field}>
              <div style={addbook.suggestionsHeader}>
                <span style={addbook.label}>
                  {coverLoading
                    ? '🔍 Searching covers…'
                    : coverSuggestions.length > 0
                      ? `Book Covers (${coverSuggestions.length} found)`
                      : searchTouched ? 'No covers found online' : 'Cover Suggestions'}
                </span>
                {coverLoading && (
                  <div style={{ width: 14, height: 14, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                )}
              </div>
              {coverSuggestions.length > 0 && (
                <div style={addbook.suggestionsRow}>
                  {coverSuggestions.map(s => (
                    <button
                      key={s.id}
                      title={`${s.title}${s.authors ? ' — ' + s.authors : ''}`}
                      onClick={() => handleSelectSuggestion(s)}
                      disabled={fetchingCover}
                      style={{
                        ...addbook.suggestionItem,
                        outline: selectedCoverId === s.id ? '2px solid var(--teal)' : '2px solid transparent',
                        opacity: fetchingCover && selectedCoverId !== s.id ? 0.5 : 1,
                      }}
                    >
                      <img src={s.coverUrl} alt={s.title} style={addbook.suggestionImg} />
                      {fetchingCover && selectedCoverId === s.id && (
                        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4 }}>
                          <div style={{ width:16, height:16, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!coverLoading && searchTouched && coverSuggestions.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No covers found online — upload one below.</span>
              )}
            </div>
          )}

          {/* Format toggle */}
          <div style={addbook.field}>
            <label style={addbook.label}>Reading Format</label>
            <div style={addbook.toggleGroup}>
              <button
                style={{ ...addbook.toggleBtn, ...(isEbook ? {} : addbook.toggleBtnActive) }}
                onClick={() => setIsEbook(false)}
              >Physical Pages</button>
              <button
                style={{ ...addbook.toggleBtn, ...(isEbook ? addbook.toggleBtnActive : {}) }}
                onClick={() => setIsEbook(true)}
              >eBook %</button>
            </div>
          </div>

          {!isEbook && (
            <div style={addbook.field}>
              <label style={addbook.label}>Total Pages</label>
              <input
                style={addbook.input}
                type="number"
                min="1"
                value={totalPages}
                onChange={e => setTotalPages(e.target.value)}
                placeholder="e.g. 320"
              />
            </div>
          )}

          {/* Labels */}
          <div style={addbook.field}>
            <label style={addbook.label}>Labels / Tags</label>
            <div style={addbook.labelWrap}>
              {labels.map(tag => (
                <span key={tag} style={addbook.labelChip}>
                  {tag}
                  <button style={addbook.labelChipX} onClick={() => removeLabel(tag)}>×</button>
                </span>
              ))}
              <input
                style={addbook.labelInput}
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onBlur={() => labelInput.trim() && addLabel(labelInput)}
                placeholder={labels.length ? 'Add another…' : 'Type label + Enter'}
              />
            </div>
          </div>

          {/* Start date */}
          <div style={addbook.field}>
            <label style={addbook.label}>Started Reading</label>
            <input
              style={addbook.input}
              type="date"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
            />
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div style={{ padding: '8px 18px', color: '#e53e3e', fontSize: 13, fontWeight: 600, background: 'rgba(229,62,62,0.07)', borderTop: '1px solid rgba(229,62,62,0.15)' }}>
            ⚠ {saveError}
          </div>
        )}

        <div style={addbook.footer}>
          <button style={addbook.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...addbook.saveBtn, ...(!title.trim() ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
            onClick={handleSave}
          >
            {book ? 'Save Changes' : 'Add Book'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── AddNoteModal ───────────────────────────────────────────────────────────── */

function AddNoteModal({ book, note, onSave, onClose }) {
  const [type, setType] = useState(note?.type || 'note')
  const [text, setText] = useState(note?.text || '')
  const [page, setPage] = useState(note?.page != null ? String(note.page) : '')
  const [percent, setPercent] = useState(note?.percent != null ? String(note.percent) : '')
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleSave() {
    if (!text.trim()) return
    onSave({
      type,
      text: text.trim(),
      page: parseInt(page) || null,
      percent: parseFloat(percent) || null,
    })
  }

  return (
    <div style={addnote.overlay} onClick={onClose}>
      <div style={addnote.modal} onClick={e => e.stopPropagation()}>
        <div style={addnote.header}>
          <span style={addnote.headerTitle}>{note ? 'Edit Note' : 'Add Note'}</span>
          <button style={addnote.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={addnote.body}>
          {/* Type toggle */}
          <div style={addnote.field}>
            <label style={addnote.label}>Type</label>
            <div style={addnote.toggleGroup}>
              <button
                style={{ ...addnote.toggleBtn, ...(type === 'note' ? addnote.toggleBtnActive : {}) }}
                onClick={() => setType('note')}
              >✍ Note</button>
              <button
                style={{ ...addnote.toggleBtn, ...(type === 'quote' ? addnote.toggleBtnActive : {}) }}
                onClick={() => setType('quote')}
              >❝ Quote</button>
            </div>
          </div>

          <div style={addnote.field}>
            <label style={addnote.label}>{type === 'quote' ? 'Quote Text' : 'Note Text'}</label>
            <textarea
              ref={textareaRef}
              style={addnote.textarea}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={type === 'quote' ? 'Enter the quote…' : 'Write your note…'}
              rows={5}
            />
          </div>

          {!book.isEbook && (
            <div style={addnote.field}>
              <label style={addnote.label}>Page Number</label>
              <input
                style={addnote.input}
                type="number"
                min="1"
                value={page}
                onChange={e => setPage(e.target.value)}
                placeholder="e.g. 42"
              />
            </div>
          )}

          <div style={addnote.field}>
            <label style={addnote.label}>
              Progress (%)
              {!book.isEbook && <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> — optional</span>}
            </label>
            <input
              style={addnote.input}
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={percent}
              onChange={e => setPercent(e.target.value)}
              placeholder="e.g. 35"
            />
          </div>
        </div>

        <div style={addnote.footer}>
          <button style={addnote.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={addnote.saveBtn} onClick={handleSave} disabled={!text.trim()}>
            {note ? 'Save Changes' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── NoteCard ───────────────────────────────────────────────────────────────── */

function NoteCard({ note, book, onEdit, onDelete, onShare, onShareLink, shareLinkLoading, onCopy, onMemorize }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const isQuote = note.type === 'quote'
  const dateStr = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const locParts = []
  if (note.page) locParts.push(`p. ${note.page}`)
  if (note.percent != null) locParts.push(`${note.percent}%`)

  return (
    <div style={{ ...bnote.card, borderLeftColor: isQuote ? '#d4a84c' : 'var(--teal)' }}>
      <div style={bnote.cardTop}>
        <span style={{ ...bnote.typeBadge, background: isQuote ? 'rgba(212,168,76,0.12)' : 'rgba(0,139,139,0.08)', color: isQuote ? '#b8860b' : 'var(--teal)' }}>
          {isQuote ? '❝ Quote' : '✍ Note'}
        </span>
        {locParts.length > 0 && <span style={bnote.locLabel}>{locParts.join(' · ')}</span>}
        {dateStr && <span style={bnote.dateLabel}>{dateStr}</span>}
        {note.shareToken && (
          <span title={'Shared link active'} style={{ fontSize:11, color:'var(--teal)', marginLeft:4, flexShrink:0 }}>🔗</span>
        )}
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={menuRef}>
          <button style={bnote.menuBtn} onClick={() => setMenuOpen(v => !v)}>
            {shareLinkLoading ? '…' : '⋯'}
          </button>
          {menuOpen && (
            <div style={bnote.menu}>
              <button style={bnote.menuItem} onClick={() => { onCopy(note); setMenuOpen(false) }}>Copy text</button>
              <button style={bnote.menuItem} onClick={() => { onShare(note); setMenuOpen(false) }}>Share image</button>
              {onShareLink && (
                <button style={bnote.menuItem} onClick={() => { onShareLink(note); setMenuOpen(false) }}>
                  {note.shareToken ? 'View share link' : 'Share link'}
                </button>
              )}
              <button style={bnote.menuItem} onClick={() => { onMemorize?.(note); setMenuOpen(false) }}>Memorize</button>
              <button style={bnote.menuItem} onClick={() => { onEdit(note); setMenuOpen(false) }}>Edit</button>
              <button style={{ ...bnote.menuItem, color: '#e53e3e' }} onClick={() => { onDelete(note); setMenuOpen(false) }}>Delete</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ ...bnote.text, fontStyle: isQuote ? 'italic' : 'normal' }}>
        {isQuote && <span style={bnote.openQuote}>”</span>}
        {note.text}
        {isQuote && <span style={bnote.closeQuote}>”</span>}
      </div>
    </div>
  )
}

/* ── ShareLinkModal ─────────────────────────────────────────────────────────── */

function ShareLinkModal({ token, noteId, onUnshare, onClose }) {
  const url = noteShareUrl(token)
  const [copied, setCopied] = useState(false)
  const [unsharing, setUnsharing] = useState(false)
  const [confirmUnshare, setConfirmUnshare] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  async function doUnshare() {
    setUnsharing(true)
    await onUnshare(token, noteId)
    setUnsharing(false)
  }

  return (
    <div style={bmodal.overlay} onClick={onClose}>
      <div style={{ ...bmodal.sheet, maxWidth: 380, gap: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 12px' }}>
          <span style={{ fontSize:15, fontWeight:700, fontFamily:'DM Sans,sans-serif', color:'var(--ink)' }}>
            🔗 Shared link
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--ink-faint)', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          <p style={{ fontSize:12, color:'var(--ink-faint)', margin:0, lineHeight:1.6 }}>
            Anyone with this link can view the note. The link reflects your latest edits automatically.
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
            <div style={{
              flex:1, fontSize:11, color:'var(--ink)', background:'var(--parchment)',
              border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px',
              wordBreak:'break-all', lineHeight:1.5, fontFamily:'monospace',
            }}>
              {url}
            </div>
            <button onClick={copyLink} style={{
              flexShrink:0, padding:'8px 14px', borderRadius:8,
              background: copied ? 'var(--teal)' : 'var(--surface)',
              color: copied ? 'white' : 'var(--ink)',
              border:'1.5px solid var(--border)', cursor:'pointer',
              fontSize:12, fontWeight:600, fontFamily:'DM Sans,sans-serif',
              transition:'all 0.15s', whiteSpace:'nowrap',
            }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {confirmUnshare ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:'var(--ink-faint)', flex:1 }}>Remove this shared link? It will stop working.</span>
              <button
                onClick={doUnshare}
                disabled={unsharing}
                style={{ fontSize:11, fontWeight:600, color:'var(--rose)', background:'var(--rose-light)', border:'1px solid rgba(225,72,72,0.3)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
              >{unsharing ? 'Removing…' : 'Yes, remove'}</button>
              <button onClick={() => setConfirmUnshare(false)} style={{ fontSize:11, fontWeight:600, color:'var(--ink-faint)', background:'var(--parchment)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmUnshare(true)}
              style={{ fontSize:11, fontWeight:600, color:'var(--rose)', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}
            >
              Remove shared link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── BookCard ───────────────────────────────────────────────────────────────── */

function BookCard({ book, onClick, onEdit, onDelete }) {
  const noteCount = book.notes?.length || 0
  const progress = book.isEbook
    ? (book.notes?.filter(n => n.percent != null).reduce((max, n) => Math.max(max, n.percent), 0) || null)
    : (book.totalPages && book.notes?.filter(n => n.page).length
        ? Math.round((Math.max(...book.notes.filter(n => n.page).map(n => n.page)) / book.totalPages) * 100)
        : null)

  const previewSrc = book.coverData || book.coverUrl

  return (
    <div style={bcard.card} onClick={onClick}>
      <div style={bcard.coverWrap}>
        {previewSrc
          ? <img src={previewSrc} alt={book.title} style={bcard.coverImg} />
          : (
            <div style={bcard.coverPlaceholder}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.3">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
          )
        }
        {noteCount > 0 && (
          <span style={bcard.noteBadge}>{noteCount}</span>
        )}
        {book.completed && (
          <span style={bcard.completedBadge}>✓</span>
        )}
      </div>
      <div style={bcard.info}>
        <div style={bcard.title}>{book.title}</div>
        {book.author && <div style={bcard.author}>{book.author}</div>}
        {book.labels?.length > 0 && (
          <div style={bcard.labelsRow}>
            {book.labels.slice(0, 2).map(l => (
              <span key={l} style={bcard.labelPill}>{l}</span>
            ))}
            {book.labels.length > 2 && <span style={bcard.labelPill}>+{book.labels.length - 2}</span>}
          </div>
        )}
        {!book.completed && progress != null && (
          <div style={bcard.progressWrap}>
            <div style={bcard.progressTrack}>
              <div style={{ ...bcard.progressFill, width: `${Math.min(100, progress)}%` }} />
            </div>
            <span style={bcard.progressLabel}>{progress}%</span>
          </div>
        )}
        {book.completed && book.completedAt && (
          <div style={bcard.dateLabel}>✅ {formatDate(book.completedAt)}</div>
        )}
        {!book.completed && book.startedAt && (
          <div style={bcard.dateLabel}>📅 {formatDate(book.startedAt)}</div>
        )}
        <div style={bcard.actions} onClick={e => e.stopPropagation()}>
          <button style={bcard.actionBtn} onClick={onEdit}>Edit</button>
          <button style={{ ...bcard.actionBtn, color: '#e53e3e' }} onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ── BookDetail ─────────────────────────────────────────────────────────────── */

function BookDetail({ book: initialBook, onBack, onChange, searchQuery, userId }) {
  const [book, setBook] = useState(initialBook)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [editNote, setEditNote] = useState(null)
  const [shareCard, setShareCard] = useState(null)
  const [shareLink, setShareLink] = useState(null) // { token, noteId } | null
  const [shareLinkLoading, setShareLinkLoading] = useState(false)
  const [deleteNote, setDeleteNote] = useState(null)
  const [celebrating, setCelebrating] = useState(false)
  const [memorizeConfirm, setMemorizeConfirm] = useState(null) // { incoming, existing } | null

  // Sync when initialBook prop changes
  useEffect(() => { setBook(initialBook) }, [initialBook])

  const notes = (book.notes || []).slice().sort((a, b) => {
    const da = new Date(a.createdAt || 0)
    const db = new Date(b.createdAt || 0)
    return db - da
  })

  const filteredNotes = searchQuery
    ? notes.filter(n => n.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes

  const progress = book.isEbook
    ? (notes.filter(n => n.percent != null).reduce((max, n) => Math.max(max, n.percent), 0) || null)
    : (book.totalPages && notes.filter(n => n.page).length
        ? Math.round((Math.max(...notes.filter(n => n.page).map(n => n.page)) / book.totalPages) * 100)
        : null)

  function mutateBook(updatedBook) {
    saveBook(updatedBook, userId)
    setBook(updatedBook)
    onChange(updatedBook)
  }

  function handleMemorize(note) {
    const incoming = {
      noteId: note.id,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author || '',
      type: note.type,
      text: note.text,
      page: note.page || null,
      percent: note.percent != null ? note.percent : null,
    }
    const existing = getMemorizeNote()
    if (existing) {
      setMemorizeConfirm({ incoming, existing })
    } else {
      setMemorizeNote(incoming)
    }
  }

  /** Returns 0–100 progress for a book object based on its notes */
  function computeBookProgress(b) {
    const ns = b.notes || []
    if (b.isEbook) {
      const maxPct = ns.filter(n => n.percent != null).reduce((mx, n) => Math.max(mx, n.percent), 0)
      return maxPct
    }
    if (b.totalPages && ns.some(n => n.page)) {
      const maxPage = Math.max(...ns.filter(n => n.page).map(n => n.page))
      return Math.round((maxPage / b.totalPages) * 100)
    }
    return 0
  }

  /** After a note mutation, check if progress hit 100% and auto-complete */
  function checkAutoComplete(updated) {
    if (updated.completed) return updated // already done
    const pct = computeBookProgress(updated)
    if (pct >= 100) {
      const autoCompleted = { ...updated, completed: true, completedAt: new Date().toISOString() }
      mutateBook(autoCompleted)
      setCelebrating(true)
      return autoCompleted
    }
    return updated
  }

  function toggleCompleted() {
    const nowCompleted = !book.completed
    const updated = {
      ...book,
      completed: nowCompleted,
      completedAt: nowCompleted ? new Date().toISOString() : null,
    }
    mutateBook(updated)
    if (nowCompleted) setCelebrating(true)
  }

  function handleAddNote(noteData) {
    const newNote = {
      id: generateId(),
      ...noteData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = { ...book, notes: [newNote, ...(book.notes || [])] }
    // mutateBook first so UI reflects the new note regardless of auto-complete
    mutateBook(updated)
    setAddNoteOpen(false)
    checkAutoComplete(updated)
  }

  function handleEditNote(noteData) {
    const updatedNote = { ...editNote, ...noteData, updatedAt: new Date().toISOString() }
    const updatedNotes = (book.notes || []).map(n => n.id === editNote.id ? updatedNote : n)
    const updated = { ...book, notes: updatedNotes }
    mutateBook(updated)
    setEditNote(null)
    // Keep shared link in sync if note was shared
    if (updatedNote.shareToken && userId) {
      syncSharedNote({ note: updatedNote, book, userId }).catch(() => {})
    }
    checkAutoComplete(updated)
  }

  function handleDeleteNote(note) {
    const updatedNotes = (book.notes || []).filter(n => n.id !== note.id)
    const updated = { ...book, notes: updatedNotes }
    mutateBook(updated)
    // Remove share from Supabase if it had one
    if (note.shareToken && userId) {
      unshareNote({ token: note.shareToken, userId }).catch(() => {})
    }
    setDeleteNote(null)
  }

  async function handleShareLink(note) {
    if (!userId) return
    // If already shared just show the link
    if (note.shareToken) {
      setShareLink({ token: note.shareToken, noteId: note.id })
      return
    }
    setShareLinkLoading(note.id)
    try {
      const token = await shareNote({ note, book, userId })
      // Persist the shareToken on the note
      const updatedNote = { ...note, shareToken: token }
      const updatedNotes = (book.notes || []).map(n => n.id === note.id ? updatedNote : n)
      const updated = { ...book, notes: updatedNotes }
      mutateBook(updated)
      setShareLink({ token, noteId: note.id })
    } catch (e) {
      console.error('[shareLink]', e)
    } finally {
      setShareLinkLoading(null)
    }
  }

  async function handleUnshare(token, noteId) {
    if (!userId) return
    try {
      await unshareNote({ token, userId })
      // Remove shareToken from note
      const updatedNotes = (book.notes || []).map(n =>
        n.id === noteId ? (() => { const { shareToken: _, ...rest } = n; return rest })() : n
      )
      mutateBook({ ...book, notes: updatedNotes })
      setShareLink(null)
    } catch (e) {
      console.error('[unshare]', e)
    }
  }

  function handleCopy(note) {
    navigator.clipboard.writeText(note.text).catch(() => {})
  }

  const previewSrc = book.coverData || book.coverUrl

  return (
    <div style={bdetail.wrap}>
      <button style={bdetail.backBtn} onClick={onBack}>
        ← Back to Books
      </button>

      <div style={bdetail.bookHeader}>
        <div style={bdetail.coverWrap}>
          {previewSrc
            ? <img src={previewSrc} alt={book.title} style={bdetail.coverImg} />
            : (
              <div style={bdetail.coverPlaceholder}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M9 21V9"/>
                </svg>
              </div>
            )
          }
        </div>
        <div style={bdetail.bookInfo}>
          <h2 style={bdetail.bookTitle}>{book.title}</h2>
          {book.author && <div style={bdetail.bookAuthor}>{book.author}</div>}
          {book.totalPages && !book.isEbook && <div style={bdetail.bookMeta}>{book.totalPages} pages</div>}
          {book.labels?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {book.labels.map(l => (
                <span key={l} style={bdetail.labelPill}>{l}</span>
              ))}
            </div>
          )}
          {!book.completed && progress != null && (
            <div style={bdetail.progressWrap}>
              <div style={bdetail.progressTrack}>
                <div style={{ ...bdetail.progressFill, width: `${Math.min(100, progress)}%` }} />
              </div>
              <span style={bdetail.progressLabel}>{progress}% complete</span>
            </div>
          )}
          <div style={bdetail.noteMeta}>{notes.length} note{notes.length !== 1 ? 's' : ''}</div>
          {/* Date row */}
          <div style={bdetail.dateRow}>
            {book.startedAt && (
              <span style={bdetail.datePill}>
                📅 Started {formatDate(book.startedAt)}
              </span>
            )}
            {book.completedAt && (
              <span style={{ ...bdetail.datePill, color: '#38a169' }}>
                ✅ Finished {formatDate(book.completedAt)}
              </span>
            )}
          </div>
          <button
            style={book.completed ? bdetail.completedBtn : bdetail.markFinishedBtn}
            onClick={toggleCompleted}
          >
            {book.completed ? '↩ Mark as Reading' : '✓ Mark as Finished'}
          </button>
        </div>
      </div>

      <div style={bdetail.notesHeader}>
        <span style={bdetail.notesTitle}>Notes &amp; Quotes</span>
        <button style={bdetail.addNoteBtn} onClick={() => setAddNoteOpen(true)}>+ Add Note</button>
      </div>

      {filteredNotes.length === 0
        ? (
          <div style={bdetail.emptyState}>
            <span style={{ fontSize: 32 }}>✍</span>
            <div style={bdetail.emptyTitle}>No notes yet</div>
            <div style={bdetail.emptySub}>
              {searchQuery ? 'No notes match your search.' : 'Add your first note or quote from this book.'}
            </div>
          </div>
        )
        : filteredNotes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            book={book}
            onEdit={setEditNote}
            onDelete={setDeleteNote}
            onShare={note => setShareCard({
                type:          note.type === 'quote' ? 'book_quote' : 'book_note',
                noteType:      note.type,
                text:          note.text,
                bookTitle:     book.title,
                bookAuthor:    book.author,
                bookLabels:    book.labels,
                bookCoverData: book.coverData,
                bookCoverUrl:  book.coverUrl,
                page:          note.page,
                percent:       note.percent,
              })}
            onShareLink={userId ? handleShareLink : null}
            shareLinkLoading={shareLinkLoading === note.id}
            onCopy={handleCopy}
            onMemorize={handleMemorize}
          />
        ))
      }

      {addNoteOpen && (
        <AddNoteModal book={book} note={null} onSave={handleAddNote} onClose={() => setAddNoteOpen(false)} />
      )}
      {editNote && (
        <AddNoteModal book={book} note={editNote} onSave={handleEditNote} onClose={() => setEditNote(null)} />
      )}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />
      {shareLink && (
        <ShareLinkModal
          token={shareLink.token}
          noteId={shareLink.noteId}
          onUnshare={handleUnshare}
          onClose={() => setShareLink(null)}
        />
      )}
      {deleteNote && (
        <div style={bmodal.overlay} onClick={() => setDeleteNote(null)}>
          <div style={bmodal.sheet} onClick={e => e.stopPropagation()}>
            <div style={bmodal.confirmTitle}>Delete Note?</div>
            <div style={bmodal.confirmSub}>This cannot be undone.</div>
            <div style={bmodal.confirmActions}>
              <button style={bmodal.cancelBtn} onClick={() => setDeleteNote(null)}>Cancel</button>
              <button style={bmodal.deleteBtn} onClick={() => handleDeleteNote(deleteNote)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {memorizeConfirm && (
        <div style={bmodal.overlay} onClick={() => setMemorizeConfirm(null)}>
          <div style={{ ...bmodal.sheet, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={bmodal.confirmTitle}>Replace memory note?</div>
            <div style={{ padding:'0 16px 12px', borderBottom:'1px solid var(--border)' }}>
              <p style={{ fontSize:12, color:'var(--ink-muted)', margin:'0 0 4px' }}>Current ({memorizeConfirm.existing.type}):</p>
              <p style={{ fontSize:13, color:'var(--ink)', margin:'0 0 2px', fontStyle: memorizeConfirm.existing.type === 'quote' ? 'italic' : 'normal',
                display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {memorizeConfirm.existing.type === 'quote' ? `"${memorizeConfirm.existing.text}"` : memorizeConfirm.existing.text}
              </p>
              <p style={{ fontSize:11, color:'var(--teal)', margin:0 }}>— {memorizeConfirm.existing.bookTitle}</p>
            </div>
            <div style={{ padding:'12px 16px 4px' }}>
              <p style={{ fontSize:12, color:'var(--ink-muted)', margin:'0 0 4px' }}>Replace with ({memorizeConfirm.incoming.type}):</p>
              <p style={{ fontSize:13, color:'var(--ink)', margin:'0 0 2px', fontStyle: memorizeConfirm.incoming.type === 'quote' ? 'italic' : 'normal',
                display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {memorizeConfirm.incoming.type === 'quote' ? `"${memorizeConfirm.incoming.text}"` : memorizeConfirm.incoming.text}
              </p>
              <p style={{ fontSize:11, color:'var(--teal)', margin:'0 0 12px' }}>— {memorizeConfirm.incoming.bookTitle}</p>
            </div>
            <div style={bmodal.confirmActions}>
              <button style={bmodal.cancelBtn} onClick={() => setMemorizeConfirm(null)}>Cancel</button>
              <button
                style={{ ...bmodal.deleteBtn, background:'var(--teal)', borderColor:'var(--teal)' }}
                onClick={() => { setMemorizeNote(memorizeConfirm.incoming); setMemorizeConfirm(null) }}
              >Replace</button>
            </div>
          </div>
        </div>
      )}
      {celebrating && (
        <BookCelebration bookName={book.title} onClose={() => setCelebrating(false)} />
      )}
    </div>
  )
}

/* ── BookLibraryTab (default export) ────────────────────────────────────────── */

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'title',  label: 'Title A–Z' },
  { id: 'author', label: 'Author A–Z' },
]

export default function BookLibraryTab({ searchQuery }) {
  const { session } = useAuth()
  const userId = session?.user?.id || null
  const [books, setBooks] = useState(() => getAllBooks())
  const [view, setView] = useState('list')
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [editBook, setEditBook] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [sortBy, setSortBy] = useState('newest')
  const [filterLabel, setFilterLabel] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)

  useEffect(() => {
    const handler = () => setBooks(getAllBooks())
    window.addEventListener('pb-book-library-updated', handler)
    return () => window.removeEventListener('pb-book-library-updated', handler)
  }, [])

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    function handler(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  const bookList = Object.values(books).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.addedAt || 0) - new Date(a.addedAt || 0)
    if (sortBy === 'oldest') return new Date(a.addedAt || 0) - new Date(b.addedAt || 0)
    if (sortBy === 'title')  return (a.title || '').localeCompare(b.title || '')
    if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '')
    return 0
  })

  // Collect all unique labels across all books
  const allLabels = [...new Set(bookList.flatMap(b => b.labels || []))]

  const searchFiltered = searchQuery
    ? bookList.filter(b =>
        b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.notes || []).some(n => n.text?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : bookList

  const filteredBooks = filterLabel
    ? searchFiltered.filter(b => (b.labels || []).includes(filterLabel))
    : searchFiltered

  const inProgressBooks = filteredBooks.filter(b => !b.completed)
  const completedBooks  = filteredBooks.filter(b => b.completed)

  const selectedBook = selectedBookId ? books[selectedBookId] : null

  if (view === 'detail' && selectedBook) {
    return (
      <BookDetail
        book={selectedBook}
        onBack={() => { setView('list'); setSelectedBookId(null) }}
        onChange={(updatedBook) => setBooks(getAllBooks())}
        searchQuery={searchQuery}
        userId={userId}
      />
    )
  }

  function handleSaveBook(bookData) {
    saveBook(bookData, userId)
    setBooks(getAllBooks())
    setAddBookOpen(false)
    setEditBook(null)
  }

  function handleDeleteBook(book) {
    deleteBook(book.id, userId)
    setBooks(getAllBooks())
    setDeleteConfirm(null)
  }

  const sortLabel = SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Sort'

  function renderGrid(bookArr) {
    return (
      <div style={blt.grid}>
        {bookArr.map(book => (
          <BookCard
            key={book.id}
            book={book}
            onClick={() => { setSelectedBookId(book.id); setView('detail') }}
            onEdit={(e) => { e.stopPropagation(); setEditBook(book) }}
            onDelete={(e) => { e.stopPropagation(); setDeleteConfirm(book) }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={blt.wrap}>
      {/* Toolbar */}
      <div style={blt.toolbar}>
        <span style={blt.bookCount}>
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Sort dropdown */}
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button style={blt.sortBtn} onClick={() => setSortOpen(v => !v)}>
              ↕ {sortLabel}
            </button>
            {sortOpen && (
              <div style={blt.sortMenu}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    style={{ ...blt.sortMenuItem, ...(sortBy === opt.id ? blt.sortMenuItemActive : {}) }}
                    onClick={() => { setSortBy(opt.id); setSortOpen(false) }}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>
          <button style={blt.addBtn} onClick={() => setAddBookOpen(true)}>+ Add Book</button>
        </div>
      </div>

      {/* Label filter chips */}
      {allLabels.length > 0 && (
        <div style={blt.labelBar}>
          <button
            style={{ ...blt.labelChip, ...(filterLabel === null ? blt.labelChipActive : {}) }}
            onClick={() => setFilterLabel(null)}
          >All</button>
          {allLabels.map(l => (
            <button
              key={l}
              style={{ ...blt.labelChip, ...(filterLabel === l ? blt.labelChipActive : {}) }}
              onClick={() => setFilterLabel(filterLabel === l ? null : l)}
            >{l}</button>
          ))}
        </div>
      )}

      {filteredBooks.length === 0
        ? (
          <div style={blt.emptyState}>
            <span style={{ fontSize: 48 }}>📚</span>
            <div style={blt.emptyTitle}>Your Book Library</div>
            <div style={blt.emptySub}>
              {searchQuery || filterLabel
                ? 'No books match your filter.'
                : 'Track books you\'re reading, save quotes, and write notes.'}
            </div>
            {!searchQuery && !filterLabel && (
              <button style={blt.emptyBtn} onClick={() => setAddBookOpen(true)}>Add Your First Book</button>
            )}
          </div>
        )
        : (
          <>
            {/* In Progress section */}
            {inProgressBooks.length > 0 && (
              <>
                {completedBooks.length > 0 && (
                  <div style={blt.sectionHeader}>
                    <span style={blt.sectionIcon}>📖</span>
                    <span style={blt.sectionTitle}>In Progress</span>
                    <span style={blt.sectionCount}>{inProgressBooks.length}</span>
                  </div>
                )}
                {renderGrid(inProgressBooks)}
              </>
            )}

            {/* Completed section */}
            {completedBooks.length > 0 && (
              <>
                <div style={{ ...blt.sectionHeader, marginTop: inProgressBooks.length ? 20 : 0 }}>
                  <span style={blt.sectionIcon}>✅</span>
                  <span style={blt.sectionTitle}>Completed</span>
                  <span style={blt.sectionCount}>{completedBooks.length}</span>
                </div>
                {renderGrid(completedBooks)}
              </>
            )}
          </>
        )
      }

      {addBookOpen && (
        <AddBookModal book={null} onSave={handleSaveBook} onClose={() => setAddBookOpen(false)} />
      )}
      {editBook && (
        <AddBookModal book={editBook} onSave={handleSaveBook} onClose={() => setEditBook(null)} />
      )}
      {deleteConfirm && (
        <div style={bmodal.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={bmodal.sheet} onClick={e => e.stopPropagation()}>
            <div style={bmodal.confirmTitle}>Delete "{deleteConfirm.title}"?</div>
            <div style={bmodal.confirmSub}>
              This will permanently delete the book and all {deleteConfirm.notes?.length || 0} note(s). This cannot be undone.
            </div>
            <div style={bmodal.confirmActions}>
              <button style={bmodal.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={bmodal.deleteBtn} onClick={() => handleDeleteBook(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

/* BookLibraryTab list view */
const blt = {
  wrap: {
    padding: '16px',
    fontFamily: "'DM Sans', sans-serif",
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bookCount: {
    fontSize: 13,
    color: 'var(--ink-muted)',
    fontWeight: 500,
  },
  addBtn: {
    background: 'var(--teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  sortBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: 'nowrap',
  },
  sortMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    overflow: 'hidden',
    minWidth: 130,
  },
  sortMenuItem: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  sortMenuItemActive: {
    color: 'var(--teal)',
    fontWeight: 700,
    background: 'rgba(0,139,139,0.07)',
  },
  labelBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
    paddingBottom: 2,
  },
  labelChip: {
    background: 'var(--parchment)',
    border: '1px solid var(--border)',
    borderRadius: 99,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    textTransform: 'lowercase',
  },
  labelChipActive: {
    background: 'var(--teal)',
    borderColor: 'var(--teal)',
    color: '#fff',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionIcon: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
    fontFamily: "'DM Sans', sans-serif",
    flex: 1,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink-faint)',
    background: 'var(--parchment)',
    border: '1px solid var(--border)',
    borderRadius: 99,
    padding: '1px 8px',
    fontFamily: "'DM Sans', sans-serif",
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
    fontFamily: "'Cormorant Garamond', serif",
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: 'var(--ink-faint)',
    maxWidth: 260,
    lineHeight: 1.5,
  },
  emptyBtn: {
    marginTop: 8,
    background: 'var(--teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}

/* BookCard */
const bcard = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
    display: 'flex',
    flexDirection: 'column',
  },
  coverWrap: {
    position: 'relative',
    width: '100%',
    paddingTop: '140%',
    background: 'var(--parchment)',
    overflow: 'hidden',
  },
  coverImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '6px 6px 0 0',
  },
  coverPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: 'var(--teal)',
    color: '#fff',
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    fontFamily: "'DM Sans', sans-serif",
  },
  completedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    background: '#38a169',
    color: '#fff',
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    fontFamily: "'DM Sans', sans-serif",
  },
  labelsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 2,
  },
  labelPill: {
    fontSize: 9,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 99,
    background: 'rgba(0,139,139,0.1)',
    color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif",
    textTransform: 'lowercase',
  },
  info: {
    padding: '8px 10px 10px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
    lineHeight: 1.3,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  author: {
    fontSize: 11,
    color: 'var(--ink-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    background: 'var(--border)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    background: 'var(--teal)',
    transition: 'width 0.3s',
  },
  progressLabel: {
    fontSize: 10,
    color: 'var(--ink-faint)',
    whiteSpace: 'nowrap',
  },
  dateLabel: {
    fontSize: 10,
    color: 'var(--ink-faint)',
    marginTop: 2,
    fontFamily: "'DM Sans', sans-serif",
  },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  },
  actionBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--ink-muted)',
    padding: '3px 8px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}

/* BookDetail */
const bdetail = {
  wrap: {
    padding: '16px',
    fontFamily: "'DM Sans', sans-serif",
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--teal)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: 16,
    fontFamily: "'DM Sans', sans-serif",
    display: 'block',
  },
  bookHeader: {
    display: 'flex',
    gap: 14,
    marginBottom: 20,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 14,
  },
  coverWrap: {
    flexShrink: 0,
    width: 70,
    height: 100,
    borderRadius: 6,
    overflow: 'hidden',
    background: 'var(--parchment)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverPlaceholder: {
    width: 70,
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--parchment)',
    borderRadius: 6,
    flexShrink: 0,
  },
  bookInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--ink)',
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    lineHeight: 1.2,
  },
  bookAuthor: {
    fontSize: 13,
    color: 'var(--ink-muted)',
  },
  bookMeta: {
    fontSize: 12,
    color: 'var(--ink-faint)',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    background: 'var(--border)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    background: 'var(--teal)',
    transition: 'width 0.3s',
  },
  progressLabel: {
    fontSize: 11,
    color: 'var(--ink-faint)',
    whiteSpace: 'nowrap',
  },
  noteMeta: {
    fontSize: 12,
    color: 'var(--ink-faint)',
    marginTop: 2,
  },
  dateRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginTop: 4,
  },
  datePill: {
    fontSize: 11,
    color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif",
  },
  labelPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 9px',
    borderRadius: 99,
    background: 'rgba(0,139,139,0.1)',
    color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif",
    textTransform: 'lowercase',
  },
  markFinishedBtn: {
    marginTop: 8,
    background: '#38a169',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    alignSelf: 'flex-start',
  },
  completedBtn: {
    marginTop: 8,
    background: 'none',
    color: '#38a169',
    border: '1px solid #38a169',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    alignSelf: 'flex-start',
  },
  notesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  addNoteBtn: {
    background: 'var(--teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 24px',
    textAlign: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  emptySub: {
    fontSize: 12,
    color: 'var(--ink-faint)',
    maxWidth: 240,
    lineHeight: 1.5,
  },
}

/* NoteCard */
const bnote = {
  card: {
    background: 'var(--surface)',
    borderLeft: '3px solid var(--teal)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 10,
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 99,
  },
  locLabel: {
    fontSize: 11,
    color: 'var(--ink-faint)',
  },
  dateLabel: {
    fontSize: 11,
    color: 'var(--ink-faint)',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
    fontFamily: "'DM Sans', sans-serif",
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 100,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 120,
    overflow: 'hidden',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  text: {
    fontSize: 14,
    color: 'var(--ink)',
    lineHeight: 1.65,
  },
  openQuote: {
    fontSize: 22,
    color: 'var(--ink-faint)',
    lineHeight: 0,
    verticalAlign: 'middle',
    marginRight: 2,
  },
  closeQuote: {
    fontSize: 22,
    color: 'var(--ink-faint)',
    lineHeight: 0,
    verticalAlign: 'middle',
    marginLeft: 2,
  },
}

/* AddBook modal */
const addbook = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: '14px 14px 0 0',
    width: '100%',
    maxWidth: 520,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 2,
  },
  body: {
    padding: '16px 18px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  coverRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  coverPreview: {
    width: 80,
    height: 110,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--parchment)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  uploadBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    display: 'block',
    marginBottom: 6,
  },
  clearCoverBtn: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: '#e53e3e',
    cursor: 'pointer',
    padding: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    color: 'var(--ink)',
    background: 'var(--parchment)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    width: '100%',
    boxSizing: 'border-box',
  },
  toggleGroup: {
    display: 'flex',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  toggleBtnActive: {
    background: 'var(--teal)',
    color: '#fff',
    fontWeight: 700,
  },
  labelWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 10px',
    background: 'var(--parchment)',
    minHeight: 38,
    alignItems: 'center',
  },
  labelChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(0,139,139,0.12)',
    color: 'var(--teal)',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px 2px 10px',
    fontFamily: "'DM Sans', sans-serif",
  },
  labelChipX: {
    background: 'none',
    border: 'none',
    color: 'var(--teal)',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  labelInput: {
    border: 'none',
    outline: 'none',
    background: 'none',
    fontSize: 13,
    color: 'var(--ink)',
    fontFamily: "'DM Sans', sans-serif",
    minWidth: 100,
    flex: 1,
  },
  suggestionsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  suggestionsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  suggestionItem: {
    position: 'relative', // needed for spinner overlay
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    borderRadius: 4,
    overflow: 'hidden',
    outlineOffset: 2,
  },
  suggestionImg: {
    width: 60,
    height: 80,
    objectFit: 'cover',
    display: 'block',
    borderRadius: 4,
  },
  footer: {
    display: 'flex',
    gap: 10,
    padding: '12px 18px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  cancelBtn: {
    flex: 1,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  saveBtn: {
    flex: 2,
    background: 'var(--teal)',
    border: 'none',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}

/* AddNote modal */
const addnote = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: '14px 14px 0 0',
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 2,
  },
  body: {
    padding: '16px 18px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  toggleGroup: {
    display: 'flex',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  toggleBtnActive: {
    background: 'var(--teal)',
    color: '#fff',
    fontWeight: 700,
  },
  textarea: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--ink)',
    background: 'var(--parchment)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    resize: 'vertical',
    lineHeight: 1.6,
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 110,
  },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    color: 'var(--ink)',
    background: 'var(--parchment)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    width: '100%',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    gap: 10,
    padding: '12px 18px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  cancelBtn: {
    flex: 1,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  saveBtn: {
    flex: 2,
    background: 'var(--teal)',
    border: 'none',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}

/* Share modal */
/* Generic confirm modal */
const bmodal = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 250,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    background: 'var(--surface)',
    borderRadius: 14,
    padding: '24px 20px 20px',
    maxWidth: 340,
    width: '100%',
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 8,
  },
  confirmSub: {
    fontSize: 13,
    color: 'var(--ink-muted)',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  confirmActions: {
    display: 'flex',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  deleteBtn: {
    flex: 1,
    background: '#e53e3e',
    border: 'none',
    borderRadius: 9,
    padding: '10px',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}
