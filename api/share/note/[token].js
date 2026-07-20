/**
 * GET /share/note/:token
 *
 * Server-renders a shared note page with Open Graph meta tags so that
 * social media previews (iMessage, WhatsApp, Twitter, etc.) show the
 * note title and a description. Humans and bots both get this page —
 * the React SPA's SharedNotePage handles in-app navigation only.
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { token } = req.query

  if (!token) {
    return res.status(400).send('Missing token')
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).send('Server configuration error')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from('pb_shared_notes')
    .select('note_data, book_title, book_author, updated_at')
    .eq('token', token)
    .single()

  if (error || !data) {
    return res.status(404).send(notFoundHtml())
  }

  const noteText = data.note_data?.text || ''
  const isRich   = noteText.startsWith('<!RICH>')

  let noteTitle   = ''
  let bodyHtml    = ''
  let description = ''

  if (isRich) {
    try {
      const parsed = JSON.parse(noteText.slice(7))
      noteTitle = parsed.title || ''
      bodyHtml  = parsed.body  || ''
      description = bodyHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160)
    } catch {
      bodyHtml = noteText.slice(7)
    }
  } else {
    bodyHtml    = `<p>${esc(noteText)}</p>`
    description = noteText.slice(0, 160)
  }

  const displayTitle = noteTitle || data.book_title || 'Shared Note'
  const source       = data.book_author || data.book_title || ''
  const ogDesc       = description || (source ? `A note from ${source}` : 'A note from Particular Baptist Devotional')
  const appUrl       = `https://pbdevotional.app/share/note/${token}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.status(200).send(renderPage({ displayTitle, noteTitle, bodyHtml, source, ogDesc, appUrl, isRich, updatedAt: data.updated_at }))
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

function renderPage({ displayTitle, noteTitle, bodyHtml, source, ogDesc, appUrl, isRich, updatedAt }) {
  const richStyles = isRich ? `
    .rich h1 { font-size:1.35em; font-weight:700; margin:.4em 0 .2em; font-family:'Cormorant Garamond',serif; }
    .rich h2 { font-size:1.1em;  font-weight:700; margin:.4em 0 .15em; font-family:'Cormorant Garamond',serif; }
    .rich p  { margin:.2em 0; }
    .rich ul, .rich ol { padding-left:1.4em; margin:.3em 0; }
    .rich li { margin:.15em 0; padding-left:.2em; }
    .rich blockquote, .rich .sc-quote {
      border-left:3px solid #1d6b5a; margin:8px 0; padding:8px 12px;
      background:rgba(29,107,90,.06); border-radius:0 8px 8px 0;
      font-style:italic; color:#2c2417;
    }
    .rich blockquote em, .rich .sc-quote em { font-style:normal; }
    .rich strong { font-weight:700; }
    .rich em { font-style:italic; }
    .rich a { color:#1d6b5a; }
  ` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(displayTitle)} — Particular Baptist Devotional</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />

  <!-- Open Graph -->
  <meta property="og:type"         content="article" />
  <meta property="og:title"        content="${esc(displayTitle)}" />
  <meta property="og:description"  content="${esc(ogDesc)}" />
  <meta property="og:url"          content="${esc(appUrl)}" />
  <meta property="og:site_name"    content="Particular Baptist Devotional" />
  <meta property="og:image"        content="https://pbdevotional.app/pwa-512.png" />
  <meta property="og:image:width"  content="512" />
  <meta property="og:image:height" content="512" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${esc(displayTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image"       content="https://pbdevotional.app/pwa-512.png" />

  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: #faf7f2;
      font-family: 'DM Sans', sans-serif;
      color: #2c2417;
    }
    .page {
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center;
      padding: 0 16px 40px;
    }
    .header {
      width: 100%; max-width: 600px;
      padding: 20px 0 16px;
      border-bottom: 1px solid #e8e2d8;
      margin-bottom: 24px;
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: inherit;
    }
    .header img { width: 32px; height: 32px; border-radius: 8px; }
    .brand { font-size: 16px; font-weight: 700; font-family: 'Cormorant Garamond', serif; }
    .card {
      width: 100%; max-width: 600px;
      background: #fff;
      border: 1px solid #e8e2d8;
      border-radius: 16px; padding: 24px 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,.07);
    }
    .source {
      font-size: 12px; color: #9c8c72;
      padding-bottom: 14px; margin-bottom: 14px;
      border-bottom: 1px solid #e8e2d8;
    }
    .note-title {
      font-size: 20px; font-weight: 700;
      font-family: 'Cormorant Garamond', serif;
      margin-bottom: 12px;
    }
    .plain-text {
      font-size: 17px; line-height: 1.75;
      font-family: 'Cormorant Garamond', serif;
      white-space: pre-wrap; word-break: break-word;
    }
    .updated {
      font-size: 11px; color: #9c8c72;
      margin-top: 16px; padding-top: 12px;
      border-top: 1px solid #e8e2d8;
    }
    .footer { margin-top: 24px; font-size: 12px; color: #9c8c72; }
    .footer a { color: #9c8c72; text-decoration: none; }
    ${richStyles}
  </style>
</head>
<body>
  <div class="page">
    <a class="header" href="https://pbdevotional.app">
      <img src="https://pbdevotional.app/pwa-192.png" alt="Particular Baptist Devotional" />
      <span class="brand">Particular Baptist Devotional</span>
    </a>

    <div class="card">
      ${source ? `<div class="source">📖 ${esc(source)}</div>` : ''}
      ${noteTitle ? `<div class="note-title">${esc(noteTitle)}</div>` : ''}
      ${isRich
        ? `<div class="rich" style="font-size:16px;line-height:1.8;font-family:'Cormorant Garamond',serif;word-break:break-word;">${bodyHtml}</div>`
        : `<div class="plain-text">${bodyHtml}</div>`
      }
      ${updatedAt ? `<div class="updated">Last updated ${formatDate(updatedAt)}</div>` : ''}
    </div>

    <div class="footer">
      <a href="https://pbdevotional.app">Made with Particular Baptist Devotional</a>
    </div>
  </div>
</body>
</html>`
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Note not found — Particular Baptist Devotional</title>
  <meta property="og:title" content="Note not found" />
  <meta property="og:description" content="This shared note may have been removed or the link is invalid." />
</head>
<body style="font-family:sans-serif;padding:2rem;background:#faf7f2;">
  <p>This shared note may have been removed or the link is invalid.</p>
  <a href="https://pbdevotional.app">← Go to Particular Baptist Devotional</a>
</body>
</html>`
}
