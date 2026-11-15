// The block types (shared/data/blocks.json, step BG5): data and types only, no rules (blocks.ts has
// those). Blocks stack in the bag like materials (materials.ts adds them with group 'block').

import blockData from '../data/blocks.json';
import type { Icon } from './icons.ts';
import type { RoomKind } from './room.ts';
import type { BlockId, MaterialId, Rank } from './types.ts';

/** An extra item a broken block may drop, besides itself. */
export interface BlockDrop {
  item: MaterialId;
  /** 0 to 1. */
  chance: number;
}

export interface BlockType {
  id: BlockId;
  name: string;
  /** Hits to break it (1 to 8). */
  hardness: number;
  rank: Rank;
  baseValue: number;
  /** True = sold in the Catalog (price = baseValue * 3). The rest comes from drops, later splicing. */
  inCatalog: boolean;
  /** Extra drops besides the block itself (which always comes back). */
  drops: BlockDrop[];
  /** The seed a broken block may drop (step BG6 fills it in); null until then. */
  seedId: MaterialId | null;
  /** The room kinds it can be placed in. */
  placeIn: RoomKind[];
  icon: Icon;
}

/** One block standing in a cell of a room's foreground layer (Room.blocks, key "col,row"). */
export interface BlockCell {
  id: BlockId;
  /** Hits taken so far (it heals when it was not hit for BLOCK_HEAL_MS). */
  hits: number;
  /** The time of the last hit (ms). */
  hitAt: number;
}

export const BLOCK_TYPES = blockData as BlockType[];

const BY_ID = new Map(BLOCK_TYPES.map((b) => [b.id as string, b]));

export type BlockLookup = (id: string) => BlockType;

export function getBlockType(id: string): BlockType {
  const b = BY_ID.get(id);
  if (!b) throw new Error(`unknown block ${id}`);
  return b;
}

export function isBlockId(id: string): id is BlockId {
  return BY_ID.has(id);
}
