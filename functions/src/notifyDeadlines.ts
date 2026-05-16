import * as admin from 'firebase-admin'
import { sendDiscord } from './sendDiscord'
import { sendTelegram } from './sendTelegram'

interface DeadlineDoc {
  id: string
  title: string
  description: string
  dueAt: admin.firestore.Timestamp
  notifyAt: admin.firestore.Timestamp
  notifyVia: string[]
  userId: string
}

interface UserDoc {
  telegramChatId?: string | null
  discordWebhookUrl?: string | null
  displayName?: string
}

export async function checkDeadlines(): Promise<void> {
  const db = admin.firestore()
  const now = admin.firestore.Timestamp.now()
  const token = process.env.TELEGRAM_BOT_TOKEN

  const snapshot = await db
    .collection('deadlines')
    .where('isNotified', '==', false)
    .where('notifyAt', '<=', now)
    .get()

  for (const docSnap of snapshot.docs) {
    const deadline = { id: docSnap.id, ...docSnap.data() } as DeadlineDoc
    const userSnap = await db.collection('users').doc(deadline.userId).get()
    const user = userSnap.data() as UserDoc | undefined

    if (!user) continue

    const channels = deadline.notifyVia ?? []

    if (channels.includes('telegram') && user.telegramChatId && token) {
      await sendTelegram(user.telegramChatId, deadline, token)
    }

    if (channels.includes('discord') && user.discordWebhookUrl) {
      await sendDiscord(
        user.discordWebhookUrl,
        deadline,
        user.displayName ?? 'User',
      )
    }

    await db.collection('deadlines').doc(deadline.id).update({ isNotified: true })
  }
}
