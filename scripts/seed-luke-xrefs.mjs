/**
 * seed-luke-xrefs.mjs
 *
 * Upserts OT quotation cross-references for the Gospel of Luke.
 * Rows already present in author_cross_refs are silently skipped.
 *
 * Usage: node scripts/seed-luke-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Lev': 'Leviticus',
  'Mal': 'Malachi',
  'Psa': 'Psalms',
  'Mic': 'Micah',
  'Dan': 'Daniel',
  'Gen': 'Genesis',
  'Num': 'Numbers',
  'Isa': 'Isaiah',
  'Exo': 'Exodus',
  'Deu': 'Deuteronomy',
  '1Ki': '1 Kings',
  '2Ki': '2 Kings',
  '1Sa': '1 Samuel',
  'Amo': 'Amos',
  'Jon': 'Jonah',
  '2Ch': '2 Chronicles',
  'Jer': 'Jeremiah',
  'Pro': 'Proverbs',
  'Hos': 'Hosea',
  'Zec': 'Zechariah',
}

const RAW = `\
Luk 1:10	Lev 16:17
Luk 1:17	Mal 4:5,6
Luk 1:32	Psa 132:11
Luk 1:33	Mic 4:7
Luk 1:33	Dan 4:3
Luk 1:55	Gen 22:18
Luk 1:55	Gen 17:19
Luk 1:73	Gen 22:16
Luk 1:73	Gen 12:3
Luk 1:78	Num 24:17
Luk 1:78	Mal 4:2
Luk 1:79	Isa 9:2
Luk 2:21,22	Lev 12:3,4
Luk 2:23	Exo 13:2
Luk 2:24	Lev 12:8
Luk 2:34	Isa 8:14,15
Luk 3:4,5,6	Isa 40:3,4,5
Luk 4:4	Deu 8:3
Luk 4:8	Deu 6:13
Luk 4:8	Deu 10:20
Luk 4:10,11	Psa 91:11,12
Luk 4:12	Deu 6:16
Luk 4:18,19	Isa 61:1,2
Luk 4:25,26	1Ki 17:1,9
Luk 4:25,26	1Ki 18:1,2
Luk 4:27	2Ki 5:14
Luk 5:14	Lev 14:2
Luk 6:3,4	1Sa 21:6
Luk 6:24	Amo 6:1
Luk 7:27	Mal 3:1
Luk 8:10	Isa 6:9
Luk 10:4	2Ki 4:29
Luk 10:27	Deu 6:5
Luk 10:27	Lev 19:18
Luk 10:28	Lev 18:5
Luk 11:30	Jon 1:17
Luk 11:30	Jon 3:1
Luk 11:30	Jon 4:1
Luk 11:31	2Ki 10:1
Luk 11:51	Gen 4:8
Luk 11:51	2Ch 24:21,22
Luk 13:27	Psa 6:8
Luk 13:35	Psa 118:26
Luk 13:35	Jer 12:7
Luk 13:35	Jer 22:5
Luk 14:8	Pro 25:6
Luk 14:26	Mic 7:6
Luk 17:3	Lev 19:17
Luk 17:27	Gen 7:7
Luk 17:29	Gen 19:16
Luk 17:32	Gen 19:26
Luk 18:20	Exo 20:12
Luk 18:20	Deu 5:17
Luk 19:46	Isa 56:7
Luk 19:46	Jer 7:11
Luk 20:9	Isa 5:1
Luk 20:17	Psa 118:22,23
Luk 20:18	Isa 8:14
Luk 20:18	Zec 12:3
Luk 20:18	Dan 2:44
Luk 20:28	Deu 25:5
Luk 20:37	Exo 3:6
Luk 20:42,43	Psa 110:1
Luk 22:37	Isa 53:12
Luk 23:29	Isa 54:1
Luk 23:30	Hos 10:8
Luk 23:46	Psa 31:5
Luk 24:46	Isa 53:5`

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token) {
  const m = token.match(/Luk\s+(\d+):(\d+)/)
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
  if (!srcToken || !tgtToken) { console.warn(`Malformed line: "${trimmed}"`); parseErrors++; continue }
  try {
    const src = parseSrc(srcToken.trim())
    const tgt = parseTgt(tgtToken.trim())
    rows.push({
      src_book: 'Luke', src_chapter: src.chapter, src_verse: src.verse,
      tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
      label: null, updated_at: new Date().toISOString(),
    })
  } catch (e) { console.warn(`Parse error on "${trimmed}": ${e.message}`); parseErrors++ }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) { console.error('Usage: node scripts/seed-luke-xrefs.mjs <service-role-key>'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let inserted = 0, skipped = 0
const CHUNK = 50

for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK)
  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(chunk, { onConflict: 'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse', ignoreDuplicates: true })
  if (error) { console.error(`Chunk ${i / CHUNK + 1} error: ${error.message}`); skipped += chunk.length }
  else {
    for (const r of chunk)
      console.log(`  ✓ Luk ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
