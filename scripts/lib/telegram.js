'use strict'

const fetch = require('node-fetch')

const MAX_MESSAGE_LENGTH = 4096

/** Normalize chat id (string; keep negative group ids). */
function normalizeChatId(chatId) {
  if (chatId == null || chatId === '') return null
  const s = String(chatId).trim()
  if (!s) return null
  if (/^-?\d+$/.test(s)) return s
  return s
}

/** Comma-separated TELEGRAM_CHAT_IDS; optionally TELEGRAM_GROUP_CHAT_ID. */
function parseTelegramChatIdsFromEnv({ includeGroup = false } = {}) {
  const ids = new Set()
  if (includeGroup) {
    const group = normalizeChatId(process.env.TELEGRAM_GROUP_CHAT_ID)
    if (group) ids.add(group)
  }
  const list = process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_NOTIFY_CHAT_IDS || ''
  for (const part of list.split(',')) {
    const id = normalizeChatId(part)
    if (id) ids.add(id)
  }
  return [...ids]
}

function chunkText(text, maxLen = MAX_MESSAGE_LENGTH) {
  const chunks = []
  let rest = String(text)
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen)
    if (cut < maxLen * 0.5) cut = maxLen
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  if (rest.length) chunks.push(rest)
  return chunks.length ? chunks : ['']
}

/**
 * Send plain-text message(s). Returns true if all chunks succeeded.
 */
async function sendTelegram(chatId, text, token) {
  const id = normalizeChatId(chatId)
  if (!token || !id) {
    console.error('sendTelegram: missing token or chat_id')
    return false
  }
  const chunks = chunkText(text)
  let ok = true
  for (const chunk of chunks) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: id,
            text: chunk,
            disable_web_page_preview: true,
          }),
        },
      )
      if (!res.ok) {
        console.error('sendTelegram:', id, res.status, await res.text())
        ok = false
      }
    } catch (err) {
      console.error('sendTelegram:', id, err.message || err)
      ok = false
    }
  }
  return ok
}

/** Send to every id from env (group + TELEGRAM_CHAT_IDS when includeGroup). */
async function sendTelegramToEnvRecipients(text, token, options) {
  const ids = parseTelegramChatIdsFromEnv(options)
  if (!ids.length) return false
  let any = false
  for (const id of ids) {
    if (await sendTelegram(id, text, token)) any = true
  }
  return any
}

module.exports = {
  sendTelegram,
  sendTelegramToEnvRecipients,
  normalizeChatId,
  parseTelegramChatIdsFromEnv,
  chunkText,
}
