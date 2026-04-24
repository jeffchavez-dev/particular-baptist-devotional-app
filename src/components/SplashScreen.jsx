import React, { useEffect, useState } from 'react'

/* ─── timing ─────────────────────────────────────────
   fade-in  : 700 ms
   hold     : 1 100 ms
   fade-out : 600 ms
   total    : ~2 400 ms then unmounts
──────────────────────────────────────────────────── */
const FADE_IN_MS  = 700
const HOLD_MS     = 1100
const FADE_OUT_MS = 600

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in') // 'in' | 'hold' | 'out'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), FADE_IN_MS)
    const t2 = setTimeout(() => setPhase('out'),  FADE_IN_MS + HOLD_MS)
    const t3 = setTimeout(onDone,                 FADE_IN_MS + HOLD_MS + FADE_OUT_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const opacity =
    phase === 'in'   ? 0   :
    phase === 'hold' ? 1   : 0

  const transition =
    phase === 'in'  ? `opacity ${FADE_IN_MS}ms ease`       :
    phase === 'out' ? `opacity ${FADE_OUT_MS}ms ease`       : 'none'

  return (
    <>
      <style>{`
        @keyframes pb-rule-grow {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        @keyframes pb-badge-up {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pb-icon-in {
          from { transform: scale(0.82); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes pb-title-up {
          from { transform: translateY(18px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pb-sub-up {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: '#110e0b',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity,
        transition,
        pointerEvents: phase === 'out' ? 'none' : 'all',
        userSelect: 'none',
      }}>

        {/* ── top decorative rule ── */}
        <div style={{
          width: 48, height: 1,
          background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
          marginBottom: 28,
          animation: 'pb-rule-grow 0.6s 0.15s both ease-out',
        }} />

        {/* ── badge ── */}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#c9a84c', opacity: 0.85,
          fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
          marginBottom: 22,
          animation: 'pb-badge-up 0.55s 0.25s both ease-out',
        }}>
          365-Day Reading Plan
        </div>

        {/* ── icon ── */}
        <img
          src="/pb-icon.svg"
          alt=""
          style={{
            width: 56, height: 56,
            marginBottom: 24,
            animation: 'pb-icon-in 0.6s 0.3s both cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />

        {/* ── title ── */}
        <h1 style={{
          margin: 0,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 'clamp(22px, 5vw, 28px)',
          fontWeight: 400,
          color: '#f5f0e8',
          textAlign: 'center',
          lineHeight: 1.35,
          letterSpacing: '0.01em',
          animation: 'pb-title-up 0.65s 0.4s both ease-out',
        }}>
          A Year in the<br />Great Confessions
        </h1>

        {/* ── sub ── */}
        <p style={{
          margin: '14px 0 0',
          fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
          fontSize: 13,
          color: '#c9a84c',
          opacity: 0.7,
          letterSpacing: '0.04em',
          textAlign: 'center',
          animation: 'pb-sub-up 0.6s 0.55s both ease-out',
        }}>
          On the Confessions &amp; Catechism
        </p>

        {/* ── bottom decorative rule ── */}
        <div style={{
          width: 48, height: 1,
          background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
          marginTop: 28,
          animation: 'pb-rule-grow 0.6s 0.65s both ease-out',
        }} />

      </div>
    </>
  )
}
