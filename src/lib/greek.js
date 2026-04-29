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

/* Canonical NT order for search results */
const NT_BOOK_ORDER = [
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James',
  '1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]

/**
 * Search all GNT words for a given Strong's ID.
 * Returns { results:[{book,chapter,verse,w,t,g}], total, capped }
 * One result per verse (first matching word), canonical order, capped at maxResults.
 */
export function searchGreekByStrongs(strongsId, maxResults = 300) {
  if (!_greekData || !strongsId) return { results: [], total: 0, capped: false }
  const targetNum = parseInt(
    strongsId.replace(/^[GgHh]/, '').replace(/[A-Za-z]+$/, ''),
    10
  )
  if (isNaN(targetNum)) return { results: [], total: 0, capped: false }

  const results = []
  let total = 0

  for (const book of NT_BOOK_ORDER) {
    const bookData = _greekData[book]
    if (!bookData) continue
    const chs = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chs) {
      const verses = bookData[String(ch)]
      if (!verses) continue
      const vs = Object.keys(verses).map(Number).sort((a, b) => a - b)
      for (const v of vs) {
        const words = verses[String(v)]
        if (!words) continue
        for (const wd of words) {
          const n = parseInt(
            (wd.s || '').replace(/^[GgHh]/, '').replace(/[A-Za-z]+$/, ''), 10
          )
          if (n === targetNum) {
            total++
            if (results.length < maxResults) {
              results.push({ book, chapter: ch, verse: v, w: wd.w, t: wd.t, g: wd.g })
            }
            break // one entry per verse
          }
        }
      }
    }
  }
  return { results, total, capped: total > maxResults }
}

/* ── Grammar parser (Robinson morphology) ───────────────────────────────── */

const POS = {
  N:'Noun', V:'Verb', T:'Article', A:'Adj', P:'Pron',
  R:'Rel. Pron', C:'Recip. Pron', D:'Dem. Pron', K:'Correl. Pron',
  I:'Interrog. Pron', X:'Indef. Pron', Q:'Correl/Interrog', F:'Refl. Pron',
  ADV:'Adverb', CONJ:'Conj', COND:'Cond', PRT:'Particle',
  PREP:'Prep', INJ:'Interj', ARAM:'Aramaic', HEB:'Hebrew',
}
const CASE  = { N:'Nominative', G:'Genitive', D:'Dative', A:'Accusative', V:'Vocative', L:'Locative' }
const NUM   = { S:'Singular', P:'Plural' }
const GEN   = { M:'Masculine', F:'Feminine', N:'Neuter' }
const TENSE = {
  P:'Present', I:'Imperfect', F:'Future', A:'Aorist', '2A':'2nd Aorist',
  R:'Perfect', '2R':'2nd Perfect', L:'Pluperfect', FP:'Future Perfect',
}
const VOICE = { A:'Active', M:'Middle', P:'Passive', E:'Middle/Passive', D:'Deponent', O:'—' }
const MOOD  = { I:'Indicative', S:'Subjunctive', O:'Optative', N:'Infinitive', P:'Participle', M:'Imperative' }
const PERS  = { '1':'1st', '2':'2nd', '3':'3rd' }

const SIMPLE = {
  ADV:'Adverb', CONJ:'Conjunction', COND:'Conditional',
  PRT:'Particle', PREP:'Preposition', INJ:'Interjection',
  ARAM:'Aramaic word', HEB:'Hebrew word',
}

// Short forms for the compact inline label (word chip title, etc.)
const CASE_S  = { N:'Nom', G:'Gen', D:'Dat', A:'Acc', V:'Voc', L:'Loc' }
const NUM_S   = { S:'Sg',  P:'Pl'  }
const GEN_S   = { M:'Masc', F:'Fem', N:'Neut' }
const TENSE_S = {
  P:'Pres', I:'Imperf', F:'Fut', A:'Aor', '2A':'2nd Aor',
  R:'Perf', '2R':'2nd Perf', L:'Plpf', FP:'Fut Perf',
}
const VOICE_S = { A:'Act', M:'Mid', P:'Pass', E:'Mid/Pass', D:'Dep', O:'—' }
const MOOD_S  = { I:'Ind', S:'Subj', O:'Opt', N:'Inf', P:'Part', M:'Imper' }

/**
 * Parse the Tense+Voice+Mood segment of a Robinson verb code.
 * Handles both 1-char tenses (A, P, F…) and 2-char tenses (2A, 2R, FP).
 * Returns { tense, voice, mood, moodChar } using either full or short labels.
 */
function parseTVM(tvm, short = false) {
  if (!tvm) return { tense:'', voice:'', mood:'', moodChar:'' }
  const T = short ? TENSE_S : TENSE
  const V = short ? VOICE_S : VOICE
  const M = short ? MOOD_S  : MOOD
  let tense, voice, mood, moodChar
  // 2-char tense prefix check: '2A', '2R', 'FP'
  const t2 = T[tvm.slice(0, 2)]
  if (t2 !== undefined) {
    tense    = t2
    voice    = V[tvm[2]] || tvm[2] || ''
    mood     = M[tvm[3]] || tvm[3] || ''
    moodChar = tvm[3] || ''
  } else {
    tense    = T[tvm[0]] || tvm[0] || ''
    voice    = V[tvm[1]] || tvm[1] || ''
    mood     = M[tvm[2]] || tvm[2] || ''
    moodChar = tvm[2] || ''
  }
  return { tense, voice, mood, moodChar }
}

/**
 * Parse Case+Number+Gender segment (e.g. "NSM", "GPF").
 */
function parseCNG(cgn, short = false) {
  const C = short ? CASE_S : CASE
  const N = short ? NUM_S  : NUM
  const G = short ? GEN_S  : GEN
  return {
    c: C[cgn?.[0]] || '',
    n: N[cgn?.[1]] || '',
    g: G[cgn?.[2]] || '',
  }
}

/**
 * Convert a Robinson morphology code to a compact readable label.
 * Examples:
 *   "N-NSF"    → "Noun · Nom Sg Fem"
 *   "V-AAI-3S" → "Verb · Aor Act Ind · 3rd Sg"
 *   "V-PAP-NSM"→ "Verb · Pres Act Part · Nom Sg Masc"
 *   "ADV"      → "Adverb"
 */
export function parseGrammar(code) {
  if (!code) return ''
  const clean = code.replace(/-(P|T|C|ATT|S)$/g, '')
  if (SIMPLE[clean]) return SIMPLE[clean]

  const parts   = clean.split('-')
  const posCode = parts[0]
  const pos     = POS[posCode] || posCode

  if (posCode === 'V') {
    const { tense, voice, mood, moodChar } = parseTVM(parts[1], true)
    const tvmStr = [tense, voice, mood].filter(v => v && v !== '—').join(' ')

    if (moodChar === 'P' && parts[2]) {
      // Participle: Case+Number+Gender follows
      const { c, n, g } = parseCNG(parts[2], true)
      return `Verb · ${tvmStr} · ${[c, n, g].filter(Boolean).join(' ')}`
    }
    if (moodChar !== 'N' && parts[2]) {
      // Finite verb: Person+Number (e.g. "3S")
      const p = PERS[parts[2][0]] || parts[2][0]
      const n = NUM_S[parts[2][1]] || parts[2][1] || ''
      return `Verb · ${tvmStr} · ${[p, n].filter(Boolean).join(' ')}`.trimEnd()
    }
    return `Verb · ${tvmStr}`.trimEnd()
  }

  // Noun / pronoun / article / adjective: CGN packed in parts[1]
  if (parts[1]) {
    const { c, n, g } = parseCNG(parts[1], true)
    return `${pos} · ${[c, n, g].filter(Boolean).join(' ')}`
  }

  return pos
}

/**
 * Parse a Robinson code into a structured label list for detailed display.
 * Returns { pos: string, items: [{label, value}] } or null.
 */
export function parseMorphDetails(code) {
  if (!code) return null
  const clean = code.replace(/-(P|T|C|ATT|S)$/g, '')
  if (SIMPLE[clean]) return { pos: SIMPLE[clean], items: [] }

  const parts   = clean.split('-')
  const posCode = parts[0]
  const pos     = POS[posCode] || posCode
  const items   = []

  if (posCode === 'V') {
    const { tense, voice, mood, moodChar } = parseTVM(parts[1], false)
    if (tense) items.push({ label:'Tense', value: tense })
    if (voice && voice !== '—') items.push({ label:'Voice', value: voice })
    if (mood)  items.push({ label:'Mood',  value: mood  })

    if (moodChar === 'P' && parts[2]) {
      const { c, n, g } = parseCNG(parts[2], false)
      if (c) items.push({ label:'Case',   value: c })
      if (n) items.push({ label:'Number', value: n })
      if (g) items.push({ label:'Gender', value: g })
    } else if (moodChar !== 'N' && parts[2]) {
      const p = PERS[parts[2][0]]
      const n = NUM[parts[2][1]]
      if (p) items.push({ label:'Person', value: p })
      if (n) items.push({ label:'Number', value: n })
    }
  } else if (parts[1]) {
    const { c, n, g } = parseCNG(parts[1], false)
    if (c) items.push({ label:'Case',   value: c })
    if (n) items.push({ label:'Number', value: n })
    if (g) items.push({ label:'Gender', value: g })
  }

  return { pos, items }
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
