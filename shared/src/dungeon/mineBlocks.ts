// The dig mine's block kinds (MG-3, docs/PLAN-MINIGAMES.md 1.3). Data: shared/data/mineBlocks.json. Pure helpers.

import blockData from '../../data/mineBlocks.json';
import type { PaletteName } from '../palette.ts';
import type { MaterialId, Rank } from '../types.ts';

export type MineBlockId = 'stone' | 'dirt' | 'clay' | 'coal' | 'copper' | 'iron' | 'mithril' | 'crystal' | 'gold_vein' | 'diamond' | 'bedrock';

export interface MineBlockType {
  id: MineBlockId;
  name: string;
  /** Pickaxe hits to break it (a steel pickaxe swing is 2 hits). */
  hits: number;
  /** What it drops (min to max of one item), or null (bedrock). */
  drop: { item: MaterialId; min: number; max: number } | null;
  /** Stone, dirt and clay: they drop their block only now and then, and never push ore out of a full bag. */
  filler?: boolean;
  /** Only the steel pickaxe breaks it (like the old mithril rock); never on the cheapest route to the exit. */
  hard?: boolean;
  /** Crystal, gold vein, diamond: 0 to DIG_RARE_MAX per floor, off the main route, they glint. */
  rare?: boolean;
  unbreakable?: boolean;
  rank: Rank;
  /** The rank its gem roll uses (the old rocks: ROCK_GEM_RANK); none for filler. */
  gemRank?: Rank;
  /** Veins and rare blocks appear from this depth on. */
  minDepth: number;
  /** Vein weight at minDepth, plus weightPerDepth per extra depth (never below 0). */
  weight: number;
  weightPerDepth: number;
  /** Placeholder art colours (palette names): top face, front face. */
  colors: [PaletteName, PaletteName];
}

export const MINE_BLOCKS = blockData as MineBlockType[];
const BY_ID = new Map<string, MineBlockType>(MINE_BLOCKS.map((b) => [b.id, b]));

export function getMineBlock(id: MineBlockId): MineBlockType {
  const b = BY_ID.get(id);
  if (!b) throw new Error(`unknown mine block ${id}`);
  return b;
}

/** The weight of a kind at a depth (0 before its minDepth). */
export function blockWeight(b: Pick<MineBlockType, 'minDepth' | 'weight' | 'weightPerDepth'>, depth: number): number {
  if (depth < b.minDepth) return 0;
  return Math.max(0, b.weight + b.weightPerDepth * (depth - b.minDepth));
}

/** Ore veins (not filler, not rare, not bedrock) that can appear at a depth, with their weights. */
export function veinWeights(depth: number): { id: MineBlockId; weight: number }[] {
  return MINE_BLOCKS.filter((b) => !b.filler && !b.rare && !b.unbreakable)
    .map((b) => ({ id: b.id, weight: blockWeight(b, depth) }))
    .filter((v) => v.weight > 0);
}

/** The rare kinds that can appear at a depth, with their weights. */
export function rareWeights(depth: number): { id: MineBlockId; weight: number }[] {
  return MINE_BLOCKS.filter((b) => b.rare)
    .map((b) => ({ id: b.id, weight: blockWeight(b, depth) }))
    .filter((v) => v.weight > 0);
}
