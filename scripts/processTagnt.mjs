/**
 * Downloads and processes the two TAGNT (Translators Amalgamated Greek NT)
 * files from STEPBible (CC BY 4.0) and outputs a compact JSON for the app.
 *
 * Run once:  node scripts/processTagnt.mjs
 * Output:    public/tagnt.json  (~4-6 MB gzipped)
 */

import { writeFileSync } from 'fs'

const FILES = [
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
]

/* TAGNT 3-letter codes → full English book names (matching KJV json slugs) */
const BOOK_MAP = {
  Mat:'Matthew',  Mrk:'Mark',     Luk:'Luke',     Jhn:'John',
  Act:'Acts',     Rom:'Romans',   '1Co':'1 Corinthians', '2Co':'2 Corinthians',
  Gal:'Galatians', Eph:'Ephesians', Php:'Philippians', Col:'Colossians',
  '1Th':'1 Thessalonians', '2Th':'2 Thessalonians',
  '1Ti':'1 Timothy', '2Ti':'2 Timothy', Tit:'Titus', Phm:'Philemon',
  Heb:'Hebrews',  Jas:'James',
  '1Pe':'1 Peter', '2Pe':'2 Peter',
  '1Jn':'1 John', '2Jn':'2 John', '3Jn':'3 John',
  Jud:'Jude',     Rev:'Revelation',
}

const result = {}
let totalWords = 0

for (const url of FILES) {
  const fileName = decodeURIComponent(url.split('/').pop()).replace(' - STEPBible.org CC-BY.txt', '')
  console.log(`\nDownloading ${fileName}…`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const text = await res.text()

  const lines = text.replace(/^﻿/, '').split('\n')
  let wordCount = 0

  for (const line of lines) {
    // Skip blank lines, comment/preview lines, column header lines
    if (!line.trim()) continue
    if (line.trimStart().startsWith('#')) continue
    if (line.trimStart().startsWith('Word & Type')) continue
    if (!line.includes('\t')) continue

    const cols = line.split('\t')
    if (cols.length < 5) continue

    // Column 0: "Mat.1.1#01=NKO"
    const ref = cols[0].trim()
    const eqIdx = ref.indexOf('=')
    if (eqIdx === -1) continue

    const refPart = ref.substring(0, eqIdx)   // "Mat.1.1#01"
    const msType  = ref.substring(eqIdx + 1)  // "NKO"

    const hashIdx = refPart.indexOf('#')
    if (hashIdx === -1) continue

    const bcv   = refPart.substring(0, hashIdx).split('.')  // ["Mat","1","1"]
    if (bcv.length < 3) continue

    const bookName = BOOK_MAP[bcv[0]]
    if (!bookName) continue
    const chapter = bcv[1]
    const verse   = bcv[2]

    // Column 1: "Βίβλος (Biblos)" → Greek word + transliteration
    const greekCol   = (cols[1] || '').trim()
    const parenMatch = greekCol.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    const greekWord  = parenMatch ? parenMatch[1].trim() : greekCol
    const translit   = parenMatch ? parenMatch[2].trim() : ''
    if (!greekWord) continue

    // Column 3: "G0976=N-NSF" → Strong's + grammar
    const strongCol = (cols[3] || '').trim()
    const eq2       = strongCol.indexOf('=')
    const strongs   = eq2 >= 0 ? strongCol.substring(0, eq2).trim() : strongCol
    const grammar   = eq2 >= 0 ? strongCol.substring(eq2 + 1).trim() : ''

    // Column 4: "βίβλος=book" → dictionary gloss (after '=')
    const dictCol = (cols[4] || '').trim()
    const eq3     = dictCol.indexOf('=')
    const gloss   = eq3 >= 0 ? dictCol.substring(eq3 + 1).trim() : dictCol

    // Build nested output: Book → chapter → verse → [words]
    if (!result[bookName])            result[bookName] = {}
    if (!result[bookName][chapter])   result[bookName][chapter] = {}
    if (!result[bookName][chapter][verse]) result[bookName][chapter][verse] = []

    result[bookName][chapter][verse].push({
      w: greekWord,
      t: translit,
      g: gloss,
      s: strongs,
      r: grammar,
      ms: msType,
    })
    wordCount++
  }

  totalWords += wordCount
  console.log(`  ✓ ${wordCount.toLocaleString()} words`)
}

const json = JSON.stringify(result)
writeFileSync('public/tagnt.json', json)

const kb = (json.length / 1024).toFixed(0)
const mb = (json.length / 1024 / 1024).toFixed(2)

console.log(`\n✅ Saved public/tagnt.json`)
console.log(`   ${totalWords.toLocaleString()} total words across NT`)
console.log(`   ${mb} MB (${kb} KB) uncompressed — expect ~3-4 MB gzipped`)
console.log(`\nData licensed CC BY 4.0 — STEPBible.org / Tyndale House Cambridge`)
