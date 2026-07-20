/**
 * GET /api/push-send  (triggered by Vercel Cron daily at 08:00 UTC)
 *
 * Sends every subscriber a daily reading reminder. Avoids importing from
 * src/lib/ (those files chain-import large data files that break serverless
 * bundling). Plan logic is inlined minimally here.
 *
 * Env vars required:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   CRON_SECRET  (optional — if set, request must include Authorization: Bearer <secret>)
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// ── Minimal plan helpers (no data file imports) ──────────────────────────────

const BIBLE_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]

const CHAPTER_COUNTS = [
  50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,
  66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,
  6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22,
]

function isTodayRestDay(config) {
  if (!config?.restDays?.length) return false
  return config.restDays.includes(new Date().getDay())
}

function getChapterLabel(config, currentIndex) {
  if (!config) return null
  // Build flat chapter list from plan books
  const books = config.books || BIBLE_BOOKS
  const chapters = []
  for (const book of books) {
    const idx = BIBLE_BOOKS.indexOf(book)
    if (idx === -1) continue
    const count = CHAPTER_COUNTS[idx] || 1
    for (let c = 1; c <= count; c++) chapters.push(`${book} ${c}`)
  }
  if (!chapters.length || currentIndex >= chapters.length) return null
  const cpd = config.chaptersPerDay || 1
  const result = []
  for (let i = 0; i < cpd; i++) {
    if (currentIndex + i < chapters.length) result.push(chapters[currentIndex + i])
  }
  return result.length ? result.join(' & ') : null
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const auth = req.headers['authorization'] || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const vapidPublic  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidMailto  = process.env.VAPID_MAILTO || 'jeffchavez0828@gmail.com'

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Missing VAPID env vars' })
  }

  webpush.setVapidDetails(`mailto:${vapidMailto}`, vapidPublic, vapidPrivate)

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
      // Fetch user's active Bible plan
      const { data: planRows } = await supabase
        .from('pb_bible_plans')
        .select('config, current_index')
        .eq('user_id', sub.user_id)
        .eq('is_active', true)
        .limit(1)

      const plan         = planRows?.[0] ?? null
      const isRestDay    = plan ? isTodayRestDay(plan.config) : false
      const chapterLabel = plan && !isRestDay
        ? getChapterLabel(plan.config, plan.current_index ?? 0)
        : null

      let body
      if (!plan) {
        body = "Time for your daily devotional reading. Open the app to continue."
      } else if (isRestDay) {
        body = "It's a rest day — but the app is ready when you are. 📖"
      } else if (chapterLabel) {
        body = `Today's reading: ${chapterLabel} 📖`
      } else {
        body = "Your Bible reading plan is complete! 🎉 Check the app to start a new plan."
      }

      const payload = JSON.stringify({
        title: 'Particular Baptist Devotional',
        body,
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
