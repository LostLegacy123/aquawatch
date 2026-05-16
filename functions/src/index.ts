import * as admin from 'firebase-admin'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { checkDeadlines } from './notifyDeadlines'
import { sendDiscord } from './sendDiscord'

admin.initializeApp()

export const checkDeadlinesScheduled = onSchedule('every 5 minutes', async () => {
  await checkDeadlines()
})

export const telegramWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    res.status(500).send('Bot token not configured')
    return
  }

  const update = req.body
  const message = update?.message
  const text: string = message?.text ?? ''
  const chatId = message?.chat?.id

  if (!text.startsWith('/start ') || !chatId) {
    res.status(200).json({ ok: true })
    return
  }

  const code = text.replace('/start ', '').trim()
  const db = admin.firestore()

  const usersSnap = await db
    .collection('users')
    .where('telegramLinkCode', '==', code)
    .limit(1)
    .get()

  let reply: string

  if (usersSnap.empty) {
    reply =
      '❌ Invalid or expired code. Please generate a new one from the dashboard.'
  } else {
    const userDoc = usersSnap.docs[0]
    await userDoc.ref.update({
      telegramChatId: String(chatId),
      telegramLinkCode: null,
    })
    reply = '✅ Your Telegram is now linked to AquaWatch PH!'
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  })

  res.status(200).json({ ok: true })
})

export const testDiscordWebhook = onCall(async (request) => {
  const webhookUrl = request.data?.webhookUrl as string | undefined
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new HttpsError('invalid-argument', 'webhookUrl is required')
  }

  try {
    await sendDiscord(
      webhookUrl,
      {
        title: 'Test Notification',
        description: 'Your Discord webhook is working correctly.',
        dueAt: { toDate: () => new Date() },
      },
      request.auth?.token?.name ?? 'AquaWatch PH User',
    )
    return { success: true }
  } catch (err) {
    throw new HttpsError(
      'internal',
      err instanceof Error ? err.message : 'Webhook test failed',
    )
  }
})
