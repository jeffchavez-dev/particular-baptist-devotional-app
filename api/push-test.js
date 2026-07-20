const webpush = require('web-push')

module.exports = function handler(req, res) {
  try {
    const keys = webpush.generateVAPIDKeys()
    res.status(200).json({ ok: true, pub: keys.publicKey.slice(0, 10) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
