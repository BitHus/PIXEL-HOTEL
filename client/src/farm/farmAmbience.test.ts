import { describe, expect, it } from 'vitest';
import { BUILD_CELL, cellOnFloor, createRoom, doorZoneRect } from '@pixel-hotel/shared';
import { farmDecorSpots, grassRoll } from './farmAmbience.ts';

const farm = (id = 5, level: 1 | 2 | 3 = 1) => createRoom(id, 'farm', level, 1);

describe('farm ambience', () => {
  it('is deterministic per room id and differs between rooms', () => {
    expect(farmDecorSpots(farm(5))).toEqual(farmDecorSpots(farm(5)));
    expect(farmDecorSpots(farm(5))).not.toEqual(farmDecorSpots(farm(6)));
  });
  it('places a modest amount, on floor, inside the cell, off the door zone', () => {
    for (const lvl of [1, 2, 3] as const) {
      const room = farm(9, lvl);
      const spots = farmDecorSpots(room);
      const cells = (room.w / BUILD_CELL) * (room.h / BUILD_CELL);
      expect(spots.length).toBeGreaterThan(3);
      expect(spots.length).toBeLessThan(cells * 0.3);
      const dz = doorZoneRect(room);
      for (const s of spots) {
        expect(cellOnFloor(room, s.c, s.r)).toBe(true);
        expect(Math.floor(s.x / BUILD_CELL)).toBe(s.c);
        expect(Math.floor(s.y / BUILD_CELL)).toBe(s.r);
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        const inZone = s.x >= dz.x && s.x < dz.x + dz.w && s.y >= dz.y && s.y < dz.y + dz.h;
        expect(inZone).toBe(false);
      }
    }
  });
  it('trees stand only on the back row and keep a gap', () => {
    const trees = farmDecorSpots(farm(3, 3)).filter((s) => s.kind === 'tree');
    for (const t of trees) expect(t.r).toBe(0);
    for (let i = 1; i < trees.length; i++) expect(trees[i]!.c - trees[i - 1]!.c).toBeGreaterThanOrEqual(3);
  });
  it('grass rolls are stable, bounded, and use one variant when only one exists', () => {
    let shifted = 0;
    let tinted = 0;
    for (let c = 0; c < 20; c++) for (let r = 0; r < 12; r++) {
      const a = grassRoll(4, c, r, 1);
      expect(a).toEqual(grassRoll(4, c, r, 1));
      expect(a.variant).toBe(0);
      if (a.shift) shifted++;
      if (a.tint) tinted++;
      expect(grassRoll(4, c, r, 3).variant).toBeLessThan(3);
    }
    expect(shifted).toBeGreaterThan(40);
    expect(tinted).toBeGreaterThan(40);
  });
});
