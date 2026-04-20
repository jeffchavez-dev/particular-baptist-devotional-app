import { createClient } from '@supabase/supabase-js'

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
  {ch:3,t:"Of God's Decree",p:7},{ch:4,t:'Of Creation',p:4},
  {ch:5,t:'Of Divine Providence',p:7},{ch:6,t:'Of the Fall of Man',p:6},
  {ch:7,t:"Of God's Covenant",p:3},{ch:8,t:'Of Christ the Mediator',p:10},
  {ch:9,t:'Of Free Will',p:5},{ch:10,t:'Of Effectual Calling',p:4},
  {ch:11,t:'Of Justification',p:5},{ch:12,t:'Of Adoption',p:1},
  {ch:13,t:'Of Sanctification',p:3},{ch:14,t:'Of Saving Faith',p:3},
  {ch:15,t:'Of Repentance unto Life',p:6},{ch:16,t:'Of Good Works',p:7},
  {ch:17,t:'Of Perseverance of the Saints',p:3},{ch:18,t:'Of Assurance of Grace',p:4},
  {ch:19,t:'Of the Law of God',p:7},{ch:20,t:'Of the Gospel',p:4},
  {ch:21,t:'Of Christian Liberty',p:3},{ch:22,t:'Of Religious Worship & Sabbath',p:8},
  {ch:23,t:'Of Lawful Oaths and Vows',p:5},{ch:24,t:'Of the Civil Magistrate',p:4},
  {ch:25,t:'Of Marriage',p:3},{ch:26,t:'Of the Church',p:15},
  {ch:27,t:'Of Communion of Saints',p:2},{ch:28,t:'Of Baptism and the Lord\'s Supper',p:4},
  {ch:29,t:'Of Baptism',p:4},{ch:30,t:"Of the Lord's Supper",p:8},
  {ch:31,t:'Of the State after Death',p:3},{ch:32,t:'Of the Last Judgment',p:2},
]

const lbcf2 = []
chapters.forEach(c => { for(let p=1;p<=c.p;p++) lbcf2.push({src:'2LBCF',reading:`Ch. ${c.ch} §${p}`,detail:c.t,link:`https://www.1689.com/chapter${c.ch}.html`}) })

const catechism = Array.from({length:114},(_,i)=>({
  src:'Catechism',
  reading:`Q&A #${i+1}`,
  detail:'The Baptist Catechism (Keach\'s)',
  link:`https://baptistcatechism.org/${i+1}/`
}))

const lbcf1Titles = [
  'The Holy Scriptures','Of God','Of the Decrees of God','Of Creation','Of Providence',
  'Of the Fall and Original Sin',"Of the Covenant of God",'Of Christ the Mediator',
  'Of Free Will','Of Effectual Calling','Of Justification','Of Adoption','Of Sanctification',
  'Of Saving Faith','Of Repentance and Salvation','Of Good Works','Of Perseverance of Saints',
  'Of the Assurance of Salvation','Of the Law of God','Of the Gospel','Of Christian Liberty',
  'Of Worship and the Sabbath','Of Oaths and Vows','Of the Civil Magistrate','Of Marriage',
  'Of the Church','Of Communion of Saints','Of Baptism and the Lord\'s Supper','Of Baptism',
  "Of the Lord's Supper",'Of the State after Death','Of the Last Judgment',
  "Of Scripture's Perfection",'Of the Rule of Faith','Of Judgment of Controversies',
  'Of Private Judgment','Of Creeds and Confessions',"Of the Church's Authority",
  'Of Church Councils','Of the Visible Church','Of Officers of the Church',
  'Of Church Censures','Of the Power of the Keys','Of Calling to Office','Of the Sacraments',
  'Of the Word and Sacraments','Of Infant Membership','Of Covenant Children',
  'Of Church Discipline','Of Communion of Churches','Of Civil Government and Religion',
  'Of the Final State',
]
const lbcf1 = lbcf1Titles.map((t,i)=>({src:'1LBCF',reading:`Article ${i+1}`,detail:t,link:'https://www.arbca.com/1644-confession'}))

const reviewPrompts = [
  'Revisit your favourite reading from this week',
  'Meditate on a Scripture tied to this week\'s doctrine',
  'Write a short reflection — what stood out most?',
  'Discuss this week\'s readings with a friend or family',
  'Pray through a doctrine you studied this week',
  'Read a related passage from the Psalms',
  'Journal your thoughts on this week\'s theme',
]

export function buildSchedule() {
  const pool = []
  let i2=0, iC=0, i1=0, iR=0
  for (let day=1; day<=365; day++) {
    if (day % 7 === 0) {
      pool.push({day, date:dateStr(day), src:'Review', reading:'Weekly review & reflection', detail:reviewPrompts[iR%reviewPrompts.length], link:null})
      iR++
    } else {
      const turn = (day - Math.floor(day/7)) % 3
      let pushed = false
      const tryPush = (arr, idx) => { if(idx < arr.length){pool.push({day,date:dateStr(day),...arr[idx]});return true;}return false; }
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
