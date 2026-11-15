// The farm (brief section 10b, step BG6): free-form. Seeds are planted on SOIL cells (floor cells painted
// with the 'soil' style) of a farm room, one plant per cell; a plant blocks its cell like a small block.
// It grows in 3 stages in real time (sprout, small plant, fully grown), also while the game is closed:
// Plant.plantedAt / readyAt are on the same clock as `now`, which is passed in (no Date.now here). No
// watering, no rotting: a fully grown plant waits until it is punched. A punch on a grown plant harvests it
// (SEED_YIELD blocks or crops by rank, a chance for the seed back, a chance for gems); an unripe plant is
// never harmed. Everything that changes the bag or the wallet goes through ledger.applyChange. Pure.

import { BUILD_CELL, PLANT_SPROUT_SHARE, SEED_BACK_CHANCE, SEED_GROW_MS, SEED_YIELD, SOIL_STYLE, BLOCK_HIT_COOLDOWN_MS } from './config.ts';
import { getBlockType, isBlockId } from './blockTypes.ts';
import { cellProblem, inReach, roomOf, withRoom, type BlockContext, type BlockProblem } from './blocks.ts';
import { getFurnitureType, type FurnitureLookup } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { gemDrop } from './gems.ts';
import { applyChange } from './ledger.ts';
import { CROP_TYPES, cropOfSeed, getMaterialType, isSeedId } from './materials.ts';
import { rngInt } from './rng.ts';
import { blockKey, cellOnFloor, floorStyleAt, plantInCell, plantList, type Plant, type Room } from './room.ts';
import type { FurnitureItem, MaterialId, Point, Rank, Rng, SeedId } from './types.ts';

export type PlantStage = 'sprout' | 'small' | 'full';

// ---------- What a seed is ----------

/** The block or crop a seed grows (a block seed: `<block>_seed`; a crop seed: its crop). */
export function seedProduct(seed: SeedId): MaterialId {
  const block = seed.endsWith('_seed') ? seed.slice(0, -'_seed'.length) : null;
  if (block !== null && isBlockId(block)) return block;
  return cropOfSeed(seed).id;
}

/** The rank of a seed = the rank of what it grows. */
export function seedRank(seed: SeedId): Rank {
  return getMaterialType(seedProduct(seed)).rank;
}

/** How long a fresh plant of this seed takes to be fully grown, ms (config SEED_GROW_MS by rank). */
export function seedGrowMs(seed: SeedId): number {
  return SEED_GROW_MS[seedRank(seed)];
}

// ---------- Soil ----------

/** True if this cell is floor with the soil style (the only place a seed can go). */
export function isSoil(room: Room, c: number, r: number): boolean {
  return room.kind === 'farm' && cellOnFloor(room, c, r) && floorStyleAt(room, c, r) === SOIL_STYLE;
}

/** Every soil cell of a farm room (with or without a plant). */
export function soilCells(room: Room): { c: number; r: number }[] {
  const out: { c: number; r: number }[] = [];
  if (room.kind !== 'farm') return out;
  const cols = Math.ceil(room.w / BUILD_CELL);
  const rows = Math.ceil(room.h / BUILD_CELL);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isSoil(room, c, r)) out.push({ c, r });
  return out;
}

// ---------- Growth ----------

/** The stage: sprout for the first PLANT_SPROUT_SHARE of its time, then the small plant, then fully grown. */
export function growthStage(plant: Plant, now: number): PlantStage {
  const total = Math.max(1, plant.readyAt - plant.plantedAt);
  const t = now - plant.plantedAt;
  if (t >= total) return 'full';
  return t >= total * PLANT_SPROUT_SHARE ? 'small' : 'sprout';
}

export function isRipe(plant: Plant, now: number): boolean {
  return now >= plant.readyAt;
}

/** ms until it is fully grown (0 when it is). */
export function readyInMs(plant: Plant, now: number): number {
  return Math.max(0, plant.readyAt - now);
}

// ---------- Planting ----------

const FARM_ONLY = ['farm'] as const;

/** Why this seed may not go into this cell now (null = it may). Does not look at the bag. */
export function plantProblem(
  room: Room,
  items: readonly FurnitureItem[],
  c: number,
  r: number,
  ctx: BlockContext,
  types: FurnitureLookup = getFurnitureType,
): BlockProblem | null {
  if (room.kind !== 'farm') return room.kind === 'lakeside' ? 'not_buildable' : 'wrong_room';
  if (cellOnFloor(room, c, r) && !isSoil(room, c, r)) return 'no_soil';
  return cellProblem(room, items, FARM_ONLY, c, r, ctx, types);
}

export type PlantSeedResult = { ok: true; state: GameState } | { ok: false; problem: BlockProblem };

/** Plants one seed of the bag in a cell (ledger reason 'plant'). Only the room's owner. */
export function plantSeed(
  state: GameState,
  roomId: number,
  c: number,
  r: number,
  seed: string,
  at: number,
  ctx: BlockContext,
  types: FurnitureLookup = getFurnitureType,
): PlantSeedResult {
  const room = roomOf(state, roomId);
  if (!room || room.ownerId !== state.player.id) return { ok: false, problem: 'not_owner' };
  if (!Number.isInteger(c) || !Number.isInteger(r) || !isSeedId(seed)) return { ok: false, problem: 'floor' };
  if ((state.player.materials[seed] ?? 0) < 1) return { ok: false, problem: 'empty' };
  const problem = plantProblem(room, state.items, c, r, ctx, types);
  if (problem) return { ok: false, problem };
  const paid = applyChange(state, { reason: 'plant', materials: { [seed]: -1 }, note: `${seed}@${blockKey(c, r)}` }, at);
  if (!paid) return { ok: false, problem: 'empty' };
  const plant: Plant = { seed, plantedAt: at, readyAt: at + seedGrowMs(seed) };
  return { ok: true, state: withRoom(paid, { ...room, plants: { ...room.plants, [blockKey(c, r)]: plant } }) };
}

// ---------- Harvest ----------

export interface HarvestRoll {
  /** What grew: a block or a crop. */
  item: MaterialId;
  qty: number;
  /** True = the seed comes back too. */
  seedBack: boolean;
  gems: number;
}

/** What a fully grown plant gives. Rolls in this order: the amount, the seed back, the gems. */
export function harvestPlant(plant: Plant, rng: Rng): HarvestRoll {
  const rank = seedRank(plant.seed);
  const y = SEED_YIELD[rank];
  const qty = rngInt(rng, y.min, y.max);
  const seedBack = rng() < SEED_BACK_CHANCE;
  return { item: seedProduct(plant.seed), qty, seedBack, gems: gemDrop('harvest', rank, rng) };
}

export type HitPlantResult =
  | { ok: false; problem: BlockProblem; leftMs?: number }
  | { ok: true; state: GameState; roll: HarvestRoll; seed: SeedId };

/**
 * One punch at the plant in a cell. Needs the owner, a plant and reach. A plant that is not fully grown is
 * left alone (problem 'unripe', with the time left): a tap can never destroy it. 'cooldown' (nothing changes)
 * when the last punch was under BLOCK_HIT_COOLDOWN_MS ago. A grown plant is harvested: the plant goes, the
 * cell is free again, the result goes through the ledger (reason 'harvest').
 */
export function hitPlant(
  state: GameState,
  roomId: number,
  c: number,
  r: number,
  at: number,
  lastHitAt: number,
  rng: Rng,
  from: Point | null,
): HitPlantResult {
  const room = roomOf(state, roomId);
  if (!room || room.ownerId !== state.player.id) return { ok: false, problem: 'not_owner' };
  const plant = plantInCell(room, c, r);
  if (!plant) return { ok: false, problem: 'no_plant' };
  if (from && !inReach(from, c, r)) return { ok: false, problem: 'reach' };
  if (!isRipe(plant, at)) return { ok: false, problem: 'unripe', leftMs: readyInMs(plant, at) };
  if (at - lastHitAt < BLOCK_HIT_COOLDOWN_MS) return { ok: false, problem: 'cooldown' };
  const roll = harvestPlant(plant, rng);
  const materials: Partial<Record<MaterialId, number>> = { [roll.item]: roll.qty };
  if (roll.seedBack) materials[plant.seed] = (materials[plant.seed] ?? 0) + 1;
  const paid = applyChange(
    state,
    { reason: 'harvest', materials, ...(roll.gems > 0 ? { gems: roll.gems } : {}), note: `${plant.seed}@${blockKey(c, r)}` },
    at,
  );
  if (!paid) return { ok: false, problem: 'no_plant' };
  const plants = { ...room.plants };
  delete plants[blockKey(c, r)];
  return { ok: true, state: withRoom(paid, { ...room, plants }), roll, seed: plant.seed };
}

/** The plants of a room whose cells overlap a rectangle (the door zone after an upgrade). */
export function plantsOverlapping(room: Room, rect: { x: number; y: number; w: number; h: number }): { c: number; r: number; seed: SeedId }[] {
  return plantList(room)
    .filter((p) => {
      const x = p.c * BUILD_CELL;
      const y = p.r * BUILD_CELL;
      return x < rect.x + rect.w && x + BUILD_CELL > rect.x && y < rect.y + rect.h && y + BUILD_CELL > rect.y;
    })
    .map((p) => ({ c: p.c, r: p.r, seed: p.plant.seed }));
}

// ---------- The shop of seeds, the travel card ----------

/** The crops whose seeds are sold in the catalog (Seeds tab): the basic seeds. */
export function seedsForSale(): (typeof CROP_TYPES)[number][] {
  return CROP_TYPES.filter((c) => c.seedPrice !== null);
}

/** Buys `qty` seeds of a crop (ledger reason 'seeds'). Null if not for sale or the gold is short. */
export function buySeeds(state: GameState, seed: SeedId, qty: number, at: number): GameState | null {
  const crop = CROP_TYPES.find((c) => c.seed === seed);
  if (!crop || crop.seedPrice === null || !Number.isInteger(qty) || qty < 1) return null;
  return applyChange(state, { reason: 'seeds', gold: -crop.seedPrice * qty, materials: { [seed]: qty }, note: `bought ${qty} ${seed}` }, at);
}

/** Counts for the travel card: fully grown plants, growing plants and free soil cells. */
export function farmCounts(room: Room, now: number): { ripe: number; growing: number; free: number } {
  let ripe = 0;
  let growing = 0;
  for (const { plant } of plantList(room)) {
    if (isRipe(plant, now)) ripe++;
    else growing++;
  }
  return { ripe, growing, free: Math.max(0, soilCells(room).length - ripe - growing) };
}

/** Painting the farm floor: a cell that holds a plant stays soil (the plant must not float on grass). */
export function keepSoilUnderPlants(room: Room): Room {
  let next = room;
  for (const { c, r } of plantList(room)) {
    if (floorStyleAt(next, c, r) !== SOIL_STYLE) {
      const painted = { ...(next.floorCells ?? {}), [blockKey(c, r)]: SOIL_STYLE };
      next = { ...next, floorCells: painted };
    }
  }
  return next;
}
