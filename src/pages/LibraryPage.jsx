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

const SCHEDULE = buildSchedule()

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function HlDot({ colorId, size = 9 }) {
  const c = getHlStyle(colorId)
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: c.dot, flexShrink: 0,
    }} />
  )
}

function SectionHeader({ icon, title, count, action }) {
  return (
    <div style={s.sectionHeader}>
      {icon}
      <span style={s.sectionTitle}>{title}</span>
      {count > 0 && <span style={s.sectionBadge}>{count}</span>}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
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

/* ══════════════════════════════════════════════════════════════
   Create Note Form
══════════════════════════════════════════════════════════════ */
function CreateNoteForm({ onSave, onCancel, session }) {
  const [noteText,    setNoteText]    = useState('')
  const [tagEnabled,  setTagEnabled]  = useState(false)
  const [tagBook,     setTagBook]     = useState('Genesis')
  const [tagChapter,  setTagChapter]  = useState(1)
  const [tagVerse,    setTagVerse]    = useState(1)
  const [saving,      setSaving]      = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 60)
  }, [])

  const selectedBook = BIBLE_BOOKS.find(b => b.name === tagBook) ?? BIBLE_BOOKS[0]
  const maxChapters  = selectedBook.chapters
  // Clamp chapter when book changes
  useEffect(() => {
    if (tagChapter > maxChapters) setTagChapter(maxChapters)
  }, [tagBook, maxChapters, tagChapter])

  async function handleSave() {
    const text = noteText.trim()
    if (!text) return
    setSaving(true)
    try {
      let key
      if (tagEnabled) {
        // Attach to a specific verse — stored under the scripture note key
        key = `kjv|${tagBook}|${tagChapter}|${tagVerse}`
      } else {
        // Standalone library note
        key = `lib|${new Date().toISOString()}`
      }
      setItemNote(key, text, session?.user?.id)
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.createForm}>
      {/* Title row */}
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

      {/* Note textarea */}
      <textarea
        ref={textareaRef}
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        placeholder="Write your note here…"
        rows={5}
        style={s.textarea}
      />

      {/* Scripture tag toggle */}
      <button
        style={{
          ...s.tagToggleBtn,
          ...(tagEnabled ? s.tagToggleBtnActive : {}),
        }}
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

      {/* Scripture pickers (visible when tag enabled) */}
      {tagEnabled && (
        <div style={s.pickerRow}>
          {/* Book */}
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

          {/* Chapter */}
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

          {/* Verse */}
          <div style={s.pickerGroup}>
            <label style={s.pickerLabel}>Vs.</label>
            <input
              type="number"
              min={1}
              max={200}
              value={tagVerse}
              onChange={e => setTagVerse(Math.max(1, parseInt(e.target.value) || 1))}
              style={s.pickerInput}
            />
          </div>
        </div>
      )}

      {/* Tag hint */}
      {tagEnabled && (
        <p style={s.tagHint}>
          This note will be saved to <strong>{tagBook} {tagChapter}:{tagVerse}</strong> and will appear in Scripture Notes when you open that verse.
        </p>
      )}

      {/* Actions */}
      <div style={s.formActions}>
        <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={!noteText.trim() || saving}
          style={{
            ...s.saveBtn,
            opacity: (!noteText.trim() || saving) ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Edit Note Form (reuse for existing notes)
══════════════════════════════════════════════════════════════ */
function EditNoteForm({ noteKey, initialText, onSave, onCancel, session }) {
  const [noteText, setNoteText] = useState(initialText)
  const [saving,   setSaving]   = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 60)
  }, [])

  async function handleSave() {
    const text = noteText.trim()
    setSaving(true)
    try {
      setItemNote(noteKey, text || null, session?.user?.id)
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
      <textarea
        ref={textareaRef}
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        placeholder="Note text…"
        rows={5}
        style={s.textarea}
      />
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

      {/* Saved Devotional Days */}
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

      {/* Scripture Chapter Bookmarks */}
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
function NotesTab({ enrichedDevNotes, kjvNotes, confNotes, libNotes, navigate, session, onRemoveKjvNote, onRemoveConfNote, onRemoveLibNote }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNote,    setEditingNote]    = useState(null) // { key, note }

  function handleSaved() {
    setShowCreateForm(false)
    setEditingNote(null)
  }

  return (
    <div style={s.tabContent}>

      {/* ── Create Note Form / Button ── */}
      {showCreateForm ? (
        <CreateNoteForm
          session={session}
          onSave={handleSaved}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : editingNote ? (
        <EditNoteForm
          key={editingNote.key}
          noteKey={editingNote.key}
          initialText={editingNote.note}
          session={session}
          onSave={handleSaved}
          onCancel={() => setEditingNote(null)}
        />
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          style={s.newNoteBtn}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7.5 4.5v6M4.5 7.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          New Note
        </button>
      )}

      <div style={s.divider} />

      {/* ── Personal Library Notes ── */}
      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--teal)" strokeWidth="1.3"/>
            <path d="M5 5.5h4M5 8h2.5" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        }
        title="Personal Notes"
        count={libNotes.length}
      />
      <p style={s.sectionHint}>Notes created directly in My Library</p>
      {libNotes.length === 0
        ? <EmptyMsg text='No personal notes yet. Tap "New Note" above to write one.' />
        : libNotes.map(n => (
          <div key={n.key} style={s.card}>
            <div style={s.cardHead}>
              <span style={s.dateBadge}>
                {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={() => setEditingNote(n)}
                style={s.editBtn}
                title="Edit note"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
              <RemoveBtn onClick={() => onRemoveLibNote(n.key)} label="Delete note" />
            </div>
            <p style={{ ...s.cardPreview, fontSize: 12, color: 'var(--ink)' }}>{n.note}</p>
          </div>
        ))
      }

      <div style={s.divider} />

      {/* ── Scripture Notes ── */}
      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--teal)" strokeWidth="1.3"/>
            <path d="M5 5.5h4M5 8h2.5" stroke="var(--teal)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        }
        title="Scripture Notes"
        count={kjvNotes.length}
      />
      <p style={s.sectionHint}>Notes attached to specific Bible verses</p>
      {kjvNotes.length === 0
        ? <EmptyMsg text="No scripture notes yet. Use the pencil icon on any verse, or tag a scripture when creating a new note above." />
        : kjvNotes.map(n => (
          <div
            key={n.key}
            style={s.card}
          >
            <div style={s.cardHead}>
              <span style={s.refBadge}>{n.book} {n.chapter}:{n.verse}</span>
              <button
                onClick={() => setEditingNote({ key: n.key, note: n.note })}
                style={s.editBtn}
                title="Edit note"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
              <RemoveBtn onClick={() => onRemoveKjvNote(n.key)} label="Delete note" />
              <button
                onClick={() => navigate('/scripture', { state: { book: n.book, chapter: n.chapter, verse: n.verse } })}
                style={s.openBtn}
                title="Open in Scripture reader"
              >
                Open →
              </button>
            </div>
            <p style={s.cardPreview}>{n.note.slice(0, 160)}{n.note.length > 160 ? '…' : ''}</p>
          </div>
        ))
      }

      <div style={s.divider} />

      {/* ── Devotional Notes ── */}
      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2.5h10M2 5h6M2 7.5h8M2 10h5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        }
        title="Devotional Notes"
        count={enrichedDevNotes.length}
      />
      {!session ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
          <p style={s.emptyText}>Sign in to sync and view your devotional notes.</p>
          <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
            Sign in →
          </button>
        </div>
      ) : enrichedDevNotes.length === 0 ? (
        <EmptyMsg text="No devotional notes yet. Open any reading day to add your reflections." />
      ) : enrichedDevNotes.map(n => (
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
          <p style={s.cardPreview}>{n.notes.slice(0, 140)}{n.notes.length > 140 ? '…' : ''}</p>
        </div>
      ))}

      <div style={s.divider} />

      {/* ── Confession Notes ── */}
      <SectionHeader
        icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--purple-ink)" strokeWidth="1.3"/>
            <path d="M5 5.5h4M5 8h2.5" stroke="var(--purple-ink)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        }
        title="Confession Notes"
        count={confNotes.length}
      />
      {confNotes.length === 0
        ? <EmptyMsg text="No confession notes yet. Open any confession paragraph and tap Note." />
        : confNotes.map(n => {
          const srcLabel = n.source === '2lbcf' ? '2LBCF' : n.source === 'catechism' ? 'Catechism' : '1LBCF'
          return (
            <div
              key={n.key}
              style={s.card}
            >
              <div style={s.cardHead}>
                <span style={s.refBadge}>{srcLabel} {n.itemKey}</span>
                <button
                  onClick={() => setEditingNote({ key: n.key, note: n.note })}
                  style={s.editBtn}
                  title="Edit note"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 9l1.2-2.4 4.8-4.8 1.5 1.5-4.8 4.8L2 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
                <RemoveBtn onClick={() => onRemoveConfNote(n.key)} label="Delete note" />
                <button
                  onClick={() => navigate(`/confessions?t=${n.source}`, { state: { itemKey: n.itemKey, source: n.source } })}
                  style={s.openBtn}
                  title="Open in Confessions"
                >
                  Open →
                </button>
              </div>
              <p style={s.cardPreview}>{n.note.slice(0, 160)}{n.note.length > 160 ? '…' : ''}</p>
            </div>
          )
        })
      }

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Highlights Tab
══════════════════════════════════════════════════════════════ */
function HighlightsTab({ kjvHighlights, confHighlights, navigate, onRemoveKjvHighlight, onRemoveConfHighlight }) {
  return (
    <div style={s.tabContent}>

      {/* Scripture Highlights */}
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
                    title={`Go to ${h.book} ${h.chapter}:${h.verse}`}
                  >
                    <HlDot colorId={h.colorId} />
                    {h.book} {h.chapter}:{h.verse}
                  </button>
                  <button
                    onClick={() => onRemoveKjvHighlight(h.key)}
                    style={{ ...s.hlRemoveBtn, color: c.numClr }}
                    title="Remove highlight"
                  >×</button>
                </div>
              )
            })}
          </div>
        )
      }

      <div style={s.divider} />

      {/* Confession Highlights */}
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
                    title={`Go to ${srcLabel} ${h.itemKey}`}
                  >
                    <HlDot colorId={h.colorId} />
                    {srcLabel} {h.itemKey}
                  </button>
                  <button
                    onClick={() => onRemoveConfHighlight(h.key)}
                    style={{ ...s.hlRemoveBtn, color: c.numClr }}
                    title="Remove highlight"
                  >×</button>
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

  /* ── Live annotation state ── */
  const [devNotes,       setDevNotes]       = useState([])
  const [savedDays,      setSavedDays]      = useState(() => getBookmarks())
  const [scBookmarks,    setScBookmarks]    = useState(() => getAllScriptureBookmarks())
  const [kjvHighlights,  setKjvHighlights]  = useState(() => getAllKjvHighlights())
  const [kjvNotes,       setKjvNotes]       = useState(() => getAllKjvNotes())
  const [confHighlights, setConfHighlights] = useState(() => getAllConfHighlights())
  const [confNotes,      setConfNotes]      = useState(() => getAllConfNotes())
  const [libNotes,       setLibNotes]       = useState(() => getAllLibNotes())

  /* ── Load devotional notes ── */
  useEffect(() => {
    if (session) {
      supabase.from('progress').select('day_number, completed, notes')
        .eq('user_id', session.user.id)
        .then(({ data }) => {
          setDevNotes((data || []).filter(r => r.notes && r.notes.trim()))
        })
    } else {
      const local = getLocalProgress()
      setDevNotes(
        Object.entries(local)
          .filter(([, d]) => d.notes && d.notes.trim())
          .map(([day, d]) => ({ day_number: parseInt(day), notes: d.notes }))
      )
    }
  }, [session])

  /* ── Refresh all annotation state on any change ── */
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

  /* ── Derived data ── */
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

  /* ── Tab counts ── */
  const notesCount      = libNotes.length + kjvNotes.length + enrichedDevNotes.length + confNotes.length
  const bookmarksCount  = savedDayEntries.length + scBookmarks.length
  const highlightsCount = kjvHighlights.length   + confHighlights.length

  const TABS = [
    { id: 'notes',      label: 'Notes',      count: notesCount      },
    { id: 'bookmarks',  label: 'Bookmarks',  count: bookmarksCount  },
    { id: 'highlights', label: 'Highlights', count: highlightsCount },
  ]

  /* ── Mutation handlers ── */
  const handleRemoveSavedDay = useCallback(day => {
    toggleBookmark(day)
    setSavedDays(prev => { const n = { ...prev }; delete n[day]; return n })
  }, [])

  const handleRemoveScBookmark = useCallback((book, chapter) => {
    toggleScriptureBookmark(book, chapter)
    setScBookmarks(getAllScriptureBookmarks())
  }, [])

  const handleRemoveKjvHighlight  = useCallback(key => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveConfHighlight = useCallback(key => setHighlight(key, null, session?.user?.id), [session?.user?.id])
  const handleRemoveKjvNote       = useCallback(key => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveConfNote      = useCallback(key => setItemNote(key, null, session?.user?.id),  [session?.user?.id])
  const handleRemoveLibNote       = useCallback(key => setItemNote(key, null, session?.user?.id),  [session?.user?.id])

  return (
    <div style={s.page}>

      {/* ── Sticky header + tabs ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <button style={s.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={s.headerTitle}>My Library</span>
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

      {/* ── Scrollable content ── */}
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
    minHeight: '100vh',
    background: 'var(--parchment)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    paddingTop: 'env(safe-area-inset-top)',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px 8px',
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink)', padding: 4, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16, fontWeight: 700, color: 'var(--ink)',
    fontFamily: "'Cormorant Garamond', serif",
  },
  tabBar: {
    display: 'flex',
    borderTop: '1px solid var(--border)',
  },
  tab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', padding: '10px 4px',
    fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--teal)',
    borderBottom: '2px solid var(--teal)',
  },
  tabBadge: {
    fontSize: 9, fontWeight: 700,
    background: 'var(--border)', color: 'var(--ink-faint)',
    borderRadius: 99, padding: '1px 5px', lineHeight: 1.6,
  },
  tabBadgeActive: {
    background: 'var(--teal-light)', color: 'var(--teal)',
  },
  scrollArea: {
    flex: 1, overflowY: 'auto', paddingBottom: 90,
  },
  tabContent: {
    padding: '14px 16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  divider: {
    height: 1, background: 'var(--border)', margin: '14px 0 10px',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 6, marginTop: 4, flexWrap: 'wrap',
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' },
  sectionBadge: {
    fontSize: 9, fontWeight: 700,
    background: 'var(--teal-light)', color: 'var(--teal)',
    borderRadius: 99, padding: '1px 6px',
  },
  sectionHint: {
    fontSize: 11, color: 'var(--ink-faint)', margin: '-2px 0 6px', lineHeight: 1.5,
  },
  emptyText: {
    fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 4px', lineHeight: 1.6,
  },

  /* ── New Note button ── */
  newNoteBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', background: 'var(--teal-light)',
    border: '1.5px dashed var(--teal)',
    borderRadius: 'var(--radius-lg)',
    padding: '11px 14px',
    cursor: 'pointer', color: 'var(--teal)',
    fontSize: 13, fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.12s',
    marginBottom: 4,
  },

  /* ── Create / Edit form ── */
  createForm: {
    background: 'var(--surface)',
    border: '1.5px solid var(--teal)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 4,
  },
  createFormHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  formCloseBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },
  textarea: {
    width: '100%', resize: 'vertical', minHeight: 110,
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
    color: 'var(--ink)', background: 'var(--parchment)',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
    outline: 'none',
  },

  /* ── Scripture tag toggle ── */
  tagToggleBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 12px',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: 'var(--ink-muted)', fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.15s, color 0.15s',
    textAlign: 'left',
  },
  tagToggleBtnActive: {
    borderColor: 'var(--teal)', color: 'var(--teal)',
    background: 'var(--teal-light)',
  },
  tagPreview: {
    marginLeft: 4, fontSize: 11, fontWeight: 700,
    background: 'var(--teal)', color: '#fff',
    borderRadius: 99, padding: '1px 8px',
  },

  /* ── Pickers ── */
  pickerRow: {
    display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
  },
  pickerGroup: {
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  pickerLabel: {
    fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  pickerSelect: {
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '6px 8px', fontSize: 12, color: 'var(--ink)',
    background: 'var(--parchment)', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 170,
  },
  pickerSelectSmall: {
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '6px 8px', fontSize: 12, color: 'var(--ink)',
    background: 'var(--parchment)', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    width: 64,
  },
  pickerInput: {
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '6px 8px', fontSize: 12, color: 'var(--ink)',
    background: 'var(--parchment)',
    fontFamily: "'DM Sans', sans-serif",
    width: 56, outline: 'none',
  },
  tagHint: {
    fontSize: 11, color: 'var(--ink-faint)', margin: 0, lineHeight: 1.55,
  },

  /* ── Form actions ── */
  formActions: {
    display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 2,
  },
  cancelBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 16px',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: 'var(--ink-muted)', fontFamily: "'DM Sans', sans-serif",
  },
  saveBtn: {
    background: 'var(--teal)', border: 'none',
    borderRadius: 8, padding: '7px 18px',
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: '#fff', fontFamily: "'DM Sans', sans-serif",
    transition: 'opacity 0.15s',
  },

  /* ── Cards ── */
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '10px 12px',
    transition: 'border-color 0.15s', marginBottom: 4,
  },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: 5,
    marginBottom: 3, flexWrap: 'wrap',
  },
  dayBadge: { fontSize: 10, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 },
  dateBadge: { fontSize: 10, color: 'var(--ink-faint)', flexShrink: 0 },
  refBadge:  { fontSize: 11, fontWeight: 600, color: 'var(--ink)' },
  srcBadge:  { fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, letterSpacing: '0.04em', flexShrink: 0 },
  cardReading: { fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px', fontFamily: "'Cormorant Garamond', serif" },
  cardPreview: { fontSize: 11, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.55 },

  removeBtn: {
    marginLeft: 'auto', flexShrink: 0,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-faint)', padding: '2px 4px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.12s',
  },
  editBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 6, padding: '2px 7px',
    cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: 'var(--ink-faint)', fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.12s, color 0.12s',
  },
  openBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, color: 'var(--teal)',
    fontFamily: "'DM Sans', sans-serif", padding: '2px 0',
    marginLeft: 'auto', flexShrink: 0,
  },

  /* ── Highlights ── */
  hlGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4,
  },
  hlChip: {
    display: 'inline-flex', alignItems: 'center',
    border: '1px solid', borderRadius: 99, overflow: 'hidden',
  },
  hlChipInner: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 600, padding: '4px 8px 4px 10px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  hlRemoveBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, lineHeight: 1, padding: '2px 8px 2px 2px', opacity: 0.7,
  },
}
