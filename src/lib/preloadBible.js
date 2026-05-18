/**
 * preloadBible.js
 *
 * Pre-warms the service-worker runtime cache for the Bible data files
 * that the user is most likely to need immediately.
 *
 * Called at app startup (main.jsx) so that by the time the user opens
 * the Bible reader — even if they go offline in between — kjv.json and
 * the Strong's lexicons are already in the SW CacheFirst runtime cache
 * and load instantly.
 *
 * Larger / optional files (tagnt, tahot, lxx, lxx-words, abab, nasb)
 * are intentionally excluded here. They're loaded on demand the first
 * time the user opens those modes, and cached by the SW thereafter.
 */

import { loadBibleVersion } from './bibleVersions'

// Small Strong's lexicon files — fetch directly (they're not loaded via
// loadBibleVersion, so we need a plain fetch to trigger the SW cache).
const LEXICON_URLS = [
  '/strongs-greek.json',   // 695 KB
  '/strongs-hebrew.json',  // 1.2 MB
]

export function preloadBibleData() {
  // Skip if no network — nothing to warm, and we'd just get errors
  if (!navigator.onLine) return

  // --- KJV (default version, 9.3 MB) ---
  // Uses the same loader as KjvReader so the in-memory _versionCache is
  // populated too. That way, if the user opens the Bible reader while the
  // fetch is still in flight, the single Promise is shared (no double-download).
  // The SW CacheFirst handler stores the response so all future loads are instant.
  loadBibleVersion('kjv').catch(() => {})

  // --- Strong's lexicons (small, needed for word-study mode) ---
  // Fire and forget — the SW CacheFirst handler caches each on first fetch.
  LEXICON_URLS.forEach(url => {
    fetch(url).catch(() => {})
  })
}
