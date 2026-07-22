# Plan — ESV Bible Translation

## What we are building
Add the ESV as a fetchable Bible translation via the ESV API (api.esv.org), proxied through a Vercel serverless function so the API key never reaches the browser. Fetched chapters are normalized to `{verse, text}` and stored in localStorage — once a chapter is cached for a user, it's never fetched again. ESV appears in the version picker and parallel panel like any other text translation. Attribution displays inline at the bottom of each ESV chapter, and a one-liner appears in the About/Settings page under translations.

## Language agreed on
- **Cache aggressively**: localStorage per chapter, key `esv-{bookSlug}-{chapter}`, permanent — no expiry
- **Proxy**: `api/esv.js` serverless function, takes `?book=&chapter=`, calls ESV API with secret key, returns normalized `[{verse, text}]`
- **Parallel mode**: ESV joins `_TEXT_VERSIONS` — plain text parallel, not word-level like Greek/Hebrew
- **Verse data shape**: normalized to `{verse, text}` before storing in localStorage

## Decisions made
- **Attribution placement**: inline footer at the bottom of each ESV chapter in KjvReader (only when ESV is active) + a one-liner in the About/Settings page under the translations section
- **Cache shape**: store as JSON array of `{verse, text}` directly — no re-parsing on read
- **Search**: not supported for ESV (can't search full Bible via API without 31,000 requests) — show "Search not available for ESV" when ESV is active

## Assumptions
- `ESV_API_KEY` will be added to Vercel env vars manually after build (same process as VAPID keys)
- ESV is opt-in via the Visible Translations setting, not in the default visible set

## Files to touch
1. `api/esv.js` — new serverless proxy function
2. `src/lib/esvCache.js` — new localStorage cache module
3. `src/lib/bibleVersions.js` — register ESV with `type: 'api'`, no `dataFile`
4. `src/components/KjvReader.jsx` — load ESV via esvCache, add to `_TEXT_VERSIONS`, attribution footer, disable search for ESV
5. `src/pages/AboutPage.jsx` — ESV attribution one-liner in translations section
6. `public/version.json` — bump version

## Build order
Start with `api/esv.js` → `src/lib/esvCache.js` → `src/lib/bibleVersions.js` → `src/components/KjvReader.jsx` → `src/pages/AboutPage.jsx` → version bump.
