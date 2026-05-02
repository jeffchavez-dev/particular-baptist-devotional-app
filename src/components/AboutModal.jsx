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

export default function AboutModal({ open, onClose }) {
  const navigate = useNavigate()
  const { session } = useAuth()

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/pb-icon.png" alt="P.B." style={{ width: 28, height: 28, borderRadius: '50%' }} />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--ink)' }}>
                About Particular Baptist Devotional
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-faint)',
                fontSize: '24px',
                lineHeight: '1',
                padding: '4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '32px', color: 'var(--ink)' }}>
            {/* Intro */}
            <div style={{ marginBottom: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '16px', lineHeight: '1.7', maxWidth: '600px', margin: '0 auto 16px', color: 'var(--ink-muted)' }}>
                A year of daily reading through the foundational confessions and catechism of Particular Baptist theology. Walk through Scripture doctrine with historical voices, pastoral quotes, and space for your own reflections.
              </p>
            </div>

            {/* Features */}
            <div style={{ marginBottom: '48px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)', marginBottom: '24px' }}>
                Features
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {features.map((feat, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--teal)', flexShrink: 0, marginTop: '2px' }}>
                      {feat.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                        {feat.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--ink-muted)' }}>
                        {feat.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)', marginBottom: '24px' }}>
                The Confessions
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {sources.map((src, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      navigate(`/confessions?t=${src.route}`)
                      onClose()
                    }}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: src.bg,
                      border: `1.5px solid ${src.color}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: src.color, letterSpacing: '0.05em' }}>
                        {src.label}
                      </span>
                      <span style={{ fontSize: '11px', color: src.color, opacity: '0.7' }}>
                        {src.year}
                      </span>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600', color: src.color }}>
                      {src.name}
                    </h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--ink-muted)', lineHeight: '1.5' }}>
                      {src.desc}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: '500', color: src.color }}>
                      {src.chapters} →
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '12px', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Built with Scripture and historical theology in mind.
              </p>
              <p style={{ margin: 0 }}>
                © 2026 Particular Baptist Devotional. Licensed under <a href="#" style={{ color: 'var(--teal)', textDecoration: 'none' }}>CC BY-NC-SA 4.0</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
