/**
 * seed-jas-thru-rev-xrefs.mjs
 *
 * Upserts OT quotation cross-references for:
 *   James, 1 Peter, 2 Peter, 1 John, Jude, Revelation
 *
 * Rows already present are silently skipped (ignoreDuplicates: true).
 *
 * Usage: node scripts/seed-jas-thru-rev-xrefs.mjs <service-role-key>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

const BOOK_MAP = {
  'Isa': 'Isaiah',
  'Job': 'Job',
  'Pro': 'Proverbs',
  'Lev': 'Leviticus',
  'Exo': 'Exodus',
  'Gen': 'Genesis',
  'Jos': 'Joshua',
  '1Ki': '1 Kings',
  'Psa': 'Psalms',
  'Deu': 'Deuteronomy',
  'Hos': 'Hosea',
  'Num': 'Numbers',
  'Eze': 'Ezekiel',
  'Dan': 'Daniel',
  'Zec': 'Zechariah',
  'Jer': 'Jeremiah',
  'Joe': 'Joel',
  'Hag': 'Haggai',
  'Lam': 'Lamentations',
  'Nah': 'Nahum',
  'Hab': 'Habakkuk',
  'Est': 'Esther',
  'Zep': 'Zephaniah',
  'Mic': 'Micah',
  '2Ch': '2 Chronicles',
  '2Ki': '2 Kings',
  'Amo': 'Amos',
}

// Each entry: { src_book, prefix, raw }
// Rev 21:2 "Eze 40:1-49;48:1-35&c" is pre-expanded into two lines.
const ALL_BOOKS = [

  { src_book: 'James', prefix: 'Jas', raw: `\
Jas 1:10	Isa 40:6
Jas 1:10	Job 14:2
Jas 1:19	Pro 17:27
Jas 2:1	Lev 19:15
Jas 2:1	Pro 24:23
Jas 2:8	Lev 19:18
Jas 2:11	Exo 20:13
Jas 2:21	Gen 22:9
Jas 2:23	Gen 15:6
Jas 2:25	Jos 2:1
Jas 2:25	Jos 6:17
Jas 4:6	Pro 3:34
Jas 5:3	Pro 16:27
Jas 5:11	Job 1:21
Jas 5:11	Job 42:1
Jas 5:17	1Ki 17:1
Jas 5:17	1Ki 18:41` },

  { src_book: '1 Peter', prefix: '1Pe', raw: `\
1Pe 1:16	Lev 11:44
1Pe 1:24	Isa 40:6
1Pe 2:3	Psa 34:8
1Pe 2:4	Psa 118:22
1Pe 2:6	Isa 28:16
1Pe 2:7	Psa 118:22
1Pe 2:9	Exo 19:6
1Pe 2:9	Deu 10:15
1Pe 2:9	Hos 1:10
1Pe 2:10	Hos 2:23
1Pe 2:17	Pro 24:21
1Pe 2:22	Isa 53:9
1Pe 2:24	Isa 53:4
1Pe 3:6	Gen 18:12
1Pe 3:7	Pro 17:13
1Pe 3:10	Psa 34:12
1Pe 3:14	Isa 8:12
1Pe 3:20	Gen 6:3
1Pe 4:8	Pro 10:12
1Pe 4:18	Pro 11:31
1Pe 5:5	Pro 3:34
1Pe 5:7	Psa 55:23` },

  { src_book: '2 Peter', prefix: '2Pe', raw: `\
2Pe 2:5	Gen 7:23
2Pe 2:5	Gen 8:1
2Pe 2:6	Gen 19:1
2Pe 2:15	Num 22:1
2Pe 2:22	Pro 26:11
2Pe 3:4	Eze 12:22
2Pe 3:5	Gen 1:1
2Pe 3:5	Gen 7:21
2Pe 3:8	Psa 90:4
2Pe 3:10	Psa 102:26
2Pe 3:13	Isa 65:17
2Pe 3:13	Isa 66:22` },

  { src_book: '1 John', prefix: '1Jo', raw: `\
1Jo 1:8	Pro 20:9
1Jo 3:5	Isa 53:4
1Jo 3:12	Gen 4:8
1Jo 3:12	Num 22:41
1Jo 3:12	Num 16:1` },

  { src_book: 'Jude', prefix: 'Jde', raw: `\
Jde 1:5	Exo 12:41
Jde 1:5	Num 14:32
Jde 1:7	Gen 19:1
Jde 1:9	Deu 34:5
Jde 1:11	Gen 4:8
Jde 1:11	Num 22:1
Jde 1:11	Num 16:1
Jde 1:14	Gen 5:18` },

  { src_book: 'Revelation', prefix: 'Rev', raw: `\
Rev 1:6	Exo 19:6
Rev 1:7	Dan 7:13
Rev 1:7	Isa 40:5
Rev 1:7	Zec 12:10
Rev 1:8	Isa 41:4
Rev 1:8	Isa 44:6
Rev 1:12	Zec 4:2
Rev 1:14	Dan 7:9
Rev 1:14	Dan 10:5
Rev 1:14	Eze 1:27
Rev 1:14	Eze 8:2
Rev 1:14	Eze 43:2
Rev 1:16	Isa 49:2
Rev 1:17	Dan 8:17
Rev 1:17	Dan 10:8
Rev 1:17	Isa 44:6
Rev 2:1	Deu 23:14
Rev 2:7	Gen 2:9
Rev 2:14	Num 25:2
Rev 2:14	Num 31:16
Rev 2:20	1Ki 16:31
Rev 2:20	1Ki 21:23
Rev 2:20	2Ki 9:33
Rev 2:23	Jer 17:10
Rev 2:27	Psa 2:9
Rev 3:7	Isa 22:22
Rev 3:7	Job 12:14
Rev 3:9	Isa 60:14
Rev 3:17	Hos 12:8
Rev 3:19	Pro 3:11
Rev 3:21	Psa 110:1
Rev 4:2	Eze 1:26
Rev 4:5	Exo 19:16
Rev 4:5	Eze 1:1
Rev 4:5	Eze 11:1
Rev 4:5	Isa 6:1
Rev 4:6	Eze 1:22
Rev 4:6	Exo 24:10
Rev 4:6	Eze 1:5
Rev 4:6	Eze 10:12
Rev 4:7	Eze 1:10
Rev 4:8	Isa 6:2
Rev 5:1	Eze 2:2
Rev 5:6	Isa 53:7
Rev 5:6	Zec 4:10
Rev 5:6	2Ch 16:9
Rev 5:8	Psa 141:2
Rev 5:10	Exo 19:6
Rev 5:11	Dan 7:10
Rev 6:8	Eze 14:21
Rev 6:12	Isa 24:18
Rev 6:12	Isa 13:13
Rev 6:12	Hag 2:6
Rev 6:12	Joe 2:31
Rev 6:12	Isa 34:4
Rev 6:14	Psa 102:26
Rev 6:14	Isa 34:4
Rev 6:15	Isa 2:9
Rev 6:15	Isa 2:19
Rev 6:15	Hos 10:8
Rev 6:15	Isa 13:13
Rev 6:15	Psa 110:5
Rev 6:15	Joe 2:11
Rev 7:2	Eze 9:2
Rev 7:16	Isa 49:10
Rev 7:17	Isa 25:8
Rev 8:3	Lev 16:12
Rev 8:3	Exo 30:8
Rev 8:3	Psa 141:2
Rev 8:5	Eze 10:2
Rev 8:7	Joe 2:30
Rev 8:7	Exo 9:23
Rev 8:8	Exo 7:20
Rev 8:11	Jer 9:15
Rev 8:12	Eze 32:7
Rev 9:4	Eze 9:6
Rev 9:6	Jer 8:3
Rev 9:7	Joe 2:4
Rev 9:7	Joe 1:6
Rev 9:7	Joe 2:5
Rev 9:20	Psa 115:4
Rev 9:20	Psa 135:15
Rev 10:2	Eze 2:9
Rev 10:3	Jer 25:30
Rev 10:4	Dan 8:26
Rev 10:5	Dan 12:4
Rev 10:8	Eze 2:8
Rev 10:11	Jer 1:9
Rev 11:1	Eze 40:3
Rev 11:1	Eze 41:13
Rev 11:1	Eze 40:47
Rev 11:2	Dan 7:25
Rev 11:4	Zec 4:3
Rev 11:5	2Ki 1:9
Rev 11:6	1Ki 17:1
Rev 11:6	Exo 7:20
Rev 11:7	Dan 7:21
Rev 11:10	Est 9:22
Rev 11:15	Dan 2:44
Rev 11:15	Dan 7:14
Rev 11:18	Psa 2:1
Rev 11:18	Psa 46:6
Rev 11:18	Dan 7:10
Rev 11:18	Psa 115:13
Rev 11:18	Dan 11:44
Rev 12:1	Mic 4:9
Rev 12:1	Isa 66:7
Rev 12:3	Dan 7:7
Rev 12:4	Dan 8:10
Rev 12:5	Isa 66:7
Rev 12:5	Psa 2:10
Rev 12:6	Dan 7:25
Rev 12:7	Dan 10:13
Rev 12:7	Dan 12:1
Rev 12:14	Dan 7:25
Rev 12:14	Dan 12:7
Rev 13:1	Dan 7:3
Rev 13:2	Dan 7:5
Rev 13:5	Dan 7:8
Rev 13:5	Dan 7:25
Rev 13:7	Dan 8:10
Rev 13:7	Dan 5:19
Rev 13:7	Dan 2:37
Rev 13:10	Isa 14:2
Rev 13:10	Gen 9:6
Rev 13:14	Dan 3:1
Rev 14:1	Psa 2:6
Rev 14:1	Isa 59:20
Rev 14:5	Psa 32:2
Rev 14:8	Isa 21:9
Rev 14:8	Jer 51:8
Rev 14:8	Dan 4:27
Rev 14:10	Psa 75:9
Rev 14:10	Isa 51:22
Rev 14:10	Jer 25:15
Rev 14:11	Isa 34:10
Rev 14:14	Dan 7:13
Rev 14:14	Isa 19:1
Rev 14:15	Joe 3:13
Rev 14:19	Joe 3:13
Rev 14:19	Isa 63:3
Rev 14:19	Lam 1:15
Rev 15:2	Eze 1:22
Rev 15:3	Exo 15:11
Rev 15:4	Jer 10:6
Rev 15:4	Psa 86:9
Rev 15:7	Eze 10:7
Rev 15:8	Eze 10:4
Rev 15:8	Isa 6:4
Rev 15:8	1Ki 8:11
Rev 16:2	Eze 10:2
Rev 16:2	Exo 9:10
Rev 16:3	Exo 7:19
Rev 16:6	Exo 7:21
Rev 16:6	Eze 16:38
Rev 16:10	Exo 10:22
Rev 16:12	Isa 11:15
Rev 16:12	Jer 50:38
Rev 16:14	Zep 3:8
Rev 16:14	Joe 3:2
Rev 16:14	Zec 14:2
Rev 16:21	Exo 9:24
Rev 17:1	Jer 51:13
Rev 17:2	Jer 51:7
Rev 17:3	Dan 7:7
Rev 17:4	Jer 51:7
Rev 17:8	Dan 7:11
Rev 17:12	Dan 7:20
Rev 17:14	Dan 8:25
Rev 17:15	Isa 8:7
Rev 17:15	Jer 51:42
Rev 18:2	Isa 21:9
Rev 18:2	Jer 51:8
Rev 18:2	Isa 13:21
Rev 18:3	Jer 51:7
Rev 18:3	Nah 3:4
Rev 18:4	Isa 52:11
Rev 18:4	Jer 50:8
Rev 18:4	Jer 51:6
Rev 18:6	Jer 50:15
Rev 18:6	Psa 137:8
Rev 18:7	Isa 47:7
Rev 18:7	Jer 50:31
Rev 18:11	Eze 27:1
Rev 18:11	Isa 23:1
Rev 18:18	Isa 34:10
Rev 18:20	Isa 44:23
Rev 18:20	Jer 51:48
Rev 18:21	Jer 51:63
Rev 18:22	Isa 24:8
Rev 18:22	Jer 7:34
Rev 18:22	Jer 25:10
Rev 18:23	Isa 23:8
Rev 18:24	Jer 51:49
Rev 19:2	Deu 32:4
Rev 19:3	Isa 34:10
Rev 19:5	Psa 135:1
Rev 19:5	Psa 115:13
Rev 19:8	Psa 45:14
Rev 19:8	Isa 61:10
Rev 19:11	Psa 72:2
Rev 19:12	Dan 10:6
Rev 19:13	Isa 63:1
Rev 19:15	Psa 2:9
Rev 19:15	Lam 1:15
Rev 19:15	Isa 63:3
Rev 19:17	Isa 34:6
Rev 19:17	Eze 39:17
Rev 19:19	Psa 2:2
Rev 19:20	Isa 30:33
Rev 19:20	Dan 7:11
Rev 20:4	Dan 9:22
Rev 21:1	Isa 65:17
Rev 21:2	Eze 40:1
Rev 21:2	Eze 48:1
Rev 21:3	Eze 37:27
Rev 21:4	Isa 25:8
Rev 21:4	Isa 65:19
Rev 21:5	Isa 43:19
Rev 21:6	Isa 55:1
Rev 21:10	Eze 40:2
Rev 21:12	Eze 48:31
Rev 21:15	Zec 2:1
Rev 21:15	Eze 40:3
Rev 21:19	Isa 54:11
Rev 21:23	Isa 60:19
Rev 21:23	Eze 48:35
Rev 21:24	Isa 60:3
Rev 21:27	Isa 52:1
Rev 21:27	Eze 44:9
Rev 22:1	Zec 14:8
Rev 22:1	Eze 47:1
Rev 22:3	Zec 14:11
Rev 22:5	Isa 24:23
Rev 22:5	Isa 60:19
Rev 22:5	Eze 48:35
Rev 22:10	Dan 8:26
Rev 22:10	Dan 12:4
Rev 22:12	Isa 40:10
Rev 22:13	Isa 41:4
Rev 22:13	Isa 44:6
Rev 22:16	Isa 11:1
Rev 22:17	Isa 55:1
Rev 22:18	Deu 4:2
Rev 22:18	Deu 12:32
Rev 22:20	Hab 2:3` },

]

// ── Parsers ──────────────────────────────────────────────────────────────────

function firstVerse(s) { return parseInt(s.match(/\d+/)[0], 10) }

function parseSrc(token, prefix) {
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
  console.error('Usage: node scripts/seed-jas-thru-rev-xrefs.mjs <service-role-key>')
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
