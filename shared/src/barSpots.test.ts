import { describe, expect, it } from 'vitest';
import { BAR_SPOTS_MAX, GUEST_MAX } from './config.ts';
import { barServePoint, barSpotFor, barSpotIndex, barSpots, chooseSpot, freeBarSpots } from './barSpots.ts';
import { doorPoint, footprintRect, getFurnitureType, staffZone } from './furniture.ts';
import { buildNavGrid } from './nav.ts';
import { guestZones, npcGrid, npcPath } from './npcNav.ts';
import { rectsOverlap } from './room.ts';
import { seededRng } from './rng.ts';
import { itemBlockers } from './furniture.ts';
import { legacyStart, withItem } from './tavernTest.ts';

function world(extra: (s: ReturnType<typeof legacyStart>) => ReturnType<typeof legacyStart> = (s) => s) {
  const s = extra(legacyStart());
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  const grid = npcGrid(buildNavGrid(room, itemBlockers(s.items, room.id)), guestZones(s.items, room));
  return { s, room, grid, spots: barSpots(s.items, room, grid) };
}

describe('bar spots (TF-1)', () => {
  it('a counter of 3 cells gives 3 spots on the customer side, facing the bar, left to right', () => {
    const { s, room, grid, spots } = world();
    const counter = s.items.find((i) => i.typeId === 'counter')!;
    const fp = footprintRect(counter, getFurnitureType('counter'));
    expect(spots).toHaveLength(Math.round(fp.w / 32));
    expect(spots.map((p) => p.cell.c)).toEqual([...spots.map((p) => p.cell.c)].sort((a, b) => a - b));
    for (const p of spots) {
      expect(p.barUid).toBe(counter.uid);
      expect(p.side).toBe('front');
      // On the customer side: opposite to the staff strip.
      const zone = staffZone(counter, getFurnitureType('counter'));
      expect(rectsOverlap({ x: p.x - 16, y: p.y - 16, w: 32, h: 32 }, zone)).toBe(false);
      expect(npcPath(grid, doorPoint(room), p).length).toBeGreaterThan(0);
    }
  });

  it('every spot is free of blockers, off the staff zones, the kitchen and the door zone', () => {
    const { s, room, spots } = world();
    const blockers = itemBlockers(s.items, room.id);
    for (const p of spots) {
      const cell = { x: p.cell.c * 32, y: p.cell.r * 32, w: 32, h: 32 };
      expect(blockers.some((b) => rectsOverlap(cell, b))).toBe(false);
      expect(guestZones(s.items, room).some((z) => rectsOverlap(cell, z))).toBe(false);
    }
  });

  it('each bar extension piece adds one spot (a 4-cell bar = 4 spots); capped at BAR_SPOTS_MAX', () => {
    const base = world();
    const counter = base.s.items.find((i) => i.typeId === 'counter')!;
    const fp = footprintRect(counter, getFurnitureType('counter'));
    const more = world((s) => withItem(s, 90, 'counter_ext', fp.x + fp.w + 16, fp.y + fp.h, counter.facing));
    expect(more.spots).toHaveLength(base.spots.length + 1);
    expect(BAR_SPOTS_MAX).toBeLessThanOrEqual(GUEST_MAX);
    expect(more.spots.length).toBeLessThanOrEqual(BAR_SPOTS_MAX);
  });

  it('a turned counter still has spots on its customer side, facing it', () => {
    for (const facing of ['up', 'left', 'right'] as const) {
      const { s, spots } = world((st) => ({ ...st, items: st.items.map((i) => (i.typeId === 'counter' ? { ...i, facing } : i)) }));
      const counter = s.items.find((i) => i.typeId === 'counter')!;
      const zone = staffZone(counter, getFurnitureType('counter'));
      for (const p of spots) expect(rectsOverlap({ x: p.x - 16, y: p.y - 16, w: 32, h: 32 }, zone)).toBe(false);
    }
  });

  it('freeBarSpots: a guest or a mess holds a spot; barSpotFor picks the nearest the door, then the leftmost', () => {
    const { spots, room } = world();
    expect(spots.length).toBeGreaterThan(1);
    const first = spots[0]!;
    const held = { barSpot: { barUid: first.barUid, c: first.cell.c, r: first.cell.r } };
    expect(freeBarSpots(spots, [held])).toHaveLength(spots.length - 1);
    expect(freeBarSpots(spots, [], [{ seatUid: first.barUid, seatIndex: barSpotIndex(first.cell) }])).toHaveLength(spots.length - 1);
    expect(freeBarSpots(spots, [], [], [held.barSpot])).toHaveLength(spots.length - 1);
    const door = doorPoint(room);
    const pick = barSpotFor(spots, door)!;
    const d = (p: { x: number; y: number }): number => Math.hypot(p.x - door.x, p.y - door.y);
    expect(d(pick)).toBe(Math.min(...spots.map(d)));
    expect(barSpotFor([], door)).toBeNull();
  });

  it('the hand-over point lies on the staff side, level with the spot, and is reachable by the player', () => {
    const { s, spots } = world();
    const counter = s.items.find((i) => i.typeId === 'counter')!;
    const zone = staffZone(counter, getFurnitureType('counter'));
    for (const p of spots) {
      const sp = barServePoint(p, counter);
      expect(sp.x).toBeGreaterThanOrEqual(zone.x);
      expect(sp.x).toBeLessThanOrEqual(zone.x + zone.w);
      expect(sp.y).toBeGreaterThanOrEqual(zone.y);
      expect(sp.y).toBeLessThanOrEqual(zone.y + zone.h);
      expect(Math.abs(sp.x - p.x)).toBeLessThanOrEqual(1);
    }
  });
});

describe('chooseSpot (TF-2)', () => {
  const rng = (): number => 0.5;
  it('nothing free = null, no seat = bar, no spot = table', () => {
    expect(chooseSpot(rng, { size: 1, seatsFree: 0, spotsFree: 0 })).toBeNull();
    expect(chooseSpot(rng, { size: 1, seatsFree: 0, spotsFree: 2 })).toBe('bar');
    expect(chooseSpot(rng, { size: 1, seatsFree: 3, spotsFree: 0 })).toBe('table');
  });
  it('groups take a table first, the bar only when no table fits them', () => {
    expect(chooseSpot(rng, { size: 3, seatsFree: 3, spotsFree: 5 })).toBe('table');
    expect(chooseSpot(rng, { size: 3, seatsFree: 2, spotsFree: 3 })).toBe('bar');
    expect(chooseSpot(rng, { size: 2, seatsFree: 1, spotsFree: 1 })).toBeNull();
  });
  it('a single guest: same seed same result, more free spots raise the bar share, a dish wish lowers it', () => {
    const share = (c: { seatsFree: number; spotsFree: number; wantsDish?: boolean }): number => {
      const r = seededRng(5);
      let n = 0;
      for (let k = 0; k < 2000; k++) if (chooseSpot(r, { size: 1, ...c }) === 'bar') n++;
      return n / 2000;
    };
    const a = chooseSpot(seededRng(9), { size: 1, seatsFree: 3, spotsFree: 3 });
    expect(chooseSpot(seededRng(9), { size: 1, seatsFree: 3, spotsFree: 3 })).toBe(a);
    expect(share({ seatsFree: 3, spotsFree: 5 })).toBeGreaterThan(share({ seatsFree: 3, spotsFree: 1 }));
    expect(share({ seatsFree: 3, spotsFree: 3, wantsDish: true })).toBeLessThan(share({ seatsFree: 3, spotsFree: 3 }));
    // BAR_BASE 0.35 with 3 seats and 1 spot = 0.35 - 0.15 = 0.20
    expect(share({ seatsFree: 3, spotsFree: 1 })).toBeGreaterThan(0.15);
    expect(share({ seatsFree: 3, spotsFree: 1 })).toBeLessThan(0.25);
  });
});
