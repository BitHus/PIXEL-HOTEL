// The tavern's kitchen ANNEX (owner 18 Nov): attached floor below the tavern with a partition wall and ONE doorway; geometry, nav, placing, level growth.
import { describe, expect, it } from 'vitest';
import { doorPoint, footprintRect, getFurnitureType, roomBlockers, canPlace } from './furniture.ts';
import { annexShift, kitchenNoPlace, kitchenWall, KITCHEN_DOOR_CELLS } from './kitchenWall.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { buildNavGrid, cellAt, isCellFree, reachableCells } from './nav.ts';
import { annexRectOf, createRoom, doorRect, doorZoneRect, floorRects, floorStyleAt, rectInsideFloor, rectsOverlap, roomAtLevel, shapesFor } from './room.ts';
import { guestZones } from './npcNav.ts';
import { KITCHEN_FLOOR_STYLE } from './config.ts';
import { innDoorSpotRects } from './innDoors.ts';

const LEVELS = [1, 2, 3] as const;
const shopShapes = shapesFor('shop').filter((s) => s.shopStart);

describe('the kitchen annex', () => {
  it('only a tavern has one; hotel, farm and a missing room have none, and a hotel of a tavern shape gets no extra floor', () => {
    expect(kitchenWall(undefined)).toBeNull();
    expect(kitchenWall(createRoom(1, 'hotel', 1, 1))).toBeNull();
    expect(kitchenWall(createRoom(1, 'farm', 1, 1, 'farm'))).toBeNull();
    const hotelLong = createRoom(1, 'hotel', 1, 1, 'long');
    const tavernLong = createRoom(2, 'shop', 1, 1, 'long');
    expect(floorRects(tavernLong).length).toBe(floorRects(hotelLong).length + 1);
    expect(tavernLong.h).toBeGreaterThan(hotelLong.h);
  });

  it('on every shape and level: the annex hangs below the main floor, touches other floor only along its top row, stays clear of the main door, has one 2-cell doorway', () => {
    for (const sh of shopShapes) {
      for (const l of LEVELS) {
        const room = createRoom(1, 'shop', l, 1, sh.id);
        const kw = kitchenWall(room)!;
        const tag = `${sh.id} L${l}`;
        const a = kw.annex;
        expect(annexRectOf(sh.id, l), tag).toEqual(a);
        const main = floorRects(room).filter((r) => !(r.x === a.x && r.y === a.y && r.w === a.w && r.h === a.h));
        // no overlap with the main floor, attached on top, and nothing else touches it
        for (const m of main) expect(rectsOverlap(m, a), `${tag} overlap`).toBe(false);
        expect(main.some((m) => m.y + m.h === a.y && m.x <= a.x && m.x + m.w >= a.x + a.w), `${tag} attached below one rectangle`).toBe(true);
        const side = { x: a.x - 1, y: a.y + 32, w: a.w + 2, h: a.h - 32 };
        for (const m of main) expect(rectsOverlap(m, side), `${tag} touches a side`).toBe(false);
        expect(a.w / 32, tag).toBeGreaterThanOrEqual(4);
        expect(kw.inside.h / 32, tag).toBeGreaterThanOrEqual(3);
        // the partition: the annex's top row minus the doorway
        expect(kw.walls.length, tag).toBe(a.w / 32 - KITCHEN_DOOR_CELLS);
        for (const w of [...kw.walls, kw.door, kw.doorOut]) expect(rectInsideFloor(room, w), tag).toBe(true);
        expect(kw.door.w, tag).toBe(KITCHEN_DOOR_CELLS * 32);
        expect(kw.walls.some((w) => rectsOverlap(w, kw.door)), tag).toBe(false);
        for (const w of [...kw.walls, kw.door, kw.doorOut]) {
          expect(rectsOverlap(w, doorZoneRect(room)), `${tag} door zone`).toBe(false);
          expect(rectsOverlap(w, doorRect(room)), `${tag} main door`).toBe(false);
          expect(innDoorSpotRects(room).some((d) => rectsOverlap(w, d)), `${tag} inn door`).toBe(false);
        }
        expect(rectsOverlap(a, doorZoneRect(room)), tag).toBe(false);
        // main door -> doorway -> inside by walking
        const grid = buildNavGrid(room, roomBlockers(room, []));
        const door = cellAt(grid, { x: kw.door.x + 16, y: kw.door.y + 16 });
        const inside = cellAt(grid, { x: kw.inside.x + 16, y: kw.inside.y + 16 });
        const main0 = cellAt(grid, doorPoint(room));
        const reach = reachableCells(grid, main0.r * grid.cols + main0.c);
        expect(reach[door.r * grid.cols + door.c], `${tag} doorway reachable`).toBe(true);
        expect(reach[inside.r * grid.cols + inside.c], `${tag} inside reachable`).toBe(true);
      }
    }
  });

  it('the annex floor is stone tiles whatever the room floor is', () => {
    const room = createRoom(1, 'shop', 1, 1, 'square_shop');
    const kw = kitchenWall(room)!;
    expect(floorStyleAt(room, kw.inside.x / 32 + 1, kw.inside.y / 32 + 1)).toBe(KITCHEN_FLOOR_STYLE);
    expect(floorStyleAt(room, 1, 1)).toBe(room.floorStyle);
  });

  it('the partition blocks walking and placing; the doorway stays walkable but free of furniture, and so does the floor outside it; guests never use it', () => {
    const room = createRoom(1, 'shop', 1, 1, 'square_shop');
    const kw = kitchenWall(room)!;
    const grid = buildNavGrid(room, roomBlockers(room, []));
    const w = kw.walls[0]!;
    expect(isCellFree(grid, w.x / 32, w.y / 32)).toBe(false);
    expect(isCellFree(grid, kw.door.x / 32, kw.door.y / 32)).toBe(true);
    expect(isCellFree(grid, kw.doorOut.x / 32, kw.doorOut.y / 32)).toBe(true);
    for (const r of kitchenNoPlace(room)) expect(canPlace(room, [], getFurnitureType('chair'), r.x + 16, r.y + 32, 'down')).toBe(false);
    expect(guestZones([], room).some((z) => rectsOverlap(z, kw.door))).toBe(true);
    expect(guestZones([], room).some((z) => rectsOverlap(z, kw.inside))).toBe(true);
  });

  it('a new game stands the start stove and barrel inside the annex and nothing of the start tavern on the partition, on every shape', () => {
    for (const sh of shopShapes) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: sh.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const kw = kitchenWall(room)!;
      const fp = (typeId: string) => footprintRect(s.items.find((i) => i.typeId === typeId)!, getFurnitureType(typeId));
      for (const t of ['stove', 'brewing_barrel']) {
        const r = fp(t);
        expect(r.x >= kw.inside.x && r.y >= kw.inside.y && r.x + r.w <= kw.inside.x + kw.inside.w && r.y + r.h <= kw.inside.y + kw.inside.h, `${sh.id} ${t} inside`).toBe(true);
      }
      for (const i of s.items.filter((x) => x.roomId === room.id && x.onItemUid === null)) {
        const r = footprintRect(i, getFurnitureType(i.typeId));
        expect(kitchenNoPlace(room).some((w) => rectsOverlap(r, w)), `${sh.id} ${i.typeId}`).toBe(false);
      }
    }
  });

  it('annexShift: the annex moves down by the growth of the main floor and not sideways; null without an annex', () => {
    for (const sh of shopShapes) {
      for (const [from, to] of [[1, 2], [2, 3], [1, 3]] as const) {
        const sft = annexShift(sh.id, from, to)!;
        expect(sft.x, sh.id).toBe(0);
        expect(sft.y, sh.id).toBeGreaterThan(0);
        const grown = roomAtLevel(createRoom(1, 'shop', from, 1, sh.id), to);
        expect(kitchenWall(grown)!.annex.y - kitchenWall(createRoom(1, 'shop', from, 1, sh.id))!.annex.y).toBe(sft.y);
      }
    }
    expect(annexShift('farm', 1, 2)).toBeNull();
  });
});
