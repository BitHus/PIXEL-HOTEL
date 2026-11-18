// The tavern's walled kitchen (owner 18 Nov): the wall ring, its one doorway, what it blocks, and that the start tavern stays whole.
import { describe, expect, it } from 'vitest';
import { doorPoint, footprintRect, getFurnitureType, roomBlockers } from './furniture.ts';
import { innDoorSpotRects } from './innDoors.ts';
import { kitchenWall } from './kitchenWall.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { buildNavGrid, cellAt, isCellFree, reachableCells } from './nav.ts';
import { createRoom, doorZoneRect, rectInsideFloor, rectsOverlap, shapesFor } from './room.ts';
import { guestZones } from './npcNav.ts';
import { canPlace } from './furniture.ts';

const LEVELS = [1, 2, 3] as const;
const shopShapes = shapesFor('shop').filter((s) => s.shopStart);

describe('the kitchen wall', () => {
  it('only a tavern has one; hotel, farm and a missing room have none', () => {
    expect(kitchenWall(undefined)).toBeNull();
    expect(kitchenWall(createRoom(1, 'hotel', 1, 1))).toBeNull();
    expect(kitchenWall(createRoom(1, 'farm', 1, 1, 'farm'))).toBeNull();
  });

  it('on every shape and level: a ring of wall cells on the floor around the zone with exactly one doorway, off the door zone and the Inn doors', () => {
    for (const sh of shopShapes) {
      for (const l of LEVELS) {
        const room = createRoom(1, 'shop', l, 1, sh.id);
        const kw = kitchenWall(room)!;
        const tag = `${sh.id} L${l}`;
        expect(kw.door, tag).not.toBeNull();
        expect(kw.walls.length, tag).toBeGreaterThan(3);
        for (const w of [...kw.walls, kw.door!]) {
          expect(rectInsideFloor(room, w), tag).toBe(true);
          expect(rectsOverlap(w, kw.inside), tag).toBe(false);
          expect(rectsOverlap(w, doorZoneRect(room)), tag).toBe(false);
          expect(innDoorSpotRects(room).some((d) => rectsOverlap(w, d)), `${tag} inn door`).toBe(false);
        }
        expect(kw.walls.some((w) => rectsOverlap(w, kw.door!)), tag).toBe(false);
        // the doorway touches the inside on one side and floor on the other
        const grid = buildNavGrid(room, roomBlockers(room, []));
        const door = cellAt(grid, { x: kw.door!.x + 16, y: kw.door!.y + 16 });
        const inside = cellAt(grid, { x: kw.inside.x + 16, y: kw.inside.y + 16 });
        const reach = reachableCells(grid, door.r * grid.cols + door.c);
        expect(reach[inside.r * grid.cols + inside.c], `${tag} inside reachable through the doorway`).toBe(true);
        const main = cellAt(grid, doorPoint(room));
        expect(reach[main.r * grid.cols + main.c], `${tag} main door reaches the kitchen`).toBe(true);
      }
    }
  });

  it('the wall blocks walking and placing; the doorway stays free of furniture; guests never use it', () => {
    const room = createRoom(1, 'shop', 1, 1, 'square_shop');
    const kw = kitchenWall(room)!;
    const grid = buildNavGrid(room, roomBlockers(room, []));
    const w = kw.walls[0]!;
    expect(isCellFree(grid, w.x / 32, w.y / 32)).toBe(false);
    const door = kw.door!;
    expect(isCellFree(grid, door.x / 32, door.y / 32)).toBe(true);
    expect(canPlace(room, [], getFurnitureType('chair'), w.x + 16, w.y + 32, 'down')).toBe(false);
    expect(canPlace(room, [], getFurnitureType('chair'), door.x + 16, door.y + 32, 'down')).toBe(false);
    expect(guestZones([], room).some((z) => rectsOverlap(z, door))).toBe(true);
  });

  it('a new game stands the start stove and barrel inside the walls and nothing of the start tavern in the ring, on every shape', () => {
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
        expect([...kw.walls, kw.door!].some((w) => rectsOverlap(r, w)), `${sh.id} ${i.typeId}`).toBe(false);
      }
    }
  });
});
