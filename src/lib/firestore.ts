import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import type { Deadline, NotifyChannel, UserProfile, WaterData } from '../types'

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

export async function createDeadline(input: {
  userId: string
  title: string
  description: string
  dueAt: Date
  notifyVia: NotifyChannel[]
  notifyMinutesBefore: number
}): Promise<void> {
  const notifyAt = new Date(input.dueAt.getTime() - input.notifyMinutesBefore * 60 * 1000)
  await addDoc(collection(db, 'deadlines'), {
    userId: input.userId,
    title: input.title,
    description: input.description,
    dueAt: Timestamp.fromDate(input.dueAt),
    notifyAt: Timestamp.fromDate(notifyAt),
    notifyVia: input.notifyVia,
    notifyMinutesBefore: input.notifyMinutesBefore,
    isNotified: false,
    createdAt: serverTimestamp(),
  })
}

export function subscribeUserDeadlines(
  userId: string,
  onData: (items: Deadline[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'deadlines'),
    where('userId', '==', userId),
    orderBy('dueAt', 'asc'),
  )
  return onSnapshot(q, (snapshot) => {
    onData(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Deadline[],
    )
  })
}

export async function deleteDeadline(id: string): Promise<void> {
  await deleteDoc(doc(db, 'deadlines', id))
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
