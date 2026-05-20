import React, { useState } from 'react'
import { buildSchedule } from '../lib/supabase'
import { getAllBooks } from '../lib/bookLibrary'

const SCHEDULE        = buildSchedule()
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
  return new Date().toISOString().slice(0, 10)   // e.g. "2026-05-20"
}

export default function ExportModal({ isOpen, onClose, userNotes = [], progress = {}, session }) {
  const [downloaded, setDownloaded] = useState(null)
  // 'idle' | 'authenticating' | 'uploading' | 'success' | 'error'
  const [driveStatus, setDriveStatus] = useState('idle')
  const [driveFile,   setDriveFile]   = useState(null)   // { name, id, url }
  const [driveError,  setDriveError]  = useState('')

  if (!isOpen) return null

  const noteMap        = {}
  userNotes.forEach(n => { noteMap[n.day_number] = n.notes })
  const completedCount = Object.values(progress).filter(Boolean).length
  const noteCount      = userNotes.length
  const books          = Object.values(getAllBooks())

  function flash(key) {
    setDownloaded(key)
    setTimeout(() => setDownloaded(null), 2200)
  }

  /* ── Shared backup builder ── */
  function buildBackupJSON() {
    const data = {
      app:      'Particular Baptist Devotional',
      exported: new Date().toISOString(),
      user:     session?.user?.email || 'guest',
      summary:  { total: 365, completed: completedCount, withNotes: noteCount, books: books.length },
      days: SCHEDULE
        .filter(r => progress[r.day] || noteMap[r.day])
        .map(r => ({
          day:       r.day,
          date:      r.date,
          source:    r.src,
          reading:   r.reading,
          completed: !!progress[r.day],
          notes:     noteMap[r.day] || null,
        })),
      bookLibrary: books.map(b => ({
        id:          b.id,
        title:       b.title,
        author:      b.author  || null,
        isEbook:     b.isEbook || false,
        totalPages:  b.totalPages  || null,
        labels:      b.labels      || [],
        completed:   b.completed   || false,
        startedAt:   b.startedAt   || null,
        completedAt: b.completedAt || null,
        addedAt:     b.addedAt     || null,
        notes:       b.notes       || [],
      })),
    }
    return JSON.stringify(data, null, 2)
  }

  /* ── Shared CSV builder (used by local export + Drive upload) ── */
  function buildBackupCSV() {
    const header = ['Day','Date','Source','Reading','Detail','Completed','Notes']
    const rows   = SCHEDULE.map(r => [
      r.day, r.date, r.src,
      `"${(r.reading || '').replace(/"/g, '""')}"`,
      `"${(r.detail  || '').replace(/"/g, '""')}"`,
      progress[r.day] ? 'Yes' : 'No',
      `"${(noteMap[r.day] || '').replace(/"/g, '""')}"`,
    ])
    return [header, ...rows].map(r => r.join(',')).join('\n')
  }

  /* ── CSV download ── */
  function exportCSV() {
    triggerDownload(`pb-devotional-export-${todayISO()}.csv`, buildBackupCSV(), 'text/csv;charset=utf-8;')
    flash('csv')
  }

  /* ── JSON download ── */
  function exportJSON() {
    triggerDownload(
      `pb-devotional-backup-${todayISO()}.json`,
      buildBackupJSON(),
      'application/json'
    )
    flash('json')
  }

  /* ── Google Drive upload ── */
  function uploadToDrive() {
    setDriveStatus('authenticating')
    setDriveError('')
    setDriveFile(null)

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
        if (tokenResponse.error) {
          setDriveStatus('error')
          setDriveError(`Google auth failed: ${tokenResponse.error}`)
          return
        }
        await doUpload(tokenResponse.access_token)
      },
    })

    client.requestAccessToken()
  }

  async function doUpload(accessToken) {
    setDriveStatus('uploading')
    try {
      const date     = todayISO()
      const filename = `pb-devotional-backup-${date}.csv`
      const content  = buildBackupCSV()

      const metadata = {
        name:        filename,
        mimeType:    'text/csv',
        description: `Particular Baptist Devotional backup — ${date}. ${completedCount}/365 days completed, ${noteCount} notes, ${books.length} books.`,
      }

      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file',     new Blob([content],                  { type: 'text/csv' }))

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body:    form,
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Drive API error ${res.status}`)
      }

      const file = await res.json()
      setDriveStatus('success')
      setDriveFile({ name: file.name, id: file.id, url: file.webViewLink })
    } catch (err) {
      setDriveStatus('error')
      setDriveError(err.message || 'Upload failed. Please try again.')
    }
  }

  const driveConfigured = !!GOOGLE_CLIENT_ID

  const driveStatusLabel = {
    idle:           null,
    authenticating: 'Waiting for Google sign-in…',
    uploading:      'Uploading to Drive…',
    success:        null,
    error:          null,
  }[driveStatus]

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={m.header}>
          <div>
            <div style={m.title}>Export &amp; Backup</div>
            <div style={m.subtitle}>{completedCount} days completed · {noteCount} notes · {books.length} books</div>
          </div>
          <button onClick={onClose} style={m.closeBtn} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={m.body}>

          {/* CSV */}
          <button style={m.optionCard} onClick={exportCSV}>
            <div style={m.optionEmoji}>📊</div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={m.optionTitle}>Export as CSV</div>
              <div style={m.optionDesc}>All 365 days with completion status and your notes. Opens in Excel or Google Sheets.</div>
            </div>
            <div style={{...m.optionAction, color: downloaded === 'csv' ? 'var(--teal)' : 'var(--ink-faint)'}}>
              {downloaded === 'csv' ? '✓' : '↓'}
            </div>
          </button>

          {/* JSON */}
          <button style={m.optionCard} onClick={exportJSON}>
            <div style={m.optionEmoji}>💾</div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={m.optionTitle}>Export as JSON</div>
              <div style={m.optionDesc}>Full backup — completed days, notes, and book library. File includes today's date in the name.</div>
            </div>
            <div style={{...m.optionAction, color: downloaded === 'json' ? 'var(--teal)' : 'var(--ink-faint)'}}>
              {downloaded === 'json' ? '✓' : '↓'}
            </div>
          </button>

          {/* Google Drive direct upload */}
          <div style={m.driveCard}>
            <div style={m.driveTop}>
              {/* Google Drive tri-colour icon */}
              <svg width="20" height="18" viewBox="0 0 87 78" fill="none">
                <path d="M6.2 66.4L15 51.3l21.7.1 8.8 15.1H6.2z" fill="#4285F4"/>
                <path d="M80.8 66.4H51.5l-8.8-15.1L58.5 24l22.3 38.6z" fill="#34A853"/>
                <path d="M15 51.3L29.2 26.6 43.9 0 58.5 24l-14.8 27.3H15z" fill="#FBBC05"/>
                <path d="M43.9 0L29.2 26.6 15 51.3l-8.8-14.9L29.2 0h14.7z" fill="#EA4335" opacity=".85"/>
              </svg>
              <span style={m.driveTitle}>Google Drive Backup</span>
            </div>

            {!driveConfigured ? (
              /* Not yet configured — show setup instructions */
              <div>
                <p style={m.driveDesc}>
                  Direct Drive upload needs a one-time Google Cloud setup. Once configured, every backup uploads as
                  {' '}<code style={m.code}>pb-devotional-backup-YYYY-MM-DD.csv</code> — dated so you can track each version.
                </p>
                <div style={m.setupSteps}>
                  <div style={m.setupStep}><span style={m.stepNum}>1</span> Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={m.link}>console.cloud.google.com</a> and create a project</div>
                  <div style={m.setupStep}><span style={m.stepNum}>2</span> Enable the <strong>Google Drive API</strong></div>
                  <div style={m.setupStep}><span style={m.stepNum}>3</span> Create an <strong>OAuth 2.0 Web Client ID</strong> and add your domain to Authorized JS origins</div>
                  <div style={m.setupStep}><span style={m.stepNum}>4</span> Add <code style={m.code}>VITE_GOOGLE_CLIENT_ID=your_client_id</code> to your <code style={m.code}>.env</code> file and redeploy</div>
                </div>
              </div>
            ) : driveStatus === 'success' ? (
              /* Success state */
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
                  {driveFile?.url && (
                    <a href={driveFile.url} target="_blank" rel="noopener noreferrer" style={m.driveLink}>
                      View in Drive ↗
                    </a>
                  )}
                  <button
                    onClick={() => { setDriveStatus('idle'); setDriveFile(null) }}
                    style={{...m.driveLink, background:'none', border:'1px solid var(--border)', color:'var(--ink-muted)', cursor:'pointer'}}
                  >
                    Upload again
                  </button>
                </div>
              </div>
            ) : driveStatus === 'error' ? (
              /* Error state */
              <div>
                <div style={m.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0,marginTop:1}}>
                    <circle cx="7" cy="7" r="6" stroke="#dc3545" strokeWidth="1.3"/>
                    <path d="M7 4v3.5M7 9.5h.01" stroke="#dc3545" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <span style={{fontSize:12, color:'#dc3545'}}>{driveError}</span>
                </div>
                <button
                  onClick={() => { setDriveStatus('idle'); setDriveError('') }}
                  style={{...m.driveLink, marginTop:8, background:'none', cursor:'pointer'}}
                >
                  Try again
                </button>
              </div>
            ) : (
              /* Idle / loading state */
              <div>
                <p style={m.driveDesc}>
                  Uploads directly to your Google Drive as{' '}
                  <code style={m.code}>pb-devotional-backup-{todayISO()}.csv</code>.
                  Each backup is date-stamped so you can track your history.
                </p>
                <button
                  onClick={uploadToDrive}
                  disabled={driveStatus !== 'idle'}
                  style={{
                    ...m.driveBtn,
                    opacity: driveStatus !== 'idle' ? 0.65 : 1,
                    cursor:  driveStatus !== 'idle' ? 'default' : 'pointer',
                  }}
                >
                  {driveStatus !== 'idle' ? (
                    <>
                      <span style={m.spinner} />
                      {driveStatusLabel}
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2v7M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Upload to Google Drive
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
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
  overlay:  { position:'fixed', inset:0, background:'rgba(20,16,10,0.65)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 },
  modal:    { background:'white', borderRadius:14, maxWidth:440, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'90vh', overflow:'hidden' },
  header:   { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', gap:12 },
  title:    { fontSize:15, fontWeight:600, color:'var(--ink)' },
  subtitle: { fontSize:12, color:'var(--ink-faint)', marginTop:2 },
  closeBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', display:'flex', alignItems:'center', padding:5, borderRadius:6, flexShrink:0 },
  body:     { padding:'20px', display:'flex', flexDirection:'column', gap:10, overflowY:'auto' },

  optionCard:   { display:'flex', alignItems:'center', gap:14, padding:'14px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', cursor:'pointer', background:'var(--parchment)', textAlign:'left', transition:'background 0.1s', width:'100%', fontFamily:"'DM Sans',sans-serif" },
  optionEmoji:  { fontSize:24, flexShrink:0, lineHeight:1 },
  optionTitle:  { fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:3 },
  optionDesc:   { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5 },
  optionAction: { fontSize:18, fontWeight:700, flexShrink:0, marginLeft:4, transition:'color 0.2s' },

  driveCard:  { padding:'14px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', background:'var(--parchment)', marginTop:4 },
  driveTop:   { display:'flex', alignItems:'center', gap:8, marginBottom:10 },
  driveTitle: { fontSize:13, fontWeight:600, color:'var(--ink)' },
  driveDesc:  { fontSize:12, color:'var(--ink-faint)', lineHeight:1.55, margin:'0 0 10px' },
  driveBtn: {
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:13, fontWeight:600, color:'white',
    background:'var(--teal)', border:'none', borderRadius:'var(--radius)',
    padding:'8px 16px', fontFamily:"'DM Sans',sans-serif",
    boxShadow:'0 2px 8px rgba(29,107,90,0.3)',
  },
  driveLink: {
    display:'inline-flex', alignItems:'center', fontSize:12, color:'var(--teal)',
    fontWeight:600, textDecoration:'none', border:'1px solid var(--teal)',
    borderRadius:'var(--radius)', padding:'5px 11px', gap:4,
  },

  setupSteps: { display:'flex', flexDirection:'column', gap:6, marginTop:8 },
  setupStep:  { display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--ink-muted)', lineHeight:1.5 },
  stepNum:    { flexShrink:0, width:18, height:18, borderRadius:'50%', background:'var(--teal-light)', color:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, marginTop:1 },
  link:       { color:'var(--teal)', fontWeight:600 },
  code:       { fontFamily:'monospace', fontSize:11, background:'rgba(0,0,0,0.06)', borderRadius:3, padding:'1px 4px' },

  successBox: { display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:'var(--teal-light)', borderRadius:'var(--radius)', border:'1px solid rgba(29,107,90,0.2)' },
  errorBox:   { display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'#fff5f5', borderRadius:'var(--radius)', border:'1px solid #fecaca' },

  spinner: {
    display:'inline-block', width:12, height:12, borderRadius:'50%',
    border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'white',
    animation:'spin 0.7s linear infinite', flexShrink:0,
  },
  footer: { display:'flex', justifyContent:'flex-end', padding:'14px 20px', borderTop:'1px solid var(--border)' },
}
