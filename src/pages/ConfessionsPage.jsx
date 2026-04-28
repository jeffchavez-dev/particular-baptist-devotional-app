import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { getFontCss } from '../components/FontPrefsPanel'
import { usePrefs, useAuth } from '../App'
import CopyBtn from '../components/CopyBtn'
import { LBCF2 }              from '../data/lbcf2'
import { CATECHISM }          from '../data/catechism'
import { LBCF1 }              from '../data/lbcf1'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import { saveState, loadState, saveScroll, restoreScroll } from '../lib/pageState'
import { parseRefs } from '../lib/parseRefs'
import KjvModal from '../components/KjvModal'
import ShareCardModal from '../components/ShareCardModal'
import {
  HIGHLIGHT_COLORS, getHlStyle,
  loadHighlights, loadItemNotes,
  setHighlight, setItemNote,
  addSearchHistory, getSearchHistory, clearSearchHistory, removeSearchEntry,
} from '../lib/annotations'

/* ── 2LBCF chapter titles ── */
const CHAPTER_TITLES = {
  0: 'Preface',
  1: 'Of the Holy Scriptures',
  2: 'Of God and of the Holy Trinity',
  3: "Of God's Decree",
  4: 'Of Creation',
  5: 'Of Divine Providence',
  6: 'Of the Fall of Man, Of Sin, and of the Punishment Thereof',
  7: "Of God's Covenant",
  8: 'Of Christ the Mediator',
  9: 'Of Free Will',
  10: 'Of Effectual Calling',
  11: 'Of Justification',
  12: 'Of Adoption',
  13: 'Of Sanctification',
  14: 'Of Saving Faith',
  15: 'Of Repentance unto Life and Salvation',
  16: 'Of Good Works',
  17: 'Of the Perseverance of the Saints',
  18: 'Of the Assurance of Grace and Salvation',
  19: 'Of the Law of God',
  20: 'Of the Gospel and of the Extent of the Grace Thereof',
  21: 'Of Christian Liberty and Liberty of Conscience',
  22: 'Of Religious Worship and the Sabbath Day',
  23: 'Of Lawful Oaths and Vows',
  24: 'Of the Civil Magistrate',
  25: 'Of Marriage',
  26: 'Of the Church',
  27: 'Of the Communion of Saints',
  28: 'Of Baptism and the Lord\'s Supper',
  29: 'Of Baptism',
  30: "Of the Lord's Supper",
  31: 'Of the State of Man After Death and of the Resurrection of the Dead',
  32: 'Of the Last Judgment',
}

function buildChapters() {
  const chapters = {}
  Object.entries(LBCF2).forEach(([key, item]) => {
    const parts = key.split('.')
    const ch  = parseInt(parts[0])
    const para = parseInt(parts[1])
    if (!chapters[ch]) chapters[ch] = []
    chapters[ch].push({ key, para, text: item.text, refs: item.refs })
  })
  Object.keys(chapters).forEach(ch => chapters[ch].sort((a, b) => a.para - b.para))
  return chapters
}

const LBCF2_CHAPTERS = buildChapters()

function cleanRefs(refs) {
  if (!refs) return ''
  return refs.replace(/\b[a-z](?=[A-Z1-9])/g, '').replace(/\s+/g, ' ').trim()
}

function makeSearchable(text) {
  if (!text) return ''
  return text
    .replace(/(\w)-\s+/g, '$1')
    .replace(/\b[a-z](?=[A-Z])/g, '')
    .replace(/\b([a-z])([a-z]{3,})\b/g, (_, _m, word) => word)
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildSearchIndex() {
  const idx = { lbcf2: {}, catechism: {}, lbcf1: {}, orthodox: {} }
  Object.entries(LBCF2).forEach(([key, item]) => {
    idx.lbcf2[key] = makeSearchable((item.text || '') + ' ' + (item.refs || ''))
  })
  Object.entries(CATECHISM).forEach(([num, item]) => {
    idx.catechism[num] = makeSearchable((item.q || '') + ' ' + (item.a || '') + ' ' + (item.refs || ''))
  })
  Object.entries(LBCF1).forEach(([num, item]) => {
    idx.lbcf1[num] = makeSearchable((item.title || '') + ' ' + (item.text || '') + ' ' + (item.refs || ''))
  })
  Object.entries(ORTHODOX_CATECHISM).forEach(([num, item]) => {
    idx.orthodox[num] = makeSearchable((item.q || '') + ' ' + (item.a || '') + ' ' + (item.refs || ''))
  })
  return idx
}

const SEARCH_IDX = buildSearchIndex()

function textMatches(rawText, rawRefs, normIndexed, q) {
  if (!q) return true
  const raw = ((rawText || '') + ' ' + (rawRefs || '')).toLowerCase()
  return raw.includes(q) || normIndexed.includes(q)
}

function highlight(text, q) {
  if (!q || !text) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'))
    if (parts.length === 1) return text
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{background:'#fef08a',color:'inherit',borderRadius:2,padding:'0 1px'}}>{p}</mark>
        : p
    )
  } catch { return text }
}

const SOURCES = {
  '2lbcf':     { label: '2LBCF',     name: 'Second London Baptist Confession (1677/1689)', color: 'var(--purple-ink)', bg: 'var(--purple-soft)', href: 'https://www.the1689confession.com/' },
  'catechism': { label: 'Catechism', name: "Keach's Baptist Catechism (1693)",            color: 'var(--teal)',       bg: 'var(--teal-light)',  href: 'https://baptistcatechism.org/' },
  '1lbcf':     { label: '1LBCF',     name: 'First London Baptist Confession (1644)',       color: 'var(--amber-ink)', bg: 'var(--amber-soft)',  href: 'https://london1644.info/en/fulltext.html' },
  'orthodox':  { label: 'Orthodox',  name: 'An Orthodox Catechism (1680)',                 color: 'var(--sky)',       bg: 'var(--sky-light)',  href: 'https://1689.com/an-orthodox-catechism/' },
}

/* ── Clickable scripture-proof chips ── */
function RefChips({ refs, onOpen }) {
  const parsed = parseRefs(refs)
  if (!parsed.length) return <span style={{ fontSize:13, color:'var(--ink-muted)' }}>{refs}</span>
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:2 }}>
      {parsed.map(({ book, chapter, verse, display }) => (
        <button
          key={`${book}|${chapter}|${verse ?? 0}`}
          style={rc.chip}
          onClick={() => onOpen({ book, chapter, verse: verse ?? null, refDisplay: display })}
        >
          {display}
        </button>
      ))}
    </div>
  )
}
const rc = {
  chip: {
    fontSize:11, fontWeight:500, color:'var(--teal)',
    background:'var(--teal-light)', border:'1px solid transparent',
    borderRadius:99, padding:'3px 9px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", lineHeight:1.4,
  },
}

/* ── Highlight colour picker ── */
function ConfColorPicker({ currentColor, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  return (
    <div ref={ref} style={cp.wrap}>
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c.id}
          title={c.label}
          onClick={() => { onSelect(currentColor === c.id ? null : c.id); onClose() }}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: c.dot, border: 'none', cursor: 'pointer', padding: 0,
            outline: currentColor === c.id ? `3px solid ${c.border}` : '2px solid transparent',
            outlineOffset: 1,
            transform: currentColor === c.id ? 'scale(1.2)' : 'scale(1)',
            transition: 'outline 0.1s, transform 0.1s',
          }}
        />
      ))}
      {currentColor && (
        <button
          title="Remove highlight"
          onClick={() => { onSelect(null); onClose() }}
          style={{
            width:22, height:22, borderRadius:'50%', background:'var(--border-strong)',
            border:'none', cursor:'pointer', fontSize:13, color:'var(--ink-muted)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0,
          }}
        >×</button>
      )}
    </div>
  )
}
const cp = {
  wrap: {
    display:'inline-flex', alignItems:'center', gap:5,
    padding:'5px 8px', background:'var(--surface)',
    border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
    boxShadow:'0 2px 12px rgba(0,0,0,0.12)', marginTop:4,
  },
}

/* ── Search history dropdown ── */
function SearchHistDrop({ history, onSelect, onRemove, onClear, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])
  if (!history.length) return null
  return (
    <div ref={ref} style={sh.drop}>
      <div style={sh.header}>
        <span style={sh.title}>Recent searches</span>
        <button style={sh.clearAll} onClick={() => { onClear(); onClose() }}>Clear all</button>
      </div>
      {history.map(q => (
        <div key={q} style={sh.row}>
          <button style={sh.item} onClick={() => { onSelect(q); onClose() }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{flexShrink:0,opacity:0.4}}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5.5 3v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={sh.itemText}>{q}</span>
          </button>
          <button style={sh.rm} onClick={() => onRemove(q)}>×</button>
        </div>
      ))}
    </div>
  )
}
const sh = {
  drop: {
    position:'absolute', top:'100%', left:0, right:0, zIndex:30,
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
    overflow:'hidden', marginTop:2, fontFamily:"'DM Sans',sans-serif",
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'7px 12px', borderBottom:'1px solid var(--border)',
  },
  title: { fontSize:10, fontWeight:700, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.06em' },
  clearAll: { fontSize:11, fontWeight:600, color:'var(--teal)', background:'none', border:'none', cursor:'pointer', padding:0 },
  row: { display:'flex', alignItems:'center' },
  item: { display:'flex', alignItems:'center', gap:8, flex:1, padding:'8px 12px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif" },
  itemText: { fontSize:13, color:'var(--ink)', flex:1 },
  rm: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:16, padding:'0 12px', flexShrink:0 },
}

/* ── Per-item annotation toolbar ── */
function ItemActions({
  itemKey, label, copyText, shareTitle, shareSource,
  onOpenKjv, refs,
  highlights, itemNotes, onHighlight, onNote, onShare,
  isActive,
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [draft, setDraft] = useState('')
  const currentColor = highlights[itemKey] || null
  const note = itemNotes[itemKey] || null
  const hlStyle = currentColor ? getHlStyle(currentColor) : null

  function openNote() {
    setDraft(note || '')
    setEditingNote(true)
  }

  function saveNote() {
    onNote(itemKey, draft)
    setEditingNote(false)
  }

  function deleteNote() {
    onNote(itemKey, '')
    setEditingNote(false)
  }

  function handleShare() {
    onShare({
      type: 'reading',
      title: shareTitle,
      subtitle: label,
      source: shareSource,
      text: copyText,
      label: '',
    })
  }

  function handleShareNote() {
    onShare({
      type: 'reading',
      title: shareTitle,
      subtitle: label,
      source: shareSource,
      text: `${copyText.slice(0, 300)}${copyText.length > 300 ? '…' : ''}\n\n— My note:\n${note}`,
      label: '',
    })
  }

  return (
    <div>
      {/* Highlight tint bar */}
      {currentColor && (
        <div style={{
          height: 3, borderRadius: 99, marginBottom: 6,
          background: hlStyle.dot, opacity: 0.5,
        }} />
      )}

      {/* Action row — only shown when this item is tapped/active */}
      {isActive && <div style={ia.row}>
        {/* Highlight button */}
        <div style={{position:'relative'}}>
          <button
            style={{
              ...ia.btn,
              ...(currentColor ? { color: hlStyle.numClr, background: hlStyle.numBg, borderColor: hlStyle.border } : {}),
            }}
            onClick={() => setShowPicker(p => !p)}
            title="Highlight"
          >
            {/* Highlighter icon */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10l1.5-3L9.5 1l1.5 1.5L5 8.5 2 10Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M7 3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          {showPicker && (
            <ConfColorPicker
              currentColor={currentColor}
              onSelect={colorId => onHighlight(itemKey, colorId)}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>

        {/* Note button */}
        <button
          style={{
            ...ia.btn,
            ...(note ? { color:'rgba(150,110,0,0.9)', borderColor:'rgba(200,150,0,0.35)', background:'rgba(210,160,0,0.14)' } : {}),
          }}
          onClick={openNote}
          title={note ? 'View note' : 'Add note'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 10.5L2 8.5 8 2.5l2 2-6 6-2.5.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            <line x1="7" y1="3" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>

        {/* Share button */}
        <button style={ia.btn} onClick={handleShare} title="Share">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="9.5" cy="2" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
            <circle cx="9.5" cy="10" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
            <circle cx="2.5" cy="6" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M3.8 5.3l4.2-2.8M3.8 6.7l4.2 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Copy button */}
        <CopyBtn getText={() => copyText} label="" />
      </div>}

      {/* Saved note display */}
      {note && !editingNote && (
        <div style={ia.noteDisplay} onClick={openNote}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{flexShrink:0,marginTop:2,opacity:0.5}}>
            <path d="M1 9l.5-2L6 2.5l2 2L3.5 9 1 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <span style={{flex:1}}>{note}</span>
          <button
            onClick={e => { e.stopPropagation(); handleShareNote() }}
            style={ia.noteShareBtn}
            title="Share note"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="8.5" cy="2" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="8.5" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="2.5" cy="5.5" r="1.3" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M3.8 4.9l3.5-2.4M3.8 6.1l3.5 2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Inline note editor */}
      {editingNote && (
        <div style={ia.noteEditor}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`Note on ${shareTitle}…`}
            style={ia.textarea}
            autoFocus
            rows={3}
          />
          <div style={ia.editorActions}>
            <button onClick={saveNote} style={ia.saveBtn}>Save</button>
            <button onClick={() => setEditingNote(false)} style={ia.cancelBtn}>Cancel</button>
            {note && <button onClick={deleteNote} style={ia.deleteBtn}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  )
}

const ia = {
  row: { display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginTop:6 },
  btn: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontSize:11, fontWeight:500, color:'var(--ink-muted)',
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:99, padding:'6px 8px', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'all 0.12s',
  },
  noteDisplay: {
    display:'flex', gap:6, alignItems:'flex-start',
    marginTop:6, padding:'6px 10px',
    background:'rgba(210,160,0,0.08)',
    borderLeft:'2px solid rgba(200,150,0,0.35)',
    borderRadius:'0 4px 4px 0',
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.6,
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  noteShareBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    padding:'2px 4px', borderRadius:4, flexShrink:0,
  },
  noteEditor: { marginTop:8, display:'flex', flexDirection:'column', gap:6 },
  textarea: {
    width:'100%', padding:'8px 10px',
    border:'1.5px solid var(--teal)', borderRadius:'var(--radius)',
    fontSize:13, color:'var(--ink)', lineHeight:1.6,
    fontFamily:"'DM Sans',sans-serif", background:'var(--surface)',
    resize:'vertical', outline:'none', boxSizing:'border-box',
  },
  editorActions: { display:'flex', gap:6, alignItems:'center' },
  saveBtn: {
    fontSize:11, fontWeight:700, padding:'5px 12px',
    background:'var(--teal)', color:'white', border:'none',
    borderRadius:'var(--radius)', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  cancelBtn: {
    fontSize:11, padding:'5px 10px', background:'none', color:'var(--ink-muted)',
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
  },
  deleteBtn: {
    fontSize:11, padding:'5px 10px', background:'none', color:'#b33',
    border:'1px solid rgba(180,50,50,0.3)', borderRadius:'var(--radius)',
    cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginLeft:'auto',
  },
}

/* ══════════════════════════════════════════════════════════════ */
export default function ConfessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { state: locationState } = useLocation()
  const { prefs, updatePrefs } = usePrefs()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const _saved = loadState('conf', { tab: '2lbcf', search: '' })
  const tab    = searchParams.get('t') || _saved.tab

  const [activeChapter, setActiveChapter] = useState(null)
  const [search,        setSearch]        = useState(_saved.search)
  const [navOpen,       setNavOpen]       = useState(false)
  const [kjvModal,      setKjvModal]      = useState(null)
  const [shareCard,     setShareCard]     = useState(null)
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768)
  const [sidebarConf,   setSidebarConf]   = useState(tab)
  const pendingScrollRef = useRef(null)
  const contentRef = useRef(null)
  const searchWrapRef = useRef(null)

  /* Deep-link from Settings: scroll to specific paragraph/Q&A/article */
  const deepLinkRef = useRef(
    locationState?.itemKey && locationState?.source ? locationState : null
  )

  /* Search history */
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory('conf'))
  const [showHistDrop,  setShowHistDrop]  = useState(false)

  /* Annotations — plain state, always written by reading fresh from localStorage */
  const [hlData,   setHlData]   = useState(() => loadHighlights())
  const [noteData, setNoteData] = useState(() => loadItemNotes())

  const [activeItemKey, setActiveItemKey] = useState(null) // tap-to-show actions

  const handleHighlight = useCallback((key, colorId) => {
    setHighlight(key, colorId, userId)
    setHlData(loadHighlights())
  }, [userId])

  const handleNote = useCallback((key, text) => {
    setItemNote(key, text, userId)
    setNoteData(loadItemNotes())
  }, [userId])

  /* Refresh annotations when a cross-device sync completes */
  useEffect(() => {
    function onSync() {
      setHlData(loadHighlights())
      setNoteData(loadItemNotes())
    }
    
    function onHighlightChanged(evt) {
      setHlData(evt.detail.highlights)
    }
    
    function onNoteChanged(evt) {
      setNoteData(evt.detail.notes)
    }
    
    window.addEventListener('pb-annotations-updated', onSync)
    window.addEventListener('pb-highlight-changed', onHighlightChanged)
    window.addEventListener('pb-note-changed', onNoteChanged)
    return () => {
      window.removeEventListener('pb-annotations-updated', onSync)
      window.removeEventListener('pb-highlight-changed', onHighlightChanged)
      window.removeEventListener('pb-note-changed', onNoteChanged)
    }
  }, [])

  useEffect(() => { saveState('conf', { tab, search }) }, [tab, search])
  useEffect(() => {
    restoreScroll('conf')
    return () => saveScroll('conf')
  }, [])

  /* Deep-link scroll: fires once after the tab content renders */
  useEffect(() => {
    if (!deepLinkRef.current) return
    const { itemKey, source } = deepLinkRef.current
    deepLinkRef.current = null
    let domId
    if (source === '2lbcf')     domId = `p-${itemKey}`
    else if (source === 'catechism') domId = `qa-${itemKey}`
    else if (source === '1lbcf')    domId = `art-${itemKey}`
    if (!domId) return
    const timer = setTimeout(() => {
      const el = document.getElementById(domId)
      if (el) {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
        /* Highlight the chapter in the sidebar nav */
        if (source === '2lbcf') setActiveChapter(`ch-${itemKey.split('.')[0]}`)
        else if (source === '1lbcf') setActiveChapter(`art-${itemKey}`)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [tab]) // re-fire if tab changes (URL param arrives after mount)

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setNavOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!pendingScrollRef.current) return
    const id = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
          setActiveChapter(id)
        }
      }, 60)
    })
  }, [tab])

  const src = SOURCES[tab] || SOURCES['2lbcf']
  const sidebarSrc = SOURCES[sidebarConf] || SOURCES['2lbcf']
  const textStyle = { fontSize: prefs.sizePx, fontFamily: getFontCss(prefs.fontId) }

  function setTab(t) {
    setSearchParams({ t })
    setActiveChapter(null)
    setSearch('')
    setNavOpen(false)
  }

  function scrollToChapter(id) {
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
    }
    setActiveChapter(id)
    if (isMobile) setNavOpen(false)
  }

  function handleChapterClick(chId) {
    if (sidebarConf !== tab) {
      pendingScrollRef.current = chId
      setTab(sidebarConf)
    } else {
      scrollToChapter(chId)
      if (isMobile) setNavOpen(false)
    }
  }

  /* Search submission */
  function submitSearch(q) {
    const trimmed = q.trim()
    setSearch(trimmed)
    if (trimmed) {
      addSearchHistory('conf', trimmed)
      setSearchHistory(getSearchHistory('conf'))
    }
    setShowHistDrop(false)
  }

  /* Chapter nav for sidebar */
  const chapterNav = useMemo(() => {
    if (sidebarConf === '2lbcf') {
      return Object.keys(LBCF2_CHAPTERS).map(ch => ({
        id: `ch-${ch}`, label: ch === '0' ? 'Preface' : `Ch. ${ch}`, title: CHAPTER_TITLES[parseInt(ch)],
      }))
    }
    if (sidebarConf === '1lbcf') {
      return Object.entries(LBCF1).map(([num, item]) => ({
        id: `art-${num}`, label: `Art. ${num}`, title: item.title,
      }))
    }
    return []
  }, [sidebarConf])

  const q = search.toLowerCase().trim()

  const resultCounts = useMemo(() => {
    if (!q) return null
    let lbcf2Count = 0, catCount = 0, lbcf1Count = 0, orthodoxCount = 0
    Object.entries(LBCF2_CHAPTERS).forEach(([chNum, paras]) => {
      const chTitle = (CHAPTER_TITLES[parseInt(chNum)] || '').toLowerCase()
      const chMatch = chTitle.includes(q)
      paras.forEach(p => {
        if (chMatch || textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)) lbcf2Count++
      })
    })
    Object.entries(CATECHISM).forEach(([num, item]) => {
      if (textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.catechism[num] || '', q)) catCount++
    })
    Object.entries(LBCF1).forEach(([num, item]) => {
      if (textMatches(item.title + ' ' + item.text, item.refs, SEARCH_IDX.lbcf1[num] || '', q)) lbcf1Count++
    })
    Object.entries(ORTHODOX_CATECHISM).forEach(([num, item]) => {
      if (textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.orthodox[num] || '', q)) orthodoxCount++
    })
    return { lbcf2: lbcf2Count, catechism: catCount, lbcf1: lbcf1Count, orthodox: orthodoxCount }
  }, [q])

  /* ── Sidebar content ── */
  const SidebarContent = (
    <div style={s.sidebarContent}>
      <div style={s.confSelector}>
        <div style={s.confSelectorLabel}>Browse</div>
        {Object.entries(SOURCES).map(([key, info]) => (
          <button
            key={key}
            style={{
              ...s.confSelectorBtn,
              ...(sidebarConf === key ? {
                background: info.bg, color: info.color,
                borderColor: info.color, fontWeight: 700,
              } : {}),
            }}
            onClick={() => {
              setSidebarConf(key)
              if (key === 'catechism' || key === 'orthodox') setTab(key)
            }}
          >
            <span style={{...s.confBadgeDot, background: sidebarConf === key ? info.color : 'var(--border-strong)'}} />
            <span style={{flex:1, textAlign:'left'}}>{info.label}</span>
            <span style={{fontSize:10, opacity:0.6, fontWeight:400}}>
              {key === '2lbcf' ? '1689' : key === 'catechism' ? '1693' : '1644'}
            </span>
          </button>
        ))}
        {sidebarConf !== tab && sidebarConf !== 'catechism' && (
          <p style={{fontSize:10, color:'var(--ink-faint)', margin:'6px 4px 0', lineHeight:1.5}}>
            Select a chapter below to open it
          </p>
        )}
      </div>

      {chapterNav.length > 0 && (
        <>
          <div style={s.sidebarDivider} />
          <div style={s.chapterListLabel}>Chapters</div>
          <div style={s.chapterList}>
            {chapterNav.map(ch => (
              <button
                key={ch.id}
                style={{
                  ...s.chapBtn,
                  ...(activeChapter === ch.id && sidebarConf === tab ? s.chapBtnActive : {}),
                }}
                onClick={() => handleChapterClick(ch.id)}
                title={ch.title}
              >
                <span style={{...s.chapLabel, color: sidebarSrc.color}}>{ch.label}</span>
                <span style={s.chapTitle}>{ch.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div style={s.page}>

      {/* ── Sticky header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          {isMobile && (
            <button
              onClick={() => setNavOpen(o => !o)}
              className="btn btn-ghost"
              style={{gap:5, fontSize:12, padding:'5px 10px', flexShrink:0}}
              aria-label="Open navigation"
              title="Navigation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2.5" width="14" height="1.5" rx=".75" fill="currentColor"/>
                <rect x="1" y="7"   width="9"  height="1.5" rx=".75" fill="currentColor"/>
                <rect x="1" y="11.5" width="11" height="1.5" rx=".75" fill="currentColor"/>
              </svg>
            </button>
          )}

          {!isMobile && (
            <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={s.srcName}>{src.name}</span>
            </div>
          )}

          {/* Search with history */}
          <div style={{...s.searchBox, position:'relative'}} ref={searchWrapRef}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              style={s.searchInput}
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setShowHistDrop(!e.target.value && searchHistory.length > 0)
              }}
              onFocus={() => { if (!search && searchHistory.length) setShowHistDrop(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter') submitSearch(search)
                if (e.key === 'Escape') { setSearch(''); setShowHistDrop(false) }
              }}
              placeholder="Search…"
            />
            {search && (
              <button onClick={() => { setSearch(''); setShowHistDrop(false) }} style={s.clearBtn}>×</button>
            )}
            {showHistDrop && searchHistory.length > 0 && (
              <SearchHistDrop
                history={searchHistory}
                onSelect={q => { setSearch(q); setShowHistDrop(false) }}
                onRemove={q => {
                  removeSearchEntry('conf', q)
                  setSearchHistory(getSearchHistory('conf'))
                }}
                onClear={() => {
                  clearSearchHistory('conf')
                  setSearchHistory([])
                  setShowHistDrop(false)
                }}
                onClose={() => setShowHistDrop(false)}
              />
            )}
          </div>

        </div>
      </header>

      {isMobile && navOpen && (
        <div style={s.backdrop} onClick={() => setNavOpen(false)} />
      )}

      <div style={s.layout}>

        {!isMobile && (
          <aside style={s.desktopSidebar}>
            {SidebarContent}
          </aside>
        )}

        {isMobile && (
          <aside style={{
            ...s.mobileSidebar,
            transform: navOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}>
            <div style={s.mobileNavHeader}>
              <span style={{fontSize:13, fontWeight:600, color:'var(--ink)'}}>Navigate</span>
              <button onClick={() => setNavOpen(false)} style={s.mobileNavClose}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {SidebarContent}
          </aside>
        )}

        {/* ── Main content ── */}
        <main style={s.main} ref={contentRef}>

          {q && resultCounts && (() => {
            const count = resultCounts[tab === '2lbcf' ? 'lbcf2' : tab === 'catechism' ? 'catechism' : 'lbcf1']
            if (count === 0) return (
              <div style={s.empty}>No results for "{search}"
                {searchHistory.length > 0 && (
                  <div style={{marginTop:10, fontSize:12, color:'var(--teal)'}}>
                    Recent: {searchHistory.slice(0,3).map((q, i) => (
                      <button key={q} onClick={() => setSearch(q)} style={{background:'none',border:'none',color:'var(--teal)',cursor:'pointer',textDecoration:'underline',fontSize:12,marginLeft:i>0?8:0}}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
            return (
              <div style={s.resultBanner}>
                {count} {tab === 'catechism' ? 'Q&A' : 'section'}{count !== 1 ? 's' : ''} matched "{search}"
              </div>
            )
          })()}

          {isMobile && (
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:'1rem', flexWrap:'wrap'}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={{fontSize:12, color:'var(--ink-muted)', flex:1, fontFamily:"'Cormorant Garamond',serif"}}>{src.name}</span>
            </div>
          )}

          {/* ── 2LBCF ── */}
          {tab === '2lbcf' && (
            <div>
              {Object.entries(LBCF2_CHAPTERS).map(([chNum, paras]) => {
                const chTitle = CHAPTER_TITLES[parseInt(chNum)] || ''
                const chId    = `ch-${chNum}`
                const chTitleMatches = q && chTitle.toLowerCase().includes(q)

                if (q) {
                  const hasMatch = chTitleMatches || paras.some(p =>
                    textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)
                  )
                  if (!hasMatch) return null
                }
                return (
                  <section key={chNum} id={chId} style={s.chapter}>
                    <div style={s.chapterHeader}>
                      {chNum !== '0' && <span style={s.chapterNum}>Chapter {chNum}</span>}
                      <h2 style={s.chapterTitle}}>{chNum === '0' ? 'Preface' : chTitle}</h2>
                    </div>
                    {paras.map(p => {
                      const paraMatches = !q || chTitleMatches ||
                        textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)
                      if (!paraMatches) return null
                      const itemKey = `conf|2lbcf|${p.key}`
                      const hlColor = hlData[itemKey] || null
                      const hlStyle = hlColor ? getHlStyle(hlColor) : null
                      return (
                        <div
                          key={p.key}
                          style={{
                            ...s.paragraph,
                            ...(hlColor ? { background: hlStyle.rowBg, borderLeft: `3px solid ${hlStyle.border}`, marginLeft:-8, paddingLeft:8, borderRadius:6 } : {}),
                            cursor:'pointer',
                          }}
                          id={`p-${p.key}`}
                          onClick={() => setActiveItemKey(prev => prev === itemKey ? null : itemKey)}
                        >
                          <div style={s.paraNum}>§{p.para}</div>
                          <div style={s.paraBody}>
                            <p style={{...s.paraText, ...textStyle}}>{highlight(p.text, q)}</p>
                            <div onClick={e => e.stopPropagation()}>
                              {p.refs && (
                                <div style={s.refs}>
                                  <span style={s.refsLabel}>Proof texts: </span>
                                  <RefChips refs={p.refs} onOpen={setKjvModal} />
                                </div>
                              )}
                              <ItemActions
                                itemKey={itemKey}
                                label="2LBCF"
                                copyText={p.text + (p.refs ? '\n\nScripture proofs: ' + cleanRefs(p.refs) : '')}
                                shareTitle={`2LBCF ${p.key}`}
                                shareSource="2LBCF"
                                highlights={hlData}
                                itemNotes={noteData}
                                onHighlight={handleHighlight}
                                onNote={handleNote}
                                onShare={setShareCard}
                                isActive={activeItemKey === itemKey}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}

          {/* ── Catechism ── */}
          {tab === 'catechism' && (
            <div style={s.catechismList}>
              {Object.entries(CATECHISM).map(([num, item]) => {
                if (q && !textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.catechism[num] || '', q)) return null
                const itemKey = `conf|catechism|${num}`
                const hlColor = hlData[itemKey] || null
                const hlStyle = hlColor ? getHlStyle(hlColor) : null
                return (
                  <div
                    key={num}
                    style={{
                      ...s.qaBlock,
                      ...(hlColor ? { background: hlStyle.rowBg, borderLeft: `3px solid ${hlStyle.border}`, marginLeft:-8, paddingLeft:8, borderRadius:6 } : {}),
                      cursor:'pointer',
                    }}
                    id={`qa-${num}`}
                    onClick={() => setActiveItemKey(prev => prev === itemKey ? null : itemKey)}
                  >
                    <div style={s.qaNum}>Q.{num}</div>
                    <div style={s.qaBody}>
                      <p style={{...s.qaQuestion, ...textStyle}}>{highlight(item.q, q)}</p>
                      <p style={{...s.qaAnswer, ...textStyle}}><strong style={{fontWeight:600}}>A.</strong> {highlight(item.a, q)}</p>
                      <div onClick={e => e.stopPropagation()}>
                        {item.refs && (
                          <div style={s.refs}>
                            <span style={s.refsLabel}>Proof texts: </span>
                            <RefChips refs={item.refs} onOpen={setKjvModal} />
                          </div>
                        )}
                        <ItemActions
                          itemKey={itemKey}
                          label="Catechism"
                          copyText={`Q. ${item.q}\n\nA. ${item.a}` + (item.refs ? '\n\nScripture proofs: ' + cleanRefs(item.refs) : '')}
                          shareTitle={`Catechism Q.${num}`}
                          shareSource="Catechism"
                          highlights={hlData}
                          itemNotes={noteData}
                          onHighlight={handleHighlight}
                          onNote={handleNote}
                          onShare={setShareCard}
                          isActive={activeItemKey === itemKey}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 1LBCF ── */}
          {tab === '1lbcf' && (
            <div>
              {Object.entries(LBCF1).map(([num, item]) => {
                const artId = `art-${num}`
                if (q && !textMatches(item.title + ' ' + item.text, item.refs, SEARCH_IDX.lbcf1[num] || '', q)) return null
                const lines = item.text.split('\n').filter(l => l.trim())
                const itemKey = `conf|1lbcf|${num}`
                const hlColor = hlData[itemKey] || null
                const hlStyle = hlColor ? getHlStyle(hlColor) : null
                return (
                  <section
                    key={num}
                    id={artId}
                    style={{
                      ...s.article,
                      ...(hlColor ? { background: hlStyle.rowBg, borderLeft: `3px solid ${hlStyle.border}`, marginLeft:-8, paddingLeft:8, borderRadius:6 } : {}),
                      cursor:'pointer',
                    }}
                    onClick={() => setActiveItemKey(prev => prev === itemKey ? null : itemKey)}
                  >
                    <div style={{...s.articleHeader, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                      <div>
                        <span style={s.articleNum}>Article {num}</span>
                        <h2 style={s.articleTitle}>{item.title}</h2>
                      </div>
                    </div>
                    <div style={s.articleBody}>
                      {lines.map((line, i) => {
                        const clean = line.replace(/^\d+\s+/, '').trim()
                        if (!clean) return null
                        return <p key={i} style={{...s.articleLine, ...textStyle}}>{highlight(clean, q)}</p>
                      })}
                      <div onClick={e => e.stopPropagation()}>
                        {item.refs && (
                          <div style={s.refs}>
                            <span style={s.refsLabel}>Proof texts: </span>
                            <RefChips refs={item.refs} onOpen={setKjvModal} />
                          </div>
                        )}
                        <ItemActions
                          itemKey={itemKey}
                          label="1LBCF"
                          copyText={`${item.title}\n\n${item.text}` + (item.refs ? '\n\nScripture proofs: ' + cleanRefs(item.refs) : '')}
                          shareTitle={`1LBCF Art. ${num}`}
                          shareSource="1LBCF"
                          highlights={hlData}
                          itemNotes={noteData}
                          onHighlight={handleHighlight}
                          onNote={handleNote}
                          onShare={setShareCard}
                          isActive={activeItemKey === itemKey}
                        />
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* ── Orthodox Catechism ── */}
          {tab === 'orthodox' && (
            <div style={s.catechismList}>
              {Object.entries(ORTHODOX_CATECHISM).map(([num, item]) => {
                if (q && !textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.orthodox?.[num] || '', q)) return null
                const itemKey = `conf|orthodox|${num}`
                const hlColor = hlData[itemKey] || null
                const hlStyle = hlColor ? getHlStyle(hlColor) : null
                return (
                  <div
                    key={num}
                    style={{
                      ...s.qaBlock,
                      ...(hlColor ? { background: hlStyle.rowBg, borderLeft: `3px solid ${hlStyle.border}`, marginLeft:-8, paddingLeft:8, borderRadius:6 } : {}),
                      cursor:'pointer',
                    }}
                    id={`qa-${num}`}
                    onClick={() => setActiveItemKey(prev => prev === itemKey ? null : itemKey)}
                  >
                    <div style={s.qaNum}>Q.{num}</div>
                    <div style={s.qaBody}>
                      <p style={{...s.qaQuestion, ...textStyle}}>{highlight(item.q, q)}</p>
                      <p style={{...s.qaAnswer, ...textStyle}}><strong style={{fontWeight:600}}>A.</strong> {highlight(item.a, q)}</p>
                      <div onClick={e => e.stopPropagation()}>
                        {item.refs && (
                          <div style={s.refs}>
                            <span style={s.refsLabel}>Proof texts: </span>
                            <RefChips refs={item.refs} onOpen={setKjvModal} />
                          </div>
                        )}
                        <ItemActions
                          itemKey={itemKey}
                          label="Orthodox Catechism"
                          copyText={`Q. ${item.q}\n\nA. ${item.a}` + (item.refs ? '\n\nScripture proofs: ' + cleanRefs(item.refs) : '')}
                          shareTitle={`Orthodox Catechism Q.${num}`}
                          shareSource="Orthodox"
                          highlights={hlData}
                          itemNotes={noteData}
                          onHighlight={handleHighlight}
                          onNote={handleNote}
                          onShare={setShareCard}
                          isActive={activeItemKey === itemKey}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </main>
      </div>

      {/* KJV scripture modal */}
      {kjvModal && (
        <KjvModal
          book={kjvModal.book}
          chapter={kjvModal.chapter}
          verse={kjvModal.verse ?? null}
          refDisplay={kjvModal.refDisplay}
          onClose={() => setKjvModal(null)}
        />
      )}

      {/* Share card modal */}
      <ShareCardModal
        isOpen={shareCard !== null}
        onClose={() => setShareCard(null)}
        card={shareCard}
      />
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight:'100vh', background:'var(--parchment)', fontFamily:"'DM Sans',sans-serif", paddingBottom:'env(safe-area-inset-bottom)' },

  header: {
    position:'sticky', top:0, zIndex:30,
    background:'var(--surface)', borderBottom:'1px solid var(--border)',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerInner: {
    maxWidth:1200, margin:'0 auto',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'8px 16px', gap:10,
  },

  srcBadge: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:'0.05em', flexShrink:0 },
  srcName:  { fontSize:13, color:'var(--ink)', fontFamily:"'Cormorant Garamond',serif", fontWeight:600, flex:1, minWidth:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' },

  searchBox: {
    display:'flex', alignItems:'center', gap:6,
    border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
    padding:'0 10px', background:'var(--surface)', minWidth:140, maxWidth:240, flex:1,
  },
  searchInput: {
    border:'none', background:'transparent', outline:'none',
    fontSize:13, color:'var(--ink)', padding:'7px 0',
    fontFamily:"'DM Sans',sans-serif", width:'100%',
  },
  clearBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px',
  },

  layout: { display:'flex', maxWidth:1200, margin:'0 auto' },

  desktopSidebar: {
    width:240, flexShrink:0,
    position:'sticky', top:53, alignSelf:'flex-start',
    height:'calc(100vh - 53px)', overflowY:'auto',
    borderRight:'1px solid var(--border)',
    background:'var(--surface)',
  },

  sidebarContent: { padding:'12px 8px 24px' },

  confSelector: { marginBottom:4 },
  confSelectorLabel: {
    fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
    color:'var(--ink-faint)', padding:'0 8px', marginBottom:4,
  },
  confSelectorBtn: {
    display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left',
    padding:'8px 10px', marginBottom:3, background:'none', border:'1.5px solid transparent',
    borderRadius:'var(--radius)', cursor:'pointer', fontSize:13, fontWeight:600,
    color:'var(--ink)', fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s',
  },
  confBadgeDot: { width:8, height:8, borderRadius:'50%', flexShrink:0, transition:'background 0.15s' },

  sidebarDivider: { height:1, background:'var(--border)', margin:'10px 4px' },

  chapterListLabel: {
    fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
    color:'var(--ink-faint)', padding:'0 8px', marginBottom:4,
  },
  chapterList: { display:'flex', flexDirection:'column', gap:1 },
  chapBtn: {
    display:'flex', flexDirection:'column', alignItems:'flex-start',
    width:'100%', textAlign:'left', padding:'5px 8px',
    background:'none', border:'none', cursor:'pointer',
    borderRadius:'var(--radius)', transition:'background 0.1s',
    fontFamily:"'DM Sans',sans-serif",
  },
  chapBtnActive: { background:'var(--parchment-dark)' },
  chapLabel: { fontSize:10, fontWeight:700, letterSpacing:'0.04em' },
  chapTitle: { fontSize:10, color:'var(--ink-muted)', lineHeight:1.35, marginTop:1 },

  backdrop: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
    zIndex:40, backdropFilter:'blur(2px)',
  },
  mobileSidebar: {
    position:'fixed', top:0, left:0, bottom:0, width:280,
    background:'var(--surface)', borderRight:'1px solid var(--border)',
    boxShadow:'4px 0 24px rgba(0,0,0,0.12)',
    zIndex:50, display:'flex', flexDirection:'column',
    transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    overflowY:'auto',
  },
  mobileNavHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'var(--surface)', flexShrink:0,
  },
  mobileNavClose: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    justifyContent:'center', padding:6, borderRadius:'var(--radius)',
  },

  main: { flex:1, padding:'1.5rem 1.5rem 5rem', maxWidth:760, minWidth:0 },
  empty: { textAlign:'center', padding:'4rem', color:'var(--ink-faint)', fontSize:14 },
  resultBanner: {
    fontSize:12, color:'var(--teal)', background:'var(--teal-light)',
    border:'1px solid rgba(29,107,90,0.2)', borderRadius:'var(--radius)',
    padding:'8px 14px', marginBottom:'1.5rem', fontWeight:500,
  },

  chapter: { marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)' },
  chapterHeader: { marginBottom:'1.5rem' },
  chapterNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--teal)', display:'block', marginBottom:4 },
  chapterTitle: { fontSize:26, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.2 },

  paragraph: { display:'flex', gap:12, marginBottom:'1.5rem', alignItems:'flex-start', transition:'background 0.15s, border-color 0.15s' },
  paraNum: { fontSize:12, fontWeight:700, color:'var(--ink-faint)', flexShrink:0, minWidth:24, paddingTop:3, fontVariantNumeric:'tabular-nums' },
  paraBody: { flex:1, minWidth:0 },
  paraText: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9, color:'var(--ink)', margin:'0 0 8px' },

  catechismList: {},
  qaBlock: { display:'flex', gap:14, marginBottom:'1.75rem', paddingBottom:'1.75rem', borderBottom:'1px solid var(--border)', alignItems:'flex-start', transition:'background 0.15s' },
  qaNum: { fontSize:12, fontWeight:700, color:'var(--teal)', flexShrink:0, minWidth:30, paddingTop:2, fontVariantNumeric:'tabular-nums' },
  qaBody: { flex:1, minWidth:0 },
  qaQuestion: { fontSize:17, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.55, margin:'0 0 8px' },
  qaAnswer: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.85, color:'var(--ink)', margin:'0 0 8px' },

  article: { marginBottom:'2.5rem', paddingBottom:'2rem', borderBottom:'1px solid var(--border)', transition:'background 0.15s' },
  articleHeader: { marginBottom:'1rem' },
  articleNum: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--amber-ink)', display:'block', marginBottom:4 },
  articleTitle: { fontSize:24, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:'var(--ink)', lineHeight:1.25 },
  articleBody: { paddingLeft:4 },
  articleLine: { fontSize:16, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.9, color:'var(--ink)', margin:'0 0 6px' },

  refs: { fontSize:12, color:'var(--ink-faint)', lineHeight:1.65, marginTop:8, borderLeft:'2px solid var(--border)', paddingLeft:10, fontFamily:"'DM Sans',sans-serif" },
  refsLabel: { fontWeight:600, color:'var(--ink-muted)' },
}
