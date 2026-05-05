/**
 * seed-xrefs.mjs  (formerly seed-2john-xrefs.mjs)
 *
 * Upserts author cross-references for multiple books.
 * Add new books to ALL_BOOKS below and re-run as needed.
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
// Structure: ALL_BOOKS is an array of { src_book, src_chapter, xrefs[] }
// For single-chapter books (2 John, 3 John, Jude, Philemon, Obadiah) src_chapter = 1.

const ALL_BOOKS = [

  // ── 2 John ──────────────────────────────────────────────────────────────────
  { src_book: '2 John', src_chapter: 1, xrefs: [
    // Verse 1
    { verse: 1, tgt_book: '3 John',          tgt_chapter: 1,  tgt_verse: 1 },
    { verse: 1, tgt_book: '1 Peter',         tgt_chapter: 5,  tgt_verse: 1 },
    { verse: 1, tgt_book: '1 John',          tgt_chapter: 3,  tgt_verse: 18 },
    { verse: 1, tgt_book: 'John',            tgt_chapter: 8,  tgt_verse: 32 },
    { verse: 1, tgt_book: '1 Timothy',       tgt_chapter: 2,  tgt_verse: 4 },
    { verse: 1, tgt_book: 'Hebrews',         tgt_chapter: 10, tgt_verse: 26 },
    { verse: 1, tgt_book: 'John',            tgt_chapter: 1,  tgt_verse: 17 },
    { verse: 1, tgt_book: 'John',            tgt_chapter: 14, tgt_verse: 6 },
    { verse: 1, tgt_book: 'Galatians',       tgt_chapter: 2,  tgt_verse: 5 },
    // Verse 2
    { verse: 2, tgt_book: '1 Corinthians',   tgt_chapter: 13, tgt_verse: 6 },
    // Verse 3
    { verse: 3, tgt_book: '1 Timothy',       tgt_chapter: 1,  tgt_verse: 2 },
    { verse: 3, tgt_book: '2 Timothy',       tgt_chapter: 1,  tgt_verse: 2 },
    { verse: 3, tgt_book: 'Jude',            tgt_chapter: 1,  tgt_verse: 2 },
    // Verse 4
    { verse: 4, tgt_book: '3 John',          tgt_chapter: 1,  tgt_verse: 3 },
    { verse: 4, tgt_book: '3 John',          tgt_chapter: 1,  tgt_verse: 4 },
    // Verse 5
    { verse: 5, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 7 },
    { verse: 5, tgt_book: '1 John',          tgt_chapter: 3,  tgt_verse: 11 },
    // Verse 6
    { verse: 6, tgt_book: '1 John',          tgt_chapter: 5,  tgt_verse: 3 },
    { verse: 6, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 5 },
    { verse: 6, tgt_book: 'John',            tgt_chapter: 14, tgt_verse: 15 },
    { verse: 6, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 24 },
    // Verse 7
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 18 },
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 26 },
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 4,  tgt_verse: 1 },
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 22 },
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 4,  tgt_verse: 2 },
    { verse: 7, tgt_book: '1 John',          tgt_chapter: 4,  tgt_verse: 3 },
    // Verse 8
    { verse: 8, tgt_book: 'Galatians',       tgt_chapter: 3,  tgt_verse: 4 },
    { verse: 8, tgt_book: 'Hebrews',         tgt_chapter: 10, tgt_verse: 35 },
    { verse: 8, tgt_book: '1 Corinthians',   tgt_chapter: 3,  tgt_verse: 8 },
    // Verse 9
    { verse: 9, tgt_book: '1 John',          tgt_chapter: 2,  tgt_verse: 23 },
    // Verse 10
    { verse: 10, tgt_book: 'Romans',          tgt_chapter: 16, tgt_verse: 17 },
    { verse: 10, tgt_book: 'Galatians',       tgt_chapter: 1,  tgt_verse: 8 },
    { verse: 10, tgt_book: 'Galatians',       tgt_chapter: 1,  tgt_verse: 9 },
    { verse: 10, tgt_book: '2 Thessalonians', tgt_chapter: 3,  tgt_verse: 6 },
    { verse: 10, tgt_book: '2 Thessalonians', tgt_chapter: 3,  tgt_verse: 14 },
    { verse: 10, tgt_book: 'Titus',           tgt_chapter: 3,  tgt_verse: 10 },
    // Verse 11
    { verse: 11, tgt_book: '1 Timothy',       tgt_chapter: 5,  tgt_verse: 22 },
    // Verse 12
    { verse: 12, tgt_book: '3 John',          tgt_chapter: 1,  tgt_verse: 13 },
    { verse: 12, tgt_book: '3 John',          tgt_chapter: 1,  tgt_verse: 14 },
    { verse: 12, tgt_book: 'John',            tgt_chapter: 15, tgt_verse: 11 },
    { verse: 12, tgt_book: 'John',            tgt_chapter: 17, tgt_verse: 13 },
  ]},

  // ── 3 John ──────────────────────────────────────────────────────────────────
  { src_book: '3 John', src_chapter: 1, xrefs: [
    // Verse 1
    { verse: 1, tgt_book: '2 John',          tgt_chapter: 1,  tgt_verse: 1 },
    { verse: 1, tgt_book: '1 John',          tgt_chapter: 3,  tgt_verse: 18 },
    // Verse 3
    { verse: 3, tgt_book: '2 John',          tgt_chapter: 1,  tgt_verse: 4 },
    // Verse 4
    { verse: 4, tgt_book: '1 Corinthians',   tgt_chapter: 4,  tgt_verse: 14 },
    { verse: 4, tgt_book: '1 Corinthians',   tgt_chapter: 4,  tgt_verse: 15 },
    { verse: 4, tgt_book: 'Galatians',       tgt_chapter: 4,  tgt_verse: 19 },
    { verse: 4, tgt_book: '1 Timothy',       tgt_chapter: 1,  tgt_verse: 2 },
    { verse: 4, tgt_book: '2 Timothy',       tgt_chapter: 1,  tgt_verse: 2 },
    { verse: 4, tgt_book: 'Titus',           tgt_chapter: 1,  tgt_verse: 4 },
    { verse: 4, tgt_book: 'Philemon',        tgt_chapter: 1,  tgt_verse: 10 },
    // Verse 5
    { verse: 5, tgt_book: 'Galatians',       tgt_chapter: 6,  tgt_verse: 10 },
    { verse: 5, tgt_book: 'Hebrews',         tgt_chapter: 13, tgt_verse: 1 },
    { verse: 5, tgt_book: 'Matthew',         tgt_chapter: 25, tgt_verse: 35 },
    // Verse 6
    { verse: 6, tgt_book: '1 Thessalonians', tgt_chapter: 2,  tgt_verse: 12 },
    { verse: 6, tgt_book: 'Colossians',      tgt_chapter: 1,  tgt_verse: 10 },
    // Verse 7
    { verse: 7, tgt_book: 'Acts',            tgt_chapter: 5,  tgt_verse: 41 },
    { verse: 7, tgt_book: '1 Corinthians',   tgt_chapter: 9,  tgt_verse: 12 },
    { verse: 7, tgt_book: '1 Corinthians',   tgt_chapter: 9,  tgt_verse: 15 },
    // Verse 11
    { verse: 11, tgt_book: 'Psalms',         tgt_chapter: 34, tgt_verse: 14 },
    { verse: 11, tgt_book: 'Psalms',         tgt_chapter: 37, tgt_verse: 27 },
    { verse: 11, tgt_book: 'Isaiah',         tgt_chapter: 1,  tgt_verse: 16 },
    { verse: 11, tgt_book: 'Isaiah',         tgt_chapter: 1,  tgt_verse: 17 },
    { verse: 11, tgt_book: '1 John',         tgt_chapter: 2,  tgt_verse: 29 },
    { verse: 11, tgt_book: '1 John',         tgt_chapter: 3,  tgt_verse: 6 },
    // Verse 12
    { verse: 12, tgt_book: '1 Timothy',      tgt_chapter: 3,  tgt_verse: 7 },
    { verse: 12, tgt_book: 'John',           tgt_chapter: 21, tgt_verse: 24 },
    // Verse 13
    { verse: 13, tgt_book: '2 John',         tgt_chapter: 1,  tgt_verse: 12 },
    // Verse 15
    { verse: 15, tgt_book: 'John',           tgt_chapter: 10, tgt_verse: 3 },
  ]},


  // ── Zephaniah 1 ─────────────────────────────────────────────────────────────
  { src_book: 'Zephaniah', src_chapter: 1, xrefs: [
    // Verse 1
    { verse: 1, tgt_book: 'Jeremiah',       tgt_chapter: 1,  tgt_verse: 2 },
    { verse: 1, tgt_book: '2 Kings',        tgt_chapter: 22, tgt_verse: 1 },
    // Verse 2
    { verse: 2, tgt_book: 'Jeremiah',       tgt_chapter: 8,  tgt_verse: 13 },
    { verse: 2, tgt_book: '2 Kings',        tgt_chapter: 22, tgt_verse: 16 },
    { verse: 2, tgt_book: '2 Kings',        tgt_chapter: 22, tgt_verse: 17 },
    // Verse 3
    { verse: 3, tgt_book: 'Hosea',          tgt_chapter: 4,  tgt_verse: 3 },
    { verse: 3, tgt_book: 'Ezekiel',        tgt_chapter: 7,  tgt_verse: 19 },
    { verse: 3, tgt_book: 'Ezekiel',        tgt_chapter: 14, tgt_verse: 17 },
    // Verse 4
    { verse: 4, tgt_book: '2 Kings',        tgt_chapter: 23, tgt_verse: 4 },
    // Verse 5
    { verse: 5, tgt_book: 'Jeremiah',       tgt_chapter: 19, tgt_verse: 13 },
    { verse: 5, tgt_book: '1 Kings',        tgt_chapter: 18, tgt_verse: 21 },
    { verse: 5, tgt_book: '2 Kings',        tgt_chapter: 17, tgt_verse: 33 },
    { verse: 5, tgt_book: '2 Kings',        tgt_chapter: 17, tgt_verse: 41 },
    { verse: 5, tgt_book: '1 Kings',        tgt_chapter: 11, tgt_verse: 5 },
    { verse: 5, tgt_book: '1 Kings',        tgt_chapter: 11, tgt_verse: 33 },
    // Verse 6
    { verse: 6, tgt_book: 'Jeremiah',       tgt_chapter: 2,  tgt_verse: 13 },
    { verse: 6, tgt_book: 'Jeremiah',       tgt_chapter: 2,  tgt_verse: 17 },
    { verse: 6, tgt_book: 'Jeremiah',       tgt_chapter: 15, tgt_verse: 6 },
    { verse: 6, tgt_book: 'Jeremiah',       tgt_chapter: 5,  tgt_verse: 24 },
    { verse: 6, tgt_book: 'Hebrews',        tgt_chapter: 11, tgt_verse: 6 },
    // Verse 7
    { verse: 7, tgt_book: 'Habakkuk',       tgt_chapter: 2,  tgt_verse: 20 },
    { verse: 7, tgt_book: 'Joel',           tgt_chapter: 1,  tgt_verse: 15 },
    { verse: 7, tgt_book: 'Isaiah',         tgt_chapter: 34, tgt_verse: 6 },
    { verse: 7, tgt_book: 'Jeremiah',       tgt_chapter: 46, tgt_verse: 10 },
    { verse: 7, tgt_book: 'Ezekiel',        tgt_chapter: 39, tgt_verse: 17 },
    { verse: 7, tgt_book: 'Ezekiel',        tgt_chapter: 39, tgt_verse: 19 },
    { verse: 7, tgt_book: '1 Samuel',       tgt_chapter: 16, tgt_verse: 5 },
    // Verse 8
    { verse: 8, tgt_book: '2 Kings',        tgt_chapter: 24, tgt_verse: 12 },
    { verse: 8, tgt_book: '2 Kings',        tgt_chapter: 24, tgt_verse: 14 },
    { verse: 8, tgt_book: '2 Kings',        tgt_chapter: 25, tgt_verse: 7 },
    { verse: 8, tgt_book: 'Matthew',        tgt_chapter: 22, tgt_verse: 11 },
    // Verse 9
    { verse: 9, tgt_book: '1 Samuel',       tgt_chapter: 5,  tgt_verse: 5 },
    // Verse 10
    { verse: 10, tgt_book: '2 Chronicles',  tgt_chapter: 33, tgt_verse: 14 },
    { verse: 10, tgt_book: 'Zechariah',     tgt_chapter: 11, tgt_verse: 3 },
    { verse: 10, tgt_book: '2 Kings',       tgt_chapter: 22, tgt_verse: 14 },
    // Verse 11
    { verse: 11, tgt_book: 'Zechariah',     tgt_chapter: 11, tgt_verse: 2 },
    { verse: 11, tgt_book: 'James',         tgt_chapter: 5,  tgt_verse: 1 },
    // Verse 12
    { verse: 12, tgt_book: 'Amos',          tgt_chapter: 9,  tgt_verse: 3 },
    { verse: 12, tgt_book: 'Jeremiah',      tgt_chapter: 48, tgt_verse: 11 },
    { verse: 12, tgt_book: 'Amos',          tgt_chapter: 6,  tgt_verse: 1 },
    { verse: 12, tgt_book: 'Psalms',        tgt_chapter: 94, tgt_verse: 7 },
    { verse: 12, tgt_book: 'Ezekiel',       tgt_chapter: 8,  tgt_verse: 12 },
    { verse: 12, tgt_book: 'Malachi',       tgt_chapter: 2,  tgt_verse: 17 },
    { verse: 12, tgt_book: 'Malachi',       tgt_chapter: 3,  tgt_verse: 14 },
    { verse: 12, tgt_book: 'Malachi',       tgt_chapter: 3,  tgt_verse: 15 },
    // Verse 13
    { verse: 13, tgt_book: 'Isaiah',        tgt_chapter: 42, tgt_verse: 22 },
    { verse: 13, tgt_book: 'Amos',          tgt_chapter: 5,  tgt_verse: 11 },
    { verse: 13, tgt_book: 'Micah',         tgt_chapter: 6,  tgt_verse: 15 },
    // Verse 14
    { verse: 14, tgt_book: 'Ezekiel',       tgt_chapter: 7,  tgt_verse: 7 },
    { verse: 14, tgt_book: 'Ezekiel',       tgt_chapter: 7,  tgt_verse: 12 },
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 33, tgt_verse: 7 },
    // Verse 15
    { verse: 15, tgt_book: 'Joel',          tgt_chapter: 1,  tgt_verse: 15 },
    { verse: 15, tgt_book: 'Job',           tgt_chapter: 30, tgt_verse: 3 },
    { verse: 15, tgt_book: 'Joel',          tgt_chapter: 2,  tgt_verse: 2 },
    // Verse 16
    { verse: 16, tgt_book: 'Jeremiah',      tgt_chapter: 4,  tgt_verse: 19 },
    { verse: 16, tgt_book: 'Isaiah',        tgt_chapter: 2,  tgt_verse: 15 },
    // Verse 17
    { verse: 17, tgt_book: 'Jeremiah',      tgt_chapter: 10, tgt_verse: 18 },
    { verse: 17, tgt_book: 'Deuteronomy',   tgt_chapter: 28, tgt_verse: 29 },
    { verse: 17, tgt_book: 'Isaiah',        tgt_chapter: 59, tgt_verse: 10 },
    { verse: 17, tgt_book: 'Psalms',        tgt_chapter: 79, tgt_verse: 3 },
    { verse: 17, tgt_book: 'Psalms',        tgt_chapter: 83, tgt_verse: 10 },
    // Verse 18
    { verse: 18, tgt_book: 'Ezekiel',       tgt_chapter: 7,  tgt_verse: 19 },
    { verse: 18, tgt_book: 'Proverbs',      tgt_chapter: 11, tgt_verse: 4 },
    { verse: 18, tgt_book: 'Ezekiel',       tgt_chapter: 36, tgt_verse: 5 },
  ]},

  // ── Zephaniah 2 ─────────────────────────────────────────────────────────────
  { src_book: 'Zephaniah', src_chapter: 2, xrefs: [
    // Verse 1
    { verse: 1, tgt_book: 'Jeremiah',       tgt_chapter: 6,  tgt_verse: 15 },
    // Verse 2
    { verse: 2, tgt_book: 'Psalms',         tgt_chapter: 1,  tgt_verse: 4 },
    { verse: 2, tgt_book: '2 Kings',        tgt_chapter: 23, tgt_verse: 26 },
    // Verse 3
    { verse: 3, tgt_book: 'Amos',           tgt_chapter: 5,  tgt_verse: 6 },
    { verse: 3, tgt_book: 'Psalms',         tgt_chapter: 76, tgt_verse: 9 },
    { verse: 3, tgt_book: 'Isaiah',         tgt_chapter: 11, tgt_verse: 4 },
    { verse: 3, tgt_book: 'Amos',           tgt_chapter: 5,  tgt_verse: 14 },
    { verse: 3, tgt_book: 'Amos',           tgt_chapter: 5,  tgt_verse: 15 },
    { verse: 3, tgt_book: 'Isaiah',         tgt_chapter: 2,  tgt_verse: 10 },
    { verse: 3, tgt_book: 'Isaiah',         tgt_chapter: 26, tgt_verse: 20 },
    { verse: 3, tgt_book: 'Isaiah',         tgt_chapter: 26, tgt_verse: 21 },
    // Verse 4
    { verse: 4, tgt_book: 'Zechariah',      tgt_chapter: 9,  tgt_verse: 5 },
    { verse: 4, tgt_book: 'Zechariah',      tgt_chapter: 9,  tgt_verse: 6 },
    { verse: 4, tgt_book: 'Jeremiah',       tgt_chapter: 47, tgt_verse: 5 },
    { verse: 4, tgt_book: 'Amos',           tgt_chapter: 1,  tgt_verse: 6 },
    { verse: 4, tgt_book: 'Amos',           tgt_chapter: 1,  tgt_verse: 7 },
    { verse: 4, tgt_book: 'Amos',           tgt_chapter: 1,  tgt_verse: 8 },
    // Verse 5
    { verse: 5, tgt_book: 'Jeremiah',       tgt_chapter: 47, tgt_verse: 7 },
    { verse: 5, tgt_book: 'Ezekiel',        tgt_chapter: 25, tgt_verse: 16 },
    { verse: 5, tgt_book: '1 Samuel',       tgt_chapter: 30, tgt_verse: 14 },
    { verse: 5, tgt_book: 'Nahum',          tgt_chapter: 2,  tgt_verse: 13 },
    { verse: 5, tgt_book: 'Joshua',         tgt_chapter: 13, tgt_verse: 3 },
    // Verse 6
    { verse: 6, tgt_book: 'Isaiah',         tgt_chapter: 65, tgt_verse: 10 },
    // Verse 7
    { verse: 7, tgt_book: 'Joshua',         tgt_chapter: 19, tgt_verse: 29 },
    { verse: 7, tgt_book: 'Obadiah',        tgt_chapter: 1,  tgt_verse: 19 },
    { verse: 7, tgt_book: 'Zechariah',      tgt_chapter: 10, tgt_verse: 3 },
    { verse: 7, tgt_book: 'Luke',           tgt_chapter: 1,  tgt_verse: 68 },
    // Verse 8
    { verse: 8, tgt_book: 'Jeremiah',       tgt_chapter: 48, tgt_verse: 27 },
    { verse: 8, tgt_book: 'Ezekiel',        tgt_chapter: 25, tgt_verse: 3 },
    { verse: 8, tgt_book: 'Ezekiel',        tgt_chapter: 25, tgt_verse: 6 },
    { verse: 8, tgt_book: 'Jeremiah',       tgt_chapter: 49, tgt_verse: 1 },
    // Verse 9
    { verse: 9, tgt_book: 'Isaiah',         tgt_chapter: 49, tgt_verse: 18 },
    { verse: 9, tgt_book: 'Ezekiel',        tgt_chapter: 16, tgt_verse: 48 },
    { verse: 9, tgt_book: 'Deuteronomy',    tgt_chapter: 29, tgt_verse: 23 },
    { verse: 9, tgt_book: 'Isaiah',         tgt_chapter: 13, tgt_verse: 19 },
    // Verse 10
    { verse: 10, tgt_book: 'Isaiah',        tgt_chapter: 16, tgt_verse: 6 },
    // Verse 11
    { verse: 11, tgt_book: 'Isaiah',        tgt_chapter: 17, tgt_verse: 4 },
    { verse: 11, tgt_book: 'Psalms',        tgt_chapter: 22, tgt_verse: 27 },
    { verse: 11, tgt_book: 'Genesis',       tgt_chapter: 10, tgt_verse: 5 },
    // Verse 13
    { verse: 13, tgt_book: 'Isaiah',        tgt_chapter: 10, tgt_verse: 12 },
    { verse: 13, tgt_book: 'Nahum',         tgt_chapter: 3,  tgt_verse: 7 },
    // Verse 14
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 13, tgt_verse: 21 },
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 13, tgt_verse: 22 },
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 34, tgt_verse: 14 },
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 34, tgt_verse: 11 },
    { verse: 14, tgt_book: 'Jeremiah',      tgt_chapter: 22, tgt_verse: 14 },
    { verse: 14, tgt_book: 'Jeremiah',      tgt_chapter: 22, tgt_verse: 15 },
    // Verse 15
    { verse: 15, tgt_book: 'Isaiah',        tgt_chapter: 47, tgt_verse: 8 },
    { verse: 15, tgt_book: 'Ezekiel',       tgt_chapter: 25, tgt_verse: 5 },
    { verse: 15, tgt_book: 'Jeremiah',      tgt_chapter: 19, tgt_verse: 8 },
    { verse: 15, tgt_book: 'Nahum',         tgt_chapter: 3,  tgt_verse: 19 },
  ]},

  // ── Zephaniah 3 ─────────────────────────────────────────────────────────────
  { src_book: 'Zephaniah', src_chapter: 3, xrefs: [
    // Verse 1
    { verse: 1, tgt_book: 'Jeremiah',       tgt_chapter: 6,  tgt_verse: 6 },
    // Verse 2
    { verse: 2, tgt_book: 'Jeremiah',       tgt_chapter: 5,  tgt_verse: 3 },
    // Verse 3
    { verse: 3, tgt_book: 'Ezekiel',        tgt_chapter: 22, tgt_verse: 27 },
    { verse: 3, tgt_book: 'Micah',          tgt_chapter: 3,  tgt_verse: 9 },
    { verse: 3, tgt_book: 'Micah',          tgt_chapter: 3,  tgt_verse: 10 },
    { verse: 3, tgt_book: 'Habakkuk',       tgt_chapter: 1,  tgt_verse: 8 },
    // Verse 4
    { verse: 4, tgt_book: 'Jeremiah',       tgt_chapter: 23, tgt_verse: 11 },
    { verse: 4, tgt_book: 'Hosea',          tgt_chapter: 9,  tgt_verse: 7 },
    { verse: 4, tgt_book: 'Ezekiel',        tgt_chapter: 22, tgt_verse: 26 },
    // Verse 5
    { verse: 5, tgt_book: 'Jeremiah',       tgt_chapter: 12, tgt_verse: 1 },
    // Verse 6
    { verse: 6, tgt_book: 'Zechariah',      tgt_chapter: 7,  tgt_verse: 14 },
    { verse: 6, tgt_book: 'Zechariah',      tgt_chapter: 9,  tgt_verse: 8 },
    // Verse 7
    { verse: 7, tgt_book: 'Jeremiah',       tgt_chapter: 36, tgt_verse: 3 },
    { verse: 7, tgt_book: 'Micah',          tgt_chapter: 7,  tgt_verse: 3 },
    // Verse 8
    { verse: 8, tgt_book: 'Habakkuk',       tgt_chapter: 2,  tgt_verse: 3 },
    { verse: 8, tgt_book: 'Isaiah',         tgt_chapter: 8,  tgt_verse: 17 },
    { verse: 8, tgt_book: 'Joel',           tgt_chapter: 3,  tgt_verse: 2 },
    // Verse 9
    { verse: 9, tgt_book: 'Isaiah',         tgt_chapter: 19, tgt_verse: 18 },
    // Verse 10
    { verse: 10, tgt_book: 'Psalms',        tgt_chapter: 68, tgt_verse: 31 },
    { verse: 10, tgt_book: 'Isaiah',        tgt_chapter: 11, tgt_verse: 11 },
    { verse: 10, tgt_book: 'Isaiah',        tgt_chapter: 60, tgt_verse: 4 },
    // Verse 11
    { verse: 11, tgt_book: 'Isaiah',        tgt_chapter: 2,  tgt_verse: 11 },
    { verse: 11, tgt_book: 'Isaiah',        tgt_chapter: 54, tgt_verse: 4 },
    { verse: 11, tgt_book: 'Malachi',       tgt_chapter: 4,  tgt_verse: 1 },
    { verse: 11, tgt_book: 'Jeremiah',      tgt_chapter: 7,  tgt_verse: 4 },
    { verse: 11, tgt_book: 'Matthew',       tgt_chapter: 3,  tgt_verse: 9 },
    // Verse 12
    { verse: 12, tgt_book: 'Isaiah',        tgt_chapter: 14, tgt_verse: 32 },
    { verse: 12, tgt_book: 'Matthew',       tgt_chapter: 5,  tgt_verse: 3 },
    // Verse 13
    { verse: 13, tgt_book: 'Isaiah',        tgt_chapter: 60, tgt_verse: 21 },
    { verse: 13, tgt_book: 'Revelation',    tgt_chapter: 14, tgt_verse: 5 },
    { verse: 13, tgt_book: 'Micah',         tgt_chapter: 5,  tgt_verse: 4 },
    // Verse 14
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 12, tgt_verse: 6 },
    { verse: 14, tgt_book: 'Isaiah',        tgt_chapter: 54, tgt_verse: 1 },
    { verse: 14, tgt_book: 'Zechariah',     tgt_chapter: 2,  tgt_verse: 10 },
    { verse: 14, tgt_book: 'Zechariah',     tgt_chapter: 9,  tgt_verse: 9 },
    // Verse 15
    { verse: 15, tgt_book: 'Matthew',       tgt_chapter: 27, tgt_verse: 42 },
    { verse: 15, tgt_book: 'John',          tgt_chapter: 1,  tgt_verse: 49 },
    { verse: 15, tgt_book: 'Psalms',        tgt_chapter: 46, tgt_verse: 5 },
    { verse: 15, tgt_book: 'Zechariah',     tgt_chapter: 2,  tgt_verse: 10 },
    { verse: 15, tgt_book: 'Revelation',    tgt_chapter: 21, tgt_verse: 3 },
    // Verse 16
    { verse: 16, tgt_book: 'Isaiah',        tgt_chapter: 35, tgt_verse: 3 },
    { verse: 16, tgt_book: 'Hebrews',       tgt_chapter: 12, tgt_verse: 12 },
    // Verse 17
    { verse: 17, tgt_book: 'Isaiah',        tgt_chapter: 63, tgt_verse: 1 },
    { verse: 17, tgt_book: 'Isaiah',        tgt_chapter: 62, tgt_verse: 5 },
    { verse: 17, tgt_book: 'Jeremiah',      tgt_chapter: 32, tgt_verse: 41 },
    // Verse 18
    { verse: 18, tgt_book: 'Lamentations',  tgt_chapter: 1,  tgt_verse: 4 },
    { verse: 18, tgt_book: 'Lamentations',  tgt_chapter: 2,  tgt_verse: 6 },
    // Verse 19
    { verse: 19, tgt_book: 'Isaiah',        tgt_chapter: 60, tgt_verse: 14 },
    { verse: 19, tgt_book: 'Micah',         tgt_chapter: 4,  tgt_verse: 6 },
    { verse: 19, tgt_book: 'Micah',         tgt_chapter: 4,  tgt_verse: 7 },
    { verse: 19, tgt_book: 'Isaiah',        tgt_chapter: 61, tgt_verse: 7 },
    { verse: 19, tgt_book: 'Jeremiah',      tgt_chapter: 13, tgt_verse: 11 },
    { verse: 19, tgt_book: 'Jeremiah',      tgt_chapter: 33, tgt_verse: 9 },
    // Verse 20
    { verse: 20, tgt_book: 'Isaiah',        tgt_chapter: 11, tgt_verse: 12 },
    { verse: 20, tgt_book: 'Jeremiah',      tgt_chapter: 32, tgt_verse: 37 },
    { verse: 20, tgt_book: 'Ezekiel',       tgt_chapter: 11, tgt_verse: 17 },
  ]},

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

let inserted = 0
let skipped  = 0

for (const { src_book, src_chapter, xrefs } of ALL_BOOKS) {
  console.log(`\nUpserting ${src_book} cross-references…`)
  for (const xref of xrefs) {
    const row = {
      src_book,
      src_chapter,
      src_verse:   xref.verse,
      tgt_book:    xref.tgt_book,
      tgt_chapter: xref.tgt_chapter,
      tgt_verse:   xref.tgt_verse ?? null,
      label:       xref.label ?? null,
      updated_at:  new Date().toISOString(),
    }

    const { error } = await supabase
      .from('author_cross_refs')
      .upsert(row, { onConflict: 'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse', ignoreDuplicates: true })

    if (error) {
      console.warn(`  ✗ v${xref.verse} → ${xref.tgt_book} ${xref.tgt_chapter}:${xref.tgt_verse}  [${error.message}]`)
      skipped++
    } else {
      console.log(`  ✓ v${xref.verse} → ${xref.tgt_book} ${xref.tgt_chapter}:${xref.tgt_verse}`)
      inserted++
    }
  }
}

console.log(`\nDone. ${inserted} upserted, ${skipped} failed.`)
