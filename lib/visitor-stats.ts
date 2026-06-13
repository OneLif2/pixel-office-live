'use client'

import { useEffect, useState } from 'react'

/**
 * Total-views counter backed by counterapi.dev v1.
 *
 * v1 is the anonymous tier: no account, API key, or backend of our own — the
 * visitor's browser calls it directly over CORS (`access-control-allow-origin: *`).
 * The whole feature is client-side; the Jetson exporter is never involved.
 *
 * There is no live/concurrent viewer count: that needs a stateful presence
 * backend, which counterapi.dev cannot provide. We only show cumulative views.
 *
 * v1 is counterapi.dev's legacy anonymous endpoint. If it is ever retired, set
 * NEXT_PUBLIC_COUNTER_BASE_URL (and namespace/name) to a replacement that
 * returns `{ "count": <number> }`.
 */
const COUNTER_BASE = (
  process.env.NEXT_PUBLIC_COUNTER_BASE_URL || 'https://api.counterapi.dev/v1'
).replace(/\/+$/, '')
const COUNTER_NAMESPACE = process.env.NEXT_PUBLIC_COUNTER_NAMESPACE || 'onelif2-pixel-office-live'
const COUNTER_NAME = process.env.NEXT_PUBLIC_COUNTER_NAME || 'views'

// Counting is limited to the real public page so local/Jetson previews never
// inflate the number (checked against window.location at runtime).
const VISITOR_ALLOWED_ORIGIN = (
  process.env.NEXT_PUBLIC_VISITOR_ALLOWED_ORIGIN || 'https://onelif2.github.io'
).replace(/\/+$/, '')
const VISITOR_ALLOWED_PATH = normalizePath(
  process.env.NEXT_PUBLIC_VISITOR_ALLOWED_PATH || '/pixel-office-live',
)

// One increment per browser tab session; repeat loads only read the total.
const VIEW_COUNTED_KEY = 'pixel-office-live-view-counted-v1'

export interface VisitorStats {
  configured: boolean
  totalViews: number | null
  loading: boolean
  error: boolean
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return withSlash.replace(/\/+$/, '') || '/'
}

function isVisitorCounterPage(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.origin === VISITOR_ALLOWED_ORIGIN &&
    normalizePath(window.location.pathname) === VISITOR_ALLOWED_PATH
  )
}

function readCount(raw: unknown): number | null {
  const value = (raw as { count?: unknown } | null)?.count
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  return null
}

async function fetchCount(action: 'up' | 'get'): Promise<number | null> {
  const base = `${COUNTER_BASE}/${encodeURIComponent(COUNTER_NAMESPACE)}/${encodeURIComponent(COUNTER_NAME)}`
  const url = action === 'up' ? `${base}/up` : `${base}/`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return readCount(await res.json())
}

export function useVisitorStats(): VisitorStats {
  const [stats, setStats] = useState<VisitorStats>({
    configured: false,
    totalViews: null,
    loading: false,
    error: false,
  })

  useEffect(() => {
    if (!isVisitorCounterPage()) {
      setStats({ configured: false, totalViews: null, loading: false, error: false })
      return
    }

    let cancelled = false
    setStats((prev) => ({ ...prev, configured: true, loading: true }))

    const alreadyCounted = (() => {
      try {
        return sessionStorage.getItem(VIEW_COUNTED_KEY) === '1'
      } catch {
        return false
      }
    })()

    const load = async (action: 'up' | 'get') => {
      try {
        const total = await fetchCount(action)
        if (cancelled) return
        setStats({ configured: true, totalViews: total, loading: false, error: total === null })
        if (action === 'up' && total !== null) {
          try {
            sessionStorage.setItem(VIEW_COUNTED_KEY, '1')
          } catch {}
        }
      } catch {
        if (!cancelled) {
          setStats((prev) => ({ ...prev, configured: true, loading: false, error: true }))
        }
      }
    }

    void load(alreadyCounted ? 'get' : 'up')

    // Refresh the displayed total when the visitor returns to the tab, so it
    // reflects other people's visits without a polling loop.
    const onVisibility = () => {
      if (!document.hidden) void load('get')
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return stats
}
