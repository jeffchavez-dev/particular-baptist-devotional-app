/**
 * Downloads and processes the Open Scriptures Strong's lexicon
 * (public domain — James Strong, 1890) and outputs compact JSON for the app.
 *
 * Run once:  node scripts/processStrongs.mjs
 * Output:    public/strongs-greek.json
 *            public/strongs-hebrew.json
 *
 * Source:    https://github.com/openscriptures/strongs
 * Each entry: { id, lemma, xlit, pron, strongs_def, kjv_def }
 * We keep:  { l, x, p, d }
 *   l = lemma (the base form)
 *   x = transliteration
 *   p = pronunciation guide
 *   d = definition (combined short + KJV usage)
 */

import { writeFileSync } from 'fs'

const SOURCES = {
  greek:  'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js',
  hebrew: 'https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js',
}

for (const [lang, url] of Object.entries(SOURCES)) {
  console.log(`\nDownloading ${lang} lexicon…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const text = await res.text()

  // The file is a JS assignment: var strongsGreek = { ... };
  // Extract the JSON object body
  const objStart = text.indexOf('{')
  const objEnd   = text.lastIndexOf('}')
  if (objStart === -1 || objEnd === -1) throw new Error('Could not find JSON object in ' + lang + ' source')

  const raw = JSON.parse(text.slice(objStart, objEnd + 1))

  // Build compact output: key = numeric string e.g. "1161"
  const out = {}
  let count = 0

  for (const [key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue

    // Numeric key (strip leading zeros) — matches strongsUrl() in the app
    const numKey = String(parseInt(key.replace(/\D/g, ''), 10))
    if (!numKey || numKey === 'NaN') continue

    // Build a readable short definition by combining the fields
    const parts = []
    if (entry.strongs_def) parts.push(entry.strongs_def.trim())

    // KJV usage note — shows how KJV translators rendered the word
    const kjv = (entry.kjv_def || '').trim().replace(/\.$/, '')
    if (kjv) parts.push(`KJV: ${kjv}`)

    out[numKey] = {
      l: (entry.lemma       || '').trim(),   // original script form
      x: (entry.xlit        || '').trim(),   // transliteration
      p: (entry.pron        || '').trim(),   // pronunciation
      d: parts.join(' — '),                  // definition
    }
    count++
  }

  const json = JSON.stringify(out)
  const outFile = `public/strongs-${lang}.json`
  writeFileSync(outFile, json)

  const mb = (json.length / 1024 / 1024).toFixed(2)
  console.log(`  ✓ ${count.toLocaleString()} entries → ${outFile} (${mb} MB uncompressed)`)
}

console.log('\nDone. Add "process:strongs" script to package.json if needed.')
