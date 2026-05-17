import { useCallback } from 'react'
import { ExternalLink, Droplets, Newspaper, RefreshCw } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useWaterData } from '../hooks/useWaterData'
import { useArticles } from '../hooks/useArticles'
import { useToast } from '../hooks/useToast'
import { Skeleton } from '../components/Skeleton'
import { ARTICLE_TOPICS } from '../types'
import type { Article, WaterData, WaterSource } from '../types'

function formatTimeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Unknown'
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string)
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

function groupArticlesByTopic(articles: Article[]): Record<string, Article[]> {
  const map: Record<string, Article[]> = {}
  for (const topic of ARTICLE_TOPICS) {
    map[topic] = []
  }
  for (const a of articles) {
    const key = ARTICLE_TOPICS.includes(a.topic as (typeof ARTICLE_TOPICS)[number])
      ? a.topic
      : 'Water Related News'
    if (!map[key]) map[key] = []
    map[key].push(a)
  }
  return map
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-cyan" style={{ color: '#00d4ff' }}>
        {article.source}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{article.title}</h3>
      {article.summary ? (
        <p className="mb-2 line-clamp-3 text-sm text-slate-400">{article.summary}</p>
      ) : null}
      <p className="text-xs text-slate-500">{formatTimeAgo(article.publishedAt)}</p>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1 text-xs text-cyan hover:underline"
        style={{ color: '#00d4ff' }}
      >
        Read article <ExternalLink size={12} />
      </a>
    </article>
  )
}

function TopicSection({ topic, items }: { topic: string; items: Article[] }) {
  if (items.length === 0) return null
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold text-white">{topic}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  )
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
        <p className="text-sm text-slate-500">No readings in Firestore yet.</p>
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

export function Dashboard() {
  const { showToast } = useToast()
  const onNewArticles = useCallback(() => showToast('New articles loaded'), [showToast])
  const onNewWater = useCallback(() => showToast('New water data fetched'), [showToast])
  const { articles, loading: articlesLoading } = useArticles(onNewArticles)
  const { data: waterData, loading: waterLoading, pulsing } = useWaterData(onNewWater)
  const groupedWater = groupBySource(waterData)
  const groupedArticles = groupArticlesByTopic(articles)
  const usingWaterMock = waterData.some((d) => d.id.startsWith('mock-'))

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">AquaWatch PH</h1>
        <p className="mt-1 text-slate-400">
          Scraped news by topic and water readings from PAGASA / DOE
        </p>
      </header>

      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Newspaper className="text-cyan" style={{ color: '#00d4ff' }} size={22} />
          <h2 className="text-xl font-bold text-white">News &amp; articles</h2>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Updated when the daily / hourly scraper runs (DOE, LWUA, DENR, water districts, ABS-CBN,
          GMA, Manila Bulletin, Inquirer).
        </p>

        {articlesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-44" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
            <Newspaper className="mx-auto mb-3 text-slate-600" size={48} />
            <p className="text-slate-400">No articles yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Run the daily scraper workflow or wait for cron-job.org
            </p>
          </div>
        ) : (
          ARTICLE_TOPICS.map((topic) => (
            <TopicSection key={topic} topic={topic} items={groupedArticles[topic] || []} />
          ))
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Droplets className="text-cyan" style={{ color: '#00d4ff' }} size={22} />
          <h2 className="text-xl font-bold text-white">Water readings</h2>
        </div>
        {usingWaterMock ? (
          <p className="mb-4 text-sm text-amber-400/90">
            Showing sample data — add documents to the <code className="text-cyan">waterData</code>{' '}
            collection for live readings.
          </p>
        ) : null}

        {waterLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-40" />
            ))}
          </div>
        ) : (
          <>
            <SourceSection source="PAGASA" items={groupedWater.PAGASA} pulsing={pulsing} />
            <SourceSection source="DOE" items={groupedWater.DOE} pulsing={pulsing} />
          </>
        )}
      </section>
    </div>
  )
}
