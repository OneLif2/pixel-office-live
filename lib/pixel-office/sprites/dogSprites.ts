import type { SpriteData } from '../types'
import type { CharacterSprites } from './spriteData'
import { getCatSprites } from './catSprites'

/** Four walk frames per direction, loaded from the dog sheet PNG
 * (92×96: 4 frames × 23px wide, rows down/up/right/left × 24px tall). */
export interface DogSpriteFrames {
  down: [SpriteData, SpriteData, SpriteData, SpriteData]
  up: [SpriteData, SpriteData, SpriteData, SpriteData]
  right: [SpriteData, SpriteData, SpriteData, SpriteData]
  left: [SpriteData, SpriteData, SpriteData, SpriteData]
}

let loadedDogFrames: DogSpriteFrames | null = null
let cachedSprites: CharacterSprites | null = null

/** Register dog frames loaded from the PNG sheet */
export function registerDogSprites(frames: DogSpriteFrames): void {
  loadedDogFrames = frames
  cachedSprites = null
}

/** Build CharacterSprites for the dog. Walk uses the real 4-frame gait;
 *  typing and reading reuse the standing pose (dogs don't type).
 *  Falls back to the cat sprites until the dog sheet is loaded. */
export function getDogSprites(): CharacterSprites {
  if (!loadedDogFrames) return getCatSprites()
  if (cachedSprites) return cachedSprites

  const { down, up, right, left } = loadedDogFrames
  const idle = (s: SpriteData): [SpriteData, SpriteData] => [s, s]
  cachedSprites = {
    walk: {
      [0]: down,
      [1]: left,
      [2]: right,
      [3]: up,
    },
    typing: {
      [0]: idle(down[1]),
      [1]: idle(left[1]),
      [2]: idle(right[1]),
      [3]: idle(up[1]),
    },
    reading: {
      [0]: idle(down[1]),
      [1]: idle(left[1]),
      [2]: idle(right[1]),
      [3]: idle(up[1]),
    },
  }
  return cachedSprites
}
