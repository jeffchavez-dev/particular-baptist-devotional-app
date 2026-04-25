/**
 * Scripture reference parser for LBCF/Catechism proof texts.
 *
 * Input:  raw refs string, e.g. "aGen 1:1; bPs 33:6; c1 Cor 15:45"
 * Output: array of { book (full name), chapter (int), verse (int|null), display (string) }
 *
 * The LBCF source data uses lowercase letters as footnote markers immediately
 * before each reference (a, b, c…). cleanRefs() strips those first.
 */

/* ── Full book name lookup — abbreviation → canonical name ── */
const ABBREV = {
  // Genesis
  gen:'Genesis', ge:'Genesis', gn:'Genesis',
  // Exodus
  ex:'Exodus', exo:'Exodus', exod:'Exodus',
  // Leviticus
  lev:'Leviticus', le:'Leviticus', lv:'Leviticus',
  // Numbers
  num:'Numbers', nu:'Numbers', nm:'Numbers', nb:'Numbers',
  // Deuteronomy
  deu:'Deuteronomy', deut:'Deuteronomy', dt:'Deuteronomy', de:'Deuteronomy',
  // Joshua
  jos:'Joshua', josh:'Joshua',
  // Judges
  jdg:'Judges', judg:'Judges',
  // Ruth
  rut:'Ruth', rth:'Ruth',
  // 1–2 Samuel
  '1sa':'1 Samuel', '1sam':'1 Samuel',
  '2sa':'2 Samuel', '2sam':'2 Samuel',
  // 1–2 Kings
  '1ki':'1 Kings', '1kgs':'1 Kings', '1kings':'1 Kings',
  '2ki':'2 Kings', '2kgs':'2 Kings', '2kings':'2 Kings',
  // 1–2 Chronicles
  '1ch':'1 Chronicles', '1chr':'1 Chronicles', '1chron':'1 Chronicles',
  '2ch':'2 Chronicles', '2chr':'2 Chronicles', '2chron':'2 Chronicles',
  // Ezra / Nehemiah / Esther
  ezr:'Ezra', ezra:'Ezra',
  neh:'Nehemiah', ne:'Nehemiah',
  est:'Esther', esth:'Esther',
  // Job
  job:'Job',
  // Psalms
  ps:'Psalms', psa:'Psalms', pss:'Psalms', psalm:'Psalms', psalms:'Psalms',
  // Proverbs
  pr:'Proverbs', pro:'Proverbs', prov:'Proverbs', prv:'Proverbs',
  // Ecclesiastes
  ec:'Ecclesiastes', ecc:'Ecclesiastes', eccl:'Ecclesiastes', qoh:'Ecclesiastes',
  // Song of Solomon
  ss:'Song of Solomon', sos:'Song of Solomon', song:'Song of Solomon',
  sol:'Song of Solomon', sg:'Song of Solomon', cant:'Song of Solomon',
  // Isaiah
  isa:'Isaiah', is:'Isaiah',
  // Jeremiah
  jer:'Jeremiah', je:'Jeremiah',
  // Lamentations
  lam:'Lamentations', la:'Lamentations',
  // Ezekiel
  eze:'Ezekiel', ezek:'Ezekiel',
  // Daniel
  dan:'Daniel', da:'Daniel', dn:'Daniel',
  // Minor OT prophets
  hos:'Hosea', ho:'Hosea',
  joe:'Joel', jl:'Joel',
  amo:'Amos', am:'Amos',
  oba:'Obadiah', ob:'Obadiah', obad:'Obadiah',
  jon:'Jonah', jnh:'Jonah',
  mic:'Micah', mi:'Micah',
  nah:'Nahum', na:'Nahum',
  hab:'Habakkuk', hb:'Habakkuk',
  zep:'Zephaniah', zeph:'Zephaniah',
  hag:'Haggai', hg:'Haggai',
  zec:'Zechariah', zech:'Zechariah',
  mal:'Malachi', ml:'Malachi',
  // NT Gospels
  mat:'Matthew', matt:'Matthew', mt:'Matthew',
  mar:'Mark', mark:'Mark', mrk:'Mark', mk:'Mark',
  luk:'Luke', lk:'Luke',
  joh:'John', jn:'John',
  // Acts
  act:'Acts', acts:'Acts', ac:'Acts',
  // Paul
  rom:'Romans', ro:'Romans', rm:'Romans',
  '1co':'1 Corinthians', '1cor':'1 Corinthians',
  '2co':'2 Corinthians', '2cor':'2 Corinthians',
  gal:'Galatians', ga:'Galatians',
  eph:'Ephesians',
  php:'Philippians', phil:'Philippians', phl:'Philippians',
  col:'Colossians',
  '1th':'1 Thessalonians', '1thes':'1 Thessalonians', '1thess':'1 Thessalonians',
  '2th':'2 Thessalonians', '2thes':'2 Thessalonians', '2thess':'2 Thessalonians',
  '1ti':'1 Timothy', '1tim':'1 Timothy',
  '2ti':'2 Timothy', '2tim':'2 Timothy',
  tit:'Titus',
  phm:'Philemon', phlm:'Philemon', philem:'Philemon',
  // General epistles
  heb:'Hebrews', he:'Hebrews',
  jas:'James', jm:'James', jam:'James',
  '1pe':'1 Peter', '1pet':'1 Peter', '1pt':'1 Peter',
  '2pe':'2 Peter', '2pet':'2 Peter', '2pt':'2 Peter',
  '1jo':'1 John', '1joh':'1 John', '1jn':'1 John',
  '2jo':'2 John', '2joh':'2 John', '2jn':'2 John',
  '3jo':'3 John', '3joh':'3 John', '3jn':'3 John',
  jude:'Jude',
  rev:'Revelation', re:'Revelation', rvl:'Revelation', apoc:'Revelation',
}

/**
 * Full canonical book names → canonical form.
 * Handles LBCF1 which writes "John", "James", "Matthew", "1John" etc.
 */
const FULL_NAMES = Object.fromEntries([
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Psalm','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
  'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
].map(n => [n.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,''), n]))

/**
 * Strips footnote marker letters (a, b, c…) that appear at the start of
 * each individual reference in LBCF data, e.g. "aGen 1:1" → "Gen 1:1".
 * Also strips trailing periods used by LBCF1 abbreviations: "Isa. 46" → "Isa 46".
 */
function cleanRefs(refs) {
  return refs
    .replace(/\b[a-z](?=[A-Z1-9])/g, '')      // strip footnote markers
    .replace(/([A-Za-z])\.(\s|;|,|$)/g, '$1$2') // "Isa. " → "Isa "
    .replace(/([A-Za-z])\.$/, '$1')             // trailing period at end
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve a book token (possibly with a leading number, e.g. "1Cor" or "1 Cor")
 * to a canonical full name. Returns null if not recognised.
 */
function resolveBook(numStr, abbr) {
  const key = numStr ? `${numStr}${abbr}` : abbr
  const lower = key.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'')
  const abbrLower = abbr.toLowerCase()
  return (
    ABBREV[lower] ??
    FULL_NAMES[lower] ??
    ABBREV[abbrLower] ??
    FULL_NAMES[abbrLower] ??
    null
  )
}

/**
 * Parse a refs string into an array of { book, chapter, verse, display }.
 *
 * - `verse` is the specific verse number (int) or null for chapter-only refs.
 * - Comma-separated additional verses within the same chapter are each emitted
 *   as separate entries, e.g. "Gen 1:1,3" → two entries with verse 1 and 3.
 * - Deduplicates by book+chapter+verse.
 */
export function parseRefs(refsStr) {
  if (!refsStr) return []
  const cleaned = cleanRefs(refsStr)
  const seen = new Set()
  const results = []

  // Split on semicolons — each part is one reference group
  const parts = cleaned.split(/[;]/).map(s => s.trim()).filter(Boolean)

  for (const part of parts) {
    // Match: optional leading digit (1/2/3), book letters, chapter, optional verse
    // Accepts "Gen 1:1", "1Cor 15:45", "Ps23:1", "Matt 5:3-12", "Gen 1" (chapter-only)
    const m = part.match(/^(\d\s*)?([A-Za-z]+)\.?\s*(\d+)(?:[:.]\s*(\d+))?/)
    if (!m) continue

    const numPart = m[1] ? m[1].replace(/\s+/g, '') : ''
    const bookPart = m[2]
    const chapter  = parseInt(m[3])
    const primaryVerse = m[4] ? parseInt(m[4]) : null

    const book = resolveBook(numPart, bookPart)
    if (!book || !chapter) continue

    function addRef(verse, display) {
      const key = `${book}|${chapter}|${verse ?? 0}`
      if (seen.has(key)) return
      seen.add(key)
      results.push({ book, chapter, verse: verse ?? null, display })
    }

    addRef(primaryVerse, part.trim())

    // Handle comma-separated additional verses in the same chapter:
    // e.g. "Gen 1:1,3,5" — after the main match, scan for ",<number>"
    if (primaryVerse !== null) {
      const afterMatch = part.slice(m[0].length)
      let commaMatch
      const commaRe = /,\s*(\d+)/g
      while ((commaMatch = commaRe.exec(afterMatch)) !== null) {
        const v = parseInt(commaMatch[1])
        if (v) addRef(v, `${book} ${chapter}:${v}`)
      }
    }
  }

  return results
}
