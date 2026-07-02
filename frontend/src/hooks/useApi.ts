import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export interface ApiResource<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-fetches; safe against unmount and out-of-order responses. */
  refetch: () => Promise<void>
}

/**
 * Generic data-fetching hook. Guards against updates after unmount and
 * against stale responses overtaking newer ones. Pass `null` to skip.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): ApiResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchNow = useCallback(async () => {
    const seq = ++requestSeq.current
    if (path === null) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await api.get<T>(path)
      if (mounted.current && seq === requestSeq.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mounted.current && seq === requestSeq.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (mounted.current && seq === requestSeq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => {
    void fetchNow()
  }, [fetchNow])

  return { data, loading, error, refetch: fetchNow }
}
