// Lightweight page-state and scroll persistence via sessionStorage
// Usage: saveState('conf', { tab, search }), loadState('conf', defaults)
//        saveScroll('conf'), restoreScroll('conf')

export function saveState(key, state) {
  try { sessionStorage.setItem(`ps-${key}`, JSON.stringify(state)) } catch {}
}

export function loadState(key, defaults = {}) {
  try {
    const raw = sessionStorage.getItem(`ps-${key}`)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch { return defaults }
}

export function saveScroll(key) {
  try { sessionStorage.setItem(`sc-${key}`, String(Math.round(window.scrollY))) } catch {}
}

export function restoreScroll(key) {
  try {
    const y = parseInt(sessionStorage.getItem(`sc-${key}`) || '0', 10)
    if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
  } catch {}
}
