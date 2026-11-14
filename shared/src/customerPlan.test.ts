import { describe, expect, it } from 'vitest';
import { ACT_WEIGHTS, BUYER_ACTS, WINDOW_ACTS } from './config.ts';
import { BEHAVIOURS, actWeight, pickBehaviour, planKey, planVisit, npcGrid, npcPath, inStaffZone } from './customerPlan.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import type { CustomerKind } from './npcTalk.ts';
import { createRoom } from './room.ts';
import { seededRng } from './rng.ts';

const KINDS: CustomerKind[] = ['hurried', 'browser', 'chatty'];

describe('the behaviour picker (natural customers)', () => {
  it('picks by weight: every behaviour comes, the heavier ones more often, a kind likes its own', () => {
    const rng = seededRng(1);
    const count = (kind: CustomerKind): Record<string, number> => {
      const n: Record<string, number> = {};
      for (let i = 0; i < 6000; i++) {
        const b = pickBehaviour(rng, kind)!;
        n[b] = (n[b] ?? 0) + 1;
      }
      return n;
    };
    const browser = count('browser');
    for (const b of BEHAVIOURS) expect(browser[b] ?? 0, b).toBeGreaterThan(0);
    const total = BEHAVIOURS.reduce((a, b) => a + actWeight(b, 'browser'), 0);
    for (const b of BEHAVIOURS) expect((browser[b] ?? 0) / 6000).toBeCloseTo(actWeight(b, 'browser') / total, 1);
    const chatty = count('chatty');
    expect(chatty.talk! / 6000).toBeGreaterThan(browser.talk! / 6000);
    // A hurried customer never sits down.
    expect(count('hurried').sit).toBeUndefined();
    expect(Object.keys(ACT_WEIGHTS).sort()).toEqual(['decor', 'goods', 'remark', 'sit', 'talk', 'wander']);
  });

  it('never picks an excluded behaviour', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 500; i++) expect(['wander', 'goods']).not.toContain(pickBehaviour(rng, 'chatty', ['wander', 'goods']));
    expect(pickBehaviour(rng, 'chatty', BEHAVIOURS)).toBeNull();
  });

  it('a buyer ends at the goods, a window-shopper has no fixed end; never the same thing twice in a row', () => {
    const rng = seededRng(3);
    for (const kind of KINDS) {
      for (let i = 0; i < 400; i++) {
        const buy = planVisit(rng, kind, true, undefined);
        expect(buy[buy.length - 1]).toBe('goods');
        expect(buy.length - 1).toBeGreaterThanOrEqual(BUYER_ACTS[kind][0]);
        expect(buy.length - 1).toBeLessThanOrEqual(BUYER_ACTS[kind][1]);
        const look = planVisit(rng, kind, false, undefined);
        expect(look.length).toBeGreaterThanOrEqual(WINDOW_ACTS[kind][0]);
        expect(look.length).toBeLessThanOrEqual(WINDOW_ACTS[kind][1]);
        for (const plan of [buy, look]) for (let k = 1; k < plan.length; k++) expect(plan[k]).not.toBe(plan[k - 1]);
      }
    }
    // Some buyers go straight to the goods.
    const straight = Array.from({ length: 200 }, () => planVisit(rng, 'hurried', true, undefined)).filter((p) => p.length === 1);
    expect(straight.length).toBeGreaterThan(20);
  });

  it('a plan is never the same as the one before, and plans differ a lot', () => {
    const rng = seededRng(4);
    for (const kind of KINDS) {
      for (const buys of [true, false]) {
        let last: string | undefined;
        const seen = new Set<string>();
        for (let i = 0; i < 500; i++) {
          const key = planKey(planVisit(rng, kind, buys, last));
          expect(key).not.toBe(last);
          seen.add(key);
          last = key;
        }
        expect(seen.size).toBeGreaterThan(kind === 'hurried' ? 4 : 15);
      }
    }
  });
});

describe('the customers\' nav grid (staff only)', () => {
  const room = createRoom(2, 'shop', 1, 1);
  const grid = buildNavGrid(room, []);
  const zone = { x: 100, y: 40, w: 96, h: 40 };

  it('blocks every cell that touches a staff zone and nothing else', () => {
    const g = npcGrid(grid, [zone]);
    expect(npcGrid(grid, [zone])).toBe(g); // cached
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const x = c * g.cell;
        const y = r * g.cell;
        const touches = x < zone.x + zone.w && x + g.cell > zone.x && y < zone.y + zone.h && y + g.cell > zone.y;
        expect(isCellFree(g, c, r)).toBe(!touches);
      }
    }
    expect(grid.blocked.every((b) => !b)).toBe(true); // the room's own grid is untouched
  });

  it('a way to a spot in the zone ends at the nearest free spot outside it', () => {
    const g = npcGrid(grid, [zone]);
    const path = npcPath(g, { x: 300, y: 200 }, { x: 148, y: 60 });
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1]!;
    expect(inStaffZone([zone], end)).toBe(false);
    const cell = cellAt(g, end);
    expect(isCellFree(g, cell.c, cell.r)).toBe(true);
    expect(Math.hypot(end.x - 148, end.y - 60)).toBeLessThan(40);
  });
});
