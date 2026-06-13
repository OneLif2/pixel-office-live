'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentActivity, AgentAppearance } from '@/lib/pixel-office/agentBridge'
import type { FloorColor, OfficePet } from '@/lib/pixel-office/types'
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
  skin?: number // palette index chosen in the dashboard
  color?: FloorColor // color tint chosen in the dashboard
}

export interface PublicState {
  v: number
  ts: number
  staleAfterMs: number
  agents: Record<string, PublicAgent>
  pets?: Array<{ kind: string; name?: string; col?: number; row?: number; skin?: number; color?: FloorColor }>
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

const FIREBASE_DATABASE_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '').replace(/\/+$/, '')
const FIREBASE_STATE_PATH = process.env.NEXT_PUBLIC_FIREBASE_STATE_PATH || 'pixel-office/live/state'
const FIREBASE_STREAM_URL =
  process.env.NEXT_PUBLIC_FIREBASE_STREAM_URL ||
  (FIREBASE_DATABASE_URL ? `${FIREBASE_DATABASE_URL}/${encodeFirebasePath(FIREBASE_STATE_PATH)}.json` : '')

const MOCK_URL = `${ASSET_BASE}/mock-state.json`
const FETCH_INTERVAL_MS = 20_000
const REALTIME_FALLBACK_INTERVAL_MS = 60_000
const API_EVERY_N_CYCLES = 4

function encodeFirebasePath(statePath: string): string {
  return statePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

const STATE_MAP: Record<PublicAgent['s'], AgentActivity['state']> = {
  w: 'working',
  i: 'idle',
  a: 'waiting',
  o: 'offline',
}

export function isStale(state: PublicState, now = Date.now()): boolean {
  return now - state.ts > state.staleAfterMs
}

// Mirror of the exporter's offline threshold (snapshot-exporter
// lib/build-snapshot.mjs: OFFLINE_MS, detectState `timeDiff > OFFLINE_MS → 'o'`).
// Kept in sync by hand because the two apps are separate packages.
const AGENT_OFFLINE_MS = 10 * 60 * 1000

/**
 * Decay one agent's last-exported status to what it should read *now*.
 *
 * While the snapshot is fresh, trust the exporter's status exactly: it
 * recomputes every agent from the live session + trace state on each run (file
 * watcher + heartbeat), so re-deriving status here only fabricates wrong
 * transitions (e.g. flipping a busy agent to idle/offline because its rounded
 * `ls` looks old between heartbeats). Only once the whole snapshot has gone
 * stale — signal genuinely lost — do we conservatively decay: drop to offline
 * when `ls` is well past the offline window, otherwise stand active agents down
 * to idle since we can no longer confirm they are busy.
 */
export function decayAgentState(
  s: PublicAgent['s'],
  ls: number,
  stale: boolean,
  now = Date.now(),
): PublicAgent['s'] {
  if (s === 'o') return 'o'
  if (!stale) return s
  if (ls > 0 && now - ls > AGENT_OFFLINE_MS) return 'o'
  if (s === 'w' || s === 'a') return 'i'
  return s
}

/**
 * Map the sanitized snapshot to the engine's AgentActivity shape.
 * Each agent's status is decayed to the wall clock (see decayAgentState) so a
 * quiet agent stands down/leaves on its own schedule, not when another agent's
 * activity happens to trigger the next export.
 */
export function toAgentActivities(state: PublicState, stale: boolean, now = Date.now()): AgentActivity[] {
  return Object.entries(state.agents).map(([agentId, a]) => {
    const s = decayAgentState(a.s, a.ls, stale, now)
    const subCount = stale || s === 'o' ? 0 : Math.max(0, Math.min(8, a.sub | 0))
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

/**
 * Per-agent appearance (skin/color) from the snapshot, keyed by the same engine
 * id toAgentActivities uses (display name), so the public office matches the
 * dashboard's chosen look.
 */
export function toAgentAppearance(state: PublicState): Record<string, AgentAppearance> {
  const out: Record<string, AgentAppearance> = {}
  for (const [agentId, a] of Object.entries(state.agents)) {
    const appearance: AgentAppearance = {}
    if (typeof a.skin === 'number') appearance.skin = a.skin
    if (a.color) appearance.color = a.color
    if (appearance.skin !== undefined || appearance.color) out[a.n || agentId] = appearance
  }
  return out
}

const KNOWN_PET_KINDS = new Set(['cat', 'dog', 'lobster'])

/** Map snapshot pets to engine OfficePet[] so the public office matches the dashboard. */
export function toOfficePets(state: PublicState): OfficePet[] {
  const pets = state.pets ?? []
  const out: OfficePet[] = []
  pets.forEach((p, i) => {
    if (!KNOWN_PET_KINDS.has(p.kind)) return
    const pet: OfficePet = {
      id: `snap-pet-${i}`,
      kind: p.kind as OfficePet['kind'],
      col: typeof p.col === 'number' ? p.col : 0,
      row: typeof p.row === 'number' ? p.row : 0,
    }
    if (typeof p.skin === 'number') pet.skin = p.skin
    if (p.color) pet.color = p.color
    if (p.name) pet.name = p.name
    out.push(pet)
  })
  return out
}

function parsePublicState(raw: unknown): PublicState | null {
  const d = raw as PublicState
  if (!d || typeof d !== 'object') return null
  if (d.v !== SCHEMA_VERSION) return null
  if (typeof d.ts !== 'number' || typeof d.staleAfterMs !== 'number') return null
  if (!d.agents || typeof d.agents !== 'object') return null
  return d
}

/** Outcome of the last manual refresh, for honest button feedback. */
export type RefreshState = 'idle' | 'refreshing' | 'updated' | 'nochange' | 'error'

export interface PublicOfficeState {
  state: PublicState | null
  stale: boolean
  lastFetched: number | null
  usingMock: boolean
  versionMismatch: boolean
  refreshing: boolean
  refreshState: RefreshState
  refresh: () => void
}

type PublicOfficeFetchState = Omit<PublicOfficeState, 'refreshing' | 'refreshState' | 'refresh'>

/** Subscribe to realtime when configured; keep GitHub polling as fallback/manual refresh. */
export function usePublicOfficeState(): PublicOfficeState {
  const [result, setResult] = useState<PublicOfficeFetchState>({
    state: null,
    stale: false,
    lastFetched: null,
    usingMock: false,
    versionMismatch: false,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshState, setRefreshState] = useState<RefreshState>('idle')
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
    let realtime: EventSource | null = null
    let manualRefreshInFlight = false
    let refreshClearTimer: ReturnType<typeof setTimeout> | null = null

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

    const applyRealtimeEvent = (event: Event) => {
      const message = event as MessageEvent<string>
      try {
        const payload = JSON.parse(message.data) as { data?: unknown }
        const state = parsePublicState(payload?.data)
        if (state) apply(state, false)
      } catch {
        // Firebase keep-alive / malformed payload: ignore and let polling recover.
      }
    }

    const fetchSnapshot = async (forceApi = false) => {
      const shouldFetchApi = forceApi || cycle.current % API_EVERY_N_CYCLES === 0
      let apiOk = false

      const tasks: Array<Promise<boolean>> = []
      if (shouldFetchApi) {
        tasks.push(
          (async () => {
            const state = await fetchFrom(SNAPSHOT_API_URL, {
              headers: { Accept: 'application/vnd.github.raw+json' },
            })
            if (!state) return false
            apply(state, false)
            apiOk = true
            return true
          })(),
        )
      }
      tasks.push(
        (async () => {
          const state = await fetchFrom(SNAPSHOT_URL)
          if (!state) return false
          apply(state, false)
          return true
        })(),
      )

      const results = await Promise.allSettled(tasks)
      const gotAny = results.some((res) => res.status === 'fulfilled' && res.value)

      cycle.current++

      // keep last state; if we never got real data, fall back to mock (dev/offline)
      if (!gotAny && !hasRealData.current) {
        try {
          const state = parsePublicState(await (await fetch(MOCK_URL, { cache: 'no-store' })).json())
          if (state) apply({ ...state, ts: Date.now() }, true)
        } catch {}
      }

      return { gotAny, apiAttempted: shouldFetchApi, apiOk }
    }

    refreshRef.current = async () => {
      if (manualRefreshInFlight || cancelled) return
      manualRefreshInFlight = true
      setRefreshing(true)
      setRefreshState('refreshing')
      const prevTs = newestTs.current
      let outcome: RefreshState = 'error'
      try {
        const { gotAny, apiAttempted, apiOk } = await fetchSnapshot(true)
        if (newestTs.current > prevTs) outcome = 'updated' // got a newer snapshot
        else if (apiAttempted && !apiOk) outcome = 'error' // fresh source unreachable (e.g. rate-limited)
        else if (gotAny) outcome = 'nochange' // reached GitHub, already current
        else outcome = 'error'
      } catch {
        outcome = 'error'
      } finally {
        manualRefreshInFlight = false
        if (!cancelled) setRefreshing(false)
      }
      if (!cancelled) {
        setRefreshState(outcome)
        if (refreshClearTimer) clearTimeout(refreshClearTimer)
        refreshClearTimer = setTimeout(() => {
          if (!cancelled) setRefreshState('idle')
        }, 2500)
      }
    }

    const onVisibility = () => {
      if (!document.hidden) void fetchSnapshot(true)
    }

    if (FIREBASE_STREAM_URL && typeof EventSource !== 'undefined') {
      realtime = new EventSource(FIREBASE_STREAM_URL)
      realtime.addEventListener('put', applyRealtimeEvent)
      realtime.addEventListener('patch', applyRealtimeEvent)
    }

    void fetchSnapshot(true)
    timer = setInterval(() => {
      if (!document.hidden) void fetchSnapshot()
    }, FIREBASE_STREAM_URL ? REALTIME_FALLBACK_INTERVAL_MS : FETCH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (realtime) realtime.close()
      if (timer) clearInterval(timer)
      if (refreshClearTimer) clearTimeout(refreshClearTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { ...result, refreshing, refreshState, refresh }
}
