import React, { useState, useEffect, useRef, useCallback } from 'react'
import { generateId, getAllBooks, saveBook, deleteBook, searchBookCovers } from '../lib/bookLibrary'

/*
  Book: { id, title, author, isEbook, totalPages, coverUrl, coverData, addedAt, notes[] }
  Note: { id, type ('note'|'quote'), text, page, percent, createdAt, updatedAt }
*/

/* ── Canvas helpers ─────────────────────────────────────────────────────────── */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ')
  let line = ''
  let lineCount = 0
  let currentY = y

  for (let i = 0; i < words.length; i++) {
    const testLine = line + (line ? ' ' : '') + words[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      if (lineCount >= maxLines - 1) {
        // truncate with ellipsis
        let truncated = line
        while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1)
        }
        ctx.fillText(truncated + '…', x, currentY)
        return currentY + lineHeight
      }
      ctx.fillText(line, x, currentY)
      currentY += lineHeight
      lineCount++
      line = words[i]
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY)
    currentY += lineHeight
  }
  return currentY
}

function applyBg(ctx, preset, w, h) {
  if (preset.type === 'solid') {
    ctx.fillStyle = preset.bg
    ctx.fillRect(0, 0, w, h)
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, preset.bg[0])
    grad.addColorStop(1, preset.bg[1])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}

async function drawBookNoteCard(canvas, note, book, preset, format, useCoverBg, scale) {
  const w = format.w * scale
  const h = format.h * scale
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  let textColor = preset.textColor
  let accentColor = preset.accentColor

  if (useCoverBg && (book.coverData || book.coverUrl)) {
    // Draw cover image as background
    await new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // Scale cover to fill canvas
        const imgRatio = img.width / img.height
        const canvasRatio = w / h
        let sx, sy, sw, sh
        if (imgRatio > canvasRatio) {
          sh = img.height
          sw = sh * canvasRatio
          sx = (img.width - sw) / 2
          sy = 0
        } else {
          sw = img.width
          sh = sw / canvasRatio
          sx = 0
          sy = (img.height - sh) / 2
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
        // Dark overlay
        ctx.fillStyle = 'rgba(10,8,5,0.72)'
        ctx.fillRect(0, 0, w, h)
        textColor = '#f5f0e8'
        accentColor = '#d4a84c'
        resolve()
      }
      img.onerror = () => {
        applyBg(ctx, preset, w, h)
        resolve()
      }
      img.src = book.coverData || book.coverUrl
    })
  } else {
    applyBg(ctx, preset, w, h)
  }

  const refDim = Math.min(w, h)
  const PAD = Math.round(refDim * 0.08)

  // Top rule
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = accentColor
  ctx.lineWidth = Math.round(refDim * 0.003)
  ctx.beginPath()
  ctx.moveTo(PAD, PAD * 0.6)
  ctx.lineTo(w - PAD, PAD * 0.6)
  ctx.stroke()
  ctx.restore()

  // Book title badge
  const badgeFontSize = Math.round(refDim * 0.028)
  ctx.font = `600 ${badgeFontSize}px 'DM Sans', sans-serif`
  const titleText = book.title || 'Unknown Book'
  const titleMetrics = ctx.measureText(titleText)
  const badgePadX = Math.round(refDim * 0.022)
  const badgePadY = Math.round(refDim * 0.012)
  const badgeH = badgeFontSize + badgePadY * 2
  const badgeW = titleMetrics.width + badgePadX * 2
  const badgeX = PAD
  const badgeY = Math.round(PAD * 0.75)
  const badgeR = badgeH / 2

  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = accentColor
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeR)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = accentColor
  ctx.font = `600 ${badgeFontSize}px 'DM Sans', sans-serif`
  ctx.fillText(titleText, badgeX + badgePadX, badgeY + badgePadY + badgeFontSize * 0.78)

  // Note type badge
  const typeBadgeX = badgeX + badgeW + Math.round(refDim * 0.015)
  const typeLabel = note.type === 'quote' ? '❝ Quote' : '✍ Note'
  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = textColor
  roundRect(ctx, typeBadgeX, badgeY, ctx.measureText(typeLabel).width + badgePadX * 2, badgeH, badgeR)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = textColor
  ctx.globalAlpha = 0.7
  ctx.font = `500 ${badgeFontSize}px 'DM Sans', sans-serif`
  ctx.fillText(typeLabel, typeBadgeX + badgePadX, badgeY + badgePadY + badgeFontSize * 0.78)
  ctx.globalAlpha = 1

  // Large decorative open-quote
  const quoteFontSize = Math.round(refDim * 0.32)
  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = accentColor
  ctx.font = `bold ${quoteFontSize}px Georgia, serif`
  ctx.fillText('“', PAD - Math.round(refDim * 0.02), PAD * 1.8 + quoteFontSize * 0.6)
  ctx.restore()

  // Main text
  const mainFontSize = Math.round(refDim * 0.048)
  const mainLineHeight = mainFontSize * 1.55
  const textY = PAD * 1.8
  const maxTextWidth = w - PAD * 2.2
  const maxLines = Math.floor((h * 0.52) / mainLineHeight)

  ctx.fillStyle = textColor
  if (note.type === 'quote') {
    ctx.font = `italic ${mainFontSize}px Georgia, serif`
  } else {
    ctx.font = `${mainFontSize}px 'DM Sans', sans-serif`
  }

  const endY = wrapText(ctx, note.text || '', PAD, textY, maxTextWidth, mainLineHeight, maxLines)

  // Author attribution
  if (book.author) {
    const attrFontSize = Math.round(refDim * 0.032)
    const attrY = endY + Math.round(refDim * 0.035)
    ctx.fillStyle = accentColor
    ctx.font = `500 ${attrFontSize}px 'DM Sans', sans-serif`
    ctx.fillText(`— ${book.author}`, PAD, attrY)

    // Page/percent line
    const subFontSize = Math.round(refDim * 0.026)
    ctx.font = `${subFontSize}px 'DM Sans', sans-serif`
    ctx.fillStyle = textColor
    ctx.globalAlpha = 0.5
    const locParts = []
    if (note.page) locParts.push(`p. ${note.page}`)
    if (note.percent != null) locParts.push(`${note.percent}%`)
    if (locParts.length) {
      ctx.fillText(locParts.join(' · '), PAD, attrY + attrFontSize * 1.6)
    }
    ctx.globalAlpha = 1
  }

  // Bottom rule
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = accentColor
  ctx.lineWidth = Math.round(refDim * 0.003)
  ctx.beginPath()
  ctx.moveTo(PAD, h - PAD * 0.55)
  ctx.lineTo(w - PAD, h - PAD * 0.55)
  ctx.stroke()
  ctx.restore()

  // Branding
  const brandFontSize = Math.round(refDim * 0.024)
  ctx.fillStyle = textColor
  ctx.globalAlpha = 0.4
  ctx.font = `500 ${brandFontSize}px 'DM Sans', sans-serif`
  ctx.fillText('Particular Baptist Devotional', PAD, h - PAD * 0.28)
  ctx.globalAlpha = 1
}

/* ── Presets & Formats ──────────────────────────────────────────────────────── */

const SHARE_PRESETS = [
  { id: 'ink',       label: 'Deep Ink',  type: 'solid',    bg: '#1a1410',              textColor: '#f5f0e8', accentColor: '#c9a84c' },
  { id: 'parchment', label: 'Parchment', type: 'gradient', bg: ['#f5f0e8', '#ddd5c5'], textColor: '#1a1410', accentColor: '#8a6d2e' },
  { id: 'forest',    label: 'Forest',    type: 'gradient', bg: ['#1a3a2a', '#0d2418'], textColor: '#e8f5f0', accentColor: '#7ec8b0' },
  { id: 'royal',     label: 'Royal',     type: 'gradient', bg: ['#2d1b4e', '#1a0f2e'], textColor: '#e8e0f8', accentColor: '#a87ee8' },
  { id: 'amber',     label: 'Amber',     type: 'gradient', bg: ['#4a3210', '#2a1e08'], textColor: '#f5ece0', accentColor: '#d4a84c' },
]

const SHARE_FORMATS = [
  { id: 'square', label: 'Square',    w: 1080, h: 1080 },
  { id: 'story',  label: 'Story',     w: 1080, h: 1920 },
  { id: 'wide',   label: 'Landscape', w: 1920, h: 1080 },
]

/* ── BookNoteShareModal ─────────────────────────────────────────────────────── */

function BookNoteShareModal({ note, book, onClose }) {
  const canvasRef = useRef(null)
  const [preset, setPreset] = useState(SHARE_PRESETS[0])
  const [format, setFormat] = useState(SHARE_FORMATS[0])
  const hasCover = !!(book.coverData || book.coverUrl)
  const [useCoverBg, setUseCoverBg] = useState(hasCover)
  const [scale, setScale] = useState(1.0)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawBookNoteCard(canvas, note, book, preset, format, useCoverBg, scale)
  }, [note, book, preset, format, useCoverBg, scale])

  // Re-draw after 150ms for font settling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const timer = setTimeout(() => {
      drawBookNoteCard(canvas, note, book, preset, format, useCoverBg, scale)
    }, 150)
    return () => clearTimeout(timer)
  }, [note, book, preset, format, useCoverBg, scale])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function share() {
    setSharing(true)
    const canvas = canvasRef.current
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'note-card.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: book.title || 'Note Card' })
        } catch (_) {
          download(blob)
        }
      } else {
        download(blob)
      }
      setSharing(false)
    }, 'image/png')
  }

  function download(blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `note-card-${Date.now()}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div style={bshare.overlay} onClick={onClose}>
      <div style={bshare.modal} onClick={e => e.stopPropagation()}>
        <div style={bshare.header}>
          <span style={bshare.headerTitle}>Share Note Card</span>
          <button style={bshare.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={bshare.canvasWrap}>
          <canvas ref={canvasRef} style={bshare.canvas} />
        </div>

        <div style={bshare.controls}>
          {hasCover && (
            <label style={bshare.toggleRow}>
              <input
                type="checkbox"
                checked={useCoverBg}
                onChange={e => setUseCoverBg(e.target.checked)}
                style={{ accentColor: 'var(--teal)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Use book cover as background</span>
            </label>
          )}

          <div style={bshare.sectionLabel}>Format</div>
          <div style={bshare.chipRow}>
            {SHARE_FORMATS.map(f => (
              <button
                key={f.id}
                style={{ ...bshare.chip, ...(format.id === f.id ? bshare.chipActive : {}) }}
                onClick={() => setFormat(f)}
              >{f.label}</button>
            ))}
          </div>

          {!useCoverBg && (
            <>
              <div style={bshare.sectionLabel}>Style</div>
              <div style={bshare.presetRow}>
                {SHARE_PRESETS.map(p => (
                  <button
                    key={p.id}
                    title={p.label}
                    onClick={() => setPreset(p)}
                    style={{
                      ...bshare.presetSwatch,
                      background: Array.isArray(p.bg)
                        ? `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})`
                        : p.bg,
                      outline: preset.id === p.id ? `2px solid var(--teal)` : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          <div style={bshare.sectionLabel}>Text Size</div>
          <div style={bshare.chipRow}>
            <button style={bshare.chip} onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1)))}>A−</button>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '0 4px' }}>{Math.round(scale * 100)}%</span>
            <button style={bshare.chip} onClick={() => setScale(s => Math.min(2.0, +(s + 0.1).toFixed(1)))}>A+</button>
          </div>
        </div>

        <div style={bshare.footer}>
          <button style={bshare.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={bshare.shareBtn} onClick={share} disabled={sharing}>
            {sharing ? 'Preparing…' : navigator.share ? 'Share' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [coverLoading, setCoverLoading] = useState(false)
  const [searchTouched, setSearchTouched] = useState(false)
  const [selectedCoverId, setSelectedCoverId] = useState(null)
  const fileInputRef = useRef(null)
  const debounceRef = useRef(null)

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

  function handleSelectSuggestion(suggestion) {
    setSelectedCoverId(suggestion.id)
    setCoverUrl(suggestion.coverUrl)
    setCoverData(null)
  }

  function handleSave() {
    if (!title.trim()) return
    const bookData = {
      id: book?.id || generateId(),
      title: title.trim(),
      author: author.trim(),
      isEbook,
      totalPages: isEbook ? null : (parseInt(totalPages) || null),
      coverUrl,
      coverData,
      addedAt: book?.addedAt || new Date().toISOString(),
      notes: book?.notes || [],
    }
    onSave(bookData)
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

          {/* Fields */}
          <div style={addbook.field}>
            <label style={addbook.label}>Title <span style={{ color: 'var(--teal)' }}>*</span></label>
            <input
              style={addbook.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Book title"
              autoFocus
            />
          </div>

          <div style={addbook.field}>
            <label style={addbook.label}>Author</label>
            <input
              style={addbook.input}
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </div>

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

          {/* Cover suggestions */}
          {searchTouched && (
            <div style={addbook.field}>
              <label style={addbook.label}>
                {coverLoading ? 'Searching covers…' : `Cover Suggestions (${coverSuggestions.length})`}
              </label>
              {coverSuggestions.length > 0 && (
                <div style={addbook.suggestionsRow}>
                  {coverSuggestions.map(s => (
                    <button
                      key={s.id}
                      title={`${s.title}${s.authors ? ' — ' + s.authors : ''}`}
                      onClick={() => handleSelectSuggestion(s)}
                      style={{
                        ...addbook.suggestionItem,
                        outline: selectedCoverId === s.id ? '2px solid var(--teal)' : '2px solid transparent',
                      }}
                    >
                      <img src={s.coverUrl} alt={s.title} style={addbook.suggestionImg} />
                    </button>
                  ))}
                </div>
              )}
              {!coverLoading && coverSuggestions.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No covers found. Try uploading one above.</span>
              )}
            </div>
          )}
        </div>

        <div style={addbook.footer}>
          <button style={addbook.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={addbook.saveBtn} onClick={handleSave} disabled={!title.trim()}>
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

function NoteCard({ note, book, onEdit, onDelete, onShare, onCopy }) {
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
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={menuRef}>
          <button style={bnote.menuBtn} onClick={() => setMenuOpen(v => !v)}>⋯</button>
          {menuOpen && (
            <div style={bnote.menu}>
              <button style={bnote.menuItem} onClick={() => { onCopy(note); setMenuOpen(false) }}>Copy</button>
              <button style={bnote.menuItem} onClick={() => { onShare(note); setMenuOpen(false) }}>Share</button>
              <button style={bnote.menuItem} onClick={() => { onEdit(note); setMenuOpen(false) }}>Edit</button>
              <button style={{ ...bnote.menuItem, color: '#e53e3e' }} onClick={() => { onDelete(note); setMenuOpen(false) }}>Delete</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ ...bnote.text, fontStyle: isQuote ? 'italic' : 'normal' }}>
        {isQuote && <span style={bnote.openQuote}>“</span>}
        {note.text}
        {isQuote && <span style={bnote.closeQuote}>”</span>}
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
      </div>
      <div style={bcard.info}>
        <div style={bcard.title}>{book.title}</div>
        {book.author && <div style={bcard.author}>{book.author}</div>}
        {progress != null && (
          <div style={bcard.progressWrap}>
            <div style={bcard.progressTrack}>
              <div style={{ ...bcard.progressFill, width: `${Math.min(100, progress)}%` }} />
            </div>
            <span style={bcard.progressLabel}>{progress}%</span>
          </div>
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

function BookDetail({ book: initialBook, onBack, onChange, searchQuery }) {
  const [book, setBook] = useState(initialBook)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [editNote, setEditNote] = useState(null)
  const [shareNote, setShareNote] = useState(null)
  const [deleteNote, setDeleteNote] = useState(null)

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
    saveBook(updatedBook)
    setBook(updatedBook)
    onChange(updatedBook)
  }

  function handleAddNote(noteData) {
    const newNote = {
      id: generateId(),
      ...noteData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = { ...book, notes: [newNote, ...(book.notes || [])] }
    mutateBook(updated)
    setAddNoteOpen(false)
  }

  function handleEditNote(noteData) {
    const updatedNotes = (book.notes || []).map(n =>
      n.id === editNote.id ? { ...n, ...noteData, updatedAt: new Date().toISOString() } : n
    )
    const updated = { ...book, notes: updatedNotes }
    mutateBook(updated)
    setEditNote(null)
  }

  function handleDeleteNote(note) {
    const updatedNotes = (book.notes || []).filter(n => n.id !== note.id)
    const updated = { ...book, notes: updatedNotes }
    mutateBook(updated)
    setDeleteNote(null)
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
          {progress != null && (
            <div style={bdetail.progressWrap}>
              <div style={bdetail.progressTrack}>
                <div style={{ ...bdetail.progressFill, width: `${Math.min(100, progress)}%` }} />
              </div>
              <span style={bdetail.progressLabel}>{progress}% complete</span>
            </div>
          )}
          <div style={bdetail.noteMeta}>{notes.length} note{notes.length !== 1 ? 's' : ''}</div>
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
            onShare={setShareNote}
            onCopy={handleCopy}
          />
        ))
      }

      {addNoteOpen && (
        <AddNoteModal book={book} note={null} onSave={handleAddNote} onClose={() => setAddNoteOpen(false)} />
      )}
      {editNote && (
        <AddNoteModal book={book} note={editNote} onSave={handleEditNote} onClose={() => setEditNote(null)} />
      )}
      {shareNote && (
        <BookNoteShareModal note={shareNote} book={book} onClose={() => setShareNote(null)} />
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
    </div>
  )
}

/* ── BookLibraryTab (default export) ────────────────────────────────────────── */

export default function BookLibraryTab({ searchQuery }) {
  const [books, setBooks] = useState(() => getAllBooks())
  const [view, setView] = useState('list')
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [editBook, setEditBook] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    const handler = () => setBooks(getAllBooks())
    window.addEventListener('pb-book-library-updated', handler)
    return () => window.removeEventListener('pb-book-library-updated', handler)
  }, [])

  const bookList = Object.values(books).sort((a, b) => {
    const da = new Date(a.addedAt || 0)
    const db = new Date(b.addedAt || 0)
    return db - da
  })

  const filteredBooks = searchQuery
    ? bookList.filter(b =>
        b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.notes || []).some(n => n.text?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : bookList

  const selectedBook = selectedBookId ? books[selectedBookId] : null

  if (view === 'detail' && selectedBook) {
    return (
      <BookDetail
        book={selectedBook}
        onBack={() => { setView('list'); setSelectedBookId(null) }}
        onChange={(updatedBook) => setBooks(getAllBooks())}
        searchQuery={searchQuery}
      />
    )
  }

  function handleSaveBook(bookData) {
    saveBook(bookData)
    setBooks(getAllBooks())
    setAddBookOpen(false)
    setEditBook(null)
  }

  function handleDeleteBook(book) {
    deleteBook(book.id)
    setBooks(getAllBooks())
    setDeleteConfirm(null)
  }

  return (
    <div style={blt.wrap}>
      <div style={blt.toolbar}>
        <span style={blt.bookCount}>
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
        </span>
        <button style={blt.addBtn} onClick={() => setAddBookOpen(true)}>+ Add Book</button>
      </div>

      {filteredBooks.length === 0
        ? (
          <div style={blt.emptyState}>
            <span style={{ fontSize: 48 }}>📚</span>
            <div style={blt.emptyTitle}>Your Book Library</div>
            <div style={blt.emptySub}>
              {searchQuery
                ? 'No books match your search.'
                : 'Track books you\'re reading, save quotes, and write notes.'}
            </div>
            {!searchQuery && (
              <button style={blt.emptyBtn} onClick={() => setAddBookOpen(true)}>Add Your First Book</button>
            )}
          </div>
        )
        : (
          <div style={blt.grid}>
            {filteredBooks.map(book => (
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
  suggestionsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  suggestionItem: {
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
const bshare = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
    overflow: 'hidden',
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
  canvasWrap: {
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--parchment)',
    flexShrink: 0,
  },
  canvas: {
    maxWidth: '100%',
    maxHeight: 220,
    borderRadius: 6,
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    objectFit: 'contain',
  },
  controls: {
    padding: '12px 18px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ink-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: 4,
  },
  chipRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    background: 'var(--parchment)',
    border: '1px solid var(--border)',
    borderRadius: 99,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink)',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  chipActive: {
    background: 'var(--teal)',
    borderColor: 'var(--teal)',
    color: '#fff',
  },
  presetRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetSwatch: {
    width: 32,
    height: 32,
    borderRadius: 99,
    border: 'none',
    cursor: 'pointer',
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
  shareBtn: {
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
