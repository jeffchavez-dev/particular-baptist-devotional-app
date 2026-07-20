/**
 * POST /api/push-notify-update
 *
 * Called by a Vercel Webhook (event: "deployment.succeeded", scoped to this
 * project + Production) right after each production deploy finishes. Fetches
 * the freshly-deployed public/version.json, and if its "version" differs from
 * the last one we notified about, pushes an "Update available" notification
 * to every subscriber.
 *
 * Env vars required (in addition to the push-send.js ones):
 *   VERCEL_WEBHOOK_SECRET  (the signing secret shown when the webhook was created)
 *
 * NOTE: signature verification here follows Vercel's documented webhook
 * verification pattern (raw body + HMAC-SHA1 in the `x-vercel-signature`
 * header). This has not been exercised against a live webhook delivery yet —
 * double-check the payload field names below (`type`, `payload.target`,
 * `payload.deployment.url`) against an actual delivery in the Vercel
 * dashboard's webhook logs after the first real deploy, and adjust if the
 * shape differs.
 */

import crypto from 'crypto'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const webpush = require('web-push')
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawBody = await readRawBody(req)

  const secret = process.env.VERCEL_WEBHOOK_SECRET
  if (secret) {
    const signature = req.headers['x-vercel-signature']
    const expected   = crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
    if (signature !== expected) {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }

  let body
  try { body = JSON.parse(rawBody.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }

  if (body.type !== 'deployment.succeeded' || body.payload?.target !== 'production') {
    return res.status(200).json({ skipped: true, reason: 'not a production deployment.succeeded event' })
  }

  const deploymentUrl = body.payload?.deployment?.url
  if (!deploymentUrl) return res.status(400).json({ error: 'Missing deployment URL in payload' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )

  let versionInfo
  try {
    const resp = await fetch(`https://${deploymentUrl}/version.json`, { cache: 'no-store' })
    versionInfo = await resp.json()
  } catch (e) {
    console.error('Failed to fetch version.json:', e?.message)
    return res.status(500).json({ error: 'Could not fetch version.json' })
  }

  const { data: metaRow } = await supabase
    .from('pb_app_meta').select('value').eq('key', 'last_notified_version').maybeSingle()

  const lastNotified = metaRow?.value?.version
  if (lastNotified === versionInfo.version) {
    return res.status(200).json({ skipped: true, reason: 'already notified for this version', version: versionInfo.version })
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || 'jeffchavez0828@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const { data: subs, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (error) {
    console.error('Supabase fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  const payload = JSON.stringify({
    title: 'Update available',
    body:  `v${versionInfo.version} — ${versionInfo.changelog || 'New improvements are ready.'}`,
    icon:  '/pwa-192.png',
    badge: '/pwa-192.png',
    tag:   'app-update',
    url:   '/',
  })

  const results = await Promise.allSettled(
    (subs || []).map(async sub => {
      const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
      try {
        await webpush.sendNotification(pushSub, payload)
      } catch (err) {
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      }
    })
  )

  await supabase.from('pb_app_meta').upsert({
    key: 'last_notified_version',
    value: { version: versionInfo.version, notified_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  })

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  console.log(`Push update-notify: version=${versionInfo.version} sent=${sent} failed=${failed}`)
  return res.status(200).json({ sent, failed, version: versionInfo.version })
}
