// Step T1b: the kitchen zone (per shape and level, staff only for guests), the kitchen pieces, and the prep bonus of a stove.

import { describe, expect, it } from 'vitest';
import { PREP_BONUS } from './config.ts';
import { tavernAppeal } from './appeal.ts';
import { collectCook, prepBonus, returnOrphanCooks, startCook } from './cooking.ts';
import { footprintRect, getFurnitureType, itemBlockers, canPlace } from './furniture.ts';
import { applyChange } from './ledger.ts';
import { buildNavGrid, isCellFree } from './nav.ts';
import { inStaffZone, npcGrid, npcPath, staffZones } from './npcNav.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { ROOM_SHAPES, createRoom, kitchenRect, rectInsideFloor, shapesFor } from './room.ts';
import { seededRng } from './rng.ts';
import { tavernSeats } from './tavern.ts';
import { runTavern, stock, tavernWorld, withItem } from './tavernTest.ts';
import type { GameState } from './gameState.ts';
import type { Rect } from './types.ts';

const shops = ROOM_SHAPES.filter((s) => s.shopStart);
const newGame = (shape: string): GameState => createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape }, 0);
const roomOf = (s: GameState) => s.rooms.find((r) => r.id === s.tavern.roomId)!;
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the kitchen zone (step T1b)', () => {
  it('every shop shape has one rectangle per level, growing: each contains the one before, the stove of level 1 stands in it', () => {
    expect(shops.map((s) => s.id).sort()).toEqual(shapesFor('shop').filter((s) => s.shopStart).map((s) => s.id).sort());
    for (const shape of shops) {
      expect(shape.kitchen, shape.id).toHaveLength(3);
      const rects = [1, 2, 3].map((level) => kitchenRect({ kind: 'shop', shape: shape.id, level: level as 1 | 2 | 3 })!);
      for (let k = 1; k < 3; k++) {
        const a = rects[k - 1]!;
        const b = rects[k]!;
        expect(a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h, `${shape.id} level ${k + 1}`).toBe(true);
      }
      const stove = shape.shopStart!.stove;
      expect(stove.x - 16 >= rects[0]!.x && stove.x + 16 <= rects[0]!.x + rects[0]!.w && stove.y - 32 >= rects[0]!.y && stove.y <= rects[0]!.y + rects[0]!.h, `${shape.id} stove`).toBe(true);
    }
    expect(kitchenRect({ kind: 'hotel', shape: 'square', level: 1 })).toBeNull();
  });

  it('lies on the floor at every level and never on the door zone, the bar, the stools, the round table or the barrel of a new game', () => {
    for (const shape of shops) {
      const s = newGame(shape.id);
      for (const level of [1, 2, 3] as const) {
        const room = createRoom(s.tavern.roomId, 'shop', level, 1, shape.id);
        const zone = kitchenRect(room)!;
        expect(rectInsideFloor(room, zone), `${shape.id} L${level} on the floor`).toBe(true);
        for (const i of s.items.filter((x) => x.roomId === room.id && x.onItemUid === null && x.typeId !== 'stove')) {
          expect(overlap(footprintRect(i, getFurnitureType(i.typeId)), zone), `${shape.id} L${level} ${i.typeId}`).toBe(false);
        }
      }
    }
  });

  it('is staff only for guests: their grid blocks it, nobody sits in it, no table in it is a table, and a day of guests never sets foot in it', () => {
    for (const shape of shops) {
      let s = newGame(shape.id);
      const room = roomOf(s);
      const zone = kitchenRect(room)!;
      const zones = staffZones(s.items, room.id, room);
      expect(zones).toContainEqual(zone);
      expect(staffZones(s.items, room.id)).not.toContainEqual(zone); // without the room it is the counter's zone only
      const grid = npcGrid(buildNavGrid(room, itemBlockers(s.items, room.id)), zones);
      for (let y = zone.y; y < zone.y + zone.h; y += 32) for (let x = zone.x; x < zone.x + zone.w; x += 32) expect(isCellFree(grid, x / 32, y / 32), `${shape.id} ${x},${y}`).toBe(false);
      // The walk to a point inside it ends outside it.
      const walk = npcPath(grid, { x: room.w / 2, y: room.h - 16 }, { x: zone.x + 16, y: zone.y + 16 });
      expect(walk.some((p) => inStaffZone([zone], p))).toBe(false);
      // Still three reachable seats, none in the kitchen.
      const seats = tavernSeats(s.items, room.id, room);
      expect(seats, shape.id).toHaveLength(3);
      expect(seats.some((k) => inStaffZone([zone], k))).toBe(false);
      // A long evening of guests: nobody is ever inside the zone.
      const rng = seededRng(21);
      s = stock(s, 'root_ale', 40);
      let inside = 0;
      runTavern(s, 0, 25 * 60_000, rng, true, (x) => {
        for (const g of x.tavern.guests) if (g.x >= zone.x && g.x <= zone.x + zone.w && g.y >= zone.y && g.y <= zone.y + zone.h) inside++;
      });
      expect(inside, shape.id).toBe(0);
    }
  });

  it('a prep table inside the kitchen is nobody\'s table: a stool next to it is not a tavern seat', () => {
    const s0 = newGame('square_shop');
    const room = roomOf(s0);
    // A prep table at the zone's edge (cols 8..9, row 3) and a bar stool just outside it (col 10, row 3).
    let s = withItem(s0, 70, 'prep_table', 288, 128);
    s = withItem(s, 71, 'bar_stool', 336, 128);
    expect(tavernSeats(s.items, room.id, room).some((k) => k.uid === 71)).toBe(false);
    expect(tavernSeats(s.items, room.id).some((k) => k.uid === 71)).toBe(true); // without the zone (no room given) it would be
  });

  it('grows with the room: level 2 and 3 zones are bigger', () => {
    const s = newGame('square_shop');
    const sizes = [1, 2, 3].map((level) => kitchenRect({ kind: 'shop', shape: 'square_shop', level: level as 1 | 2 | 3 })!).map((r) => r.w * r.h);
    expect(sizes[0]! < sizes[1]! && sizes[1]! < sizes[2]!).toBe(true);
    expect(roomOf(s).level).toBe(1);
  });
});

describe('the kitchen pieces (step T1b)', () => {
  it('prep_table is a surface, pantry, sink and serving_hatch are plain decor, all shop catalog pieces with appeal', () => {
    expect(getFurnitureType('prep_table')).toMatchObject({ surface: true, placeIn: 'shop', inCatalog: true });
    for (const id of ['pantry', 'sink', 'serving_hatch']) expect(getFurnitureType(id), id).toMatchObject({ surface: false, onSurface: false, blocks: true, placeIn: 'shop', inCatalog: true });
    for (const id of ['prep_table', 'pantry', 'sink', 'serving_hatch']) expect(getFurnitureType(id).appeal, id).toBeGreaterThan(0);
  });
  it('counts for appeal, each type at most 3 times', () => {
    const s0 = newGame('square_shop');
    const room = roomOf(s0);
    const base = tavernAppeal(room, s0.items);
    // Four sinks far from the bar: only three count.
    let s = s0;
    for (let k = 0; k < 4; k++) s = withItem(s, 80 + k, 'sink', 48 + k * 64, 288);
    expect(tavernAppeal(room, s.items)).toBe(base + 3 * getFurnitureType('sink').appeal);
  });
  it('are placed in the tavern only', () => {
    const s = newGame('square_shop');
    const hotel = s.rooms.find((r) => r.kind === 'hotel')!;
    for (const id of ['prep_table', 'pantry', 'sink', 'serving_hatch']) expect(canPlace(hotel, [], getFurnitureType(id), 160, 160, 'down'), id).toBe(false);
  });
});

describe('the prep bonus (step T1b, config PREP_BONUS)', () => {
  const stove = (s: GameState) => s.items.find((i) => i.typeId === 'stove')!;
  const cookable = (s: GameState): GameState => applyChange(s, { reason: 'debug', materials: { turnip: 20 } }, 1)!;

  it('starts at 0; a prep table cell-adjacent to the stove inside the zone adds 1, two add 2, never more than the max', () => {
    let s = newGame('square_shop');
    const room = roomOf(s);
    expect(prepBonus(s.items, room, stove(s))).toBe(0);
    s = withItem(s, 90, 'prep_table', 288, 96); // right of the stove (cols 8..9, row 2)
    expect(prepBonus(s.items, room, stove(s))).toBe(1);
    s = withItem(s, 91, 'prep_table', 256, 128); // below it (cols 7..8, row 3)
    expect(prepBonus(s.items, room, stove(s))).toBe(2);
    expect(PREP_BONUS.max).toBe(2);
    s = withItem(s, 92, 'prep_table', 320, 160); // a third inside the zone but not touching the stove
    expect(prepBonus(s.items, room, stove(s))).toBe(2);
  });
  it('only adjacent and only inside the zone: a table one cell away, a diagonal one, one outside the zone give nothing', () => {
    const s0 = newGame('square_shop');
    const room = roomOf(s0);
    expect(prepBonus(withItem(s0, 90, 'prep_table', 352, 96).items, room, stove(s0))).toBe(0); // cols 9..10: not touching (col 8 gap) and half outside
    expect(prepBonus(withItem(s0, 90, 'prep_table', 320, 160).items, room, stove(s0))).toBe(0); // diagonal
    // Above the stove (row 1, in the back wall band cells): outside the zone, though adjacent.
    expect(prepBonus(withItem(s0, 90, 'prep_table', 256, 64).items, room, stove(s0))).toBe(0);
  });
  it('a stove outside the zone still cooks, without the bonus', () => {
    let s = newGame('square_shop');
    const room = roomOf(s);
    s = withItem(s, 95, 'stove', 400, 288); // far from the kitchen
    s = withItem(s, 96, 'prep_table', 464, 288); // right next to it, but not in the zone
    const far = s.items.find((i) => i.uid === 95)!;
    expect(prepBonus(s.items, room, far)).toBe(0);
    const started = startCook(cookable(s), 95, 'roasted_turnip', 2, 100)!;
    expect(started.tavern.cooks[0]).toEqual({ stoveUid: 95, food: 'roasted_turnip', qty: 2, readyAt: expect.any(Number) });
    expect(collectCook(started, 95, 10 ** 9)!.qty).toBe(2);
  });
  it('a batch in a kitchen with prep tables gives the bonus dishes for the crops of qty dishes; the crops refund ignores the bonus', () => {
    let s = cookable(newGame('square_shop'));
    s = withItem(s, 90, 'prep_table', 288, 96);
    s = withItem(s, 91, 'prep_table', 256, 128);
    const u = stove(s).uid;
    const turnips = s.player.materials.turnip!;
    const started = startCook(s, u, 'roasted_turnip', 2, 100)!;
    expect(turnips - started.player.materials.turnip!).toBe(2); // two dishes of crops (one turnip each)
    expect(started.tavern.cooks[0]).toMatchObject({ qty: 2, bonus: 2 });
    const got = collectCook(started, u, 10 ** 9)!;
    expect(got.qty).toBe(4); // 2 paid + 2 bonus
    expect(got.state.player.materials.roasted_turnip).toBe(4);
    // The stove is sold while cooking: the crops of the 2 paid dishes come back, not 4.
    const gone = returnOrphanCooks({ ...started, items: started.items.filter((i) => i.uid !== u) }, 200);
    expect(gone.player.materials.turnip).toBe(turnips);
    // Taking a table away later does not touch a batch that already cooks: the bonus was fixed at the start.
    const noTables = { ...started, items: started.items.filter((i) => i.typeId !== 'prep_table') };
    expect(collectCook(noTables, u, 10 ** 9)!.qty).toBe(4);
  });
});
