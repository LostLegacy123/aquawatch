import * as admin from 'firebase-admin'
import { escapeMarkdownV2, sendTelegram } from './sendTelegram'
import { sendDiscord } from './sendDiscord'

export type EventKind = 'deadline' | 'meeting' | 'business_trip'

interface EventDoc {
  userId: string
  scheduledAt: admin.firestore.Timestamp
  isCompleted: boolean
  notificationsSent: string[]
  notifyVia: string[]
  eventKind: EventKind
  title?: string
}

interface UserDoc {
  telegramChatId?: string | null
  discordWebhookUrl?: string | null
}

const TRIGGER_TIME_LABEL: Record<string, string> = {
  '3d': '3 days',
  '24h': '24 hours',
  '3h': '3 hours',
  '1h': '1 hour',
  '15m': '15 minutes',
  exact: '0 minutes',
}

/** Upcoming triggers: minutes-until bands (non-overlapping). */
const UPCOMING_TRIGGERS: {
  key: string
  minU: number
  maxU: number
}[] = [
  { key: '3d', minU: 4320, maxU: Number.POSITIVE_INFINITY },
  { key: '24h', minU: 1440, maxU: 4320 },
  { key: '3h', minU: 180, maxU: 1440 },
  { key: '1h', minU: 60, maxU: 180 },
  { key: '15m', minU: 15, maxU: 60 },
  { key: 'exact', minU: 0, maxU: 15 },
]

/** Missed triggers: minutes-after bands. */
const MISSED_TRIGGERS: { key: string; minD: number; maxD: number }[] = [
  { key: 'miss_10m', minD: 10, maxD: 60 },
  { key: 'miss_1h', minD: 60, maxD: 1440 },
  { key: 'miss_24h', minD: 1440, maxD: Number.POSITIVE_INFINITY },
]

function formatDate(date: Date): string {
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })
}

function buildPlainMessage(
  kind: EventKind,
  triggerKey: string,
  title: string | undefined,
  scheduledDate: Date,
): string {
  const date = formatDate(scheduledDate)
  const missed = triggerKey.startsWith('miss_')
  const X = TRIGGER_TIME_LABEL[triggerKey] ?? ''

  if (kind === 'deadline') {
    if (missed) {
      return `Urgent Reminder: You missed the deadline for ${title ?? 'task'} that was ended on ${date}.`
    }
    return `Reminder: You have a deadline on ${date}. You have ${X} left before deadline.`
  }
  if (kind === 'meeting') {
    if (missed) {
      return `Urgent Reminder: You missed the meeting on ${date}.`
    }
    return `Reminder: You have a meeting on ${date}. You have ${X} left before the meeting.`
  }
  // business_trip
  if (missed) {
    return `Urgent Reminder: You missed your business trip on ${date}.`
  }
  return `Reminder: You have a business trip on ${date}. You have ${X} left before the trip.`
}

function discordColorForTrigger(triggerKey: string): number {
  if (triggerKey.startsWith('miss_')) return 0xff0000
  if (triggerKey === '1h') return 0xffaa00
  return 0x00aaff
}

function buildTelegramBody(
  kind: EventKind,
  triggerKey: string,
  title: string | undefined,
  scheduledDate: Date,
): string {
  const raw = buildPlainMessage(kind, triggerKey, title, scheduledDate)
  return escapeMarkdownV2(raw)
}

function activeUpcomingKeys(u: number): string[] {
  return UPCOMING_TRIGGERS.filter(
    (t) => u >= t.minU && u < t.maxU,
  ).map((t) => t.key)
}

function activeMissedKeys(d: number): string[] {
  return MISSED_TRIGGERS.filter(
    (t) => d >= t.minD && d < t.maxD,
  ).map((t) => t.key)
}

export async function runCheckNotifications(): Promise<void> {
  const db = admin.firestore()
  const nowMs = Date.now()

  const snapshot = await db.collection('events').where('isCompleted', '==', false).get()

  for (const docSnap of snapshot.docs) {
    const ev = { id: docSnap.id, ...docSnap.data() } as EventDoc & { id: string }
    const scheduledMs = ev.scheduledAt.toMillis()
    const scheduledDate = ev.scheduledAt.toDate()
    const sent = new Set(ev.notificationsSent ?? [])
    const u = Math.floor((scheduledMs - nowMs) / 60000)
    const d = Math.floor((nowMs - scheduledMs) / 60000)

    const toSend: string[] =
      scheduledMs > nowMs ? activeUpcomingKeys(u) : activeMissedKeys(d)

    for (const triggerKey of toSend) {
      if (sent.has(triggerKey)) continue

      const bodyMd = buildTelegramBody(
        ev.eventKind ?? 'deadline',
        triggerKey,
        ev.title,
        scheduledDate,
      )

      const plainForDiscord = buildPlainMessage(
        ev.eventKind ?? 'deadline',
        triggerKey,
        ev.title,
        scheduledDate,
      )

      const userSnap = await db.collection('users').doc(ev.userId).get()
      const user = userSnap.data() as UserDoc | undefined
      if (!user) continue

      const channels = ev.notifyVia ?? []

      if (channels.includes('telegram') && user.telegramChatId) {
        await sendTelegram(user.telegramChatId, bodyMd)
      }

      if (channels.includes('discord') && user.discordWebhookUrl) {
        const embed = {
          title: 'AquaWatch PH',
          description: plainForDiscord,
          color: discordColorForTrigger(triggerKey),
        }
        await sendDiscord(user.discordWebhookUrl, embed)
      }

      await docSnap.ref.update({
        notificationsSent: admin.firestore.FieldValue.arrayUnion(triggerKey),
      })
      sent.add(triggerKey)
    }
  }
}
