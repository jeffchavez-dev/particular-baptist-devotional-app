import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const VAPID_PUBLIC_KEY = 'BC9Dn5Pvou9_LphX4_-9SgKZAwEsPe47wQ2W9tpt-NgQiJQFYS9cCD69CL82Oe3MBBZfYTt-IL0CjZ7yjGg60oY'

/** Convert VAPID public key (base64url) → Uint8Array */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function NotificationSettings({ userId }) {
  const navigate = useNavigate()
  const [supported,  setSupported]  = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [status,     setStatus]     = useState('idle')  // idle | working
  const [msg,        setMsg]        = useState('')
  const [error,      setError]      = useState('')

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (!ok) return

    setPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (sub) setSubscribed(true) })
      .catch(() => {})
  }, [])

  async function handleEnable() {
    setError(''); setMsg('')
    setStatus('working')

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Notifications blocked — please allow them in your browser or device settings, then try again.')
        setStatus('idle')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const res = await fetch('/api/push-subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subscription: sub.toJSON(),
          userId,
          action: 'subscribe',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      setSubscribed(true)
      setMsg('Notifications enabled — you\'ll get a reminder naming today\'s actual reading each morning.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not enable notifications. Try again.')
    } finally {
      setStatus('idle')
    }
  }

  async function handleDisable() {
    setError(''); setMsg('')
    setStatus('working')

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push-subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription: sub.toJSON(), action: 'unsubscribe' }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setMsg('')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not disable notifications.')
    } finally {
      setStatus('idle')
    }
  }

  /* ── Not supported ── */
  if (!supported) {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>
            Push notifications aren't supported in this browser. Install the app to your home screen (iOS 16.4+ / Android) or try Chrome/Edge on desktop.
          </span>
        </div>
      </div>
    )
  }

  /* ── Permission denied ── */
  if (permission === 'denied') {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>
            Notifications are blocked for this site. Open your browser's site settings, allow notifications, and reload the page.
          </span>
        </div>
      </div>
    )
  }

  /* ── Sign-in required ──
     A personalized reminder needs to read your Bible/Confession plan progress
     server-side, which only exists in Supabase for signed-in accounts. */
  if (!userId) {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>
            Sign in to get a daily push notification naming today's actual Bible chapter and confession reading.
          </span>
        </div>
        <div style={n.controls}>
          <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{fontSize:13, flexShrink:0}}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const busy = status === 'working'

  return (
    <div style={n.row}>
      <div style={n.label}>
        <span style={n.name}>Daily Reminders</span>
        <span style={n.hint}>
          {subscribed
            ? 'You\'ll get a push notification naming today\'s Bible chapter and confession reading, once a day each morning.'
            : 'Get a daily push notification naming today\'s actual Bible chapter and confession reading.'}
        </span>
      </div>

      <div style={n.controls}>
        {subscribed ? (
          <button
            onClick={handleDisable}
            disabled={busy}
            className="btn btn-outline"
            style={{fontSize:13, color:'#b33', borderColor:'rgba(180,50,50,0.3)', flexShrink:0}}
          >
            {busy ? 'Disabling…' : 'Turn off'}
          </button>
        ) : (
          <button
            onClick={handleEnable}
            disabled={busy}
            className="btn btn-primary"
            style={{fontSize:13, flexShrink:0}}
          >
            {busy ? 'Enabling…' : 'Enable notifications'}
          </button>
        )}

        {msg   && <p style={n.success}>{msg}</p>}
        {error && <p style={n.errorMsg}>{error}</p>}
      </div>
    </div>
  )
}

const n = {
  row: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16,
    paddingBottom:16, marginBottom:16, borderBottom:'1px solid var(--border)',
    flexWrap:'wrap',
  },
  label:    { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:180 },
  name:     { fontSize:14, fontWeight:600, color:'var(--ink)' },
  hint:     { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5, maxWidth:380 },
  controls: { display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 },
  success:  { fontSize:12, color:'var(--teal)', fontWeight:500, margin:0 },
  errorMsg: { fontSize:12, color:'#c33', margin:0, maxWidth:260 },
}
