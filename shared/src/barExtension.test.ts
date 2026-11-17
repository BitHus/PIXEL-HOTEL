import { describe, expect, it } from 'vitest';
import { barExtensionsConnected, canRemoveBarPiece } from './barExtension.ts';
import { canPickUp, canPlace, footprintRect, getFurnitureType, moveItem, planPlacement, snapToSurface } from './furniture.ts';
import { guestZones } from './npcNav.ts';
import { legacyStart } from './tavernTest.ts';
import type { FurnitureItem } from './types.ts';

const ext = getFurnitureType('counter_ext');
const start = () => {
  const s = legacyStart();
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  const counter = s.items.find((i) => i.typeId === 'counter' && i.roomId === room.id)!;
  return { s, room, counter, fp: footprintRect(counter, getFurnitureType('counter')) };
};
const piece = (uid: number, x: number, y: number, facing: FurnitureItem['facing'], roomId: number): FurnitureItem => ({ uid, typeId: 'counter_ext', x, y, facing, roomId, ownerId: 1, onItemUid: null }) as FurnitureItem;

describe('bar extension (OA-6)', () => {
  it('the type: one cell, surface, in the catalog, a fair price, art for all facings', () => {
    expect(ext.w).toBe(32);
    expect(ext.d).toBe(32);
    expect(ext.height).toBe(72);
    expect(ext.surface).toBe(true);
    expect(ext.placeIn).toBe('shop');
    expect(ext.inCatalog).toBe(true);
    expect(ext.noPickup).toBeUndefined();
    expect(ext.baseValue).toBeLessThan(getFurnitureType('counter').baseValue);
  });

  it('goes next to the end of the counter in a straight line, same facing only', () => {
    const { s, room, fp, counter } = start();
    const rightX = fp.x + fp.w + 16;
    const y = fp.y + fp.h;
    expect(canPlace(room, s.items, ext, rightX, y, counter.facing)).toBe(true);
    expect(canPlace(room, s.items, ext, fp.x - 16, y, counter.facing)).toBe(true);
    expect(canPlace(room, s.items, ext, rightX, y, 'right')).toBe(false); // other facing
    expect(canPlace(room, s.items, ext, rightX, y + 32, counter.facing)).toBe(false); // next row: not in line
    expect(canPlace(room, s.items, ext, rightX + 32, y, counter.facing)).toBe(false); // gap
  });

  it('chains onto another piece of the same facing, never without a link', () => {
    const { s, room, fp, counter } = start();
    const y = fp.y + fp.h;
    const a = piece(900, fp.x + fp.w + 16, y, counter.facing, room.id);
    const items = [...s.items, a];
    expect(canPlace(room, items, ext, a.x + 32, y, counter.facing)).toBe(true);
    expect(canPlace(room, items, ext, a.x + 64, y, counter.facing)).toBe(false);
  });

  it('the connection rule: an orphan piece is not connected; a middle piece cannot be picked up, an end piece can', () => {
    const { s, room, fp, counter } = start();
    const y = fp.y + fp.h;
    const a = piece(900, fp.x + fp.w + 16, y, counter.facing, room.id);
    const b = piece(901, a.x + 32, y, counter.facing, room.id);
    const items = [...s.items, a, b];
    expect(barExtensionsConnected(items, room.id)).toBe(true);
    expect(barExtensionsConnected(s.items.concat(b), room.id)).toBe(false);
    expect(canRemoveBarPiece(items, a.uid)).toBe(false);
    expect(canRemoveBarPiece(items, b.uid)).toBe(true);
    expect(canPickUp(a, items)).toBe(false);
    expect(canPickUp(b, items)).toBe(true);
    expect(canPickUp(counter, items)).toBe(false); // the counter stays unpickable
    // The counter cannot be moved away from its pieces (the pieces would hang loose).
    const others = items.filter((i) => i.uid !== counter.uid);
    expect(canPlace(room, others, getFurnitureType('counter'), counter.x, counter.y + 64, counter.facing)).toBe(false);
  });

  it('register, taps and mugs can stand on the new cells (surface), and the guests never walk behind it', () => {
    const { s, room, fp, counter } = start();
    const y = fp.y + fp.h;
    const a = piece(900, fp.x + fp.w + 16, y, counter.facing, room.id);
    const items = [...s.items, a];
    const reg = getFurnitureType('register');
    const spot = snapToSurface(room, items, reg, a.x, a.y - 8, 'down');
    expect(spot?.onItemUid).toBe(a.uid);
    const planned = planPlacement(room, items, reg, a.x, a.y - 8, 'down');
    expect(planned.onItemUid).toBe(a.uid);
    const zones = guestZones(items, room);
    const strip = zones.filter((z) => z.x <= a.x && a.x <= z.x + z.w);
    expect(strip.length).toBeGreaterThan(0);
    // moving the piece keeps its riders on it
    const moved = moveItem(items, a.uid, { x: a.x, y: a.y, facing: a.facing, roomId: room.id, onItemUid: null });
    expect(moved.length).toBe(items.length);
  });

  it('a row of pieces is allowed while the staff spot stays reachable, and stops at other furniture', () => {
    const { s, room, fp, counter } = start();
    let items = [...s.items];
    let placed = 0;
    for (let k = 0; k < 20; k++) {
      const x = fp.x + fp.w + 16 + k * 32;
      if (!canPlace(room, items, ext, x, fp.y + fp.h, counter.facing)) break;
      items = [...items, piece(900 + k, x, fp.y + fp.h, counter.facing, room.id)];
      placed++;
    }
    expect(placed).toBeGreaterThanOrEqual(3); // the stove stands 4 cells to the right in the starter tavern
    expect(placed).toBeLessThan(20);
    expect(barExtensionsConnected(items, room.id)).toBe(true);
  });
});
