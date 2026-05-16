import type { Request, Response } from 'express'
import * as admin from 'firebase-admin'
import { escapeMarkdownV2 } from './sendTelegram'

/**
 * HTTP handler: link Telegram chat to user via /start CODE.
 * Always responds HTTP 200 for Telegram (except wrong method).
 */
export async function handleTelegramWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('telegramWebhook: TELEGRAM_BOT_TOKEN missing')
    res.status(200).json({ ok: true })
    return
  }

  const update = req.body as {
    message?: { text?: string; chat?: { id?: number | string } }
  }
  const message = update?.message
  const text: string = message?.text ?? ''
  const chatId = message?.chat?.id

  if (!text.startsWith('/start ') || chatId === undefined || chatId === null) {
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

  let replyPlain: string

  if (usersSnap.empty) {
    replyPlain =
      '❌ Invalid or expired code. Please generate a new one from the dashboard.'
  } else {
    const userDoc = usersSnap.docs[0]
    await userDoc.ref.update({
      telegramChatId: String(chatId),
      telegramLinkCode: null,
    })
    replyPlain =
      '✅ Telegram linked! You will now receive notifications here.'
  }

  const replyMd = escapeMarkdownV2(replyPlain)

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyMd,
        parse_mode: 'MarkdownV2',
      }),
    })
  } catch (err) {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('telegramWebhook: reply send failed', err)
  }

  res.status(200).json({ ok: true })
}
