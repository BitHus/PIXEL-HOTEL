import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, getBlockType, type BlockType } from './blockTypes.ts';
import { approachSpot, blockDrops, blockProblem, crackStage, hitBlock, hitsNow, inReach, placeBlock, type BlockContext } from './blocks.ts';
import { BLOCK_HEAL_MS, BLOCK_HIT_COOLDOWN_MS, BLOCK_REACH, BUILD_CELL, GEM_RANK_MULT } from './config.ts';
import { buyBlocks, blockPrice, upgradeRoom } from './economy.ts';
import { behindPoint, behindReachable, doorReachesMiddle, getFurnitureType, roomBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { gainsSince } from './gains.ts';
import { blockGemDrop, gemDrop, gemPieces } from './gems.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { blockInCell, blockKey, blockList, cellOf, type Room } from './room.ts';
import { buildNavGrid, findPath, lineOfSight } from './nav.ts';
import { seededRng } from './rng.ts';
import { ledgerMaterials } from './testState.ts';
import type { Rng } from './types.ts';

const free: BlockContext = { standing: [], from: null };
const rich = (): GameState => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 1000, materials: { dirt: 60, stone: 60, planks: 5, cinder_block: 5 } }, 0)!;
const hotel = (s: GameState): Room => s.rooms.find((r) => r.id === s.player.hotelRoomId)!;
const shop = (s: GameState): Room => s.rooms.find((r) => r.id === s.player.shopRoomId)!;
const roomOf = (s: GameState, id: number): Room => s.rooms.find((r) => r.id === id)!;
/** A rng that gives these values in turn (then 0.99). */
const seq = (...v: number[]): Rng => {
  let i = 0;
  return () => v[i++] ?? 0.99;
};

function put(s: GameState, roomId: number, c: number, r: number, id = 'dirt', ctx = free): GameState {
  const res = placeBlock(s, roomId, c, r, id, 10, ctx);
  if (!res.ok) throw new Error(`placing ${id} at ${c},${r}: ${res.problem}`);
  return res.state;
}

describe('the block data', () => {
  it('has ten blocks, hardness 1 to 8, with unique ids and a rank each', () => {
    expect(BLOCK_TYPES).toHaveLength(10);
    expect(new Set(BLOCK_TYPES.map((b) => b.id)).size).toBe(10);
    expect(Math.min(...BLOCK_TYPES.map((b) => b.hardness))).toBe(1);
    expect(Math.max(...BLOCK_TYPES.map((b) => b.hardness))).toBe(8);
    for (const b of BLOCK_TYPES) {
      expect(b.hardness).toBeGreaterThanOrEqual(1);
      expect(['common', 'rare', 'ultra_rare', 'legendary']).toContain(b.rank);
      expect(b.placeIn).not.toContain('lakeside');
    }
  });
  it('the catalog sells a few of them for baseValue * 3', () => {
    const sold = BLOCK_TYPES.filter((b) => b.inCatalog);
    expect(sold.length).toBeGreaterThanOrEqual(3);
    expect(sold.length).toBeLessThan(BLOCK_TYPES.length);
    const s = buyBlocks(createNewPlayer(undefined, 0), 'dirt', 5, 1)!;
    expect(blockPrice('dirt')).toBe(getBlockType('dirt').baseValue * 3);
    expect(s.player.wallet.gold).toBe(100 - blockPrice('dirt') * 5);
    expect(s.player.materials.dirt).toBe(5);
    expect(buyBlocks(createNewPlayer(undefined, 0), 'cinder_block', 1, 1)).toBeNull(); // not in the catalog
    expect(buyBlocks(createNewPlayer(undefined, 0), 'stone', 99, 1)).toBeNull(); // too little gold
  });
});

describe('where a block may stand', () => {
  it('puts a block in a free floor cell, takes it from the bag and writes the ledger', () => {
    const s0 = rich();
    const s = put(s0, s0.player.hotelRoomId, 3, 3);
    expect(blockInCell(hotel(s), 3, 3)).toMatchObject({ id: 'dirt', hits: 0 });
    expect(s.player.materials.dirt).toBe(59);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'block_place', materials: { dirt: -1 } });
    expect(ledgerMaterials(s).dirt).toBe(59);
  });
  it('refuses cells outside the floor, on the door zone, taken ones, and with none in the bag', () => {
    const s = rich();
    const id = s.player.hotelRoomId;
    const why = (c: number, r: number, state = s, block = 'dirt'): string | null => {
      const res = placeBlock(state, id, c, r, block, 1, free);
      return res.ok ? null : res.problem;
    };
    expect(why(-1, 3)).toBe('floor');
    expect(why(18, 3)).toBe('floor');
    expect(why(3, 12)).toBe('floor');
    expect(why(8, 10)).toBe('door');
    expect(why(9, 11)).toBe('door');
    expect(why(7, 10)).toBeNull(); // next to the zone is fine
    expect(why(2, 2, put(s, id, 2, 2))).toBe('taken');
    expect(why(2, 2, s, 'brick')).toBe('empty');
    expect(why(1.5, 2)).toBe('floor');
  });
  it('refuses a cell with floor furniture, but not the cell next to it', () => {
    const s = rich();
    const id = s.player.shopRoomId;
    const counter = s.items.find((i) => i.typeId === 'counter' && i.roomId === id)!;
    const t = getFurnitureType('counter');
    const { c, r } = cellOf({ x: counter.x, y: counter.y - 1 });
    expect(blockProblem(shop(s), s.items, getBlockType('dirt'), c, r, free)).toBe('furniture');
    const w = t.w / BUILD_CELL;
    expect(blockProblem(shop(s), s.items, getBlockType('dirt'), c + w, r, free)).not.toBe('furniture');
  });
  it('refuses the cell of an avatar standing still, not the cell of a walking one', () => {
    const s = rich();
    const id = s.player.hotelRoomId;
    const at = { x: 3 * BUILD_CELL + 16, y: 3 * BUILD_CELL + 16 };
    expect(placeBlock(s, id, 3, 3, 'dirt', 1, { standing: [at], from: null })).toMatchObject({ ok: false, problem: 'avatar' });
    expect(placeBlock(s, id, 3, 3, 'dirt', 1, { standing: [], from: null })).toMatchObject({ ok: true });
  });
  it('has a reach of BLOCK_REACH cells; farther is "reach"', () => {
    const s = rich();
    const id = s.player.hotelRoomId;
    const from = { x: 5 * BUILD_CELL + 16, y: 5 * BUILD_CELL + 16 };
    expect(inReach(from, 5 + BLOCK_REACH, 5)).toBe(true);
    expect(inReach(from, 5 + BLOCK_REACH + 1, 5)).toBe(false);
    expect(inReach(from, 7, 7)).toBe(true);
    expect(placeBlock(s, id, 5 + BLOCK_REACH, 5, 'dirt', 1, { standing: [from], from })).toMatchObject({ ok: true });
    expect(placeBlock(s, id, 5 + BLOCK_REACH + 1, 5, 'dirt', 1, { standing: [from], from })).toMatchObject({ ok: false, problem: 'reach' });
  });
  it('only the owner changes a room; the lakeside and wrong rooms are refused', () => {
    const s = rich();
    const id = s.player.hotelRoomId;
    const stranger: GameState = { ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, ownerId: 99 } : r)) };
    expect(placeBlock(stranger, id, 3, 3, 'dirt', 1, free)).toMatchObject({ ok: false, problem: 'not_owner' });
    expect(hitBlock(put(s, id, 3, 3), 999, 3, 3, 100, 0, seq(), null)).toMatchObject({ ok: false, problem: 'not_owner' });
    const lake = s.rooms.find((r) => r.kind === 'lakeside')!;
    expect(placeBlock(s, lake.id, 3, 3, 'dirt', 1, free)).toMatchObject({ ok: false, problem: 'not_buildable' });
    const shopOnly = { ...getBlockType('dirt'), placeIn: ['shop'] } as BlockType;
    expect(blockProblem(hotel(s), s.items, shopOnly, 3, 3, free)).toBe('wrong_room');
    expect(blockProblem(shop(s), s.items, shopOnly, 3, 3, free)).toBeNull();
  });
  it('works in the farm (also on soil, step BG6), but not on the cooking pot', () => {
    const s = rich();
    const farm = roomOf(s, s.player.farmRoomId);
    expect(blockProblem(farm, s.items, getBlockType('dirt'), 2, 2, free)).toBeNull(); // a soil cell: a block may stand there
    expect(blockProblem(farm, s.items, getBlockType('dirt'), 14, 3, free)).toBe('fixed'); // the pot (464, 128)
    expect(blockProblem(farm, s.items, getBlockType('dirt'), 8, 8, free)).toBeNull();
  });
});

describe('blocks block walking', () => {
  it('walkers go around a block, and a one-cell gap between blocks is walkable', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    for (let c = 0; c < 18; c++) if (c !== 9) s = put(s, id, c, 5);
    const grid = buildNavGrid(hotel(s), roomBlockers(hotel(s), s.items));
    const from = { x: 3 * 32 + 16, y: 8 * 32 + 16 };
    const to = { x: 3 * 32 + 16, y: 2 * 32 + 16 };
    expect(lineOfSight(grid, from, to)).toBe(false); // the wall is in the way
    const path = findPath(grid, from, to);
    expect(path).not.toBeNull();
    // The only way through is the gap in column 9: no step of the path touches a block.
    for (let i = 1; i < path!.length; i++) expect(lineOfSight(grid, path![i - 1]!, path![i]!)).toBe(true);
    expect(Math.max(...path!.map((p) => p.x))).toBeGreaterThan(9 * 32);
  });
  it('a placement that shuts the door off from the middle is refused; the room stays open', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    const problems: (string | null)[] = [];
    for (let c = 0; c < 18; c++) {
      const res = placeBlock(s, id, c, 9, 'dirt', 1, free);
      problems.push(res.ok ? null : res.problem);
      if (res.ok) s = res.state;
    }
    expect(problems.slice(0, 17).every((p) => p === null)).toBe(true);
    expect(problems[17]).toBe('door_blocked');
    expect(doorReachesMiddle(hotel(s), roomBlockers(hotel(s), s.items))).toBe(true);
    expect(blockList(hotel(s))).toHaveLength(17);
  });
  it('the spot behind the counter must stay reachable', () => {
    let s = rich();
    const id = s.player.shopRoomId;
    const counter = s.items.find((i) => i.typeId === 'counter' && i.roomId === id)!;
    const t = getFurnitureType('counter');
    const b = behindPoint(counter, t);
    const centre = cellOf(b);
    const ring: { c: number; r: number }[] = [];
    for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) ring.push({ c: centre.c + dc, r: centre.r + dr });
    ring.sort((p, q) => Math.hypot(p.c - centre.c, p.r - centre.r) - Math.hypot(q.c - centre.c, q.r - centre.r));
    const why = new Set<string>();
    for (const { c, r } of ring) {
      const res = placeBlock(s, id, c, r, 'dirt', 1, free);
      if (res.ok) s = res.state;
      else why.add(res.problem);
    }
    expect(why.has('counter_blocked') || why.has('door_blocked')).toBe(true);
    expect(behindReachable(shop(s), roomBlockers(shop(s), s.items), behindPoint(counter, t))).toBe(true);
    expect(doorReachesMiddle(shop(s), roomBlockers(shop(s), s.items))).toBe(true);
  });
  it('the tavern: the last block that would cut a reachable seat off from the door is refused (seat_blocked)', () => {
    // The left stool of the start tavern stands on cell (12, 5); the table is on columns 13-14, rows 5-6.
    // Its free neighbours are the six cells below; with all six shut, no guest could get within reach of the seat.
    let st = rich();
    const id = st.player.shopRoomId;
    const ring = [[11, 4], [12, 4], [13, 4], [11, 5], [11, 6], [12, 6]] as const;
    for (const [c, r] of ring.slice(0, 5)) st = put(st, id, c, r, 'dirt');
    const [c, r] = ring[5];
    const res = placeBlock(st, id, c, r, 'dirt', 1, free);
    expect(res).toEqual({ ok: false, problem: 'seat_blocked' });
    // A block that cuts nothing off is still allowed somewhere else.
    const others = Array.from({ length: 12 }, (_, k) => placeBlock(st, id, 3 + k, 9, 'dirt', 1, free));
    expect(others.some((o) => o.ok)).toBe(true);
  });
  it('furniture cannot be put on a block (the blockers include the blocks)', () => {
    const s0 = rich();
    const s = put(s0, s0.player.hotelRoomId, 4, 4);
    expect(roomBlockers(hotel(s), s.items).some((r) => r.x === 4 * 32 && r.y === 4 * 32)).toBe(true);
  });
});

describe('punching', () => {
  it('breaks after `hardness` hits, one per tap, cooldown BLOCK_HIT_COOLDOWN_MS apart', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    let s = put(s0, id, 3, 3, 'stone');
    const hardness = getBlockType('stone').hardness;
    expect(hardness).toBe(4);
    let last = -Infinity;
    for (let n = 1; n < hardness; n++) {
      const at = 1000 + n * BLOCK_HIT_COOLDOWN_MS;
      const r = hitBlock(s, id, 3, 3, at, last, seq(), null);
      expect(r).toMatchObject({ ok: true, kind: 'cracked', hits: n, hardness });
      if (r.ok) s = r.state;
      last = at;
      expect(blockInCell(hotel(s), 3, 3)?.hits).toBe(n);
    }
    const final = hitBlock(s, id, 3, 3, 1000 + hardness * BLOCK_HIT_COOLDOWN_MS, last, seq(0.1, 0.99, 0.99, 0.99), null);
    expect(final).toMatchObject({ ok: true, kind: 'broken' });
    if (!final.ok || final.kind !== 'broken') return;
    expect(blockInCell(hotel(final.state), 3, 3)).toBeNull();
    // The block came back to the bag (the first roll was low).
    expect(final.state.player.materials.stone).toBe(60);
    expect(final.state.ledger.at(-1)).toMatchObject({ reason: 'block_break' });
  });
  it('a hardness 1 block breaks with one hit', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    const r = hitBlock(put(s0, id, 3, 3, 'dirt'), id, 3, 3, 1000, 0, seq(), null);
    expect(r).toMatchObject({ ok: true, kind: 'broken' });
  });
  it('a hit inside the cooldown does nothing; a tap on an empty cell is refused', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    const s = put(s0, id, 3, 3, 'stone');
    expect(hitBlock(s, id, 3, 3, 1000 + BLOCK_HIT_COOLDOWN_MS - 1, 1000, seq(), null)).toEqual({ ok: false, problem: 'cooldown' });
    expect(hitBlock(s, id, 3, 3, 1000 + BLOCK_HIT_COOLDOWN_MS, 1000, seq(), null)).toMatchObject({ ok: true, kind: 'cracked' });
    expect(hitBlock(s, id, 4, 4, 1000, 0, seq(), null)).toEqual({ ok: false, problem: 'no_block' });
  });
  it('needs reach', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    const s = put(s0, id, 3, 3, 'stone');
    const far = { x: 15 * 32 + 16, y: 8 * 32 + 16 };
    expect(hitBlock(s, id, 3, 3, 1000, 0, seq(), far)).toEqual({ ok: false, problem: 'reach' });
  });
  it('a block that was left alone heals; crack stages go from 0 up', () => {
    const cell = { id: 'stone' as const, hits: 3, hitAt: 1000 };
    expect(hitsNow(cell, 1000 + BLOCK_HEAL_MS)).toBe(3);
    expect(hitsNow(cell, 1000 + BLOCK_HEAL_MS + 1)).toBe(0);
    expect(crackStage({ ...cell, hits: 0 }, 4, 1000)).toBe(0);
    expect(crackStage({ ...cell, hits: 1 }, 4, 1000)).toBe(1);
    expect(crackStage({ ...cell, hits: 3 }, 4, 1000)).toBe(3);
    expect(crackStage(cell, 4, 1000 + BLOCK_HEAL_MS + 5)).toBe(0);
  });
  it('a hit after healing starts again from one', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    let s = put(s0, id, 3, 3, 'stone');
    for (const at of [1000, 1300, 1600]) {
      const r = hitBlock(s, id, 3, 3, at, at - 300, seq(), null);
      if (r.ok) s = r.state;
    }
    expect(blockInCell(hotel(s), 3, 3)?.hits).toBe(3);
    const r = hitBlock(s, id, 3, 3, 1600 + BLOCK_HEAL_MS + 100, 1600, seq(), null);
    expect(r).toMatchObject({ ok: true, kind: 'cracked', hits: 1 });
  });
});

describe('drops (rng passed in)', () => {
  it('every part is its own roll: nothing, block, seed, both', () => {
    // stone has no seed; dirt does. Rolls: block, seed, (extras), gem chance.
    expect(blockDrops(getBlockType('dirt'), seq(0.99, 0.99, 0.99))).toEqual({ materials: {}, gems: 0 });
    expect(blockDrops(getBlockType('dirt'), seq(0.1, 0.99, 0.99)).materials).toEqual({ dirt: 1 });
    expect(blockDrops(getBlockType('dirt'), seq(0.99, 0.01, 0.99)).materials).toEqual({ dirt_seed: 1 });
    expect(blockDrops(getBlockType('dirt'), seq(0.1, 0.01, 0.99)).materials).toEqual({ dirt: 1, dirt_seed: 1 });
  });
  it('gems follow after the item rolls, by rank', () => {
    // planks (common): block 0.5 hit, seed none, wood 0.05 hit, gem 0.01 hit, amount 0 -> min 1.
    expect(blockDrops(getBlockType('planks'), seq(0.5, 0.99, 0.05, 0.01, 0))).toEqual({ materials: { planks: 1, wood: 1 }, gems: 1 });
  });
  it('rarer blocks drop more gems, up to 12 for legendary (the max per rank is in config BLOCK_DROPS)', () => {
    expect(blockGemDrop('common', seq(0, 0.99))).toBe(2);
    expect(blockGemDrop('rare', seq(0, 0.99))).toBe(4);
    expect(blockGemDrop('ultra_rare', seq(0, 0.99))).toBe(8);
    expect(blockGemDrop('legendary', seq(0, 0.99))).toBe(12);
    expect(blockGemDrop('legendary', seq(0.99, 0))).toBe(0);
  });
  it('gem pieces add up and use the colour of their tier', () => {
    for (let n = 0; n <= 25; n++) expect(gemPieces(n).reduce((a, p) => a + p.value, 0)).toBe(n);
    expect(gemPieces(7).map((p) => p.value)).toEqual([5, 1, 1]);
    expect(gemPieces(10)).toHaveLength(1);
    expect(new Set(gemPieces(16).map((p) => p.colors.join()))).toHaveProperty('size', 3);
  });
  it('gems get the rank bonus', () => {
    expect(gemDrop('block', 'common', seq(0, 0))).toBe(1);
    expect(gemDrop('block', 'ultra_rare', seq(0, 0.99))).toBe(2 * GEM_RANK_MULT.ultra_rare);
    expect(gemDrop('block', 'legendary', seq(0.5, 0))).toBe(0);
  });
  it('gems and items go through the ledger and show in the gains list', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    const s1 = put(s0, id, 3, 3, 'planks');
    // Planks take 3 hits; here a soft copy so one hit breaks it (the rolls are what is tested).
    const r = hitBlock(s1, id, 3, 3, 1000, 0, seq(0.5, 0.99, 0.05, 0.01, 0), null, (b) => ({ ...getBlockType(b), hardness: 1 }));
    expect(r).toMatchObject({ ok: true, kind: 'broken' });
    if (!r.ok) return;
    expect(r.state.player.wallet.gems).toBe(1);
    expect(r.state.ledger.at(-1)).toMatchObject({ reason: 'block_break', gemsDelta: 1, materials: { planks: 1, wood: 1 } });
    expect(r.state.ledger.reduce((a, e) => a + (e.gemsDelta ?? 0), 0)).toBe(r.state.player.wallet.gems);
    expect(ledgerMaterials(r.state).planks).toBe(r.state.player.materials.planks);
    expect(gainsSince(s1, r.state)).toEqual([
      { itemId: 'planks', count: 1, rank: 'common' },
      { itemId: 'wood', count: 1, rank: 'common' },
      { itemId: 'gems', count: 1, rank: 'common' },
    ]);
  });
  it('place then break many times never creates or loses blocks', () => {
    const s0 = rich();
    const id = s0.player.hotelRoomId;
    let s = s0;
    const rng = seededRng(5);
    let t = 0;
    for (let i = 0; i < 40; i++) {
      s = put(s, id, 2, 2, 'stone');
      for (let h = 0; h < 4; h++) {
        t += BLOCK_HIT_COOLDOWN_MS;
        const r = hitBlock(s, id, 2, 2, t, t - BLOCK_HIT_COOLDOWN_MS, rng, null);
        if (r.ok) s = r.state;
      }
    }
    // The block only comes back by chance now: never more than we had, and the room ends empty.
    expect(s.player.materials.stone).toBeLessThanOrEqual(60);
    expect(s.player.materials.stone).toBeGreaterThan(20);
    expect(blockList(hotel(s))).toHaveLength(0);
  });
});

describe('a room upgrade', () => {
  it('blocks on soil stay put when the farm grows (the plots are gone since BG6)', () => {
    const s0 = rich();
    const farmId = s0.player.farmRoomId;
    const s1 = put(s0, farmId, 8, 2, 'stone');
    expect(blockInCell(roomOf(s1, farmId), 8, 2)).not.toBeNull();
    const up = upgradeRoom(s1, farmId, 5)!;
    expect(blockInCell(roomOf(up, farmId), 8, 2)).not.toBeNull();
    expect(up.player.materials.stone).toBe(59);
    expect(blockKey(8, 2)).toBe('8,2');
  });
});

describe('walking closer', () => {
  it('finds the free cell nearest to the avatar that is well inside the reach of a far cell', () => {
    const s = rich();
    const grid = buildNavGrid(hotel(s), roomBlockers(hotel(s), s.items));
    const from = { x: 2 * 32 + 16, y: 2 * 32 + 16 };
    const spot = approachSpot(grid, from, 12, 2)!;
    expect(spot).not.toBeNull();
    expect(Math.hypot(spot.x - (12 * 32 + 16), spot.y - (2 * 32 + 16))).toBeLessThanOrEqual((BLOCK_REACH - 1) * 32);
    expect(inReach(spot, 12, 2)).toBe(true);
    // The nearest such cell is 2 cells from the target on the avatar's side: column 10.
    expect(Math.floor(spot.x / 32)).toBe(10);
  });
  it('goes around a wall to a cell near the target', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    for (let r = 0; r < 12; r++) if (r < 10) s = put(s, id, 6, r);
    const grid = buildNavGrid(hotel(s), roomBlockers(hotel(s), s.items));
    // The wall at column 6 spans rows 0-9; rows 10-11 stay open, so the left side is reachable around the bottom.
    expect(approachSpot(grid, { x: 15 * 32 + 16, y: 2 * 32 + 16 }, 1, 2)).not.toBeNull();
  });
});
