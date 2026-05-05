/**
 * seed-matthew-xrefs.mjs
 *
 * Upserts OT quotation cross-references for the Gospel of Matthew.
 * Rows already present in author_cross_refs are silently skipped
 * (ignoreDuplicates: true on the unique constraint).
 *
 * Usage (service role key — bypasses RLS, no sign-in needed):
 *   node scripts/seed-matthew-xrefs.mjs <service-role-key>
 *
 * Get it from: Supabase dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

// ── Book abbreviation → canonical name ──────────────────────────────────────
const BOOK_MAP = {
  'Isa': 'Isaiah',
  'Mic': 'Micah',
  'Hos': 'Hosea',
  'Jer': 'Jeremiah',
  'Deu': 'Deuteronomy',
  'Psa': 'Psalms',
  'Exo': 'Exodus',
  'Lev': 'Leviticus',
  'Gen': 'Genesis',
  'Num': 'Numbers',
  '1Sa': '1 Samuel',
  'Jon': 'Jonah',
  '1Ki': '1 Kings',
  'Mal': 'Malachi',
  'Zec': 'Zechariah',
  'Dan': 'Daniel',
  'Joe': 'Joel',
  'Eze': 'Ezekiel',
  '2Ch': '2 Chronicles',
  'Pro': 'Proverbs',
}

// ── Raw data (tab-separated: "Mat X:Y[,Z|-Z]\tAbbr C:V[,V|-V][&c]") ─────────
// Source verse ranges (e.g. "4:15,16") → use first verse only.
// Target verse lists / ranges (e.g. "91:11,12" or "42:1-4") → first verse only.
// &c suffix is stripped.
const RAW = `\
Mat 1:23	Isa 7:14
Mat 2:6	Mic 5:2
Mat 2:15	Hos 11:1
Mat 2:18	Jer 31:15
Mat 3:3	Isa 40:3
Mat 4:4	Deu 8:3
Mat 4:6	Psa 91:11,12
Mat 4:7	Deu 6:16
Mat 4:10	Deu 6:13
Mat 4:10	Deu 10:20
Mat 4:15,16	Isa 9:1,2
Mat 4:15,16	Isa 42:7
Mat 5:5	Psa 37:11
Mat 5:21	Exo 20:13
Mat 5:21	Deu 5:17
Mat 5:27	Exo 20:14
Mat 5:27	Deu 5:18
Mat 5:31	Deu 24:1
Mat 5:33	Exo 20:7
Mat 5:33	Lev 19:12
Mat 5:38	Exo 21:24
Mat 5:38	Lev 24:20
Mat 5:38	Deu 19:21
Mat 5:43	Lev 19:18
Mat 5:48	Gen 17:1
Mat 7:23	Psa 6:8
Mat 8:4	Lev 14:2,3
Mat 8:17	Isa 53:4
Mat 9:13	Hos 6:6
Mat 10:35,36	Mic 7:6
Mat 11:5	Isa 35:5
Mat 11:5	Isa 29:18
Mat 11:10	Mal 3:1
Mat 11:14	Mal 4:5
Mat 12:3	1Sa 21:6
Mat 12:5	Num 28:9,10
Mat 12:7	Hos 6:6
Mat 12:18	Isa 42:1
Mat 12:18-21	Isa 42:1-4
Mat 12:40	Jon 1:17&c
Mat 12:42	1Ki 10:1
Mat 13:14	Isa 6:9,10
Mat 13:35	Psa 78:2
Mat 15:4	Exo 20:12
Mat 15:4	Deu 5:16
Mat 15:4	Exo 21:17
Mat 15:4	Lev 20:9
Mat 15:4	Pro 20:20
Mat 15:8,9	Isa 29:13
Mat 16:4	Jon 1:17
Mat 17:10	Mal 4:5
Mat 18:15	Lev 19:17
Mat 18:16	Lev 19:15
Mat 18:16	Deu 19:15
Mat 19:4	Gen 1:27
Mat 19:5	Gen 2:24
Mat 19:7	Deu 24:1
Mat 19:18	Exo 20:12&c
Mat 19:19	Lev 19:18
Mat 19:26	Jer 32:17
Mat 21:5	Zec 9:9
Mat 21:9	Psa 118:26
Mat 21:13	Isa 56:7
Mat 21:13	Jer 7:11
Mat 21:16	Psa 8:2
Mat 21:33	Isa 5:1
Mat 21:42	Psa 118:22,23
Mat 21:44	Isa 8:14
Mat 21:44	Zec 12:3
Mat 21:44	Dan 2:34,35,44
Mat 22:24	Deu 25:5
Mat 22:32	Exo 3:6
Mat 22:37	Deu 6:5
Mat 22:39	Lev 19:18
Mat 22:44	Psa 110:1
Mat 23:35	Gen 4:8
Mat 23:35	2Ch 24:21,22
Mat 23:38	Psa 69:25
Mat 23:38	Jer 12:7
Mat 23:38	Jer 22:5
Mat 23:39	Psa 118:26
Mat 24:15	Dan 9:27
Mat 24:15	Dan 8:13
Mat 24:15	Dan 11:31
Mat 24:15	Dan 12:11
Mat 24:21	Jer 30:7
Mat 24:29	Isa 13:9,10
Mat 24:29	Joe 2:10
Mat 24:29	Joe 3:15
Mat 24:29	Eze 32:7
Mat 24:35	Isa 51:16
Mat 24:37	Gen 7:4
Mat 25:41	Psa 6:8
Mat 26:24	Psa 22:1-31
Mat 26:31	Zec 13:7
Mat 26:60	Psa 35:11
Mat 26:67	Isa 50:6
Mat 27:9,10	Zec 11:13
Mat 27:35	Psa 22:18
Mat 27:43	Psa 22:7,8,9
Mat 27:46	Psa 22:1
Mat 28:18	Dan 7:14`

// ── Parsers ──────────────────────────────────────────────────────────────────

/** Extract the first integer from a verse string like "11", "11,12", "11-14", "11,12,13" */
function firstVerse(verseStr) {
  return parseInt(verseStr.match(/\d+/)[0], 10)
}

/**
 * Parse a source token like "Mat 4:15,16" or "Mat 12:18-21" or "Mat 7:23"
 * Always returns { chapter, verse } using the first verse.
 */
function parseSrc(token) {
  const m = token.match(/Mat\s+(\d+):(\d+)/)
  if (!m) throw new Error(`Cannot parse source: "${token}"`)
  return { chapter: parseInt(m[1], 10), verse: parseInt(m[2], 10) }
}

/**
 * Parse a target token like "Isa 7:14", "Psa 91:11,12", "Isa 42:1-4", "Jon 1:17&c"
 * Returns { book, chapter, verse } using the first verse.
 */
function parseTgt(token) {
  // Strip &c (et cetera marker)
  token = token.replace(/&c\.?/gi, '').trim()
  // Match: ABBR CHAPTER:VERSE_SPEC
  // Abbreviations are like "Isa", "Deu", "1Sa", "2Ch"
  const m = token.match(/^([A-Z][a-z]{1,3}|[123][A-Z][a-z]{1,2})\s+(\d+):(.+)$/)
  if (!m) throw new Error(`Cannot parse target: "${token}"`)
  const abbr    = m[1]
  const chapter = parseInt(m[2], 10)
  const verse   = firstVerse(m[3])
  const book    = BOOK_MAP[abbr]
  if (!book) throw new Error(`Unknown abbreviation: "${abbr}" in "${token}"`)
  return { book, chapter, verse }
}

// ── Parse all rows ───────────────────────────────────────────────────────────
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
      src_book:    'Matthew',
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
if (parseErrors > 0) {
  console.error('Fix parse errors before upserting.')
  process.exit(1)
}

// ── Upsert ───────────────────────────────────────────────────────────────────
const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node scripts/seed-matthew-xrefs.mjs <service-role-key>')
  console.error('  Get it from: Supabase dashboard → Project Settings → API → service_role key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let inserted = 0
let skipped  = 0

// Batch in chunks of 50 to avoid large payloads
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
    for (const r of chunk) {
      console.log(`  ✓ Mat ${r.src_chapter}:${r.src_verse} → ${r.tgt_book} ${r.tgt_chapter}:${r.tgt_verse}`)
    }
    inserted += chunk.length
  }
}

console.log(`\nDone. ${inserted} upserted/skipped-as-duplicate, ${skipped} failed.`)
