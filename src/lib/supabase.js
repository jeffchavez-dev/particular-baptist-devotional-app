import { createClient } from '@supabase/supabase-js'
import { SCHEDULE } from '../data/schedule'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

// ── Bible chapter progress (localStorage) ────────────────────────────────
const BIBLE_KEY = 'pb-bible-progress'

export function getBibleProgress() {
  try { return JSON.parse(localStorage.getItem(BIBLE_KEY) || '{}') }
  catch { return {} }
}

export function setBibleChapter(chapter, done, userId) {
  const all = getBibleProgress()
  if (done) all[chapter] = true
  else delete all[chapter]
  try { localStorage.setItem(BIBLE_KEY, JSON.stringify(all)) } catch {}
  // Fire-and-forget Supabase sync when logged in
  if (userId) {
    if (done) {
      supabase.from('pb_bible_progress')
        .upsert({ user_id: userId, chapter, done: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chapter' })
        .catch(() => {})
    } else {
      supabase.from('pb_bible_progress')
        .delete().match({ user_id: userId, chapter })
        .catch(() => {})
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
