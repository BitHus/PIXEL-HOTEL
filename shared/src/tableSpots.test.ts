import { describe, expect, it } from 'vitest';
import { getFurnitureType } from './furniture.ts';
import { tavernSeats } from './tavern.ts';
import { plateSlot, plateSlots, spotLiftPx, tableTopArea } from './tableSpots.ts';
import { legacyStart, withItem } from './tavernTest.ts';
import type { FurnitureItem } from './types.ts';

const table = (typeId: string): FurnitureItem => ({ uid: 1, typeId, x: 480, y: 224, facing: 'down', roomId: 1, ownerId: 1, onItemUid: null }) as FurnitureItem;

describe('plate slots (OA-2, OA-12)', () => {
  it('a rectangular table keeps its old rule: the footprint, inset', () => {
    const t = table('long_table');
    const type = getFurnitureType('long_table');
    const { rect, inset } = tableTopArea(t, type);
    expect(rect.w).toBe(type.w);
    const s = plateSlot({ x: 0, y: 0 }, t, type);
    expect(s.x).toBe(rect.x + inset);
    expect(s.y).toBeGreaterThanOrEqual(rect.y + inset);
  });

  it('the round table: every seat around it gets a slot inside the drawn ellipse of its top (art rows 0-35 of 64, 60 wide)', () => {
    const t = table('round_table');
    const type = getFurnitureType('round_table');
    // Seats north, east, south, west and a far corner: all four directions of a stool around the 2x2 table.
    const seats = [{ x: 480, y: 120 }, { x: 560, y: 192 }, { x: 480, y: 260 }, { x: 400, y: 192 }, { x: 100, y: 900 }];
    // topFace is in DRAWN coordinates (no lift, spotLiftPx = 0): the art top is x 2..61, y 0..27 of the 64x64 sprite, centre 13.5 px from its top.
    expect(spotLiftPx(type, 29)).toBe(0);
    expect(spotLiftPx(getFurnitureType('long_table'), 26)).toBe(26);
    for (const s of plateSlots(seats, t, type)) {
      const sx = s.x - t.x;
      const sy = s.y - (t.y - 64 + 13.5);
      expect((sx / 30) ** 2 + (sy / 13.5) ** 2, `slot ${s.x},${s.y}`).toBeLessThanOrEqual(1.05); // the box corners touch the rim (rim is drawn, so within 5%)
    }
  });

  it('the starter tavern: the dish spots of its seats are inside the table top', () => {
    let s = legacyStart();
    s = withItem(s, 70, 'bar_stool', 432, 192, 'up'); // north of the table
    const table = s.items.find((i) => i.typeId === 'table')!;
    const type = getFurnitureType('table');
    const { rect } = tableTopArea(table, type);
    const seats = tavernSeats(s.items, s.tavern.roomId).filter((k) => k.tableUid === table.uid);
    expect(seats.length).toBeGreaterThanOrEqual(3);
    for (const k of seats) {
      expect(k.spot.x).toBeGreaterThanOrEqual(rect.x);
      expect(k.spot.x).toBeLessThanOrEqual(rect.x + rect.w);
      expect(k.spot.y).toBeGreaterThanOrEqual(rect.y);
      expect(k.spot.y).toBeLessThanOrEqual(rect.y + rect.h);
    }
  });
});
