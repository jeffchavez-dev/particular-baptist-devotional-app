import React, { useEffect, useRef, useState } from 'react'

/* ── Background presets ── */
const PRESETS = [
  { id:'ink',       label:'Deep Ink',    type:'solid',    bg:'#1a1410',               textColor:'#f5f0e8', accentColor:'#c9a84c' },
  { id:'parchment', label:'Parchment',   type:'gradient', bg:['#f5f0e8','#ddd5c5'],  textColor:'#1a1410', accentColor:'#8a6d2e' },
  { id:'forest',    label:'Forest',      type:'gradient', bg:['#1a3a2a','#0d2418'],  textColor:'#e8f5f0', accentColor:'#7ec8b0' },
  { id:'royal',     label:'Royal',       type:'gradient', bg:['#2d1b4e','#1a0f2e'],  textColor:'#e8e0f8', accentColor:'#a87ee8' },
  { id:'teal',      label:'Deep Teal',   type:'gradient', bg:['#1a3a38','#0d2220'],  textColor:'#e0f5f4', accentColor:'#7ecfc8' },
  { id:'amber',     label:'Amber',       type:'gradient', bg:['#4a3210','#2a1e08'],  textColor:'#f5ece0', accentColor:'#d4a84c' },
  { id:'custom',    label:'Custom',      type:'solid',    bg:'#ffffff',              textColor:'#1a1410', accentColor:'#8a6d2e' },
]

/* Formats — standard social media dimensions */
const FORMATS = [
  { id:'square', label:'Square (1:1)',    w:1080, h:1080, hint:'Instagram post, Facebook post' },
  { id:'story',  label:'Story (9:16)',    w:1080, h:1920, hint:'Instagram & Facebook story' },
  { id:'wide',   label:'Landscape (16:9)', w:1920, h:1080, hint:'Facebook cover, Twitter' },
]

const SRC_COLORS = {
  '2LBCF':    { bg:'#3d2b6b', text:'#c4a8ff' },
  'Catechism':{ bg:'#1a3a38', text:'#7ecfc8' },
  '1LBCF':    { bg:'#4a2e0a', text:'#d4a84c' },
  'Review':   { bg:'#2a2a2a', text:'#aaaaaa' },
}

/* ── Canvas helpers ── */
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

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  if (!text) return y
  const paragraphs = text.split(/\n+/)
  let currentY = y
  let linesDrawn = 0
  for (const para of paragraphs) {
    const words = para.split(' ').filter(Boolean)
    let line = ''
    for (let i = 0; i < words.length; i++) {
      const testLine = line ? line + ' ' + words[i] : words[i]
      if (ctx.measureText(testLine).width > maxWidth && line) {
        if (linesDrawn >= maxLines - 1) { ctx.fillText(line + '\u2026', x, currentY); return currentY }
        ctx.fillText(line, x, currentY)
        line = words[i]; currentY += lineHeight; linesDrawn++
      } else { line = testLine }
    }
    if (line) {
      if (linesDrawn >= maxLines) { ctx.fillText(line + '\u2026', x, currentY); return currentY }
      ctx.fillText(line, x, currentY)
      currentY += lineHeight; linesDrawn++
    }
  }
  return currentY
}

/* ── Shared sub-routines ── */
function applyBackground(ctx, preset, w, h, customBg) {
  if (preset.type === 'gradient' && Array.isArray(preset.bg)) {
    const grd = ctx.createLinearGradient(0, 0, 0, h)
    grd.addColorStop(0, preset.bg[0]); grd.addColorStop(1, preset.bg[1])
    ctx.fillStyle = grd
  } else {
    ctx.fillStyle = preset.id === 'custom' ? (customBg || '#ffffff') : preset.bg
  }
  ctx.fillRect(0, 0, w, h)
}

function drawTopChrome(ctx, w, h, PAD, accentColor, source) {
  /* Rule */
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, h * 0.1); ctx.lineTo(w - PAD, h * 0.1); ctx.stroke()
  ctx.globalAlpha = 1

  /* P.B. monogram */
  ctx.fillStyle = accentColor; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.font = `bold ${Math.round(w * 0.026)}px 'DM Sans','Helvetica Neue',sans-serif`
  ctx.fillText('P.B.', PAD, h * 0.088)

  /* Source badge */
  const srcColors = SRC_COLORS[source] || { bg:'#333', text:'#eee' }
  const bFontSz = Math.round(w * 0.019)
  ctx.font = `bold ${bFontSz}px 'DM Sans','Helvetica Neue',sans-serif`
  const bLabel = source || 'Note'
  const bPadX = w * 0.02, bPadY = w * 0.013
  const bH = bFontSz + bPadY * 2, bW = ctx.measureText(bLabel).width + bPadX * 2
  const sourceY = h * 0.155
  ctx.fillStyle = srcColors.bg
  roundRect(ctx, PAD, sourceY - bFontSz - bPadY, bW, bH, bH / 2)
  ctx.fill()
  ctx.fillStyle = srcColors.text
  ctx.fillText(bLabel, PAD + bPadX, sourceY)
  return sourceY
}

function drawBottomChrome(ctx, w, h, PAD, accentColor, textColor) {
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, h * 0.921); ctx.lineTo(w - PAD, h * 0.921); ctx.stroke()
  ctx.globalAlpha = 1

  const fSz = Math.round(w * 0.019)
  ctx.font = `${fSz}px 'DM Sans','Helvetica Neue',sans-serif`
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.45; ctx.textAlign = 'left'
  ctx.fillText('Particular Baptist Devotional', PAD, h * 0.94)
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.65; ctx.textAlign = 'right'
  ctx.fillText('pb-devotional.vercel.app', w - PAD, h * 0.94)
  ctx.globalAlpha = 1; ctx.textAlign = 'left'
}

/* ── Reading / Note card ── */
function drawReadingCard(ctx, card, w, h, PAD, textColor, accentColor) {
  const contentW = w - PAD * 2
  const sourceY  = drawTopChrome(ctx, w, h, PAD, accentColor, card.source)

  /* Subtitle */
  const subSz = Math.round(w * 0.022)
  ctx.font = `${subSz}px 'DM Sans','Helvetica Neue',sans-serif`
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.55
  ctx.fillText(card.subtitle || '', PAD, sourceY + subSz * 2)
  ctx.globalAlpha = 1

  /* Title */
  const titleSz = Math.round(w * 0.048)
  const titleY  = sourceY + subSz * 2 + titleSz * 1.4
  ctx.fillStyle = textColor
  ctx.font = `600 ${titleSz}px 'Georgia','Times New Roman',serif`
  const titleBottom = wrapText(ctx, card.title || '', PAD, titleY, contentW, titleSz * 1.25, 3)

  /* Divider */
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.25; ctx.lineWidth = 1
  const divY = titleBottom + w * 0.025
  ctx.beginPath(); ctx.moveTo(PAD, divY); ctx.lineTo(w - PAD, divY); ctx.stroke()
  ctx.globalAlpha = 1

  /* Optional label */
  let contentY = divY + w * 0.06
  if (card.label) {
    ctx.fillStyle = accentColor
    ctx.font = `bold ${Math.round(w * 0.018)}px 'DM Sans','Helvetica Neue',sans-serif`
    ctx.fillText(card.label.toUpperCase(), PAD, contentY)
    contentY += w * 0.05
  }

  /* Decorative open-quote */
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.22
  ctx.font = `${Math.round(w * 0.13)}px 'Georgia',serif`
  ctx.fillText('\u201C', PAD - w * 0.008, contentY + w * 0.045)
  ctx.globalAlpha = 1

  /* Content body */
  const cSz = Math.round(w * 0.031), cLineH = cSz * 1.75
  const maxLines = Math.max(3, Math.floor((h * 0.52) / cLineH))
  ctx.fillStyle = textColor
  ctx.font = `italic ${cSz}px 'Georgia','Times New Roman',serif`
  wrapText(ctx, card.text || '', PAD + w * 0.04, contentY + w * 0.02, contentW - w * 0.04, cLineH, maxLines)

  drawBottomChrome(ctx, w, h, PAD, accentColor, textColor)
}

/* ── Quote card — quote text is the hero ── */
function drawQuoteCard(ctx, card, w, h, PAD, textColor, accentColor) {
  const contentW = w - PAD * 2
  const sourceY  = drawTopChrome(ctx, w, h, PAD, accentColor, card.source)

  /* Day subtitle */
  const subSz = Math.round(w * 0.02)
  ctx.font = `${subSz}px 'DM Sans','Helvetica Neue',sans-serif`
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.5
  ctx.fillText(card.subtitle || '', PAD, sourceY + subSz * 2)
  ctx.globalAlpha = 1

  /* Section heading (label) */
  let headY = sourceY + subSz * 4.5
  if (card.label) {
    ctx.fillStyle = accentColor
    ctx.font = `bold ${Math.round(w * 0.02)}px 'DM Sans','Helvetica Neue',sans-serif`
    ctx.fillText(card.label.toUpperCase(), PAD, headY)
    headY += w * 0.046
  }

  /* Large decorative open-quote */
  const qMarkSz = Math.round(w * 0.19)
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.2
  ctx.font = `${qMarkSz}px 'Georgia',serif`
  ctx.fillText('\u201C', PAD - w * 0.01, headY + qMarkSz * 0.52)
  ctx.globalAlpha = 1

  /* Quote text — most prominent */
  const qSz = Math.round(w * 0.038), qLineH = qSz * 1.85
  const maxLines = Math.max(4, Math.floor((h * 0.54) / qLineH))
  ctx.fillStyle = textColor
  ctx.font = `italic ${qSz}px 'Georgia','Times New Roman',serif`
  const quoteBottom = wrapText(ctx, card.text || '', PAD + w * 0.04, headY + w * 0.04, contentW - w * 0.06, qLineH, maxLines)

  /* Closing quote mark */
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.25
  ctx.font = `${Math.round(w * 0.07)}px 'Georgia',serif`
  ctx.textAlign = 'right'
  ctx.fillText('\u201D', w - PAD + w * 0.005, quoteBottom)
  ctx.globalAlpha = 1; ctx.textAlign = 'left'

  /* Attribution */
  const attribY = Math.min(quoteBottom + w * 0.07, h * 0.87)
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.75
  ctx.font = `500 ${Math.round(w * 0.024)}px 'DM Sans','Helvetica Neue',sans-serif`
  if (card.title) ctx.fillText(`\u2014 ${card.title}`, PAD, attribY)
  if (card.subtitle2) {
    ctx.globalAlpha = 0.5
    ctx.font = `italic ${Math.round(w * 0.021)}px 'Georgia',serif`
    ctx.fillText(card.subtitle2, PAD, attribY + w * 0.042)
  }
  ctx.globalAlpha = 1

  drawBottomChrome(ctx, w, h, PAD, accentColor, textColor)
}

/* ── Master draw dispatcher ── */
function drawCard(canvas, card, preset, format, customBg, customText) {
  const { w, h } = format
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const PAD         = Math.round(w * 0.08)
  const textColor   = preset.id === 'custom' ? (customText || '#1a1410') : preset.textColor
  const accentColor = preset.accentColor

  applyBackground(ctx, preset, w, h, customBg)
  ctx.textBaseline = 'alphabetic'

  if (card.type === 'quote') {
    drawQuoteCard(ctx, card, w, h, PAD, textColor, accentColor)
  } else {
    drawReadingCard(ctx, card, w, h, PAD, textColor, accentColor)
  }
}

/* ── Modal component ── */
export default function ShareCardModal({ isOpen, onClose, card }) {
  const canvasRef               = useRef(null)
  const [preset,    setPreset]  = useState(PRESETS[0])
  const [format,    setFormat]  = useState(FORMATS[0])
  const [customBg,  setCustomBg]  = useState('#f5f0e8')
  const [customText,setCustomText]= useState('#1a1410')

  /* Redraw whenever inputs change */
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !card) return
    document.fonts.ready.then(() => {
      drawCard(canvasRef.current, card, preset, format, customBg, customText)
    })
  }, [isOpen, card, preset, format, customBg, customText])

  /* ESC to close */
  useEffect(() => {
    if (!isOpen) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const [sharing, setSharing] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  /* Build a PNG blob from the canvas */
  function getBlob() {
    return new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
  }

  function filename() {
    const slug = card?.type === 'quote' ? 'quote' : card?.type === 'note' ? 'note' : 'reading'
    return `pb-${slug}-day${card?.day || ''}-${preset.id}.png`
  }

  /* On mobile: opens native share sheet → Save Image → goes to Camera Roll */
  async function shareNative() {
    if (!canvasRef.current) return
    setSharing(true)
    try {
      const blob = await getBlob()
      const file = new File([blob], filename(), { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Particular Baptist Devotional' })
      } else {
        // canShare said no (e.g. desktop Chrome) — fall back to download
        fallbackDownload(blob)
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // Share failed for a real reason — try download instead
        const blob = await getBlob()
        fallbackDownload(blob)
      }
    } finally {
      setSharing(false)
    }
  }

  /* On desktop: plain file download */
  async function fallbackDownload(blob) {
    const b = blob || await getBlob()
    const url = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = url; a.download = filename()
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!isOpen) return null

  const typeLabel = card?.type === 'quote' ? 'Quote' : card?.type === 'note' ? 'My Reflection' : card?.source

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={m.header}>
          <div>
            <span style={m.title}>Share Card</span>
            <span style={m.titleSub}> — {typeLabel}</span>
          </div>
          <button onClick={onClose} style={m.closeBtn} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={m.body}>

          {/* Canvas preview */}
          <div style={m.preview}>
            <canvas
              ref={canvasRef}
              style={{ maxWidth:'100%', maxHeight:300, borderRadius:8, boxShadow:'0 4px 24px rgba(0,0,0,0.25)' }}
            />
          </div>

          {/* Format */}
          <div style={m.section}>
            <div style={m.label}>Format</div>
            <div style={m.row}>
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  title={f.hint}
                  style={{ ...m.chip, ...(format.id === f.id ? m.chipActive : {}) }}
                  onClick={() => setFormat(f)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={m.hint}>{format.hint}</div>
          </div>

          {/* Background */}
          <div style={m.section}>
            <div style={m.label}>Background</div>
            <div style={m.row}>
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={() => setPreset(p)}
                  style={{
                    ...m.swatch,
                    background: p.id === 'custom'
                      ? 'conic-gradient(#ff6b6b 0deg,#ffd93d 90deg,#6bcb77 180deg,#4d96ff 270deg,#ff6b6b 360deg)'
                      : Array.isArray(p.bg) ? `linear-gradient(135deg,${p.bg[0]},${p.bg[1]})` : p.bg,
                    outline: preset.id === p.id ? '2.5px solid var(--teal)' : '2px solid transparent',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <div style={m.presetName}>{preset.label}</div>
          </div>

          {/* Custom color pickers */}
          {preset.id === 'custom' && (
            <div style={m.section}>
              <div style={m.colorRow}>
                <label style={m.colorLabel}>
                  <span style={m.label}>Background</span>
                  <input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} style={m.colorInput} />
                </label>
                <label style={m.colorLabel}>
                  <span style={m.label}>Text color</span>
                  <input type="color" value={customText} onChange={e => setCustomText(e.target.value)} style={m.colorInput} />
                </label>
              </div>
            </div>
          )}

          {/* Sharing tip — adapts to device */}
          <div style={m.tip}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0,marginTop:1}}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--teal)" strokeWidth="1.2"/>
              <path d="M6.5 5.5v4M6.5 4h.01" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {canShare
              ? <span><strong>On mobile:</strong> tap <em>Share / Save Image</em> below — the iOS/Android share sheet opens so you can save straight to Photos or post directly to Instagram or Facebook.</span>
              : <span><strong>On desktop:</strong> the PNG downloads to your computer. To share on social media, upload it from your Downloads folder.</span>
            }
          </div>
        </div>

        {/* Footer */}
        <div style={m.footer}>
          <button onClick={onClose} className="btn btn-ghost" style={{fontSize:13}}>Cancel</button>
          {/* Desktop fallback — plain download */}
          {!canShare && (
            <button onClick={() => fallbackDownload()} className="btn btn-outline" style={{fontSize:13, gap:6}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v7M4 7l3 3 3-3M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download PNG
            </button>
          )}
          {/* Primary — share sheet on mobile, also triggers download on desktop if canShare is somehow true */}
          <button
            onClick={shareNative}
            className="btn btn-primary"
            disabled={sharing}
            style={{fontSize:13, gap:6}}
          >
            {sharing
              ? <span className="spinner" style={{width:14,height:14}} />
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v5M4.5 4.5L7 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 7v4.5h8V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
            {canShare ? 'Share / Save Image' : 'Save PNG'}
          </button>
        </div>
      </div>
    </div>
  )
}

const m = {
  overlay: {
    position:'fixed', inset:0, background:'rgba(20,16,10,0.65)',
    zIndex:200, display:'flex', alignItems:'center', justifyContent:'center',
    backdropFilter:'blur(4px)', padding:16,
  },
  modal: {
    background:'white', borderRadius:14, maxWidth:480, width:'100%',
    boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column',
    maxHeight:'92vh', overflow:'hidden',
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0,
  },
  title:    { fontSize:15, fontWeight:600, color:'var(--ink)' },
  titleSub: { fontSize:13, color:'var(--ink-faint)', fontWeight:400 },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', padding:5, borderRadius:6,
  },
  body: { padding:'20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 },
  preview: {
    display:'flex', justifyContent:'center', alignItems:'center',
    background:'#e8e8e8', borderRadius:10, padding:12, minHeight:120,
  },
  section: { display:'flex', flexDirection:'column', gap:8 },
  label: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' },
  hint:  { fontSize:11, color:'var(--ink-faint)', marginTop:-2 },
  row:   { display:'flex', flexWrap:'wrap', gap:8 },
  chip: {
    padding:'6px 14px', borderRadius:99, border:'1.5px solid var(--border)',
    background:'var(--parchment)', fontSize:12, cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", color:'var(--ink)', transition:'all 0.15s',
  },
  chipActive: { borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)' },
  swatch: {
    width:34, height:34, borderRadius:8, cursor:'pointer', flexShrink:0, border:'none',
    transition:'outline 0.12s',
  },
  presetName: { fontSize:12, color:'var(--ink-muted)', marginTop:-2 },
  colorRow:   { display:'flex', gap:20 },
  colorLabel: { display:'flex', flexDirection:'column', gap:6, cursor:'pointer' },
  colorInput: {
    width:52, height:38, padding:2, border:'1.5px solid var(--border)',
    borderRadius:8, cursor:'pointer', background:'none',
  },
  tip: {
    display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px',
    background:'var(--teal-light)', borderRadius:'var(--radius)',
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.55,
  },
  footer: {
    display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8,
    padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0,
  },
}
