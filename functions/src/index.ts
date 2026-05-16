import * as admin from 'firebase-admin'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { runCheckNotifications } from './checkNotifications'
import { runSendDailyDigest } from './sendDailyDigest'
import { handleTelegramWebhook } from './telegramWebhook'

admin.initializeApp()

export const checkNotifications = onSchedule(
  {
    schedule: '*/5 * * * *',
    timeZone: 'UTC',
  },
  async () => {
    await runCheckNotifications()
  },
)

export const sendDailyDigest = onSchedule(
  {
    schedule: '0 1 * * *',
    timeZone: 'UTC',
  },
  async () => {
    await runSendDailyDigest()
  },
)

export const telegramWebhook = onRequest(async (req, res) => {
  await handleTelegramWebhook(req, res)
})

export const testDiscordWebhook = onCall(async (request) => {
  const webhookUrl = request.data?.webhookUrl as string | undefined
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new HttpsError('invalid-argument', 'webhookUrl is required')
  }

  const embed = {
    title: '✅ AquaWatch PH',
    description:
      'Discord connection verified! You will receive notifications here.',
    color: 0x00cc66,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new HttpsError(
        'internal',
        `Discord webhook error: ${res.status} ${text}`,
      )
    }
    return { success: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    throw new HttpsError(
      'internal',
      err instanceof Error ? err.message : 'Webhook test failed',
    )
  }
})
