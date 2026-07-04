# Particular Baptist Devotional App — Claude Context

Read this file at the start of every session before touching any code.

## Tech Stack

- **React 18 + Vite** PWA (vite-plugin-pwa, Workbox autoUpdate)
- **Supabase** — auth + cloud sync (progress, notes, cross-refs)
- **React Router v6** — client-side routing
- **Deployed on Vercel** — auto-deploy on `git push` to `main`
- No TypeScript; plain JSX throughout

---

## Routes & Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `Dashboard.jsx` | Home: daily devotional card, Bible reading plan card, confession tracker card. Shows "Rest day" when the Bible plan has no reading scheduled. |
| `/day/:dayNum` | `ReadingPage.jsx` | Daily devotional reading for a specific day number (1–365). |
| `/quiz` | `QuizPage.jsx` | Catechism / theology quiz. |
| `/scripture` | `ScripturePage.jsx` | Full Bible reader — wraps `KjvReader`. Has its own fixed header with the book pill, version dropdown, back/forward nav, book icon (study mode toggle), and search icon. |
| `/confessions` | `ConfessionsPage.jsx` | 1689 LBCF and other confession documents, chapter-by-chapter. |
| `/library` | `LibraryPage.jsx` | Tabbed library: Highlights, Notes, Bookmarks, Highlighted Phrases. |
| `/about` | `AboutPage.jsx` | Settings page (despite the route name). Contains: Bible Tracker, Confession Tracker, Achievements, Settings (dark mode, font, check for updates, reset), Sync, About. |
| `/auth` | `AuthPage.jsx` | Sign in / sign up. Redirects to `/` when already signed in. |
| `/share/note/:token` | `SharedNotePage.jsx` | Public shared note view (no auth required). |

---

## Bottom Navigation (5 tabs)

| Tab | Route | Notes |
|---|---|---|
| Devotional | `/` | Home / dashboard |
| Confession | `/confessions` | LBCF reader |
| Scripture | `/scripture` | Bible reader |
| My Library | `/library` | Highlights, Notes, etc. |
| Settings | `/about` | AboutPage (route is `/about`) |

---

## Key Components

### `KjvReader.jsx` (src/components/)
The main Bible reader. ~5000 lines. Key areas:
- **Study mode** — toggled by the open-book icon in ScripturePage's header. When on: shows confession chips, cross-ref chips, inline commentary chips above verses, and author study notes.
- **Inline commentary** — loads on study mode toggle. Three commentaries available: MHC (Matthew Henry), Gill (John Gill), Calvin. Selector row appears below chapter heading. Commentary sections appear as collapsible gold-bordered chips above the relevant verse.
- **Partial highlights** — two-tap UX: tap first word → tap last word → toolbar appears. Works across verses. Stored in `localStorage` under `pb-partial-highlights`.
- **Verse highlights** — tap verse number to select whole verse → toolbar → pick color. 5 color options.
- **Verse notes** — tap verse → note editor appears.
- **Cross-references** — confession chips + Bible xref chips shown in study mode.
- **Parallel mode** — GNT/HOT/LXX panels alongside KJV.
- **Version switcher** — KJV, ABAB, Greek NT, Hebrew OT, LXX.

### `CommentaryPanel.jsx` (src/components/)
Standalone commentary panel (accordion UI). Now only used if referenced directly; inline commentary in KjvReader replaces its previous bottom-of-chapter placement.

### `ScriptureControls.jsx` (src/components/)
Sticky bar at the bottom of ScripturePage (above bottom nav) with book/chapter pill and search input.

### `BottomNav.jsx` (src/components/)
Fixed bottom navigation. Auto-hides on scroll down, reappears on scroll up.

---

## Key Libraries (src/lib/)

| File | Purpose |
|---|---|
| `annotations.js` | Highlights, notes, partial highlights, search history. All localStorage. `HIGHLIGHT_COLORS` array controls color scheme (`rowBg`, `border`, `numBg`, `numClr`, `dot`). |
| `commentary.js` | Commentary registry (`COMMENTARIES` object). Currently has MHC (GitHub/Razzula), Gill (HelloAO API JSON), Calvin (BibleHub HTML). Offline-first via Cache API (`pb-commentary-v1`). Add new commentaries by adding an entry with `id`, `name`, `shortName`, `hasBook(book)`, `getUrl(book, chapter)`, `parse(raw)`. |
| `versionCheck.js` | App update detection. Fetches `public/version.json` bypassing SW cache. `fetchRemoteVersion()`, `getInstalledVersion()`, `setInstalledVersion()`. |
| `biblePlan.js` | Bible reading plan logic. `isTodayRestDay(config)` returns true when plan has no chapters scheduled today. |
| `bibleBooks.js` | `BIBLE_BOOKS` array, `BOOK_ABBR` map. |
| `supabase.js` | Supabase client, `getBibleProgress()`, `setBibleChapter()`, etc. |
| `authorContent.js` | Author-only study notes and cross-refs stored in Supabase. |
| `crossRef.js` | Confession cross-reference chips (`getCrossRefs`). |
| `bibleXrefs.js` | Bible-to-Bible cross-reference chips. |
| `memorize.js` | Verse memorization feature. |

---

## Update System (`public/version.json`)

```json
{ "version": "1.2", "date": "2026-06-01", "changelog": "..." }
```

- Excluded from SW precache via `globIgnores: ['**/version.json']` in `vite.config.js`
- **To ship a visible update to users**: bump `"version"` in `public/version.json`, commit, push. On next app open the user sees an "Update" button in Settings → App Version with the changelog.
- `checkForUpdate()` in `AboutPage.jsx` calls `reg.update()` to force the SW to re-fetch, then compares versions.
- `applyUpdate()` posts `SKIP_WAITING` to any waiting SW, waits for `controllerchange`, then reloads.

---

## Styling Conventions

- All styles are plain JS objects (`const s = { ... }`) referenced as `style={s.foo}` — no CSS modules or Tailwind.
- CSS variables: `--gold`, `--teal`, `--teal-light`, `--gold-faint`, `--ink`, `--ink-muted`, `--ink-faint`, `--surface`, `--parchment`, `--parchment-dark`, `--border`, `--border-strong`.
- Google Fonts: Cormorant Garamond (serif headings), DM Sans (UI), Georgia (commentary body), Lora (notes).

---

## Data Storage

| Data | Location |
|---|---|
| Highlights | `localStorage` (`pb-highlights`) |
| Partial phrase highlights | `localStorage` (`pb-partial-highlights`) |
| Verse notes | `localStorage` (`pb-item-notes`) |
| Bible chapter progress | `localStorage` + Supabase `pb_bible_progress` |
| Bible reading plans | `localStorage` + Supabase `pb_bible_plans` |
| Commentary cache | Cache API (`pb-commentary-v1`) |
| App version | `localStorage` (`pb-app-version`) |
| Reader version preference | `localStorage` (`pb-default-version`) |

---

## Common Patterns

**Adding a commentary**: Add an entry to `COMMENTARIES` in `src/lib/commentary.js`. Needs: `id`, `name`, `shortName`, `description`, `hasBook(book) → bool`, `getUrl(book, chapter) → url`, `parse(rawString) → [{heading, paragraphs[]}]`.

**Bumping the app version**: Edit `public/version.json` → increment `version`, update `date` and `changelog` → commit + push.

**Study mode**: `studyMode` prop flows from `ScripturePage` → `KjvReader`. The open-book icon in the ScripturePage header toggles it.

**Inline commentary state** (in KjvReader): `inlineComId` (which commentary), `inlineComData` (`{[segKey]: {sections, loading}}`), `inlineComExp` (`{[secKey]: bool}`).
