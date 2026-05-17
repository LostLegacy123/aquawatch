'use strict'

const fetch = require('node-fetch')
const admin = require('firebase-admin')

const TOPICS = [
  'Wind Projects',
  'Water District Updates',
  'Water Related News',
]

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
  if (!token || !chatId) return
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
  }
}

async function sendDiscord(webhookUrl, title, url, source) {
  if (!webhookUrl) return
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: 'AquaWatch PH — New article',
          description: `${title}\n${source}\n${url}`,
          color: 0x00aaff,
        },
      ],
    }),
  })
}

/** Share articles not yet sent to group (near real-time, rubric option c). */
async function runShareNewArticles() {
  const db = initFirebase()
  if (!db) return

  const snapshot = await db
    .collection('articles')
    .where('sentToGroup', '==', false)
    .limit(30)
    .get()

  if (snapshot.empty) {
    console.log('No new articles to share')
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID
  const discordWebhook = process.env.DISCORD_GROUP_WEBHOOK

  let shared = 0
  const batch = db.batch()

  for (const docSnap of snapshot.docs) {
    const a = docSnap.data()
    if (!TOPICS.includes(a.topic)) continue

    const text = [
      `New: ${a.title || 'Untitled'}`,
      `Topic: ${a.topic}`,
      `Source: ${a.source || 'Unknown'}`,
      a.url || '',
    ]
      .filter(Boolean)
      .join('\n')

    if (groupChatId) await sendTelegram(groupChatId, text, token)
    if (discordWebhook) {
      await sendDiscord(discordWebhook, a.title, a.url, a.source)
    }

    batch.update(docSnap.ref, { sentToGroup: true })
    shared += 1
  }

  if (shared > 0) {
    await batch.commit()
  }
  console.log(`Shared ${shared} new articles to group`)
}

module.exports = { runShareNewArticles }

if (require.main === module) {
  runShareNewArticles().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
