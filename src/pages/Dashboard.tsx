import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Newspaper } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useArticles } from '../hooks/useArticles'
import { useToast } from '../hooks/useToast'
import { Skeleton } from '../components/Skeleton'
import { ARTICLE_TOPICS } from '../types'
import type { Article } from '../types'

const ARTICLES_PER_PAGE = 30

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

function normalizeTopic(topic: string): string {
  return ARTICLE_TOPICS.includes(topic as (typeof ARTICLE_TOPICS)[number])
    ? topic
    : 'Water Related News'
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>()
  return articles.filter((a) => {
    const key = (a.url || a.id).trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function groupBySourceThenTopic(articles: Article[]): Map<string, Map<string, Article[]>> {
  const bySource = new Map<string, Map<string, Article[]>>()
  for (const a of articles) {
    const source = a.source?.trim() || 'Unknown source'
    const topic = normalizeTopic(a.topic)
    if (!bySource.has(source)) bySource.set(source, new Map())
    const byTopic = bySource.get(source)!
    if (!byTopic.has(topic)) byTopic.set(topic, [])
    byTopic.get(topic)!.push(a)
  }
  return bySource
}

function sortedSources(bySource: Map<string, Map<string, Article[]>>): string[] {
  return [...bySource.keys()].sort((a, b) => a.localeCompare(b))
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
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

function TopicBlock({ topic, items }: { topic: string; items: Article[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">{topic}</h4>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </div>
  )
}

function SourceBlock({
  source,
  byTopic,
}: {
  source: string
  byTopic: Map<string, Article[]>
}) {
  const topicsWithArticles = ARTICLE_TOPICS.filter((t) => (byTopic.get(t)?.length ?? 0) > 0)
  const otherTopics = [...byTopic.keys()].filter(
    (t) => !ARTICLE_TOPICS.includes(t as (typeof ARTICLE_TOPICS)[number]),
  )
  const orderedTopics = [...topicsWithArticles, ...otherTopics]

  return (
    <section className="mb-10 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5 md:p-6">
      <h3 className="mb-5 text-xl font-bold text-white">{source}</h3>
      {orderedTopics.map((topic) => (
        <TopicBlock key={topic} topic={topic} items={byTopic.get(topic) || []} />
      ))}
    </section>
  )
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  const [jumpInput, setJumpInput] = useState(String(page))

  useEffect(() => {
    setJumpInput(String(page))
  }, [page])

  if (totalPages <= 1) return null

  const goToPage = (raw: string) => {
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) return
    const clamped = Math.min(totalPages, Math.max(1, n))
    onPage(clamped)
    setJumpInput(String(clamped))
  }

  const onJumpSubmit = (e: FormEvent) => {
    e.preventDefault()
    goToPage(jumpInput)
  }

  return (
    <nav className="mt-8 flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onPage(1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="min-w-[7rem] text-center text-sm text-slate-300">
          Page <strong className="text-white">{page}</strong> of{' '}
          <strong className="text-white">{totalPages}</strong>
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          Next <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPage(totalPages)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          Last
        </button>
      </div>

      <form
        onSubmit={onJumpSubmit}
        className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-400"
      >
        <label htmlFor="jump-page" className="sr-only">
          Jump to page
        </label>
        <span>Go to page</span>
        <input
          id="jump-page"
          type="number"
          min={1}
          max={totalPages}
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-white"
        />
        <button
          type="submit"
          className="rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-cyan"
          style={{ color: '#00d4ff' }}
        >
          Go
        </button>
      </form>
    </nav>
  )
}

export function Dashboard() {
  const { showToast } = useToast()
  const onNewArticles = useCallback(() => showToast('New articles loaded'), [showToast])
  const { articles, loading: articlesLoading } = useArticles(onNewArticles)
  const [page, setPage] = useState(1)

  const uniqueArticles = useMemo(() => dedupeArticles(articles), [articles])
  const totalPages = Math.max(1, Math.ceil(uniqueArticles.length / ARTICLES_PER_PAGE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [uniqueArticles.length])

  const pageArticles = useMemo(() => {
    const start = (safePage - 1) * ARTICLES_PER_PAGE
    return uniqueArticles.slice(start, start + ARTICLES_PER_PAGE)
  }, [uniqueArticles, safePage])

  const grouped = useMemo(() => groupBySourceThenTopic(pageArticles), [pageArticles])
  const sources = useMemo(() => sortedSources(grouped), [grouped])

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">AquaWatch PH</h1>
      </header>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="text-cyan" style={{ color: '#00d4ff' }} size={22} />
            <h2 className="text-xl font-bold text-white">News &amp; articles</h2>
          </div>
          {!articlesLoading && uniqueArticles.length > 0 ? (
            <p className="text-sm text-slate-500">
              {uniqueArticles.length} article{uniqueArticles.length === 1 ? '' : 's'} ·{' '}
              {totalPages} page{totalPages === 1 ? '' : 's'} · up to {ARTICLES_PER_PAGE} per page
            </p>
          ) : null}
        </div>

        {articlesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-44" />
            ))}
          </div>
        ) : uniqueArticles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
            <Newspaper className="mx-auto mb-3 text-slate-600" size={48} />
            <p className="text-slate-400">No articles yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Run the daily scraper workflow or wait for the scheduled job
            </p>
          </div>
        ) : (
          <>
            {sources.map((source) => (
              <SourceBlock key={source} source={source} byTopic={grouped.get(source)!} />
            ))}
            <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  )
}
