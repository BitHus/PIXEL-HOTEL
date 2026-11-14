// Pure helpers for the atmosphere step (lighting, shadows, dust, idle shifting). No Pixi and no
// game rules: only numbers for drawing. Time comes in as a parameter.

import {
  DUST_MAX,
  DUST_PER_LIGHT,
  FLICKER_BRIGHTNESS,
  FLICKER_RADIUS,
  IDLE_SHIFT_EVERY_MS,
  IDLE_SHIFT_HOLD_MS,
  LIGHT_STEP_MS,
  footprintSize,
  type FurnitureItem,
  type FurnitureType,
  type LightSource,
  type Point,
} from '@pixel-hotel/shared';

/** A light pool in the room: where, what, and a seed so every flame flickers on its own. */
export interface RoomLight {
  x: number;
  y: number;
  light: LightSource;
  seed: number;
}

/** A fixed pseudo-random number in [0, 1) from two integers (no state, the same every time). */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toNumber(r: number, g: number, b: number): number {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** The colour the room is multiplied with: white moved toward `hex` by strength (0 = white). */
export function ambientColor(hex: string, strength: number): number {
  const s = Math.max(0, Math.min(1, strength));
  const [r, g, b] = parse(hex);
  return toNumber(255 + (r - 255) * s, 255 + (g - 255) * s, 255 + (b - 255) * s);
}

/** A colour made darker (factor 0..1), as a number for Pixi. */
export function scaleColor(hex: string, factor: number): number {
  const [r, g, b] = parse(hex);
  return toNumber(r * factor, g * factor, b * factor);
}

/** The radii of a pool's stepped rings, largest first; every ring adds the same bit of light. */
export function lightRings(radius: number, rings: number): number[] {
  const n = Math.max(1, Math.floor(rings));
  return Array.from({ length: n }, (_, i) => Math.round((radius * (n - i)) / n));
}

/**
 * A flame's flicker at a time: multipliers for the radius and the brightness, both <= 1. It
 * changes in steps of LIGHT_STEP_MS, and amount 0 is a steady light.
 */
export function flickerAt(seed: number, timeMs: number, amount: number): { radius: number; brightness: number } {
  const step = Math.floor(timeMs / LIGHT_STEP_MS);
  const a = Math.max(0, Math.min(1, amount));
  // Mostly calm, with a stronger dip now and then.
  const dip = hash01(seed, step) ** 2;
  const sway = hash01(seed + 7919, Math.floor(step / 3));
  return { radius: 1 - a * FLICKER_RADIUS * sway, brightness: 1 - a * FLICKER_BRIGHTNESS * dip };
}

/** Where an item's light pool is centred: the middle of a floor item, halfway up a wall item. */
export function lightPoint(item: Pick<FurnitureItem, 'x' | 'y' | 'facing'>, type: FurnitureType): Point {
  if (type.wall) return { x: item.x, y: item.y - Math.round(type.height / 2) };
  return { x: item.x, y: item.y - Math.round(footprintSize(type, item.facing).d / 2) };
}

/** The lights of the placed items that have one. */
export function itemLights(items: readonly FurnitureItem[], roomId: number, typeOf: (id: string) => FurnitureType, hidden: ReadonlySet<number> = new Set()): RoomLight[] {
  const out: RoomLight[] = [];
  for (const item of items) {
    if (item.roomId !== roomId || hidden.has(item.uid)) continue;
    const type = typeOf(item.typeId);
    if (type.light) out.push({ ...lightPoint(item, type), light: type.light, seed: item.uid });
  }
  return out;
}

/** One row of a pixel ellipse: at dy from the middle it runs from -half to +half. */
export interface EllipseRow {
  dy: number;
  half: number;
}

/** A pixel ellipse as whole rows (no smooth edge): rx wide and ry tall on each side of the middle. */
export function ellipseRows(rx: number, ry: number): EllipseRow[] {
  const rows: EllipseRow[] = [];
  const h = Math.max(1, Math.round(ry));
  for (let dy = -h + 1; dy <= h - 1; dy++) {
    const k = 1 - (dy * dy) / (h * h);
    rows.push({ dy, half: Math.max(1, Math.round(rx * Math.sqrt(k))) });
  }
  return rows;
}

/** The shadow under a floor item with this footprint: half width and half height of the ellipse. */
export function shadowSize(fw: number, fd: number): { rx: number; ry: number } {
  return { rx: Math.round(fw / 2) + 3, ry: Math.max(3, Math.min(6, Math.round(fd / 8) + 2)) };
}

/** A standing customer's small shift: -1, 0 or 1 px sideways, a short moment every few seconds. */
export function idleShift(id: number, timeMs: number): -1 | 0 | 1 {
  const offset = hash01(id, 1) * IDLE_SHIFT_EVERY_MS;
  const t = timeMs + offset;
  const turn = Math.floor(t / IDLE_SHIFT_EVERY_MS);
  if (t - turn * IDLE_SHIFT_EVERY_MS >= IDLE_SHIFT_HOLD_MS) return 0;
  return hash01(id, turn + 2) < 0.5 ? -1 : 1;
}

/** How many lights get dust, so the room never has more than DUST_MAX specks. */
export function dustLightCount(lights: number): number {
  return Math.min(lights, Math.floor(DUST_MAX / DUST_PER_LIGHT));
}

/**
 * One dust speck of a light at a time: a slow loop inside the pool, on whole px, and whether it
 * shows bright or faint. The same inputs give the same speck.
 */
export function dustSpeck(light: RoomLight, index: number, timeMs: number): { x: number; y: number; bright: boolean } {
  const p1 = hash01(light.seed, index * 3 + 11) * Math.PI * 2;
  const p2 = hash01(light.seed, index * 3 + 12) * Math.PI * 2;
  const speed = 0.00012 + hash01(light.seed, index * 3 + 13) * 0.00014;
  const reach = light.light.radius * (0.25 + 0.4 * hash01(light.seed, index + 40));
  const x = light.x + Math.cos(timeMs * speed + p1) * reach;
  const y = light.y - 18 + Math.sin(timeMs * speed * 0.7 + p2) * reach * 0.55;
  return { x: Math.round(x), y: Math.round(y), bright: Math.sin(timeMs * speed * 5 + p1) > 0 };
}
