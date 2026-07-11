const _cache = {
  studyMode:   false,
  inlineComId: null,
  inlineComExp: {},
}

export function getStudySession() {
  return { ..._cache, inlineComExp: { ..._cache.inlineComExp } }
}

export function setStudySession(patch) {
  Object.assign(_cache, patch)
  if (patch.inlineComExp !== undefined) {
    _cache.inlineComExp = { ...patch.inlineComExp }
  }
}
