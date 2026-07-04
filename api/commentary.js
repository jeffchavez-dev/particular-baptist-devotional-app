/**
 * GET /api/commentary?src=calvin&book=romans&chapter=1
 *
 * Server-side proxy for commentaries that block browser CORS (e.g. BibleHub).
 * Returns the raw HTML/JSON from the upstream source with CORS headers so the
 * PWA can read it from the browser. Responses are cached on Vercel's CDN for
 * 24 hours so the upstream is hit at most once per chapter per day.
 */

const CALVIN_BOOKS = {
  'Genesis':         'genesis',
  'Joshua':          'joshua',
  'Psalms':          'psalms',
  'Isaiah':          'isaiah',
  'Jeremiah':        'jeremiah',
  'Lamentations':    'lamentations',
  'Ezekiel':         'ezekiel',
  'Daniel':          'daniel',
  'Hosea':           'hosea',
  'Joel':            'joel',
  'Amos':            'amos',
  'Obadiah':         'obadiah',
  'Jonah':           'jonah',
  'Micah':           'micah',
  'Nahum':           'nahum',
  'Habakkuk':        'habakkuk',
  'Zephaniah':       'zephaniah',
  'Haggai':          'haggai',
  'Zechariah':       'zechariah',
  'Malachi':         'malachi',
  'Matthew':         'matthew',
  'Mark':            'mark',
  'Luke':            'luke',
  'John':            'john',
  'Acts':            'acts',
  'Romans':          'romans',
  '1 Corinthians':   '1_corinthians',
  '2 Corinthians':   '2_corinthians',
  'Galatians':       'galatians',
  'Ephesians':       'ephesians',
  'Philippians':     'philippians',
  'Colossians':      'colossians',
  '1 Thessalonians': '1_thessalonians',
  '2 Thessalonians': '2_thessalonians',
  '1 Timothy':       '1_timothy',
  '2 Timothy':       '2_timothy',
  'Titus':           'titus',
  'Philemon':        'philemon',
  'Hebrews':         'hebrews',
  'James':           'james',
  '1 Peter':         '1_peter',
  '2 Peter':         '2_peter',
  '1 John':          '1_john',
  'Jude':            'jude',
}

export default async function handler(req, res) {
  // CORS — allow the PWA origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { src, book, chapter } = req.query

  if (src === 'calvin') {
    const slug = CALVIN_BOOKS[book]
    if (!slug || !chapter) return res.status(400).json({ error: 'Unknown book or missing chapter' })

    const url = `https://biblehub.com/commentaries/calvin/${slug}/${chapter}.htm`
    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PBDevotionalApp/1.0)' },
      })
      if (!upstream.ok) return res.status(502).json({ error: `Upstream ${upstream.status}` })

      const html = await upstream.text()
      // Cache on Vercel CDN for 24 hours, stale-while-revalidate for 1 hour after
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send(html)
    } catch (err) {
      return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message })
    }
  }

  return res.status(400).json({ error: 'Unknown src' })
}
