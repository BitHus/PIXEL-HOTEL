// The tavern's OPEN kitchen annex (owner 18 Nov): attached floor below the tavern, no partition and no doorway, staff only for guests;
// geometry, size against the old annex, nav, placing, and the compact start layout.
import { describe, expect, it } from 'vitest';
import { behindPoint, behindReachable, canPlace, doorPoint, footprintRect, getFurnitureType, itemBlockers, roomBlockers } from './furniture.ts';
import { KITCHEN_FLOOR_STYLE } from './config.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { buildNavGrid, cellAt, isCellFree, reachableCells } from './nav.ts';
import { annexRectOf, createRoom, doorRect, doorZoneRect, floorRects, floorStyleAt, rectsOverlap, roomAnnex, shapesFor } from './room.ts';
import { kitchenZone } from './kitchen.ts';
import { guestZones, npcGrid } from './npcNav.ts';
import { innDoorSpotRects, innDoorSpots } from './innDoors.ts';
import { upgradeRoom } from './economy.ts';

const LEVELS = [1, 2, 3] as const;
const shopShapes = shapesFor('shop').filter((s) => s.shopStart);
/** The annex areas (cells) of the partition-wall annex (save 39), per shape and level: the new annex must be at least 1.5 times as big (owner: the kitchen is too small). */
const OLD_AREA: Record<string, number[]> = { square_shop: [20, 30, 35], long: [16, 25, 30], l_shape: [20, 30, 35], plus: [20, 25, 30], wide_hall: [20, 30, 35] };

describe('the open kitchen annex', () => {
  it('only a tavern has one; hotel, farm and a missing room have none', () => {
    expect(roomAnnex(undefined)).toBeNull();
    expect(roomAnnex(createRoom(1, 'hotel', 1, 1))).toBeNull();
    expect(roomAnnex(createRoom(1, 'farm', 1, 1, 'farm'))).toBeNull();
    const hotelLong = createRoom(1, 'hotel', 1, 1, 'long');
    const tavernLong = createRoom(2, 'shop', 1, 1, 'long');
    expect(floorRects(tavernLong).length).toBe(floorRects(hotelLong).length + 1);
    expect(tavernLong.h).toBeGreaterThan(hotelLong.h);
  });

  it('on every shape and level (KITCHEN-ABOVE, 19 Nov): sits ABOVE the main floor, touches other floor only along its bottom edge, stays clear of the main door and the Inn doors, is 1.5x or more of the old size and never shrinks', () => {
    for (const sh of shopShapes) {
      let last = 0;
      for (const l of LEVELS) {
        const room = createRoom(1, 'shop', l, 1, sh.id);
        const a = roomAnnex(room)!;
        const tag = `${sh.id} L${l}`;
        expect(annexRectOf(sh.id, l), tag).toEqual(a);
        const main = floorRects(room).filter((r) => !(r.x === a.x && r.y === a.y && r.w === a.w && r.h === a.h));
        for (const m of main) expect(rectsOverlap(m, a), `${tag} overlap`).toBe(false);
        expect(a.y, tag).toBe(0);
        expect(main.some((m) => m.y === a.y + a.h && m.x <= a.x && m.x + m.w >= a.x + a.w), `${tag} attached above one rectangle`).toBe(true);
        const side = { x: a.x - 1, y: a.y, w: a.w + 2, h: a.h - 32 };
        for (const m of main) expect(rectsOverlap(m, side), `${tag} touches a side`).toBe(false);
        expect(rectsOverlap(a, doorZoneRect(room)), `${tag} door zone`).toBe(false);
        expect(rectsOverlap(a, doorRect(room)), `${tag} main door`).toBe(false);
        // the cellar stairs are in the kitchen back wall; the suite and garden doors stay out of it
        expect(innDoorSpots(room).filter((d) => d.id !== 'tavern_to_cellar').some((d) => rectsOverlap(a, d.spot)), `${tag} inn door`).toBe(false);
        const cells = (a.w / 32) * (a.h / 32);
        expect(cells, `${tag} size`).toBeGreaterThanOrEqual(OLD_AREA[sh.id]![l - 1]! * 1.5);
        expect(cells, `${tag} never shrinks`).toBeGreaterThanOrEqual(last);
        last = cells;
        expect(a.h / 32, tag).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('is open: every annex cell is walkable and reachable from the main door, along the whole top edge; guests never use it', () => {
    for (const sh of shopShapes) {
      for (const l of LEVELS) {
        const room = createRoom(1, 'shop', l, 1, sh.id);
        const a = roomAnnex(room)!;
        const tag = `${sh.id} L${l}`;
        const grid = buildNavGrid(room, roomBlockers(room, []));
        const start = cellAt(grid, doorPoint(room));
        const reach = reachableCells(grid, start.r * grid.cols + start.c);
        for (let y = a.y; y < a.y + a.h; y += 32) {
          for (let x = a.x; x < a.x + a.w; x += 32) {
            const c = cellAt(grid, { x: x + 16, y: y + 16 });
            expect(isCellFree(grid, c.c, c.r), `${tag} ${x},${y} free`).toBe(true);
            expect(reach[c.r * grid.cols + c.c], `${tag} ${x},${y} reachable`).toBe(true);
          }
        }
        // a piece may stand on the top row (nothing is a wall there) and in a corner
        expect(canPlace(room, [], getFurnitureType('chair'), a.x + 16, a.y + 32, 'down'), `${tag} top row`).toBe(true);
        expect(canPlace(room, [], getFurnitureType('chair'), a.x + a.w - 16, a.y + a.h, 'down'), `${tag} corner`).toBe(true);
        // staff only: the whole annex is a guest zone and the guests' grid blocks it
        expect(kitchenZone(room)).toEqual(a);
        expect(guestZones([], room).some((z) => z.x === a.x && z.y === a.y && z.w === a.w && z.h === a.h), tag).toBe(true);
        const g = npcGrid(grid, guestZones([], room));
        const mid = cellAt(g, { x: a.x + a.w / 2, y: a.y + a.h / 2 });
        expect(isCellFree(g, mid.c, mid.r), `${tag} guests blocked`).toBe(false);
        const edge = cellAt(g, { x: a.x + 16, y: a.y + 16 });
        expect(isCellFree(g, edge.c, edge.r), `${tag} top row blocked for guests`).toBe(false);
      }
    }
  });

  it('the annex floor is stone tiles whatever the room floor is', () => {
    const room = createRoom(1, 'shop', 1, 1, 'square_shop');
    const a = roomAnnex(room)!;
    expect(floorStyleAt(room, a.x / 32 + 1, a.y / 32 + 1)).toBe(KITCHEN_FLOOR_STYLE);
    expect(floorStyleAt(room, 1, 1)).toBe(room.floorStyle);
  });

  it('a prep table next to the start stove, inside the annex, fits on every shape', () => {
    for (const sh of shopShapes) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: sh.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const stove = s.items.find((i) => i.typeId === 'stove')!;
      const spots = [[stove.x - 64, stove.y], [stove.x + 64, stove.y], [stove.x, stove.y + 32], [stove.x, stove.y - 32]] as const;
      expect(spots.some(([x, y]) => canPlace(room, s.items, getFurnitureType('prep_table'), x, y, 'down')), sh.id).toBe(true);
    }
  });
});

describe('the start layout (START LAYOUT REDO, owner 19 Nov)', () => {
  it('on every shape: all start pieces stand on valid floor, the stove and barrel inside the annex, the bar right under the kitchen, the table 2 free rows from the bar front, every staff spot reachable', () => {
    for (const sh of shopShapes) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: sh.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const a = roomAnnex(room)!;
      const floor = s.items.filter((i) => i.roomId === room.id && i.onItemUid === null);
      for (const i of floor) {
        const t = getFurnitureType(i.typeId);
        const rest = s.items.filter((x) => x.uid !== i.uid && x.onItemUid !== i.uid);
        expect(canPlace(room, rest, t, i.x, i.y, i.facing), `${sh.id} ${i.typeId} placeable`).toBe(true);
      }
      const fp = (typeId: string) => footprintRect(s.items.find((i) => i.typeId === typeId)!, getFurnitureType(typeId));
      const inA = (r: { x: number; y: number; w: number; h: number }) => r.x >= a.x && r.y >= a.y && r.x + r.w <= a.x + a.w && r.y + r.h <= a.y + a.h;
      expect(inA(fp('stove')), `${sh.id} stove`).toBe(true);
      expect(inA(fp('brewing_barrel')), `${sh.id} barrel`).toBe(true);
      const bars = floor.filter((i) => i.typeId === 'bar');
      for (const b of bars) {
        expect(b.y, `${sh.id} bar row`).toBe(a.y + a.h + 32); // the first main row, the kitchen behind it
        expect(behindReachable(room, itemBlockers(s.items, room.id), behindPoint(b, getFurnitureType('bar'))), `${sh.id} behind the bar`).toBe(true);
      }
      const barFront = Math.max(...bars.map((b) => b.y));
      for (const t of ['table', 'chair']) for (const i of floor.filter((x) => x.typeId === t)) expect(footprintRect(i, getFurnitureType(t)).y - barFront, `${sh.id} ${t} away from the bar`).toBeGreaterThanOrEqual(2 * 32);
    }
  });

  it('the new-game camera frame: bar, table with chairs, stove and barrel lie within 8 cells wide and 9 cells high on the square tavern', () => {
    const s = createNewPlayer(undefined, 0);
    const rs = s.items.filter((i) => i.roomId === s.tavern.roomId && i.onItemUid === null).map((i) => footprintRect(i, getFurnitureType(i.typeId)));
    const x0 = Math.min(...rs.map((r) => r.x));
    const x1 = Math.max(...rs.map((r) => r.x + r.w));
    const y0 = Math.min(...rs.map((r) => r.y));
    const y1 = Math.max(...rs.map((r) => r.y + r.h));
    expect(x1 - x0).toBeLessThanOrEqual(8 * 32);
    expect(y1 - y0).toBeLessThanOrEqual(9 * 32);
  });
});
describe('the real bar and its start layout across shapes and levels (job 3d, 19 Nov)', () => {
  const BAR_MIN: Record<string, number> = { square_shop: 6, l_shape: 6, wide_hall: 6, plus: 6, long: 3 }; // long: its annex is only 4 cells wide at level 1
  it('a long bar of one-cell pieces: the register on the first (the checkout end), a tap stand in the middle, bar stools along the front, all in a row', () => {
    for (const sh of shopShapes) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: sh.id }, 0);
      const bars = s.items.filter((i) => i.typeId === 'bar').sort((a, b) => a.x - b.x);
      expect(bars.length, sh.id).toBeGreaterThanOrEqual(BAR_MIN[sh.id]!);
      expect(new Set(bars.map((b) => b.y)).size, `${sh.id} one row`).toBe(1);
      bars.forEach((b, k) => k > 0 && expect(b.x - bars[k - 1]!.x, `${sh.id} no gap`).toBe(32));
      const reg = s.items.find((i) => i.typeId === 'register')!;
      expect(reg.onItemUid, sh.id).toBe(bars[0]!.uid);
      const tap = s.items.find((i) => i.typeId === 'tap_stand')!;
      const at = bars.findIndex((b) => b.uid === tap.onItemUid);
      expect(at, `${sh.id} tap not at the register`).toBeGreaterThan(0);
      if (bars.length >= 5) expect(at, `${sh.id} tap not at the far end`).toBeLessThan(bars.length - 1);
      for (const st of s.items.filter((i) => i.typeId === 'bar_stool')) expect(st.y, `${sh.id} stool in front`).toBe(bars[0]!.y + 32);
    }
  });

  it('every start piece stays valid after the upgrade to level 2 and 3, and the bar stays served and reachable', () => {
    for (const sh of shopShapes) {
      let s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: sh.id }, 0);
      for (const l of [2, 3]) {
        s = upgradeRoom({ ...s, player: { ...s.player, wallet: { ...s.player.wallet, gold: 99999 } } }, s.player.shopRoomId, 1)!;
        const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
        expect(room.level).toBe(l);
        const floor = s.items.filter((i) => i.roomId === room.id && i.onItemUid === null);
        expect(floor.length, `${sh.id} L${l} nothing sent to the bag`).toBeGreaterThanOrEqual(10);
        for (const i of floor) {
          const rest = s.items.filter((x) => x.uid !== i.uid && x.onItemUid !== i.uid);
          expect(canPlace(room, rest, getFurnitureType(i.typeId), i.x, i.y, i.facing), `${sh.id} L${l} ${i.typeId}`).toBe(true);
        }
      }
    }
  });
});
