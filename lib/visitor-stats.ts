'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const FIREBASE_DATABASE_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '').replace(/\/+$/, '')
const VISITOR_PATH = process.env.NEXT_PUBLIC_FIREBASE_VISITOR_PATH || 'pixel-office/live/visitors'
const HEARTBEAT_MS = 15_000
const REFRESH_MS = 15_000
const ACTIVE_WINDOW_MS = 45_000
const CLEANUP_AFTER_MS = 5 * 60_000
const VIEW_COUNTED_KEY = 'pixel-office-live-view-counted-v1'
const VIEWER_ID_KEY = 'pixel-office-live-viewer-id-v1'

export interface VisitorStats {
  configured: boolean
  liveViewers: number | null
  totalViews: number | null
  loading: boolean
  error: boolean
}

function encodeFirebasePath(statePath: string): string {
  return statePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function firebaseUrl(path: string): string {
  return `${FIREBASE_DATABASE_URL}/${encodeFirebasePath(path)}.json`
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return null
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, { ...init, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T | null
}

async function putJson(url: string, value: unknown, init?: { keepalive?: boolean }): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    keepalive: init?.keepalive,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function incrementTotalViews(totalUrl: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const getRes = await fetch(totalUrl, {
      cache: 'no-store',
      headers: { 'X-Firebase-ETag': 'true' },
    })
    if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`)

    const current = readNumber(await getRes.json()) ?? 0
    const etag = getRes.headers.get('ETag')
    const next = current + 1
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (etag) headers['if-match'] = etag

    const putRes = await fetch(totalUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(next),
      cache: 'no-store',
    })
    if (putRes.status === 412) continue
    if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`)
    return next
  }
  return null
}

export function useVisitorStats(): VisitorStats {
  const configured = Boolean(FIREBASE_DATABASE_URL)
  const urls = useMemo(() => {
    if (!configured) return null
    const base = VISITOR_PATH.replace(/^\/+|\/+$/g, '')
    return {
      live: firebaseUrl(`${base}/live`),
      total: firebaseUrl(`${base}/totalViews`),
    }
  }, [configured])

  const [stats, setStats] = useState<VisitorStats>({
    configured,
    liveViewers: null,
    totalViews: null,
    loading: configured,
    error: false,
  })
  const viewerUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!configured || !urls) {
      setStats({
        configured: false,
        liveViewers: null,
        totalViews: null,
        loading: false,
        error: false,
      })
      return
    }

    let cancelled = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    let cleanupCursor = 0

    const viewerId = (() => {
      try {
        const existing = sessionStorage.getItem(VIEWER_ID_KEY)
        if (existing) return existing
        const next = randomId()
        sessionStorage.setItem(VIEWER_ID_KEY, next)
        return next
      } catch {
        return randomId()
      }
    })()
    const viewerUrl = `${urls.live}/${encodeURIComponent(viewerId)}.json`
    viewerUrlRef.current = viewerUrl

    const markPresence = async () => {
      await putJson(viewerUrl, { seenAt: Date.now() })
    }

    const cleanupStale = async (records: Record<string, { seenAt?: number }>) => {
      const now = Date.now()
      const staleIds = Object.entries(records)
        .filter(([, value]) => now - (readNumber(value?.seenAt) ?? 0) > CLEANUP_AFTER_MS)
        .slice(0, 8)
        .map(([id]) => id)
      await Promise.allSettled(staleIds.map((id) => fetch(`${urls.live}/${encodeURIComponent(id)}.json`, {
        method: 'DELETE',
        cache: 'no-store',
      })))
    }

    const refresh = async () => {
      try {
        const [liveRecords, totalRaw] = await Promise.all([
          fetchJson<Record<string, { seenAt?: number }>>(urls.live),
          fetchJson<unknown>(urls.total),
        ])
        if (cancelled) return

        const cutoff = Date.now() - ACTIVE_WINDOW_MS
        const liveViewers = Object.values(liveRecords || {}).filter((value) => {
          const seenAt = readNumber(value?.seenAt)
          return seenAt !== null && seenAt >= cutoff
        }).length
        const totalViews = readNumber(totalRaw) ?? 0

        setStats({
          configured: true,
          liveViewers,
          totalViews,
          loading: false,
          error: false,
        })

        cleanupCursor++
        if (cleanupCursor % 8 === 0 && liveRecords) {
          void cleanupStale(liveRecords)
        }
      } catch {
        if (!cancelled) {
          setStats((prev) => ({ ...prev, configured: true, loading: false, error: true }))
        }
      }
    }

    const countViewOnce = async () => {
      let shouldCount = true
      try {
        shouldCount = sessionStorage.getItem(VIEW_COUNTED_KEY) !== '1'
      } catch {}
      if (!shouldCount) return

      const next = await incrementTotalViews(urls.total)
      if (next !== null && !cancelled) {
        setStats((prev) => ({ ...prev, totalViews: next, loading: false, error: false }))
      }
      try {
        sessionStorage.setItem(VIEW_COUNTED_KEY, '1')
      } catch {}
    }

    void (async () => {
      try {
        await markPresence()
        await countViewOnce()
        await refresh()
      } catch {
        if (!cancelled) {
          setStats((prev) => ({ ...prev, configured: true, loading: false, error: true }))
        }
      }
    })()

    heartbeatTimer = setInterval(() => {
      if (!document.hidden) void markPresence().then(refresh).catch(() => {
        if (!cancelled) setStats((prev) => ({ ...prev, error: true, loading: false }))
      })
    }, HEARTBEAT_MS)

    refreshTimer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, REFRESH_MS)

    const onVisibility = () => {
      if (!document.hidden) void markPresence().then(refresh).catch(() => {})
    }
    const onPageHide = () => {
      const url = viewerUrlRef.current
      if (url) void fetch(url, { method: 'DELETE', keepalive: true })
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      cancelled = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (refreshTimer) clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      onPageHide()
    }
  }, [configured, urls])

  return stats
}
