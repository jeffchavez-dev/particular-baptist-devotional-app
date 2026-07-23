import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, migrateLocalToSupabase, syncBibleProgressUp, syncBibleProgressDown, syncUserDataUp, syncUserDataDown } from './lib/supabase'
import { syncAnnotationsUp, syncAnnotationsDown } from './lib/annotations'
import { syncBooksUp, syncBooksDown } from './lib/bookLibrary'
import { tryAdvancePlanForChapter } from './lib/biblePlan'
import { migrateOldPlan, ensureActivePlanMirrored, syncActivePlanFromLegacy, syncMultiPlansUp, syncMultiPlansDown } from './lib/multiPlan'
import { loadPrefs, savePrefs, DEFAULT_PREFS } from './components/FontPrefsPanel'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import QuizPage from './pages/QuizPage'
import ScripturePage from './pages/ScripturePage'
import ConfessionsPage from './pages/ConfessionsPage'
import AboutPage from './pages/AboutPage'
import LibraryPage from './pages/LibraryPage'
import SharedNotePage from './pages/SharedNotePage'
import BottomNav from './components/BottomNav'
import SplashScreen from './components/SplashScreen'
import OnboardingOverlay from './components/OnboardingOverlay'
import { useOnboarding } from './hooks/useOnboarding'

export const OnboardingContext = createContext({ startTour: () => {} })
export const useOnboardingCtx  = () => useContext(OnboardingContext)

export const AuthContext  = createContext(null)
export const useAuth      = () => useContext(AuthContext)

export const ThemeContext = createContext({ dark: false, toggleDark: () => {} })
export const useTheme     = () => useContext(ThemeContext)

export const PrefsContext = createContext({ prefs: DEFAULT_PREFS, updatePrefs: () => {} })
export const usePrefs     = () => useContext(PrefsContext)

export default function App() {
  const [session, setSession] = useState(undefined)
  const prevUser = useRef(null)
  const [showSplash, setShowSplash] = useState(true)
  const { active: tourActive, step: tourStep, start: startTour, next: tourNext, skip: tourSkip } = useOnboarding()

  /* ── Migrate old single-plan → multi-plan on first load ── */
  /* ── Then ensure the legacy keys match the active plan     ── */
  useEffect(() => {
    migrateOldPlan()
    ensureActivePlanMirrored()
  }, [])

  /* ── Global bible-chapter → plan sync bridge ──────────────────────
     When KjvReader or the tracker grid marks a chapter done/undone,
     tryAdvancePlanForChapter checks if it matches today's plan and
     advances/retreats the plan index automatically.
  ── */
  useEffect(() => {
    function onBibleChapterChanged(e) {
      const { chapter, done } = e.detail || {}
      if (chapter != null) tryAdvancePlanForChapter(chapter, !!done)
    }
    // After tryAdvancePlanForChapter writes legacy progress, mirror it back
    // into the multi-plan array so Supabase sync doesn't overwrite the advance.
    function onPlanChanged() {
      syncActivePlanFromLegacy()
    }
    window.addEventListener('pb-bible-chapter-changed', onBibleChapterChanged)
    window.addEventListener('pb-plan-changed', onPlanChanged)
    return () => {
      window.removeEventListener('pb-bible-chapter-changed', onBibleChapterChanged)
      window.removeEventListener('pb-plan-changed', onPlanChanged)
    }
  }, [])

  /* ── Online/offline detection ── */
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /* ── Sync annotations when tab becomes visible again ── */
  useEffect(() => {
    function onVisible() {
      if (!document.hidden && prevUser.current) {
        syncAnnotationsDown(prevUser.current.id)
        syncBibleProgressDown(prevUser.current.id)
        syncBooksDown(prevUser.current.id)
        syncMultiPlansDown(prevUser.current.id)
        syncUserDataDown(prevUser.current.id)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  /* Cross-device sync happens on login and on tab-focus (see visibilitychange above).
     Manual sync is available from the Settings page (AboutPage). */

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
  function updatePrefs(patch) {
    setPrefsState(prev => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }

  /* ── Auth ── */
  useEffect(() => {
    // Race getSession() against a 1.5 s timeout so an expired token that needs
    // a network refresh (offline → SW NetworkFirst waits up to 5 s) does NOT
    // block the Dashboard.  onAuthStateChange below will update the session
    // once the refresh eventually resolves — even after this early render.
    const sessionTimeout = new Promise(resolve =>
      setTimeout(() => resolve({ data: { session: null } }), 1500)
    )
    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user && !prevUser.current) {
        migrateLocalToSupabase(s.user.id)
        /* Sync annotations: push local data up, then pull server data down */
        syncAnnotationsUp(s.user.id)
          .then(() => syncAnnotationsDown(s.user.id))
          .catch(e => console.warn('[auth-sync-annotations] error:', e?.message))
        /* Sync Bible chapter progress: same pattern */
        syncBibleProgressUp(s.user.id)
          .then(() => syncBibleProgressDown(s.user.id))
          .catch(e => console.warn('[auth-sync-bible] error:', e?.message))
        /* Sync book library: push local → pull server */
        syncBooksUp(s.user.id)
          .then(() => syncBooksDown(s.user.id))
          .catch(e => console.warn('[auth-sync-books] error:', e?.message))
        /* Sync named Bible reading plans */
        syncMultiPlansUp(s.user.id)
          .then(() => syncMultiPlansDown(s.user.id))
          .catch(e => console.warn('[auth-sync-plans] error:', e?.message))
        /* Sync confession plan config/progress (part of generic pb_user_data) */
        syncUserDataUp(s.user.id)
          .then(() => syncUserDataDown(s.user.id))
          .catch(e => console.warn('[auth-sync-userdata] error:', e?.message))
      }
      prevUser.current = s?.user ?? null
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    /* Auth not yet resolved — show splash on top of the bare spinner so
       there is no visible flash before the app loads */
    return (
      <>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      <PrefsContext.Provider value={{ prefs, updatePrefs }}>
        <AuthContext.Provider value={{ session }}>
        <OnboardingContext.Provider value={{ startTour }}>
          {/* Public shared-note route — no splash, no nav, no offline banner */}
          <Routes>
            <Route path="/share/note/:token" element={<SharedNotePage />} />
            <Route path="*" element={
              <>
                {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
                {/* Offline banner */}
                {!isOnline && (
                  <div id="pwa-offline-banner" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    background: '#7a5c1e', color: 'white',
                    fontSize: 12, fontWeight: 500, textAlign: 'center',
                    padding: '6px 16px 6px', fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: '0.02em',
                  }}>
                    ✈ Offline — all readings available, sync paused
                  </div>
                )}
                <div style={!isOnline ? { paddingTop: 34 } : {}}>
                  <Routes>
                    <Route path="/auth"        element={session ? <Navigate to="/" /> : <AuthPage />} />
                    <Route path="/"            element={<Dashboard />} />
                    <Route path="/quiz"        element={<QuizPage />} />
                    <Route path="/scripture"   element={<ScripturePage />} />
                    <Route path="/confessions" element={<ConfessionsPage />} />
                    <Route path="/about"       element={<AboutPage />} />
                    <Route path="/library"     element={<LibraryPage />} />
                    <Route path="*"            element={<Navigate to="/" />} />
                  </Routes>
                  <BottomNav />
                </div>
              </>
            } />
          </Routes>
          {tourActive && !showSplash && (
            <OnboardingOverlay step={tourStep} onNext={tourNext} onSkip={tourSkip} />
          )}
        </OnboardingContext.Provider>
        </AuthContext.Provider>
      </PrefsContext.Provider>
    </ThemeContext.Provider>
  )
}
