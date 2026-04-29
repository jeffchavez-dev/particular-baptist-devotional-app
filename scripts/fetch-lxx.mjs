/**
 * Fetches all LXX (Septuagint) chapters from API.Bible and bundles
 * them into public/lxx.json for fully-offline PWA access.
 *
 * Setup:
 *   1. Get a free API key at https://api.bible.com/signin
 *   2. Run: API_BIBLE_KEY=your_key_here node scripts/fetch-lxx.mjs
 *   3. Or add to your .env and use: npm run fetch:lxx
 *
 * Note: Uses the UBSLPT (UBS LXX) Bible version ID from API.Bible
 * LXX includes additional deuterocanonical books beyond the Hebrew scriptures.
 */

import { writeFileSync } from 'fs'

const API_KEY = process.env.API_BIBLE_KEY
if (!API_KEY) {
  console.error('❌ Error: API_BIBLE_KEY environment variable not set')
  console.error('Get a free key at: https://api.bible.com/signin')
  process.exit(1)
}

// LXX book order with chapter counts (Rahlfs versification)
// Includes deuterocanonical books not in MT
const BOOKS = [
  { name: 'Genesis', chapters: 50 },
  { name: 'Exodus', chapters: 40 },
  { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 },
  { name: 'Deuteronomy', chapters: 34 },
  { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 },
  { name: 'Ruth', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Kings', chapters: 22 },
  { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 },
  { name: '2 Chronicles', chapters: 36 },
  { name: '1 Esdras', chapters: 9 },
  { name: '2 Esdras', chapters: 16 },
  { name: 'Tobit', chapters: 14 },
  { name: 'Judith', chapters: 16 },
  { name: 'Esther', chapters: 10 },
  { name: '1 Maccabees', chapters: 16 },
  { name: '2 Maccabees', chapters: 15 },
  { name: '3 Maccabees', chapters: 7 },
  { name: '4 Maccabees', chapters: 18 },
  { name: 'Psalms', chapters: 151 },
  { name: 'Odes of Solomon', chapters: 14 },
  { name: 'Proverbs', chapters: 31 },
  { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Songs', chapters: 8 },
  { name: 'Job', chapters: 42 },
  { name: 'Wisdom', chapters: 19 },
  { name: 'Sirach', chapters: 51 },
  { name: 'Psalms of Solomon', chapters: 18 },
  { name: 'Hosea', chapters: 14 },
  { name: 'Amos', chapters: 9 },
  { name: 'Micah', chapters: 7 },
  { name: 'Joel', chapters: 3 },
  { name: 'Obadiah', chapters: 1 },
  { name: 'Jonah', chapters: 4 },
  { name: 'Nahum', chapters: 3 },
  { name: 'Habakkuk', chapters: 3 },
  { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 },
  { name: 'Zechariah', chapters: 14 },
  { name: 'Malachi', chapters: 4 },
  { name: 'Isaiah', chapters: 66 },
  { name: 'Jeremiah', chapters: 52 },
  { name: 'Baruch', chapters: 5 },
  { name: 'Lamentations', chapters: 5 },
  { name: 'Letter of Jeremiah', chapters: 1 },
  { name: 'Ezekiel', chapters: 48 },
  { name: 'Susanna', chapters: 1 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Bel and the Dragon', chapters: 1 },
]

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

// Map English book names to API.Bible book IDs for UBSLPT (LXX)
// You may need to adjust these based on actual API.Bible IDs
const BOOK_ID_MAP = {
  'genesis': 'GEN', 'exodus': 'EXO', 'leviticus': 'LEV', 'numbers': 'NUM',
  'deuteronomy': 'DEU', 'joshua': 'JOS', 'judges': 'JDG', 'ruth': 'RUT',
  '1samuel': '1SA', '2samuel': '2SA', '1kings': '1KI', '2kings': '2KI',
  '1chronicles': '1CH', '2chronicles': '2CH', '1esdras': '1ES', '2esdras': '2ES',
  'tobit': 'TOB', 'judith': 'JDT', 'esther': 'EST', '1maccabees': '1MA',
  '2maccabees': '2MA', '3maccabees': '3MA', '4maccabees': '4MA', 'psalms': 'PSA',
  'odesosolomon': 'ODE', 'proverbs': 'PRO', 'ecclesiastes': 'ECC', 'songofsongs': 'SNG',
  'job': 'JOB', 'wisdom': 'WIS', 'sirach': 'SIR', 'psalmsosolomon': 'PSO',
  'hosea': 'HOS', 'amos': 'AMO', 'micah': 'MIC', 'joel': 'JOL', 'obadiah': 'OBA',
  'jonah': 'JON', 'nahum': 'NAH', 'habakkuk': 'HAB', 'zephaniah': 'ZEP',
  'haggai': 'HAG', 'zechariah': 'ZEC', 'malachi': 'MAL', 'isaiah': 'ISA',
  'jeremiah': 'JER', 'baruch': 'BAR', 'lamentations': 'LAM', 'letterofjeremiah': 'LJE',
  'ezekiel': 'EZK', 'susanna': 'SUS', 'daniel': 'DAN', 'belandthedragon': 'BEL',
}

async function fetchChapter(bookId, chapter, retries = 3) {
  const url = `https://api.scripture.api.bible/v1/bibles/UBSLPT/chapters/${bookId}.${chapter}/verses?include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'api-key': API_KEY }
      })
      if (res.status === 404) return [] // Chapter doesn't exist
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const json = await res.json()
      if (!json.data?.verses) return []
      
      // Store as compact {v, t} to save space
      return json.data.verses.map(v => ({
        v: parseInt(v.verseOrdinal),
        t: v.text.replace(/<[^>]*>/g, '').trim() // remove HTML tags
      }))
    } catch (e) {
      if (attempt === retries) {
        console.warn(`⚠️  Failed to fetch ${bookId} ch.${chapter}: ${e.message}`)
        return []
      }
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
}

const CONCURRENCY = 5 // API.Bible rate limiting
const result = {}
let fetched = 0
const total = BOOKS.reduce((s, b) => s + b.chapters, 0)

console.log(`Fetching ${total} chapters across ${BOOKS.length} books from API.Bible (LXX)…\n`)
const startTime = Date.now()

for (const book of BOOKS) {
  const s = slug(book.name)
  const bookId = BOOK_ID_MAP[s]
  
  if (!bookId) {
    console.warn(`⚠️  No mapping for book: ${book.name}`)
    continue
  }

  result[s] = {}

  // Fetch all chapters for this book concurrently in batches
  for (let ch = 1; ch <= book.chapters; ch += CONCURRENCY) {
    const batch = []
    for (let i = ch; i < Math.min(ch + CONCURRENCY, book.chapters + 1); i++) {
      batch.push(i)
    }
    const verses = await Promise.all(batch.map(i => fetchChapter(bookId, i)))
    batch.forEach((i, idx) => { 
      result[s][i] = verses[idx]
    })
    fetched += batch.length
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  process.stdout.write(`  ✓ ${book.name.padEnd(25)} ${fetched}/${total}  (${elapsed}s)\n`)
}

const json = JSON.stringify(result)
writeFileSync('public/lxx.json', json)

const kb = (json.length / 1024).toFixed(0)
console.log(`\n✅ Saved public/lxx.json  (${kb} KB uncompressed)\n`)
console.log('📖 LXX (Greek Septuagint) now available in your devotional app!')
