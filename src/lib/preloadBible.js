/**
 * preloadBible.js — DEPRECATED (kept for backward compatibility)
 *
 * Bible JSON files are now included in the Workbox precache via globPatterns
 * in vite.config.js.  They are downloaded once during PWA installation and
 * served from cache on every subsequent open — no per-launch fetching needed.
 *
 * This file is a no-op and can be removed once all call-sites are cleaned up.
 */

// eslint-disable-next-line no-empty-function
export function preloadBibleData() {}
