/**
 * process-abab.mjs
 *
 * Converts ABAB.bblx (MySword SQLite Bible format) to the app's JSON format.
 *
 * Input:  C:/Users/Jeff Chavez/OneDrive/Documents/ABAB.bblx
 * Output: public/abab.json
 *
 * JSON format: { book_slug: { chapter: [{ v: N, t: "text" }] } }
 *
 * Usage: node scripts/process-abab.mjs
 */

import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT  = 'C:/Users/Jeff Chavez/OneDrive/Documents/ABAB.bblx'
const OUTPUT = resolve(__dirname, '../public/abab.json')

/* ── MySword book number → app slug (same slugging as KJV reader) ── */
// Slug = bookName.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'')
const BOOK_SLUGS = [
  null,             // 0  (unused — books start at 1)
  'genesis',        // 1
  'exodus',         // 2
  'leviticus',      // 3
  'numbers',        // 4
  'deuteronomy',    // 5
  'joshua',         // 6
  'judges',         // 7
  'ruth',           // 8
  '1samuel',        // 9
  '2samuel',        // 10
  '1kings',         // 11
  '2kings',         // 12
  '1chronicles',    // 13
  '2chronicles',    // 14
  'ezra',           // 15
  'nehemiah',       // 16
  'esther',         // 17
  'job',            // 18
  'psalms',         // 19
  'proverbs',       // 20
  'ecclesiastes',   // 21
  'songofsolomon',  // 22
  'isaiah',         // 23
  'jeremiah',       // 24
  'lamentations',   // 25
  'ezekiel',        // 26
  'daniel',         // 27
  'hosea',          // 28
  'joel',           // 29
  'amos',           // 30
  'obadiah',        // 31
  'jonah',          // 32
  'micah',          // 33
  'nahum',          // 34
  'habakkuk',       // 35
  'zephaniah',      // 36
  'haggai',         // 37
  'zechariah',      // 38
  'malachi',        // 39
  'matthew',        // 40
  'mark',           // 41
  'luke',           // 42
  'john',           // 43
  'acts',           // 44
  'romans',         // 45
  '1corinthians',   // 46
  '2corinthians',   // 47
  'galatians',      // 48
  'ephesians',      // 49
  'philippians',    // 50
  'colossians',     // 51
  '1thessalonians', // 52
  '2thessalonians', // 53
  '1timothy',       // 54
  '2timothy',       // 55
  'titus',          // 56
  'philemon',       // 57
  'hebrews',        // 58
  'james',          // 59
  '1peter',         // 60
  '2peter',         // 61
  '1john',          // 62
  '2john',          // 63
  '3john',          // 64
  'jude',           // 65
  'revelation',     // 66
]

/* ── Main ── */
console.log('Opening', INPUT)
const db = new Database(INPUT, { readonly: true })

const rows = db.prepare(
  'SELECT Book, Chapter, Verse, Scripture FROM Bible ORDER BY Book, Chapter, Verse'
).all()
db.close()

console.log(`Read ${rows.length.toLocaleString()} verses`)

const output = {}
let skipped = 0

for (const row of rows) {
  const slug = BOOK_SLUGS[row.Book]
  if (!slug) { skipped++; continue }

  if (!output[slug]) output[slug] = {}
  const ch = String(row.Chapter)
  if (!output[slug][ch]) output[slug][ch] = []

  output[slug][ch].push({ v: row.Verse, t: row.Scripture.trim() })
}

if (skipped > 0) console.warn(`Skipped ${skipped} rows with unmapped book numbers`)

// Quick stats
const bookCount = Object.keys(output).length
const verseCount = Object.values(output).reduce((sum, bk) =>
  sum + Object.values(bk).reduce((s, ch) => s + ch.length, 0), 0)

console.log(`Books: ${bookCount}  Verses: ${verseCount.toLocaleString()}`)

writeFileSync(OUTPUT, JSON.stringify(output))
console.log('Written to', OUTPUT)
