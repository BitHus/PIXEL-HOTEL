import { describe, expect, it } from 'vitest';
import {
  FURNITURE_TYPES,
  canPlace,
  footprintRect,
  getFurnitureType,
  moveItem,
  nextFacing,
  pickUpItem,
  planPlacement,
  snapToSurface,
  standPointFor,
  type FurnitureLookup,
} from './furniture.ts';
import { createRoom } from './room.ts';
import type { Facing, FurnitureItem, FurnitureType } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 576 x 384, door zone x 256..320, y 336..384
const T = getFurnitureType;

let nextUid = 1;
function item(typeId: string, x: number, y: number, facing: Facing = 'down', onItemUid: number | null = null): FurnitureItem {
  return { uid: nextUid++, typeId, ownerId: 1, roomId: room.id, x, y, facing, onItemUid };
}

describe('furniture data', () => {
  it('has the 12 home types, in the catalog, common, and only the rug does not block', () => {
    const home = FURNITURE_TYPES.filter((t) => t.category === 'home_furniture');
    expect(home).toHaveLength(12);
    for (const t of home) {
      expect(t.inCatalog).toBe(true);
      expect(t.rarity).toBe('common');
      expect(t.blocks).toBe(t.id !== 'rug');
      expect(t.facings.length).toBeGreaterThan(0);
    }
    expect(T('bed').placeIn).toBe('hotel');
    expect(T('bookshelf').placeIn).toBe('hotel');
    expect(T('chair').placeIn).toBe('both');
  });

  it('has the step 7 shop types (section 7, 9)', () => {
    expect(T('shelf')).toMatchObject({ w: 72, d: 24, height: 80, slots: 3, baseValue: 10, blocks: true, inCatalog: true, placeIn: 'shop' });
    expect(T('display_case')).toMatchObject({ w: 72, d: 32, slots: 4, baseValue: 40, appeal: 6, inCatalog: true, placeIn: 'shop' });
    expect(T('sign')).toMatchObject({ w: 40, wall: true, appeal: 10, baseValue: 25, inCatalog: true, placeIn: 'shop' });
    expect(T('banner')).toMatchObject({ w: 32, wall: true, appeal: 6, baseValue: 15, inCatalog: true, placeIn: 'shop' });
    expect(T('shop_rug')).toMatchObject({ w: 80, d: 56, blocks: false, appeal: 5, baseValue: 12, inCatalog: true, placeIn: 'shop' });
    expect(T('counter')).toMatchObject({ w: 80, d: 40, appeal: 8, inCatalog: false, noPickup: true });
    expect(T('stall_table')).toMatchObject({ w: 80, d: 48, slots: 3, baseValue: 10, blocks: true, inCatalog: false });
    expect(T('lamp')).toMatchObject({ placeIn: 'both', appeal: 4 });
    expect(T('plant')).toMatchObject({ placeIn: 'both', appeal: 3 });
  });
});

describe('footprintRect', () => {
  it('runs from (x - fw/2, y - fd) to (x + fw/2, y)', () => {
    expect(footprintRect({ x: 200, y: 200, facing: 'down' }, T('sofa'))).toEqual({ x: 160, y: 160, w: 80, h: 40 });
    expect(footprintRect({ x: 200, y: 200, facing: 'up' }, T('sofa'))).toEqual({ x: 160, y: 160, w: 80, h: 40 });
  });

  it('swaps w and d when facing left or right', () => {
    expect(footprintRect({ x: 200, y: 200, facing: 'right' }, T('sofa'))).toEqual({ x: 180, y: 120, w: 40, h: 80 });
    expect(footprintRect({ x: 200, y: 200, facing: 'left' }, T('sofa'))).toEqual({ x: 180, y: 120, w: 40, h: 80 });
  });
});

describe('nextFacing', () => {
  it("cycles through the type's facings", () => {
    const seen: Facing[] = [];
    let f: Facing = 'down';
    for (let i = 0; i < 4; i++) seen.push((f = nextFacing(T('chair'), f)));
    expect(seen).toEqual(['right', 'up', 'left', 'down']);
    expect(nextFacing(T('table'), 'down')).toBe('right');
    expect(nextFacing(T('table'), 'right')).toBe('down');
    expect(nextFacing(T('lamp'), 'down')).toBe('down');
  });
});

describe('canPlace', () => {
  it('refuses overlaps between blocking items, but rugs overlap anything', () => {
    const sofa = item('sofa', 200, 200);
    expect(canPlace(room, [sofa], T('sofa'), 220, 210, 'down')).toBe(false);
    expect(canPlace(room, [sofa], T('chair'), 200, 190, 'down')).toBe(false);
    expect(canPlace(room, [sofa], T('rug'), 200, 210, 'down')).toBe(true);
    // Sharing an edge is not an overlap.
    expect(canPlace(room, [sofa], T('sofa'), 280, 200, 'down')).toBe(true);
    // A blocking item can stand on a rug.
    const rug = item('rug', 400, 200);
    expect(canPlace(room, [rug], T('table'), 400, 190, 'down')).toBe(true);
  });

  it('keeps the footprint inside the floor', () => {
    expect(canPlace(room, [], T('chair'), 16, 32, 'down')).toBe(true);
    expect(canPlace(room, [], T('chair'), 12, 32, 'down')).toBe(false);
    expect(canPlace(room, [], T('chair'), 100, 20, 'down')).toBe(false);
    expect(canPlace(room, [], T('chair'), 100, 388, 'down')).toBe(false);
  });

  it('refuses the door zone, also for rugs and when only touching it', () => {
    expect(canPlace(room, [], T('chair'), 288, 384, 'down')).toBe(false);
    expect(canPlace(room, [], T('rug'), 288, 384, 'down')).toBe(false);
    expect(canPlace(room, [], T('chair'), 240, 384, 'down')).toBe(false); // right edge at x 256
    expect(canPlace(room, [], T('chair'), 236, 384, 'down')).toBe(true);
    expect(canPlace(room, [], T('rug'), 288, 336, 'down')).toBe(false); // bottom edge at y 336
  });

  it('refuses an item that would cut the door off from the middle of the room', () => {
    // Bookshelves (56 wide) in a row above the door zone, from x 0 to 504: a 72 px gap is left.
    const row = Array.from({ length: 9 }, (_, i) => item('bookshelf', 28 + i * 56, 320));
    expect(canPlace(room, row, T('chair'), 100, 100, 'down')).toBe(true);
    expect(canPlace(room, row, T('bookshelf'), 532, 320, 'down')).toBe(false);
    // A rug in the gap is fine: it does not block walking.
    expect(canPlace(room, row, T('rug'), 536, 320, 'right')).toBe(true);
  });

  it('respects placeIn', () => {
    const shop = createRoom(2, 'shop', 1, 1);
    expect(canPlace(shop, [], T('bed'), 100, 200, 'down')).toBe(false);
    expect(canPlace(shop, [], T('chair'), 100, 200, 'down')).toBe(true);
  });
});

describe('surfaces', () => {
  it('snaps an onSurface item to the nearest free spot on top', () => {
    const table = item('table', 200, 200); // top: x 168..232, y 160..200
    expect(snapToSurface(room, [table], T('lamp'), 200, 190, 'down')).toEqual({ x: 200, y: 190, onItemUid: table.uid });
    // Near the edge it is pulled inside the top.
    expect(snapToSurface(room, [table], T('lamp'), 230, 200, 'down')).toEqual({ x: 220, y: 200, onItemUid: table.uid });
    // A second lamp does not overlap the first.
    const lamp = item('lamp', 180, 190, 'down', table.uid);
    const spot = snapToSurface(room, [table, lamp], T('lamp'), 184, 190, 'down');
    expect(spot?.onItemUid).toBe(table.uid);
    const a = footprintRect(lamp, T('lamp'));
    const b = footprintRect({ x: spot!.x, y: spot!.y, facing: 'down' }, T('lamp'));
    expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    // Not over a surface: no snap; on the floor it is a normal placement.
    expect(snapToSurface(room, [table], T('lamp'), 400, 190, 'down')).toBeNull();
    expect(planPlacement(room, [table], T('lamp'), 400, 190, 'down')).toMatchObject({ onItemUid: null, ok: true });
    // Items that are not onSurface never snap.
    expect(snapToSurface(room, [table], T('chair'), 200, 190, 'down')).toBeNull();
  });

  it('moves and goes back with the item under it', () => {
    const table = item('table', 200, 200);
    const lamp = item('lamp', 210, 190, 'down', table.uid);
    const moved = moveItem([table, lamp], table.uid, { x: 300, y: 250, facing: 'down', roomId: room.id, onItemUid: null });
    expect(moved.find((i) => i.uid === lamp.uid)).toMatchObject({ x: 310, y: 240, onItemUid: table.uid, roomId: room.id });
    const back = pickUpItem(moved, table.uid);
    expect(back.find((i) => i.uid === table.uid)).toMatchObject({ roomId: null });
    expect(back.find((i) => i.uid === lamp.uid)).toMatchObject({ roomId: null, onItemUid: null });
  });

  it('turns with the item under it and stays on top', () => {
    const table = item('table', 200, 200); // center (200, 180)
    const lamp = item('lamp', 220, 192, 'down', table.uid); // lamp center (220, 180)
    const turned = moveItem([table, lamp], table.uid, { x: 200, y: 212, facing: 'right', roomId: room.id, onItemUid: null });
    const l = turned.find((i) => i.uid === lamp.uid)!;
    const top = footprintRect(turned.find((i) => i.uid === table.uid)!, T('table'));
    const fp = footprintRect(l, T('lamp'));
    expect(l.onItemUid).toBe(table.uid);
    expect(fp.x >= top.x && fp.y >= top.y && fp.x + fp.w <= top.x + top.w && fp.y + fp.h <= top.y + top.h).toBe(true);
  });

  it('is one level only', () => {
    const box: FurnitureType = { ...T('crate'), id: 'small_box', w: 24, d: 24, surface: true, onSurface: true };
    const types: FurnitureLookup = (id) => (id === 'small_box' ? box : T(id));
    const table = item('table', 200, 200);
    const onTable = item('small_box', 180, 192, 'down', table.uid);
    // A lamp aimed at the box lands on the table next to it, never on the box.
    const spot = snapToSurface(room, [table, onTable], T('lamp'), 180, 188, 'down', types);
    expect(spot?.onItemUid).toBe(table.uid);
    // A surface that carries items cannot itself go onto a surface.
    const p = planPlacement(room, [table], box, 200, 192, 'down', true, types);
    expect(p.onItemUid).toBeNull();
    expect(p.ok).toBe(false);
  });
});

describe('standPointFor', () => {
  it('is in front of the item, turned with its facing', () => {
    const t = T('chair'); // 32 x 32, standPoint (0, 24)
    expect(standPointFor({ x: 100, y: 100, facing: 'down' }, t)).toEqual({ x: 100, y: 124 });
    expect(standPointFor({ x: 100, y: 100, facing: 'right' }, t)).toEqual({ x: 140, y: 84 });
    expect(standPointFor({ x: 100, y: 100, facing: 'up' }, t)).toEqual({ x: 100, y: 44 });
    expect(standPointFor({ x: 100, y: 100, facing: 'left' }, t)).toEqual({ x: 60, y: 84 });
  });
});
