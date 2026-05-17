'use strict'

const path = require('path')
const fetch = require('node-fetch')
const admin = require('firebase-admin')
const { sendTelegramToEnvRecipients } = require('./lib/telegram')

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
} catch {
  /* optional for local runs */
}

const TOPICS = [
  'Wind Projects',
  'Water District Updates',
  'Water Related News',
]

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** 9:00 AM yesterday → 8:59:59 AM today (Asia/Manila) */
function getDigestWindow(now = new Date()) {
  const manilaNow = new Date(now.getTime() + MANILA_OFFSET_MS)
  const y = manilaNow.getUTCFullYear()
  const mo = manilaNow.getUTCMonth()
  const d = manilaNow.getUTCDate()
  const endMs = Date.UTC(y, mo, d, 8, 59, 59, 999) - MANILA_OFFSET_MS
  const startMs = Date.UTC(y, mo, d, 9, 0, 0, 0) - MANILA_OFFSET_MS - 24 * 60 * 60 * 1000
  return { startMs, endMs }
}

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set; exiting.')
    return null
  }
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(raw)),
      })
    }
    return admin.firestore()
  } catch (err) {
    console.error('Firebase init failed:', err.message || err)
    return null
  }
}

async function sendDiscord(webhookUrl, text) {
  if (!webhookUrl) return false
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: 'AquaWatch PH — Daily digest',
          description: text.slice(0, 4000),
          color: 0x00cc66,
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('sendDiscord:', res.status, await res.text())
    return false
  }
  return true
}

async function fetchDigestArticles(db) {
  const { startMs, endMs } = getDigestWindow()
  const startTs = admin.firestore.Timestamp.fromMillis(startMs)
  const endTs = admin.firestore.Timestamp.fromMillis(endMs)

  console.log(
    `Digest window (PHT): ${new Date(startMs).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} → ${new Date(endMs).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
  )

  let snapshot = await db
    .collection('articles')
    .where('publishedAt', '>=', startTs)
    .where('publishedAt', '<=', endTs)
    .get()

  if (snapshot.empty) {
    console.log('No articles in 9AM–9AM window; using last 24 hours (manual/test runs)')
    const fallbackStart = admin.firestore.Timestamp.fromMillis(
      Date.now() - 24 * 60 * 60 * 1000,
    )
    snapshot = await db
      .collection('articles')
      .where('publishedAt', '>=', fallbackStart)
      .get()
  }

  return { snapshot, endMs }
}

async function runSendDailyDigest() {
  const db = initFirebase()
  if (!db) {
    process.exitCode = 1
    return
  }

  const { snapshot, endMs } = await fetchDigestArticles(db)

  if (snapshot.empty) {
    console.log('No articles to digest — run scraper first')
    process.exitCode = 1
    return
  }

  const byTopic = new Map(TOPICS.map((t) => [t, []]))
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    if (!TOPICS.includes(data.topic)) continue
    byTopic.get(data.topic).push({ id: docSnap.id, ...data })
  }

  const dateLabel = new Date(endMs).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
  })
  const lines = [
    `Daily digest — ${dateLabel}`,
    '(9:00 AM yesterday – 8:59 AM today, Philippine time)',
    '',
  ]
  let hasAny = false

  for (const topic of TOPICS) {
    const articles = byTopic.get(topic) || []
    if (articles.length === 0) continue
    hasAny = true
    lines.push(topic)
    for (const a of articles) {
      lines.push(`• ${a.title || 'Untitled'} (${a.source || 'source'})`)
      if (a.url) lines.push(`  ${a.url}`)
    }
    lines.push('')
  }

  if (!hasAny) {
    console.log('No articles matched rubric topics')
    process.exitCode = 1
    return
  }

  const message = lines.join('\n').trim()
  const token = process.env.TELEGRAM_BOT_TOKEN
  const discordWebhook = process.env.DISCORD_GROUP_WEBHOOK

  let sent = false
  if (token) {
    try {
      sent = (await sendTelegramToEnvRecipients(message, token, { includeGroup: true })) || sent
    } catch (err) {
      console.error('Telegram digest failed:', err.message || err)
    }
    if (!sent) {
      console.warn(
        'Telegram digest not sent — set TELEGRAM_GROUP_CHAT_ID and/or TELEGRAM_CHAT_IDS in GitHub Secrets',
      )
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN missing')
  }

  if (discordWebhook) {
    try {
      sent = (await sendDiscord(discordWebhook, message)) || sent
    } catch (err) {
      console.error('Discord digest failed:', err.message || err)
    }
  } else {
    console.warn('DISCORD_GROUP_WEBHOOK not set')
  }

  if (!sent) {
    console.error('Digest not sent — add group secrets to GitHub Actions')
    process.exitCode = 1
    return
  }

  const batch = db.batch()
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    if (TOPICS.includes(data.topic)) {
      batch.update(docSnap.ref, { sentToGroup: true })
    }
  }
  await batch.commit()
  console.log(`Daily digest sent for ${snapshot.size} articles in window`)
}

module.exports = { runSendDailyDigest, getDigestWindow }

if (require.main === module) {
  runSendDailyDigest().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
