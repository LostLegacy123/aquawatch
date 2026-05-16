import type { Timestamp } from 'firebase/firestore'

export type WaterSource = 'PAGASA' | 'DOE'

export interface WaterData {
  id: string
  source: WaterSource
  category: string
  title: string
  value: string
  unit: string
  location: string
  fetchedAt: Timestamp | null
  rawUrl: string
}

export type NotifyChannel = 'telegram' | 'discord'

export type EventKind = 'deadline' | 'meeting' | 'business_trip'

/** Document shape in the `events` Firestore collection */
export interface ScheduledEvent {
  id: string
  userId: string
  eventKind: EventKind
  title: string
  description: string
  scheduledAt: Timestamp
  notifyVia: NotifyChannel[]
  notificationsSent: string[]
  isCompleted: boolean
  createdAt: Timestamp
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  telegramChatId: string | null
  telegramLinkCode: string | null
  discordWebhookUrl: string | null
  createdAt: Timestamp | null
}
