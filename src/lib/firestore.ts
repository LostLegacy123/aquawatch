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
      onData(items)
    },
    (err) => {
      onError?.(err)
      onData([])
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
    limit(120),
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
