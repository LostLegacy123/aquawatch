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

export const ARTICLE_TOPICS = [
  'Wind Projects',
  'Water District Updates',
  'Water Related News',
] as const

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number]

export interface Article {
  id: string
  url: string
  title: string
  summary: string
  source: string
  topic: ArticleTopic | string
  publishedAt: Timestamp
  imageUrl: string | null
  sentToGroup?: boolean
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
