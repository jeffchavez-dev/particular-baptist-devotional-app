import React, { useState } from 'react'
import { buildSchedule } from '../lib/supabase'
import { getAllBooks } from '../lib/bookLibrary'

const SCHEDULE = buildSchedule()

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ExportModal({ isOpen, onClose, userNotes = [], progress = {}, session }) {
  const [downloaded, setDownloaded] = useState(null)

  if (!isOpen) return null

  /* Build a quick day→notes lookup */
  const noteMap = {}
  userNotes.forEach(n => { noteMap[n.day_number] = n.notes })

  const completedCount = Object.values(progress).filter(Boolean).length
  const noteCount      = userNotes.length
  const books          = Object.values(getAllBooks())

  function flash(key) {
    setDownloaded(key)
    setTimeout(() => setDownloaded(null), 2200)
  }

  /* ── CSV ── */
  function exportCSV() {
    const header = ['Day','Date','Source','Reading','Detail','Completed','Notes']
    const rows = SCHEDULE.map(r => [
      r.day,
      r.date,
      r.src,
      `"${(r.reading || '').replace(/"/g, '""')}"`,
      `"${(r.detail  || '').replace(/"/g, '""')}"`,
      progress[r.day] ? 'Yes' : 'No',
      `"${(noteMap[r.day] || '').replace(/"/g, '""')}"`,
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    triggerDownload('pb-devotional-export.csv', csv, 'text/csv;charset=utf-8;')
    flash('csv')
  }

  /* ── JSON ── */
  function exportJSON() {
    const data = {
      app: 'Particular Baptist Devotional',
      exported: new Date().toISOString(),
      user: session?.user?.email || 'guest',
      summary: { total: 365, completed: completedCount, withNotes: noteCount, books: books.length },
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
        author:      b.author || null,
        isEbook:     b.isEbook || false,
        totalPages:  b.totalPages || null,
        labels:      b.labels || [],
        completed:   b.completed || false,
        startedAt:   b.startedAt || null,
        completedAt: b.completedAt || null,
        addedAt:     b.addedAt || null,
        notes:       b.notes || [],
      })),
    }
    triggerDownload(
      'pb-devotional-backup.json',
      JSON.stringify(data, null, 2),
      'application/json'
    )
    flash('json')
  }

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
              {downloaded === 'csv' ? '✓ Saved' : '↓'}
            </div>
          </button>

          {/* JSON */}
          <button style={m.optionCard} onClick={exportJSON}>
            <div style={m.optionEmoji}>💾</div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={m.optionTitle}>Export as JSON</div>
              <div style={m.optionDesc}>Full backup of all completed days and personal notes. Useful for archiving or migration.</div>
            </div>
            <div style={{...m.optionAction, color: downloaded === 'json' ? 'var(--teal)' : 'var(--ink-faint)'}}>
              {downloaded === 'json' ? '✓ Saved' : '↓'}
            </div>
          </button>

          {/* Google Drive section */}
          <div style={m.driveCard}>
            <div style={m.driveTop}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 3L2.5 14.5h5.5L14.5 3H9z" stroke="var(--amber-ink)" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M14.5 3L21 14.5h-5.5L14.5 3z" stroke="var(--teal)" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 14.5l3 5h6l-3-5H8z" stroke="var(--purple-ink)" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <span style={m.driveTitle}>Google Drive</span>
            </div>
            <p style={m.driveDesc}>
              Download your CSV or JSON file above, then upload it to Google Drive to keep a secure cloud backup.
              Your notes are always safely stored in Supabase too.
            </p>
            <a
              href="https://drive.google.com/drive/my-drive"
              target="_blank"
              rel="noopener noreferrer"
              style={m.driveLink}
            >
              Open Google Drive ↗
            </a>
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
  overlay: {
    position:'fixed', inset:0, background:'rgba(20,16,10,0.65)',
    zIndex:200, display:'flex', alignItems:'center', justifyContent:'center',
    backdropFilter:'blur(4px)', padding:16,
  },
  modal: {
    background:'white', borderRadius:14, maxWidth:440, width:'100%',
    boxShadow:'0 24px 64px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column',
    maxHeight:'90vh', overflow:'hidden',
  },
  header: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
    padding:'16px 20px', borderBottom:'1px solid var(--border)', gap:12,
  },
  title: { fontSize:15, fontWeight:600, color:'var(--ink)' },
  subtitle: { fontSize:12, color:'var(--ink-faint)', marginTop:2 },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)',
    display:'flex', alignItems:'center', padding:5, borderRadius:6, flexShrink:0,
  },
  body: { padding:'20px', display:'flex', flexDirection:'column', gap:10, overflowY:'auto' },
  optionCard: {
    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
    border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    cursor:'pointer', background:'var(--parchment)', textAlign:'left',
    transition:'background 0.1s, box-shadow 0.1s', width:'100%',
    fontFamily:"'DM Sans',sans-serif",
  },
  optionEmoji: { fontSize:24, flexShrink:0, lineHeight:1 },
  optionTitle: { fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:3 },
  optionDesc: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.5 },
  optionAction: { fontSize:18, fontWeight:700, flexShrink:0, marginLeft:4, transition:'color 0.2s' },

  driveCard: {
    padding:'14px 16px', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', background:'var(--parchment)', marginTop:4,
  },
  driveTop: { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  driveTitle: { fontSize:13, fontWeight:600, color:'var(--ink)' },
  driveDesc: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.55, margin:'0 0 10px' },
  driveLink: {
    display:'inline-flex', alignItems:'center', fontSize:12, color:'var(--teal)',
    fontWeight:600, textDecoration:'none', border:'1px solid var(--teal)',
    borderRadius:'var(--radius)', padding:'5px 11px', gap:4,
  },
  footer: {
    display:'flex', justifyContent:'flex-end', padding:'14px 20px',
    borderTop:'1px solid var(--border)',
  },
}
