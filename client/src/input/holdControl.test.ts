import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, HOLD_PLACE_MS } from '@pixel-hotel/shared';
import { HoldControl, type HoldResult, type HoldTarget } from './holdControl.ts';

function setup(answer: (t: HoldTarget, n: number) => HoldResult = () => 'go') {
  let now = 0;
  let walking = false;
  const hits: HoldTarget[] = [];
  const control = new HoldControl({
    now: () => now,
    walking: () => walking,
    hit: async (t) => {
      hits.push(t);
      return answer(t, hits.length);
    },
  });
  const advance = async (ms: number): Promise<void> => {
    for (let i = 0; i < ms; i += 16) {
      now += 16;
      control.tick();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return { control, hits, advance, setWalking: (w: boolean) => (walking = w) };
}

describe('HoldControl', () => {
  it('hits at once on start, then at the cooldown rate, one request per hit', async () => {
    const { control, hits, advance } = setup();
    control.start({ kind: 'block', c: 3, r: 3 });
    await Promise.resolve();
    expect(hits).toHaveLength(1); // the first hit is on press
    await advance(1000);
    expect(hits.length).toBeGreaterThanOrEqual(4);
    expect(hits.length).toBeLessThanOrEqual(1 + Math.floor(1000 / BLOCK_HIT_COOLDOWN_MS));
  });

  it('stops when the thing breaks, and when released', async () => {
    const a = setup((_t, n) => (n === 3 ? 'stop' : 'go'));
    a.control.start({ kind: 'block', c: 1, r: 1 });
    await a.advance(3000);
    expect(a.hits).toHaveLength(3);
    expect(a.control.active).toBe(false);
    const b = setup();
    b.control.start({ kind: 'tree', index: 2 });
    await b.advance(500);
    const n = b.hits.length;
    b.control.stop();
    await b.advance(2000);
    expect(b.hits).toHaveLength(n);
  });

  it('waits while the avatar walks closer, then goes on', async () => {
    const { control, hits, advance, setWalking } = setup((_t, n) => (n === 1 ? 'walk' : 'go'));
    setWalking(true);
    control.start({ kind: 'block', c: 5, r: 5 });
    await advance(1000);
    expect(hits).toHaveLength(1); // walking: no more requests
    setWalking(false);
    await advance(300);
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('a retry answer does not use up the cooldown', async () => {
    const { control, hits, advance } = setup((_t, n) => (n <= 2 ? 'retry' : 'go'));
    control.start({ kind: 'rock', id: 7 });
    await advance(100);
    expect(hits.length).toBeGreaterThanOrEqual(3); // asked again on the next frames, not 400 ms later
  });

  it('a place line takes the cells in order, one per HOLD_PLACE_MS, and skips nothing', async () => {
    const { control, hits, advance } = setup();
    control.start({ kind: 'line', c: 2, r: 2 });
    control.push([
      { c: 3, r: 2 },
      { c: 4, r: 2 },
    ]);
    await advance(HOLD_PLACE_MS * 4);
    expect(hits).toEqual([
      { kind: 'line', c: 2, r: 2 },
      { kind: 'line', c: 3, r: 2 },
      { kind: 'line', c: 4, r: 2 },
    ]);
    expect(control.lastCell).toEqual({ c: 4, r: 2 });
  });

  it('an answer that arrives after the hold ended is ignored', async () => {
    const { control, hits, advance } = setup(() => 'stop');
    control.start({ kind: 'block', c: 1, r: 1 });
    control.stop();
    control.start({ kind: 'block', c: 2, r: 2 });
    await advance(100);
    await advance(1000);
    expect(hits.some((h) => h.kind === 'block' && h.c === 2)).toBe(true);
  });
});
