// The farm (brief section 10b, step BG6): free-form. Seeds are planted on SOIL cells (floor cells painted
// with the 'soil' style) of a farm room, one plant per cell; a plant blocks its cell like a small block.
// It grows in 3 stages in real time (sprout, small plant, fully grown), also while the game is closed:
// Plant.plantedAt / readyAt are on the same clock as `now`, which is passed in (no Date.now here). No
// watering, no rotting: a fully grown plant waits until it is punched. A punch on a grown plant harvests it
// (SEED_YIELD blocks or crops by rank, a chance for the seed back, a chance for gems); an unripe plant is
// never harmed. Everything that changes the bag or the wallet goes through ledger.applyChange. Pure.

import { BUILD_CELL, PLANT_ROOMS, PLANT_SPROUT_SHARE, SEED_YIELD, SPLICE_BONUS_CHANCE, SOIL_STYLE } from './config.ts';
import { blockReachOf, bonusesOf, growMsScaled, harvestQtyOf, blockHitCooldownOf, plantCapOf, seedBackChanceOf } from './skillRules.ts';
import type { Bonuses } from './stats.ts';
import { cellProblem, inReach, roomOf, withRoom, type BlockContext, type BlockProblem } from './blocks.ts';
import { getBlockType } from './blockTypes.ts';
import { getFurnitureType, type FurnitureLookup } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { gemDrop } from './gems.ts';
import { applyChange } from './ledger.ts';
import { grantXp } from './xp.ts';
import { CROP_TYPES, isSeedId } from './materials.ts';
import { isFoodSeed, seedGrowMs, seedGrows, seedRank } from './seeds.ts';
import { pairKey } from './spliceData.ts';
import { recipeFor, spliceGrowMs } from './splice.ts';
import { rngInt } from './rng.ts';
import { blockInCell, blockKey, cellOnFloor, floorStyleAt, plantInCell, plantList, type Plant, type Room } from './room.ts';
import type { FurnitureItem, MaterialId, Point, Rng, SeedId } from './types.ts';

export type PlantStage = 'sprout' | 'small' | 'full';

// ---------- What a seed is (seeds.ts) ----------

export { seedGrows, seedGrowMs, seedProduct, seedRank } from './seeds.ts';

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

/**
 * Why this seed may not go into this cell now (null = it may). Does not look at the bag. Step SG4: a seed goes on a soil
 * cell (farm) or on a BLOCK cell (the host stays, the plant sits on its top face) in a hotel, tavern or farm. A food crop
 * (isFoodSeed) needs soil or a block with soilHost. PLANTS_ROOM_CAP plants per room. `seed` is optional: without it only
 * the cell is judged (the client's tint and tap checks), with it also the food rule.
 */
export function plantProblem(
  room: Room,
  items: readonly FurnitureItem[],
  c: number,
  r: number,
  ctx: BlockContext,
  types: FurnitureLookup = getFurnitureType,
  seed?: SeedId,
  skills?: Bonuses,
): BlockProblem | null {
  if (room.kind === 'lakeside') return 'not_buildable';
  if (!PLANT_ROOMS.includes(room.kind as (typeof PLANT_ROOMS)[number])) return 'wrong_room';
  const host = blockInCell(room, c, r);
  if (!host && cellOnFloor(room, c, r) && !isSoil(room, c, r)) return 'no_soil';
  if (host && seed !== undefined && isFoodSeed(seed) && !getBlockType(host.id).soilHost) return 'needs_soil';
  const problem = cellProblem(room, items, PLANT_ROOMS, c, r, ctx, types, true);
  if (problem) return problem;
  if (plantList(room).length >= plantCapOf(room.kind as 'farm' | 'hotel' | 'shop', skills)) return 'too_many_plants';
  return null;
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
  const problem = plantProblem(room, state.items, c, r, ctx, types, seed, bonusesOf(state.player));
  if (problem) return { ok: false, problem };
  const paid = applyChange(state, { reason: 'plant', materials: { [seed]: -1 }, note: `${seed}@${blockKey(c, r)}` }, at);
  if (!paid) return { ok: false, problem: 'empty' };
  const plant: Plant = { seed, plantedAt: at, readyAt: at + growMsScaled(seedGrowMs(seed), bonusesOf(state.player)) }; // Green thumb
  return { ok: true, state: withRoom(paid, { ...room, plants: { ...room.plants, [blockKey(c, r)]: plant } }) };
}

// ---------- Splicing (step BG7) ----------

export type SpliceSeedResult = { ok: true; state: GameState } | { ok: false; problem: BlockProblem };

/**
 * Uses a second seed on a planted cell: the cell then grows the pair's new seed for the longer of the two grow
 * times plus SPLICE_BONUS_MS (the clock restarts now). Refused with nothing taken: 'nothing_happens' (the pair is
 * not in the table, or it is the same seed twice: both seeds stay), 'already_spliced', 'ripe' (harvest it first),
 * 'no_plant', 'empty'. Only the room's owner. The seed is used up through the ledger (reason 'splice').
 */
export function spliceSeed(state: GameState, roomId: number, c: number, r: number, seed: string, at: number): SpliceSeedResult {
  const room = roomOf(state, roomId);
  if (!room || room.ownerId !== state.player.id) return { ok: false, problem: 'not_owner' };
  if (!Number.isInteger(c) || !Number.isInteger(r) || !isSeedId(seed)) return { ok: false, problem: 'no_plant' };
  const plant = plantInCell(room, c, r);
  if (!plant) return { ok: false, problem: 'no_plant' };
  if (plant.with) return { ok: false, problem: 'already_spliced' };
  if (isRipe(plant, at)) return { ok: false, problem: 'ripe' };
  if ((state.player.materials[seed] ?? 0) < 1) return { ok: false, problem: 'empty' };
  const recipe = recipeFor(plant.seed, seed);
  if (!recipe) return { ok: false, problem: 'nothing_happens' };
  const paid = applyChange(state, { reason: 'splice', materials: { [seed]: -1 }, note: `${plant.seed}+${seed}@${blockKey(c, r)}` }, at);
  if (!paid) return { ok: false, problem: 'empty' };
  const spliced: Plant = { seed: plant.seed, with: seed, plantedAt: at, readyAt: at + spliceGrowMs(plant.seed, seed, bonusesOf(state.player)) };
  return { ok: true, state: withRoom(paid, { ...room, plants: { ...room.plants, [blockKey(c, r)]: spliced } }) };
}

// ---------- Harvest ----------

export interface HarvestRoll {
  /** What grew: a block, a crop or another good (null: furniture, clothes, or nothing from a splice). */
  item: MaterialId | null;
  qty: number;
  /** Furniture type id that grew (a furniture seed), or null. */
  furniture: string | null;
  /** Clothing id that grew (a clothes seed; unlocked forever), or null. */
  clothing: string | null;
  /** True = the seed comes back too (never for a splice: its seed is the result). */
  seedBack: boolean;
  gems: number;
  /** A spliced plant: the NEW seed it gives, and the pair key of the recipe (the Book's found list). */
  result: SeedId | null;
  recipe: string | null;
}

/**
 * What a fully grown plant gives. Plain plant: rolls in this order: the amount (blocks, crops, goods; furniture and
 * clothes are always one), the seed back, the gems. A spliced plant gives its NEW seed (one), a small chance
 * (SPLICE_BONUS_CHANCE) of one block or crop of either seed (rolls: the chance, which of the two), and gems
 * (source 'splice', the result's rank). Clothes already unlocked always give the seed back (nothing is wasted).
 */
export function harvestPlant(plant: Plant, rng: Rng, unlockedClothing: readonly string[] = [], skills?: Bonuses): HarvestRoll {
  if (plant.with) {
    const result = recipeFor(plant.seed, plant.with)?.result ?? null;
    let item: MaterialId | null = null;
    if (rng() < SPLICE_BONUS_CHANCE) {
      const g = seedGrows(rng() < 0.5 ? plant.seed : plant.with);
      if (g.kind === 'material') item = g.id;
    }
    const gems = result ? gemDrop('splice', seedRank(result), rng) : 0;
    return { item, qty: item ? 1 : 0, furniture: null, clothing: null, seedBack: false, gems, result, recipe: pairKey(plant.seed, plant.with) };
  }
  const rank = seedRank(plant.seed);
  const grows = seedGrows(plant.seed);
  const y = SEED_YIELD[rank];
  const qty = grows.kind === 'material' ? harvestQtyOf(rngInt(rng, y.min, y.max), skills, rng) : 1; // Bountiful
  let seedBack = rng() < seedBackChanceOf(skills); // Seed keeper
  if (grows.kind === 'clothing' && unlockedClothing.includes(grows.id)) seedBack = true;
  return {
    item: grows.kind === 'material' ? grows.id : null,
    qty,
    furniture: grows.kind === 'furniture' ? grows.id : null,
    clothing: grows.kind === 'clothing' ? grows.id : null,
    seedBack,
    gems: gemDrop('harvest', rank, rng, skills),
    result: null,
    recipe: null,
  };
}

export type HitPlantResult =
  | { ok: false; problem: BlockProblem; leftMs?: number }
  | { ok: true; state: GameState; roll: HarvestRoll; seed: SeedId };

/**
 * One punch at the plant in a cell. Needs the owner, a plant and reach. A plant that is not fully grown is
 * left alone (problem 'unripe', with the time left): a tap can never destroy it. 'cooldown' (nothing changes)
 * when the last punch was under BLOCK_HIT_COOLDOWN_MS ago. A grown plant is harvested: the plant goes, the
 * cell is free again, the result goes through the ledger (reason 'harvest', or 'splice' for a spliced plant;
 * a found recipe is added to Player.splicesFound, a clothes seed unlocks its piece).
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
  if (from && !inReach(from, c, r, blockReachOf(bonusesOf(state.player)))) return { ok: false, problem: 'reach' };
  if (!isRipe(plant, at)) return { ok: false, problem: 'unripe', leftMs: readyInMs(plant, at) };
  if (at - lastHitAt < blockHitCooldownOf(bonusesOf(state.player))) return { ok: false, problem: 'cooldown' };
  const roll = harvestPlant(plant, rng, state.player.unlockedClothing, bonusesOf(state.player));
  const materials: Partial<Record<MaterialId, number>> = {};
  if (roll.item && roll.qty > 0) materials[roll.item] = roll.qty;
  if (roll.result) materials[roll.result] = (materials[roll.result] ?? 0) + 1;
  if (roll.seedBack) materials[plant.seed] = (materials[plant.seed] ?? 0) + 1;
  const paid = applyChange(
    state,
    {
      reason: roll.result ? 'splice' : 'harvest',
      materials,
      ...(roll.furniture ? { addFurniture: [roll.furniture] } : {}),
      ...(roll.gems > 0 ? { gems: roll.gems } : {}),
      note: `${plant.seed}${plant.with ? `+${plant.with}` : ''}@${blockKey(c, r)}`,
    },
    at,
  );
  if (!paid) return { ok: false, problem: 'no_plant' };
  const plants = { ...room.plants };
  delete plants[blockKey(c, r)];
  let player = paid.player;
  if (roll.clothing && !player.unlockedClothing.includes(roll.clothing)) player = { ...player, unlockedClothing: [...player.unlockedClothing, roll.clothing] };
  if (roll.recipe && !player.splicesFound.includes(roll.recipe)) player = { ...player, splicesFound: [...player.splicesFound, roll.recipe] };
  // SK-2: xp by the seed's rank, plus a bonus the first time a splice result seed is made.
  let done = grantXp(withRoom({ ...paid, player }, { ...room, plants }), { t: 'harvest', rank: seedRank(plant.seed) }, at);
  if (roll.result && state.player.seen[roll.result] === undefined) done = grantXp(done, { t: 'splice_first' }, at);
  return { ok: true, state: done, roll, seed: plant.seed };
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

/** Painting the farm floor: a cell that holds a plant (not on a block) stays soil (the plant must not float on grass). */
export function keepSoilUnderPlants(room: Room): Room {
  let next = room;
  for (const { c, r } of plantList(room)) {
    if (blockInCell(room, c, r)) continue; // a plant on a block host: the soil below does not matter
    if (floorStyleAt(next, c, r) !== SOIL_STYLE) {
      const painted = { ...(next.floorCells ?? {}), [blockKey(c, r)]: SOIL_STYLE };
      next = { ...next, floorCells: painted };
    }
  }
  return next;
}
