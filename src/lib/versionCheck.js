/**
 * versionCheck.js — App version detection and update utilities.
 *
 * How it works:
 *  • `public/version.json` holds the current release info (version, date, changelog).
 *    It is intentionally EXCLUDED from the Workbox precache so it always comes
 *    from the network — that is how the app detects that a new version has deployed.
 *  • The installed version is persisted in localStorage under INSTALLED_KEY.
 *  • When the fetched version differs from the stored one, an update is available.
 *  • The service worker already silently downloads and activates the new build in
 *    the background (registerType: 'autoUpdate').  Applying the update is simply
 *    reloading the page after storing the new version.
 *
 * Developer workflow — bump the version before every commit you want users to see:
 *  1. Edit `public/version.json` — increment "version" (1.0 → 1.1) and update
 *     "date" and "changelog".
 *  2. Commit + deploy as usual.
 *  3. On next app open the user sees the "Update" button with the changelog text.
 */

const INSTALLED_KEY = 'pb-app-version'

/** The version string stored when the user last applied an update. */
export function getInstalledVersion() {
  try { return localStorage.getItem(INSTALLED_KEY) || null } catch { return null }
}

/** Persist the version that just finished installing. */
export function setInstalledVersion(version) {
  try { localStorage.setItem(INSTALLED_KEY, String(version)) } catch {}
}

/**
 * Fetch version.json directly from the server.
 * The `cache: 'no-store'` header + unique query string prevents both the
 * browser HTTP cache and the service worker precache from serving a stale copy.
 *
 * Returns `{ version, date, changelog }` or `null` on network error / offline.
 */
export async function fetchRemoteVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
