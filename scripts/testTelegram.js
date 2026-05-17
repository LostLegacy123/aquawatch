'use strict'

const path = require('path')
const admin = require('firebase-admin')
const {
  parseTelegramChatIdsFromEnv,
  testTelegramConnection,
  normalizeChatId,
  sendTelegram,
} = require('./lib/telegram')
const { getLinkedTelegramChatIds } = require('./lib/telegramBroadcast')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
  }
  return admin.firestore()
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing in .env')
    process.exitCode = 1
    return
  }

  const envIds = parseTelegramChatIdsFromEnv({ includeGroup: true })
  console.log('Env chat ids:', envIds.length ? envIds.join(', ') : '(none)')

  const db = initFirebase()
  const linked = db ? await getLinkedTelegramChatIds(db) : []
  console.log(
    'Linked in Settings (Firestore):',
    linked.length ? linked.join(', ') : '(none — link in Dashboard Settings)',
  )

  console.log('')
  console.log('Testing env TELEGRAM_GROUP_CHAT_ID (may fail if id is wrong for this bot):')
  const groupId = normalizeChatId(process.env.TELEGRAM_GROUP_CHAT_ID)
  if (groupId) {
    await testTelegramConnection(token, groupId)
  }

  if (linked.length) {
    console.log('')
    console.log('Testing your linked Settings chat (this is what reminders use):')
    const ok = await sendTelegram(
      linked[0],
      'AquaWatch PH — test to your linked Telegram (Settings)',
      token,
    )
    if (ok) {
      console.log('SUCCESS: Linked Telegram works. Scraper digest will use this too.')
      process.exitCode = 0
      return
    }
  }

  if (!groupId && !linked.length) {
    console.error('No env group id and no linked Telegram user.')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
