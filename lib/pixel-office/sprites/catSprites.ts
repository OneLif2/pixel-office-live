import type { SpriteData } from '../types'
import type { CharacterSprites } from './spriteData'

// Simple 16x16 orange pixel cat (padded to 16x24 with transparency on top)
const _ = ''
const O = '#e8943a' // orange body
const D = '#c47020' // dark orange (stripes/ears)
const W = '#ffffff' // white (chest/paws)
const E = '#2d2d2d' // eyes
const N = '#ffb0b0' // nose/pink
const T = '#c47020' // tail

// Cat facing down — standing
const CAT_DOWN_1: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,D,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,D,O,D,_,D,O,D,_,_,_,_,_],
  [_,_,_,_,D,O,O,O,O,O,D,_,_,_,_,_],
  [_,_,_,_,O,E,O,N,O,E,O,_,_,_,_,_],
  [_,_,_,_,O,O,W,W,W,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,W,_,W,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,_,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,W,_,_,_,W,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Cat facing down — walk frame (legs apart)
const CAT_DOWN_2: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,D,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,D,O,D,_,D,O,D,_,_,_,_,_],
  [_,_,_,_,D,O,O,O,O,O,D,_,_,_,_,_],
  [_,_,_,_,O,E,O,N,O,E,O,_,_,_,_,_],
  [_,_,_,_,O,O,W,W,W,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,W,_,W,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,O,_,O,O,_,_,_,_,_,_],
  [_,_,_,_,O,_,_,_,_,_,O,_,_,_,_,_],
  [_,_,_,_,W,_,_,_,_,_,W,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Cat facing right — standing
const CAT_RIGHT_1: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,D,O,D,_,_,_,_,_],
  [_,_,T,T,O,O,O,O,O,E,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,N,_,_,_,_,_],
  [_,_,_,_,_,O,O,W,W,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,_,O,_,O,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,O,_,O,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,O,_,O,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,W,_,W,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Cat facing right — walk frame
const CAT_RIGHT_2: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,D,O,D,_,_,_,_,_],
  [_,_,T,T,O,O,O,O,O,E,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,N,_,_,_,_,_],
  [_,_,_,_,_,O,O,W,W,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,_,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,_,_,O,_,_,_,_,_,_],
  [_,_,_,_,O,_,_,_,_,_,O,_,_,_,_,_],
  [_,_,_,_,W,_,_,_,_,_,W,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Cat facing up — standing
const CAT_UP_1: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,D,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,D,O,D,_,D,O,D,_,_,_,_,_],
  [_,_,_,_,D,O,O,O,O,O,D,_,_,_,_,_],
  [_,_,_,_,O,O,O,O,O,O,O,_,_,_,_,_],
  [_,_,_,_,O,O,O,O,O,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,T,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,T,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,T,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,W,_,_,_,W,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Cat facing up — walk frame (legs apart)
const CAT_UP_2: SpriteData = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,D,_,_,_,D,_,_,_,_,_,_],
  [_,_,_,_,D,O,D,_,D,O,D,_,_,_,_,_],
  [_,_,_,_,D,O,O,O,O,O,D,_,_,_,_,_],
  [_,_,_,_,O,O,O,O,O,O,O,_,_,_,_,_],
  [_,_,_,_,O,O,O,O,O,O,O,_,_,_,_,_],
  [_,_,_,_,_,O,O,O,O,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,T,_,O,_,_,_,_,_,_],
  [_,_,_,_,_,O,_,T,_,O,_,_,_,_,_,_],
  [_,_,_,_,O,_,_,T,_,_,O,_,_,_,_,_],
  [_,_,_,_,W,_,_,_,_,_,W,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

/** Flip a sprite horizontally to generate left-facing from right-facing */
function flipH(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse())
}

const CAT_LEFT_1 = flipH(CAT_RIGHT_1)
const CAT_LEFT_2 = flipH(CAT_RIGHT_2)

/** Two animation frames per direction, loaded from a cat skin PNG sheet
 * (32×72: 2 frames × 16px wide, rows down/up/right × 24px tall). */
export interface CatSkinFrames {
  down: [SpriteData, SpriteData]
  up: [SpriteData, SpriteData]
  right: [SpriteData, SpriteData]
}

let loadedCatSkins: CatSkinFrames[] = []
let selectedCatSkin = 0
const skinSpritesCache = new Map<number, CharacterSprites>()

/** Register cat skins loaded from PNG resources (replaces built-in art) */
export function registerCatSkins(skins: CatSkinFrames[]): void {
  loadedCatSkins = skins
  skinSpritesCache.clear()
}

export function getCatSkinCount(): number {
  return loadedCatSkins.length
}

export function getSelectedCatSkin(): number {
  return selectedCatSkin
}

export function setSelectedCatSkin(index: number): void {
  selectedCatSkin = index
}

function buildCatSprites(
  down1: SpriteData, down2: SpriteData,
  up1: SpriteData, up2: SpriteData,
  right1: SpriteData, right2: SpriteData,
): CharacterSprites {
  const left1 = flipH(right1)
  const left2 = flipH(right2)
  const walk = (s1: SpriteData, s2: SpriteData): [SpriteData, SpriteData, SpriteData, SpriteData] =>
    [s1, s2, s1, s2]
  const idle = (s: SpriteData): [SpriteData, SpriteData] => [s, s]

  return {
    walk: {
      [0]: walk(down1, down2),
      [1]: walk(left1, left2),
      [2]: walk(right1, right2),
      [3]: walk(up1, up2),
    },
    typing: {
      [0]: idle(down1),
      [1]: idle(left1),
      [2]: idle(right1),
      [3]: idle(up1),
    },
    reading: {
      [0]: idle(down1),
      [1]: idle(left1),
      [2]: idle(right1),
      [3]: idle(up1),
    },
  }
}

/** Build CharacterSprites for the cat. Uses the selected PNG skin when loaded,
 *  falling back to the built-in art. Walk uses 4 frames (stand/walk alternating).
 *  Typing and reading reuse standing pose (cats don't type). */
export function getCatSprites(skinIndex = selectedCatSkin): CharacterSprites {
  const skin = loadedCatSkins[skinIndex] ?? loadedCatSkins[0]
  if (skin) {
    const cacheKey = loadedCatSkins.indexOf(skin)
    let sprites = skinSpritesCache.get(cacheKey)
    if (!sprites) {
      sprites = buildCatSprites(skin.down[0], skin.down[1], skin.up[0], skin.up[1], skin.right[0], skin.right[1])
      skinSpritesCache.set(cacheKey, sprites)
    }
    return sprites
  }
  return buildCatSprites(CAT_DOWN_1, CAT_DOWN_2, CAT_UP_1, CAT_UP_2, CAT_RIGHT_1, CAT_RIGHT_2)
}
