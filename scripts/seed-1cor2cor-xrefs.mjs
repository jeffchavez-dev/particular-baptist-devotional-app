/**
 * seed-1cor2cor-xrefs.mjs
 *
 * Upserts OT quotation cross-references for 1 & 2 Corinthians.
 * Rows already present in author_cross_refs are silently skipped.
 *
 * Usage: node scripts/seed-1cor2cor-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Isa': 'Isaiah',
  'Jer': 'Jeremiah',
  'Psa': 'Psalms',
  'Job': 'Job',
  'Deu': 'Deuteronomy',
  'Gen': 'Genesis',
  'Exo': 'Exodus',
  'Num': 'Numbers',
  'Hos': 'Hosea',
  'Lev': 'Leviticus',
  'Pro': 'Proverbs',
  '2Sa': '2 Samuel',
}

const ALL_BOOKS = [
  { src_book: '1 Corinthians', prefix: '1Co', rows: `\
1Co 1:20	Isa 44:25
1Co 1:20	Isa 33:18
1Co 1:31	Jer 9:24
1Co 2:9	Isa 64:4
1Co 2:16	Isa 40:13
1Co 3:8	Psa 62:12
1Co 3:19	Job 5:13
1Co 3:20	Psa 94:11
1Co 5:13	Deu 17:9
1Co 5:13	Deu 19:19
1Co 5:13	Deu 24:7
1Co 6:16	Gen 2:24
1Co 9:9	Deu 25:4
1Co 10:1	Exo 13:21
1Co 10:1	Exo 14:22
1Co 10:1	Num 9:18
1Co 10:3	Exo 16:15
1Co 10:3	Exo 17:6
1Co 10:3	Num 11:4
1Co 10:3	Num 20:11
1Co 10:3	Num 26:64
1Co 10:7	Exo 32:6
1Co 10:8	Num 25:1
1Co 10:8	Num 21:4
1Co 10:8	Num 14:2
1Co 10:8	Psa 106:14
1Co 10:20	Deu 32:17
1Co 10:26	Psa 24:1
1Co 14:21	Isa 28:11
1Co 14:34	Gen 3:16
1Co 15:3	Isa 53:8
1Co 15:3	Psa 22:1
1Co 15:3	Psa 40:1
1Co 15:4	Psa 16:10
1Co 15:25	Psa 110:1
1Co 15:27	Psa 8:6
1Co 15:32	Isa 22:13
1Co 15:45	Gen 2:7
1Co 15:54	Isa 25:8
1Co 15:55	Hos 13:14` },

  { src_book: '2 Corinthians', prefix: '2Co', rows: `\
2Co 3:13	Exo 34:33
2Co 4:13	Psa 116:10
2Co 5:17	Isa 43:18
2Co 6:2	Isa 49:8
2Co 6:16	Lev 26:11
2Co 6:17	Isa 52:11
2Co 6:17	Jer 31:9
2Co 6:17	2Sa 7:14
2Co 8:15	Exo 16:18
2Co 9:7	Pro 22:8
2Co 9:9	Psa 112:9
2Co 10:17	Jer 9:24
2Co 13:1	Deu 19:15` },
]

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token, prefix) {
  const m = token.match(new RegExp(`${prefix}\\s+(\\d+):(\\d+)`))
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

for (const { src_book, prefix, rows: raw } of ALL_BOOKS) {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [srcToken, tgtToken] = trimmed.split('\t')
    if (!srcToken || !tgtToken) { console.warn(`Malformed line: "${trimmed}"`); parseErrors++; continue }
    try {
      const src = parseSrc(srcToken.trim(), prefix)
      const tgt = parseTgt(tgtToken.trim())
      rows.push({
        src_book, src_chapter: src.chapter, src_verse: src.verse,
        tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
        label: null, updated_at: new Date().toISOString(),
      })
    } catch (e) { console.warn(`Parse error on "${trimmed}": ${e.message}`); parseErrors++ }
  }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) { console.error('Usage: node scripts/seed-1cor2cor-xrefs.mjs <service-role-key>'); process.exit(1) }

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
      console.log(`  ✓ ${r.src_book} ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
