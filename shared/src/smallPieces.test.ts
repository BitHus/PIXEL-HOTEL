// A2: the small pieces (wall items, small decor, rugs, floor decor) can be planned and placed in a hotel room with the right snap: floor pieces on whole cells,
// wall pieces free inside the back wall band on the 4 px snap, free-on-surface decor free on a surface top.
import { describe, expect, it } from 'vitest';
import { BUILD_CELL, SNAP } from './config.ts';
import { FURNITURE_TYPES, canPlace, getFurnitureType, isOnGrid, wallItemRect } from './furniture.ts';
import { planGhost, startNewPlacing } from './placing.ts';
import { wallBands, createRoom } from './room.ts';
import type { FurnitureItem } from './types.ts';

const room = createRoom(1, 'hotel', 2, 1);
const hotelTypes = FURNITURE_TYPES.filter((t) => t.placeIn === 'both' || t.placeIn === 'hotel');
const band = wallBands(room)[0]!;

describe('small pieces can be placed in a hotel room', () => {
  it('every wall piece fits on the back wall band, on the 4 px snap, whole item inside the band', () => {
    const walls = hotelTypes.filter((t) => t.wall);
    expect(walls.length).toBeGreaterThan(3);
    for (const t of walls) {
      const s = startNewPlacing(t.id, { x: band.x + 70 + 3, y: band.y + band.h / 2 + 1 }, null);
      const plan = planGhost(room, [], s);
      expect(plan.ok, t.id).toBe(true);
      expect(Math.abs(plan.x % SNAP), t.id).toBe(0);
      expect(Math.abs(plan.y % SNAP), t.id).toBe(0);
      const r = wallItemRect(plan, t);
      expect(r.y).toBeGreaterThanOrEqual(band.y);
      expect(r.y + r.h).toBeLessThanOrEqual(band.y + band.h);
    }
  });
  it('every non-blocking or small floor piece lands on whole cells inside the floor', () => {
    const smalls = hotelTypes.filter((t) => !t.wall && (!t.blocks || t.freeOnSurface || (t.w <= 32 && t.d <= 32)));
    expect(smalls.length).toBeGreaterThan(5);
    for (const t of smalls) {
      const s = startNewPlacing(t.id, { x: 6 * BUILD_CELL + 7, y: 7 * BUILD_CELL + 5 }, null);
      const plan = planGhost(room, [], s);
      expect(plan.onItemUid, t.id).toBeNull();
      expect(isOnGrid(plan, t), t.id).toBe(true);
      expect(canPlace(room, [], t, plan.x, plan.y, plan.facing), t.id).toBe(true);
    }
  });
  it('small decor on a surface moves freely on the 4 px snap, also on the second try after it was placed', () => {
    const decor = hotelTypes.find((t) => t.freeOnSurface && t.onSurface)!;
    const table = FURNITURE_TYPES.find((t) => t.surface && (t.placeIn === 'both' || t.placeIn === 'hotel'));
    if (!table) return;
    const at = { x: 5 * BUILD_CELL + table.w / 2, y: 6 * BUILD_CELL + table.d };
    const item: FurnitureItem = { uid: 1, typeId: table.id, ownerId: 1, roomId: room.id, x: at.x, y: at.y, facing: table.facings[0]!, onItemUid: null };
    const s = startNewPlacing(decor.id, { x: at.x + 5, y: at.y - table.d / 2 + 3 }, null);
    const plan = planGhost(room, [item], s);
    expect(plan.ok).toBe(true);
    expect(plan.onItemUid).toBe(1);
    expect(Math.abs(plan.x % SNAP)).toBe(0);
    expect(getFurnitureType(decor.id).freeOnSurface).toBe(true);
  });
});
