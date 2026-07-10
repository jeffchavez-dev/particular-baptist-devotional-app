# Particular Baptist Devotional App

A progressive web app for daily devotional reading, Bible study, confession reading, and catechism review — built for Reformed Particular Baptist believers.

**Live:** [pb-devotional.vercel.app](https://pb-devotional.vercel.app)
**Stack:** React 18 + Vite · Supabase · React Router v6 · Vercel

---

## Features

### Devotional Reading
- Daily devotional readings (365 days) tied to a Bible reading plan
- Daily reflection journal with save/share
- "Rest day" state on days with no scheduled reading
- Watson quote of the day on the home screen

### Bible Reader
- Full KJV Bible with chapter-by-chapter navigation
- **Verse highlights** — tap a verse number to highlight in 5 colors
- **Partial phrase highlights** — two-tap UX: tap first word → tap last word → pick color
- **Verse notes** — tap a verse to add a personal note
- **Study mode** — toggle with the open-book icon to reveal:
  - Inline commentary chips (Matthew Henry, John Gill, Calvin) above each verse
  - Confession cross-reference chips linking verses to 2LBCF articles
  - Bible-to-Bible cross-reference chips
  - Author study notes
- **Parallel mode** — view GNT, HOT, or LXX alongside KJV
- **Version switcher** — KJV, ABAB, Greek NT, Hebrew OT, LXX
- Commentary font size follows the user's Reading Font Size setting
- Scripture bookmarks and completion tracking

### Bible Reading Plans
- Multiple named reading plans with configurable pace and rest days
- Today's scheduled reading shown on the Dashboard
- Chapter-by-chapter progress tracker (Bible Tracker tab)
- Syncs across devices via Supabase

### Confession Reading Plan
- Choose a plan: 2LBCF only, Catechism only, 1LBCF, Orthodox Catechism, "Three" (2LBCF + Catechism + 1LBCF), or all four
- Daily article/Q&A reading with advance/retreat controls
- **Confession Tracker tab** shows per-document progress bars (2LBCF, Catechism, 1LBCF, Orthodox) derived from plan position — updates immediately as you advance
- Syncs across devices via Supabase

### Catechism Quiz
- Theology quiz with randomized questions
- Score tracking and achievements

### My Library
- Highlights, Notes, Bookmarks, Highlighted Phrases — all in one place
- Shareable note links (public URL, no auth required)

### Sync (Supabase)
- Cloud sync covers: devotional day progress, Bible chapter progress, Bible reading plan position, confession plan position/config/completions, bookmarks, scripture bookmarks, and scripture completions
- Sync runs UP then DOWN (sequentially) to prevent stale local data from overwriting newer data from another device
- Per-key timestamp tracking ensures the newer version always wins
- After sync, Dashboard and all tracker tabs update in real time without requiring a page reload

### Onboarding Tour
- Interactive step-by-step tour covering all major features
- Spotlights UI elements with an SVG mask overlay
- Triggers study mode, commentary, parallel Bible, and confession chips live during the tour
- Responsive — adapts tooltip placement and width for mobile vs desktop

### Settings (About page)
- Dark mode toggle
- Reading Font Size control (applies to Bible text and commentary)
- Bible Tracker and Confession Tracker sections
- Achievements
- App version with changelog and one-tap update
- Sync button with detailed result summary

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
