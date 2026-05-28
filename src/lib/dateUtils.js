/**
 * dateUtils.js — Shared date helpers.
 *
 * IMPORTANT: always use localDateStr() instead of
 * new Date().toISOString().slice(0, 10) for anything that is
 * compared against the user's calendar day.
 *
 * toISOString() returns UTC time.  For users in UTC+ timezones the
 * UTC date is still "yesterday" for hours after their local midnight,
 * so plan-advancement guards like (lastAdvancedDate === todayStr)
 * would fire incorrectly until UTC finally rolls over.
 */

/**
 * Returns the current local date as "YYYY-MM-DD".
 * Equivalent to toISOString() but uses the device's local timezone.
 */
export function localDateStr(d = new Date()) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
