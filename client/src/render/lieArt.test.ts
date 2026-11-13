import { describe, expect, it } from 'vitest';
import { START_LOOK, footprintRect, getFurnitureType, headPoint, LIE_HEAD_PX, seatSpots, type Facing } from '@pixel-hotel/shared';
import { bedRects, lyingRects, pillowMiddle, rectBounds } from './lieArt.ts';

const bed = getFurnitureType('bed');
const FACINGS: Facing[] = ['down', 'right', 'up', 'left'];

describe('lying in bed (step 5b fix)', () => {
  for (const facing of FACINGS) {
    it(`stays inside the bed and puts the head at the pillow end (${facing})`, () => {
      const rects = lyingRects(START_LOOK, bed, facing);
      // Inside the bed's own drawing (the footprint with the bed's height), every rectangle.
      const [bx0, by0, bx1, by1] = rectBounds(bedRects(bed, facing));
      for (const [x, y, w, h] of rects) {
        expect(x >= bx0 && y >= by0 && x + w <= bx1 && y + h <= by1, `${facing}: ${[x, y, w, h]}`).toBe(true);
      }
      // Sideways the drawing never leaves the footprint.
      const fp = footprintRect({ x: 0, y: 0, facing }, bed);
      const [lx0, , lx1, ly1] = rectBounds(rects);
      expect(lx0).toBeGreaterThanOrEqual(fp.x - 1);
      expect(lx1).toBeLessThanOrEqual(fp.x + fp.w + 1);
      expect(ly1).toBeLessThanOrEqual(fp.y + fp.h + 1);
      // The head is the middle of the pillow, at the pillow end of the bed (the head end of the body).
      const head = pillowMiddle(bed, facing);
      const spot = seatSpots({ x: 0, y: 0, facing }, bed)[0]!;
      const floorHead = headPoint(spot, LIE_HEAD_PX);
      const towardHead = { x: floorHead.x - spot.x, y: floorHead.y - spot.y };
      expect(Math.sign(head.x - spot.x) * Math.sign(towardHead.x) >= 0).toBe(true);
      if (towardHead.x !== 0) expect(Math.sign(head.x - spot.x)).toBe(Math.sign(towardHead.x));
      if (facing === 'down') expect(head.y).toBeLessThan(spot.y - 12);
      if (facing === 'up') expect(head.y).toBeGreaterThan(spot.y);
    });
  }

  it('draws the blanket last, over the head and shoulders', () => {
    const rects = lyingRects(START_LOOK, bed, 'down');
    const cover = bedRects(bed, 'down', 'cover');
    expect(rects.slice(-cover.length)).toEqual(cover);
    expect(rects.length).toBeGreaterThan(cover.length);
  });
});
