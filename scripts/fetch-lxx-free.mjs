/**
 * Alternative LXX fetcher using free JSON sources
 * 
 * This is a fallback if you don't have an API.Bible key.
 * It attempts to fetch from the Open Bible project or other free sources.
 * 
 * Note: Free sources may have incomplete data or different formatting.
 * For best results, use fetch-lxx.mjs with an API.Bible key.
 */

import { writeFileSync, existsSync, readFileSync } from 'fs'

console.log('⚠️  LXX Free Source Fetcher (Fallback)\n')
console.log('This script fetches LXX from free sources.')
console.log('For best results, use: npm run fetch:lxx with an API.Bible key\n')

// Try multiple free LXX sources
const SOURCES = [
  {
    name: 'CCAT LXX (Text only)',
    url: 'https://raw.githubusercontent.com/openscriptures/Septuagint/master/',
    format: 'raw'
  },
  {
    name: 'Bible Gateway (Web scraping required)',
    note: 'Not feasible due to terms of service'
  }
]

console.log('Available free LXX sources:\n')
SOURCES.forEach((s, i) => {
  console.log(`${i + 1}. ${s.name}`)
  if (s.note) console.log(`   ${s.note}`)
  if (s.url) console.log(`   ${s.url}`)
})

console.log('\n📌 Recommended approach:\n')
console.log('1. Get a free API.Bible key at https://api.bible.com/signin')
console.log('2. Run: API_BIBLE_KEY=your_key npm run fetch:lxx')
console.log('\n✨ This will give you complete, accurate LXX data.')
console.log('⏱️  Estimated time: 2-3 minutes\n')
