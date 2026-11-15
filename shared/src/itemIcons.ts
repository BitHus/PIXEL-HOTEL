// Where every item's icon is found (step BG2). The icons live in the data files next to each item;
// this file gathers them by group so one test can check them all and the client has one lookup.

import extraIcons from '../data/extraIcons.json';
import { CLOTHING } from './clothing.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { GEAR_PIECES, GEAR_TYPES } from './gear.ts';
import type { Icon } from './icons.ts';
import { MATERIAL_TYPES, getMaterialType } from './materials.ts';
import type { MaterialId } from './types.ts';

/** The dungeon key (10 gold at the dungeon door). */
export const KEY_ICON = (extraIcons as { key: Icon }).key;

/** Every icon by group. Items of one group must differ in shape + colours (tested). */
export function iconGroups(): Record<string, { id: string; icon: Icon }[]> {
  const out: Record<string, { id: string; icon: Icon }[]> = {};
  for (const m of MATERIAL_TYPES) (out[m.group] ??= []).push({ id: m.id, icon: m.icon });
  out.furniture = FURNITURE_TYPES.map((f) => ({ id: f.id, icon: f.icon }));
  out.clothing = CLOTHING.map((c) => ({ id: c.id, icon: c.icon }));
  out.gear = [...GEAR_PIECES, ...GEAR_TYPES].map((g) => ({ id: g.id, icon: g.icon }));
  out.extra = [{ id: 'key', icon: KEY_ICON }];
  return out;
}

export function materialIcon(id: MaterialId): Icon {
  return getMaterialType(id).icon;
}
