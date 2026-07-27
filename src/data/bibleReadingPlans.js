/**
 * Bible Reading Plan Presets
 * Add new plans here — no other code changes needed.
 * Each preset with chapterOrder: null uses canonical book order from BIBLE_BOOKS.
 * Presets with chapterOrder: [...] override with a custom sequence.
 */

/** Generate an inclusive range of chapter strings, e.g. chs('Genesis', 1, 11) */
function chs(book, from, to) {
  const r = []
  for (let i = from; i <= to; i++) r.push(`${book} ${i}`)
  return r
}

export const READING_PLANS = [
  {
    id: 'whole-canonical',
    label: 'Whole Bible',
    description: 'All 1,189 chapters in canonical order (Genesis → Revelation)',
    scope: 'whole',
    chapterOrder: null, // computed from BIBLE_BOOKS
  },
  {
    id: 'ot-only',
    label: 'Old Testament',
    description: 'All 929 OT chapters in canonical order',
    scope: 'ot',
    chapterOrder: null,
  },
  {
    id: 'nt-only',
    label: 'New Testament',
    description: 'All 260 NT chapters in canonical order',
    scope: 'nt',
    chapterOrder: null,
  },
  {
    id: 'chronological',
    label: 'Chronological',
    description: 'All 1,189 chapters in the order events occurred historically',
    scope: 'whole',
    chapterOrder: [
      // ── Primeval history ──────────────────────────────────────
      ...chs('Genesis', 1, 11),
      // ── Patriarchal period (Job likely set here) ──────────────
      ...chs('Job', 1, 42),
      ...chs('Genesis', 12, 50),
      // ── The Exodus and Wilderness ─────────────────────────────
      ...chs('Exodus', 1, 40),
      ...chs('Leviticus', 1, 27),
      ...chs('Numbers', 1, 36),
      ...chs('Deuteronomy', 1, 34),
      // ── Conquest and Judges ───────────────────────────────────
      ...chs('Joshua', 1, 24),
      ...chs('Judges', 1, 21),
      ...chs('Ruth', 1, 4),
      // ── United Kingdom ────────────────────────────────────────
      ...chs('1 Samuel', 1, 31),
      ...chs('Psalms', 1, 41),       // Book I — mostly Davidic
      ...chs('2 Samuel', 1, 24),
      ...chs('1 Chronicles', 1, 29), // David's history/preparations
      ...chs('Psalms', 42, 72),      // Book II
      ...chs('1 Kings', 1, 11),      // Solomon's reign
      ...chs('Psalms', 73, 89),      // Book III
      ...chs('Proverbs', 1, 31),
      ...chs('Ecclesiastes', 1, 12),
      ...chs('Song of Solomon', 1, 8),
      // ── Divided Kingdom ───────────────────────────────────────
      ...chs('1 Kings', 12, 22),
      ...chs('2 Kings', 1, 25),
      ...chs('2 Chronicles', 1, 36),
      // ── Pre-Exilic Prophets ───────────────────────────────────
      ...chs('Obadiah', 1, 1),
      ...chs('Joel', 1, 3),
      ...chs('Jonah', 1, 4),
      ...chs('Amos', 1, 9),
      ...chs('Hosea', 1, 14),
      ...chs('Micah', 1, 7),
      ...chs('Isaiah', 1, 39),
      ...chs('Nahum', 1, 3),
      ...chs('Zephaniah', 1, 3),
      ...chs('Habakkuk', 1, 3),
      // ── Exile ─────────────────────────────────────────────────
      ...chs('Jeremiah', 1, 52),
      ...chs('Lamentations', 1, 5),
      ...chs('Ezekiel', 1, 48),
      ...chs('Daniel', 1, 12),
      // ── Return from Exile ─────────────────────────────────────
      ...chs('Isaiah', 40, 66),
      ...chs('Psalms', 90, 150),     // Books IV–V
      ...chs('Ezra', 1, 10),
      ...chs('Haggai', 1, 2),
      ...chs('Zechariah', 1, 14),
      ...chs('Esther', 1, 10),
      ...chs('Nehemiah', 1, 13),
      ...chs('Malachi', 1, 4),
      // ── Gospels ───────────────────────────────────────────────
      ...chs('Matthew', 1, 28),
      ...chs('Mark', 1, 16),
      ...chs('Luke', 1, 24),
      ...chs('John', 1, 21),
      // ── Early Church & Epistles (approximate writing order) ───
      ...chs('Acts', 1, 28),
      ...chs('James', 1, 5),
      ...chs('Galatians', 1, 6),
      ...chs('1 Thessalonians', 1, 5),
      ...chs('2 Thessalonians', 1, 3),
      ...chs('1 Corinthians', 1, 16),
      ...chs('2 Corinthians', 1, 13),
      ...chs('Romans', 1, 16),
      ...chs('Colossians', 1, 4),
      ...chs('Philemon', 1, 1),
      ...chs('Ephesians', 1, 6),
      ...chs('Philippians', 1, 4),
      ...chs('1 Timothy', 1, 6),
      ...chs('Titus', 1, 3),
      ...chs('2 Timothy', 1, 4),
      ...chs('1 Peter', 1, 5),
      ...chs('2 Peter', 1, 3),
      ...chs('Hebrews', 1, 13),
      ...chs('1 John', 1, 5),
      ...chs('2 John', 1, 1),
      ...chs('3 John', 1, 1),
      ...chs('Jude', 1, 1),
      ...chs('Revelation', 1, 22),
    ],
  },
  {
    id: 'psalms',
    label: 'Psalms',
    description: 'All 150 Psalms — the prayer book and hymnbook of Scripture',
    scope: 'custom-order',
    chapterOrder: chs('Psalms', 1, 150),
  },
  {
    id: 'gospels',
    label: 'Gospels',
    description: 'Matthew, Mark, Luke, and John — the life, death, and resurrection of Christ',
    scope: 'custom-order',
    chapterOrder: [
      ...chs('Matthew', 1, 28),
      ...chs('Mark', 1, 16),
      ...chs('Luke', 1, 24),
      ...chs('John', 1, 21),
    ],
  },
  {
    id: 'custom',
    label: 'Custom Range',
    description: 'Pick any start and end point in the Bible',
    scope: 'custom',
    chapterOrder: null,
  },
]

export const PLAN_BY_ID = Object.fromEntries(READING_PLANS.map(p => [p.id, p]))
