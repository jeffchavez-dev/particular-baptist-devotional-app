/**
 * GET /api/push-send  (triggered by Vercel Cron daily at 08:00 UTC)
 *
 * Sends a Web Push notification to all subscribers reminding them to read.
 *
 * Env vars required:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   CRON_SECRET  (set in Vercel dashboard, sent as Authorization: Bearer <secret>)
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getTodayDayNum() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
}

export default async function handler(req, res) {
  // Verify cron secret (Vercel passes it automatically when configured)
  const auth = req.headers['authorization'] || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Configure web-push VAPID
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || 'jeffchavez0828@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  const dayNum = getTodayDayNum()

  // Fetch all active subscriptions
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) {
    console.error('Supabase fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  if (!subs || subs.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No subscribers' })
  }

  const payload = JSON.stringify({
    title: 'Particular Baptist Devotional',
    body:  `Day ${dayNum} of your 365-day reading plan is ready. Open to read and reflect.`,
    icon:  '/pwa-192.png',
    badge: '/pwa-192.png',
    tag:   'daily-reading',
    url:   '/',
  })

  const results = await Promise.allSettled(
    subs.map(async sub => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      try {
        await webpush.sendNotification(pushSub, payload)
        return { ok: true }
      } catch (err) {
        // 410 Gone = expired subscription; clean it up
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      }
    })
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`Push send: day=${dayNum} sent=${sent} failed=${failed}`)
  return res.status(200).json({ sent, failed, day: dayNum })
}
