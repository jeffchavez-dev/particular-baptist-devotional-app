import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, buildSchedule, getLocalProgress, setLocalProgress, getBibleProgress, setBibleChapter, toggleBookmark, isBookmarked } from '../lib/supabase'
import { useAuth } from '../App'
import { LBCF2 } from '../data/lbcf2'
import { CATECHISM } from '../data/catechism'
import { LBCF1 } from '../data/lbcf1'
import { QUOTES } from '../data/quotes'
import ShareCardModal from '../components/ShareCardModal'
import { getFontCss } from '../components/FontPrefsPanel'
import { usePrefs } from '../App'
import CopyBtn from '../components/CopyBtn'
import { parseRefs } from '../lib/parseRefs'
import KjvModal from '../components/KjvModal'

const SCHEDULE = buildSchedule()

function badgeClass(src) {
  if (src === '2LBCF')    return 'badge badge-2lbcf'
  if (src === 'Catechism') return 'badge badge-cat'
  if (src === '1LBCF')    return 'badge badge-1lbcf'
  return 'badge badge-review'
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <polyline points="2,6.5 5.5,10 11,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function getContent(entry) {
  if (!entry) return null
  if (entry.src === '2LBCF') {
    const m = entry.reading.match(/Ch\.\s*(\d+)\s*§(\d+)/)
    if (!m) return null
    const key = `${m[1]}.${m[2]}`
    const item = LBCF2[key]
    if (!item) return null
    return { type: '2lbcf', text: item.text, refs: item.refs, quoteKey: key }
  }
  if (entry.src === 'Catechism') {
    const m = entry.reading.match(/Q&A\s*#(\d+)/)
    if (!m) return null
    const item = CATECHISM[parseInt(m[1])]
    if (!item) return null
    return { type: 'catechism', q: item.q, a: item.a, refs: item.refs }
  }
  if (entry.src === '1LBCF') {
    const m = entry.reading.match(/Article\s*(\d+)/)
    if (!m) return null
    const num = parseInt(m[1])
    const item = LBCF1[num]
    if (!item) return null
    return { type: '1lbcf', title: item.title, text: item.text, refs: item.refs, quoteKey: `lbcf1.${num}` }
  }
  return null
}

/** Parse "1 Corinthians 8" or "Isaiah 44" → { book, chapter, refDisplay } */
function parseBibleChapterRef(str) {
  if (!str) return null
  const m = str.match(/^(.*?)\s+(\d+)$/)
  if (!m) return null
  return { book: m[1].trim(), chapter: parseInt(m[2]), refDisplay: str }
}

function BodyText({ text, textStyle = {} }) {
  const style = { ...s.bodyText, ...textStyle }
  const lines = text.split('\\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    return <p style={style}>{text}</p>
  }
  return (
    <div style={style}>
      {lines.map((line, i) => <p key={i} style={{ marginBottom: i < lines.length - 1 ? '0.6em' : 0 }}>{line}</p>)}
    </div>
  )
}

const ADMIN_EMAIL = 'jeffchavez0828@gmail.com'

const EMPTY_DRAFT = { heading: '', quote: '', author: '', work: '' }

function QuoteBlock({ quoteKey, session, textStyle = {}, onShareQuote }) {
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const staticQ  = QUOTES[quoteKey]

  const [dbQ,     setDbQ]     = useState(null)
  const [fetched, setFetched] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(EMPTY_DRAFT)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase
        .from('quotes')
        .select('*')
        .eq('quote_key', quoteKey)
        .maybeSingle()
      if (!cancelled) {
        if (!err) setDbQ(data || null)
        setFetched(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [quoteKey])

  const q = dbQ || staticQ   // DB overrides static

  function startEdit() {
    setDraft({ heading: q?.heading || '', quote: q?.quote || '', author: q?.author || '', work: q?.work || '' })
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!draft.quote.trim() || !draft.author.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('quotes').upsert(
      { quote_key: quoteKey, ...draft, updated_at: new Date().toISOString() },
      { onConflict: 'quote_key' }
    )
    if (err) {
      setError('Save failed: ' + err.message)
      setSaving(false)
      return
    }
    setDbQ({ ...draft })
    setEditing(false)
    setSaving(false)
  }

  async function removeOverride() {
    const { error: err } = await supabase.from('quotes').delete().eq('quote_key', quoteKey)
    if (!err) { setDbQ(null); setEditing(false) }
    else setError('Delete failed: ' + err.message)
  }

  if (!fetched && !staticQ) return null          // wait silently if nothing to show yet
  if (!q && !isAdmin) return null                // no quote, not admin → nothing

  return (
    <div style={s.quoteCard}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: editing ? 12 : 0 }}>
        {!editing && q && <div style={s.quoteHeading}>{q.heading}</div>}
        {!editing && !q && <div style={s.quoteHeading}>Quote</div>}
        {isAdmin && !editing && (
          <button onClick={startEdit} style={qe.editBtn}>
            {dbQ ? 'Edit' : staticQ ? 'Override' : '+ Add quote'}
          </button>
        )}
      </div>

      {editing ? (
        <div style={qe.form}>
          <label style={qe.label}>Heading</label>
          <input style={qe.input} value={draft.heading} onChange={e => setDraft(d => ({...d, heading: e.target.value}))} placeholder="e.g. The Necessity of Scripture" />
          <label style={qe.label}>Quote</label>
          <textarea style={qe.ta} rows={4} value={draft.quote} onChange={e => setDraft(d => ({...d, quote: e.target.value}))} placeholder="Quote text…" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={qe.label}>Author</label>
              <input style={qe.input} value={draft.author} onChange={e => setDraft(d => ({...d, author: e.target.value}))} placeholder="e.g. Benjamin Keach" />
            </div>
            <div>
              <label style={qe.label}>Work</label>
              <input style={qe.input} value={draft.work} onChange={e => setDraft(d => ({...d, work: e.target.value}))} placeholder="e.g. Gospel Mysteries Unveil'd" />
            </div>
          </div>
          {error && <p style={dn.errorText}>{error}</p>}
          <div style={qe.actions}>
            {dbQ && <button onClick={removeOverride} style={qe.deleteBtn}>Remove override</button>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setEditing(false); setError(null) }} className="btn btn-ghost" style={{ fontSize:13 }}>Cancel</button>
              <button onClick={save} className="btn btn-primary" disabled={saving || !draft.quote.trim()} style={{ fontSize:13 }}>
                {saving ? <span className="spinner" style={{width:13,height:13}}/> : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : q ? (
        <>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2}}>
            <div style={s.quoteMark}>&ldquo;</div>
            {onShareQuote && (
              <button
                onClick={() => onShareQuote(q)}
                style={{...cb.btn, color:'var(--purple-ink)', borderColor:'var(--purple-soft)'}}
                title="Create share image of this quote"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 5.8l5-2.8M4 7.2l5 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span style={{fontSize:11}}>Share</span>
              </button>
            )}
          </div>
          <blockquote style={{...s.quoteText, ...textStyle, fontSize: textStyle.fontSize ? textStyle.fontSize * 0.94 : undefined}}>{q.quote}</blockquote>
          <div style={s.quoteAttrib}>
            — {q.author}<span style={s.quoteWork}>, {q.work}</span>
          </div>
          {dbQ && isAdmin && (
            <div style={{ marginTop:6, fontSize:11, color:'var(--teal)', opacity:0.7 }}>● Live (DB override)</div>
          )}
        </>
      ) : (
        <p style={{ fontSize:13, color:'var(--ink-faint)', fontStyle:'italic', margin:'4px 0 0' }}>
          No quote for this entry yet.
        </p>
      )}
    </div>
  )
}

const qe = {
  editBtn: { fontSize:12, color:'var(--gold)', background:'none', border:'none', cursor:'pointer', fontWeight:500, padding:'2px 6px', borderRadius:4 },
  form: { display:'flex', flexDirection:'column', gap:10 },
  label: { fontSize:11, fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:3 },
  input: { width:'100%', boxSizing:'border-box', fontSize:14 },
  ta: { width:'100%', boxSizing:'border-box', fontSize:14, resize:'vertical', lineHeight:1.6 },
  actions: { display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:4 },
  deleteBtn: { fontSize:12, color:'var(--ink-faint)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 },
  errorText: { fontSize:12, color:'#c0392b', margin:'6px 0 0', background:'#fdf0ef', padding:'6px 10px', borderRadius:4 },
}

const cb = {
  btn: {
    display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px',
    background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius)',
    cursor:'pointer', color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif",
    transition:'border-color 0.15s',
  },
}

function ContentBlock({ content, session, entry, prefs, onShare, onShareQuote, onScriptureRef }) {
  if (!content) return null

  const textStyle = prefs
    ? { fontSize: prefs.sizePx, fontFamily: getFontCss(prefs.fontId) }
    : {}

  const parsedRefs = content.refs ? parseRefs(content.refs) : []

  function getContentText() {
    let text = content.type === 'catechism'
      ? `Q. ${content.q}\n\nA. ${content.a}`
      : (content.text || '')
    if (content.refs) text += '\n\nScripture proofs: ' + content.refs
    return text
  }

  return (
    <div className="card" style={s.contentCard}>
      <div style={s.contentHeader}>
        <span style={s.contentLabel}>
          {content.type === 'catechism' ? "Today's Reading" : 'Confession Text'}
        </span>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <CopyBtn getText={getContentText} label="Copy" />
          {onShare && (
            <button
              onClick={() => onShare({ type:'reading', text: getContentText() })}
              style={{...cb.btn, color:'var(--purple-ink)', borderColor:'var(--purple-soft)'}}
              title="Create share image"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 5.8l5-2.8M4 7.2l5 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:11}}>Share</span>
            </button>
          )}
        </div>
      </div>

      {content.type === 'catechism' && (
        <div style={s.catWrap}>
          <p style={{...s.catQ, ...textStyle}}><em>Q.</em> {content.q}</p>
          <p style={{...s.catA, ...textStyle}}><em>A.</em> {content.a}</p>
        </div>
      )}

      {(content.type === '2lbcf' || content.type === '1lbcf') && (
        <BodyText text={content.text} textStyle={textStyle} />
      )}

      {content.refs && (
        <div style={s.refsBlock}>
          <div style={s.refsLabel}>Scripture Proofs</div>
          {parsedRefs.length > 0 ? (
            <div style={s.refChips}>
              {parsedRefs.map(({ book, chapter, verse, display }) => (
                <button
                  key={`${book}|${chapter}|${verse ?? 0}`}
                  style={s.refChip}
                  onClick={() => onScriptureRef && onScriptureRef({ book, chapter, verse: verse ?? null, refDisplay: display })}
                >
                  {display}
                </button>
              ))}
            </div>
          ) : (
            <p style={s.refsText}>{content.refs}</p>
          )}
        </div>
      )}

      {content.quoteKey && (
        <QuoteBlock
          quoteKey={content.quoteKey}
          session={session}
          textStyle={textStyle}
          onShareQuote={onShareQuote}
        />
      )}
    </div>
  )
}

function DevNote({ day, session }) {
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const [note,    setNote]    = useState(null)
  const [draft,   setDraft]   = useState('')
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase
        .from('dev_notes')
        .select('content')
        .eq('day_number', day)
        .maybeSingle()           // returns null (not error) when no row found
      if (!cancelled) {
        if (!err) setNote(data?.content ?? null)
        setFetched(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [day])

  function startEdit() {
    setDraft(note || '')
    setError(null)
    setEditing(true)
  }

  async function saveNote() {
    if (!draft.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('dev_notes').upsert(
      { day_number: day, content: draft.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'day_number' }
    )
    if (err) {
      setError('Save failed: ' + err.message)
      setSaving(false)
      return
    }
    setNote(draft.trim())
    setEditing(false)
    setSaving(false)
  }

  async function deleteNote() {
    const { error: err } = await supabase.from('dev_notes').delete().eq('day_number', day)
    if (!err) { setNote(null); setEditing(false) }
    else setError('Delete failed: ' + err.message)
  }

  if (!fetched) return null
  if (!note && !isAdmin) return null

  return (
    <div className="card" style={dn.card}>
      <div style={dn.header}>
        <div style={dn.labelRow}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0}}>
            <path d="M9 1.5L11.5 4 4.5 11H2v-2.5L9 1.5z" stroke="var(--amber-ink)" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          <span style={dn.label}>Author's Note</span>
        </div>
        {isAdmin && !editing && (
          <button onClick={startEdit} style={dn.editBtn}>{note ? 'Edit' : '+ Add note'}</button>
        )}
      </div>

      {editing ? (
        <div style={{marginTop:10}}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Write a note for all readers on this day…"
            rows={5}
            style={dn.textarea}
            autoFocus
          />
          {error && <p style={dn.errorText}>{error}</p>}
          <div style={dn.editActions}>
            {note && <button onClick={deleteNote} style={dn.deleteBtn}>Delete</button>}
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => { setEditing(false); setError(null) }} className="btn btn-ghost" style={{fontSize:13}}>Cancel</button>
              <button onClick={saveNote} className="btn btn-primary" disabled={saving || !draft.trim()} style={{fontSize:13}}>
                {saving ? <span className="spinner" style={{width:13,height:13}}/> : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : note ? (
        <p style={dn.noteText}>{note}</p>
      ) : (
        <p style={{...dn.noteText, color:'var(--ink-faint)', fontStyle:'italic'}}>No author's note for this day yet.</p>
      )}
    </div>
  )
}

const dn = {
  card: { padding:'20px', borderLeft:'3px solid var(--amber-ink)', background:'var(--amber-soft)' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 },
  labelRow: { display:'flex', alignItems:'center', gap:6 },
  label: { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--amber-ink)' },
  editBtn: { fontSize:12, color:'var(--amber-ink)', background:'none', border:'none', cursor:'pointer', fontWeight:500, padding:'2px 6px', borderRadius:4 },
  noteText: { fontSize:15, lineHeight:1.8, color:'var(--ink)', margin:'8px 0 0', fontFamily:"'Cormorant Garamond',serif" },
  textarea: { resize:'vertical', minHeight:100, lineHeight:1.7, width:'100%', boxSizing:'border-box', background:'white' },
  editActions: { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 },
  deleteBtn: { fontSize:12, color:'var(--ink-faint)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 },
}

export default function ReadingPage() {
  const { dayNum } = useParams()
  const day = parseInt(dayNum)
  const navigate = useNavigate()
  const { session } = useAuth()

  const entry = SCHEDULE.find(r => r.day === day)
  const prev  = SCHEDULE.find(r => r.day === day - 1)
  const next  = SCHEDULE.find(r => r.day === day + 1)
  const content = getContent(entry)

  const [completed, setCompleted] = useState(false)
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shareCard, setShareCard] = useState(null)
  const [kjvModal, setKjvModal] = useState(null)   // { book, chapter, refDisplay }
  const { prefs, updatePrefs } = usePrefs()
  const bibleChapter = entry?.bibleChapter || null
  const parsedBibleChapter = parseBibleChapterRef(bibleChapter)
  const [bibleChapterDone, setBibleChapterDone] = useState(() =>
    bibleChapter ? !!getBibleProgress()[bibleChapter] : false
  )
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(day))

  useEffect(() => {
    if (!entry) return
    if (session) {
      async function load() {
        setLoading(true)
        const { data } = await supabase
          .from('progress')
          .select('completed, notes')
          .eq('user_id', session.user.id)
          .eq('day_number', day)
          .single()
        if (data) {
          setCompleted(!!data.completed)
          setNotes(data.notes || '')
          setSavedNotes(data.notes || '')
        } else {
          setCompleted(false); setNotes(''); setSavedNotes('')
        }
        setLoading(false)
      }
      load()
    } else {
      const local = getLocalProgress()
      const d = local[day] || {}
      setCompleted(!!d.completed)
      setNotes(d.notes || '')
      setSavedNotes(d.notes || '')
      setLoading(false)
    }
  }, [day, session])

  async function toggleComplete() {
    const newVal = !completed
    setCompleted(newVal)
    // Auto-mark the linked bible chapter when day is completed
    if (newVal && bibleChapter && !bibleChapterDone) {
      setBibleChapter(bibleChapter, true, session?.user?.id)
      setBibleChapterDone(true)
    }
    if (session) {
      await supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: day,
        completed: newVal,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' })
    } else {
      setLocalProgress(day, { completed: newVal, notes })
    }
  }

  function toggleBibleChapter() {
    const newVal = !bibleChapterDone
    setBibleChapterDone(newVal)
    if (bibleChapter) setBibleChapter(bibleChapter, newVal, session?.user?.id)
  }

  function handleBookmark(e) {
    e.stopPropagation()
    const next = toggleBookmark(day)
    setBookmarked(next)
  }

  async function saveNotes() {
    setSaving(true)
    if (session) {
      await supabase.from('progress').upsert({
        user_id: session.user.id,
        day_number: day,
        completed,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day_number' })
    } else {
      setLocalProgress(day, { completed, notes })
    }
    setSavedNotes(notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!entry) {
    return <div style={{padding:'3rem',textAlign:'center'}}>Day not found. <button onClick={()=>navigate('/')} className="btn btn-ghost">Go home</button></div>
  }

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
        <div className="spinner" />
      </div>
    )
  }

  const hasUnsaved = notes !== savedNotes

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <button onClick={()=>navigate('/')} className="btn btn-ghost" style={{gap:4}} title="Back to all days" aria-label="Back to all days">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontSize:13,color:'var(--ink-faint)'}}>Day {day} of 365</span>
            {!session && (
              <button onClick={() => navigate('/auth')} className="btn btn-outline" style={{fontSize:12, padding:'5px 12px'}}>Sign in</button>
            )}
          </div>
        </div>
      </header>

      <main style={s.main} className="fade-in">
        {/* Day header */}
        <div style={s.dayHeader}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span className={badgeClass(entry.src)}>{entry.src}</span>
            <span style={{fontSize:13,color:'var(--ink-faint)'}}>Day {day} · {entry.date}</span>
          </div>
          <h2 style={s.readingTitle}>{entry.reading}</h2>
          <p style={s.readingDetail}>{entry.detail}</p>
        </div>

        {/* Inline confession / catechism text */}
        <ContentBlock
          content={content}
          session={session}
          entry={entry}
          prefs={prefs}
          onScriptureRef={ref => setKjvModal(ref)}
          onShare={({ text }) => setShareCard({
            type: 'reading',
            day: day,
            title: entry.reading,
            subtitle: `Day ${day} · ${entry.date}`,
            source: entry.src,
            text: content?.type === 'catechism'
              ? `Q. ${content.q}\n\nA. ${content.a}`
              : (content?.text || ''),
            refs: content?.refs || '',
          })}
          onShareQuote={(q) => setShareCard({
            type: 'quote',
            day: day,
            source: entry.src,
            subtitle: `Day ${day} · ${entry.date}`,
            label: q.heading || '',
            text: q.quote,
            title: q.author,
            subtitle2: q.work,
          })}
        />

        {/* Author's note */}
        <DevNote day={day} session={session} />

        {/* Navigation (top) */}
        <div style={s.nav}>
          <div>
            {prev && (
              <button onClick={()=>navigate(`/day/${prev.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-start',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>← Previous</span>
                <span style={{fontSize:13}}>Day {prev.day} · {prev.reading}</span>
              </button>
            )}
          </div>
          <div>
            {next && (
              <button onClick={()=>navigate(`/day/${next.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-end',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>Next →</span>
                <span style={{fontSize:13}}>Day {next.day} · {next.reading}</span>
              </button>
            )}
          </div>
        </div>

        {/* Complete toggle */}
        <div className="card" style={s.completeCard} onClick={toggleComplete}>
          <div style={{...s.cb, ...(completed ? s.cbDone : {})}}>
            {completed && <CheckIcon />}
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--ink)'}}>
              {completed ? 'Completed' : 'Mark as complete'}
            </div>
            <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:1}}>
              {completed ? 'Click to undo' : 'Click when you have finished this reading'}
            </div>
          </div>
        </div>

        {/* Scripture Reading */}
        {bibleChapter && (
          <div className="card" style={s.bibleCard}>
            <div style={s.bibleCardInner}>
              <div style={s.bibleLeft}>
                <span style={s.bibleLabel}>Scripture Reading</span>
                <button
                  style={s.bibleChapterBtn}
                  onClick={() => parsedBibleChapter && setKjvModal(parsedBibleChapter)}
                  title="Read chapter in KJV"
                >
                  {bibleChapter}
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{opacity:0.6, flexShrink:0}}>
                    <path d="M2 9L9 2M9 2H5.5M9 2v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
                <span style={s.bibleHint}>Tap to read in KJV · check when done</span>
              </div>
              <button
                onClick={toggleBibleChapter}
                style={{
                  ...s.bibleCheck,
                  background: bibleChapterDone ? 'var(--teal)' : 'white',
                  borderColor: bibleChapterDone ? 'var(--teal)' : 'var(--border-strong)',
                }}
                title={bibleChapterDone ? 'Mark unread' : 'Mark as read'}
                aria-label={bibleChapterDone ? 'Mark unread' : 'Mark chapter as read'}
              >
                {bibleChapterDone && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <polyline points="2,7 5.5,11 12,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
            {bibleChapterDone && (
              <div style={s.bibleReadBadge}>✓ Chapter read</div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="card" style={s.notesCard}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <h3 style={{fontSize:15,fontFamily:"'Cormorant Garamond',serif",fontWeight:600}}>
                My notes &amp; reflections
              </h3>
              <button
                onClick={handleBookmark}
                title={bookmarked ? 'Remove bookmark' : 'Bookmark this day'}
                aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this day'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px 4px', display: 'flex', alignItems: 'center',
                  color: bookmarked ? 'var(--teal)' : 'var(--border-strong)',
                  transition: 'color 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 2.5A1.5 1.5 0 014.5 1h7A1.5 1.5 0 0113 2.5v12l-5-3-5 3V2.5z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
                    fill={bookmarked ? 'currentColor' : 'none'}
                    fillOpacity={bookmarked ? 0.18 : 0}
                  />
                </svg>
              </button>
            </div>
            {hasUnsaved && (
              <span style={{fontSize:11,color:'var(--ink-faint)'}}>Unsaved changes</span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What stood out to you? What questions arose? How does this apply to your life?"
            style={{...s.textarea}}
            rows={6}
          />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:10,gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex', gap:6}}>
              {savedNotes && (
                <CopyBtn getText={() => savedNotes} label="Copy note" />
              )}
              {savedNotes && (
                <button
                  onClick={() => setShareCard({
                    type: 'note',
                    day: day,
                    title: entry.reading,
                    subtitle: `Day ${day} · ${entry.date}`,
                    source: entry.src,
                    text: savedNotes,
                    label: 'My Reflection',
                  })}
                  style={{...cb.btn, color:'var(--purple-ink)', borderColor:'var(--purple-soft)'}}
                  title="Create share image of this note"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 5.8l5-2.8M4 7.2l5 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{fontSize:11}}>Share</span>
                </button>
              )}
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              {saved && <span style={{fontSize:12,color:'var(--teal)'}}>Saved ✓</span>}
              <button
                className="btn btn-primary"
                onClick={saveNotes}
                disabled={saving || !hasUnsaved}
                style={{opacity: (!hasUnsaved && !saving) ? 0.5 : 1}}
              >
                {saving ? <span className="spinner" style={{width:14,height:14}} /> : 'Save notes'}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={s.nav}>
          <div>
            {prev && (
              <button onClick={()=>navigate(`/day/${prev.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-start',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>← Previous</span>
                <span style={{fontSize:13}}>Day {prev.day} · {prev.reading}</span>
              </button>
            )}
          </div>
          <div>
            {next && (
              <button onClick={()=>navigate(`/day/${next.day}`)} className="btn btn-outline" style={{flexDirection:'column',alignItems:'flex-end',gap:2,padding:'10px 14px'}}>
                <span style={{fontSize:11,color:'var(--ink-faint)'}}>Next →</span>
                <span style={{fontSize:13}}>Day {next.day} · {next.reading}</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Share Card modal */}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />

      {/* KJV chapter modal */}
      {kjvModal && (
        <KjvModal
          book={kjvModal.book}
          chapter={kjvModal.chapter}
          verse={kjvModal.verse ?? null}
          refDisplay={kjvModal.refDisplay}
          onClose={() => setKjvModal(null)}
        />
      )}
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'var(--parchment)' },
  header: { borderBottom:'1px solid var(--border)', background:'var(--surface)', position:'sticky', top:0, zIndex:10 },
  headerInner: { maxWidth:680, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' },
  main: { maxWidth:680, margin:'0 auto', padding:'2.5rem 24px', display:'flex', flexDirection:'column', gap:20 },
  dayHeader: { paddingBottom:4 },
  readingTitle: { fontSize:32, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', marginBottom:6 },
  readingDetail: { fontSize:15, color:'var(--ink-muted)', lineHeight:1.6 },
  readLink: {
    display:'inline-flex', alignItems:'center', marginTop:12,
    fontSize:13, color:'var(--teal)', fontWeight:500,
    border:'1px solid var(--teal)', borderRadius:'var(--radius)',
    padding:'5px 12px', textDecoration:'none',
  },
  contentCard: { padding:'24px' },
  contentHeader: { marginBottom:16 },
  contentLabel: {
    fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)',
  },
  bodyText: {
    fontSize:16, lineHeight:1.85, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", fontWeight:400,
    margin: 0,
  },
  catWrap: { display:'flex', flexDirection:'column', gap:14 },
  catQ: {
    fontSize:16, lineHeight:1.8, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", margin:0,
  },
  catA: {
    fontSize:16, lineHeight:1.8, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", margin:0,
  },
  refsBlock: {
    marginTop:20, paddingTop:16,
    borderTop:'1px solid var(--border)',
  },
  refsLabel: {
    fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--ink-faint)', marginBottom:8,
  },
  refsText: {
    fontSize:13, color:'var(--ink-muted)', lineHeight:1.7, margin:0,
  },
  refChips: {
    display:'flex', flexWrap:'wrap', gap:6,
  },
  refChip: {
    fontSize:12, fontWeight:500, color:'var(--teal)',
    background:'var(--teal-light)', border:'1px solid transparent',
    borderRadius:99, padding:'4px 10px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.4,
    transition:'border-color 0.15s, background 0.15s',
  },
  quoteCard: {
    marginTop:20, paddingTop:20,
    borderTop:'1px solid var(--border)',
  },
  quoteHeading: {
    fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
    color:'var(--gold)', marginBottom:10,
  },
  quoteMark: {
    fontSize:52, lineHeight:1, color:'var(--gold)', opacity:0.4,
    fontFamily:"'Cormorant Garamond',serif", marginBottom:-8, display:'block',
  },
  quoteText: {
    fontSize:15, lineHeight:1.85, color:'var(--ink)',
    fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
    margin:'0 0 12px 0', paddingLeft:4,
  },
  quoteAttrib: {
    fontSize:12, color:'var(--ink-muted)', fontWeight:500,
  },
  quoteWork: {
    fontStyle:'italic', fontWeight:400,
  },
  completeCard: {
    display:'flex', alignItems:'center', gap:14, padding:'16px 20px', cursor:'pointer',
    transition:'background 0.15s',
  },
  cb: {
    width:24, height:24, borderRadius:6, border:'1.5px solid var(--border-strong)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.2s', background:'var(--surface)',
  },
  cbDone: { background:'var(--teal)', borderColor:'var(--teal)' },
  bibleCard: { padding:'16px 20px' },
  bibleCardInner: { display:'flex', alignItems:'center', gap:12 },
  bibleLeft: { flex:1, display:'flex', flexDirection:'column', gap:2 },
  bibleLabel: { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--teal)' },
  bibleChapter: { fontSize:18, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)' },
  bibleChapterBtn: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:18, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)',
    background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left',
    textDecoration:'underline', textDecorationColor:'var(--teal)', textDecorationThickness:1,
    textUnderlineOffset:3,
  },
  bibleHint: { fontSize:11, color:'var(--ink-faint)', fontFamily:"'DM Sans',sans-serif" },
  bibleCheck: {
    width:36, height:36, borderRadius:'50%', border:'2px solid',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all 0.2s',
  },
  bibleReadBadge: {
    marginTop:8, fontSize:11, color:'var(--teal)', fontWeight:600,
    fontFamily:"'DM Sans',sans-serif",
  },
  notesCard: { padding:'20px' },
  textarea: { resize:'vertical', minHeight:120, lineHeight:1.7 },
  nav: { display:'flex', justifyContent:'space-between', gap:12, marginTop:8 },
}
