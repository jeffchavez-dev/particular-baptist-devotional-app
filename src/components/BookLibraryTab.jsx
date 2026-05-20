import React, { useState, useEffect, useRef, useCallback } from 'react'
import { generateId, getAllBooks, saveBook, deleteBook, searchBookCovers } from '../lib/bookLibrary'
import { useAuth } from '../App'
import BookCelebration from './BookCelebration'
import { getMemorizeNote, setMemorizeNote } from '../lib/memorize'

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

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99, align = 'left') {
  if (!text) return y
  ctx.direction = 'ltr'   // prevent bidi bleed from Hebrew segments
  ctx.textAlign = align
  const drawX = align === 'right'  ? x + maxWidth
              : align === 'center' ? x + maxWidth / 2
              : x
  // Zero-width LTR mark — prevents bidi engine from reordering trailing punctuation
  const LTR = '‎'
  const words = text.split(' ').filter(Boolean)
  let line = '', lineCount = 0, currentY = y
  for (const word of words) {
    const testLine = line ? line + ' ' + word : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      if (lineCount >= maxLines - 1) { ctx.fillText(LTR + line + '…', drawX, currentY); return currentY }
      ctx.fillText(LTR + line, drawX, currentY)
      line = word; currentY += lineHeight; lineCount++
    } else { line = testLine }
  }
  if (line) { ctx.fillText(LTR + line, drawX, currentY); currentY += lineHeight }
  return currentY
}

function applyBg(ctx, preset, w, h, customBg) {
  if (preset.id === 'custom') {
    ctx.fillStyle = customBg || '#ffffff'
  } else if (preset.type === 'solid') {
    ctx.fillStyle = preset.bg
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, preset.bg[0])
    grad.addColorStop(1, preset.bg[1])
    ctx.fillStyle = grad
  }
  ctx.fillRect(0, 0, w, h)
}

async function drawBookNoteCard(canvas, note, book, preset, format, useCoverBg, scale, textPosition = 'top', textAlign = 'left', metaShown = {}, customBg, customText) {
  const w = format.w, h = format.h
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  let textColor   = preset.id === 'custom' ? (customText || '#1a1410') : preset.textColor
  let accentColor = preset.accentColor

  if (useCoverBg && (book.coverData || book.coverUrl)) {
    await new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const imgRatio = img.width / img.height
        const canvasRatio = w / h
        let sx, sy, sw, sh
        if (imgRatio > canvasRatio) {
          sh = img.height; sw = sh * canvasRatio; sx = (img.width - sw) / 2; sy = 0
        } else {
          sw = img.width; sh = sw / canvasRatio; sx = 0; sy = (img.height - sh) / 2
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
        ctx.fillStyle = 'rgba(10,8,5,0.72)'; ctx.fillRect(0, 0, w, h)
        textColor = '#f5f0e8'; accentColor = '#d4a84c'
        resolve()
      }
      img.onerror = () => { applyBg(ctx, preset, w, h, customBg); resolve() }
      img.src = book.coverData || book.coverUrl
    })
  } else {
    applyBg(ctx, preset, w, h, customBg)
  }

  const refDim = Math.min(w, h)
  const PAD    = Math.round(refDim * 0.08)
  ctx.textBaseline = 'alphabetic'

  // ── Top rule ──
  ctx.save()
  ctx.globalAlpha = 0.35; ctx.strokeStyle = accentColor
  ctx.lineWidth = Math.round(refDim * 0.003)
  ctx.beginPath(); ctx.moveTo(PAD, PAD * 0.6); ctx.lineTo(w - PAD, PAD * 0.6); ctx.stroke()
  ctx.restore()

  // ── Book title badge ──
  const badgeFontSize = Math.round(refDim * 0.028)
  ctx.font = `600 ${badgeFontSize}px 'DM Sans', sans-serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  const titleText  = book.title || 'Unknown Book'
  const badgePadX  = Math.round(refDim * 0.022)
  const badgePadY  = Math.round(refDim * 0.012)
  const badgeH     = badgeFontSize + badgePadY * 2
  const badgeW     = ctx.measureText(titleText).width + badgePadX * 2
  const badgeY     = Math.round(PAD * 0.75)
  const badgeR     = badgeH / 2
  const showBookTitle = metaShown.bookTitle !== false

  if (showBookTitle) {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = accentColor
    roundRect(ctx, PAD, badgeY, badgeW, badgeH, badgeR); ctx.fill(); ctx.restore()
    ctx.fillStyle = accentColor
    ctx.fillText(titleText, PAD + badgePadX, badgeY + badgePadY + badgeFontSize * 0.78)
  }

  // Note type badge
  const typeBadgeX = showBookTitle ? PAD + badgeW + Math.round(refDim * 0.015) : PAD
  const typeLabel  = note.type === 'quote' ? '❝ Quote' : '✍ Note'
  ctx.font = `500 ${badgeFontSize}px 'DM Sans', sans-serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = textColor
  roundRect(ctx, typeBadgeX, badgeY, ctx.measureText(typeLabel).width + badgePadX * 2, badgeH, badgeR); ctx.fill(); ctx.restore()
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.7
  ctx.fillText(typeLabel, typeBadgeX + badgePadX, badgeY + badgePadY + badgeFontSize * 0.78)
  ctx.globalAlpha = 1

  // ── Content block geometry (format-aware) ──
  const badgeBottom  = badgeY + badgeH
  const isLeft   = textPosition === 'left'
  const isRight  = textPosition === 'right'
  const isBottom = textPosition === 'bottom'
  const isCenter = textPosition === 'center'
  const colFrac    = format.id === 'wide' ? 0.48 : 0.52
  const bottomFrac = format.id === 'wide' ? 0.38 : format.id === 'story' ? 0.56 : 0.50
  const centerFrac = format.id === 'wide' ? 0.28 : format.id === 'story' ? 0.36 : 0.32
  const contentX    = isRight ? Math.round(w - PAD - (w - PAD * 2) * colFrac) : PAD
  const contentW    = (isLeft || isRight) ? Math.round((w - PAD * 2) * colFrac) : w - PAD * 2
  const blockStartY = isBottom ? Math.round(h * bottomFrac)
                    : isCenter ? Math.round(h * centerFrac)
                    : badgeBottom + Math.round(refDim * 0.08)

  // ── Category tags ──
  let catBottom = blockStartY
  const showCategory = metaShown.category !== false && book.labels?.length
  if (showCategory) {
    const catSz = Math.round(refDim * 0.020)
    ctx.font = `500 ${catSz}px 'DM Sans', sans-serif`
    ctx.fillStyle = accentColor; ctx.globalAlpha = 0.7
    wrapText(ctx, book.labels.join(' · '), contentX, blockStartY, contentW, catSz * 1.5, 1, textAlign)
    ctx.globalAlpha = 1
    catBottom = blockStartY + catSz * 1.5
  }

  // ── Decorative open-quote — always left-anchored, always LTR ──
  const textY = catBottom
  const quoteFontSize = Math.round(refDim * 0.18)
  ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = accentColor
  ctx.font = `bold ${quoteFontSize}px Georgia, serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.fillText('”', contentX - Math.round(refDim * 0.01), textY + quoteFontSize * 0.75)
  ctx.restore()

  // ── Main text ──
  const mainFontSize   = Math.round(refDim * 0.048 * scale)
  const mainLineHeight = mainFontSize * 1.55
  const maxLines       = Math.max(3, Math.floor((h * 0.52) / mainLineHeight))
  ctx.fillStyle = textColor
  if (note.type === 'quote') {
    ctx.font = `italic ${mainFontSize}px Georgia, serif`
  } else {
    ctx.font = `${mainFontSize}px 'DM Sans', sans-serif`
  }
  const endY = wrapText(ctx, note.text || '', contentX, textY, contentW, mainLineHeight, maxLines, textAlign)

  // ── Author attribution ──
  let finalBottom = endY
  const showAuthor = metaShown.author !== false && book.author
  if (showAuthor) {
    const attrFontSize = Math.round(refDim * 0.032)
    const attrY        = endY + Math.round(refDim * 0.035)
    ctx.fillStyle = accentColor
    ctx.font = `500 ${attrFontSize}px 'DM Sans', sans-serif`
    wrapText(ctx, `— ${book.author}`, contentX, attrY, contentW, attrFontSize * 1.4, 1, textAlign)
    finalBottom = attrY + attrFontSize * 0.3
    const locParts = []
    if (note.page) locParts.push(`p. ${note.page}`)
    if (note.percent != null) locParts.push(`${note.percent}%`)
    if (locParts.length) {
      const subFontSize = Math.round(refDim * 0.026)
      ctx.font = `${subFontSize}px 'DM Sans', sans-serif`
      ctx.fillStyle = textColor; ctx.globalAlpha = 0.5
      wrapText(ctx, locParts.join(' · '), contentX, attrY + attrFontSize * 1.6, contentW, subFontSize * 1.4, 1, textAlign)
      ctx.globalAlpha = 1
      finalBottom = attrY + attrFontSize * 1.6 + subFontSize * 0.3
    }
  }

  // ── Bottom rule (dynamic) ──
  const bottomRuleY = Math.min(Math.max(finalBottom + refDim * 0.065, h * 0.68), h * 0.93)
  ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = accentColor
  ctx.lineWidth = Math.round(refDim * 0.003)
  ctx.beginPath(); ctx.moveTo(PAD, bottomRuleY); ctx.lineTo(w - PAD, bottomRuleY); ctx.stroke()
  ctx.restore()

  // ── Logo — FIXED at bottom-right corner ──
  const logoImg = await getLogoImg()
  if (logoImg) {
    const logoSize = Math.round(refDim * 0.055)
    const logoX    = w - PAD - logoSize
    const logoY    = h - Math.round(PAD * 0.65) - logoSize
    ctx.save(); ctx.globalAlpha = 0.62
    ctx.beginPath()
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
    ctx.restore()
  }
}

/* ── Presets & Formats ──────────────────────────────────────────────────────── */

const SHARE_PRESETS = [
  { id: 'ink',       label: 'Deep Ink',     type: 'solid',    bg: '#1a1410',              textColor: '#f5f0e8', accentColor: '#c9a84c' },
  { id: 'parchment', label: 'Parchment',    type: 'gradient', bg: ['#f5f0e8', '#ddd5c5'], textColor: '#1a1410', accentColor: '#8a6d2e' },
  { id: 'ancient',   label: '17th Century', type: 'gradient', bg: ['#d8b86a', '#9a7020'], textColor: '#0e0400', accentColor: '#7a1408' },
  { id: 'forest',    label: 'Forest',       type: 'gradient', bg: ['#1a3a2a', '#0d2418'], textColor: '#e8f5f0', accentColor: '#7ec8b0' },
  { id: 'royal',     label: 'Royal',        type: 'gradient', bg: ['#2d1b4e', '#1a0f2e'], textColor: '#e8e0f8', accentColor: '#a87ee8' },
  { id: 'teal',      label: 'Deep Teal',    type: 'gradient', bg: ['#1a3a38', '#0d2220'], textColor: '#e0f5f4', accentColor: '#7ecfc8' },
  { id: 'amber',     label: 'Amber',        type: 'gradient', bg: ['#4a3210', '#2a1e08'], textColor: '#f5ece0', accentColor: '#d4a84c' },
  { id: 'custom',    label: 'Custom',       type: 'solid',    bg: '#ffffff',              textColor: '#1a1410', accentColor: '#8a6d2e' },
]

const SHARE_FORMATS = [
  { id: 'square', label: 'Square',    w: 1080, h: 1080 },
  { id: 'story',  label: 'Story',     w: 1080, h: 1920 },
  { id: 'wide',   label: 'Landscape', w: 1920, h: 1080 },
]

/* ── BookNoteShareModal ─────────────────────────────────────────────────────── */

export function BookNoteShareModal({ note, book, onClose }) {
  const canvasRef  = useRef(null)
  const [preset,       setPreset]       = useState(SHARE_PRESETS[0])
  const [format,       setFormat]       = useState(SHARE_FORMATS[0])
  const hasCover = !!(book.coverData || book.coverUrl)
  const [useCoverBg,   setUseCoverBg]   = useState(hasCover)
  const [customBg,     setCustomBg]     = useState('#f5f0e8')
  const [customText,   setCustomText]   = useState('#1a1410')
  const [scale,        setScale]        = useState(1.0)
  const [sharing,      setSharing]      = useState(false)
  const [textPosition, setTextPosition] = useState('top')
  const [textAlign,    setTextAlign]    = useState('left')
  const [metaShown,    setMetaShown]    = useState({
    bookTitle: true,
    author:    true,
    category:  !!(book.labels?.length),
  })

  const SCALE_MIN = 0.5, SCALE_MAX = 1.8, SCALE_STEP = 0.1

  const metaLabels = { bookTitle: 'Book Title', author: 'Author', category: 'Category' }
  const metaKeys   = Object.entries({ bookTitle: true, author: !!book.author, category: !!(book.labels?.length) })
    .filter(([, v]) => v).map(([k]) => k)
  const toggleMeta = key => setMetaShown(prev => ({ ...prev, [key]: prev[key] === false }))

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    drawBookNoteCard(canvas, note, book, preset, format, useCoverBg, scale, textPosition, textAlign, metaShown, customBg, customText)
    const t = setTimeout(() => {
      if (canvasRef.current) drawBookNoteCard(canvasRef.current, note, book, preset, format, useCoverBg, scale, textPosition, textAlign, metaShown, customBg, customText)
    }, 120)
    return () => clearTimeout(t)
  }, [note, book, preset, format, useCoverBg, customBg, customText, scale, textPosition, textAlign, metaShown])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  function fallbackDownload(blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `book-note-${Date.now()}.png`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function shareNative() {
    setSharing(true)
    try {
      const blob = await new Promise(r => canvasRef.current.toBlob(r, 'image/png'))
      const file = new File([blob], `book-note-${Date.now()}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: book.title || 'Book Note' })
      } else { fallbackDownload(blob) }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        const blob = await new Promise(r => canvasRef.current.toBlob(r, 'image/png'))
        fallbackDownload(blob)
      }
    } finally { setSharing(false) }
  }

  const selectStyle = {
    appearance:'none', WebkitAppearance:'none',
    padding:'7px 30px 7px 10px', borderRadius:8, fontSize:12, fontWeight:600,
    fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
    border:'1.5px solid var(--border)',
    background:`var(--parchment) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23888' d='M5 7L1 3h8z'/%3E%3C/svg%3E") no-repeat right 8px center`,
    color:'var(--ink)', outline:'none', width:'100%',
  }

  return (
    <div style={bm.overlay} onClick={onClose}>
      <div style={bm.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={bm.header}>
          <div>
            <span style={bm.title}>Share Note Card</span>
            <span style={bm.titleSub}> — {note.type === 'quote' ? 'Quote' : 'Reflection'}</span>
          </div>
          <button onClick={onClose} style={bm.closeBtn} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={bm.body}>

          {/* Canvas preview */}
          <div style={bm.preview}>
            <canvas ref={canvasRef} style={{ maxWidth:'100%', maxHeight: format.id === 'wide' ? 220 : 340, borderRadius:8, boxShadow:'0 4px 24px rgba(0,0,0,0.25)', display:'block' }} />
          </div>

          {/* Format */}
          <div style={bm.section}>
            <div style={bm.label}>Format</div>
            <div style={bm.row}>
              {SHARE_FORMATS.map(f => (
                <button key={f.id} style={{ ...bm.chip, ...(format.id === f.id ? bm.chipActive : {}) }} onClick={() => setFormat(f)}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Position + Align dropdowns */}
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ ...bm.section, flex:1 }}>
              <label style={bm.label} htmlFor="bn-position">Text Position</label>
              <select id="bn-position" value={textPosition} onChange={e => setTextPosition(e.target.value)} style={selectStyle}>
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div style={{ ...bm.section, flex:1 }}>
              <label style={bm.label} htmlFor="bn-align">Text Align</label>
              <select id="bn-align" value={textAlign} onChange={e => setTextAlign(e.target.value)} style={selectStyle}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          {/* Text Size */}
          <div style={bm.section}>
            <div style={bm.label}>Text Size <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--ink-faint)'}}>— smaller fits more text</span></div>
            <div style={{...bm.row, alignItems:'center'}}>
              <button onClick={() => setScale(s => Math.max(SCALE_MIN, +(s-SCALE_STEP).toFixed(2)))} disabled={scale <= SCALE_MIN} style={{...bm.scaleBtn, opacity: scale <= SCALE_MIN ? 0.35 : 1}}>A<sup style={{fontSize:'0.55em'}}>−</sup></button>
              <span style={bm.scaleCurrent}>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(SCALE_MAX, +(s+SCALE_STEP).toFixed(2)))} disabled={scale >= SCALE_MAX} style={{...bm.scaleBtn, opacity: scale >= SCALE_MAX ? 0.35 : 1}}>A<sup style={{fontSize:'0.55em'}}>+</sup></button>
            </div>
          </div>

          {/* Show Fields */}
          {metaKeys.length > 0 && (
            <div style={bm.section}>
              <div style={bm.label}>Show Fields</div>
              <div style={bm.fieldsList}>
                {metaKeys.map(key => {
                  const on = metaShown[key] !== false
                  return (
                    <label key={key} style={bm.fieldRow}>
                      <span style={{fontSize:12, color:'var(--ink-muted)', flex:1}}>{metaLabels[key]}</span>
                      <div
                        style={{...bm.toggle, background: on ? 'var(--teal)' : 'var(--border-strong)'}}
                        onClick={() => toggleMeta(key)}
                        role="switch" aria-checked={on} tabIndex={0}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleMeta(key)}
                      >
                        <div style={{...bm.toggleThumb, transform: on ? 'translateX(14px)' : 'translateX(2px)'}} />
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Background */}
          <div style={bm.section}>
            <div style={bm.label}>Background</div>
            {/* Book cover toggle */}
            {hasCover && (
              <div style={bm.fieldsList}>
                <label style={bm.fieldRow}>
                  <span style={{fontSize:12, color:'var(--ink-muted)', flex:1}}>Use book cover as background</span>
                  <div
                    style={{...bm.toggle, background: useCoverBg ? 'var(--teal)' : 'var(--border-strong)'}}
                    onClick={() => setUseCoverBg(v => !v)}
                    role="switch" aria-checked={useCoverBg} tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setUseCoverBg(v => !v)}
                  >
                    <div style={{...bm.toggleThumb, transform: useCoverBg ? 'translateX(14px)' : 'translateX(2px)'}} />
                  </div>
                </label>
              </div>
            )}
            {/* Preset swatches — only when not using cover */}
            {!useCoverBg && (
              <>
                <div style={bm.row}>
                  {SHARE_PRESETS.map(p => (
                    <button key={p.id} title={p.label} onClick={() => setPreset(p)} style={{
                      ...bm.swatch,
                      background: p.id === 'custom' ? 'conic-gradient(#ff6b6b 0deg,#ffd93d 90deg,#6bcb77 180deg,#4d96ff 270deg,#ff6b6b 360deg)' : Array.isArray(p.bg) ? `linear-gradient(135deg,${p.bg[0]},${p.bg[1]})` : p.bg,
                      outline: preset.id === p.id ? '2.5px solid var(--teal)' : '2px solid transparent', outlineOffset:2,
                    }} />
                  ))}
                </div>
                <div style={bm.presetName}>{preset.label}</div>
              </>
            )}
          </div>

          {/* Custom colors */}
          {!useCoverBg && preset.id === 'custom' && (
            <div style={bm.section}>
              <div style={bm.colorRow}>
                <label style={bm.colorLabel}><span style={bm.label}>Background</span><input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} style={bm.colorInput} /></label>
                <label style={bm.colorLabel}><span style={bm.label}>Text color</span><input type="color" value={customText} onChange={e => setCustomText(e.target.value)} style={bm.colorInput} /></label>
              </div>
            </div>
          )}

          {/* Tip */}
          <div style={bm.tip}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0,marginTop:1}}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--teal)" strokeWidth="1.2"/>
              <path d="M6.5 5.5v4M6.5 4h.01" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {canShare
              ? <span><strong>On mobile:</strong> tap <em>Share / Save Image</em> to save to Photos or post to Instagram.</span>
              : <span><strong>On desktop:</strong> the PNG downloads to your computer.</span>
            }
          </div>
        </div>

        {/* Footer */}
        <div style={bm.footer}>
          <button onClick={onClose} className="btn btn-ghost" style={{fontSize:13}}>Cancel</button>
          {!canShare && (
            <button onClick={() => canvasRef.current.toBlob(blob => fallbackDownload(blob), 'image/png')} className="btn btn-outline" style={{fontSize:13, gap:6}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 7l3 3 3-3M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Download PNG
            </button>
          )}
          <button onClick={shareNative} className="btn btn-primary" disabled={sharing} style={{fontSize:13, gap:6}}>
            {sharing
              ? <span className="spinner" style={{width:14,height:14}} />
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v5M4.5 4.5L7 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 7v4.5h8V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            {canShare ? 'Share / Save Image' : 'Save PNG'}
          </button>
        </div>
      </div>
    </div>
  )
}

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

function NoteCard({ note, book, onEdit, onDelete, onShare, onCopy, onMemorize }) {
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
              <button style={bnote.menuItem} onClick={() => { onMemorize?.(note); setMenuOpen(false) }}>Memorize</button>
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
  const [shareNote, setShareNote] = useState(null)
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
    const updatedNotes = (book.notes || []).map(n =>
      n.id === editNote.id ? { ...n, ...noteData, updatedAt: new Date().toISOString() } : n
    )
    const updated = { ...book, notes: updatedNotes }
    mutateBook(updated)
    setEditNote(null)
    checkAutoComplete(updated)
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
            onShare={setShareNote}
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
/* Unified share modal styles — mirrors ShareCardModal's `m` object */
const bm = {
  overlay:     { position:'fixed', inset:0, background:'rgba(20,16,10,0.65)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 },
  modal:       { background:'white', borderRadius:14, maxWidth:460, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'92vh', overflow:'hidden' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  title:       { fontSize:15, fontWeight:600, color:'var(--ink)' },
  titleSub:    { fontSize:13, color:'var(--ink-faint)', fontWeight:400 },
  closeBtn:    { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:5, borderRadius:6 },
  body:        { padding:'20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 },
  preview:     { display:'flex', justifyContent:'center', alignItems:'center', background:'#e8e8e8', borderRadius:10, padding:6 },
  section:     { display:'flex', flexDirection:'column', gap:6 },
  label:       { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' },
  row:         { display:'flex', flexWrap:'wrap', gap:8 },
  chip:        { padding:'6px 14px', borderRadius:99, border:'1.5px solid var(--border)', background:'var(--parchment)', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", color:'var(--ink)', transition:'all 0.15s' },
  chipActive:  { borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)' },
  scaleBtn:    { width:40, height:40, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', cursor:'pointer', fontFamily:"'Georgia',serif", display:'flex', alignItems:'center', justifyContent:'center', background:'var(--parchment)', color:'var(--ink)' },
  scaleCurrent:{ flex:1, textAlign:'center', fontSize:12, color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif", fontWeight:600 },
  fieldsList:  { display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' },
  fieldRow:    { display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--parchment)', cursor:'pointer', borderBottom:'1px solid var(--border)' },
  toggle:      { width:30, height:18, borderRadius:9, position:'relative', flexShrink:0, cursor:'pointer', transition:'background 0.2s' },
  toggleThumb: { position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'transform 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)' },
  swatch:      { width:34, height:34, borderRadius:8, cursor:'pointer', flexShrink:0, border:'none', transition:'outline 0.12s' },
  presetName:  { fontSize:12, color:'var(--ink-muted)', marginTop:-2 },
  colorRow:    { display:'flex', gap:20 },
  colorLabel:  { display:'flex', flexDirection:'column', gap:6, cursor:'pointer' },
  colorInput:  { width:52, height:38, padding:2, border:'1.5px solid var(--border)', borderRadius:8, cursor:'pointer', background:'none' },
  tip:         { display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'var(--teal-light)', borderRadius:'var(--radius)', fontSize:12, color:'var(--ink-muted)', lineHeight:1.55 },
  footer:      { display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 },
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
