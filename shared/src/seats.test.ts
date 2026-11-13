import { describe, expect, it } from 'vitest';
import { AVATAR_RADIUS, LIE_HEAD_PX } from './config.ts';
import { FURNITURE_TYPES, footprintRect, getFurnitureType, itemBlockers } from './furniture.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import { createRoom } from './room.ts';
import {
  approachPoints,
  freeSeatsByTap,
  hasSeats,
  headDirection,
  headPoint,
  onSeat,
  planSit,
  seatSpots,
  standUpSpot,
} from './seats.ts';
import type { Facing, FurnitureItem } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 576 x 384
const T = getFurnitureType;
const FACINGS: Facing[] = ['down', 'right', 'up', 'left'];

let nextUid = 1;
function item(typeId: string, x: number, y: number, facing: Facing = 'down'): FurnitureItem {
  return { uid: nextUid++, typeId, ownerId: 1, roomId: room.id, x, y, facing, onItemUid: null };
}
const gridFor = (items: FurnitureItem[]) => buildNavGrid(room, itemBlockers(items, room.id));
const last = <P>(a: P[]): P => a[a.length - 1]!;

describe('seat data', () => {
  it('chair, settle and bench have sit seats (2 on the long ones), the bed one lie seat', () => {
    expect(T('chair').seats.map((s) => s.pose)).toEqual(['sit']);
    expect(T('sofa').seats.map((s) => s.pose)).toEqual(['sit', 'sit']);
    expect(T('bench').seats.map((s) => s.pose)).toEqual(['sit', 'sit']);
    expect(T('bed').seats.map((s) => s.pose)).toEqual(['lie']);
    for (const t of FURNITURE_TYPES) {
      expect(t.sittable).toBe(t.seats.some((s) => s.pose === 'sit'));
      if (!['chair', 'sofa', 'bench', 'bed'].includes(t.id)) expect(hasSeats(t)).toBe(false);
    }
  });

  it('every seat lies inside the footprint in every facing', () => {
    for (const t of FURNITURE_TYPES.filter(hasSeats)) {
      for (const f of t.facings) {
        const it = item(t.id, 200, 200, f);
        const fp = footprintRect(it, t);
        for (const s of seatSpots(it, t)) {
          expect(s.x).toBeGreaterThan(fp.x);
          expect(s.x).toBeLessThan(fp.x + fp.w);
          expect(s.y).toBeGreaterThan(fp.y);
          expect(s.y).toBeLessThan(fp.y + fp.h);
          expect(s.facing).toBe(f);
        }
      }
    }
  });
});

describe('seatSpots', () => {
  it('turns the seats with the item', () => {
    const t = T('sofa'); // 80 x 40, seats (-17, -18) and (17, -18): center offset (+-17, 2)
    const at = (f: Facing) => seatSpots({ x: 200, y: 200, facing: f }, t).map(({ x, y }) => ({ x, y }));
    expect(at('down')).toEqual([{ x: 183, y: 182 }, { x: 217, y: 182 }]);
    // Facing right the footprint is 40 x 80, center (200, 160); (dx, dy) -> (dy, -dx).
    expect(at('right')).toEqual([{ x: 202, y: 177 }, { x: 202, y: 143 }]);
    expect(at('up')).toEqual([{ x: 217, y: 178 }, { x: 183, y: 178 }]);
    expect(at('left')).toEqual([{ x: 198, y: 143 }, { x: 198, y: 177 }]);
  });
});

describe('lying', () => {
  it('puts the head at the pillow end in every facing', () => {
    const t = T('bed');
    for (const f of FACINGS) {
      const bed = item('bed', 300, 250, f);
      const spot = seatSpots(bed, t)[0]!;
      expect(spot.pose).toBe('lie');
      const head = headPoint(spot, LIE_HEAD_PX);
      const center = { x: footprintRect(bed, t).x + footprintRect(bed, t).w / 2, y: footprintRect(bed, t).y + footprintRect(bed, t).h / 2 };
      const dir = headDirection(f);
      // The head is on the pillow side of the bed's middle...
      expect((head.x - center.x) * dir.x + (head.y - center.y) * dir.y).toBeGreaterThan(10);
      // ...and inside the footprint.
      const fp = footprintRect(bed, t);
      expect(head.x).toBeGreaterThan(fp.x);
      expect(head.x).toBeLessThan(fp.x + fp.w);
      expect(head.y).toBeGreaterThan(fp.y);
      expect(head.y).toBeLessThan(fp.y + fp.h);
    }
    expect(headDirection('down')).toEqual({ x: 0, y: -1 });
    expect(headDirection('right')).toEqual({ x: -1, y: 0 });
    expect(headDirection('up')).toEqual({ x: 0, y: 1 });
    expect(headDirection('left')).toEqual({ x: 1, y: 0 });
  });

  it('can be reached from either side of the bed', () => {
    const bed = item('bed', 288, 200); // footprint x 256..320, y 120..200
    const fromLeft = planSit(gridFor([bed]), { x: 100, y: 160 }, bed, T('bed'), null);
    const fromRight = planSit(gridFor([bed]), { x: 480, y: 160 }, bed, T('bed'), null);
    expect(last(fromLeft!.path).x).toBeLessThan(256);
    expect(last(fromRight!.path).x).toBeGreaterThan(320);
  });
});

describe('approachPoints', () => {
  it('lies on all four sides, avatar radius outside, level with the seat', () => {
    const chair = item('chair', 200, 200); // footprint 184..216, 168..200
    const seat = seatSpots(chair, T('chair'))[0]!;
    const r = AVATAR_RADIUS;
    expect(approachPoints(chair, T('chair'), seat)).toEqual([
      { x: 200, y: 200 + r },
      { x: 184 - r, y: seat.y },
      { x: 216 + r, y: seat.y },
      { x: 200, y: 168 - r },
    ]);
  });
});

describe('planSit', () => {
  it('sits on a chair with a table in front of it from the side', () => {
    const chair = item('chair', 200, 200); // footprint 184..216, 168..200
    const table = item('table', 200, 240); // footprint 168..232, 200..240, right in front
    const grid = gridFor([chair, table]);
    const plan = planSit(grid, { x: 200, y: 330 }, chair, T('chair'), null);
    expect(plan).not.toBeNull();
    const end = last(plan!.path);
    // Ends beside the chair, not in front of it (the table is there).
    expect(end.y).toBeLessThan(200);
    expect(end.x < 184 || end.x > 216).toBe(true);
    expect(plan!.seat.facing).toBe('down');
  });

  it('takes the nearest reachable approach point', () => {
    const chair = item('chair', 200, 200);
    const grid = gridFor([chair]);
    // From the right, the right side is nearest.
    expect(last(planSit(grid, { x: 400, y: 180 }, chair, T('chair'), null)!.path).x).toBeGreaterThan(216);
    // From the left, the left side.
    expect(last(planSit(grid, { x: 40, y: 180 }, chair, T('chair'), null)!.path).x).toBeLessThan(184);
    // From below, the front.
    expect(last(planSit(grid, { x: 200, y: 330 }, chair, T('chair'), null)!.path).y).toBeGreaterThan(200);
  });

  it('gives nothing when no approach point is reachable', () => {
    const chair = item('chair', 200, 200);
    // Walled in by four crates.
    const walls = [item('crate', 200, 168), item('crate', 200, 240), item('crate', 160, 220), item('crate', 240, 220)];
    const left = item('crate', 160, 180);
    const right = item('crate', 240, 180);
    const grid = gridFor([chair, ...walls, left, right]);
    expect(planSit(grid, { x: 400, y: 330 }, chair, T('chair'), null)).toBeNull();
  });

  it('gives the 2nd settle seat when the 1st is taken, and the nearest free seat to the tap', () => {
    const sofa = item('sofa', 288, 200);
    const t = T('sofa');
    const grid = gridFor([sofa]);
    const leftTap = { x: 270, y: 180 };
    const rightTap = { x: 306, y: 180 };
    expect(planSit(grid, { x: 288, y: 320 }, sofa, t, leftTap)!.seat.index).toBe(0);
    expect(planSit(grid, { x: 288, y: 320 }, sofa, t, rightTap)!.seat.index).toBe(1);
    expect(planSit(grid, { x: 288, y: 320 }, sofa, t, leftTap, [0])!.seat.index).toBe(1);
    expect(planSit(grid, { x: 288, y: 320 }, sofa, t, leftTap, [0, 1])).toBeNull();
    expect(freeSeatsByTap(sofa, t, null, [1]).map((s) => s.index)).toEqual([0]);
  });

  it('walks in front of the chosen settle seat', () => {
    const sofa = item('sofa', 288, 200); // footprint 248..328
    const plan = planSit(gridFor([sofa]), { x: 240, y: 320 }, sofa, T('sofa'), { x: 310, y: 180 })!;
    expect(plan.seat.index).toBe(1);
    expect(last(plan.path).x).toBeGreaterThan(288);
  });
});

describe('onSeat and standUpSpot', () => {
  it('knows when the seat moved, and stands up on the nearest free spot', () => {
    const chair = item('chair', 200, 200);
    const t = T('chair');
    const seat = seatSpots(chair, t)[0]!;
    expect(onSeat(seat, chair, t, 0)).toBe(true);
    expect(onSeat(seat, { ...chair, x: 240 }, t, 0)).toBe(false);
    expect(onSeat(seat, undefined, undefined, 0)).toBe(false);
    const grid = gridFor([chair]);
    const spot = standUpSpot(grid, seat);
    const c = cellAt(grid, spot);
    expect(isCellFree(grid, c.c, c.r)).toBe(true);
    expect(Math.hypot(spot.x - seat.x, spot.y - seat.y)).toBeLessThan(48);
    // Picked up: the spot is free, so the avatar stays where it is.
    expect(standUpSpot(gridFor([]), seat)).toEqual({ x: seat.x, y: seat.y });
  });
});
