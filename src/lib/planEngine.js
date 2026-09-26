/**
 * planEngine.js — Pure Bible-reading-plan computation, extracted from biblePlan.js.
 *
 * No localStorage, no window, no Supabase import — safe to import from a plain
 * Node environment (e.g. Vercel serverless functions), not just the Vite app.
 * Callers pass in `config`/`progress` objects themselves.
 */

import { BIBLE_BOOKS } from './bibleBooks'
import { PLAN_BY_ID } from '../data/bibleReadingPlans'

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

/** Returns true if today (or a given Date) is a rest day per the config. */
export function isTodayRestDay(config, date = new Date()) {
  if (!config?.restDays?.length) return false
  return config.restDays.includes(date.getDay()) // 0=Sun … 6=Sat
}

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
