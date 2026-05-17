# Notification automation (GitHub Actions)

Personal reminders use **Notification Checker (every 5 min)** only. Scrapers stay manual until you enable them separately.

## How to tell if GitHub schedule is working

1. Open **Actions → Notification Checker (every 5 min)**.
2. After 10–15 minutes, you should see new runs labeled **Scheduled** (not “Manually run by…”).
3. Or run: `gh run list --workflow="Notification Checker (every 5 min)"` and look for `event: schedule`.

If you only ever see **workflow_dispatch**, GitHub cron is not firing. Check:

| Where | What to check |
|-------|----------------|
| **Actions → Notification Checker** | No yellow “workflow was disabled” banner; use **Enable workflow** if shown |
| **Settings → Actions → General** | “Allow all actions” (or allow for this repo) |
| **Settings → Billing → Plans and usage** | Private repo: under 2,000 Actions minutes/month |
| **Default branch** | Workflow file must be on `master` (it is after you push) |

Cron uses **UTC**. `*/5 * * * *` = at :00, :05, :10, :15… UTC (8 hours behind Philippine time).

## If schedule still does not run (free backup)

Use [cron-job.org](https://cron-job.org) (free) to call GitHub’s API every 5 minutes and **Run workflow** — no Vercel, no Firebase Blaze.

1. Create a GitHub PAT (classic) with scope **workflow**.
2. Add cron job: **POST**  
   `https://api.github.com/repos/LostLegacy123/aquawatch/actions/workflows/check-notifications.yml/dispatches`  
   Body: `{"ref":"master"}`  
   Header: `Authorization: Bearer YOUR_PAT`

## Secrets required

- `FIREBASE_SERVICE_ACCOUNT`
- `TELEGRAM_BOT_TOKEN`

Users must link Telegram in **Settings** and enable **Telegram** on each event.
