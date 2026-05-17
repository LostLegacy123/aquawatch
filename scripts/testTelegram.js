'use strict'

const path = require('path')
const {
  parseTelegramChatIdsFromEnv,
  testTelegramConnection,
  normalizeChatId,
} = require('./lib/telegram')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing in .env')
    process.exitCode = 1
    return
  }

  const ids = parseTelegramChatIdsFromEnv({ includeGroup: true })
  console.log('Chat ids from env:', ids.length ? ids.join(', ') : '(none)')

  const single =
    normalizeChatId(process.argv[2]) ||
    ids[0] ||
    normalizeChatId(process.env.TELEGRAM_GROUP_CHAT_ID)

  if (!single) {
    console.error('Pass a chat id argument or set TELEGRAM_GROUP_CHAT_ID / TELEGRAM_CHAT_ID in .env')
    process.exitCode = 1
    return
  }

  const ok = await testTelegramConnection(token, single)
  process.exitCode = ok ? 0 : 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
