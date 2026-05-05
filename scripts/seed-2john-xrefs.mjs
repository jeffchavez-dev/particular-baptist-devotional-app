/**
 * seed-2john-xrefs.mjs
 *
 * One-time script: upserts author cross-references for 2 John.
 *
 * Usage (service role key — bypasses RLS, no login needed):
 *   node scripts/seed-2john-xrefs.mjs <service-role-key>
 *
 * Get it from: Supabase dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

// ── Book name normalisation ──────────────────────────────────────────────────
// Maps abbreviated names to full canonical names used in the database.
const BOOK_MAP = {
  'Gen': 'Genesis', 'Ex': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers',
  'Deut': 'Deuteronomy', 'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth',
  '1 Sam': '1 Samuel', '2 Sam': '2 Samuel', '1 Kgs': '1 Kings', '2 Kgs': '2 Kings',
  '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles', 'Ezra': 'Ezra', 'Neh': 'Nehemiah',
  'Est': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs', 'Eccl': 'Ecclesiastes',
  'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
  'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
  'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk',
  'Zeph': 'Zephaniah', 'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
  'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
  'Rom': 'Romans', '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians',
  'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
  '1 Thess': '1 Thessalonians', '2 Thess': '2 Thessalonians',
  '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', 'Titus': 'Titus', 'Phlm': 'Philemon',
  'Heb': 'Hebrews', 'Jas': 'James', '1 Pet': '1 Peter', '2 Pet': '2 Peter',
  '1 John': '1 John', '2 John': '2 John', '3 John': '3 John',
  'Jude': 'Jude', 'Rev': 'Revelation',
}

function resolveBook(abbr) {
  const clean = abbr.replace(/\.$/, '').trim()
  return BOOK_MAP[clean] || clean
}

// ── Cross-reference data ─────────────────────────────────────────────────────
// Format: { verse, tgt_book, tgt_chapter, tgt_verse, label? }
// For single-chapter books (Jude, 3 John, 2 John, Philemon, Obadiah) the
// chapter is always 1.

const XREFS = [
  // Verse 1
  { verse: 1, tgt_book: '3 John',       tgt_chapter: 1,  tgt_verse: 1 },
  { verse: 1, tgt_book: '1 Peter',      tgt_chapter: 5,  tgt_verse: 1 },
  { verse: 1, tgt_book: '1 John',       tgt_chapter: 3,  tgt_verse: 18 },
  { verse: 1, tgt_book: 'John',         tgt_chapter: 8,  tgt_verse: 32 },
  { verse: 1, tgt_book: '1 Timothy',    tgt_chapter: 2,  tgt_verse: 4 },
  { verse: 1, tgt_book: 'Hebrews',      tgt_chapter: 10, tgt_verse: 26 },
  { verse: 1, tgt_book: 'John',         tgt_chapter: 1,  tgt_verse: 17 },
  { verse: 1, tgt_book: 'John',         tgt_chapter: 14, tgt_verse: 6 },
  { verse: 1, tgt_book: 'Galatians',    tgt_chapter: 2,  tgt_verse: 5 },

  // Verse 2
  { verse: 2, tgt_book: '1 Corinthians', tgt_chapter: 13, tgt_verse: 6 },

  // Verse 3
  { verse: 3, tgt_book: '1 Timothy',    tgt_chapter: 1,  tgt_verse: 2 },
  { verse: 3, tgt_book: '2 Timothy',    tgt_chapter: 1,  tgt_verse: 2 },
  { verse: 3, tgt_book: 'Jude',         tgt_chapter: 1,  tgt_verse: 2 },

  // Verse 4
  { verse: 4, tgt_book: '3 John',       tgt_chapter: 1,  tgt_verse: 3 },
  { verse: 4, tgt_book: '3 John',       tgt_chapter: 1,  tgt_verse: 4 },

  // Verse 5
  { verse: 5, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 7 },
  { verse: 5, tgt_book: '1 John',       tgt_chapter: 3,  tgt_verse: 11 },

  // Verse 6
  { verse: 6, tgt_book: '1 John',       tgt_chapter: 5,  tgt_verse: 3 },
  { verse: 6, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 5 },
  { verse: 6, tgt_book: 'John',         tgt_chapter: 14, tgt_verse: 15 },
  { verse: 6, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 24 },

  // Verse 7
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 18 },
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 26 },
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 4,  tgt_verse: 1 },
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 22 },
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 4,  tgt_verse: 2 },
  { verse: 7, tgt_book: '1 John',       tgt_chapter: 4,  tgt_verse: 3 },

  // Verse 8
  { verse: 8, tgt_book: 'Galatians',    tgt_chapter: 3,  tgt_verse: 4 },
  { verse: 8, tgt_book: 'Hebrews',      tgt_chapter: 10, tgt_verse: 35 },
  { verse: 8, tgt_book: '1 Corinthians', tgt_chapter: 3, tgt_verse: 8 },

  // Verse 9
  { verse: 9, tgt_book: '1 John',       tgt_chapter: 2,  tgt_verse: 23 },

  // Verse 10
  { verse: 10, tgt_book: 'Romans',           tgt_chapter: 16, tgt_verse: 17 },
  { verse: 10, tgt_book: 'Galatians',        tgt_chapter: 1,  tgt_verse: 8 },
  { verse: 10, tgt_book: 'Galatians',        tgt_chapter: 1,  tgt_verse: 9 },
  { verse: 10, tgt_book: '2 Thessalonians',  tgt_chapter: 3,  tgt_verse: 6 },
  { verse: 10, tgt_book: '2 Thessalonians',  tgt_chapter: 3,  tgt_verse: 14 },
  { verse: 10, tgt_book: 'Titus',            tgt_chapter: 3,  tgt_verse: 10 },

  // Verse 11
  { verse: 11, tgt_book: '1 Timothy',   tgt_chapter: 5,  tgt_verse: 22 },

  // Verse 12
  { verse: 12, tgt_book: '3 John',      tgt_chapter: 1,  tgt_verse: 13 },
  { verse: 12, tgt_book: '3 John',      tgt_chapter: 1,  tgt_verse: 14 },
  { verse: 12, tgt_book: 'John',        tgt_chapter: 15, tgt_verse: 11 },
  { verse: 12, tgt_book: 'John',        tgt_chapter: 17, tgt_verse: 13 },
]

// ── Main ─────────────────────────────────────────────────────────────────────
const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node scripts/seed-2john-xrefs.mjs <service-role-key>')
  console.error('  Get it from: Supabase dashboard → Project Settings → API → service_role key')
  process.exit(1)
}

// Service role key bypasses RLS — no sign-in needed
const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('Upserting 2 John cross-references…')

let inserted = 0
let skipped  = 0

for (const xref of XREFS) {
  const row = {
    src_book:    '2 John',
    src_chapter: 1,
    src_verse:   xref.verse,
    tgt_book:    xref.tgt_book,
    tgt_chapter: xref.tgt_chapter,
    tgt_verse:   xref.tgt_verse ?? null,
    label:       xref.label ?? null,
    updated_at:  new Date().toISOString(),
  }

  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(row, { onConflict: 'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse' })

  if (error) {
    console.warn(`  ✗ v${xref.verse} → ${xref.tgt_book} ${xref.tgt_chapter}:${xref.tgt_verse}  [${error.message}]`)
    skipped++
  } else {
    console.log(`  ✓ v${xref.verse} → ${xref.tgt_book} ${xref.tgt_chapter}:${xref.tgt_verse}`)
    inserted++
  }
}

console.log(`\nDone. ${inserted} upserted, ${skipped} failed.`)
