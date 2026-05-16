/**
 * POST embed JSON to Discord webhook. Never throws — logs errors and returns.
 */
export async function sendDiscord(
  webhookUrl: string,
  embed: object,
): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console -- Cloud Functions logging
      console.error('sendDiscord: HTTP', res.status, await res.text())
    }
  } catch (err) {
    // eslint-disable-next-line no-console -- Cloud Functions logging
    console.error('sendDiscord:', err)
  }
}
