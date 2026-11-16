// Room themes of the crypt (DG1). A theme = which templates it fits, which props it places, and how
// its enemies stand. Data: shared/data/dungeonThemes.json. Pure helpers; the rng is passed in.

import themeData from '../../data/dungeonThemes.json';
import { rngInt } from '../rng.ts';
import type { Rng } from '../types.ts';

export type EnemyStyle = 'normal' | 'none' | 'ambush' | 'guard';

export interface RoomTheme {
  id: string;
  role: 'spawn' | 'exit' | 'any';
  templates: string[];
  rounds: number[];
  weight: number;
  props: [string, number, number][];
  enemies: EnemyStyle;
}

export const ROOM_THEMES: readonly RoomTheme[] = themeData.themes as RoomTheme[];
export const LANDMARK_KINDS: readonly string[] = themeData.landmarks;

export function getTheme(id: string): RoomTheme {
  const t = ROOM_THEMES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown room theme ${id}`);
  return t;
}

/** A free room's theme: by weight among the 'any' themes of this round that fit its template. */
export function pickTheme(rng: Rng, round: number, template: string): RoomTheme {
  const fit = ROOM_THEMES.filter((t) => t.role === 'any' && t.rounds.includes(round) && (t.templates.includes('*') || t.templates.includes(template)));
  const total = fit.reduce((a, t) => a + t.weight, 0);
  let roll = rng() * total;
  for (const t of fit) {
    roll -= t.weight;
    if (roll < 0) return t;
  }
  return fit[fit.length - 1] ?? getTheme('storeroom');
}

/** How many of each prop a theme places: one draw per prop entry, in the file's order. */
export function rollProps(rng: Rng, theme: RoomTheme): string[] {
  const out: string[] = [];
  for (const [kind, min, max] of theme.props) {
    const n = rngInt(rng, min, max);
    for (let k = 0; k < n; k++) out.push(kind);
  }
  return out;
}

export function isLandmarkKind(kind: string): boolean {
  return LANDMARK_KINDS.includes(kind);
}
