/**
 * multiPlan.js — Multiple named Bible reading plans.
 *
 * Each user can create any number of named plans. One plan is "active" —
 * it is mirrored to the legacy pb-plan-config / pb-plan-progress keys so
 * all existing code (devotional page, KjvReader, BibleTrackerSection) works
 * without changes.
 *
 * Storage keys:
 *   pb-bible-plans      → PlanEntry[]
 *   pb-plan-active-id   → string (id of active plan)
 *
 * Required Supabase SQL (run once in the SQL editor):
 *
 *   create table pb_bible_plans (
 *     id                 text not null,
 *     user_id            uuid references auth.users(id) on delete cascade not null,
 *     name               text not null default 'My Plan',
 *     config             jsonb not null default '{}',
 *     current_index      int  not null default 0,
 *     last_advanced_date text,
 *     started_date       text,
 *     is_active          boolean not null default false,
 *     updated_at         timestamptz default now(),
 *     primary key (user_id, id)
 *   );
 *   alter table pb_bible_plans enable row level security;
 *   create policy "own bible plans" on pb_bible_plans
 *     for all using (auth.uid() = user_id);
 */

import { supabase } from './supabase'
import {
  getPlanConfig, savePlanConfig, clearPlanConfig,
  getPlanProgress, savePlanProgress, resetPlanProgress,
} from './biblePlan'

const PLANS_KEY     = 'pb-bible-plans'
const ACTIVE_ID_KEY = 'pb-plan-active-id'

/* ── Raw storage ──────────────────────────────────────────────────── */

export function getAllPlans() {
  try { return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]') } catch { return [] }
}

function _savePlansRaw(plans) {
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(plans)) } catch {}
  window.dispatchEvent(new CustomEvent('pb-plans-changed'))
}

export function getActivePlanId() {
  try { return localStorage.getItem(ACTIVE_ID_KEY) || null } catch { return null }
}

function _setActivePlanId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_ID_KEY, id)
    else     localStorage.removeItem(ACTIVE_ID_KEY)
  } catch {}
}

export function getActivePlan() {
  const plans = getAllPlans()
  if (!plans.length) return null
  const id = getActivePlanId()
  return plans.find(p => p.id === id) || plans[0] || null
}

/* ── Legacy key mirror ────────────────────────────────────────────── */

/**
 * Mirror a plan's config + progress to the legacy pb-plan-config /
 * pb-plan-progress keys so existing devotional/scripture code sees it.
 */
function _mirrorToLegacy(plan) {
  if (!plan) { clearPlanConfig(); resetPlanProgress(); return }
  const { id: _id, name: _nm, currentIndex, lastAdvancedDate, ...config } = plan
  savePlanConfig(config)
  savePlanProgress({ currentIndex: currentIndex ?? 0, lastAdvancedDate: lastAdvancedDate ?? null })
}

/**
 * Read the legacy progress keys and write them back into the active plan
 * in the array.  Call this whenever pb-plan-changed fires (i.e. whenever
 * advancePlan / retreatPlan / savePlanProgress updates the legacy key).
 */
export function syncActivePlanFromLegacy() {
  const id = getActivePlanId()
  if (!id) return
  const progress = getPlanProgress()
  const plans = getAllPlans()
  const idx = plans.findIndex(p => p.id === id)
  if (idx === -1) return
  plans[idx] = {
    ...plans[idx],
    currentIndex:      progress.currentIndex ?? 0,
    lastAdvancedDate:  progress.lastAdvancedDate ?? null,
  }
  _savePlansRaw(plans)
}

/* ── Migration ────────────────────────────────────────────────────── */

/**
 * Migrate the old single-plan storage (pb-plan-config / pb-plan-progress)
 * to the multi-plan array.  Safe to call on every app start — no-op if
 * the array already has entries.
 */
export function migrateOldPlan() {
  if (getAllPlans().length > 0) return   // already migrated
  const oldConfig = getPlanConfig()
  if (!oldConfig) return                 // no old plan to migrate
  const oldProgress = getPlanProgress()
  const id = 'plan_' + Date.now().toString(36)
  const plan = {
    id,
    name: oldConfig.name || 'My Plan',
    ...oldConfig,
    currentIndex:     oldProgress?.currentIndex ?? 0,
    lastAdvancedDate: oldProgress?.lastAdvancedDate ?? null,
  }
  _savePlansRaw([plan])
  _setActivePlanId(id)
  // Legacy keys stay as-is (already correct)
}

/* ── CRUD ─────────────────────────────────────────────────────────── */

/**
 * Create a new plan.  config is the same shape as pb-plan-config.
 * If it's the first plan, it becomes active automatically.
 */
export function createPlan(config, name = 'My Plan') {
  const plans = getAllPlans()
  const id    = 'plan_' + Date.now().toString(36)
  const plan  = {
    id,
    name,
    ...config,
    currentIndex:     0,
    lastAdvancedDate: null,
    startedDate:      new Date().toISOString().slice(0, 10),
  }
  plans.push(plan)
  _savePlansRaw(plans)

  if (plans.length === 1) {
    _setActivePlanId(id)
    _mirrorToLegacy(plan)
  }
  return plan
}

/**
 * Update a plan's fields (name, config fields, progress, etc.).
 * If the updated plan is active, also mirrors to legacy keys.
 */
export function updatePlan(id, updates) {
  const plans = getAllPlans()
  const idx   = plans.findIndex(p => p.id === id)
  if (idx === -1) return
  plans[idx] = { ...plans[idx], ...updates, id }
  _savePlansRaw(plans)
  if (id === getActivePlanId()) _mirrorToLegacy(plans[idx])
}

/**
 * Delete a plan.  If it was active, the next plan becomes active (or none).
 */
export function deletePlan(id) {
  const wasActive = id === getActivePlanId()
  const plans     = getAllPlans().filter(p => p.id !== id)
  _savePlansRaw(plans)

  if (wasActive) {
    const next = plans[0] || null
    _setActivePlanId(next?.id || null)
    _mirrorToLegacy(next)
  }
}

/**
 * Make a plan the "active" one — it will be shown in devotional / scripture.
 */
export function setActivePlan(id) {
  const plan = getAllPlans().find(p => p.id === id)
  if (!plan) return
  _setActivePlanId(id)
  _mirrorToLegacy(plan)
  window.dispatchEvent(new CustomEvent('pb-plans-changed'))
}

/* ── Supabase sync ────────────────────────────────────────────────── */

export async function syncMultiPlansUp(userId) {
  const plans = getAllPlans()
  if (!plans.length) return { success: true, count: 0 }
  const activeId = getActivePlanId()
  try {
    const rows = plans.map(({ id, name, currentIndex, lastAdvancedDate, startedDate, ...rest }) => ({
      id,
      user_id:           userId,
      name,
      config:            rest,
      current_index:     currentIndex ?? 0,
      last_advanced_date: lastAdvancedDate ?? null,
      started_date:      startedDate ?? null,
      is_active:         id === activeId,
      updated_at:        new Date().toISOString(),
    }))
    const { error } = await supabase.from('pb_bible_plans')
      .upsert(rows, { onConflict: 'user_id,id' })
    if (error) throw error
    return { success: true, count: rows.length }
  } catch (e) {
    console.warn('[multiPlan] syncUp:', e?.message)
    return { success: false, error: e?.message }
  }
}

export async function syncMultiPlansDown(userId) {
  try {
    const { data, error } = await supabase.from('pb_bible_plans')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    if (!data?.length) return { success: true, count: 0 }

    const local    = getAllPlans()
    const localMap = Object.fromEntries(local.map(p => [p.id, p]))
    let changed    = false

    data.forEach(row => {
      const existing = localMap[row.id]
      const remote   = {
        id:               row.id,
        name:             row.name,
        ...row.config,
        currentIndex:     row.current_index ?? 0,
        lastAdvancedDate: row.last_advanced_date ?? null,
        startedDate:      row.started_date ?? null,
      }
      if (!existing) {
        // New plan from another device
        localMap[row.id] = remote
        changed = true
      } else {
        // Keep whichever has more progress
        if ((row.current_index ?? 0) > (existing.currentIndex ?? 0)) {
          localMap[row.id] = { ...existing, ...remote }
          changed = true
        }
      }
    })

    if (!changed) return { success: true, count: 0 }

    const merged = Object.values(localMap)
    _savePlansRaw(merged)

    // If active plan was updated, mirror to legacy
    const activeId  = getActivePlanId()
    const activePlan = merged.find(p => p.id === activeId)
    if (activePlan) _mirrorToLegacy(activePlan)

    return { success: true, count: data.length }
  } catch (e) {
    console.warn('[multiPlan] syncDown:', e?.message)
    return { success: false, error: e?.message }
  }
}
