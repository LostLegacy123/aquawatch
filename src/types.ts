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

export interface Deadline {
  id: string
  userId: string
  title: string
  description: string
  dueAt: Timestamp
  notifyAt: Timestamp
  notifyVia: NotifyChannel[]
  notifyMinutesBefore: number
  isNotified: boolean
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
