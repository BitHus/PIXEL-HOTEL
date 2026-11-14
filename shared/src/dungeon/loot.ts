// Loot tables (brief section 10), data in shared/data/loot.json. rollLoot rolls `rolls` drops
// with the rng that is passed in. Step 9e: every drop row has a RANK. A roll first picks a rank
// (config RANK_WEIGHTS times the table's rankMultiplier: golden chests, mimics and bosses shift
// the odds up), then one of the table's drops of that rank by weight. A rank the table does not
// have falls to the next lower one. An item is 'gold', a material id or a furniture type id.
// Every enemy type has its own table with one drop per rank (ENEMY_TABLES).

import lootData from '../../data/loot.json';
import { RANKS, rollRank } from '../ranks.ts';
import { rngInt } from '../rng.ts';
import type { Rank, Rng } from '../types.ts';

export interface LootDrop {
  item: string;
  min: number;
  max: number;
  /** The weight among the table's drops of the same rank. */
  weight: number;
  rank: Rank;
}

export interface LootTable {
  id: string;
  rolls: number;
  /** Multiplies RANK_WEIGHTS for this table (1 = the base odds). */
  rankMultiplier: Partial<Record<Rank, number>>;
  drops: LootDrop[];
}

/** The enemy types that have a drop table: the kinds plus the mimic. */
export const ENEMY_TABLES = ['slime', 'bat', 'skeleton', 'mimic', 'bone_king'] as const;
export type EnemyTableId = (typeof ENEMY_TABLES)[number];
export type LootTableId = 'wooden_chest' | 'golden_chest' | 'boss' | EnemyTableId;

export const LOOT_TABLES = lootData as LootTable[];

export function getLootTable(id: LootTableId): LootTable {
  const t = LOOT_TABLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown loot table ${id}`);
  return t;
}

/** The ranks a table has drops for. */
export function tableRanks(table: LootTable): Rank[] {
  return RANKS.filter((r) => table.drops.some((d) => d.rank === r));
}

/** The chance (0..1) that one roll of the table gives each rank. */
export function rankChances(table: LootTable): Record<Rank, number> {
  const out: Record<Rank, number> = { common: 0, rare: 0, ultra_rare: 0, legendary: 0 };
  // Exact: walk the same weights rollRank uses, in small steps of the roll.
  const steps = 20000;
  const has = tableRanks(table);
  for (let i = 0; i < steps; i++) out[rollRank(() => (i + 0.5) / steps, table.rankMultiplier, has)] += 1 / steps;
  return out;
}

/** One dropped thing: an item id and how many. */
export interface Loot {
  item: string;
  qty: number;
}

/** One drop: a rank first, then a weighted pick among the table's drops of that rank. */
export function rollDrop(table: LootTable, rng: Rng): Loot & { rank: Rank } {
  const rank = rollRank(rng, table.rankMultiplier, tableRanks(table));
  const drops = table.drops.filter((d) => d.rank === rank);
  const total = drops.reduce((a, d) => a + d.weight, 0);
  let r = rng() * total;
  let pick = drops[drops.length - 1] ?? table.drops[0]!;
  for (const d of drops) {
    if (r < d.weight) {
      pick = d;
      break;
    }
    r -= d.weight;
  }
  return { item: pick.item, qty: rngInt(rng, pick.min, pick.max), rank: pick.rank };
}

/** Rolls the table `rolls` times. */
export function rollLoot(table: LootTable, rng: Rng): (Loot & { rank: Rank })[] {
  return Array.from({ length: table.rolls }, () => rollDrop(table, rng));
}
