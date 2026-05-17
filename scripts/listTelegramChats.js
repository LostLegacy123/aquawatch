'use strict'

const path = require('path')
const { listRecentTelegramChats } = require('./lib/telegram')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing in .env')
    process.exitCode = 1
    return
  }

  console.log('Fetching chats from getUpdates…')
  console.log('If the list is empty:')
  console.log('  1. Add @aquawatchph_bot to your Telegram group')
  console.log('  2. Send any message in that group (e.g. "test")')
  console.log('  3. Run this script again')
  console.log('')

  const chats = await listRecentTelegramChats(token)
  if (chats.length === 0) {
    console.log('No chats found.')
    console.log(
      'If the bot uses a Vercel webhook, getUpdates may be empty — use @RawDataBot in the group to see the real id, or send a DM to the bot first.',
    )
    process.exitCode = 1
    return
  }

  console.log('Use one of these ids for TELEGRAM_GROUP_CHAT_ID (groups start with -100):')
  console.log('')
  for (const c of chats) {
    console.log(`  ${c.id}  (${c.type})  ${c.title}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
