export interface DeadlinePayload {
  title: string
  description: string
  dueAt: { toDate: () => Date }
}

export async function sendDiscord(
  webhookUrl: string,
  deadline: DeadlinePayload,
  userName: string,
): Promise<void> {
  const dueDate = deadline.dueAt.toDate()
  const now = Date.now()
  const diffMs = dueDate.getTime() - now

  let color = 0x00aaff
  if (diffMs < 0) color = 0xff0000
  else if (diffMs < 3600000) color = 0xffaa00

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: '⏰ Deadline Reminder',
          description: `${deadline.title}\n${deadline.description || ''}`,
          color,
          fields: [
            {
              name: 'Due At',
              value: dueDate.toLocaleString('en-PH'),
              inline: true,
            },
            {
              name: 'Set By',
              value: userName,
              inline: true,
            },
          ],
          footer: { text: 'AquaWatch PH Notification System' },
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status}`)
  }
}
