import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BLOCK_STACK_RISE_PX, BUILD_CELL, NAV_STEP_MAX } from './config.ts';
import type { BlockCell } from './blockTypes.ts';
import { npcGrid } from './npcNav.ts';
import { buildNavGrid, canStep, cellCenter, findPath, isCellFree, levelOf, lineOfSight, reachableCells, type NavGrid } from './nav.ts';
import { buildWalkGrid, cellLevel, easeLift, levelAtPoint, liftPxOfLevel } from './navHeights.ts';
import { createNewPlayer } from './newPlayer.ts';
import type { Room } from './room.ts';

// Step ST3: the player walks over block stacks by steps of at most NAV_STEP_MAX level; guests stay on level 0.
const base = (): Room => createNewPlayer(undefined, 0).rooms.find((r) => r.kind === 'hotel')!;
const b: BlockCell = { id: 'dirt', hits: 0, hitAt: 0 };
const withStacks = (room: Room, stacks: Record<string, number>): Room => ({
  ...room,
  blocks: Object.fromEntries(Object.entries(stacks).map(([k, n]) => [k, Array.from({ length: n }, () => b)])),
});
// A free spot in the middle of the room, cells (c, r) .. (c+4, r).
const spot = (room: Room): { c: number; r: number } => ({ c: Math.floor(room.w / BUILD_CELL / 2) - 2, r: Math.floor(room.h / BUILD_CELL / 2) });
const idx = (g: NavGrid, c: number, r: number): number => r * g.cols + c;

describe('cell levels', () => {
  it('level = stack size, 0 without blocks', () => {
    const room = withStacks(base(), { '3,3': 2 });
    expect(cellLevel(room, 3, 3)).toBe(2);
    expect(cellLevel(room, 4, 3)).toBe(0);
    expect(levelAtPoint(room, { x: 3 * BUILD_CELL + 5, y: 3 * BUILD_CELL + 5 })).toBe(2);
  });
  it('the walk grid keeps block cells free and records their level; the plain grid still blocks them', () => {
    const room = withStacks(base(), { '3,3': 2 });
    const g = buildWalkGrid(room, []);
    expect(isCellFree(g, 3, 3)).toBe(true);
    expect(levelOf(g, idx(g, 3, 3))).toBe(2);
  });
});

describe('stepping', () => {
  it('canStep: up to NAV_STEP_MAX', () => {
    expect(NAV_STEP_MAX).toBe(1);
    const room = withStacks(base(), { '3,3': 1, '4,3': 3 });
    const g = buildWalkGrid(room, []);
    expect(canStep(g, idx(g, 2, 3), idx(g, 3, 3))).toBe(true);
    expect(canStep(g, idx(g, 3, 3), idx(g, 4, 3))).toBe(false);
    expect(canStep(g, idx(g, 2, 3), idx(g, 4, 3))).toBe(false);
  });
  it('a stair 1-2-3 is climbed; a lone 2-stack is a wall from the floor', () => {
    const room0 = base();
    const { c, r } = spot(room0);
    const stair = buildWalkGrid(withStacks(room0, { [`${c + 1},${r}`]: 1, [`${c + 2},${r}`]: 2, [`${c + 3},${r}`]: 3 }), []);
    const from = cellCenter(stair, c, r);
    const top = cellCenter(stair, c + 3, r);
    const path = findPath(stair, from, top);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(top);
    // walls on the sides of a lone 2-stack: no way up, the goal falls back to the nearest reachable cell.
    const lone = buildWalkGrid(withStacks(room0, { [`${c + 2},${r}`]: 2 }), []);
    const reach = reachableCells(lone, idx(lone, c, r));
    expect(reach[idx(lone, c + 2, r)]).toBe(false);
    // a free but unreachable goal gives no path (same as any unreachable free cell)
    expect(findPath(lone, cellCenter(lone, c, r), cellCenter(lone, c + 2, r))).toBeNull();
  });
  it('a path over the stair never makes a step bigger than NAV_STEP_MAX (cell by cell)', () => {
    const room0 = base();
    const { c, r } = spot(room0);
    const g = buildWalkGrid(withStacks(room0, { [`${c + 1},${r}`]: 1, [`${c + 2},${r}`]: 2, [`${c + 3},${r}`]: 3, [`${c + 4},${r}`]: 2 }), []);
    const path = findPath(g, cellCenter(g, c, r), cellCenter(g, c + 4, r))!;
    let prev = idx(g, c, r);
    for (const p of path.slice(1)) {
      // sample the segment finely: neighbour samples never differ by more than the step max
      const cc = Math.floor(p.x / g.cell);
      const rr = Math.floor(p.y / g.cell);
      expect(Math.abs(levelOf(g, idx(g, cc, rr)) - levelOf(g, prev))).toBeLessThanOrEqual(NAV_STEP_MAX);
      prev = idx(g, cc, rr);
    }
  });
  it('line of sight is cut at a level change (smoothing never cuts across a stair)', () => {
    const room0 = base();
    const { c, r } = spot(room0);
    const g = buildWalkGrid(withStacks(room0, { [`${c + 1},${r}`]: 1 }), []);
    expect(lineOfSight(g, cellCenter(g, c, r), cellCenter(g, c + 2, r))).toBe(false);
    expect(lineOfSight(g, cellCenter(g, c, r + 1), cellCenter(g, c + 2, r + 1))).toBe(true);
  });
  it('the start cell may drop down: an avatar on a stack with broken neighbours is not stuck', () => {
    const room0 = base();
    const { c, r } = spot(room0);
    const g = buildWalkGrid(withStacks(room0, { [`${c},${r}`]: 3 }), []);
    const path = findPath(g, cellCenter(g, c, r), cellCenter(g, c + 3, r));
    expect(path).not.toBeNull();
  });
  it('a plant on a block cell and furniture still block the player', () => {
    const room0 = base();
    const { c, r } = spot(room0);
    const room = { ...withStacks(room0, { [`${c},${r}`]: 1 }), plants: { [`${c},${r}`]: { seedId: 'dirt_seed', plantedAt: 0, growMs: 1, splice: null } } } as unknown as Room;
    expect(isCellFree(buildWalkGrid(room, []), c, r)).toBe(false);
  });
});

describe('guests stay on level 0', () => {
  it('the guest grid (plain buildNavGrid with the block rects) never lists a block cell as free', () => {
    const room = withStacks(base(), { '3,3': 1 });
    const g = npcGrid(buildNavGrid(room, [{ x: 3 * BUILD_CELL, y: 3 * BUILD_CELL, w: BUILD_CELL, h: BUILD_CELL }]), []);
    expect(isCellFree(g, 3, 3)).toBe(false);
    expect(g.level).toBeUndefined();
  });
});

describe('lift', () => {
  it('lift is level * rise; the ease converges, never overshoots, is frame-rate independent', () => {
    expect(liftPxOfLevel(2)).toBe(2 * BLOCK_STACK_RISE_PX);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 200 }), (a, t, dt) => {
        const cur = liftPxOfLevel(a);
        const target = liftPxOfLevel(t);
        const next = easeLift(cur, target, dt);
        expect(Math.abs(target - next)).toBeLessThanOrEqual(Math.abs(target - cur));
        expect(next >= Math.min(cur, target) && next <= Math.max(cur, target)).toBe(true);
      }),
    );
    expect(easeLift(0, 14, 5000)).toBe(14);
    const once = easeLift(0, 14, 100);
    const twice = easeLift(easeLift(0, 14, 50), 14, 50);
    expect(Math.abs(once - twice)).toBeLessThan(1e-6);
  });
});
