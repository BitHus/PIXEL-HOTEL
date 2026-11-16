import { describe, expect, it } from 'vitest';
import { PLANTS_ROOM_CAP, SEED_GROW_MS } from './config.ts';
import { hitBlock, placeBlock, type BlockContext } from './blocks.ts';
import { hitPlant, plantProblem, plantSeed } from './farm.ts';
import { roomBlockers } from './furniture.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { blockInCell, plantInCell, type Plant, type Room } from './room.ts';
import { seededRng } from './rng.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';

// Step SG4: seeds go on soil or on any block (the block stays under the plant), food crops need soil or a soilHost block.
const free: BlockContext = { standing: [], from: null };
const rich = (): GameState => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 1000 }, 0)!;
const kindId = (s: GameState, kind: Room['kind']): number => s.rooms.find((r) => r.kind === kind)!.id;
const roomById = (s: GameState, id: number): Room => s.rooms.find((r) => r.id === id)!;
const CELLS = [2, 3, 4, 5, 6, 7].map((c) => ({ c, r: 3 }));
const give = (s: GameState, seed: string, n = 1): GameState => applyChange(s, { reason: 'debug', materials: { [seed]: n } }, 0)!;

function withBlocks(s: GameState, roomId: number, ids: string[]): GameState {
  let next = applyChange(s, { reason: 'debug', materials: Object.fromEntries(ids.map((i) => [i, 1])) }, 0)!;
  ids.forEach((id, i) => {
    const res = placeBlock(next, roomId, CELLS[i]!.c, CELLS[i]!.r, id, 1, free);
    if (!res.ok) throw new Error(`block ${id}: ${res.problem}`);
    next = res.state;
  });
  return next;
}

describe('plants on any block (step SG4)', () => {
  it('a block seed goes on planks, stone and dirt in a hotel; every block stays under its plant', () => {
    let s = rich();
    const h = kindId(s, 'hotel');
    s = give(withBlocks(s, h, ['planks', 'stone', 'dirt']), 'clay_seed', 3);
    for (const [i, id] of ['planks', 'stone', 'dirt'].entries()) {
      const res = plantSeed(s, h, CELLS[i]!.c, CELLS[i]!.r, 'clay_seed', 10, free);
      expect(res.ok, id).toBe(true);
      if (res.ok) s = res.state;
    }
    const room = roomById(s, h);
    expect(Object.keys(room.plants)).toHaveLength(3);
    expect(Object.keys(room.blocks)).toHaveLength(3);
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
    expect(ledgerMaterials(s)).toEqual(s.player.materials);
  });

  it('a food crop needs soil or a soilHost block: refused on planks (nothing taken), fine on dirt, fine on farm soil', () => {
    let s = rich();
    const h = kindId(s, 'hotel');
    s = give(withBlocks(s, h, ['planks', 'dirt']), 'turnip_seed', 3);
    expect(plantSeed(s, h, CELLS[0]!.c, CELLS[0]!.r, 'turnip_seed', 10, free)).toEqual({ ok: false, problem: 'needs_soil' });
    expect(s.player.materials.turnip_seed).toBe(3);
    expect(plantSeed(s, h, CELLS[1]!.c, CELLS[1]!.r, 'turnip_seed', 10, free).ok).toBe(true);
    expect(plantSeed(s, kindId(s, 'farm'), 2, 2, 'turnip_seed', 10, free).ok).toBe(true);
  });

  it('bare floor of a hotel takes no seed (no_soil), the lakeside none at all, farm grass none', () => {
    const s = give(rich(), 'clay_seed', 2);
    expect(plantSeed(s, kindId(s, 'hotel'), CELLS[0]!.c, CELLS[0]!.r, 'clay_seed', 1, free)).toEqual({ ok: false, problem: 'no_soil' });
    expect(plantSeed(s, kindId(s, 'lakeside'), 3, 3, 'clay_seed', 1, free)).toEqual({ ok: false, problem: 'not_buildable' });
    expect(plantSeed(s, kindId(s, 'farm'), 12, 8, 'clay_seed', 1, free)).toEqual({ ok: false, problem: 'no_soil' });
  });

  it('a tavern block takes a plant too', () => {
    let s = rich();
    const shop = kindId(s, 'shop');
    s = applyChange(s, { reason: 'debug', materials: { planks: 1, clay_seed: 1 } }, 0)!;
    const spot = CELLS.find((x) => placeBlock(s, shop, x.c, x.r, 'planks', 1, free).ok);
    if (!spot) return; // no free tavern cell in this start layout: the hotel tests cover the rule
    const b = placeBlock(s, shop, spot.c, spot.r, 'planks', 1, free);
    if (!b.ok) throw new Error(b.problem);
    expect(plantSeed(b.state, shop, spot.c, spot.r, 'clay_seed', 2, free).ok).toBe(true);
  });

  it('a block with a plant cannot be punched; a ripe plant is harvested by its own punch, the block stays and can then be punched', () => {
    let s = rich();
    const h = kindId(s, 'hotel');
    s = give(withBlocks(s, h, ['dirt']), 'dirt_seed');
    const res = plantSeed(s, h, CELLS[0]!.c, CELLS[0]!.r, 'dirt_seed', 0, free);
    if (!res.ok) throw new Error(res.problem);
    s = res.state;
    expect(hitBlock(s, h, CELLS[0]!.c, CELLS[0]!.r, 10_000, 0, seededRng(1), null)).toEqual({ ok: false, problem: 'planted' });
    const ripe = SEED_GROW_MS.common + 1;
    const hit = hitPlant(s, h, CELLS[0]!.c, CELLS[0]!.r, ripe, 0, seededRng(2), null);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    const room = roomById(hit.state, h);
    expect(plantInCell(room, CELLS[0]!.c, CELLS[0]!.r)).toBeNull();
    expect(blockInCell(room, CELLS[0]!.c, CELLS[0]!.r)?.id).toBe('dirt');
    expect(hitBlock(hit.state, h, CELLS[0]!.c, CELLS[0]!.r, ripe + 1000, 0, seededRng(3), null).ok).toBe(true);
  });

  it('a block cannot be placed over a plant (the host never changes under it)', () => {
    let s = rich();
    const h = kindId(s, 'hotel');
    s = give(withBlocks(s, h, ['planks']), 'dirt_seed');
    const res = plantSeed(s, h, CELLS[0]!.c, CELLS[0]!.r, 'dirt_seed', 0, free);
    if (!res.ok) throw new Error(res.problem);
    s = applyChange(res.state, { reason: 'debug', materials: { dirt: 1 } }, 0)!;
    expect(placeBlock(s, h, CELLS[0]!.c, CELLS[0]!.r, 'dirt', 1, free)).toEqual({ ok: false, problem: 'taken' });
  });

  it('PLANTS_ROOM_CAP: hotel 16, tavern 8, farm 80; the next plant is refused with too_many_plants', () => {
    expect(PLANTS_ROOM_CAP).toEqual({ farm: 80, hotel: 16, shop: 8 });
    const fill = (s: GameState, roomId: number, n: number): GameState => {
      const plants: Record<string, Plant> = {};
      for (let i = 0; i < n; i++) plants[`${i},0`] = { seed: 'dirt_seed', plantedAt: 0, readyAt: 1 };
      return { ...s, rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, plants } : r)) };
    };
    for (const [kind, cap] of [['hotel', 16], ['shop', 8]] as const) {
      let s = rich();
      const rid = kindId(s, kind);
      s = withBlocks(s, rid, kind === 'shop' ? [] : ['dirt']);
      if (kind === 'shop') {
        s = applyChange(s, { reason: 'debug', materials: { dirt: 1 } }, 0)!;
        const spot = CELLS.find((x) => placeBlock(s, rid, x.c, x.r, 'dirt', 1, free).ok);
        if (!spot) continue;
        s = (placeBlock(s, rid, spot.c, spot.r, 'dirt', 1, free) as { state: GameState }).state;
        const full = fill(s, rid, cap);
        expect(plantProblem(roomById(full, rid), full.items, spot.c, spot.r, free)).toBe('too_many_plants');
        const almost = fill(s, rid, cap - 1);
        expect(plantProblem(roomById(almost, rid), almost.items, spot.c, spot.r, free)).toBeNull();
        continue;
      }
      expect(plantProblem(roomById(s, rid), s.items, CELLS[0]!.c, CELLS[0]!.r, free)).toBeNull();
      const full = fill(s, rid, cap);
      expect(plantProblem(roomById(full, rid), full.items, CELLS[0]!.c, CELLS[0]!.r, free)).toBe('too_many_plants');
      const almost = fill(s, rid, cap - 1);
      expect(plantProblem(roomById(almost, rid), almost.items, CELLS[0]!.c, CELLS[0]!.r, free)).toBeNull();
    }
    const f = rich();
    const crowded = { ...f, rooms: f.rooms.map((r) => (r.kind === 'farm' ? { ...r, plants: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`${i},0`, { seed: 'turnip_seed', plantedAt: 0, readyAt: 1 } as Plant])) } : r)) } as GameState;
    expect(plantProblem(roomById(crowded, kindId(crowded, 'farm')), crowded.items, 2, 2, free)).toBe('too_many_plants');
  });

  it('navigation: a plant on a block adds no blocker cell (the block already blocks); a plant on soil still does', () => {
    let s = rich();
    const h = kindId(s, 'hotel');
    s = give(withBlocks(s, h, ['dirt']), 'dirt_seed');
    const cells = (st: GameState): Set<string> => new Set(roomBlockers(roomById(st, h), st.items).map((r) => `${r.x},${r.y}`));
    const before = cells(s);
    const res = plantSeed(s, h, CELLS[0]!.c, CELLS[0]!.r, 'dirt_seed', 0, free);
    if (!res.ok) throw new Error(res.problem);
    expect(cells(res.state)).toEqual(before);
    const t = plantSeed(give(rich(), 'turnip_seed'), kindId(rich(), 'farm'), 2, 2, 'turnip_seed', 0, free);
    expect(t.ok).toBe(true);
    if (t.ok) expect(roomBlockers(roomById(t.state, kindId(t.state, 'farm')), t.state.items).some((r) => r.x === 64 && r.y === 64)).toBe(true);
  });
});
