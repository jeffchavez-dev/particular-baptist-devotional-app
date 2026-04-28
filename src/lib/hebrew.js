/**
 * Hebrew Old Testament (TAHOT) data library
 *
 * Data source: Translators Amalgamated Hebrew OT — STEPBible.org (CC BY 4.0)
 * Processed by scripts/processTaght.mjs → public/tahot.json
 *
 * Each word record: { w, t, g, s, r, ms }
 *   w  = Hebrew word (with full Masoretic pointing & cantillation)
 *   t  = transliteration
 *   g  = English gloss
 *   s  = disambiguated Strong's number (e.g. "H7225G")
 *   r  = ETCBC morphology code (e.g. "HVqp3ms", "HNcmpa")
 *   ms = manuscript type: L=Leningrad, Q=Qere, R=Restored, X=LXX extra
 */

/* ── Lazy-loaded cache ─────────────────────────────────────────────────── */
let _hebrewData  = null
let _loadPromise = null

export async function loadHebrew() {
  if (_hebrewData) return _hebrewData
  if (_loadPromise) return _loadPromise
  _loadPromise = fetch('/tahot.json')
    .then(r => {
      if (!r.ok) throw new Error(`Hebrew OT data not found (HTTP ${r.status}). Run: npm run process:hebrew`)
      return r.json()
    })
    .then(data => {
      _hebrewData  = data
      _loadPromise = null
      return data
    })
    .catch(err => {
      _loadPromise = null
      throw err
    })
  return _loadPromise
}

/**
 * Get all verses of a Hebrew OT chapter.
 * Returns [{verse: number, words: [{w,t,g,s,r,ms}]}] sorted by verse,
 * or null if not loaded / not found.
 */
export function getHebrewChapter(book, chapter) {
  const chData = _hebrewData?.[book]?.[String(chapter)]
  if (!chData) return null
  return Object.entries(chData)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([v, words]) => ({ verse: parseInt(v), words }))
}

/* ── OT book set ─────────────────────────────────────────────────────── */
export const OT_BOOKS = new Set([
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
])

/* ── ETCBC morphology parser ─────────────────────────────────────────── */
const POS   = { A:'Adj', C:'Conj', D:'Adv', N:'Noun', P:'Prep', R:'Pron', S:'Suffix', T:'Particle', V:'Verb' }
const STEM  = { q:'Qal', N:'Niphal', p:'Piel', P:'Pual', h:'Hiphil', H:'Hophal', t:'Hithpael', o:'Polel', O:'Polal', r:'Hithpolel', m:'Poel', M:'Poal' }
const ASPCT = { p:'Perf', i:'Impf', w:'Consec', q:'Seq Impf', h:'Cohort', j:'Jussive', v:'Imper', r:'Part', s:'Part Pass', a:'Inf Abs', c:'Inf Const' }
const NUM   = { s:'Sg', p:'Pl', d:'Du' }
const GEN   = { m:'Masc', f:'Fem', b:'Both' }
const STA   = { a:'Abs', c:'Const', d:'Det' }
const PER   = { '1':'1st', '2':'2nd', '3':'3rd' }

/**
 * Convert ETCBC morphology code to a readable label.
 * Examples:
 *   "HVqp3ms"   → "Verb · Qal Perf · 3rd Masc Sg"
 *   "HNcmpa"    → "Noun · Masc Sg Abs"
 *   "HR/Ncfsa"  → "Noun · Fem Sg Abs"   (main part after last /)
 *   "HC"        → "Conj"
 */
export function parseHebrewMorph(code) {
  if (!code) return ''
  // Strip 'H' language prefix, then take the main morpheme (after last /)
  const stripped = code.startsWith('H') ? code.slice(1) : code
  const main     = stripped.split('/').pop() || stripped

  const posCode = main[0]
  const pos     = POS[posCode] || posCode

  if (posCode === 'V') {
    // Verb: [V][stem][aspect][person][gender][number]
    const stem   = STEM[main[1]]  || main[1]  || ''
    const aspect = ASPCT[main[2]] || main[2]  || ''
    const per    = PER[main[3]]   || ''
    const gen    = GEN[main[4]]   || ''
    const num    = NUM[main[5]]   || ''
    const tvPart = [stem, aspect].filter(Boolean).join(' ')
    const pgnPart = [per, gen, num].filter(Boolean).join(' ')
    return ['Verb', tvPart, pgnPart].filter(Boolean).join(' · ')
  }

  if (posCode === 'N' || posCode === 'A') {
    // Noun / Adjective: [N/A][proper/common][gender][number][state]
    const gen   = GEN[main[2]] || ''
    const num   = NUM[main[3]] || ''
    const state = STA[main[4]] || ''
    const detail = [gen, num, state].filter(Boolean).join(' ')
    return detail ? `${pos} · ${detail}` : pos
  }

  if (posCode === 'R' || posCode === 'S') {
    // Pronoun / suffix
    const per = PER[main[1]] || ''
    const gen = GEN[main[2]] || ''
    const num = NUM[main[3]] || ''
    const detail = [per, gen, num].filter(Boolean).join(' ')
    return detail ? `${pos} · ${detail}` : pos
  }

  // Preposition, conjunction, particle, adverb, etc.
  return pos
}

/**
 * Determine manuscript variant marker for display.
 * Returns null for the standard Leningrad/Masoretic text (no marker needed).
 * Q = Qere scribal correction
 * R = Restored text (from parallel passage)
 * X = Extra word from LXX
 */
export function getHebMsMarker(msType) {
  if (!msType || msType === 'L') return null
  if (msType === 'Q') return 'Q'
  if (msType === 'R') return 'R'
  if (msType === 'X') return 'X'
  return null
}
