/**
 * Fetches all 1,189 KJV Bible chapters from the GitHub CDN and bundles
 * them into public/kjv.json for fully-offline PWA access.
 *
 * Run once:  node scripts/fetch-kjv.mjs
 * Or via:    npm run fetch:kjv
 */

import { writeFileSync } from 'fs'

const BOOKS = [
  { name:'Genesis', chapters:50 },      { name:'Exodus', chapters:40 },
  { name:'Leviticus', chapters:27 },    { name:'Numbers', chapters:36 },
  { name:'Deuteronomy', chapters:34 },  { name:'Joshua', chapters:24 },
  { name:'Judges', chapters:21 },       { name:'Ruth', chapters:4 },
  { name:'1 Samuel', chapters:31 },     { name:'2 Samuel', chapters:24 },
  { name:'1 Kings', chapters:22 },      { name:'2 Kings', chapters:25 },
  { name:'1 Chronicles', chapters:29 }, { name:'2 Chronicles', chapters:36 },
  { name:'Ezra', chapters:10 },         { name:'Nehemiah', chapters:13 },
  { name:'Esther', chapters:10 },       { name:'Job', chapters:42 },
  { name:'Psalms', chapters:150 },      { name:'Proverbs', chapters:31 },
  { name:'Ecclesiastes', chapters:12 }, { name:'Song of Solomon', chapters:8 },
  { name:'Isaiah', chapters:66 },       { name:'Jeremiah', chapters:52 },
  { name:'Lamentations', chapters:5 },  { name:'Ezekiel', chapters:48 },
  { name:'Daniel', chapters:12 },       { name:'Hosea', chapters:14 },
  { name:'Joel', chapters:3 },          { name:'Amos', chapters:9 },
  { name:'Obadiah', chapters:1 },       { name:'Jonah', chapters:4 },
  { name:'Micah', chapters:7 },         { name:'Nahum', chapters:3 },
  { name:'Habakkuk', chapters:3 },      { name:'Zephaniah', chapters:3 },
  { name:'Haggai', chapters:2 },        { name:'Zechariah', chapters:14 },
  { name:'Malachi', chapters:4 },
  { name:'Matthew', chapters:28 },      { name:'Mark', chapters:16 },
  { name:'Luke', chapters:24 },         { name:'John', chapters:21 },
  { name:'Acts', chapters:28 },         { name:'Romans', chapters:16 },
  { name:'1 Corinthians', chapters:16 },{ name:'2 Corinthians', chapters:13 },
  { name:'Galatians', chapters:6 },     { name:'Ephesians', chapters:6 },
  { name:'Philippians', chapters:4 },   { name:'Colossians', chapters:4 },
  { name:'1 Thessalonians', chapters:5 },{ name:'2 Thessalonians', chapters:3 },
  { name:'1 Timothy', chapters:6 },     { name:'2 Timothy', chapters:4 },
  { name:'Titus', chapters:3 },         { name:'Philemon', chapters:1 },
  { name:'Hebrews', chapters:13 },      { name:'James', chapters:5 },
  { name:'1 Peter', chapters:5 },       { name:'2 Peter', chapters:3 },
  { name:'1 John', chapters:5 },        { name:'2 John', chapters:1 },
  { name:'3 John', chapters:1 },        { name:'Jude', chapters:1 },
  { name:'Revelation', chapters:22 },
]

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

async function fetchChapter(bookSlug, ch, retries = 3) {
  const url = `https://raw.githubusercontent.com/wldeh/bible-api/main/bibles/en-kjv/books/${bookSlug}/chapters/${ch}.json`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // Store as compact {v, t} to save space
      return (json.data || []).map(v => ({ v: parseInt(v.verse), t: v.text }))
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
}

const CONCURRENCY = 25 // parallel requests per batch
const result = {}
let fetched = 0
const total = BOOKS.reduce((s, b) => s + b.chapters, 0) // 1,189

console.log(`Fetching ${total} chapters across ${BOOKS.length} books…\n`)
const startTime = Date.now()

for (const book of BOOKS) {
  const s = slug(book.name)
  result[s] = {}

  // Fetch all chapters for this book concurrently in batches
  for (let ch = 1; ch <= book.chapters; ch += CONCURRENCY) {
    const batch = []
    for (let i = ch; i < Math.min(ch + CONCURRENCY, book.chapters + 1); i++) {
      batch.push(i)
    }
    const verses = await Promise.all(batch.map(i => fetchChapter(s, i)))
    batch.forEach((i, idx) => { result[s][i] = verses[idx] })
    fetched += batch.length
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  process.stdout.write(`  ✓ ${book.name.padEnd(22)} ${fetched}/${total}  (${elapsed}s)\n`)
}

const json = JSON.stringify(result)
writeFileSync('public/kjv.json', json)

const kb = (json.length / 1024).toFixed(0)
console.log(`\n✅ Saved public/kjv.json  (${kb} KB uncompressed)\n`)
