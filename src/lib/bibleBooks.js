// Complete Bible — every book with chapter counts
// Total: 929 OT + 260 NT = 1,189 chapters

export const BIBLE_BOOKS = [
  // ── Old Testament ──────────────────────────────────────────
  { name:'Genesis',          chapters:50,  testament:'OT' },
  { name:'Exodus',           chapters:40,  testament:'OT' },
  { name:'Leviticus',        chapters:27,  testament:'OT' },
  { name:'Numbers',          chapters:36,  testament:'OT' },
  { name:'Deuteronomy',      chapters:34,  testament:'OT' },
  { name:'Joshua',           chapters:24,  testament:'OT' },
  { name:'Judges',           chapters:21,  testament:'OT' },
  { name:'Ruth',             chapters:4,   testament:'OT' },
  { name:'1 Samuel',         chapters:31,  testament:'OT' },
  { name:'2 Samuel',         chapters:24,  testament:'OT' },
  { name:'1 Kings',          chapters:22,  testament:'OT' },
  { name:'2 Kings',          chapters:25,  testament:'OT' },
  { name:'1 Chronicles',     chapters:29,  testament:'OT' },
  { name:'2 Chronicles',     chapters:36,  testament:'OT' },
  { name:'Ezra',             chapters:10,  testament:'OT' },
  { name:'Nehemiah',         chapters:13,  testament:'OT' },
  { name:'Esther',           chapters:10,  testament:'OT' },
  { name:'Job',              chapters:42,  testament:'OT' },
  { name:'Psalms',           chapters:150, testament:'OT' },
  { name:'Proverbs',         chapters:31,  testament:'OT' },
  { name:'Ecclesiastes',     chapters:12,  testament:'OT' },
  { name:'Song of Solomon',  chapters:8,   testament:'OT' },
  { name:'Isaiah',           chapters:66,  testament:'OT' },
  { name:'Jeremiah',         chapters:52,  testament:'OT' },
  { name:'Lamentations',     chapters:5,   testament:'OT' },
  { name:'Ezekiel',          chapters:48,  testament:'OT' },
  { name:'Daniel',           chapters:12,  testament:'OT' },
  { name:'Hosea',            chapters:14,  testament:'OT' },
  { name:'Joel',             chapters:3,   testament:'OT' },
  { name:'Amos',             chapters:9,   testament:'OT' },
  { name:'Obadiah',          chapters:1,   testament:'OT' },
  { name:'Jonah',            chapters:4,   testament:'OT' },
  { name:'Micah',            chapters:7,   testament:'OT' },
  { name:'Nahum',            chapters:3,   testament:'OT' },
  { name:'Habakkuk',         chapters:3,   testament:'OT' },
  { name:'Zephaniah',        chapters:3,   testament:'OT' },
  { name:'Haggai',           chapters:2,   testament:'OT' },
  { name:'Zechariah',        chapters:14,  testament:'OT' },
  { name:'Malachi',          chapters:4,   testament:'OT' },
  // ── New Testament ──────────────────────────────────────────
  { name:'Matthew',          chapters:28,  testament:'NT' },
  { name:'Mark',             chapters:16,  testament:'NT' },
  { name:'Luke',             chapters:24,  testament:'NT' },
  { name:'John',             chapters:21,  testament:'NT' },
  { name:'Acts',             chapters:28,  testament:'NT' },
  { name:'Romans',           chapters:16,  testament:'NT' },
  { name:'1 Corinthians',    chapters:16,  testament:'NT' },
  { name:'2 Corinthians',    chapters:13,  testament:'NT' },
  { name:'Galatians',        chapters:6,   testament:'NT' },
  { name:'Ephesians',        chapters:6,   testament:'NT' },
  { name:'Philippians',      chapters:4,   testament:'NT' },
  { name:'Colossians',       chapters:4,   testament:'NT' },
  { name:'1 Thessalonians',  chapters:5,   testament:'NT' },
  { name:'2 Thessalonians',  chapters:3,   testament:'NT' },
  { name:'1 Timothy',        chapters:6,   testament:'NT' },
  { name:'2 Timothy',        chapters:4,   testament:'NT' },
  { name:'Titus',            chapters:3,   testament:'NT' },
  { name:'Philemon',         chapters:1,   testament:'NT' },
  { name:'Hebrews',          chapters:13,  testament:'NT' },
  { name:'James',            chapters:5,   testament:'NT' },
  { name:'1 Peter',          chapters:5,   testament:'NT' },
  { name:'2 Peter',          chapters:3,   testament:'NT' },
  { name:'1 John',           chapters:5,   testament:'NT' },
  { name:'2 John',           chapters:1,   testament:'NT' },
  { name:'3 John',           chapters:1,   testament:'NT' },
  { name:'Jude',             chapters:1,   testament:'NT' },
  { name:'Revelation',       chapters:22,  testament:'NT' },
]

export const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((s, b) => s + b.chapters, 0) // 1,189

// Build a Set of all valid "Book Chapter" strings (e.g. "Genesis 1")
export const ALL_CHAPTER_IDS = new Set(
  BIBLE_BOOKS.flatMap(b =>
    Array.from({ length: b.chapters }, (_, i) => `${b.name} ${i + 1}`)
  )
)

// Lookup: "Isaiah" → { name, chapters, testament }
export const BOOK_BY_NAME = Object.fromEntries(BIBLE_BOOKS.map(b => [b.name, b]))

// Standard 3-letter abbreviations for each book
export const BOOK_ABBR = {
  'Genesis':'Gen', 'Exodus':'Exo', 'Leviticus':'Lev', 'Numbers':'Num',
  'Deuteronomy':'Deu', 'Joshua':'Jos', 'Judges':'Jdg', 'Ruth':'Rut',
  '1 Samuel':'1Sa', '2 Samuel':'2Sa', '1 Kings':'1Ki', '2 Kings':'2Ki',
  '1 Chronicles':'1Ch', '2 Chronicles':'2Ch', 'Ezra':'Ezr', 'Nehemiah':'Neh',
  'Esther':'Est', 'Job':'Job', 'Psalms':'Psa', 'Proverbs':'Pro',
  'Ecclesiastes':'Ecc', 'Song of Solomon':'Sos', 'Isaiah':'Isa', 'Jeremiah':'Jer',
  'Lamentations':'Lam', 'Ezekiel':'Eze', 'Daniel':'Dan', 'Hosea':'Hos',
  'Joel':'Joe', 'Amos':'Amo', 'Obadiah':'Oba', 'Jonah':'Jon', 'Micah':'Mic',
  'Nahum':'Nah', 'Habakkuk':'Hab', 'Zephaniah':'Zep', 'Haggai':'Hag',
  'Zechariah':'Zec', 'Malachi':'Mal',
  'Matthew':'Mat', 'Mark':'Mrk', 'Luke':'Luk', 'John':'Joh', 'Acts':'Act',
  'Romans':'Rom', '1 Corinthians':'1Co', '2 Corinthians':'2Co', 'Galatians':'Gal',
  'Ephesians':'Eph', 'Philippians':'Php', 'Colossians':'Col',
  '1 Thessalonians':'1Th', '2 Thessalonians':'2Th',
  '1 Timothy':'1Ti', '2 Timothy':'2Ti', 'Titus':'Tit', 'Philemon':'Phm',
  'Hebrews':'Heb', 'James':'Jas', '1 Peter':'1Pe', '2 Peter':'2Pe',
  '1 John':'1Jo', '2 John':'2Jo', '3 John':'3Jo', 'Jude':'Jud', 'Revelation':'Rev',
}
