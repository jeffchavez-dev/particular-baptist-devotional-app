import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.cross}>✦</div>
          <h1 style={styles.heroTitle}>365 Days Through the Confessions</h1>
          <p style={styles.heroSub}>
            A devotional journey through the Second London Baptist Confession,
            Keach's Catechism, and the First London Baptist Confession.
          </p>
          <div style={styles.pillGroup}>
            <span style={styles.pill}>2LBCF · 160 paragraphs</span>
            <span style={styles.pill}>Catechism · 114 Q&As</span>
            <span style={styles.pill}>1LBCF · 52 articles</span>
          </div>
        </div>
      </div>

      <div style={styles.right}>
        <div className="card fade-in" style={styles.formCard}>
          <div style={styles.tabs}>
            <button style={{...styles.tab, ...(mode==='signin'?styles.tabActive:{})}} onClick={()=>setMode('signin')}>Sign in</button>
            <button style={{...styles.tab, ...(mode==='signup'?styles.tabActive:{})}} onClick={()=>setMode('signup')}>Create account</button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'signup' && (
              <div style={styles.field}>
                <label style={styles.label}>Full name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'At least 6 characters':'Your password'} required minLength={6} />
            </div>

            {error   && <p style={styles.err}>{error}</p>}
            {message && <p style={styles.msg}>{message}</p>}

            <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:8}} disabled={loading}>
              {loading ? <span className="spinner" style={{width:16,height:16}} /> : (mode==='signin' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { display:'flex', minHeight:'100vh' },
  left: {
    flex:1, background:'var(--ink)', display:'flex',
    alignItems:'center', justifyContent:'center', padding:'3rem',
  },
  leftInner: { maxWidth:400, color:'var(--parchment)' },
  cross: { fontSize:28, color:'var(--gold-light)', marginBottom:'1.5rem', display:'block' },
  heroTitle: { fontSize:'clamp(28px,4vw,42px)', lineHeight:1.2, color:'var(--parchment)', marginBottom:'1rem' },
  heroSub: { fontSize:15, color:'rgba(250,247,242,0.65)', lineHeight:1.7, marginBottom:'2rem' },
  pillGroup: { display:'flex', flexWrap:'wrap', gap:8 },
  pill: {
    fontSize:11, fontWeight:500, padding:'4px 10px',
    border:'1px solid rgba(250,247,242,0.2)', borderRadius:99,
    color:'rgba(250,247,242,0.7)', letterSpacing:'0.04em',
  },
  right: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--parchment)' },
  formCard: { width:'100%', maxWidth:400, padding:'2rem' },
  tabs: { display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:'1.5rem' },
  tab: {
    flex:1, padding:'8px 0', background:'none', border:'none',
    fontSize:14, fontWeight:500, color:'var(--ink-faint)',
    borderBottom:'2px solid transparent', marginBottom:-1, transition:'all 0.15s',
  },
  tabActive: { color:'var(--ink)', borderBottomColor:'var(--gold)' },
  form: { display:'flex', flexDirection:'column', gap:16 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:13, fontWeight:500, color:'var(--ink-muted)' },
  err: { fontSize:13, color:'#c0392b', background:'#fdf0ee', padding:'8px 12px', borderRadius:'var(--radius)' },
  msg: { fontSize:13, color:'var(--teal)', background:'var(--teal-light)', padding:'8px 12px', borderRadius:'var(--radius)' },
}
