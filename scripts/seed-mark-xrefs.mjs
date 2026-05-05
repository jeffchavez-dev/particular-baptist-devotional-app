/**
 * seed-mark-xrefs.mjs
 *
 * Upserts OT quotation cross-references for the Gospel of Mark.
 * Rows already present in author_cross_refs are silently skipped
 * (ignoreDuplicates: true on the unique constraint).
 *
 * Usage (service role key — bypasses RLS, no sign-in needed):
 *   node scripts/seed-mark-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Isa': 'Isaiah',
  'Mal': 'Malachi',
  'Lev': 'Leviticus',
  '1Sa': '1 Samuel',
  'Exo': 'Exodus',
  'Deu': 'Deuteronomy',
  'Pro': 'Proverbs',
  'Gen': 'Genesis',
  'Psa': 'Psalms',
  'Jer': 'Jeremiah',
  'Dan': 'Daniel',
  'Joe': 'Joel',
  'Zec': 'Zechariah',
  'Mic': 'Micah',
  'Num': 'Numbers',
}

const RAW = `\
Mar 1:2,3	Mal 3:1
Mar 1:2,3	Isa 40:3
Mar 1:44	Lev 14:2
Mar 2:25,26	1Sa 21:6
Mar 4:12	Isa 6:9
Mar 7:6,7	Isa 29:13
Mar 7:10	Exo 20:12
Mar 7:10	Deu 5:16
Mar 7:10	Exo 21:17
Mar 7:10	Pro 20:20
Mar 9:11	Mal 4:5
Mar 9:44	Isa 66:24
Mar 10:4	Deu 24:1
Mar 10:6	Gen 1:27
Mar 10:7	Gen 2:24
Mar 10:19	Exo 20:12,13,14
Mar 11:9	Psa 118:26
Mar 11:17	Isa 56:7
Mar 11:17	Jer 7:11
Mar 12:1	Isa 5:1
Mar 12:10,11	Psa 118:22,23
Mar 12:19	Deu 25:5
Mar 12:26	Exo 3:6
Mar 12:29,30	Deu 6:4,5
Mar 12:31	Lev 19:18
Mar 12:33	1Sa 15:22
Mar 12:36	Psa 110:1
Mar 13:5	Jer 29:8
Mar 13:12	Mic 7:6
Mar 13:14	Dan 9:27
Mar 13:14	Dan 8:13
Mar 13:14	Dan 11:31
Mar 13:14	Dan 12:11
Mar 13:24	Isa 13:9,10
Mar 13:24	Joe 3:15
Mar 13:31	Isa 40:8
Mar 14:27	Zec 13:7
Mar 15:28	Isa 53:12
Mar 15:34	Psa 22:1`

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token) {
  const m = token.match(/Mar\s+(\d+):(\d+)/)
  if (!m) throw new Error(`Cannot parse source: "${token}"`)
  return { chapter: parseInt(m[1], 10), verse: parseInt(m[2], 10) }
}

function parseTgt(token) {
  token = token.replace(/&c\.?/gi, '').trim()
  const m = token.match(/^([A-Z][a-z]{1,3}|[123][A-Z][a-z]{1,2})\s+(\d+):(.+)$/)
  if (!m) throw new Error(`Cannot parse target: "${token}"`)
  const book = BOOK_MAP[m[1]]
  if (!book) throw new Error(`Unknown abbreviation: "${m[1]}"`)
  return { book, chapter: parseInt(m[2], 10), verse: firstVerse(m[3]) }
}

const rows = []
let parseErrors = 0

for (const line of RAW.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed) continue
  const [srcToken, tgtToken] = trimmed.split('\t')
  if (!srcToken || !tgtToken) {
    console.warn(`Malformed line: "${trimmed}"`)
    parseErrors++
    continue
  }
  try {
    const src = parseSrc(srcToken.trim())
    const tgt = parseTgt(tgtToken.trim())
    rows.push({
      src_book:    'Mark',
      src_chapter: src.chapter,
      src_verse:   src.verse,
      tgt_book:    tgt.book,
      tgt_chapter: tgt.chapter,
      tgt_verse:   tgt.verse,
      label:       null,
      updated_at:  new Date().toISOString(),
    })
  } catch (e) {
    console.warn(`Parse error on "${trimmed}": ${e.message}`)
    parseErrors++
  }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node scripts/seed-mark-xrefs.mjs <service-role-key>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let inserted = 0, skipped = 0
const CHUNK = 50

for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK)
  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(chunk, {
      onConflict:       'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse',
      ignoreDuplicates: true,
    })
  if (error) {
    console.error(`Chunk ${i / CHUNK + 1} error: ${error.message}`)
    skipped += chunk.length
  } else {
    for (const r of chunk)
      console.log(`  ✓ Mar ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
