// Blocks and punching (step BG5). Pure rules on plain data: where a block may stand, putting one in
// a cell, hitting one until it breaks, and what it drops. Time and rng are passed in.
//
// A block lives in the room's foreground layer (Room.blocks), one per cell. It never stands on the
// door zone, outside the floor, on a cell with floor furniture, on the farm's plots or pot, or on a
// cell where an avatar stands still. Blocks block walking, so a placement that would shut the door
// off from the middle of the room, or the shopkeeper's spot behind the counter, is refused.
// Blocks are items in the bag (Player.materials, group 'block'); every change goes through
// ledger.applyChange. Only the room's owner changes the room.

import { BLOCK_CRACK_STAGES, BLOCK_HEAL_MS, BLOCK_HIT_COOLDOWN_MS, BLOCK_REACH, BLOCK_SEED_CHANCE, BUILD_CELL } from './config.ts';
import { getBlockType, isBlockId, type BlockCell, type BlockLookup, type BlockType } from './blockTypes.ts';
import { footprintRect, getFurnitureType, behindPoint, behindReachable, doorReachesMiddle, roomBlockers, type FurnitureLookup } from './furniture.ts';
import { noPlaceRects, fixedBlockers } from './farmLayout.ts';
import { cellCenter, isCellFree, nearestFreeCell, reachableCells, type NavGrid } from './nav.ts';
import type { GameState } from './gameState.ts';
import { gemDrop } from './gems.ts';
import { applyChange } from './ledger.ts';
import { blockInCell, blockKey, cellOf, cellOnFloor, cellRectOf, doorZoneRect, rectsOverlap, type Room } from './room.ts';
import type { FurnitureItem, MaterialId, Point, Rng } from './types.ts';

export type BlockProblem =
  | 'not_owner' // not the player's room
  | 'not_buildable' // the lakeside
  | 'wrong_room' // the block's placeIn does not list this room
  | 'empty' // none of this block in the bag
  | 'floor' // the cell is not (all) floor
  | 'door' // on the door zone
  | 'taken' // a block is already there
  | 'furniture' // floor furniture is there
  | 'fixed' // the farm's plots or the cooking pot
  | 'avatar' // an avatar stands still there
  | 'door_blocked' // the door would no longer reach the middle
  | 'counter_blocked' // the spot behind the counter would no longer be reachable
  | 'reach' // too far from the avatar (the client walks closer first)
  | 'no_block' // nothing to hit there
  | 'cooldown'; // too soon after the last hit (not an error)

/** Who is where: the avatars standing still (cells that stay free) and the one who places or hits. */
export interface BlockContext {
  /** Positions of avatars standing still (the own avatar, customers, guests). */
  standing: readonly Point[];
  /** The acting avatar's position; null = no reach limit (tests, the server's own checks). */
  from: Point | null;
}

/** True if the cell's centre is within BLOCK_REACH cells of the avatar. */
export function inReach(from: Point, c: number, r: number): boolean {
  const mid = cellRectOf(c, r);
  return Math.hypot(mid.x + BUILD_CELL / 2 - from.x, mid.y + BUILD_CELL / 2 - from.y) <= BLOCK_REACH * BUILD_CELL;
}

/** Floor furniture (not wall items, not riders on a surface) of the room. */
function floorFurniture(room: Room, items: readonly FurnitureItem[], types: FurnitureLookup): FurnitureItem[] {
  return items.filter((i) => i.roomId === room.id && i.onItemUid === null && !types(i.typeId).wall);
}

/** Why a block of this type may not be put in this cell now (null = it may). Does not look at the bag. */
export function blockProblem(
  room: Room,
  items: readonly FurnitureItem[],
  type: BlockType,
  c: number,
  r: number,
  ctx: BlockContext,
  types: FurnitureLookup = getFurnitureType,
): BlockProblem | null {
  if (room.kind === 'lakeside') return 'not_buildable';
  if (!type.placeIn.includes(room.kind)) return 'wrong_room';
  if (!cellOnFloor(room, c, r)) return 'floor';
  const cell = cellRectOf(c, r);
  if (rectsOverlap(cell, doorZoneRect(room))) return 'door';
  if (blockInCell(room, c, r)) return 'taken';
  if (floorFurniture(room, items, types).some((i) => rectsOverlap(cell, footprintRect(i, types(i.typeId))))) return 'furniture';
  if ([...noPlaceRects(room), ...fixedBlockers(room)].some((x) => rectsOverlap(cell, x))) return 'fixed';
  if (ctx.standing.some((p) => cellOf(p).c === c && cellOf(p).r === r)) return 'avatar';
  // Blocks block walking: the door must still reach the middle, and the counter's staff spot the door.
  const blockers = [...roomBlockers(room, items, types), cell];
  if (!doorReachesMiddle(room, blockers)) return 'door_blocked';
  for (const counter of floorFurniture(room, items, types)) {
    const t = types(counter.typeId);
    if (t.servedFromBehind && !behindReachable(room, blockers, behindPoint(counter, t))) return 'counter_blocked';
  }
  if (ctx.from && !inReach(ctx.from, c, r)) return 'reach';
  return null;
}

function roomOf(state: GameState, roomId: number): Room | null {
  return state.rooms.find((x) => x.id === roomId) ?? null;
}

function withRoom(state: GameState, room: Room): GameState {
  return { ...state, rooms: state.rooms.map((x) => (x.id === room.id ? room : x)) };
}

export type PlaceBlockResult = { ok: true; state: GameState } | { ok: false; problem: BlockProblem };

/** Puts one block of the bag into a cell (ledger reason 'block_place'). */
export function placeBlock(
  state: GameState,
  roomId: number,
  c: number,
  r: number,
  blockId: string,
  at: number,
  ctx: BlockContext,
  lookup: BlockLookup = getBlockType,
  types: FurnitureLookup = getFurnitureType,
): PlaceBlockResult {
  const room = roomOf(state, roomId);
  if (!room || room.ownerId !== state.player.id) return { ok: false, problem: 'not_owner' };
  if (!Number.isInteger(c) || !Number.isInteger(r) || !isKnown(blockId, lookup)) return { ok: false, problem: 'floor' };
  const type = lookup(blockId);
  if ((state.player.materials[type.id] ?? 0) < 1) return { ok: false, problem: 'empty' };
  const problem = blockProblem(room, state.items, type, c, r, ctx, types);
  if (problem) return { ok: false, problem };
  const paid = applyChange(state, { reason: 'block_place', materials: { [type.id]: -1 }, note: `${type.id}@${blockKey(c, r)}` }, at);
  if (!paid) return { ok: false, problem: 'empty' };
  const cell: BlockCell = { id: type.id, hits: 0, hitAt: at };
  return { ok: true, state: withRoom(paid, { ...room, blocks: { ...room.blocks, [blockKey(c, r)]: cell } }) };
}

function isKnown(id: string, lookup: BlockLookup): boolean {
  if (lookup === getBlockType) return isBlockId(id);
  try {
    lookup(id);
    return true;
  } catch {
    return false;
  }
}

/** Hits a block has taken now: a block that was left alone for BLOCK_HEAL_MS has healed. */
export function hitsNow(cell: BlockCell, at: number): number {
  return at - cell.hitAt > BLOCK_HEAL_MS ? 0 : cell.hits;
}

/** The crack picture of a block: 0 (whole) to BLOCK_CRACK_STAGES - 1 (about to break). Rendering only. */
export function crackStage(cell: BlockCell, hardness: number, at: number): number {
  return Math.min(BLOCK_CRACK_STAGES - 1, Math.floor((hitsNow(cell, at) * BLOCK_CRACK_STAGES) / hardness));
}

export interface BlockDrops {
  materials: Partial<Record<MaterialId, number>>;
  gems: number;
}

/**
 * What a broken block gives: itself (always), its seed (BLOCK_SEED_CHANCE, when it has one), each
 * extra drop by its chance, and maybe gems by the block's rank. Rolls in that order.
 */
export function blockDrops(type: BlockType, rng: Rng): BlockDrops {
  const materials: Partial<Record<MaterialId, number>> = { [type.id]: 1 };
  const add = (id: MaterialId): void => {
    materials[id] = (materials[id] ?? 0) + 1;
  };
  if (type.seedId && rng() < BLOCK_SEED_CHANCE) add(type.seedId);
  for (const d of type.drops) if (rng() < d.chance) add(d.item);
  return { materials, gems: gemDrop('block', type.rank, rng) };
}

export type HitBlockResult =
  | { ok: false; problem: BlockProblem }
  | { ok: true; kind: 'cracked'; state: GameState; hits: number; hardness: number }
  | { ok: true; kind: 'broken'; state: GameState; drops: BlockDrops };

/**
 * One punch at the block in a cell. Needs the room's owner, a block there and reach; refused with
 * 'cooldown' (nothing changes) when the last punch (lastHitAt) was under BLOCK_HIT_COOLDOWN_MS ago.
 * The last block hit counts hardness hits; the block breaks and its drops go through the ledger
 * (reason 'block_break').
 */
export function hitBlock(
  state: GameState,
  roomId: number,
  c: number,
  r: number,
  at: number,
  lastHitAt: number,
  rng: Rng,
  from: Point | null,
  lookup: BlockLookup = getBlockType,
): HitBlockResult {
  const room = roomOf(state, roomId);
  if (!room || room.ownerId !== state.player.id) return { ok: false, problem: 'not_owner' };
  const cell = blockInCell(room, c, r);
  if (!cell) return { ok: false, problem: 'no_block' };
  if (from && !inReach(from, c, r)) return { ok: false, problem: 'reach' };
  if (at - lastHitAt < BLOCK_HIT_COOLDOWN_MS) return { ok: false, problem: 'cooldown' };
  const type = lookup(cell.id);
  const hits = hitsNow(cell, at) + 1;
  const key = blockKey(c, r);
  if (hits < type.hardness) {
    const blocks = { ...room.blocks, [key]: { ...cell, hits, hitAt: at } };
    return { ok: true, kind: 'cracked', state: withRoom(state, { ...room, blocks }), hits, hardness: type.hardness };
  }
  const drops = blockDrops(type, rng);
  const blocks = { ...room.blocks };
  delete blocks[key];
  const paid = applyChange(state, { reason: 'block_break', materials: drops.materials, ...(drops.gems > 0 ? { gems: drops.gems } : {}), note: `${type.id}@${key}` }, at);
  if (!paid) return { ok: false, problem: 'no_block' };
  return { ok: true, kind: 'broken', state: withRoom(paid, { ...room, blocks }), drops };
}

/** The blocks of a room whose cells overlap a rectangle (for the door zone after an upgrade). */
export function blocksOverlapping(room: Room, rect: { x: number; y: number; w: number; h: number }): { c: number; r: number; id: string }[] {
  return Object.entries(room.blocks)
    .map(([k, b]) => {
      const [c, r] = k.split(',').map(Number) as [number, number];
      return { c, r, id: b.id as string };
    })
    .filter((b) => rectsOverlap(cellRectOf(b.c, b.r), rect));
}

/**
 * Where the avatar walks to when a cell is too far to place or punch: the free cell nearest to the
 * avatar (reachable, not the target itself) that is at most BLOCK_REACH - 1 cells from the target,
 * so it is well inside the reach on arrival. Null if there is none.
 */
export function approachSpot(grid: NavGrid, from: Point, c: number, r: number): Point | null {
  const start = nearestFreeCell(grid, from);
  if (start === null) return null;
  const reach = reachableCells(grid, start);
  const target = { x: (c + 0.5) * grid.cell, y: (r + 0.5) * grid.cell };
  let best: Point | null = null;
  let bestD = Infinity;
  for (let i = 0; i < grid.blocked.length; i++) {
    if (!reach[i]) continue;
    const col = i % grid.cols;
    const row = (i - col) / grid.cols;
    if ((col === c && row === r) || !isCellFree(grid, col, row)) continue;
    const mid = cellCenter(grid, col, row);
    if (Math.hypot(mid.x - target.x, mid.y - target.y) > (BLOCK_REACH - 1) * grid.cell) continue;
    const d = Math.hypot(mid.x - from.x, mid.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = mid;
    }
  }
  return best;
}
