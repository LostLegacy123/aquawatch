'use strict'

const fetch = require('node-fetch')
const admin = require('firebase-admin')

const TRIGGERS = [
  { key: '3d', minDiff: -4320, maxDiff: -4315 },
  { key: '24h', minDiff: -1440, maxDiff: -1435 },
  { key: '3h', minDiff: -180, maxDiff: -175 },
  { key: '1h', minDiff: -60, maxDiff: -55 },
  { key: '15m', minDiff: -15, maxDiff: -10 },
  { key: 'exact', minDiff: 0, maxDiff: 5 },
  { key: 'miss_10m', minDiff: 10, maxDiff: 15 },
  { key: 'miss_1h', minDiff: 60, maxDiff: 65 },
  { key: 'miss_24h', minDiff: 1440, maxDiff: 1445 },
]

const TRIGGER_TIME_LABEL = {
  '3d': '3 days',
  '24h': '24 hours',
  '3h': '3 hours',
  '1h': '1 hour',
  '15m': '15 minutes',
  exact: '0 minutes',
}

function formatDate(date) {
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildMessage(eventKind, triggerKey, title, scheduledDate) {
  const date = formatDate(scheduledDate)
  const missed = triggerKey.startsWith('miss_')
  const X = TRIGGER_TIME_LABEL[triggerKey] ?? ''
  const kind = eventKind || 'deadline'

  if (kind === 'deadline') {
    if (missed) {
      return `Urgent Reminder: You missed the deadline for ${title || 'task'} that was ended on ${date}.`
    }
    return `Reminder: You have a deadline on ${date}. You have ${X} left before deadline.`
  }
  if (kind === 'meeting') {
    if (missed) {
      return `Urgent Reminder: You missed the meeting on ${date}.`
    }
    return `Reminder: You have a meeting on ${date}. You have ${X} left before the meeting.`
  }
  if (missed) {
    return `Urgent Reminder: You missed your business trip on ${date}.`
  }
  return `Reminder: You have a business trip on ${date}. You have ${X} left before the trip.`
}

function discordColorForTrigger(triggerKey) {
  if (triggerKey.startsWith('miss_')) return 0xff0000
  if (triggerKey === '1h') return 0xffaa00
  return 0x00aaff
}

function activeTriggerKey(diff) {
  for (const t of TRIGGERS) {
    if (diff >= t.minDiff && diff <= t.maxDiff) return t.key
  }
  return null
}

async function sendTelegram(chatId, message, token) {
  if (!token) {
    console.error('sendTelegram: TELEGRAM_BOT_TOKEN missing')
    return
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: escapeHtml(message),
          parse_mode: 'HTML',
        }),
      },
    )
    if (!res.ok) {
      console.error('sendTelegram: HTTP', res.status, await res.text())
    }
  } catch (err) {
    console.error('sendTelegram:', err.message || err)
  }
}

async function sendDiscord(webhookUrl, message, triggerKey) {
  if (!webhookUrl) return
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: 'AquaWatch PH',
            description: message,
            color: discordColorForTrigger(triggerKey),
          },
        ],
      }),
    })
    if (!res.ok) {
      console.error('sendDiscord: HTTP', res.status, await res.text())
    }
  } catch (err) {
    console.error('sendDiscord:', err.message || err)
  }
}

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set; exiting.')
    return null
  }
  try {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(raw)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }
    return admin.firestore()
  } catch (err) {
    console.error('Firebase init failed:', err.message || err)
    return null
  }
}

async function main() {
  const db = initFirebase()
  if (!db) return

  const token = process.env.TELEGRAM_BOT_TOKEN
  const nowMs = Date.now()

  const snapshot = await db
    .collection('events')
    .where('isCompleted', '==', false)
    .get()

  console.log(`Processing ${snapshot.size} open events`)

  for (const docSnap of snapshot.docs) {
    const ev = docSnap.data()
    const scheduledAt = ev.scheduledAt
    if (!scheduledAt || typeof scheduledAt.toMillis !== 'function') continue

    const scheduledMs = scheduledAt.toMillis()
    const scheduledDate = scheduledAt.toDate()
    const diff = Math.floor((nowMs - scheduledMs) / 60000)
    const triggerKey = activeTriggerKey(diff)
    if (!triggerKey) continue

    const sent = new Set(ev.notificationsSent || [])
    if (sent.has(triggerKey)) continue

    const message = buildMessage(
      ev.eventKind,
      triggerKey,
      ev.title,
      scheduledDate,
    )

    const userSnap = await db.collection('users').doc(ev.userId).get()
    const user = userSnap.data()
    if (!user) continue

    const channels = ev.notifyVia || []

    if (channels.includes('telegram') && user.telegramChatId) {
      await sendTelegram(user.telegramChatId, message, token)
    }

    if (channels.includes('discord') && user.discordWebhookUrl) {
      await sendDiscord(user.discordWebhookUrl, message, triggerKey)
    }

    try {
      await docSnap.ref.update({
        notificationsSent: admin.firestore.FieldValue.arrayUnion(triggerKey),
      })
    } catch (err) {
      console.error('Firestore update failed:', docSnap.id, err.message || err)
    }
  }

  console.log('Notification check complete')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
