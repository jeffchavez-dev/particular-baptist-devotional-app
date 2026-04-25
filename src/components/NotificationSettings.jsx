import React, { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = 'BBCVNo8lVrGRVkDgO0rBh-toh_8CtTL8W5z4hAjMBO4RUNi5qF-9TXj3V6IvUMmMa4NmXme0ivMMmGw4AY9IAsg'

/** Convert VAPID public key (base64url) → Uint8Array */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function NotificationSettings({ userId }) {
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
          userId:       userId || null,
          action:       'subscribe',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      setSubscribed(true)
      setMsg('Notifications enabled — you\'ll receive a daily reminder each morning.')
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

  const busy = status === 'working'

  return (
    <div style={n.row}>
      <div style={n.label}>
        <span style={n.name}>Daily Reminders</span>
        <span style={n.hint}>
          {subscribed
            ? 'You\'ll receive a daily push notification on this device each morning.'
            : 'Get a daily push notification on this device reminding you to read.'}
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
