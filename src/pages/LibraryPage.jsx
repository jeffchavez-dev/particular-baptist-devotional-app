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
import { loadBibleVersion } from '../lib/bibleVersions'

const SCHEDULE = buildSchedule()

/* ── Rich-note storage marker ── */
const RICH_PREFIX = '<!RICH>'

function isRichNote(raw) { return typeof raw === 'string' && raw.startsWith(RICH_PREFIX) }

function parseRichNote(raw) {
  try {
    const parsed = JSON.parse(raw.slice(RICH_PREFIX.length))
    return { title: '', body: '', labels: [], ...parsed }
  } catch {
    return { title: '', body: '', labels: [] }
  }
}

function encodeRichNote(title, body, labels = []) {
  return RICH_PREFIX + JSON.stringify({ title, body, labels })
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

/* ── Fetch a single KJV verse text ── */
async function fetchVerseText(book, chapter, verse) {
  try {
    const data = await loadBibleVersion('kjv')
    const slug = book.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const verses = data[slug]?.[chapter]
    if (!verses) return null
    const v = verses.find(v => v.v === parseInt(verse))
    return v?.t ?? null
  } catch {
    return null
  }
}

/* ── Fetch a range of KJV verses ── */
async function fetchVerseRange(book, chapter, fromVerse, toVerse) {
  try {
    const data = await loadBibleVersion('kjv')
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
function ScriptureVerseModal({ sc, onClose, onNavigate }) {
  const [verses,  setVerses]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sc) return
    setLoading(true)
    const { book, chapter, verse, verseTo } = sc
    if (verseTo && verseTo !== verse) {
      fetchVerseRange(book, chapter, verse, verseTo).then(vs => { setVerses(vs); setLoading(false) })
    } else {
      fetchVerseText(book, chapter, verse).then(t => {
        setVerses(t ? [{ v: verse, t }] : [])
        setLoading(false)
      })
    }
  }, [sc?.book, sc?.chapter, sc?.verse, sc?.verseTo]) // eslint-disable-line

  if (!sc) return null

  const refLabel = (sc.verseTo && sc.verseTo !== sc.verse)
    ? `${sc.book} ${sc.chapter}:${sc.verse}–${sc.verseTo}`
    : `${sc.book} ${sc.chapter}:${sc.verse}`

  return (
    <div style={vm.backdrop} onClick={onClose}>
      <div style={vm.sheet} onClick={e => e.stopPropagation()}>
        <div style={vm.header}>
          <span style={vm.ref}>{refLabel}</span>
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
            {labels.map(lb => <span key={lb} style={s.noteLabelChip}>{lb}</span>)}
          </div>
        )}
        {/* eslint-disable-next-line react/no-danger */}
        <div
          style={s.richBody}
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
  const [verse,     setVerse]     = useState(1)
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

  const style = {
    ...am.popup,
    top: pos.bottom + 4,
    left: Math.max(8, Math.min(pos.left, window.innerWidth - 270)),
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
            onChange={e => { setChapter(Number(e.target.value)); setVerse(1); setVerseTo('') }}
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
            onChange={e => setVerse(Math.max(1, parseInt(e.target.value) || 1))}
            style={am.refInput}
          />
        </div>
        <div style={am.refGroup}>
          <label style={am.refLabel}>To (opt)</label>
          <input
            type="number" min={verse} max={200} value={verseTo} placeholder="–"
            onChange={e => setVerseTo(e.target.value === '' ? '' : Math.max(verse, parseInt(e.target.value) || verse))}
            style={am.refInput}
          />
        </div>
      </div>
      <div style={am.insertRow}>
        <button style={am.insertBtn}
          onClick={() => onSelect({ book, chapter, verse, verseTo: verseTo === '' ? null : Number(verseTo), quoteMode: false })}>
          Insert tag
        </button>
        <button style={{ ...am.insertBtn, ...am.insertBtnAlt }}
          onClick={() => onSelect({ book, chapter, verse, verseTo: verseTo === '' ? null : Number(verseTo), quoteMode: true })}>
          Quote verse{verseTo ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Rich Text Editor Toolbar
══════════════════════════════════════════════════════════════ */
const TOOLBAR_ACTIONS = [
  { id: 'h1',     label: 'H1',   title: 'Heading 1', cmd: 'formatBlock', val: 'H1' },
  { id: 'h2',     label: 'H2',   title: 'Heading 2', cmd: 'formatBlock', val: 'H2' },
  { id: 'bold',   label: <b>B</b>,   title: 'Bold',   cmd: 'bold' },
  { id: 'italic', label: <em>I</em>, title: 'Italic', cmd: 'italic' },
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

    // Make sure no whitespace between @ and cursor (i.e., it's a continuous word)
    const between = text.slice(idx + 1, range.startOffset)
    if (between.includes(' ')) { setAtPopup(null); return }

    // Compute popup position from the @ character
    const atRange = range.cloneRange()
    atRange.setStart(node, idx)
    atRange.setEnd(node, idx + 1)
    const rect = atRange.getBoundingClientRect()

    // Save the range at @ so we can delete it when inserting
    const deleteRange = range.cloneRange()
    deleteRange.setStart(node, idx)
    deleteRange.setEnd(node, range.startOffset)
    atRangeRef.current = deleteRange

    setAtQuery(between)
    setAtPopup({ bottom: rect.bottom + window.scrollY, left: rect.left + window.scrollX })
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
      let innerHtml
      if (isRange) {
        const vrs = await fetchVerseRange(book, chapter, verse, verseTo)
        innerHtml = vrs.length > 0
          ? vrs.map(vr => `<sup style="font-size:0.7em;margin-right:2px">${vr.v}</sup>${vr.t}`).join(' ')
          : refLabel
      } else {
        const text = await fetchVerseText(book, chapter, verse)
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

      {/* Toolbar */}
      <div style={re.toolbar}>
        {TOOLBAR_ACTIONS.map(action => (
          <button
            key={action.id}
            title={action.title}
            onMouseDown={e => { e.preventDefault(); execCmd(action.cmd, action.val) }}
            style={re.toolBtn}
            type="button"
          >
            {action.label}
          </button>
        ))}
        <span style={re.toolDivider} />
        <button
          title="Undo"
          aria-label="Undo"
          onMouseDown={e => { e.preventDefault(); execUndo() }}
          style={re.toolBtn}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4.5h6a3.5 3.5 0 010 7H4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 2L2 4.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          title="Redo"
          aria-label="Redo"
          onMouseDown={e => { e.preventDefault(); execRedo() }}
          style={re.toolBtn}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 4.5H6a3.5 3.5 0 000 7h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.5 2L12 4.5 9.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={re.toolDivider} />
        <span style={re.atHint}>Type @ for scripture</span>
      </div>

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
        data-placeholder="Write your note here…"
      />

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
   Label Picker
══════════════════════════════════════════════════════════════ */
function LabelPicker({ selected, onChange }) {
  const [allLabels, setAllLabels] = useState(getStoredLabels)
  const [adding,    setAdding]    = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  function toggle(label) {
    onChange(selected.includes(label)
      ? selected.filter(l => l !== label)
      : [...selected, label]
    )
  }

  function addLabel() {
    const trimmed = newLabel.trim()
    if (!trimmed) { setAdding(false); return }
    const updated = allLabels.includes(trimmed) ? allLabels : [...allLabels, trimmed]
    saveStoredLabels(updated)
    setAllLabels(updated)
    if (!selected.includes(trimmed)) onChange([...selected, trimmed])
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div style={lp.wrap}>
      <p style={lp.heading}>Labels</p>
      <div style={lp.chipRow}>
        {allLabels.map(label => {
          const active = selected.includes(label)
          return (
            <button key={label} type="button" onClick={() => toggle(label)}
              style={{ ...lp.chip, ...(active ? lp.chipActive : {}) }}>
              {active && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}
              {label}
            </button>
          )
        })}
        {adding ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addLabel() }
                if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
              }}
              placeholder="New label…"
              style={lp.addInput}
            />
            <button type="button" onClick={addLabel} style={lp.addConfirm}>Add</button>
            <button type="button" onClick={() => { setAdding(false); setNewLabel('') }} style={lp.addCancel}>✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} style={lp.addChip}>+ Add label</button>
        )}
      </div>
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
  const [tagVerse,   setTagVerse]   = useState(1)
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
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels)
      const key = tagEnabled
        ? `kjv|${tagBook}|${tagChapter}|${tagVerse}`
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
      <LabelPicker selected={labels} onChange={setLabels} />

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
          <span style={s.tagPreview}>{tagBook} {tagChapter}:{tagVerse}</span>
        )}
      </button>

      {tagEnabled && (
        <div style={s.pickerRow}>
          <div style={s.pickerGroup}>
            <label style={s.pickerLabel}>Book</label>
            <select
              value={tagBook}
              onChange={e => { setTagBook(e.target.value); setTagChapter(1); setTagVerse(1) }}
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
              onChange={e => { setTagChapter(Number(e.target.value)); setTagVerse(1) }}
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
              onChange={e => setTagVerse(Math.max(1, parseInt(e.target.value) || 1))}
              style={s.pickerInput}
            />
          </div>
        </div>
      )}
      {tagEnabled && (
        <p style={s.tagHint}>
          This note will be saved to <strong>{tagBook} {tagChapter}:{tagVerse}</strong> and will appear in Scripture Notes.
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
  const parsed = isRich ? parseRichNote(initialRaw) : { title: '', body: '', labels: [] }

  const [titleVal, setTitleVal] = useState(parsed.title || '')
  const [bodyHtml, setBodyHtml] = useState(
    isRich ? (parsed.body || '') : (initialRaw || '')
  )
  const [labels,   setLabels]   = useState(parsed.labels || [])
  const [saving,   setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const raw = encodeRichNote(titleVal.trim(), bodyHtml, labels)
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

      <LabelPicker selected={labels} onChange={setLabels} />

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

function NotesTab({ enrichedDevNotes, kjvNotes, confNotes, libNotes, navigate, session, onRemoveKjvNote, onRemoveConfNote, onRemoveLibNote }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNote,    setEditingNote]    = useState(null)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [sortBy,         setSortBy]         = useState('date-desc')
  const [filterLabel,    setFilterLabel]    = useState('')
  const [scriptureModal, setScriptureModal] = useState(null)
  const searchRef = useRef(null)

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

  const filteredLib = useMemo(() => {
    let list = q
      ? libNotes.filter(n => richNoteSearchText(n.note).toLowerCase().includes(q))
      : [...libNotes]
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
  }, [libNotes, q, filterLabel, sortBy])

  const filteredKjv = useMemo(() => {
    let list = q
      ? kjvNotes.filter(n =>
          richNoteSearchText(n.note).toLowerCase().includes(q) ||
          `${n.book} ${n.chapter}:${n.verse}`.toLowerCase().includes(q)
        )
      : [...kjvNotes]
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
  }, [kjvNotes, q, filterLabel, sortBy])
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

  return (
    <div style={s.tabContent}>

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
          <button onClick={() => setShowCreateForm(true)} style={s.newNoteBtn}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7.5 4.5v6M4.5 7.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            New Note
          </button>

          {/* Sort controls */}
          <div style={s.sortBar}>
            <span style={s.sortLabel}>Sort:</span>
            {SORT_OPTS.map(opt => (
              <button key={opt.id} type="button"
                style={{ ...s.sortBtn, ...(sortBy === opt.id ? s.sortBtnActive : {}) }}
                onClick={() => setSortBy(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Label filter chips */}
          {allUsedLabels.length > 0 && (
            <div style={s.labelFilterRow}>
              <span style={s.sortLabel}>Filter:</span>
              <button type="button"
                style={{ ...s.filterChip, ...(filterLabel === '' ? s.filterChipActive : {}) }}
                onClick={() => setFilterLabel('')}>
                All
              </button>
              {allUsedLabels.map(label => (
                <button key={label} type="button"
                  style={{ ...s.filterChip, ...(filterLabel === label ? s.filterChipActive : {}) }}
                  onClick={() => setFilterLabel(filterLabel === label ? '' : label)}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div style={s.searchRow}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search your notes…"
              style={s.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                style={s.searchClear}
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {isSearching && (
            <p style={s.searchMeta}>
              {totalResults === 0
                ? 'No notes match your search'
                : `${totalResults} note${totalResults !== 1 ? 's' : ''} match "${searchQuery.trim()}"`
              }
            </p>
          )}
        </>
      )}

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
            count={libNotes.length}
            filtered={isSearching ? filteredLib.length : null}
          />
          <p style={s.sectionHint}>Notes created directly in My Library</p>
          {filteredLib.length === 0 && !isSearching
            ? <EmptyMsg text='No personal notes yet. Tap "New Note" above to write one.' />
            : filteredLib.map(n => (
              <div key={n.key} style={s.card}>
                <div style={s.cardHead}>
                  <span style={s.dateBadge}>
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button onClick={() => setEditingNote(n)} style={s.editBtn} title="Edit note">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    Edit
                  </button>
                  <RemoveBtn onClick={() => onRemoveLibNote(n.key)} label="Delete note" />
                  <CopyShareBar rawNote={n.note} />
                </div>
                <NoteBody
                  rawNote={n.note}
                  query={isSearching ? searchQuery.trim() : ''}
                  onScriptureClick={setScriptureModal}
                />
              </div>
            ))
          }
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
            count={kjvNotes.length}
            filtered={isSearching ? filteredKjv.length : null}
          />
          <p style={s.sectionHint}>Notes attached to specific Bible verses</p>
          {filteredKjv.length === 0 && !isSearching
            ? <EmptyMsg text="No scripture notes yet. Use the pencil icon on any verse, or tag a scripture when creating a new note above." />
            : filteredKjv.map(n => (
              <div key={n.key} style={s.card}>
                <div style={s.cardHead}>
                  <span style={s.refBadge}>{n.book} {n.chapter}:{n.verse}</span>
                  <button onClick={() => setEditingNote({ key: n.key, note: n.note })} style={s.editBtn} title="Edit note">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    Edit
                  </button>
                  <RemoveBtn onClick={() => onRemoveKjvNote(n.key)} label="Delete note" />
                  <button
                    onClick={() => navigate('/scripture', { state: { book: n.book, chapter: n.chapter, verse: n.verse } })}
                    style={s.openBtn}
                  >Open →</button>
                </div>
                <NoteBody
                  rawNote={n.note}
                  query={isSearching ? searchQuery.trim() : ''}
                  onScriptureClick={setScriptureModal}
                />
                <CopyShareBar rawNote={n.note} />
              </div>
            ))
          }
        </>
      )}

      <div style={s.divider} />

      {/* ── Devotional Notes ── */}
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
          ) : filteredDev.map(n => (
            <div key={n.day_number} style={s.card} onClick={() => navigate(`/day/${n.day_number}`)}>
              <div style={s.cardHead}>
                <span style={s.dayBadge}>Day {n.day_number}</span>
                <span style={s.dateBadge}>{n.entry.date}</span>
                <span style={{
                  ...s.srcBadge,
                  background: n.entry.src === '2LBCF' ? 'var(--purple-soft)' : n.entry.src === 'Catechism' ? 'var(--teal-light)' : 'var(--amber-soft)',
                  color:      n.entry.src === '2LBCF' ? 'var(--purple-ink)' : n.entry.src === 'Catechism' ? 'var(--teal)'       : 'var(--amber-ink)',
                }}>{n.entry.src}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 'auto', opacity: .35, flexShrink: 0 }}>
                  <path d="M3 2l3.5 3.5L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={s.cardReading}>{n.entry.reading}</p>
              <NoteBody
                rawNote={n.notes}
                query={isSearching ? searchQuery.trim() : ''}
                onScriptureClick={setScriptureModal}
              />
            </div>
          ))}
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
          />
          {filteredConf.length === 0 && !isSearching
            ? <EmptyMsg text="No confession notes yet. Open any confession paragraph and tap Note." />
            : filteredConf.map(n => {
              const srcLabel = n.source === '2lbcf' ? '2LBCF' : n.source === 'catechism' ? 'Catechism' : '1LBCF'
              return (
                <div key={n.key} style={s.card}>
                  <div style={s.cardHead}>
                    <span style={s.refBadge}>{srcLabel} {n.itemKey}</span>
                    <button onClick={() => setEditingNote({ key: n.key, note: n.note })} style={s.editBtn} title="Edit note">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      Edit
                    </button>
                    <RemoveBtn onClick={() => onRemoveConfNote(n.key)} label="Delete note" />
                    <button
                      onClick={() => navigate(`/confessions?t=${n.source}`, { state: { itemKey: n.itemKey, source: n.source } })}
                      style={s.openBtn}
                    >Open →</button>
                  </div>
                  <NoteBody
                    rawNote={n.note}
                    query={isSearching ? searchQuery.trim() : ''}
                    onScriptureClick={setScriptureModal}
                  />
                </div>
              )
            })
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
          <div>
            <span style={s.headerTitle}>My Library</span>
            <span style={s.headerSub}>Notes, bookmarks, highlights &amp; more</span>
          </div>
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

  /* ── Search bar ── */
  searchRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px', marginBottom: 2,
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    fontSize: 16, color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
  },
  searchClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0,
  },
  searchMeta: {
    fontSize: 11, color: 'var(--teal)', fontWeight: 600,
    margin: '0 0 2px', lineHeight: 1.5,
  },

  /* ── New Note button ── */
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
    borderRadius: '8px 8px 0 0', padding: '4px 6px',
  },
  toolBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 28, height: 26, borderRadius: 5, border: 'none',
    background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.1s',
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
    border: '1px solid var(--border)', borderTop: 'none',
    borderRadius: '0 0 8px 8px',
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

/* ── Label picker styles ── */
const lp = {
  wrap:    { borderTop: '1px solid var(--border)', paddingTop: 10 },
  heading: { fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  chip: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 99,
    padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
    display: 'inline-flex', alignItems: 'center',
  },
  chipActive: { background: 'var(--teal-light)', borderColor: 'var(--teal)', color: 'var(--teal)' },
  addChip: {
    background: 'none', border: '1px dashed var(--teal)', borderRadius: 99,
    padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    color: 'var(--teal)', fontFamily: "'DM Sans', sans-serif",
  },
  addInput: {
    border: '1px solid var(--teal)', borderRadius: 8, padding: '4px 8px',
    fontSize: 16, color: 'var(--ink)', background: 'var(--parchment)',
    outline: 'none', fontFamily: "'DM Sans', sans-serif", width: 130,
  },
  addConfirm: {
    background: 'var(--teal)', border: 'none', borderRadius: 7,
    padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif",
  },
  addCancel: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 7,
    padding: '4px 8px', cursor: 'pointer', fontSize: 11,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
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
