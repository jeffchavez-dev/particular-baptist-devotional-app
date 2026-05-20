/**
 * Downloads Bible translations from fetch.bible CDN and converts them
 * to the app's internal JSON format:
 *   { book_slug: { chapter: [{ v: verse_num, t: text }] } }
 *
 * Usage: node scripts/download-translations.mjs
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')
const BASE_URL   = 'https://v1.fetch.bible/bibles'

// ── Slug mapping: fetch.bible code → app's localStorage key ──────────────
const FETCH_TO_APP = {
  gen:'genesis', exo:'exodus', lev:'leviticus', num:'numbers', deu:'deuteronomy',
  jos:'joshua', jdg:'judges', rut:'ruth', '1sa':'1samuel', '2sa':'2samuel',
  '1ki':'1kings', '2ki':'2kings', '1ch':'1chronicles', '2ch':'2chronicles',
  ezr:'ezra', neh:'nehemiah', est:'esther', job:'job', psa:'psalms',
  pro:'proverbs', ecc:'ecclesiastes', sng:'songofsolomon', isa:'isaiah',
  jer:'jeremiah', lam:'lamentations', ezk:'ezekiel', dan:'daniel',
  hos:'hosea', jol:'joel', amo:'amos', oba:'obadiah', jon:'jonah',
  mic:'micah', nam:'nahum', hab:'habakkuk', zep:'zephaniah', hag:'haggai',
  zec:'zechariah', mal:'malachi',
  mat:'matthew', mrk:'mark', luk:'luke', jhn:'john', act:'acts',
  rom:'romans', '1co':'1corinthians', '2co':'2corinthians', gal:'galatians',
  eph:'ephesians', php:'philippians', col:'colossians', '1th':'1thessalonians',
  '2th':'2thessalonians', '1ti':'1timothy', '2ti':'2timothy', tit:'titus',
  phm:'philemon', heb:'hebrews', jas:'james', '1pe':'1peter', '2pe':'2peter',
  '1jn':'1john', '2jn':'2john', '3jn':'3john', jud:'jude', rev:'revelation',
}

// All canonical books in order (OT then NT)
const ALL_BOOKS = Object.keys(FETCH_TO_APP)

// ── Translations to download ──────────────────────────────────────────────
const TRANSLATIONS = [
  { fetchId: 'eng_bsb', outFile: 'bsb.json',  label: 'Berean Standard Bible',    scope: 'full' },
  { fetchId: 'eng_gnv', outFile: 'gnv.json',  label: 'Geneva Bible (1599)',       scope: 'full' },
  { fetchId: 'eng_rv',  outFile: 'rv.json',   label: 'Revised Version (1895)',    scope: 'full' },
  { fetchId: 'eng_tnt', outFile: 'tnt.json',  label: 'Tyndale New Testament',     scope: 'nt'   },
]

const NT_START = 'mat'  // first NT book slug

// ── Helper: extract plain text from a verse element array ─────────────────
function extractVerseText(elements) {
  const parts = []
  for (const el of elements) {
    if (typeof el === 'string') {
      // Remove trailing \n used as paragraph separators
      parts.push(el.replace(/\n+/g, ' ').trim())
    } else if (el && typeof el === 'object') {
      // Skip headings and footnotes; they're separate structural data
      // type === 'note' | 'heading' | 'break' etc.
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// ── Helper: fetch with retry ──────────────────────────────────────────────
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url)
      if (r.status === 404) return null   // book not in this translation
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ── Download and convert one translation ─────────────────────────────────
async function downloadTranslation({ fetchId, outFile, label, scope }) {
  console.log(`\n📖  ${label} (${fetchId})`)
  const output = {}
  let bookCount = 0, verseCount = 0

  const books = scope === 'nt'
    ? ALL_BOOKS.slice(ALL_BOOKS.indexOf(NT_START))
    : ALL_BOOKS

  for (const slug of books) {
    const url = `${BASE_URL}/${fetchId}/txt/${slug}.json`
    process.stdout.write(`  ${slug}… `)

    const data = await fetchWithRetry(url)
    if (!data) { process.stdout.write('skipped (not found)\n'); continue }

    const appSlug = FETCH_TO_APP[slug]
    const bookOut = {}

    // contents is indexed by chapter (1-based), then verse (1-based)
    const chapters = data.contents || []
    for (let c = 1; c < chapters.length; c++) {
      const chapterArr = chapters[c]
      if (!chapterArr || !chapterArr.length) continue
      const verses = []
      for (let v = 1; v < chapterArr.length; v++) {
        const verseElements = chapterArr[v]
        if (!Array.isArray(verseElements)) continue
        const text = extractVerseText(verseElements)
        if (text) {
          verses.push({ v, t: text })
          verseCount++
        }
      }
      if (verses.length) bookOut[c] = verses
    }

    if (Object.keys(bookOut).length) {
      output[appSlug] = bookOut
      bookCount++
      process.stdout.write(`✓ (${Object.keys(bookOut).length} chapters)\n`)
    } else {
      process.stdout.write('empty — skipped\n')
    }

    // Small polite delay so we don't hammer the CDN
    await new Promise(r => setTimeout(r, 80))
  }

  const outPath = join(PUBLIC_DIR, outFile)
  writeFileSync(outPath, JSON.stringify(output))
  const sizeMB = (JSON.stringify(output).length / 1024 / 1024).toFixed(2)
  console.log(`  ✅ Saved ${outPath} — ${bookCount} books, ${verseCount} verses, ${sizeMB} MB`)
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log('Downloading Bible translations from fetch.bible…')
for (const t of TRANSLATIONS) {
  await downloadTranslation(t)
}
console.log('\n✅  All done!')
