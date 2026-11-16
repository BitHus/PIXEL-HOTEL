// Crypt light layer, pure part (outdoors rework C14): stepped radii, flicker, the list of light sources,
// the vignette steps and the frame-rate guard. No Pixi here; dungeonLight.ts draws it.

import {
  DUNGEON_BLOCK,
  LIGHT_CHEST_ALPHA,
  LIGHT_CHEST_PX,
  LIGHT_CROWN_ALPHA,
  LIGHT_CROWN_PX,
  LIGHT_EXIT_ALPHA,
  LIGHT_EXIT_PX,
  LIGHT_GOLD_CHEST_PX,
  LIGHT_MIN_FPS,
  LIGHT_PERF_FRAMES,
  LIGHT_TORCH_ALPHA,
  LIGHT_TORCH_PX,
  type Chest,
  type DungeonMap,
  type Enemy,
  type RunPlace,
} from '@pixel-hotel/shared';
import { hash01 } from '../fx/shake.ts';
import { wallTorchSpots } from './dungeonArt.ts';
import { decorLights } from './decor.ts';

export type LightKind = 'torch' | 'lantern' | 'exit' | 'chest' | 'gold_chest' | 'crown' | 'decor';

export interface LightSource {
  kind: LightKind;
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** Seeds the flicker so pools do not pulse together. */
  seed: number;
  /** Own tint (props: the glow colour from propArt); else the colour of the kind. */
  color?: string;
}

/** A radius rounded down to a whole number of steps (at least one step). */
export function stepRadius(radius: number, step: number): number {
  return Math.max(step, Math.floor(radius / step) * step);
}

/** The flickering radius: base plus a whole-step shift of up to +-amp, re-rolled every everyMs. Deterministic from the clock. */
export function flickerRadius(base: number, clockMs: number, seed: number, amp: number, everyMs: number, step: number): number {
  const n = Math.floor(Math.max(0, clockMs) / Math.max(1, everyMs));
  const shift = (hash01(seed, n) * 2 - 1) * amp;
  return stepRadius(base + Math.round(shift / step) * step, step);
}

/** The discs of one pool, biggest first: radii step down evenly, every disc adds `alpha` (additive blending), so the middle is brightest. */
export function lightRings(radius: number, rings: number, alpha: number, step: number): { r: number; alpha: number }[] {
  const out: { r: number; alpha: number }[] = [];
  for (let k = 0; k < rings; k++) out.push({ r: stepRadius((radius * (rings - k)) / rings, step), alpha });
  return out;
}

/** Mine lanterns: the same blocks drawBlocks puts a lantern on (a wall block with floor below). */
export function mineLanternSpots(map: DungeonMap): { x: number; y: number }[] {
  const B = DUNGEON_BLOCK;
  const out: { x: number; y: number }[] = [];
  const floor = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.blocks[r * map.cols + c] === 'floor' || !floor(c, r + 1) || (c * 7 + r * 3) % 9 !== 0) continue;
      out.push({ x: c * B + B / 2, y: r * B + B - 14 - 2 });
    }
  }
  return out;
}

/** The lights that never move on a floor: wall torches (crypt) or lanterns (mine), the exit and the glowing props (DG2). Stable per map. */
export function staticLights(map: DungeonMap, place: RunPlace): LightSource[] {
  const out: LightSource[] = [];
  const B = DUNGEON_BLOCK;
  const spots = place === 'mine' ? mineLanternSpots(map) : wallTorchSpots(map, place);
  for (const s of spots) {
    out.push({ kind: place === 'mine' ? 'lantern' : 'torch', x: s.x, y: s.y, radius: LIGHT_TORCH_PX, alpha: LIGHT_TORCH_ALPHA, seed: (s.x * 31 + s.y) | 0 });
  }
  if (map.exit.c >= 0) {
    out.push({ kind: 'exit', x: (map.exit.c + 0.5) * B, y: (map.exit.r + 0.5) * B, radius: LIGHT_EXIT_PX, alpha: LIGHT_EXIT_ALPHA, seed: map.exit.c * 97 + map.exit.r });
  }
  out.push(...decorLights(map));
  return out;
}

/** Lights that depend on the run: closed chests (golden ones glow wider) and the living Bone King crown. */
export function dynamicLights(chests: readonly Chest[], enemies: readonly Enemy[]): LightSource[] {
  const out: LightSource[] = [];
  for (const c of chests) {
    if (c.opened) continue;
    const gold = c.kind === 'golden' && !c.mimic;
    out.push({ kind: gold ? 'gold_chest' : 'chest', x: c.x, y: c.y - 12, radius: gold ? LIGHT_GOLD_CHEST_PX : LIGHT_CHEST_PX, alpha: LIGHT_CHEST_ALPHA, seed: c.id * 13 + 5 });
  }
  for (const e of enemies) {
    if (e.kind === 'bone_king') out.push({ kind: 'crown', x: e.x, y: e.y - 56, radius: LIGHT_CROWN_PX, alpha: LIGHT_CROWN_ALPHA, seed: e.id * 7 + 1 });
  }
  return out;
}

/** The darkness of a vignette step from the middle (0) to the corner (1): 0 inside `start`, then `steps` equal steps up to `maxAlpha`. */
export function vignetteAlpha(dist01: number, start: number, steps: number, maxAlpha: number): number {
  if (dist01 <= start) return 0;
  const k = Math.min(steps, Math.ceil(((dist01 - start) / (1 - start)) * steps));
  return (k / steps) * maxAlpha;
}

/** Keeps a running frame time; `failed` turns true (for good) when the average over a full window is below minFps. */
export class LightPerf {
  private sum = 0;
  private n = 0;
  failed = false;

  constructor(private readonly minFps = LIGHT_MIN_FPS, private readonly window = LIGHT_PERF_FRAMES) {}

  /** Feed the real frame time in ms (a single frame counts at most 100 ms, so a tab-away gap does not decide). */
  feed(dtMs: number): void {
    if (this.failed || dtMs <= 0) return;
    this.sum += Math.min(100, dtMs);
    this.n++;
    if (this.n >= this.window) {
      if (1000 / (this.sum / this.n) < this.minFps) this.failed = true;
      this.sum = 0;
      this.n = 0;
    }
  }
}
