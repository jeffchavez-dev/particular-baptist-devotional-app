/**
 * seed-john-xrefs.mjs
 *
 * Upserts OT quotation cross-references for the Gospel of John.
 * Rows already present in author_cross_refs are silently skipped.
 *
 * Usage: node scripts/seed-john-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Isa': 'Isaiah',
  'Gen': 'Genesis',
  'Psa': 'Psalms',
  'Num': 'Numbers',
  'Mic': 'Micah',
  'Exo': 'Exodus',
  'Lev': 'Leviticus',
  'Deu': 'Deuteronomy',
  'Zec': 'Zechariah',
  'Pro': 'Proverbs',
  '2Sa': '2 Samuel',
}

const RAW = `\
Jhn 1:23	Isa 40:3
Jhn 1:51	Gen 28:12
Jhn 2:17	Psa 69:9
Jhn 3:14	Num 21:8,9
Jhn 4:37	Mic 6:15
Jhn 6:31	Psa 78:24
Jhn 6:31	Exo 16:15
Jhn 6:45	Isa 54:13
Jhn 6:49	Exo 16:15
Jhn 7:22	Lev 12:3
Jhn 7:38	Isa 55:1
Jhn 7:38	Isa 58:11
Jhn 7:38	Isa 44:3
Jhn 7:38	Zec 13:1
Jhn 7:38	Zec 14:8
Jhn 7:38	Pro 18:4
Jhn 7:38	Isa 12:3
Jhn 7:39	Isa 44:3
Jhn 7:42	Psa 89:4
Jhn 7:42	Psa 132:11
Jhn 7:42	Mic 5:1,2
Jhn 8:5	Lev 20:10
Jhn 8:5	Deu 22:21
Jhn 8:17	Deu 19:15
Jhn 9:31	Psa 82:6
Jhn 10:34	Psa 82:6
Jhn 12:13	Psa 118:26
Jhn 12:14,15	Zec 9:9
Jhn 12:34	2Sa 7:13
Jhn 12:34	Psa 89:30,37
Jhn 12:34	Psa 110:4
Jhn 12:34	Isa 9:7
Jhn 12:38	Isa 53:1
Jhn 12:40	Isa 6:9
Jhn 12:49	Deu 18:18
Jhn 13:18	Psa 41:9
Jhn 15:25	Psa 69:4
Jhn 15:25	Psa 109:3
Jhn 15:25	Psa 35:19
Jhn 17:12	Psa 41:10
Jhn 17:12	Psa 109:8,17
Jhn 19:24	Psa 22:19
Jhn 19:28	Psa 69:21
Jhn 19:36	Exo 12:46
Jhn 19:36	Psa 34:20
Jhn 19:36	Num 9:12
Jhn 19:37	Zec 12:10
Jhn 20:9	Psa 16:10
Jhn 20:17	Psa 22:22`

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token) {
  const m = token.match(/Jhn\s+(\d+):(\d+)/)
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
      src_book: 'John', src_chapter: src.chapter, src_verse: src.verse,
      tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
      label: null, updated_at: new Date().toISOString(),
    })
  } catch (e) { console.warn(`Parse error on "${trimmed}": ${e.message}`); parseErrors++ }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) { console.error('Usage: node scripts/seed-john-xrefs.mjs <service-role-key>'); process.exit(1) }

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
      console.log(`  ✓ Jhn ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
