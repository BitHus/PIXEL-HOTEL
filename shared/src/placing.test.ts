import { describe, expect, it } from 'vitest';
import {
  cancelPlacing,
  confirmPlacing,
  moveGhost,
  planGhost,
  rotateGhost,
  rotateInPlace,
  startMovePlacing,
  startNewPlacing,
} from './placing.ts';
import { getFurnitureType, type FurnitureLookup } from './furniture.ts';
import { createRoom } from './room.ts';
import type { Facing, FurnitureItem, FurnitureType } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 576 x 384, door zone x 256..320, y 336..384

let nextUid = 1;
function item(typeId: string, x: number, y: number, facing: Facing = 'down', onItemUid: number | null = null): FurnitureItem {
  return { uid: nextUid++, typeId, ownerId: 1, roomId: room.id, x, y, facing, onItemUid };
}
const owner = (uid = 100) => ({ ownerId: 1, newUid: () => uid });

describe('placing a new item', () => {
  it('starts at the given center with the first facing and places only where it fits', () => {
    const s = startNewPlacing('sofa', { x: 150, y: 150 }, null);
    expect(s.facing).toBe('down');
    expect(planGhost(room, [], s)).toMatchObject({ x: 152, y: 172, ok: true });
    const placed = confirmPlacing(room, [], s, owner(7));
    expect(placed).toEqual([{ uid: 7, typeId: 'sofa', ownerId: 1, roomId: 1, x: 152, y: 172, facing: 'down', onItemUid: null }]);
  });

  it('refuses to place while the ghost is invalid, and changes nothing', () => {
    const items = [item('table', 200, 200)];
    let called = false;
    const off = startNewPlacing('chair', { x: -50, y: 100 }, null);
    expect(confirmPlacing(room, items, off, { ownerId: 1, newUid: () => ((called = true), 1) })).toBeNull();
    const onTable = startNewPlacing('chair', { x: 200, y: 180 }, null);
    expect(planGhost(room, items, onTable).ok).toBe(false);
    expect(confirmPlacing(room, items, onTable, owner())).toBeNull();
    const inDoor = startNewPlacing('chair', { x: 288, y: 360 }, null);
    expect(confirmPlacing(room, items, inDoor, owner())).toBeNull();
    expect(called).toBe(false);
  });

  it('cancel leaves the items as they were (an inventory item stays in the inventory)', () => {
    const inv: FurnitureItem = { ...item('lamp', 0, 0), roomId: null };
    const s = moveGhost(startNewPlacing('lamp', { x: 100, y: 100 }, inv.uid), { x: 300, y: 200 });
    expect(cancelPlacing([inv], s)).toEqual([inv]);
  });
});

describe('moving a placed item', () => {
  it('starts where the item is, with its facing', () => {
    const sofa = item('sofa', 201, 203, 'right');
    const s = startMovePlacing(sofa);
    expect(s.facing).toBe('right');
    expect(s.center).toEqual({ x: 201, y: 163 });
  });

  it('cancel restores the exact previous position and facing', () => {
    const table = item('table', 202, 199, 'right');
    const lamp = item('lamp', 202, 190, 'down', table.uid);
    const items = [table, lamp];
    let s = startMovePlacing(lamp);
    s = rotateGhost(moveGhost(s, { x: 400, y: 100 }));
    const back = cancelPlacing(items, s);
    expect(back).toEqual(items);

    let t = startMovePlacing(table);
    t = rotateGhost(moveGhost(t, { x: 450, y: 250 }));
    expect(t.facing).toBe('down');
    expect(cancelPlacing(items, t)).toEqual(items);
    // Even if the items were changed meanwhile, cancel puts the moved item back exactly.
    const shifted = items.map((i) => (i.uid === table.uid ? { ...i, x: 9, y: 9, facing: 'down' as Facing } : i));
    expect(cancelPlacing(shifted, t).find((i) => i.uid === table.uid)).toEqual(table);
  });

  it('place moves the item and what stands on it', () => {
    const table = item('table', 200, 200);
    const lamp = item('lamp', 200, 190, 'down', table.uid);
    const s = moveGhost(startMovePlacing(table), { x: 400, y: 180 });
    const next = confirmPlacing(room, [table, lamp], s, owner());
    expect(next?.find((i) => i.uid === table.uid)).toMatchObject({ x: 400, y: 200 });
    expect(next?.find((i) => i.uid === lamp.uid)).toMatchObject({ x: 400, y: 190, onItemUid: table.uid });
  });
});

describe('rotateInPlace', () => {
  it('turns the item around its footprint center when it fits', () => {
    const sofa = item('sofa', 200, 200); // 80 x 40, center (200, 180)
    const next = rotateInPlace(room, [sofa], sofa.uid);
    expect(next?.[0]).toMatchObject({ x: 200, y: 220, facing: 'right' }); // 40 x 80, same center
  });

  it('is refused when the new facing does not fit', () => {
    const sofa = item('sofa', 200, 40); // turned it would stick out of the top of the floor
    expect(rotateInPlace(room, [sofa], sofa.uid)).toBeNull();
    const bed = item('bed', 200, 200);
    const shelf = item('bookshelf', 244, 200, 'right'); // touches the bed's right side
    expect(rotateInPlace(room, [shelf], shelf.uid)).not.toBeNull();
    expect(rotateInPlace(room, [bed, shelf], bed.uid)).toBeNull(); // turned, the bed overlaps it
  });

  it('is refused for a type with one facing', () => {
    const lamp = item('lamp', 100, 100);
    expect(rotateInPlace(room, [lamp], lamp.uid)).toBeNull();
  });

  it('is refused when something standing on it would fall off', () => {
    // A narrow ledge (80 x 24) with a wide jar (32 x 16) on it: turned, the ledge is 24 wide.
    const base = getFurnitureType('table');
    const ledge: FurnitureType = { ...base, id: 'ledge', w: 80, d: 24, facings: ['down', 'right'] };
    const jar: FurnitureType = { ...getFurnitureType('lamp'), id: 'jar', w: 32, d: 16 };
    const types: FurnitureLookup = (id) => (id === 'ledge' ? ledge : id === 'jar' ? jar : getFurnitureType(id));
    const l = item('ledge', 200, 200);
    const j = item('jar', 200, 196, 'down', l.uid);
    expect(rotateInPlace(room, [l], l.uid, types)).not.toBeNull();
    expect(rotateInPlace(room, [l, j], l.uid, types)).toBeNull();
    const alone = item('table', 400, 200);
    const lamp = item('lamp', 400, 190, 'down', alone.uid);
    const turned = rotateInPlace(room, [alone, lamp], alone.uid);
    expect(turned?.find((i) => i.uid === lamp.uid)?.roomId).toBe(room.id);
  });
});
