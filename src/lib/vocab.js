/**
 * Greek / Hebrew vocabulary list — localStorage-backed.
 * Key: 'pb-vocab'
 * Shape: { [strongsId]: { id, lang, lemma, translit, pronun, gloss, def,
 *                         savedFrom, reviewCount, status, savedAt } }
 *
 * status: 'new' | 'learning' | 'mastered'
 * savedFrom: { book, chapter, verse } | null
 */

const STORAGE_KEY = 'pb-vocab'

export const VOCAB_STATUSES = [
  { id: 'new',      label: 'New',      color: 'var(--ink-faint)',   bg: 'var(--border)' },
  { id: 'learning', label: 'Learning', color: '#92700a',            bg: 'rgba(180,140,60,0.15)' },
  { id: 'mastered', label: 'Mastered', color: '#0e7a50',            bg: 'rgba(14,122,80,0.12)' },
]

function read() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function write(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

export function loadVocab() {
  return read()
}

export function getVocabList(lang) {
  const all = read()
  return Object.values(all)
    .filter(w => !lang || w.lang === lang)
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function isVocabSaved(id) {
  return !!read()[id]
}

export function saveVocabWord({ id, lang, lemma, translit, pronun, gloss, def, savedFrom }) {
  const data = read()
  // Preserve existing review stats if re-saving
  const existing = data[id] || {}
  data[id] = {
    id, lang, lemma, translit, pronun, gloss, def,
    savedFrom: savedFrom || null,
    reviewCount: existing.reviewCount || 0,
    status: existing.status || 'new',
    savedAt: existing.savedAt || Date.now(),
  }
  write(data)
}

export function removeVocabWord(id) {
  const data = read()
  delete data[id]
  write(data)
}

export function toggleVocabWord(entry) {
  if (isVocabSaved(entry.id)) {
    removeVocabWord(entry.id)
    return false
  } else {
    saveVocabWord(entry)
    return true
  }
}

export function incrementReviewCount(id) {
  const data = read()
  if (!data[id]) return
  data[id].reviewCount = (data[id].reviewCount || 0) + 1
  // Auto-promote status based on review count
  if (data[id].status === 'new' && data[id].reviewCount >= 1) {
    data[id].status = 'learning'
  }
  write(data)
}

export function setVocabStatus(id, status) {
  const data = read()
  if (!data[id]) return
  data[id].status = status
  write(data)
}
