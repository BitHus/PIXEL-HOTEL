// J4 smooth punching (docs/PLAN-OB-REWORK.md 3.1): the FEEL of one pickaxe hit in the dig mine, pure numbers for dungeonScreen to draw.
// A plain hit: a flash with a 1 px squash, 3 to 5 chips flying AWAY from the avatar, a tick whose pitch rises per hit, NO shake (a repeated
// action must not tire the eyes). A break shakes by trauma squared (filler barely, ore 2 px, a rare block 3 px + a 40 ms hit stop).
// Look only: no rule reads this. Numbers in shared/src/config/mine.ts (DIG_*).

import {
  DIG_CHIPS_MAX,
  DIG_CHIPS_MIN,
  DIG_FLASH_MS,
  DIG_HITSTOP_RARE_MS,
  DIG_SHAKE_MAX_PX,
  DIG_SHAKE_MS,
  DIG_TRAUMA,
  digHitProgress,
  type MineBlockType,
} from '@pixel-hotel/shared';
import { hash01 } from '../fx/shake.ts';

export interface DigFx {
  /** Chip particles to throw. */
  chips: number;
  /** 0..1, the tick's pitch: rises with the part of the block dug (1 on the break). */
  pitch: number;
  shakePx: number;
  shakeMs: number;
  hitStopMs: number;
}

/** Screen shake from trauma (0..1): px = max * trauma^2, whole px (small hits barely move). */
export const shakeFromTrauma = (trauma: number, maxPx = DIG_SHAKE_MAX_PX): number => Math.round(maxPx * Math.min(1, Math.max(0, trauma)) ** 2);

/** The feel of one dig event: a hit that left the block (`hits` of the block's total) or the break of a block of this type. */
export function digHitFx(block: Pick<MineBlockType, 'hits' | 'filler' | 'rare' | 'rank' | 'gemRank'>, hits: number, broken: boolean, seed = 0): DigFx {
  const chips = DIG_CHIPS_MIN + Math.floor(hash01(seed, 3) * (DIG_CHIPS_MAX - DIG_CHIPS_MIN + 1));
  if (!broken) return { chips, pitch: digHitProgress(hits, block.hits).frac, shakePx: 0, shakeMs: 0, hitStopMs: 0 };
  const rare = !!block.rare || block.rank === 'ultra_rare' || block.rank === 'legendary';
  const kind = rare ? 'rare' : block.filler ? 'filler' : 'ore';
  const shakePx = shakeFromTrauma(DIG_TRAUMA[kind]);
  return { chips: chips + 3, pitch: 1, shakePx, shakeMs: shakePx > 0 ? DIG_SHAKE_MS[kind] : 0, hitStopMs: rare ? DIG_HITSTOP_RARE_MS : 0 };
}

/** The cave-in's shake (trauma squared, capped like the rest). */
export function caveInShake(): { px: number; ms: number } {
  return { px: shakeFromTrauma(DIG_TRAUMA.cavein), ms: DIG_SHAKE_MS.cavein };
}

/** Chip velocities (px/s) flying AWAY from `from` (the avatar) out of `at` (the block), in a 100 degree cone, a bit upward. Seeded. */
export function chipVelocities(from: { x: number; y: number }, at: { x: number; y: number }, n: number, seed: number): { vx: number; vy: number }[] {
  const base = Math.atan2(at.y - from.y, at.x - from.x);
  const ok = Number.isFinite(base) && (at.x !== from.x || at.y !== from.y);
  const out: { vx: number; vy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (ok ? base : -Math.PI / 2) + (hash01(seed, i * 2) - 0.5) * ((100 * Math.PI) / 180);
    const speed = 60 + hash01(seed, i * 2 + 1) * 70;
    out.push({ vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 25 });
  }
  return out;
}

/** The hit flash on the block over time since the hit: a bright first half (full block), then a dimmer half pressed in by 1 px
 *  (the squash), then nothing. Whole pixels only. */
export function digFlashAt(tMs: number): { alpha: number; inset: number } | null {
  if (tMs < 0 || tMs >= DIG_FLASH_MS) return null;
  return tMs < DIG_FLASH_MS / 2 ? { alpha: 0.45, inset: 0 } : { alpha: 0.2, inset: 1 };
}
