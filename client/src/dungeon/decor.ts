// DG2: what the dungeon view does with map.decor (DG1). Pure helpers (aliases, variants, lights, the landmark line)
// plus drawDecorProp, which calls the artist's drawDecor hook (propArt.ts). No game rule here: the layout decides
// where props stand, this only says how they look and which of them glow.

import type { Container } from 'pixi.js';
import { DUNGEON_BLOCK, LIGHT_TORCH_ALPHA, type DecorProp, type DungeonMap } from '@pixel-hotel/shared';
import { drawDecor, propLight, PROP_INFO } from './propArt.ts';
import type { LightSource } from './light.ts';

/** The propArt kind for a generator kind (propArt names them all now: no aliases). */
export function decorKind(kind: string): string {
  return kind;
}

/** Variant of a prop from its cell, stable per floor. */
export function decorVariant(c: number, r: number): number {
  return (Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663)) >>> 0;
}

/** True when the prop hangs over the floor like a decal or is walked over (drawn under avatars and enemies). */
export function decorIsFlat(kind: string): boolean {
  const info = (PROP_INFO as Record<string, { solid: boolean; upright?: boolean } | undefined>)[decorKind(kind)];
  return !info || (!info.solid && !info.upright);
}

/** True when a prop moves with the clock (flames): the view redraws it per flame frame. */
export function decorAnimated(kind: string): boolean {
  return propLight(decorKind(kind))?.flicker === true;
}

/** The static lights of the props: braziers, campfires, candles, the fountain, glowcaps. Positions are world px. */
export function decorLights(map: DungeonMap): LightSource[] {
  const out: LightSource[] = [];
  for (const d of map.decor ?? []) {
    const l = propLight(decorKind(d.kind));
    if (!l) continue;
    out.push({
      kind: 'decor',
      x: (d.c + 0.5) * DUNGEON_BLOCK,
      y: (d.r + 1) * DUNGEON_BLOCK + l.dy,
      radius: l.radius,
      alpha: LIGHT_TORCH_ALPHA,
      seed: d.id * 29 + 3,
      color: l.color,
    });
  }
  return out;
}

const LANDMARK_LINES: Record<string, string> = {
  fountain: 'A dry fountain still glows with a cold light.',
  statue: 'A giant statue stands watch over this floor.',
  brazier_big: 'A great brazier burns here. Someone keeps it lit.',
  pillar_ring: 'A ring of old pillars. Something was kept here.',
  sarcophagus: 'Two stone coffins lie side by side.',
};

/** The landmark of a floor (the first decor of a landmark kind), or null (old runs have none). */
export function landmarkOf(map: DungeonMap): DecorProp | null {
  return (map.decor ?? []).find((d) => d.kind in LANDMARK_LINES) ?? null;
}

/** The toast text for a floor's landmark, or null. */
export function landmarkToast(map: DungeonMap): string | null {
  const lm = landmarkOf(map);
  return lm ? (LANDMARK_LINES[lm.kind] ?? null) : null;
}

/** One prop for the view: the artist's drawDecor. */
export function drawDecorProp(kind: string, c: number, r: number, clockMs: number): Container {
  return drawDecor(decorKind(kind), decorVariant(c, r), clockMs);
}
