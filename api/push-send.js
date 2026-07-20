// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
const webpush   = require('web-push')
const { createClient } = require('@supabase/supabase-js')

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
  if (!config || !config.restDays || !config.restDays.length) return false
  return config.restDays.includes(new Date().getDay())
}

function getChapterLabel(config, currentIndex) {
  if (!config) return null
  var books    = config.books || BIBLE_BOOKS
  var chapters = []
  for (var i = 0; i < books.length; i++) {
    var book  = books[i]
    var idx   = BIBLE_BOOKS.indexOf(book)
    if (idx === -1) continue
    var count = CHAPTER_COUNTS[idx] || 1
    for (var c = 1; c <= count; c++) chapters.push(book + ' ' + c)
  }
  if (!chapters.length || currentIndex >= chapters.length) return null
  var cpd    = config.chaptersPerDay || 1
  var result = []
  for (var j = 0; j < cpd; j++) {
    if (currentIndex + j < chapters.length) result.push(chapters[currentIndex + j])
  }
  return result.length ? result.join(' & ') : null
}

module.exports = async function handler(req, res) {
  var auth = req.headers['authorization'] || ''
  if (process.env.CRON_SECRET && auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  var vapidPublic  = process.env.VAPID_PUBLIC_KEY
  var vapidPrivate = process.env.VAPID_PRIVATE_KEY
  var vapidMailto  = process.env.VAPID_MAILTO || 'jeffchavez0828@gmail.com'

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Missing VAPID env vars' })
  }

  webpush.setVapidDetails('mailto:' + vapidMailto, vapidPublic, vapidPrivate)

  var supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )

  var slot = req.query.slot || 'morning'

  var subsResult = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .not('user_id', 'is', null)
    .eq('slot', slot)

  if (subsResult.error) {
    console.error('Supabase fetch error:', subsResult.error)
    return res.status(500).json({ error: subsResult.error.message })
  }

  var subs = subsResult.data || []
  if (!subs.length) {
    return res.status(200).json({ sent: 0, message: 'No subscribers for slot: ' + slot })
  }

  var results = await Promise.allSettled(
    subs.map(async function(sub) {
      var planResult = await supabase
        .from('pb_bible_plans')
        .select('config, current_index')
        .eq('user_id', sub.user_id)
        .eq('is_active', true)
        .limit(1)

      var plan         = planResult.data && planResult.data[0] ? planResult.data[0] : null
      var isRestDay    = plan ? isTodayRestDay(plan.config) : false
      var chapterLabel = (plan && !isRestDay) ? getChapterLabel(plan.config, plan.current_index || 0) : null

      var body
      if (!plan) {
        body = 'Time for your daily devotional reading. Open the app to continue.'
      } else if (isRestDay) {
        body = "It's a rest day — but the app is ready when you are. 📖"
      } else if (chapterLabel) {
        body = "Today's reading: " + chapterLabel + ' 📖'
      } else {
        body = 'Your Bible reading plan is complete! 🎉 Check the app to start a new plan.'
      }

      var payload  = JSON.stringify({ title: 'Particular Baptist Devotional', body: body, icon: '/pwa-192.png', badge: '/pwa-192.png', tag: 'daily-reading', url: '/' })
      var pushSub  = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }

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

  var sent   = results.filter(function(r) { return r.status === 'fulfilled' }).length
  var failed = results.filter(function(r) { return r.status === 'rejected'  }).length
  console.log('Push send: slot=' + slot + ' sent=' + sent + ' failed=' + failed)
  return res.status(200).json({ sent: sent, failed: failed, slot: slot })
}
