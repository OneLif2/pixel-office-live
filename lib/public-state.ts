'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentActivity } from '@/lib/pixel-office/agentBridge'
import { ASSET_BASE } from '@/lib/asset-base'

/**
 * Public snapshot schema v1 (see pixel_office_github_pages_implementation_plan.md §5).
 * Only render fields listed here; ignore everything else.
 */
export interface PublicAgent {
  n: string // display name
  e: string // emoji
  s: 'w' | 'i' | 'a' | 'o' // working | idle | waiting | offline
  ls: number // lastActive epoch ms
  sub: number // subagent count
  seat?: string // seat uid from agent-seats.json
}

export interface PublicState {
  v: number
  ts: number
  staleAfterMs: number
  agents: Record<string, PublicAgent>
  pets?: Array<{ kind: string; name?: string }>
}

export const SCHEMA_VERSION = 1

const SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_SNAPSHOT_URL ||
  'https://raw.githubusercontent.com/OneLif2/pixel-office-live/data/state.json'

// raw.githubusercontent caches ~5 min and ignores query-string cache busting,
// so the GitHub contents API (no CDN cache, CORS *) is polled as the freshness
// source: every 4th 20s cycle ≈ 45 req/h/viewer, leaving room under the common
// unauthenticated 60/h limit for load/focus refreshes.
const SNAPSHOT_API_URL =
  process.env.NEXT_PUBLIC_SNAPSHOT_API_URL ||
  'https://api.github.com/repos/OneLif2/pixel-office-live/contents/state.json?ref=data'

const MOCK_URL = `${ASSET_BASE}/mock-state.json`
const FETCH_INTERVAL_MS = 20_000
const API_EVERY_N_CYCLES = 4

const STATE_MAP: Record<PublicAgent['s'], AgentActivity['state']> = {
  w: 'working',
  i: 'idle',
  a: 'waiting',
  o: 'offline',
}

export function isStale(state: PublicState, now = Date.now()): boolean {
  return now - state.ts > state.staleAfterMs
}

/**
 * Map the sanitized snapshot to the engine's AgentActivity shape.
 * When the snapshot is stale, active agents render as idle (signal lost ≠ busy).
 */
export function toAgentActivities(state: PublicState, stale: boolean): AgentActivity[] {
  return Object.entries(state.agents).map(([agentId, a]) => {
    const s = stale && (a.s === 'w' || a.s === 'a') ? 'i' : a.s
    const subCount = stale ? 0 : Math.max(0, Math.min(8, a.sub | 0))
    return {
      // use the display name as the engine id so labels render as "Dido"
      // rather than "Dido (dido)" (agentBridge appends ids that differ)
      agentId: a.n || agentId,
      name: a.n,
      emoji: a.e,
      state: STATE_MAP[s] ?? 'idle',
      lastActive: a.ls,
      subagents: Array.from({ length: subCount }, (_, i) => ({
        toolId: `sub-${i + 1}`,
        label: '',
      })),
    }
  })
}

export function toSeatAssignments(state: PublicState): Record<string, string> {
  const seats: Record<string, string> = {}
  for (const [agentId, a] of Object.entries(state.agents)) {
    if (typeof a.seat === 'string' && a.seat) seats[a.n || agentId] = a.seat
  }
  return seats
}

function parsePublicState(raw: unknown): PublicState | null {
  const d = raw as PublicState
  if (!d || typeof d !== 'object') return null
  if (d.v !== SCHEMA_VERSION) return null
  if (typeof d.ts !== 'number' || typeof d.staleAfterMs !== 'number') return null
  if (!d.agents || typeof d.agents !== 'object') return null
  return d
}

export interface PublicOfficeState {
  state: PublicState | null
  stale: boolean
  lastFetched: number | null
  usingMock: boolean
  versionMismatch: boolean
  refreshing: boolean
  refresh: () => void
}

type PublicOfficeFetchState = Omit<PublicOfficeState, 'refreshing' | 'refresh'>

/** Fetch the snapshot every 20 s; pause when hidden; refetch on visibility/manual refresh. */
export function usePublicOfficeState(): PublicOfficeState {
  const [result, setResult] = useState<PublicOfficeFetchState>({
    state: null,
    stale: false,
    lastFetched: null,
    usingMock: false,
    versionMismatch: false,
  })
  const [refreshing, setRefreshing] = useState(false)
  const hasRealData = useRef(false)
  const newestTs = useRef(0)
  const cycle = useRef(0)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const refresh = useCallback(() => {
    void refreshRef.current()
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    let manualRefreshInFlight = false

    const apply = (state: PublicState, usingMock: boolean) => {
      if (cancelled) return
      // raw CDN can lag behind the API source — never regress to an older snapshot
      if (!usingMock && state.ts < newestTs.current) return
      if (!usingMock) newestTs.current = state.ts
      hasRealData.current = hasRealData.current || !usingMock
      setResult({
        state,
        stale: usingMock ? false : isStale(state),
        lastFetched: Date.now(),
        usingMock,
        versionMismatch: false,
      })
    }

    const fetchFrom = async (url: string, init?: RequestInit): Promise<PublicState | null> => {
      const res = await fetch(url, { ...init, cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      const state = parsePublicState(raw)
      if (!state && !cancelled && raw && typeof raw === 'object' && (raw as PublicState).v !== SCHEMA_VERSION) {
        setResult((prev) => ({ ...prev, versionMismatch: true }))
      }
      return state
    }

    const fetchSnapshot = async (forceApi = false) => {
      let gotAny = false
      const shouldFetchApi = forceApi || cycle.current % API_EVERY_N_CYCLES === 0
      const sources: Array<Promise<PublicState | null>> = []

      if (shouldFetchApi) {
        sources.push(fetchFrom(SNAPSHOT_API_URL, {
          headers: { Accept: 'application/vnd.github.raw+json' },
        }))
      }
      sources.push(fetchFrom(SNAPSHOT_URL))

      const results = await Promise.allSettled(sources.map(async (source) => {
        const state = await source
        if (!state) return false
        apply(state, false)
        return true
      }))
      gotAny = results.some((res) => res.status === 'fulfilled' && res.value)

      cycle.current++

      // keep last state; if we never got real data, fall back to mock (dev/offline)
      if (!gotAny && !hasRealData.current) {
        try {
          const state = parsePublicState(await (await fetch(MOCK_URL, { cache: 'no-store' })).json())
          if (state) apply({ ...state, ts: Date.now() }, true)
        } catch {}
      }
    }

    refreshRef.current = async () => {
      if (manualRefreshInFlight || cancelled) return
      manualRefreshInFlight = true
      setRefreshing(true)
      try {
        await fetchSnapshot(true)
      } finally {
        manualRefreshInFlight = false
        if (!cancelled) setRefreshing(false)
      }
    }

    const onVisibility = () => {
      if (!document.hidden) void fetchSnapshot(true)
    }

    void fetchSnapshot(true)
    timer = setInterval(() => {
      if (!document.hidden) void fetchSnapshot()
    }, FETCH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { ...result, refreshing, refresh }
}
