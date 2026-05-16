import { useEffect, useState } from 'react'
import { Check, MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  generateLinkCode,
  saveDiscordWebhook,
  setTelegramLinkCode,
  subscribeUserProfile,
  testDiscordWebhook,
  unlinkTelegram,
} from '../lib/firestore'
import type { UserProfile } from '../types'

export function Settings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [discordUrl, setDiscordUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'YourBotName'

  useEffect(() => {
    if (!user) return
    return subscribeUserProfile(user.uid, setProfile)
  }, [user])

  useEffect(() => {
    if (profile?.discordWebhookUrl) {
      setDiscordUrl(profile.discordWebhookUrl)
    }
  }, [profile?.discordWebhookUrl])

  const handleGenerateCode = async () => {
    if (!user) return
    const code = generateLinkCode()
    await setTelegramLinkCode(user.uid, code)
    setLinkCode(code)
  }

  const handleUnlinkTelegram = async () => {
    if (!user) return
    await unlinkTelegram(user.uid)
    setLinkCode(null)
  }

  const handleSaveDiscord = async () => {
    if (!user || !discordUrl.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await saveDiscordWebhook(user.uid, discordUrl.trim())
      setMessage('Discord webhook saved.')
    } catch {
      setMessage('Failed to save webhook.')
    } finally {
      setSaving(false)
    }
  }

  const handleTestDiscord = async () => {
    if (!discordUrl.trim()) return
    setTesting(true)
    setMessage('')
    try {
      await testDiscordWebhook(discordUrl.trim())
      setMessage('Test message sent!')
    } catch {
      setMessage('Test failed. Check your webhook URL.')
    } finally {
      setTesting(false)
    }
  }

  const telegramLinked = !!profile?.telegramChatId
  const discordLinked = !!profile?.discordWebhookUrl

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Settings</h1>
        <p className="mt-1 text-slate-400">Configure Telegram and Discord notifications</p>
      </header>

      {message && (
        <p className="mb-4 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm text-cyan">
          {message}
        </p>
      )}

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <MessageCircle size={20} />
            Telegram
          </h2>
          {telegramLinked ? (
            <span className="rounded-full bg-green-900/50 px-3 py-1 text-xs text-green-400">
              Telegram Linked ✓
            </span>
          ) : (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Not Linked
            </span>
          )}
        </div>

        {!telegramLinked ? (
          <>
            <button
              type="button"
              onClick={handleGenerateCode}
              className="mb-4 rounded-lg bg-cyan px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: '#00d4ff', color: '#0a0f1e' }}
            >
              Link Telegram Account
            </button>
            {(linkCode || profile?.telegramLinkCode) && (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
                <li>Open Telegram</li>
                <li>
                  Search for <strong>@{botUsername}</strong>
                </li>
                <li>
                  Send <code className="rounded bg-slate-800 px-1">/start {linkCode || profile?.telegramLinkCode}</code> to the bot
                </li>
                <li>Come back here — this page will update automatically</li>
              </ol>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleUnlinkTelegram}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Unlink
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Send size={20} />
            Discord Webhook
          </h2>
          {discordLinked ? (
            <span className="flex items-center gap-1 rounded-full bg-green-900/50 px-3 py-1 text-xs text-green-400">
              <Check size={12} /> Linked
            </span>
          ) : (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Not Linked
            </span>
          )}
        </div>

        <label className="mb-2 block text-sm text-slate-400">Webhook URL</label>
        <input
          type="url"
          value={discordUrl}
          onChange={(e) => setDiscordUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveDiscord}
            disabled={saving}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#00d4ff', color: '#0a0f1e' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleTestDiscord}
            disabled={testing || !discordUrl.trim()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {testing ? 'Sending…' : 'Send Test Message'}
          </button>
        </div>
      </section>
    </div>
  )
}
