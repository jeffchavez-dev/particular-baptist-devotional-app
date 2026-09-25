import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  {
    path: '/home',
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
    icon: (_active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 2v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M4 7.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/library',
    label: 'My Library',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="16" height="16" rx="2"
          stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M7 8h8M7 11.5h5M7 15h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M15 3v4l-1.5-1-1.5 1V3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
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
  const isDesktopRef = useRef(window.innerWidth >= 769)

  useEffect(() => {
    const handler = () => {
      const d = window.innerWidth >= 769
      isDesktopRef.current = d
      setIsDesktop(d)
      if (d) setVisible(true)   // always show when switching to desktop
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* Auto-hide on scroll down, show on scroll up — mobile only */
  useEffect(() => {
    function onScrollDir(e) {
      if (isDesktopRef.current) return   // never hide on desktop
      const { direction, scrollTop } = e.detail
      setVisible(direction === 'up' || scrollTop < 30)
    }
    window.addEventListener('pb-scroll-dir', onScrollDir)
    return () => window.removeEventListener('pb-scroll-dir', onScrollDir)
  }, [])

  /* Always show when route changes */
  useEffect(() => { setVisible(true) }, [pathname])

  function getActive() {
    if (pathname === '/home') return '/home'
    if (pathname.startsWith('/confessions')) return '/confessions'
    if (pathname.startsWith('/scripture'))  return '/scripture'
    if (pathname.startsWith('/library'))    return '/library'
    if (pathname.startsWith('/about'))      return '/about'
    return null
  }
  const active = getActive()
  if (active === null) return null

  function getTargetPath(tab) {
    return tab.path
  }

  const desktopNav = isDesktop ? {
    left: '50%',
    right: 'auto',
    transform: 'translateX(-50%)',
    maxWidth: 480,
  } : {}

  return (
    <>
      <div
        data-bottom-nav
        style={{
          ...n.spacer,
          height: visible ? 'calc(80px + env(safe-area-inset-bottom))' : 0,
        }}
      />
      <nav
        data-bottom-nav
        style={{
          ...n.nav,
          ...desktopNav,
          transform: isDesktop
            ? `translateX(-50%) translateY(${visible ? '0' : 'calc(100% + 24px)'})`
            : `translateY(${visible ? '0' : 'calc(100% + 24px)'})`,
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
              data-onboarding={`nav-${tab.path.replace('/', '') || 'home'}`}
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
  spacer: { height: 'calc(80px + env(safe-area-inset-bottom))', display: 'block', transition: 'height 0.28s ease' },
  nav: {
    position: 'fixed',
    bottom: 'calc(12px + env(safe-area-inset-bottom))',
    left: 16, right: 16,
    borderRadius: 99,
    background: 'var(--surface)',
    display: 'flex', alignItems: 'center', zIndex: 100,
    boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)',
    border: '1px solid var(--border)',
    padding: '0 4px',
  },
  tabWrap: { height: 64 },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 0, background: 'none', border: 'none',
    cursor: 'pointer', padding: '12px 4px', position: 'relative',
    transition: 'color 0.15s', fontFamily: "'DM Sans', sans-serif",
    WebKitTapHighlightColor: 'transparent',
  },
  icon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute', bottom: 6, left: '30%', right: '30%',
    height: 3, borderRadius: 99, background: 'var(--teal)',
  },
}
