import { createClient } from '@supabase/supabase-js'
import { DAY_BIBLE } from '../data/readingPlan'
import { LBCF1 } from '../data/lbcf1'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Schedule generation ───────────────────────────────────────────────
const mShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const mDays  = [31,28,31,30,31,30,31,31,30,31,30,31]

function dateStr(n) {
  let d = n - 1, m = 0
  while (d >= mDays[m]) { d -= mDays[m]; m++ }
  return mShort[m] + ' ' + (d + 1)
}

const chapters = [
  {ch:1,t:'Of the Holy Scriptures',p:10},{ch:2,t:'Of God and of the Holy Trinity',p:3},
  {ch:3,t:"Of God's Decree",p:7},{ch:4,t:'Of Creation',p:3},
  {ch:5,t:'Of Divine Providence',p:7},{ch:6,t:'Of the Fall of Man',p:5},
  {ch:7,t:"Of God's Covenant",p:3},{ch:8,t:'Of Christ the Mediator',p:10},
  {ch:9,t:'Of Free Will',p:5},{ch:10,t:'Of Effectual Calling',p:4},
  {ch:11,t:'Of Justification',p:6},{ch:12,t:'Of Adoption',p:1},
  {ch:13,t:'Of Sanctification',p:3},{ch:14,t:'Of Saving Faith',p:3},
  {ch:15,t:'Of Repentance unto Life',p:5},{ch:16,t:'Of Good Works',p:7},
  {ch:17,t:'Of Perseverance of the Saints',p:3},{ch:18,t:'Of Assurance of Grace',p:4},
  {ch:19,t:'Of the Law of God',p:7},{ch:20,t:'Of the Gospel',p:4},
  {ch:21,t:'Of Christian Liberty',p:3},{ch:22,t:'Of Religious Worship & Sabbath',p:8},
  {ch:23,t:'Of Lawful Oaths and Vows',p:5},{ch:24,t:'Of the Civil Magistrate',p:3},
  {ch:25,t:'Of Marriage',p:4},{ch:26,t:'Of the Church',p:15},
  {ch:27,t:'Of Communion of Saints',p:2},{ch:28,t:'Of Baptism and the Lord\'s Supper',p:2},
  {ch:29,t:'Of Baptism',p:4},{ch:30,t:"Of the Lord's Supper",p:8},
  {ch:31,t:'Of the State after Death',p:3},{ch:32,t:'Of the Last Judgment',p:3},
]

const lbcf2 = []
chapters.forEach(c => { for(let p=1;p<=c.p;p++) lbcf2.push({src:'2LBCF',reading:`Ch. ${c.ch} §${p}`,detail:c.t,link:`https://www.the1689confession.com/1689/chapter-${c.ch}`}) })

const catechism = Array.from({length:114},(_,i)=>({
  src:'Catechism',
  reading:`Q&A #${i+1}`,
  detail:'The Baptist Catechism (Keach\'s)',
  link:`https://baptistcatechism.org/${i+1}/`
}))

// Derive 1LBCF article list directly from the data file so titles are always accurate
const lbcf1 = Object.entries(LBCF1).map(([num, item]) => ({
  src: '1LBCF',
  reading: `Article ${num}`,
  detail: item.title,
  link: `https://london1644.info/en/fulltext.html#artikel${String(parseInt(num)).padStart(2,'0')}`,
}))

const reviewPrompts = [
  'Revisit your favourite reading from this week',
  'Meditate on a Scripture tied to this week\'s doctrine',
  'Write a short reflection — what stood out most?',
  'Discuss this week\'s readings with a friend or family',
  'Pray through a doctrine you studied this week',
  'Read a related passage from the Psalms',
  'Journal your thoughts on this week\'s theme',
]

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

export function buildSchedule() {
  const pool = []
  let i2=0, iC=0, i1=0, iR=0
  for (let day=1; day<=365; day++) {
    if (day % 7 === 0) {
      pool.push({day, date:dateStr(day), src:'Review', reading:'Weekly review & reflection', detail:reviewPrompts[iR%reviewPrompts.length], link:null, bibleChapter: DAY_BIBLE[day] || null})
      iR++
    } else {
      const turn = (day - Math.floor(day/7)) % 3
      let pushed = false
      const tryPush = (arr, idx) => { if(idx < arr.length){pool.push({day,date:dateStr(day),...arr[idx], bibleChapter: DAY_BIBLE[day] || null});return true;}return false; }
      if      (turn===0 && tryPush(lbcf2,i2))    { i2++;  pushed=true }
      else if (turn===1 && tryPush(catechism,iC)) { iC++;  pushed=true }
      else if (turn===2 && tryPush(lbcf1,i1))     { i1++;  pushed=true }
      if (!pushed) {
        if      (tryPush(lbcf2,i2))    i2++
        else if (tryPush(catechism,iC)) iC++
        else if (tryPush(lbcf1,i1))     i1++
      }
    }
  }
  return pool
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
