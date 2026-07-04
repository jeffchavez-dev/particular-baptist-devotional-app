/**
 * Commentary registry — offline-first via Cache API.
 * Add new commentaries by extending COMMENTARIES below.
 */

const CACHE_NAME    = 'pb-commentary-v1'
const MHC_BASE      = 'https://raw.githubusercontent.com/Razzula/public-domain-bible-resources/main/dist/MHC'
const GILL_BASE     = 'https://bible.helloao.org/api/c/john-gill'
// BibleHub blocks CORS — route through our own Vercel serverless proxy
const CALVIN_PROXY  = '/api/commentary'

// Books Calvin wrote on and their BibleHub URL slugs
const CALVIN_BOOKS = {
  'Genesis':         'genesis',
  'Joshua':          'joshua',
  'Psalms':          'psalms',
  'Isaiah':          'isaiah',
  'Jeremiah':        'jeremiah',
  'Lamentations':    'lamentations',
  'Ezekiel':         'ezekiel',
  'Daniel':          'daniel',
  'Hosea':           'hosea',
  'Joel':            'joel',
  'Amos':            'amos',
  'Obadiah':         'obadiah',
  'Jonah':           'jonah',
  'Micah':           'micah',
  'Nahum':           'nahum',
  'Habakkuk':        'habakkuk',
  'Zephaniah':       'zephaniah',
  'Haggai':          'haggai',
  'Zechariah':       'zechariah',
  'Malachi':         'malachi',
  'Matthew':         'matthew',
  'Mark':            'mark',
  'Luke':            'luke',
  'John':            'john',
  'Acts':            'acts',
  'Romans':          'romans',
  '1 Corinthians':   '1_corinthians',
  '2 Corinthians':   '2_corinthians',
  'Galatians':       'galatians',
  'Ephesians':       'ephesians',
  'Philippians':     'philippians',
  'Colossians':      'colossians',
  '1 Thessalonians': '1_thessalonians',
  '2 Thessalonians': '2_thessalonians',
  '1 Timothy':       '1_timothy',
  '2 Timothy':       '2_timothy',
  'Titus':           'titus',
  'Philemon':        'philemon',
  'Hebrews':         'hebrews',
  'James':           'james',
  '1 Peter':         '1_peter',
  '2 Peter':         '2_peter',
  '1 John':          '1_john',
  'Jude':            'jude',
}

// ── Book → MHC path mapping ──────────────────────────────────────────────────
const MHC_BOOKS = {
  'Genesis':          { vol: 1, folder: '01.GEN', code: 'GEN' },
  'Exodus':           { vol: 1, folder: '02.EXO', code: 'EXO' },
  'Leviticus':        { vol: 1, folder: '03.LEV', code: 'LEV' },
  'Numbers':          { vol: 1, folder: '04.NUM', code: 'NUM' },
  'Deuteronomy':      { vol: 1, folder: '05.DEU', code: 'DEU' },
  'Joshua':           { vol: 2, folder: '06.JOS', code: 'JOS' },
  'Judges':           { vol: 2, folder: '07.JDG', code: 'JDG' },
  'Ruth':             { vol: 2, folder: '08.RUT', code: 'RUT' },
  '1 Samuel':         { vol: 2, folder: '09.1SA', code: '1SA' },
  '2 Samuel':         { vol: 2, folder: '10.2SA', code: '2SA' },
  '1 Kings':          { vol: 2, folder: '11.1KI', code: '1KI' },
  '2 Kings':          { vol: 2, folder: '12.2KI', code: '2KI' },
  '1 Chronicles':     { vol: 2, folder: '13.1CH', code: '1CH' },
  '2 Chronicles':     { vol: 2, folder: '14.2CH', code: '2CH' },
  'Ezra':             { vol: 2, folder: '15.EZR', code: 'EZR' },
  'Nehemiah':         { vol: 2, folder: '16.NEH', code: 'NEH' },
  'Esther':           { vol: 2, folder: '17.EST', code: 'EST' },
  'Job':              { vol: 3, folder: '18.JOB', code: 'JOB' },
  'Psalms':           { vol: 3, folder: '19.PSA', code: 'PSA' },
  'Proverbs':         { vol: 3, folder: '20.PRO', code: 'PRO' },
  'Ecclesiastes':     { vol: 3, folder: '21.ECC', code: 'ECC' },
  'Song of Solomon':  { vol: 3, folder: '22.SNG', code: 'SNG' },
  'Isaiah':           { vol: 4, folder: '23.ISA', code: 'ISA' },
  'Jeremiah':         { vol: 4, folder: '24.JER', code: 'JER' },
  'Lamentations':     { vol: 4, folder: '25.LAM', code: 'LAM' },
  'Ezekiel':          { vol: 4, folder: '26.EZK', code: 'EZK' },
  'Daniel':           { vol: 4, folder: '27.DAN', code: 'DAN' },
  'Hosea':            { vol: 4, folder: '28.HOS', code: 'HOS' },
  'Joel':             { vol: 4, folder: '29.JOL', code: 'JOL' },
  'Amos':             { vol: 4, folder: '30.AMO', code: 'AMO' },
  'Obadiah':          { vol: 4, folder: '31.OBA', code: 'OBA' },
  'Jonah':            { vol: 4, folder: '32.JON', code: 'JON' },
  'Micah':            { vol: 4, folder: '33.MIC', code: 'MIC' },
  'Nahum':            { vol: 4, folder: '34.NAM', code: 'NAM' },
  'Habakkuk':         { vol: 4, folder: '35.HAB', code: 'HAB' },
  'Zephaniah':        { vol: 4, folder: '36.ZEP', code: 'ZEP' },
  'Haggai':           { vol: 4, folder: '37.HAG', code: 'HAG' },
  'Zechariah':        { vol: 4, folder: '38.ZEC', code: 'ZEC' },
  'Malachi':          { vol: 4, folder: '39.MAL', code: 'MAL' },
  'Matthew':          { vol: 5, folder: '40.MAT', code: 'MAT' },
  'Mark':             { vol: 5, folder: '41.MRK', code: 'MRK' },
  'Luke':             { vol: 5, folder: '42.LUK', code: 'LUK' },
  'John':             { vol: 5, folder: '43.JHN', code: 'JHN' },
  'Acts':             { vol: 6, folder: '44.ACT', code: 'ACT' },
  'Romans':           { vol: 6, folder: '45.ROM', code: 'ROM' },
  '1 Corinthians':    { vol: 6, folder: '46.1CO', code: '1CO' },
  '2 Corinthians':    { vol: 6, folder: '47.2CO', code: '2CO' },
  'Galatians':        { vol: 6, folder: '48.GAL', code: 'GAL' },
  'Ephesians':        { vol: 6, folder: '49.EPH', code: 'EPH' },
  'Philippians':      { vol: 6, folder: '50.PHP', code: 'PHP' },
  'Colossians':       { vol: 6, folder: '51.COL', code: 'COL' },
  '1 Thessalonians':  { vol: 6, folder: '52.1TH', code: '1TH' },
  '2 Thessalonians':  { vol: 6, folder: '53.2TH', code: '2TH' },
  '1 Timothy':        { vol: 6, folder: '54.1TI', code: '1TI' },
  '2 Timothy':        { vol: 6, folder: '55.2TI', code: '2TI' },
  'Titus':            { vol: 6, folder: '56.TIT', code: 'TIT' },
  'Philemon':         { vol: 6, folder: '57.PHM', code: 'PHM' },
  'Hebrews':          { vol: 6, folder: '58.HEB', code: 'HEB' },
  'James':            { vol: 6, folder: '59.JAS', code: 'JAS' },
  '1 Peter':          { vol: 6, folder: '60.1PE', code: '1PE' },
  '2 Peter':          { vol: 6, folder: '61.2PE', code: '2PE' },
  '1 John':           { vol: 6, folder: '62.1JN', code: '1JN' },
  '2 John':           { vol: 6, folder: '63.2JN', code: '2JN' },
  '3 John':           { vol: 6, folder: '64.3JN', code: '3JN' },
  'Jude':             { vol: 6, folder: '65.JUD', code: 'JUD' },
  'Revelation':       { vol: 6, folder: '66.REV', code: 'REV' },
}

// ── Commentary registry ───────────────────────────────────────────────────────
// To add a new commentary: add an entry here with getUrl, hasBook, and parse.
export const COMMENTARIES = {
  mhc: {
    id:          'mhc',
    name:        'Matthew Henry',
    shortName:   'MHC',
    description: 'Commentary on the Whole Bible (1706–1721)',
    hasBook: book => !!MHC_BOOKS[book],
    getUrl: (book, chapter) => {
      const b = MHC_BOOKS[book]
      return b ? `${MHC_BASE}/VOL.${b.vol}/${b.folder}/${b.code}.${chapter}.html` : null
    },
    parse: html => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const sections = []
      let current = null
      for (const el of doc.body.children) {
        if (el.tagName === 'H2') {
          if (current) sections.push(current)
          current = { heading: el.textContent.trim(), paragraphs: [] }
        } else if (el.tagName === 'DIV' && el.classList.contains('exbib-content')) {
          if (!current) current = { heading: '', paragraphs: [] }
          for (const p of el.querySelectorAll('p')) {
            current.paragraphs.push(p.innerHTML)
          }
        }
      }
      if (current) sections.push(current)
      return sections
    },
  },
  calvin: {
    id:          'calvin',
    name:        "Calvin's Commentaries",
    shortName:   'Calvin',
    description: 'Commentaries on the Bible (1540s–1560s)',
    hasBook: book => !!CALVIN_BOOKS[book],
    getUrl: (book, chapter) => {
      const slug = CALVIN_BOOKS[book]
      return slug ? `${CALVIN_PROXY}?src=calvin&book=${encodeURIComponent(book)}&chapter=${chapter}` : null
    },
    parse: html => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const sections = []

      // BibleHub Calvin structure:
      //   <div class="comm">
      //     <div align="center"><b>Romans 1:1-7</b></div>
      //     <p>1. English verse quote...</p>
      //     <p>1. Latin verse quote...</p>  ← repeat for each verse
      //     <p>1. Paul, etc. [11] -- Actual commentary text...</p>  ← starts here
      //   </div>
      // Commentary paragraphs contain " -- " or "[" footnote markers;
      // verse-quote paragraphs do not.
      for (const comm of doc.querySelectorAll('.comm')) {
        const boldEl = comm.querySelector('b')
        if (!boldEl) continue
        const heading = boldEl.textContent.trim()
        if (!heading) continue

        const paragraphs = []
        let inCommentary = false
        for (const p of comm.querySelectorAll('p')) {
          const text = p.textContent.trim()
          if (!text || text.length < 10) continue
          if (!inCommentary && (text.includes(' -- ') || text.includes('['))) {
            inCommentary = true
          }
          if (inCommentary) paragraphs.push(p.innerHTML)
        }

        if (paragraphs.length > 0) sections.push({ heading, paragraphs })
      }
      return sections
    },
  },
  gill: {
    id:          'gill',
    name:        "Gill's Exposition",
    shortName:   'Gill',
    description: "Exposition of the Entire Bible (1746–1763)",
    hasBook: book => !!MHC_BOOKS[book],
    getUrl: (book, chapter) => {
      const b = MHC_BOOKS[book]
      return b ? `${GILL_BASE}/${b.code}/${chapter}.json` : null
    },
    parse: json => {
      let data
      try { data = typeof json === 'string' ? JSON.parse(json) : json } catch { return [] }
      const verses = data?.chapter?.verses ?? []
      return verses
        .filter(v => v.type === 'verse' && Array.isArray(v.content) && v.content.length)
        .map(v => ({
          heading:    `Verse ${v.number}`,
          paragraphs: v.content.map(t => String(t)),
        }))
    },
  },
}

// ── Fetch with Cache API (offline-first) ─────────────────────────────────────
function _makeTimeoutSignal(ms) {
  // AbortSignal.timeout() not available in Safari < 16 — use AbortController
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  return ctrl.signal
}

async function _fetchCached(url) {
  try {
    // Try Cache API first (offline-first)
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME)
      const hit   = await cache.match(url)
      if (hit) return hit.text()
      const res = await fetch(url, { signal: _makeTimeoutSignal(15000) })
      if (!res.ok) return null
      await cache.put(url, res.clone())
      return res.text()
    }
    // Fallback: plain fetch when Cache API is unavailable
    const res = await fetch(url, { signal: _makeTimeoutSignal(15000) })
    return res.ok ? res.text() : null
  } catch {
    return null
  }
}

/**
 * Fetch and parse a chapter's commentary.
 * Returns { sections: [{ heading, paragraphs[] }] } or null.
 */
export async function getCommentary(commentaryId, book, chapter) {
  const c = COMMENTARIES[commentaryId]
  if (!c || !c.hasBook(book)) return null
  const url = c.getUrl(book, chapter)
  if (!url) return null
  const raw = await _fetchCached(url)
  if (!raw) return null
  return { sections: c.parse(raw) }
}

/** True if the chapter is already stored in cache (available offline). */
export async function isCommentaryCached(commentaryId, book, chapter) {
  const c = COMMENTARIES[commentaryId]
  if (!c || !c.hasBook(book)) return false
  const url = c.getUrl(book, chapter)
  if (!url) return false
  try {
    const cache = await caches.open(CACHE_NAME)
    return !!(await cache.match(url))
  } catch { return false }
}
