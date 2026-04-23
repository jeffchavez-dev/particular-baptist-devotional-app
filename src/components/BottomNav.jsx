import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  {
    path: '/',
    label: 'Devotional',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 2L3 9v10a1 1 0 001 1h5v-5h4v5h5a1 1 0 001-1V9z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M11 2L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/confessions',
    label: 'Confession',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="2" width="13" height="17" rx="1.5"
          stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M3 6h13" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M16 14c1.5 0 3 .9 3 2.5S17.5 19 16 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/scripture',
    label: 'Scripture',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 4a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M9 7h5M7 10.5h8M7 13.5h8M7 16.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M9 2v6l2-1.5L13 8V2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  /* Determine active tab — treat /day/:num as "Devotional" */
  function getActive() {
    if (pathname === '/' || pathname.startsWith('/day/')) return '/'
    if (pathname.startsWith('/confessions')) return '/confessions'
    if (pathname.startsWith('/scripture')) return '/scripture'
    return null
  }
  const active = getActive()
  if (active === null) return null   // hide on /auth, /quiz etc.

  return (
    <>
      {/* Spacer so content isn't hidden behind the nav */}
      <div data-bottom-nav style={n.spacer} />

      <nav data-bottom-nav style={n.nav} aria-label="Main navigation">
        {TABS.map(tab => {
          const isActive = active === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                ...n.tab,
                color: isActive ? 'var(--teal)' : 'var(--ink-faint)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span style={n.icon}>{tab.icon(isActive)}</span>
              <span style={{
                ...n.label,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--teal)' : 'var(--ink-faint)',
              }}>
                {tab.label}
              </span>
              {isActive && <span style={n.indicator} />}
            </button>
          )
        })}
      </nav>
    </>
  )
}

const n = {
  /* Only renders on ≤ 768px — use a CSS class trick via inline style + media won't work,
     so we use a wrapper div and the nav itself is always rendered but hidden on desktop
     via the class approach below. We use display:flex always; Desktop hides via CSS class. */
  spacer: {
    height: 64,
    // Hide spacer on desktop
    display: 'block',
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: 'white',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'stretch',
    zIndex: 100,
    boxShadow: '0 -2px 12px rgba(0,0,0,0.07)',
    // Safe area for iOS home indicator
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 4px 4px',
    position: 'relative',
    transition: 'color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
    WebkitTapHighlightColor: 'transparent',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: '0 0 2px 2px',
    background: 'var(--teal)',
  },
}
