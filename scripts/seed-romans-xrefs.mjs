/**
 * seed-romans-xrefs.mjs
 *
 * Upserts OT quotation cross-references for Romans.
 * Rows already present in author_cross_refs are silently skipped.
 *
 * Usage: node scripts/seed-romans-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Hab': 'Habakkuk',
  'Jer': 'Jeremiah',
  'Pro': 'Proverbs',
  'Psa': 'Psalms',
  'Deu': 'Deuteronomy',
  'Job': 'Job',
  'Isa': 'Isaiah',
  'Eze': 'Ezekiel',
  'Gen': 'Genesis',
  'Exo': 'Exodus',
  'Mal': 'Malachi',
  'Hos': 'Hosea',
  'Lev': 'Leviticus',
  'Joe': 'Joel',
  'Nah': 'Nahum',
  '1Ki': '1 Kings',
  'Amo': 'Amos',
}

const RAW = `\
Rom 1:17	Hab 2:4
Rom 1:22	Jer 10:14
Rom 2:6	Pro 24:12
Rom 2:6	Psa 62:12
Rom 2:11	Deu 10:17
Rom 2:11	Job 34:19
Rom 2:24	Isa 52:5
Rom 2:24	Eze 36:20
Rom 3:4	Psa 116:11
Rom 3:4	Psa 51:4
Rom 3:8	Jer 17:6
Rom 3:10	Psa 14:1
Rom 3:13	Psa 5:9
Rom 3:13	Psa 140:3
Rom 3:14	Psa 10:7
Rom 3:15	Isa 59:7
Rom 3:18	Psa 36:1
Rom 4:3	Gen 15:6
Rom 4:7	Psa 32:1
Rom 4:11	Gen 17:10
Rom 4:17	Gen 17:5
Rom 4:18	Gen 15:5
Rom 7:7	Exo 20:17
Rom 7:7	Deu 5:21
Rom 8:36	Psa 44:22
Rom 9:7	Gen 21:12
Rom 9:9	Gen 18:10
Rom 9:12	Gen 25:23
Rom 9:13	Mal 1:2
Rom 9:15	Exo 33:19
Rom 9:17	Exo 9:16
Rom 9:20	Isa 45:9
Rom 9:21	Jer 18:6
Rom 9:25	Hos 2:23
Rom 9:26	Hos 1:10
Rom 9:27	Isa 10:22
Rom 9:29	Isa 1:9
Rom 9:33	Isa 8:14
Rom 9:33	Isa 28:16
Rom 10:5	Lev 18:5
Rom 10:5	Eze 20:11
Rom 10:6	Deu 30:12
Rom 10:8	Deu 30:14
Rom 10:11	Isa 28:16
Rom 10:13	Joe 2:32
Rom 10:15	Isa 52:7
Rom 10:15	Nah 1:15
Rom 10:16	Isa 53:1
Rom 10:18	Psa 19:4
Rom 10:19	Deu 32:21
Rom 10:20	Isa 65:1
Rom 11:1	Psa 94:14
Rom 11:3	1Ki 19:10
Rom 11:4	1Ki 19:18
Rom 11:8	Isa 29:10
Rom 11:8	Isa 6:9
Rom 11:9	Psa 69:22
Rom 11:26	Isa 59:20
Rom 11:34	Isa 40:13
Rom 11:35	Job 41:11
Rom 12:9	Amo 5:15
Rom 12:16	Isa 5:21
Rom 12:16	Pro 3:7
Rom 12:19	Deu 32:35
Rom 12:20	Pro 25:21
Rom 13:9	Exo 20:13
Rom 13:9	Deu 5:16
Rom 13:9	Lev 19:18
Rom 14:11	Isa 45:23
Rom 15:3	Psa 69:9
Rom 15:9	Psa 18:49
Rom 15:10	Deu 32:43
Rom 15:11	Psa 117:1
Rom 15:12	Isa 11:1
Rom 15:21	Isa 52:15`

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token) {
  const m = token.match(/Rom\s+(\d+):(\d+)/)
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
      src_book: 'Romans', src_chapter: src.chapter, src_verse: src.verse,
      tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
      label: null, updated_at: new Date().toISOString(),
    })
  } catch (e) { console.warn(`Parse error on "${trimmed}": ${e.message}`); parseErrors++ }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) { console.error('Usage: node scripts/seed-romans-xrefs.mjs <service-role-key>'); process.exit(1) }

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
      console.log(`  ✓ Rom ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
