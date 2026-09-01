import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveScroll, restoreScroll } from '../lib/pageState'
import { useAuth } from '../App'
import {
  getAllKjvHighlights, getAllKjvNotes,
  getAllConfHighlights, getAllConfNotes,
  getAllLibNotes,
  getAllScriptureBookmarks, toggleScriptureBookmark,
  HIGHLIGHT_COLORS, getHlStyle,
  setHighlight, setItemNote,
  loadPartialHighlights, removePartialHighlight,
} from '../lib/annotations'
import { supabase, getLocalProgress, setLocalProgress, buildSchedule } from '../lib/supabase'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { loadBibleVersion, getChapterVerses, BIBLE_VERSIONS } from '../lib/bibleVersions'
import { getDefaultReaderVersion, resolveVersion } from '../lib/readerPrefs'
import { LBCF2 } from '../data/lbcf2'
import { LBCF1 } from '../data/lbcf1'
import { CATECHISM } from '../data/catechism'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import BookLibraryTab from '../components/BookLibraryTab'
import { shareLibNote, unshareLibNote, getLibShareToken, noteShareUrl, syncLibSharedNote } from '../lib/noteShare'
import { getAllQuotes } from '../lib/quoteLibrary'
import { getVocabList, removeVocabWord, setVocabStatus, incrementReviewCount, VOCAB_STATUSES } from '../lib/vocab'
import { getGreekFontCss, getHebrewFontCss } from '../components/FontPrefsPanel'

const SCHEDULE = buildSchedule()

/* ── Rich-note storage marker ── */
const RICH_PREFIX = '<!RICH>'

function isRichNote(raw) { return typeof raw === 'string' && raw.startsWith(RICH_PREFIX) }

function parseRichNote(raw) {
  try {
    const parsed = JSON.parse(raw.slice(RICH_PREFIX.length))
    return { title: '', body: '', labels: [], verseTag: null, chapterTag: null, createdAt: null, ...parsed }
  } catch {
    return { title: '', body: '', labels: [], verseTag: null, chapterTag: null, createdAt: null }
  }
}

/* verseTag:   { book, chapter, verse }    | null — verse-exact note (goes to Scripture Notes)
   chapterTag: { book, chapter }           | null — chapter-scoped note (goes to Personal Notes)
   createdAt:  ISO string — pass existing value when editing (preserves creation date) */
function encodeRichNote(title, body, labels = [], verseTag = null, createdAt = null, chapterTag = null) {
  const obj = { title, body, labels }
  if (verseTag)    obj.verseTag    = verseTag
  if (chapterTag)  obj.chapterTag  = chapterTag
  obj.createdAt = createdAt || new Date().toISOString()
  return RICH_PREFIX + JSON.stringify(obj)
}

function richNoteSearchText(raw) {
  if (!isRichNote(raw)) return raw
  const { title, body, labels = [] } = parseRichNote(raw)
  const stripped = (body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  return `${title || ''} ${stripped} ${labels.join(' ')}`
}

/* ── Shared helpers ────────────────────────────────────────────────────────── */
function HlDot({ colorId, size = 9 }) {
  const c = getHlStyle(colorId)
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: c.dot, flexShrink: 0,
    }} />
  )
}

function SectionHeader({ icon, title, count, filtered, open, onToggle }) {
  const clickable = !!onToggle
  return (
    <div
      style={{
        ...s.sectionHeader,
        ...(clickable ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : {}),
      }}
      onClick={onToggle}
      role={clickable ? 'button' : undefined}
      aria-expanded={clickable ? open : undefined}
    >
      {icon}
      <span style={s.sectionTitle}>{title}</span>
      {count > 0 && (
        <span style={s.sectionBadge}>
          {filtered != null && filtered !== count ? `${filtered} / ${count}` : count}
        </span>
      )}
      {clickable && (
        <svg
          width="13" height="13" viewBox="0 0 13 13" fill="none"
          style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.22s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--ink-faint)' }}
        >
          <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

function EmptyMsg({ text }) {
  return <p style={s.emptyText}>{text}</p>
}

function RemoveBtn({ onClick, label = 'Remove' }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={s.removeBtn}
      title={label}
      aria-label={label}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

const CLIP_CHARS = 220

/* ── Highlighted plain-text search ── */
function Highlighted({ text, query }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--teal-light)', color: 'var(--teal)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/* ── Resolve the effective text version (Greek/Hebrew need special rendering;
       fall back to KJV for plain-text preview when 'original' is chosen) ── */
function resolveTextVersion(pref, bookName) {
  const resolved = resolveVersion(pref, bookName, BIBLE_BOOKS)
  return ['greek', 'hebrew', 'lxx'].includes(resolved) ? 'kjv' : resolved
}

/* ── Version abbreviation label (KJV / ABAB / NASB / …) ── */
function versionLabel(pref, bookName) {
  const effectiveId = resolveTextVersion(pref, bookName)
  return BIBLE_VERSIONS.find(v => v.id === effectiveId)?.abbreviation ?? 'KJV'
}

/* ── Fetch a single verse text in the given version ── */
async function fetchVerseText(book, chapter, verse, version) {
  try {
    const vid = resolveTextVersion(version ?? getDefaultReaderVersion(), book)
    const data = await loadBibleVersion(vid)
    const slug = book.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const verses = data[slug]?.[chapter]
    if (!verses) return null
    const v = verses.find(v => v.v === parseInt(verse))
    return v?.t ?? null
  } catch {
    return null
  }
}

/* ── Fetch a range of verses in the given version ── */
async function fetchVerseRange(book, chapter, fromVerse, toVerse, version) {
  try {
    const vid = resolveTextVersion(version ?? getDefaultReaderVersion(), book)
    const data = await loadBibleVersion(vid)
    const slug = book.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const verses = data[slug]?.[chapter]
    if (!verses) return []
    return verses
      .filter(v => v.v >= fromVerse && v.v <= (toVerse ?? fromVerse))
      .map(v => ({ v: v.v, t: v.t }))
  } catch {
    return []
  }
}

/* ── Parse a fully-typed @reference  e.g. "Genesis 1:1" or "Genesis 1:1-5" ── */
const BOOKS_BY_LENGTH = [...BIBLE_BOOKS].sort((a, b) => b.name.length - a.name.length)

/* ── Book abbreviation map (abbr → full name, keyed in lowercase without periods) ── */
const BOOK_ABBREVS = {
  /* OT */
  'gen':'Genesis','exo':'Exodus','lev':'Leviticus','num':'Numbers',
  'deut':'Deuteronomy','josh':'Joshua','judg':'Judges','ruth':'Ruth',
  '1 sam':'1 Samuel','2 sam':'2 Samuel','1 kgs':'1 Kings','2 kgs':'2 Kings',
  '1 chr':'1 Chronicles','2 chr':'2 Chronicles','ezra':'Ezra','neh':'Nehemiah',
  'esth':'Esther','job':'Job','ps':'Psalms','psa':'Psalms','prov':'Proverbs',
  'eccl':'Ecclesiastes','song':'Song of Solomon','isa':'Isaiah','jer':'Jeremiah',
  'lam':'Lamentations','ezek':'Ezekiel','dan':'Daniel','hos':'Hosea','joel':'Joel',
  'amos':'Amos','obad':'Obadiah','jon':'Jonah','mic':'Micah','nah':'Nahum',
  'hab':'Habakkuk','zeph':'Zephaniah','hag':'Haggai','zech':'Zechariah','mal':'Malachi',
  /* NT */
  'matt':'Matthew','mk':'Mark','lk':'Luke','jn':'John','acts':'Acts',
  'rom':'Romans','1 cor':'1 Corinthians','2 cor':'2 Corinthians',
  'gal':'Galatians','eph':'Ephesians','phil':'Philippians','col':'Colossians',
  '1 thess':'1 Thessalonians','2 thess':'2 Thessalonians',
  '1 tim':'1 Timothy','2 tim':'2 Timothy','tit':'Titus','philem':'Philemon',
  'heb':'Hebrews','jas':'James','1 pet':'1 Peter','2 pet':'2 Peter',
  '1 jn':'1 John','2 jn':'2 John','3 jn':'3 John','jude':'Jude','rev':'Revelation',
}

/* Strip periods from abbreviated query and look up full book name.
   e.g. "Gen. 1:1" → strips periods → "Gen 1:1", looks up "gen" → "Genesis 1:1" */
function stripAbbrevPeriods(q) { return q.replace(/\./g, '').replace(/\s{2,}/g, ' ').trim() }

/** Try to resolve an abbreviation prefix in a query and return the full book name,
 *  or null if nothing matches. The returned object contains the full book name
 *  and the remainder of the query after the abbreviation. */
function resolveAbbrev(qNorm) {
  const lower = qNorm.toLowerCase()
  // Sort abbrevs by length desc so longest match wins (e.g. "1 thess" before "1 th")
  const abbrs = Object.keys(BOOK_ABBREVS).sort((a, b) => b.length - a.length)
  for (const abbr of abbrs) {
    if (lower.startsWith(abbr)) {
      const rest = qNorm.slice(abbr.length)
      // After the abbreviation there must be nothing or whitespace + reference
      if (rest === '' || rest.startsWith(' ')) {
        return { book: BOOK_ABBREVS[abbr], rest: rest.trim() }
      }
    }
  }
  return null
}

function parseAtQuery(query) {
  const q = query.trim()
  // 1. Try full book name match (original behaviour)
  for (const bk of BOOKS_BY_LENGTH) {
    if (q.toLowerCase().startsWith(bk.name.toLowerCase())) {
      const rest = q.slice(bk.name.length).trim()
      const m    = rest.match(/^(\d+):(\d+)(?:-(\d+))?$/)
      if (m) {
        return {
          book:    bk.name,
          chapter: parseInt(m[1]),
          verse:   parseInt(m[2]),
          verseTo: m[3] ? parseInt(m[3]) : null,
        }
      }
    }
  }
  // 2. Strip periods and try abbreviation lookup
  const qNorm = stripAbbrevPeriods(q)
  const abbrev = resolveAbbrev(qNorm)
  if (abbrev) {
    const m = abbrev.rest.match(/^(\d+):(\d+)(?:-(\d+))?$/)
    if (m) {
      return {
        book:    abbrev.book,
        chapter: parseInt(m[1]),
        verse:   parseInt(m[2]),
        verseTo: m[3] ? parseInt(m[3]) : null,
      }
    }
  }
  return null
}

/** Extend parseAtQuery to also handle chapter-shorthand when a chapterTag is active.
 *
 *  @3       → tagged book + chapter, verse 3          (verse-only shorthand — NEW)
 *  @3-5     → tagged book + chapter, verses 3–5       (verse range shorthand — NEW)
 *  @1:3     → tagged book, explicit chapter 1 verse 3 (existing cross-chapter shorthand)
 *  @Gen 1:3 → full reference (falls through to parseAtQuery)
 */
function parseAtQueryWithChapterTag(query, chapterTag) {
  if (chapterTag) {
    const q = query.trim()
    // @3 — bare verse number → use the tagged chapter
    // Skip 1, 2, 3 as verse shorthands — they conflict with numbered book prefixes
    // (1 Samuel, 2 Kings, 3 John, etc.). Verse shorthands work from 4+ upward.
    const mVerse = q.match(/^(\d+)$/)
    if (mVerse && parseInt(mVerse[1]) >= 4) {
      return {
        book:    chapterTag.book,
        chapter: chapterTag.chapter,
        verse:   parseInt(mVerse[1]),
        verseTo: null,
      }
    }
    // @3-5 — bare verse range → use the tagged chapter
    const mRange = q.match(/^(\d+)-(\d+)$/)
    if (mRange) {
      return {
        book:    chapterTag.book,
        chapter: chapterTag.chapter,
        verse:   parseInt(mRange[1]),
        verseTo: parseInt(mRange[2]),
      }
    }
    // @1:3 — explicit chapter:verse within the tagged book
    const mChVerse = q.match(/^(\d+):(\d+)(?:-(\d+))?$/)
    if (mChVerse) {
      return {
        book:    chapterTag.book,
        chapter: parseInt(mChVerse[1]),
        verse:   parseInt(mChVerse[2]),
        verseTo: mChVerse[3] ? parseInt(mChVerse[3]) : null,
      }
    }
  }
  return parseAtQuery(query)
}

/* ════════════════════════════════════════════════════════════════
   Confession / Catechism reference helpers
════════════════════════════════════════════════════════════════ */

/* Metadata about each confession/catechism type */
const CONF_TYPES = {
  '2lbcf':   { label: '2LBCF',   fullName: '2nd London Baptist Confession', route: '2lbcf',    color: 'var(--purple-ink)', bg: 'var(--purple-soft)',    border: 'var(--purple-ink)', hasParagraphs: true,  maxItems: null },
  '1lbcf':   { label: '1LBCF',   fullName: '1st London Baptist Confession', route: '1lbcf',    color: 'var(--amber-ink)',  bg: 'var(--amber-soft)',     border: 'var(--amber-ink)',  hasParagraphs: false, maxItems: 52   },
  'orthodox': { label: 'Orthodox', fullName: 'An Orthodox Catechism',         route: 'orthodox', color: '#0c4a6e',           bg: 'rgba(12,74,110,0.12)', border: '#0c4a6e',           hasParagraphs: false, maxItems: 196  },
  'keach':    { label: 'Keach',   fullName: "Keach's Baptist Catechism",      route: 'catechism',color: 'var(--teal)',       bg: 'var(--teal-light)',     border: 'var(--teal)',       hasParagraphs: false, maxItems: 114  },
}

/** Parse a query like "2LBCF 1:2", "1LBCF 52", "Orthodox1", "Keach 3"
 *  Returns { confType, chapter, para, complete } or null */
function parseAtQueryConfession(query) {
  const q = query.trim()
  // 2LBCF Chapter.Para or Chapter:Para  (e.g. "2LBCF 1:1" or "2LBCF 1.1")
  const m2 = q.match(/^2LBCF\s+(\d+)[.:](\d+)$/i)
  if (m2) return { confType: '2lbcf', chapter: parseInt(m2[1]), para: parseInt(m2[2]), complete: true }
  if (/^2LBCF(\s+\d*[.:]?\d*)?$/i.test(q)) return { confType: '2lbcf', complete: false }
  // 1LBCF Article  (e.g. "1LBCF 52")
  const m1 = q.match(/^1LBCF\s+(\d+)$/i)
  if (m1) return { confType: '1lbcf', chapter: null, para: parseInt(m1[1]), complete: true }
  if (/^1LBCF(\s+\d*)?$/i.test(q)) return { confType: '1lbcf', complete: false }
  // Orthodox question  (e.g. "Orthodox1", "Orthodox 1", "OrthodoxQ1")
  const mo = q.match(/^Orthodox\s*(?:Q\.?\s*)?(\d+)$/i)
  if (mo) return { confType: 'orthodox', chapter: null, para: parseInt(mo[1]), complete: true }
  if (/^Orthodox(\s.*)?$/i.test(q)) return { confType: 'orthodox', complete: false }
  // Keach question  (e.g. "Keach2", "Keach 2", "KeachQ2")
  const mk = q.match(/^Keach\s*(?:Q\.?\s*)?(\d+)$/i)
  if (mk) return { confType: 'keach', chapter: null, para: parseInt(mk[1]), complete: true }
  if (/^Keach(\s.*)?$/i.test(q)) return { confType: 'keach', complete: false }
  return null
}

/** Display label for a confession tag */
function confRefLabel(confType, chapter, para) {
  switch (confType) {
    case '2lbcf':    return `2LBCF ${chapter}.${para}`
    case '1lbcf':    return `1LBCF ${para}`
    case 'orthodox': return `Orthodox Q.${para}`
    case 'keach':    return `Keach Q.${para}`
    default:         return `Conf. ${para}`
  }
}

/** Synchronous entry lookup from static data */
function getConfEntry(confType, chapter, para) {
  switch (confType) {
    case '2lbcf':    return LBCF2[`${chapter}.${para}`] ?? null
    case '1lbcf':    return LBCF1[para]                 ?? null
    case 'orthodox': return ORTHODOX_CATECHISM[para]    ?? null
    case 'keach':    return CATECHISM[para]              ?? null
    default:         return null
  }
}

/** Short preview text for a confession entry */
function getConfPreviewText(confType, chapter, para, maxLen = 120) {
  const entry = getConfEntry(confType, chapter, para)
  if (!entry) return null
  const raw = (confType === '2lbcf' || confType === '1lbcf') ? entry.text : entry.q
  if (!raw) return null
  return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw
}

/** All paragraphs for a 2LBCF chapter */
function get2lbcfChapterParas(chapter) {
  const paras = []
  for (let i = 1; i <= 30; i++) {
    const entry = LBCF2[`${chapter}.${i}`]
    if (!entry) break
    paras.push({ para: i, ...entry })
  }
  return paras
}

/** All entries for flat-list confession types (1LBCF, Keach, Orthodox) */
function getAllConfEntries(confType) {
  const src = confType === '1lbcf' ? LBCF1 : confType === 'keach' ? CATECHISM : ORTHODOX_CATECHISM
  return Object.entries(src).map(([k, v]) => ({ para: parseInt(k), ...v }))
}

/** Full text for quote-mode insertion */
function getConfFullText(confType, chapter, para) {
  const entry = getConfEntry(confType, chapter, para)
  if (!entry) return null
  if (confType === '2lbcf' || confType === '1lbcf') return entry.text ?? null
  if (entry.a) return entry.a
  return null
}

/** Check whether a query fragment contains a space that is valid for conf refs
 *  (so checkAtMention doesn't close the popup on space) */
function isConfQueryWithSpace(q) {
  return parseAtQueryConfession(q) !== null
}

/* ── Label / category storage ── */
const LABEL_STORAGE_KEY = 'pb-note-labels'
const DEFAULT_LABELS = [
  'Biblical Theology', 'Philosophy', 'Doctrines of Grace',
  'Christology', 'Soteriology', 'Ecclesiology',
  'Eschatology', 'Prayer', 'Personal',
]

/* ── Label colour palette — deterministic per label name ── */
const LABEL_COLOR_PALETTE = [
  { bg: 'var(--teal-light)',     color: 'var(--teal)',       border: 'var(--teal)' },
  { bg: 'var(--purple-soft)',    color: 'var(--purple-ink)', border: 'var(--purple-ink)' },
  { bg: 'var(--amber-soft)',     color: 'var(--amber-ink)',  border: 'var(--amber-ink)' },
  { bg: 'var(--red-light)',      color: 'var(--red)',        border: 'var(--red)' },
  { bg: 'var(--gold-faint)',     color: 'var(--gold)',       border: 'var(--gold)' },
  { bg: 'var(--gray-soft)',      color: 'var(--gray-ink)',   border: 'var(--gray-ink)' },
  { bg: 'rgba(59,130,246,0.13)', color: '#1d4ed8',          border: '#1d4ed8' },  // blue
  { bg: 'rgba(236,72,153,0.11)', color: '#be185d',          border: '#be185d' },  // rose
]

function getLabelColor(label) {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return LABEL_COLOR_PALETTE[h % LABEL_COLOR_PALETTE.length]
}

function getStoredLabels() {
  try {
    const raw = localStorage.getItem(LABEL_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_LABELS]
}

function saveStoredLabels(labels) {
  try { localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(labels)) } catch {}
}

/* ══════════════════════════════════════════════════════════════
   Scripture Verse Modal  (shown when clicking a tagged @ref)
══════════════════════════════════════════════════════════════ */
function ScriptureVerseModal({ sc, onClose, onNavigate, onDeleteTag, onEditTag, zOverride }) {
  const [navChapter, setNavChapter] = useState(sc?.chapter ?? 1)
  const [verses,  setVerses]  = useState([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(() => getDefaultReaderVersion())
  const taggedVerseRef = useRef(null)

  /* Reset navChapter whenever a new tag is opened */
  useEffect(() => {
    if (sc) setNavChapter(sc.chapter)
  }, [sc?.book, sc?.chapter, sc?.verse, sc?.verseTo]) // eslint-disable-line

  /* Keep version in sync when the user changes it in Settings */
  useEffect(() => {
    function onStorage() { setVersion(getDefaultReaderVersion()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* Always fetch the full chapter so users can scroll context around the tag */
  useEffect(() => {
    if (!sc) return
    const ver = getDefaultReaderVersion()
    setVersion(ver)
    setLoading(true)
    fetchVerseRange(sc.book, navChapter, 1, 999, ver).then(vs => {
      setVerses(vs)
      setLoading(false)
    })
  }, [sc?.book, sc?.chapter, sc?.verse, sc?.verseTo, navChapter]) // eslint-disable-line

  /* Scroll tagged verse into view when content loads on the original chapter */
  useEffect(() => {
    if (!loading && taggedVerseRef.current) {
      taggedVerseRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [loading])

  if (!sc) return null

  const bookInfo    = BIBLE_BOOKS.find(b => b.name === sc.book)
  const maxChapter  = bookInfo?.chapters ?? 150
  const isOriginal  = navChapter === sc.chapter
  const tagFrom     = sc.verse ?? 0
  const tagTo       = sc.verseTo ?? sc.verse ?? 0
  const isTagged    = (vNum) => isOriginal && vNum >= tagFrom && vNum <= tagTo

  const refLabel = isOriginal
    ? (sc.verseTo && sc.verseTo !== sc.verse)
      ? `${sc.book} ${sc.chapter}:${sc.verse}–${sc.verseTo}`
      : `${sc.book} ${sc.chapter}:${sc.verse}`
    : `${sc.book} ${navChapter}`

  const verLabel = versionLabel(version, sc.book ?? '')

  return (
    <div style={zOverride ? { ...vm.backdrop, zIndex: zOverride } : vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        <div style={vm.header}>
          <button
            style={{ ...vm.navArrow, opacity: navChapter <= 1 ? 0.25 : 1 }}
            disabled={navChapter <= 1}
            onClick={() => setNavChapter(c => Math.max(1, c - 1))}
            aria-label="Previous chapter"
          >‹</button>
          <span style={{ ...vm.ref, flex: 1, textAlign: 'center' }}>
            {refLabel}
            <span style={{ fontWeight: 400, fontSize: '0.82em', color: 'var(--ink-faint)', marginLeft: 4 }}>· {verLabel}</span>
          </span>
          <button
            style={{ ...vm.navArrow, opacity: navChapter >= maxChapter ? 0.25 : 1 }}
            disabled={navChapter >= maxChapter}
            onClick={() => setNavChapter(c => Math.min(maxChapter, c + 1))}
            aria-label="Next chapter"
          >›</button>
          <button style={vm.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={vm.body}>
          {loading ? (
            <p style={vm.loading}>Loading…</p>
          ) : verses.length === 0 ? (
            <p style={vm.loading}>Verse not found.</p>
          ) : (
            <div>
              {verses.map(vr => {
                const tagged = isTagged(vr.v)
                return (
                  <p
                    key={vr.v}
                    ref={tagged && vr.v === tagFrom ? taggedVerseRef : null}
                    style={{
                      ...vm.verseText, marginBottom: 4, fontStyle: 'normal',
                      ...(tagged ? {
                        background: 'var(--teal-light)',
                        borderLeft: '3px solid var(--teal)',
                        padding: '3px 6px',
                        borderRadius: 4,
                        marginLeft: -6,
                      } : {}),
                    }}
                  >
                    <sup style={{ fontSize: '0.72em', fontWeight: 700, color: 'var(--teal)', marginRight: 3 }}>{vr.v}</sup>
                    {vr.t}
                  </p>
                )
              })}
            </div>
          )}
        </div>
        <div style={vm.actions}>
          {onDeleteTag && (
            <button style={{ ...vm.openBtn, background: 'none', border: '1px solid #e53e3e', color: '#e53e3e' }}
              onClick={() => { onDeleteTag(); onClose() }}>
              Remove
            </button>
          )}
          {onEditTag && (
            <button style={{ ...vm.openBtn, background: 'var(--parchment-dark)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}
              onClick={() => { onClose(); onEditTag() }}>
              Edit ref
            </button>
          )}
          <button style={vm.openBtn} onClick={() => { onNavigate(sc.book, navChapter, isOriginal ? sc.verse : 1); onClose() }}>
            Open in Scripture →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Confession / Catechism View Modal  (read-only, from NoteBody)
══════════════════════════════════════════════════════════════ */
function ConfessionModal({ conf, onClose, onNavigate, zOverride }) {
  if (!conf) return null
  const { confType, chapter, para } = conf
  const label = confRefLabel(confType, chapter, para)
  const entry = getConfEntry(confType, chapter, para)
  const ct    = CONF_TYPES[confType] ?? CONF_TYPES['2lbcf']
  const isCatechism = confType === 'orthodox' || confType === 'keach'

  return (
    <div style={zOverride ? { ...vm.backdrop, zIndex: zOverride } : vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        <div style={vm.header}>
          <span style={{ ...vm.ref, color: ct.color }}>{label}</span>
          <button style={vm.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={vm.body}>
          {!entry ? (
            <p style={vm.loading}>Entry not found.</p>
          ) : isCatechism ? (
            <>
              <p style={{ fontSize: '0.88em', fontWeight: 700, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
                Q. {entry.q}
              </p>
              <p style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.7, fontSize: '0.88em' }}>
                A. {entry.a}
              </p>
            </>
          ) : (
            <p style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.72, fontSize: '0.88em' }}>
              {entry.text}
            </p>
          )}
        </div>
        <div style={vm.actions}>
          <button
            style={{ ...vm.openBtn, background: ct.bg, color: ct.color, border: `1px solid ${ct.border}` }}
            onClick={() => { onNavigate(confType, chapter, para); onClose() }}
          >
            Open in {ct.label} →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ScTag Action Popup  (shown in EDIT MODE when clicking a tag)
══════════════════════════════════════════════════════════════ */
function ScTagActionPopup({ sc, onClose, onDelete, onEdit }) {
  const [editBook,    setEditBook]    = useState(sc.book)
  const [editChapter, setEditChapter] = useState(sc.chapter)
  const [editVerse,   setEditVerse]   = useState(String(sc.verse))
  const [editVerseTo, setEditVerseTo] = useState(sc.verseTo ? String(sc.verseTo) : '')

  const editSelectedBook = BIBLE_BOOKS.find(b => b.name === editBook) ?? BIBLE_BOOKS[0]
  const maxEditChapters  = editSelectedBook.chapters

  function handleUpdate() {
    const vNum  = Math.max(1, parseInt(editVerse)  || 1)
    const vtNum = editVerseTo === '' ? null : Math.max(vNum, parseInt(editVerseTo) || vNum)
    onEdit({ book: editBook, chapter: editChapter, verse: vNum, verseTo: vtNum })
    onClose()
  }

  const labelStyle  = { fontSize: 9, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }
  const inputStyle  = { border: 'none', background: 'transparent', outline: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'var(--ink)', textAlign: 'center', width: 0, flex: 1, minWidth: 0 }
  const stepperWrap = { display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--parchment)', overflow: 'hidden' }
  const stepBtn     = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 20, lineHeight: 1, padding: '6px 10px', fontFamily: 'sans-serif', flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none' }

  function stepVerse(delta) {
    setEditVerse(v => String(Math.max(1, Math.min(200, (parseInt(v) || 1) + delta))))
  }
  function stepVerseTo(delta) {
    setEditVerseTo(v => {
      const cur = v === '' ? (parseInt(editVerse) || 1) : (parseInt(v) || 1)
      const next = Math.max(1, Math.min(200, cur + delta))
      return String(next)
    })
  }

  return (
    <div style={vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>Edit reference</span>
          <button onClick={onClose} style={vm.closeBtn} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Book */}
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>Book</p>
          <select value={editBook} onChange={e => { setEditBook(e.target.value); setEditChapter(1); setEditVerse('1'); setEditVerseTo('') }} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 15, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
            <optgroup label="Old Testament">
              {BIBLE_BOOKS.filter(b => b.testament === 'OT').map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </optgroup>
            <optgroup label="New Testament">
              {BIBLE_BOOKS.filter(b => b.testament === 'NT').map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </optgroup>
          </select>
        </div>

        {/* Chapter + Verse + VerseTo row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>Ch.</p>
            <select value={editChapter} onChange={e => { setEditChapter(Number(e.target.value)); setEditVerse('1'); setEditVerseTo('') }} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 6px', fontSize: 15, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', textAlign: 'center' }}>
              {Array.from({ length: maxEditChapters }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>Vs.</p>
            <div style={stepperWrap}>
              <button style={stepBtn} onClick={() => stepVerse(-1)} aria-label="Decrease verse">−</button>
              <input
                type="number" min={1} max={200} value={editVerse}
                onChange={e => setEditVerse(e.target.value)}
                onBlur={() => setEditVerse(v => String(Math.max(1, parseInt(v) || 1)))}
                style={inputStyle}
              />
              <button style={stepBtn} onClick={() => stepVerse(1)} aria-label="Increase verse">+</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>To (opt)</p>
            <div style={stepperWrap}>
              <button style={stepBtn} onClick={() => stepVerseTo(-1)} aria-label="Decrease end verse">−</button>
              <input
                type="number" min={1} max={200} value={editVerseTo} placeholder="–"
                onChange={e => setEditVerseTo(e.target.value)}
                style={inputStyle}
              />
              <button style={stepBtn} onClick={() => stepVerseTo(1)} aria-label="Increase end verse">+</button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDelete} style={{ ...vm.deleteBtn }}>
            Delete tag
          </button>
          <button onClick={handleUpdate} style={{ ...vm.openBtn, flex: 1 }}>
            Update reference
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Conf Tag Action Popup  (shown in EDIT MODE when clicking a conf tag)
══════════════════════════════════════════════════════════════ */
function ConfTagActionPopup({ conf, onClose, onDelete, onEdit }) {
  const [mode,        setMode]        = useState('view')
  const [navChapter,  setNavChapter]  = useState(conf.chapter ?? 1)
  const [editType,    setEditType]    = useState(conf.confType)
  const [editChapter, setEditChapter] = useState(conf.chapter ?? 1)
  const [editPara,    setEditPara]    = useState(String(conf.para))
  const taggedParaRef = useRef(null)

  const ct          = CONF_TYPES[conf.confType] ?? CONF_TYPES['2lbcf']
  const editCt      = CONF_TYPES[editType]      ?? CONF_TYPES['2lbcf']
  const label       = confRefLabel(conf.confType, conf.chapter, conf.para)
  const isCatechism = conf.confType === 'orthodox' || conf.confType === 'keach'
  const is2lbcf     = conf.confType === '2lbcf'

  // For 2LBCF: load all paragraphs for the nav chapter; otherwise all entries for flat list
  const chapterParas  = is2lbcf ? get2lbcfChapterParas(navChapter) : null
  const flatEntries   = !is2lbcf ? getAllConfEntries(conf.confType) : null
  const maxChapter    = 32 // 2LBCF has 32 chapters

  // Scroll tagged entry into view on open / chapter change
  useEffect(() => {
    if (taggedParaRef.current) {
      taggedParaRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [navChapter])

  function handleUpdate() {
    const pNum  = Math.max(1, parseInt(editPara)    || 1)
    const chNum = editType === '2lbcf' ? Math.max(1, parseInt(editChapter) || 1) : null
    onEdit({ confType: editType, chapter: chNum, para: pNum })
    onClose()
  }

  const labelStyle = { fontSize: 9, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }
  const inputStyle = { border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'DM Sans', sans-serif", width: '100%' }

  return (
    <div style={vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        {mode === 'view' ? (
          <>
            <div style={vm.header}>
              {is2lbcf && (
                <button
                  style={{ ...vm.navArrow, opacity: navChapter <= 1 ? 0.25 : 1 }}
                  disabled={navChapter <= 1}
                  onClick={() => setNavChapter(c => Math.max(1, c - 1))}
                >‹</button>
              )}
              <span style={{ ...vm.ref, color: ct.color, flex: 1, textAlign: is2lbcf ? 'center' : 'left' }}>
                {is2lbcf
                  ? `${ct.label} ${navChapter}`
                  : label}
              </span>
              {is2lbcf && (
                <button
                  style={{ ...vm.navArrow, opacity: navChapter >= maxChapter ? 0.25 : 1 }}
                  disabled={navChapter >= maxChapter}
                  onClick={() => setNavChapter(c => Math.min(maxChapter, c + 1))}
                >›</button>
              )}
              <button style={vm.closeBtn} onClick={onClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div style={vm.body}>
              {is2lbcf ? (
                chapterParas?.length ? chapterParas.map(p => {
                  const isTagged = navChapter === conf.chapter && p.para === conf.para
                  return (
                    <div
                      key={p.para}
                      ref={isTagged ? taggedParaRef : null}
                      style={{
                        marginBottom: 12,
                        ...(isTagged ? { background: ct.bg, borderLeft: `3px solid ${ct.border}`, padding: '4px 8px', borderRadius: 4, marginLeft: -8 } : {}),
                      }}
                    >
                      <span style={{ fontSize: '0.72em', fontWeight: 700, color: ct.color, marginRight: 5 }}>{navChapter}.{p.para}</span>
                      <span style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.72, fontSize: '0.88em' }}>{p.text}</span>
                    </div>
                  )
                }) : <p style={vm.loading}>Chapter not found.</p>
              ) : flatEntries?.map(p => {
                const isTagged = p.para === conf.para
                return (
                  <div
                    key={p.para}
                    ref={isTagged ? taggedParaRef : null}
                    style={{
                      marginBottom: 14,
                      ...(isTagged ? { background: ct.bg, borderLeft: `3px solid ${ct.border}`, padding: '4px 8px', borderRadius: 4, marginLeft: -8 } : {}),
                    }}
                  >
                    <span style={{ fontSize: '0.72em', fontWeight: 700, color: ct.color, marginRight: 5 }}>
                      {isCatechism ? `Q.${p.para}` : `Art. ${p.para}`}
                    </span>
                    {isCatechism ? (
                      <>
                        <span style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.6, fontSize: '0.88em', display: 'block', fontWeight: 600, marginBottom: 2 }}>{p.q}</span>
                        <span style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.6, fontSize: '0.85em', color: 'var(--ink-muted)', display: 'block' }}>{p.a}</span>
                      </>
                    ) : (
                      <span style={{ ...vm.verseText, fontStyle: 'normal', lineHeight: 1.72, fontSize: '0.88em' }}>{p.text}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ ...vm.actions, justifyContent: 'space-between' }}>
              <button onClick={onDelete} style={vm.deleteBtn}>Delete tag</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setMode('edit')} style={{ ...vm.openBtn, background: 'var(--parchment-dark)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>Edit ref →</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <button onClick={() => setMode('view')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: 13, fontWeight: 700, padding: 0, fontFamily: "'DM Sans', sans-serif", marginRight: 8 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>Edit reference</span>
              <button style={vm.closeBtn} onClick={onClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={labelStyle}>Confession / Catechism</p>
              <select value={editType} onChange={e => { setEditType(e.target.value); setEditChapter(1); setEditPara('1') }} style={{ ...inputStyle, cursor: 'pointer' }}>
                {Object.entries(CONF_TYPES).map(([id, info]) => (
                  <option key={id} value={id}>{info.label} — {info.fullName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {editType === '2lbcf' && (
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Ch.</p>
                  <select value={editChapter} onChange={e => { setEditChapter(Number(e.target.value)); setEditPara('1') }} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {Array.from({ length: 32 }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={labelStyle}>{editCt.hasParagraphs ? 'Para.' : 'Q.'}</p>
                <input type="number" min={1} max={editCt.maxItems ?? 999} value={editPara}
                  onChange={e => setEditPara(e.target.value)}
                  onBlur={() => setEditPara(v => String(Math.max(1, parseInt(v) || 1)))}
                  style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMode('view')} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleUpdate} style={{ flex: 2, background: editCt.bg, border: `1px solid ${editCt.border}`, borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: editCt.color, fontFamily: "'DM Sans', sans-serif" }}>Update reference</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Note Body — renders plain OR rich note; intercepts @ref clicks
══════════════════════════════════════════════════════════════ */
function NoteBody({ rawNote, query, onScriptureClick, onConfessionClick, clip = true }) {
  const [expanded, setExpanded] = useState(false)

  if (!rawNote) return null

  /* Rich note (HTML stored with RICH_PREFIX) */
  if (isRichNote(rawNote)) {
    const { title, body, labels = [] } = parseRichNote(rawNote)

    function handleClick(e) {
      const scEl = e.target.closest('[data-sc-book]')
      if (scEl) {
        e.preventDefault()
        onScriptureClick?.({
          book:    scEl.dataset.scBook,
          chapter: parseInt(scEl.dataset.scChapter),
          verse:   parseInt(scEl.dataset.scVerse),
          verseTo: scEl.dataset.scVerseTo ? parseInt(scEl.dataset.scVerseTo) : null,
        })
        return
      }
      const confEl = e.target.closest('[data-conf-type]')
      if (confEl) {
        e.preventDefault()
        onConfessionClick?.({
          confType: confEl.dataset.confType,
          chapter:  confEl.dataset.confChapter ? parseInt(confEl.dataset.confChapter) : null,
          para:     parseInt(confEl.dataset.confPara),
        })
      }
    }

    return (
      <div>
        {title && <p style={s.richTitle}>{title}</p>}
        {labels.length > 0 && (
          <div style={s.noteLabelRow}>
            {labels.map(lb => {
              const c = getLabelColor(lb)
              return (
                <span key={lb} style={{ ...s.noteLabelChip, background: c.bg, color: c.color, borderColor: c.border }}>
                  {lb}
                </span>
              )
            })}
          </div>
        )}
        {/* eslint-disable-next-line react/no-danger */}
        <div
          style={s.richBody}
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: body || '' }}
          onClick={handleClick}
        />
      </div>
    )
  }

  /* Plain text note */
  const isLong  = rawNote.length > CLIP_CHARS
  const showFull = !isLong || expanded || !!query || !clip
  const display  = showFull ? rawNote : rawNote.slice(0, CLIP_CHARS).trimEnd() + '…'
  return (
    <>
      <p style={s.noteBody}>
        <Highlighted text={display} query={query} />
      </p>
      {isLong && !query && clip && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(ex => !ex) }}
          style={s.seeMoreBtn}
        >
          {expanded ? 'See less ↑' : 'See more ↓'}
        </button>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   @ Scripture Mention Popup
══════════════════════════════════════════════════════════════ */
function AtMentionPopup({ pos, query, onSelect, onClose, chapterTag }) {
  const [step,      setStep]      = useState('book')  // 'book' | 'ref' | 'conf'
  const [book,      setBook]      = useState('')
  const [chapter,   setChapter]   = useState(1)
  const [verse,     setVerse]     = useState('1')     // string so user can clear & retype
  const [verseTo,   setVerseTo]   = useState('')      // '' = single verse
  const [forceEdit, setForceEdit] = useState(false)
  const [versePreview, setVersePreview] = useState(null)
  // Confession picker state
  const [confPickType,    setConfPickType]    = useState('2lbcf')
  const [confPickChapter, setConfPickChapter] = useState(1)
  const [confPickPara,    setConfPickPara]    = useState('1')
  const ref = useRef(null)

  /* Detect fully-typed inline scripture reference */
  const resolved    = useMemo(() => parseAtQueryWithChapterTag(query, chapterTag), [query, chapterTag])
  /* Detect confession reference (complete or partial) */
  const confResolved = useMemo(() => parseAtQueryConfession(query), [query])
  const showScResolved  = resolved    && !forceEdit
  const showConfResolved = confResolved?.complete && !forceEdit

  /* Fetch verse text for preview when scripture reference is resolved */
  useEffect(() => {
    if (!showScResolved || !resolved) { setVersePreview(null); return }
    let cancelled = false
    fetchVerseText(resolved.book, resolved.chapter, resolved.verse, getDefaultReaderVersion())
      .then(t => { if (!cancelled) setVersePreview(t) })
    return () => { cancelled = true }
  }, [showScResolved, resolved?.book, resolved?.chapter, resolved?.verse]) // eslint-disable-line

  /* Sync confession picker defaults when conf type is detected in query */
  useEffect(() => {
    if (confResolved && !confResolved.complete) {
      setConfPickType(confResolved.confType)
      setConfPickChapter(1)
      setConfPickPara('1')
    }
  }, [confResolved?.confType]) // eslint-disable-line

  /* Filter books by query (only when not in resolved mode) */
  const filteredBooks = useMemo(() => {
    if (showScResolved || showConfResolved) return BIBLE_BOOKS
    const q = (step === 'book' ? query : '').toLowerCase()
    if (!q) return BIBLE_BOOKS
    const qNorm = stripAbbrevPeriods(q)
    return BIBLE_BOOKS.filter(b => {
      const bn = b.name.toLowerCase()
      if (bn.startsWith(qNorm)) return true
      // Also match if any abbreviation for this book starts with qNorm
      return Object.entries(BOOK_ABBREVS).some(([abbr, full]) =>
        full === b.name && abbr.startsWith(qNorm.split(' ')[0])
      )
    })
  }, [query, step, showScResolved, showConfResolved])

  /* Click-outside to close */
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const selectedBook = BIBLE_BOOKS.find(b => b.name === book) ?? BIBLE_BOOKS[0]
  const maxChapters  = selectedBook.chapters

  // Prefer showing ABOVE the cursor so the popup never covers what the user is typing.
  // Fall back to below only when there isn't enough vertical room above.
  const POPUP_MAX_H = 320
  const spaceAbove  = pos.top - 6
  const spaceBelow  = window.innerHeight - pos.bottom - 4
  const showAbove   = spaceAbove >= 160 // at least 160 px above → show above
  const style = {
    ...am.popup,
    top:    showAbove ? undefined       : pos.bottom + 4,
    bottom: showAbove ? window.innerHeight - pos.top + 6 : undefined,
    left:   Math.max(8, Math.min(pos.left, window.innerWidth - 270)),
    // Cap height so it doesn't overflow on small screens
    maxHeight: showAbove ? Math.min(POPUP_MAX_H, spaceAbove) : Math.min(POPUP_MAX_H, spaceBelow),
    overflowY: 'auto',
  }

  /* ── Resolved scripture reference ── */
  if (showScResolved) {
    const { book: rb, chapter: rc, verse: rv, verseTo: rvt } = resolved
    const label = rvt ? `${rb} ${rc}:${rv}–${rvt}` : `${rb} ${rc}:${rv}`
    return (
      <div ref={ref} style={style}>
        <p style={am.label}>Detected reference</p>
        <p style={am.resolvedRef}>{label}</p>
        {versePreview && (
          <p style={am.versePreview}>
            "{versePreview.length > 130 ? versePreview.slice(0, 130) + '…' : versePreview}"
          </p>
        )}
        <div style={am.insertRow}>
          <button style={am.insertBtn}
            onClick={() => onSelect({ book: rb, chapter: rc, verse: rv, verseTo: rvt, quoteMode: false })}>
            Insert tag
          </button>
          <button style={{ ...am.insertBtn, ...am.insertBtnAlt }}
            onClick={() => onSelect({ book: rb, chapter: rc, verse: rv, verseTo: rvt, quoteMode: true })}>
            Quote verse{rvt ? 's' : ''}
          </button>
        </div>
        {'ontouchstart' in window ? null : (
          <p style={am.kbHint}>
            <kbd style={am.kbd}>Space</kbd> or <kbd style={am.kbd}>↵</kbd> to insert tag
          </p>
        )}
        <button style={am.editRefBtn} onClick={() => setForceEdit(true)}>← Choose differently</button>
      </div>
    )
  }

  /* ── Resolved confession reference ── */
  if (showConfResolved) {
    const { confType, chapter: cc, para: cp } = confResolved
    const ct      = CONF_TYPES[confType] ?? CONF_TYPES['2lbcf']
    const refLbl  = confRefLabel(confType, cc, cp)
    const preview = getConfPreviewText(confType, cc, cp, 130)
    const isCatechism = confType === 'orthodox' || confType === 'keach'
    return (
      <div ref={ref} style={style}>
        <p style={am.label}>Detected confession reference</p>
        <p style={{ ...am.resolvedRef, color: ct.color }}>{refLbl}</p>
        {preview && (
          <p style={am.versePreview}>
            "{preview}"
          </p>
        )}
        <div style={am.insertRow}>
          <button style={{ ...am.insertBtn, background: ct.bg, color: ct.color, border: `1px solid ${ct.border}` }}
            onClick={() => onSelect({ confType, chapter: cc, para: cp, quoteMode: false })}>
            Insert tag
          </button>
          <button style={{ ...am.insertBtn, ...am.insertBtnAlt }}
            onClick={() => onSelect({ confType, chapter: cc, para: cp, quoteMode: true })}>
            Quote {isCatechism ? 'answer' : 'paragraph'}
          </button>
        </div>
        {'ontouchstart' in window ? null : (
          <p style={am.kbHint}>
            <kbd style={am.kbd}>Space</kbd> or <kbd style={am.kbd}>↵</kbd> to insert tag
          </p>
        )}
        <button style={am.editRefBtn} onClick={() => setForceEdit(true)}>← Choose differently</button>
      </div>
    )
  }

  /* ── Confession picker (partial conf query detected, or 'conf' step) ── */
  if ((confResolved && !confResolved.complete && !forceEdit) || step === 'conf') {
    const activeType = confResolved?.confType ?? confPickType
    const ct         = CONF_TYPES[activeType] ?? CONF_TYPES['2lbcf']
    const isCatechism = activeType === 'orthodox' || activeType === 'keach'
    const pNum = Math.max(1, parseInt(confPickPara) || 1)
    const chNum = activeType === '2lbcf' ? Math.max(1, parseInt(confPickChapter) || 1) : null
    const inputStyleConf = { border: '1px solid var(--border-strong)', borderRadius: 5, padding: '5px 8px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', outline: 'none', fontFamily: "'DM Sans', sans-serif", width: '100%' }
    return (
      <div ref={ref} style={style}>
        {step === 'conf' && (
          <button style={am.backBtn} onClick={() => setStep('book')}>← Back</button>
        )}
        <p style={am.label}>{ct.label} — {ct.fullName}</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {activeType === '2lbcf' && (
            <div style={{ flex: 1 }}>
              <label style={am.refLabel}>Ch.</label>
              <select value={confPickChapter} onChange={e => setConfPickChapter(Number(e.target.value))} style={{ ...inputStyleConf, cursor: 'pointer' }}>
                {Array.from({ length: 32 }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={am.refLabel}>{isCatechism ? 'Q.' : 'Para.'}</label>
            <input type="number" min={1} max={ct.maxItems ?? 999} value={confPickPara}
              onChange={e => setConfPickPara(e.target.value)}
              onBlur={() => setConfPickPara(v => String(Math.max(1, parseInt(v) || 1)))}
              style={inputStyleConf} />
          </div>
        </div>
        {/* Live preview of the selected entry */}
        {(() => {
          const prev = getConfPreviewText(activeType, chNum, pNum, 90)
          return prev ? <p style={am.versePreview}>"{prev}"</p> : null
        })()}
        <div style={am.insertRow}>
          <button style={{ ...am.insertBtn, background: ct.bg, color: ct.color, border: `1px solid ${ct.border}` }}
            onClick={() => onSelect({ confType: activeType, chapter: chNum, para: pNum, quoteMode: false })}>
            Insert tag
          </button>
          <button style={{ ...am.insertBtn, ...am.insertBtnAlt }}
            onClick={() => onSelect({ confType: activeType, chapter: chNum, para: pNum, quoteMode: true })}>
            Quote {isCatechism ? 'answer' : 'paragraph'}
          </button>
        </div>
      </div>
    )
  }

  /* ── Book picker ── */
  if (step === 'book') {
    return (
      <div ref={ref} style={style}>
        <p style={am.label}>Select book  <span style={am.hintSmall}>or type @Book Ch:Vs · @2LBCF 1:1 · @Keach1</span></p>
        {/* Confession quick-pick buttons */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(CONF_TYPES).map(([id, info]) => (
            <button key={id}
              style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, border: `1px solid ${info.border}`, background: info.bg, color: info.color, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              onClick={() => { setConfPickType(id); setConfPickChapter(1); setConfPickPara('1'); setStep('conf') }}>
              {info.label}
            </button>
          ))}
        </div>
        <div style={am.bookList}>
          {filteredBooks.slice(0, 12).map(b => (
            <button key={b.name} style={am.bookBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setBook(b.name); setStep('ref') }}>
              {b.name}
            </button>
          ))}
          {filteredBooks.length === 0 && <p style={am.empty}>No books match</p>}
        </div>
      </div>
    )
  }

  /* ── Chapter / verse picker ── */
  return (
    <div ref={ref} style={style}>
      <button style={am.backBtn} onClick={() => setStep('book')}>← {book}</button>
      <p style={am.label}>Chapter &amp; verse</p>
      <div style={am.refRow}>
        <div style={am.refGroup}>
          <label style={am.refLabel}>Ch.</label>
          <select
            value={chapter}
            onChange={e => { setChapter(Number(e.target.value)); setVerse('1'); setVerseTo('') }}
            style={am.refSelect}
          >
            {Array.from({ length: maxChapters }, (_, i) => i + 1).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={am.refGroup}>
          <label style={am.refLabel}>From</label>
          <input
            type="number" min={1} max={200} value={verse}
            onChange={e => setVerse(e.target.value)}
            onBlur={() => setVerse(v => String(Math.max(1, parseInt(v) || 1)))}
            style={am.refInput}
          />
        </div>
        <div style={am.refGroup}>
          <label style={am.refLabel}>To (opt)</label>
          <input
            type="number" min={1} max={200} value={verseTo} placeholder="–"
            onChange={e => setVerseTo(e.target.value)}
            onBlur={() => {
              if (verseTo === '') return
              const v = Math.max(1, parseInt(verse) || 1)
              setVerseTo(String(Math.max(v, parseInt(verseTo) || v)))
            }}
            style={am.refInput}
          />
        </div>
      </div>
      <div style={am.insertRow}>
        {(() => {
          const vNum  = Math.max(1, parseInt(verse)  || 1)
          const vtNum = verseTo === '' ? null : Math.max(vNum, parseInt(verseTo) || vNum)
          return (<>
            <button style={am.insertBtn}
              onClick={() => onSelect({ book, chapter, verse: vNum, verseTo: vtNum, quoteMode: false })}>
              Insert tag
            </button>
            <button style={{ ...am.insertBtn, ...am.insertBtnAlt }}
              onClick={() => onSelect({ book, chapter, verse: vNum, verseTo: vtNum, quoteMode: true })}>
              Quote verse{vtNum ? 's' : ''}
            </button>
          </>)
        })()}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Rich Text Editor Toolbar
══════════════════════════════════════════════════════════════ */
const TOOLBAR_ACTIONS = [
  { id: 'p',      label: 'P',    title: 'Paragraph',   cmd: 'formatBlock', val: 'P' },
  { id: 'h1',     label: 'H1',   title: 'Heading 1',   cmd: 'formatBlock', val: 'H1' },
  { id: 'h2',     label: 'H2',   title: 'Heading 2',   cmd: 'formatBlock', val: 'H2' },
  { id: 'bold',   label: <b>B</b>,   title: 'Bold',    cmd: 'bold' },
  { id: 'italic', label: <em>I</em>, title: 'Italic',  cmd: 'italic' },
  { id: 'ul',     label: '•',    title: 'Bullet list', cmd: 'insertUnorderedList' },
  { id: 'ol',     label: '1.',   title: 'Numbered list', cmd: 'insertOrderedList' },
]

/* ══════════════════════════════════════════════════════════════
   Rich Note Editor Component
══════════════════════════════════════════════════════════════ */
const RichNoteEditor = React.forwardRef(function RichNoteEditor(
  { initialTitle = '', initialBody = '', onTitleChange, onBodyChange, chapterTag, showToolbar = true, onActiveFormatsChange, headerSlot },
  editorImperativeRef
) {
  const editorRef  = useRef(null)
  const savedRange = useRef(null)

  /* Initialise editor HTML once */
  useEffect(() => {
    if (editorRef.current && initialBody) {
      editorRef.current.innerHTML = initialBody
    }
  }, []) // eslint-disable-line

  /* ── Active format state (bold, italic, h1, h2, p, ul, ol) ── */
  const [activeFormats, setActiveFormats] = useState({})

  function checkFormats() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) { setActiveFormats({}); onActiveFormatsChange?.({}); return }
    const node = sel.getRangeAt(0).commonAncestorContainer
    if (!editorRef.current?.contains(node)) return
    try {
      const blockVal = document.queryCommandValue('formatBlock').toLowerCase()
      const newFmts = {
        bold:   document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul:     document.queryCommandState('insertUnorderedList'),
        ol:     document.queryCommandState('insertOrderedList'),
        h1:     blockVal === 'h1',
        h2:     blockVal === 'h2',
        p:      blockVal === 'p' || blockVal === '',
      }
      setActiveFormats(newFmts)
      onActiveFormatsChange?.(newFmts)
    } catch { setActiveFormats({}); onActiveFormatsChange?.({}) }
  }

  /* Listen to selection changes to update active states */
  useEffect(() => {
    document.addEventListener('selectionchange', checkFormats)
    return () => document.removeEventListener('selectionchange', checkFormats)
  }, []) // eslint-disable-line

  /* @ mention state */
  const [atPopup,   setAtPopup]   = useState(null) // { bottom, left } | null
  const [atQuery,   setAtQuery]   = useState('')
  const atRangeRef = useRef(null)  // saved Range at the @ sign

  const navigate = useNavigate()

  /* sc-tag click popup (edit mode) */
  const [scTagPopup,   setScTagPopup]   = useState(null) // scripture tag → ScriptureVerseModal
  const [scEditPopup,  setScEditPopup]  = useState(null) // scripture tag edit form → ScTagActionPopup
  const [confTagPopup, setConfTagPopup] = useState(null) // confession tag popup

  function handleEditorClick(e) {
    const tagEl = e.target.closest('[data-sc-book]')
    if (tagEl && editorRef.current?.contains(tagEl)) {
      e.stopPropagation()
      const rect = tagEl.getBoundingClientRect()
      const isQuote = tagEl.tagName === 'BLOCKQUOTE' || tagEl.classList.contains('sc-quote')
      setScTagPopup({
        book:    tagEl.dataset.scBook,
        chapter: parseInt(tagEl.dataset.scChapter),
        verse:   parseInt(tagEl.dataset.scVerse),
        verseTo: tagEl.dataset.scVerseTo ? parseInt(tagEl.dataset.scVerseTo) : null,
        anchorRect: rect, el: tagEl, isQuote,
      })
      setConfTagPopup(null)
      return
    }
    const confEl = e.target.closest('[data-conf-type]')
    if (confEl && editorRef.current?.contains(confEl)) {
      e.stopPropagation()
      const rect = confEl.getBoundingClientRect()
      const isQuote = confEl.tagName === 'BLOCKQUOTE' || confEl.classList.contains('sc-quote')
      setConfTagPopup({
        confType: confEl.dataset.confType,
        chapter:  confEl.dataset.confChapter ? parseInt(confEl.dataset.confChapter) : null,
        para:     parseInt(confEl.dataset.confPara),
        anchorRect: rect, el: confEl, isQuote,
      })
      setScTagPopup(null)
      return
    }
    if (!e.target.closest('[data-sctag-popup]')) {
      setScTagPopup(null)
      setConfTagPopup(null)
    }
  }

  /* Prevents the cursor from landing inside a tag/quote element on mousedown.
     Also blocks all editor interaction while a tag popup is open so nothing
     bleeds through behind the popup. onClick still fires normally. */
  function handleEditorMouseDown(e) {
    // While a tag popup is open: block cursor/focus changes entirely
    if (scTagPopup || confTagPopup) {
      e.preventDefault()
      return
    }
    // Clicking on a tag or quote: prevent cursor placement; let onClick handle the popup
    const tagEl = e.target.closest('[data-sc-book],[data-conf-type]')
    if (tagEl && editorRef.current?.contains(tagEl)) {
      e.preventDefault()
    }
  }

  function deleteScTag(el) {
    if (!el || !editorRef.current?.contains(el)) return
    const blockEl = el.closest('blockquote') ?? el
    blockEl.parentNode?.removeChild(blockEl)
    onBodyChange(editorRef.current.innerHTML)
  }

  async function editScTag(el, newSc, isQuote) {
    if (!el || !editorRef.current?.contains(el)) return
    if (!isQuote) {
      const newLabel = newSc.verseTo
        ? `${newSc.book} ${newSc.chapter}:${newSc.verse}–${newSc.verseTo}`
        : `${newSc.book} ${newSc.chapter}:${newSc.verse}`
      el.dataset.scBook    = newSc.book
      el.dataset.scChapter = String(newSc.chapter)
      el.dataset.scVerse   = String(newSc.verse)
      if (newSc.verseTo) el.dataset.scVerseTo = String(newSc.verseTo)
      else delete el.dataset.scVerseTo
      el.textContent = newLabel
      onBodyChange(editorRef.current.innerHTML)
    } else {
      // Select the existing blockquote so handleAtSelect replaces it in place
      const range = document.createRange()
      range.selectNode(el)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      atRangeRef.current = range
      editorRef.current.focus()
      await handleAtSelect({ ...newSc, quoteMode: true })
    }
  }

  function deleteConfTag(el) {
    if (!el || !editorRef.current?.contains(el)) return
    const blockEl = el.closest('blockquote') ?? el
    blockEl.parentNode?.removeChild(blockEl)
    onBodyChange(editorRef.current.innerHTML)
  }

  async function editConfTag(el, newConf, isQuote) {
    if (!el || !editorRef.current?.contains(el)) return
    if (!isQuote) {
      const newLabel = confRefLabel(newConf.confType, newConf.chapter, newConf.para)
      const ct = CONF_TYPES[newConf.confType] ?? CONF_TYPES['2lbcf']
      el.dataset.confType    = newConf.confType
      if (newConf.chapter != null) el.dataset.confChapter = String(newConf.chapter)
      else delete el.dataset.confChapter
      el.dataset.confPara    = String(newConf.para)
      el.textContent         = newLabel
      el.style.background    = ct.bg
      el.style.color         = ct.color
      el.style.borderColor   = ct.border
      onBodyChange(editorRef.current.innerHTML)
    } else {
      // Select the existing blockquote so handleAtSelect replaces it in place
      const range = document.createRange()
      range.selectNode(el)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      atRangeRef.current = range
      editorRef.current.focus()
      await handleAtSelect({ ...newConf, quoteMode: true })
    }
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    if (!savedRange.current) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(savedRange.current)
  }

  function execCmd(cmd, val) {
    // Only restore saved range if the editor doesn't already have an active selection.
    // Calling restoreSelection() when text is highlighted overwrites the live selection
    // with a stale saved range, which breaks bold/italic on highlighted text.
    const sel = window.getSelection()
    const inEditor = sel?.rangeCount > 0 &&
      editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
    if (!inEditor) restoreSelection()
    editorRef.current?.focus()
    document.execCommand(cmd, false, val ?? null)
    checkFormats()
    onBodyChange(editorRef.current?.innerHTML || '')
  }

  function execUndo() {
    editorRef.current?.focus()
    document.execCommand('undo', false, null)
    onBodyChange(editorRef.current.innerHTML)
  }

  function execRedo() {
    editorRef.current?.focus()
    document.execCommand('redo', false, null)
    onBodyChange(editorRef.current.innerHTML)
  }

  function handleInput() {
    onBodyChange(editorRef.current.innerHTML)
    checkAtMention()
  }

  function checkAtMention() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) {
      // If popup is already visible, don't close on lost selection — the user may have
      // tapped inside the popup (blurring the editor). Let the click-outside handler decide.
      if (!atPopup) setAtPopup(null)
      return
    }
    const range = sel.getRangeAt(0)
    const node  = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) {
      if (!atPopup) setAtPopup(null)
      return
    }
    const text = node.textContent || ''
    const idx  = text.lastIndexOf('@', range.startOffset - 1)
    if (idx === -1) { setAtPopup(null); return }

    const between = text.slice(idx + 1, range.startOffset)

    // Allow spaces if:
    //  (a) the query already starts with a complete book name  ("Genesis 1:1" — chapter/verse follows), OR
    //  (b) the query is still a prefix of a numbered book name ("1 " → "1 Corinthians", "1 Kings", …)
    //  (c) the query matches an abbreviated form with or without trailing period ("Gen.", "1 Cor.", "2 Kgs.")
    if (between.includes(' ')) {
      const q     = between.toLowerCase()
      const qNorm = stripAbbrevPeriods(q)          // strip periods for abbrev matching
      const valid = BOOKS_BY_LENGTH.some(bk => {
        const bn = bk.name.toLowerCase()
        return q.startsWith(bn) || bn.startsWith(q) ||
               qNorm.startsWith(bn) || bn.startsWith(qNorm)
      }) || Object.keys(BOOK_ABBREVS).some(abbr => {
        return qNorm.startsWith(abbr) || abbr.startsWith(qNorm.split(' ')[0])
      }) || isConfQueryWithSpace(between)  // also allow conf prefixes like "2LBCF 1:2"
      if (!valid) { setAtPopup(null); return }
    }

    // Compute popup anchor from the @ character
    // Use viewport-relative coords (popup is position:fixed — do NOT add scrollY)
    const atRange = range.cloneRange()
    atRange.setStart(node, idx)
    atRange.setEnd(node, idx + 1)
    const rect = atRange.getBoundingClientRect()

    // Save the range at @ so we can delete "@query" when inserting
    const deleteRange = range.cloneRange()
    deleteRange.setStart(node, idx)
    deleteRange.setEnd(node, range.startOffset)
    atRangeRef.current = deleteRange

    setAtQuery(between)
    // Store both top and bottom so the popup can flip above the cursor if needed
    setAtPopup({ top: rect.top, bottom: rect.bottom, left: rect.left })
  }

  async function handleAtSelect({ book, chapter, verse, verseTo, quoteMode, confType, para }) {
    setAtPopup(null)
    editorRef.current?.focus()

    // Delete the "@query" text the user typed
    if (atRangeRef.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(atRangeRef.current)
      document.execCommand('delete', false)
    }

    /* ── Confession / Catechism tag ── */
    if (confType) {
      const ct       = CONF_TYPES[confType] ?? CONF_TYPES['2lbcf']
      const refLbl   = confRefLabel(confType, chapter, para)
      const chAttr   = chapter != null ? ` data-conf-chapter="${chapter}"` : ''
      if (quoteMode) {
        const text = getConfFullText(confType, chapter, para)
        const innerHtml = text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : refLbl
        document.execCommand('insertHTML', false,
          `<blockquote class="sc-quote" data-conf-type="${confType}"${chAttr} data-conf-para="${para}" ` +
          `contenteditable="false" ` +
          `style="margin:6px 0;padding:8px 12px;border-left:3px solid ${ct.border};` +
          `background:${ct.bg};border-radius:0 6px 6px 0;font-style:normal;` +
          `font-size:0.9em;color:var(--ink-muted);cursor:pointer;line-height:1.65;">${innerHtml} ` +
          `<em style="display:block;margin-top:5px;font-style:normal;font-weight:700;font-size:0.82em;color:${ct.color};">— ${refLbl}</em></blockquote>&#8203;`
        )
      } else {
        document.execCommand('insertHTML', false,
          `<span class="sc-tag" data-conf-type="${confType}"${chAttr} data-conf-para="${para}" ` +
          `contenteditable="false" style="display:inline-block;padding:1px 8px;margin:0 2px;` +
          `background:${ct.bg};color:${ct.color};border:1px solid ${ct.border};` +
          `border-radius:99px;font-size:0.82em;font-weight:700;cursor:pointer;` +
          `font-family:'DM Sans',sans-serif;user-select:none;">` +
          `${refLbl}</span>&#8203;`
        )
      }
      onBodyChange(editorRef.current.innerHTML)
      atRangeRef.current = null
      return
    }

    /* ── Scripture tag ── */
    const isRange  = verseTo && verseTo !== verse
    const refLabel = isRange
      ? `${book} ${chapter}:${verse}–${verseTo}`
      : `${book} ${chapter}:${verse}`
    const rangeAttrs = isRange ? ` data-sc-verse-to="${verseTo}"` : ''

    if (quoteMode) {
      const quoteVer  = getDefaultReaderVersion()
      const verAbbrev = versionLabel(quoteVer, book)
      let innerHtml
      if (isRange) {
        const vrs = await fetchVerseRange(book, chapter, verse, verseTo, quoteVer)
        innerHtml = vrs.length > 0
          ? vrs.map(vr => `<sup style="font-size:0.7em;margin-right:2px">${vr.v}</sup>${vr.t}`).join(' ')
          : refLabel
      } else {
        const text = await fetchVerseText(book, chapter, verse, quoteVer)
        innerHtml = text ? `"${text}"` : refLabel
      }
      document.execCommand('insertHTML', false,
        `<blockquote class="sc-quote" data-sc-book="${book}" data-sc-chapter="${chapter}" data-sc-verse="${verse}"${rangeAttrs} ` +
        `contenteditable="false" ` +
        `style="margin:6px 0;padding:8px 12px;border-left:3px solid var(--teal);` +
        `background:var(--teal-light);border-radius:0 6px 6px 0;font-style:italic;` +
        `font-size:0.92em;color:var(--ink-muted);cursor:pointer;overflow-wrap:break-word;word-break:break-word;">${innerHtml} ` +
        `<em style="font-style:normal;font-weight:700;font-size:0.85em;color:var(--teal);">— ${refLabel} <span style="font-weight:400;opacity:0.7;">${verAbbrev}</span></em></blockquote>&#8203;`
      )
    } else {
      document.execCommand('insertHTML', false,
        `<span class="sc-tag" data-sc-book="${book}" data-sc-chapter="${chapter}" data-sc-verse="${verse}"${rangeAttrs} ` +
        `contenteditable="false" style="display:inline-block;padding:1px 8px;margin:0 2px;` +
        `background:var(--teal-light);color:var(--teal);border:1px solid var(--teal);` +
        `border-radius:99px;font-size:0.82em;font-weight:700;cursor:pointer;` +
        `font-family:'DM Sans',sans-serif;user-select:none;">` +
        `${refLabel}</span>&#8203;`
      )
    }
    onBodyChange(editorRef.current.innerHTML)
    atRangeRef.current = null
  }

  /* ── Find the sc-tag/sc-quote element that a Backspace or Delete would hit ──
     Returns the element node if found, null otherwise.
     isBackspace=true  → look at what's before the cursor
     isBackspace=false → look at what's after  the cursor                        */
  function findScElement(range, isBackspace) {
    function isScNode(n) {
      return n && n.nodeType === Node.ELEMENT_NODE && n.dataset &&
        (n.dataset.scBook || n.dataset.confType)
    }

    /* Non-collapsed selection: check if any sc/conf element overlaps with it */
    if (!range.collapsed) {
      try {
        const ancestor = range.commonAncestorContainer
        const container = ancestor.nodeType === Node.ELEMENT_NODE
          ? ancestor : ancestor.parentElement
        if (container) {
          for (const el of container.querySelectorAll('[data-sc-book], [data-conf-type]')) {
            if (range.intersectsNode(el)) return el
          }
        }
      } catch {}
      return null
    }

    const node   = range.startContainer
    const offset = range.startOffset

    if (isBackspace) {
      if (node.nodeType === Node.TEXT_NODE) {
        // At position 0 → previous sibling may be an sc element
        if (offset === 0) return isScNode(node.previousSibling) ? node.previousSibling : null
        // Position 1 and the only character is a zero-width space → same check
        if (offset === 1 && node.textContent[0] === "​")
          return isScNode(node.previousSibling) ? node.previousSibling : null
      } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
        const child = node.childNodes[offset - 1]
        return isScNode(child) ? child : null
      }
    } else { // Delete
      if (node.nodeType === Node.TEXT_NODE && offset === node.textContent.length) {
        return isScNode(node.nextSibling) ? node.nextSibling : null
      } else if (node.nodeType === Node.TEXT_NODE && offset === node.textContent.length - 1 && node.textContent[offset] === "​") {
        // Cursor is just before a trailing zero-width space, next sibling is sc
        return isScNode(node.nextSibling) ? node.nextSibling : null
      } else if (node.nodeType === Node.ELEMENT_NODE && offset < node.childNodes.length) {
        const child = node.childNodes[offset]
        return isScNode(child) ? child : null
      }
    }
    return null
  }

  function showTagPopupForEl(el) {
    const rect    = el.getBoundingClientRect()
    const isQuote = el.tagName === 'BLOCKQUOTE' || el.classList.contains('sc-quote')
    if (el.dataset.confType) {
      setConfTagPopup({
        confType: el.dataset.confType,
        chapter:  el.dataset.confChapter ? parseInt(el.dataset.confChapter) : null,
        para:     parseInt(el.dataset.confPara),
        anchorRect: rect, el, isQuote,
      })
      setScTagPopup(null)
    } else {
      setScTagPopup({
        book:    el.dataset.scBook,
        chapter: parseInt(el.dataset.scChapter),
        verse:   parseInt(el.dataset.scVerse),
        verseTo: el.dataset.scVerseTo ? parseInt(el.dataset.scVerseTo) : null,
        anchorRect: rect, el, isQuote,
      })
      setConfTagPopup(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setAtPopup(null); setScTagPopup(null); setScEditPopup(null); setConfTagPopup(null); return }

    /* ── Backspace / Delete: intercept if it would hit a tag element ── */
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0)
        const scEl  = findScElement(range, e.key === 'Backspace')
        if (scEl && editorRef.current?.contains(scEl)) {
          e.preventDefault()
          showTagPopupForEl(scEl)
          return
        }
      }
    }

    // ── Auto-insert tag on Space or Enter when a full reference is detected ──
    if (atPopup && (e.key === ' ' || (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)))) {
      // Try scripture ref first
      const resolved = parseAtQueryWithChapterTag(atQuery, chapterTag)
      if (resolved) {
        e.preventDefault()
        handleAtSelect({ book: resolved.book, chapter: resolved.chapter, verse: resolved.verse, verseTo: resolved.verseTo, quoteMode: false })
        return
      }
      // Try confession ref
      const confResolved = parseAtQueryConfession(atQuery)
      if (confResolved?.complete) {
        e.preventDefault()
        handleAtSelect({ confType: confResolved.confType, chapter: confResolved.chapter, para: confResolved.para, quoteMode: false })
        return
      }
    }

    saveSelection()
  }

  function handleKeyUp() {
    saveSelection()
    checkAtMention()
  }

  /* Expose execCmd / undo / redo to parent via ref (used by NoteEditOverlay toolbar) */
  React.useImperativeHandle(editorImperativeRef, () => ({
    execCmd,
    execUndo,
    execRedo,
    focus: () => editorRef.current?.focus(),
  }))

  /* Editor border style: connect to toolbar when shown, full border when hidden (overlay mode) */
  const editorStyle = showToolbar
    ? re.editor
    : { ...re.editor, border: 'none', borderBottom: 'none', borderRadius: 0, minHeight: 0, background: 'transparent' }

  return (
    <div style={re.wrap} data-note-editor-wrap="1">
      {/* Title input */}
      <input
        type="text"
        placeholder="Title (optional)"
        defaultValue={initialTitle}
        onChange={e => onTitleChange(e.target.value)}
        style={re.titleInput}
      />

      {/* Meta slot: labels + key chapter — injected between title and body */}
      {headerSlot}

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseDown={handleEditorMouseDown}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseUp={saveSelection}
        onFocus={() => window.dispatchEvent(new CustomEvent('pb-note-editor-focus'))}
        onBlur={e => {
          // Only fire blur if focus truly left the editor wrap (not just moved to toolbar)
          const wrap = e.currentTarget.closest('[data-note-editor-wrap]')
          if (wrap && !wrap.contains(e.relatedTarget)) {
            window.dispatchEvent(new CustomEvent('pb-note-editor-blur'))
          }
        }}
        style={editorStyle}
        className="rich-content"
        data-placeholder="Write your note here…"
      />

      {/* Inline toolbar — only shown when NOT in fullscreen overlay mode */}
      {showToolbar && (
        <div style={re.toolbar}>
          {TOOLBAR_ACTIONS.map(action => (
            <button
              key={action.id}
              title={action.title}
              onMouseDown={e => { e.preventDefault(); execCmd(action.cmd, action.val) }}
              style={{ ...re.toolBtn, ...(activeFormats[action.id] ? re.toolBtnActive : {}) }}
              type="button"
            >
              {action.label}
            </button>
          ))}
          <span style={re.toolDivider} />
          <button title="Undo" aria-label="Undo" onMouseDown={e => { e.preventDefault(); execUndo() }} style={re.toolBtn} type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4.5h6a3.5 3.5 0 010 7H4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 2L2 4.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button title="Redo" aria-label="Redo" onMouseDown={e => { e.preventDefault(); execRedo() }} style={re.toolBtn} type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 4.5H6a3.5 3.5 0 000 7h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 2L12 4.5 9.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={re.toolDivider} />
          <span style={re.atHint}>{chapterTag ? `@ tag · @3 = verse 3 · @1:3 = ch.1 v.3 · @2LBCF 1:1 · @Keach1` : '@ scripture · @2LBCF 1:1 · @Keach1'}</span>
        </div>
      )}

      {/* @ picker popup */}
      {atPopup && (
        <AtMentionPopup
          pos={atPopup}
          query={atQuery}
          onSelect={handleAtSelect}
          onClose={() => setAtPopup(null)}
          chapterTag={chapterTag}
        />
      )}

      {/* sc-tag view: bottom sheet modal (same as read mode) */}
      {scTagPopup && (
        <ScriptureVerseModal
          sc={scTagPopup}
          onClose={() => setScTagPopup(null)}
          onNavigate={(book, ch, vs) => navigate('/scripture', { state: { book, chapter: ch, verse: vs } })}
          onDeleteTag={() => { deleteScTag(scTagPopup.el); setScTagPopup(null) }}
          onEditTag={() => setScEditPopup(scTagPopup)}
          zOverride={9600}
        />
      )}

      {/* sc-tag edit form popup */}
      {scEditPopup && (
        <ScTagActionPopup
          sc={scEditPopup}
          onClose={() => setScEditPopup(null)}
          onDelete={() => { deleteScTag(scEditPopup.el); setScEditPopup(null) }}
          onEdit={newSc => { editScTag(scEditPopup.el, newSc, scEditPopup.isQuote); setScEditPopup(null) }}
        />
      )}

      {/* conf-tag action popup (edit mode) */}
      {confTagPopup && (
        <ConfTagActionPopup
          conf={confTagPopup}
          onClose={() => setConfTagPopup(null)}
          onDelete={() => { deleteConfTag(confTagPopup.el); setConfTagPopup(null) }}
          onEdit={newConf => { editConfTag(confTagPopup.el, newConf, confTagPopup.isQuote); setConfTagPopup(null) }}
        />
      )}
    </div>
  )
})

/* ══════════════════════════════════════════════════════════════
   Note Edit Overlay  — fullscreen fixed overlay (iOS-notes style)
   Title + editor in scrollable area; toolbar fixed at bottom.
══════════════════════════════════════════════════════════════ */
function NoteEditOverlay({ isCreate, scrollKey, onBack, onSave, saving, autoSaved, editorRef, activeFormats, chapterTag, navigate, children }) {
  const [toolbarHidden, setToolbarHidden] = useState(false)
  const scrollAreaRef = useRef(null)
  const overlayRef    = useRef(null)

  /* Unique sessionStorage key — defaults to isCreate flag if not provided */
  const _scrollKey = scrollKey || (isCreate ? 'pb-overlay-scroll:create' : 'pb-overlay-scroll:edit')

  /* Track the visual viewport's position AND size.
     On iOS, when the keyboard opens the browser shifts the visual viewport
     downward (offsetTop > 0) to reveal the focused input. Without tracking
     offsetTop the overlay's top bar flies off-screen above the keyboard.
     We listen to both 'resize' (keyboard open/close) and 'scroll' (viewport pan). */
  const [vpHeight,    setVpHeight]    = useState(() => window.visualViewport?.height    ?? window.innerHeight)
  const [vpOffsetTop, setVpOffsetTop] = useState(() => window.visualViewport?.offsetTop ?? 0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = null
    function update() {
      if (raf) return               // coalesce rapid scroll + resize events
      raf = requestAnimationFrame(() => {
        raf = null
        setVpHeight(Math.round(vv.height))
        setVpOffsetTop(Math.round(vv.offsetTop))
      })
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /* Signal LibraryPage that the overlay is open so it hides the sticky header.
     This prevents the header from peeking through on iOS Safari due to
     position:sticky creating its own stacking context above position:fixed. */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pb-note-overlay-open'))
    return () => window.dispatchEvent(new CustomEvent('pb-note-overlay-close'))
  }, [])

  /* Lock background scroll while overlay is open.
     iOS ignores overflow:hidden on body alone — the position:fixed trick is required. */
  useEffect(() => {
    const body = document.body
    const scrollY = window.scrollY
    const prevOverflow = body.style.overflow
    const prevPosition = body.style.position
    const prevTop      = body.style.top
    const prevWidth    = body.style.width
    body.style.overflow  = 'hidden'
    body.style.position  = 'fixed'
    body.style.top       = `-${scrollY}px`
    body.style.width     = '100%'
    return () => {
      body.style.overflow  = prevOverflow
      body.style.position  = prevPosition
      body.style.top       = prevTop
      body.style.width     = prevWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  /* Block touchmove events that originate outside the scroll area.
     This prevents iOS from rubber-banding the fixed overlay and revealing
     the library behind when the user drags on the toolbar or title bar.
     Must be non-passive so e.preventDefault() is effective. */
  useEffect(() => {
    const overlayEl = overlayRef.current
    if (!overlayEl) return
    function blockOutsideScrollMove(e) {
      if (scrollAreaRef.current?.contains(e.target)) return // let scroll area handle its own scrolling
      if (e.cancelable) e.preventDefault()
    }
    overlayEl.addEventListener('touchmove', blockOutsideScrollMove, { passive: false })
    return () => overlayEl.removeEventListener('touchmove', blockOutsideScrollMove)
  }, [])

  /* Restore scroll position on mount; save on unmount.
     Uses setTimeout(100) not requestAnimationFrame — RichNoteEditor sets
     innerHTML in a child useEffect, and RAF fires before the browser
     has computed layout for that content (scrollHeight still 0), so
     scrollTop would clip to 0. 100ms gives the layout time to settle. */
  useEffect(() => {
    const saved = parseInt(sessionStorage.getItem(_scrollKey) || '0', 10)
    let timerId = null
    if (saved > 0) {
      timerId = setTimeout(() => {
        const el = scrollAreaRef.current
        if (el) el.scrollTop = saved
      }, 100)
    }
    return () => {
      clearTimeout(timerId)
      const el = scrollAreaRef.current
      if (el) sessionStorage.setItem(_scrollKey, String(el.scrollTop))
    }
  }, [_scrollKey])

  const atHint = chapterTag
    ? `@ tag · @3 = verse 3 · @1:3 = ch.1 v.3 · @2LBCF 1:1 · @Keach1`
    : '@ scripture tag · @2LBCF 1:1 · @Keach1'

  function execCmd(cmd, val) { editorRef.current?.execCmd(cmd, val) }
  function execUndo()        { editorRef.current?.execUndo() }
  function execRedo()        { editorRef.current?.execRedo() }

  /* Pin overlay to the visual viewport:
     - top: vpOffsetTop  → stays at the top of the visible area (top bar never flies off)
     - height: vpHeight  → ends exactly where the keyboard starts (no gap at bottom)
     Both values update in real-time as the keyboard opens/closes or the
     visual viewport pans. */
  const overlayStyle = { ...eo.overlay, top: vpOffsetTop, height: vpHeight, bottom: 'auto' }

  return (
    <div ref={overlayRef} style={overlayStyle}>

      {/* ── Single combined toolbar row ── */}
      <div style={eo.singleBar}>
        {/* Back — chevron only */}
        <button onClick={onBack} style={eo.backBtn} aria-label="Back to Library">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={re.toolDivider} />

        {/* Formatting buttons */}
        {TOOLBAR_ACTIONS.map(action => (
          <button
            key={action.id}
            title={action.title}
            onMouseDown={e => { e.preventDefault(); execCmd(action.cmd, action.val) }}
            style={{ ...re.toolBtn, ...(activeFormats[action.id] ? re.toolBtnActive : {}) }}
            type="button"
          >
            {action.label}
          </button>
        ))}
        <span style={re.toolDivider} />

        {/* Undo / Redo */}
        <button title="Undo" aria-label="Undo" onMouseDown={e => { e.preventDefault(); execUndo() }} style={re.toolBtn} type="button">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4.5h6a3.5 3.5 0 010 7H4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 2L2 4.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button title="Redo" aria-label="Redo" onMouseDown={e => { e.preventDefault(); execRedo() }} style={re.toolBtn} type="button">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 4.5H6a3.5 3.5 0 000 7h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.5 2L12 4.5 9.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={re.toolDivider} />

        {/* @ hint — fills remaining space */}
        <span style={{ ...re.atHint, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{atHint}</span>

        {/* Scripture nav — icon only */}
        <button
          onClick={() => navigate('/scripture')}
          style={eo.iconBtn}
          title="Go to Scripture (note auto-saved)"
          aria-label="Open Scripture reader"
        >
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M2 3.5C2 3.5 4 3 8.5 3s6.5.5 6.5.5V13.5S13 13 8.5 13 2 13.5 2 13.5V3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8.5 3v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div ref={scrollAreaRef} style={eo.scrollArea}
        onClick={e => {
          // Tap anywhere in the empty scroll area to focus the editor
          if (e.target === scrollAreaRef.current && editorRef.current) {
            editorRef.current.focus()
          }
        }}
      >
        <div style={eo.contentPad}>
          {children}
        </div>
      </div>

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Share / Copy helpers
══════════════════════════════════════════════════════════════ */
function noteToPlainText(rawNote) {
  if (!isRichNote(rawNote)) return rawNote
  const { title, body } = parseRichNote(rawNote)
  const stripped = (body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return title ? `${title}\n\n${stripped}` : stripped
}

function CopyShareBar({ rawNote }) {
  const [copied, setCopied] = useState(false)

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(noteToPlainText(rawNote))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function doShare() {
    const text = noteToPlainText(rawNote)
    if (navigator.share) {
      try { await navigator.share({ text }) } catch {}
    } else {
      doCopy()
    }
  }

  return (
    <div style={s.copyShareBar}>
      <button style={s.copyBtn} onClick={doCopy}>
        {copied
          ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Copied</>
          : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4 1h7a1 1 0 011 1v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> Copy</>
        }
      </button>
      <button style={s.copyBtn} onClick={doShare}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="9.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="9.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 5.2L8 3M3.5 6.8L8 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        Share
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Label Dropdown  (replaces chip-row LabelPicker)
══════════════════════════════════════════════════════════════ */
function LabelDropdown({ selected, onChange }) {
  const [open,      setOpen]      = useState(false)
  const [allLabels, setAllLabels] = useState(getStoredLabels)
  const [adding,    setAdding]    = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  useEffect(() => {
    function onDown(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function toggle(label) {
    onChange(selected.includes(label) ? selected.filter(l => l !== label) : [...selected, label])
  }

  function addLabel() {
    const t = newLabel.trim()
    if (!t) { setAdding(false); return }
    const updated = allLabels.includes(t) ? allLabels : [...allLabels, t]
    saveStoredLabels(updated)
    setAllLabels(updated)
    if (!selected.includes(t)) onChange([...selected, t])
    setNewLabel(''); setAdding(false)
  }

  const label = selected.length === 0 ? 'Add labels' : selected.length === 1 ? selected[0] : `${selected.length} labels`

  return (
    <div style={{ position: 'relative' }} ref={wrapRef}>
      <button type="button" onClick={() => setOpen(o => !o)} style={lp.trigger}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 2h4.5l4 4-3.5 3.5-4-4V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <circle cx="3" cy="3.8" r="0.7" fill="currentColor"/>
        </svg>
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </button>

      {/* Selected chips — shown below trigger */}
      {selected.length > 0 && (
        <div style={lp.selectedRow}>
          {selected.map(l => {
            const c = getLabelColor(l)
            return (
              <span key={l} style={{ ...lp.selectedChip, background: c.bg, borderColor: c.border, color: c.color }}>
                {l}
                <button type="button" onClick={() => toggle(l)} style={{ ...lp.chipRemove, color: c.color }}>×</button>
              </span>
            )
          })}
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div style={lp.panel}>
          {allLabels.map(l => (
            <label key={l} style={lp.item}>
              <input type="checkbox" checked={selected.includes(l)} onChange={() => toggle(l)} style={{ accentColor: 'var(--teal)', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: 'var(--ink)' }}>{l}</span>
            </label>
          ))}
          <div style={lp.panelDivider} />
          {adding ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
              <input ref={inputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel() } if (e.key === 'Escape') { setAdding(false); setNewLabel('') } }}
                placeholder="New label…" style={lp.addInput} />
              <button type="button" onClick={addLabel} style={lp.addConfirm}>Add</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} style={lp.addBtn}>+ Add label</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Create Note Form  (rich editor)
══════════════════════════════════════════════════════════════ */
const CREATE_DRAFT_KEY = 'pb-lib-draft'

function readCreateDraft() {
  try {
    const raw = localStorage.getItem(CREATE_DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function CreateNoteForm({ onSave, onCancel, session, navigate }) {
  const draft = useMemo(readCreateDraft, []) // read once on mount

  const [titleVal,      setTitleVal]      = useState(draft?.titleVal   ?? '')
  const [bodyHtml,      setBodyHtml]      = useState(draft?.bodyHtml   ?? '')
  const [labels,        setLabels]        = useState(draft?.labels     ?? [])
  const [tagEnabled,    setTagEnabled]    = useState(draft?.tagEnabled ?? false)
  const [tagBook,       setTagBook]       = useState(draft?.tagBook    ?? 'Genesis')
  const [tagChapter,    setTagChapter]    = useState(draft?.tagChapter ?? 1)
  const [saving,        setSaving]        = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const editorImperativeRef = useRef(null)
  const draftTimer = useRef(null)

  const selectedBook = BIBLE_BOOKS.find(b => b.name === tagBook) ?? BIBLE_BOOKS[0]
  const maxChapters  = selectedBook.chapters

  useEffect(() => {
    if (tagChapter > maxChapters) setTagChapter(maxChapters)
  }, [tagBook, maxChapters, tagChapter])

  /* Persist draft to localStorage 500 ms after every change */
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ titleVal, bodyHtml, labels, tagEnabled, tagBook, tagChapter }))
      } catch {}
    }, 500)
    return () => clearTimeout(draftTimer.current)
  }, [titleVal, bodyHtml, labels, tagEnabled, tagBook, tagChapter])

  async function handleSave() {
    const hasContent = titleVal.trim() || bodyHtml.replace(/<[^>]*>/g, '').trim()
    if (!hasContent) return
    setSaving(true)
    try {
      const chapterTag = tagEnabled ? { book: tagBook, chapter: tagChapter } : null
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels, null, null, chapterTag)
      /* Always use a lib|timestamp key so multiple notes can exist per passage. */
      const key = `lib|${new Date().toISOString()}`
      setItemNote(key, raw, session?.user?.id)
      localStorage.removeItem(CREATE_DRAFT_KEY)
      onSave()
    } finally {
      setSaving(false)
    }
  }

  async function handleBack() {
    const hasContent = titleVal.trim() || bodyHtml.replace(/<[^>]*>/g, '').trim()
    if (hasContent) {
      await handleSave()
    } else {
      localStorage.removeItem(CREATE_DRAFT_KEY)
      onCancel()
    }
  }

  const chapterTagObj = tagEnabled ? { book: tagBook, chapter: tagChapter } : null

  return (
    <NoteEditOverlay
      isCreate
      onBack={handleBack}
      onSave={handleSave}
      saving={saving}
      autoSaved={false}
      editorRef={editorImperativeRef}
      activeFormats={activeFormats}
      chapterTag={chapterTagObj}
      navigate={navigate}
    >
      {/* Rich editor — toolbar hidden (overlay owns the toolbar) */}
      <RichNoteEditor
        key={draft?.bodyHtml ? 'draft' : 'new'}
        ref={editorImperativeRef}
        initialTitle={titleVal}
        initialBody={bodyHtml}
        onTitleChange={setTitleVal}
        onBodyChange={setBodyHtml}
        showToolbar={false}
        onActiveFormatsChange={setActiveFormats}
        chapterTag={chapterTagObj}
        headerSlot={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            {/* Labels */}
            <LabelDropdown selected={labels} onChange={setLabels} />

            {/* Key Chapter toggle */}
            <button
              style={{ ...s.tagToggleBtn, ...(tagEnabled ? s.tagToggleBtnActive : {}) }}
              onClick={() => setTagEnabled(t => !t)}
              type="button"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="1" width="11" height="11" rx="1.5"
                  stroke={tagEnabled ? 'var(--teal)' : 'currentColor'} strokeWidth="1.3"/>
                <path d="M4 4.5h5M4 7h3" stroke={tagEnabled ? 'var(--teal)' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {tagEnabled ? 'Key Chapter tagged' : 'Key Chapter'}
              {tagEnabled && (
                <span style={s.tagPreview}>{tagBook} {tagChapter}</span>
              )}
            </button>

            {tagEnabled && (
              <div style={s.pickerRow}>
                <div style={s.pickerGroup}>
                  <label style={s.pickerLabel}>Book</label>
                  <select
                    value={tagBook}
                    onChange={e => { setTagBook(e.target.value); setTagChapter(1) }}
                    style={s.pickerSelect}
                  >
                    <optgroup label="Old Testament">
                      {BIBLE_BOOKS.filter(b => b.testament === 'OT').map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="New Testament">
                      {BIBLE_BOOKS.filter(b => b.testament === 'NT').map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div style={s.pickerGroup}>
                  <label style={s.pickerLabel}>Ch.</label>
                  <select
                    value={tagChapter}
                    onChange={e => setTagChapter(Number(e.target.value))}
                    style={s.pickerSelectSmall}
                  >
                    {Array.from({ length: maxChapters }, (_, i) => i + 1).map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {tagEnabled && (
              <p style={s.tagHint}>
                Tagged to <strong>{tagBook} {tagChapter}</strong>. In the editor, type <code style={{ fontSize: 10, background: 'var(--parchment-dark)', padding: '1px 4px', borderRadius: 3 }}>@1:1</code> to quickly tag verse 1 of this chapter.
              </p>
            )}
          </div>
        }
      />
    </NoteEditOverlay>
  )
}

/* ══════════════════════════════════════════════════════════════
   Edit Note Form  (rich editor)
══════════════════════════════════════════════════════════════ */
function EditNoteForm({ noteKey, initialRaw, onSave, onCancel, session, navigate }) {
  const isRich = isRichNote(initialRaw)
  const parsed = isRich ? parseRichNote(initialRaw) : { title: '', body: '', labels: [], verseTag: null }

  const [titleVal,      setTitleVal]      = useState(parsed.title || '')
  const [bodyHtml,      setBodyHtml]      = useState(isRich ? (parsed.body || '') : (initialRaw || ''))
  const [labels,        setLabels]        = useState(parsed.labels || [])
  const [saving,        setSaving]        = useState(false)
  const [autoSaved,     setAutoSaved]     = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const editorImperativeRef = useRef(null)
  const autoSaveTimer = useRef(null)
  const isFirstRender = useRef(true)

  /* Preserve the original verseTag, chapterTag, and createdAt when re-saving */
  const verseTag   = parsed.verseTag   ?? null
  const chapterTag = parsed.chapterTag ?? null
  const createdAt  = parsed.createdAt  ?? null

  /* Auto-save: debounced 1.5 s after each edit (skip first render) */
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels, verseTag, createdAt, chapterTag)
      setItemNote(noteKey, raw, session?.user?.id)
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [titleVal, bodyHtml, labels]) // eslint-disable-line

  async function handleSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setSaving(true)
    try {
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels, verseTag, createdAt, chapterTag)
      setItemNote(noteKey, raw, session?.user?.id)
      onSave(raw)
    } finally {
      setSaving(false)
    }
  }

  return (
    <NoteEditOverlay
      isCreate={false}
      scrollKey={`pb-overlay-scroll:${noteKey}`}
      onBack={onCancel}
      onSave={handleSave}
      saving={saving}
      autoSaved={autoSaved}
      editorRef={editorImperativeRef}
      activeFormats={activeFormats}
      chapterTag={chapterTag}
      navigate={navigate}
    >
      {/* Rich editor — toolbar hidden (overlay owns the toolbar) */}
      <RichNoteEditor
        ref={editorImperativeRef}
        initialTitle={titleVal}
        initialBody={bodyHtml}
        onTitleChange={setTitleVal}
        onBodyChange={setBodyHtml}
        showToolbar={false}
        onActiveFormatsChange={setActiveFormats}
        chapterTag={chapterTag}
        headerSlot={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            {/* Labels */}
            <LabelDropdown selected={labels} onChange={setLabels} />

            {/* Key Chapter badge (read-only in edit mode) */}
            {chapterTag && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Chapter:</span>
                <span style={{ ...s.tagPreview }}>{chapterTag.book} {chapterTag.chapter}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· Use @{chapterTag.chapter}:1 to reference a verse</span>
              </div>
            )}
          </div>
        }
      />
    </NoteEditOverlay>
  )
}

const BM_SORT_OPTS = [
  { id: 'date-desc', label: 'Newest' },
  { id: 'date-asc',  label: 'Oldest' },
  { id: 'chrono',    label: 'Chrono' },
  { id: 'alpha',     label: 'A → Z'  },
]

/* ══════════════════════════════════════════════════════════════
   Bookmarks Tab
══════════════════════════════════════════════════════════════ */
function BookmarksTab({ scBookmarks, navigate, onRemoveScBookmark }) {
  const [sortBy, setSortBy] = useState('date-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)

  /* Close sort dropdown on outside click */
  useEffect(() => {
    function onDown(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const sortedScBm = useMemo(() => {
    const list = [...scBookmarks]
    if (sortBy === 'date-asc')  return list.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
    if (sortBy === 'chrono')    return list.sort((a, b) => ((BOOK_ORDER[a.book] ?? 999) * 1000 + (a.chapter ?? 0)) - ((BOOK_ORDER[b.book] ?? 999) * 1000 + (b.chapter ?? 0)))
    if (sortBy === 'alpha')     return list.sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter)
    return list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)) // date-desc
  }, [scBookmarks, sortBy])

  return (
    <div style={s.tabContent}>

      {/* Sort control */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(o => !o)}
            style={{ ...s.iconDropBtn, ...(sortOpen ? s.iconDropBtnOpen : {}) }}
            title="Sort bookmarks"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M2 7h7M2 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={s.iconDropLabel}>{BM_SORT_OPTS.find(o => o.id === sortBy)?.label ?? 'Sort'}</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.5 }}>
              <path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {sortOpen && (
            <div style={s.dropPanel}>
              {BM_SORT_OPTS.map(o => (
                <button
                  key={o.id}
                  style={{ ...s.dropOption, ...(sortBy === o.id ? s.dropOptionActive : {}) }}
                  onClick={() => { setSortBy(o.id); setSortOpen(false) }}
                >
                  <span style={s.dropOptionCheck}>{sortBy === o.id ? '✓' : ''}</span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2A1.5 1.5 0 014.5.5h5A1.5 1.5 0 0111 2v11l-4-2.5L3 13V2z"
              stroke="var(--amber-ink)" strokeWidth="1.3" strokeLinejoin="round" fill="var(--amber-ink)" fillOpacity="0.12"/>
            <path d="M5.5 5h3M5.5 7.5h2" stroke="var(--amber-ink)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        }
        title="Scripture Bookmarks"
        count={scBookmarks.length}
      />
      <p style={s.sectionHint}>Chapters saved from the Scripture reader toolbar</p>
      {scBookmarks.length === 0
        ? <EmptyMsg text="No scripture bookmarks yet. Tap the bookmark icon in the Scripture reader toolbar to save any chapter." />
        : sortedScBm.map(bm => (
          <div
            key={bm.key}
            style={s.card}
            onClick={() => navigate('/scripture', { state: { book: bm.book, chapter: bm.chapter } })}
          >
            <div style={s.cardHead}>
              <span style={s.refBadge}>{bm.book} {bm.chapter}</span>
              <span style={s.dateBadge}>
                {new Date(bm.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <RemoveBtn onClick={() => onRemoveScBookmark(bm.book, bm.chapter)} label="Remove bookmark" />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .35, flexShrink: 0 }}>
                <path d="M3 2l3.5 3.5L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        ))
      }
    </div>
  )
}

/* ── Plain-text preview from any note type ── */
function notePreviewText(rawNote) {
  if (!rawNote) return ''
  if (isRichNote(rawNote)) {
    const { body } = parseRichNote(rawNote)
    return (body || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim()
  }
  return rawNote.trim()
}

/* ══════════════════════════════════════════════════════════════
   Note Card  (kanban tile)
══════════════════════════════════════════════════════════════ */
function NoteCard({ badge, badgeStyle, title, labels, chapterBadge, chapterBadgeStyle, preview, date, onCardClick, onEdit, onDelete, onOpen, query }) {
  const displayPreview = preview
    ? (query
        ? preview
        : preview
      )
    : ''

  return (
    <div style={nc.card} onClick={onCardClick}>
      {/* Top: badge OR title */}
      <div style={nc.top}>
        {badge
          ? <span style={{ ...nc.badge, ...badgeStyle }}>{badge}</span>
          : title
            ? <p style={nc.title}>{title || 'Untitled'}</p>
            : <p style={nc.titleFaint}>Untitled</p>
        }
      </div>

      {/* Labels + optional chapter badge */}
      {(labels?.length > 0 || chapterBadge) && (
        <div style={nc.labelRow}>
          {chapterBadge && (
            <span style={{ ...nc.labelChip, ...chapterBadgeStyle }}>{chapterBadge}</span>
          )}
          {labels?.slice(0, 2).map(l => {
            const c = getLabelColor(l)
            return (
              <span key={l} style={{ ...nc.labelChip, background: c.bg, color: c.color }}>
                {l}
              </span>
            )
          })}
          {labels?.length > 2 && <span style={nc.labelMore}>+{labels.length - 2}</span>}
        </div>
      )}

      {/* Preview — clamped to 3 lines */}
      <p style={nc.preview}>{displayPreview || <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>No content</span>}</p>

      {/* Footer */}
      <div style={nc.footer} onClick={e => e.stopPropagation()}>
        {date && <span style={nc.date}>{date}</span>}
        <div style={nc.actions}>
          {onOpen && (
            <button style={nc.openBtn} onClick={onOpen}>Open →</button>
          )}
          {onEdit && (
            <button style={nc.iconBtn} onClick={onEdit} title="Edit" aria-label="Edit note">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10l1.2-2.4 4.8-4.8 1.4 1.4-4.8 4.8L2 10Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {onDelete && (
            <button style={{ ...nc.iconBtn, color: 'var(--red)' }} onClick={onDelete} title="Delete" aria-label="Delete note">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Share URL inline panel ── */
function NoteShareUrlPanel({ token, urlCopied, onCopy, onUnshare }) {
  const url = noteShareUrl(token)
  const [confirmRemove, setConfirmRemove] = useState(false)
  return (
    <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--teal-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--ink)', background: 'white', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', wordBreak: 'break-all', lineHeight: 1.4, fontFamily: 'monospace' }}>
          {url}
        </div>
        <button
          onClick={onCopy}
          style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: urlCopied ? 'var(--teal)' : 'white', color: urlCopied ? 'white' : 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {urlCopied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--teal)', flex: 1 }}>Anyone with this link can view the note.</span>
        {confirmRemove ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Remove link?</span>
            <button onClick={onUnshare} style={{ fontSize: 11, fontWeight: 600, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Yes</button>
            <button onClick={() => setConfirmRemove(false)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmRemove(true)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Remove link</button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Note View Modal  (read-only, full-screen bottom sheet)
══════════════════════════════════════════════════════════════ */
function NoteViewModal({ noteData, onClose, onEdit, onDelete, onOpen, navigate, onShareLink, shareToken, shareLinkLoading, onUnshare }) {
  const { note, badge, badgeStyle, title } = noteData
  const [scripturePreview,  setScripturePreview]  = useState(null)
  const [confessionPreview, setConfessionPreview] = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [urlCopied,   setUrlCopied]   = useState(false)
  const [showUrlPanel, setShowUrlPanel] = useState(false)

  function handleScriptureClick(sc)   { setScripturePreview(sc) }
  function handleConfessionClick(c)   { setConfessionPreview(c) }

  function handleCopy() {
    const text = noteToPlainText(note)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  async function handleShareLink() {
    if (shareToken) {
      setShowUrlPanel(v => !v)
    } else if (onShareLink) {
      await onShareLink()
      setShowUrlPanel(true)
    }
  }

  function copyShareUrl() {
    if (!shareToken) return
    navigator.clipboard.writeText(noteShareUrl(shareToken)).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={nv.backdrop} onClick={onClose}>
      <div style={nv.sheet} onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div style={nv.handle} />

        {/* Header row — title + close only */}
        <div style={nv.header}>
          <div style={nv.headerLeft}>
            {badge
              ? <span style={{ ...nc.badge, ...badgeStyle }}>{badge}</span>
              : title
                ? <span style={nv.titleText}>{title}</span>
                : <span style={nv.titleFaint}>Untitled</span>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onOpen && (
              <button style={nv.openBtn} onClick={() => { onOpen(); onClose() }}>Open →</button>
            )}
            <button style={nv.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Visible action bar ── */}
        <div style={nv.actionBar}>
          {/* Copy */}
          <button style={{ ...nv.actionBtn, ...(copied ? { color: 'var(--teal)' } : {}) }} onClick={handleCopy}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              {copied
                ? <polyline points="2,6.5 5.5,10 11,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                : <><rect x="4.5" y="1.5" width="7" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 4.5H1.5a1 1 0 00-1 1V12a1 1 0 001 1h6a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>
              }
            </svg>
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {/* Share link */}
          {onShareLink && (
            <button
              style={{ ...nv.actionBtn, ...(shareToken ? { color: 'var(--teal)' } : {}) }}
              onClick={handleShareLink}
              disabled={shareLinkLoading}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M7.5 5.5a3 3 0 010 4l-1 1a3 3 0 01-4-4l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5.5 7.5a3 3 0 010-4l1-1a3 3 0 014 4l-.5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {shareLinkLoading ? 'Sharing…' : shareToken ? 'Link shared' : 'Share link'}
            </button>
          )}

          {/* Edit */}
          {onEdit && (
            <button style={nv.actionBtn} onClick={() => { onEdit(); onClose() }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M9 1.5l2.5 2.5-7 7H2v-2.5l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit
            </button>
          )}

          {/* Delete */}
          {onDelete && (
            <button style={{ ...nv.actionBtn, color: '#e53e3e' }} onClick={() => { onDelete(); onClose() }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <polyline points="2,3.5 11,3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5 3.5V2h3v1.5M4.5 3.5v7a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Delete
            </button>
          )}
        </div>

        {/* Share URL panel — shown after creating a link */}
        {showUrlPanel && shareToken && (
          <NoteShareUrlPanel
            token={shareToken}
            urlCopied={urlCopied}
            onCopy={copyShareUrl}
            onUnshare={() => { onUnshare && onUnshare(); setShowUrlPanel(false) }}
          />
        )}

        {/* Note content */}
        <div style={nv.body}>
          <NoteBody rawNote={note} clip={false} onScriptureClick={handleScriptureClick} onConfessionClick={handleConfessionClick} />
        </div>
      </div>

      {/* Verse preview — stacked above this modal */}
      <ScriptureVerseModal
        sc={scripturePreview}
        zOverride={9200}
        onClose={e => { e?.stopPropagation?.(); setScripturePreview(null) }}
        onNavigate={(book, ch, vs) => {
          setScripturePreview(null)
          onClose()
          navigate('/scripture', { state: { book, chapter: ch, verse: vs } })
        }}
      />
      {/* Confession preview — stacked above this modal */}
      <ConfessionModal
        conf={confessionPreview}
        zOverride={9200}
        onClose={e => { e?.stopPropagation?.(); setConfessionPreview(null) }}
        onNavigate={(confType) => {
          setConfessionPreview(null)
          onClose()
          navigate('/confessions', { state: { tab: confType } })
        }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Delete Confirmation Modal
══════════════════════════════════════════════════════════════ */
function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div style={dc.backdrop} onClick={onCancel}>
      <div style={dc.sheet} onClick={e => e.stopPropagation()}>
        {/* Warning icon */}
        <div style={dc.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--red)" strokeWidth="1.5" fill="var(--red-light)"/>
            <path d="M14 8v7" stroke="var(--red)" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="14" cy="19.5" r="1.2" fill="var(--red)"/>
          </svg>
        </div>
        <p style={dc.title}>Delete this note?</p>
        <p style={dc.body}>Deleted notes cannot be recovered.</p>
        <div style={dc.actions}>
          <button style={dc.cancelBtn} onClick={onCancel}>Keep note</button>
          <button style={dc.deleteBtn} onClick={onConfirm}>Delete permanently</button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Notes Tab
══════════════════════════════════════════════════════════════ */
const BOOK_ORDER = Object.fromEntries(BIBLE_BOOKS.map((b, i) => [b.name, i]))

const SORT_OPTS = [
  { id: 'date-desc', label: 'Newest' },
  { id: 'date-asc',  label: 'Oldest' },
  { id: 'chrono',    label: 'Chrono'  },
  { id: 'label',     label: 'By label' },
]

const SESSION_EDIT_KEY   = 'pb-lib-editing-note'
const SESSION_CREATE_KEY = 'pb-lib-creating-note'
const SESSION_SORT_KEY   = 'pb-lib-sort'
const SESSION_FILTER_KEY   = 'pb-lib-filter-label'
const VIEW_KEY             = 'pb-lib-note-view'
const SESSION_SECTIONS_KEY = 'pb-lib-notes-sections'

function NotesTab({ enrichedDevNotes, kjvNotes, confNotes, libNotes, navigate, session, onRemoveKjvNote, onRemoveConfNote, onRemoveLibNote, onRemoveDevNote, searchQuery = '' }) {
  /* Persist create-form open state across navigation */
  const [showCreateForm, setShowCreateFormRaw] = useState(() => {
    try { return sessionStorage.getItem(SESSION_CREATE_KEY) === '1' } catch { return false }
  })

  function setShowCreateForm(val) {
    setShowCreateFormRaw(val)
    try {
      if (val) sessionStorage.setItem(SESSION_CREATE_KEY, '1')
      else     sessionStorage.removeItem(SESSION_CREATE_KEY)
    } catch {}
  }

  /* Persist editingNote to sessionStorage so it survives navigation */
  const [editingNote, setEditingNoteRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_EDIT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  function setEditingNote(n) {
    setEditingNoteRaw(n)
    try {
      if (n) sessionStorage.setItem(SESSION_EDIT_KEY, JSON.stringify(n))
      else   sessionStorage.removeItem(SESSION_EDIT_KEY)
    } catch {}
  }

  /* When libNotes refreshes (e.g. auto-save finished), keep editingNote in sync */
  useEffect(() => {
    if (!editingNote?.key) return
    const fresh = libNotes.find(n => n.key === editingNote.key)
    // Only sync if content differs (avoid infinite loop)
    if (fresh && fresh.note !== editingNote.note) {
      setEditingNoteRaw(fresh) // update state without re-writing sessionStorage
      try { sessionStorage.setItem(SESSION_EDIT_KEY, JSON.stringify(fresh)) } catch {}
    }
  }, [libNotes]) // eslint-disable-line

  const [viewingNote,       setViewingNote]       = useState(null) // { note, key, badge?, badgeStyle?, title?, type, extra? }
  const [shareLibLink,      setShareLibLink]      = useState(null) // token string | null
  const [shareLinkLoading,  setShareLinkLoading]  = useState(false)
  const [sortBy, setSortByRaw] = useState(() => {
    try { return sessionStorage.getItem(SESSION_SORT_KEY) || 'date-desc' } catch { return 'date-desc' }
  })
  function setSortBy(val) {
    setSortByRaw(val)
    try {
      if (val && val !== 'date-desc') sessionStorage.setItem(SESSION_SORT_KEY, val)
      else sessionStorage.removeItem(SESSION_SORT_KEY)
    } catch {}
  }

  const [filterLabel, setFilterLabelRaw] = useState(() => {
    try { return sessionStorage.getItem(SESSION_FILTER_KEY) || '' } catch { return '' }
  })
  function setFilterLabel(val) {
    setFilterLabelRaw(val)
    try {
      if (val) sessionStorage.setItem(SESSION_FILTER_KEY, val)
      else sessionStorage.removeItem(SESSION_FILTER_KEY)
    } catch {}
  }
  const [sortOpen,       setSortOpen]       = useState(false)
  const [filterOpen,     setFilterOpen]     = useState(false)
  const sortRef   = useRef(null)
  const filterRef = useRef(null)

  /* ── Accordion section open/close (persisted so back-nav restores state) ── */
  const [openSections, setOpenSectionsRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_SECTIONS_KEY)
      return raw ? JSON.parse(raw) : { lib: false, kjv: false, dev: false, conf: false }
    } catch {
      return { lib: false, kjv: false, dev: false, conf: false }
    }
  })
  function toggleSection(key) {
    setOpenSectionsRaw(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { sessionStorage.setItem(SESSION_SECTIONS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  /* ── View mode: 'grid' (2-col) | 'list' (single-col) ── */
  const [noteView, setNoteViewRaw] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'grid' } catch { return 'grid' }
  })
  function setNoteView(v) {
    setNoteViewRaw(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch {}
  }
  const gridStyle = noteView === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 4 }
    : { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }

  const [scriptureModal,  setScriptureModal]  = useState(null)
  const [confessionModal, setConfessionModal] = useState(null)
  const [pendingDelete,   setPendingDelete]   = useState(null) // { key, type }

  /* Close dropdowns on outside click */
  useEffect(() => {
    function onOut(e) {
      if (sortRef.current   && !sortRef.current.contains(e.target))   setSortOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  function requestDelete(key, type) { setPendingDelete({ key, type }) }
  function confirmDelete() {
    if (!pendingDelete) return
    const { key, type } = pendingDelete
    if (type === 'lib')  onRemoveLibNote(key)
    if (type === 'kjv')  onRemoveKjvNote(key)
    if (type === 'conf') onRemoveConfNote(key)
    if (type === 'dev')  onRemoveDevNote(key)
    setPendingDelete(null)
  }

  const q = searchQuery.trim().toLowerCase()

  /* All labels in use across lib + kjv notes */
  const allUsedLabels = useMemo(() => {
    const set = new Set()
    ;[...libNotes, ...kjvNotes].forEach(n => {
      if (isRichNote(n.note)) {
        (parseRichNote(n.note).labels || []).forEach(l => set.add(l))
      }
    })
    return [...set].sort()
  }, [libNotes, kjvNotes])

  /* Split lib notes:
     - libFreeNotes:   no verseTag (includes chapter-tagged notes → Personal Notes)
     - libTaggedNotes: has verseTag (verse-exact → Scripture Notes) */
  const { libFreeNotes, libTaggedNotes } = useMemo(() => {
    const free = [], tagged = []
    libNotes.forEach(n => {
      const parsed = isRichNote(n.note) ? parseRichNote(n.note) : {}
      const vt = parsed.verseTag ?? null
      const ct = parsed.chapterTag ?? null
      if (vt) tagged.push({ ...n, book: vt.book, chapter: vt.chapter, verse: vt.verse, isLibTagged: true })
      else    free.push({ ...n, chapterTag: ct })  // carry chapterTag for badge display
    })
    return { libFreeNotes: free, libTaggedNotes: tagged }
  }, [libNotes])

  const filteredLib = useMemo(() => {
    let list = q
      ? libFreeNotes.filter(n => richNoteSearchText(n.note).toLowerCase().includes(q))
      : [...libFreeNotes]
    if (filterLabel)
      list = list.filter(n => (isRichNote(n.note) ? parseRichNote(n.note).labels || [] : []).includes(filterLabel))
    if      (sortBy === 'date-asc')  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    else if (sortBy === 'date-desc') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sortBy === 'label') {
      list.sort((a, b) => {
        const la = (isRichNote(a.note) ? parseRichNote(a.note).labels || [] : [])[0] ?? '￿'
        const lb = (isRichNote(b.note) ? parseRichNote(b.note).labels || [] : [])[0] ?? '￿'
        return la.localeCompare(lb)
      })
    }
    return list
  }, [libFreeNotes, q, filterLabel, sortBy])

  /* Scripture notes = inline scripture-page notes (kjv|) + lib notes tagged to a verse (lib| with verseTag) */
  const allScriptureNotes = useMemo(() => [...kjvNotes, ...libTaggedNotes], [kjvNotes, libTaggedNotes])

  const filteredKjv = useMemo(() => {
    let list = q
      ? allScriptureNotes.filter(n =>
          richNoteSearchText(n.note).toLowerCase().includes(q) ||
          `${n.book} ${n.chapter}:${n.verse}`.toLowerCase().includes(q)
        )
      : [...allScriptureNotes]
    if (filterLabel)
      list = list.filter(n => (isRichNote(n.note) ? parseRichNote(n.note).labels || [] : []).includes(filterLabel))
    if (sortBy === 'date-asc') list.sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))
    else if (sortBy === 'chrono') {
      list.sort((a, b) => {
        const oa = (BOOK_ORDER[a.book] ?? 999) * 1000 + (a.chapter ?? 0)
        const ob = (BOOK_ORDER[b.book] ?? 999) * 1000 + (b.chapter ?? 0)
        return oa - ob
      })
    }
    return list
  }, [allScriptureNotes, q, filterLabel, sortBy])
  const filteredConf = useMemo(() =>
    q ? confNotes.filter(n =>
      richNoteSearchText(n.note).toLowerCase().includes(q) ||
      n.source.toLowerCase().includes(q) ||
      n.itemKey.toLowerCase().includes(q)
    ) : confNotes,
    [confNotes, q]
  )
  const filteredDev = useMemo(() => {
    // Reflection notes are plain text — they carry no labels,
    // so hide them when a label filter is active (they can't match).
    if (filterLabel) return []
    if (!q) return enrichedDevNotes
    return enrichedDevNotes.filter(n =>
      n.notes.toLowerCase().includes(q) ||
      n.entry?.reading?.toLowerCase().includes(q)
    )
  }, [enrichedDevNotes, q, filterLabel])

  const totalResults = filteredLib.length + filteredKjv.length + filteredConf.length + filteredDev.length
  const isSearching  = q.length > 0

  function handleSaved(raw) {
    // Sync to Supabase if this note has an active share link
    if (raw && editingNote?.key && session?.user?.id && getLibShareToken(editingNote.key)) {
      const sourceLabel = editingNote.type === 'lib' ? 'Personal Note' : editingNote.type === 'kjv' ? 'Scripture Note' : editingNote.type === 'conf' ? 'Confession Note' : 'Note'
      syncLibSharedNote({ noteKey: editingNote.key, text: raw, title: editingNote.badge || editingNote.title || '', source: sourceLabel, userId: session.user.id })
        .catch(e => console.warn('[syncLibSharedNote]', e))
    }
    setShowCreateForm(false) // clears SESSION_CREATE_KEY via wrapper
    setEditingNote(null)     // clears SESSION_EDIT_KEY via wrapper
  }

  return (
    <div style={s.tabContent}>

      {/* Fullscreen overlays — rendered above the main list */}
      {showCreateForm && (
        <CreateNoteForm session={session} onSave={handleSaved} onCancel={() => setShowCreateForm(false)} navigate={navigate} />
      )}
      {editingNote && (
        <EditNoteForm
          key={editingNote.key}
          noteKey={editingNote.key}
          initialRaw={editingNote.note}
          session={session}
          onSave={handleSaved}
          onCancel={() => setEditingNote(null)}
          navigate={navigate}
        />
      )}

      <>
        {/* Control row: New Note + Sort icon + Filter icon */}
          <div style={s.controlRow}>
            <button onClick={() => setShowCreateForm(true)} style={s.newNoteBtnSmall}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M6 3.5v5M3.5 6h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              New Note
            </button>

            {/* ── Sort dropdown ── */}
            <div ref={sortRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setSortOpen(o => !o); setFilterOpen(false) }}
                style={{ ...s.iconDropBtn, ...(sortOpen ? s.iconDropBtnOpen : {}) }}
                title="Sort notes"
                aria-label="Sort notes"
              >
                {/* Sort icon: lines of decreasing length */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M2 7h7M2 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span style={s.iconDropLabel}>{SORT_OPTS.find(o => o.id === sortBy)?.label ?? 'Sort'}</span>
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
              {sortOpen && (
                <div style={s.dropPanel}>
                  {SORT_OPTS.map(o => (
                    <button
                      key={o.id}
                      style={{ ...s.dropOption, ...(sortBy === o.id ? s.dropOptionActive : {}) }}
                      onClick={() => { setSortBy(o.id); setSortOpen(false) }}
                    >
                      <span style={s.dropOptionCheck}>{sortBy === o.id ? '✓' : ''}</span>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Grid / List view toggle ── */}
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setNoteView('grid')}
                style={{ ...s.viewToggleBtn, ...(noteView === 'grid' ? s.viewToggleBtnActive : {}) }}
                title="Grid view" aria-label="Grid view"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                  <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                  <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                  <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              </button>
              <button
                onClick={() => setNoteView('list')}
                style={{ ...s.viewToggleBtn, ...(noteView === 'list' ? s.viewToggleBtnActive : {}) }}
                title="List view" aria-label="List view"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1 3h11M1 6.5h11M1 10h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* ── Filter by label dropdown ── */}
            {allUsedLabels.length > 0 && (
              <div ref={filterRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setFilterOpen(o => !o); setSortOpen(false) }}
                  style={{ ...s.iconDropBtn, ...(filterOpen || filterLabel ? s.iconDropBtnOpen : {}) }}
                  title="Filter by label"
                  aria-label="Filter by label"
                >
                  {/* Funnel / filter icon */}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1.5 2.5h10l-3.5 4v3.5l-3-1.5V6.5L1.5 2.5Z"
                      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
                      fill={filterLabel ? 'currentColor' : 'none'} fillOpacity={filterLabel ? 0.25 : 0}/>
                  </svg>
                  <span style={s.iconDropLabel}>{filterLabel || 'Label'}</span>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {filterLabel && <span style={s.iconDropActiveDot} />}
                </button>
                {filterOpen && (
                  <div style={s.dropPanel}>
                    <button
                      style={{ ...s.dropOption, ...(!filterLabel ? s.dropOptionActive : {}) }}
                      onClick={() => { setFilterLabel(''); setFilterOpen(false) }}
                    >
                      <span style={s.dropOptionCheck}>{!filterLabel ? '✓' : ''}</span>
                      All labels
                    </button>
                    <div style={s.dropDivider} />
                    {allUsedLabels.map(l => {
                      const c = getLabelColor(l)
                      const isActive = filterLabel === l
                      return (
                        <button
                          key={l}
                          style={{ ...s.dropOption, ...(isActive ? s.dropOptionActive : {}) }}
                          onClick={() => { setFilterLabel(isActive ? '' : l); setFilterOpen(false) }}
                        >
                          <span style={s.dropOptionCheck}>{isActive ? '✓' : ''}</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
                          {l}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active-state meta line */}
          {(filterLabel || isSearching) && (
            <p style={s.searchMeta}>
              {isSearching && totalResults === 0
                ? `No results${filterLabel ? ` for label "${filterLabel}"` : ''} matching "${searchQuery.trim()}"`
                : isSearching
                  ? `${totalResults} note${totalResults !== 1 ? 's' : ''} match "${searchQuery.trim()}"${filterLabel ? ` · ${filterLabel}` : ''}`
                  : <>Label: <strong>{filterLabel}</strong> &nbsp;·&nbsp; <button onClick={() => setFilterLabel('')} style={s.clearFilterBtn}>clear ×</button></>
              }
            </p>
          )}
      </>

      <div style={s.divider} />

      {/* ── Personal Library Notes ── */}
      {(!isSearching || filteredLib.length > 0) && (
        <>
          <SectionHeader
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--teal)" strokeWidth="1.3"/>
                <path d="M5 5.5h4M5 8h2.5" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
            title="Personal Notes"
            count={libFreeNotes.length}
            filtered={isSearching ? filteredLib.length : null}
            open={isSearching || openSections.lib}
            onToggle={!isSearching ? () => toggleSection('lib') : undefined}
          />
          {(isSearching || openSections.lib) && (
            <>
              <p style={s.sectionHint}>Notes created directly in My Library</p>
              {filteredLib.length === 0 && !isSearching
                ? libTaggedNotes.length > 0
                  ? <EmptyMsg text='Scripture-tagged notes are shown in "Scripture Notes" below.' />
                  : <EmptyMsg text='No personal notes yet. Tap "New Note" above to write one.' />
                : (
                  <div style={gridStyle}>
                    {filteredLib.map(n => {
                      const { title, labels } = isRichNote(n.note) ? parseRichNote(n.note) : { title: '', labels: [] }
                      const chTagBadge = n.chapterTag
                        ? `${n.chapterTag.book} ${n.chapterTag.chapter}`
                        : null
                      const chTagBadgeStyle = { background: 'var(--amber-soft)', color: 'var(--amber-ink)', border: '1px solid var(--amber-ink)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, display: 'inline-block', marginLeft: 4 }
                      return (
                        <NoteCard
                          key={n.key}
                          title={title}
                          labels={labels}
                          chapterBadge={chTagBadge}
                          chapterBadgeStyle={chTagBadgeStyle}
                          preview={notePreviewText(n.note)}
                          date={n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                          onCardClick={() => setViewingNote({ note: n.note, key: n.key, title, type: 'lib' })}
                          onEdit={() => setEditingNote(n)}
                          onDelete={() => requestDelete(n.key, 'lib')}
                          query={isSearching ? searchQuery.trim() : ''}
                        />
                      )
                    })}
                  </div>
                )
              }
            </>
          )}
        </>
      )}

      <div style={s.divider} />

      {/* ── Scripture Notes ── */}
      {(!isSearching || filteredKjv.length > 0) && (
        <>
          <SectionHeader
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--teal)" strokeWidth="1.3"/>
                <path d="M5 5.5h4M5 8h2.5" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
            title="Scripture Notes"
            count={allScriptureNotes.length}
            filtered={isSearching ? filteredKjv.length : null}
            open={isSearching || openSections.kjv}
            onToggle={!isSearching ? () => toggleSection('kjv') : undefined}
          />
          {(isSearching || openSections.kjv) && (
            <>
              <p style={s.sectionHint}>Notes attached to specific Bible verses</p>
              {filteredKjv.length === 0 && !isSearching
                ? <EmptyMsg text="No scripture notes yet. Use the pencil icon on any verse, or tag a scripture when creating a new note above." />
                : (
                  <div style={gridStyle}>
                    {filteredKjv.map(n => {
                      const badge = `${n.book} ${n.chapter}:${n.verse}`
                      const badgeStyle = { background: 'var(--teal-light)', color: 'var(--teal)', border: '1px solid var(--teal)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, display: 'inline-block' }
                      const noteType = n.isLibTagged ? 'lib' : 'kjv'
                      return (
                        <NoteCard
                          key={n.key}
                          badge={badge}
                          badgeStyle={badgeStyle}
                          labels={isRichNote(n.note) ? parseRichNote(n.note).labels || [] : []}
                          preview={notePreviewText(n.note)}
                          date={n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                          onCardClick={() => setViewingNote({ note: n.note, key: n.key, badge, badgeStyle, type: noteType, extra: { book: n.book, chapter: n.chapter, verse: n.verse } })}
                          onEdit={() => setEditingNote({ key: n.key, note: n.note })}
                          onDelete={() => requestDelete(n.key, noteType)}
                          onOpen={() => navigate('/scripture', { state: { book: n.book, chapter: n.chapter, verse: n.verse } })}
                          query={isSearching ? searchQuery.trim() : ''}
                        />
                      )
                    })}
                  </div>
                )
              }
            </>
          )}
        </>
      )}

      <div style={s.divider} />

      {/* ── Reflection Notes ── */}
      {(!isSearching || filteredDev.length > 0) && (
        <>
          <SectionHeader
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2.5h10M2 5h6M2 7.5h8M2 10h5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
            title="Reflection Notes"
            count={enrichedDevNotes.length}
            filtered={isSearching ? filteredDev.length : null}
            open={isSearching || openSections.dev}
            onToggle={!isSearching ? () => toggleSection('dev') : undefined}
          />
          {(isSearching || openSections.dev) && (
            <>
              {!session ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <p style={s.emptyText}>Sign in to sync and view your reflection notes.</p>
                  <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
                    Sign in →
                  </button>
                </div>
              ) : filteredDev.length === 0 && !isSearching ? (
                <EmptyMsg text="No reflection notes yet. Open the Dashboard and add your reflections." />
              ) : (
                <div style={gridStyle}>
                  {filteredDev.map(n => {
                    const badge = `Day ${n.day_number}`
                    const badgeStyle = { background: 'var(--purple-soft)', color: 'var(--purple-ink)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, display: 'inline-block' }
                    return (
                      <NoteCard
                        key={n.day_number}
                        badge={badge}
                        badgeStyle={badgeStyle}
                        preview={notePreviewText(n.notes)}
                        date={n.entry?.date ?? ''}
                        onCardClick={() => setViewingNote({ note: n.notes, key: null, badge, badgeStyle, type: 'dev', extra: { dayNumber: n.day_number } })}
                        onOpen={() => navigate('/')}
                        onDelete={() => requestDelete(n.day_number, 'dev')}
                        query={isSearching ? searchQuery.trim() : ''}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div style={s.divider} />

      {/* ── Confession Notes ── */}
      {(!isSearching || filteredConf.length > 0) && (
        <>
          <SectionHeader
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--purple-ink)" strokeWidth="1.3"/>
                <path d="M5 5.5h4M5 8h2.5" stroke="var(--purple-ink)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
            title="Confession Notes"
            count={confNotes.length}
            filtered={isSearching ? filteredConf.length : null}
            open={isSearching || openSections.conf}
            onToggle={!isSearching ? () => toggleSection('conf') : undefined}
          />
          {(isSearching || openSections.conf) && (
            <>
              {filteredConf.length === 0 && !isSearching
                ? <EmptyMsg text="No confession notes yet. Open any confession paragraph and tap Note." />
                : (
                  <div style={gridStyle}>
                    {filteredConf.map(n => {
                      const srcLabel = n.source === '2lbcf' ? '2LBCF' : n.source === 'catechism' ? 'Catechism' : '1LBCF'
                      const badge = `${srcLabel} ${n.itemKey}`
                      const badgeStyle = { background: 'var(--purple-soft)', color: 'var(--purple-ink)', border: '1px solid var(--purple-ink)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, display: 'inline-block' }
                      return (
                        <NoteCard
                          key={n.key}
                          badge={badge}
                          badgeStyle={badgeStyle}
                          labels={isRichNote(n.note) ? parseRichNote(n.note).labels || [] : []}
                          preview={notePreviewText(n.note)}
                          onCardClick={() => setViewingNote({ note: n.note, key: n.key, badge, badgeStyle, type: 'conf', extra: { source: n.source, itemKey: n.itemKey } })}
                          onEdit={() => setEditingNote({ key: n.key, note: n.note })}
                          onDelete={() => requestDelete(n.key, 'conf')}
                          onOpen={() => navigate(`/confessions?t=${n.source}`, { state: { itemKey: n.itemKey, source: n.source } })}
                          query={isSearching ? searchQuery.trim() : ''}
                        />
                      )
                    })}
                  </div>
                )
              }
            </>
          )}
        </>
      )}

      {isSearching && totalResults === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.25, margin: '0 auto 8px', display: 'block' }}>
            <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M23 23l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p style={{ ...s.emptyText, textAlign: 'center' }}>No notes match "{searchQuery.trim()}"</p>
        </div>
      )}

      {/* Scripture verse modal */}
      <ScriptureVerseModal
        sc={scriptureModal}
        onClose={() => setScriptureModal(null)}
        onNavigate={(book, ch, vs) => navigate('/scripture', { state: { book, chapter: ch, verse: vs } })}
      />

      {/* Confession / catechism view modal */}
      <ConfessionModal
        conf={confessionModal}
        onClose={() => setConfessionModal(null)}
        onNavigate={(confType) => {
          setConfessionModal(null)
          navigate('/confessions', { state: { tab: confType } })
        }}
      />

      {/* Note view modal */}
      {viewingNote && (() => {
        const vn = viewingNote
        const shareableKey = vn.key && vn.type !== 'dev' ? vn.key : null
        const currentToken = shareableKey ? getLibShareToken(shareableKey) : null
        const sourceLabel  = vn.type === 'lib' ? 'Personal Note' : vn.type === 'kjv' ? 'Scripture Note' : vn.type === 'conf' ? 'Confession Note' : vn.type === 'dev' ? 'Reflection Note' : 'Note'

        async function handleShareLibLink() {
          if (!shareableKey || !session?.user?.id) return
          setShareLinkLoading(true)
          try {
            const token = await shareLibNote({ noteKey: shareableKey, text: vn.note, title: vn.badge || vn.title || '', source: sourceLabel, userId: session.user.id })
            setShareLibLink(token)
          } catch (e) { console.error('[shareLibLink]', e) }
          finally { setShareLinkLoading(false) }
        }

        async function handleUnshareLibLink() {
          if (!shareableKey || !session?.user?.id) return
          try { await unshareLibNote({ noteKey: shareableKey, userId: session.user.id }) }
          catch (e) { console.error('[unshareLibLink]', e) }
          setShareLibLink(null)
        }

        return (
          <NoteViewModal
            noteData={vn}
            navigate={navigate}
            onClose={() => { setViewingNote(null); setShareLibLink(null) }}
            onEdit={vn.key ? () => {
              if (vn.type === 'lib') {
                const n = libNotes.find(x => x.key === vn.key)
                if (n) setEditingNote(n)
              } else {
                setEditingNote({ key: vn.key, note: vn.note })
              }
            } : null}
            onDelete={
              vn.key
                ? () => requestDelete(vn.key, vn.type)
                : vn.type === 'dev' && vn.extra?.dayNumber != null
                  ? () => { requestDelete(vn.extra.dayNumber, 'dev'); setViewingNote(null) }
                  : null
            }
            onOpen={vn.extra ? () => {
              if (vn.type === 'kjv' || (vn.type === 'lib' && vn.extra.book)) {
                const { book, chapter, verse } = vn.extra
                navigate('/scripture', { state: { book, chapter, verse } })
              } else if (vn.type === 'dev') {
                navigate('/')
              } else if (vn.type === 'conf') {
                const { source, itemKey } = vn.extra
                navigate(`/confessions?t=${source}`, { state: { itemKey, source } })
              }
            } : null}
            onShareLink={shareableKey && session?.user?.id ? handleShareLibLink : null}
            shareToken={shareLibLink || currentToken}
            shareLinkLoading={shareLinkLoading}
            onUnshare={handleUnshareLibLink}
          />
        )
      })()}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteConfirmModal
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Highlights Tab  — with legend
══════════════════════════════════════════════════════════════ */
const HL_LEGEND = [
  { id: 'yellow',  meaning: 'Remember'       },
  { id: 'green',   meaning: 'Study further'  },
  { id: 'blue',    meaning: 'Meditation'     },
  { id: 'pink',    meaning: 'Christological' },
  { id: 'purple',  meaning: 'Question?'      },
]

const HL_SORT_OPTS = [
  { id: 'date-desc', label: 'Newest'  },
  { id: 'date-asc',  label: 'Oldest'  },
  { id: 'chrono',    label: 'Chrono'  },
  { id: 'alpha',     label: 'A → Z'   },
  { id: 'color',     label: 'By color' },
]

function HighlightsTab({ kjvHighlights, confHighlights, partialHighlights, navigate, onRemoveKjvHighlight, onRemoveConfHighlight, onRemovePartialHighlight }) {
  const [sortBy, setSortBy] = useState('date-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)
  const [viewingHighlight, setViewingHighlight] = useState(null) // { book, chapter, verse } | null

  useEffect(() => {
    function onDown(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function sortHighlights(list, isConf = false) {
    const arr = [...list]
    if (sortBy === 'date-asc')  return arr.sort((a, b) => (a.savedAt ?? 0) > (b.savedAt ?? 0) ? 1 : -1)
    if (sortBy === 'chrono') {
      return isConf
        ? arr.sort((a, b) => (a.itemKey ?? '').localeCompare(b.itemKey ?? ''))
        : arr.sort((a, b) => ((BOOK_ORDER[a.book] ?? 999) * 10000 + (a.chapter ?? 0) * 200 + (a.verse ?? 0)) - ((BOOK_ORDER[b.book] ?? 999) * 10000 + (b.chapter ?? 0) * 200 + (b.verse ?? 0)))
    }
    if (sortBy === 'color')     return arr.sort((a, b) => (a.colorId ?? '').localeCompare(b.colorId ?? ''))
    if (sortBy === 'alpha') {
      return isConf
        ? arr.sort((a, b) => (a.itemKey ?? '').localeCompare(b.itemKey ?? ''))
        : arr.sort((a, b) => (a.book ?? '').localeCompare(b.book ?? '') || (a.chapter ?? 0) - (b.chapter ?? 0) || (a.verse ?? 0) - (b.verse ?? 0))
    }
    return arr.sort((a, b) => (b.savedAt ?? 0) > (a.savedAt ?? 0) ? 1 : -1) // date-desc
  }

  const sortedKjv  = useMemo(() => sortHighlights(kjvHighlights, false),  [kjvHighlights,  sortBy]) // eslint-disable-line
  const sortedConf = useMemo(() => sortHighlights(confHighlights, true),  [confHighlights, sortBy]) // eslint-disable-line

  return (
    <div style={s.tabContent}>

      {/* Sort control */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(o => !o)}
            style={{ ...s.iconDropBtn, ...(sortOpen ? s.iconDropBtnOpen : {}) }}
            title="Sort highlights"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M2 7h7M2 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={s.iconDropLabel}>{HL_SORT_OPTS.find(o => o.id === sortBy)?.label ?? 'Sort'}</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.5 }}>
              <path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {sortOpen && (
            <div style={s.dropPanel}>
              {HL_SORT_OPTS.map(o => (
                <button
                  key={o.id}
                  style={{ ...s.dropOption, ...(sortBy === o.id ? s.dropOptionActive : {}) }}
                  onClick={() => { setSortBy(o.id); setSortOpen(false) }}
                >
                  <span style={s.dropOptionCheck}>{sortBy === o.id ? '✓' : ''}</span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={s.hlLegend}>
        <p style={s.hlLegendTitle}>Highlight key</p>
        <div style={s.hlLegendGrid}>
          {HL_LEGEND.map(item => {
            const c = getHlStyle(item.id)
            return (
              <div key={item.id} style={s.hlLegendItem}>
                <span style={{ ...s.hlLegendDot, background: c.dot }} />
                <span style={s.hlLegendMeaning}>{item.meaning}</span>
              </div>
            )
          })}
        </div>
      </div>

      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 11l1.5-3 6.5-6.5 2 2-6.5 6-3.5.5Z" stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M8 3l2 2" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        }
        title="Scripture Highlights"
        count={kjvHighlights.length}
      />
      {kjvHighlights.length === 0
        ? <EmptyMsg text="No scripture highlights yet. Click a verse number in the Scripture reader to highlight it." />
        : (
          <div style={s.hlGrid}>
            {sortedKjv.map(h => {
              const c = getHlStyle(h.colorId)
              return (
                <div key={h.key} style={{ ...s.hlChip, background: c.rowBg, borderColor: c.border }}>
                  <button
                    style={{ ...s.hlChipInner, color: c.numClr }}
                    onClick={() => setViewingHighlight({ book: h.book, chapter: h.chapter, verse: h.verse })}
                  >
                    <HlDot colorId={h.colorId} />
                    {h.book} {h.chapter}:{h.verse}
                  </button>
                  <button onClick={() => onRemoveKjvHighlight(h.key)} style={{ ...s.hlRemoveBtn, color: c.numClr }}>×</button>
                </div>
              )
            })}
          </div>
        )
      }

      <div style={s.divider} />

      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 11l1.5-3 6.5-6.5 2 2-6.5 6-3.5.5Z" stroke="var(--purple-ink)" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M8 3l2 2" stroke="var(--purple-ink)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        }
        title="Confession Highlights"
        count={confHighlights.length}
      />
      {confHighlights.length === 0
        ? <EmptyMsg text="No confession highlights yet. Open any confession paragraph and tap Highlight." />
        : (
          <div style={s.hlGrid}>
            {sortedConf.map(h => {
              const c = getHlStyle(h.colorId)
              const srcLabel = h.source === '2lbcf' ? '2LBCF' : h.source === 'catechism' ? 'Catechism' : '1LBCF'
              return (
                <div key={h.key} style={{ ...s.hlChip, background: c.rowBg, borderColor: c.border }}>
                  <button
                    style={{ ...s.hlChipInner, color: c.numClr }}
                    onClick={() => navigate(`/confessions?t=${h.source}`, { state: { itemKey: h.itemKey, source: h.source } })}
                  >
                    <HlDot colorId={h.colorId} />
                    {srcLabel} {h.itemKey}
                  </button>
                  <button onClick={() => onRemoveConfHighlight(h.key)} style={{ ...s.hlRemoveBtn, color: c.numClr }}>×</button>
                </div>
              )
            })}
          </div>
        )
      }

      <div style={s.divider} />

      {/* ── Highlighted Phrases ── */}
      {(() => {
        const phrases = Object.entries(partialHighlights || {}).flatMap(([verseKey, ranges]) => {
          const parts = verseKey.split('|') // kjv|Book|chapter|verse
          const book = parts[1], chapter = parts[2], verse = parts[3]
          return (ranges || []).map((r, i) => ({ verseKey, book, chapter, verse, ...r, _idx: i }))
        })
        return (
          <>
            <SectionHeader
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M4 7h6M5 10h4" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              }
              title="Highlighted Phrases"
              count={phrases.length}
            />
            {phrases.length === 0
              ? <EmptyMsg text="No phrase highlights yet. Tap a word in the Scripture reader to start." />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                  {phrases.map((p, i) => {
                    const c = getHlStyle(p.colorId)
                    return (
                      <div key={`${p.verseKey}-${p.start}`} style={{ ...s.hlChip, background: c.rowBg, borderColor: c.border, flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <button
                            style={{ ...s.hlChipInner, color: c.numClr, fontSize: 11 }}
                            onClick={() => navigate('/scripture', { state: { book: p.book, chapter: Number(p.chapter), verse: Number(p.verse) } })}
                          >
                            <HlDot colorId={p.colorId} />
                            {p.book} {p.chapter}:{p.verse}
                          </button>
                          <button onClick={() => onRemovePartialHighlight(p.verseKey, p.start)} style={{ ...s.hlRemoveBtn, color: c.numClr }}>×</button>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5, paddingLeft: 4 }}>
                          "{p.text || '…'}"
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </>
        )
      })()}

      {/* Scripture verse preview modal — shown when a scripture highlight chip is tapped */}
      <ScriptureVerseModal
        sc={viewingHighlight}
        onClose={() => setViewingHighlight(null)}
        onNavigate={(book, ch, vs) => {
          setViewingHighlight(null)
          navigate('/scripture', { state: { book, chapter: ch, verse: vs } })
        }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════ */
export default function LibraryPage() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [activeTab, setActiveTab] = useState('notes')
  // If the user signs out while on the Books tab, fall back to Notes
  useEffect(() => {
    if (!session && activeTab === 'quotes') setActiveTab('notes')
  }, [session, activeTab])

  const [vocabReview,   setVocabReview]   = useState(null)  // { lang } when review open
  const [vocabGreek,    setVocabGreek]    = useState(() => getVocabList('greek'))
  const [vocabHebrew,   setVocabHebrew]   = useState(() => getVocabList('hebrew'))
  function refreshVocab() {
    setVocabGreek(getVocabList('greek'))
    setVocabHebrew(getVocabList('hebrew'))
  }
  // Refresh vocab list when tab becomes active
  useEffect(() => { if (activeTab === 'vocab') refreshVocab() }, [activeTab])
  const [libSearch,     setLibSearch]     = useState('')
  const [bookLibraryCount, setBookLibraryCount] = useState(0)
  const [libSearchOpen, setLibSearchOpen] = useState(false)
  const libSearchRef = useRef(null)
  /* Track whether the note editor is focused (for nav-hide / Done bar) */
  const [isEditingNote, setIsEditingNote] = useState(false)
  /* Track whether the full-screen NoteEditOverlay is open — used to hide
     the sticky header completely so it can't peek through on iOS Safari */
  const [isNoteOverlayOpen, setIsNoteOverlayOpen] = useState(false)

  const [devNotes,       setDevNotes]       = useState([])
  const [scBookmarks,    setScBookmarks]    = useState(() => getAllScriptureBookmarks())
  const [kjvHighlights,      setKjvHighlights]      = useState(() => getAllKjvHighlights())
  const [kjvNotes,           setKjvNotes]           = useState(() => getAllKjvNotes())
  const [confHighlights,     setConfHighlights]     = useState(() => getAllConfHighlights())
  const [confNotes,          setConfNotes]          = useState(() => getAllConfNotes())
  const [libNotes,           setLibNotes]           = useState(() => getAllLibNotes())
  const [partialHighlights,  setPartialHighlightsL] = useState(() => loadPartialHighlights())

  // Load devNotes from localStorage (always fast, works offline)
  function loadDevNotesFromLocal() {
    const local = getLocalProgress()
    setDevNotes(
      Object.entries(local)
        .filter(([, d]) => d.notes && d.notes.trim())
        .map(([day, d]) => ({ day_number: parseInt(day), notes: d.notes }))
    )
  }

  useEffect(() => {
    // Show local notes immediately — fast, offline-safe, always up-to-date
    loadDevNotesFromLocal()
    // When signed in, merge Supabase data so notes from other devices appear too.
    // IMPORTANT: local notes take precedence — a note just saved from ReadingPage
    // is in localStorage instantly but may not yet be in Supabase, so we must
    // not overwrite local data with the cloud response.
    if (session) {
      supabase.from('progress').select('day_number, completed, notes')
        .eq('user_id', session.user.id)
        .then(({ data }) => {
          if (!data) return
          const local = getLocalProgress()
          // Build a merged map: start from cloud notes, then overlay local (higher priority)
          const map = {}
          data.forEach(r => { if (r.notes?.trim()) map[r.day_number] = r.notes })
          Object.entries(local).forEach(([day, d]) => {
            if (d.notes?.trim()) map[parseInt(day)] = d.notes  // local wins on conflict
          })
          setDevNotes(
            Object.entries(map).map(([day, notes]) => ({ day_number: parseInt(day), notes }))
          )
        })
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // When ReadingPage saves a note, it dispatches this event so we can refresh
  // immediately from localStorage without waiting for a Supabase round-trip.
  useEffect(() => {
    const handler = () => loadDevNotesFromLocal()
    window.addEventListener('pb-progress-updated', handler)
    return () => window.removeEventListener('pb-progress-updated', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Restore scroll on mount, save on unmount — so back-navigation returns to same spot */
  useEffect(() => {
    restoreScroll('library')
    return () => saveScroll('library')
  }, [])

  useEffect(() => {
    const refresh = () => {
      setKjvHighlights(getAllKjvHighlights())
      setKjvNotes(getAllKjvNotes())
      setConfHighlights(getAllConfHighlights())
      setConfNotes(getAllConfNotes())
      setLibNotes(getAllLibNotes())
    }
    const refreshPartial = () => setPartialHighlightsL(loadPartialHighlights())
    window.addEventListener('pb-highlight-changed',          refresh)
    window.addEventListener('pb-note-changed',               refresh)
    window.addEventListener('pb-annotations-updated',        refresh)
    window.addEventListener('pb-partial-highlight-changed',  refreshPartial)
    return () => {
      window.removeEventListener('pb-highlight-changed',         refresh)
      window.removeEventListener('pb-note-changed',              refresh)
      window.removeEventListener('pb-annotations-updated',       refresh)
      window.removeEventListener('pb-partial-highlight-changed', refreshPartial)
    }
  }, [])

  useEffect(() => {
    const handler = () => setScBookmarks(getAllScriptureBookmarks())
    window.addEventListener('pb-sc-bookmark-changed', handler)
    return () => window.removeEventListener('pb-sc-bookmark-changed', handler)
  }, [])

  // Book library count — only active (and non-zero) when signed in
  useEffect(() => {
    if (!session) {
      setBookLibraryCount(0)
      return
    }
    const calc = () => Object.keys(getAllQuotes()).length
    setBookLibraryCount(calc())
    const handler = () => setBookLibraryCount(calc())
    window.addEventListener('pb-quote-library-updated', handler)
    return () => window.removeEventListener('pb-quote-library-updated', handler)
  }, [session])

  /* Show/hide nav & header when note editor is focused */
  useEffect(() => {
    const onFocus = () => {
      setIsEditingNote(true)
      document.body.dataset.noteEditing = '1'
    }
    const onBlur = () => {
      setIsEditingNote(false)
      delete document.body.dataset.noteEditing
    }
    window.addEventListener('pb-note-editor-focus', onFocus)
    window.addEventListener('pb-note-editor-blur',  onBlur)
    return () => {
      window.removeEventListener('pb-note-editor-focus', onFocus)
      window.removeEventListener('pb-note-editor-blur',  onBlur)
      delete document.body.dataset.noteEditing
    }
  }, [])

  /* Hide the sticky header completely when NoteEditOverlay is open so it
     cannot peek through on iOS Safari (position:sticky stacking context) */
  useEffect(() => {
    const onOpen  = () => setIsNoteOverlayOpen(true)
    const onClose = () => setIsNoteOverlayOpen(false)
    window.addEventListener('pb-note-overlay-open',  onOpen)
    window.addEventListener('pb-note-overlay-close', onClose)
    return () => {
      window.removeEventListener('pb-note-overlay-open',  onOpen)
      window.removeEventListener('pb-note-overlay-close', onClose)
    }
  }, [])

  // Track offline banner so the sticky header knows where to stick.
  const OFFLINE_BANNER_H = 34
  const [offlineBannerH, setOfflineBannerH] = useState(() => navigator.onLine ? 0 : OFFLINE_BANNER_H)
  useEffect(() => {
    const goOnline  = () => setOfflineBannerH(0)
    const goOffline = () => setOfflineBannerH(OFFLINE_BANNER_H)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, []) // eslint-disable-line

  const enrichedDevNotes = useMemo(() =>
    devNotes
      .map(n => ({ ...n, entry: SCHEDULE.find(r => r.day === n.day_number) || null }))
      .sort((a, b) => a.day_number - b.day_number),
    [devNotes]
  )

  const notesCount      = libNotes.length + kjvNotes.length + enrichedDevNotes.length + confNotes.length
  const bookmarksCount  = scBookmarks.length
  const highlightsCount = kjvHighlights.length   + confHighlights.length

  const vocabCount = vocabGreek.length + vocabHebrew.length
  const TABS = [
    { id: 'notes',      label: 'Notes',      count: notesCount      },
    { id: 'bookmarks',  label: 'Bookmarks',  count: bookmarksCount  },
    { id: 'highlights', label: 'Highlights', count: highlightsCount },
    { id: 'vocab',      label: 'Vocab',      count: vocabCount      },
    // Books tab is only available to signed-in users
    ...(session ? [{ id: 'quotes', label: 'Quotes', count: bookLibraryCount }] : []),
  ]

  const handleRemoveScBookmark    = useCallback((book, chapter) => { toggleScriptureBookmark(book, chapter); setScBookmarks(getAllScriptureBookmarks()) }, [])
  const handleRemoveKjvHighlight  = useCallback(key  => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveConfHighlight = useCallback(key  => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveKjvNote       = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveConfNote      = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveLibNote       = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveDevNote       = useCallback(dayNumber => {
    setLocalProgress(dayNumber, { notes: '' })
    setDevNotes(prev => prev.filter(n => n.day_number !== dayNumber))
    if (session) {
      supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: dayNumber,
        notes: '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' }).catch(() => {})
    }
  }, [session])

  return (
    <div style={s.page}>

      {/* ── Header (no back button — BottomNav handles navigation) ── */}
      <header style={{ ...s.header, top: offlineBannerH, ...(isEditingNote ? s.headerEditing : {}), ...(isNoteOverlayOpen ? { visibility: 'hidden', pointerEvents: 'none' } : {}) }}>
        {/* Editing mode: minimal "Note editing · Done" bar */}
        {isEditingNote && (
          <div style={s.editingBar}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--teal)', flexShrink: 0 }}>
              <path d="M2 11l1.2-2.4 6-6 2 2-6 6L2 11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <span style={s.editingBarText}>Note editor</span>
            <button
              style={s.editingDoneBtn}
              onClick={() => document.activeElement?.blur()}
            >Done</button>
          </div>
        )}
        <div style={{ ...s.headerInner, ...(isEditingNote ? { display: 'none' } : {}) }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: 'var(--teal)' }}>
            <rect x="2" y="2" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1"/>
            <path d="M5.5 6h7M5.5 9.5h5M5.5 13h5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M12 2v4l-1.5-1-1.5 1V2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          {(libSearchOpen || libSearch) ? (
            /* Expanded search input — replaces title text */
            <div style={s.headerSearchRow}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>
                <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                ref={libSearchRef}
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                placeholder="Search notes…"
                style={s.headerSearchInput}
                autoFocus
                onBlur={() => { if (!libSearch) setLibSearchOpen(false) }}
              />
              <button
                onMouseDown={e => { e.preventDefault(); setLibSearch(''); setLibSearchOpen(false) }}
                style={s.headerSearchClear}
                aria-label="Close search"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            /* Default: title + search icon */
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={s.headerTitle}>My Library</span>
                <span style={s.headerSub}>Notes, bookmarks, highlights &amp; more</span>
              </div>
              <button
                onClick={() => { setLibSearchOpen(true); setActiveTab('notes'); setTimeout(() => libSearchRef.current?.focus(), 0) }}
                style={s.headerSearchBtn}
                aria-label="Search notes"
                title="Search notes"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M11.5 11.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </>
          )}
        </div>
        <div style={{ ...s.tabBar, ...(isEditingNote ? { display: 'none' } : {}) }} data-onboarding="library-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ ...s.tabBadge, ...(activeTab === tab.id ? s.tabBadgeActive : {}) }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div style={s.scrollArea}>
        {activeTab === 'notes' && (
          <NotesTab
            enrichedDevNotes={enrichedDevNotes}
            kjvNotes={kjvNotes}
            confNotes={confNotes}
            libNotes={libNotes}
            navigate={navigate}
            session={session}
            onRemoveKjvNote={handleRemoveKjvNote}
            onRemoveConfNote={handleRemoveConfNote}
            onRemoveLibNote={handleRemoveLibNote}
            onRemoveDevNote={handleRemoveDevNote}
            searchQuery={libSearch}
          />
        )}
        {activeTab === 'bookmarks' && (
          <BookmarksTab
            scBookmarks={scBookmarks}
            navigate={navigate}
            onRemoveScBookmark={handleRemoveScBookmark}
          />
        )}
        {activeTab === 'highlights' && (
          <HighlightsTab
            kjvHighlights={kjvHighlights}
            confHighlights={confHighlights}
            partialHighlights={partialHighlights}
            navigate={navigate}
            onRemoveKjvHighlight={handleRemoveKjvHighlight}
            onRemoveConfHighlight={handleRemoveConfHighlight}
            onRemovePartialHighlight={(verseKey, start) => {
              removePartialHighlight(verseKey, start)
              setPartialHighlightsL(loadPartialHighlights())
            }}
          />
        )}
        {activeTab === 'vocab' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {vocabGreek.length === 0 && vocabHebrew.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-faint)', fontSize: 14, lineHeight: 1.7 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>αβγ</div>
                No saved words yet.<br />
                Open any Greek or Hebrew word in the lexicon<br />and tap <strong>Save word</strong> to add it here.
              </div>
            ) : (
              [{ lang: 'greek', label: 'Greek', words: vocabGreek }, { lang: 'hebrew', label: 'Hebrew', words: vocabHebrew }].map(({ lang, label, words }) =>
                words.length > 0 && (
                  <VocabBox
                    key={lang}
                    lang={lang}
                    label={label}
                    words={words}
                    onReview={() => setVocabReview({ lang, words: [...words] })}
                    onRemove={id => { removeVocabWord(id); refreshVocab() }}
                    onStatusChange={(id, status) => { setVocabStatus(id, status); refreshVocab() }}
                  />
                )
              )
            )}
          </div>
        )}
        {activeTab === 'quotes' && (
          session ? (
            <BookLibraryTab searchQuery={libSearch} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px', textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--teal)', opacity: 0.7 }}>
                <rect x="6" y="5" width="20" height="28" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M26 9h6v26l-6-3-6 3V9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)', maxWidth: 260, lineHeight: 1.6 }}>
                Sign in to access Book Reading Notes and track your reading journey.
              </p>
              <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{ fontSize: 13 }}>
                Sign in →
              </button>
            </div>
          )
        )}
      </div>

      {vocabReview && (
        <VocabReviewScreen
          words={vocabReview.words}
          lang={vocabReview.lang}
          onClose={() => setVocabReview(null)}
        />
      )}

    </div>
  )
}

/* ── Vocab list box (collapsible per language) ───────────────────────────── */
function VocabBox({ lang, label, words, onReview, onRemove, onStatusChange }) {
  const [open, setOpen] = useState(true)
  const isHeb = lang === 'hebrew'
  const scriptFont = isHeb ? getHebrewFontCss() : getGreekFontCss()

  return (
    <div style={vb.box}>
      {/* Box header */}
      <div style={vb.boxHeader} onClick={() => setOpen(o => !o)}>
        <svg width="10" height="10" viewBox="0 0 10 10"
          style={{ flexShrink:0, transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', color:'var(--ink-faint)' }}>
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <span style={vb.boxLabel}>{label}</span>
        <span style={vb.boxCount}>{words.length} word{words.length !== 1 ? 's' : ''}</span>
        <button
          style={vb.reviewBtn}
          onClick={e => { e.stopPropagation(); onReview() }}
        >
          ▶ Review
        </button>
      </div>

      {/* Word list */}
      {open && (
        <div style={vb.wordList}>
          {words.map(w => {
            const st = VOCAB_STATUSES.find(s => s.id === (w.status || 'new')) || VOCAB_STATUSES[0]
            const nextStatus = VOCAB_STATUSES[(VOCAB_STATUSES.findIndex(s => s.id === (w.status || 'new')) + 1) % VOCAB_STATUSES.length].id
            return (
              <div key={w.id} style={vb.wordRow}>
                <span style={{ ...vb.lemma, fontFamily: scriptFont, direction: isHeb ? 'rtl' : 'ltr' }}>
                  {w.lemma}
                </span>
                <div style={vb.wordMeta}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {w.translit && <span style={vb.translit}>{w.translit}</span>}
                    <span style={vb.strongsBadge}>{w.id}</span>
                    {w.reviewCount > 0 && (
                      <span style={vb.reviewCountBadge}>×{w.reviewCount}</span>
                    )}
                  </div>
                  {w.gloss && <span style={vb.gloss}>{w.gloss}</span>}
                  {w.savedFrom?.book && (
                    <span style={vb.savedFrom}>
                      {w.savedFrom.book}{w.savedFrom.chapter ? ` ${w.savedFrom.chapter}` : ''}
                    </span>
                  )}
                </div>
                <button
                  style={{ ...vb.statusTag, color: st.color, background: st.bg }}
                  onClick={() => onStatusChange(w.id, nextStatus)}
                  title="Tap to change status"
                >
                  {st.label}
                </button>
                <button style={vb.removeBtn} onClick={() => onRemove(w.id)} aria-label="Remove">×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Vocab review screen ─────────────────────────────────────────────────── */
function VocabReviewScreen({ words, lang, onClose }) {
  const [idx,     setIdx]     = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done,    setDone]    = useState(false)
  const [kjvData, setKjvData] = useState(null)
  const reviewedRef = useRef(new Set())

  useEffect(() => {
    loadBibleVersion('kjv').then(d => setKjvData(d)).catch(() => {})
  }, [])

  const card = words[idx]
  const isHeb = lang === 'hebrew'
  const scriptFont = isHeb ? getHebrewFontCss() : getGreekFontCss()

  // Look up the KJV verse text for the current card
  const verseText = useMemo(() => {
    if (!kjvData || !card?.savedFrom?.book || !card?.savedFrom?.chapter || !card?.savedFrom?.verse) return null
    try {
      const verses = getChapterVerses(kjvData, card.savedFrom.book, card.savedFrom.chapter)
      return verses?.find(v => v.verse === card.savedFrom.verse)?.text || null
    } catch { return null }
  }, [kjvData, card?.savedFrom?.book, card?.savedFrom?.chapter, card?.savedFrom?.verse])

  function next() {
    if (idx + 1 >= words.length) { setDone(true); return }
    setIdx(i => i + 1)
    setFlipped(false)
  }
  function prev() {
    if (idx === 0) return
    setIdx(i => i - 1)
    setFlipped(false)
  }
  function restart() {
    setIdx(0)
    setFlipped(false)
    setDone(false)
    reviewedRef.current = new Set()
  }
  function handleReveal() {
    setFlipped(true)
    // increment review count once per word per session
    if (!reviewedRef.current.has(card.id)) {
      reviewedRef.current.add(card.id)
      incrementReviewCount(card.id)
    }
  }

  return (
    <div style={vr.overlay}>
      {/* Header */}
      <div style={vr.header}>
        <span style={vr.langBadge}>{lang === 'greek' ? 'Greek' : 'Hebrew'}</span>
        <span style={vr.counter}>{done ? `${words.length} / ${words.length}` : `${idx + 1} / ${words.length}`}</span>
        <button style={vr.closeBtn} onClick={onClose}>×</button>
      </div>

      {done ? (
        <div style={vr.doneWrap}>
          <div style={vr.doneCheck}>✓</div>
          <p style={vr.doneTitle}>Review complete</p>
          <p style={vr.doneSub}>{words.length} word{words.length !== 1 ? 's' : ''} reviewed</p>
          <button style={vr.reviewAgainBtn} onClick={restart}>Review again</button>
          <button style={vr.doneCloseBtn} onClick={onClose}>Done</button>
        </div>
      ) : (
        <div style={vr.cardWrap}>
          <div style={vr.card} onClick={() => !flipped && handleReveal()}>
            {/* Front */}
            <div style={vr.cardFront}>
              <span style={{ ...vr.cardLemma, fontFamily: scriptFont, direction: isHeb ? 'rtl' : 'ltr' }}>
                {card.lemma}
              </span>
              <span style={vr.cardId}>{card.id}</span>
              {!flipped && <span style={vr.tapHint}>Tap to reveal</span>}
            </div>

            {/* Back */}
            {flipped && (
              <div style={vr.cardBack}>
                {card.morph && <p style={vr.cardMorph}>{card.morph}</p>}
                {card.translit && <p style={vr.cardTranslit}>{card.translit}{card.pronun ? ` · /${card.pronun}/` : ''}</p>}
                {card.gloss && <p style={vr.cardGloss}>"{card.gloss}"</p>}
                {card.def && <p style={vr.cardDef}>{card.def}</p>}
                {verseText && (
                  <p style={vr.cardVerse}>
                    {verseText}
                  </p>
                )}
                {card.savedFrom?.book && (
                  <p style={vr.cardSavedFrom}>
                    {card.savedFrom.book}{card.savedFrom.chapter ? ` ${card.savedFrom.chapter}` : ''}{card.savedFrom.verse ? `:${card.savedFrom.verse}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={vr.navRow}>
            <button style={{ ...vr.navBtn, opacity: idx === 0 ? 0.3 : 1 }} onClick={prev} disabled={idx === 0}>← Prev</button>
            {!flipped
              ? <button style={vr.revealBtn} onClick={handleReveal}>Reveal</button>
              : <button style={vr.nextBtn} onClick={next}>{idx + 1 >= words.length ? 'Finish' : 'Next →'}</button>
            }
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Styles ────────────────────────────────────────────────────────────────── */
const s = {
  page: {
    minHeight: '100vh', background: 'var(--parchment)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    paddingTop: 'env(safe-area-inset-top)',
  },
  headerInner: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 8px' },
  headerEditing: { transition: 'all 0.15s' },
  editingBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', minHeight: 42,
  },
  editingBarText: { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' },
  editingDoneBtn: {
    background: 'var(--teal)', border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 13, fontWeight: 700, padding: '5px 14px',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Cormorant Garamond', serif", display: 'block' },
  headerSub:   { fontSize: 11, color: 'var(--ink-faint)', display: 'block', marginTop: 1 },
  headerSearchBtn: {
    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0,
    borderRadius: 8, transition: 'color 0.12s',
  },
  headerSearchRow: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--parchment-dark)', borderRadius: 8, padding: '5px 10px',
  },
  headerSearchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    fontSize: 14, color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
  },
  headerSearchClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 1, flexShrink: 0,
  },
  tabBar: { display: 'flex', borderTop: '1px solid var(--border)' },
  tab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', padding: '10px 4px', fontSize: 12, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive:      { color: 'var(--teal)', borderBottom: '2px solid var(--teal)' },
  tabBadge:       { fontSize: 9, fontWeight: 700, background: 'var(--border)', color: 'var(--ink-faint)', borderRadius: 99, padding: '1px 5px', lineHeight: 1.6 },
  tabBadgeActive: { background: 'var(--teal-light)', color: 'var(--teal)' },
  scrollArea:     { flex: 1, overflowY: 'auto', paddingBottom: 90 },
  tabContent:     { padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 4 },
  divider:        { height: 1, background: 'var(--border)', margin: '14px 0 10px' },
  sectionHeader:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4, flexWrap: 'wrap' },
  sectionTitle:   { fontSize: 13, fontWeight: 700, color: 'var(--ink)' },
  sectionBadge:   { fontSize: 9, fontWeight: 700, background: 'var(--teal-light)', color: 'var(--teal)', borderRadius: 99, padding: '1px 6px' },
  sectionHint:    { fontSize: 11, color: 'var(--ink-faint)', margin: '-2px 0 6px', lineHeight: 1.5 },
  emptyText:      { fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 4px', lineHeight: 1.6 },

  /* ── Highlight legend ── */
  hlLegend: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 12,
  },
  hlLegendTitle: {
    fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
  },
  hlLegendGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px' },
  hlLegendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  hlLegendDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  hlLegendMeaning: { fontSize: 12, color: 'var(--ink)', fontWeight: 500 },

  searchClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: '1px', flexShrink: 0,
  },
  searchMeta: {
    fontSize: 11, color: 'var(--teal)', fontWeight: 600,
    margin: '0 0 2px', lineHeight: 1.5,
  },

  /* ── Compact control row (New Note + Sort + Filter + Search) ── */
  controlRow: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap',
  },
  newNoteBtnSmall: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'var(--teal)', border: 'none', borderRadius: 8,
    padding: '7px 12px', cursor: 'pointer', color: '#fff',
    fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
    flexShrink: 0, transition: 'opacity 0.12s',
  },
  /* ── Icon dropdown buttons (Sort / Filter) ── */
  iconDropBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'var(--parchment-dark)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
    color: 'var(--ink-muted)', fontSize: 12, fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.12s',
    position: 'relative',
  },
  iconDropBtnOpen: {
    background: 'var(--teal-light)', borderColor: 'var(--teal)', color: 'var(--teal)',
  },
  iconDropLabel: {
    maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  /* ── Grid / List view toggle buttons ── */
  viewToggleBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28,
    background: 'var(--parchment-dark)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--ink-faint)',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  },
  viewToggleBtnActive: {
    background: 'var(--teal-light)', borderColor: 'var(--teal)', color: 'var(--teal)',
  },
  iconDropActiveDot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--teal)', border: '1.5px solid var(--surface)',
  },
  /* ── Dropdown panel ── */
  dropPanel: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, boxShadow: '0 4px 16px rgba(26,22,17,0.13)',
    minWidth: 160, overflow: 'hidden',
    animation: 'fadeIn 0.12s ease',
  },
  dropOption: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', background: 'none', border: 'none',
    padding: '9px 14px', cursor: 'pointer', textAlign: 'left',
    fontSize: 13, color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.1s',
  },
  dropOptionActive: {
    background: 'var(--teal-light)', color: 'var(--teal)', fontWeight: 600,
  },
  dropOptionCheck: {
    width: 14, fontSize: 11, color: 'var(--teal)', flexShrink: 0, fontWeight: 700,
  },
  dropDivider: {
    height: 1, background: 'var(--border)', margin: '2px 0',
  },
  clearFilterBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--teal)', fontSize: 11, fontWeight: 600,
    padding: 0, fontFamily: "'DM Sans', sans-serif",
  },

  /* ── Kanban responsive grid — min 250 px per card, wraps automatically ── */
  kanbanGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: 8, marginBottom: 4,
  },

  /* ── New Note button (legacy — kept for safety) ── */
  newNoteBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', background: 'var(--teal-light)', border: '1.5px dashed var(--teal)',
    borderRadius: 'var(--radius-lg)', padding: '11px 14px',
    cursor: 'pointer', color: 'var(--teal)', fontSize: 13, fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif", transition: 'background 0.12s', marginBottom: 4,
  },

  /* ── Create / Edit form ── */
  createForm: {
    background: 'var(--surface)', border: '1.5px solid var(--teal)',
    borderRadius: 'var(--radius-lg)', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4,
  },
  createFormHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  autoSavedTag: {
    fontSize: 10, fontWeight: 700, color: 'var(--teal)',
    background: 'var(--teal-light)', borderRadius: 4,
    padding: '2px 6px', flexShrink: 0,
  },
  formCloseBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },

  /* ── Scripture tag toggle ── */
  tagToggleBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.15s, color 0.15s', textAlign: 'left',
  },
  tagToggleBtnActive: { borderColor: 'var(--teal)', color: 'var(--teal)', background: 'var(--teal-light)' },
  tagPreview: {
    marginLeft: 4, fontSize: 11, fontWeight: 700,
    background: 'var(--teal)', color: '#fff', borderRadius: 99, padding: '1px 8px',
  },
  pickerRow:        { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' },
  pickerGroup:      { display: 'flex', flexDirection: 'column', gap: 3 },
  pickerLabel:      { fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  pickerSelect:     { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", maxWidth: 200 },
  pickerSelectSmall:{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", width: 76 },
  pickerInput:      { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', fontFamily: "'DM Sans', sans-serif", width: 68, outline: 'none' },
  tagHint:          { fontSize: 11, color: 'var(--ink-faint)', margin: 0, lineHeight: 1.55 },
  formActions:      { display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 2 },
  cancelBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
    padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: 'var(--ink-muted)', fontFamily: "'DM Sans', sans-serif",
  },
  saveBtn: {
    background: 'var(--teal)', border: 'none', borderRadius: 8,
    padding: '7px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif", transition: 'opacity 0.15s',
  },

  /* ── Cards ── */
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '10px 12px',
    transition: 'border-color 0.15s', marginBottom: 4,
  },
  cardHead:    { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' },
  dayBadge:    { fontSize: 10, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 },
  dateBadge:   { fontSize: 10, color: 'var(--ink-faint)', flexShrink: 0 },
  refBadge:    { fontSize: 11, fontWeight: 600, color: 'var(--ink)' },
  srcBadge:    { fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, letterSpacing: '0.04em', flexShrink: 0 },
  cardReading: { fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', fontFamily: "'Cormorant Garamond', serif" },

  /* "See more / See less" toggle */
  seeMoreBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, color: 'var(--teal)',
    padding: '2px 0 0', fontFamily: "'DM Sans', sans-serif",
    textDecoration: 'underline', textUnderlineOffset: 2,
    display: 'block',
  },

  /* Plain note body */
  noteBody: {
    fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.7,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: "'DM Sans', sans-serif",
  },

  /* Rich note display */
  richTitle: {
    fontSize: 14, fontWeight: 700, color: 'var(--ink)',
    margin: '0 0 6px', fontFamily: "'Cormorant Garamond', serif",
  },
  richBody: {
    fontSize: 13, color: 'var(--ink)', lineHeight: 1.7,
    fontFamily: "'DM Sans', sans-serif", wordBreak: 'break-word',
    overflowX: 'hidden',
  },

  /* copy/share bar */
  copyShareBar: { display: 'flex', gap: 6, marginTop: 6 },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
  },

  removeBtn: {
    marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--ink-faint)', padding: '2px 4px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.12s',
  },
  editBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
  },
  openBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif", padding: '2px 0',
    marginLeft: 'auto', flexShrink: 0,
  },

  /* ── Note labels (view mode) ── */
  noteLabelRow: { display: 'flex', flexWrap: 'wrap', gap: 4, margin: '0 0 6px' },
  noteLabelChip: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
    padding: '2px 7px', borderRadius: 99,
    background: 'var(--teal-light)', color: 'var(--teal)',
    border: '1px solid var(--teal)', fontFamily: "'DM Sans', sans-serif",
    textTransform: 'uppercase',
  },

  /* ── Sort bar ── */
  sortBar: {
    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
    marginBottom: 4,
  },
  sortLabel: { fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', letterSpacing: '0.04em', flexShrink: 0 },
  sortBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 99,
    padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.12s, color 0.12s',
  },
  sortBtnActive: { background: 'var(--teal)', borderColor: 'var(--teal)', color: '#fff' },

  /* ── Label filter row ── */
  labelFilterRow: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 },
  filterChip: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 99,
    padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.12s, color 0.12s',
  },
  filterChipActive: { background: 'var(--teal-light)', borderColor: 'var(--teal)', color: 'var(--teal)' },

  /* ── Highlights ── */
  hlGrid:      { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  hlChip:      { display: 'inline-flex', alignItems: 'center', border: '1px solid', borderRadius: 99, overflow: 'hidden' },
  hlChipInner: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 8px 4px 10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  hlRemoveBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 8px 2px 2px', opacity: 0.7 },
}

/* ── Rich editor styles ── */
const re = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  titleInput: {
    width: '100%', border: 'none', borderBottom: '1.5px solid var(--border)',
    background: 'transparent', outline: 'none',
    fontSize: 16, fontWeight: 700, color: 'var(--ink)',
    fontFamily: "'Cormorant Garamond', serif",
    padding: '4px 2px 8px', boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
    background: 'var(--parchment)', border: '1px solid var(--border)',
    borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '4px 6px',
  },
  toolBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 28, height: 26, borderRadius: 5, border: 'none',
    background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.1s',
  },
  toolBtnActive: {
    background: 'var(--teal-light)', color: 'var(--teal)',
  },
  toolDivider: {
    width: 1, height: 18, background: 'var(--border)', margin: '0 4px', flexShrink: 0,
  },
  atHint: {
    fontSize: 10, color: 'var(--ink-faint)', fontStyle: 'italic',
    fontFamily: "'DM Sans', sans-serif",
  },
  editor: {
    minHeight: 'calc(60vh - 200px)',
    border: '1px solid var(--border)', borderBottom: 'none',
    borderRadius: '8px 8px 0 0',
    padding: '10px 12px', fontSize: 16, lineHeight: 1.75,
    color: 'var(--ink)', background: 'var(--parchment)',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none', overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-word',
    boxSizing: 'border-box',
  },
}

/* ── Note Edit Overlay styles ── */
const eo = {
  overlay:    { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'var(--parchment)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", overscrollBehavior: 'none' },
  singleBar:  { display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', paddingTop: 'max(6px, env(safe-area-inset-top))', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' },
  backBtn:    { display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: '4px 6px', flexShrink: 0 },
  iconBtn:    { display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: '4px 6px', borderRadius: 6, flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' },
  contentPad: { padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
}

/* ── @ mention popup styles ── */
const am = {
  popup: {
    position: 'fixed', zIndex: 9000,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
    padding: 10, width: 240,
    fontFamily: "'DM Sans', sans-serif",
  },
  label: { fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' },
  bookList: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' },
  bookBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', padding: '6px 8px', borderRadius: 6,
    fontSize: 13, color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.1s',
  },
  empty: { fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: 8 },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, color: 'var(--teal)',
    padding: '4px 0 6px', fontFamily: "'DM Sans', sans-serif",
  },
  refRow:   { display: 'flex', gap: 8, marginBottom: 10 },
  refGroup: { display: 'flex', flexDirection: 'column', gap: 3 },
  refLabel: { fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  refSelect: { border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', cursor: 'pointer', width: 72 },
  refInput:  { border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)', width: 64, outline: 'none' },
  insertRow: { display: 'flex', gap: 6 },
  insertBtn: {
    flex: 1, background: 'var(--teal)', border: 'none', borderRadius: 7,
    padding: '7px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif",
  },
  insertBtnAlt:  { background: 'var(--surface)', color: 'var(--teal)', border: '1.5px solid var(--teal)' },
  resolvedRef:   { fontSize: 14, fontWeight: 700, color: 'var(--teal)', fontFamily: "'Cormorant Garamond', serif", margin: '2px 0 6px' },
  versePreview:  { fontSize: 11, color: 'var(--ink-muted)', fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px', padding: '6px 8px', background: 'var(--teal-light)', borderRadius: 4 },
  editRefBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', padding: '6px 0 0', fontFamily: "'DM Sans', sans-serif" },
  hintSmall:     { fontSize: 9, fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0 },
  kbHint:        { fontSize: 10, color: 'var(--ink-faint)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  kbd: {
    display: 'inline-block', fontSize: 9, fontWeight: 700,
    background: 'var(--parchment-dark)', border: '1px solid var(--border-strong)',
    borderRadius: 4, padding: '1px 5px', fontFamily: "'DM Sans', sans-serif",
    color: 'var(--ink-muted)', boxShadow: '0 1px 0 var(--border-strong)',
  },
}

/* ── Label dropdown styles ── */
const lp = {
  /* LabelDropdown trigger button */
  trigger: {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
    padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textAlign: 'left',
  },
  /* Row of selected label chips below trigger */
  selectedRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  selectedChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--teal-light)', border: '1px solid var(--teal)',
    borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700,
    color: 'var(--teal)', fontFamily: "'DM Sans', sans-serif",
  },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, color: 'var(--teal)', lineHeight: 1, padding: 0, opacity: 0.7,
  },
  /* Dropdown panel */
  panel: {
    position: 'absolute', zIndex: 5000, top: 'calc(100% + 4px)', left: 0, right: 0,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: '6px 8px', maxHeight: 240, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px',
    cursor: 'pointer', borderRadius: 6,
  },
  panelDivider: { height: 1, background: 'var(--border)', margin: '4px 0' },
  addBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif", textAlign: 'left', padding: '4px 2px',
  },
  addInput: {
    flex: 1, border: '1px solid var(--teal)', borderRadius: 7, padding: '4px 8px',
    fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)',
    outline: 'none', fontFamily: "'DM Sans', sans-serif",
  },
  addConfirm: {
    background: 'var(--teal)', border: 'none', borderRadius: 7,
    padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
  },
}

/* ── Delete confirm modal styles ── */
const dc = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9100,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 24px',
  },
  sheet: {
    width: '100%', maxWidth: 340,
    background: 'var(--surface)', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
    padding: '28px 24px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    fontFamily: "'DM Sans', sans-serif",
  },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' },
  body:  { fontSize: 13, color: 'var(--ink-muted)', textAlign: 'center', lineHeight: 1.6, margin: '2px 0 12px' },
  actions: { display: 'flex', gap: 10, width: '100%' },
  cancelBtn: {
    flex: 1, background: 'none', border: '1px solid var(--border-strong)',
    borderRadius: 10, padding: '10px 0', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif",
  },
  deleteBtn: {
    flex: 1, background: 'var(--red)', border: 'none',
    borderRadius: 10, padding: '10px 0', cursor: 'pointer',
    fontSize: 13, fontWeight: 700, color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
  },
}

/* ── Note view modal styles ── */
const nv = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 8500,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: 640,
    background: 'var(--parchment)', borderRadius: '18px 18px 0 0',
    boxShadow: '0 -6px 30px rgba(0,0,0,0.18)',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 99, background: 'var(--border-strong)',
    margin: '10px auto 0', flexShrink: 0,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
    gap: 8,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  titleText: {
    fontSize: 15, fontWeight: 700, color: 'var(--ink)',
    fontFamily: "'Cormorant Garamond', serif",
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
  },
  titleFaint: {
    fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic',
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  openBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif", padding: '4px 6px',
  },
  editBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--parchment-dark)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)',
    fontFamily: "'DM Sans', sans-serif",
  },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center',
    background: 'var(--parchment-dark)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--ink-muted)',
    transition: 'color 0.15s, background 0.15s',
  },
  copyBtnDone: {
    color: 'var(--teal)', background: 'var(--teal-light)', borderColor: 'var(--teal)',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center',
    background: 'var(--red-light)', border: '1px solid var(--red)',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', padding: 4, display: 'flex', alignItems: 'center',
  },
  actionBar: {
    display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
    padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 7, border: 'none', background: 'none',
    fontSize: 13, fontWeight: 500, color: 'var(--ink-faint)', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  body: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px 24px',
  },
}

/* ── Note card (kanban tile) styles ── */
const nc = {
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '10px 12px',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    gap: 6, minHeight: 130, transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  top: { display: 'flex', alignItems: 'flex-start', minHeight: 22 },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
    display: 'inline-block', maxWidth: '100%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
  },
  title: {
    fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0,
    fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.3,
    overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  titleFaint: {
    fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  labelRow: { display: 'flex', flexWrap: 'wrap', gap: 3 },
  labelChip: {
    fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
    background: 'var(--teal-light)', color: 'var(--teal)', letterSpacing: '0.04em',
    textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
  },
  labelMore: {
    fontSize: 9, color: 'var(--ink-faint)', fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif", alignSelf: 'center',
  },
  preview: {
    flex: 1, fontSize: 12, color: 'var(--ink-muted)', margin: 0,
    lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
    fontFamily: "'DM Sans', sans-serif", wordBreak: 'break-word',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border)',
  },
  date: { fontSize: 11, color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif" },
  actions: { display: 'flex', gap: 2, alignItems: 'center', marginLeft: 'auto' },
  openBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 9, fontWeight: 700, color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif", padding: '2px 4px',
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 5, border: 'none',
    background: 'none', cursor: 'pointer', color: 'var(--ink-faint)',
    transition: 'color 0.12s, background 0.12s',
  },
}

/* ── Scripture verse modal styles ── */
const vm = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 8000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: '0 0 env(safe-area-inset-bottom)',
  },
  sheet: {
    width: '100%', maxWidth: 560,
    background: 'var(--surface)', borderRadius: '16px 16px 0 0',
    boxShadow: '0 -6px 30px rgba(0,0,0,0.15)',
    padding: '20px 20px 28px',
    fontFamily: "'DM Sans', sans-serif",
    maxHeight: '70vh', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 4,
    marginBottom: 12,
  },
  ref: { fontSize: 14, fontWeight: 700, color: 'var(--teal)', fontFamily: "'Cormorant Garamond', serif" },
  navArrow: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--teal)', fontSize: 22, lineHeight: 1, padding: '0 4px',
    fontFamily: 'serif', flexShrink: 0,
  },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'flex', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', minHeight: 0 },
  loading: { fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '1rem 0' },
  verseText: {
    fontSize: 15, color: 'var(--ink)', lineHeight: 1.8,
    margin: 0, fontFamily: "'Georgia', serif",
    fontStyle: 'italic',
  },
  actions: { marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  openBtn: {
    background: 'var(--teal)', border: 'none', borderRadius: 8,
    padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif",
  },
  deleteBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
    padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: '#c0392b', fontFamily: "'DM Sans', sans-serif",
  },
}

/* ── Vocab list tab styles ───────────────────────────────────────────────── */
const vb = {
  box: {
    background: 'var(--surface)', border: '1.5px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  },
  boxHeader: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
    cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid var(--border)',
  },
  boxLabel: { fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1 },
  boxCount: { fontSize: 12, color: 'var(--ink-faint)', fontFamily: "'DM Sans',sans-serif" },
  wordList: { padding: '4px 16px 8px' },
  wordRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 0', borderBottom: '1px solid var(--border)',
  },
  lemma: {
    fontSize: 20, fontWeight: 400, color: 'var(--ink)', minWidth: 60, flexShrink: 0,
  },
  wordMeta: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  translit: { fontSize: 12, color: 'var(--ink-muted)', fontFamily: "'DM Sans',sans-serif" },
  gloss: { fontSize: 12, color: 'var(--ink-faint)', fontFamily: "'DM Sans',sans-serif", fontStyle: 'italic' },
  savedFrom: {
    fontSize: 11, color: 'var(--teal)', fontFamily: "'DM Sans',sans-serif", opacity: 0.8,
  },
  strongsBadge: {
    fontSize: 10, fontWeight: 700, color: 'var(--teal)',
    background: 'var(--teal-light)', borderRadius: 99, padding: '2px 7px',
    fontFamily: "'DM Sans',sans-serif", flexShrink: 0,
  },
  reviewCountBadge: {
    fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)',
    background: 'var(--border)', borderRadius: 99, padding: '2px 6px',
    fontFamily: "'DM Sans',sans-serif", flexShrink: 0,
  },
  statusTag: {
    fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 8px',
    border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
    flexShrink: 0, whiteSpace: 'nowrap',
  },
  removeBtn: {
    fontSize: 16, color: 'var(--ink-faint)', background: 'none', border: 'none',
    cursor: 'pointer', padding: '0 4px', flexShrink: 0, lineHeight: 1,
  },
  reviewBtn: {
    fontSize: 11, fontWeight: 700, color: 'var(--teal)',
    background: 'var(--teal-light)', border: '1px solid rgba(0,120,100,0.25)',
    borderRadius: 99, padding: '4px 12px', cursor: 'pointer',
    fontFamily: "'DM Sans',sans-serif",
  },
}

/* ── Vocab review screen styles ─────────────────────────────────────────── */
const vr = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'var(--parchment)', display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans',sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  langBadge: {
    fontSize: 12, fontWeight: 700, color: 'var(--teal)',
    background: 'var(--teal-light)', borderRadius: 99, padding: '3px 10px',
  },
  counter: { fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600 },
  closeBtn: {
    fontSize: 22, lineHeight: 1, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--ink-muted)', padding: '0 4px',
  },
  cardWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 28,
  },
  card: {
    width: '100%', maxWidth: 420, minHeight: 220,
    background: 'var(--surface)', border: '1.5px solid var(--border)',
    borderRadius: 16, padding: '32px 28px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    userSelect: 'none',
  },
  cardFront: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' },
  cardLemma: { fontSize: 52, fontWeight: 400, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2 },
  cardId: { fontSize: 11, fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.05em' },
  tapHint: { fontSize: 11, color: 'var(--ink-faint)', marginTop: 12 },
  cardBack: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
    alignItems: 'center', textAlign: 'center',
  },
  cardTranslit: { margin: 0, fontSize: 14, color: 'var(--ink-muted)', fontStyle: 'italic' },
  cardGloss: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' },
  cardDef: {
    margin: 0, fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6,
    maxHeight: 120, overflowY: 'auto',
    fontFamily: "Georgia,serif",
  },
  cardMorph: {
    margin: '0 0 4px', fontSize: 11, fontWeight: 700,
    color: 'var(--ink-muted)', fontFamily: "'DM Sans',sans-serif",
    letterSpacing: '0.03em',
  },
  cardVerse: {
    margin: '10px 0 4px', fontSize: 13, color: 'var(--ink)',
    fontFamily: "Georgia,serif", lineHeight: 1.6,
    borderLeft: '3px solid var(--gold)', paddingLeft: 10,
    textAlign: 'left', width: '100%',
  },
  cardSavedFrom: {
    margin: '4px 0 0', fontSize: 11, color: 'var(--teal)',
    fontFamily: "'DM Sans',sans-serif", opacity: 0.85,
  },
  navRow: { display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 420 },
  navBtn: {
    flex: 1, padding: '10px 0', background: 'none',
    border: '1px solid var(--border)', borderRadius: 10,
    fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer',
  },
  revealBtn: {
    flex: 2, padding: '12px 0', background: 'var(--teal)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  nextBtn: {
    flex: 2, padding: '12px 0', background: 'var(--teal)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  doneWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px',
  },
  doneCheck: { fontSize: 48, color: 'var(--teal)' },
  doneTitle: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink)' },
  doneSub: { margin: 0, fontSize: 14, color: 'var(--ink-muted)' },
  reviewAgainBtn: {
    marginTop: 16, padding: '12px 32px', background: 'var(--teal)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  doneCloseBtn: {
    padding: '10px 32px', background: 'none', color: 'var(--ink-muted)',
    border: '1px solid var(--border)', borderRadius: 10, fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
}
