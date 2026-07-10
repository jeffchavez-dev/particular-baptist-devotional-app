import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    route:    '/',
    selector: '[data-onboarding="home-header"]',
    title:    "Welcome to Your Daily Reading",
    body:     "This is your home — today's Scripture and Confession readings are laid out here each day. Your 365-day plan walks you through the 2LBCF, Keach's Catechism, and more.",
    position: 'below',
  },
  {
    route:    '/',
    selector: '[data-onboarding="home-confession-card"]',
    title:    "Confession & Catechism",
    body:     "Each day includes a confession or catechism section with the full text and its Scripture proof texts. Tap any reference to read it inline.",
    position: 'below',
  },
  {
    route:    '/',
    selector: '[data-onboarding="nav-confessions"]',
    title:    "Confessions Tab",
    body:     "Browse the full 2nd London Baptist Confession, 1st London Baptist Confession, Keach's Catechism, and the Orthodox Catechism — anytime, chapter by chapter.",
    position: 'above',
  },
  {
    route:    '/confessions',
    selector: '[data-onboarding="confession-list"]',
    title:    "Choose a Confession",
    body:     "Select a document from the sidebar to start reading. Each article is cross-referenced with Scripture proof texts shown inline as chips.",
    position: 'below',
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="nav-scripture"]',
    title:    "Scripture Tab",
    body:     "The full Bible reader — KJV, Geneva Bible (1599), Greek NT, Hebrew OT, and LXX. Read continuously across chapters with infinite scroll.",
    position: 'above',
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="study-mode-btn"]',
    title:    "Study Mode",
    body:     "Tap the open-book icon to enter Study Mode. This reveals confession cross-reference chips, Bible cross-references, and inline commentary above each verse.",
    position: 'below',
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="commentary-selector"]',
    title:    "Reformed Commentaries",
    body:     "Choose from Matthew Henry, John Calvin, or John Gill. Commentary appears per-verse as collapsible chips — tap any chip to expand the commentary for that verse.",
    position: 'below',
    requiresStudyMode: true,
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="verse-number"]',
    title:    "Highlight & Take Notes",
    body:     "Tap a verse number to select it. A toolbar appears — choose a highlight color or add a personal note. Tap two words to highlight a phrase instead of the whole verse.",
    position: 'right',
  },
  {
    route:    '/library',
    selector: '[data-onboarding="library-tabs"]',
    title:    "Your Library",
    body:     "All your highlights, notes, bookmarks, and highlighted phrases live here — organized by type, searchable, and synced to your account when signed in.",
    position: 'below',
  },
  {
    route:    '/about',
    selector: '#quiz',
    title:    "Theology Quiz",
    body:     '"How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and church history. A fun way to test your Reformed knowledge.',
    position: 'below',
  },
  {
    route:    '/about',
    selector: '#bible-tracker',
    title:    "Bible Tracker",
    body:     "See which books and chapters of the Bible you've read. Mark chapters complete manually or let it track automatically as you read.",
    position: 'below',
  },
  {
    route:    '/about',
    selector: '#confession-tracker',
    title:    "Confession Tracker",
    body:     "Track your progress through each confession and catechism — see which articles you've completed and how far along you are.",
    position: 'below',
  },
]

const TOOLTIP_W = 300
const TOOLTIP_PADDING = 16
const SPOTLIGHT_PAD = 8

export default function OnboardingOverlay({ step, onNext, onSkip }) {
  const navigate   = useNavigate()
  const [rect, setRect]     = useState(null)
  const [ready, setReady]   = useState(false)
  const prevRoute  = useRef(null)
  const current    = STEPS[step]
  const total      = STEPS.length

  const resolveTarget = useCallback(() => {
    const el = document.querySelector(current.selector)
    if (!el) return null
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return el.getBoundingClientRect()
  }, [current])

  useEffect(() => {
    setReady(false)
    setRect(null)

    if (!current) return

    const doNavigate = current.route !== prevRoute.current
    prevRoute.current = current.route

    if (doNavigate) {
      navigate(current.route)
    }

    // Wait for navigation + render, then measure
    const delay = doNavigate ? 500 : 120
    const t = setTimeout(() => {
      const r = resolveTarget()
      setRect(r)
      setReady(true)
    }, delay)
    return () => clearTimeout(t)
  }, [step, current, navigate, resolveTarget])

  if (!current || !ready) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Spotlight box
  const sTop    = rect ? Math.max(0, rect.top    - SPOTLIGHT_PAD) : 0
  const sLeft   = rect ? Math.max(0, rect.left   - SPOTLIGHT_PAD) : 0
  const sWidth  = rect ? rect.width  + SPOTLIGHT_PAD * 2 : 0
  const sHeight = rect ? rect.height + SPOTLIGHT_PAD * 2 : 0

  // Tooltip position
  let tooltipTop, tooltipLeft
  if (!rect) {
    tooltipTop  = vh / 2 - 80
    tooltipLeft = vw / 2 - TOOLTIP_W / 2
  } else {
    const pos = current.position || 'below'
    if (pos === 'above') {
      tooltipTop  = sTop - 12 - 140  // estimated tooltip height
      tooltipLeft = sLeft + sWidth / 2 - TOOLTIP_W / 2
    } else if (pos === 'right') {
      tooltipTop  = sTop + sHeight / 2 - 70
      tooltipLeft = sLeft + sWidth + 12
    } else {
      tooltipTop  = sTop + sHeight + 12
      tooltipLeft = sLeft + sWidth / 2 - TOOLTIP_W / 2
    }
    // Clamp within viewport
    tooltipLeft = Math.max(TOOLTIP_PADDING, Math.min(tooltipLeft, vw - TOOLTIP_W - TOOLTIP_PADDING))
    tooltipTop  = Math.max(TOOLTIP_PADDING, tooltipTop)
  }

  const isLast = step === total - 1

  return (
    <div style={s.root}>
      {/* Dark overlay with spotlight cutout via clip-path */}
      {rect ? (
        <svg style={s.svgOverlay} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none">
          <defs>
            <mask id="spotlight-mask">
              <rect width={vw} height={vh} fill="white" />
              <rect
                x={sLeft} y={sTop}
                width={sWidth} height={sHeight}
                rx={6} fill="black"
              />
            </mask>
          </defs>
          <rect
            width={vw} height={vh}
            fill="rgba(0,0,0,0.62)"
            mask="url(#spotlight-mask)"
          />
          {/* Spotlight border ring */}
          <rect
            x={sLeft} y={sTop}
            width={sWidth} height={sHeight}
            rx={6} fill="none"
            stroke="rgba(255,255,255,0.25)" strokeWidth={1.5}
          />
        </svg>
      ) : (
        <div style={s.dimAll} />
      )}

      {/* Tooltip card */}
      <div style={{ ...s.tooltip, top: tooltipTop, left: tooltipLeft }}>
        <div style={s.stepPills}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ ...s.pill, ...(i === step ? s.pillActive : i < step ? s.pillDone : {}) }} />
          ))}
        </div>
        <div style={s.title}>{current.title}</div>
        <div style={s.body}>{current.body}</div>
        <div style={s.actions}>
          <button style={s.skipBtn} onClick={onSkip}>Skip tour</button>
          <button style={s.nextBtn} onClick={() => onNext(total)}>
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    position: 'fixed', inset: 0, zIndex: 9000,
    pointerEvents: 'none',
  },
  svgOverlay: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    pointerEvents: 'all',
  },
  dimAll: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.62)',
    pointerEvents: 'all',
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_W,
    background: 'var(--surface)',
    borderRadius: 14,
    padding: '16px 18px 14px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.32)',
    border: '1px solid var(--border)',
    fontFamily: "'DM Sans', sans-serif",
    pointerEvents: 'all',
    zIndex: 9001,
  },
  stepPills: {
    display: 'flex', gap: 4, marginBottom: 10,
  },
  pill: {
    height: 3, flex: 1, borderRadius: 99,
    background: 'var(--border-strong)', transition: 'background 0.2s',
  },
  pillActive: { background: 'var(--teal)' },
  pillDone:   { background: 'var(--teal)', opacity: 0.4 },
  title: {
    fontSize: 14, fontWeight: 700, color: 'var(--ink)',
    marginBottom: 6, lineHeight: 1.3,
  },
  body: {
    fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.65,
    marginBottom: 14,
  },
  actions: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  skipBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: 'var(--ink-faint)', padding: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  nextBtn: {
    background: 'var(--teal)', color: 'white',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, padding: '7px 16px',
    fontFamily: "'DM Sans', sans-serif",
  },
}
