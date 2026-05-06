import React, { useEffect, useRef, useState } from 'react'

/* ── Font options ── */
export const FONT_OPTIONS = [
  { id:'cormorant', label:'Cormorant',  css:"'Cormorant Garamond', Georgia, serif",             sample:'The fear of the Lord' },
  { id:'georgia',   label:'Georgia',    css:"Georgia, 'Times New Roman', serif",                  sample:'The fear of the Lord' },
  { id:'palatino',  label:'Palatino',   css:"'Palatino Linotype', 'Palatino', 'Book Antiqua', serif", sample:'The fear of the Lord' },
  { id:'sans',      label:'Sans-serif', css:"'DM Sans', 'Helvetica Neue', Arial, sans-serif",    sample:'The fear of the Lord' },
]

/* ── Size steps (kept for reference) ── */
export const FONT_SIZES = [
  { id:'s',  label:'S', px:14 },
  { id:'m',  label:'M', px:16 },
  { id:'l',  label:'L', px:19 },
  { id:'xl', label:'XL', px:23 },
]

/* ── A−/A+ step controls ── */
export const FONT_SIZE_MIN  = 12
export const FONT_SIZE_MAX  = 28
export const FONT_SIZE_STEP = 2

/* ── Script-specific font options ── */
export const GREEK_FONTS = [
  {
    id: 'palatino',
    label: 'Palatino',
    css: "'Palatino Linotype','Palatino','Book Antiqua',serif",
    hint: 'Classic scholarly serif — system font, no download',
  },
  {
    id: 'gentium',
    label: 'Gentium',
    css: "'Gentium Plus','Gentium',serif",
    hint: 'Designed for biblical & linguistic texts',
  },
  {
    id: 'garamond',
    label: 'Garamond',
    css: "'EB Garamond','Garamond',serif",
    hint: 'Elegant humanist serif with polytonic Greek',
  },
]

export const HEBREW_FONTS = [
  {
    id: 'sbl',
    label: 'SBL',
    css: "'SBL Hebrew','David','Arial Hebrew',serif",
    hint: 'Society of Biblical Literature academic font',
  },
  {
    id: 'frankruhl',
    label: 'Frank Ruhl',
    css: "'Frank Ruhl Libre','FrankRuehl','David',serif",
    hint: 'Classic Hebrew newspaper / print style',
  },
  {
    id: 'noto',
    label: 'Noto',
    css: "'Noto Serif Hebrew',serif",
    hint: "Google Noto — universal Unicode coverage",
  },
]

export function getGreekFontCss(fontId) {
  return GREEK_FONTS.find(f => f.id === fontId)?.css || GREEK_FONTS[0].css
}

export function getHebrewFontCss(fontId) {
  return HEBREW_FONTS.find(f => f.id === fontId)?.css || HEBREW_FONTS[0].css
}

const PREFS_KEY = 'pb-reading-prefs'
export const DEFAULT_PREFS = { sizePx: 16, fontId: 'cormorant', greekFontId: 'gentium', hebrewFontId: 'frankruhl', includeOrthodox: false }

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PREFS, ...parsed }
  } catch { return { ...DEFAULT_PREFS } }
}

export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch {}
}

export function getFontCss(fontId) {
  return FONT_OPTIONS.find(f => f.id === fontId)?.css || FONT_OPTIONS[0].css
}

/* ── Custom dropdown — shows font name, sample rendered in that font ── */
function FontDropdown({ value, options, onChange, sampleKey = 'sample' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = options.find(f => f.id === value) || options[0]

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position:'relative', flex:1 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'5px 9px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
          background: open ? 'var(--parchment-dark)' : 'var(--parchment)',
          cursor:'pointer', gap:8,
        }}
      >
        <span style={{ fontFamily: active.css, fontSize:13, color:'var(--ink)', lineHeight:1.2, flex:1, textAlign:'left' }}>
          {active[sampleKey] ?? active.label}
        </span>
        <span style={{ fontSize:9, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif", fontWeight:600, flexShrink:0 }}>
          {active.label}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, opacity:0.5, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'white', border:'1px solid var(--border)',
          borderRadius:'var(--radius)', boxShadow:'0 6px 20px rgba(0,0,0,0.12)',
          zIndex:300, overflow:'hidden',
        }}>
          {options.map(f => {
            const isActive = f.id === value
            return (
              <button
                key={f.id}
                onClick={() => { onChange(f.id); setOpen(false) }}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:8,
                  padding:'7px 10px', border:'none', cursor:'pointer',
                  background: isActive ? 'var(--teal-light)' : 'none',
                  borderBottom:'1px solid var(--border)',
                  transition:'background 0.1s',
                }}
              >
                <span style={{ fontFamily: f.css, fontSize:13, color: isActive ? 'var(--teal)' : 'var(--ink)', flex:1, textAlign:'left', lineHeight:1.2 }}>
                  {f[sampleKey] ?? f.label}
                </span>
                <span style={{ fontSize:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700, color: isActive ? 'var(--teal)' : 'var(--ink-faint)', flexShrink:0 }}>
                  {f.label}
                </span>
                {isActive && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink:0 }}>
                    <path d="M2 5.5L4.5 8L9 3" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Panel component ── */
export default function FontPrefsPanel({ prefs, onUpdate }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)

  /* Close on outside click */
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeFont = FONT_OPTIONS.find(f => f.id === prefs.fontId) || FONT_OPTIONS[0]

  function set(patch) { onUpdate({ ...prefs, ...patch }) }

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Font size &amp; style"
        aria-label="Reading preferences"
        style={{
          ...p.trigger,
          background: open ? 'var(--parchment-dark)' : 'none',
          borderColor: open ? 'var(--border-strong)' : 'var(--border)',
          color: open ? 'var(--ink)' : 'var(--ink-muted)',
        }}
      >
        <span style={{ fontFamily: activeFont.css, fontSize:14, fontWeight:600, lineHeight:1 }}>Aa</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={p.panel} role="dialog" aria-label="Reading preferences">

          {/* Size row — A− / current / A+ */}
          <div style={p.row}>
            <span style={p.rowLabel}>Size</span>
            <div style={p.sizeRow}>
              <button
                onClick={() => set({ sizePx: Math.max(FONT_SIZE_MIN, prefs.sizePx - FONT_SIZE_STEP) })}
                disabled={prefs.sizePx <= FONT_SIZE_MIN}
                title="Decrease font size"
                style={{ ...p.sizeStepBtn, opacity: prefs.sizePx <= FONT_SIZE_MIN ? 0.35 : 1 }}
              >A<sup style={{fontSize:'0.6em',lineHeight:1}}>−</sup></button>
              <span style={p.sizeCurrent}>{prefs.sizePx}px</span>
              <button
                onClick={() => set({ sizePx: Math.min(FONT_SIZE_MAX, prefs.sizePx + FONT_SIZE_STEP) })}
                disabled={prefs.sizePx >= FONT_SIZE_MAX}
                title="Increase font size"
                style={{ ...p.sizeStepBtn, fontSize: prefs.sizePx * 0.82, fontFamily: activeFont.css, opacity: prefs.sizePx >= FONT_SIZE_MAX ? 0.35 : 1 }}
              >A<sup style={{fontSize:'0.6em',lineHeight:1}}>+</sup></button>
            </div>
          </div>

          <div style={p.divider} />

          {/* Font dropdown */}
          <div style={p.row}>
            <span style={p.rowLabel}>Font</span>
            <FontDropdown
              value={prefs.fontId}
              options={FONT_OPTIONS}
              onChange={id => set({ fontId: id })}
              sampleKey="sample"
            />
          </div>

          {/* Reset */}
          <button
            onClick={() => set({ sizePx: DEFAULT_PREFS.sizePx, fontId: DEFAULT_PREFS.fontId })}
            style={p.resetBtn}
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Styles ── */
const p = {
  trigger: {
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'5px 9px', borderRadius:'var(--radius)', border:'1px solid',
    cursor:'pointer', transition:'all 0.12s',
  },
  panel: {
    position:'absolute', top:'calc(100% + 8px)', right:0,
    background:'white', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', boxShadow:'0 8px 32px rgba(0,0,0,0.14)',
    padding:'14px 14px 10px', zIndex:200, width:240,
    display:'flex', flexDirection:'column', gap:12,
  },
  row: { display:'flex', alignItems:'center', gap:10 },
  rowLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
    color:'var(--ink-faint)', width:30, flexShrink:0,
  },
  sizeRow: { display:'flex', gap:6, flex:1, alignItems:'center' },
  sizeStepBtn: {
    width:36, height:32, border:'1.5px solid var(--border)',
    borderRadius:'var(--radius)', cursor:'pointer',
    background:'var(--parchment)', color:'var(--ink)',
    fontFamily:"'Cormorant Garamond', serif", fontSize:14,
    transition:'all 0.12s', display:'flex', alignItems:'center',
    justifyContent:'center', lineHeight:1, flexShrink:0,
  },
  sizeCurrent: {
    flex:1, textAlign:'center', fontSize:11, color:'var(--ink-muted)',
    fontFamily:"'DM Sans',sans-serif", fontWeight:600,
  },
  divider: { height:1, background:'var(--border)', margin:'0 -2px' },
  resetBtn: {
    fontSize:11, color:'var(--ink-faint)', background:'none', border:'none',
    cursor:'pointer', textDecoration:'underline', padding:'2px 0',
    textAlign:'right', fontFamily:"'DM Sans',sans-serif",
  },
}
