import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import type {
  Article,
  EventKind,
  NotifyChannel,
  ScheduledEvent,
  UserProfile,
  WaterData,
} from '../types'
import { ARTICLE_TOPICS } from '../types'

export const MOCK_WATER_DATA: WaterData[] = [
  {
    id: 'mock-pagasa-1',
    source: 'PAGASA',
    category: 'Water Level',
    title: 'Angat Dam Water Level',
    value: '198.42',
    unit: 'm',
    location: 'Bulacan',
    fetchedAt: Timestamp.fromDate(new Date(Date.now() - 45 * 60 * 1000)),
    rawUrl: 'https://www.pagasa.dost.gov.ph/',
  },
  {
    id: 'mock-pagasa-2',
    source: 'PAGASA',
    category: 'Flood Alert',
    title: 'Marikina River Alert Level',
    value: '15.2',
    unit: 'm',
    location: 'Marikina City',
    fetchedAt: Timestamp.fromDate(new Date(Date.now() - 120 * 60 * 1000)),
    rawUrl: 'https://www.pagasa.dost.gov.ph/',
  },
  {
    id: 'mock-doe-1',
    source: 'DOE',
    category: 'Fuel Price',
    title: 'Diesel (Metro Manila)',
    value: '58.45',
    unit: 'PHP/L',
    location: 'NCR',
    fetchedAt: Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000)),
    rawUrl: 'https://www.doe.gov.ph/',
  },
]

export function subscribeWaterData(
  onData: (items: WaterData[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'waterData'), orderBy('fetchedAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as WaterData[]
      onData(items.length > 0 ? items : MOCK_WATER_DATA)
    },
    (err) => {
      onError?.(err)
      onData(MOCK_WATER_DATA)
    },
  )
}

export function subscribeArticles(
  onData: (items: Article[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'articles'),
    orderBy('publishedAt', 'desc'),
    limit(80),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Article[],
      )
    },
    (err) => {
      onError?.(err)
      onData([])
    },
  )
}

export { ARTICLE_TOPICS }

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      onData(null)
      return
    }
    onData({ uid, ...snap.data() } as UserProfile)
  })
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email,
      displayName,
      telegramChatId: null,
      telegramLinkCode: null,
      discordWebhookUrl: null,
      createdAt: serverTimestamp(),
    })
  }
}

export async function createEvent(input: {
  userId: string
  eventKind: EventKind
  title: string
  description: string
  scheduledAt: Date
  notifyVia: NotifyChannel[]
}): Promise<void> {
  await addDoc(collection(db, 'events'), {
    userId: input.userId,
    eventKind: input.eventKind,
    title: input.title,
    description: input.description,
    scheduledAt: Timestamp.fromDate(input.scheduledAt),
    notifyVia: input.notifyVia,
    notificationsSent: [],
    isCompleted: false,
    createdAt: serverTimestamp(),
  })
}

export function subscribeUserEvents(
  userId: string,
  onData: (items: ScheduledEvent[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'events'),
    where('userId', '==', userId),
    orderBy('scheduledAt', 'asc'),
  )
  return onSnapshot(q, (snapshot) => {
    onData(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ScheduledEvent[],
    )
  })
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'events', id))
}

export async function setTelegramLinkCode(uid: string, code: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { telegramLinkCode: code })
}

export async function unlinkTelegram(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    telegramChatId: null,
    telegramLinkCode: null,
  })
}

export async function saveDiscordWebhook(uid: string, url: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { discordWebhookUrl: url })
}

export async function testDiscordWebhook(webhookUrl: string): Promise<void> {
  const fn = httpsCallable<{ webhookUrl: string }, { success: boolean }>(
    functions,
    'testDiscordWebhook',
  )
  await fn({ webhookUrl })
}

export function generateLinkCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
