/**
 * Bible Version Manager
 *
 * Handles loading and caching of multiple Bible translations.
 * Currently supports: KJV, ABAB (Tagalog)
 * Future: ESV, NASB, Hebrew OT, Greek NT, etc.
 *
 * Data format per version:
 *   public/{versionId}.json  e.g. public/kjv.json, public/abab.json
 *   Structure: { book_slug: { chapter: [{ v: verse_num, t: text }] } }
 */

// ── Version Metadata ──────────────────────────────────────────────────────
export const BIBLE_VERSIONS = [
  {
    id: 'kjv',
    label: 'King James Version',
    abbreviation: 'KJV',
    language: 'English',
    year: '1611',
    description: 'The most beloved English translation',
    dataFile: '/kjv.json',
  },
  {
    id: 'abab',
    label: 'Ang Bagong Ang Biblia',
    abbreviation: 'ABAB',
    language: 'Tagalog',
    year: '2000',
    description: 'Tagalog Bible translation (Philippine Bible Society)',
    dataFile: '/abab.json',
  },
  {
    id: 'ceb',
    label: 'Ang Biblia — Cebuano Pinadayag',
    abbreviation: 'CEBug',
    language: 'Cebuano',
    year: '1917',
    description: 'Cebuano Bugna/Pinadayag — public domain. Similar in structure to the KJV.',
    dataFile: '/ceb.json',
  },
  {
    id: 'greek',
    label: 'Greek New Testament',
    abbreviation: 'GNT',
    language: 'Greek',
    year: 'NA28/TR',
    description: 'Translators Amalgamated Greek NT (TAGNT) — all major manuscript traditions with morphology',
    type: 'greek',      // special: word-level rendering, not sentence-level text
    dataFile: '/tagnt.json',
    scope: 'NT',        // NT books only
    source: 'STEPBible.org CC BY 4.0',
  },
  {
    id: 'hebrew',
    label: 'Hebrew Old Testament',
    abbreviation: 'HOT',
    language: 'Hebrew',
    year: 'BHS/WLC',
    description: 'Translators Amalgamated Hebrew OT (TAHOT) — Leningrad Codex with full Masoretic pointing and morphology',
    type: 'hebrew',     // special: word-level RTL rendering
    dataFile: '/tahot.json',
    scope: 'OT',        // OT books only
    source: 'STEPBible.org CC BY 4.0',
  },
  {
    id: 'lxx',
    label: 'Greek Septuagint',
    abbreviation: 'LXX',
    language: 'Greek',
    year: 'Rahlfs 1935',
    description: 'The Greek translation of the Hebrew scriptures used in early Christianity',
    dataFile: '/lxx.json',
    scope: 'OT',        // OT books; LXX includes additional deuterocanonical books
    source: 'CCAT (Thesaurus Linguae Graecae / CATSS) CC BY 4.0',
  },
  {
    id: 'nasb',
    label: 'New American Standard Bible 1995',
    abbreviation: 'NASB',
    language: 'English',
    year: '1995',
    description: 'New American Standard Bible, 1995 edition',
    dataFile: '/nasb.json',
  },
  {
    id: 'bsb',
    label: 'Berean Standard Bible',
    abbreviation: 'BSB',
    language: 'English',
    year: '2024',
    description: 'A modern, scholarly translation in the tradition of the KJV',
    dataFile: '/bsb.json',
  },
  {
    id: 'gnv',
    label: 'Geneva Bible (1599)',
    abbreviation: 'GNV',
    language: 'English',
    year: '1599',
    description: 'The Puritan Bible — first English Bible with verse numbers and study notes',
    dataFile: '/gnv.json',
  },
  {
    id: 'rv',
    label: 'Revised Version (1895)',
    abbreviation: 'RV',
    language: 'English',
    year: '1895',
    description: 'The first major scholarly revision of the KJV, using earlier manuscripts',
    dataFile: '/rv.json',
  },
]

// ── Version Data Cache ────────────────────────────────────────────────────
const _versionCache = {}
const _versionPromises = {}

/**
 * Load a Bible version. Returns cached data if already loaded.
 * @param {string} versionId - e.g. 'kjv', 'abab'
 * @returns {Promise<object>} Version data { book_slug: { chapter: [verse_data] } }
 */
export async function loadBibleVersion(versionId) {
  // Return cached data if available
  if (_versionCache[versionId]) {
    return _versionCache[versionId]
  }

  // Return existing promise if currently loading
  if (_versionPromises[versionId]) {
    return _versionPromises[versionId]
  }

  // Find version metadata
  const versionMeta = BIBLE_VERSIONS.find(v => v.id === versionId)
  if (!versionMeta) {
    throw new Error(`Unknown Bible version: ${versionId}`)
  }

  // Start loading
  _versionPromises[versionId] = fetch(versionMeta.dataFile)
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load ${versionId}: HTTP ${r.status}`)
      return r.json()
    })
    .then(data => {
      _versionCache[versionId] = data
      delete _versionPromises[versionId]
      return data
    })
    .catch(err => {
      delete _versionPromises[versionId]
      throw err
    })

  return _versionPromises[versionId]
}

/**
 * Get version metadata by ID
 */
export function getVersionMetadata(versionId) {
  return BIBLE_VERSIONS.find(v => v.id === versionId)
}

/**
 * Get all available versions
 */
export function getAllVersions() {
  return BIBLE_VERSIONS
}

/**
 * Check if a version is currently cached
 */
export function isVersionCached(versionId) {
  return !!_versionCache[versionId]
}

/**
 * Clear a version from cache (useful for memory management)
 */
export function clearVersionCache(versionId) {
  delete _versionCache[versionId]
}

/**
 * Get chapter verses from a loaded version
 * (same logic as KJV reader uses)
 */
export function getChapterVerses(versionData, bookName, chapter) {
  if (!versionData) return null
  const slug = bookName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  const raw = versionData[slug]?.[chapter]
  if (!raw) return null
  
  // Deduplicate verses in case of duplicates in source
  const seen = new Set()
  return raw
    .filter(v => {
      if (seen.has(v.v)) return false
      seen.add(v.v)
      return true
    })
    .map(v => ({ verse: v.v, text: v.t || '' }))
}

/**
 * Search across a specific version
 */
export function searchBibleVersion(versionData, bookNames, query, maxResults = 200) {
  if (!versionData || !query.trim()) return []
  
  const q = query.trim().toLowerCase()
  const hits = []
  
  for (const bookName of bookNames) {
    const slug = bookName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const bookData = versionData[slug]
    if (!bookData) continue
    
    const chapterNums = Object.keys(bookData).map(Number).sort((a, b) => a - b)
    for (const ch of chapterNums) {
      const verses = bookData[ch]
      if (!verses) continue
      
      for (const v of verses) {
        if (v.t && v.t.toLowerCase().includes(q)) {
          hits.push({ book: bookName, chapter: ch, verse: v.v, text: v.t })
          if (hits.length >= maxResults) return hits
        }
      }
    }
  }
  
  return hits
}
