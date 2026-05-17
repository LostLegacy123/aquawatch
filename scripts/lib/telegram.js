'use strict'

const https = require('https')

const MAX_MESSAGE_LENGTH = 4096
const REQUEST_TIMEOUT_MS = 30000

function getFetch() {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis)
  return require('node-fetch')
}

function postTelegramHttps(token, body) {
  const data = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: REQUEST_TIMEOUT_MS,
        family: 4,
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text,
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Telegram request timed out'))
    })
    req.write(data)
    req.end()
  })
}

/** Normalize chat id (string; keep negative group ids). */
function normalizeChatId(chatId) {
  if (chatId == null || chatId === '') return null
  let s = String(chatId).trim()
  if (!s) return null
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim()
  if (!s) return null
  if (/^-?\d+$/.test(s)) return s
  return s
}

function addIdFromEnvVar(ids, value) {
  if (!value) return
  const raw = String(value).trim()
  if (!raw) return
  for (const part of raw.split(/[,;\s]+/)) {
    const id = normalizeChatId(part)
    if (id) ids.add(id)
  }
}

/**
 * All Telegram destinations from env.
 * Supports: TELEGRAM_GROUP_CHAT_ID, TELEGRAM_CHAT_ID, TELEGRAM_CHAT_IDS, TELEGRAM_NOTIFY_CHAT_IDS, TELEGRAM_USER_ID
 */
function parseTelegramChatIdsFromEnv({ includeGroup = false } = {}) {
  const ids = new Set()
  if (includeGroup) {
    addIdFromEnvVar(ids, process.env.TELEGRAM_GROUP_CHAT_ID)
  }
  addIdFromEnvVar(ids, process.env.TELEGRAM_CHAT_ID)
  addIdFromEnvVar(ids, process.env.TELEGRAM_USER_ID)
  addIdFromEnvVar(ids, process.env.TELEGRAM_CHAT_IDS)
  addIdFromEnvVar(ids, process.env.TELEGRAM_NOTIFY_CHAT_IDS)
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

async function postTelegram(token, body) {
  try {
    const fetch = getFetch()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      )
      const text = await res.text()
      return { ok: res.ok, status: res.status, text }
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    console.warn('postTelegram fetch failed, using https fallback:', err.message || err)
    return postTelegramHttps(token, body)
  }
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
    const body = {
      chat_id: id,
      text: chunk,
      disable_web_page_preview: true,
    }
    let result
    try {
      result = await postTelegram(token, body)
    } catch (err) {
      console.error('sendTelegram:', id, err.message || err)
      ok = false
      continue
    }
    if (!result.ok) {
      console.error('sendTelegram:', id, result.status, result.text)
      if (result.text && result.text.includes('chat not found')) {
        console.error(
          'Hint: Add the bot to the group, send any message there, then set TELEGRAM_GROUP_CHAT_ID to that chat id (usually starts with -100).',
        )
      }
      if (result.status >= 500) {
        try {
          result = await postTelegram(token, body)
          if (result.ok) continue
          console.error('sendTelegram retry:', id, result.status, result.text)
        } catch (err) {
          console.error('sendTelegram retry:', id, err.message || err)
        }
      }
      ok = false
    }
  }
  if (ok) console.log(`sendTelegram: delivered to ${id}`)
  return ok
}

/** Send to every id from env (group + personal ids when includeGroup). */
async function sendTelegramToEnvRecipients(text, token, options) {
  const ids = parseTelegramChatIdsFromEnv(options)
  if (!ids.length) {
    console.error(
      'sendTelegramToEnvRecipients: no chat ids — set TELEGRAM_GROUP_CHAT_ID and/or TELEGRAM_CHAT_ID in env',
    )
    return false
  }
  console.log(`sendTelegramToEnvRecipients: sending to ${ids.length} chat(s)`)
  let any = false
  for (const id of ids) {
    if (await sendTelegram(id, text, token)) any = true
  }
  return any
}

function telegramGetHttps(token, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/${path}`,
        method,
        timeout: REQUEST_TIMEOUT_MS,
        family: 4,
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(text))
          } catch (e) {
            reject(e)
          }
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('getMe timed out'))
    })
    req.end()
  })
}

function getMeHttps(token) {
  return telegramGetHttps(token, 'getMe')
}

/** List recent chats the bot has seen (requires a message in that chat after bot was added). */
async function listRecentTelegramChats(token) {
  let data
  try {
    const fetch = getFetch()
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`)
    data = await res.json()
  } catch {
    data = await telegramGetHttps(token, 'getUpdates?limit=50')
  }
  if (!data.ok) {
    console.error('getUpdates failed:', data)
    return []
  }
  const chats = new Map()
  for (const update of data.result || []) {
    const msg = update.message || update.channel_post || update.my_chat_member?.chat
    const chat = msg?.chat || update.my_chat_member?.chat
    if (!chat?.id) continue
    chats.set(String(chat.id), {
      id: String(chat.id),
      type: chat.type,
      title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '(no name)',
    })
  }
  return [...chats.values()]
}

async function validateChatId(token, chatId) {
  const id = normalizeChatId(chatId)
  if (!id) return { ok: false, error: 'invalid id' }
  let data
  try {
    data = await telegramGetHttps(token, `getChat?chat_id=${encodeURIComponent(id)}`)
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  }
  if (!data.ok) return { ok: false, error: data.description || JSON.stringify(data) }
  return { ok: true, chat: data.result }
}

/** Quick connectivity test (getMe + optional send). */
async function testTelegramConnection(token, chatId) {
  let me
  try {
    const fetch = getFetch()
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    me = await meRes.json()
  } catch {
    me = await getMeHttps(token)
  }
  if (!me.ok) {
    console.error('getMe failed:', me)
    return false
  }
  console.log(`Bot: @${me.result.username}`)
  if (!chatId) return true

  const check = await validateChatId(token, chatId)
  if (!check.ok) {
    console.error(`getChat failed for ${normalizeChatId(chatId)}:`, check.error)
    console.error(
      'This id is wrong for this bot, or the bot is not in that group. Run: npm run list-telegram-chats',
    )
    return false
  }
  console.log(`Chat OK: ${check.chat.type} — ${check.chat.title || check.chat.username || chatId}`)

  return sendTelegram(chatId, 'AquaWatch PH — Telegram test OK', token)
}

module.exports = {
  sendTelegram,
  sendTelegramToEnvRecipients,
  normalizeChatId,
  parseTelegramChatIdsFromEnv,
  chunkText,
  testTelegramConnection,
  listRecentTelegramChats,
  validateChatId,
}
