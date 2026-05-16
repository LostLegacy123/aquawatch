import * as admin from 'firebase-admin'
import { escapeMarkdownV2, sendTelegram } from './sendTelegram'
import { sendDiscord } from './sendDiscord'

const TOPICS = [
  'Wind Projects',
  'Water District Updates',
  'Water Related News',
] as const

interface ArticleDoc {
  publishedAt: admin.firestore.Timestamp
  sentToGroup: boolean
  topic: string
  title?: string
}

type ArticleRow = ArticleDoc & { id: string }

export async function runSendDailyDigest(): Promise<void> {
  const db = admin.firestore()
  const nowMs = Date.now()
  const startMs = nowMs - 24 * 60 * 60 * 1000

  const startTs = admin.firestore.Timestamp.fromMillis(startMs)
  const endTs = admin.firestore.Timestamp.fromMillis(nowMs)

  const snapshot = await db
    .collection('articles')
    .where('publishedAt', '>=', startTs)
    .where('publishedAt', '<=', endTs)
    .where('sentToGroup', '==', false)
    .get()

  if (snapshot.empty) return

  const byTopic: Map<string, ArticleRow[]> = new Map()
  for (const topic of TOPICS) {
    byTopic.set(topic, [])
  }

  for (const d of snapshot.docs) {
    const data = d.data() as ArticleDoc
    const topic = data.topic
    if (!TOPICS.includes(topic as (typeof TOPICS)[number])) continue
    const list = byTopic.get(topic) ?? []
    list.push({ id: d.id, ...data })
    byTopic.set(topic, list)
  }

  const lines: string[] = []
  lines.push(
    escapeMarkdownV2(
      `Daily digest — ${new Date(nowMs).toLocaleDateString('en-PH')}`,
    ),
  )
  lines.push('')

  let hasAny = false
  for (const topic of TOPICS) {
    const articles = byTopic.get(topic) ?? []
    if (articles.length === 0) continue
    hasAny = true
    lines.push(`*${escapeMarkdownV2(topic)}*`)
    for (const a of articles) {
      const t = a.title ?? 'Untitled'
      lines.push(`• ${escapeMarkdownV2(t)}`)
    }
    lines.push('')
  }

  if (!hasAny) return

  const telegramMessage = lines.join('\n').trim()
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID
  const discordWebhook = process.env.DISCORD_GROUP_WEBHOOK

  if (groupChatId) {
    await sendTelegram(groupChatId, telegramMessage)
  } else {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('runSendDailyDigest: TELEGRAM_GROUP_CHAT_ID missing')
  }

  if (discordWebhook) {
    const plainSections: string[] = []
    plainSections.push(`Daily digest — ${new Date(nowMs).toLocaleDateString('en-PH')}`)
    plainSections.push('')
    for (const topic of TOPICS) {
      const articles = byTopic.get(topic) ?? []
      if (articles.length === 0) continue
      plainSections.push(`**${topic}**`)
      for (const a of articles) {
        plainSections.push(`• ${a.title ?? 'Untitled'}`)
      }
      plainSections.push('')
    }
    await sendDiscord(discordWebhook, {
      title: 'Daily digest',
      description: plainSections.join('\n').trim(),
      color: 0x00cc66,
    })
  } else {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('runSendDailyDigest: DISCORD_GROUP_WEBHOOK missing')
  }

  const batch = db.batch()
  for (const d of snapshot.docs) {
    const data = d.data() as ArticleDoc
    if (TOPICS.includes(data.topic as (typeof TOPICS)[number])) {
      batch.update(d.ref, { sentToGroup: true })
    }
  }
  await batch.commit()
}
