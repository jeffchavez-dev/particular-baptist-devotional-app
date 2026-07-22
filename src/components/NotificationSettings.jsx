import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const VAPID_PUBLIC_KEY = 'BB5f0jKlB_dNGFiUEJ4t8q0Jt3gEWI-3x6dwZRITz5Ixr3l7rhUSxbBIzVAdghbLXr-1cgRV2pYcQD8tIck0zSI'

const SLOTS = [
  { id: 'morning', label: 'Morning',  hint: '6:00 AM' },
  { id: 'midday',  label: 'Midday',   hint: '12:00 PM' },
  { id: 'evening', label: 'Evening',  hint: '7:00 PM' },
]

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
  const [slot,       setSlot]       = useState('morning')
  const [status,     setStatus]     = useState('idle')
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

    // Restore saved slot preference
    const saved = localStorage.getItem('pb-notif-slot')
    if (saved) setSlot(saved)
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
        body:    JSON.stringify({ subscription: sub.toJSON(), userId, slot, action: 'subscribe' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      localStorage.setItem('pb-notif-slot', slot)
      setSubscribed(true)
      setMsg(`Notifications enabled — you'll get a reminder every ${SLOTS.find(s => s.id === slot)?.label.toLowerCase()} at ${SLOTS.find(s => s.id === slot)?.hint}.`)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not enable notifications. Try again.')
    } finally {
      setStatus('idle')
    }
  }

  async function handleChangeSlot(newSlot) {
    setSlot(newSlot)
    if (!subscribed) return
    // Update slot in Supabase for active subscription
    setStatus('working')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push-subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription: sub.toJSON(), userId, slot: newSlot, action: 'subscribe' }),
        })
        localStorage.setItem('pb-notif-slot', newSlot)
        setMsg(`Reminder time updated to ${SLOTS.find(s => s.id === newSlot)?.label} (${SLOTS.find(s => s.id === newSlot)?.hint}).`)
      }
    } catch (err) {
      console.error(err)
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

  if (!supported) {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>Push notifications aren't supported in this browser. Install the app to your home screen (iOS 16.4+ / Android) or try Chrome/Edge on desktop.</span>
        </div>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>Notifications are blocked for this site. Open your browser's site settings, allow notifications, and reload the page.</span>
        </div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>Sign in to get a daily push notification naming today's actual Bible chapter and confession reading.</span>
        </div>
        <div style={n.controls}>
          <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{ fontSize: 13, flexShrink: 0 }}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const busy = status === 'working'

  return (
    <div style={n.block}>
      <div style={n.row}>
        <div style={n.label}>
          <span style={n.name}>Daily Reminders</span>
          <span style={n.hint}>
            {subscribed
              ? `You'll receive a daily reading reminder every ${SLOTS.find(s => s.id === slot)?.label.toLowerCase()} at ${SLOTS.find(s => s.id === slot)?.hint}.`
              : 'Get a daily push notification naming today\'s actual Bible chapter and confession reading.'}
          </span>
        </div>
        <div style={n.controls}>
          {subscribed ? (
            <button onClick={handleDisable} disabled={busy} className="btn btn-outline"
              style={{ fontSize: 13, color: '#b33', borderColor: 'rgba(180,50,50,0.3)', flexShrink: 0 }}>
              {busy ? 'Disabling…' : 'Turn off'}
            </button>
          ) : (
            <button onClick={handleEnable} disabled={busy} className="btn btn-primary"
              style={{ fontSize: 13, flexShrink: 0 }}>
              {busy ? 'Enabling…' : 'Enable notifications'}
            </button>
          )}
        </div>
      </div>

      {/* Time slot picker — shown always so user can pre-select before enabling */}
      <div style={n.slotRow}>
        <span style={n.slotLabel}>Reminder time</span>
        <div style={n.slotBtns}>
          {SLOTS.map(s => (
            <button
              key={s.id}
              onClick={() => handleChangeSlot(s.id)}
              disabled={busy}
              style={{
                ...n.slotBtn,
                background: slot === s.id ? 'var(--teal)' : 'transparent',
                color:      slot === s.id ? '#fff' : 'var(--ink-muted)',
                border:     slot === s.id ? '1.5px solid var(--teal)' : '1.5px solid var(--border)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>{s.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {msg   && <p style={n.success}>{msg}</p>}
      {error && <p style={n.errorMsg}>{error}</p>}
    </div>
  )
}

const n = {
  block: { paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border)' },
  row: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
  },
  label:    { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 180 },
  name:     { fontSize: 14, fontWeight: 600, color: 'var(--ink)' },
  hint:     { fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.5, maxWidth: 380 },
  controls: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
  slotRow:  { display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  slotLabel:{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 },
  slotBtns: { display: 'flex', gap: 8 },
  slotBtn:  {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, transition: 'all 0.15s',
  },
  success:  { fontSize: 12, color: 'var(--teal)', fontWeight: 500, margin: '8px 0 0' },
  errorMsg: { fontSize: 12, color: '#c33', margin: '8px 0 0', maxWidth: 260 },
}
