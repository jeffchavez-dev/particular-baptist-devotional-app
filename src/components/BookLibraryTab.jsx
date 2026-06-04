import React, { useState, useEffect, useRef } from 'react'
import { generateQuoteId, getAllQuotes, saveQuote, deleteQuote } from '../lib/quoteLibrary'
import { searchBookCovers } from '../lib/bookLibrary'
import { useAuth } from '../App'
import { getMemorizeNote, setMemorizeNote } from '../lib/memorize'
import ShareCardModal from './ShareCardModal'

/*
  Quote: {
    id, text, bookTitle, author, page,
    coverUrl, coverData, labels[],
    createdAt, shareToken?
  }
*/

/* ── Spinner keyframes ── */
;(function injectSpinKf() {
  const id = 'bl-spin-kf'
  if (document.getElementById(id)) return
  const s = document.createElement('style')
  s.id = id
  s.textContent = '@keyframes spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(s)
})()

/* ── Date helper ── */
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════
   AddQuoteModal
══════════════════════════════════════════════════════════ */
function AddQuoteModal({ quote, onSave, onClose }) {
  const [text,       setText]       = useState(quote?.text       || '')
  const [bookTitle,  setBookTitle]  = useState(quote?.bookTitle   || '')
  const [author,     setAuthor]     = useState(quote?.author      || '')
  const [page,       setPage]       = useState(quote?.page != null ? String(quote.page) : '')
  const [coverUrl,   setCoverUrl]   = useState(quote?.coverUrl    || '')
  const [coverData,  setCoverData]  = useState(quote?.coverData   || null)
  const [labels,     setLabels]     = useState(quote?.labels      || [])
  const [labelInput, setLabelInput] = useState('')
  const [coverSuggestions, setCoverSuggestions] = useState([])
  const [coverLoading,     setCoverLoading]     = useState(false)
  const [fetchingCover,    setFetchingCover]    = useState(false)
  const [selectedCoverId,  setSelectedCoverId]  = useState(null)
  const [searchTouched,    setSearchTouched]    = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const fileInputRef = useRef(null)
  const debounceRef  = useRef(null)
  const textareaRef  = useRef(null)

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 50) }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* Auto-search cover when book title changes */
  useEffect(() => {
    if (!bookTitle.trim()) { setCoverSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchTouched(true)
      setCoverLoading(true)
      const results = await searchBookCovers(bookTitle, author)
      setCoverSuggestions(results)
      setCoverLoading(false)
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [bookTitle, author])

  function addLabel(raw) {
    const tag = raw.trim().toLowerCase().replace(/[,;]+$/, '')
    if (!tag || labels.includes(tag)) { setLabelInput(''); return }
    setLabels(prev => [...prev, tag])
    setLabelInput('')
  }
  function removeLabel(tag) { setLabels(prev => prev.filter(l => l !== tag)) }
  function handleLabelKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(labelInput) }
    if (e.key === 'Backspace' && !labelInput && labels.length) setLabels(prev => prev.slice(0, -1))
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCoverData(ev.target.result); setCoverUrl(''); setSelectedCoverId(null) }
    reader.readAsDataURL(file)
  }

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
      setCoverData(dataUrl); setCoverUrl('')
    } catch {
      setCoverUrl(suggestion.coverUrl); setCoverData(null)
    } finally { setFetchingCover(false) }
  }

  function handleSave() {
    setSaveError('')
    if (!text.trim()) { setSaveError('Please enter the quote text.'); return }
    try {
      onSave({
        id:        quote?.id || generateQuoteId(),
        text:      text.trim(),
        bookTitle: bookTitle.trim(),
        author:    author.trim(),
        page:      parseInt(page) || null,
        coverUrl,
        coverData,
        labels,
        createdAt: quote?.createdAt || new Date().toISOString(),
      })
    } catch (err) {
      setSaveError(err?.message || 'Could not save. Storage may be full.')
    }
  }

  const previewSrc = coverData || coverUrl

  return (
    <div style={aq.overlay} onClick={onClose}>
      <div style={aq.modal} onClick={e => e.stopPropagation()}>

        <div style={aq.header}>
          <span style={aq.headerTitle}>{quote ? 'Edit Quote' : 'Add Quote'}</span>
          <button style={aq.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={aq.body}>

          {/* Quote text */}
          <div style={aq.field}>
            <label style={aq.label}>Quote <span style={{ color: 'var(--teal)' }}>*</span></label>
            <textarea
              ref={textareaRef}
              style={{ ...aq.textarea, ...(saveError && !text.trim() ? { borderColor: '#e53e3e' } : {}) }}
              value={text}
              onChange={e => { setText(e.target.value); setSaveError('') }}
              placeholder="Enter the quote…"
              rows={4}
            />
          </div>

          {/* Book title */}
          <div style={aq.field}>
            <label style={aq.label}>Book Title</label>
            <input
              style={aq.input}
              value={bookTitle}
              onChange={e => setBookTitle(e.target.value)}
              placeholder="Source book title"
            />
          </div>

          {/* Author */}
          <div style={aq.field}>
            <label style={aq.label}>Author</label>
            <input
              style={aq.input}
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </div>

          {/* Page */}
          <div style={aq.field}>
            <label style={aq.label}>Page Number</label>
            <input
              style={aq.input}
              type="number"
              min="1"
              value={page}
              onChange={e => setPage(e.target.value)}
              placeholder="e.g. 142"
            />
          </div>

          {/* Cover — used as share card background */}
          <div style={aq.field}>
            <label style={aq.label}>
              Cover Image
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 5 }}>
                — used as share card background
              </span>
            </label>
            <div style={aq.coverRow}>
              <div style={aq.coverPreview}>
                {previewSrc
                  ? <img src={previewSrc} alt="cover" style={aq.coverImg} />
                  : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18M9 21V9"/>
                    </svg>
                  )
                }
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button style={aq.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                  Upload Image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                {previewSrc && (
                  <button style={aq.clearBtn} onClick={() => { setCoverData(null); setCoverUrl(''); setSelectedCoverId(null) }}>
                    Remove cover
                  </button>
                )}
              </div>
            </div>

            {/* Google Books cover suggestions (fires when bookTitle is filled) */}
            {bookTitle.trim() && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600 }}>
                    {coverLoading
                      ? '🔍 Searching covers…'
                      : coverSuggestions.length > 0
                        ? `${coverSuggestions.length} covers found`
                        : searchTouched ? 'No covers found online' : 'Cover suggestions'}
                  </span>
                  {coverLoading && (
                    <div style={{ width: 12, height: 12, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  )}
                </div>
                {coverSuggestions.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {coverSuggestions.map(s => (
                      <button
                        key={s.id}
                        title={`${s.title}${s.authors ? ' — ' + s.authors : ''}`}
                        onClick={() => handleSelectSuggestion(s)}
                        disabled={fetchingCover}
                        style={{
                          position: 'relative', flexShrink: 0,
                          width: 48, height: 68, padding: 0, border: 'none',
                          borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                          outline: selectedCoverId === s.id ? '2px solid var(--teal)' : '2px solid transparent',
                          opacity: fetchingCover && selectedCoverId !== s.id ? 0.5 : 1,
                        }}
                      >
                        <img src={s.coverUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {fetchingCover && selectedCoverId === s.id && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Labels */}
          <div style={aq.field}>
            <label style={aq.label}>Labels</label>
            <div style={aq.labelWrap}>
              {labels.map(tag => (
                <span key={tag} style={aq.labelChip}>
                  {tag}
                  <button style={aq.labelChipX} onClick={() => removeLabel(tag)}>×</button>
                </span>
              ))}
              <input
                style={aq.labelInput}
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onBlur={() => labelInput.trim() && addLabel(labelInput)}
                placeholder={labels.length ? 'Add another…' : 'Type label + Enter'}
              />
            </div>
          </div>

        </div>

        {saveError && (
          <div style={{ padding: '8px 18px', color: '#e53e3e', fontSize: 13, fontWeight: 600, background: 'rgba(229,62,62,0.07)', borderTop: '1px solid rgba(229,62,62,0.15)' }}>
            ⚠ {saveError}
          </div>
        )}

        <div style={aq.footer}>
          <button style={aq.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...aq.saveBtn, ...(!text.trim() ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
            onClick={handleSave}
          >
            {quote ? 'Save Changes' : 'Add Quote'}
          </button>
        </div>

      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   QuoteCard
══════════════════════════════════════════════════════════ */
function QuoteCard({ quote, onEdit, onDelete, onShare, onMemorize }) {
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [copyFlash, setCopyFlash] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function handleCopy() {
    navigator.clipboard.writeText(quote.text).catch(() => {})
    setCopyFlash(true)
    setTimeout(() => setCopyFlash(false), 1500)
  }

  const locParts = []
  if (quote.page) locParts.push(`p. ${quote.page}`)
  const dateStr = formatDate(quote.createdAt)

  return (
    <div style={qc.card}>
      {/* Top row */}
      <div style={qc.cardTop}>
        {(quote.bookTitle || quote.author) && (
          <span style={qc.bookBadge}>
            {[quote.bookTitle, quote.author].filter(Boolean).join(' — ')}
          </span>
        )}
        {locParts.length > 0 && <span style={qc.loc}>{locParts.join(' · ')}</span>}
        {dateStr && <span style={qc.date}>{dateStr}</span>}

        {/* Overflow menu */}
        <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }} ref={menuRef}>
          <button style={qc.menuBtn} onClick={() => setMenuOpen(v => !v)}>⋯</button>
          {menuOpen && (
            <div style={qc.menu}>
              <button style={qc.menuItem} onClick={() => { onShare(quote); setMenuOpen(false) }}>Share image</button>
              <button style={qc.menuItem} onClick={() => { onMemorize(quote); setMenuOpen(false) }}>Memorize</button>
            </div>
          )}
        </div>
      </div>

      {/* Quote text */}
      <div style={qc.text}>
        <span style={qc.openQuote}>"</span>
        {quote.text}
        <span style={qc.closeQuote}>"</span>
      </div>

      {/* Labels */}
      {quote.labels?.length > 0 && (
        <div style={qc.labelsRow}>
          {quote.labels.map(l => <span key={l} style={qc.labelPill}>{l}</span>)}
        </div>
      )}

      {/* Action row */}
      <div style={qc.actionRow}>
        <button
          style={{ ...qc.actionBtn, color: copyFlash ? 'var(--teal)' : undefined }}
          onClick={handleCopy}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            {copyFlash
              ? <polyline points="2,6.5 5.5,10 11,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              : <><rect x="4.5" y="1.5" width="7" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 4.5H1.5a1 1 0 00-1 1V12a1 1 0 001 1h6a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>
            }
          </svg>
          <span>{copyFlash ? 'Copied!' : 'Copy'}</span>
        </button>

        <button style={qc.actionBtn} onClick={() => onEdit(quote)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9 1.5l2.5 2.5-7 7H2v-2.5l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Edit</span>
        </button>

        <button style={{ ...qc.actionBtn, color: '#e53e3e' }} onClick={() => onDelete(quote)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <polyline points="2,3.5 11,3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M5 3.5V2h3v1.5M4.5 3.5v7a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   BookLibraryTab (default export) — the Quotes library
══════════════════════════════════════════════════════════ */
const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest'    },
  { id: 'oldest', label: 'Oldest'    },
  { id: 'title',  label: 'Book A–Z'  },
  { id: 'author', label: 'Author A–Z'},
]

export default function BookLibraryTab({ searchQuery }) {
  const { session } = useAuth()
  const userId = session?.user?.id || null

  const [quotes,        setQuotes]        = useState(() => getAllQuotes())
  const [addOpen,       setAddOpen]       = useState(false)
  const [editQuote,     setEditQuote]     = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [shareCard,     setShareCard]     = useState(null)
  const [sortBy,        setSortBy]        = useState('newest')
  const [filterLabel,   setFilterLabel]   = useState(null)
  const [sortOpen,      setSortOpen]      = useState(false)
  const [memorizeConfirm, setMemorizeConfirm] = useState(null)
  const sortRef = useRef(null)

  useEffect(() => {
    const handler = () => setQuotes(getAllQuotes())
    window.addEventListener('pb-quote-library-updated', handler)
    return () => window.removeEventListener('pb-quote-library-updated', handler)
  }, [])

  useEffect(() => {
    if (!sortOpen) return
    function handler(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  const quoteList = Object.values(quotes).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    if (sortBy === 'title')  return (a.bookTitle || '').localeCompare(b.bookTitle || '')
    if (sortBy === 'author') return (a.author    || '').localeCompare(b.author    || '')
    return 0
  })

  const allLabels = [...new Set(quoteList.flatMap(q => q.labels || []))]

  const searchFiltered = searchQuery
    ? quoteList.filter(q =>
        q.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.bookTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.author?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quoteList

  const filteredQuotes = filterLabel
    ? searchFiltered.filter(q => (q.labels || []).includes(filterLabel))
    : searchFiltered

  function handleSaveQuote(quoteData) {
    saveQuote(quoteData, userId)
    setQuotes(getAllQuotes())
    setAddOpen(false)
    setEditQuote(null)
  }

  function handleDeleteQuote(quote) {
    deleteQuote(quote.id, userId)
    setQuotes(getAllQuotes())
    setDeleteConfirm(null)
  }

  function handleShare(quote) {
    setShareCard({
      type:          'book_quote',
      noteType:      'quote',
      text:          quote.text,
      bookTitle:     quote.bookTitle,
      bookAuthor:    quote.author,
      bookLabels:    quote.labels,
      bookCoverData: quote.coverData,
      bookCoverUrl:  quote.coverUrl,
      page:          quote.page,
      percent:       null,
    })
  }

  function handleMemorize(quote) {
    const incoming = {
      noteId:    quote.id,
      bookId:    quote.id,
      bookTitle: quote.bookTitle || '',
      bookAuthor:quote.author    || '',
      type:      'quote',
      text:      quote.text,
      page:      quote.page || null,
      percent:   null,
    }
    const existing = getMemorizeNote()
    if (existing) {
      setMemorizeConfirm({ incoming, existing })
    } else {
      setMemorizeNote(incoming)
    }
  }

  const sortLabel = SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Sort'

  return (
    <div style={blt.wrap}>

      {/* Toolbar */}
      <div style={blt.toolbar}>
        <span style={blt.count}>
          {filteredQuotes.length} {filteredQuotes.length === 1 ? 'quote' : 'quotes'}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button style={blt.sortBtn} onClick={() => setSortOpen(v => !v)}>↕ {sortLabel}</button>
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
          <button style={blt.addBtn} onClick={() => setAddOpen(true)}>+ Add Quote</button>
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

      {/* Quote list / empty state */}
      {filteredQuotes.length === 0 ? (
        <div style={blt.emptyState}>
          <span style={{ fontSize: 48 }}>❝</span>
          <div style={blt.emptyTitle}>Your Quote Collection</div>
          <div style={blt.emptySub}>
            {searchQuery || filterLabel
              ? 'No quotes match your filter.'
              : "Save meaningful quotes from books you're reading. Share them as beautiful cards."}
          </div>
          {!searchQuery && !filterLabel && (
            <button style={blt.emptyBtn} onClick={() => setAddOpen(true)}>Add Your First Quote</button>
          )}
        </div>
      ) : (
        <div style={blt.list}>
          {filteredQuotes.map(quote => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onEdit={setEditQuote}
              onDelete={setDeleteConfirm}
              onShare={handleShare}
              onMemorize={handleMemorize}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <AddQuoteModal quote={null} onSave={handleSaveQuote} onClose={() => setAddOpen(false)} />
      )}
      {editQuote && (
        <AddQuoteModal quote={editQuote} onSave={handleSaveQuote} onClose={() => setEditQuote(null)} />
      )}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />
      {deleteConfirm && (
        <div style={bm.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={bm.sheet} onClick={e => e.stopPropagation()}>
            <div style={bm.title}>Delete this quote?</div>
            <div style={bm.sub}>This cannot be undone.</div>
            <div style={bm.actions}>
              <button style={bm.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={bm.deleteBtn} onClick={() => handleDeleteQuote(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {memorizeConfirm && (
        <div style={bm.overlay} onClick={() => setMemorizeConfirm(null)}>
          <div style={{ ...bm.sheet, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={bm.title}>Replace memory quote?</div>
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '0 0 4px' }}>Current:</p>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 2px', fontStyle: 'italic',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                "{memorizeConfirm.existing.text}"
              </p>
              <p style={{ fontSize: 11, color: 'var(--teal)', margin: 0 }}>— {memorizeConfirm.existing.bookTitle}</p>
            </div>
            <div style={{ padding: '12px 16px 4px' }}>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '0 0 4px' }}>Replace with:</p>
              <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 2px', fontStyle: 'italic',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                "{memorizeConfirm.incoming.text}"
              </p>
              <p style={{ fontSize: 11, color: 'var(--teal)', margin: '0 0 12px' }}>— {memorizeConfirm.incoming.bookTitle}</p>
            </div>
            <div style={bm.actions}>
              <button style={bm.cancelBtn} onClick={() => setMemorizeConfirm(null)}>Cancel</button>
              <button
                style={{ ...bm.deleteBtn, background: 'var(--teal)', borderColor: 'var(--teal)' }}
                onClick={() => { setMemorizeNote(memorizeConfirm.incoming); setMemorizeConfirm(null) }}
              >Replace</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────── */

const blt = {
  wrap:    { padding: 16, fontFamily: "'DM Sans', sans-serif" },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  count:   { fontSize: 13, color: 'var(--ink-muted)', fontWeight: 500 },
  addBtn:  { background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  sortBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' },
  sortMenu: { position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', minWidth: 130 },
  sortMenuItem:       { display: 'block', width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  sortMenuItemActive: { color: 'var(--teal)', fontWeight: 700, background: 'rgba(0,139,139,0.07)' },
  labelBar:       { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  labelChip:      { background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textTransform: 'lowercase' },
  labelChipActive:{ background: 'var(--teal)', borderColor: 'var(--teal)', color: '#fff' },
  list:        { display: 'flex', flexDirection: 'column', gap: 10 },
  emptyState:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', gap: 10 },
  emptyTitle:  { fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Cormorant Garamond', serif", marginTop: 8 },
  emptySub:    { fontSize: 13, color: 'var(--ink-faint)', maxWidth: 270, lineHeight: 1.5 },
  emptyBtn:    { marginTop: 8, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}

const qc = {
  card:     { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid #d4a84c', borderRadius: 8, padding: '12px 14px' },
  cardTop:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  bookBadge:{ fontSize: 11, fontWeight: 600, color: '#b8860b', background: 'rgba(212,168,76,0.12)', padding: '2px 8px', borderRadius: 99, fontFamily: "'DM Sans', sans-serif" },
  loc:      { fontSize: 11, color: 'var(--ink-faint)' },
  date:     { fontSize: 11, color: 'var(--ink-faint)' },
  menuBtn:  { background: 'none', border: 'none', fontSize: 18, color: 'var(--ink-muted)', cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  menu:     { position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 120, overflow: 'hidden' },
  menuItem: { display: 'block', width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  text:     { fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 6 },
  openQuote:  { fontSize: 20, color: 'var(--ink-faint)', lineHeight: 0, verticalAlign: 'middle', marginRight: 2 },
  closeQuote: { fontSize: 20, color: 'var(--ink-faint)', lineHeight: 0, verticalAlign: 'middle', marginLeft: 2 },
  labelsRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  labelPill: { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(212,168,76,0.1)', color: '#b8860b', fontFamily: "'DM Sans', sans-serif", textTransform: 'lowercase' },
  actionRow: { display: 'flex', alignItems: 'center', gap: 2, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  actionBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'none', fontSize: 12, fontWeight: 500, color: 'var(--ink-faint)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}

const aq = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:       { background: 'var(--surface)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)' },
  closeBtn:    { background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-muted)', cursor: 'pointer', lineHeight: 1, padding: 2 },
  body:        { padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 },
  field:       { display: 'flex', flexDirection: 'column', gap: 5 },
  label:       { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' },
  input:       { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
  textarea:    { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'Cormorant Garamond', serif", resize: 'vertical', lineHeight: 1.7 },
  coverRow:    { display: 'flex', alignItems: 'flex-start', gap: 10 },
  coverPreview:{ width: 60, height: 84, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  coverImg:    { width: '100%', height: '100%', objectFit: 'cover' },
  uploadBtn:   { background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  clearBtn:    { background: 'none', border: 'none', fontSize: 11, color: '#e53e3e', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" },
  labelWrap:   { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--parchment)', minHeight: 38 },
  labelChip:   { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, background: 'var(--teal-light)', color: 'var(--teal)', borderRadius: 99, padding: '2px 8px' },
  labelChipX:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--teal)', padding: 0, lineHeight: 1 },
  labelInput:  { border: 'none', outline: 'none', fontSize: 12, background: 'none', color: 'var(--ink)', flex: 1, minWidth: 80, fontFamily: "'DM Sans', sans-serif" },
  footer:      { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 },
  cancelBtn:   { background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  saveBtn:     { background: 'var(--teal)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}

const bm = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet:     { background: 'var(--surface)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 420, padding: '20px 20px 32px', fontFamily: "'DM Sans', sans-serif" },
  title:     { fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 },
  sub:       { fontSize: 13, color: 'var(--ink-faint)', marginBottom: 18, lineHeight: 1.5 },
  actions:   { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  deleteBtn: { background: '#e53e3e', border: '1px solid #e53e3e', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}
