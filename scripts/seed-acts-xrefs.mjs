/**
 * seed-acts-xrefs.mjs
 *
 * Upserts OT quotation cross-references for the book of Acts.
 * Rows already present in author_cross_refs are silently skipped.
 *
 * Usage: node scripts/seed-acts-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Psa': 'Psalms',
  'Joe': 'Joel',
  '2Sa': '2 Samuel',
  'Deu': 'Deuteronomy',
  'Gen': 'Genesis',
  'Isa': 'Isaiah',
  'Neh': 'Nehemiah',
  'Exo': 'Exodus',
  'Amo': 'Amos',
  'Jos': 'Joshua',
  '1Ki': '1 Kings',
  '1Sa': '1 Samuel',
  '1Ch': '1 Chronicles',
  'Num': 'Numbers',
  'Jdg': 'Judges',
  'Hab': 'Habakkuk',
  'Job': 'Job',
}

const RAW = `\
Act 1:20	Psa 69:25
Act 1:20	Psa 109:8
Act 2:17-21	Joe 2:28-32
Act 2:25-28	Psa 16:8-10
Act 2:30	2Sa 7:12
Act 2:30	Psa 89:4
Act 2:31	Psa 16:10
Act 2:34	Psa 110:1
Act 3:22,23	Deu 18:15,18,19
Act 3:25	Gen 22:18
Act 3:25	Gen 12:3
Act 4:11	Psa 118:22,23
Act 4:11	Isa 28:16
Act 4:25,26	Psa 2:1,2
Act 7:2	Gen 15:7
Act 7:2	Neh 9:7
Act 7:3	Gen 12:1
Act 7:4	Gen 11:31
Act 7:4	Gen 12:4,5
Act 7:5	Gen 12:7
Act 7:5	Gen 13:15
Act 7:6,7	Gen 15:13,14
Act 7:8	Gen 17:10
Act 7:8	Gen 21:3,4
Act 7:8	Gen 25:26
Act 7:8	Gen 42:13
Act 7:9	Gen 37:4,11,28
Act 7:9	Gen 39:1,2,21
Act 7:10	Gen 41:37,40
Act 7:11	Gen 41:54
Act 7:12	Gen 42:2
Act 7:13	Gen 45:1,9
Act 7:14,15	Gen 45:1
Act 7:16	Jos 24:32
Act 7:17	Exo 1:7
Act 7:18	Exo 1:8
Act 7:19	Exo 1:10,22
Act 7:20	Exo 2:2
Act 7:21	Exo 2:3
Act 7:24	Exo 2:11
Act 7:26	Exo 2:13,14
Act 7:29	Exo 18:3
Act 7:30	Exo 3:2
Act 7:32	Exo 3:6
Act 7:33,34	Exo 3:5
Act 7:35	Exo 2:14
Act 7:35	Exo 3:15
Act 7:36	Exo 7:1
Act 7:36	Exo 14:21
Act 7:36	Exo 12:41
Act 7:36	Exo 15:23
Act 7:36	Exo 16:1
Act 7:37	Deu 18:15
Act 7:38	Exo 19:3
Act 7:38	Exo 20:1
Act 7:40	Exo 32:1
Act 7:41	Exo 32:19
Act 7:42,43	Amo 5:25,26
Act 7:44	Exo 25:40
Act 7:44	Exo 26:30
Act 7:45	Jos 3:14
Act 7:45	Jos 18:1
Act 7:46	2Sa 7:2
Act 7:46	Psa 132:5
Act 7:47	1Ki 8:1
Act 7:49,50	Isa 66:1,2
Act 8:32,33	Isa 53:7,8
Act 10:34	Deu 10:17
Act 10:34	Job 34:19
Act 13:17	Isa 1:2
Act 13:17	Exo 12:37
Act 13:18	Deu 1:31
Act 13:18	Num 14:33
Act 13:18	Psa 95:10
Act 13:19	Deu 7:1
Act 13:19	Jos 14:2
Act 13:20	Jdg 2:16
Act 13:20	1Sa 3:20
Act 13:21	1Sa 8:5
Act 13:21	1Sa 10:21
Act 13:22	1Sa 13:14
Act 13:22	Psa 89:20
Act 13:22	1Ch 10:14
Act 13:33	Psa 2:7
Act 13:34	Isa 55:3
Act 13:35	Psa 16:10
Act 13:36	1Ki 2:10
Act 13:41	Hab 1:5
Act 13:47	Isa 49:6
Act 13:47	Isa 11:10
Act 15:16,17	Amo 9:11,12
Act 17:31	Psa 9:8
Act 17:31	Psa 96:13
Act 17:31	Psa 98:9
Act 23:5	Exo 22:28
Act 28:26,27	Isa 6:9,10`

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token) {
  const m = token.match(/Act\s+(\d+):(\d+)/)
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
      src_book: 'Acts', src_chapter: src.chapter, src_verse: src.verse,
      tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
      label: null, updated_at: new Date().toISOString(),
    })
  } catch (e) { console.warn(`Parse error on "${trimmed}": ${e.message}`); parseErrors++ }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) { console.error('Usage: node scripts/seed-acts-xrefs.mjs <service-role-key>'); process.exit(1) }

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
      console.log(`  ✓ Act ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
