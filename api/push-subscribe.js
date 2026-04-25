/**
 * POST /api/push-subscribe
 * Saves (or removes) a Web Push subscription to Supabase.
 *
 * Body: { subscription: PushSubscription, userId?: string, action?: 'subscribe'|'unsubscribe' }
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Allow CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Create client inside handler so env vars are definitely resolved
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey })
      return res.status(500).json({ error: 'Server configuration error: missing Supabase credentials' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { subscription, userId, action = 'subscribe', notifyHour } = req.body || {}

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription object' })
    }

    if (action === 'unsubscribe') {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)

      if (error) {
        console.error('Supabase delete error:', error)
        return res.status(500).json({ error: error.message })
      }
      return res.status(200).json({ ok: true, action: 'unsubscribed' })
    }

    // Upsert subscription
    const row = {
      endpoint:    subscription.endpoint,
      p256dh:      subscription.keys?.p256dh  || null,
      auth:        subscription.keys?.auth     || null,
      user_id:     userId || null,
      notify_hour: (notifyHour !== undefined && notifyHour !== null) ? Number(notifyHour) : null,
      created_at:  new Date().toISOString(),
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true, action: 'subscribed' })

  } catch (err) {
    console.error('Unexpected error in push-subscribe:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
