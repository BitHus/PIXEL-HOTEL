// Loot tables (brief section 10), data in shared/data/loot.json. rollLoot rolls `rolls` weighted
// drops with the rng that is passed in. An item is 'gold', a material id or a furniture type id.

import lootData from '../../data/loot.json';
import { rngInt } from '../rng.ts';
import type { Rng } from '../types.ts';

export interface LootDrop {
  item: string;
  min: number;
  max: number;
  weight: number;
}

export interface LootTable {
  id: string;
  rolls: number;
  drops: LootDrop[];
}

export type LootTableId = 'wooden_chest' | 'golden_chest' | 'enemy_rare' | 'boss';

export const LOOT_TABLES = lootData as LootTable[];

export function getLootTable(id: LootTableId): LootTable {
  const t = LOOT_TABLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown loot table ${id}`);
  return t;
}

/** One dropped thing: an item id and how many. */
export interface Loot {
  item: string;
  qty: number;
}

/** One weighted pick from the table's drops. */
export function rollDrop(table: LootTable, rng: Rng): Loot {
  const total = table.drops.reduce((a, d) => a + d.weight, 0);
  let r = rng() * total;
  let pick = table.drops[table.drops.length - 1]!;
  for (const d of table.drops) {
    if (r < d.weight) {
      pick = d;
      break;
    }
    r -= d.weight;
  }
  return { item: pick.item, qty: rngInt(rng, pick.min, pick.max) };
}

/** Rolls the table `rolls` times. */
export function rollLoot(table: LootTable, rng: Rng): Loot[] {
  return Array.from({ length: table.rolls }, () => rollDrop(table, rng));
}
