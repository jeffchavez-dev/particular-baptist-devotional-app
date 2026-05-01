// Lightweight page-state and scroll persistence via localStorage
// Usage: saveState('conf', { tab, search }), loadState('conf', defaults)
//        saveScroll('conf'), restoreScroll('conf')

export function saveState(key, state) {
  try { localStorage.setItem(`ps-${key}`, JSON.stringify(state)) } catch {}
}

export function loadState(key, defaults = {}) {
  try {
    const raw = localStorage.getItem(`ps-${key}`)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch { return defaults }
}

export function saveScroll(key) {
  try { localStorage.setItem(`sc-${key}`, String(Math.round(window.scrollY))) } catch {}
}

export function restoreScroll(key) {
  try {
    const y = parseInt(localStorage.getItem(`sc-${key}`) || '0', 10)
    if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
  } catch {}
}

export function saveElementScroll(key, el) {
  try {
    if (el) localStorage.setItem(`sc-${key}`, String(Math.round(el.scrollTop)))
  } catch {}
}

export function restoreElementScroll(key, el) {
  try {
    if (!el) return
    const y = parseInt(localStorage.getItem(`sc-${key}`) || '0', 10)
    if (y > 0) requestAnimationFrame(() => { el.scrollTop = y })
  } catch {}
}
