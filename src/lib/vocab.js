/**
 * Greek / Hebrew vocabulary list — localStorage-backed.
 * Key: 'pb-vocab'
 * Shape: { [strongsId]: { id, lang, lemma, translit, pronun, gloss, def, savedAt } }
 */

const STORAGE_KEY = 'pb-vocab'

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

export function saveVocabWord({ id, lang, lemma, translit, pronun, gloss, def }) {
  const data = read()
  data[id] = { id, lang, lemma, translit, pronun, gloss, def, savedAt: Date.now() }
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
