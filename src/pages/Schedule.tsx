import { useEffect, useState } from 'react'
import { Calendar, Clock, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../hooks/useAuth'
import {
  createEvent,
  deleteEvent,
  subscribeUserEvents,
} from '../lib/firestore'
import { Skeleton } from '../components/Skeleton'
import type { EventKind, NotifyChannel, ScheduledEvent } from '../types'

const EVENT_KIND_OPTIONS: { value: EventKind; label: string }[] = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'business_trip', label: 'Business trip' },
]

function useCountdown(scheduledAt: Timestamp) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const tick = () => {
      const target = scheduledAt.toDate().getTime()
      const diff = target - Date.now()
      if (diff <= 0) {
        setRemaining('Overdue')
        return
      }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      const parts = []
      if (days > 0) parts.push(`${days}d`)
      parts.push(`${hours}h`, `${mins}m`, `${secs}s`)
      setRemaining(parts.join(' '))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [scheduledAt])

  return remaining
}

function StatusBadge({ event }: { event: ScheduledEvent }) {
  const now = Date.now()
  const at = event.scheduledAt.toDate().getTime()

  if (event.isCompleted) {
    return (
      <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300">
        Completed
      </span>
    )
  }
  if ((event.notificationsSent?.length ?? 0) > 0) {
    return (
      <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
        Notified
      </span>
    )
  }
  if (at < now) {
    return (
      <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-400">
        Overdue
      </span>
    )
  }
  return (
    <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-xs text-amber-400">
      Pending
    </span>
  )
}

function EventCard({
  event,
  onDelete,
}: {
  event: ScheduledEvent
  onDelete: (id: string) => void
}) {
  const countdown = useCountdown(event.scheduledAt)
  const [confirming, setConfirming] = useState(false)

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    onDelete(event.id)
    setConfirming(false)
  }

  const kindLabel =
    EVENT_KIND_OPTIONS.find((o) => o.value === event.eventKind)?.label ??
    event.eventKind

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{event.title}</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {kindLabel}
          </span>
        </div>
        <StatusBadge event={event} />
      </div>
      {event.description && (
        <p className="mb-3 text-sm text-slate-400">{event.description}</p>
      )}
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
        <Calendar size={14} />
        {event.scheduledAt.toDate().toLocaleString()}
      </div>
      <div
        className="mb-3 flex items-center gap-2 font-mono text-cyan"
        style={{ color: '#00d4ff' }}
      >
        <Clock size={14} />
        {countdown}
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {event.notifyVia.map((ch) => (
          <span
            key={ch}
            className="rounded bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300"
          >
            {ch}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        className={`flex items-center gap-1 text-sm ${
          confirming ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
        }`}
      >
        <Trash2 size={14} />
        {confirming ? 'Click again to confirm' : 'Delete'}
      </button>
    </article>
  )
}

function EmptySchedule() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
      <Calendar className="mb-4 text-slate-600" size={56} />
      <p className="text-lg text-slate-300">No events yet</p>
      <p className="mt-1 text-sm text-slate-500">Create your first event above</p>
    </div>
  )
}

export function Schedule() {
  const { user } = useAuth()
  const [events, setEvents] = useState<ScheduledEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [eventKind, setEventKind] = useState<EventKind>('deadline')
  const [notifyVia, setNotifyVia] = useState<NotifyChannel[]>([])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeUserEvents(user.uid, (items) => {
      setEvents(items)
      setLoading(false)
    })
    return unsub
  }, [user])

  const toggleChannel = (ch: NotifyChannel) => {
    setNotifyVia((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title || !scheduledAt) return
    setSubmitting(true)
    try {
      await createEvent({
        userId: user.uid,
        eventKind,
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        notifyVia,
      })
      setTitle('')
      setDescription('')
      setScheduledAt('')
      setEventKind('deadline')
      setNotifyVia([])
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteEvent(id)
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Schedule</h1>
        <p className="mt-1 text-slate-400">
          Deadlines, meetings, and trips — synced with Cloud Notifications
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mb-10 rounded-xl border border-slate-800 bg-slate-900/50 p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-white">New event</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm text-slate-400">Title</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm text-slate-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-400">Event type</span>
            <select
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value as EventKind)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan"
            >
              {EVENT_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-400">
              Date &amp; time
            </span>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-cyan"
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm text-slate-400">Notify me via</legend>
            <div className="flex gap-4">
              {(['telegram', 'discord'] as NotifyChannel[]).map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-white capitalize">
                  <input
                    type="checkbox"
                    checked={notifyVia.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="accent-cyan"
                  />
                  {ch}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg bg-cyan px-6 py-2 font-medium text-navy transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#00d4ff', color: '#0a0f1e' }}
        >
          {submitting ? 'Saving…' : 'Create event'}
        </button>
      </form>

      <h2 className="mb-4 text-lg font-semibold text-white">Your events</h2>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-36" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptySchedule />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
