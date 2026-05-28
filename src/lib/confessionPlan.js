/**
 * confessionPlan.js — Engine for the confession/catechism reading plan.
 *
 * Storage keys:
 *   pb-conf-plan-config    → { planId, restDays, mode, startedDate }
 *   pb-conf-plan-progress  → { currentIndex, lastAdvancedDate }
 *   pb-conf-completions    → [{ id, planId, label, completedDate }]
 *
 * mode: 'once'  — read all items once (non-cyclic, used for 'all' plan and optional single plans)
 *       'year'  — read cyclically to fill 1 year of reading days
 *
 * One item is always read per reading day (no chaptersPerDay equivalent).
 */

import { LBCF1 }             from '../data/lbcf1'
import { LBCF2 }             from '../data/lbcf2'
import { CATECHISM }         from '../data/catechism'
import { ORTHODOX_CATECHISM } from '../data/orthodoxCatechism'
import { CONF_PLAN_BY_ID }   from '../data/confessionPlans'
import { localDateStr }      from './dateUtils'

/* ── Storage ──────────────────────────────────────────────────────── */
const CONF_CONFIG_KEY   = 'pb-conf-plan-config'
const CONF_PROGRESS_KEY = 'pb-conf-plan-progress'
export const CONF_COMPLETE_KEY = 'pb-conf-completions'

export function getConfPlanConfig() {
  try { return JSON.parse(localStorage.getItem(CONF_CONFIG_KEY) || 'null') } catch { return null }
}
export function saveConfPlanConfig(config) {
  try { localStorage.setItem(CONF_CONFIG_KEY, JSON.stringify(config)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
}
export function clearConfPlanConfig() {
  try { localStorage.removeItem(CONF_CONFIG_KEY) } catch {}
  window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
}

export function getConfPlanProgress() {
  try {
    return JSON.parse(localStorage.getItem(CONF_PROGRESS_KEY) || 'null') || { currentIndex: 0, lastAdvancedDate: null }
  } catch { return { currentIndex: 0, lastAdvancedDate: null } }
}
export function saveConfPlanProgress(progress) {
  try { localStorage.setItem(CONF_PROGRESS_KEY, JSON.stringify(progress)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
}
export function resetConfPlanProgress() {
  try { localStorage.removeItem(CONF_PROGRESS_KEY) } catch {}
  window.dispatchEvent(new CustomEvent('pb-conf-plan-changed'))
}

export function getConfCompletions() {
  try { return JSON.parse(localStorage.getItem(CONF_COMPLETE_KEY) || '[]') } catch { return [] }
}
function addConfCompletion(config) {
  const all    = getConfCompletions()
  const preset = CONF_PLAN_BY_ID[config.planId]
  all.push({
    id:            Date.now(),
    planId:        config.planId,
    label:         preset?.label || config.planId,
    mode:          config.mode,
    completedDate: new Date().toISOString().slice(0, 10),
  })
  try { localStorage.setItem(CONF_COMPLETE_KEY, JSON.stringify(all)) } catch {}
  return all
}

/* ── Item sequence builders ───────────────────────────────────────── */

function buildLBCF1Items() {
  return Object.keys(LBCF1)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(k => ({
      planId: '1lbcf',
      key:    k,
      label:  `Article ${k}`,
      title:  LBCF1[k]?.title || '',
    }))
}

function buildLBCF2Items() {
  return Object.keys(LBCF2)
    .filter(k => !k.startsWith('0.'))       // skip preamble
    .sort((a, b) => {
      const [ac, as_] = a.split('.').map(Number)
      const [bc, bs]  = b.split('.').map(Number)
      return ac !== bc ? ac - bc : as_ - bs
    })
    .map(k => {
      const [ch, sec] = k.split('.')
      return { planId: '2lbcf', key: k, label: `Ch. ${ch} §${sec}` }
    })
}

function buildCatechismItems() {
  return Object.keys(CATECHISM)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(k => ({
      planId: 'catechism',
      key:    k,
      label:  `Q&A #${k}`,
      q:      CATECHISM[k]?.q || '',
    }))
}

function buildOrthodoxItems() {
  return Object.keys(ORTHODOX_CATECHISM)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(k => ({
      planId: 'orthodox',
      key:    k,
      label:  `Q&A #${k}`,
      q:      ORTHODOX_CATECHISM[k]?.q || '',
    }))
}

/**
 * Returns the ordered list of items for a given planId.
 * 'three' = 2LBCF → Catechism → 1LBCF  (default companion plan)
 * 'all'   = 2LBCF → Catechism → 1LBCF → Orthodox (legacy / all four)
 */
export function computeConfItems(planId) {
  if (planId === '1lbcf')     return buildLBCF1Items()
  if (planId === '2lbcf')     return buildLBCF2Items()
  if (planId === 'catechism') return buildCatechismItems()
  if (planId === 'orthodox')  return buildOrthodoxItems()
  if (planId === 'three')
    return [
      ...buildLBCF2Items(),
      ...buildCatechismItems(),
      ...buildLBCF1Items(),
    ]
  if (planId === 'all')
    return [
      ...buildLBCF2Items(),
      ...buildCatechismItems(),
      ...buildLBCF1Items(),
      ...buildOrthodoxItems(),
    ]
  return []
}

/* ── Rest day helpers ─────────────────────────────────────────────── */

export function isTodayConfRestDay(config, date = new Date()) {
  if (!config?.restDays?.length) return false
  return config.restDays.includes(date.getDay())
}

/* ── Total reading days for 'year' mode ──────────────────────────── */

function yearReadingDays(restDays) {
  const readPerWeek = 7 - (restDays || []).length
  return Math.round(365 * readPerWeek / 7)
}

/* ── Current item ─────────────────────────────────────────────────── */

/**
 * Returns the item the user should read today, or null if rest day / complete.
 * { planId, key, label, title?, q? }
 */
export function getCurrentConfItem(config, progress) {
  if (!config) return null
  if (isTodayConfRestDay(config)) return null

  const items = computeConfItems(config.planId)
  if (!items.length) return null

  const idx = progress?.currentIndex ?? 0

  if (config.mode === 'year') {
    const totalDays = yearReadingDays(config.restDays)
    if (idx >= totalDays) return null  // year complete
    return items[idx % items.length]
  }

  // 'once' mode
  if (idx >= items.length) return null
  return items[idx]
}

export function isConfPlanComplete(config, progress) {
  if (!config) return false
  const items = computeConfItems(config.planId)
  const idx   = progress?.currentIndex ?? 0
  if (config.mode === 'year') {
    return idx >= yearReadingDays(config.restDays)
  }
  return idx >= items.length
}

/* ── Advance / retreat ────────────────────────────────────────────── */

export function advanceConfPlan(config, progress) {
  const items    = computeConfItems(config.planId)
  const idx      = progress?.currentIndex ?? 0
  const today    = localDateStr()
  const newIndex = idx + 1
  const complete = config.mode === 'year'
    ? newIndex >= yearReadingDays(config.restDays)
    : newIndex >= items.length

  if (complete) addConfCompletion(config)

  return { progress: { currentIndex: newIndex, lastAdvancedDate: today }, completed: complete }
}

export function retreatConfPlan(progress) {
  const newIndex = Math.max(0, (progress?.currentIndex ?? 0) - 1)
  return { currentIndex: newIndex, lastAdvancedDate: null }
}

/* ── Stats ────────────────────────────────────────────────────────── */

export function getConfPlanStats(config, progress) {
  if (!config) return null
  const items       = computeConfItems(config.planId)
  const idx         = progress?.currentIndex ?? 0
  const restPerWeek = (config.restDays || []).length
  const readPerWeek = 7 - restPerWeek

  if (config.mode === 'year') {
    const totalDays   = yearReadingDays(config.restDays)
    const done        = Math.min(idx, totalDays)
    const pct         = totalDays > 0 ? Math.round((done / totalDays) * 100) : 0
    const cyclesDone  = Math.floor(done / (items.length || 1))
    const itemPos     = done % (items.length || 1)
    return { mode: 'year', total: totalDays, done, pct, cyclesDone, itemPos, itemsCount: items.length }
  }

  // 'once' mode
  const total       = items.length
  const done        = Math.min(idx, total)
  const pct         = total > 0 ? Math.round((done / total) * 100) : 0
  const remaining   = total - done
  const daysLeft    = readPerWeek > 0 ? Math.ceil(remaining / readPerWeek * 7) : Infinity

  let projectedEnd = null
  if (isFinite(daysLeft)) {
    const d = new Date()
    d.setDate(d.getDate() + daysLeft)
    projectedEnd = d.toISOString().slice(0, 10)
  }

  return { mode: 'once', total, done, pct, remaining, daysLeft, projectedEnd, itemsCount: items.length }
}

/* ── Default guest plan (all 4 in order, no progress stored) ─────── */

export function getGuestDefaultStats() {
  const items     = computeConfItems('all')
  const total     = items.length        // 474
  const daysLeft  = total               // 1 per day, no rest
  const d         = new Date()
  d.setDate(d.getDate() + daysLeft)
  const projectedEnd = d.toISOString().slice(0, 10)
  return { total, projectedEnd, daysLeft }
}
