import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, migrateLocalToSupabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ReadingPage from './pages/ReadingPage'
import QuizPage from './pages/QuizPage'
import ScripturePage from './pages/ScripturePage'
import ConfessionsPage from './pages/ConfessionsPage'
import BottomNav from './components/BottomNav'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const [session, setSession] = useState(undefined)
  const prevUser = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user && !prevUser.current) {
        migrateLocalToSupabase(s.user.id)
      }
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
    <AuthContext.Provider value={{ session }}>
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" /> : <AuthPage />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/day/:dayNum" element={<ReadingPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/scripture" element={<ScripturePage />} />
        <Route path="/confessions" element={<ConfessionsPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </AuthContext.Provider>
  )
}
