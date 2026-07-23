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
    // On mobile the sidebar is in a drawer — tap the hamburger to open it first
    beforeEnter: () => {
      if (window.innerWidth < 768) {
        const btn = document.querySelector('[data-onboarding="confession-hamburger"]')
        btn?.click()
      }
    },
    delay: 400,
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="nav-scripture"]',
    title:    "Scripture Tab",
    body:     "The full Bible reader — KJV, Geneva Bible (1599), Greek NT, Hebrew OT, and LXX. Read continuously across chapters with infinite scroll.",
    position: 'above',
    // Ensure KJV is pre-selected so the version picker doesn't block the reader
    beforeEnter: () => {
      try { if (!localStorage.getItem('pb-default-version')) localStorage.setItem('pb-default-version', 'kjv') } catch {}
    },
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="study-mode-btn"]',
    title:    "Study Mode",
    body:     "Tap the open-book icon to enter Study Mode. This reveals confession cross-reference chips, Bible cross-references, and inline commentary above each verse.",
    position: 'below',
    // Reset to KJV and enable study mode — both required for commentary selector to appear
    beforeEnter: () => {
      window.dispatchEvent(new CustomEvent('pb-reset-version-kjv'))
      window.dispatchEvent(new CustomEvent('pb-enable-study-mode'))
    },
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="commentary-selector"]',
    title:    "Reformed Commentaries",
    body:     "Switch between Matthew Henry, John Calvin, and John Gill right here in the sidebar — no need to scroll back up. Commentary appears per-verse as collapsible chips as you read.",
    position: 'right',
    beforeEnter: () => {
      // Open sidebar, ensure KJV + study mode so commentary selector renders
      window.dispatchEvent(new CustomEvent('pb-reset-version-kjv'))
      window.dispatchEvent(new CustomEvent('pb-enable-study-mode'))
      const pill = document.querySelector('[data-onboarding="scripture-book-pill"]')
      pill?.click()
    },
    delay: 700,
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="confession-chips"]',
    title:    "Confession & Catechism Links",
    body:     "In Study Mode, colored chips appear inline — linking each verse to its 2LBCF article, Catechism question, or Orthodox Catechism entry. Tap any chip to read the full article.",
    position: 'below',
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="parallel-section"]',
    title:    "Parallel Bible",
    body:     "Open the book picker and tap any version chip under Parallel — ABAB, NASB, BSB, Geneva, GNT, Hebrew OT, LXX — to read two translations side by side.",
    position: 'right',
    beforeEnter: () => {
      const pill = document.querySelector('[data-onboarding="scripture-book-pill"]')
      pill?.click()
    },
    delay: 450,
  },
  {
    route:    '/scripture',
    selector: '[data-onboarding="verse-number"]',
    title:    "Highlight & Take Notes",
    body:     "Tap a verse number to select it. A toolbar appears — choose a highlight color or add a personal note. Tap two words to highlight a phrase instead of the whole verse.",
    position: 'right',
    beforeEnter: () => {
      window.dispatchEvent(new CustomEvent('pb-close-scripture-sidebar'))
    },
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
    delay: 900,
  },
  {
    route:    '/about',
    selector: '#bible-tracker',
    title:    "Bible Tracker",
    body:     "See which books and chapters of the Bible you've read. Mark chapters complete manually or let it track automatically as you read.",
    position: 'below',
    delay: 400,
  },
  {
    route:    '/about',
    selector: '#confession-tracker',
    title:    "Confession Tracker",
    body:     "Track your progress through each confession and catechism — see which articles you've completed and how far along you are.",
    position: 'below',
    delay: 400,
  },
  {
    route:    '/about',
    selector: '[data-onboarding="bible-translations"]',
    title:    "Choose Your Translations",
    body:     "Tap any chip to show or hide that translation in the Scripture version picker and parallel panel. Default visible: KJV, HOT, GNT, ABAB. Add Filipino translations (ABAB, CEBug, ILO) or others here.",
    position: 'below',
    delay:    400,
  },
  {
    route:    '/about',
    selector: null,
    title:    "You're ready.",
    quote:    true,
  },
]

const TOOLTIP_PADDING = 16
const SPOTLIGHT_PAD = 8

export default function OnboardingOverlay({ step, onNext, onSkip }) {
  const navigate   = useNavigate()
  const [rect, setRect]     = useState(null)
  const [ready, setReady]   = useState(false)
  const tooltipRef = useRef(null)
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

    if (current.beforeEnter) current.beforeEnter()
    if (doNavigate) navigate(current.route)

    const delay = current.delay ?? (doNavigate ? 500 : 120)
    const t = setTimeout(() => {
      const r = current.selector ? resolveTarget() : null
      setRect(r)
      setReady(true)
    }, delay)
    return () => clearTimeout(t)
  }, [step, current, navigate, resolveTarget])

  if (!current || !ready) return null

  // visualViewport is more accurate on mobile Safari (excludes browser chrome)
  const vw = window.visualViewport?.width  ?? window.innerWidth
  const vh = window.visualViewport?.height ?? window.innerHeight

  // Responsive tooltip width: on small screens use almost full width
  const isMobileView = vw < 600
  const TOOLTIP_W    = isMobileView ? Math.min(320, vw - TOOLTIP_PADDING * 2) : 320
  // Taller estimate on mobile because text wraps more
  const TOOLTIP_H_EST = isMobileView ? 200 : 170

  // Spotlight box
  const sTop    = rect ? Math.max(0, rect.top    - SPOTLIGHT_PAD) : 0
  const sLeft   = rect ? Math.max(0, rect.left   - SPOTLIGHT_PAD) : 0
  const sWidth  = rect ? rect.width  + SPOTLIGHT_PAD * 2 : 0
  const sHeight = rect ? rect.height + SPOTLIGHT_PAD * 2 : 0

  // Tooltip position — prefer the step hint, auto-flip if it doesn't fit
  let tooltipTop, tooltipLeft
  if (!rect) {
    // No target — center the tooltip
    tooltipTop  = vh / 2 - TOOLTIP_H_EST / 2
    tooltipLeft = vw / 2 - TOOLTIP_W / 2
  } else {
    const spaceBelow = vh - (sTop + sHeight)
    const spaceAbove = sTop
    const spaceRight = vw - (sLeft + sWidth)
    const spaceLeft  = sLeft

    let pos = current.position || 'below'
    if (pos === 'below' && spaceBelow < TOOLTIP_H_EST + 24 && spaceAbove > spaceBelow) pos = 'above'
    if (pos === 'above' && spaceAbove < TOOLTIP_H_EST + 24 && spaceBelow > spaceAbove) pos = 'below'
    // On mobile, never use 'right' — stack above/below instead
    if (pos === 'right') {
      if (isMobileView || spaceRight < TOOLTIP_W + 24) pos = spaceAbove > spaceBelow ? 'above' : 'below'
    }
    if (pos === 'left') {
      if (isMobileView || spaceLeft < TOOLTIP_W + 24) pos = spaceAbove > spaceBelow ? 'above' : 'below'
    }

    if (pos === 'above') {
      tooltipTop  = sTop - TOOLTIP_H_EST - 12
      tooltipLeft = sLeft + sWidth / 2 - TOOLTIP_W / 2
    } else if (pos === 'right') {
      tooltipTop  = sTop + sHeight / 2 - TOOLTIP_H_EST / 2
      tooltipLeft = sLeft + sWidth + 12
    } else if (pos === 'left') {
      tooltipTop  = sTop + sHeight / 2 - TOOLTIP_H_EST / 2
      tooltipLeft = sLeft - TOOLTIP_W - 12
    } else {
      tooltipTop  = sTop + sHeight + 12
      tooltipLeft = sLeft + sWidth / 2 - TOOLTIP_W / 2
    }

    // Clamp within viewport
    tooltipLeft = Math.max(TOOLTIP_PADDING, Math.min(tooltipLeft, vw - TOOLTIP_W - TOOLTIP_PADDING))
    tooltipTop  = Math.max(TOOLTIP_PADDING, Math.min(tooltipTop,  vh - TOOLTIP_H_EST - TOOLTIP_PADDING))
  }

  const isLast = step === total - 1

  // Quote step — full-screen dim, centered card, no spotlight
  if (current.quote) {
    return (
      <div style={s.root}>
        <div style={s.dimAll} />
        <div style={s.quoteCard}>
          <div style={s.stepPills}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ ...s.pill, ...(i === step ? s.pillActive : i < step ? s.pillDone : {}) }} />
            ))}
          </div>
          <div style={s.quoteLabel}>Directions for Meditation</div>
          <blockquote style={s.quoteText}>
            "Read before you meditate. 'Give attendance to reading' (1 Tim. 4:13). Then it follows, 'meditate upon these things' (v. 15). Reading doth furnish with matter; it is the oil that feeds the lamp of meditation. Be sure your meditations are founded upon Scripture. Reading without meditation is unfruitful; meditation without reading is dangerous."
          </blockquote>
          <div style={s.quoteAttrib}>— Thomas Watson, <em>The Christian on the Mount</em>, 69</div>
          <div style={{ ...s.actions, marginTop: 20 }}>
            <div />
            <button style={s.nextBtn} onClick={() => onNext(total)}>
              Begin →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      {rect ? (
        <svg style={s.svgOverlay} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none">
          <defs>
            <mask id="spotlight-mask">
              <rect width={vw} height={vh} fill="white" />
              <rect x={sLeft} y={sTop} width={sWidth} height={sHeight} rx={6} fill="black" />
            </mask>
          </defs>
          <rect width={vw} height={vh} fill="rgba(0,0,0,0.62)" mask="url(#spotlight-mask)" />
          <rect x={sLeft} y={sTop} width={sWidth} height={sHeight} rx={6} fill="none"
            stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
        </svg>
      ) : (
        <div style={s.dimAll} />
      )}

      <div ref={tooltipRef} style={{ ...s.tooltip, top: tooltipTop, left: tooltipLeft, width: TOOLTIP_W }}>
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
  quoteCard: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(480px, calc(100vw - 48px))',
    background: 'var(--surface)',
    borderRadius: 18,
    padding: '28px 32px 24px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.36)',
    border: '1px solid var(--border)',
    fontFamily: "'DM Sans', sans-serif",
    pointerEvents: 'all',
    zIndex: 9001,
  },
  quoteLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--teal)', textTransform: 'uppercase',
    marginBottom: 14, marginTop: 10,
  },
  quoteText: {
    margin: '0 0 14px',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 17, lineHeight: 1.75,
    color: 'var(--ink)',
    fontStyle: 'italic',
    borderLeft: '3px solid var(--gold)',
    paddingLeft: 16,
  },
  quoteAttrib: {
    fontSize: 12, color: 'var(--ink-muted)',
    textAlign: 'right',
  },
}
