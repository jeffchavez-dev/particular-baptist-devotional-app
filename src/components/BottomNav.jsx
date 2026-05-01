import React, { useState, useEffect } from 'react'
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
  {
    path: '/about',
    label: 'Settings',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}
        />
        <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 769)
  const [visible,   setVisible]   = useState(true)

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 769)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* Auto-hide on scroll down, show on scroll up */
  useEffect(() => {
    function onScrollDir(e) {
      const { direction, scrollTop } = e.detail
      setVisible(direction === 'up' || scrollTop < 30)
    }
    window.addEventListener('pb-scroll-dir', onScrollDir)
    return () => window.removeEventListener('pb-scroll-dir', onScrollDir)
  }, [])

  /* Always show when route changes */
  useEffect(() => { setVisible(true) }, [pathname])

  function getActive() {
    if (pathname === '/' || pathname.startsWith('/day/')) return '/'
    if (pathname.startsWith('/confessions')) return '/confessions'
    if (pathname.startsWith('/scripture'))  return '/scripture'
    if (pathname.startsWith('/about'))      return '/about'
    return null
  }
  const active = getActive()
  if (active === null) return null

  function getTargetPath(tab) {
    if (tab.path !== '/') return tab.path
    try { return localStorage.getItem('pb-last-devotional-path') || '/' } catch { return '/' }
  }

  const desktopNav = isDesktop ? {
    left: '50%',
    right: 'auto',
    transform: 'translateX(-50%)',
    maxWidth: 640,
    borderLeft: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    borderRadius: '14px 14px 0 0',
  } : {}

  return (
    <>
      <div data-bottom-nav style={n.spacer} />
      <nav
        data-bottom-nav
        style={{
          ...n.nav,
          ...desktopNav,
          transform: isDesktop
            ? `translateX(-50%) translateY(${visible ? '0' : '100%'})`
            : `translateY(${visible ? '0' : '100%'})`,
          transition: 'transform 0.28s ease',
        }}
        aria-label="Main navigation"
      >
        {TABS.map(tab => {
          const isActive = active === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(getTargetPath(tab))}
              style={{ ...n.tab, color: isActive ? 'var(--teal)' : 'var(--ink-faint)' }}
              title={tab.label}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span style={n.icon}>{tab.icon(isActive)}</span>
              {isActive && <span style={n.indicator} />}
            </button>
          )
        })}
      </nav>
    </>
  )
}

const n = {
  spacer: { height: 'calc(64px + env(safe-area-inset-bottom))', display: 'block' },
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    paddingBottom: 'env(safe-area-inset-bottom)',
    background: 'var(--surface)', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'flex-start', zIndex: 100,
    boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
    paddingLeft:  'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
  tabWrap: { height: 64 },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 0, background: 'none', border: 'none',
    cursor: 'pointer', padding: '12px 4px 8px', position: 'relative',
    transition: 'color 0.15s', fontFamily: "'DM Sans', sans-serif",
    WebKitTapHighlightColor: 'transparent',
  },
  icon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute', top: 0, left: '20%', right: '20%',
    height: 2, borderRadius: '0 0 2px 2px', background: 'var(--teal)',
  },
}
