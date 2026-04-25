/**
 * POST /api/push-subscribe
 * Saves (or removes) a Web Push subscription to Supabase.
 *
 * Body: { subscription: PushSubscription, userId?: string, action?: 'subscribe'|'unsubscribe' }
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { subscription, userId, action = 'subscribe', notifyHour } = req.body || {}

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' })
  }

  if (action === 'unsubscribe') {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)

    if (error) return res.status(500).json({ error: error.message })
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

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true, action: 'subscribed' })
}
