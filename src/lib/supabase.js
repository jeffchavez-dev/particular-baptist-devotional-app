import { createClient } from '@supabase/supabase-js'
import { SCHEDULE } from '../data/schedule'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Retry helper for Supabase operations ─────────────────────────────────────
async function _retrySupabaseOp(fn, maxAttempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const backoff = 500 * Math.pow(2, attempt - 1) // exponential: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, backoff))
      }
    }
  }
  console.error('[supabase] Supabase operation failed after', maxAttempts, 'attempts:', lastError?.message)
  throw lastError
}

// ── Guest progress (localStorage) ────────────────────────────────────
const LOCAL_KEY = 'devotional_guest_progress'

export function getLocalProgress() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') }
  catch { return {} }
}

export function setLocalProgress(dayNumber, fields) {
  const all = getLocalProgress()
  all[dayNumber] = { ...(all[dayNumber] || {}), ...fields }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all))
}

export async function migrateLocalToSupabase(userId) {
  const local = getLocalProgress()
  const entries = Object.entries(local)
  if (!entries.length) return
  const rows = entries.map(([day, d]) => ({
    user_id: userId,
    day_number: parseInt(day),
    completed: !!d.completed,
    notes: d.notes || '',
    updated_at: new Date().toISOString(),
  }))
  await supabase.from('progress').upsert(rows, { onConflict: 'user_id,day_number' })
  localStorage.removeItem(LOCAL_KEY)
}

export function getTodayDayNum() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
}

// Returns the static schedule (days 1-360 from CSV; days 361-365 return null via SCHEDULE_BY_DAY)
export function buildSchedule() {
  return SCHEDULE
}

// Orthodox Catechism has 148 questions; cycle through them across 365 days.
export const ORTHODOX_Q_COUNT = 148
export function getOrthodoxForDay(day) {
  const num = ((day - 1) % ORTHODOX_Q_COUNT) + 1
  return num
}

// ── Bible chapter progress (localStorage) ────────────────────────────────
export const BIBLE_KEY = 'pb-bible-progress'

export function getBibleProgress() {
  try { return JSON.parse(localStorage.getItem(BIBLE_KEY) || '{}') }
  catch { return {} }
}

/**
 * @param {boolean} [skipPlanSync=false] - Pass true when called from within
 *   advancePlan/retreatPlan so we don't fire a plan-sync loop.
 */
export function setBibleChapter(chapter, done, userId, skipPlanSync = false) {
  const all = getBibleProgress()
  if (done) all[chapter] = true
  else delete all[chapter]
  try { localStorage.setItem(BIBLE_KEY, JSON.stringify(all)) } catch {}

  // Dispatch event for immediate UI updates (storage listeners)
  window.dispatchEvent(new StorageEvent('storage', { key: BIBLE_KEY }))

  // Notify plan-sync bridge (KjvReader mark-read, tracker grid, etc.)
  // Skip when called from advancePlan/retreatPlan to prevent double-advance.
  if (!skipPlanSync) {
    window.dispatchEvent(new CustomEvent('pb-bible-chapter-changed', { detail: { chapter, done } }))
  }
  
  // Async Supabase sync with retry (fire-and-forget, but with proper error handling)
  if (userId) {
    if (done) {
      _retrySupabaseOp(
        () => supabase.from('pb_bible_progress')
          .upsert({ user_id: userId, chapter, done: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chapter' })
      ).catch(e => console.warn('[setBibleChapter] upsert failed:', e?.message))
    } else {
      _retrySupabaseOp(
        () => supabase.from('pb_bible_progress')
          .delete().match({ user_id: userId, chapter })
      ).catch(e => console.warn('[setBibleChapter] delete failed:', e?.message))
    }
  }
}

export function isBibleChapterDone(chapter) {
  return !!getBibleProgress()[chapter]
}

// ── Bible progress Supabase sync ─────────────────────────────────────────────
// Required Supabase table (run once in your project):
//
//   create table pb_bible_progress (
//     id uuid default gen_random_uuid() primary key,
//     user_id uuid references auth.users(id) on delete cascade not null,
//     chapter text not null,
//     done boolean not null default true,
//     updated_at timestamptz default now(),
//     unique(user_id, chapter)
//   );
//   alter table pb_bible_progress enable row level security;
//   create policy "own bible progress" on pb_bible_progress
//     for all using (auth.uid() = user_id);

export async function syncBibleProgressUp(userId) {
  const all = getBibleProgress()
  const done = Object.keys(all).filter(ch => all[ch])
  if (!done.length) return
  try {
    const rows = done.map(chapter => ({
      user_id: userId, chapter, done: true, updated_at: new Date().toISOString(),
    }))
    await supabase.from('pb_bible_progress')
      .upsert(rows, { onConflict: 'user_id,chapter' })
  } catch (e) { console.warn('[bible-progress] sync up:', e?.message) }
}

export async function syncBibleProgressDown(userId) {
  try {
    const { data, error } = await supabase
      .from('pb_bible_progress')
      .select('chapter,done')
      .eq('user_id', userId)
    if (error || !data) return
    const merged = getBibleProgress()
    data.forEach(r => {
      if (r.done) merged[r.chapter] = true
      else delete merged[r.chapter]
    })
    try { localStorage.setItem(BIBLE_KEY, JSON.stringify(merged)) } catch {}
    // Dispatch a storage event so open pages (AchievementsSection etc.) react
    window.dispatchEvent(new StorageEvent('storage', { key: BIBLE_KEY }))
  } catch (e) { console.warn('[bible-progress] sync down:', e?.message) }
}

// ── Bookmarks (localStorage) ─────────────────────────────────────────────
const BOOKMARK_KEY = 'pb-bookmarks'

export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '{}') }
  catch { return {} }
}

export function toggleBookmark(day) {
  const all = getBookmarks()
  if (all[day]) delete all[day]
  else all[day] = true
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(all)) } catch {}
  return !!all[day]
}

export function isBookmarked(day) {
  return !!getBookmarks()[day]
}

// ── Manual Sync Functions (user-initiated from settings) ──────────────────────
/**
 * Sync devotional progress UP to Supabase (when logged in).
 * Saves locally first, then pushes to cloud if user is signed in.
 */
export async function syncProgressUp(userId) {
  if (!userId) return { success: false, message: 'Not logged in' }
  try {
    const local = getLocalProgress()
    const rows = Object.entries(local).map(([day, data]) => ({
      user_id: userId,
      day_number: parseInt(day),
      completed: !!data.completed,
      notes: data.notes || '',
      // Preserve the original updated_at so we don't stamp a newer timestamp
      // on old data — prevents desktop from beating mobile's real progress
      updated_at: data.updated_at || new Date().toISOString(),
    }))
    if (!rows.length) return { success: true, message: 'No local progress to sync' }

    // Use ignoreDuplicates so existing Supabase rows are not overwritten by
    // local rows that may be older (the down-sync + timestamp comparison handles merging)
    const { error } = await supabase
      .from('progress')
      .upsert(rows, { onConflict: 'user_id,day_number', ignoreDuplicates: false })

    if (error) throw error
    return { success: true, message: `Synced ${rows.length} day(s) to cloud`, count: rows.length }
  } catch (e) {
    console.error('[sync-progress-up]', e?.message)
    return { success: false, message: e?.message || 'Sync failed' }
  }
}

/**
 * Sync devotional progress DOWN from Supabase (when logged in).
 * Merges cloud data with local, keeping newest version.
 */
export async function syncProgressDown(userId) {
  if (!userId) return { success: false, message: 'Not logged in' }
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('day_number,completed,notes,updated_at')
      .eq('user_id', userId)
    
    if (error) throw error
    if (!data?.length) return { success: true, message: 'No cloud progress to download', count: 0 }
    
    const local = getLocalProgress()
    let mergedCount = 0
    
    data.forEach(row => {
      const day = String(row.day_number)
      const existing = local[day]
      
      // Use cloud data if it's newer
      const cloudTime = new Date(row.updated_at).getTime()
      const localTime = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0
      
      if (!existing || cloudTime > localTime) {
        local[day] = {
          completed: row.completed,
          notes: row.notes || '',
          updated_at: row.updated_at,
        }
        mergedCount++
      }
    })
    
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)) } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_KEY }))
    
    return { success: true, message: `Downloaded ${mergedCount} day(s) from cloud`, count: mergedCount }
  } catch (e) {
    console.error('[sync-progress-down]', e?.message)
    return { success: false, message: e?.message || 'Sync failed' }
  }
}

/**
 * Sync Bible progress UP to Supabase (when logged in).
 */
export async function syncBibleUp(userId) {
  if (!userId) return { success: false, message: 'Not logged in' }
  try {
    const all = getBibleProgress()
    const done = Object.keys(all).filter(ch => all[ch])
    if (!done.length) return { success: true, message: 'No Bible progress to sync', count: 0 }
    
    const rows = done.map(chapter => ({
      user_id: userId,
      chapter,
      done: true,
      updated_at: new Date().toISOString(),
    }))
    
    const { error } = await supabase
      .from('pb_bible_progress')
      .upsert(rows, { onConflict: 'user_id,chapter' })
    
    if (error) throw error
    return { success: true, message: `Synced ${rows.length} chapter(s) to cloud`, count: rows.length }
  } catch (e) {
    console.error('[sync-bible-up]', e?.message)
    return { success: false, message: e?.message || 'Sync failed' }
  }
}

/**
 * Sync Bible progress DOWN from Supabase (when logged in).
 */
export async function syncBibleDown(userId) {
  if (!userId) return { success: false, message: 'Not logged in' }
  try {
    const { data, error } = await supabase
      .from('pb_bible_progress')
      .select('chapter,done,updated_at')
      .eq('user_id', userId)
    
    if (error) throw error
    if (!data?.length) return { success: true, message: 'No Bible progress to download', count: 0 }
    
    const local = getBibleProgress()
    let mergedCount = 0
    
    data.forEach(row => {
      const existing = local[row.chapter]
      const cloudTime = new Date(row.updated_at).getTime()
      const localTime = 0 // Bible progress doesn't track updated_at locally
      
      if (!existing || (row.done && !existing)) {
        if (row.done) local[row.chapter] = true
        else delete local[row.chapter]
        mergedCount++
      }
    })
    
    try { localStorage.setItem(BIBLE_KEY, JSON.stringify(local)) } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: BIBLE_KEY }))
    
    return { success: true, message: `Downloaded ${mergedCount} chapter(s) from cloud`, count: mergedCount }
  } catch (e) {
    console.error('[sync-bible-down]', e?.message)
    return { success: false, message: e?.message || 'Sync failed' }
  }
}

// ── Generic user-data sync (bookmarks, scripture bookmarks, completions) ──────
// Requires this table in Supabase (run once):
//
//   create table pb_user_data (
//     id uuid default gen_random_uuid() primary key,
//     user_id uuid references auth.users(id) on delete cascade not null,
//     data_key text not null,
//     data_value jsonb not null,
//     updated_at timestamptz default now(),
//     unique(user_id, data_key)
//   );
//   alter table pb_user_data enable row level security;
//   create policy "own user data" on pb_user_data
//     for all using (auth.uid() = user_id);

const USER_DATA_MAP = [
  { local: 'pb-bookmarks',             remote: 'bookmarks' },
  { local: 'pb-scripture-bookmarks',   remote: 'scripture_bookmarks' },
  { local: 'pb-scripture-completions', remote: 'scripture_completions' },
]

export async function syncUserDataUp(userId) {
  if (!userId) return { success: false, count: 0 }
  try {
    const rows = USER_DATA_MAP.map(({ local, remote }) => {
      const raw = localStorage.getItem(local)
      const val = raw ? JSON.parse(raw) : null
      // Skip empty objects/arrays
      if (!val || (Array.isArray(val) ? val.length === 0 : Object.keys(val).length === 0)) return null
      return { user_id: userId, data_key: remote, data_value: val, updated_at: new Date().toISOString() }
    }).filter(Boolean)

    if (rows.length) {
      await supabase.from('pb_user_data').upsert(rows, { onConflict: 'user_id,data_key' })
    }
    return { success: true, count: rows.length }
  } catch (e) {
    // Table may not exist yet — degrade gracefully
    console.warn('[syncUserDataUp]', e?.message)
    return { success: true, count: 0 }
  }
}

export async function syncUserDataDown(userId) {
  if (!userId) return { success: false, count: 0 }
  try {
    const { data, error } = await supabase
      .from('pb_user_data')
      .select('data_key,data_value')
      .eq('user_id', userId)

    if (error || !data?.length) return { success: true, count: 0 }

    data.forEach(({ data_key, data_value }) => {
      const mapping = USER_DATA_MAP.find(k => k.remote === data_key)
      if (mapping && data_value != null) {
        try { localStorage.setItem(mapping.local, JSON.stringify(data_value)) } catch {}
      }
    })
    return { success: true, count: data.length }
  } catch (e) {
    console.warn('[syncUserDataDown]', e?.message)
    return { success: true, count: 0 }
  }
}

/**
 * Full sync: devotional progress, Bible progress, and local-only user data.
 * Books and annotations are synced separately via their own lib functions.
 */
export async function syncAll(userId) {
  if (!userId) return { success: false, message: 'Not logged in' }
  try {
    const [devUp, devDown, bibleUp, bibleDown, udUp, udDown] = await Promise.all([
      syncProgressUp(userId),
      syncProgressDown(userId),
      syncBibleUp(userId),
      syncBibleDown(userId),
      syncUserDataUp(userId),
      syncUserDataDown(userId),
    ])

    const allSuccess = [devUp, devDown, bibleUp, bibleDown, udUp, udDown].every(r => r.success)
    return {
      success: allSuccess,
      message: allSuccess ? 'Sync complete' : 'Sync completed with some errors',
      counts: {
        devotional: (devUp.count || 0) + (devDown.count || 0),
        bible:      (bibleUp.count || 0) + (bibleDown.count || 0),
        userData:   (udUp.count || 0) + (udDown.count || 0),
      },
    }
  } catch (e) {
    console.error('[sync-all]', e?.message)
    return { success: false, message: e?.message || 'Sync failed' }
  }
}
