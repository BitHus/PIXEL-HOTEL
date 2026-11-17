import { describe, expect, it } from 'vitest';
import { PREP_BONUS, BUILD_CELL } from './config.ts';
import { collectCook, cookYield, startCook } from './cooking.ts';
import { canPlace, footprintRect, getFurnitureType, planPlacement } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { guestZones } from './npcNav.ts';
import { applyChange } from './ledger.ts';
import { edgeAdjacent, kitchenZone, prepBonus, prepTablesFor, rectInZone } from './kitchen.ts';
import { buildNavGrid } from './nav.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { npcGrid, npcPath } from './npcNav.ts';
import { ROOM_SHAPES, roomAtLevel, shapesFor, floorRects, rectInsideFloor } from './room.ts';
import { tavernSeats } from './tavern.ts';
import { tavernAppeal } from './appeal.ts';
import { withItem, withTavernMachines } from './tavernTest.ts';
import { itemBlockers } from './furniture.ts';

const fresh = (shape = 'square_shop'): GameState => withTavernMachines(createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape }, 0));
const roomOf = (s: GameState) => s.rooms.find((r) => r.id === s.tavern.roomId)!;
const stoveOf = (s: GameState) => s.items.find((i) => i.typeId === 'stove')!;
const crops = (s: GameState): GameState => applyChange(s, { reason: 'debug', materials: { turnip: 20 } }, 0)!;

describe('the kitchen zone (step T1, data)', () => {
  it('every tavern shape has a zone for each of its 3 levels; each level contains the one before', () => {
    for (const shape of shapesFor('shop')) {
      expect(shape.kitchen, shape.id).toHaveLength(3);
      for (let l = 1; l < 3; l++) {
        const a = shape.kitchen![l - 1]!;
        const b = shape.kitchen![l]!;
        expect(b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h, `${shape.id} level ${l + 1}`).toBe(true);
      }
    }
  });

  it('the zone is a corner next to the bar: it holds the start stove and no other start item; it lies on the floor', () => {
    for (const shape of shapesFor('shop')) {
      const s = fresh(shape.id);
      for (const level of [1, 2, 3] as const) {
        const room = roomAtLevel(roomOf(s), level);
        const zone = kitchenZone(room)!;
        expect(zone, `${shape.id} ${level}`).not.toBeNull();
        expect(rectInsideFloor(room, zone), `${shape.id} ${level} on the floor`).toBe(true);
        // The zone grows by whole cells.
        expect(zone.x % BUILD_CELL === 0 && zone.w % BUILD_CELL === 0).toBe(true);
      }
      const zone = kitchenZone(roomOf(s))!;
      const inside = s.items.filter((i) => i.roomId === s.tavern.roomId && i.onItemUid === null && rectInZone(zone, footprintRect(i, getFurnitureType(i.typeId)))).map((i) => i.typeId);
      expect(inside, shape.id).toEqual(['stove']);
    }
  });

  it('only a tavern has one: no zone for a hotel, a farm or a missing room', () => {
    const s = fresh();
    expect(kitchenZone(undefined)).toBeNull();
    expect(kitchenZone(s.rooms.find((r) => r.kind === 'hotel'))).toBeNull();
    expect(kitchenZone(s.rooms.find((r) => r.kind === 'farm'))).toBeNull();
    expect(ROOM_SHAPES.filter((x) => x.kind === 'hotel').every((x) => x.kitchen === undefined)).toBe(true);
  });
});

describe('guests never enter the kitchen (nav)', () => {
  it('the nav grid for guests blocks every cell of the zone, the player\'s grid does not', () => {
    const s = fresh();
    const room = roomOf(s);
    const zone = kitchenZone(room)!;
    const grid = buildNavGrid(room, itemBlockers(s.items, room.id));
    const g = npcGrid(grid, guestZones(s.items, room));
    for (let r = zone.y / BUILD_CELL; r < (zone.y + zone.h) / BUILD_CELL; r++) {
      for (let c = zone.x / BUILD_CELL; c < (zone.x + zone.w) / BUILD_CELL; c++) {
        expect(g.blocked[r * g.cols + c], `${c},${r} guests`).toBe(true);
      }
    }
    // The owner's own avatar may walk in (only the stove's cell is blocked by the stove itself).
    const free = (zone.y / BUILD_CELL) * grid.cols + zone.x / BUILD_CELL + 1;
    expect(grid.blocked[free]).toBeFalsy();
  });

  it('a guest path to a point in the kitchen ends outside it', () => {
    const s = fresh();
    const room = roomOf(s);
    const zone = kitchenZone(room)!;
    const grid = npcGrid(buildNavGrid(room, itemBlockers(s.items, room.id)), guestZones(s.items, room));
    const door = { x: room.w / 2, y: room.h - 16 };
    const path = npcPath(grid, door, { x: zone.x + 48, y: zone.y + 48 });
    for (const p of path) expect(p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h, `${p.x},${p.y}`).toBe(false);
  });

  it('a stool in the kitchen is no tavern seat; the same stool outside is', () => {
    let s = fresh();
    const zone = kitchenZone(roomOf(s))!;
    // A prep table (a surface, so a table) with a stool north of it, both inside the zone.
    s = withItem(s, 69, 'prep_table', 288, 96);
    s = withItem(s, 70, 'bar_stool', 272, 64, 'down');
    const stool = s.items.find((i) => i.uid === 70)!;
    expect(rectInZone(zone, footprintRect(stool, getFurnitureType('bar_stool')))).toBe(true);
    expect(tavernSeats(s.items, s.tavern.roomId, null).filter((k) => k.uid === 70)).toHaveLength(1); // a seat without the zone rule
    expect(tavernSeats(s.items, s.tavern.roomId, zone).filter((k) => k.uid === 70)).toEqual([]);
    // The same stool outside the zone (next to a table there) is a seat.
    const out = withItem(withItem(s, 71, 'long_table', 480, 320), 72, 'bar_stool', 448, 288);
    expect(tavernSeats(out.items, out.tavern.roomId, zone).some((k) => k.uid === 72)).toBe(true);
  });

  it('the seat cache follows the zone when the room levels up (same items, a bigger zone)', () => {
    const s = fresh();
    const room1 = roomOf(s);
    const a = tavernSeats(s.items, s.tavern.roomId, kitchenZone(room1));
    const b = tavernSeats(s.items, s.tavern.roomId, kitchenZone(roomAtLevel(room1, 3)));
    expect(a.length).toBe(b.length); // the start seats are all outside the biggest zone too
    expect(a).not.toBe(b);
  });

  it('the owner may build in the kitchen: furniture and the prep table can be placed in it', () => {
    const s = fresh();
    const room = roomOf(s);
    const zone = kitchenZone(room)!;
    expect(canPlace(room, s.items, getFurnitureType('prep_table'), zone.x + 96, zone.y + 96, 'down')).toBe(true);
    expect(canPlace(room, s.items, getFurnitureType('pantry'), zone.x + 64, zone.y + 64, 'down')).toBe(true);
  });
});

describe('prep tables add dishes to a batch (step T1)', () => {
  const addTable = (s: GameState, uid: number, x: number, y: number, facing: 'down' | 'right' = 'down'): GameState => withItem(s, uid, 'prep_table', x, y, facing);

  it('the stove stands in the zone and starts without a bonus', () => {
    const s = crops(fresh());
    const room = roomOf(s);
    expect(prepBonus(s.items, room, stoveOf(s).uid)).toBe(0);
    const c = startCook(s, stoveOf(s).uid, 'roasted_turnip', 2, 0)!;
    expect(c.tavern.cooks[0]).toMatchObject({ qty: 2 });
    expect(c.tavern.cooks[0]!.bonus).toBeUndefined();
    expect(collectCook(c, stoveOf(s).uid, 1e9)!.qty).toBe(2);
  });

  it('a prep table next to the stove inside the zone: +1 dish; the inputs stay those of the batch you chose', () => {
    let s = crops(fresh());
    s = addTable(s, 80, 288, 96); // right of the stove (cells 8-9, row 2)
    const room = roomOf(s);
    expect(prepTablesFor(s.items, room, stoveOf(s).uid).map((i) => i.uid)).toEqual([80]);
    expect(prepBonus(s.items, room, stoveOf(s).uid)).toBe(PREP_BONUS.perTable);
    const started = startCook(s, stoveOf(s).uid, 'roasted_turnip', 2, 0)!;
    expect(started.player.materials.turnip).toBe(20 - 2); // 1 turnip per dish: only the 2 you chose are used
    expect(cookYield(started.tavern.cooks[0]!)).toBe(3);
    const got = collectCook(started, stoveOf(s).uid, 1e9)!;
    expect(got.qty).toBe(3);
    expect(got.state.player.materials.roasted_turnip).toBe(3);
    expect(got.state.ledger.at(-1)).toMatchObject({ reason: 'cook', materials: { roasted_turnip: 3 } });
  });

  it('not next to the stove: no bonus (a gap, or only a corner touching)', () => {
    let s = crops(fresh());
    s = addTable(s, 80, 320, 96); // x 288..352: a one-cell gap after the stove, and partly out of the zone
    s = addTable(s, 81, 288, 64); // x 256..320, y 32..64: touches the stove at a corner only
    expect(prepBonus(s.items, roomOf(s), stoveOf(s).uid)).toBe(0);
    expect(edgeAdjacent({ x: 224, y: 64, w: 32, h: 32 }, { x: 256, y: 32, w: 64, h: 32 })).toBe(false);
    expect(edgeAdjacent({ x: 224, y: 64, w: 32, h: 32 }, { x: 256, y: 64, w: 64, h: 32 })).toBe(true);
  });

  it('next to the stove but outside the zone: no bonus; a stove outside the zone works without one', () => {
    let s = crops(fresh());
    // South of the stove is outside the level 1 zone (rows 0..2).
    s = addTable(s, 80, 256, 128);
    expect(prepBonus(s.items, roomOf(s), stoveOf(s).uid)).toBe(0);
    // Level 2 grows the zone (rows 0..3): the same table counts now.
    expect(prepBonus(s.items, roomAtLevel(roomOf(s), 2), stoveOf(s).uid)).toBe(1);
    // A second stove in the middle of the room, with a table touching it: it still cooks, with no bonus.
    s = withItem(s, 90, 'stove', 400, 224);
    s = addTable(s, 91, 464, 224);
    expect(prepBonus(s.items, roomOf(s), 90)).toBe(0);
    const c = startCook(s, 90, 'roasted_turnip', 2, 0)!;
    expect(collectCook(c, 90, 1e9)!.qty).toBe(2);
  });

  it('at most PREP_BONUS.max extra dishes however many tables stand there', () => {
    let s = crops(fresh());
    s = addTable(s, 80, 288, 96); // east
    s = addTable(s, 81, 240, 64, 'right'); // north (32 wide, 64 deep)
    s = addTable(s, 82, 256, 128); // south (inside the level 2 zone)
    const room2 = roomAtLevel(roomOf(s), 2);
    expect(prepTablesFor(s.items, room2, stoveOf(s).uid)).toHaveLength(3);
    expect(prepBonus(s.items, room2, stoveOf(s).uid)).toBe(PREP_BONUS.max);
    expect(PREP_BONUS.max).toBe(2);
    expect(prepBonus(s.items, roomOf(s), stoveOf(s).uid)).toBe(2); // east and north at level 1
  });

  it('the bonus is fixed when the batch starts: moving the table afterwards does not change it', () => {
    let s = crops(fresh());
    s = addTable(s, 80, 288, 96);
    const started = startCook(s, stoveOf(s).uid, 'roasted_turnip', 1, 0)!;
    const moved: GameState = { ...started, items: started.items.filter((i) => i.uid !== 80) };
    expect(collectCook(moved, stoveOf(s).uid, 1e9)!.qty).toBe(2);
  });

  it('a prep table in a hotel room or the bag counts for nothing', () => {
    let s = crops(fresh());
    s = addTable(s, 80, 288, 96);
    const bag: GameState = { ...s, items: s.items.map((i) => (i.uid === 80 ? { ...i, roomId: null } : i)) };
    expect(prepBonus(bag.items, roomOf(bag), stoveOf(bag).uid)).toBe(0);
    expect(floorRects(roomOf(s)).length).toBeGreaterThan(0);
  });

  it('kitchen pieces are catalog items for the tavern only, and count for appeal (each type at most 3 times)', () => {
    for (const id of ['prep_table', 'pantry', 'sink', 'serving_hatch', 'register', 'tap_stand']) {
      const t = getFurnitureType(id);
      expect(t.placeIn, id).toBe('shop');
      expect(t.inCatalog, id).toBe(true);
      expect(t.appeal, id).toBeGreaterThan(0);
    }
    expect(['prep_table', 'pantry', 'sink', 'serving_hatch'].every((id) => getFurnitureType(id).kitchen === true)).toBe(true);
    expect(planPlacement(roomOf(fresh()), [], getFurnitureType('prep_table'), 0, 0, 'down').ok).toBe(false); // off the floor
    // Appeal: each kitchen type counts, but a type at most 3 times.
    const s = fresh();
    const room = roomOf(s);
    const base = tavernAppeal(room, s.items);
    let more = s;
    for (let k = 0; k < 5; k++) more = withItem(more, 100 + k, 'sink', 160 + 32 * k, 320);
    expect(tavernAppeal(room, more.items)).toBe(base + 3 * getFurnitureType('sink').appeal);
    expect(tavernAppeal(room, withItem(s, 99, 'pantry', 480, 160).items)).toBe(base + getFurnitureType('pantry').appeal);
  });
});
