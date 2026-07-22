# Todo

## Confession Page

- [ ] **Fix proof text chip navigation in the Confession page sidebar** — the Proof Texts tab shows cross-reference chips (e.g. "Art. 4 ·15", "4.2 ·48", "Q.25") that currently navigate to an old `/day/:num` URL instead of jumping to the correct article or Q&A within the Confession reader. Should navigate in-page: "Art. 4" → 2LBCF Chapter 4, "Q.25" → Catechism Q&A 25, "4.2" → 2LBCF Chapter 4 Section 2. Files in scope: `src/pages/ConfessionsPage.jsx` and any sub-components it uses.

## Bible Versions
- [ ] Find an open-source Cebuano Bible translation to add as a new version (see `src/lib/bibleVersions.js` for how KJV/ABAB/GNT/HOT/LXX are registered) — need a source with a permissive/public-domain license and machine-readable text (JSON/USFM/etc.), not just a website to scrape.
- [ ] Add **Ang Dating Biblia (ADB)** — Tagalog, 1905, Public Domain. Source: `tgl-tagalog.osis.xml` from https://github.com/seven1m/open-bibles (OSIS XML format). Use `id: 'adb'`, abbreviation `ADB`. Integrate the same way as ILO: convert OSIS → `public/adb.json` via a Python script, register in `bibleVersions.js`, add to `_TEXT_VERSIONS` in `KjvReader.jsx`, add color entry in `ShareCardModal.jsx`. Should be opt-in via the Visible Translations setting (not in the default visible set).

## Settings
- [ ] Reorganize UX for changing Bible text size — currently a single global `prefs.sizePx` (AboutPage.jsx "Reading Font Size") drives devotional/confession/Bible text alike, but the settings copy says it only applies to "confession & reading text." In the Scripture reader (KjvReader.jsx) the only way to resize is an undiscoverable pinch-to-zoom gesture (mobile only, no desktop control). Needs a clearer, in-reader-accessible way to adjust Bible text size.

## Notifications
- [x] Fix push notifications — root cause was a VAPID key with no matching private key, plus missing server env vars. Regenerated a matching key pair, hardened `push-subscribe.js`/`push-send.js`. Code done; **manual setup below still required before it actually works in production.**
- [x] Personalize the daily reminder — `push-send.js` now names the signed-in user's actual today's Bible chapter + confession section (reusing `src/lib/planEngine.js`/`confessionPlan.js`, same logic Dashboard.jsx uses). Notifications require sign-in (guests' plan progress isn't visible server-side). Fixed at one daily time (~8am UTC) since Vercel Hobby only allows daily-or-slower cron — revisit a per-user time-of-day picker if the project moves to Pro.
- [x] Push notification when an app update ships — new `api/push-notify-update.js`, triggered by a Vercel deployment webhook (not a Deploy Hook — those trigger deploys, they don't fire after one). **Signature/payload verification is unverified against a real delivery** — check the first live webhook call in Vercel's delivery log and adjust `body.type`/`body.payload.target`/`body.payload.deployment.url` field names if needed.
- [ ] **Manual setup required (not done by Claude — needs dashboard access). Full walkthrough below, do in order:**

### Part 1 — Supabase: run the SQL
1. supabase.com → project → **SQL Editor** → New query → paste and Run:
   ```sql
   -- Push subscriptions (safe to run even if it already exists)
   create table if not exists push_subscriptions (
     endpoint    text primary key,
     p256dh      text,
     auth        text,
     user_id     uuid,
     created_at  timestamptz default now()
   );
   alter table push_subscriptions enable row level security;

   -- Last-notified app version, for the update-push webhook
   create table if not exists pb_app_meta (
     key        text primary key,
     value      jsonb,
     updated_at timestamptz default now()
   );
   alter table pb_app_meta enable row level security;
   -- No policies on either table: only the service-role key (used server-side
   -- by the api/ functions) touches them, so RLS blocking the anon key is fine.
   ```
2. Confirm all four tables exist:
   ```sql
   select table_name from information_schema.tables
   where table_name in ('push_subscriptions', 'pb_bible_plans', 'pb_user_data', 'pb_app_meta');
   ```
   If `pb_bible_plans` or `pb_user_data` are missing, stop and flag it — those back existing Bible/Confession-plan sync and something else is wrong.

### Part 2 — Vercel: environment variables
vercel.com → project → **Settings → Environment Variables** → add each, checked for **Production**:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | *(regenerate — previous key was exposed in git history)* |
| `VAPID_PRIVATE_KEY` | *(regenerate — previous key was exposed in git history)* |
| `VAPID_MAILTO` | `mailto:jeff.chavez0828@gmail.com` |
| `SUPABASE_URL` | same value as existing `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` secret key |
| `CRON_SECRET` | *(regenerate — previous secret was exposed in git history)* |

(Leave `VERCEL_WEBHOOK_SECRET` for Part 3.)

### Part 3 — Vercel: deployment webhook (for update-available pushes)
This is a **Webhook**, not a "Deploy Hook" (deploy hooks trigger deploys; webhooks fire after one completes).
1. vercel.com → avatar/team name → **Settings → Webhooks** (account/team level, not inside the project).
2. **Add Webhook** → URL: `https://<production-domain>/api/push-notify-update`
3. Events: check **Deployment Succeeded** only.
4. Projects: scope to this project only.
5. Save — copy the signing secret shown once.
6. Add it to the project's env vars: `VERCEL_WEBHOOK_SECRET` = *(that secret)*.

### Part 4 — Redeploy and test
1. Redeploy (env var changes need a fresh deploy to take effect).
2. Sign in to the app → Settings → **Enable notifications**.
3. Test the daily reminder immediately (don't wait for 8am UTC):
   ```
   curl -H "Authorization: Bearer <your-cron-secret>" https://<domain>/api/push-send
   ```
   Expect a push naming the actual Bible chapter + confession section, and `{"sent":1,"failed":0}` back.
4. Test the update-push: deploy any small change, then check **Team Settings → Webhooks → your webhook → Deliveries** for a `200`. A `401` means the signature check failed — the field names in `api/push-notify-update.js` (`body.type`, `body.payload.target`, `body.payload.deployment.url`) were written from Vercel's documented payload shape but never verified against a real delivery; report back what the delivery log shows and adjust from there.
