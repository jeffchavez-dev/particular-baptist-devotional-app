/**
 * build-lxx.mjs
 *
 * Generates public/lxx.json from the eliranwong/LXX-Rahlfs-1935 GitHub repo.
 *
 * The LXX Rahlfs-1935 data is split across two files:
 *   - 01_wordlist_unicode/text_accented.csv  : globalIndex \t localIndex \t word
 *   - 08_versification/001_verse_c_modified_KEEP.csv : Book.Ch.V \t wordStartIndex
 *
 * Run: node scripts/build-lxx.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')

const REPO_BASE = 'https://raw.githubusercontent.com/eliranwong/LXX-Rahlfs-1935/master'
const WORD_URL  = `${REPO_BASE}/01_wordlist_unicode/text_accented.csv`
const VERSE_URL = `${REPO_BASE}/08_versification/001_verse_c_modified_KEEP.csv`

// ── Book abbreviations that are DUPLICATE manuscripts — skip them ──────────
// Keep: JoshB (not JoshA), JudgB (not JudgA), Tob/TobBA (not TobS),
//       DanTh (not DanOG), SusTh (not SusOG), BelTh/Bel (not BelOG)
const SKIP_BOOKS = new Set([
  'JoshA', 'JudgA', 'TobS',
  'DanOG', 'SusOG', 'BelOG',
  // Large Isaiah/Jeremiah split identifiers that appear as sub-manuscripts
  'IsaA', 'JerA',
])

// ── LXX abbreviation → canonical English name used in the app ─────────────
// 2Esd in LXX = Ezra (ch 1-10) + Nehemiah (ch 11-23); handled specially below.
const BOOK_MAP = {
  'Gen':    'Genesis',
  'Exod':   'Exodus',
  'Lev':    'Leviticus',
  'Num':    'Numbers',
  'Deut':   'Deuteronomy',
  'JoshB':  'Joshua',
  'Josh':   'Joshua',
  'JudgB':  'Judges',
  'Judg':   'Judges',
  'Ruth':   'Ruth',
  '1Sam':   '1 Samuel',
  '2Sam':   '2 Samuel',
  '1Kgs':   '1 Kings',
  '2Kgs':   '2 Kings',
  '1Chr':   '1 Chronicles',
  '2Chr':   '2 Chronicles',
  '1Esd':   '1 Esdras',
  '1Esdr':  '1 Esdras',
  // '2Esd' / '2Esdr' handled specially — split into Ezra + Nehemiah
  'Esth':   'Esther',
  'EsthGr': 'Esther (Greek)',
  'Jdt':    'Judith',
  'TobBA':  'Tobit',
  'Tob':    'Tobit',
  '1Macc':  '1 Maccabees',
  '2Macc':  '2 Maccabees',
  '3Macc':  '3 Maccabees',
  '4Macc':  '4 Maccabees',
  'Ps':     'Psalms',
  'PssSol': 'Psalms of Solomon',
  'PsSol':  'Psalms of Solomon',
  'Odes':   'Odes',
  'Prov':   'Proverbs',
  'Eccl':   'Ecclesiastes',
  'Song':   'Song of Songs',
  'Job':    'Job',
  'Wis':    'Wisdom of Solomon',
  'Sir':    'Sirach',
  'Hos':    'Hosea',
  'Amos':   'Amos',
  'Mic':    'Micah',
  'Joel':   'Joel',
  'Obad':   'Obadiah',
  'Jon':    'Jonah',
  'Jonah':  'Jonah',
  'Nah':    'Nahum',
  'Hab':    'Habakkuk',
  'Zeph':   'Zephaniah',
  'Hag':    'Haggai',
  'Zech':   'Zechariah',
  'Mal':    'Malachi',
  'Isa':    'Isaiah',
  'Jer':    'Jeremiah',
  'Bar':    'Baruch',
  'Lam':    'Lamentations',
  'EpJer':  'Letter of Jeremiah',
  'Ezek':   'Ezekiel',
  'SusTh':  'Susanna',
  'Sus':    'Susanna',
  'DanTh':  'Daniel',
  'Dan':    'Daniel',
  'BelTh':  'Bel and the Dragon',
  'Bel':    'Bel and the Dragon',
}

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

async function fetchText(url, label) {
  console.log(`⬇  Downloading ${label} (${url.split('/').pop()})…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const text = await res.text()
  console.log(`   ✓ ${label}: ${(text.length / 1024 / 1024).toFixed(1)} MB`)
  return text
}

async function main() {
  console.log('\n📖 LXX Rahlfs-1935 → public/lxx.json\n')

  // ── 1. Fetch data ──────────────────────────────────────────────────────
  const [verseCsv, wordCsv] = await Promise.all([
    fetchText(VERSE_URL, 'Versification'),
    fetchText(WORD_URL,  'Word list'),
  ])

  // ── 2. Parse word list: globalIndex \t localIndex \t word ──────────────
  console.log('\n📝 Parsing word list…')
  // Peek first 3 lines to detect format
  const sampleLines = wordCsv.split('\n').slice(0, 5)
  console.log('   Sample lines:', sampleLines.slice(0, 3).map(l => JSON.stringify(l)))

  const words = []
  let wordCount = 0
  let minIdx = Infinity, maxIdx = -1

  for (const line of wordCsv.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split('\t')
    if (parts.length < 3) continue
    const globalIdx = parseInt(parts[0], 10)
    if (isNaN(globalIdx)) continue // skip header if any
    const word = parts[2].trim()
    words[globalIdx] = word
    wordCount++
    if (globalIdx < minIdx) minIdx = globalIdx
    if (globalIdx > maxIdx) maxIdx = globalIdx
  }
  console.log(`   Parsed ${wordCount} words (index range: ${minIdx}–${maxIdx})`)

  // ── 3. Parse versification: Book.Ch.V \t wordStartIndex ───────────────
  console.log('\n📖 Parsing versification…')
  const sampleVerse = verseCsv.split('\n').slice(0, 5)
  console.log('   Sample lines:', sampleVerse.slice(0, 3).map(l => JSON.stringify(l)))

  const verses = []
  let verseCount = 0
  const unknownBooks = new Set()
  const skippedBooks = new Set()

  for (const line of verseCsv.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split('\t')
    if (parts.length < 2) continue
    const ref = parts[0].trim()
    const wordStart = parseInt(parts[1], 10)
    if (isNaN(wordStart)) continue // skip header

    // Parse Book.Chapter.Verse
    const dotParts = ref.split('.')
    if (dotParts.length < 3) continue
    const book = dotParts[0]
    const ch   = parseInt(dotParts[1], 10)
    const v    = parseInt(dotParts[2], 10)
    if (isNaN(ch) || isNaN(v)) continue

    if (SKIP_BOOKS.has(book)) { skippedBooks.add(book); continue }

    verses.push({ book, ch, v, wordStart })
    verseCount++
  }

  // Sort by wordStart to ensure correct word-slice boundaries
  verses.sort((a, b) => a.wordStart - b.wordStart)
  console.log(`   Parsed ${verseCount} verses`)
  if (skippedBooks.size) console.log(`   Skipped manuscripts: ${[...skippedBooks].join(', ')}`)

  // ── 4. Reconstruct verse texts ─────────────────────────────────────────
  console.log('\n🔨 Reconstructing verse texts…')
  const result = {}

  for (let i = 0; i < verses.length; i++) {
    const { book, ch, v, wordStart } = verses[i]
    const nextStart = i + 1 < verses.length ? verses[i + 1].wordStart : maxIdx + 1

    // Collect words for this verse
    const verseWords = []
    for (let w = wordStart; w < nextStart; w++) {
      if (words[w]) verseWords.push(words[w])
    }
    const text = verseWords.join(' ').trim()
    if (!text) continue

    // ── Handle 2Esd/2Esdr split: ch 1-10 = Ezra, ch 11-23 = Nehemiah ────
    if (book === '2Esd' || book === '2Esdr') {
      let canonBook, canonCh
      if (ch <= 10) { canonBook = 'Ezra';     canonCh = ch }
      else          { canonBook = 'Nehemiah'; canonCh = ch - 10 }
      const s = slug(canonBook)
      if (!result[s]) result[s] = {}
      if (!result[s][canonCh]) result[s][canonCh] = []
      result[s][canonCh].push({ v, t: text })
      continue
    }

    // ── Map to canonical name ─────────────────────────────────────────────
    const canonName = BOOK_MAP[book]
    if (!canonName) {
      unknownBooks.add(book)
      continue
    }

    const s = slug(canonName)
    if (!result[s]) result[s] = {}
    if (!result[s][ch]) result[s][ch] = []
    result[s][ch].push({ v, t: text })
  }

  if (unknownBooks.size) {
    console.log(`\n⚠️  Unmapped book abbreviations: ${[...unknownBooks].sort().join(', ')}`)
    console.log('   Add these to BOOK_MAP in the script if needed.')
  }

  // ── 5. Write output ────────────────────────────────────────────────────
  const outPath = join(ROOT, 'public', 'lxx.json')
  const json = JSON.stringify(result)
  writeFileSync(outPath, json, 'utf-8')

  const mb = (json.length / 1024 / 1024).toFixed(2)
  console.log(`\n✅ Saved public/lxx.json  (${mb} MB uncompressed)`)
  console.log(`   Books: ${Object.keys(result).length}`)
  console.log('')

  // Print per-book summary
  for (const [s, chapters] of Object.entries(result)) {
    const chCount  = Object.keys(chapters).length
    const vCount   = Object.values(chapters).reduce((n, arr) => n + arr.length, 0)
    console.log(`   ${s.padEnd(22)}  ${String(chCount).padStart(3)} ch  ${String(vCount).padStart(5)} v`)
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
