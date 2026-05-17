'use strict'

const {
  sendTelegram,
  sendTelegramToEnvRecipients,
  normalizeChatId,
} = require('./telegram')

/** Everyone who linked Telegram in Settings (same ids as schedule reminders). */
async function getLinkedTelegramChatIds(db) {
  const ids = new Set()
  const snap = await db.collection('users').get()
  for (const doc of snap.docs) {
    const id = normalizeChatId(doc.data().telegramChatId)
    if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * Send to group env ids, then every Settings-linked Telegram user.
 * Matches how schedule reminders reach you when group id is wrong.
 */
async function sendTelegramBroadcast(db, message, token) {
  if (!token) return false

  let sent = false

  if (await sendTelegramToEnvRecipients(message, token, { includeGroup: true })) {
    sent = true
  }

  if (db) {
    const linked = await getLinkedTelegramChatIds(db)
    for (const chatId of linked) {
      if (await sendTelegram(chatId, message, token)) {
        console.log(`Telegram sent to linked user chat ${chatId}`)
        sent = true
      }
    }
    if (linked.length === 0) {
      console.warn('No linked Telegram users in Firestore — link in Dashboard Settings')
    }
  }

  return sent
}

module.exports = { sendTelegramBroadcast, getLinkedTelegramChatIds }
