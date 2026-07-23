/**
 * biblePlan.js — Core engine for the flexible Bible reading plan.
 *
 * Storage keys:
 *   pb-plan-config    → plan configuration (preset, pace, rest days, range)
 *   pb-plan-progress  → { currentIndex, lastAdvancedDate }
 *
 * Invariant: all functions are pure-logic; side-effects (localStorage writes,
 * setBibleChapter) are explicit. Nothing here touches React state.
 */

import { BIBLE_BOOKS } from './bibleBooks'
import { READING_PLANS, PLAN_BY_ID } from '../data/bibleReadingPlans'
import { getBibleProgress, setBibleChapter } from './supabase'
import { localDateStr } from './dateUtils'

/* ── Storage ──────────────────────────────────────────────────────── */
const CONFIG_KEY   = 'pb-plan-config'
const PROGRESS_KEY = 'pb-plan-progress'
export const PLAN_COMPLETE_KEY = 'pb-plan-completions'

export function getPlanConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') } catch { return null }
}
export function savePlanConfig(config) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-plan-changed'))
}
export function clearPlanConfig() {
  try { localStorage.removeItem(CONFIG_KEY) } catch {}
  window.dispatchEvent(new CustomEvent('pb-plan-changed'))
}

export function getPlanProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null') || { currentIndex: 0, lastAdvancedDate: null }
  } catch { return { currentIndex: 0, lastAdvancedDate: null } }
}
export function savePlanProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-plan-changed'))
}
export function resetPlanProgress() {
  try { localStorage.removeItem(PROGRESS_KEY) } catch {}
  window.dispatchEvent(new CustomEvent('pb-plan-changed'))
}

/* Plan completion log */
export function getPlanCompletions() {
  try { return JSON.parse(localStorage.getItem(PLAN_COMPLETE_KEY) || '[]') } catch { return [] }
}
export function addPlanCompletion(config) {
  const all = getPlanCompletions()
  const preset = PLAN_BY_ID[config.planId]
  all.push({
    id: Date.now(),
    planId: config.planId,
    // Use custom plan name if set, otherwise fall back to preset label
    label: config.name || preset?.label || config.planId,
    chaptersPerDay: config.chaptersPerDay,
    startedDate: config.startedDate,
    completedDate: new Date().toISOString().slice(0, 10),
  })
  try { localStorage.setItem(PLAN_COMPLETE_KEY, JSON.stringify(all)) } catch {}
  return all
}

/* ── Chapter sequence computation ────────────────────────────────── */

/**
 * Returns the full ordered list of chapter strings for a given config.
 * e.g. ["Genesis 1", "Genesis 2", ..., "Revelation 22"]
 */
export function computePlanChapters(config) {
  if (!config) return []

  const preset = PLAN_BY_ID[config.planId]

  // Custom chapter order (chronological plans etc.)
  if (preset?.chapterOrder?.length) return preset.chapterOrder

  // Derive from BIBLE_BOOKS based on scope
  let books = BIBLE_BOOKS
  if (config.planId === 'ot-only' || preset?.scope === 'ot') {
    books = BIBLE_BOOKS.filter(b => b.testament === 'OT')
  } else if (config.planId === 'nt-only' || preset?.scope === 'nt') {
    books = BIBLE_BOOKS.filter(b => b.testament === 'NT')
  }

  // Build full chapter list for the book set
  const allChapters = []
  for (const bk of books) {
    for (let ch = 1; ch <= bk.chapters; ch++) {
      allChapters.push(`${bk.name} ${ch}`)
    }
  }

  // Custom range — slice from startBook:startChapter to endBook:endChapter
  if (config.planId === 'custom') {
    const startIdx = allChapters.findIndex(c => c === `${config.startBook} ${config.startChapter}`)
    const endIdx   = allChapters.findIndex(c => c === `${config.endBook} ${config.endChapter}`)
    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      return allChapters.slice(startIdx, endIdx + 1)
    }
    // Fallback if range is bad
    return allChapters
  }

  return allChapters
}

/* ── Rest day helpers ─────────────────────────────────────────────── */

/** Returns true if today (or a given Date) is a rest day per the config. */
export function isTodayRestDay(config, date = new Date()) {
  if (!config?.restDays?.length) return false
  return config.restDays.includes(date.getDay()) // 0=Sun … 6=Sat
}

/* ── Current reading ─────────────────────────────────────────────── */

/**
 * Returns the chapter(s) the user should read today, or null on a rest day
 * or when the plan is complete.
 * Returns an array of strings (1 or 2 items based on chaptersPerDay).
 */
export function getCurrentPlanChapters(config, progress) {
  if (!config) return null
  if (isTodayRestDay(config)) return null

  const chapters = computePlanChapters(config)
  if (!chapters.length) return null

  const cpd = config.chaptersPerDay || 1
  const idx = progress?.currentIndex ?? 0

  if (idx >= chapters.length) return null // plan complete

  const result = []
  for (let i = 0; i < cpd; i++) {
    if (idx + i < chapters.length) result.push(chapters[idx + i])
  }
  return result.length ? result : null
}

/**
 * True when the plan is fully read (currentIndex ≥ total chapters).
 */
export function isPlanComplete(config, progress) {
  if (!config) return false
  const chapters = computePlanChapters(config)
  return (progress?.currentIndex ?? 0) >= chapters.length
}

/* ── Advancing the plan ───────────────────────────────────────────── */

/**
 * Mark today's chapter(s) as read and advance the plan index.
 * Returns the updated progress object (caller should save it).
 * Also marks each chapter done in the Bible tracker.
 *
 * @param {object} config   - plan config
 * @param {object} progress - current plan progress
 * @param {string|null} userId - for Supabase sync
 * @returns {{ progress, completed }} - updated progress + whether plan just finished
 */
export function advancePlan(config, progress, userId = null) {
  const chapters = computePlanChapters(config)
  const cpd      = config.chaptersPerDay || 1
  const idx      = progress?.currentIndex ?? 0
  const today    = localDateStr()

  // Mark each chapter done in the Bible tracker.
  // skipPlanSync = true prevents the global plan-sync listener from firing
  // again (we're already advancing the plan here).
  for (let i = 0; i < cpd; i++) {
    const ch = chapters[idx + i]
    if (ch) setBibleChapter(ch, true, userId, true)
  }

  const newIndex    = idx + cpd
  const newProgress = { currentIndex: newIndex, lastAdvancedDate: today }
  const completed   = newIndex >= chapters.length

  if (completed) addPlanCompletion(config)

  return { progress: newProgress, completed }
}

/**
 * Un-mark today's chapter(s) (uncheck) and retreat the plan index.
 */
export function retreatPlan(config, progress, userId = null) {
  const chapters = computePlanChapters(config)
  const cpd      = config.chaptersPerDay || 1
  const idx      = progress?.currentIndex ?? 0

  // Un-mark chapters in the tracker (skipPlanSync = true to avoid loop)
  for (let i = 0; i < cpd; i++) {
    const ch = chapters[idx - cpd + i]
    if (ch) setBibleChapter(ch, false, userId, true)
  }

  const newIndex    = Math.max(0, idx - cpd)
  const newProgress = { currentIndex: newIndex, lastAdvancedDate: null }
  return newProgress
}

/* ── Stats ────────────────────────────────────────────────────────── */

/**
 * Returns display stats for the current plan.
 */
export function getPlanStats(config, progress) {
  if (!config) return null
  const chapters    = computePlanChapters(config)
  const total       = chapters.length
  const done        = Math.min(progress?.currentIndex ?? 0, total)
  const remaining   = total - done
  const pct         = total > 0 ? Math.round((done / total) * 100) : 0
  const cpd         = config.chaptersPerDay || 1
  const restPerWeek = (config.restDays || []).length
  const readPerWeek = 7 - restPerWeek
  const chPerWeek   = cpd * readPerWeek
  const weeksLeft   = chPerWeek > 0 ? remaining / chPerWeek : Infinity
  const daysLeft    = Math.ceil(weeksLeft * 7)

  let projectedEnd = null
  if (isFinite(daysLeft)) {
    const d = new Date()
    d.setDate(d.getDate() + daysLeft)
    projectedEnd = d.toISOString().slice(0, 10)
  }

  return { total, done, remaining, pct, daysLeft, projectedEnd }
}

/**
 * Checks the Bible progress store and returns which of today's assigned
 * chapters are already marked done (handles manual checks from tracker).
 */
export function areTodayChaptersDone(config, progress) {
  const todays = getCurrentPlanChapters(config, progress)
  if (!todays?.length) return false
  const bibleProgress = getBibleProgress()
  return todays.every(ch => !!bibleProgress[ch])
}

/**
 * Called from the global pb-bible-chapter-changed listener whenever a chapter
 * is marked done/undone externally (scripture mark-read, tracker grid checkbox).
 *
 * If the chapter matches today's active-plan chapter(s) and all of them are
 * now done, advances the plan index automatically (without re-calling
 * setBibleChapter since the chapter is already written).  If unchecked and the
 * plan was advanced today, retreats the index.
 */
export function tryAdvancePlanForChapter(chapter, done) {
  const config = getPlanConfig()
  if (!config) return

  const progress = getPlanProgress()
  const today    = localDateStr()

  const todays = getCurrentPlanChapters(config, progress)
  if (!todays?.length || !todays.includes(chapter)) return

  if (done) {
    // Guard: already advanced today (e.g. via devotional checkmark)
    if (progress.lastAdvancedDate === today) return
    // Only advance once ALL of today's chapters are marked
    const bp      = getBibleProgress()
    const allDone = todays.every(ch => !!bp[ch])
    if (!allDone) return

    const cpd      = config.chaptersPerDay || 1
    const chapters = computePlanChapters(config)
    const newIndex = progress.currentIndex + cpd
    const complete = newIndex >= chapters.length
    if (complete) addPlanCompletion(config)
    savePlanProgress({ currentIndex: newIndex, lastAdvancedDate: today })
  } else {
    // Retreat only if the plan was already advanced today
    if (progress.lastAdvancedDate !== today) return
    const cpd      = config.chaptersPerDay || 1
    const newIndex = Math.max(0, progress.currentIndex - cpd)
    savePlanProgress({ currentIndex: newIndex, lastAdvancedDate: null })
  }

  // Notify listeners (Dashboard re-reads progress, App.jsx syncs multi-plan array).
  window.dispatchEvent(new CustomEvent('pb-plan-changed'))
}
