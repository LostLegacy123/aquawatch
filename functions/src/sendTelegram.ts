/** Escape dynamic text for Telegram MarkdownV2. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

/**
 * POST sendMessage with MarkdownV2. Reads TELEGRAM_BOT_TOKEN from process.env.
 * Never throws — logs errors and returns.
 */
export async function sendTelegram(chatId: string, message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('sendTelegram: TELEGRAM_BOT_TOKEN missing')
    return
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'MarkdownV2',
        }),
      },
    )
    if (!res.ok) {
      // eslint-disable-next-line no-console -- Cloud Functions logging
      console.error('sendTelegram: HTTP', res.status, await res.text())
    }
  } catch (err) {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('sendTelegram:', err)
  }
}
