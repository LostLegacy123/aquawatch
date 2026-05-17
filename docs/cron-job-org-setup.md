# cron-job.org → GitHub Actions (notifications)

cron-job.org presses **Run workflow** for you every 5 minutes. No cron-job.org API key required — use their website.

## What you create (keep secrets off GitHub / out of git)

| Item | Where | Notes |
|------|--------|--------|
| **cron-job.org account** | [cron-job.org](https://console.cron-job.org) | Free tier is enough |
| **GitHub PAT (classic)** | GitHub → Settings → Developer settings → Personal access tokens | Scope: **`workflow`** only (or `repo` if `workflow` alone fails). Copy once — you won’t see it again |
| **GitHub repo secrets** | Already set | `FIREBASE_SERVICE_ACCOUNT`, `TELEGRAM_BOT_TOKEN` in repo **Settings → Secrets and variables → Actions** |

**Do not** commit the PAT or paste it in the repo. Store it only in cron-job.org’s password/header field.

---

## Step 1 — GitHub token

1. GitHub → profile picture → **Settings**
2. **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
3. Name: `cron-job-aquawatch`
4. Expiration: pick a date after May 20, 2026 (or no expiration if your school allows)
5. Scopes: check **`workflow`**
6. Generate and **copy the token** (`ghp_...`)

---

## Step 2 — cron-job.org job (notifications)

1. Log in at [console.cron-job.org](https://console.cron-job.org)
2. **Cronjobs** → **Create cronjob**
3. **Title:** `AquaWatch notifications`
4. **URL:**  
   `https://api.github.com/repos/LostLegacy123/aquawatch/actions/workflows/check-notifications.yml/dispatches`
5. **Schedule:** every **5** minutes (or use pattern matching `*/5 * * * *` if the UI offers it)
6. **Request method:** `POST`
7. **Headers** (add each):

   | Name | Value |
   |------|--------|
   | `Accept` | `application/vnd.github+json` |
   | `Authorization` | `Bearer ghp_YOUR_TOKEN_HERE` |
   | `Content-Type` | `application/json` |
   | `X-GitHub-Api-Version` | `2022-11-28` |

8. **Request body** (raw JSON):

   ```json
   {"ref":"master"}
   ```

9. Save and **Enable** the job.

---

## Step 3 — Verify (5–10 minutes)

1. GitHub → **Actions → Notification Checker (every 5 min)**
2. New runs should appear about every 5 minutes (may still say “Manually run” in the UI — that’s OK; the run still executes).
3. Open the latest run → confirm green check and log line `Processing N open events`.

Test notification:

- App **Settings** → **Telegram Linked**
- **Schedule** → new event ~20–30 min ahead → check **Telegram**
- Wait for a rubric window (e.g. **15 minutes before** = between 10–15 min before event time)

---

## Scraper cron jobs (no GitHub schedule — disable job = no scrape)

Scraper workflows are **`workflow_dispatch` only**. Use cron-job.org to trigger them (same headers/body as notifications).

**Before daily/hourly scrapers:** add GitHub secrets `TELEGRAM_GROUP_CHAT_ID` (and optional `DISCORD_GROUP_WEBHOOK`) so the workflow can post to your **group** chat after scraping. The dashboard reads scraped rows from Firestore `articles`.

### Daily scraper (9:00 AM PHT)

| Field | Value |
|--------|--------|
| URL | `https://api.github.com/repos/LostLegacy123/aquawatch/actions/workflows/scraper-daily.yml/dispatches` |
| Schedule | Once daily at **9:00 AM**, timezone **Asia/Manila** |
| Method / headers / body | POST, same as notifications (`{"ref":"master"}`) |

### Hourly scraper (optional)

| Field | Value |
|--------|--------|
| URL | `https://api.github.com/repos/LostLegacy123/aquawatch/actions/workflows/scraper-realtime.yml/dispatches` |
| Schedule | Every **1 hour** (uses more GitHub Actions minutes) |

Turning off or deleting a cron-job.org job stops that workflow from running automatically.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| HTTP 401 | PAT wrong, expired, or missing `workflow` scope |
| HTTP 404 | Wrong repo name or workflow filename in URL |
| HTTP 422 | Body must be exactly `{"ref":"master"}` |
| Runs but no Telegram | Link Telegram in Settings; enable Telegram on event; check repo secrets |
| cron-job.org job disabled | Fix URL/PAT; re-enable job after 25 failures |

---

## Do we need the cron-job.org API?

**No** for this setup. The web UI is enough. The cron-job.org API is only if you want to create jobs from code later.
