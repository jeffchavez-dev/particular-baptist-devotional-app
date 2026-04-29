/**
 * Scripture reference parser for 2LBCF, Catechism, and 1LBCF proof texts.
 *
 * Handles two formats:
 *   - lbcf2 / catechism: "2Ti 3:15-17; Isa 8:20; Rom 1:19-21; 2:14-15"
 *   - lbcf1:            "Isa. 46:9 & John 10:30; 1Cor. 2:11b & Matt. 11:27"
 */

export const BOOK_MAP = {
  // Genesis–Malachi
  'Gen':  { name:'Genesis',         short:'Gen',  order:1  },
  'Exo':  { name:'Exodus',          short:'Exod', order:2  },
  'Exod': { name:'Exodus',          short:'Exod', order:2  },
  'Ex':   { name:'Exodus',          short:'Exod', order:2  },
  'Lev':  { name:'Leviticus',       short:'Lev',  order:3  },
  'Num':  { name:'Numbers',         short:'Num',  order:4  },
  'Deu':  { name:'Deuteronomy',     short:'Deut', order:5  },
  'Deut': { name:'Deuteronomy',     short:'Deut', order:5  },
  'Dt':   { name:'Deuteronomy',     short:'Deut', order:5  },
  'Jos':  { name:'Joshua',          short:'Josh', order:6  },
  'Josh': { name:'Joshua',          short:'Josh', order:6  },
  'Jdg':  { name:'Judges',          short:'Judg', order:7  },
  'Judg': { name:'Judges',          short:'Judg', order:7  },
  'Rut':  { name:'Ruth',            short:'Ruth', order:8  },
  'Ruth': { name:'Ruth',            short:'Ruth', order:8  },
  '1Sa':  { name:'1 Samuel',        short:'1 Sam',order:9  },
  '1Sam': { name:'1 Samuel',        short:'1 Sam',order:9  },
  '2Sa':  { name:'2 Samuel',        short:'2 Sam',order:10 },
  '2Sam': { name:'2 Samuel',        short:'2 Sam',order:10 },
  '1Ki':  { name:'1 Kings',         short:'1 Kgs',order:11 },
  '1Kgs': { name:'1 Kings',         short:'1 Kgs',order:11 },
  '1Kin': { name:'1 Kings',         short:'1 Kgs',order:11 },
  '2Ki':  { name:'2 Kings',         short:'2 Kgs',order:12 },
  '2Kgs': { name:'2 Kings',         short:'2 Kgs',order:12 },
  '1Ch':  { name:'1 Chronicles',    short:'1 Chr',order:13 },
  '1Chr': { name:'1 Chronicles',    short:'1 Chr',order:13 },
  '2Ch':  { name:'2 Chronicles',    short:'2 Chr',order:14 },
  '2Chr': { name:'2 Chronicles',    short:'2 Chr',order:14 },
  'Ezr':  { name:'Ezra',            short:'Ezra', order:15 },
  'Ezra': { name:'Ezra',            short:'Ezra', order:15 },
  'Neh':  { name:'Nehemiah',        short:'Neh',  order:16 },
  'Est':  { name:'Esther',          short:'Esth', order:17 },
  'Esth': { name:'Esther',          short:'Esth', order:17 },
  'Job':  { name:'Job',             short:'Job',  order:18 },
  'Psa':  { name:'Psalms',          short:'Ps',   order:19 },
  'Ps':   { name:'Psalms',          short:'Ps',   order:19 },
  'Pro':  { name:'Proverbs',        short:'Prov', order:20 },
  'Prov': { name:'Proverbs',        short:'Prov', order:20 },
  'Ecc':  { name:'Ecclesiastes',    short:'Eccl', order:21 },
  'Eccl': { name:'Ecclesiastes',    short:'Eccl', order:21 },
  'Son':  { name:'Song of Solomon', short:'Song', order:22 },
  'Song': { name:'Song of Solomon', short:'Song', order:22 },
  'Cant': { name:'Song of Solomon', short:'Song', order:22 },
  'Isa':  { name:'Isaiah',          short:'Isa',  order:23 },
  'Jer':  { name:'Jeremiah',        short:'Jer',  order:24 },
  'Lam':  { name:'Lamentations',    short:'Lam',  order:25 },
  'Eze':  { name:'Ezekiel',         short:'Ezek', order:26 },
  'Ezek': { name:'Ezekiel',         short:'Ezek', order:26 },
  'Dan':  { name:'Daniel',          short:'Dan',  order:27 },
  'Hos':  { name:'Hosea',           short:'Hos',  order:28 },
  'Joe':  { name:'Joel',            short:'Joel', order:29 },
  'Joel': { name:'Joel',            short:'Joel', order:29 },
  'Amo':  { name:'Amos',            short:'Amos', order:30 },
  'Amos': { name:'Amos',            short:'Amos', order:30 },
  'Oba':  { name:'Obadiah',         short:'Obad', order:31 },
  'Obad': { name:'Obadiah',         short:'Obad', order:31 },
  'Jon':  { name:'Jonah',           short:'Jonah',order:32 },
  'Jonah':{ name:'Jonah',           short:'Jonah',order:32 },
  'Mic':  { name:'Micah',           short:'Mic',  order:33 },
  'Nah':  { name:'Nahum',           short:'Nah',  order:34 },
  'Hab':  { name:'Habakkuk',        short:'Hab',  order:35 },
  'Zep':  { name:'Zephaniah',       short:'Zeph', order:36 },
  'Zeph': { name:'Zephaniah',       short:'Zeph', order:36 },
  'Hag':  { name:'Haggai',          short:'Hag',  order:37 },
  'Zec':  { name:'Zechariah',       short:'Zech', order:38 },
  'Zech': { name:'Zechariah',       short:'Zech', order:38 },
  'Mal':  { name:'Malachi',         short:'Mal',  order:39 },
  // NT
  'Mat':  { name:'Matthew',         short:'Matt', order:40 },
  'Matt': { name:'Matthew',         short:'Matt', order:40 },
  'Mar':  { name:'Mark',            short:'Mark', order:41 },
  'Mark': { name:'Mark',            short:'Mark', order:41 },
  'Mrk':  { name:'Mark',            short:'Mark', order:41 },
  'Luk':  { name:'Luke',            short:'Luke', order:42 },
  'Luke': { name:'Luke',            short:'Luke', order:42 },
  'Joh':  { name:'John',            short:'John', order:43 },
  'John': { name:'John',            short:'John', order:43 },
  'Act':  { name:'Acts',            short:'Acts', order:44 },
  'Acts': { name:'Acts',            short:'Acts', order:44 },
  'Rom':  { name:'Romans',          short:'Rom',  order:45 },
  '1Co':  { name:'1 Corinthians',   short:'1 Cor',order:46 },
  '1Cor': { name:'1 Corinthians',   short:'1 Cor',order:46 },
  '2Co':  { name:'2 Corinthians',   short:'2 Cor',order:47 },
  '2Cor': { name:'2 Corinthians',   short:'2 Cor',order:47 },
  'Gal':  { name:'Galatians',       short:'Gal',  order:48 },
  'Eph':  { name:'Ephesians',       short:'Eph',  order:49 },
  'Phi':  { name:'Philippians',     short:'Phil', order:50 },
  'Phil': { name:'Philippians',     short:'Phil', order:50 },
  'Col':  { name:'Colossians',      short:'Col',  order:51 },
  '1Th':  { name:'1 Thessalonians', short:'1 Thes',order:52 },
  '1The': { name:'1 Thessalonians', short:'1 Thes',order:52 },
  '1Thes':{ name:'1 Thessalonians', short:'1 Thes',order:52 },
  '2Th':  { name:'2 Thessalonians', short:'2 Thes',order:53 },
  '2The': { name:'2 Thessalonians', short:'2 Thes',order:53 },
  '1Ti':  { name:'1 Timothy',       short:'1 Tim',order:54 },
  '1Tim': { name:'1 Timothy',       short:'1 Tim',order:54 },
  '2Ti':  { name:'2 Timothy',       short:'2 Tim',order:55 },
  '2Tim': { name:'2 Timothy',       short:'2 Tim',order:55 },
  'Tit':  { name:'Titus',           short:'Titus',order:56 },
  'Titus':{ name:'Titus',           short:'Titus',order:56 },
  'Phm':  { name:'Philemon',        short:'Phlm', order:57 },
  'Phlm': { name:'Philemon',        short:'Phlm', order:57 },
  'Heb':  { name:'Hebrews',         short:'Heb',  order:58 },
  'Jam':  { name:'James',           short:'Jas',  order:59 },
  'Jas':  { name:'James',           short:'Jas',  order:59 },
  'James':{ name:'James',           short:'Jas',  order:59 },
  '1Pe':  { name:'1 Peter',         short:'1 Pet',order:60 },
  '1Pet': { name:'1 Peter',         short:'1 Pet',order:60 },
  '2Pe':  { name:'2 Peter',         short:'2 Pet',order:61 },
  '2Pet': { name:'2 Peter',         short:'2 Pet',order:61 },
  '1Jo':  { name:'1 John',          short:'1 John',order:62 },
  '1Joh': { name:'1 John',          short:'1 John',order:62 },
  '1John':{ name:'1 John',          short:'1 John',order:62 },
  '2Jo':  { name:'2 John',          short:'2 John',order:63 },
  '2Joh': { name:'2 John',          short:'2 John',order:63 },
  '3Jo':  { name:'3 John',          short:'3 John',order:64 },
  '3Joh': { name:'3 John',          short:'3 John',order:64 },
  'Jud':  { name:'Jude',            short:'Jude', order:65 },
  'Jude': { name:'Jude',            short:'Jude', order:65 },
  'Rev':  { name:'Revelation',      short:'Rev',  order:66 },
}

/** Normalise a raw book token (strip periods, trailing lowercase a/b) */
function normaliseBook(raw) {
  return raw.replace(/\./g, '').replace(/[ab]$/, '').trim()
}

/**
 * Slug → BOOK_MAP entry, built from full canonical names.
 * Handles "1 Corinthians" → slug "1corinthians" → bookInfo.
 */
const FULL_SLUG_MAP = (() => {
  const m = {}
  Object.values(BOOK_MAP).forEach(info => {
    const slug = info.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    if (!m[slug]) m[slug] = info
  })
  return m
})()

/** Resolve a raw book token to its BOOK_MAP entry, or null */
function resolveBook(raw) {
  const key = normaliseBook(raw)
  // Direct abbreviation lookup (fast path for normal refs like "1Cor", "Rom")
  if (BOOK_MAP[key]) return BOOK_MAP[key]
  // Full-name slug lookup (handles "1 Corinthians", "Romans", "Psalms" etc.)
  const slug = key.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  return FULL_SLUG_MAP[slug] || null
}

/**
 * Parse a refs string into an array of citation objects:
 *   { bookInfo, chapter, verseStart, verseEnd, refStr }
 *
 * Handles:
 *   - Leading footnote letters: "eIsa 8:20" → "Isa 8:20"
 *   - Continued book: "Rom 1:19-21; 2:14-15" (2:14-15 is still Romans)
 *   - Comma verses: "Mat 22:29,31-32" → two refs
 *   - Ampersand separator (1LBCF): "Gen 1:1 & 31"
 *   - Trailing letter suffixes: "1Cor 2:11b" → verse 11
 */
export function parseRefs(refsStr) {
  if (!refsStr || !refsStr.trim()) return []

  // Split on semicolons and ampersands; each is a primary segment
  const segments = refsStr.split(/[;&]/).map(s => s.trim()).filter(Boolean)

  const results = []
  let curBook    = null   // normalised book key
  let curBookInfo = null  // from BOOK_MAP
  let curChapter  = null

  for (const seg of segments) {
    // Strip leading single-lowercase-letter footnote marker (e.g. "e" in "eIsa")
    const cleaned = seg.replace(/^[a-z](?=[A-Z0-9])/, '').trim()

    // Pattern A: "BookToken Chapter:VerseSpec[,VerseSpec...]"
    //   BookToken = optional digit prefix (possibly space-separated) + letters + optional period
    //   Handles "1Cor 15:45" AND "1 Corinthians 6:19" (Orthodox-style full names)
    const bookChapterRx = /^((?:[1-3]\s*)?[A-Za-z][a-zA-Z]*\.?)\s+(\d+):([^\s]+(?:,\s*[^\s]+)*)/

    const mBC = cleaned.match(bookChapterRx)
    if (mBC) {
      const bookRaw   = mBC[1]
      const bookInfo  = resolveBook(bookRaw)
      const chapter   = parseInt(mBC[2])
      const verseSpec = mBC[3]

      curBook     = bookRaw
      curBookInfo = bookInfo
      curChapter  = chapter

      // Parse verse specs: "15-17,20" → [{15,17},{20,20}]
      parseVerseSpec(verseSpec).forEach(({ vs, ve }) => {
        if (bookInfo) results.push({ bookInfo, chapter, verseStart: vs, verseEnd: ve, refStr: `${bookInfo.short} ${chapter}:${vs}${ve !== vs ? '–'+ve : ''}` })
      })
      continue
    }

    // Pattern B: "Chapter:VerseSpec" — continues from previous book
    const chapterVerseRx = /^(\d+):([^\s]+(?:,\s*[^\s]+)*)/
    const mCV = cleaned.match(chapterVerseRx)
    if (mCV && curBookInfo) {
      const chapter   = parseInt(mCV[1])
      const verseSpec = mCV[2]
      curChapter      = chapter
      parseVerseSpec(verseSpec).forEach(({ vs, ve }) => {
        results.push({ bookInfo: curBookInfo, chapter, verseStart: vs, verseEnd: ve, refStr: `${curBookInfo.short} ${chapter}:${vs}${ve !== vs ? '–'+ve : ''}` })
      })
      continue
    }

    // Pattern C: bare verse spec "31-32" or "31,32" — continues from previous book+chapter
    if (curBookInfo && curChapter !== null) {
      parseVerseSpec(cleaned).forEach(({ vs, ve }) => {
        if (vs) results.push({ bookInfo: curBookInfo, chapter: curChapter, verseStart: vs, verseEnd: ve, refStr: `${curBookInfo.short} ${curChapter}:${vs}${ve !== vs ? '–'+ve : ''}` })
      })
    }
  }

  return results
}

/** Parse a verse-spec string like "15-17,20,25-28" into [{vs,ve}] */
function parseVerseSpec(spec) {
  return spec.split(',').map(s => s.trim()).flatMap(part => {
    const m = part.match(/^(\d+[a-z]?)(?:-(\d+[a-z]?))?$/)
    if (!m) return []
    const vs = parseInt(m[1])
    const ve = m[2] ? parseInt(m[2]) : vs
    if (isNaN(vs)) return []
    return [{ vs, ve }]
  })
}

/**
 * Build a complete Scripture index from all three data sources + the schedule.
 *
 * Returns an array of index entries, sorted canonically:
 *   { key, bookInfo, chapter, verseStart, verseEnd, refStr, citations: [{label, day, src}] }
 *
 * Duplicate passage keys are merged so one row can list multiple citations.
 */
export function buildScriptureIndex(LBCF2, CATECHISM, LBCF1, SCHEDULE, ORTHODOX_CATECHISM = null) {
  // Map: passageKey → { bookInfo, chapter, verseStart, verseEnd, refStr, citations[] }
  const map = new Map()

  function addRefs(refsStr, label, day, src, refKey = null) {
    const parsed = parseRefs(refsStr)
    parsed.forEach(ref => {
      const key = `${ref.bookInfo.order}|${ref.chapter}|${ref.verseStart}`
      if (!map.has(key)) {
        map.set(key, { ...ref, citations: [] })
      }
      // Avoid duplicate citations for the same label+day
      const entry = map.get(key)
      if (!entry.citations.find(c => c.label === label && c.day === day)) {
        entry.citations.push({ label, day, src, refKey })
      }
    })
  }

  SCHEDULE.forEach(r => {
    if (r.src === '2LBCF') {
      const m = r.reading.match(/Ch\.\s*(\d+)\s*§(\d+)/)
      if (!m) return
      const key = `${m[1]}.${m[2]}`
      const item = LBCF2[key]
      if (!item || !item.refs) return
      addRefs(item.refs, `2LBCF ${m[1]}.${m[2]}`, r.day, '2LBCF')
    }
    if (r.src === 'Catechism') {
      const m = r.reading.match(/Q&A\s*#(\d+)/)
      if (!m) return
      const item = CATECHISM[parseInt(m[1])]
      if (!item || !item.refs) return
      addRefs(item.refs, `Catechism Q.${m[1]}`, r.day, 'Catechism')
    }
    if (r.src === '1LBCF') {
      const m = r.reading.match(/Article\s*(\d+)/)
      if (!m) return
      const item = LBCF1[parseInt(m[1])]
      if (!item || !item.refs) return
      addRefs(item.refs, `1LBCF Art. ${m[1]}`, r.day, '1LBCF')
    }
  })

  // ── Orthodox Catechism (all entries — not schedule-linked) ──
  if (ORTHODOX_CATECHISM) {
    Object.entries(ORTHODOX_CATECHISM).forEach(([num, item]) => {
      if (!item.refs) return
      addRefs(item.refs, `Orthodox Q.${num}`, null, 'Orthodox', num)
    })
  }

  // Sort canonically: book order → chapter → verse
  return Array.from(map.values()).sort((a, b) => {
    if (a.bookInfo.order !== b.bookInfo.order) return a.bookInfo.order - b.bookInfo.order
    if (a.chapter !== b.chapter) return a.chapter - b.chapter
    return a.verseStart - b.verseStart
  })
}
