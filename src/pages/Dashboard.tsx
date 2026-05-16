import { useCallback } from 'react'
import { ExternalLink, Droplets, RefreshCw } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useWaterData } from '../hooks/useWaterData'
import { useToast } from '../hooks/useToast'
import { Skeleton } from '../components/Skeleton'
import type { WaterData, WaterSource } from '../types'

function formatTimeAgo(fetchedAt: WaterData['fetchedAt']): string {
  if (!fetchedAt) return 'Unknown'
  const date = fetchedAt instanceof Timestamp ? fetchedAt.toDate() : new Date(fetchedAt as unknown as string)
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function groupBySource(data: WaterData[]): Record<WaterSource, WaterData[]> {
  return {
    PAGASA: data.filter((d) => d.source === 'PAGASA'),
    DOE: data.filter((d) => d.source === 'DOE'),
  }
}

function WaterCard({ item, pulsing }: { item: WaterData; pulsing: boolean }) {
  return (
    <article
      className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition ${
        pulsing ? 'animate-pulse ring-2 ring-cyan/50' : ''
      }`}
    >
      <div className="mb-1 text-xs uppercase tracking-wide text-cyan" style={{ color: '#00d4ff' }}>
        {item.category}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
      <p className="text-2xl font-bold text-white">
        {item.value}
        <span className="ml-1 text-base font-normal text-slate-400">{item.unit}</span>
      </p>
      <p className="mt-2 text-sm text-slate-400">{item.location}</p>
      <p className="mt-1 text-xs text-slate-500">{formatTimeAgo(item.fetchedAt)}</p>
      <a
        href={item.rawUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1 text-xs text-cyan hover:underline"
        style={{ color: '#00d4ff' }}
      >
        View source <ExternalLink size={12} />
      </a>
    </article>
  )
}

function SourceSection({
  source,
  items,
  pulsing,
}: {
  source: WaterSource
  items: WaterData[]
  pulsing: boolean
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-bold text-white">{source}</h2>
        {pulsing && (
          <RefreshCw className="animate-spin text-cyan" style={{ color: '#00d4ff' }} size={18} />
        )}
      </div>
      {items.length === 0 ? (
        <EmptyWaterState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <WaterCard key={item.id} item={item} pulsing={pulsing} />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyWaterState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-700 py-12 text-center">
      <Droplets className="mb-3 text-slate-600" size={48} />
      <p className="text-slate-400">No water data available yet</p>
      <p className="mt-1 text-sm text-slate-500">Data will appear when the scraper runs</p>
    </div>
  )
}

export function Dashboard() {
  const { showToast } = useToast()
  const onNewData = useCallback(() => showToast('New water data fetched'), [showToast])
  const { data, loading, pulsing } = useWaterData(onNewData)
  const grouped = groupBySource(data)

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Water Data Dashboard</h1>
        <p className="mt-1 text-slate-400">Live readings from PAGASA and DOE sources</p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <SourceSection source="PAGASA" items={grouped.PAGASA} pulsing={pulsing} />
          <SourceSection source="DOE" items={grouped.DOE} pulsing={pulsing} />
        </>
      )}
    </div>
  )
}
