// The look of fishing and chopping (outdoors rework C13): pure helpers, no Pixi. Everything here is cosmetic; the rules stay in shared/src/fishing.ts.

import {
  FISH_BAR,
  FISH_REEL_FULL,
  FX_NIBBLE_CHANCE,
  FX_NIBBLE_EVERY_MS,
  FX_NIBBLE_MS,
  FX_REEL_DRAIN_FRACTION,
  type Point,
} from '@pixel-hotel/shared';
import { easeInQuad, clamp01 } from '../fx/ease.ts';
import { hash01 } from '../fx/shake.ts';
import type { ReelView } from '../ui/fishBar.ts';

export interface ReelFeedback {
  /** The fish is inside the catch box. */
  catching: boolean;
  /** The catch bar is nearly empty and still falling. */
  draining: boolean;
  /** 0 (the fish is in the box) to 1 (far from it): how hard the bobber thrashes. */
  tension: number;
}

/** What the reel looks like from its numbers. `fillTrend` = fill now minus fill a moment ago (positive = rising). */
export function reelFeedback(v: ReelView, fillTrend: number): ReelFeedback {
  const dist = Math.abs(v.fishPos - v.boxPos);
  const half = v.boxSize / 2;
  const catching = dist <= half;
  const draining = v.fill < FISH_REEL_FULL * FX_REEL_DRAIN_FRACTION && fillTrend < 0;
  const tension = catching ? 0 : clamp01((dist - half) / (FISH_BAR / 4));
  return { catching, draining, tension };
}

/** A cosmetic nibble while waiting: 0 (up), 1 or 2 (px the bobber is pulled down). Same clock and seed = same dips. */
export function nibbleDip(clockMs: number, seed: number): number {
  const win = Math.floor(clockMs / FX_NIBBLE_EVERY_MS);
  if (hash01(seed, win * 2) > FX_NIBBLE_CHANCE) return 0;
  const start = hash01(seed, win * 2 + 1) * (FX_NIBBLE_EVERY_MS - FX_NIBBLE_MS);
  const t = clockMs - win * FX_NIBBLE_EVERY_MS - start;
  if (t < 0 || t >= FX_NIBBLE_MS) return 0;
  return t < FX_NIBBLE_MS / 3 || t >= (FX_NIBBLE_MS * 2) / 3 ? 1 : 2;
}

/** A point on an arc from a to b (k 0..1), `height` px above the straight line in the middle. */
export function arcPoint(a: Point, b: Point, k: number, height: number): Point {
  const t = clamp01(k);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 4 * height * t * (1 - t) };
}

/** The reel tick sound steps: how many 10% steps of the catch bar this fill is. A tick plays when this rises. */
export function reelTickStep(fill: number): number {
  return Math.floor(clamp01(fill / FISH_REEL_FULL) * 10);
}

/** The pitch (0 to 1) of a reel tick: the fuller the bar, the higher. */
export function reelTickPitch(fill: number): number {
  return clamp01(fill / FISH_REEL_FULL);
}

/** A tree's fall, k 0..1: it tips over (accelerating), bounces once on landing and fades at the end. */
export function treeFall(k: number): { angle: number; lift: number; alpha: number; landed: boolean } {
  const t = clamp01(k);
  const TIP = 0.7;
  const landed = t >= TIP;
  const angle = 1.3 * easeInQuad(Math.min(1, t / TIP));
  const lift = landed ? Math.round(Math.sin(((t - TIP) / (1 - TIP)) * Math.PI) * 3) : 0;
  const alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
  return { angle, lift, alpha, landed };
}

/** The wind sway of tree `i` in whole px (-max..max), slow, each tree on its own phase. */
export function swayPx(clockMs: number, i: number, max: number): number {
  return Math.round(Math.sin(clockMs / 1400 + i * 1.7) * max);
}

/** Builds the two bobber drawings (floating and pulled under) ONCE; get() never draws again. */
export class BobberSet<T> {
  readonly idle: T;
  readonly dip: T;

  constructor(make: (dip: boolean) => T) {
    this.idle = make(false);
    this.dip = make(true);
  }

  get(dip: boolean): T {
    return dip ? this.dip : this.idle;
  }
}
