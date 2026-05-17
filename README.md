# AquaWatch PH

Real-time water and environmental news for the Philippines, plus personal schedule reminders via **Telegram** and **Discord**.

| Layer | Technology |
|--------|------------|
| Web app | React, Vite, TypeScript, Tailwind CSS |
| Auth & database | Firebase (Google Sign-In, Firestore) |
| Hosting | Firebase Hosting |
| Event notifications | GitHub Actions → `scripts/checkNotifications.js` |
| Telegram bot linking | Vercel → `api/telegram-webhook.js` |
| News scraping | GitHub Actions → `scraper/` |
| Marketing page | `railway-landing/` (Railway) |
| Legacy (optional) | Firebase Cloud Functions in `functions/` |

**Repository:** https://github.com/LostLegacy123/aquawatch

---

## Architecture

```mermaid
flowchart TB
  subgraph client ["React App — Firebase Hosting"]
    Login["Login — Google Auth"]
    Dash["Dashboard — waterData + mocks"]
    Sched["Schedule — events CRUD"]
    Set["Settings — Telegram code + Discord webhook"]
  end

  subgraph firestore ["Firestore"]
    WD["waterData"]
    EV["events"]
    US["users"]
    AR["articles"]
  end

  subgraph gha ["GitHub Actions — workflows in repo; schedules OFF by default"]
    CN["check-notifications — manual only until cron enabled"]
    SD["scraper-daily — manual only until cron enabled"]
    SR["scraper-realtime — manual only until cron enabled"]
  end

  subgraph vercel ["Vercel"]
    TW["api/telegram-webhook"]
  end

  subgraph legacy ["Optional — Firebase Functions"]
    CF["checkNotifications + sendDailyDigest + telegramWebhook + testDiscordWebhook"]
  end

  client --> firestore
  CN --> EV
  CN --> US
  SD --> AR
  SR --> AR
  TW --> US
  CF -.-> EV
  CF -.-> AR
```

**Solid lines** — primary paths in use today. **Dotted lines** — legacy Functions; avoid running **both** Functions schedulers and GitHub Actions notification workflow, or users may get duplicate messages.

---

## Firestore collections

| Collection | Purpose | Client access |
|------------|---------|----------------|
| `waterData` | Dashboard readings (PAGASA / DOE style) | Public read |
| `events` | User schedules (deadlines, meetings, trips) | Owner read/write |
| `users` | Profile, Telegram link, Discord webhook | Owner read/write |
| `articles` | Scraped news for digest | Public read; writes via Admin SDK only |
| `deadlines` | Legacy (rules may remain; UI uses `events`) | — |

### `events` document shape

```ts
{
  userId: string
  eventKind: "deadline" | "meeting" | "business_trip"
  title: string
  description: string
  scheduledAt: Timestamp
  notifyVia: ("telegram" | "discord")[]
  notificationsSent: string[]   // e.g. "24h", "exact", "miss_10m"
  isCompleted: boolean
  createdAt: Timestamp
}
```

---

## Project structure

```
aquawatch-ph/
├── src/                    # React app
│   ├── pages/              # Dashboard, Schedule, Settings, Login
│   ├── lib/                # Firebase client, Firestore helpers
│   └── hooks/
├── functions/              # Firebase Cloud Functions (legacy / optional)
├── scripts/                # GHA notification checker
├── scraper/                # News scraper + sources/
├── api/                    # Vercel Telegram webhook
├── railway-landing/        # Static landing page
└── .github/workflows/      # GHA workflows (manual-only until you enable cron)
```

---

## Local development

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Fill in `.env` (never commit — `.env` is gitignored).
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

### Scripts (optional)

```bash
cd scripts && npm install
# Set FIREBASE_SERVICE_ACCOUNT and TELEGRAM_BOT_TOKEN in the shell, then:
node checkNotifications.js
```

---

## GitHub Actions workflows

Workflows are **safe to commit and push**: they use **`workflow_dispatch` only** (manual run from the Actions tab). **Cron schedules are commented out** so nothing scrapes or sends notifications automatically until you enable them.

| File | Purpose | When enabled (cron) |
|------|---------|---------------------|
| `check-notifications.yml` | Event reminders via Telegram/Discord | Every 5 minutes |
| `scraper-daily.yml` | Scrape news sources → `articles` | Daily 9:00 AM PHT |
| `scraper-realtime.yml` | Hourly scrape (full run today; `--realtime` TBD) | Every hour |

### Enable automatic runs

1. Add repository secrets: **Settings → Secrets and variables → Actions**
   - `FIREBASE_SERVICE_ACCOUNT` — service account JSON as a **single line**
   - `TELEGRAM_BOT_TOKEN`
   - `DISCORD_GROUP_WEBHOOK` (optional; digest / unused by notification script today)
2. In each workflow file, uncomment the `schedule:` block and keep `workflow_dispatch` if you want manual runs too.
3. Commit and push.
4. **Disable** Firebase scheduled functions if you use GHA for notifications (avoid duplicates).

### Manual test (before enabling cron)

**Actions →** pick a workflow → **Run workflow**.

---

## Vercel (Telegram webhook)

Deploy the repo (or `api/` folder) on Vercel and set:

- `FIREBASE_SERVICE_ACCOUNT`
- `TELEGRAM_BOT_TOKEN`

Point your bot webhook to:

`https://<your-vercel-domain>/api/telegram-webhook`

Users link from **Settings** with `/start <6-digit-code>`.

---

## Firebase deploy (app + rules)

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

Deploy Functions only if you still want the legacy path:

```bash
cd functions && npm install && npm run build
firebase deploy --only functions
```

---

## Environment variables

See [`.env.example`](.env.example).

| Variable | Where |
|----------|--------|
| `VITE_FIREBASE_*` | Frontend (Vite) |
| `VITE_TELEGRAM_BOT_USERNAME` | Settings UI copy |
| `FIREBASE_SERVICE_ACCOUNT` | GHA, scraper, Vercel, local scripts |
| `TELEGRAM_BOT_TOKEN` | GHA, Vercel, Functions |
| `TELEGRAM_GROUP_CHAT_ID` | Daily digest (Functions) |
| `DISCORD_GROUP_WEBHOOK` | Daily digest (Functions) |

---

## Links

- Dashboard (placeholder): https://aquawatch-ph.web.app
- Telegram bot: https://t.me/aquawatchph_bot

---

## License

Private project — see repository owner for terms.
