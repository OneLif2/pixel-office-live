import { ASSET_BASE } from '../../asset-base'
import type { SpriteData } from '../types'
import { registerCatSkins } from './catSprites'
import type { CatSkinFrames } from './catSprites'
import { registerDogSprites } from './dogSprites'
import { setCharacterTemplates } from './spriteData'
import type { LoadedCharacterData } from './spriteData'
import { setWallSprites } from '../wallTiles'
import { setFloorSprites } from '../floorTiles'
import { buildDynamicCatalog } from '../layout/furnitureCatalog'
import type { LoadedAssetData } from '../layout/furnitureCatalog'

const HOOTBU_ASSET_BASE = ASSET_BASE + '/assets/pixel-office/hootbu'
const HOOTBU_FURNITURE_BASE = `${HOOTBU_ASSET_BASE}/furniture`

type HootbuFurnitureAsset = {
  id?: unknown
  name?: unknown
  label?: unknown
  category?: unknown
  file?: unknown
  width?: unknown
  height?: unknown
  footprintW?: unknown
  footprintH?: unknown
  isDesk?: unknown
  groupId?: unknown
  orientation?: unknown
  state?: unknown
  canPlaceOnSurfaces?: unknown
  backgroundTiles?: unknown
  canPlaceOnWalls?: unknown
}

type NormalizedHootbuFurnitureAsset = {
  asset: LoadedAssetData['catalog'][number]
  file: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getFurnitureAssetsFromCatalog(raw: unknown): HootbuFurnitureAsset[] {
  if (Array.isArray(raw)) return raw as HootbuFurnitureAsset[]
  if (!isObject(raw)) return []
  const assets = raw.assets ?? raw.catalog
  return Array.isArray(assets) ? assets as HootbuFurnitureAsset[] : []
}

function normalizeFurnitureAsset(raw: HootbuFurnitureAsset): LoadedAssetData['catalog'][number] | null {
  if (typeof raw.id !== 'string' || typeof raw.file !== 'string') return null

  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : typeof raw.name === 'string' ? raw.name : raw.id,
    category: typeof raw.category === 'string' ? raw.category : 'decor',
    width: typeof raw.width === 'number' ? raw.width : 16,
    height: typeof raw.height === 'number' ? raw.height : 16,
    footprintW: typeof raw.footprintW === 'number' ? raw.footprintW : 1,
    footprintH: typeof raw.footprintH === 'number' ? raw.footprintH : 1,
    isDesk: raw.isDesk === true,
    ...(typeof raw.groupId === 'string' ? { groupId: raw.groupId } : {}),
    ...(typeof raw.orientation === 'string' ? { orientation: raw.orientation } : {}),
    ...(typeof raw.state === 'string' ? { state: raw.state } : {}),
    ...(raw.canPlaceOnSurfaces === true ? { canPlaceOnSurfaces: true } : {}),
    ...(typeof raw.backgroundTiles === 'number' ? { backgroundTiles: raw.backgroundTiles } : {}),
    ...(raw.canPlaceOnWalls === true ? { canPlaceOnWalls: true } : {}),
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await mapper(items[currentIndex])
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * Load a PNG image and convert it to SpriteData (2D array of hex color strings).
 * Transparent pixels become '' (empty string).
 */
function canvasToSpriteData(canvas: HTMLCanvasElement): SpriteData {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData

  const result: string[][] = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 128) {
        row.push('')
      } else {
        row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase())
      }
    }
    result.push(row)
  }
  return result
}

function pngToSpriteData(img: HTMLImageElement): SpriteData {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvasToSpriteData(canvas)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function normalizedSpriteData(img: HTMLImageElement, targetWidth?: number, targetHeight?: number): SpriteData {
  const canvas = document.createElement('canvas')
  const shouldResize =
    typeof targetWidth === 'number' &&
    typeof targetHeight === 'number' &&
    img.width !== targetWidth &&
    img.height !== targetHeight &&
    img.width % targetWidth === 0 &&
    img.height % targetHeight === 0

  if (shouldResize) {
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    return canvasToSpriteData(canvas)
  }

  return pngToSpriteData(img)
}

function stripOpaqueSheetBackground(sprite: SpriteData): SpriteData {
  if (sprite.length === 0 || sprite[0].length === 0) return sprite
  if (sprite.some((row) => row.some((pixel) => pixel === ''))) return sprite

  const height = sprite.length
  const width = sprite[0].length
  const result = sprite.map((row) => [...row])
  const visited = Array.from({ length: height }, () => Array(width).fill(false))
  const queue: Array<[number, number]> = []

  const brightness = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return 0.299 * r + 0.587 * g + 0.114 * b
  }

  const corners = [sprite[0][0], sprite[0][width - 1], sprite[height - 1][0], sprite[height - 1][width - 1]]
  const threshold = Math.max(140, Math.min(...corners.map((pixel) => brightness(pixel))) - 12)

  const enqueue = (x: number, y: number) => {
    if (visited[y][x]) return
    if (brightness(result[y][x]) < threshold) return
    visited[y][x] = true
    queue.push([x, y])
  }

  for (let x = 0; x < width; x++) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift()!
    result[y][x] = ''
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }

  return result
}

/**
 * Extract a sub-region from a SpriteData array.
 */
function extractRegion(sprite: SpriteData, x: number, y: number, w: number, h: number): SpriteData {
  const result: string[][] = []
  for (let row = y; row < y + h; row++) {
    result.push(sprite[row].slice(x, x + w))
  }
  return result
}

/**
 * Parse a character PNG (112×96) into LoadedCharacterData.
 * Layout: 7 frames × 16px wide, 3 direction rows × 32px tall (24px sprite + 8px top padding).
 * Row 0 = down, Row 1 = up, Row 2 = right.
 * Frame order: walk1, walk2, walk3, type1, type2, read1, read2.
 */
function parseCharacterSheet(sheet: SpriteData): LoadedCharacterData {
  const FRAME_W = 16
  const FRAME_H = 32
  const extract = (frame: number, dirRow: number) =>
    extractRegion(sheet, frame * FRAME_W, dirRow * FRAME_H, FRAME_W, FRAME_H)

  return {
    down: [extract(0, 0), extract(1, 0), extract(2, 0), extract(3, 0), extract(4, 0), extract(5, 0), extract(6, 0)],
    up: [extract(0, 1), extract(1, 1), extract(2, 1), extract(3, 1), extract(4, 1), extract(5, 1), extract(6, 1)],
    right: [extract(0, 2), extract(1, 2), extract(2, 2), extract(3, 2), extract(4, 2), extract(5, 2), extract(6, 2)],
  }
}

/**
 * Load character PNGs from /assets/pixel-office/characters/ and register them.
 * Loads the default set plus any extra contiguous char_N.png files.
 * Falls back silently to hardcoded templates if the base set fails.
 */
export async function loadCharacterPNGs(): Promise<boolean> {
  try {
    const characters: LoadedCharacterData[] = []
    const baseCharacterCount = 6
    const maxCharacterCount = 64
    const CHARACTER_SHEET_WIDTH = 112
    const CHARACTER_SHEET_HEIGHT = 96

    for (let i = 0; i < baseCharacterCount; i++) {
      const img = await loadImage(`/assets/pixel-office/characters/char_${i}.png`)
      const sheet = stripOpaqueSheetBackground(normalizedSpriteData(img, CHARACTER_SHEET_WIDTH, CHARACTER_SHEET_HEIGHT))
      characters.push(parseCharacterSheet(sheet))
    }

    for (let i = baseCharacterCount; i < maxCharacterCount; i++) {
      try {
        const img = await loadImage(`/assets/pixel-office/characters/char_${i}.png`)
        const sheet = stripOpaqueSheetBackground(normalizedSpriteData(img, CHARACTER_SHEET_WIDTH, CHARACTER_SHEET_HEIGHT))
        characters.push(parseCharacterSheet(sheet))
      } catch {
        break
      }
    }

    setCharacterTemplates(characters)
    return true
  } catch (e) {
    console.warn('Failed to load character PNGs, using fallback templates:', e)
    return false
  }
}

const CAT_SHEET_WIDTH = 32
const CAT_SHEET_HEIGHT = 72
const CAT_FRAME_W = 16
const CAT_FRAME_H = 24
const MAX_CAT_SKINS = 16

/** Cut one 16×24 frame out of a cat sheet (row: 0=down, 1=up, 2=right) */
function catSheetFrame(sheet: SpriteData, row: number, col: number): SpriteData {
  const frame: SpriteData = []
  for (let y = 0; y < CAT_FRAME_H; y++) {
    frame.push((sheet[row * CAT_FRAME_H + y] ?? []).slice(col * CAT_FRAME_W, (col + 1) * CAT_FRAME_W))
  }
  return frame
}

/**
 * Load cat skin sheets from /assets/pixel-office/pets/cat_<n>.png.
 * Sheet format: 32×72 — 2 frames × 16px wide, 3 direction rows (down/up/right) × 24px tall.
 * cat_0.png is the default (Pixel Agents cat); users can add cat_2.png, cat_3.png, …
 * or replace the files to change the skin.
 */
export async function loadCatSkinPNGs(): Promise<boolean> {
  try {
    const skins: CatSkinFrames[] = []
    for (let i = 0; i < MAX_CAT_SKINS; i++) {
      try {
        const img = await loadImage(`/assets/pixel-office/pets/cat_${i}.png`)
        const sheet = normalizedSpriteData(img, CAT_SHEET_WIDTH, CAT_SHEET_HEIGHT)
        skins.push({
          down: [catSheetFrame(sheet, 0, 0), catSheetFrame(sheet, 0, 1)],
          up: [catSheetFrame(sheet, 1, 0), catSheetFrame(sheet, 1, 1)],
          right: [catSheetFrame(sheet, 2, 0), catSheetFrame(sheet, 2, 1)],
        })
      } catch {
        break
      }
    }
    if (skins.length === 0) return false
    registerCatSkins(skins)
    return true
  } catch (e) {
    console.warn('Failed to load cat skin PNGs, using built-in cat art:', e)
    return false
  }
}

const DOG_SHEET_WIDTH = 92
const DOG_SHEET_HEIGHT = 96
const DOG_FRAME_W = 23
const DOG_FRAME_H = 24

/** Cut one 23×24 frame out of the dog sheet (row: 0=down, 1=up, 2=right, 3=left) */
function dogSheetFrame(sheet: SpriteData, row: number, col: number): SpriteData {
  const frame: SpriteData = []
  for (let y = 0; y < DOG_FRAME_H; y++) {
    frame.push((sheet[row * DOG_FRAME_H + y] ?? []).slice(col * DOG_FRAME_W, (col + 1) * DOG_FRAME_W))
  }
  return frame
}

/**
 * Load the dog sprite sheet from /assets/pixel-office/pets/dog_0.png.
 * Sheet format: 92×96 — 4 frames × 23px wide, 4 direction rows
 * (down/up/right/left) × 24px tall. Left has its own art (not mirrored).
 */
export async function loadDogSpritePNG(): Promise<boolean> {
  try {
    const img = await loadImage(ASSET_BASE + '/assets/pixel-office/pets/dog_0.png')
    const sheet = normalizedSpriteData(img, DOG_SHEET_WIDTH, DOG_SHEET_HEIGHT)
    const dirRow = (row: number): [SpriteData, SpriteData, SpriteData, SpriteData] =>
      [dogSheetFrame(sheet, row, 0), dogSheetFrame(sheet, row, 1), dogSheetFrame(sheet, row, 2), dogSheetFrame(sheet, row, 3)]
    registerDogSprites({
      down: dirRow(0),
      up: dirRow(1),
      right: dirRow(2),
      left: dirRow(3),
    })
    return true
  } catch (e) {
    console.warn('Failed to load dog sprite PNG, dog pets fall back to cat art:', e)
    return false
  }
}

/**
 * Load walls.png (64×128, 4×4 grid of 16×32 pieces) and register wall sprites.
 * 16 auto-tile sprites indexed by bitmask (N=1, E=2, S=4, W=8).
 * Grid layout: left-to-right, top-to-bottom → bitmask 0,1,2,...,15.
 */
export async function loadWallPNG(): Promise<boolean> {
  try {
    const img = await loadImage(ASSET_BASE + '/assets/pixel-office/walls.png')
    const sheet = pngToSpriteData(img)
    const PIECE_W = 16
    const PIECE_H = 32
    const COLS = 4
    const sprites: SpriteData[] = []
    for (let i = 0; i < 16; i++) {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      sprites.push(extractRegion(sheet, col * PIECE_W, row * PIECE_H, PIECE_W, PIECE_H))
    }
    setWallSprites(sprites)
    return true
  } catch (e) {
    console.warn('Failed to load walls.png, using fallback solid walls:', e)
    return false
  }
}

/**
 * Load Hootbu floor patterns from floors.png and register them.
 * The sheet is 7 floor patterns in one 112x16 horizontal strip.
 */
export async function loadFloorPNG(): Promise<boolean> {
  try {
    const img = await loadImage(`${HOOTBU_ASSET_BASE}/floors.png`)
    const sheet = pngToSpriteData(img)
    const PIECE_W = 16
    const PIECE_H = 16
    const sprites: SpriteData[] = []
    for (let i = 0; i < 7; i++) {
      sprites.push(extractRegion(sheet, i * PIECE_W, 0, PIECE_W, PIECE_H))
    }
    setFloorSprites(sprites)
    return true
  } catch (e) {
    console.warn('Failed to load floors.png, using fallback floor tiles:', e)
    return false
  }
}

/**
 * Load Hootbu furniture metadata and PNG sprites from public assets.
 * This registers the existing dynamic furniture catalog used by the editor and renderer.
 */
export async function loadHootbuFurnitureAssets(): Promise<boolean> {
  try {
    const res = await fetch(`${HOOTBU_FURNITURE_BASE}/furniture-catalog.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const rawCatalog = await res.json()
    const rawAssets = getFurnitureAssetsFromCatalog(rawCatalog)
    const normalizedAssets: NormalizedHootbuFurnitureAsset[] = rawAssets
      .map((rawAsset) => {
        const asset = normalizeFurnitureAsset(rawAsset)
        return asset && typeof rawAsset.file === 'string' ? { asset, file: rawAsset.file } : null
      })
      .filter((item): item is NormalizedHootbuFurnitureAsset => item !== null)

    const sprites: LoadedAssetData['sprites'] = {}
    const loadedAssets = await mapWithConcurrency(normalizedAssets, 16, async ({ asset, file }) => {
      try {
        const img = await loadImage(`${HOOTBU_ASSET_BASE}/${file}`)
        return { asset, sprite: normalizedSpriteData(img, asset.width, asset.height) }
      } catch (e) {
        console.warn(`Failed to load furniture asset ${asset.id}:`, e)
        return null
      }
    })

    const catalog: LoadedAssetData['catalog'] = []
    for (const loaded of loadedAssets) {
      if (!loaded) continue
      catalog.push(loaded.asset)
      sprites[loaded.asset.id] = loaded.sprite
    }

    if (catalog.length === 0) return false
    return buildDynamicCatalog({ catalog, sprites })
  } catch (e) {
    console.warn('Failed to load Hootbu furniture assets, using fallback catalog:', e)
    return false
  }
}
