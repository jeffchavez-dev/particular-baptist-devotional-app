/**
 * Downloads and processes the four TAHOT (Translators Amalgamated Hebrew OT)
 * files from STEPBible (CC BY 4.0) and outputs a compact JSON for the app.
 *
 * Run once:  node scripts/processTaght.mjs
 * Output:    public/tahot.json
 */

import { writeFileSync } from 'fs'

const BASE = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/'
const FILES = [
  BASE + 'TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  BASE + 'TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  BASE + 'TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
  BASE + 'TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
]

/* TAHOT 3-letter codes → English book names (matching KJV json slugs) */
const BOOK_MAP = {
  Gen:'Genesis',    Exo:'Exodus',       Lev:'Leviticus',      Num:'Numbers',
  Deu:'Deuteronomy',Jos:'Joshua',       Jdg:'Judges',         Rut:'Ruth',
  '1Sa':'1 Samuel', '2Sa':'2 Samuel',   '1Ki':'1 Kings',      '2Ki':'2 Kings',
  '1Ch':'1 Chronicles','2Ch':'2 Chronicles',
  Ezr:'Ezra',        Neh:'Nehemiah',    Est:'Esther',
  Job:'Job',         Psa:'Psalms',      Pro:'Proverbs',
  Ecc:'Ecclesiastes',Sng:'Song of Solomon',
  Isa:'Isaiah',      Jer:'Jeremiah',    Lam:'Lamentations',
  Ezk:'Ezekiel',     Dan:'Daniel',
  Hos:'Hosea',       Joe:'Joel',        Amo:'Amos',
  Oba:'Obadiah',     Jon:'Jonah',       Mic:'Micah',
  Nah:'Nahum',       Hab:'Habakkuk',    Zep:'Zephaniah',
  Hag:'Haggai',      Zec:'Zechariah',   Mal:'Malachi',
}

const result = {}
let totalWords = 0

for (const url of FILES) {
  const fileName = decodeURIComponent(url.split('/').pop()).replace(' - STEPBible.org CC BY.txt', '')
  console.log(`\nDownloading ${fileName}…`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const text = await res.text()

  const lines = text.replace(/^﻿/, '').split('\n')
  let wordCount = 0

  for (const line of lines) {
    if (!line.trim() || !line.includes('\t')) continue

    const cols = line.split('\t')
    if (cols.length < 6) continue

    // Col 0: "Gen.1.1#01=L" or "Gen.1.1#01=L(Q)" etc.
    const col0 = cols[0].trim()
    // Data lines start with a book code (letter or digit)
    if (!col0.match(/^[A-Z1-9][A-Za-z0-9]/)) continue

    const eqIdx = col0.indexOf('=')
    if (eqIdx === -1) continue

    const refPart = col0.substring(0, eqIdx)
    const msRaw   = col0.substring(eqIdx + 1)

    // Primary manuscript type = first char before any parentheses
    const msType = msRaw.replace(/\([^)]*\)/g, '').charAt(0) || 'L'

    // Skip Ketiv (uncorrected scribal text) — translators use Qere/Leningrad
    if (msType === 'K') continue

    const hashIdx = refPart.indexOf('#')
    if (hashIdx === -1) continue

    const bcv = refPart.substring(0, hashIdx).split('.')
    if (bcv.length < 3) continue

    const bookName = BOOK_MAP[bcv[0]]
    if (!bookName) continue

    const chapter = bcv[1]
    const verse   = bcv[2]

    // Col 1: Hebrew word
    // Strip backslash + everything after (punctuation cantillation marks like ׃)
    // Strip forward slashes (prefix/suffix morpheme separators)
    const rawHeb  = (cols[1] || '').trim()
    const hebWord = rawHeb.split('\\')[0].replace(/\//g, '').trim()
    if (!hebWord) continue

    // Col 2: Transliteration — strip morpheme separator slashes
    const translit = (cols[2] || '').replace(/\//g, '').trim()

    // Col 3: English gloss — strip morpheme separators and angle/square bracket markers
    const gloss = (cols[3] || '')
      .replace(/[/<>\[\]]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')

    // Col 4: dStrong — extract root Strong's number from {curly braces}
    const dsCol     = (cols[4] || '')
    const rootMatch = dsCol.match(/\{([^}+\s]+)/)
    const strongs   = rootMatch ? rootMatch[1].trim() : ''

    // Col 5: ETCBC morphology code
    const morph = (cols[5] || '').trim()

    // Build nested output: Book → chapter → verse → [words]
    if (!result[bookName])                    result[bookName] = {}
    if (!result[bookName][chapter])           result[bookName][chapter] = {}
    if (!result[bookName][chapter][verse])    result[bookName][chapter][verse] = []

    result[bookName][chapter][verse].push({
      w:  hebWord,
      t:  translit,
      g:  gloss,
      s:  strongs,
      r:  morph,
      ms: msType,
    })
    wordCount++
  }

  totalWords += wordCount
  console.log(`  ✓ ${wordCount.toLocaleString()} words`)
}

const json = JSON.stringify(result)
writeFileSync('public/tahot.json', json)

const mb = (json.length / 1024 / 1024).toFixed(2)
const kb = (json.length / 1024).toFixed(0)
console.log(`\n✅ Saved public/tahot.json`)
console.log(`   ${totalWords.toLocaleString()} total words across OT`)
console.log(`   ${mb} MB (${kb} KB) uncompressed`)
console.log(`\nData licensed CC BY 4.0 — STEPBible.org / Tyndale House Cambridge`)
