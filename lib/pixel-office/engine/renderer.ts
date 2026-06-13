import { TileType, TILE_SIZE, CharacterState, Direction } from '../types'
import type { TileType as TileTypeVal, FurnitureInstance, Character, SpriteData, Seat, FloorColor } from '../types'
import { getCachedSprite, getOutlineSprite } from '../sprites/spriteCache'
import { getCharacterSprites, BUBBLE_PERMISSION_SPRITE, BUBBLE_WAITING_SPRITE } from '../sprites/spriteData'
import type { CharacterSprites } from '../sprites/spriteData'
import { getCatSprites } from '../sprites/catSprites'
import { getDogSprites } from '../sprites/dogSprites'
import { getCharacterSprite } from './characters'
import { renderMatrixEffect } from './matrixEffect'
import { getColorizedFloorSprite, hasFloorSprites, WALL_COLOR } from '../floorTiles'
import { hasWallSprites, getWallInstances, wallColorToHex } from '../wallTiles'
import { getColorizedSprite } from '../colorize'
import type { BugEntity } from '../bugs/types'
import { renderBugs } from '../bugs/renderer'
import type { PixelOfficeWeather } from '../weather'
import {
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  OUTLINE_Z_SORT_OFFSET,
  SELECTED_OUTLINE_ALPHA,
  HOVERED_OUTLINE_ALPHA,
  GHOST_PREVIEW_SPRITE_ALPHA,
  GHOST_PREVIEW_TINT_ALPHA,
  SELECTION_DASH_PATTERN,
  BUTTON_MIN_RADIUS,
  BUTTON_RADIUS_ZOOM_FACTOR,
  BUTTON_ICON_SIZE_FACTOR,
  BUTTON_LINE_WIDTH_MIN,
  BUTTON_LINE_WIDTH_ZOOM_FACTOR,
  BUBBLE_FADE_DURATION_SEC,
  BUBBLE_SITTING_OFFSET_PX,
  BUBBLE_VERTICAL_OFFSET_PX,
  FALLBACK_FLOOR_COLOR,
  SEAT_OWN_COLOR,
  SEAT_AVAILABLE_COLOR,
  SEAT_BUSY_COLOR,
  GRID_LINE_COLOR,
  VOID_TILE_OUTLINE_COLOR,
  VOID_TILE_DASH_PATTERN,
  GHOST_BORDER_HOVER_FILL,
  GHOST_BORDER_HOVER_STROKE,
  GHOST_BORDER_STROKE,
  GHOST_VALID_TINT,
  GHOST_INVALID_TINT,
  SELECTION_HIGHLIGHT_COLOR,
  DELETE_BUTTON_BG,
  ROTATE_BUTTON_BG,
  HEATMAP_CELL_SIZE,
  HEATMAP_CELL_GAP,
  HEATMAP_BOTTOM_MARGIN,
} from '../constants'

// ── GitHub Contribution Heatmap ─────────────────────────────────

export interface ContributionDay { count: number; date: string }
export interface ContributionWeek { days: ContributionDay[] }
export interface ContributionData { weeks: ContributionWeek[]; username: string }

const HEATMAP_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
const SHOW_GITHUB_CONTRIBUTION_HEATMAP = false

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function fillCloudRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function renderSunnyCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  opacity: number,
): void {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = 'rgba(153, 203, 236, 0.46)'
  fillCloudRect(ctx, x + 8 * scale, y + 30 * scale, 82 * scale, 12 * scale)
  fillCloudRect(ctx, x + 26 * scale, y + 20 * scale, 60 * scale, 16 * scale)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  fillCloudRect(ctx, x, y + 24 * scale, 96 * scale, 18 * scale)
  fillCloudRect(ctx, x + 10 * scale, y + 14 * scale, 32 * scale, 24 * scale)
  fillCloudRect(ctx, x + 34 * scale, y + 6 * scale, 34 * scale, 32 * scale)
  fillCloudRect(ctx, x + 62 * scale, y + 16 * scale, 40 * scale, 22 * scale)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  fillCloudRect(ctx, x + 14 * scale, y + 18 * scale, 18 * scale, 6 * scale)
  fillCloudRect(ctx, x + 46 * scale, y + 10 * scale, 18 * scale, 6 * scale)
  ctx.restore()
}

function renderWaxingCrescentMoon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const cell = Math.max(3, Math.round(size / 7))
  const left = Math.round(centerX - cell * 3.5)
  const top = Math.round(centerY - cell * 3.5)

  ctx.save()
  const litRows = [
    '0011100',
    '0001110',
    '0000111',
    '0000111',
    '0000111',
    '0001110',
    '0011100',
  ]
  ctx.fillStyle = '#f6d84d'
  for (let row = 0; row < litRows.length; row++) {
    for (let col = 0; col < litRows[row].length; col++) {
      if (litRows[row][col] !== '1') continue
      ctx.fillRect(left + col * cell, top + row * cell, cell, cell)
    }
  }
  ctx.restore()
}

function renderPixelStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const s = Math.max(1, Math.round(size))
  const cx = Math.round(x)
  const cy = Math.round(y)
  ctx.fillRect(cx, cy - s, s, s)
  ctx.fillRect(cx - s, cy, s, s)
  ctx.fillRect(cx, cy, s, s)
  ctx.fillRect(cx + s, cy, s, s)
  ctx.fillRect(cx, cy + s, s, s)
}

function renderWeatherBackdrop(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  weather: PixelOfficeWeather,
  timeSeconds: number,
): void {
  if (weather === 'clear') return

  ctx.save()
  if (weather === 'sunny') {
    ctx.fillStyle = '#42abf5'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = '#6fcaff'
    ctx.fillRect(0, Math.round(canvasHeight * 0.34), canvasWidth, Math.ceil(canvasHeight * 0.36))
    ctx.fillStyle = '#a8e6ff'
    ctx.fillRect(0, Math.round(canvasHeight * 0.68), canvasWidth, Math.ceil(canvasHeight * 0.32))

    const sunX = Math.round(canvasWidth * 0.82)
    const sunY = Math.round(canvasHeight * 0.13)
    const sunSize = Math.max(28, Math.min(56, canvasWidth * 0.06))
    ctx.fillStyle = '#ffe36e'
    ctx.fillRect(sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize)
    ctx.fillStyle = '#fff2a8'
    ctx.fillRect(sunX - sunSize * 0.28, sunY - sunSize * 0.28, sunSize * 0.56, sunSize * 0.56)
    ctx.fillStyle = 'rgba(255, 238, 126, 0.72)'
    ctx.fillRect(sunX - sunSize * 0.12, sunY - sunSize * 1.05, sunSize * 0.24, sunSize * 0.34)
    ctx.fillRect(sunX - sunSize * 0.12, sunY + sunSize * 0.71, sunSize * 0.24, sunSize * 0.34)
    ctx.fillRect(sunX - sunSize * 1.05, sunY - sunSize * 0.12, sunSize * 0.34, sunSize * 0.24)
    ctx.fillRect(sunX + sunSize * 0.71, sunY - sunSize * 0.12, sunSize * 0.34, sunSize * 0.24)

    const drift = (timeSeconds * 8) % (canvasWidth + 180)
    renderSunnyCloud(ctx, (canvasWidth * 0.12 + drift * 0.18) % (canvasWidth + 120) - 60, canvasHeight * 0.12, 0.7, 0.96)
    renderSunnyCloud(ctx, (canvasWidth * 0.46 - drift * 0.12 + canvasWidth + 120) % (canvasWidth + 160) - 80, canvasHeight * 0.2, 0.95, 0.92)
    renderSunnyCloud(ctx, (canvasWidth * 0.7 + drift * 0.1) % (canvasWidth + 150) - 70, canvasHeight * 0.38, 0.82, 0.9)
    ctx.restore()
    return
  }

  if (weather === 'night') {
    ctx.fillStyle = '#080d1f'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    const moonX = Math.round(canvasWidth * 0.82)
    const moonY = Math.round(canvasHeight * 0.13)
    const moonSize = Math.max(28, Math.min(56, canvasWidth * 0.06))
    renderWaxingCrescentMoon(ctx, moonX, moonY, moonSize)
    ctx.fillStyle = '#fff4a8'
    renderPixelStar(ctx, moonX - moonSize * 1.05, moonY - moonSize * 0.35, Math.max(1, moonSize * 0.04))
    renderPixelStar(ctx, moonX + moonSize * 0.9, moonY - moonSize * 0.55, Math.max(1, moonSize * 0.035))
    renderPixelStar(ctx, moonX + moonSize * 1.18, moonY + moonSize * 0.35, Math.max(1, moonSize * 0.03))
    ctx.fillStyle = 'rgba(192, 216, 255, 0.72)'
    for (let i = 0; i < 54; i++) {
      const x = seededUnit(i + 3) * canvasWidth
      const y = seededUnit(i + 91) * canvasHeight * 0.78
      const twinkle = 0.42 + seededUnit(i + Math.floor(timeSeconds * 0.8)) * 0.45
      ctx.globalAlpha = twinkle
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
    ctx.globalAlpha = 1
    ctx.restore()
    return
  }

  ctx.fillStyle = '#0b1024'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const sweep = (Math.sin(timeSeconds * 0.42) + 1) / 2
  const cloud = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
  cloud.addColorStop(0, 'rgba(20, 30, 61, 0.55)')
  cloud.addColorStop(Math.max(0.02, Math.min(0.98, sweep)), 'rgba(58, 70, 109, 0.3)')
  cloud.addColorStop(1, 'rgba(8, 12, 31, 0.65)')
  ctx.fillStyle = cloud
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const cycle = (timeSeconds + 1.15) % 5.6
  const flash = cycle < 0.08 ? 0.52 * (1 - cycle / 0.08) : cycle > 0.18 && cycle < 0.25 ? 0.22 * (1 - (cycle - 0.18) / 0.07) : 0
  if (flash > 0) {
    ctx.fillStyle = `rgba(210, 226, 255, ${flash})`
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    renderLightningBolt(ctx, canvasWidth, canvasHeight, Math.floor((timeSeconds + 1.15) / 5.6), flash)
  }

  ctx.restore()
}

function renderLightningBolt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  strikeIndex: number,
  flash: number,
): void {
  const startX = canvasWidth * (0.18 + seededUnit(strikeIndex + 17) * 0.64)
  let x = startX
  let y = 0
  const segments = 7

  ctx.save()
  ctx.strokeStyle = `rgba(237, 246, 255, ${Math.min(1, flash + 0.42)})`
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(137, 187, 255, 0.82)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.moveTo(Math.round(x), y)
  for (let i = 1; i <= segments; i++) {
    x += (seededUnit(strikeIndex * 19 + i) - 0.5) * canvasWidth * 0.08
    y = (canvasHeight * 0.1) + (i / segments) * canvasHeight * 0.45
    ctx.lineTo(Math.round(x), Math.round(y))
  }
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.strokeStyle = `rgba(113, 178, 255, ${flash * 0.8})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(Math.round(x), Math.round(y - canvasHeight * 0.12))
  ctx.lineTo(Math.round(x + canvasWidth * 0.08), Math.round(y - canvasHeight * 0.03))
  ctx.stroke()
  ctx.restore()
}

function renderWeatherAtmosphere(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  weather: PixelOfficeWeather,
  timeSeconds: number,
): void {
  if (weather === 'clear') return

  ctx.save()
  if (weather === 'sunny') {
    ctx.fillStyle = 'rgba(255, 232, 142, 0.07)'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
    return
  }

  if (weather === 'night') {
    ctx.fillStyle = 'rgba(4, 8, 24, 0.28)'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
    return
  }

  ctx.fillStyle = 'rgba(6, 11, 30, 0.28)'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.lineCap = 'square'
  ctx.strokeStyle = 'rgba(174, 214, 255, 0.58)'
  ctx.lineWidth = 1
  const dropCount = Math.max(120, Math.min(360, Math.floor((canvasWidth * canvasHeight) / 4600)))
  const fallDistance = canvasHeight + 96
  const slant = 18
  for (let i = 0; i < dropCount; i++) {
    const baseX = seededUnit(i + 23) * (canvasWidth + 80) - 40
    const baseY = seededUnit(i + 59) * fallDistance - 64
    const speed = 180 + seededUnit(i + 101) * 220
    const y = (baseY + timeSeconds * speed) % fallDistance - 48
    const gust = Math.sin(timeSeconds * 2.2 + i) * 7
    const x = (baseX + timeSeconds * 52 + gust) % (canvasWidth + 96) - 48
    const len = 10 + seededUnit(i + 211) * 13
    ctx.globalAlpha = 0.34 + seededUnit(i + 307) * 0.38
    ctx.beginPath()
    ctx.moveTo(Math.round(x), Math.round(y))
    ctx.lineTo(Math.round(x + slant), Math.round(y + len))
    ctx.stroke()
  }

  ctx.globalAlpha = 0.23
  ctx.strokeStyle = 'rgba(219, 238, 255, 0.55)'
  ctx.lineWidth = 2
  for (let i = 0; i < 34; i++) {
    const x = seededUnit(i + 509) * canvasWidth
    const y = (seededUnit(i + 607) * canvasHeight + timeSeconds * 420) % canvasHeight
    ctx.beginPath()
    ctx.moveTo(Math.round(x), Math.round(y))
    ctx.lineTo(Math.round(x + 26), Math.round(y + 22))
    ctx.stroke()
  }
  ctx.restore()
}

function contributionLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 6) return 2
  if (count <= 9) return 3
  return 4
}

function renderContributionHeatmap(
  ctx: CanvasRenderingContext2D,
  data: ContributionData,
  offsetX: number, offsetY: number, zoom: number,
): void {
  if (!data.weeks.length) return
  const tileW = TILE_SIZE * zoom
  // Draw 52×7 heatmap grid across left room top wall (row 0, cols 1-9)
  const areaX = offsetX + 1 * tileW
  const areaW = 9 * tileW
  const areaH = tileW
  const areaY = offsetY  // row 0 top edge
  // Calculate cell size to fit 52 cols × 7 rows with 1px gaps
  const gapPx = Math.max(0.5, 0.5 * zoom)
  const cellW = (areaW - (data.weeks.length - 1) * gapPx) / data.weeks.length
  const cellH = (areaH - 6 * gapPx) / 7

  // Fill background so gaps between cells are consistent
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(areaX), Math.round(areaY), Math.round(areaW), Math.round(areaH))

  for (let w = 0; w < data.weeks.length; w++) {
    const week = data.weeks[w]
    for (let d = 0; d < week.days.length; d++) {
      const level = contributionLevel(week.days[d].count)
      ctx.fillStyle = HEATMAP_COLORS[level]
      const x = areaX + w * (cellW + gapPx)
      const y = areaY + d * (cellH + gapPx)
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(cellW), Math.ceil(cellH))
    }
  }
}

/** Render photograph on right room wall (row 0, cols 12-18) */
function renderPhotograph(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  offsetX: number, offsetY: number, zoom: number,
): void {
  const tileW = TILE_SIZE * zoom
  const margin = 1 * zoom  // 1px border
  const baseW = 7 * tileW - margin * 2
  const baseH = tileW - margin * 2
  const scale = 4 / 3
  const areaW = baseW * scale
  const areaH = baseH * scale
  // Anchor bottom edge: shift areaY up by the extra height
  const baseY = offsetY + margin - tileW / 8
  const areaY = baseY + baseH - areaH
  // Center horizontally relative to original area
  const baseX = offsetX + 10 * tileW + margin
  const areaX = baseX - (areaW - baseW) / 2
  // Fit image preserving aspect ratio
  const imgAspect = img.width / img.height
  const areaAspect = areaW / areaH
  let drawW: number, drawH: number, drawX: number, drawY: number
  if (imgAspect > areaAspect) {
    drawW = areaW
    drawH = areaW / imgAspect
    drawX = areaX
    drawY = areaY + (areaH - drawH) / 2
  } else {
    drawH = areaH
    drawW = areaH * imgAspect
    drawX = areaX + (areaW - drawW) / 2
    drawY = areaY
  }
  ctx.drawImage(img, Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH))
}

// ── Render functions ────────────────────────────────────────────

export function renderTileGrid(
  ctx: CanvasRenderingContext2D,
  tileMap: TileTypeVal[][],
  offsetX: number,
  offsetY: number,
  zoom: number,
  tileColors?: Array<FloorColor | null>,
  cols?: number,
): void {
  const s = TILE_SIZE * zoom
  const useSpriteFloors = hasFloorSprites()
  const tmRows = tileMap.length
  const tmCols = tmRows > 0 ? tileMap[0].length : 0
  const layoutCols = cols ?? tmCols
  const GRID_STEP = 3 // Draw grid lines every N tiles

  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      const tile = tileMap[r][c]
      if (tile === TileType.VOID) continue

      if (tile === TileType.WALL) {
        const colorIdx = r * layoutCols + c
        const wallColor = tileColors?.[colorIdx]
        ctx.fillStyle = wallColor ? wallColorToHex(wallColor) : WALL_COLOR
        ctx.fillRect(offsetX + c * s, offsetY + r * s, s, s)
        continue
      }

      if (!useSpriteFloors) {
        ctx.fillStyle = FALLBACK_FLOOR_COLOR
        ctx.fillRect(offsetX + c * s, offsetY + r * s, s, s)
        continue
      }

      // Floor tile: draw the colorized floor sprite, matching upstream Pixel
      // Agents. (The old flat fillRect was a seam workaround for fractional
      // zoom; zoom is now snapped to integer device pixels, so sprites tile
      // exactly.)
      const colorIdx = r * layoutCols + c
      const color = tileColors?.[colorIdx] ?? { h: 0, s: 0, b: 0, c: 0 }
      const sprite = getColorizedFloorSprite(tile, color)
      const cached = getCachedSprite(sprite, zoom)
      ctx.drawImage(cached, offsetX + c * s, offsetY + r * s)
    }
  }

  // Subtle square grid lines per floor tile (ceramic tile effect).
  // Only drawn on floor tiles so the grid never shows outside the office.
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      const tile = tileMap[r][c]
      if (tile === TileType.VOID || tile === TileType.WALL) continue
      ctx.rect(Math.round(offsetX + c * s) + 0.5, Math.round(offsetY + r * s) + 0.5, Math.round(s), Math.round(s))
    }
  }
  ctx.stroke()
  ctx.restore()

}

interface ZDrawable {
  zY: number
  draw: (ctx: CanvasRenderingContext2D) => void
  drawBehindWall?: (ctx: CanvasRenderingContext2D) => void
  drawWallMask?: (ctx: CanvasRenderingContext2D, wall: ZDrawable, clipBounds: WorldBounds) => void
  uid?: string
  occlusionBounds?: WorldBounds
  isWall?: boolean
  isFurniture?: boolean
  isActor?: boolean
}

interface WorldBounds {
  x: number
  y: number
  w: number
  h: number
}

const BEHIND_WALL_ALPHA = 0.38
const BEHIND_WALL_FILTER = 'grayscale(0.95) saturate(0.38) brightness(0.76) contrast(1.08)'
const ACTOR_WALL_DEPTH_TOLERANCE = 1
const FURNITURE_SHADOW_LUMA_MAX = 92
const FURNITURE_SHADOW_CHROMA_MAX = 28
const behindWallSpriteCache = new WeakMap<SpriteData, {
  withShadows: Array<Array<string | null>>
  withoutShadows: Array<Array<string | null>>
}>()

function spriteWidth(sprite: SpriteData): number {
  return sprite[0]?.length ?? TILE_SIZE
}

function spriteHeight(sprite: SpriteData): number {
  return sprite.length || TILE_SIZE
}

function colorKey(color: FloorColor): string {
  return `${color.h}-${color.s}-${color.b}-${color.c}-${color.colorize ? 1 : 0}`
}

function colorizeCharacterSprites(sprites: CharacterSprites, cacheKeyBase: string, color: FloorColor): CharacterSprites {
  const key = `${cacheKeyBase}-${colorKey(color)}`
  const colorize = (sprite: SpriteData, suffix: string) => getColorizedSprite(`${key}-${suffix}`, sprite, color)
  const colorizeWalk = (
    dir: Direction,
    frames: [SpriteData, SpriteData, SpriteData, SpriteData],
  ): [SpriteData, SpriteData, SpriteData, SpriteData] => [
    colorize(frames[0], `walk-${dir}-0`),
    colorize(frames[1], `walk-${dir}-1`),
    colorize(frames[2], `walk-${dir}-2`),
    colorize(frames[3], `walk-${dir}-3`),
  ]
  const colorizePair = (
    group: string,
    dir: Direction,
    frames: [SpriteData, SpriteData],
  ): [SpriteData, SpriteData] => [
    colorize(frames[0], `${group}-${dir}-0`),
    colorize(frames[1], `${group}-${dir}-1`),
  ]
  return {
    walk: {
      [Direction.DOWN]: colorizeWalk(Direction.DOWN, sprites.walk[Direction.DOWN]),
      [Direction.LEFT]: colorizeWalk(Direction.LEFT, sprites.walk[Direction.LEFT]),
      [Direction.RIGHT]: colorizeWalk(Direction.RIGHT, sprites.walk[Direction.RIGHT]),
      [Direction.UP]: colorizeWalk(Direction.UP, sprites.walk[Direction.UP]),
    } as Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>,
    typing: {
      [Direction.DOWN]: colorizePair('typing', Direction.DOWN, sprites.typing[Direction.DOWN]),
      [Direction.LEFT]: colorizePair('typing', Direction.LEFT, sprites.typing[Direction.LEFT]),
      [Direction.RIGHT]: colorizePair('typing', Direction.RIGHT, sprites.typing[Direction.RIGHT]),
      [Direction.UP]: colorizePair('typing', Direction.UP, sprites.typing[Direction.UP]),
    } as Record<Direction, [SpriteData, SpriteData]>,
    reading: {
      [Direction.DOWN]: colorizePair('reading', Direction.DOWN, sprites.reading[Direction.DOWN]),
      [Direction.LEFT]: colorizePair('reading', Direction.LEFT, sprites.reading[Direction.LEFT]),
      [Direction.RIGHT]: colorizePair('reading', Direction.RIGHT, sprites.reading[Direction.RIGHT]),
      [Direction.UP]: colorizePair('reading', Direction.UP, sprites.reading[Direction.UP]),
    } as Record<Direction, [SpriteData, SpriteData]>,
  }
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  if (color[0] !== '#') return null
  if (color.length === 4) {
    const r = Number.parseInt(color[1] + color[1], 16)
    const g = Number.parseInt(color[2] + color[2], 16)
    const b = Number.parseInt(color[3] + color[3], 16)
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b }
  }
  if (color.length !== 7) return null
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b }
}

function isFurnitureShadowPixel(color: string): boolean {
  const rgb = parseHexColor(color)
  if (!rgb) return false
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  const min = Math.min(rgb.r, rgb.g, rgb.b)
  const luma = rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722
  return luma <= FURNITURE_SHADOW_LUMA_MAX && max - min <= FURNITURE_SHADOW_CHROMA_MAX
}

function toBehindWallPixelColor(color: string): string | null {
  if (color === '') return null
  const rgb = parseHexColor(color)
  if (!rgb) return color
  const luma = rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722
  const r = Math.max(0, Math.min(255, Math.round((luma * 0.84 + rgb.r * 0.16) * 0.72)))
  const g = Math.max(0, Math.min(255, Math.round((luma * 0.9 + rgb.g * 0.1) * 0.72)))
  const b = Math.max(0, Math.min(255, Math.round((luma * 1.05 + rgb.b * 0.06) * 0.72)))
  return `rgba(${r},${g},${b},${BEHIND_WALL_ALPHA})`
}

function getBehindWallSpritePixels(sprite: SpriteData, skipFurnitureShadows: boolean): Array<Array<string | null>> {
  let cached = behindWallSpriteCache.get(sprite)
  if (!cached) {
    cached = { withShadows: [], withoutShadows: [] }
    behindWallSpriteCache.set(sprite, cached)
  }

  const key = skipFurnitureShadows ? 'withoutShadows' : 'withShadows'
  if (cached[key].length > 0) return cached[key]

  const pixels = sprite.map((row) => row.map((color) => {
    if (color === '') return null
    if (skipFurnitureShadows && isFurnitureShadowPixel(color)) return null
    return toBehindWallPixelColor(color)
  }))
  cached[key] = pixels
  return pixels
}

function renderBehindWallSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  drawX: number,
  drawY: number,
  zoom: number,
  skipFurnitureShadows: boolean,
): void {
  const pixels = getBehindWallSpritePixels(sprite, skipFurnitureShadows)
  for (let r = 0; r < pixels.length; r++) {
    for (let c = 0; c < pixels[r].length; c++) {
      const color = pixels[r][c]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(drawX + c * zoom, drawY + r * zoom, zoom, zoom)
    }
  }
}

function clipToSpritePixels(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  drawX: number,
  drawY: number,
  zoom: number,
  skipFurnitureShadows: boolean,
): boolean {
  let hasPixels = false
  ctx.beginPath()
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const color = sprite[r][c]
      if (color === '') continue
      if (skipFurnitureShadows && isFurnitureShadowPixel(color)) continue
      ctx.rect(drawX + c * zoom, drawY + r * zoom, zoom, zoom)
      hasPixels = true
    }
  }
  if (!hasPixels) return false
  ctx.clip()
  return true
}

function renderWallThroughSpritePixels(
  ctx: CanvasRenderingContext2D,
  wall: ZDrawable,
  clipBounds: WorldBounds,
  offsetX: number,
  offsetY: number,
  zoom: number,
  sprite: SpriteData,
  drawX: number,
  drawY: number,
  skipFurnitureShadows: boolean,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    offsetX + clipBounds.x * zoom,
    offsetY + clipBounds.y * zoom,
    clipBounds.w * zoom,
    clipBounds.h * zoom,
  )
  ctx.clip()
  if (clipToSpritePixels(ctx, sprite, drawX, drawY, zoom, skipFurnitureShadows)) {
    wall.draw(ctx)
  }
  ctx.restore()
}

function boundsOverlap(a: WorldBounds, b: WorldBounds): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function boundsIntersection(a: WorldBounds, b: WorldBounds): WorldBounds | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.w, b.x + b.w)
  const bottom = Math.min(a.y + a.h, b.y + b.h)
  if (right <= x || bottom <= y) return null
  return { x, y, w: right - x, h: bottom - y }
}

function renderClippedDrawable(
  ctx: CanvasRenderingContext2D,
  drawable: ZDrawable,
  clipBounds: WorldBounds,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    offsetX + clipBounds.x * zoom,
    offsetY + clipBounds.y * zoom,
    clipBounds.w * zoom,
    clipBounds.h * zoom,
  )
  ctx.clip()
  drawable.draw(ctx)
  ctx.restore()
}

function renderBehindWallGhost(
  ctx: CanvasRenderingContext2D,
  drawable: ZDrawable,
  wallBounds: WorldBounds,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    offsetX + wallBounds.x * zoom,
    offsetY + wallBounds.y * zoom,
    wallBounds.w * zoom,
    wallBounds.h * zoom,
  )
  ctx.clip()
  if (drawable.drawBehindWall) {
    drawable.drawBehindWall(ctx)
  } else {
    ctx.globalAlpha = BEHIND_WALL_ALPHA
    ctx.filter = BEHIND_WALL_FILTER
    drawable.draw(ctx)
  }
  ctx.restore()
}

function shouldRepairWallOcclusion(occluded: ZDrawable, wall: ZDrawable): boolean {
  if (!occluded.occlusionBounds || !wall.occlusionBounds) return false
  if (!boundsOverlap(occluded.occlusionBounds, wall.occlusionBounds)) return false

  // Furniture can cross into a wall tile while its bottom edge still sorts in
  // front of the wall, so keep the geometric overlap rule for solid furniture.
  if (occluded.isFurniture) return true

  // Actors need depth awareness: hair/head pixels can overlap a nearby wall
  // even when the actor is walking in front of it. A small tolerance keeps
  // behind-wall leg/body slices working for actors just behind a wall face.
  if (occluded.isActor) return occluded.zY <= wall.zY + ACTOR_WALL_DEPTH_TOLERANCE

  return occluded.zY < wall.zY
}

function renderWallOcclusionRepairs(
  ctx: CanvasRenderingContext2D,
  occludableDrawables: ZDrawable[],
  wallDrawables: ZDrawable[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  draggedFurnitureUid?: string | null,
): void {
  for (const wall of wallDrawables) {
    if (!wall.occlusionBounds) continue
    for (const occluded of occludableDrawables) {
      const forceDraggedRepair = draggedFurnitureUid != null && occluded.uid === draggedFurnitureUid
      if (!forceDraggedRepair && !shouldRepairWallOcclusion(occluded, wall)) continue
      if (!occluded.occlusionBounds) continue
      const clipBounds = boundsIntersection(occluded.occlusionBounds, wall.occlusionBounds)
      if (!clipBounds) continue
      if (!occluded.drawWallMask) continue
      occluded.drawWallMask(ctx, wall, clipBounds)
      renderBehindWallGhost(ctx, occluded, clipBounds, offsetX, offsetY, zoom)
    }
  }
}

/** Wrap task text at maxChars characters or at Chinese punctuation boundaries */
function wrapTaskText(text: string, maxChars = 10): string[] {
  const punctuation = /[，。！？、；：,!?;:]/
  const lines: string[] = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    current += text[i]
    if (punctuation.test(text[i]) || current.length >= maxChars) {
      lines.push(current)
      current = ''
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 6) // max 6 lines
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
  contributions?: ContributionData,
  photograph?: HTMLImageElement,
  gatewayHealthy?: boolean,
  draggedFurnitureUid?: string | null,
): void {
  const drawables: ZDrawable[] = []
  const laptopSizeScale = 0.7
  const laptopXTiltRad = (50 * Math.PI) / 180
  const laptopUpwardSpinRad = -Math.PI / 12
  const laptopTiltScaleY = Math.max(0.22, Math.abs(Math.cos(laptopXTiltRad)))
  const laptopTiltSkewX = -Math.sin(laptopXTiltRad) * 0.35
  const visibleSubagentStoolIds = new Set<string>()
  for (const ch of characters) {
    if (!ch.isSubagent || ch.state !== CharacterState.TYPE || !ch.seatId) continue
    if (!ch.seatId.startsWith('stool-r')) continue
    if (ch.matrixEffect === 'despawn') continue
    visibleSubagentStoolIds.add(ch.seatId)
  }

  // Wall decorations as z-sorted drawables (zY just above row 0 walls so they render on top of walls but below characters)
  const wallDecoZY = TILE_SIZE + 0.5
  if (SHOW_GITHUB_CONTRIBUTION_HEATMAP && contributions && contributions.weeks.length > 0) {
    drawables.push({ zY: wallDecoZY, draw: () => {
      renderContributionHeatmap(ctx, contributions, offsetX, offsetY, zoom)
    }})
  }
  if (photograph) {
    drawables.push({ zY: wallDecoZY, draw: () => {
      renderPhotograph(ctx, photograph, offsetX, offsetY, zoom)
    }})
  }

  // Furniture
  for (const f of furniture) {
    if (f.uid?.startsWith('stool-r') && !visibleSubagentStoolIds.has(f.uid)) {
      continue
    }
    const isWallInstance = f.uid === undefined && !f.emoji
    const spriteBounds: WorldBounds = {
      x: f.x,
      y: f.y,
      w: spriteWidth(f.sprite),
      h: spriteHeight(f.sprite),
    }
    const wallRise = f.zY > f.y ? f.zY - f.y : TILE_SIZE
    const wallFaceHeight = Math.max(1, Math.min(TILE_SIZE, wallRise))
    const wallOcclusionBounds: WorldBounds = {
      x: f.x,
      y: f.zY - wallFaceHeight,
      w: TILE_SIZE,
      h: wallFaceHeight,
    }
    const furnitureOcclusionBounds = f.wallOcclusionDisabled
      ? undefined
      : f.wallOcclusionBounds ?? spriteBounds
    const fx = offsetX + f.x * zoom
    const fy = offsetY + f.y * zoom
    if (f.emoji) {
      const emojiSize = TILE_SIZE * zoom
      const emojiX = fx + emojiSize / 2
      const emojiY = fy + emojiSize * 0.8
      const emojiScale = f.emojiScale ?? 1
      const emojiBoundsSize = TILE_SIZE * emojiScale
      const emojiOcclusionBounds = f.wallOcclusionDisabled ? undefined : {
        x: f.x + TILE_SIZE / 2 - emojiBoundsSize / 2,
        y: f.y,
        w: emojiBoundsSize,
        h: TILE_SIZE,
      }
      drawables.push({
        uid: f.uid,
        zY: f.zY,
        isFurniture: Boolean(emojiOcclusionBounds),
        ...(emojiOcclusionBounds ? { occlusionBounds: emojiOcclusionBounds } : {}),
        draw: (c) => {
          c.font = `${emojiSize * 0.7 * emojiScale}px serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          if (f.rotation) {
            c.save()
            c.translate(emojiX, emojiY)
            c.rotate((f.rotation * Math.PI) / 180)
            c.fillText(f.emoji!, 0, 0)
            c.restore()
          } else {
            c.fillText(f.emoji!, emojiX, emojiY)
          }

          // Camera flash effect: brief white burst every 10 seconds
          if (f.emoji === '📷') {
            const flashCycle = (Date.now() % 10000) / 10000
            if (flashCycle < 0.03) {
              const flashAlpha = 1 - flashCycle / 0.03
              const flashR = emojiSize * 1.5
              const grad = c.createRadialGradient(emojiX, emojiY, 0, emojiX, emojiY, flashR)
              grad.addColorStop(0, `rgba(255,255,255,${flashAlpha * 0.9})`)
              grad.addColorStop(0.3, `rgba(255,255,200,${flashAlpha * 0.5})`)
              grad.addColorStop(1, `rgba(255,255,200,0)`)
              c.fillStyle = grad
              c.fillRect(emojiX - flashR, emojiY - flashR, flashR * 2, flashR * 2)
            }
          }
        },
      })
    } else {
      const cached = getCachedSprite(f.sprite, zoom)
      drawables.push({
        uid: f.uid,
        zY: f.zY,
        occlusionBounds: isWallInstance ? wallOcclusionBounds : furnitureOcclusionBounds,
        isWall: isWallInstance,
        isFurniture: !isWallInstance && Boolean(furnitureOcclusionBounds),
        draw: (c) => {
          c.drawImage(cached, fx, fy)
        },
        ...(!isWallInstance && furnitureOcclusionBounds
          ? {
              drawBehindWall: (c) => renderBehindWallSprite(c, f.sprite, fx, fy, zoom, true),
              drawWallMask: (c, wall, clipBounds) => {
                renderWallThroughSpritePixels(c, wall, clipBounds, offsetX, offsetY, zoom, f.sprite, fx, fy, false)
              },
            }
          : {}),
      })

      // Server alarm beacon (top of the server rack in the lounge left wall).
      if (f.uid === 'server-b-left') {
        const healthy = gatewayHealthy !== false
        const now = Date.now()
        const healthyPulse = (Math.sin(now / 900) + 1) / 2
        const unhealthyPulse = (Math.sin(now / 120) + 1) / 2
        const blinkAlpha = healthy
          ? (0.55 + healthyPulse * 0.4) // slow breathing blink
          : (0.15 + unhealthyPulse * 0.85) // fast urgent blink
        drawables.push({
          zY: f.zY + 0.15,
          draw: (c) => {
            const lampX = Math.round(fx + 15 * zoom)
            const lampTopY = Math.round(fy + 1 * zoom)
            const lampW = Math.max(3, Math.round(3.6 * zoom))
            const lampH = Math.max(2, Math.round(2.2 * zoom))
            const stemW = Math.max(1, Math.round(1.1 * zoom))
            const stemH = Math.max(1, Math.round(1.4 * zoom))
            const baseW = Math.max(2, Math.round(2.6 * zoom))
            const baseH = Math.max(1, Math.round(1.1 * zoom))
            const lampLeft = Math.round(lampX - lampW / 2)
            const stemLeft = Math.round(lampX - stemW / 2)
            const stemTop = lampTopY + lampH
            const baseLeft = Math.round(lampX - baseW / 2)
            const baseTop = stemTop + stemH
            c.save()
            c.globalAlpha = blinkAlpha
            // Lamp cover (pixel warning light, not a sphere)
            c.fillStyle = '#2B2F45'
            c.fillRect(lampLeft - 1, lampTopY - 1, lampW + 2, lampH + 2)
            c.fillStyle = healthy ? '#63E46F' : '#F25F5C'
            c.fillRect(lampLeft, lampTopY, lampW, lampH)
            // Lamp stem + base
            c.fillStyle = '#3A425E'
            c.fillRect(stemLeft, stemTop, stemW, stemH)
            c.fillRect(baseLeft, baseTop, baseW, baseH)
            // Pixel glow bands to keep a lamp-like look (avoid spherical aura)
            const glowOuter = Math.max(8, Math.round(8.4 * zoom))
            const glowMid = Math.max(5, Math.round(5.8 * zoom))
            const glowInner = Math.max(3, Math.round(3.4 * zoom))
            c.fillStyle = healthy ? 'rgba(99,228,111,0.14)' : 'rgba(242,95,92,0.2)'
            c.fillRect(lampX - glowOuter, lampTopY - glowOuter, glowOuter * 2, glowOuter * 2)
            c.fillStyle = healthy ? 'rgba(99,228,111,0.2)' : 'rgba(242,95,92,0.28)'
            c.fillRect(lampX - glowMid, lampTopY - glowMid, glowMid * 2, glowMid * 2)
            c.fillStyle = healthy ? 'rgba(99,228,111,0.28)' : 'rgba(242,95,92,0.35)'
            c.fillRect(lampX - glowInner, lampTopY - glowInner, glowInner * 2, glowInner * 2)
            c.restore()
          },
        })
      }
    }
  }

  // Characters
  for (const ch of characters) {
    const charZY = ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET

    // Subagent temporary laptop: place it in front of the character using
    // live world coordinates, so it stays aligned with seated offsets.
    if (ch.isSubagent && ch.state === CharacterState.TYPE && ch.seatId) {
      let dx = 0
      let dy = 0
      if (ch.dir === Direction.LEFT) dx = -1
      else if (ch.dir === Direction.RIGHT) dx = 1
      else if (ch.dir === Direction.UP) dy = -1
      else dy = 1

      const forwardOffsetPx = TILE_SIZE * 0.62
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0
      const laptopWorldX = ch.x + dx * forwardOffsetPx
      const laptopWorldY = ch.y + sittingOffset + dy * forwardOffsetPx - 5 - TILE_SIZE / 8
      const laptopX = offsetX + laptopWorldX * zoom
      const laptopY = offsetY + laptopWorldY * zoom
      const laptopFacing =
        ch.dir === Direction.LEFT ? Direction.RIGHT :
        ch.dir === Direction.RIGHT ? Direction.LEFT :
        ch.dir === Direction.UP ? Direction.DOWN :
        Direction.UP
      const laptopRotation =
        laptopFacing === Direction.DOWN ? 0 :
        laptopFacing === Direction.LEFT ? 90 :
        laptopFacing === Direction.UP ? 180 : 270
      const laptopZY = laptopWorldY + TILE_SIZE * 0.45

      drawables.push({
        zY: laptopZY,
        occlusionBounds: {
          x: laptopWorldX - (TILE_SIZE * laptopSizeScale) / 2,
          y: laptopWorldY - (TILE_SIZE * laptopSizeScale) / 2,
          w: TILE_SIZE * laptopSizeScale,
          h: TILE_SIZE * laptopSizeScale,
        },
        draw: (c) => {
          const emojiSize = TILE_SIZE * zoom * laptopSizeScale
          c.save()
          c.translate(Math.round(laptopX), Math.round(laptopY))
          c.rotate((laptopRotation * Math.PI) / 180)
          // Composite transform: X-axis tilt + extra upward spin around laptop center.
          c.rotate(laptopUpwardSpinRad)
          c.transform(1, 0, laptopTiltSkewX, laptopTiltScaleY, 0, 0)
          c.font = `${emojiSize}px serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText('💻', 0, 0)
          c.restore()
        },
      })
    }

    if (ch.isLobster) {
      const lobsterX = Math.round(offsetX + ch.x * zoom)
      const lobsterY = Math.round(offsetY + ch.y * zoom + 2 * zoom)
      const lobsterAngle =
        ch.dir === Direction.RIGHT ? Math.PI / 2 :
        ch.dir === Direction.DOWN ? Math.PI :
        ch.dir === Direction.LEFT ? -Math.PI / 2 :
        0
      if (ch.lobsterBubbles.length > 0) {
        const bubbles = ch.lobsterBubbles
        drawables.push({
          zY: charZY - 0.05,
          draw: (c) => {
            c.save()
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.font = `${Math.max(10, Math.round(6 * zoom))}px serif`
            for (const b of bubbles) {
              const progress = b.age / 0.8
              const bx = lobsterX + b.x * zoom
              const by = lobsterY + (b.y - progress * 8) * zoom
              const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.7 ? (1 - progress) / 0.3 : 1
              c.globalAlpha = alpha * 0.9
              c.fillText('🫧', bx, by)
            }
            c.restore()
          },
        })
      }
      drawables.push({
        zY: charZY,
        isActor: true,
        occlusionBounds: {
          x: ch.x - 8,
          y: ch.y - 8,
          w: 16,
          h: 16,
        },
        draw: (c) => {
          c.save()
          c.translate(lobsterX, lobsterY)
          c.rotate(lobsterAngle)
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.font = `${Math.max(14, Math.round(9 * zoom))}px serif`
          c.fillText('🦞', 0, 0)
          c.restore()
        },
      })
      continue
    }

    const baseSprites = ch.isCat ? getCatSprites(ch.palette) : ch.isDog ? getDogSprites() : getCharacterSprites(ch.palette, ch.hueShift)
    // FloorColor tint: pets carry it as petColor, agents as colorTint. Either
    // way it runs through the same colorize path on top of the base sprites.
    const tint = ch.isCat || ch.isDog ? ch.petColor : ch.colorTint
    const tintKey = ch.isCat ? `cat-${ch.palette}` : ch.isDog ? 'dog' : `agent-${ch.palette}-${ch.hueShift}`
    const sprites = tint ? colorizeCharacterSprites(baseSprites, tintKey, tint) : baseSprites
    const spriteData = getCharacterSprite(ch, sprites)
    const cached = getCachedSprite(spriteData, zoom)
    const charSpriteW = spriteWidth(spriteData)
    const charSpriteH = spriteHeight(spriteData)
    // Sitting offset: shift character down when seated so they visually sit in the chair
    const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0
    const characterBounds: WorldBounds = {
      x: ch.x - charSpriteW / 2,
      y: ch.y + sittingOffset - charSpriteH,
      w: charSpriteW,
      h: charSpriteH,
    }
    // Anchor at bottom-center of character — round to integer device pixels
    const drawX = Math.round(offsetX + ch.x * zoom - cached.width / 2)
    const drawY = Math.round(offsetY + (ch.y + sittingOffset) * zoom - cached.height)

    // Sort characters by bottom of their tile (not center) so they render
    // in front of same-row furniture (e.g. chairs) but behind furniture
    // at lower rows (e.g. desks, bookshelves that occlude from below).

    // Matrix spawn/despawn effect — skip outline, use per-pixel rendering
    if (ch.matrixEffect) {
      const mDrawX = drawX
      const mDrawY = drawY
      const mSpriteData = spriteData
      const mCh = ch
      drawables.push({
        zY: charZY,
        isActor: true,
        occlusionBounds: characterBounds,
        drawBehindWall: (c) => renderBehindWallSprite(c, mSpriteData, mDrawX, mDrawY, zoom, false),
        drawWallMask: (c, wall, clipBounds) => {
          renderWallThroughSpritePixels(c, wall, clipBounds, offsetX, offsetY, zoom, mSpriteData, mDrawX, mDrawY, false)
        },
        draw: (c) => {
          renderMatrixEffect(c, mCh, mSpriteData, mDrawX, mDrawY, zoom)
        },
      })
      continue
    }

    // White outline: full opacity for selected, 50% for hover
    const isSelected = selectedAgentId !== null && ch.id === selectedAgentId
    const isHovered = hoveredAgentId !== null && ch.id === hoveredAgentId
    if (isSelected || isHovered) {
      const outlineAlpha = isSelected ? SELECTED_OUTLINE_ALPHA : HOVERED_OUTLINE_ALPHA
      const outlineData = getOutlineSprite(spriteData)
      const outlineCached = getCachedSprite(outlineData, zoom)
      const olDrawX = drawX - zoom  // 1 sprite-pixel offset, scaled
      const olDrawY = drawY - zoom  // outline follows sitting offset via drawY
      drawables.push({
        zY: charZY - OUTLINE_Z_SORT_OFFSET, // sort just before character
        draw: (c) => {
          c.save()
          c.globalAlpha = outlineAlpha
          c.drawImage(outlineCached, olDrawX, olDrawY)
          c.restore()
        },
      })
    }

    drawables.push({
      zY: charZY,
      isActor: true,
      occlusionBounds: characterBounds,
      drawBehindWall: (c) => renderBehindWallSprite(c, spriteData, drawX, drawY, zoom, false),
      drawWallMask: (c, wall, clipBounds) => {
        renderWallThroughSpritePixels(c, wall, clipBounds, offsetX, offsetY, zoom, spriteData, drawX, drawY, false)
      },
      draw: (c) => {
        c.drawImage(cached, drawX, drawY)
      },
    })

    // Agent label above head
    if (ch.label) {
      const labelX = Math.round(offsetX + ch.x * zoom)
      const labelY = drawY - 2 * zoom
      const fontSize = Math.max(12, Math.round(5.25 * zoom))
      const isWorking = ch.isActive && ch.state === CharacterState.TYPE
      const now = Date.now()
      // Blink effect for working state: use time-based alpha
      const labelAlpha = isWorking ? 0.7 + 0.3 * Math.sin(now / 300) : 1.0
      let labelColor = ch.isSubagent
        ? (isWorking ? `rgba(220,38,38,${labelAlpha})` : '#991B1B')
        : (isWorking ? `rgba(34,197,94,${labelAlpha})` : '#FFD700')
      if (ch.systemRoleType === 'gateway_sre') {
        const state = ch.systemStatus ?? 'unknown'
        if (state === 'healthy') {
          const alpha = 0.65 + 0.3 * ((Math.sin(now / 760) + 1) / 2)
          labelColor = `rgba(34,197,94,${alpha})`
        } else if (state === 'degraded') {
          const alpha = 0.45 + 0.55 * ((Math.sin(now / 220) + 1) / 2)
          labelColor = `rgba(250,204,21,${alpha})`
        } else if (state === 'down') {
          const alpha = 0.28 + 0.72 * ((Math.sin(now / 110) + 1) / 2)
          labelColor = `rgba(153,27,27,${alpha})`
        } else {
          labelColor = '#9CA3AF'
        }
      }
      drawables.push({
        zY: charZY + 0.1,
        draw: (c) => {
          c.save()
          c.font = `bold ${fontSize}px sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'bottom'
          const textW = c.measureText(ch.label).width
          const padX = 4 * zoom
          const padY = 2 * zoom
          const boxX = labelX - textW / 2 - padX
          const boxY = labelY - fontSize - padY
          const boxW = textW + padX * 2
          const boxH = fontSize + padY * 2
          const r = 3 * zoom
          c.beginPath()
          c.moveTo(boxX + r, boxY)
          c.lineTo(boxX + boxW - r, boxY)
          c.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r)
          c.lineTo(boxX + boxW, boxY + boxH - r)
          c.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r)
          c.lineTo(boxX + r, boxY + boxH)
          c.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r)
          c.lineTo(boxX, boxY + r)
          c.arcTo(boxX, boxY, boxX + r, boxY, r)
          c.closePath()
          c.fillStyle = 'rgba(0,0,0,0.55)'
          c.fill()
          c.fillStyle = 'rgba(0,0,0,0.9)'
          c.fillText(ch.label, labelX, labelY + 1)
          c.fillStyle = labelColor
          c.fillText(ch.label, labelX, labelY)
          c.restore()
        },
      })
    }

    // Task text bubble: scrolling marquee above (or below if near top) the agent's head
    if (ch.taskText && ch.isActive && ch.state === CharacterState.TYPE && !ch.isSubagent) {
      const taskX = Math.round(offsetX + ch.x * zoom)
      const labelFontSize = Math.max(12, Math.round(5.25 * zoom))
      const taskFontSize = Math.max(10, Math.round(4.5 * zoom))
      const padX = 5 * zoom
      const padY = 3 * zoom
      const bubbleH = taskFontSize + padY * 2
      const bubbleW = Math.round(72 * zoom)
      const boxX = Math.max(2, Math.min(taskX - bubbleW / 2, (ctx.canvas.width - bubbleW - 2)))
      const idealBoxY = drawY - 2 * zoom - labelFontSize - 4 * zoom - bubbleH - 4 * zoom
      // If bubble would be clipped by top edge, flip it below the character instead
      const belowY = drawY + cached.height + labelFontSize + 4 * zoom
      const tailUp = idealBoxY >= 4  // tail points down when bubble is above, up when below
      const boxY = idealBoxY >= 4 ? idealBoxY : belowY
      const fullText = ch.taskText
      drawables.push({
        zY: charZY + 0.2,
        draw: (c) => {
          c.save()
          c.font = `${taskFontSize}px sans-serif`
          const fullW = c.measureText(fullText).width
          const gap = bubbleW * 0.5
          const cycle = fullW + gap
          const speed = 30
          const scrollPx = ((Date.now() / 1000 * speed * zoom) % cycle)
          const textX = boxX + padX + (fullW > bubbleW - padX * 2 ? gap - scrollPx : 0)

          const r = 3 * zoom
          const tailW = 5 * zoom
          c.beginPath()
          c.moveTo(boxX + r, boxY)
          c.lineTo(boxX + bubbleW - r, boxY)
          c.arcTo(boxX + bubbleW, boxY, boxX + bubbleW, boxY + r, r)
          c.lineTo(boxX + bubbleW, boxY + bubbleH - r)
          c.arcTo(boxX + bubbleW, boxY + bubbleH, boxX + bubbleW - r, boxY + bubbleH, r)
          if (tailUp) {
            // Tail at bottom pointing down toward label
            c.lineTo(taskX + tailW, boxY + bubbleH)
            c.lineTo(taskX, boxY + bubbleH + 4 * zoom)
            c.lineTo(taskX - tailW, boxY + bubbleH)
          }
          c.lineTo(boxX + r, boxY + bubbleH)
          c.arcTo(boxX, boxY + bubbleH, boxX, boxY + bubbleH - r, r)
          if (!tailUp) {
            // Tail at top pointing up toward character
            c.lineTo(boxX, boxY + r)
            c.arcTo(boxX, boxY, boxX + r, boxY, r)
            c.lineTo(taskX - tailW, boxY)
            c.lineTo(taskX, boxY - 4 * zoom)
            c.lineTo(taskX + tailW, boxY)
          } else {
            c.lineTo(boxX, boxY + r)
            c.arcTo(boxX, boxY, boxX + r, boxY, r)
          }
          c.closePath()
          c.fillStyle = 'rgba(15,23,42,0.88)'
          c.fill()
          c.strokeStyle = 'rgba(99,102,241,0.7)'
          c.lineWidth = zoom
          c.stroke()

          c.beginPath()
          c.rect(boxX + padX, boxY, bubbleW - padX * 2, bubbleH)
          c.clip()
          c.fillStyle = '#e2e8f0'
          c.textAlign = 'left'
          c.textBaseline = 'middle'
          c.fillText(fullText, textX, boxY + bubbleH / 2)
          c.restore()
        },
      })
    }

    // Code snippet particles are rendered as DOM overlays in app/pixel-office/page.tsx
    // so they can float beyond the canvas area and pass over the top agent list.
  }

  // Sort by Y (lower = in front = drawn later)
  drawables.sort((a, b) => a.zY - b.zY)
  const occludableDrawables = drawables.filter((d) => !d.isWall && d.occlusionBounds)
  const wallDrawables = drawables.filter((d) => d.isWall && d.occlusionBounds)

  for (const d of drawables) {
    d.draw(ctx)
  }
  renderWallOcclusionRepairs(ctx, occludableDrawables, wallDrawables, offsetX, offsetY, zoom, draggedFurnitureUid)
}

// ── Seat indicators ─────────────────────────────────────────────

export function renderSeatIndicators(
  ctx: CanvasRenderingContext2D,
  seats: Map<string, Seat>,
  characters: Map<number, Character>,
  selectedAgentId: number | null,
  hoveredTile: { col: number; row: number } | null,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (selectedAgentId === null || !hoveredTile) return
  const selectedChar = characters.get(selectedAgentId)
  if (!selectedChar) return

  // Only show indicator for the hovered seat tile
  for (const [uid, seat] of seats) {
    if (seat.seatCol !== hoveredTile.col || seat.seatRow !== hoveredTile.row) continue

    const s = TILE_SIZE * zoom
    const x = offsetX + seat.seatCol * s
    const y = offsetY + seat.seatRow * s

    if (selectedChar.seatId === uid) {
      // Selected agent's own seat — blue
      ctx.fillStyle = SEAT_OWN_COLOR
    } else if (!seat.assigned) {
      // Available seat — green
      ctx.fillStyle = SEAT_AVAILABLE_COLOR
    } else {
      // Busy (assigned to another agent) — red
      ctx.fillStyle = SEAT_BUSY_COLOR
    }
    ctx.fillRect(x, y, s, s)
    break
  }
}

/** Seat overview mode: highlight every seat with its availability.
 * Green = free, red = taken, blue = the selected agent's own seat. */
export function renderSeatOverview(
  ctx: CanvasRenderingContext2D,
  seats: Map<string, Seat>,
  characters: Map<number, Character>,
  selectedAgentId: number | null,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const selectedChar = selectedAgentId !== null ? characters.get(selectedAgentId) : null
  const s = TILE_SIZE * zoom
  for (const [uid, seat] of seats) {
    const x = offsetX + Math.round(seat.seatCol) * s
    const y = offsetY + Math.round(seat.seatRow) * s
    if (selectedChar && selectedChar.seatId === uid) {
      ctx.fillStyle = SEAT_OWN_COLOR
    } else if (!seat.assigned) {
      ctx.fillStyle = SEAT_AVAILABLE_COLOR
    } else {
      ctx.fillStyle = SEAT_BUSY_COLOR
    }
    ctx.fillRect(x, y, s, s)
  }
}

// ── Edit mode overlays ──────────────────────────────────────────

export function renderGridOverlay(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
  cols: number,
  rows: number,
  tileMap?: TileTypeVal[][],
): void {
  const s = TILE_SIZE * zoom
  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  // Vertical lines — offset by 0.5 for crisp 1px lines
  for (let c = 0; c <= cols; c++) {
    const x = offsetX + c * s + 0.5
    ctx.moveTo(x, offsetY)
    ctx.lineTo(x, offsetY + rows * s)
  }
  // Horizontal lines
  for (let r = 0; r <= rows; r++) {
    const y = offsetY + r * s + 0.5
    ctx.moveTo(offsetX, y)
    ctx.lineTo(offsetX + cols * s, y)
  }
  ctx.stroke()

  // Draw faint dashed outlines on VOID tiles
  if (tileMap) {
    ctx.save()
    ctx.strokeStyle = VOID_TILE_OUTLINE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(VOID_TILE_DASH_PATTERN)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tileMap[r]?.[c] === TileType.VOID) {
          ctx.strokeRect(offsetX + c * s + 0.5, offsetY + r * s + 0.5, s - 1, s - 1)
        }
      }
    }
    ctx.restore()
  }
}

/** Draw faint expansion placeholders 1 tile outside grid bounds (ghost border). */
export function renderGhostBorder(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
  cols: number,
  rows: number,
  ghostHoverCol: number,
  ghostHoverRow: number,
): void {
  const s = TILE_SIZE * zoom
  ctx.save()

  // Collect ghost border tiles: one ring around the grid
  const ghostTiles: Array<{ c: number; r: number }> = []
  // Top and bottom rows
  for (let c = -1; c <= cols; c++) {
    ghostTiles.push({ c, r: -1 })
    ghostTiles.push({ c, r: rows })
  }
  // Left and right columns (excluding corners already added)
  for (let r = 0; r < rows; r++) {
    ghostTiles.push({ c: -1, r })
    ghostTiles.push({ c: cols, r })
  }

  for (const { c, r } of ghostTiles) {
    const x = offsetX + c * s
    const y = offsetY + r * s
    const isHovered = c === ghostHoverCol && r === ghostHoverRow
    if (isHovered) {
      ctx.fillStyle = GHOST_BORDER_HOVER_FILL
      ctx.fillRect(x, y, s, s)
    }
    ctx.strokeStyle = isHovered ? GHOST_BORDER_HOVER_STROKE : GHOST_BORDER_STROKE
    ctx.lineWidth = 1
    ctx.setLineDash(VOID_TILE_DASH_PATTERN)
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
  }

  ctx.restore()
}

export function renderGhostPreview(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  col: number,
  row: number,
  valid: boolean,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const cached = getCachedSprite(sprite, zoom)
  const x = offsetX + col * TILE_SIZE * zoom
  const y = offsetY + row * TILE_SIZE * zoom
  ctx.save()
  ctx.globalAlpha = GHOST_PREVIEW_SPRITE_ALPHA
  ctx.drawImage(cached, x, y)
  // Tint overlay
  ctx.globalAlpha = GHOST_PREVIEW_TINT_ALPHA
  ctx.fillStyle = valid ? GHOST_VALID_TINT : GHOST_INVALID_TINT
  ctx.fillRect(x, y, cached.width, cached.height)
  ctx.restore()
}

export function renderSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  w: number,
  h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom
  const x = offsetX + col * s
  const y = offsetY + row * s
  ctx.save()
  ctx.strokeStyle = SELECTION_HIGHLIGHT_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash(SELECTION_DASH_PATTERN)
  ctx.strokeRect(x + 1, y + 1, w * s - 2, h * s - 2)
  ctx.restore()
}

export function renderDeleteButton(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  w: number,
  _h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): DeleteButtonBounds {
  const s = TILE_SIZE * zoom
  // Position at top-right corner of selected furniture
  const cx = offsetX + (col + w) * s + 1
  const cy = offsetY + row * s - 1
  const radius = Math.max(BUTTON_MIN_RADIUS, zoom * BUTTON_RADIUS_ZOOM_FACTOR)

  // Circle background
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = DELETE_BUTTON_BG
  ctx.fill()

  // X mark
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(BUTTON_LINE_WIDTH_MIN, zoom * BUTTON_LINE_WIDTH_ZOOM_FACTOR)
  ctx.lineCap = 'round'
  const xSize = radius * BUTTON_ICON_SIZE_FACTOR
  ctx.beginPath()
  ctx.moveTo(cx - xSize, cy - xSize)
  ctx.lineTo(cx + xSize, cy + xSize)
  ctx.moveTo(cx + xSize, cy - xSize)
  ctx.lineTo(cx - xSize, cy + xSize)
  ctx.stroke()
  ctx.restore()

  return { cx, cy, radius }
}

export function renderRotateButton(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  _w: number,
  _h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): RotateButtonBounds {
  const s = TILE_SIZE * zoom
  // Position to the left of the delete button (which is at top-right corner)
  const radius = Math.max(BUTTON_MIN_RADIUS, zoom * BUTTON_RADIUS_ZOOM_FACTOR)
  const cx = offsetX + col * s - 1
  const cy = offsetY + row * s - 1

  // Circle background
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = ROTATE_BUTTON_BG
  ctx.fill()

  // Circular arrow icon
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(BUTTON_LINE_WIDTH_MIN, zoom * BUTTON_LINE_WIDTH_ZOOM_FACTOR)
  ctx.lineCap = 'round'
  const arcR = radius * BUTTON_ICON_SIZE_FACTOR
  ctx.beginPath()
  // Draw a 270-degree arc
  ctx.arc(cx, cy, arcR, -Math.PI * 0.8, Math.PI * 0.7)
  ctx.stroke()
  // Draw arrowhead at the end of the arc
  const endAngle = Math.PI * 0.7
  const endX = cx + arcR * Math.cos(endAngle)
  const endY = cy + arcR * Math.sin(endAngle)
  const arrowSize = radius * 0.35
  ctx.beginPath()
  ctx.moveTo(endX + arrowSize * 0.6, endY - arrowSize * 0.3)
  ctx.lineTo(endX, endY)
  ctx.lineTo(endX + arrowSize * 0.7, endY + arrowSize * 0.5)
  ctx.stroke()
  ctx.restore()

  return { cx, cy, radius }
}

// ── Speech bubbles ──────────────────────────────────────────────

export function renderBubbles(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const ch of characters) {
    if (!ch.bubbleType) continue

    const sprite = ch.bubbleType === 'permission'
      ? BUBBLE_PERMISSION_SPRITE
      : BUBBLE_WAITING_SPRITE

    // Compute opacity: permission = full, waiting = fade in last 0.5s
    let alpha = 1.0
    if (ch.bubbleType === 'waiting' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
      alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC
    }

    const cached = getCachedSprite(sprite, zoom)
    // Position: centered above the character's head
    // Character is anchored bottom-center at (ch.x, ch.y), sprite is 16x24
    // Place bubble above head with a small gap; follow sitting offset
    const sittingOff = ch.state === CharacterState.TYPE ? BUBBLE_SITTING_OFFSET_PX : 0
    const bubbleX = Math.round(offsetX + ch.x * zoom - cached.width / 2)
    const bubbleY = Math.round(offsetY + (ch.y + sittingOff - BUBBLE_VERTICAL_OFFSET_PX) * zoom - cached.height - 1 * zoom)

    ctx.save()
    if (alpha < 1.0) ctx.globalAlpha = alpha
    ctx.drawImage(cached, bubbleX, bubbleY)
    ctx.restore()
  }
}

export function renderPhotoComments(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const lifetime = 4.0
  const canvasH = ctx.canvas.height / (window.devicePixelRatio || 1)
  for (const ch of characters) {
    if (ch.photoComments.length === 0) continue
    const sittingOff = ch.state === CharacterState.TYPE ? BUBBLE_SITTING_OFFSET_PX : 0
    const anchorX = Math.round(offsetX + ch.x * zoom)
    const anchorY = Math.round(offsetY + (ch.y + sittingOff - BUBBLE_VERTICAL_OFFSET_PX) * zoom)
    const fontSize = Math.max(10, Math.round(4 * zoom))
    const totalFloatDist = anchorY + 20 // distance from character to top of canvas

    ctx.save()
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    for (const pc of ch.photoComments) {
      const progress = pc.age / lifetime
      let alpha = 1.0
      if (pc.age < 0.3) alpha = pc.age / 0.3
      if (progress > 0.6) alpha = (1 - progress) / 0.4
      const floatY = progress * totalFloatDist
      const baseX = anchorX + pc.x * zoom
      const baseY = anchorY - floatY

      ctx.globalAlpha = alpha * 0.95
      const tw = ctx.measureText(pc.text).width
      const px = 4 * (zoom / 3)
      const py = 2 * (zoom / 3)
      const rx = baseX - tw / 2 - px
      const ry = baseY - fontSize - py * 2
      const rw = tw + px * 2
      const rh = fontSize + py * 2
      const cr = 4

      // Background pill
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.beginPath()
      ctx.moveTo(rx + cr, ry)
      ctx.lineTo(rx + rw - cr, ry)
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr)
      ctx.lineTo(rx + rw, ry + rh - cr)
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh)
      ctx.lineTo(rx + cr, ry + rh)
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr)
      ctx.lineTo(rx, ry + cr)
      ctx.quadraticCurveTo(rx, ry, rx + cr, ry)
      ctx.closePath()
      ctx.fill()

      // Text
      ctx.fillStyle = '#FFD700'
      ctx.fillText(pc.text, baseX, baseY - py)
    }
    ctx.restore()
  }
}

export interface ButtonBounds {
  /** Center X in device pixels */
  cx: number
  /** Center Y in device pixels */
  cy: number
  /** Radius in device pixels */
  radius: number
}

export type DeleteButtonBounds = ButtonBounds
export type RotateButtonBounds = ButtonBounds

export interface EditorRenderState {
  showGrid: boolean
  ghostSprite: SpriteData | null
  ghostCol: number
  ghostRow: number
  ghostValid: boolean
  selectedCol: number
  selectedRow: number
  selectedW: number
  selectedH: number
  hasSelection: boolean
  isRotatable: boolean
  /** Updated each frame by renderDeleteButton */
  deleteButtonBounds: DeleteButtonBounds | null
  /** Updated each frame by renderRotateButton */
  rotateButtonBounds: RotateButtonBounds | null
  /** Whether to show ghost border (expansion tiles outside grid) */
  showGhostBorder: boolean
  /** Hovered ghost border tile col (-1 to cols) */
  ghostBorderHoverCol: number
  /** Hovered ghost border tile row (-1 to rows) */
  ghostBorderHoverRow: number
  dragUid: string | null
}

export interface SelectionRenderState {
  selectedAgentId: number | null
  hoveredAgentId: number | null
  hoveredTile: { col: number; row: number } | null
  seats: Map<string, Seat>
  characters: Map<number, Character>
  /** Seat overview mode: highlight every seat's availability */
  showAllSeats?: boolean
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  zoom: number,
  panX: number,
  panY: number,
  selection?: SelectionRenderState,
  editor?: EditorRenderState,
  tileColors?: Array<FloorColor | null>,
  layoutCols?: number,
  layoutRows?: number,
  bugs?: BugEntity[],
  contributions?: ContributionData,
  photograph?: HTMLImageElement,
  gatewayHealthy?: boolean,
  weather: PixelOfficeWeather = 'clear',
  weatherTimeSeconds = 0,
): { offsetX: number; offsetY: number } {
  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  renderWeatherBackdrop(ctx, canvasWidth, canvasHeight, weather, weatherTimeSeconds)
  renderWeatherAtmosphere(ctx, canvasWidth, canvasHeight, weather, weatherTimeSeconds)

  // Use layout dimensions (fallback to tileMap size)
  const cols = layoutCols ?? (tileMap.length > 0 ? tileMap[0].length : 0)
  const rows = layoutRows ?? tileMap.length

  // Center map in viewport + pan offset (integer device pixels)
  const mapW = cols * TILE_SIZE * zoom
  const mapH = rows * TILE_SIZE * zoom
  const offsetX = Math.floor((canvasWidth - mapW) / 2) + Math.round(panX)
  const offsetY = Math.floor((canvasHeight - mapH) / 2) + Math.round(panY)

  // Draw tiles (floor + wall base color)
  renderTileGrid(ctx, tileMap, offsetX, offsetY, zoom, tileColors, layoutCols)

  if (bugs && bugs.length > 0) {
    renderBugs(ctx, bugs, offsetX, offsetY, zoom)
  }

  // Seat indicators (below furniture/characters, on top of floor)
  if (selection) {
    if (selection.showAllSeats) {
      renderSeatOverview(ctx, selection.seats, selection.characters, selection.selectedAgentId, offsetX, offsetY, zoom)
    }
    renderSeatIndicators(ctx, selection.seats, selection.characters, selection.selectedAgentId, selection.hoveredTile, offsetX, offsetY, zoom)
  }

  // Build wall instances for z-sorting with furniture and characters
  const wallInstances = hasWallSprites()
    ? getWallInstances(tileMap, tileColors, layoutCols)
    : []
  const allFurniture = wallInstances.length > 0
    ? [...wallInstances, ...furniture]
    : furniture

  // Draw walls + furniture + characters (z-sorted)
  const selectedId = selection?.selectedAgentId ?? null
  const hoveredId = selection?.hoveredAgentId ?? null
  renderScene(ctx, allFurniture, characters, offsetX, offsetY, zoom, selectedId, hoveredId, contributions, photograph, gatewayHealthy, editor?.dragUid ?? null)

  // Speech bubbles (always on top of characters)
  renderBubbles(ctx, characters, offsetX, offsetY, zoom)

  // Editor overlays
  if (editor) {
    if (editor.showGrid) {
      renderGridOverlay(ctx, offsetX, offsetY, zoom, cols, rows, tileMap)
    }
    if (editor.showGhostBorder) {
      renderGhostBorder(ctx, offsetX, offsetY, zoom, cols, rows, editor.ghostBorderHoverCol, editor.ghostBorderHoverRow)
    }
    if (editor.ghostSprite && editor.ghostCol >= 0) {
      renderGhostPreview(ctx, editor.ghostSprite, editor.ghostCol, editor.ghostRow, editor.ghostValid, offsetX, offsetY, zoom)
    }
    if (editor.hasSelection) {
      renderSelectionHighlight(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      editor.deleteButtonBounds = renderDeleteButton(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      if (editor.isRotatable) {
        editor.rotateButtonBounds = renderRotateButton(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      } else {
        editor.rotateButtonBounds = null
      }
    } else {
      editor.deleteButtonBounds = null
      editor.rotateButtonBounds = null
    }
  }

  return { offsetX, offsetY }
}
