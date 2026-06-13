'use client'

import { useEffect, useRef, useState } from 'react'
import { OfficeState } from '@/lib/pixel-office/engine/officeState'
import { renderFrame } from '@/lib/pixel-office/engine/renderer'
import { syncAgentsToOffice } from '@/lib/pixel-office/agentBridge'
import { migrateLayoutColors } from '@/lib/pixel-office/layout/layoutSerializer'
import { TILE_SIZE } from '@/lib/pixel-office/constants'
import type { OfficeLayout } from '@/lib/pixel-office/types'
import {
  loadCharacterPNGs,
  loadWallPNG,
  loadFloorPNG,
  loadHootbuFurnitureAssets,
  loadCatSkinPNGs,
  loadDogSpritePNG,
} from '@/lib/pixel-office/sprites/pngLoader'
import {
  getStoredWeather,
  setStoredWeather,
  WEATHER_CONFIG_EVENT,
  WEATHER_OPTIONS,
  type PixelOfficeWeather,
} from '@/lib/pixel-office/weather'
import { ASSET_BASE } from '@/lib/asset-base'
import {
  usePublicOfficeState,
  toAgentActivities,
  toSeatAssignments,
} from '@/lib/public-state'

const FIT_PADDING_PX = 24
const TOP_EXTRA_PX = 56 // keep room for the HUD above the office
const MAX_ZOOM = 3

const WEATHER_ICONS: Record<PixelOfficeWeather, string> = {
  clear: '⛅',
  sunny: '☀️',
  storm: '⛈️',
  night: '🌙',
}

function formatAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'just now'
  if (min === 1) return '1 min ago'
  if (min < 120) return `${min} min ago`
  return `${Math.round(min / 60)} h ago`
}

function formatLatency(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`
}

export default function PublicOfficePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const officeRef = useRef<OfficeState | null>(null)
  const agentIdMapRef = useRef<Map<string, number>>(new Map())
  const nextIdRef = useRef<{ current: number }>({ current: 1 })
  const weatherRef = useRef<PixelOfficeWeather>('clear')

  const [ready, setReady] = useState(false)
  const [weather, setWeather] = useState<PixelOfficeWeather>('clear')
  const [now, setNow] = useState(() => Date.now())
  const { state, stale, lastFetched, usingMock, versionMismatch, refreshing, refresh } = usePublicOfficeState()

  // One-time init: sprite assets + office layout
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      await Promise.all([
        loadCharacterPNGs(),
        loadWallPNG(),
        loadFloorPNG(),
        loadHootbuFurnitureAssets(),
        loadCatSkinPNGs(),
        loadDogSpritePNG(),
      ])
      let layout: OfficeLayout | undefined
      try {
        const res = await fetch(`${ASSET_BASE}/office-layout.json`, { cache: 'no-store' })
        if (res.ok) layout = migrateLayoutColors(await res.json())
      } catch {}
      if (cancelled) return
      const office = new OfficeState(layout, 'en')
      // The dashboard drives the On-Call SRE from /api/gateway-health; the
      // public page has no APIs, so mark healthy once to enable her patrol
      // (status 'unknown' freezes her in place).
      office.updateGatewaySreState({ status: 'healthy', checkedAt: Date.now() })
      officeRef.current = office
      setReady(true)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep age/latency badges live even between snapshot fetches.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Weather: per-visitor, localStorage only
  useEffect(() => {
    const sync = () => {
      const next = getStoredWeather()
      weatherRef.current = next
      setWeather(next)
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(WEATHER_CONFIG_EVENT, sync as EventListener)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(WEATHER_CONFIG_EVENT, sync as EventListener)
    }
  }, [])

  // Snapshot facts → engine characters
  useEffect(() => {
    const office = officeRef.current
    if (!ready || !office || !state) return
    syncAgentsToOffice(
      toAgentActivities(state, stale),
      office,
      agentIdMapRef.current,
      nextIdRef.current,
      toSeatAssignments(state),
    )
  }, [ready, state, stale])

  // Game loop: everything animates client-side between snapshots
  useEffect(() => {
    if (!ready || !canvasRef.current || !containerRef.current || !officeRef.current) return
    const canvas = canvasRef.current
    const container = containerRef.current
    const office = officeRef.current
    let rafId = 0
    let lastTime = 0
    let stopped = false

    const frame = (time: number) => {
      if (stopped) return
      const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      const width = container.clientWidth
      const height = container.clientHeight
      const dpr = window.devicePixelRatio || 1
      const cols = office.layout.cols
      const rows = office.layout.rows

      // Fit the whole office into the viewport; snap zoom to integer device pixels
      const fitW = Math.max(1, width - FIT_PADDING_PX * 2) / Math.max(1, cols * TILE_SIZE)
      const fitH =
        Math.max(1, height - FIT_PADDING_PX * 2 - TOP_EXTRA_PX) / Math.max(1, rows * TILE_SIZE)
      const fitZoom = Math.min(fitW, fitH, MAX_ZOOM)
      const deviceZoom = Math.max(1, Math.floor(fitZoom * dpr))

      office.update(dt)

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        renderFrame(
          ctx,
          width * dpr,
          height * dpr,
          office.tileMap,
          office.furniture,
          office.getCharacters(),
          deviceZoom,
          0,
          Math.round((TOP_EXTRA_PX / 2) * dpr),
          {
            selectedAgentId: null,
            hoveredAgentId: null,
            hoveredTile: null,
            seats: office.seats,
            characters: office.characters,
            showAllSeats: false,
          },
          undefined,
          office.layout.tileColors,
          cols,
          rows,
          undefined,
          undefined,
          undefined,
          true,
          weatherRef.current,
          time / 1000,
        )
      }
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
    }
  }, [ready])

  const pickWeather = (w: PixelOfficeWeather) => {
    setStoredWeather(w)
    weatherRef.current = w
    setWeather(w)
  }

  const ageMs = state ? now - state.ts : 0
  const receiveLagMs = state && lastFetched ? Math.max(0, lastFetched - state.ts) : null
  const latencyTitle =
    receiveLagMs === null
      ? 'Snapshot age from exporter timestamp.'
      : `Snapshot age from exporter timestamp. Browser received it after ${formatLatency(receiveLagMs)}.`

  const STATE_LABELS: Record<string, string> = { w: 'working', i: 'idle', a: 'waiting', o: 'offline' }
  const agentChips = state
    ? Object.entries(state.agents).map(([id, a]) => {
        const s = stale && (a.s === 'w' || a.s === 'a') ? 'i' : a.s
        return { id, name: a.n, emoji: a.e, state: STATE_LABELS[s] ?? 'offline', sub: stale ? 0 : a.sub }
      })
    : []

  return (
    <main className="office-root" ref={containerRef}>
      <canvas ref={canvasRef} className="office-canvas" />
      <div className="office-hud">
        <div className="office-hud-left">
          <span className="office-title">🦞 OpenClaw Pixel Office</span>
          <div className="agent-chips">
            {agentChips.map((a) => (
              <span key={a.id} className={`agent-chip agent-chip-${a.state}`}>
                <span className="agent-chip-emoji">{a.emoji}</span>
                <span className="agent-chip-name">{a.name}</span>
                <span className="agent-chip-state">{a.state}</span>
                {a.sub > 0 && <span className="agent-chip-sub">+{a.sub}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="office-badges">
          {versionMismatch && <span className="badge badge-stale">update available — please refresh later</span>}
          {state && stale && !usingMock && (
            <span className="badge badge-stale">⚠ last updated {formatAgo(ageMs)}</span>
          )}
          {state && !stale && !usingMock && (
            <span className="badge">updated {formatAgo(ageMs)}</span>
          )}
          {state && !usingMock && (
            <span className={`badge badge-latency${stale ? ' badge-stale' : ''}`} title={latencyTitle}>
              latency {formatLatency(ageMs)}
            </span>
          )}
          {usingMock && <span className="badge badge-mock">demo data</span>}
          <button
            type="button"
            className={`refresh-btn${refreshing ? ' refreshing' : ''}`}
            title="Refresh status"
            aria-label="Refresh status"
            onClick={refresh}
            disabled={refreshing}
          >
            ↻
          </button>
          <div className="weather-bar">
            {WEATHER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`weather-btn${weather === opt.value ? ' active' : ''}`}
                title={opt.value}
                onClick={() => pickWeather(opt.value)}
              >
                {WEATHER_ICONS[opt.value]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!ready && <div className="office-loading">loading office…</div>}
    </main>
  )
}
