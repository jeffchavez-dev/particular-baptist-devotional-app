# Particular Baptist Devotional App

A progressive web app for daily devotional reading, Bible study, confession reading, and catechism review — built for Reformed Particular Baptist believers.

**Live:** [pb-devotional.vercel.app](https://pb-devotional.vercel.app)
**Stack:** React 18 + Vite · Supabase · React Router v6 · Vercel

---

## Features

> **Convention:** every feature section below ends with a **"Done when:"** line — the observable, testable state that confirms it's actually working end-to-end, not just that the code exists. Add one whenever a new feature is documented here.

### Devotional Reading
- Daily devotional readings (365 days) tied to a Bible reading plan
- Daily reflection journal with save/share
- "Rest day" state on days with no scheduled reading
- Watson quote of the day on the home screen

**Done when:** the Dashboard shows the correct day's reading for today's date, unscheduled days show "Rest day," and a saved reflection reappears after a reload.

### Bible Reader
- Full Bible with chapter-by-chapter navigation and infinite-scroll reading
- **Verse highlights** — tap a verse number to highlight in 5 colors
- **Partial phrase highlights** — two-tap UX: tap first word → tap last word → pick color
- **Verse notes** — tap a verse to add a personal note
- **Study mode** — toggle with the open-book icon to reveal:
  - Inline commentary chips (Matthew Henry, John Gill, Calvin) above each verse
  - Confession cross-reference chips linking verses to 2LBCF articles
  - Bible-to-Bible cross-reference chips
  - Author study notes
- **Parallel mode** — view any combination of versions alongside the active one; available parallel options respect the user's Visible Translations setting
- **Multiple translations** — 10 versions available:

| ID | Abbreviation | Language | Notes |
|---|---|---|---|
| `kjv` | KJV | English | King James Version (1611) — default |
| `abab` | ABAB | Tagalog | Ang Bagong Ang Biblia (Philippine Bible Society) |
| `ceb` | CEBug | Cebuano | Cebuano Ang Biblia — Bugna/Pinadayag (1917, public domain) |
| `ilocano` | ILO | Ilocano | Ti Biblia — Unlocked Literal Bible (Door43, 2019, CC BY-SA 4.0) |
| `nasb` | NASB | English | New American Standard Bible 1995 |
| `bsb` | BSB | English | Berean Standard Bible (2024) |
| `gnv` | GNV | English | Geneva Bible (1599) — the Puritan Bible |
| `rv` | RV | English | Revised Version (1895) |
| `greek` | GNT | Greek | TAGNT — word-level morphology, NT only (STEPBible CC BY 4.0) |
| `hebrew` | HOT | Hebrew | TAHOT — word-level Masoretic, OT only (STEPBible CC BY 4.0) |
| `lxx` | LXX | Greek | Rahlfs Septuagint (CCAT CC BY 4.0), OT only |

- **Visible Translations setting** — choose which versions appear in the version picker and parallel panel; default visible set is KJV, HOT, GNT, ABAB; all others are opt-in via Settings
- Commentary font size follows the user's Reading Font Size setting
- Scripture bookmarks and completion tracking
- **Animated sidebar** — Scripture book navigator slides in/out with a smooth cubic-bezier transition on both mobile and desktop; desktop sidebar animates via width collapse, mobile via translateX
- **Scripture sidebar (mobile)** — 360px wide panel with:
  - Bookmarks shown as horizontal wrapping pill chips (abbreviated book names, up to 16 bookmarks) instead of a vertical list
  - OT and NT book lists in a 2-column CSS grid, halving scroll depth (39 OT books → ~20 rows; 27 NT books → ~14 rows)
  - Tapping a book expands its chapter grid spanning the full width of both columns
  - Chapter grid shows 6 chapters per row
- **Morphology popups** — tapping a chip on a parsed Greek/Hebrew word shows a definition popup with:
  - The Greek grammatical term (e.g. ὁ ἀόριστος for Aorist) shown above the definition
  - **Discourse Function block** (Greek only) — when a known discourse particle is tapped (δέ, καί, οὖν, γάρ, ἀλλά, διό, ὥστε, διὰ τοῦτο, τότε, μέν, ἔπειτα), a teal-tinted block appears showing the particle's semantic constraint, discourse function description, and Runge/Levinsohn source citation. Matches accent-insensitively so μὲν/μέν, καὶ/καί etc. all resolve correctly.
- **Morph search "This word only" checkbox** — filters concordance results to the exact surface form; checkbox and label are left-aligned on all screen sizes

**Done when:** a highlight/note/bookmark made in the reader survives a reload, toggling study mode reveals commentary + cross-ref chips for a chapter known to have both, disabling a translation in Settings removes it from both the version dropdown and the parallel panel immediately, and tapping μέν in the GNT reader shows a Discourse Function block citing Runge and Levinsohn.

### Bible Reading Plans
- Multiple named reading plans with configurable pace and rest days
- Today's scheduled reading shown on the Dashboard
- Chapter-by-chapter progress tracker (Bible Tracker tab)
- Syncs across devices via Supabase

**Done when:** the Dashboard names the correct chapter(s) for today given the active plan's pace/rest-day config, and the Bible Tracker tab reflects the same position after a sync on a second device.

### Confession Reading Plan
- Choose a plan: 2LBCF only, Catechism only, 1LBCF, Orthodox Catechism, "Three" (2LBCF + Catechism + 1LBCF), or all four
- **Default plan** for first-time / guest users is "Three Confessions, year cycle" (2LBCF + Baptist Catechism + 1LBCF), configurable in Settings
- Daily article/Q&A reading with advance/retreat controls
- **Dashboard deep-link** — the confession card on the Home screen shows a "Read →" button that navigates directly to the correct section (chapter, article, or Q&A) in the Confession reader
- **Confession Tracker tab** shows per-document progress bars (2LBCF, Catechism, 1LBCF, Orthodox) derived from plan position — updates immediately as you advance
- Proof-text references in the reader link out to the in-app Bible reader
- Syncs across devices via Supabase

**Done when:** advancing/retreating the plan updates the Confession Tracker progress bars immediately, tapping "Read →" on the Dashboard opens the exact article/Q&A in the Confession reader, and the position survives a sync to another device.

### Catechism Quiz
- Theology quiz with randomized questions
- Score tracking and achievements

**Done when:** completing a quiz shows a correct final score and unlocks the matching achievement.

### My Library
- **Highlights** — all verse and phrase highlights with color filter
- **Reflection Notes** — personal daily notes saved from the Home screen, shown with date and searchable
  - **Rich text editor** — bold, italic, underline, lists, and heading formatting in the note editor
  - **@ scripture tagging** — type `@` in a note to tag a Bible verse inline; numbered books (1 Corinthians, 2 Timothy, etc.) work correctly
  - **Shareable links** — every note can be shared via a public URL (no auth required); shared note pages include OpenGraph meta tags so link previews render correctly in iMessage, Slack, Twitter, etc.
- **Bookmarks** — confession and catechism bookmarks with scripture cross-references
- **Highlighted Phrases** — partial phrase highlights saved from the Bible reader

**Done when:** every item type saved elsewhere in the app appears in its matching Library tab, Reflection Notes saved today appear in the Notes tab after a reload, a shared note link opens correctly in a signed-out browser, and pasting a shared note URL into iMessage shows a preview card with the note title.

### Sync (Supabase)
- Cloud sync covers: devotional day progress, Bible chapter progress, Bible reading plan position, confession plan position/config/completions, bookmarks, scripture bookmarks, and scripture completions
- Sync runs UP then DOWN (sequentially) to prevent stale local data from overwriting newer data from another device
- Per-key timestamp tracking ensures the newer version always wins
- After sync, Dashboard and all tracker tabs update in real time without requiring a page reload

**Done when:** changing progress on device A and syncing on device B shows A's data without a page reload, and syncing stale device A afterward does not overwrite B's newer state.

### Onboarding Tour
- Interactive step-by-step tour covering all major features
- Spotlights UI elements with an SVG mask overlay
- Triggers study mode, commentary, parallel Bible, and confession chips live during the tour
- Responsive — adapts tooltip placement and width for mobile vs desktop

**Done when:** the tour completes start-to-finish on both a mobile and a desktop viewport with no tooltip clipped off-screen or step blocked by an unrelated overlay.

### Vocabulary Review (Spaced Repetition)
- Hybrid spaced-repetition flashcard system for Greek/Hebrew vocabulary from the user's library
- **4 review modes** selectable at the end of each round:
  - **Smart** — 70% weak words + 30% fresh cards
  - **Weak Focus** — session-tagged learning cards only
  - **Fresh Cards** — unreviewed words only
  - **Mixed** — random shuffle across all words
- Round-end screen shows: round counter, status chip summary (new/learning/known counts), a contextual learning tip, and the 4 mode buttons
- Session state (`sessionWeakRef`, `reviewedRef`) accumulates across rounds without resetting between them

**Done when:** completing a 10-card round shows the round-end screen with the correct chip summary, selecting a mode builds the next deck correctly from session-accumulated weak/reviewed sets, and switching to Weak Focus when no weak words exist shows an appropriate empty state.

### Share Cards
- Generate a shareable image card from any Bible verse selection, chapter, confession article, or catechism Q&A
- **Formats** — Square (1:1 for Instagram/Facebook), Story (9:16), Landscape (16:9)
- **Themes** — 8 color presets (Deep Ink, Parchment, 17th Century, Forest, Royal, Deep Teal, Amber, Custom)
- **Text controls** — position (Top/Bottom/Center/Left/Right) and alignment (Left/Center/Right)
- **Scale slider** — resize text to fit
- **Source chip** — color-coded badge per translation/confession document (KJV, GNT, HOT, ILO, 2LBCF, Catechism, 1LBCF, Orthodox, etc.)
- **Proof Texts toggle** — confession and catechism share cards can show or hide the Scripture proof references section independently from the body text
- **Hebrew/RTL lock** — HOT cards lock to right-align automatically; Greek (GNT/LXX) respects the user's alignment choice
- Download as PNG or share via native share sheet

**Done when:** a confession card generated with proof texts toggled off shows only the article body, a GNT card respects a Center alignment selection (not forced right), and a HOT card is always right-aligned regardless of the dropdown setting.

### Settings (About page)
- Dark mode toggle
- Reading Font Size control (applies to Bible text and commentary)
- Default Bible Translation picker (filtered to the user's visible set)
- **Bible Translations** — chip-toggle panel to choose which translations appear in the Scripture version picker and parallel panel; default visible: KJV, HOT, GNT, ABAB; "Reset to defaults" restores the default set
- Bible Tracker and Confession Tracker sections
- Achievements
- App version with changelog and one-tap update
- Sync button with detailed result summary
- Push notifications (see below)
- **Data Sources** — credits all open data and scholarship sources used in the app, including STEPBible (morphology), BibleHub Strong's, public domain Bible texts, and discourse grammar references (Runge, Levinsohn)

**Done when:** every toggle/button here reflects its new state immediately, toggling a translation off removes it from the Scripture picker on the same navigation without a reload, and the state persists after a reload.

### Push Notifications
- **Daily reminder** — signed-in users can enable a once-daily push notification naming that day's actual Bible reading-plan chapter(s) and Confession-plan item (same content as the Dashboard). Requires sign-in because the reminder is built server-side from Supabase-synced plan progress, which guests never sync. Fixed at one daily time (~8am UTC) — Vercel's Hobby plan only supports daily-or-slower Cron, so this isn't per-user-configurable yet.
- **Update available** — every subscriber gets a push the moment a new version deploys, triggered by a Vercel deployment webhook (`api/push-notify-update.js`) rather than waiting for the in-app pull-based update check.
- Requires one-time Vercel/Supabase setup (env vars, a couple of tables, a deployment webhook) — not yet completed. See `todo.md` for the full walkthrough.

**Done when:** manually triggering `/api/push-send` delivers a push naming the real Bible chapter + confession section for a signed-in test account, and a real deploy produces a successful (`200`) webhook delivery followed by an "Update available" push. **Not yet done** — pending the manual setup in `todo.md`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite (PWA via vite-plugin-pwa / Workbox) |
| Routing | React Router v6 |
| Backend / Auth | Supabase (Postgres + Row Level Security) |
| Hosting | Vercel (auto-deploy on push to `main`) |
| Styling | Plain JS style objects, CSS variables |
| Fonts | Cormorant Garamond, DM Sans, Georgia, Lora |

---

## Local Development

```bash
npm install
cp .env.example .env.local   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

---

## Deployment

Push to `main` — Vercel auto-deploys. Bump `public/version.json` with every user-facing change so the in-app update banner fires correctly.

**Push notifications** additionally require: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_MAILTO`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` set as Vercel env vars; a `push_subscriptions` + `pb_app_meta` table in Supabase; and a Vercel deployment webhook pointed at `/api/push-notify-update`. Full step-by-step in `todo.md`.
