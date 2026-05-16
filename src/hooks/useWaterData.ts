import { useEffect, useRef, useState } from 'react'
import { subscribeWaterData } from '../lib/firestore'
import type { WaterData } from '../types'

export function useWaterData(onNewData?: () => void) {
  const [data, setData] = useState<WaterData[]>([])
  const [loading, setLoading] = useState(true)
  const [pulsing, setPulsing] = useState(false)
  const prevCount = useRef(0)
  const isFirst = useRef(true)

  useEffect(() => {
    const unsub = subscribeWaterData(
      (items) => {
        if (!isFirst.current && items.length > prevCount.current) {
          setPulsing(true)
          onNewData?.()
          setTimeout(() => setPulsing(false), 2000)
        }
        prevCount.current = items.length
        isFirst.current = false
        setData(items)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [onNewData])

  return { data, loading, pulsing }
}
