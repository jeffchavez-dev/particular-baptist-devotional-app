import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, migrateLocalToSupabase } from './lib/supabase'
import { loadPrefs, savePrefs, DEFAULT_PREFS } from './components/FontPrefsPanel'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ReadingPage from './pages/ReadingPage'
import QuizPage from './pages/QuizPage'
import ScripturePage from './pages/ScripturePage'
import ConfessionsPage from './pages/ConfessionsPage'
import AboutPage from './pages/AboutPage'
import BottomNav from './components/BottomNav'

export const AuthContext  = createContext(null)
export const useAuth      = () => useContext(AuthContext)

export const ThemeContext = createContext({ dark: false, toggleDark: () => {} })
export const useTheme     = () => useContext(ThemeContext)

export const PrefsContext = createContext({ prefs: DEFAULT_PREFS, updatePrefs: () => {} })
export const usePrefs     = () => useContext(PrefsContext)

export default function App() {
  const [session, setSession] = useState(undefined)
  const prevUser = useRef(null)

  /* ── Theme (dark mode) ── */
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('pb-dark') === '1' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem('pb-dark', dark ? '1' : '0') } catch {}
  }, [dark])
  function toggleDark() { setDark(d => !d) }

  /* ── Font / reading prefs ── */
  const [prefs, setPrefsState] = useState(() => loadPrefs())
  function updatePrefs(p) { setPrefsState(p); savePrefs(p) }

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user && !prevUser.current) migrateLocalToSupabase(s.user.id)
      prevUser.current = s?.user ?? null
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      <PrefsContext.Provider value={{ prefs, updatePrefs }}>
        <AuthContext.Provider value={{ session }}>
          <Routes>
            <Route path="/auth"    element={session ? <Navigate to="/" /> : <AuthPage />} />
            <Route path="/"        element={<Dashboard />} />
            <Route path="/day/:dayNum" element={<ReadingPage />} />
            <Route path="/quiz"    element={<QuizPage />} />
            <Route path="/scripture"  element={<ScripturePage />} />
            <Route path="/confessions" element={<ConfessionsPage />} />
            <Route path="/about"   element={<AboutPage />} />
            <Route path="*"        element={<Navigate to="/" />} />
          </Routes>
          <BottomNav />
        </AuthContext.Provider>
      </PrefsContext.Provider>
    </ThemeContext.Provider>
  )
}
