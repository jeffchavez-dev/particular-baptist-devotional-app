import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="2" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="7" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="7" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Full Confession Texts',
    body: 'Read each paragraph of the 2LBCF, Keach\'s Catechism, and the 1LBCF inline — no external sites required.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 2L13.5 8H20L14.5 12L16.5 18.5L11 14.5L5.5 18.5L7.5 12L2 8H8.5L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Scripture Proof Texts',
    body: 'Every article is grounded in Scripture. See the proof texts that anchor each doctrinal statement to God\'s Word.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M11 7v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Pastoral Quotes',
    body: 'Keach, Coxe, Knollys, Owen, Renihan — historical voices illuminate each reading with theological depth.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 13l4 4L18 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Progress Tracking',
    body: 'Mark days complete, build streaks, and sync your progress across devices when you sign in.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 5h16M3 9h10M3 13h13M3 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Personal Notes',
    body: 'Write reflections for any day. Your notes are saved privately and sync to your account.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Quiz',
    body: '"How Particular Baptist are you?" — 37 questions covering Scripture, soteriology, covenant theology, and history.',
  },
]

const sources = [
  {
    label: '2LBCF',
    name: 'Second London Baptist Confession',
    year: '1689',
    color: 'var(--purple-ink)',
    bg: 'var(--purple-soft)',
    chapters: '32 chapters',
    desc: 'The doctrinal standard of Particular Baptists — a thorough statement of Reformed theology grounded in Scripture, closely following the Westminster Confession with key Baptist modifications.',
    route: '2lbcf',
  },
  {
    label: 'Catechism',
    name: "Keach's Baptist Catechism",
    year: '1693',
    color: 'var(--teal)',
    bg: 'var(--teal-light)',
    chapters: '114 questions',
    desc: 'One hundred and fourteen questions and answers teaching the essentials of Christian doctrine — designed by Benjamin Keach for instruction in faith and practice for all ages.',
    route: 'catechism',
  },
  {
    label: '1LBCF',
    name: 'First London Baptist Confession',
    year: '1644',
    color: 'var(--amber-ink)',
    bg: 'var(--amber-soft)',
    chapters: '52 articles',
    desc: 'The founding document of the Particular Baptist movement — fifty-two articles affirming biblical faith, distinguishing these congregations from General Baptists and Anabaptists.',
    route: '1lbcf',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { session } = useAuth()

  return (
    <div style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.navBrand}>
            <img src="/pb-icon.svg" alt="P.B." style={{ width: 30, height: 30 }} />
            <span style={s.navTitle}>Particular Baptist Devotional</span>
          </div>
          <div style={s.navActions}>
            <button onClick={() => navigate('/quiz')} className="btn btn-ghost" style={{ fontSize: 13 }}>
              Take the Quiz
            </button>
            {session
              ? <button onClick={() => navigate('/dashboard')} className="btn btn-outline" style={{ fontSize: 13 }}>My Dashboard</button>
              : <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{ fontSize: 13 }}>Sign in</button>
            }
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        {/* decorative rule */}
        <div style={s.heroRule} />

        <div style={s.heroInner}>
          <div style={s.heroBadgeRow}>
            <span style={s.heroBadge}>365-Day Reading Plan</span>
          </div>

          <img src="/pb-icon.svg" alt="P.B." style={s.heroIcon} />

          <h1 style={s.heroTitle}>
            A Year in the<br />Great Confessions
          </h1>

          <p style={s.heroSub}>
            Walk daily through the Second London Baptist Confession,
            Keach's Catechism, and the First London Baptist Confession —
            with Scripture proofs, pastoral quotes, and space for your own reflections.
          </p>

          <div style={s.heroCtas}>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={s.ctaPrimary}>
              Begin the Devotional
            </button>
            <button onClick={() => navigate('/quiz')} className="btn btn-outline" style={s.ctaSecondary}>
              How Particular Baptist Are You? →
            </button>
          </div>

          <p style={s.heroNote}>Free · No account required · Progress syncs when you sign in</p>
        </div>

        <div style={s.heroRule} />
      </section>

      {/* ── Preface Quote ── */}
      <section style={s.quoteSection}>
        <div style={s.quoteInner}>
          <div style={s.quoteMarkOpen}>"</div>
          <blockquote style={s.quoteText}>
            One thing that greatly prevailed with us to undertake this work was not only to give a
            full account of ourselves to those Christians that differ from us about the subject of
            baptism, but also the profit that might from thence arise unto those that have any
            account of our labors in their instruction and establishment in the great truths of the
            gospel, in the clear understanding and steady belief of which our comfortable walking
            with God, and fruitfulness before Him in all our ways, is most nearly concerned.
            Therefore, we did conclude it necessary to express ourselves the more fully and
            distinctly, and also to fix on such a method as might be most comprehensive of those
            things we designed to explain our sense and belief of.
          </blockquote>
          <div style={s.quoteMarkClose}>"</div>
          <div style={s.quoteAttrib}>
            <span style={s.quoteAttribLine} />
            <div>
              <div style={s.quoteAttribName}>The Particular Baptist Elders and Messengers</div>
              <div style={s.quoteAttribWork}>Preface — To the Judicious and Impartial Reader, 1677</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Confessions ── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.eyebrow}>Three Confessions · One Faith</p>
          <h2 style={s.sectionTitle}>The Standards of Particular Baptist Theology</h2>
          <div style={s.sourcesGrid}>
            {sources.map(src => (
              <div key={src.label} style={{...s.sourceCard, cursor: 'pointer'}} onClick={() => navigate(`/confessions?t=${src.route}`)}>
                <div style={s.sourceCardTop}>
                  <span style={{ ...s.sourceBadge, background: src.bg, color: src.color }}>{src.label}</span>
                  <span style={s.sourceCardYear}>{src.year}</span>
                </div>
                <div style={s.sourceCardName}>{src.name}</div>
                <div style={s.sourceCardChapters}>{src.chapters}</div>
                <p style={s.sourceCardDesc}>{src.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ ...s.section, background: 'white' }}>
        <div style={s.sectionInner}>
          <p style={s.eyebrow}>What's Inside</p>
          <h2 style={s.sectionTitle}>Everything for Daily Devotional Reading</h2>
          <div style={s.featuresGrid}>
            {features.map(f => (
              <div key={f.title} style={s.featureCard}>
                <div style={s.featureIcon}>{f.icon}</div>
                <div style={s.featureTitle}>{f.title}</div>
                <p style={s.featureBody}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quiz teaser ── */}
      <section style={{ ...s.section, background: 'var(--parchment-dark)' }}>
        <div style={{ ...s.sectionInner, textAlign: 'center' }}>
          <p style={s.eyebrow}>Test Your Knowledge</p>
          <h2 style={s.sectionTitle}>How Particular Baptist Are You?</h2>
          <p style={s.quizSub}>
            37 questions — one for each of the congregations that signed the 1689 Confession.
            From easy to expert, covering Scripture, soteriology, covenant theology, church practice, and history.
          </p>
          <div style={s.tierRow}>
            {['Seeker', 'Sympathizer', 'Convinced', 'Confessional', 'Particular Baptist'].map((t, i) => (
              <div key={t} style={{ ...s.tier, opacity: 0.35 + i * 0.16 }}>
                <div style={s.tierLabel}>{t}</div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/quiz')} className="btn btn-primary" style={{ ...s.ctaPrimary, marginTop: '2.25rem' }}>
            Start the Quiz →
          </button>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={s.ctaSection}>
        <div style={s.ctaSectionInner}>
          <img src="/pb-icon.svg" alt="P.B." style={s.ctaIcon} />
          <h2 style={s.ctaTitle}>Begin Your Year in the Confessions</h2>
          <p style={s.ctaBody}>
            No commitment required. Start today and mark your progress as you go.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn" style={s.ctaFinal}>
            Open the Devotional
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span style={s.footerText}>Created by Jeff Chavez with Claude Code</span>
          <span style={s.footerDot}>·</span>
          <a href="https://theologycheck.blog" target="_blank" rel="noopener noreferrer" style={s.footerLink}>
            <img
              src="https://theologycheckblog.wordpress.com/wp-content/uploads/2022/02/tc-logo.png"
              alt="TheologyCheck"
              style={{ height: 18, verticalAlign: 'middle', marginRight: 5 }}
            />
            theologycheck.blog
          </a>
        </div>
      </footer>
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--parchment)',
    fontFamily: "'DM Sans', sans-serif",
  },

  /* Nav */
  nav: {
    borderBottom: '1px solid var(--border)',
    background: 'rgba(245,240,232,0.96)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  navInner: {
    maxWidth: 1040,
    margin: '0 auto',
    padding: '12px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  navTitle: {
    fontSize: 15,
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    color: 'var(--ink)',
    letterSpacing: '0.01em',
  },
  navActions: { display: 'flex', alignItems: 'center', gap: 8 },

  /* Hero */
  hero: {
    textAlign: 'center',
    padding: '0 24px',
    background: 'var(--parchment)',
  },
  heroRule: {
    maxWidth: 160,
    margin: '3.5rem auto',
    height: 1,
    background: 'linear-gradient(to right, transparent, var(--border-strong), transparent)',
  },
  heroInner: { maxWidth: 700, margin: '0 auto' },
  heroBadgeRow: { marginBottom: '1.5rem' },
  heroBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--teal)',
    background: 'var(--teal-light)',
    borderRadius: 99,
    padding: '4px 14px',
  },
  heroIcon: { width: 76, height: 76, margin: '0 auto 1.75rem', display: 'block' },
  heroTitle: {
    fontSize: 'clamp(42px,7vw,76px)',
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    color: 'var(--ink)',
    lineHeight: 1.08,
    marginBottom: '1.5rem',
    letterSpacing: '-0.01em',
  },
  heroSub: {
    fontSize: 17,
    color: 'var(--ink-muted)',
    lineHeight: 1.8,
    maxWidth: 560,
    margin: '0 auto 2.5rem',
  },
  heroCtas: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  ctaPrimary: { fontSize: 15, padding: '12px 30px' },
  ctaSecondary: { fontSize: 14, padding: '11px 22px' },
  heroNote: { fontSize: 12, color: 'var(--ink-faint)', letterSpacing: '0.03em' },

  /* Preface Quote */
  quoteSection: {
    background: 'var(--ink)',
    padding: '5rem 28px',
  },
  quoteInner: {
    maxWidth: 760,
    margin: '0 auto',
    position: 'relative',
  },
  quoteMarkOpen: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 120,
    lineHeight: 1,
    color: 'rgba(255,255,255,0.08)',
    position: 'absolute',
    top: -20,
    left: -16,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  quoteMarkClose: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 120,
    lineHeight: 1,
    color: 'rgba(255,255,255,0.08)',
    position: 'absolute',
    bottom: 40,
    right: -16,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  quoteText: {
    fontSize: 'clamp(16px,2.2vw,20px)',
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 400,
    fontStyle: 'italic',
    color: 'rgba(250,247,242,0.88)',
    lineHeight: 1.85,
    margin: '0 0 2.5rem',
    position: 'relative',
    zIndex: 1,
  },
  quoteAttrib: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    position: 'relative',
    zIndex: 1,
  },
  quoteAttribLine: {
    display: 'block',
    width: 36,
    height: 1,
    background: 'var(--gold-light)',
    flexShrink: 0,
  },
  quoteAttribName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(250,247,242,0.75)',
    letterSpacing: '0.04em',
    marginBottom: 2,
  },
  quoteAttribWork: {
    fontSize: 12,
    color: 'rgba(250,247,242,0.4)',
    fontStyle: 'italic',
    letterSpacing: '0.02em',
  },

  /* Shared section */
  section: { padding: '5.5rem 28px' },
  sectionInner: { maxWidth: 1040, margin: '0 auto' },
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--teal)',
    marginBottom: '0.75rem',
  },
  sectionTitle: {
    fontSize: 'clamp(26px,4vw,42px)',
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    color: 'var(--ink)',
    marginBottom: '2.75rem',
    lineHeight: 1.18,
  },

  /* Sources */
  sourcesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
    gap: 20,
  },
  sourceCard: {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '28px 26px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sourceCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 99,
    letterSpacing: '0.06em',
  },
  sourceCardYear: { fontSize: 12, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' },
  sourceCardName: {
    fontSize: 19,
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    color: 'var(--ink)',
    lineHeight: 1.3,
  },
  sourceCardChapters: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  sourceCardDesc: {
    fontSize: 13.5,
    color: 'var(--ink-muted)',
    lineHeight: 1.7,
    margin: 0,
    marginTop: 4,
  },

  /* Features */
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: '0 32px',
  },
  featureCard: {
    padding: '24px 0',
    borderTop: '2px solid var(--border)',
  },
  featureIcon: { color: 'var(--teal)', marginBottom: 14 },
  featureTitle: { fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 7 },
  featureBody: { fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.7, margin: 0 },

  /* Quiz teaser */
  quizSub: {
    fontSize: 16,
    color: 'var(--ink-muted)',
    lineHeight: 1.75,
    maxWidth: 520,
    margin: '0 auto 0',
  },
  tierRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: '1.75rem',
  },
  tier: {
    background: 'var(--ink)',
    borderRadius: 99,
    padding: '5px 16px',
  },
  tierLabel: { fontSize: 12, fontWeight: 500, color: 'white', whiteSpace: 'nowrap' },

  /* Final CTA */
  ctaSection: {
    background: 'var(--ink)',
    padding: '6rem 28px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaSectionInner: { maxWidth: 560, margin: '0 auto', position: 'relative', zIndex: 1 },
  ctaIcon: {
    width: 52,
    height: 52,
    margin: '0 auto 1.75rem',
    display: 'block',
    opacity: 0.9,
  },
  ctaTitle: {
    fontSize: 'clamp(26px,4vw,40px)',
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 600,
    color: 'white',
    marginBottom: '1rem',
    lineHeight: 1.2,
  },
  ctaBody: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.7,
    marginBottom: '2.25rem',
  },
  ctaFinal: {
    fontSize: 15,
    padding: '13px 36px',
    background: 'white',
    color: 'var(--ink)',
    fontWeight: 600,
    borderRadius: 'var(--radius)',
  },

  /* Footer */
  footer: {
    borderTop: '1px solid var(--border)',
    background: 'white',
    padding: '20px 28px',
  },
  footerInner: {
    maxWidth: 1040,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  footerText: { fontSize: 13, color: 'var(--ink-faint)' },
  footerDot: { color: 'var(--border-strong)' },
  footerLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--ink-muted)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
  },
}
