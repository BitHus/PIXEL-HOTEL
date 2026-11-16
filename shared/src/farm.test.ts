import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, BUILD_CELL, FARM_START_SOIL, SEED_BACK_CHANCE, SEED_GROW_MS, SEED_YIELD, SOIL_STYLE } from './config.ts';
import { blockProblem, placeBlock, type BlockContext } from './blocks.ts';
import { getBlockType } from './blockTypes.ts';
import { buySeeds, farmCounts, growthStage, harvestPlant, hitPlant, isSoil, plantProblem, plantSeed, readyInMs, seedGrowMs, seedProduct, seedRank, soilCells } from './farm.ts';
import { fixedBlockers, noPlaceRects } from './farmLayout.ts';
import { CROP_TYPES, getMaterialType, isSeedId } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { paintFloor, upgradeRoom } from './economy.ts';
import { readSave, toSaveText } from './save.ts';
import { canPlace, getFurnitureType, roomBlockers } from './furniture.ts';
import { plantInCell, type Plant, type Room } from './room.ts';
import { seededRng } from './rng.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';
import type { Rng } from './types.ts';

const MIN = 60_000;
const free: BlockContext = { standing: [], from: null };
const rich = (gold = 1000): GameState => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold }, 0)!;
const farmRoom = (s: GameState): Room => s.rooms.find((r) => r.id === s.player.farmRoomId)!;
const farmId = (s: GameState): number => s.player.farmRoomId;
const ledgerAddsUp = (s: GameState): void => {
  expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  expect(ledgerMaterials(s)).toEqual(s.player.materials);
};
/** A rng that gives these values in turn (then 0.99). */
const seq = (...v: number[]): Rng => {
  let i = 0;
  return () => v[i++] ?? 0.99;
};
// A soil cell of the start patch, and one next to it that is soil too.
const SOIL = { c: FARM_START_SOIL.c, r: FARM_START_SOIL.r };

function planted(seed = 'turnip_seed', at = 1000, cell = SOIL): GameState {
  const s = applyChange(rich(), { reason: 'debug', materials: { [seed]: 5 } }, 0)!;
  const res = plantSeed(s, farmId(s), cell.c, cell.r, seed, at, free);
  if (!res.ok) throw new Error(res.problem);
  return res.state;
}

describe('seeds (step BG6)', () => {
  it('every block and every crop has a seed item with a seed icon, and grows what it is named after', () => {
    for (const c of CROP_TYPES) {
      expect(isSeedId(c.seed)).toBe(true);
      expect(seedProduct(c.seed)).toBe(c.id);
      expect(getMaterialType(c.seed).icon.shape).toBe('seed');
    }
    for (const id of ['dirt', 'stone', 'glass', 'cinder_block'] as const) {
      const seed = getBlockType(id).seedId!;
      expect(seed).toBe(`${id}_seed`);
      expect(isSeedId(seed)).toBe(true);
      expect(seedProduct(seed as never)).toBe(id);
      expect(getMaterialType(seed).icon.shape).toBe('seed');
    }
  });

  it('grow time follows the rank of what grows: minutes, tens of minutes, hours, longer', () => {
    expect(seedRank('turnip_seed')).toBe('common');
    expect(seedGrowMs('turnip_seed')).toBe(SEED_GROW_MS.common);
    expect(SEED_GROW_MS.common).toBeLessThanOrEqual(2 * MIN); // the first harvest of a starter seed
    expect(seedGrowMs('pumpkin_seed')).toBe(SEED_GROW_MS.rare);
    expect(seedGrowMs('glowcap_spore')).toBe(SEED_GROW_MS.ultra_rare);
    expect(seedGrowMs('cinder_block_seed' as never)).toBe(SEED_GROW_MS.ultra_rare);
    expect(SEED_GROW_MS.common).toBeLessThan(SEED_GROW_MS.rare);
    expect(SEED_GROW_MS.rare).toBeLessThan(SEED_GROW_MS.ultra_rare);
    expect(SEED_GROW_MS.ultra_rare).toBeLessThan(SEED_GROW_MS.legendary);
  });

  it('seeds cost their price in the catalog (basic crop seeds); the glowcap spore is not for sale', () => {
    expect(buySeeds(rich(0), 'pumpkin_seed', 7, 0)).toBeNull(); // 105 gold, 100 in the wallet
    expect(buySeeds(rich(), 'glowcap_spore', 1, 0)).toBeNull();
    expect(buySeeds(rich(), 'dirt_seed', 1, 0)).toBeNull(); // block seeds come from drops, not the shop
    expect(buySeeds(rich(), 'turnip_seed', 0, 0)).toBeNull();
    expect(buySeeds(rich(0), 'carrot_seed', 5, 0)?.player.wallet.gold).toBe(60);
  });
});

describe('soil', () => {
  it('a new farm starts with a patch of soil cells; the rest is grass', () => {
    const room = farmRoom(rich());
    expect(soilCells(room)).toHaveLength(FARM_START_SOIL.w * FARM_START_SOIL.h);
    expect(isSoil(room, SOIL.c, SOIL.r)).toBe(true);
    expect(isSoil(room, 0, 0)).toBe(false);
    expect(room.floorStyle).toBe('grass');
  });

  it('seeds go on soil or a block: bare grass, the bare hotel floor and the lakeside refuse', () => {
    const s = applyChange(rich(), { reason: 'debug', materials: { turnip_seed: 3 } }, 0)!;
    expect(plantSeed(s, farmId(s), 12, 8, 'turnip_seed', 1, free)).toEqual({ ok: false, problem: 'no_soil' });
    expect(plantSeed(s, s.player.hotelRoomId, 4, 4, 'turnip_seed', 1, free)).toEqual({ ok: false, problem: 'no_soil' });
    expect(plantSeed(s, s.player.lakesideRoomId, 4, 4, 'turnip_seed', 1, free)).toEqual({ ok: false, problem: 'not_buildable' });
    expect(plantSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 1, free)).toMatchObject({ ok: true });
  });

  it('soil is free to add and remove with the paint tool, but a cell under a plant stays soil', () => {
    let s = planted();
    const id = farmId(s);
    const grass = paintFloor(s, id, { c: 10, r: 8 }, { c: 11, r: 9 }, SOIL_STYLE)!;
    expect(soilCells(farmRoom(grass))).toHaveLength(FARM_START_SOIL.w * FARM_START_SOIL.h + 4);
    expect(grass.player.wallet.gold).toBe(s.player.wallet.gold); // free
    expect(paintFloor(s, id, { c: 1, r: 1 }, { c: 1, r: 1 }, 'wood_planks')).toBeNull(); // a farm paints soil and grass only
    // Remove the whole starter patch: the planted cell stays soil.
    s = paintFloor(s, id, { c: 0, r: 0 }, { c: 17, r: 11 }, 'grass')!;
    expect(soilCells(farmRoom(s))).toEqual([SOIL]);
    expect(paintFloor(rich(), rich().player.hotelRoomId, { c: 3, r: 3 }, { c: 3, r: 3 }, SOIL_STYLE)).toBeNull(); // not in the hotel
  });
});

describe('planting', () => {
  it('puts the seed in the cell, takes it from the bag, and the ledger adds up', () => {
    const s = planted('turnip_seed', 1000);
    const plant = plantInCell(farmRoom(s), SOIL.c, SOIL.r)!;
    expect(plant).toEqual({ seed: 'turnip_seed', plantedAt: 1000, readyAt: 1000 + SEED_GROW_MS.common });
    expect(s.player.materials.turnip_seed).toBe(4);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'plant' });
    ledgerAddsUp(s);
  });

  it('one plant per cell; needs the seed in the bag; only the owner', () => {
    const s = planted();
    expect(plantSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 2000, free)).toEqual({ ok: false, problem: 'taken' });
    const none = rich();
    expect(plantSeed(none, farmId(none), SOIL.c, SOIL.r, 'turnip_seed', 1, free)).toEqual({ ok: false, problem: 'empty' });
    expect(plantSeed(none, farmId(none), SOIL.c, SOIL.r, 'turnip' as never, 1, free)).toMatchObject({ ok: false });
    const other = { ...s, rooms: s.rooms.map((r) => (r.id === farmId(s) ? { ...r, ownerId: 999 } : r)) };
    expect(plantSeed(other, farmId(s), SOIL.c + 1, SOIL.r, 'turnip_seed', 1, free)).toEqual({ ok: false, problem: 'not_owner' });
  });

  it('a plant blocks its cell like a small block: no block on it, no walking, no plant under an avatar', () => {
    const s = planted();
    const room = farmRoom(s);
    const dirt = getBlockType('dirt');
    expect(blockProblem(room, s.items, dirt, SOIL.c, SOIL.r, free)).toBe('taken');
    expect(roomBlockers(room, s.items).some((r) => r.x === SOIL.c * BUILD_CELL && r.y === SOIL.r * BUILD_CELL)).toBe(true);
    const standing: BlockContext = { standing: [{ x: (SOIL.c + 1.5) * BUILD_CELL, y: (SOIL.r + 0.5) * BUILD_CELL }], from: null };
    const t = applyChange(s, { reason: 'debug', materials: { dirt_seed: 1 } }, 0)!;
    expect(plantSeed(t, farmId(t), SOIL.c + 1, SOIL.r, 'dirt_seed', 5, standing)).toEqual({ ok: false, problem: 'avatar' });
    // A block cannot be placed over a plant; a plant may go on a block (step SG4, the host stays).
    const withBlock = placeBlock(applyChange(t, { reason: 'debug', materials: { dirt: 2 } }, 0)!, farmId(t), SOIL.c + 2, SOIL.r, 'dirt', 5, free);
    expect(withBlock.ok).toBe(true);
    if (!withBlock.ok) return;
    expect(plantProblem(farmRoom(withBlock.state), withBlock.state.items, SOIL.c + 2, SOIL.r, free)).toBeNull();
    expect(plantProblem(farmRoom(s), s.items, SOIL.c, SOIL.r, free)).toBe('taken'); // the plant itself fills its cell
  });

  it('the farm has no fixed blockers any more (the pot is gone, step K1): its old cell takes soil and a plant', () => {
    const s = rich();
    const room = farmRoom(s);
    expect(fixedBlockers(room)).toEqual([]);
    expect(noPlaceRects(room)).toEqual([]);
    const oldPot = { c: 14, r: 3 }; // where the pot stood (x 448 to 480, y 96 to 128)
    const soiled = paintFloor(s, farmId(s), oldPot, oldPot, SOIL_STYLE)!;
    expect(plantProblem(farmRoom(soiled), soiled.items, oldPot.c, oldPot.r, free)).toBeNull();
  });

  it('never on the door zone or furniture; reach is checked last', () => {
    const s = rich();
    const room = farmRoom(s);
    expect(plantProblem(room, s.items, SOIL.c, SOIL.r, { standing: [], from: { x: 500, y: 300 } })).toBe('reach');
    expect(plantProblem(room, s.items, SOIL.c, SOIL.r, { standing: [], from: { x: (SOIL.c + 0.5) * 32, y: (SOIL.r + 0.5) * 32 } })).toBeNull();
  });

  it('decorations go around and on soil, also where the pot stood', () => {
    const s = rich();
    const room = farmRoom(s);
    const plant = getFurnitureType('plant');
    expect(canPlace(room, s.items, plant, 496, 320, 'down')).toBe(true);
    expect(canPlace(room, s.items, plant, 464, 128, 'down')).toBe(true);
    expect(canPlace(room, s.items, getFurnitureType('shelf'), 480, 320, 'down')).toBe(false); // shop furniture does not go on the farm
    expect(roomBlockers(room, s.items)).toEqual([]);
  });
});

describe('growth in real time', () => {
  const plant: Plant = { seed: 'turnip_seed', plantedAt: 1_000_000, readyAt: 1_000_000 + 2 * MIN };

  it('has 3 stages: sprout, small plant, fully grown', () => {
    expect(growthStage(plant, 1_000_000)).toBe('sprout');
    expect(growthStage(plant, 1_000_000 + MIN - 1)).toBe('sprout');
    expect(growthStage(plant, 1_000_000 + MIN)).toBe('small');
    expect(growthStage(plant, 1_000_000 + 2 * MIN - 1)).toBe('small');
    expect(growthStage(plant, 1_000_000 + 2 * MIN)).toBe('full');
    expect(growthStage(plant, 1_000_000 + 999 * MIN)).toBe('full'); // no rotting
    expect(readyInMs(plant, 1_000_000 + 30_000)).toBe(90_000);
    expect(readyInMs(plant, 1_000_000 + 10 * MIN)).toBe(0);
  });

  it('keeps growing while the game is closed: only the times are saved, a reload gives the same stages', () => {
    const s = planted('turnip_seed', 5000);
    const loaded = readSave(toSaveText(s, 6000));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const p = plantInCell(farmRoom(loaded.state), SOIL.c, SOIL.r)!;
    expect(growthStage(p, 5000 + 30_000)).toBe('sprout');
    expect(growthStage(p, 5000 + 90_000)).toBe('small');
    expect(growthStage(p, 5000 + 10 * 3_600_000)).toBe('full'); // hours later, the game was closed
  });
});

describe('harvest by punching', () => {
  const ripeAt = 1000 + SEED_GROW_MS.common;

  it('an unripe plant is left alone: nothing changes and it says how long is left', () => {
    const s = planted('turnip_seed', 1000);
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ripeAt - 1, 0, seededRng(1), null);
    expect(r).toEqual({ ok: false, problem: 'unripe', leftMs: 1 });
    expect(plantInCell(farmRoom(s), SOIL.c, SOIL.r)).not.toBeNull();
    // Even a flurry of punches cannot destroy it.
    for (let t = 0; t < 20; t++) expect(hitPlant(s, farmId(s), SOIL.c, SOIL.r, 2000 + t * 300, 0, seededRng(t), null)).toMatchObject({ ok: false, problem: 'unripe' });
  });

  it('a grown plant is harvested in one punch, the cell is free again, and it all goes through the ledger', () => {
    const s = planted('turnip_seed', 1000);
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ripeAt, 0, seq(0.5, 0.9, 0.9), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(plantInCell(farmRoom(r.state), SOIL.c, SOIL.r)).toBeNull();
    expect(r.roll).toMatchObject({ item: 'turnip', qty: 3, seedBack: false, gems: 0 });
    expect(r.state.player.materials.turnip).toBe(3);
    expect(r.state.player.materials.turnip_seed).toBe(4); // 5 - 1 planted, none back
    expect(r.state.ledger.at(-1)).toMatchObject({ reason: 'harvest' });
    ledgerAddsUp(r.state);
    // The cell takes a new seed.
    expect(plantSeed(r.state, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', ripeAt + 1, free)).toMatchObject({ ok: true });
  });

  it('rolls with a fixed rng: amount by rank, the seed back by chance, gems by chance', () => {
    const turnip: Plant = { seed: 'turnip_seed', plantedAt: 0, readyAt: 1 };
    // rng order: amount, seed back, gems (chance, then size).
    expect(harvestPlant(turnip, seq(0, 0, 0, 0))).toMatchObject({ item: 'turnip', qty: SEED_YIELD.common.min, seedBack: true, gems: 1 });
    expect(harvestPlant(turnip, seq(0.99, SEED_BACK_CHANCE, 0.99))).toMatchObject({ item: 'turnip', qty: SEED_YIELD.common.max, seedBack: false, gems: 0 });
    const cinder: Plant = { seed: 'cinder_block_seed' as never, plantedAt: 0, readyAt: 1 };
    const roll = harvestPlant(cinder, seq(0.99, 0.99, 0, 0));
    expect(roll.item).toBe('cinder_block');
    expect(roll.qty).toBe(SEED_YIELD.ultra_rare.max);
    expect(roll.gems).toBe(4); // 1 gem * the ultra_rare multiplier
    // Every rank stays inside 1 to 4.
    for (const y of Object.values(SEED_YIELD)) {
      expect(y.min).toBeGreaterThanOrEqual(1);
      expect(y.max).toBeLessThanOrEqual(4);
    }
  });

  it('a block seed grows blocks; the seed can come back and gems can drop', () => {
    const s = planted('stone_seed', 1000);
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, 1000 + SEED_GROW_MS.common, 0, seq(0, 0, 0, 0), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.player.materials.stone).toBe(SEED_YIELD.common.min);
    expect(r.state.player.materials.stone_seed).toBe(5); // 5 - 1 + 1 back
    expect(r.state.player.wallet.gems).toBe(1);
    ledgerAddsUp(r.state);
  });

  it('refuses out of reach, the cooldown, an empty cell and a stranger\'s farm', () => {
    const s = planted('turnip_seed', 1000);
    const at = ripeAt;
    expect(hitPlant(s, farmId(s), SOIL.c, SOIL.r, at, 0, seededRng(1), { x: 500, y: 330 })).toEqual({ ok: false, problem: 'reach' });
    expect(hitPlant(s, farmId(s), SOIL.c, SOIL.r, at, at - BLOCK_HIT_COOLDOWN_MS + 1, seededRng(1), null)).toEqual({ ok: false, problem: 'cooldown' });
    expect(hitPlant(s, farmId(s), SOIL.c + 1, SOIL.r, at, 0, seededRng(1), null)).toEqual({ ok: false, problem: 'no_plant' });
    const other = { ...s, rooms: s.rooms.map((r) => (r.id === farmId(s) ? { ...r, ownerId: 999 } : r)) };
    expect(hitPlant(other, farmId(s), SOIL.c, SOIL.r, at, 0, seededRng(1), null)).toEqual({ ok: false, problem: 'not_owner' });
  });

  it('counts ripe, growing and free soil for the Map card', () => {
    const s = planted('turnip_seed', 1000);
    const t = plantSeed(s, farmId(s), SOIL.c + 1, SOIL.r, 'turnip_seed', 1000 + MIN, free);
    if (!t.ok) throw new Error(t.problem);
    const total = FARM_START_SOIL.w * FARM_START_SOIL.h;
    expect(farmCounts(farmRoom(t.state), 1000 + 2 * MIN)).toEqual({ ripe: 1, growing: 1, free: total - 2 });
  });
});

describe('upgrading the farm', () => {
  it('costs 200, then 600 gold through the ledger; soil and plants stay; the room grows', () => {
    const s = planted('turnip_seed', 5);
    const id = farmId(s);
    const up = upgradeRoom(s, id, 6)!;
    expect(up.player.wallet.gold).toBe(s.player.wallet.gold - 200);
    expect(up.ledger.at(-1)).toMatchObject({ reason: 'room_upgrade', goldDelta: -200 });
    expect(farmRoom(up)).toMatchObject({ level: 2, w: 704, h: 480 });
    expect(soilCells(farmRoom(up))).toEqual(soilCells(farmRoom(s)));
    expect(plantInCell(farmRoom(up), SOIL.c, SOIL.r)).toEqual(plantInCell(farmRoom(s), SOIL.c, SOIL.r));
    const top = upgradeRoom(up, id, 7)!;
    expect(top.player.wallet.gold).toBe(up.player.wallet.gold - 600);
    expect(upgradeRoom(top, id, 8)).toBeNull();
    ledgerAddsUp(top);
  });
});
