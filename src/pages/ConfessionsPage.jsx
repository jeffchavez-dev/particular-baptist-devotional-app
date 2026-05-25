import React, { useMemo, useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { getFontCss } from '../components/FontPrefsPanel'
import { usePrefs, useAuth } from '../App'
import CopyBtn from '../components/CopyBtn'
import { LBCF2 }              from '../data/lbcf2'
import { CATECHISM }          from '../data/catechism'
import { LBCF1 }              from '../data/lbcf1'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import { saveState, loadState, saveScroll, restoreScroll } from '../lib/pageState'
import { parseRefs } from '../lib/parseRefs'
import { buildScriptureIndex, BOOK_MAP } from '../lib/scriptureParser'
import { buildSchedule } from '../lib/supabase'
import KjvModal from '../components/KjvModal'
import ShareCardModal from '../components/ShareCardModal'
import {
  HIGHLIGHT_COLORS, getHlStyle,
  loadHighlights, loadItemNotes,
  setHighlight, setItemNote,
  addSearchHistory, getSearchHistory, clearSearchHistory, removeSearchEntry,
} from '../lib/annotations'
import {
  isAuthor,
  fetchChapterDescs,
  upsertChapterDesc,
  deleteChapterDesc,
} from '../lib/authorContent'
import { getMemorizeConf, setMemorizeConf, clearMemorizeConf } from '../lib/memorize'

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
  '2lbcf':     { label: '2LBCF',     name: 'Second London Baptist Confession (1677/1689)', desc: 'The doctrinal standard of Particular Baptists — 32 chapters of Reformed theology grounded in Scripture, closely following the Westminster Confession with key Baptist modifications.', stat: '32 chapters', color: 'var(--purple-ink)', bg: 'var(--purple-soft)', href: 'https://www.the1689confession.com/' },
  'catechism': { label: 'Catechism', name: "Keach's Baptist Catechism (1693)",             desc: 'One hundred and fourteen questions and answers teaching the essentials of Christian doctrine — designed for instruction in faith and practice for all ages.', stat: '114 Q&A',      color: 'var(--teal)',       bg: 'var(--teal-light)',  href: 'https://baptistcatechism.org/' },
  '1lbcf':     { label: '1LBCF',     name: 'First London Baptist Confession (1644)',        desc: 'The founding document of the Particular Baptist movement — fifty-two articles affirming biblical faith and believer\'s baptism.', stat: '52 articles',  color: 'var(--amber-ink)', bg: 'var(--amber-soft)',  href: 'https://london1644.info/en/fulltext.html' },
  'orthodox':  { label: 'Orthodox',  name: 'An Orthodox Catechism (1680)',                  desc: 'Composed by Hercules Collins following the structure of the Heidelberg Catechism while affirming Particular Baptist distinctives.', stat: '148 Q&A',      color: 'var(--sky)',        bg: 'var(--sky-light)',   href: 'https://1689.com/an-orthodox-catechism/' },
}

/* ── Proof-text helpers (sidebar panel) ── */
const _SCHEDULE = buildSchedule()
const PT_INDEX  = buildScriptureIndex(LBCF2, CATECHISM, LBCF1, _SCHEDULE, ORTHODOX_CATECHISM)

const BOOK_NAMES_ORDERED = Array.from(
  new Map(Object.values(BOOK_MAP).map(b => [b.order, b])).values()
).sort((a, b) => a.order - b.order)

function ptSrcBadge(src) {
  if (src === '2LBCF')     return { bg:'var(--purple-soft)', color:'var(--purple-ink)' }
  if (src === 'Catechism') return { bg:'var(--teal-light)',  color:'var(--teal)' }
  if (src === 'Orthodox')  return { bg:'rgba(12,74,110,0.12)', color:'#0c4a6e' }
  return                          { bg:'var(--amber-soft)',  color:'var(--amber-ink)' }
}

/* Sidebar proof-text panel */
function ProofTextPanel({ onDayNav, onOrthodoxNav }) {
  const [ptSearch,   setPtSearch]   = useState('')
  const [expanded,   setExpanded]   = useState(null)
  const [filterSrc,  setFilterSrc]  = useState('')

  const filtered = useMemo(() => {
    const q = ptSearch.toLowerCase().trim()
    return PT_INDEX.filter(entry => {
      if (filterSrc && !entry.citations.some(c => c.src === filterSrc)) return false
      if (!q) return true
      return (
        entry.refStr.toLowerCase().includes(q) ||
        entry.bookInfo.name.toLowerCase().includes(q) ||
        entry.citations.some(c => c.label.toLowerCase().includes(q))
      )
    })
  }, [ptSearch, filterSrc])

  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach(entry => {
      const name = entry.bookInfo.name
      if (!groups.has(name)) groups.set(name, { bookInfo: entry.bookInfo, entries: [] })
      groups.get(name).entries.push(entry)
    })
    return Array.from(groups.values()).sort((a, b) => a.bookInfo.order - b.bookInfo.order)
  }, [filtered])

  return (
    <div style={pt.wrap}>
      {/* Search + filter */}
      <div style={pt.searchRow}>
        <div style={pt.searchBox}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            style={pt.searchInput}
            value={ptSearch}
            onChange={e => setPtSearch(e.target.value)}
            placeholder="Search references…"
          />
          {ptSearch && <button style={pt.clearBtn} onClick={() => setPtSearch('')}>×</button>}
        </div>
        <select value={filterSrc} onChange={e => setFilterSrc(e.target.value)} style={pt.select}>
          <option value="">All sources</option>
          <option value="2LBCF">2LBCF</option>
          <option value="Catechism">Catechism</option>
          <option value="1LBCF">1LBCF</option>
          <option value="Orthodox">Orthodox</option>
        </select>
      </div>

      <div style={pt.count}>
        {grouped.length} book{grouped.length !== 1 ? 's' : ''} · {filtered.length} passage{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Results */}
      <div style={pt.list}>
        {grouped.map(({ bookInfo, entries }) => {
          const isOpen = expanded === bookInfo.name || ptSearch.trim() !== ''
          const isOT   = bookInfo.order <= 39
          return (
            <div key={bookInfo.name} style={pt.bookBlock}>
              <button
                style={pt.bookBtn}
                onClick={() => setExpanded(e => e === bookInfo.name ? null : bookInfo.name)}
              >
                <span style={{
                  ...pt.testBadge,
                  background: isOT ? 'var(--amber-soft)' : 'var(--purple-soft)',
                  color: isOT ? 'var(--amber-ink)' : 'var(--purple-ink)',
                }}>{isOT ? 'OT' : 'NT'}</span>
                <span style={pt.bookName}>{bookInfo.name}</span>
                <span style={pt.bookCount}>{entries.length}</span>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
                  style={{flexShrink:0, transition:'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)'}}>
                  <path d="M3.5 2l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
              {isOpen && (
                <div style={pt.entryList}>
                  {entries.map(entry => (
                    <div key={entry.refStr} style={pt.entryRow}>
                      <span style={pt.refStr}>{entry.refStr}</span>
                      <div style={pt.citeRow}>
                        {entry.citations.map((c, i) => {
                          const badge = ptSrcBadge(c.src)
                          const isOrthodox = c.src === 'Orthodox'
                          const shortLabel = c.src === '2LBCF'
                            ? c.label.replace('2LBCF ', '')
                            : c.label.replace(/^(Catechism|1LBCF|Orthodox) /, '')
                          return (
                            <button
                              key={i}
                              style={{...pt.citeBtn, background: badge.bg, color: badge.color}}
                              onClick={() => isOrthodox
                                ? onOrthodoxNav?.(c.refKey)
                                : onDayNav(c.day)
                              }
                              title={isOrthodox
                                ? `${c.label} — Open Orthodox Catechism`
                                : `${c.label} · Day ${c.day}`
                              }
                            >
                              {shortLabel}
                              {!isOrthodox && (
                                <span style={{fontWeight:400,opacity:0.65,marginLeft:3}}>·{c.day}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {grouped.length === 0 && (
          <div style={{fontSize:12, color:'var(--ink-faint)', textAlign:'center', padding:'1.5rem 0'}}>No passages found.</div>
        )}
      </div>
    </div>
  )
}

const pt = {
  wrap: { display:'flex', flexDirection:'column', gap:8, fontFamily:"'DM Sans',sans-serif" },
  searchRow: { display:'flex', gap:6 },
  searchBox: {
    flex:1, display:'flex', alignItems:'center', gap:6,
    border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'0 8px', background:'var(--parchment)',
  },
  searchInput: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:12, color:'var(--ink)', padding:'6px 0',
    fontFamily:"'DM Sans',sans-serif",
  },
  clearBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:14, lineHeight:1, padding:0 },
  select: {
    fontSize:11, border:'1px solid var(--border)', borderRadius:'var(--radius)',
    background:'var(--surface)', color:'var(--ink)', cursor:'pointer', padding:'4px 6px',
    fontFamily:"'DM Sans',sans-serif",
  },
  count: { fontSize:10, color:'var(--ink-faint)', padding:'0 2px' },
  list: { display:'flex', flexDirection:'column', gap:3 },
  bookBlock: { border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' },
  bookBtn: {
    display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left',
    padding:'7px 10px', background:'var(--surface)', border:'none', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
  },
  testBadge: { fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:99, letterSpacing:'0.05em', flexShrink:0 },
  bookName: { fontSize:12, fontWeight:600, color:'var(--ink)', flex:1, fontFamily:"'Cormorant Garamond',serif" },
  bookCount: { fontSize:10, color:'var(--ink-faint)', flexShrink:0 },
  entryList: { borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column' },
  entryRow: {
    display:'flex', flexDirection:'column', gap:3,
    padding:'6px 10px', borderBottom:'1px solid var(--border)',
  },
  refStr: { fontSize:11, fontWeight:600, color:'var(--ink)', fontVariantNumeric:'tabular-nums' },
  citeRow: { display:'flex', flexWrap:'wrap', gap:3 },
  citeBtn: {
    display:'inline-flex', alignItems:'center', fontSize:10, fontWeight:600,
    padding:'2px 7px', borderRadius:99, border:'none', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
  },
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
  memorizePayload,
  isActive,
}) {
  const [showPicker,      setShowPicker]      = useState(false)
  const [editingNote,     setEditingNote]      = useState(false)
  const [draft,           setDraft]            = useState('')
  const [memConfirm,      setMemConfirm]       = useState(null) // { incoming, existing } | null
  const [memSaved,        setMemSaved]         = useState(false)
  const currentColor = highlights[itemKey] || null
  const note = itemNotes[itemKey] || null
  const hlStyle = currentColor ? getHlStyle(currentColor) : null

  function handleMemorize() {
    if (!memorizePayload) return
    const existing = getMemorizeConf()
    if (existing && existing.key !== memorizePayload.key) {
      setMemConfirm({ incoming: memorizePayload, existing })
    } else {
      setMemorizeConf(memorizePayload)
      setMemSaved(true)
      setTimeout(() => setMemSaved(false), 2000)
    }
  }

  function confirmMemorize() {
    if (!memConfirm) return
    setMemorizeConf(memConfirm.incoming)
    setMemConfirm(null)
    setMemSaved(true)
    setTimeout(() => setMemSaved(false), 2000)
  }

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

        {/* Memory button */}
        {memorizePayload && (
          <button
            style={{
              ...ia.btn,
              ...(memSaved ? { color:'var(--teal)', borderColor:'rgba(29,107,90,0.4)', background:'rgba(29,107,90,0.08)' } : {}),
            }}
            onClick={handleMemorize}
            title="Add to Memory"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.52 1.5 2.5 3.52 2.5 6c0 1.62.88 3.04 2.2 3.8V11h4.6V9.8A4.5 4.5 0 0011.5 6c0-2.48-2.02-4.5-4.5-4.5z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                fill={memSaved ? 'rgba(29,107,90,0.15)' : 'none'}/>
              <path d="M4.7 11h4.6M5.5 12.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {memSaved ? ' Saved' : ''}
          </button>
        )}
      </div>}

      {/* Memory replace confirm */}
      {memConfirm && (
        <div style={ia.memConfirm}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-faint)', marginBottom:6 }}>
            Replace memory?
          </div>
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:4 }}>
            Current: <strong>{memConfirm.existing.label}</strong> — {memConfirm.existing.source}
          </div>
          <div style={{ fontSize:11, color:'var(--ink-muted)', marginBottom:8 }}>
            New: <strong>{memConfirm.incoming.label}</strong> — {memConfirm.incoming.source}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={confirmMemorize} style={ia.saveBtn}>Replace</button>
            <button onClick={() => setMemConfirm(null)} style={ia.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

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
  memConfirm: {
    marginTop:8, padding:'10px 12px',
    background:'var(--parchment)', border:'1px solid var(--border)',
    borderRadius:8, fontSize:12,
  },
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
  const routerNavigate = useNavigate()
  const { prefs, updatePrefs } = usePrefs()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const _saved = loadState('conf', { tab: null, search: '', anchorId: null })
  const tab    = searchParams.get('t') || _saved.tab || null

  const [activeChapter, setActiveChapter] = useState(null)
  const [search,        setSearch]        = useState(_saved.search)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [openSources,     setOpenSources]     = useState(() => new Set())
  const [navOpen,         setNavOpen]         = useState(false)
  const [kjvModal,      setKjvModal]      = useState(null)
  const [shareCard,     setShareCard]     = useState(null)
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768)
  const [sidebarConf,   setSidebarConf]   = useState(tab || '2lbcf')

  // Always-current refs so cleanup callbacks never capture stale values
  const currentTabRef    = useRef(tab)
  currentTabRef.current  = tab
  const currentSearchRef   = useRef(search)
  currentSearchRef.current = search

  const pendingScrollRef = useRef(null)
  const contentRef    = useRef(null)
  const searchWrapRef = useRef(null)
  const headerRef     = useRef(null)
  const prefsSizeRef  = useRef(prefs.sizePx)
  const didInitAnchorRef = useRef(false)
  const searchInputRef = useRef(null)

  const [headerH,   setHeaderH]   = useState(53)
  const [chromeVis, setChromeVis] = useState(true)
  const isDesktopRef = useRef(window.innerWidth >= 768)

  // Track offline banner height so the fixed header drops below it.
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

  /* Deep-link from Settings: scroll to specific paragraph/Q&A/article */
  const deepLinkRef = useRef(
    locationState?.itemKey && locationState?.source ? locationState : null
  )

  /* Search history */
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory('conf'))

  /* Annotations — plain state, always written by reading fresh from localStorage */
  const [hlData,   setHlData]   = useState(() => loadHighlights())
  const [noteData, setNoteData] = useState(() => loadItemNotes())

  const [activeItemKey, setActiveItemKey] = useState(null) // tap-to-show actions

  /* Author chapter descriptions */
  const [chapterDescs,   setChapterDescs]   = useState({}) // { [chapter_key]: {id, description} }
  const [editingChDesc,  setEditingChDesc]  = useState(null) // chapter_key being edited, or null
  const [chDescDraft,    setChDescDraft]    = useState('')

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

  /* Focus search input when panel opens (avoid keyboard popup on page load) */
  useEffect(() => {
    if (searchPanelOpen) searchInputRef.current?.focus()
  }, [searchPanelOpen])

  /* Fetch chapter descriptions whenever the active tab changes */
  useEffect(() => {
    const src = tab || '2lbcf'
    fetchChapterDescs(src).then(rows => {
      const map = {}
      rows.forEach(r => { map[r.chapter_key] = { id: r.id, description: r.description } })
      setChapterDescs(map)
    })
  }, [tab])

  /* Keep prefsSizeRef in sync for pinch handler */
  useEffect(() => { prefsSizeRef.current = prefs.sizePx }, [prefs.sizePx])

  /* Measure header once it mounts */
  useEffect(() => {
    if (headerRef.current) setHeaderH(headerRef.current.offsetHeight)
  }, [])

  /* Window scroll → dispatch pb-scroll-dir (for BottomNav) + update chromeVis */
  function getCurrentAnchorId() {
    try {
      const els = contentRef.current?.querySelectorAll('[id^="p-"],[id^="qa-"],[id^="art-"]')
      if (!els?.length) return null
      for (const el of els) {
        if (el.getBoundingClientRect().bottom >= headerH + 8) return el.id
      }
      return els[0]?.id || null
    } catch { return null }
  }

  function saveCurrentAnchor() {
    const anchorId = getCurrentAnchorId()
    saveScroll('conf')
    saveState('conf', { tab: currentTabRef.current, search: currentSearchRef.current, anchorId })
  }

  useEffect(() => {
    const onResize = () => { isDesktopRef.current = window.innerWidth >= 768 }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let lastY = window.scrollY
    function handler() {
      const y = window.scrollY
      const delta = y - lastY
      if (Math.abs(delta) < 8) return
      lastY = y
      const direction = delta > 0 ? 'down' : 'up'
      window.dispatchEvent(new CustomEvent('pb-scroll-dir', {
        detail: { direction, scrollTop: y },
      }))
      // Never hide the header on desktop
      if (!isDesktopRef.current) setChromeVis(direction === 'up' || y < 30)
      saveCurrentAnchor()
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [tab, search])

  /* Always restore chrome visibility when tab changes */
  useEffect(() => { setChromeVis(true) }, [tab])

  /* Pinch-to-zoom on content area */
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const pinch = { active: false, dist: 0, startSize: 16 }
    function getDist(t0, t1) {
      return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
    }
    function onTouchStart(e) {
      if (e.touches.length === 2) {
        pinch.active    = true
        pinch.dist      = getDist(e.touches[0], e.touches[1])
        pinch.startSize = prefsSizeRef.current
      } else { pinch.active = false }
    }
    function onTouchMove(e) {
      if (!pinch.active || e.touches.length !== 2) return
      e.preventDefault()
      const d    = getDist(e.touches[0], e.touches[1])
      const next = Math.round(Math.min(28, Math.max(12, pinch.startSize * (d / pinch.dist))))
      if (next !== prefsSizeRef.current) updatePrefs({ sizePx: next })
    }
    function onTouchEnd() { pinch.active = false }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!didInitAnchorRef.current) {
      didInitAnchorRef.current = true
      return
    }
    saveCurrentAnchor()
  }, [tab, search]) // eslint-disable-line
  useEffect(() => {
    const saved = loadState('conf', { anchorId: null })

    /* Compute scroll-independent absolute offsetTop by walking the offsetParent chain.
       getBoundingClientRect() is viewport-relative and breaks when window.scrollY
       is in flux (e.g. NoteEditOverlay body-fix cleanup racing with this timer).
       offsetTop chain is layout-stable regardless of current scroll position. */
    function getAbsoluteTop(el) {
      let top = 0, cur = el
      while (cur) { top += cur.offsetTop; cur = cur.offsetParent }
      return top
    }

    function scrollToSaved(anchorId, retriesLeft) {
      const el = document.getElementById(anchorId)
      if (el) {
        window.scrollTo({ top: Math.max(0, getAbsoluteTop(el) - 80), behavior: 'instant' })
        setActiveChapter(anchorId)
        return
      }
      if (retriesLeft > 0) {
        setTimeout(() => scrollToSaved(anchorId, retriesLeft - 1), 80)
      } else {
        restoreScroll('conf')
      }
    }

    let timerId = null
    if (saved.anchorId) {
      timerId = setTimeout(() => scrollToSaved(saved.anchorId, 8), 100)
    } else {
      timerId = setTimeout(() => restoreScroll('conf'), 100)
    }

    return () => {
      clearTimeout(timerId)
      saveCurrentAnchor()
    }
  }, [])

  /* Deep-link scroll: fires once after the tab content renders */
  useEffect(() => {
    if (!deepLinkRef.current) return
    const { itemKey, source } = deepLinkRef.current
    deepLinkRef.current = null
    let domId
    if (source === '2lbcf')          domId = `p-${itemKey}`
    else if (source === 'catechism') domId = `qa-${itemKey}`
    else if (source === '1lbcf')     domId = `art-${itemKey}`
    else if (source === 'orthodox')  domId = `qa-${itemKey}`
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
  const _isAuthor = isAuthor(session)

  /* Renders chapter description + author edit controls for a given chapter_key + source */
  function ChapterDesc({ chapterKey, srcKey }) {
    const existing = chapterDescs[chapterKey]
    const isEditing = editingChDesc === chapterKey
    const srcColor = (SOURCES[srcKey] || SOURCES['2lbcf']).color

    async function saveDesc() {
      const text = chDescDraft.trim()
      if (!text) {
        // treat as delete
        if (existing?.id) {
          await deleteChapterDesc(existing.id)
          setChapterDescs(prev => { const n = {...prev}; delete n[chapterKey]; return n })
        }
      } else {
        await upsertChapterDesc({ source: srcKey, chapter_key: chapterKey, description: text })
        setChapterDescs(prev => ({
          ...prev,
          [chapterKey]: { ...prev[chapterKey], description: text },
        }))
      }
      setEditingChDesc(null)
    }

    async function deleteDesc() {
      if (existing?.id) await deleteChapterDesc(existing.id)
      setChapterDescs(prev => { const n = {...prev}; delete n[chapterKey]; return n })
      setEditingChDesc(null)
    }

    if (isEditing) {
      return (
        <div style={cd.editorWrap}>
          <textarea
            autoFocus
            rows={4}
            value={chDescDraft}
            onChange={e => setChDescDraft(e.target.value)}
            placeholder="Write a chapter introduction or description visible to all readers…"
            style={cd.textarea}
          />
          <div style={cd.actions}>
            <button onClick={saveDesc} style={cd.saveBtn}>Save</button>
            <button onClick={() => setEditingChDesc(null)} style={cd.cancelBtn}>Cancel</button>
            {existing?.description && (
              <button onClick={deleteDesc} style={cd.deleteBtn}>Delete</button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div style={cd.wrap}>
        {existing?.description && (
          <p style={cd.text}>{existing.description}</p>
        )}
        {_isAuthor && (
          <button
            style={{
              ...cd.editBtn,
              color: existing?.description ? srcColor : 'var(--ink-faint)',
              opacity: existing?.description ? 1 : 0.45,
            }}
            onClick={() => {
              setChDescDraft(existing?.description || '')
              setEditingChDesc(chapterKey)
            }}
            title={existing?.description ? 'Edit chapter description' : 'Add chapter description'}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 9.5l.4-2L7 2l2 2-5.6 5.5-2.4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
              <line x1="6.2" y1="2.8" x2="8.2" y2="4.8" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span style={{fontSize:10}}>{existing?.description ? 'Edit intro' : 'Add intro'}</span>
          </button>
        )}
      </div>
    )
  }

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
      // Auto-expand all sources when a search is submitted
      setOpenSources(new Set(Object.keys(SOURCES)))
    }
  }

  /* Navigate to a search result: switch tab if needed, then scroll to item */
  function navigateToResult(result) {
    setSearchPanelOpen(false)
    const targetTab = result.source
    if (tab !== targetTab) {
      pendingScrollRef.current = result.id
      setSearchParams({ t: targetTab })
    } else {
      const el = document.getElementById(result.id)
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }
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

  /* Build a flat list of search results across all sources */
  const searchResults = useMemo(() => {
    if (!q) return []
    const hits = []
    Object.entries(LBCF2_CHAPTERS).forEach(([chNum, paras]) => {
      const chTitle = CHAPTER_TITLES[parseInt(chNum)] || ''
      const chMatch = chTitle.toLowerCase().includes(q)
      paras.forEach(p => {
        if (chMatch || textMatches(p.text, p.refs, SEARCH_IDX.lbcf2[p.key] || '', q)) {
          hits.push({ source: '2lbcf', label: `Ch.${chNum} §${p.para}`, text: p.text, id: `p-${p.key}` })
        }
      })
    })
    Object.entries(CATECHISM).forEach(([num, item]) => {
      if (textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.catechism[num] || '', q)) {
        hits.push({ source: 'catechism', label: `Q&A ${num}`, text: `Q. ${item.q}`, id: `qa-${num}` })
      }
    })
    Object.entries(LBCF1).forEach(([num, item]) => {
      if (textMatches(item.title + ' ' + item.text, item.refs, SEARCH_IDX.lbcf1[num] || '', q)) {
        hits.push({ source: '1lbcf', label: `Art. ${num}`, text: item.title ? `${item.title} — ${item.text}` : item.text, id: `art-${num}` })
      }
    })
    Object.entries(ORTHODOX_CATECHISM).forEach(([num, item]) => {
      if (textMatches(item.q + ' ' + item.a, item.refs, SEARCH_IDX.orthodox[num] || '', q)) {
        hits.push({ source: 'orthodox', label: `Q&A ${num}`, text: `Q. ${item.q}`, id: `qa-${num}` })
      }
    })
    return hits
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
              {key === '2lbcf' ? '1689' : key === 'catechism' ? '1693' : key === 'orthodox' ? '1680' : '1644'}
            </span>
          </button>
        ))}

        {/* Proof Texts entry */}
        <button
          style={{
            ...s.confSelectorBtn,
            ...(sidebarConf === 'prooftexts' ? {
              background:'var(--parchment)', color:'var(--ink)',
              borderColor:'var(--ink-muted)', fontWeight:700,
            } : {}),
          }}
          onClick={() => setSidebarConf('prooftexts')}
        >
          <span style={{...s.confBadgeDot, background: sidebarConf === 'prooftexts' ? 'var(--ink-muted)' : 'var(--border-strong)'}} />
          <span style={{flex:1, textAlign:'left'}}>Proof Texts</span>
          <span style={{fontSize:10, opacity:0.6, fontWeight:400}}>Index</span>
        </button>

        {sidebarConf !== tab && sidebarConf !== 'catechism' && sidebarConf !== 'prooftexts' && (
          <p style={{fontSize:10, color:'var(--ink-faint)', margin:'6px 4px 0', lineHeight:1.5}}>
            Select a chapter below to open it
          </p>
        )}
      </div>

      {/* Chapter nav (confessions) */}
      {chapterNav.length > 0 && sidebarConf !== 'prooftexts' && (
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

      {/* Proof Texts panel */}
      {sidebarConf === 'prooftexts' && (
        <>
          <div style={s.sidebarDivider} />
          <ProofTextPanel
            onDayNav={d => { routerNavigate(`/day/${d}`); setNavOpen(false) }}
            onOrthodoxNav={qNum => {
              setSidebarConf('orthodox')
              setTab('orthodox')
              setNavOpen(false)
              // Scroll to the specific question after the tab renders
              setTimeout(() => {
                const el = document.getElementById(`qa-${qNum}`)
                if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
              }, 250)
            }}
          />
        </>
      )}
    </div>
  )

  return (
    <div style={{ ...s.page, paddingTop: headerH }}>

      {/* ── Fixed header (auto-hides on scroll down) ── */}
      <header
        ref={headerRef}
        style={{
          ...s.header,
          top:        offlineBannerH,   // slide below offline banner when present
          transform:  chromeVis ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.28s ease',
        }}
      >
        <div style={s.headerInner}>
          {/* Hamburger — always top-left on mobile */}
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

          {/* Source badge + name (desktop always; mobile when tab selected) */}
          {!isMobile && tab && (
            <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={s.srcName}>{src.name}</span>
            </div>
          )}
          {!isMobile && !tab && (
            <div style={{flex:1, minWidth:0}}>
              <span style={{fontSize:14, fontWeight:700, color:'var(--ink)', fontFamily:"'Cormorant Garamond',serif"}}>
                Historic Baptist Confessions
              </span>
            </div>
          )}
          {isMobile && tab && (
            <div style={{display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0, overflow:'hidden'}}>
              <span style={{...s.srcBadge, background: src.bg, color: src.color}}>{src.label}</span>
              <span style={{...s.srcName, fontSize:12}}>{src.name}</span>
            </div>
          )}
          {isMobile && !tab && (
            <div style={{flex:1, minWidth:0}}>
              <span style={{fontSize:13, fontWeight:700, color:'var(--ink)', fontFamily:"'Cormorant Garamond',serif"}}>
                Confessions
              </span>
            </div>
          )}

          {/* Search icon — always far right */}
          <button
            onClick={() => {
              setSearchPanelOpen(o => !o)
              if (searchPanelOpen) setSearch('')
            }}
            style={{
              ...sl.searchIconBtn,
              color: searchPanelOpen || search ? 'var(--teal)' : 'var(--ink-faint)',
              background: searchPanelOpen || search ? 'var(--teal-light)' : 'none',
            }}
            title="Search confessions"
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {search && <span style={sl.searchBadge}>{searchResults.length}</span>}
          </button>

        </div>
      </header>

      {isMobile && navOpen && (
        <div style={s.backdrop} onClick={() => setNavOpen(false)} />
      )}

      {/* ── Right-panel search drawer ── */}
      {searchPanelOpen && (
        <div
          style={srp.backdrop}
          onClick={() => { setSearchPanelOpen(false); setSearch('') }}
        />
      )}
      <div style={{
        ...srp.panel,
        transform: searchPanelOpen ? 'translateX(0)' : 'translateX(100%)',
      }}>
        {/* Panel header */}
        <div style={srp.panelHeader}>
          <span style={srp.panelTitle}>Search Confessions</span>
          <button
            style={srp.closeBtn}
            onClick={() => { setSearchPanelOpen(false); setSearch('') }}
            aria-label="Close search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div style={srp.inputRow}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{color:'var(--ink-faint)',flexShrink:0}}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchInputRef}
            style={srp.input}
            value={search}
            onChange={e => {
              const v = e.target.value
              setSearch(v)
              if (v.trim()) setOpenSources(new Set(Object.keys(SOURCES)))
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') submitSearch(search)
              if (e.key === 'Escape') { setSearch(''); setSearchPanelOpen(false) }
            }}
            placeholder="Search all confessions & catechisms…"
          />
          {search
            ? <button onClick={() => setSearch('')} style={srp.clearBtn}>×</button>
            : null
          }
        </div>

        {/* Scrollable body */}
        <div style={srp.body}>

          {/* No query → show history */}
          {!q && searchHistory.length > 0 && (
            <div style={srp.histSection}>
              <div style={srp.histHeader}>
                <span style={srp.histLabel}>Recent searches</span>
                <button style={srp.histClearAll} onClick={() => { clearSearchHistory('conf'); setSearchHistory([]) }}>
                  Clear all
                </button>
              </div>
              {searchHistory.map(entry => (
                <div key={entry} style={srp.histRow}>
                  <button style={srp.histItem} onClick={() => {
                    setSearch(entry)
                    setOpenSources(new Set(Object.keys(SOURCES)))
                  }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{flexShrink:0,opacity:0.4}}>
                      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5.5 3v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span style={srp.histItemText}>{entry}</span>
                  </button>
                  <button style={srp.histRm} onClick={() => {
                    removeSearchEntry('conf', entry)
                    setSearchHistory(getSearchHistory('conf'))
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          {!q && searchHistory.length === 0 && (
            <div style={srp.emptyHint}>Type to search across all confessions and catechisms</div>
          )}

          {/* Results grouped by source */}
          {q && searchResults.length === 0 && (
            <div style={srp.noResults}>No results for "{search}"</div>
          )}

          {q && searchResults.length > 0 && (
            <div style={srp.resultsSections}>
              <div style={srp.totalCount}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </div>
              {Object.entries(SOURCES).map(([srcKey, srcInfo]) => {
                const hits = searchResults.filter(r => r.source === srcKey)
                if (!hits.length) return null
                const isOpen = openSources.has(srcKey)
                return (
                  <div key={srcKey} style={srp.srcGroup}>
                    <button
                      style={srp.srcGroupHeader}
                      onClick={() => setOpenSources(prev => {
                        const next = new Set(prev)
                        if (next.has(srcKey)) next.delete(srcKey)
                        else next.add(srcKey)
                        return next
                      })}
                    >
                      <span style={{...srp.srcBadge, background: srcInfo.bg, color: srcInfo.color}}>
                        {srcInfo.label}
                      </span>
                      <span style={srp.srcGroupName}>{srcInfo.name}</span>
                      <span style={srp.srcGroupCount}>{hits.length}</span>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
                        style={{flexShrink:0, transition:'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', color:'var(--ink-faint)'}}>
                        <path d="M3.5 2l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </button>

                    {isOpen && (
                      <div style={srp.hitList}>
                        {hits.map((r, i) => {
                          const snippet = r.text ? r.text.slice(0, 140) + (r.text.length > 140 ? '…' : '') : ''
                          return (
                            <button key={i} style={srp.hitItem} onClick={() => navigateToResult(r)}>
                              <span style={srp.hitLabel}>{r.label}</span>
                              <p style={srp.hitSnippet}>{highlight(snippet, search)}</p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={s.layout}>

        {!isMobile && (
          <aside style={{
            ...s.desktopSidebar,
            top: headerH + offlineBannerH,
            height: `calc(100vh - ${headerH + offlineBannerH}px)`,
          }}>
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

          {/* ── Landing card grid (first visit / no tab selected) ── */}
          {!tab && (
            <div style={sl.landing}>
              <div style={sl.landingHero}>
                <h1 style={sl.landingTitle}>Historic Baptist Confessions</h1>
                <p style={sl.landingSubtitle}>Select a confession or catechism to begin reading</p>
              </div>
              <div style={sl.cardGrid}>
                {Object.entries(SOURCES).map(([key, src]) => (
                  <button
                    key={key}
                    style={sl.card}
                    onClick={() => setTab(key)}
                  >
                    <div style={{ ...sl.cardAccent, background: src.color }} />
                    <div style={sl.cardBody}>
                      <div style={sl.cardTop}>
                        <span style={{ ...sl.cardBadge, background: src.bg, color: src.color }}>
                          {src.label}
                        </span>
                        <span style={sl.cardStat}>{src.stat}</span>
                      </div>
                      <div style={sl.cardName}>{src.name}</div>
                      <p style={sl.cardDesc}>{src.desc}</p>
                    </div>
                    <div style={{ ...sl.cardArrow, color: src.color }}>→</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!tab && (<>

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
                      <h2 style={s.chapterTitle}>{chNum === '0' ? 'Preface' : chTitle}</h2>
                    </div>
                    <ChapterDesc chapterKey={chNum} srcKey="2lbcf" />
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
                                memorizePayload={{ planId:'2lbcf', key:p.key, label:`2LBCF ${p.key}`, text:p.text, source:'2nd London Baptist Confession' }}
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
                          memorizePayload={{ planId:'catechism', key:num, label:`Q.${num}`, text:`Q. ${item.q}\n\nA. ${item.a}`, source:"Keach's Baptist Catechism" }}
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
                    <ChapterDesc chapterKey={num} srcKey="1lbcf" />
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
                          memorizePayload={{ planId:'1lbcf', key:num, label:`1LBCF Art. ${num}`, text:`${item.title}\n\n${item.text.split('\n')[0]}`, source:'1st London Baptist Confession' }}
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
                          memorizePayload={{ planId:'orthodox', key:num, label:`Q.${num}`, text:`Q. ${item.q}\n\nA. ${item.a}`, source:'An Orthodox Catechism' }}
                          isActive={activeItemKey === itemKey}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          </>)}

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
    position:'fixed', top:0, left:0, right:0, zIndex:30,
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

const sl = {
  libraryBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:32, height:32, borderRadius:'var(--radius)', border:'1px solid var(--border)',
    background:'var(--surface)', cursor:'pointer', flexShrink:0,
    color:'var(--ink-muted)',
  },
  landing: { padding:'24px 0 40px' },
  landingHero: { marginBottom:28, textAlign:'center' },
  landingTitle: {
    fontSize:26, fontWeight:700, color:'var(--ink)', margin:'0 0 8px',
    fontFamily:"'Cormorant Garamond',serif",
  },
  landingSubtitle: { fontSize:14, color:'var(--ink-muted)', margin:0 },
  cardGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 },
  card: {
    display:'flex', flexDirection:'row', alignItems:'stretch',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', cursor:'pointer', textAlign:'left',
    padding:0, overflow:'hidden', transition:'box-shadow 0.15s, transform 0.15s',
    fontFamily:"'DM Sans',sans-serif",
    boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  },
  cardAccent: { width:5, flexShrink:0 },
  cardBody: { flex:1, padding:'16px 12px 16px 16px', minWidth:0 },
  cardTop: { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  cardBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.08em',
    padding:'2px 7px', borderRadius:99,
  },
  cardStat: { fontSize:11, color:'var(--ink-faint)', marginLeft:'auto' },
  cardName: {
    fontSize:15, fontWeight:700, color:'var(--ink)', lineHeight:1.35,
    marginBottom:6, fontFamily:"'Cormorant Garamond',serif",
  },
  cardDesc: {
    fontSize:12, color:'var(--ink-muted)', lineHeight:1.6,
    margin:0, display:'-webkit-box', WebkitLineClamp:3,
    WebkitBoxOrient:'vertical', overflow:'hidden',
  },
  cardArrow: {
    display:'flex', alignItems:'center', paddingRight:14,
    fontSize:18, fontWeight:700, flexShrink:0,
  },

  /* Search icon button in header */
  searchIconBtn: {
    display:'flex', alignItems:'center', gap:5,
    padding:'6px 8px', borderRadius:'var(--radius)',
    border:'1px solid transparent', cursor:'pointer',
    transition:'all 0.15s', flexShrink:0,
    fontFamily:"'DM Sans',sans-serif",
  },
  searchBadge: {
    fontSize:10, fontWeight:700, minWidth:16, height:16,
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    background:'var(--teal)', color:'white', borderRadius:99, padding:'0 4px',
  },

}

/* ── Right-panel search drawer styles ── */
const srp = {
  backdrop: {
    position:'fixed', inset:0, zIndex:150,
    background:'rgba(0,0,0,0.3)', backdropFilter:'blur(1px)',
  },
  panel: {
    position:'fixed', top:0, right:0, bottom:0, zIndex:160,
    width:340, maxWidth:'92vw',
    background:'var(--surface)', borderLeft:'1px solid var(--border)',
    boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',
    display:'flex', flexDirection:'column',
    transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    fontFamily:"'DM Sans',sans-serif",
  },
  panelHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid var(--border)',
    flexShrink:0,
  },
  panelTitle: {
    fontSize:14, fontWeight:700, color:'var(--ink)',
    fontFamily:"'DM Sans',sans-serif",
  },
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', display:'flex', alignItems:'center',
    justifyContent:'center', padding:6, borderRadius:'var(--radius)',
    transition:'color 0.12s',
  },
  inputRow: {
    display:'flex', alignItems:'center', gap:8,
    padding:'10px 14px', borderBottom:'1px solid var(--border)',
    flexShrink:0,
  },
  input: {
    flex:1, border:'none', background:'transparent', outline:'none',
    fontSize:14, color:'var(--ink)', fontFamily:"'DM Sans',sans-serif",
    padding:'2px 0',
  },
  clearBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, lineHeight:1, padding:'0 2px',
  },
  body: { flex:1, overflowY:'auto', padding:'8px 0' },

  /* History */
  histSection: { padding:'4px 0 8px' },
  histHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'6px 16px 8px',
  },
  histLabel: {
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    letterSpacing:'0.07em', color:'var(--ink-faint)',
  },
  histClearAll: {
    fontSize:11, fontWeight:600, color:'var(--teal)',
    background:'none', border:'none', cursor:'pointer', padding:0,
  },
  histRow: { display:'flex', alignItems:'center' },
  histItem: {
    display:'flex', alignItems:'center', gap:8, flex:1,
    padding:'8px 16px', background:'none', border:'none',
    cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif",
  },
  histItemText: { fontSize:13, color:'var(--ink)', flex:1 },
  histRm: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--ink-faint)', fontSize:16, padding:'0 14px', flexShrink:0,
  },

  emptyHint: {
    fontSize:13, color:'var(--ink-faint)', textAlign:'center',
    padding:'32px 24px', lineHeight:1.6,
  },
  noResults: {
    fontSize:14, color:'var(--ink-faint)', textAlign:'center',
    padding:'32px 16px',
  },

  /* Results */
  resultsSections: { display:'flex', flexDirection:'column' },
  totalCount: {
    fontSize:10, fontWeight:700, color:'var(--ink-faint)',
    textTransform:'uppercase', letterSpacing:'0.07em',
    padding:'8px 16px 4px',
  },
  srcGroup: {
    borderBottom:'1px solid var(--border)', overflow:'hidden',
  },
  srcGroupHeader: {
    display:'flex', alignItems:'center', gap:8, width:'100%',
    padding:'9px 14px', background:'var(--parchment)',
    border:'none', cursor:'pointer', textAlign:'left',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
  },
  srcBadge: {
    fontSize:9, fontWeight:700, letterSpacing:'0.07em',
    padding:'2px 7px', borderRadius:99, flexShrink:0,
  },
  srcGroupName: {
    fontSize:11, fontWeight:600, color:'var(--ink)', flex:1, minWidth:0,
    overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
    fontFamily:"'Cormorant Garamond',serif",
  },
  srcGroupCount: {
    fontSize:10, fontWeight:600, color:'var(--ink-faint)', flexShrink:0,
  },
  hitList: { display:'flex', flexDirection:'column' },
  hitItem: {
    display:'flex', flexDirection:'column', gap:3, textAlign:'left',
    padding:'9px 16px 9px 20px', border:'none',
    borderBottom:'1px solid var(--border)',
    background:'var(--surface)', cursor:'pointer',
    fontFamily:"'DM Sans',sans-serif", transition:'background 0.1s',
    width:'100%',
  },
  hitLabel: {
    fontSize:11, fontWeight:700, color:'var(--teal)',
    letterSpacing:'0.03em',
  },
  hitSnippet: {
    fontSize:12, color:'var(--ink-muted)', margin:0, lineHeight:1.55,
    display:'-webkit-box', WebkitLineClamp:2,
    WebkitBoxOrient:'vertical', overflow:'hidden',
    fontFamily:"'Cormorant Garamond',serif",
  },
}

/* Chapter description styles */
const cd = {
  wrap: { marginBottom:'1rem' },
  text: {
    fontSize:15, fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
    color:'var(--ink-muted)', lineHeight:1.75, margin:'0 0 8px',
    borderLeft:'2px solid var(--border)', paddingLeft:12,
  },
  editBtn: {
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:11, fontWeight:500, background:'none',
    border:'1px solid var(--border)', borderRadius:99,
    padding:'4px 10px', cursor:'pointer', transition:'all 0.12s',
    fontFamily:"'DM Sans',sans-serif",
  },
  editorWrap: { marginBottom:'1.25rem' },
  textarea: {
    width:'100%', padding:'8px 10px', boxSizing:'border-box',
    border:'1.5px solid var(--teal)', borderRadius:'var(--radius)',
    fontSize:14, color:'var(--ink)', lineHeight:1.65,
    fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
    background:'var(--surface)', resize:'vertical', outline:'none',
  },
  actions: { display:'flex', gap:6, alignItems:'center', marginTop:6 },
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
