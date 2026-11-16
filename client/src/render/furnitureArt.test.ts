import { describe, expect, it } from 'vitest';
import { FURNITURE_TYPES, LIE_HEAD_PX, footprintRect, headPoint, seatSpots, type ArtBox, type Facing } from '@pixel-hotel/shared';
import { boxesForFacing, iconStylePixels, roleFloorRects, seatHeight, seatLiftFor, surfaceHeight } from './furnitureArt.ts';

/** The floor rect of a box relative to the anchor. */
const floorOf = (b: ArtBox) => ({ x: b.dx, y: b.dy - b.d, w: b.w, h: b.d });

describe('furniture art', () => {
  it('every type is as tall as its boxes, and its boxes stay inside the footprint', () => {
    for (const t of FURNITURE_TYPES) {
      const boxes = boxesForFacing(t, 'down').boxes;
      expect(Math.max(...boxes.map((b) => -b.dy + b.z + b.h + b.d))).toBe(t.height);
      for (const facing of ['down', 'right', 'up'] as Facing[]) {
        const fp = footprintRect({ x: 0, y: 0, facing }, t);
        for (const b of boxesForFacing(t, facing).boxes) {
          const r = floorOf(b);
          expect(r.x >= fp.x && r.y >= fp.y && r.x + r.w <= fp.x + fp.w && r.y + r.h <= fp.y + fp.h, `${t.id} ${facing}`).toBe(true);
        }
      }
    }
  });

  it('left is right mirrored', () => {
    const chair = FURNITURE_TYPES.find((t) => t.id === 'chair')!;
    expect(boxesForFacing(chair, 'left')).toEqual({ ...boxesForFacing(chair, 'right'), mirror: true });
  });
});

describe('lying on the bed (step 5b)', () => {
  it('puts the head on the pillow in all four facings', () => {
    const bed = FURNITURE_TYPES.find((t) => t.id === 'bed')!;
    for (const facing of ['down', 'right', 'up', 'left'] as Facing[]) {
      const spot = seatSpots({ x: 0, y: 0, facing }, bed)[0]!;
      const head = headPoint(spot, LIE_HEAD_PX);
      const [pillow] = roleFloorRects(bed, facing, 'pillow');
      expect(pillow, facing).toBeDefined();
      // Inside the pillow, give or take a pixel or two at its back edge.
      const m = 2;
      const inside =
        head.x >= pillow!.x - m && head.x <= pillow!.x + pillow!.w + m && head.y >= pillow!.y - m && head.y <= pillow!.y + pillow!.h + m;
      expect(inside, `${facing}: head ${JSON.stringify(head)} pillow ${JSON.stringify(pillow)}`).toBe(true);
      // The blanket is there in every facing too.
      expect(roleFloorRects(bed, facing, 'cover')).toHaveLength(1);
    }
  });
});

describe('icon style (room art looks like the item icon)', () => {
  it('adds one outline around the whole shape and light on the top-left edge', () => {
    const out = iconStylePixels([[0, 0, 4, 4, '#808080']]);
    const px = new Map<string, string>();
    for (const [x, y, w, h, c] of out) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px.set(`${x + i},${y + j}`, c);
    expect(px.size).toBe(4 * 4 + 4 * 4); // 4x4 plus a 1 px outline on the four sides (no corners)
    expect(px.get('-1,-1')).toBeUndefined(); // no corner pixel in the outline
    expect(px.get('-1,0')).toBe(px.get('0,-1')); // outline colour
    expect(px.get('0,0')).not.toBe('#808080'); // lighter top-left edge
    expect(px.get('1,1')).toBe('#808080'); // the inside stays flat
  });
});

describe('heights match the sprites (ART-REDO R1 and R2)', () => {
  const type = (id: string) => FURNITURE_TYPES.find((t) => t.id === id)!;
  it('surface heights', () => {
    expect(surfaceHeight(type('round_table'))).toBe(26);
    expect(surfaceHeight(type('table'))).toBe(26);
    expect(surfaceHeight(type('long_table'))).toBe(26);
  });
  it('seat heights, and the avatar is raised past the standard pose', () => {
    expect(seatHeight(type('bar_stool'))).toBe(24);
    expect(seatHeight(type('chair'))).toBe(18);
    expect(seatLiftFor(type('bar_stool'))).toBe(10);
    expect(seatLiftFor(type('chair'))).toBe(4);
    expect(seatLiftFor(type('table'))).toBe(0);
  });
  it('R4 boxes match the new sprites: sofa seat 16 and back 38, bench seat 18, desk top 28, rug fills its footprint', () => {
    expect(seatHeight(type('sofa'))).toBe(16);
    expect(Math.max(...boxesForFacing(type('sofa'), 'down').boxes.map((b) => b.z + b.h))).toBe(38);
    expect(seatHeight(type('bench'))).toBe(18);
    expect(surfaceHeight(type('desk'))).toBe(28);
    const rug = type('rug');
    const base = boxesForFacing(rug, 'down').boxes.find((b) => b.w === rug.w && b.d === rug.d);
    expect(base).toBeDefined();
    expect(surfaceHeight(rug)).toBe(0);
  });
});
