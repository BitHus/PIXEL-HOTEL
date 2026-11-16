// DG2: what the dungeon view does with map.decor (DG1). Pure helpers (aliases, variants, lights, the landmark line)
// plus drawDecorProp, which calls the artist's drawDecor hook (propArt.ts). No game rule here: the layout decides
// where props stand, this only says how they look and which of them glow.

import { Container, Graphics } from 'pixi.js';
import { DUNGEON_BLOCK, LIGHT_TORCH_ALPHA, PALETTE, type DecorProp, type DungeonMap } from '@pixel-hotel/shared';
import { drawDecor, propLight, PROP_INFO } from './propArt.ts';
import type { LightSource } from './light.ts';

/** Kinds the generator uses that propArt names differently (a missing kind would draw the grey box). */
const DECOR_ALIAS: Record<string, string> = {
  brazier: 'brazier_big',
  sarcophagus_small: 'sarcophagus',
};

/** The propArt kind for a generator kind. */
export function decorKind(kind: string): string {
  return DECOR_ALIAS[kind] ?? kind;
}

/** Variant of a prop from its cell, stable per floor. */
export function decorVariant(c: number, r: number): number {
  return (Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663)) >>> 0;
}

/** True when the prop hangs over the floor like a decal or is walked over (drawn under avatars and enemies). */
export function decorIsFlat(kind: string): boolean {
  const info = (PROP_INFO as Record<string, { solid: boolean } | undefined>)[decorKind(kind)];
  return !info || !info.solid;
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

/** gem_pile has no art in propArt yet: a small code-art pile (cool gems, 1 px dark outline). */
function gemPile(): Container {
  const root = new Container();
  const g = new Graphics();
  const out = PALETTE[25]!;
  const gem = (x: number, y: number, c: string): void => {
    g.rect(x - 1, y - 1, 7, 6).fill(out);
    g.rect(x, y, 5, 4).fill(c);
    g.rect(x, y, 2, 1).fill(PALETTE[19]!);
  };
  gem(-9, -7, PALETTE[18]!);
  gem(2, -8, PALETTE[17]!);
  gem(-4, -4, PALETTE[28]!);
  root.addChild(g);
  root.label = 'prop:gem_pile';
  return root;
}

/** One prop for the view: the artist's drawDecor, with the aliases and the gem pile fallback. */
export function drawDecorProp(kind: string, c: number, r: number, clockMs: number): Container {
  if (kind === 'gem_pile') return gemPile();
  return drawDecor(decorKind(kind), decorVariant(c, r), clockMs);
}
