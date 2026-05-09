import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import {
  getAllKjvHighlights, getAllKjvNotes,
  getAllConfHighlights, getAllConfNotes,
  getAllLibNotes,
  getAllScriptureBookmarks, toggleScriptureBookmark,
  HIGHLIGHT_COLORS, getHlStyle,
  setHighlight, setItemNote,
} from '../lib/annotations'
import { supabase, getLocalProgress, getBookmarks, toggleBookmark, buildSchedule } from '../lib/supabase'
import { BIBLE_BOOKS } from '../lib/bibleBooks'
import { loadBibleVersion, BIBLE_VERSIONS } from '../lib/bibleVersions'
import { getDefaultReaderVersion, resolveVersion } from '../lib/readerPrefs'

const SCHEDULE = buildSchedule()

/* ── Rich-note storage marker ── */
const RICH_PREFIX = '<!RICH>'

function isRichNote(raw) { return typeof raw === 'string' && raw.startsWith(RICH_PREFIX) }

function parseRichNote(raw) {
  try {
    const parsed = JSON.parse(raw.slice(RICH_PREFIX.length))
    return { title: '', body: '', labels: [], verseTag: null, createdAt: null, ...parsed }
  } catch {
    return { title: '', body: '', labels: [], verseTag: null, createdAt: null }
  }
}

/* verseTag: { book, chapter, verse } | null
   createdAt: ISO string — pass the existing value when editing (preserves creation date) */
function encodeRichNote(title, body, labels = [], verseTag = null, createdAt = null) {
  const obj = { title, body, labels }
  if (verseTag) obj.verseTag = verseTag
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

function SectionHeader({ icon, title, count, filtered }) {
  return (
    <div style={s.sectionHeader}>
      {icon}
      <span style={s.sectionTitle}>{title}</span>
      {count > 0 && (
        <span style={s.sectionBadge}>
          {filtered != null && filtered !== count ? `${filtered} / ${count}` : count}
        </span>
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

function parseAtQuery(query) {
  const q = query.trim()
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
  return null
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
function ScriptureVerseModal({ sc, onClose, onNavigate, zOverride }) {
  const [verses,  setVerses]  = useState([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(() => getDefaultReaderVersion())

  /* Keep version in sync when the user changes it in Settings (same-tab storage event) */
  useEffect(() => {
    function onStorage() { setVersion(getDefaultReaderVersion()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!sc) return
    /* Re-read version on each open so a settings change before opening is reflected */
    const ver = getDefaultReaderVersion()
    setVersion(ver)
    setLoading(true)
    const { book, chapter, verse, verseTo } = sc
    if (verseTo && verseTo !== verse) {
      fetchVerseRange(book, chapter, verse, verseTo, ver).then(vs => { setVerses(vs); setLoading(false) })
    } else {
      fetchVerseText(book, chapter, verse, ver).then(t => {
        setVerses(t ? [{ v: verse, t }] : [])
        setLoading(false)
      })
    }
  }, [sc?.book, sc?.chapter, sc?.verse, sc?.verseTo]) // eslint-disable-line

  if (!sc) return null

  const refLabel = (sc.verseTo && sc.verseTo !== sc.verse)
    ? `${sc.book} ${sc.chapter}:${sc.verse}–${sc.verseTo}`
    : `${sc.book} ${sc.chapter}:${sc.verse}`

  const verLabel = versionLabel(version, sc.book ?? '')

  return (
    <div style={zOverride ? { ...vm.backdrop, zIndex: zOverride } : vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        <div style={vm.header}>
          <span style={vm.ref}>{refLabel} <span style={{ fontWeight: 400, fontSize: '0.82em', color: 'var(--ink-faint)', marginLeft: 4 }}>· {verLabel}</span></span>
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
          ) : verses.length === 1 ? (
            <p style={vm.verseText}>"{verses[0].t}"</p>
          ) : (
            <div>
              {verses.map(vr => (
                <p key={vr.v} style={{ ...vm.verseText, marginBottom: 6, fontStyle: 'normal' }}>
                  <sup style={{ fontSize: '0.72em', fontWeight: 700, color: 'var(--teal)', marginRight: 3 }}>{vr.v}</sup>
                  {vr.t}
                </p>
              ))}
            </div>
          )}
        </div>
        <div style={vm.actions}>
          <button style={vm.openBtn} onClick={() => { onNavigate(sc.book, sc.chapter, sc.verse); onClose() }}>
            Open in Scripture →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Note Body — renders plain OR rich note; intercepts @ref clicks
══════════════════════════════════════════════════════════════ */
function NoteBody({ rawNote, query, onScriptureClick, clip = true }) {
  const [expanded, setExpanded] = useState(false)

  if (!rawNote) return null

  /* Rich note (HTML stored with RICH_PREFIX) */
  if (isRichNote(rawNote)) {
    const { title, body, labels = [] } = parseRichNote(rawNote)

    function handleClick(e) {
      const el = e.target.closest('[data-sc-book]')
      if (el) {
        e.preventDefault()
        onScriptureClick?.({
          book:    el.dataset.scBook,
          chapter: parseInt(el.dataset.scChapter),
          verse:   parseInt(el.dataset.scVerse),
          verseTo: el.dataset.scVerseTo ? parseInt(el.dataset.scVerseTo) : null,
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
function AtMentionPopup({ pos, query, onSelect, onClose }) {
  const [step,      setStep]      = useState('book')  // 'book' | 'ref'
  const [book,      setBook]      = useState('')
  const [chapter,   setChapter]   = useState(1)
  const [verse,     setVerse]     = useState('1')     // string so user can clear & retype
  const [verseTo,   setVerseTo]   = useState('')      // '' = single verse
  const [forceEdit, setForceEdit] = useState(false)
  const ref = useRef(null)

  /* Detect fully-typed inline reference like "Genesis 1:1" or "Genesis 1:1-5" */
  const resolved    = useMemo(() => parseAtQuery(query), [query])
  const showResolved = resolved && !forceEdit

  /* Filter books by query (only when not in resolved mode) */
  const filteredBooks = useMemo(() => {
    if (showResolved) return BIBLE_BOOKS
    const q = (step === 'book' ? query : '').toLowerCase()
    return q ? BIBLE_BOOKS.filter(b => b.name.toLowerCase().startsWith(q)) : BIBLE_BOOKS
  }, [query, step, showResolved])

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

  // Flip popup above the cursor when it would go off the bottom of the viewport
  const POPUP_MAX_H = 320
  const fitsBelow   = (pos.bottom + 4 + POPUP_MAX_H) <= window.innerHeight
  const style = {
    ...am.popup,
    top:    fitsBelow ? pos.bottom + 4 : undefined,
    bottom: fitsBelow ? undefined : window.innerHeight - pos.top + 6,
    left:   Math.max(8, Math.min(pos.left, window.innerWidth - 270)),
  }

  /* ── Resolved: user typed a complete reference ── */
  if (showResolved) {
    const { book: rb, chapter: rc, verse: rv, verseTo: rvt } = resolved
    const label = rvt ? `${rb} ${rc}:${rv}–${rvt}` : `${rb} ${rc}:${rv}`
    return (
      <div ref={ref} style={style}>
        <p style={am.label}>Detected reference</p>
        <p style={am.resolvedRef}>{label}</p>
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
        <button style={am.editRefBtn} onClick={() => setForceEdit(true)}>
          ← Choose differently
        </button>
      </div>
    )
  }

  /* ── Book picker ── */
  if (step === 'book') {
    return (
      <div ref={ref} style={style}>
        <p style={am.label}>Select book  <span style={am.hintSmall}>or type @Book Ch:Vs</span></p>
        <div style={am.bookList}>
          {filteredBooks.slice(0, 12).map(b => (
            <button key={b.name} style={am.bookBtn} onClick={() => { setBook(b.name); setStep('ref') }}>
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
function RichNoteEditor({ initialTitle = '', initialBody = '', onTitleChange, onBodyChange }) {
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
    if (!sel || !sel.rangeCount) { setActiveFormats({}); return }
    const node = sel.getRangeAt(0).commonAncestorContainer
    if (!editorRef.current?.contains(node)) return
    try {
      const blockVal = document.queryCommandValue('formatBlock').toLowerCase()
      setActiveFormats({
        bold:   document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul:     document.queryCommandState('insertUnorderedList'),
        ol:     document.queryCommandState('insertOrderedList'),
        h1:     blockVal === 'h1',
        h2:     blockVal === 'h2',
        p:      blockVal === 'p' || blockVal === '',
      })
    } catch { setActiveFormats({}) }
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
    restoreSelection()
    document.execCommand(cmd, false, val ?? null)
    editorRef.current?.focus()
    onBodyChange(editorRef.current.innerHTML)
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
    if (!sel || !sel.rangeCount) { setAtPopup(null); return }
    const range = sel.getRangeAt(0)
    const node  = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) { setAtPopup(null); return }
    const text = node.textContent || ''
    const idx  = text.lastIndexOf('@', range.startOffset - 1)
    if (idx === -1) { setAtPopup(null); return }

    const between = text.slice(idx + 1, range.startOffset)

    // Allow spaces if:
    //  (a) the query already starts with a complete book name  ("Genesis 1:1" — chapter/verse follows), OR
    //  (b) the query is still a prefix of a numbered book name ("1 " → "1 Corinthians", "1 Kings", …)
    if (between.includes(' ')) {
      const q = between.toLowerCase()
      const valid = BOOKS_BY_LENGTH.some(bk => {
        const bn = bk.name.toLowerCase()
        return q.startsWith(bn) || bn.startsWith(q)
      })
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

  async function handleAtSelect({ book, chapter, verse, verseTo, quoteMode }) {
    setAtPopup(null)
    editorRef.current?.focus()

    // Delete the "@query" text the user typed
    if (atRangeRef.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(atRangeRef.current)
      document.execCommand('delete', false)
    }

    const isRange  = verseTo && verseTo !== verse
    const refLabel = isRange
      ? `${book} ${chapter}:${verse}–${verseTo}`
      : `${book} ${chapter}:${verse}`
    const rangeAttrs = isRange ? ` data-sc-verse-to="${verseTo}"` : ''

    if (quoteMode) {
      const quoteVer = getDefaultReaderVersion()
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
        `style="margin:6px 0;padding:8px 12px;border-left:3px solid var(--teal);` +
        `background:var(--teal-light);border-radius:0 6px 6px 0;font-style:italic;` +
        `font-size:0.92em;color:var(--ink-muted);">${innerHtml} ` +
        `<em style="font-style:normal;font-weight:700;font-size:0.85em;color:var(--teal);">— ${refLabel}</em></blockquote>`
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

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setAtPopup(null); return }
    // Prevent Enter from creating a <div> in some browsers
    if (e.key === 'Enter' && !e.shiftKey) {
      // Let browser default handle it for block elements
    }
    saveSelection()
  }

  function handleKeyUp() {
    saveSelection()
    checkAtMention()
  }

  return (
    <div style={re.wrap}>
      {/* Title input */}
      <input
        type="text"
        placeholder="Title (optional)"
        defaultValue={initialTitle}
        onChange={e => onTitleChange(e.target.value)}
        style={re.titleInput}
      />

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseUp={saveSelection}
        style={re.editor}
        className="rich-content"
        data-placeholder="Write your note here…"
      />

      {/* Toolbar — sits below the editor so it's always reachable on long notes */}
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
        <span style={re.atHint}>@ scripture</span>
      </div>

      {/* @ picker popup */}
      {atPopup && (
        <AtMentionPopup
          pos={atPopup}
          query={atQuery}
          onSelect={handleAtSelect}
          onClose={() => setAtPopup(null)}
        />
      )}
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
function CreateNoteForm({ onSave, onCancel, session }) {
  const [titleVal,   setTitleVal]   = useState('')
  const [bodyHtml,   setBodyHtml]   = useState('')
  const [labels,     setLabels]     = useState([])
  const [tagEnabled, setTagEnabled] = useState(false)
  const [tagBook,    setTagBook]    = useState('Genesis')
  const [tagChapter, setTagChapter] = useState(1)
  const [tagVerse,   setTagVerse]   = useState('1')  // string so user can clear & retype
  const [saving,     setSaving]     = useState(false)

  const selectedBook = BIBLE_BOOKS.find(b => b.name === tagBook) ?? BIBLE_BOOKS[0]
  const maxChapters  = selectedBook.chapters

  useEffect(() => {
    if (tagChapter > maxChapters) setTagChapter(maxChapters)
  }, [tagBook, maxChapters, tagChapter])

  async function handleSave() {
    const hasContent = titleVal.trim() || bodyHtml.replace(/<[^>]*>/g, '').trim()
    if (!hasContent) return
    setSaving(true)
    try {
      const verseTag = tagEnabled
        ? { book: tagBook, chapter: tagChapter, verse: Math.max(1, parseInt(tagVerse) || 1) }
        : null
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels, verseTag)
      /* Tagged notes save under the verse's kjv| key so they appear in the
         scripture reader. Un-tagged notes keep the lib|timestamp key. */
      const key = verseTag
        ? `kjv|${verseTag.book}|${verseTag.chapter}|${verseTag.verse}`
        : `lib|${new Date().toISOString()}`
      setItemNote(key, raw, session?.user?.id)
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.createForm}>
      {/* Form header */}
      <div style={s.createFormHeader}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="var(--teal)" strokeWidth="1.4"/>
          <path d="M4.5 5.5h6M4.5 8h4" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>New Note</span>
        <button onClick={onCancel} style={s.formCloseBtn} aria-label="Cancel">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Rich editor */}
      <RichNoteEditor
        initialTitle={titleVal}
        initialBody={bodyHtml}
        onTitleChange={setTitleVal}
        onBodyChange={setBodyHtml}
      />

      {/* Labels */}
      <LabelDropdown selected={labels} onChange={setLabels} />

      {/* Scripture tag toggle */}
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
        {tagEnabled ? 'Scripture tagged' : 'Tag a scripture'}
        {tagEnabled && (
          <span style={s.tagPreview}>{tagBook} {tagChapter}:{Math.max(1, parseInt(tagVerse) || 1)}</span>
        )}
      </button>

      {tagEnabled && (
        <div style={s.pickerRow}>
          <div style={s.pickerGroup}>
            <label style={s.pickerLabel}>Book</label>
            <select
              value={tagBook}
              onChange={e => { setTagBook(e.target.value); setTagChapter(1); setTagVerse('1') }}
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
              onChange={e => { setTagChapter(Number(e.target.value)); setTagVerse('1') }}
              style={s.pickerSelectSmall}
            >
              {Array.from({ length: maxChapters }, (_, i) => i + 1).map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <div style={s.pickerGroup}>
            <label style={s.pickerLabel}>Vs.</label>
            <input
              type="number" min={1} max={200} value={tagVerse}
              onChange={e => setTagVerse(e.target.value)}
              onBlur={() => setTagVerse(v => String(Math.max(1, parseInt(v) || 1)))}
              style={s.pickerInput}
            />
          </div>
        </div>
      )}
      {tagEnabled && (
        <p style={s.tagHint}>
          This note will be saved to <strong>{tagBook} {tagChapter}:{Math.max(1, parseInt(tagVerse) || 1)}</strong> and will appear in Scripture Notes.
        </p>
      )}

      <div style={s.formActions}>
        <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Edit Note Form  (rich editor)
══════════════════════════════════════════════════════════════ */
function EditNoteForm({ noteKey, initialRaw, onSave, onCancel, session }) {
  const isRich = isRichNote(initialRaw)
  const parsed = isRich ? parseRichNote(initialRaw) : { title: '', body: '', labels: [], verseTag: null }

  const [titleVal, setTitleVal] = useState(parsed.title || '')
  const [bodyHtml, setBodyHtml] = useState(
    isRich ? (parsed.body || '') : (initialRaw || '')
  )
  const [labels,   setLabels]   = useState(parsed.labels || [])
  const [saving,   setSaving]   = useState(false)

  /* Preserve the original verseTag and createdAt when re-saving */
  const verseTag  = parsed.verseTag  ?? null
  const createdAt = parsed.createdAt ?? null

  async function handleSave() {
    setSaving(true)
    try {
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels, verseTag, createdAt)
      setItemNote(noteKey, raw, session?.user?.id)
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.createForm}>
      <div style={s.createFormHeader}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 12l1.5-3 6-6 2 2-6 6-3.5.5Z" stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Edit Note</span>
        <button onClick={onCancel} style={s.formCloseBtn} aria-label="Cancel">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <RichNoteEditor
        initialTitle={titleVal}
        initialBody={bodyHtml}
        onTitleChange={setTitleVal}
        onBodyChange={setBodyHtml}
      />

      <LabelDropdown selected={labels} onChange={setLabels} />

      <div style={s.formActions}>
        <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Bookmarks Tab
══════════════════════════════════════════════════════════════ */
function BookmarksTab({ savedDayEntries, scBookmarks, navigate, onRemoveSavedDay, onRemoveScBookmark }) {
  return (
    <div style={s.tabContent}>

      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2A1.5 1.5 0 014.5.5h5A1.5 1.5 0 0111 2v11l-4-2.5L3 13V2z"
              stroke="var(--teal)" strokeWidth="1.3" strokeLinejoin="round" fill="var(--teal)" fillOpacity="0.12"/>
          </svg>
        }
        title="Saved Days"
        count={savedDayEntries.length}
      />
      {savedDayEntries.length === 0
        ? <EmptyMsg text="No saved days yet. Tap the bookmark icon on any devotional reading day." />
        : savedDayEntries.map(entry => (
          <div key={entry.day} style={s.card} onClick={() => navigate(`/day/${entry.day}`)}>
            <div style={s.cardHead}>
              <span style={s.dayBadge}>Day {entry.day}</span>
              <span style={s.dateBadge}>{entry.date}</span>
              <span style={{
                ...s.srcBadge,
                background: entry.src === '2LBCF' ? 'var(--purple-soft)' : entry.src === 'Catechism' ? 'var(--teal-light)' : 'var(--amber-soft)',
                color:      entry.src === '2LBCF' ? 'var(--purple-ink)' : entry.src === 'Catechism' ? 'var(--teal)'       : 'var(--amber-ink)',
              }}>{entry.src}</span>
              <RemoveBtn onClick={() => onRemoveSavedDay(entry.day)} label="Remove saved day" />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .35, flexShrink: 0 }}>
                <path d="M3 2l3.5 3.5L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={s.cardReading}>{entry.reading}</p>
          </div>
        ))
      }

      <div style={s.divider} />

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
        : scBookmarks.map(bm => (
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
function NoteCard({ badge, badgeStyle, title, labels, preview, date, onCardClick, onEdit, onDelete, onOpen, query }) {
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

      {/* Labels */}
      {labels?.length > 0 && (
        <div style={nc.labelRow}>
          {labels.slice(0, 2).map(l => {
            const c = getLabelColor(l)
            return (
              <span key={l} style={{ ...nc.labelChip, background: c.bg, color: c.color }}>
                {l}
              </span>
            )
          })}
          {labels.length > 2 && <span style={nc.labelMore}>+{labels.length - 2}</span>}
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

/* ══════════════════════════════════════════════════════════════
   Note View Modal  (read-only, full-screen bottom sheet)
══════════════════════════════════════════════════════════════ */
function NoteViewModal({ noteData, onClose, onEdit, onDelete, onOpen, navigate }) {
  const { note, badge, badgeStyle, title } = noteData
  const [scripturePreview, setScripturePreview] = useState(null)

  function handleScriptureClick(sc) {
    setScripturePreview(sc)
  }

  return (
    <div style={nv.backdrop} onClick={onClose}>
      <div style={nv.sheet} onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div style={nv.handle} />

        {/* Header row */}
        <div style={nv.header}>
          <div style={nv.headerLeft}>
            {badge
              ? <span style={{ ...nc.badge, ...badgeStyle }}>{badge}</span>
              : title
                ? <span style={nv.titleText}>{title}</span>
                : <span style={nv.titleFaint}>Untitled</span>
            }
          </div>
          <div style={nv.headerActions}>
            {onOpen && (
              <button style={nv.openBtn} onClick={() => { onOpen(); onClose() }}>
                Open →
              </button>
            )}
            {onEdit && (
              <button style={nv.editBtn} onClick={() => { onEdit(); onClose() }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 11l1.2-2.4 5.5-5.5 1.6 1.6-5.5 5.5L2 11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            {onDelete && (
              <button style={nv.deleteBtn} onClick={() => { onDelete(); onClose() }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <button style={nv.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Note content */}
        <div style={nv.body}>
          <NoteBody rawNote={note} clip={false} onScriptureClick={handleScriptureClick} />
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

function NotesTab({ enrichedDevNotes, kjvNotes, confNotes, libNotes, navigate, session, onRemoveKjvNote, onRemoveConfNote, onRemoveLibNote, searchQuery = '' }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNote,    setEditingNote]    = useState(null)
  const formAreaRef = useRef(null)
  const [viewingNote,    setViewingNote]    = useState(null) // { note, key, badge?, badgeStyle?, title?, type, extra? }
  const [sortBy,         setSortBy]         = useState('date-desc')
  const [filterLabel,    setFilterLabel]    = useState('')
  const [sortOpen,       setSortOpen]       = useState(false)
  const [filterOpen,     setFilterOpen]     = useState(false)
  const sortRef   = useRef(null)
  const filterRef = useRef(null)
  const [scriptureModal, setScriptureModal] = useState(null)
  const [pendingDelete,  setPendingDelete]  = useState(null) // { key, type }

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

  /* Split lib notes: free-form vs scripture-tagged (verseTag in JSON) */
  const { libFreeNotes, libTaggedNotes } = useMemo(() => {
    const free = [], tagged = []
    libNotes.forEach(n => {
      const vt = isRichNote(n.note) ? parseRichNote(n.note).verseTag : null
      if (vt) tagged.push({ ...n, book: vt.book, chapter: vt.chapter, verse: vt.verse, isLibTagged: true })
      else    free.push(n)
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
  const filteredDev = useMemo(() =>
    q ? enrichedDevNotes.filter(n =>
      n.notes.toLowerCase().includes(q) ||
      n.entry?.reading?.toLowerCase().includes(q)
    ) : enrichedDevNotes,
    [enrichedDevNotes, q]
  )

  const totalResults = filteredLib.length + filteredKjv.length + filteredConf.length + filteredDev.length
  const isSearching  = q.length > 0

  function handleSaved() {
    setShowCreateForm(false)
    setEditingNote(null)
  }

  /* Scroll the form into view whenever it opens */
  useEffect(() => {
    if (!showCreateForm && !editingNote) return
    const t = setTimeout(() => {
      formAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => clearTimeout(t)
  }, [showCreateForm, editingNote?.key]) // eslint-disable-line

  return (
    <div style={s.tabContent}>

      <div ref={formAreaRef}>
      {showCreateForm ? (
        <CreateNoteForm session={session} onSave={handleSaved} onCancel={() => setShowCreateForm(false)} />
      ) : editingNote ? (
        <EditNoteForm
          key={editingNote.key}
          noteKey={editingNote.key}
          initialRaw={editingNote.note}
          session={session}
          onSave={handleSaved}
          onCancel={() => setEditingNote(null)}
        />
      ) : (
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
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
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
      )}
      </div>{/* /formAreaRef */}

      <div style={s.divider} />

      {/* ── Personal Library Notes — kanban grid ── */}
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
          />
          <p style={s.sectionHint}>Notes created directly in My Library</p>
          {filteredLib.length === 0 && !isSearching
            ? libTaggedNotes.length > 0
              ? <EmptyMsg text='Scripture-tagged notes are shown in "Scripture Notes" below.' />
              : <EmptyMsg text='No personal notes yet. Tap "New Note" above to write one.' />
            : (
              <div style={s.kanbanGrid}>
                {filteredLib.map(n => {
                  const { title, labels } = isRichNote(n.note) ? parseRichNote(n.note) : { title: '', labels: [] }
                  return (
                    <NoteCard
                      key={n.key}
                      title={title}
                      labels={labels}
                      preview={notePreviewText(n.note)}
                      date={new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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

      <div style={s.divider} />

      {/* ── Scripture Notes — kanban grid ── */}
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
          />
          <p style={s.sectionHint}>Notes attached to specific Bible verses</p>
          {filteredKjv.length === 0 && !isSearching
            ? <EmptyMsg text="No scripture notes yet. Use the pencil icon on any verse, or tag a scripture when creating a new note above." />
            : (
              <div style={s.kanbanGrid}>
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

      <div style={s.divider} />

      {/* ── Devotional Notes — kanban grid ── */}
      {(!isSearching || filteredDev.length > 0) && (
        <>
          <SectionHeader
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2.5h10M2 5h6M2 7.5h8M2 10h5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
            title="Devotional Notes"
            count={enrichedDevNotes.length}
            filtered={isSearching ? filteredDev.length : null}
          />
          {!session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
              <p style={s.emptyText}>Sign in to sync and view your devotional notes.</p>
              <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
                Sign in →
              </button>
            </div>
          ) : filteredDev.length === 0 && !isSearching ? (
            <EmptyMsg text="No devotional notes yet. Open any reading day to add your reflections." />
          ) : (
            <div style={s.kanbanGrid}>
              {filteredDev.map(n => {
                const badge = `Day ${n.day_number}`
                const badgeStyle = { background: 'var(--purple-soft)', color: 'var(--purple-ink)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, display: 'inline-block' }
                return (
                  <NoteCard
                    key={n.day_number}
                    badge={badge}
                    badgeStyle={badgeStyle}
                    preview={notePreviewText(n.notes)}
                    date={n.entry.date}
                    onCardClick={() => setViewingNote({ note: n.notes, key: null, badge, badgeStyle, type: 'dev', extra: { dayNumber: n.day_number } })}
                    onOpen={() => navigate(`/day/${n.day_number}`)}
                    query={isSearching ? searchQuery.trim() : ''}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      <div style={s.divider} />

      {/* ── Confession Notes — kanban grid ── */}
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
          />
          {filteredConf.length === 0 && !isSearching
            ? <EmptyMsg text="No confession notes yet. Open any confession paragraph and tap Note." />
            : (
              <div style={s.kanbanGrid}>
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

      {/* Note view modal */}
      {viewingNote && (
        <NoteViewModal
          noteData={viewingNote}
          navigate={navigate}
          onClose={() => setViewingNote(null)}
          onEdit={viewingNote.key ? () => {
            if (viewingNote.type === 'lib') {
              // Find the full lib note object to pass into edit form
              const n = libNotes.find(x => x.key === viewingNote.key)
              if (n) setEditingNote(n)
            } else {
              setEditingNote({ key: viewingNote.key, note: viewingNote.note })
            }
          } : null}
          onDelete={viewingNote.key ? () => requestDelete(viewingNote.key, viewingNote.type) : null}
          onOpen={viewingNote.extra ? () => {
            if (viewingNote.type === 'kjv') {
              const { book, chapter, verse } = viewingNote.extra
              navigate('/scripture', { state: { book, chapter, verse } })
            } else if (viewingNote.type === 'dev') {
              navigate(`/day/${viewingNote.extra.dayNumber}`)
            } else if (viewingNote.type === 'conf') {
              const { source, itemKey } = viewingNote.extra
              navigate(`/confessions?t=${source}`, { state: { itemKey, source } })
            }
          } : null}
        />
      )}

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

function HighlightsTab({ kjvHighlights, confHighlights, navigate, onRemoveKjvHighlight, onRemoveConfHighlight }) {
  return (
    <div style={s.tabContent}>

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
            {kjvHighlights.map(h => {
              const c = getHlStyle(h.colorId)
              return (
                <div key={h.key} style={{ ...s.hlChip, background: c.rowBg, borderColor: c.border }}>
                  <button
                    style={{ ...s.hlChipInner, color: c.numClr }}
                    onClick={() => navigate('/scripture', { state: { book: h.book, chapter: h.chapter, verse: h.verse } })}
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
            {confHighlights.map(h => {
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
  const [libSearch,     setLibSearch]     = useState('')
  const [libSearchOpen, setLibSearchOpen] = useState(false)
  const libSearchRef = useRef(null)

  const [devNotes,       setDevNotes]       = useState([])
  const [savedDays,      setSavedDays]      = useState(() => getBookmarks())
  const [scBookmarks,    setScBookmarks]    = useState(() => getAllScriptureBookmarks())
  const [kjvHighlights,  setKjvHighlights]  = useState(() => getAllKjvHighlights())
  const [kjvNotes,       setKjvNotes]       = useState(() => getAllKjvNotes())
  const [confHighlights, setConfHighlights] = useState(() => getAllConfHighlights())
  const [confNotes,      setConfNotes]      = useState(() => getAllConfNotes())
  const [libNotes,       setLibNotes]       = useState(() => getAllLibNotes())

  useEffect(() => {
    if (session) {
      supabase.from('progress').select('day_number, completed, notes')
        .eq('user_id', session.user.id)
        .then(({ data }) => setDevNotes((data || []).filter(r => r.notes && r.notes.trim())))
    } else {
      const local = getLocalProgress()
      setDevNotes(
        Object.entries(local)
          .filter(([, d]) => d.notes && d.notes.trim())
          .map(([day, d]) => ({ day_number: parseInt(day), notes: d.notes }))
      )
    }
  }, [session])

  useEffect(() => {
    const refresh = () => {
      setKjvHighlights(getAllKjvHighlights())
      setKjvNotes(getAllKjvNotes())
      setConfHighlights(getAllConfHighlights())
      setConfNotes(getAllConfNotes())
      setLibNotes(getAllLibNotes())
    }
    window.addEventListener('pb-highlight-changed',   refresh)
    window.addEventListener('pb-note-changed',        refresh)
    window.addEventListener('pb-annotations-updated', refresh)
    return () => {
      window.removeEventListener('pb-highlight-changed',   refresh)
      window.removeEventListener('pb-note-changed',        refresh)
      window.removeEventListener('pb-annotations-updated', refresh)
    }
  }, [])

  useEffect(() => {
    const handler = () => setScBookmarks(getAllScriptureBookmarks())
    window.addEventListener('pb-sc-bookmark-changed', handler)
    return () => window.removeEventListener('pb-sc-bookmark-changed', handler)
  }, [])

  const enrichedDevNotes = useMemo(() =>
    devNotes
      .map(n => ({ ...n, entry: SCHEDULE.find(r => r.day === n.day_number) }))
      .filter(n => n.entry)
      .sort((a, b) => a.day_number - b.day_number),
    [devNotes]
  )

  const savedDayEntries = useMemo(() =>
    Object.keys(savedDays)
      .map(d => SCHEDULE.find(r => r.day === parseInt(d)))
      .filter(Boolean)
      .sort((a, b) => a.day - b.day),
    [savedDays]
  )

  const notesCount      = libNotes.length + kjvNotes.length + enrichedDevNotes.length + confNotes.length
  const bookmarksCount  = savedDayEntries.length + scBookmarks.length
  const highlightsCount = kjvHighlights.length   + confHighlights.length

  const TABS = [
    { id: 'notes',      label: 'Notes',      count: notesCount      },
    { id: 'bookmarks',  label: 'Bookmarks',  count: bookmarksCount  },
    { id: 'highlights', label: 'Highlights', count: highlightsCount },
  ]

  const handleRemoveSavedDay      = useCallback(day  => { toggleBookmark(day); setSavedDays(prev => { const n = {...prev}; delete n[day]; return n }) }, [])
  const handleRemoveScBookmark    = useCallback((book, chapter) => { toggleScriptureBookmark(book, chapter); setScBookmarks(getAllScriptureBookmarks()) }, [])
  const handleRemoveKjvHighlight  = useCallback(key  => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveConfHighlight = useCallback(key  => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveKjvNote       = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveConfNote      = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveLibNote       = useCallback(key  => setItemNote(key, null, session?.user?.id),  [session?.user?.id])

  return (
    <div style={s.page}>

      {/* ── Header (no back button — BottomNav handles navigation) ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
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
        <div style={s.tabBar}>
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
            searchQuery={libSearch}
          />
        )}
        {activeTab === 'bookmarks' && (
          <BookmarksTab
            savedDayEntries={savedDayEntries}
            scBookmarks={scBookmarks}
            navigate={navigate}
            onRemoveSavedDay={handleRemoveSavedDay}
            onRemoveScBookmark={handleRemoveScBookmark}
          />
        )}
        {activeTab === 'highlights' && (
          <HighlightsTab
            kjvHighlights={kjvHighlights}
            confHighlights={confHighlights}
            navigate={navigate}
            onRemoveKjvHighlight={handleRemoveKjvHighlight}
            onRemoveConfHighlight={handleRemoveConfHighlight}
          />
        )}
      </div>

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

  /* ── Kanban 2-column grid ── */
  kanbanGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4,
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
    outline: 'none', overflowY: 'auto', wordBreak: 'break-word',
    boxSizing: 'border-box',
  },
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
  resolvedRef:   { fontSize: 14, fontWeight: 700, color: 'var(--teal)', fontFamily: "'Cormorant Garamond', serif", margin: '2px 0 10px' },
  editRefBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', padding: '6px 0 0', fontFamily: "'DM Sans', sans-serif" },
  hintSmall:     { fontSize: 9, fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0 },
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
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center',
    background: 'var(--red-light)', border: '1px solid var(--red)',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', padding: 4, display: 'flex', alignItems: 'center',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '16px 20px 24px',
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
  date: { fontSize: 9, color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif" },
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  ref: { fontSize: 14, fontWeight: 700, color: 'var(--teal)', fontFamily: "'Cormorant Garamond', serif" },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'flex' },
  body: { flex: 1, overflowY: 'auto' },
  loading: { fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '1rem 0' },
  verseText: {
    fontSize: 15, color: 'var(--ink)', lineHeight: 1.8,
    margin: 0, fontFamily: "'Georgia', serif",
    fontStyle: 'italic',
  },
  actions: { marginTop: 16, display: 'flex', justifyContent: 'flex-end' },
  openBtn: {
    background: 'var(--teal)', border: 'none', borderRadius: 8,
    padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif",
  },
}
