import React, { useRef, useState } from 'react'
import { buildSchedule, getBibleProgress, getLocalProgress, getBookmarks } from '../lib/supabase'
import { getAllBooks } from '../lib/bookLibrary'
import { loadHighlights, loadItemNotes, getScriptureBookmarks } from '../lib/annotations'

const SCHEDULE         = buildSchedule()
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/* ── Helpers ── */
function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getCompletions() {
  try { return JSON.parse(localStorage.getItem('pb-scripture-completions') || '[]') } catch { return [] }
}

function csvEsc(v) { return `"${String(v == null ? '' : v).replace(/"/g, '""')}"` }

/* ── Comprehensive JSON builder ── */
function buildBackupJSON(progress, noteMap, session) {
  const highlights        = loadHighlights()
  const itemNotes         = loadItemNotes()
  const bibleProgress     = getBibleProgress()
  const bookmarks         = getBookmarks()
  const scriptureBookmarks = getScriptureBookmarks()
  const completions       = getCompletions()
  const books             = Object.values(getAllBooks())

  const completedCount = Object.values(progress).filter(Boolean).length
  const noteCount      = Object.values(noteMap).filter(Boolean).length

  const parseAnnotations = (obj) => Object.entries(obj).map(([key, val]) => {
    const [type, ...rest] = key.split('|')
    return { key, type, reference: rest.join('|'), value: val }
  })

  return JSON.stringify({
    app:      'Particular Baptist Devotional',
    version:  '2.0',
    exported: new Date().toISOString(),
    user:     session?.user?.email || 'guest',
    summary: {
      devotional:         { completed: completedCount, withNotes: noteCount, total: 365 },
      bibleChapters:      Object.keys(bibleProgress).filter(k => bibleProgress[k]).length,
      bibleCompletions:   completions.length,
      highlights:         Object.keys(highlights).length,
      itemNotes:          Object.keys(itemNotes).length,
      devotionalBookmarks:Object.keys(bookmarks).filter(k => bookmarks[k]).length,
      scriptureBookmarks: Object.keys(scriptureBookmarks).length,
      books:              books.length,
      bookNotes:          books.reduce((s, b) => s + (b.notes?.length || 0), 0),
    },

    devotional: {
      progress: SCHEDULE
        .filter(r => progress[r.day] || noteMap[r.day])
        .map(r => ({
          day: r.day, date: r.date, source: r.src, reading: r.reading,
          completed: !!progress[r.day],
          notes: noteMap[r.day] || null,
        })),
      bookmarks: Object.keys(bookmarks)
        .filter(k => bookmarks[k])
        .map(k => {
          const r = SCHEDULE.find(s => s.day === parseInt(k))
          return { day: parseInt(k), date: r?.date || null, source: r?.src || null }
        }),
    },

    bible: {
      chaptersCompleted: Object.keys(bibleProgress).filter(k => bibleProgress[k]),
      completionRecords: completions,
      bookmarks: Object.entries(scriptureBookmarks).map(([key, savedAt]) => {
        const [book, chapter] = key.split('|')
        return { book, chapter: parseInt(chapter), savedAt }
      }),
    },

    annotations: {
      highlights: parseAnnotations(highlights).map(({ key, type, reference, value }) => ({ key, type, reference, color: value })),
      notes:      parseAnnotations(itemNotes).map(({ key, type, reference, value }) => ({ key, type, reference, note: value })),
    },

    bookLibrary: books.map(b => ({
      id: b.id, title: b.title, author: b.author || null,
      isEbook: b.isEbook || false, totalPages: b.totalPages || null,
      labels: b.labels || [], completed: b.completed || false,
      startedAt: b.startedAt || null, completedAt: b.completedAt || null,
      addedAt: b.addedAt || null,
      notes: (b.notes || []).map(n => ({
        id: n.id, type: n.type, text: n.text,
        page: n.page || null, percent: n.percent ?? null,
        labels: n.labels || [], createdAt: n.createdAt || null,
      })),
    })),
  }, null, 2)
}

/* ── Multi-section CSV builder ── */
function buildBackupCSV(progress, noteMap) {
  const highlights         = loadHighlights()
  const itemNotes          = loadItemNotes()
  const bibleProgress      = getBibleProgress()
  const bookmarks          = getBookmarks()
  const scriptureBookmarks = getScriptureBookmarks()
  const completions        = getCompletions()
  const books              = Object.values(getAllBooks())
  const rows               = []

  const sec = (title) => { rows.push(''); rows.push(`=== ${title} ===`) }

  // Devotional Progress
  sec('DEVOTIONAL PROGRESS (365 days)')
  rows.push(['Day','Date','Source','Reading','Completed','Notes'].join(','))
  SCHEDULE.forEach(r => rows.push([
    r.day, csvEsc(r.date), csvEsc(r.src), csvEsc(r.reading),
    progress[r.day] ? 'Yes' : 'No', csvEsc(noteMap[r.day] || ''),
  ].join(',')))

  // Bible Tracker
  sec('BIBLE TRACKER')
  rows.push(['Chapter','Completed'].join(','))
  Object.keys(bibleProgress).filter(k => bibleProgress[k]).forEach(ch =>
    rows.push([csvEsc(ch), 'Yes'].join(',')))

  // Bible Completions
  if (completions.length) {
    sec('BIBLE READING ACHIEVEMENTS')
    rows.push(['Label','Start Date','End Date','Auto Recorded'].join(','))
    completions.forEach(c => rows.push([
      csvEsc(c.label || ''), csvEsc(c.startDate || ''), csvEsc(c.endDate || ''),
      c.autoRecorded ? 'Yes' : 'No',
    ].join(',')))
  }

  // Highlights (verse, confession, catechism)
  sec('HIGHLIGHTS (Bible · Confession · Catechism)')
  rows.push(['Type','Reference','Color'].join(','))
  Object.entries(highlights).forEach(([key, color]) => {
    const [type, ...rest] = key.split('|')
    rows.push([csvEsc(type), csvEsc(rest.join('|')), csvEsc(color)].join(','))
  })

  // Notes (verse notes, confession/catechism notes)
  sec('NOTES & ANNOTATIONS (Bible · Confession · Catechism)')
  rows.push(['Type','Reference','Note'].join(','))
  Object.entries(itemNotes).forEach(([key, note]) => {
    const [type, ...rest] = key.split('|')
    rows.push([csvEsc(type), csvEsc(rest.join('|')), csvEsc(note)].join(','))
  })

  // Devotional Bookmarks
  sec('DEVOTIONAL BOOKMARKS')
  rows.push(['Day','Date','Source'].join(','))
  Object.keys(bookmarks).filter(k => bookmarks[k]).forEach(k => {
    const r = SCHEDULE.find(s => s.day === parseInt(k))
    rows.push([k, csvEsc(r?.date || ''), csvEsc(r?.src || '')].join(','))
  })

  // Scripture Bookmarks
  sec('SCRIPTURE BOOKMARKS')
  rows.push(['Book','Chapter','Saved At'].join(','))
  Object.entries(scriptureBookmarks).forEach(([key, savedAt]) => {
    const [book, chapter] = key.split('|')
    rows.push([csvEsc(book), chapter, csvEsc(savedAt)].join(','))
  })

  // Book Library
  sec('BOOK LIBRARY')
  rows.push(['Title','Author','Completed','Labels','Notes Count','Added At'].join(','))
  books.forEach(b => rows.push([
    csvEsc(b.title), csvEsc(b.author || ''), b.completed ? 'Yes' : 'No',
    csvEsc((b.labels || []).join('; ')), (b.notes || []).length, csvEsc(b.addedAt || ''),
  ].join(',')))

  // Book Notes & Quotes
  sec('BOOK NOTES & QUOTES')
  rows.push(['Book Title','Author','Type','Text','Page','Percent','Created At'].join(','))
  books.forEach(b => (b.notes || []).forEach(n => rows.push([
    csvEsc(b.title), csvEsc(b.author || ''), csvEsc(n.type || 'note'),
    csvEsc(n.text || ''), csvEsc(n.page || ''),
    csvEsc(n.percent != null ? n.percent : ''), csvEsc(n.createdAt || ''),
  ].join(','))))

  return rows.join('\n')
}

/* ── Restore / Import logic ── */
async function doRestore(backupData, mode) {
  const { devotional, bible, annotations, bookLibrary } = backupData

  // Devotional progress
  if (devotional?.progress?.length) {
    const existing = mode === 'merge' ? getLocalProgress() : {}
    devotional.progress.forEach(r => {
      if (r.completed || r.notes) {
        existing[r.day] = { completed: !!r.completed, notes: r.notes || '', updated_at: new Date().toISOString() }
      }
    })
    localStorage.setItem('devotional_guest_progress', JSON.stringify(existing))
    window.dispatchEvent(new StorageEvent('storage', { key: 'devotional_guest_progress' }))
  }

  // Devotional bookmarks
  if (devotional?.bookmarks?.length) {
    const existing = mode === 'merge' ? getBookmarks() : {}
    devotional.bookmarks.forEach(b => { existing[b.day] = true })
    localStorage.setItem('pb-bookmarks', JSON.stringify(existing))
  }

  // Bible progress
  if (bible?.chaptersCompleted?.length) {
    const existing = mode === 'merge' ? getBibleProgress() : {}
    bible.chaptersCompleted.forEach(ch => { existing[ch] = true })
    localStorage.setItem('pb-bible-progress', JSON.stringify(existing))
    window.dispatchEvent(new StorageEvent('storage', { key: 'pb-bible-progress' }))
  }

  // Bible completion records
  if (bible?.completionRecords?.length) {
    const existing = mode === 'merge' ? getCompletions() : []
    const existingIds = new Set(existing.map(c => c.id))
    bible.completionRecords.forEach(c => { if (!existingIds.has(c.id)) existing.push(c) })
    localStorage.setItem('pb-scripture-completions', JSON.stringify(existing))
  }

  // Scripture bookmarks
  if (bible?.bookmarks?.length) {
    const existing = mode === 'merge' ? getScriptureBookmarks() : {}
    bible.bookmarks.forEach(b => { existing[`${b.book}|${b.chapter}`] = b.savedAt })
    localStorage.setItem('pb-scripture-bookmarks', JSON.stringify(existing))
  }

  // Highlights
  if (annotations?.highlights?.length) {
    const existing = mode === 'merge' ? loadHighlights() : {}
    annotations.highlights.forEach(h => { existing[h.key] = h.color })
    localStorage.setItem('pb-highlights', JSON.stringify(existing))
    window.dispatchEvent(new CustomEvent('pb-highlight-changed', { detail: { highlights: existing } }))
  }

  // Item notes
  if (annotations?.notes?.length) {
    const existing = mode === 'merge' ? loadItemNotes() : {}
    annotations.notes.forEach(n => { existing[n.key] = n.note })
    localStorage.setItem('pb-item-notes', JSON.stringify(existing))
    window.dispatchEvent(new CustomEvent('pb-note-changed', { detail: { notes: existing } }))
  }

  // Book library
  if (bookLibrary?.length) {
    const existing = mode === 'merge' ? getAllBooks() : {}
    bookLibrary.forEach(b => { if (mode === 'overwrite' || !existing[b.id]) existing[b.id] = b })
    localStorage.setItem('pb-book-library', JSON.stringify(existing))
    window.dispatchEvent(new CustomEvent('pb-book-library-updated'))
  }
}

/* ── Component ── */
export default function ExportModal({ isOpen, onClose, userNotes = [], progress = {}, session }) {
  const fileInputRef   = useRef(null)
  const [downloaded,   setDownloaded]  = useState(null)
  const [driveStatus,  setDriveStatus] = useState('idle')  // idle|authenticating|uploading|success|error
  const [driveFile,    setDriveFile]   = useState(null)
  const [driveError,   setDriveError]  = useState('')

  // Import / restore state
  const [importData,   setImportData]  = useState(null)    // parsed backup JSON
  const [importError,  setImportError] = useState('')
  const [importMode,   setImportMode]  = useState('merge') // 'merge' | 'overwrite'
  const [importStep,   setImportStep]  = useState('idle')  // idle|preview|confirm|done|error
  const [importResult, setImportResult] = useState('')

  if (!isOpen) return null

  const noteMap        = {}
  userNotes.forEach(n => { noteMap[n.day_number] = n.notes })
  const completedCount = Object.values(progress).filter(Boolean).length
  const noteCount      = userNotes.length
  const books          = Object.values(getAllBooks())

  function flash(key) {
    setDownloaded(key); setTimeout(() => setDownloaded(null), 2200)
  }

  /* ── Export as JSON ── */
  function exportJSON() {
    triggerDownload(
      `pb-devotional-backup-${todayISO()}.json`,
      buildBackupJSON(progress, noteMap, session),
      'application/json'
    )
    flash('json')
  }

  /* ── Export as CSV ── */
  function exportCSV() {
    triggerDownload(
      `pb-devotional-export-${todayISO()}.csv`,
      buildBackupCSV(progress, noteMap),
      'text/csv;charset=utf-8;'
    )
    flash('csv')
  }

  /* ── Google Drive upload (JSON) ── */
  function uploadToDrive() {
    setDriveStatus('authenticating'); setDriveError(''); setDriveFile(null)
    if (!GOOGLE_CLIENT_ID) {
      setDriveStatus('error')
      setDriveError('Google Drive is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.')
      return
    }
    if (!window.google?.accounts?.oauth2) {
      setDriveStatus('error')
      setDriveError('Google Sign-In library failed to load. Check your internet connection and try again.')
      return
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     'https://www.googleapis.com/auth/drive.file',
      callback:  async (tokenResponse) => {
        if (tokenResponse.error) { setDriveStatus('error'); setDriveError(`Google auth failed: ${tokenResponse.error}`); return }
        await doUpload(tokenResponse.access_token)
      },
    })
    client.requestAccessToken()
  }

  async function doUpload(accessToken) {
    setDriveStatus('uploading')
    try {
      const date     = todayISO()
      const filename = `pb-devotional-backup-${date}.json`
      const content  = buildBackupJSON(progress, noteMap, session)
      const metadata = {
        name: filename, mimeType: 'application/json',
        description: `Particular Baptist Devotional backup — ${date}. ${completedCount}/365 days, ${noteCount} notes, ${books.length} books.`,
      }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file',     new Blob([content],                  { type: 'application/json' }))
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
      )
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Drive API error ${res.status}`) }
      const file = await res.json()
      setDriveStatus('success'); setDriveFile({ name: file.name, id: file.id, url: file.webViewLink })
    } catch (err) {
      setDriveStatus('error'); setDriveError(err.message || 'Upload failed. Please try again.')
    }
  }

  /* ── Import / Restore ── */
  function handleFileSelect(e) {
    setImportError(''); setImportData(null); setImportStep('idle'); setImportResult('')
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.app !== 'Particular Baptist Devotional') throw new Error('Not a valid PB Devotional backup file.')
        if (!data.version || data.version < '2.0') throw new Error('This backup is from an older version. Some data may not restore correctly — you can still proceed.')
        setImportData(data); setImportStep('preview')
      } catch (err) { setImportError(err.message); setImportStep('idle') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function confirmRestore() {
    setImportStep('confirm')
    try {
      await doRestore(importData, importMode)
      setImportStep('done')
      setImportResult(`Restored successfully. Reload the app to see all changes.`)
    } catch (err) {
      setImportStep('error')
      setImportResult(err.message || 'Restore failed.')
    }
  }

  function resetImport() {
    setImportData(null); setImportError(''); setImportStep('idle'); setImportResult('')
  }

  const driveConfigured = !!GOOGLE_CLIENT_ID
  const driveStatusLabel = { authenticating: 'Waiting for Google sign-in…', uploading: 'Uploading to Drive…' }[driveStatus]

  const s = importData?.summary || {}

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={m.header}>
          <div>
            <div style={m.title}>Export &amp; Backup</div>
            <div style={m.subtitle}>{completedCount}/365 days · {noteCount} notes · {books.length} books</div>
          </div>
          <button onClick={onClose} style={m.closeBtn} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={m.body}>

          {/* Section: Export */}
          <div style={m.sectionHead}>Export</div>

          {/* JSON */}
          <button style={m.optionCard} onClick={exportJSON}>
            <div style={m.optionEmoji}>💾</div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={m.optionTitle}>Full Backup (JSON)</div>
              <div style={m.optionDesc}>Everything — devotional, Bible tracker, confession/catechism highlights &amp; notes, bookmarks, book library with notes &amp; quotes.</div>
            </div>
            <div style={{...m.optionAction, color: downloaded === 'json' ? 'var(--teal)' : 'var(--ink-faint)'}}>
              {downloaded === 'json' ? '✓' : '↓'}
            </div>
          </button>

          {/* CSV */}
          <button style={m.optionCard} onClick={exportCSV}>
            <div style={m.optionEmoji}>📊</div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={m.optionTitle}>Full Export (CSV)</div>
              <div style={m.optionDesc}>Same data in multi-section spreadsheet format — devotional, Bible tracker, highlights, notes, bookmarks, books. Opens in Excel or Google Sheets.</div>
            </div>
            <div style={{...m.optionAction, color: downloaded === 'csv' ? 'var(--teal)' : 'var(--ink-faint)'}}>
              {downloaded === 'csv' ? '✓' : '↓'}
            </div>
          </button>

          {/* Google Drive */}
          <div style={m.driveCard}>
            <div style={m.driveTop}>
              <svg width="20" height="18" viewBox="0 0 87 78" fill="none">
                <path d="M6.2 66.4L15 51.3l21.7.1 8.8 15.1H6.2z" fill="#4285F4"/>
                <path d="M80.8 66.4H51.5l-8.8-15.1L58.5 24l22.3 38.6z" fill="#34A853"/>
                <path d="M15 51.3L29.2 26.6 43.9 0 58.5 24l-14.8 27.3H15z" fill="#FBBC05"/>
                <path d="M43.9 0L29.2 26.6 15 51.3l-8.8-14.9L29.2 0h14.7z" fill="#EA4335" opacity=".85"/>
              </svg>
              <span style={m.driveTitle}>Google Drive Backup</span>
            </div>
            {!driveConfigured ? (
              <div>
                <p style={m.driveDesc}>Direct Drive upload needs a one-time setup. Once configured, backups upload as <code style={m.code}>pb-devotional-backup-YYYY-MM-DD.json</code> with full data.</p>
                <div style={m.setupSteps}>
                  <div style={m.setupStep}><span style={m.stepNum}>1</span>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={m.link}>console.cloud.google.com</a> and create a project</div>
                  <div style={m.setupStep}><span style={m.stepNum}>2</span>Enable the <strong>Google Drive API</strong></div>
                  <div style={m.setupStep}><span style={m.stepNum}>3</span>Create an <strong>OAuth 2.0 Web Client ID</strong> and add your domain to Authorized JS origins</div>
                  <div style={m.setupStep}><span style={m.stepNum}>4</span>Add <code style={m.code}>VITE_GOOGLE_CLIENT_ID=your_client_id</code> to your <code style={m.code}>.env</code> and redeploy</div>
                </div>
              </div>
            ) : driveStatus === 'success' ? (
              <div>
                <div style={m.successBox}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                    <circle cx="8" cy="8" r="7" fill="var(--teal)" opacity=".15"/>
                    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color:'var(--teal)'}}>Uploaded successfully</div>
                    <div style={{fontSize:11, color:'var(--ink-faint)', marginTop:2}}>{driveFile?.name}</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  {driveFile?.url && <a href={driveFile.url} target="_blank" rel="noopener noreferrer" style={m.driveLink}>View in Drive ↗</a>}
                  <button onClick={() => { setDriveStatus('idle'); setDriveFile(null) }} style={{...m.driveLink, background:'none', border:'1px solid var(--border)', color:'var(--ink-muted)', cursor:'pointer'}}>Upload again</button>
                </div>
              </div>
            ) : driveStatus === 'error' ? (
              <div>
                <div style={m.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0,marginTop:1}}>
                    <circle cx="7" cy="7" r="6" stroke="#dc3545" strokeWidth="1.3"/>
                    <path d="M7 4v3.5M7 9.5h.01" stroke="#dc3545" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <span style={{fontSize:12, color:'#dc3545'}}>{driveError}</span>
                </div>
                <button onClick={() => { setDriveStatus('idle'); setDriveError('') }} style={{...m.driveLink, marginTop:8, background:'none', cursor:'pointer'}}>Try again</button>
              </div>
            ) : (
              <div>
                <p style={m.driveDesc}>Uploads full JSON backup to your Google Drive as <code style={m.code}>pb-devotional-backup-{todayISO()}.json</code>. All data included.</p>
                <button onClick={uploadToDrive} disabled={driveStatus !== 'idle'} style={{...m.driveBtn, opacity: driveStatus !== 'idle' ? 0.65 : 1, cursor: driveStatus !== 'idle' ? 'default' : 'pointer'}}>
                  {driveStatus !== 'idle' ? <><span style={m.spinner} />{driveStatusLabel}</> : <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Upload to Google Drive
                  </>}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={m.divider} />

          {/* Section: Restore */}
          <div style={m.sectionHead}>Restore / Import</div>

          {/* Sync note */}
          <div style={m.syncNote}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0,marginTop:1}}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--teal)" strokeWidth="1.2"/>
              <path d="M6.5 5.5v4M6.5 4h.01" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span><strong>Signed-in users:</strong> devotional progress, Bible tracker, highlights, notes, and book library sync automatically across devices via the cloud. <strong>Bookmarks, Bible completion records, and reading streaks are local-only</strong> and benefit from a manual backup when switching phones.</span>
          </div>

          {importStep === 'idle' && (
            <div style={m.importCard}>
              <div style={{fontSize:13, color:'var(--ink-muted)', marginBottom:10, lineHeight:1.55}}>
                Restore from a <code style={m.code}>.json</code> backup file. Choose <strong>Merge</strong> to add to existing data, or <strong>Overwrite</strong> to replace it.
              </div>
              <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
                {['merge','overwrite'].map(mode => (
                  <button key={mode} onClick={() => setImportMode(mode)} style={{
                    ...m.modeBtn,
                    ...(importMode === mode ? m.modeBtnActive : {}),
                  }}>
                    {mode === 'merge' ? '⊕ Merge' : '↺ Overwrite'}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11, color:'var(--ink-faint)', marginBottom:10}}>
                {importMode === 'merge'
                  ? 'Keeps your current data and adds anything from the backup that is missing.'
                  : 'Replaces your current data entirely with the backup. Use with caution.'}
              </div>
              <button onClick={() => fileInputRef.current?.click()} style={m.importBtn}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Choose Backup File
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" style={{display:'none'}} onChange={handleFileSelect} />
              {importError && <div style={{...m.errorBox, marginTop:10}}><span style={{fontSize:12, color:'#dc3545'}}>{importError}</span></div>}
            </div>
          )}

          {importStep === 'preview' && importData && (
            <div style={m.importCard}>
              <div style={{fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:4}}>Backup Preview</div>
              <div style={{fontSize:11, color:'var(--ink-faint)', marginBottom:10}}>
                From {importData.exported ? new Date(importData.exported).toLocaleDateString() : 'unknown date'} · {importData.user || 'guest'}
              </div>
              <div style={m.previewGrid}>
                {[
                  ['Devotional days', s.devotional?.completed ?? 0],
                  ['Devotional notes', s.devotional?.withNotes ?? 0],
                  ['Bible chapters', s.bibleChapters ?? 0],
                  ['Bible completions', s.bibleCompletions ?? 0],
                  ['Highlights', s.highlights ?? 0],
                  ['Annotation notes', s.itemNotes ?? 0],
                  ['Dev. bookmarks', s.devotionalBookmarks ?? 0],
                  ['Scripture bookmarks', s.scriptureBookmarks ?? 0],
                  ['Books', s.books ?? 0],
                  ['Book notes/quotes', s.bookNotes ?? 0],
                ].map(([label, val]) => (
                  <div key={label} style={m.previewRow}>
                    <span style={{fontSize:12, color:'var(--ink-muted)'}}>{label}</span>
                    <span style={{fontSize:12, fontWeight:600, color:'var(--teal)'}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11, color:'var(--ink-faint)', margin:'10px 0', padding:'8px 10px', background: importMode === 'overwrite' ? '#fff5f5' : 'var(--teal-light)', borderRadius:'var(--radius)'}}>
                {importMode === 'overwrite'
                  ? '⚠ Overwrite mode: your current data will be replaced. This cannot be undone.'
                  : '⊕ Merge mode: backup data will be added to your existing data.'}
              </div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={resetImport} style={{...m.modeBtn, flex:1}}>← Back</button>
                <button onClick={confirmRestore} style={{...m.driveBtn, flex:2}}>
                  Restore Now
                </button>
              </div>
            </div>
          )}

          {(importStep === 'confirm') && (
            <div style={m.importCard}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={m.spinner2} />
                <span style={{fontSize:13, color:'var(--ink-muted)'}}>Restoring…</span>
              </div>
            </div>
          )}

          {importStep === 'done' && (
            <div style={m.importCard}>
              <div style={m.successBox}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                  <circle cx="8" cy="8" r="7" fill="var(--teal)" opacity=".15"/>
                  <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <div style={{fontSize:13, fontWeight:600, color:'var(--teal)'}}>Restore complete</div>
                  <div style={{fontSize:11, color:'var(--ink-faint)', marginTop:2}}>{importResult}</div>
                </div>
              </div>
              <button onClick={resetImport} style={{...m.modeBtn, marginTop:10}}>Restore another file</button>
            </div>
          )}

          {importStep === 'error' && (
            <div style={m.importCard}>
              <div style={m.errorBox}>
                <span style={{fontSize:12, color:'#dc3545'}}>{importResult}</span>
              </div>
              <button onClick={resetImport} style={{...m.modeBtn, marginTop:10}}>Try again</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={m.footer}>
          <button onClick={onClose} className="btn btn-ghost" style={{fontSize:13}}>Close</button>
        </div>
      </div>
    </div>
  )
}

const m = {
  overlay:    { position:'fixed', inset:0, background:'rgba(20,16,10,0.65)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 },
  modal:      { background:'white', borderRadius:14, maxWidth:460, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'90vh', overflow:'hidden' },
  header:     { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', gap:12 },
  title:      { fontSize:15, fontWeight:600, color:'var(--ink)' },
  subtitle:   { fontSize:12, color:'var(--ink-faint)', marginTop:2 },
  closeBtn:   { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:5, borderRadius:6, flexShrink:0 },
  body:       { padding:'20px', display:'flex', flexDirection:'column', gap:10, overflowY:'auto' },
  sectionHead:{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--ink-faint)', marginTop:4 },
  divider:    { borderTop:'1px solid var(--border)', margin:'4px 0' },

  optionCard:   { display:'flex', alignItems:'center', gap:14, padding:'14px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', cursor:'pointer', background:'var(--parchment)', textAlign:'left', width:'100%', fontFamily:"'DM Sans',sans-serif" },
  optionEmoji:  { fontSize:24, flexShrink:0, lineHeight:1 },
  optionTitle:  { fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:3 },
  optionDesc:   { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5 },
  optionAction: { fontSize:18, fontWeight:700, flexShrink:0, marginLeft:4 },

  driveCard:  { padding:'14px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', background:'var(--parchment)', marginTop:2 },
  driveTop:   { display:'flex', alignItems:'center', gap:8, marginBottom:10 },
  driveTitle: { fontSize:13, fontWeight:600, color:'var(--ink)' },
  driveDesc:  { fontSize:12, color:'var(--ink-faint)', lineHeight:1.55, margin:'0 0 10px' },
  driveBtn:   { display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'white', background:'var(--teal)', border:'none', borderRadius:'var(--radius)', padding:'8px 16px', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 2px 8px rgba(29,107,90,0.3)', cursor:'pointer' },
  driveLink:  { display:'inline-flex', alignItems:'center', fontSize:12, color:'var(--teal)', fontWeight:600, textDecoration:'none', border:'1px solid var(--teal)', borderRadius:'var(--radius)', padding:'5px 11px', gap:4 },

  setupSteps: { display:'flex', flexDirection:'column', gap:6, marginTop:8 },
  setupStep:  { display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--ink-muted)', lineHeight:1.5 },
  stepNum:    { flexShrink:0, width:18, height:18, borderRadius:'50%', background:'var(--teal-light)', color:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, marginTop:1 },
  link:       { color:'var(--teal)', fontWeight:600 },
  code:       { fontFamily:'monospace', fontSize:11, background:'rgba(0,0,0,0.06)', borderRadius:3, padding:'1px 4px' },

  syncNote:   { display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'var(--teal-light)', borderRadius:'var(--radius)', fontSize:12, color:'var(--ink-muted)', lineHeight:1.55 },

  importCard: { padding:'14px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', background:'var(--parchment)' },
  importBtn:  { display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--teal)', background:'none', border:'1.5px solid var(--teal)', borderRadius:'var(--radius)', padding:'8px 16px', fontFamily:"'DM Sans',sans-serif", cursor:'pointer' },
  modeBtn:    { padding:'6px 14px', borderRadius:99, border:'1.5px solid var(--border)', background:'var(--parchment)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", color:'var(--ink)' },
  modeBtnActive: { borderColor:'var(--teal)', background:'var(--teal-light)', color:'var(--teal)' },

  previewGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, marginBottom:4 },
  previewRow:  { display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'white', borderRadius:4 },

  successBox: { display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:'var(--teal-light)', borderRadius:'var(--radius)', border:'1px solid rgba(29,107,90,0.2)' },
  errorBox:   { display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'#fff5f5', borderRadius:'var(--radius)', border:'1px solid #fecaca' },

  spinner:  { display:'inline-block', width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'white', animation:'spin 0.7s linear infinite', flexShrink:0 },
  spinner2: { display:'inline-block', width:14, height:14, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'spin 0.7s linear infinite', flexShrink:0 },
  footer:   { display:'flex', justifyContent:'flex-end', padding:'14px 20px', borderTop:'1px solid var(--border)' },
}
