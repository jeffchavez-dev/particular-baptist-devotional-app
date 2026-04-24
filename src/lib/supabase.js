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

export function setBibleChapter(chapter, done) {
  const all = getBibleProgress()
  if (done) all[chapter] = true
  else delete all[chapter]
  try { localStorage.setItem(BIBLE_KEY, JSON.stringify(all)) } catch {}
}

export function isBibleChapterDone(chapter) {
  return !!getBibleProgress()[chapter]
}
