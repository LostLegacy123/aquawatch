'use strict'

const fetch = require('node-fetch')
const admin = require('firebase-admin')

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

async function sendTelegram(chatId, text, token) {
  if (!token || !chatId) return false
  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  )
  if (!res.ok) {
    console.error('sendTelegram:', res.status, await res.text())
    return false
  }
  return true
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

async function runSendDailyDigest() {
  const db = initFirebase()
  if (!db) return

  const { startMs, endMs } = getDigestWindow()
  const startTs = admin.firestore.Timestamp.fromMillis(startMs)
  const endTs = admin.firestore.Timestamp.fromMillis(endMs)

  console.log(
    `Digest window (PHT): ${new Date(startMs).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} → ${new Date(endMs).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
  )

  const snapshot = await db
    .collection('articles')
    .where('publishedAt', '>=', startTs)
    .where('publishedAt', '<=', endTs)
    .get()

  if (snapshot.empty) {
    console.log('No articles in digest window')
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
    console.log('No articles matched rubric topics in window')
    return
  }

  const message = lines.join('\n').trim()
  const token = process.env.TELEGRAM_BOT_TOKEN
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID
  const discordWebhook = process.env.DISCORD_GROUP_WEBHOOK

  if (groupChatId) {
    await sendTelegram(groupChatId, message, token)
  } else {
    console.warn('TELEGRAM_GROUP_CHAT_ID not set — skip Telegram digest')
  }

  if (discordWebhook) {
    await sendDiscord(discordWebhook, message)
  } else {
    console.warn('DISCORD_GROUP_WEBHOOK not set — skip Discord digest')
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
