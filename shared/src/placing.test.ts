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
import { getFurnitureType, poseAtCell, type FurnitureLookup } from './furniture.ts';
import { createRoom } from './room.ts';
import type { Facing, FurnitureItem, FurnitureType } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 18 x 12 cells (576 x 384), door zone x 256..320, y 320..384

let nextUid = 1;
function item(typeId: string, x: number, y: number, facing: Facing = 'down', onItemUid: number | null = null): FurnitureItem {
  return { uid: nextUid++, typeId, ownerId: 1, roomId: room.id, x, y, facing, onItemUid };
}
/** An item whose footprint's top-left cell is (col, row). */
function atCell(typeId: string, col: number, row: number, facing: Facing = 'down'): FurnitureItem {
  const p = poseAtCell(getFurnitureType(typeId), facing, col, row);
  return item(typeId, p.x, p.y, facing);
}
const owner = (uid = 100) => ({ ownerId: 1, newUid: () => uid });

describe('placing a new item', () => {
  it('starts at the given center with the first facing and places only where it fits', () => {
    const s = startNewPlacing('sofa', { x: 150, y: 150 }, null);
    expect(s.facing).toBe('down');
    // The ghost snaps to the cells (BG1): a 3 x 1 sofa whose middle is at (150, 150) lands on columns 3..5, row 4.
    expect(planGhost(room, [], s)).toMatchObject({ x: 144, y: 160, ok: true });
    const placed = confirmPlacing(room, [], s, owner(7));
    expect(placed).toEqual([{ uid: 7, typeId: 'sofa', ownerId: 1, roomId: 1, x: 144, y: 160, facing: 'down', onItemUid: null }]);
  });

  it('the ghost steps from cell to cell, never in between', () => {
    for (let x = 100; x < 200; x += 7) {
      const p = planGhost(room, [], startNewPlacing('chair', { x, y: 150 }, null));
      expect((p.x - 16) % 32).toBe(0);
      expect(p.y % 32).toBe(0);
    }
    // Shift (no snap) does not matter for floor items.
    expect(planGhost(room, [], startNewPlacing('chair', { x: 133, y: 150 }, null), false)).toEqual(planGhost(room, [], startNewPlacing('chair', { x: 133, y: 150 }, null), true));
  });

  it('wall items keep the free 4 px snap (Shift: whole px) along the band', () => {
    const torch = startNewPlacing('wall_torch', { x: 131, y: 40 }, null);
    expect(planGhost(room, [], torch)).toMatchObject({ x: 132, y: 0, ok: true });
    expect(planGhost(room, [], torch, false)).toMatchObject({ x: 131, y: 0, ok: true });
    expect(planGhost(room, [], startNewPlacing('wall_torch', { x: 133, y: 40 }, null))).toMatchObject({ x: 132, y: 0 });
  });

  it('refuses to place while the ghost is invalid, and changes nothing', () => {
    const items = [atCell('table', 6, 5)];
    let called = false;
    const off = startNewPlacing('chair', { x: -50, y: 100 }, null);
    expect(confirmPlacing(room, items, off, { ownerId: 1, newUid: () => ((called = true), 1) })).toBeNull();
    const onTable = startNewPlacing('chair', { x: 208, y: 176 }, null);
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
    const sofa = atCell('sofa', 6, 4, 'right'); // 1 x 3 cells: x 192..224, y 128..224
    const s = startMovePlacing(sofa);
    expect(s.facing).toBe('right');
    expect(s.center).toEqual({ x: 208, y: 176 });
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
    const table = atCell('table', 6, 5); // anchor (224, 192)
    const lamp = item('lamp', 208, 192, 'down', table.uid);
    const s = moveGhost(startMovePlacing(table), { x: 416, y: 176 });
    const next = confirmPlacing(room, [table, lamp], s, owner());
    expect(next?.find((i) => i.uid === table.uid)).toMatchObject({ x: 416, y: 192 });
    expect(next?.find((i) => i.uid === lamp.uid)).toMatchObject({ x: 400, y: 192, onItemUid: table.uid });
  });
});

describe('rotateInPlace', () => {
  it('turns the item keeping its anchor cell (the bottom-centre cell) when it fits', () => {
    const sofa = atCell('sofa', 5, 6); // 3 x 1: columns 5..7, row 6, anchor cell (6, 6), anchor point (208, 224)
    const next = rotateInPlace(room, [sofa], sofa.uid);
    expect(next?.[0]).toMatchObject({ x: 208, y: 224, facing: 'right' }); // 1 x 3: column 6, rows 4..6
    // A second turn ('up') is 3 x 1 again, on the same anchor cell.
    const up = rotateInPlace(room, next!, sofa.uid);
    expect(up?.[0]).toMatchObject({ x: 208, y: 224, facing: 'up' });
    // Even widths: a 2 x 1 table keeps the left of its two centre cells.
    const table = atCell('table', 4, 6); // columns 4..5, anchor cell (4, 6)
    expect(rotateInPlace(room, [table], table.uid)?.[0]).toMatchObject({ x: 4 * 32 + 16, y: 7 * 32, facing: 'right' });
  });

  it('is refused when the new facing does not fit', () => {
    const sofa = atCell('sofa', 5, 0); // turned (1 x 3 on the anchor cell) it would stick out of the top of the floor
    expect(rotateInPlace(room, [sofa], sofa.uid)).toBeNull();
    const bed = atCell('bed', 6, 4); // columns 6..7, rows 4..6, anchor cell (6, 6)
    const shelf = atCell('bookshelf', 5, 5, 'right'); // 1 x 2 at column 5, rows 5..6: next to the bed
    expect(rotateInPlace(room, [shelf], shelf.uid)).not.toBeNull();
    expect(rotateInPlace(room, [bed, shelf], bed.uid)).toBeNull(); // turned (3 x 2 over columns 5..7) the bed overlaps it
  });

  it('is refused for a type with one facing', () => {
    const lamp = atCell('lamp', 3, 3);
    expect(rotateInPlace(room, [lamp], lamp.uid)).toBeNull();
  });

  it('a wall item turns where it hangs (it has one facing here, so it stays)', () => {
    const torch = item('wall_torch', 131, 0);
    expect(rotateInPlace(room, [torch], torch.uid)).toBeNull();
  });

  it('is refused when something standing on it would fall off', () => {
    // A 3 x 1 ledge with a 2 x 1 jar on it: turned, the ledge is 1 cell wide.
    const base = getFurnitureType('table');
    const ledge: FurnitureType = { ...base, id: 'ledge', w: 96, d: 32, facings: ['down', 'right'] };
    const jar: FurnitureType = { ...getFurnitureType('lamp'), id: 'jar', w: 64, d: 32 };
    const types: FurnitureLookup = (id) => (id === 'ledge' ? ledge : id === 'jar' ? jar : getFurnitureType(id));
    const l = item('ledge', 240, 192); // columns 6..8, row 5
    const j = item('jar', 224, 192, 'down', l.uid);
    expect(rotateInPlace(room, [l], l.uid, types)).not.toBeNull();
    expect(rotateInPlace(room, [l, j], l.uid, types)).toBeNull();
    const alone = atCell('table', 12, 5);
    const lamp = item('lamp', 400, 192, 'down', alone.uid);
    const turned = rotateInPlace(room, [alone, lamp], alone.uid);
    expect(turned?.find((i) => i.uid === lamp.uid)?.roomId).toBe(room.id);
  });
});
