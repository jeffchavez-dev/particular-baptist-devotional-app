# Security

## Practices

- All secrets (API keys, private keys, tokens, cron secrets) go in **Vercel environment variables only** — never in committed files
- Documentation and setup guides use placeholders like `<your-secret-here>`, never real values
- Every new env var added to Vercel must be documented by name (not value) in `todo.md` or `README.md`

## Incident Log

### July 22, 2026 — VAPID keys and CRON_SECRET exposed in git history

**What happened:** A setup walkthrough in `todo.md` was committed with real secret values hardcoded in plain text — `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and `CRON_SECRET`. GitGuardian flagged the exposure after the push reached GitHub.

**What was done:**
1. Redacted the values in `todo.md` and pushed immediately
2. Used `git-filter-repo` to scrub all three values from the full git history
3. Force-pushed to GitHub to overwrite the public history
4. Rotated all three secrets — new VAPID key pair generated, new CRON_SECRET generated
5. Updated `VAPID_PUBLIC_KEY` in `src/components/NotificationSettings.jsx`
6. Updated all rotated values in Vercel environment variables and redeployed

**Lessons learned:**
- Documentation files are committed files — treat them the same as source code when it comes to secrets
- A pre-commit hook scanning for secret patterns would have blocked this before it reached GitHub (see `todo.md`)
- Rotating secrets after exposure is expensive — scrubbing git history, force-pushing, regenerating keys, updating multiple places. Prevention costs nothing by comparison.

## Reporting a Vulnerability

This is a personal/private app. If you find a security issue, contact jeff.chavez0828@gmail.com.
