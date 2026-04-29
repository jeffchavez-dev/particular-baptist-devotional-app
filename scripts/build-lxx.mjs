/**
 * build-lxx.mjs
 *
 * Generates two files from the eliranwong/LXX-Rahlfs-1935 GitHub repo:
 *   public/lxx.json       — plain text (v, t) per verse  → main reader
 *   public/lxx-words.json — word+Strongs per verse        → parallel Strongs view
 *
 * Data sources:
 *   01_wordlist_unicode/text_accented.csv  : globalIndex \t localIndex \t word
 *   07_StrongNumber/final_Strongs.csv      : globalIndex \t G####
 *   08_versification/001_verse_c_modified_KEEP.csv : Book.Ch.V \t wordStartIndex
 *
 * Run: node scripts/build-lxx.mjs
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')

const BASE       = 'https://raw.githubusercontent.com/eliranwong/LXX-Rahlfs-1935/master'
const WORD_URL   = `${BASE}/01_wordlist_unicode/text_accented.csv`
const STRONGS_URL= `${BASE}/07_StrongNumber/final_Strongs.csv`
const VERSE_URL  = `${BASE}/08_versification/001_verse_c_modified_KEEP.csv`

// ── Duplicate manuscripts to skip ─────────────────────────────────────────
const SKIP_BOOKS = new Set(['JoshA','JudgA','TobS','DanOG','SusOG','BelOG','IsaA','JerA'])

// ── LXX abbreviation → canonical English name ──────────────────────────────
// '2Esd'/'2Esdr' handled specially (split into Ezra + Nehemiah)
const BOOK_MAP = {
  Gen:'Genesis', Exod:'Exodus', Lev:'Leviticus', Num:'Numbers', Deut:'Deuteronomy',
  JoshB:'Joshua', Josh:'Joshua', JudgB:'Judges', Judg:'Judges', Ruth:'Ruth',
  '1Sam':'1 Samuel', '2Sam':'2 Samuel', '1Kgs':'1 Kings', '2Kgs':'2 Kings',
  '1Chr':'1 Chronicles', '2Chr':'2 Chronicles',
  '1Esd':'1 Esdras', '1Esdr':'1 Esdras',
  Esth:'Esther', EsthGr:'Esther (Greek)',
  Jdt:'Judith', TobBA:'Tobit', Tob:'Tobit',
  '1Macc':'1 Maccabees', '2Macc':'2 Maccabees', '3Macc':'3 Maccabees', '4Macc':'4 Maccabees',
  Ps:'Psalms', PssSol:'Psalms of Solomon', PsSol:'Psalms of Solomon',
  Odes:'Odes', Prov:'Proverbs', Eccl:'Ecclesiastes', Song:'Song of Songs',
  Job:'Job', Wis:'Wisdom of Solomon', Sir:'Sirach',
  Hos:'Hosea', Amos:'Amos', Mic:'Micah', Joel:'Joel', Obad:'Obadiah',
  Jon:'Jonah', Jonah:'Jonah', Nah:'Nahum', Hab:'Habakkuk', Zeph:'Zephaniah',
  Hag:'Haggai', Zech:'Zechariah', Mal:'Malachi',
  Isa:'Isaiah', Jer:'Jeremiah', Bar:'Baruch', Lam:'Lamentations',
  EpJer:'Letter of Jeremiah', Ezek:'Ezekiel',
  SusTh:'Susanna', Sus:'Susanna', DanTh:'Daniel', Dan:'Daniel',
  BelTh:'Bel and the Dragon', Bel:'Bel and the Dragon',
}

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

async function fetchText(url, label) {
  console.log(`⬇  Downloading ${label} …`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const text = await res.text()
  console.log(`   ✓ ${label}: ${(text.length / 1024 / 1024).toFixed(1)} MB`)
  return text
}

async function main() {
  console.log('\n📖 LXX Rahlfs-1935 builder\n')

  // ── 1. Fetch all three CSVs in parallel ───────────────────────────────
  const [verseCsv, wordCsv, strongsCsv] = await Promise.all([
    fetchText(VERSE_URL,   'Versification'),
    fetchText(WORD_URL,    'Word list (accented)'),
    fetchText(STRONGS_URL, 'Strongs numbers'),
  ])

  // ── 2. Parse word list: globalIndex \t localIndex \t word ─────────────
  console.log('\n📝 Parsing word list…')
  const words = []
  let maxIdx = -1
  for (const line of wordCsv.split('\n')) {
    const t = line.trim(); if (!t) continue
    const p = t.split('\t'); if (p.length < 3) continue
    const i = parseInt(p[0], 10); if (isNaN(i)) continue
    words[i] = p[2].trim()
    if (i > maxIdx) maxIdx = i
  }
  console.log(`   ${Object.keys(words).length} words, max index ${maxIdx}`)

  // ── 3. Parse Strongs: globalIndex \t G#### ────────────────────────────
  console.log('📝 Parsing Strongs numbers…')
  const strongs = []   // strongs[globalIndex] = 'G####' | ''
  for (const line of strongsCsv.split('\n')) {
    const t = line.trim(); if (!t) continue
    const p = t.split('\t'); if (p.length < 2) continue
    const i = parseInt(p[0], 10); if (isNaN(i)) continue
    strongs[i] = p[1].trim()
  }
  console.log(`   ${strongs.filter(Boolean).length} Strongs entries`)

  // ── 4. Parse versification: Book.Ch.V \t wordStartIndex ──────────────
  console.log('📖 Parsing versification…')
  const verses = []
  const skippedBooks = new Set()
  for (const line of verseCsv.split('\n')) {
    const t = line.trim(); if (!t) continue
    const p = t.split('\t'); if (p.length < 2) continue
    const ref = p[0].trim()
    const ws  = parseInt(p[1], 10)
    if (isNaN(ws)) continue
    const dots = ref.split('.')
    if (dots.length < 3) continue
    const book = dots[0]
    const ch   = parseInt(dots[1], 10)
    const v    = parseInt(dots[2], 10)
    if (isNaN(ch) || isNaN(v)) continue
    if (SKIP_BOOKS.has(book)) { skippedBooks.add(book); continue }
    verses.push({ book, ch, v, wordStart: ws })
  }
  verses.sort((a, b) => a.wordStart - b.wordStart)
  console.log(`   ${verses.length} verses parsed`)
  if (skippedBooks.size) console.log(`   Skipped: ${[...skippedBooks].join(', ')}`)

  // ── 5. Build both outputs in one pass ──────────────────────────────────
  console.log('\n🔨 Building outputs…')
  const plain = {}   // { slug: { ch: [{v, t}] } }       → lxx.json
  const wordy = {}   // { slug: { ch: [{v, words:[{w,s}]}] } } → lxx-words.json
  const unknownBooks = new Set()

  function addEntry(bookSlug, ch, v, verseWords, verseStrongs) {
    // plain
    if (!plain[bookSlug]) plain[bookSlug] = {}
    if (!plain[bookSlug][ch]) plain[bookSlug][ch] = []
    plain[bookSlug][ch].push({ v, t: verseWords.join(' ').trim() })
    // wordy — only include words that have a non-empty text
    if (!wordy[bookSlug]) wordy[bookSlug] = {}
    if (!wordy[bookSlug][ch]) wordy[bookSlug][ch] = []
    const wordObjs = verseWords
      .map((w, idx) => ({ w, s: verseStrongs[idx] || '' }))
      .filter(o => o.w)
    wordy[bookSlug][ch].push({ verse: v, words: wordObjs })
  }

  for (let i = 0; i < verses.length; i++) {
    const { book, ch, v, wordStart } = verses[i]
    const nextStart = i + 1 < verses.length ? verses[i + 1].wordStart : maxIdx + 1

    const verseWords   = []
    const verseStrongs = []
    for (let w = wordStart; w < nextStart; w++) {
      if (words[w]) { verseWords.push(words[w]); verseStrongs.push(strongs[w] || '') }
    }
    if (!verseWords.length) continue

    // 2Esdr split → Ezra + Nehemiah
    if (book === '2Esd' || book === '2Esdr') {
      const [canonBook, canonCh] = ch <= 10
        ? ['Ezra', ch]
        : ['Nehemiah', ch - 10]
      addEntry(slug(canonBook), canonCh, v, verseWords, verseStrongs)
      continue
    }

    const canonName = BOOK_MAP[book]
    if (!canonName) { unknownBooks.add(book); continue }
    addEntry(slug(canonName), ch, v, verseWords, verseStrongs)
  }

  if (unknownBooks.size)
    console.log(`⚠️  Unmapped: ${[...unknownBooks].sort().join(', ')}`)

  // ── 6. Write outputs ───────────────────────────────────────────────────
  const plainJson = JSON.stringify(plain)
  const wordyJson = JSON.stringify(wordy)

  writeFileSync(join(ROOT, 'public', 'lxx.json'),       plainJson, 'utf-8')
  writeFileSync(join(ROOT, 'public', 'lxx-words.json'), wordyJson, 'utf-8')

  const books = Object.keys(plain)
  console.log(`\n✅ public/lxx.json       ${(plainJson.length/1024/1024).toFixed(2)} MB — ${books.length} books`)
  console.log(`✅ public/lxx-words.json  ${(wordyJson.length/1024/1024).toFixed(2)} MB — ${books.length} books\n`)

  for (const bs of books) {
    const chs  = Object.keys(plain[bs]).length
    const vs   = Object.values(plain[bs]).reduce((n,a) => n+a.length, 0)
    console.log(`   ${bs.padEnd(22)} ${String(chs).padStart(3)} ch  ${String(vs).padStart(5)} v`)
  }
}

main().catch(err => { console.error('\n❌', err.message, '\n', err.stack); process.exit(1) })
