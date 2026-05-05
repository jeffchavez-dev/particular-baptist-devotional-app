/**
 * seed-gal-thru-heb-xrefs.mjs
 *
 * Upserts OT quotation cross-references for:
 *   Galatians, Ephesians, Philippians, Colossians,
 *   1 & 2 Thessalonians, 1 & 2 Timothy, Hebrews
 *
 * Rows already present are silently skipped (ignoreDuplicates: true).
 *
 * Usage: node scripts/seed-gal-thru-heb-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Deu': 'Deuteronomy',
  'Psa': 'Psalms',
  'Gen': 'Genesis',
  'Hab': 'Habakkuk',
  'Lev': 'Leviticus',
  'Exo': 'Exodus',
  'Isa': 'Isaiah',
  'Zec': 'Zechariah',
  'Job': 'Job',
  'Pro': 'Proverbs',
  'Dan': 'Daniel',
  'Num': 'Numbers',
  'Hos': 'Hosea',
  'Ecc': 'Ecclesiastes',
  '2Sa': '2 Samuel',
  '1Sa': '1 Samuel',
  '1Ki': '1 Kings',
  '2Ki': '2 Kings',
  'Jos': 'Joshua',
  'Jdg': 'Judges',
  '1Ch': '1 Chronicles',
  'Hag': 'Haggai',
  'Mic': 'Micah',
  'Jer': 'Jeremiah',
  'Neh': 'Nehemiah',
}

// Each entry: { src_book, prefix, raw }
// Note: Phl 4:5 "Psa 119:1-176;141:1-10" is pre-expanded into two lines.
const ALL_BOOKS = [

  { src_book: 'Galatians', prefix: 'Gal', raw: `\
Gal 2:6	Deu 10:17
Gal 2:16	Psa 143:2
Gal 3:6	Gen 15:6
Gal 3:8	Gen 12:3
Gal 3:8	Gen 22:18
Gal 3:10	Deu 27:26
Gal 3:11	Hab 2:4
Gal 3:12	Lev 18:5
Gal 3:13	Deu 21:23
Gal 3:16	Gen 22:18
Gal 3:17	Exo 12:40
Gal 4:22	Gen 21:2
Gal 4:22	Gen 16:15
Gal 4:27	Isa 54:1
Gal 4:30	Gen 21:10
Gal 5:14	Lev 19:18` },

  { src_book: 'Ephesians', prefix: 'Eph', raw: `\
Eph 2:17	Isa 57:19
Eph 4:8	Psa 68:18
Eph 4:25	Zec 8:16
Eph 4:26	Psa 4:4
Eph 5:31	Gen 2:24
Eph 6:2	Exo 20:12
Eph 6:2	Deu 5:16
Eph 6:9	Deu 10:17
Eph 6:9	Job 34:19
Eph 6:17	Isa 59:17` },

  { src_book: 'Philippians', prefix: 'Phl', raw: `\
Phl 2:10	Isa 45:23
Phl 4:5	Psa 119:1
Phl 4:5	Psa 141:1
Phl 4:5	Psa 145:18` },

  { src_book: 'Colossians', prefix: 'Col', raw: `\
Col 2:11	Deu 10:16
Col 3:25	Deu 10:17
Col 3:25	Job 34:19` },

  { src_book: '1 Thessalonians', prefix: '1Th', raw: `\
1Th 5:8	Isa 59:17
1Th 5:15	Pro 17:13` },

  { src_book: '2 Thessalonians', prefix: '2Th', raw: `\
2Th 2:4	Dan 11:36
2Th 2:8	Isa 11:4` },

  { src_book: '1 Timothy', prefix: '1Ti', raw: `\
1Ti 2:13	Gen 1:17
1Ti 2:13	Gen 2:7
1Ti 2:14	Gen 3:6
1Ti 2:14	Gen 3:12
1Ti 5:18	Deu 25:4
1Ti 6:7	Job 1:21
1Ti 6:7	Ecc 5:14
1Ti 6:7	Psa 49:18` },

  { src_book: '2 Timothy', prefix: '2Ti', raw: `\
2Ti 2:19	Num 16:5
2Ti 3:8	Exo 7:11` },

  { src_book: 'Hebrews', prefix: 'Heb', raw: `\
Heb 1:5	Psa 2:7
Heb 1:5	2Sa 7:14
Heb 1:6	Psa 97:7
Heb 1:7	Psa 104:4
Heb 1:8	Psa 45:6
Heb 1:10	Psa 102:25
Heb 1:13	Psa 110:1
Heb 2:6	Psa 8:4
Heb 2:12	Psa 22:22
Heb 2:13	Isa 8:18
Heb 2:13	Psa 18:2
Heb 2:13	2Sa 22:2
Heb 3:2	Num 12:7
Heb 3:7	Psa 95:7
Heb 3:15	Psa 95:7
Heb 3:17	Num 14:35
Heb 4:3	Psa 95:11
Heb 4:4	Gen 2:2
Heb 4:7	Psa 95:7
Heb 5:4	1Ch 23:13
Heb 5:5	Psa 2:7
Heb 5:6	Psa 110:4
Heb 6:14	Gen 22:16
Heb 7:1	Gen 14:18
Heb 7:17	Psa 110:4
Heb 8:5	Exo 25:40
Heb 8:8	Jer 31:31
Heb 9:2	Exo 25:1
Heb 9:2	Exo 26:36
Heb 9:2	Exo 40:3
Heb 9:2	Num 17:10
Heb 9:7	Exo 30:10
Heb 9:13	Lev 16:14
Heb 9:14	Num 14:36
Heb 9:20	Exo 24:8
Heb 10:5	Psa 40:6
Heb 10:11	Exo 29:38
Heb 10:12	Psa 110:1
Heb 10:16	Jer 31:33
Heb 10:27	Isa 64:1
Heb 10:28	Deu 17:6
Heb 10:30	Deu 32:35
Heb 10:37	Hab 2:3
Heb 11:3	Gen 1:1
Heb 11:4	Gen 4:4
Heb 11:5	Gen 5:24
Heb 11:7	Gen 6:8
Heb 11:8	Gen 12:1
Heb 11:9	Gen 12:5
Heb 11:9	Gen 27:11
Heb 11:11	Gen 18:1
Heb 11:12	Gen 22:17
Heb 11:13	Gen 47:9
Heb 11:13	Psa 39:13
Heb 11:13	Gen 23:4
Heb 11:14	Hos 14:2
Heb 11:17	Gen 22:1
Heb 11:18	Gen 22:12
Heb 11:20	Gen 27:28
Heb 11:21	Gen 47:31
Heb 11:21	Gen 48:15
Heb 11:22	Gen 50:24
Heb 11:23	Exo 2:2
Heb 11:25	Exo 2:11
Heb 11:27	Exo 2:15
Heb 11:28	Exo 12:11
Heb 11:29	Exo 14:22
Heb 11:30	Jos 6:20
Heb 11:31	Jos 2:1
Heb 11:31	Jos 6:17
Heb 11:32	Jdg 6:4
Heb 11:32	1Sa 7:1
Heb 11:32	2Sa 2:1
Heb 11:33	2Sa 8:1
Heb 11:33	Jdg 14:1
Heb 11:33	Dan 6:1
Heb 11:34	Dan 3:1
Heb 11:35	2Ki 4:20
Heb 11:35	1Ki 17:1
Heb 11:35	1Ki 19:1
Heb 12:5	Pro 3:11
Heb 12:9	Num 27:16
Heb 12:12	Isa 35:3
Heb 12:12	Pro 4:26
Heb 12:15	Deu 29:18
Heb 12:16	Gen 25:31
Heb 12:18	Exo 19:16
Heb 12:20	Exo 19:12
Heb 12:21	Deu 9:19
Heb 12:26	Hag 2:6
Heb 12:29	Deu 4:24
Heb 13:2	Gen 18:2
Heb 13:5	Deu 31:8
Heb 13:5	Jos 1:5
Heb 13:6	Psa 118:6
Heb 13:11	Lev 4:12
Heb 13:11	Lev 16:27
Heb 13:11	Num 19:3
Heb 13:14	Mic 2:10` },

]

// ── Parsers ──────────────────────────────────────────────────────────────────

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token, prefix) {
  // Escape special regex chars in prefix (e.g. "1Th", "2Ti")
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = token.match(new RegExp(`${escaped}\\s+(\\d+):(\\d+)`))
  if (!m) throw new Error(`Cannot parse source: "${token}" (prefix: ${prefix})`)
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

// ── Build rows ───────────────────────────────────────────────────────────────

const rows = []
let parseErrors = 0

for (const { src_book, prefix, raw } of ALL_BOOKS) {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [srcToken, tgtToken] = trimmed.split('\t')
    if (!srcToken || !tgtToken) {
      console.warn(`Malformed line: "${trimmed}"`)
      parseErrors++
      continue
    }
    try {
      const src = parseSrc(srcToken.trim(), prefix)
      const tgt = parseTgt(tgtToken.trim())
      rows.push({
        src_book, src_chapter: src.chapter, src_verse: src.verse,
        tgt_book: tgt.book, tgt_chapter: tgt.chapter, tgt_verse: tgt.verse,
        label: null, updated_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn(`Parse error on "${trimmed}": ${e.message}`)
      parseErrors++
    }
  }
}

console.log(`Parsed ${rows.length} rows (${parseErrors} errors).`)
if (parseErrors > 0) { process.exit(1) }

// ── Upsert ───────────────────────────────────────────────────────────────────

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node scripts/seed-gal-thru-heb-xrefs.mjs <service-role-key>')
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
      console.log(`  ✓ ${r.src_book} ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
