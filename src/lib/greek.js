/**
 * Greek New Testament (TAGNT) data library
 *
 * Data source: Translators Amalgamated Greek NT — STEPBible.org (CC BY 4.0)
 * Processed by scripts/processTagnt.mjs → public/tagnt.json
 *
 * Each word record: { w, t, g, s, r, ms }
 *   w  = Greek word
 *   t  = transliteration
 *   g  = dictionary gloss
 *   s  = disambiguated Strong's number (e.g. "G0976")
 *   r  = Robinson morphology code (e.g. "N-NSF", "V-AAI-3S")
 *   ms = manuscript type (e.g. "NKO", "K(O)", "N(K)(O)")
 */

/* ── Lazy-loaded cache ─────────────────────────────────────────────────── */
let _greekData = null
let _loadPromise = null

export async function loadGreek() {
  if (_greekData) return _greekData
  if (_loadPromise) return _loadPromise
  _loadPromise = fetch('/tagnt.json')
    .then(r => {
      if (!r.ok) throw new Error(`Greek NT data not found (HTTP ${r.status}). Run: node scripts/processTagnt.mjs`)
      return r.json()
    })
    .then(data => {
      _greekData = data
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
 * Get all verses of a Greek NT chapter.
 * Returns [{verse: number, words: [{w,t,g,s,r,ms}]}] sorted by verse number,
 * or null if not loaded / not found.
 */
export function getGreekChapter(book, chapter) {
  const chData = _greekData?.[book]?.[String(chapter)]
  if (!chData) return null
  return Object.entries(chData)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([v, words]) => ({ verse: parseInt(v), words }))
}

/* ── NT book set (Greek reader is NT-only) ──────────────────────────────── */
export const NT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
])

/* ── Grammar parser (Robinson morphology) ───────────────────────────────── */

const POS = {
  N:'Noun', V:'Verb', T:'Article', A:'Adj', P:'Pron',
  R:'Rel. Pron', C:'Recip. Pron', D:'Dem. Pron', K:'Correl. Pron',
  I:'Interrog. Pron', X:'Indef. Pron', Q:'Correl/Interrog', F:'Refl. Pron',
  ADV:'Adverb', CONJ:'Conj', COND:'Cond', PRT:'Particle',
  PREP:'Prep', INJ:'Interj', ARAM:'Aramaic', HEB:'Hebrew',
}
const CASE  = { N:'Nom', G:'Gen', D:'Dat', A:'Acc', V:'Voc', L:'Loc' }
const NUM   = { S:'Sg', P:'Pl' }
const GEN   = { M:'Masc', F:'Fem', N:'Neut' }
const TENSE = {
  P:'Pres', I:'Imperf', F:'Fut', A:'Aor', '2A':'2nd Aor',
  R:'Perf', '2R':'2nd Perf', L:'Plpf', FP:'Fut Perf',
}
const VOICE = { A:'Act', M:'Mid', P:'Pass', E:'Mid/Pass', D:'Dep', O:'—' }
const MOOD  = { I:'Ind', S:'Subj', O:'Opt', N:'Inf', P:'Part', M:'Imper' }
const PERS  = { '1':'1st', '2':'2nd', '3':'3rd' }

const SIMPLE = {
  ADV:'Adverb', CONJ:'Conjunction', COND:'Conditional',
  PRT:'Particle', PREP:'Preposition', INJ:'Interjection',
  ARAM:'Aramaic word', HEB:'Hebrew word',
}

/**
 * Convert a Robinson morphology code to a readable label.
 * Examples:
 *   "N-NSF"    → "Noun · Nom Sg Fem"
 *   "V-AAI-3S" → "Verb · Aor Act Ind · 3rd Sg"
 *   "ADV"      → "Adverb"
 */
export function parseGrammar(code) {
  if (!code) return ''
  // Strip proper-noun / title / Attic markers at end
  const clean = code.replace(/-(P|T|C|ATT|S)$/g, '')

  if (SIMPLE[clean]) return SIMPLE[clean]

  const parts = clean.split('-')
  const posCode = parts[0]
  const pos = POS[posCode] || posCode

  if (posCode === 'V') {
    const tense  = TENSE[parts[1]] || parts[1] || ''
    const voice  = VOICE[parts[2]] || parts[2] || ''
    const mood   = MOOD[parts[3]]  || parts[3] || ''
    const tvmStr = [tense, voice, mood].filter(Boolean).join(' ')

    // Participle: may have case/number/gender
    if (parts[3] === 'P' && parts[4]) {
      const c = CASE[parts[4]] || parts[4]
      const n = NUM[parts[5]]  || parts[5] || ''
      const g = GEN[parts[6]]  || parts[6] || ''
      return `Verb · ${tvmStr} · ${[c, n, g].filter(Boolean).join(' ')}`
    }
    // Finite: person + number
    if (parts[4]) {
      const p = PERS[parts[4]] || parts[4]
      const n = NUM[parts[5]]  || parts[5] || ''
      return `Verb · ${tvmStr} · ${p} ${n}`.trimEnd()
    }
    return `Verb · ${tvmStr}`.trimEnd()
  }

  // Noun / pronoun / article / adjective: POS-CASE-NUM[-GEN]
  if (parts[1]) {
    const c = CASE[parts[1]] || parts[1]
    const n = NUM[parts[2]]  || parts[2] || ''
    const g = GEN[parts[3]]  || parts[3] || ''
    return `${pos} · ${[c, n, g].filter(Boolean).join(' ')}`
  }

  return pos
}

/**
 * Determine the manuscript-tradition marker for display.
 * Returns:
 *   'TR'  — word is in Textus Receptus (KJV tradition) but NOT in NA/modern
 *   'NA'  — word is in NA/modern editions but NOT in TR
 *   null  — word appears in both (or indeterminate) — no marker shown
 */
export function getMsMarker(msType) {
  if (!msType) return null
  // Strip parenthesised variant notes — e.g. "N(K)(O)" → "N(O)" → "N"
  const primary = msType.replace(/\([^)]*\)/g, '')
  const hasN = /N/.test(primary)
  const hasK = /K/.test(primary)
  if (hasK && !hasN) return 'TR'   // KJV-only word
  if (hasN && !hasK) return 'NA'   // Modern-text-only word
  return null
}
