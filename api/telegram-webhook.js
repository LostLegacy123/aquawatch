'use strict'

const admin = require('firebase-admin')

let db = null

function getDb() {
  if (db) return db
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured')
  }
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(raw)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  db = admin.firestore()
  return db
}

async function replyToTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing')
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch (err) {
    console.error('replyToTelegram failed:', err.message || err)
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const update = req.body || {}
    const message = update.message
    const text = message?.text ?? ''
    const chatId = message?.chat?.id

    if (!text.startsWith('/start ') || chatId === undefined || chatId === null) {
      res.status(200).json({ ok: true })
      return
    }

    const code = text.replace('/start ', '').trim()
    const firestore = getDb()

    const usersSnap = await firestore
      .collection('users')
      .where('telegramLinkCode', '==', code)
      .limit(1)
      .get()

    let reply
    if (usersSnap.empty) {
      reply =
        '❌ Invalid or expired code. Please generate a new one from the dashboard.'
    } else {
      const userDoc = usersSnap.docs[0]
      await userDoc.ref.update({
        telegramChatId: String(chatId),
        telegramLinkCode: null,
      })
      reply =
        '✅ Telegram linked! You will now receive notifications here.'
    }

    await replyToTelegram(chatId, reply)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('telegram-webhook error:', err.message || err)
    res.status(200).json({ ok: true })
  }
}
