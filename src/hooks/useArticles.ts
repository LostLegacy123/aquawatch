import { useEffect, useState } from 'react'
import { subscribeArticles } from '../lib/firestore'
import type { Article } from '../types'

export function useArticles(onNewArticles?: () => void) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let prevCount = 0
    const unsub = subscribeArticles(
      (items) => {
        if (items.length > prevCount && prevCount > 0) {
          onNewArticles?.()
        }
        prevCount = items.length
        setArticles(items)
        setLoading(false)
      },
      () => {
        setArticles([])
        setLoading(false)
      },
    )
    return unsub
  }, [onNewArticles])

  return { articles, loading }
}
