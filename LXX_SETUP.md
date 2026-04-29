# LXX Greek Septuagint — Integration Guide

This guide explains how to add the LXX (Greek Septuagint) as a Bible version in your devotional app.

## Quick Start

### Option 1: API.Bible (Recommended — 5 minutes)

**Best for:** Complete, accurate LXX data with all deuterocanonical books.

1. **Get a free API key:**
   - Go to https://api.bible.com/signin
   - Click "Create an account" → complete registration
   - Navigate to your account settings
   - Click "Create API Key"
   - Copy the key

2. **Fetch the LXX data:**
   ```bash
   API_BIBLE_KEY=your_key_here npm run fetch:lxx
   ```

3. **Watch for success:**
   ```
   Fetching 1000+ chapters across 50+ books from API.Bible (LXX)…
   ✓ Genesis                     50/1000+ (3.2s)
   ✓ Exodus                     90/1000+ (5.1s)
   ...
   ✅ Saved public/lxx.json  (2500 KB uncompressed)
   ```

4. **Done!** Rebuild and the LXX reader will be available.

### Option 2: Manual JSON (Advanced)

If you prefer to create the LXX JSON file manually:

1. Download LXX text from a source (see "Data Sources" below)
2. Convert to the required format: `{ book_slug: { chapter: [{ v, t }] } }`
3. Save as `public/lxx.json`
4. Rebuild the app

---

## How It Works

### Data Format

Each Bible version in your app uses this structure:

```json
{
  "genesis": {
    "1": [
      { "v": 1, "t": "Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν." },
      { "v": 2, "t": "Ἡ δὲ γῆ ἦν ἀόρατος καὶ ἀκατασκεύαστος..." }
    ],
    "2": [ ... ]
  },
  "exodus": { ... }
}
```

Where:
- `book_slug` = lowercase book name, no spaces, no punctuation (e.g., `genesis`, `1samuel`)
- `v` = verse number (integer)
- `t` = verse text (string, plain text only)

### Integration Points

**Version Registration** — `src/lib/bibleVersions.js`
```javascript
{
  id: 'lxx',
  label: 'Greek Septuagint',
  abbreviation: 'LXX',
  language: 'Greek',
  year: 'Rahlfs 1935',
  description: 'The Greek translation of the Hebrew scriptures used in early Christianity',
  dataFile: '/lxx.json',
  scope: 'OT',
  source: 'CCAT (Thesaurus Linguae Graecae / CATSS) CC BY 4.0',
}
```

**KjvReader Component** — `src/components/KjvReader.jsx`
- Automatically detects and renders any registered version
- No code changes needed

---

## Data Sources

### Primary: API.Bible (Recommended)

**Pros:**
- Free tier covers all books
- Complete LXX including deuterocanonical books
- Well-maintained API
- Immediate availability

**Cons:**
- Requires free API key registration

**URL:** https://api.bible.com

**Script:** `npm run fetch:lxx` (requires `API_BIBLE_KEY` env var)

### Secondary: CCAT LXX

**Pros:**
- Most scholarly, widely cited source
- Morphological tagging available
- Based on Rahlfs 1935 edition

**Cons:**
- Restrictive license (requires user declaration form)
- Binary .mlxx format, requires custom parser
- More complex setup

**URL:** http://ccat.sas.upenn.edu/gopher/text/religion/biblical/lxxmorph/

**Process:**
1. Fill out user declaration: http://ccat.sas.upenn.edu/gopher/text/religion/biblical/lxxmorph/0-user-declaration.txt
2. Download .mlxx files
3. Parse using Open Scriptures tools
4. Convert to JSON

### Tertiary: Open Scriptures LXX

**Pros:**
- Open source, community maintained
- Includes lemmas and morphology
- GitHub-hosted

**Cons:**
- May lack complete verse-by-verse text
- Primarily lemma/vocabulary data

**URL:** https://github.com/openscriptures/GreekResources

**Folders:**
- `LxxLemmas/` — Lemmatized Septuagint
- `GreekWordList.js` — LXX vocabulary index

---

## Troubleshooting

### "API_BIBLE_KEY environment variable not set"

```bash
# Make sure to pass the key when running the script:
API_BIBLE_KEY=your_actual_key npm run fetch:lxx

# Or export it first:
export API_BIBLE_KEY=your_actual_key
npm run fetch:lxx
```

### Script runs but creates empty lxx.json

1. **Check your API key is valid:**
   - Log in to https://api.bible.com
   - Verify the key is active

2. **Check rate limiting:**
   - API.Bible free tier has limits
   - Wait 10 minutes and try again

3. **Check book ID mappings:**
   - The script uses UBSLPT (UBS LXX) as the Bible version ID
   - This may change if API.Bible updates their catalog
   - Contact API.Bible support if this fails

### "Failed to fetch" errors for some books

This is normal — some LXX books may not be available in the API yet:
- The script will skip them and continue
- A partial LXX is better than none
- You can manually add missing books later

### File size is too large

The uncompressed LXX JSON is typically 2-3 MB:
- HTTP compression (gzip) on Vercel reduces this to ~400-600 KB
- This is acceptable for modern browsers
- Users only download once (then cached offline)

If needed, you can strip extra content:
```bash
# Remove less-used deuterocanonical books
# Modify the BOOKS array in scripts/fetch-lxx.mjs
```

---

## Using the LXX in Your App

### For Users

1. Open a Bible passage
2. A version selector appears (if implemented in UI)
3. Choose "Greek Septuagint (LXX)"
4. Read in Greek
5. All features work: highlighting, notes, sharing, etc.

### For Developers

The version loader handles everything:

```javascript
import { loadBibleVersion } from 'src/lib/bibleVersions.js'

// Load LXX data (or any version)
const lxxData = await loadBibleVersion('lxx')

// Data format matches KJV
const genesis1 = lxxData.genesis[1]
// Returns: [
//   { v: 1, t: 'Ἐν ἀρχῇ ἐποίησεν...' },
//   { v: 2, t: 'Ἡ δὲ γῆ ἦν ἀόρατος...' }
// ]
```

---

## Adding Other Versions

To add **ESV**, **NASB**, or other translations:

1. **Create a fetch script:**
   ```bash
   cp scripts/fetch-lxx.mjs scripts/fetch-esv.mjs
   ```

2. **Update the API calls** to use the appropriate version ID

3. **Register in `src/lib/bibleVersions.js`:**
   ```javascript
   {
     id: 'esv',
     label: 'English Standard Version',
     abbreviation: 'ESV',
     language: 'English',
     year: '2001',
     description: '...',
     dataFile: '/esv.json',
   }
   ```

4. **Run the fetch script:**
   ```bash
   API_BIBLE_KEY=your_key npm run fetch:esv
   ```

---

## Support

**Problems with the LXX script?**
- Check that `API_BIBLE_KEY` is correctly set
- Verify you have an active API.Bible account
- Try again in 10 minutes (rate limiting)

**Want a different Bible source?**
- Check available sources above
- Create a custom fetch script following the pattern
- Submit a GitHub issue if you get stuck

**Need multiple languages?**
- The app architecture supports unlimited versions
- Add each version via its own fetch script
- UI dropdown for version selection can be added later
