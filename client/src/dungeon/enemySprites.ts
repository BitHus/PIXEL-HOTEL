// MOBS (artist): the PNG idle strips of the enemies. Files: client/src/assets/sprites/actors/<kind>_idle.png, a horizontal row of
// 32 x 32 frames (slime, bat, mimic: 2 frames; art-src/aseprite/mob_<kind>.aseprite). Skeleton and Bone King have no PNG yet (code art).
// The dungeon view may ask enemyIdleFrame(kind, mimic, clockMs): a Texture to put in a Sprite (anchor 0.5, 1; the feet / bottom middle of the
// 32 px frame), or null = keep drawEnemy (the code art). The white hit flash stays code (a Sprite with tint 0xffffff and a white filter, or drawEnemy(.., true)).
import type { Texture } from 'pixi.js';
import { spriteFrames } from '../render/spriteStore.ts';

export const ENEMY_STRIP_FRAME = 32;
/** Idle frame time per kind, ms (slime breathes slowly, the bat flaps fast, the mimic's mouth gapes slowly). */
export const ENEMY_IDLE_MS: Record<string, number> = { slime: 420, bat: 160, mimic: 500, rock_beetle: 380 };

export function enemyIdleFrames(kind: string, mimic: boolean): Texture[] | null {
  const id = mimic ? 'mimic' : kind;
  if (!(id in ENEMY_IDLE_MS)) return null;
  return spriteFrames('actors', id, 'idle', ENEMY_STRIP_FRAME);
}

export function enemyIdleFrame(kind: string, mimic: boolean, clockMs: number, phase = 0): Texture | null {
  const frames = enemyIdleFrames(kind, mimic);
  if (!frames || frames.length === 0) return null;
  const ms = ENEMY_IDLE_MS[mimic ? 'mimic' : kind]!;
  return frames[(Math.floor(Math.max(0, clockMs) / ms) + phase) % frames.length]!;
}
