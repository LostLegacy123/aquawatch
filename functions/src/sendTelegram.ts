export interface DeadlinePayload {
  title: string
  description: string
  dueAt: { toDate: () => Date }
}

export async function sendTelegram(
  chatId: string,
  deadline: DeadlinePayload,
  token: string,
): Promise<void> {
  const dueFormatted = deadline.dueAt.toDate().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const text = [
    '⏰ *Deadline Reminder*',
    `*${deadline.title}*`,
    `📋 ${deadline.description || 'No description'}`,
    `🗓 Due: ${dueFormatted}`,
    '⚡ Sent from AquaWatch PH',
  ].join('\n')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })

  if (!res.ok) {
    throw new Error(`Telegram API error: ${res.status}`)
  }
}
