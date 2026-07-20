/**
 * GET /api/push-send  (triggered by Vercel Cron daily at 08:00 UTC)
 *
 * Sends every subscriber a personalized Web Push reminder naming today's
 * actual Bible reading-plan chapter(s) and Confession-plan item — the same
 * content Dashboard.jsx shows for that user.
 *
 * (Fixed single daily time, not per-user, since Vercel Cron on the Hobby
 * plan only supports a once-a-day schedule.)
 *
 * Env vars required:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
 *   CRON_SECRET  (set in Vercel dashboard, sent as Authorization: Bearer <secret>)
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { isTodayRestDay, getCurrentPlanChapters } from '../src/lib/planEngine.js'
import { isTodayConfRestDay, getCurrentConfItem } from '../src/lib/confessionPlan.js'

function bibleLine(planRow) {
  if (!planRow) return 'No Bible plan set up'
  const config   = planRow.config || {}
  const progress = { currentIndex: planRow.current_index ?? 0, lastAdvancedDate: planRow.last_advanced_date ?? null }
  if (isTodayRestDay(config)) return 'Rest day'
  const chapters = getCurrentPlanChapters(config, progress)
  return chapters?.length ? chapters.join(' & ') : 'Plan complete! 🎉'
}

function confLine(confConfig, confProgress) {
  if (!confConfig) return 'No confession plan set up'
  if (isTodayConfRestDay(confConfig)) return 'Rest day'
  const item = getCurrentConfItem(confConfig, confProgress)
  return item?.label || 'Plan complete! 🎉'
}

export default async function handler(req, res) {
  // Verify cron secret (Vercel passes it automatically when configured)
  const auth = req.headers['authorization'] || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || 'jeffchavez0828@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .not('user_id', 'is', null)

  if (error) {
    console.error('Supabase fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  if (!subs || subs.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No subscribers' })
  }

  const results = await Promise.allSettled(
    subs.map(async sub => {
      const [{ data: planRows }, { data: userDataRows }] = await Promise.all([
        supabase.from('pb_bible_plans')
          .select('config, current_index, last_advanced_date')
          .eq('user_id', sub.user_id).eq('is_active', true).limit(1),
        supabase.from('pb_user_data')
          .select('data_key, data_value')
          .eq('user_id', sub.user_id)
          .in('data_key', ['conf_plan_config', 'conf_plan_progress']),
      ])

      const planRow      = planRows?.[0] ?? null
      const confConfig    = userDataRows?.find(r => r.data_key === 'conf_plan_config')?.data_value ?? null
      const confProgress  = userDataRows?.find(r => r.data_key === 'conf_plan_progress')?.data_value ?? null

      const bible = bibleLine(planRow)
      const conf  = confLine(confConfig, confProgress)

      const payload = JSON.stringify({
        title: "Today's Reading",
        body:  `📖 Bible: ${bible}   📜 Confession: ${conf}`,
        icon:  '/pwa-192.png',
        badge: '/pwa-192.png',
        tag:   'daily-reading',
        url:   '/',
      })

      const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
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

  console.log(`Push send: sent=${sent} failed=${failed}`)
  return res.status(200).json({ sent, failed })
}
