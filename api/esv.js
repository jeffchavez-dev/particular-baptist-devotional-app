/**
 * GET /api/esv?book=Romans&chapter=8
 *
 * Proxy for the ESV API. Keeps the API key server-side.
 * Returns normalized verse array: [{verse, text}]
 *
 * Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®),
 * copyright © 2001 by Crossway, a publishing ministry of Good News Publishers.
 * Used by permission. All rights reserved.
 */

export default async function handler(req, res) {
  const { book, chapter } = req.query

  if (!book || !chapter) {
    return res.status(400).json({ error: 'Missing book or chapter' })
  }

  const apiKey = process.env.ESV_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ESV API key not configured' })
  }

  const passage = `${book} ${chapter}`
  const url = new URL('https://api.esv.org/v3/passage/text/')
  url.searchParams.set('q', passage)
  url.searchParams.set('include-headings', 'false')
  url.searchParams.set('include-footnotes', 'false')
  url.searchParams.set('include-verse-numbers', 'true')
  url.searchParams.set('include-short-copyright', 'false')
  url.searchParams.set('include-passage-references', 'false')
  url.searchParams.set('indent-paragraphs', '0')
  url.searchParams.set('indent-poetry', 'false')

  let raw
  try {
    const upstream = await fetch(url.toString(), {
      headers: { Authorization: `Token ${apiKey}` },
    })
    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `ESV API error: ${body}` })
    }
    raw = await upstream.json()
  } catch (err) {
    return res.status(502).json({ error: `ESV API unreachable: ${err.message}` })
  }

  const text = raw.passages?.[0] ?? ''

  // Parse "[1] verse text [2] verse text ..." into [{verse, text}]
  const verses = []
  const re = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const verseText = m[2].replace(/\s+/g, ' ').trim()
    if (verseText) verses.push({ verse: parseInt(m[1], 10), text: verseText })
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
  res.status(200).json({ verses })
}
