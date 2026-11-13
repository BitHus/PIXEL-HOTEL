// A small seeded random number source (mulberry32) for tests and tools. The rules never make
// their own randomness: an Rng is always passed in.

import type { Rng } from './types.ts';

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [min, max]. */
export function rngInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty list. */
export function rngPick<T>(rng: Rng, list: readonly T[]): T {
  const v = list[Math.floor(rng() * list.length)] ?? list[0];
  if (v === undefined) throw new Error('rngPick: empty list');
  return v;
}
