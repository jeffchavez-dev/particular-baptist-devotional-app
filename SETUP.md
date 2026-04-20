# 365 Devotional App — Setup & Deployment Guide

A full-stack web app for the 365-day Reformed Baptist devotional plan.
Built with React + Vite + Supabase, deployed on Vercel.

---

## What you need (all free)

- A **GitHub** account — github.com
- A **Supabase** account — supabase.com
- A **Vercel** account — vercel.com
- **Node.js** installed on your computer — nodejs.org (v18+)

---

## Step 1 — Set up Supabase (your database & auth)

1. Go to supabase.com and create a free account.
2. Click **New project**, name it `devotional-365`, choose a region close to you, set a database password, and click **Create project**.
3. Wait ~2 minutes for it to provision.
4. In the left sidebar, click **SQL Editor**.
5. Paste and run this SQL to create the required table:

```sql
create table public.progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  day_number  int not null,
  completed   boolean default false,
  notes       text default '',
  updated_at  timestamptz default now(),
  unique (user_id, day_number)
);

alter table public.progress enable row level security;

create policy "Users manage own progress"
  on public.progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

6. Go to **Project Settings → API** in the left sidebar.
7. Copy these two values — you'll need them shortly:
   - **Project URL** (looks like: https://abcdefgh.supabase.co)
   - **anon public** key (a long string under "Project API keys")

---

## Step 2 — Get the code running locally

1. Download/unzip this project folder, or copy it somewhere on your computer.

2. Open a terminal in the project folder and run:
```bash
npm install
```

3. Create a file called `.env` (copy from `.env.example`) and fill in your Supabase values:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Start the dev server:
```bash
npm run dev
```

5. Open http://localhost:5173 — the app should be running!

---

## Step 3 — Deploy to Vercel (make it live online)

### Option A: Via GitHub (recommended)

1. Create a new GitHub repository (public or private).
2. Push the project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. Go to vercel.com and log in.
4. Click **Add New → Project**, then import your GitHub repository.
5. Vercel auto-detects Vite. Before deploying, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
6. Click **Deploy**. In ~60 seconds your app is live at a `*.vercel.app` URL.

### Option B: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
# Follow prompts — when asked for env vars, enter your Supabase values
```

---

## Step 4 — Set up your custom domain (optional)

1. In Vercel, go to your project → **Settings → Domains**.
2. Add your domain (e.g. `devotional.yourchurch.com`) and follow the DNS instructions.

---

## Step 5 — Configure Supabase Auth redirect URLs

So that email confirmation links work on your live domain:

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://devotional-365.vercel.app`).
3. Add it to **Redirect URLs** as well.

---

## Features included

- Email/password sign-up and sign-in
- 365-day checklist: 2LBCF (160 paragraphs), Catechism (114 Q&As), 1LBCF (52 articles)
- Weekly review days interwoven every 7th day
- Progress saved to the cloud — works across any device
- Per-day notes & reflections with auto-save
- Progress bar, completion stats, and best streak tracker
- Search and filter by source, status, date
- Direct links to read each source online
- Responsive design for mobile and desktop

---

## Folder structure

```
devotional-app/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── src/
    ├── main.jsx         Entry point
    ├── App.jsx          Router + auth context
    ├── index.css        Global styles
    ├── lib/
    │   └── supabase.js  Supabase client + schedule data
    └── pages/
        ├── AuthPage.jsx    Sign in / sign up
        ├── Dashboard.jsx   Main checklist + progress
        └── ReadingPage.jsx Individual day view + notes
```

---

## Troubleshooting

**"Invalid API key" error** — Double-check your `.env` values match exactly what's in Supabase → Settings → API. No trailing spaces.

**Blank page after deploy** — Make sure `vercel.json` is in the root of your project (it handles client-side routing).

**Email confirmation not arriving** — Check spam. In Supabase → Authentication → Email Templates you can customise the email. For testing, you can disable email confirmation under Auth → Settings → "Enable email confirmations".

**Row-level security error** — Make sure you ran the full SQL in Step 1, including both the `alter table` and `create policy` commands.
