const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabase.from('push_subscriptions').select('count').limit(1)
    res.status(200).json({ ok: true, supabase: error ? error.message : 'connected', webpush: typeof webpush.sendNotification })
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 300) })
  }
}
