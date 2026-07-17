import React, { useEffect, useMemo, useRef, useState } from 'react'

/* ── Logo preloader ── */
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

/* ── Background presets ── */
const PRESETS = [
  { id:'ink',       label:'Deep Ink',      type:'solid',    bg:'#1a1410',              textColor:'#f5f0e8', accentColor:'#c9a84c' },
  { id:'parchment', label:'Parchment',     type:'gradient', bg:['#f5f0e8','#ddd5c5'], textColor:'#1a1410', accentColor:'#8a6d2e' },
  { id:'ancient',   label:'17th Century',  type:'gradient', bg:['#d8b86a','#9a7020'], textColor:'#0e0400', accentColor:'#7a1408' },
  { id:'forest',    label:'Forest',        type:'gradient', bg:['#1a3a2a','#0d2418'], textColor:'#e8f5f0', accentColor:'#7ec8b0' },
  { id:'royal',     label:'Royal',         type:'gradient', bg:['#2d1b4e','#1a0f2e'], textColor:'#e8e0f8', accentColor:'#a87ee8' },
  { id:'teal',      label:'Deep Teal',     type:'gradient', bg:['#1a3a38','#0d2220'], textColor:'#e0f5f4', accentColor:'#7ecfc8' },
  { id:'amber',     label:'Amber',         type:'gradient', bg:['#4a3210','#2a1e08'], textColor:'#f5ece0', accentColor:'#d4a84c' },
  { id:'custom',    label:'Custom',        type:'solid',    bg:'#ffffff',             textColor:'#1a1410', accentColor:'#8a6d2e' },
]

const CARD_SCALE_MIN     = 0.5
const CARD_SCALE_MAX     = 1.8
const CARD_SCALE_STEP    = 0.1
const CARD_SCALE_DEFAULT = 1.0

const FORMATS = [
  { id:'square', label:'Square (1:1)',      w:1080, h:1080, hint:'Instagram post, Facebook post' },
  { id:'story',  label:'Story (9:16)',      w:1080, h:1920, hint:'Instagram & Facebook story' },
  { id:'wide',   label:'Landscape (16:9)', w:1920, h:1080, hint:'Facebook cover, Twitter' },
]

const SRC_COLORS = {
  '2LBCF':    { bg:'#3d2b6b', text:'#c4a8ff' },
  'Catechism':{ bg:'#1a3a38', text:'#7ecfc8' },
  '1LBCF':    { bg:'#4a2e0a', text:'#d4a84c' },
  'Orthodox': { bg:'#2a1a3a', text:'#d4b8ff' },
  'Review':   { bg:'#2a2a2a', text:'#aaaaaa' },
  'KJV':      { bg:'#1e3a5f', text:'#a8c5e8' },
  'GNT':      { bg:'#1a2e5f', text:'#a8b8e8' },
  'HOT':      { bg:'#5f2b1a', text:'#e8c4a8' },
  'LXX':      { bg:'#2b3a1a', text:'#b8d4a8' },
  'ABAB':     { bg:'#1a3a2a', text:'#a8e8c5' },
  'CEBug':    { bg:'#3a1a2a', text:'#e8a8c5' },
  'NASB':     { bg:'#1a2a3a', text:'#a8c5d4' },
  'BSB':      { bg:'#1a3a30', text:'#a8e8d4' },
  'GNV':      { bg:'#3a2a1a', text:'#d4c5a8' },
  'RV':       { bg:'#2a3a1a', text:'#c5d4a8' },
  'ILO':      { bg:'#3a1a10', text:'#f0c8a0' },
}

// Hebrew block U+0590–U+05FF + Hebrew presentation forms U+FB1D–U+FB4E
// Previous range [יִ-ﭏ] = U+05D9–U+FB4F accidentally covered Greek polytonic (U+1F00–U+1FFF)
const HEBREW_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/
function hasHebrew(str) { return HEBREW_RE.test(str || '') }
const HEBREW_FONT = "'Noto Serif Hebrew','Frank Ruhl Libre','Arial Hebrew','David','SBL Hebrew',serif"

// Explicit Unicode escape so no editor can strip the invisible character
const LTR = '‎'   // LEFT-TO-RIGHT MARK — zero-width, prevents bidi reordering of trailing punctuation

/* ── Canvas helpers ── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Word-wrap text onto the canvas.
 * align: 'left' | 'center' | 'right'
 * Always forces ctx.direction = 'ltr' and prepends LTR mark to every drawn line
 * to prevent the Unicode BiDi algorithm from reordering trailing punctuation.
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99, align = 'left') {
  if (!text) return y
  ctx.direction = 'ltr'
  ctx.textAlign = align
  const drawX = align === 'right'  ? x + maxWidth
              : align === 'center' ? x + maxWidth / 2
              : x
  const paragraphs = text.split(/\n+/)
  let currentY = y, linesDrawn = 0
  for (const para of paragraphs) {
    const words = para.split(' ').filter(Boolean)
    let line = ''
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word
      if (ctx.measureText(testLine).width > maxWidth && line) {
        if (linesDrawn >= maxLines - 1) { ctx.fillText(LTR + line + '…', drawX, currentY); return currentY }
        ctx.fillText(LTR + line, drawX, currentY)
        line = word; currentY += lineHeight; linesDrawn++
      } else { line = testLine }
    }
    if (line) {
      if (linesDrawn >= maxLines) { ctx.fillText(LTR + line + '…', drawX, currentY); return currentY }
      ctx.fillText(LTR + line, drawX, currentY)
      currentY += lineHeight; linesDrawn++
    }
  }
  return currentY
}

/* ── Solid/gradient background ── */
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

/* ── Top chrome: rule + source badge ── */
function drawTopChrome(ctx, w, h, PAD, accentColor, source) {
  const refDim = Math.min(w, h)
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, h * 0.055); ctx.lineTo(w - PAD, h * 0.055); ctx.stroke()
  ctx.globalAlpha = 1
  const srcColors = SRC_COLORS[source] || { bg:'#333', text:'#eee' }
  const bFontSz   = Math.round(refDim * 0.019)
  ctx.font        = `bold ${bFontSz}px 'DM Sans','Helvetica Neue',sans-serif`
  const bLabel    = source || 'Note'
  const bPadX = refDim * 0.02, bPadY = refDim * 0.013
  const bH = bFontSz + bPadY * 2, bW = ctx.measureText(bLabel).width + bPadX * 2
  const sourceY = h * 0.1
  ctx.fillStyle = srcColors.bg
  roundRect(ctx, PAD, sourceY - bFontSz - bPadY, bW, bH, bH / 2); ctx.fill()
  ctx.fillStyle = srcColors.text
  ctx.fillText(LTR + bLabel, PAD + bPadX, sourceY)
  return sourceY
}

/* ── Bottom chrome: dynamic rule + fixed logo ── */
function drawBottomChrome(ctx, w, h, PAD, accentColor, contentBottom, logoImg) {
  const refDim = Math.min(w, h)
  const ruleY  = contentBottom != null
    ? Math.min(Math.max(contentBottom + refDim * 0.065, h * 0.68), h * 0.93)
    : h * 0.9
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, ruleY); ctx.lineTo(w - PAD, ruleY); ctx.stroke()
  ctx.globalAlpha = 1
  if (logoImg) {
    const logoSize = Math.round(refDim * 0.055)
    const logoX    = w - PAD - logoSize
    const logoY    = h - Math.round(PAD * 0.65) - logoSize
    ctx.save(); ctx.globalAlpha = 0.62
    ctx.beginPath(); ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
    ctx.restore()
  }
}

/* ── Content block geometry — format-aware ── */
function contentGeometry(textPosition, w, h, PAD, refDim, afterY, formatId) {
  const isLeft   = textPosition === 'left'
  const isRight  = textPosition === 'right'
  const isBottom = textPosition === 'bottom'
  const isCenter = textPosition === 'center'
  const colFrac    = formatId === 'wide' ? 0.48 : 0.52
  const bottomFrac = formatId === 'wide' ? 0.38 : formatId === 'story' ? 0.56 : 0.50
  const centerFrac = formatId === 'wide' ? 0.28 : formatId === 'story' ? 0.36 : 0.32
  return {
    contentX:    isRight ? Math.round(w - PAD - (w - PAD * 2) * colFrac) : PAD,
    contentW:    (isLeft || isRight) ? Math.round((w - PAD * 2) * colFrac) : w - PAD * 2,
    blockStartY: isBottom ? Math.round(h * bottomFrac)
               : isCenter ? Math.round(h * centerFrac)
               : afterY,
  }
}

/* ── Reading / Note card (devotional, confession, scripture) ── */
function drawReadingCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, formatId) {
  const refDim   = Math.min(w, h)
  const sourceY  = drawTopChrome(ctx, w, h, PAD, accentColor, card.source)
  const isHeb    = card.script === 'hebrew' || hasHebrew(card.text || '')
  const bodyFont = isHeb ? HEBREW_FONT : "'Georgia','Times New Roman',serif"
  const effAlign = isHeb ? 'right' : textAlign

  const { contentX, contentW, blockStartY } = contentGeometry(textPosition, w, h, PAD, refDim, sourceY + refDim * 0.095, formatId)

  /* Title */
  let titleBottom = blockStartY
  const showTitle = metaShown.title !== false && card.title
  if (showTitle) {
    const titleSz = Math.round(refDim * 0.048)
    ctx.fillStyle = textColor
    ctx.font      = `600 ${titleSz}px 'Georgia','Times New Roman',serif`
    titleBottom   = wrapText(ctx, card.title, contentX, blockStartY, contentW, titleSz * 1.3, 3, effAlign)
  }

  /* Version subtitle */
  let versionBottom = titleBottom
  const showVersion = metaShown.version !== false && card.subtitle
  if (showVersion) {
    const vSz  = Math.round(refDim * 0.022)
    const vY   = titleBottom + (showTitle ? refDim * 0.018 : 0)
    ctx.fillStyle = accentColor; ctx.globalAlpha = 0.72
    ctx.font      = `${vSz}px 'DM Sans','Helvetica Neue',sans-serif`
    wrapText(ctx, card.subtitle, contentX, vY, contentW, vSz * 1.4, 1, effAlign)
    ctx.globalAlpha = 1
    versionBottom   = vY + vSz
  }

  /* Divider */
  const divY = (showTitle || showVersion) ? versionBottom + refDim * 0.030 : blockStartY
  ctx.strokeStyle = accentColor; ctx.globalAlpha = 0.25; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(contentX, divY); ctx.lineTo(contentX + contentW, divY); ctx.stroke()
  ctx.globalAlpha = 1

  /* Section label */
  let contentY = divY + refDim * 0.055
  const showLabel = metaShown.label !== false && card.label
  if (showLabel) {
    ctx.fillStyle = accentColor
    ctx.font      = `bold ${Math.round(refDim * 0.018)}px 'DM Sans','Helvetica Neue',sans-serif`
    wrapText(ctx, card.label.toUpperCase(), contentX, contentY, contentW, refDim * 0.022, 1, effAlign)
    contentY += refDim * 0.05
  }

  /* Decorative quote mark — follows text alignment */
  const qMarkSzR = Math.round(refDim * 0.10)
  const qGlyph   = isHeb ? '״' : '“'
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.18
  ctx.font      = `${qMarkSzR}px 'Georgia',serif`
  ctx.direction = 'ltr'
  if (effAlign === 'right') {
    ctx.textAlign = 'right'
    ctx.fillText(qGlyph, contentX + contentW, contentY + refDim * 0.045)
  } else if (effAlign === 'center') {
    ctx.textAlign = 'center'
    ctx.fillText(qGlyph, contentX + contentW / 2, contentY + refDim * 0.045)
  } else {
    ctx.textAlign = 'left'
    ctx.fillText(qGlyph, contentX, contentY + refDim * 0.045)
  }
  ctx.globalAlpha = 1

  /* Content body */
  const cSz         = Math.round(refDim * 0.031 * scale)
  const cLineH      = cSz * (isHeb ? 2.1 : 1.75)
  const refsPresent = metaShown.refs !== false && !!(card.refs?.trim())
  const maxLines    = Math.max(3, Math.floor((h * (refsPresent ? 0.48 : 0.62)) / cLineH))
  ctx.fillStyle     = textColor
  const indentX     = effAlign === 'left' ? refDim * 0.04 : 0
  let contentBottom

  if (isHeb) {
    ctx.font = `${Math.round(cSz * 1.3)}px ${bodyFont}`
    ctx.direction = 'rtl'; ctx.textAlign = 'right'
    const drawX = contentX + contentW - refDim * 0.04
    const txtW  = contentW - refDim * 0.04
    const words = (card.text || '').split(' ').filter(Boolean)
    let line = '', lineCount = 0, cy = contentY + refDim * 0.02
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > txtW && line) {
        ctx.fillText(line, drawX, cy); cy += cLineH; lineCount++; line = word
        if (lineCount >= maxLines) break
      } else { line = test }
    }
    if (line && lineCount < maxLines) { ctx.fillText(line, drawX, cy); cy += cLineH }
    contentBottom = cy
    ctx.direction = 'ltr'
  } else {
    ctx.font = `italic ${cSz}px ${bodyFont}`
    contentBottom = wrapText(ctx, card.text || '', contentX + indentX, contentY + refDim * 0.02, contentW - indentX, cLineH, maxLines, effAlign)
  }

  /* Proof texts */
  let finalBottom = contentBottom
  if (refsPresent) {
    const refAreaTop = contentBottom + refDim * 0.03
    if (refAreaTop < h * 0.88) {
      const refSz       = Math.round(refDim * 0.017)
      const refLineH    = refSz * 1.55
      const refMaxLines = Math.max(1, Math.floor((h * 0.88 - refAreaTop) / refLineH))
      const refsClean   = card.refs.replace(/\b[a-z](?=[A-Z1-9])/g, '').replace(/\s+/g, ' ').trim()
      ctx.fillStyle = accentColor; ctx.globalAlpha = 0.65
      ctx.font      = `bold ${refSz}px 'DM Sans','Helvetica Neue',sans-serif`
      wrapText(ctx, 'Scripture proofs:', contentX, refAreaTop, contentW, refSz * 1.5, 1, effAlign)
      ctx.fillStyle = textColor; ctx.globalAlpha = 0.38
      ctx.font      = `${refSz}px 'DM Sans','Helvetica Neue',sans-serif`
      finalBottom   = wrapText(ctx, refsClean, contentX, refAreaTop + refSz * 1.8, contentW, refLineH, refMaxLines, effAlign)
      ctx.globalAlpha = 1
    }
  }

  drawBottomChrome(ctx, w, h, PAD, accentColor, finalBottom, logoImg)
}

/* ── Quote card (book quotes from reading page) ── */
function drawQuoteCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, formatId) {
  const refDim  = Math.min(w, h)
  const sourceY = drawTopChrome(ctx, w, h, PAD, accentColor, card.source)
  const { contentX, contentW, blockStartY } = contentGeometry(textPosition, w, h, PAD, refDim, sourceY + refDim * 0.025, formatId)

  let headY = blockStartY
  const showLabel = metaShown.label !== false && card.label
  if (showLabel) {
    ctx.fillStyle = accentColor
    ctx.font      = `bold ${Math.round(refDim * 0.02)}px 'DM Sans','Helvetica Neue',sans-serif`
    wrapText(ctx, card.label.toUpperCase(), contentX, headY, contentW, refDim * 0.025, 1, textAlign)
    headY += refDim * 0.032
  }

  /* Decorative open-quote — always left-anchored */
  const qMarkSz = Math.round(refDim * 0.19)
  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.2
  ctx.font      = `${qMarkSz}px 'Georgia',serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.fillText('“', contentX - refDim * 0.01, headY + qMarkSz * 0.52)
  ctx.globalAlpha = 1

  const qSz      = Math.round(refDim * 0.038 * scale), qLineH = qSz * 1.85
  const maxLines = Math.max(4, Math.floor((h * 0.65) / qLineH))
  ctx.fillStyle  = textColor
  ctx.font       = `italic ${qSz}px 'Georgia','Times New Roman',serif`
  const indentX  = textAlign === 'left' ? refDim * 0.04 : 0
  const quoteBottom = wrapText(ctx, card.text || '', contentX + indentX, headY + refDim * 0.025, contentW - indentX, qLineH, maxLines, textAlign)

  ctx.fillStyle = accentColor; ctx.globalAlpha = 0.25
  ctx.font      = `${Math.round(refDim * 0.07)}px 'Georgia',serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'right'
  ctx.fillText('”', contentX + contentW, quoteBottom)
  ctx.globalAlpha = 1

  let finalBottom = quoteBottom
  const attribY   = Math.min(quoteBottom + refDim * 0.07, h * 0.87)
  if (metaShown.title !== false && card.title) {
    ctx.fillStyle = textColor; ctx.globalAlpha = 0.75
    ctx.font      = `500 ${Math.round(refDim * 0.024)}px 'DM Sans','Helvetica Neue',sans-serif`
    wrapText(ctx, `— ${card.title}`, contentX, attribY, contentW, refDim * 0.030, 2, textAlign)
    finalBottom = attribY + refDim * 0.032
  }
  if (metaShown.version !== false && card.subtitle2) {
    ctx.globalAlpha = 0.5
    ctx.font        = `italic ${Math.round(refDim * 0.021)}px 'Georgia',serif`
    wrapText(ctx, card.subtitle2, contentX, attribY + refDim * 0.042, contentW, refDim * 0.028, 2, textAlign)
    finalBottom = attribY + refDim * 0.042 + refDim * 0.028
  }
  ctx.globalAlpha = 1

  drawBottomChrome(ctx, w, h, PAD, accentColor, finalBottom, logoImg)
}

/* ── Book note / quote card (from My Library book shelf) ── */
function drawBookNoteCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, formatId) {
  const refDim = Math.min(w, h)

  // ── Top rule ──
  ctx.save()
  ctx.globalAlpha = 0.35; ctx.strokeStyle = accentColor
  ctx.lineWidth = Math.round(refDim * 0.003)
  ctx.beginPath(); ctx.moveTo(PAD, PAD * 0.6); ctx.lineTo(w - PAD, PAD * 0.6); ctx.stroke()
  ctx.restore()

  // ── Book title badge ──
  const badgeFontSz = Math.round(refDim * 0.028)
  ctx.font = `600 ${badgeFontSz}px 'DM Sans', sans-serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  const titleText  = card.bookTitle || 'Unknown Book'
  const badgePadX  = Math.round(refDim * 0.022), badgePadY = Math.round(refDim * 0.012)
  const badgeH     = badgeFontSz + badgePadY * 2, badgeW = ctx.measureText(titleText).width + badgePadX * 2
  const badgeY     = Math.round(PAD * 0.75), badgeR = badgeH / 2
  const showBookTitle = metaShown.bookTitle !== false

  if (showBookTitle) {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = accentColor
    roundRect(ctx, PAD, badgeY, badgeW, badgeH, badgeR); ctx.fill(); ctx.restore()
    ctx.fillStyle = accentColor
    ctx.fillText(LTR + titleText, PAD + badgePadX, badgeY + badgePadY + badgeFontSz * 0.78)
  }

  // Note-type badge
  const typeBadgeX = showBookTitle ? PAD + badgeW + Math.round(refDim * 0.015) : PAD
  const typeLabel  = card.noteType === 'quote' ? '❝ Quote' : '✍ Note'
  ctx.font = `500 ${badgeFontSz}px 'DM Sans', sans-serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = textColor
  roundRect(ctx, typeBadgeX, badgeY, ctx.measureText(typeLabel).width + badgePadX * 2, badgeH, badgeR); ctx.fill(); ctx.restore()
  ctx.fillStyle = textColor; ctx.globalAlpha = 0.7
  ctx.fillText(LTR + typeLabel, typeBadgeX + badgePadX, badgeY + badgePadY + badgeFontSz * 0.78)
  ctx.globalAlpha = 1

  // ── Content block geometry ──
  const badgeBottom = badgeY + badgeH
  const { contentX, contentW, blockStartY } = contentGeometry(textPosition, w, h, PAD, refDim, badgeBottom + Math.round(refDim * 0.08), formatId)

  // ── Category tags ──
  let catBottom = blockStartY
  const showCategory = metaShown.category !== false && card.bookLabels?.length
  if (showCategory) {
    const catSz = Math.round(refDim * 0.020)
    ctx.font = `500 ${catSz}px 'DM Sans', sans-serif`
    ctx.fillStyle = accentColor; ctx.globalAlpha = 0.7
    wrapText(ctx, card.bookLabels.join(' · '), contentX, blockStartY, contentW, catSz * 1.5, 1, textAlign)
    ctx.globalAlpha = 1
    catBottom = blockStartY + catSz * 1.5
  }

  // ── Decorative open-quote ──
  const textY = catBottom
  const quoteFontSz = Math.round(refDim * 0.18)
  ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = accentColor
  ctx.font = `bold ${quoteFontSz}px Georgia, serif`
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
  ctx.fillText('“', contentX - Math.round(refDim * 0.01), textY + quoteFontSz * 0.75)
  ctx.restore()

  // ── Main text ──
  const mainFontSz   = Math.round(refDim * 0.048 * scale)
  const mainLineH    = mainFontSz * 1.55
  const maxLines     = Math.max(3, Math.floor((h * 0.52) / mainLineH))
  ctx.fillStyle = textColor
  ctx.font = card.noteType === 'quote'
    ? `italic ${mainFontSz}px Georgia, serif`
    : `${mainFontSz}px 'DM Sans', sans-serif`
  const endY = wrapText(ctx, card.text || '', contentX, textY, contentW, mainLineH, maxLines, textAlign)

  // ── Author + Book title attribution ──
  let finalBottom = endY
  const showAuthor = metaShown.author !== false && card.bookAuthor
  const showBookTitleAttr = metaShown.bookTitle !== false && card.bookTitle
  if (showAuthor || showBookTitleAttr) {
    const attrFontSz = Math.round(refDim * 0.032)
    const attrY      = endY + Math.round(refDim * 0.035)
    let   nextY      = attrY

    // Author line
    if (showAuthor) {
      ctx.fillStyle = accentColor; ctx.globalAlpha = 1
      ctx.font = `500 ${attrFontSz}px 'DM Sans', sans-serif`
      wrapText(ctx, `— ${card.bookAuthor}`, contentX, nextY, contentW, attrFontSz * 1.4, 1, textAlign)
      nextY += attrFontSz * 1.5
    }

    // Book title line — italic, slightly smaller, below the author
    if (showBookTitleAttr) {
      const titleFontSz = Math.round(refDim * 0.026)
      ctx.font = `italic ${titleFontSz}px 'Georgia', serif`
      ctx.fillStyle = textColor; ctx.globalAlpha = 0.6
      wrapText(ctx, card.bookTitle, contentX, nextY, contentW, titleFontSz * 1.45, 2, textAlign)
      ctx.globalAlpha = 1
      nextY += titleFontSz * 1.5
    }

    finalBottom = nextY

    // Page / percent
    const locParts = []
    if (card.page) locParts.push(`p. ${card.page}`)
    if (card.percent != null) locParts.push(`${card.percent}%`)
    if (locParts.length) {
      const subFontSz = Math.round(refDim * 0.026)
      ctx.font = `${subFontSz}px 'DM Sans', sans-serif`
      ctx.fillStyle = textColor; ctx.globalAlpha = 0.5
      wrapText(ctx, locParts.join(' · '), contentX, nextY, contentW, subFontSz * 1.4, 1, textAlign)
      ctx.globalAlpha = 1
      finalBottom = nextY + subFontSz * 0.3
    }
  }

  drawBottomChrome(ctx, w, h, PAD, accentColor, finalBottom, logoImg)
}

/* ── Master draw dispatcher ── */
async function drawCard(canvas, card, preset, format, customBg, customText, scale, logoImg, textPosition, textAlign, metaShown, uploadedPhoto, useCoverBg) {
  const { w, h } = format
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const PAD = Math.round(Math.min(w, h) * 0.08)
  let textColor   = preset.id === 'custom' ? (customText || '#1a1410') : preset.textColor
  let accentColor = preset.accentColor

  const isBook = card.type === 'book_note' || card.type === 'book_quote'

  // Determine background photo source
  let bgSrc = null
  if (isBook && useCoverBg && (card.bookCoverData || card.bookCoverUrl)) {
    bgSrc = card.bookCoverData || card.bookCoverUrl
  } else if (!isBook && uploadedPhoto) {
    bgSrc = uploadedPhoto
  }

  if (bgSrc) {
    await new Promise(resolve => {
      const img = new Image()
      if (typeof bgSrc === 'string' && bgSrc.startsWith('http')) img.crossOrigin = 'anonymous'
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
        resolve()
      }
      img.onerror = () => { applyBackground(ctx, preset, w, h, customBg); resolve() }
      img.src = bgSrc
    })
    textColor   = '#f5f0e8'
    accentColor = isBook ? '#d4a84c' : '#c9a84c'
  } else {
    applyBackground(ctx, preset, w, h, customBg)
  }

  ctx.textBaseline = 'alphabetic'
  if (isBook) {
    drawBookNoteCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, format.id)
  } else if (card.type === 'quote') {
    drawQuoteCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, format.id)
  } else {
    drawReadingCard(ctx, card, w, h, PAD, textColor, accentColor, scale, logoImg, textPosition, textAlign, metaShown, format.id)
  }
}

/* ── Modal ── */
export default function ShareCardModal({ isOpen, onClose, card }) {
  const canvasRef                    = useRef(null)
  const fileInputRef                 = useRef(null)
  const [preset,       setPreset]    = useState(PRESETS[0])
  const [format,       setFormat]    = useState(FORMATS[0])
  const [customBg,     setCustomBg]  = useState('#f5f0e8')
  const [customText,   setCustomText]  = useState('#1a1410')
  const [cardScale,    setCardScale]   = useState(CARD_SCALE_DEFAULT)
  const [textPosition, setTextPosition] = useState('top')
  const [textAlign,    setTextAlign]    = useState('left')
  const [metaShown,    setMetaShown]    = useState({ title:true, version:true, label:true, refs:true })
  const [uploadedPhoto, setUploadedPhoto] = useState(null)   // dataURL — for non-book types
  const [showLogo,     setShowLogo]     = useState(true)

  const isBook = card?.type === 'book_note' || card?.type === 'book_quote'
  const hasCover = isBook && !!(card?.bookCoverData || card?.bookCoverUrl)

  // For book types: toggle to use book cover as bg (default on if cover exists)
  const [useCoverBg, setUseCoverBg] = useState(false)

  // Reset useCoverBg whenever a new card opens
  useEffect(() => {
    if (isOpen && card) setUseCoverBg(hasCover)
  }, [isOpen, card]) // eslint-disable-line

  const availableMeta = useMemo(() => {
    if (!card) return {}
    if (isBook) {
      return {
        bookTitle: !!(card.bookTitle),
        author:    !!(card.bookAuthor),
        category:  !!(card.bookLabels?.length),
      }
    }
    const isQuote = card.type === 'quote'
    return {
      title:   !!(card.title),
      version: isQuote ? !!(card.subtitle2) : !!(card.subtitle),
      label:   !!(card.label),
      refs:    !!(card.refs),
    }
  }, [card, isBook])

  const metaLabels = useMemo(() => {
    if (isBook) return { bookTitle: 'Book Title', author: 'Author', category: 'Category' }
    return {
      title:   card?.type === 'quote' ? 'Author'        : 'Reference',
      version: card?.type === 'quote' ? 'Work / Source' : 'Version',
      label:   'Section Label',
      refs:    'Proof Texts',
    }
  }, [card, isBook])

  // Reset layout + metaShown whenever a new card opens
  useEffect(() => {
    if (!card) return
    setTextAlign('left')
    setTextPosition('top')
    setCardScale(CARD_SCALE_DEFAULT)
    if (isBook) {
      setMetaShown({ bookTitle: true, author: true, category: !!(card.bookLabels?.length) })
    } else {
      setMetaShown({ title: true, version: true, label: true, refs: true })
    }
  }, [card]) // eslint-disable-line

  useEffect(() => {
    if (!isOpen || !card) return
    async function render() {
      const canvas = canvasRef.current; if (!canvas) return
      try {
        const logo = showLogo ? await getLogoImg() : null
        await drawCard(canvas, card, preset, format, customBg, customText, cardScale, logo, textPosition, textAlign, metaShown, uploadedPhoto, useCoverBg)
      } catch (err) { console.error('[ShareCard]', err) }
    }
    render()
    const t = setTimeout(render, 120)
    return () => clearTimeout(t)
  }, [isOpen, card, preset, format, customBg, customText, cardScale, textPosition, textAlign, metaShown, uploadedPhoto, useCoverBg, showLogo])

  useEffect(() => {
    if (!isOpen) return
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  const [sharing, setSharing] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  function getBlob() { return new Promise(r => canvasRef.current.toBlob(r, 'image/png')) }
  function filename() {
    const slug = isBook ? (card?.noteType === 'quote' ? 'book-quote' : 'book-note')
               : card?.type === 'quote' ? 'quote' : card?.type === 'note' ? 'note' : 'reading'
    return `pb-${slug}-${preset.id}.png`
  }
  async function shareNative() {
    setSharing(true)
    try {
      const blob = await getBlob()
      const file = new File([blob], filename(), { type:'image/png' })
      if (navigator.canShare?.({ files:[file] })) {
        await navigator.share({ files:[file], title:'Particular Baptist Devotional' })
      } else { fallbackDownload(blob) }
    } catch(err) {
      if (err?.name !== 'AbortError') { const b = await getBlob(); fallbackDownload(b) }
    } finally { setSharing(false) }
  }
  async function fallbackDownload(blob) {
    const b = blob || await getBlob()
    const url = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href = url; a.download = filename()
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!isOpen) return null

  const typeLabel  = isBook
    ? (card?.noteType === 'quote' ? 'Book Quote' : 'Book Note')
    : card?.type === 'quote' ? 'Quote' : card?.type === 'note' ? 'My Reflection' : card?.source
  const metaKeys   = Object.entries(availableMeta).filter(([, v]) => v).map(([k]) => k)
  const toggleMeta = key => setMetaShown(p => ({ ...p, [key]: p[key] === false }))

  const selectStyle = {
    appearance:'none', WebkitAppearance:'none',
    padding:'7px 30px 7px 10px', borderRadius:8, fontSize:12, fontWeight:600,
    fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
    border:'1.5px solid var(--border)', background:`var(--parchment) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23888' d='M5 7L1 3h8z'/%3E%3C/svg%3E") no-repeat right 8px center`,
    color:'var(--ink)', outline:'none', width:'100%',
  }

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
            <canvas ref={canvasRef} style={{ maxWidth:'100%', maxHeight: format.id === 'wide' ? 220 : 340, borderRadius:8, boxShadow:'0 4px 24px rgba(0,0,0,0.25)', display:'block' }} />
          </div>

          {/* Format */}
          <div style={m.section}>
            <div style={m.label}>Format</div>
            <div style={m.row}>
              {FORMATS.map(f => (
                <button key={f.id} title={f.hint} style={{ ...m.chip, ...(format.id === f.id ? m.chipActive : {}) }} onClick={() => setFormat(f)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={m.hint}>{format.hint}</div>
          </div>

          {/* Position + Align */}
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ ...m.section, flex:1 }}>
              <label style={m.label} htmlFor="sc-position">Text Position</label>
              <select id="sc-position" value={textPosition} onChange={e => setTextPosition(e.target.value)} style={selectStyle}>
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div style={{ ...m.section, flex:1 }}>
              <label style={m.label} htmlFor="sc-align">Text Align</label>
              {card?.script === 'hebrew' ? (
                <div style={{ ...selectStyle, opacity:0.5, pointerEvents:'none', display:'flex', alignItems:'center' }}>Right (Hebrew)</div>
              ) : (
                <select id="sc-align" value={textAlign} onChange={e => setTextAlign(e.target.value)} style={selectStyle}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              )}
            </div>
          </div>

          {/* Text size */}
          <div style={m.section}>
            <div style={m.label}>Text Size <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--ink-faint)'}}>— smaller fits more text</span></div>
            <div style={{...m.row, alignItems:'center'}}>
              <button onClick={() => setCardScale(s => Math.max(CARD_SCALE_MIN, +(s-CARD_SCALE_STEP).toFixed(2)))} disabled={cardScale <= CARD_SCALE_MIN} style={{...m.scaleBtn, opacity: cardScale <= CARD_SCALE_MIN ? 0.35 : 1}}>A<sup style={{fontSize:'0.55em'}}>−</sup></button>
              <span style={m.scaleCurrent}>{Math.round(cardScale * 100)}%</span>
              <button onClick={() => setCardScale(s => Math.min(CARD_SCALE_MAX, +(s+CARD_SCALE_STEP).toFixed(2)))} disabled={cardScale >= CARD_SCALE_MAX} style={{...m.scaleBtn, opacity: cardScale >= CARD_SCALE_MAX ? 0.35 : 1}}>A<sup style={{fontSize:'0.55em'}}>+</sup></button>
            </div>
          </div>

          {/* Show Fields */}
          <div style={m.section}>
            <div style={m.label}>Show Fields</div>
            <div style={m.fieldsList}>
              {metaKeys.map(key => {
                const on = metaShown[key] !== false
                return (
                  <label key={key} style={m.fieldRow}>
                    <span style={{ fontSize:12, color:'var(--ink-muted)', flex:1 }}>{metaLabels[key]}</span>
                    <div
                      style={{ ...m.toggle, background: on ? 'var(--teal)' : 'var(--border-strong)' }}
                      onClick={() => toggleMeta(key)}
                      role="switch" aria-checked={on} tabIndex={0}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleMeta(key)}
                    >
                      <div style={{ ...m.toggleThumb, transform: on ? 'translateX(14px)' : 'translateX(2px)' }} />
                    </div>
                  </label>
                )
              })}
              {/* App logo toggle — always shown */}
              <label style={m.fieldRow}>
                <span style={{ fontSize:12, color:'var(--ink-muted)', flex:1 }}>App Logo</span>
                <div
                  style={{ ...m.toggle, background: showLogo ? 'var(--teal)' : 'var(--border-strong)' }}
                  onClick={() => setShowLogo(v => !v)}
                  role="switch" aria-checked={showLogo} tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowLogo(v => !v)}
                >
                  <div style={{ ...m.toggleThumb, transform: showLogo ? 'translateX(14px)' : 'translateX(2px)' }} />
                </div>
              </label>
            </div>
          </div>

          {/* Background section — conditional on card type */}
          <div style={m.section}>
            {isBook ? (
              <>
                <div style={m.label}>Background</div>
                {/* Book cover toggle */}
                {hasCover && (
                  <div style={m.fieldsList}>
                    <label style={m.fieldRow}>
                      <div style={{display:'flex', alignItems:'center', gap:8, flex:1}}>
                        <img
                          src={card.bookCoverData || card.bookCoverUrl}
                          alt=""
                          style={{width:28, height:36, objectFit:'cover', borderRadius:3, border:'1px solid var(--border)', flexShrink:0}}
                        />
                        <span style={{fontSize:12, color:'var(--ink-muted)'}}>Use book cover as background</span>
                      </div>
                      <div
                        style={{ ...m.toggle, background: useCoverBg ? 'var(--teal)' : 'var(--border-strong)' }}
                        onClick={() => setUseCoverBg(v => !v)}
                        role="switch" aria-checked={useCoverBg} tabIndex={0}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setUseCoverBg(v => !v)}
                      >
                        <div style={{ ...m.toggleThumb, transform: useCoverBg ? 'translateX(14px)' : 'translateX(2px)' }} />
                      </div>
                    </label>
                  </div>
                )}
                {/* Preset swatches when not using cover */}
                {!useCoverBg && (
                  <>
                    <div style={m.row}>
                      {PRESETS.map(p => (
                        <button key={p.id} title={p.label} onClick={() => setPreset(p)} style={{
                          ...m.swatch,
                          background: p.id === 'custom' ? 'conic-gradient(#ff6b6b 0deg,#ffd93d 90deg,#6bcb77 180deg,#4d96ff 270deg,#ff6b6b 360deg)' : Array.isArray(p.bg) ? `linear-gradient(135deg,${p.bg[0]},${p.bg[1]})` : p.bg,
                          outline: preset.id === p.id ? '2.5px solid var(--teal)' : '2px solid transparent', outlineOffset:2,
                        }} />
                      ))}
                    </div>
                    <div style={m.presetName}>{preset.label}</div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={m.label}>Background Photo <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--ink-faint)'}}>— overrides color preset</span></div>
                {uploadedPhoto ? (
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <img src={uploadedPhoto} alt="" style={{width:44, height:44, objectFit:'cover', borderRadius:6, border:'1.5px solid var(--border)', flexShrink:0}} />
                    <span style={{fontSize:12, color:'var(--ink-muted)', flex:1}}>Custom photo applied</span>
                    <button onClick={() => setUploadedPhoto(null)} style={{fontSize:12, color:'#c0392b', background:'none', border:'1px solid #c0392b', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", flexShrink:0}}>Remove</button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} style={{...m.chip, display:'inline-flex', alignItems:'center', gap:6, width:'fit-content'}}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3 5l3.5-4L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 10.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    Upload Photo
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => setUploadedPhoto(ev.target.result)
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }} />
                {/* Color presets */}
                <div style={m.row}>
                  {PRESETS.map(p => (
                    <button key={p.id} title={p.label} onClick={() => setPreset(p)} style={{
                      ...m.swatch,
                      background: p.id === 'custom' ? 'conic-gradient(#ff6b6b 0deg,#ffd93d 90deg,#6bcb77 180deg,#4d96ff 270deg,#ff6b6b 360deg)' : Array.isArray(p.bg) ? `linear-gradient(135deg,${p.bg[0]},${p.bg[1]})` : p.bg,
                      outline: preset.id === p.id ? '2.5px solid var(--teal)' : '2px solid transparent', outlineOffset:2,
                    }} />
                  ))}
                </div>
                <div style={m.presetName}>{preset.label}</div>
              </>
            )}
          </div>

          {/* Custom colors (non-book only when not using cover, or book when not using cover) */}
          {(!useCoverBg) && preset.id === 'custom' && (
            <div style={m.section}>
              <div style={m.colorRow}>
                <label style={m.colorLabel}><span style={m.label}>Background</span><input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} style={m.colorInput} /></label>
                <label style={m.colorLabel}><span style={m.label}>Text color</span><input type="color" value={customText} onChange={e => setCustomText(e.target.value)} style={m.colorInput} /></label>
              </div>
            </div>
          )}

          <div style={m.tip}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0,marginTop:1}}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--teal)" strokeWidth="1.2"/>
              <path d="M6.5 5.5v4M6.5 4h.01" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {canShare
              ? <span>Tap <em>Download PNG</em> to save the file, or <em>Share / Save Image</em> to open the share sheet and post to Instagram, save to Photos, etc.</span>
              : <span>Click <em>Download PNG</em> to save the image to your computer.</span>
            }
          </div>
        </div>

        {/* Footer */}
        <div style={m.footer}>
          <button onClick={onClose} className="btn btn-ghost" style={{fontSize:13}}>Cancel</button>
          <button onClick={() => fallbackDownload()} className="btn btn-outline" style={{fontSize:13, gap:6}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 7l3 3 3-3M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Download PNG
          </button>
          {canShare && (
            <button onClick={shareNative} className="btn btn-primary" disabled={sharing} style={{fontSize:13, gap:6}}>
              {sharing
                ? <span className="spinner" style={{width:14,height:14}} />
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v5M4.5 4.5L7 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 7v4.5h8V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
              Share / Save Image
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const m = {
  overlay:  { position:'fixed', inset:0, background:'rgba(20,16,10,0.65)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 },
  modal:    { background:'white', borderRadius:14, maxWidth:460, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'92vh', overflow:'hidden' },
  header:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  title:    { fontSize:15, fontWeight:600, color:'var(--ink)' },
  titleSub: { fontSize:13, color:'var(--ink-faint)', fontWeight:400 },
  closeBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:5, borderRadius:6 },
  body:     { padding:'20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 },
  preview:  { display:'flex', justifyContent:'center', alignItems:'center', background:'#e8e8e8', borderRadius:10, padding:6 },
  section:  { display:'flex', flexDirection:'column', gap:6 },
  label:    { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)' },
  hint:     { fontSize:11, color:'var(--ink-faint)', marginTop:-2 },
  row:      { display:'flex', flexWrap:'wrap', gap:8 },
  chip:     { padding:'6px 14px', borderRadius:99, border:'1.5px solid var(--border)', background:'var(--parchment)', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", color:'var(--ink)', transition:'all 0.15s' },
  chipActive: { borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)' },
  scaleBtn: { width:40, height:40, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', cursor:'pointer', fontFamily:"'Georgia',serif", display:'flex', alignItems:'center', justifyContent:'center', background:'var(--parchment)', color:'var(--ink)' },
  scaleCurrent: { flex:1, textAlign:'center', fontSize:12, color:'var(--ink-muted)', fontFamily:"'DM Sans',sans-serif", fontWeight:600 },
  fieldsList: { display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' },
  fieldRow:   { display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--parchment)', cursor:'pointer', borderBottom:'1px solid var(--border)' },
  toggle:     { width:30, height:18, borderRadius:9, position:'relative', flexShrink:0, cursor:'pointer', transition:'background 0.2s' },
  toggleThumb:{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'transform 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)' },
  swatch:     { width:34, height:34, borderRadius:8, cursor:'pointer', flexShrink:0, border:'none', transition:'outline 0.12s' },
  presetName: { fontSize:12, color:'var(--ink-muted)', marginTop:-2 },
  colorRow:   { display:'flex', gap:20 },
  colorLabel: { display:'flex', flexDirection:'column', gap:6, cursor:'pointer' },
  colorInput: { width:52, height:38, padding:2, border:'1.5px solid var(--border)', borderRadius:8, cursor:'pointer', background:'none' },
  tip:        { display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'var(--teal-light)', borderRadius:'var(--radius)', fontSize:12, color:'var(--ink-muted)', lineHeight:1.55 },
  footer:     { display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 },
}
