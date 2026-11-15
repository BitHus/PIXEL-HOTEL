import { describe, expect, it } from 'vitest';
import { AXE_COOLDOWN_MS, BLOCK_HIT_COOLDOWN_MS, PICKAXE_COOLDOWN_MS, TAP_MAX_MOVE_PX } from './config.ts';
import { HOLD_IDLE, cellsBetween, holdMoved, holdStart, holdStop, holdTick } from './hold.ts';

/** Runs a hold with 16 ms frames from `from` to `to` and returns the times of the hits. */
function run(cooldown: number, from: number, to: number, frame = 16): number[] {
  let s = holdStart();
  const hits: number[] = [];
  for (let t = from; t <= to; t += frame) {
    const r = holdTick(s, t, cooldown);
    s = r.state;
    if (r.hit) hits.push(t);
  }
  return hits;
}

describe('holdTick', () => {
  it('hits on the first tick after the press, not after a delay', () => {
    expect(holdTick(holdStart(), 1000, BLOCK_HIT_COOLDOWN_MS)).toEqual({ state: { active: true, lastHitAt: 1000 }, hit: true });
  });

  it('does nothing when no hold is active', () => {
    expect(holdTick(HOLD_IDLE, 1000, 250)).toEqual({ state: HOLD_IDLE, hit: false });
  });

  it('follows the cooldown rate: 250 ms blocks, 400 ms rocks and trees', () => {
    for (const cd of [BLOCK_HIT_COOLDOWN_MS, PICKAXE_COOLDOWN_MS, AXE_COOLDOWN_MS]) {
      const hits = run(cd, 0, 4000);
      expect(hits[0]).toBe(0);
      for (let i = 1; i < hits.length; i++) expect(hits[i]! - hits[i - 1]!).toBeGreaterThanOrEqual(cd);
      // Never slower than the cooldown plus one frame.
      for (let i = 1; i < hits.length; i++) expect(hits[i]! - hits[i - 1]!).toBeLessThan(cd + 16);
      expect(hits.length).toBeGreaterThanOrEqual(Math.floor(4000 / (cd + 16)));
    }
  });

  it('never hits twice in one tick, and not in the next frames of the cooldown', () => {
    const first = holdTick(holdStart(), 500, 250);
    expect(first.hit).toBe(true);
    expect(holdTick(first.state, 500, 250).hit).toBe(false); // the same instant
    expect(holdTick(first.state, 516, 250).hit).toBe(false);
    expect(holdTick(first.state, 749, 250).hit).toBe(false);
    expect(holdTick(first.state, 750, 250).hit).toBe(true);
  });

  it('a long stall gives one hit, not a burst, and the next one a full cooldown later', () => {
    const first = holdTick(holdStart(), 0, 250);
    const late = holdTick(first.state, 5000, 250);
    expect(late.hit).toBe(true);
    expect(holdTick(late.state, 5016, 250).hit).toBe(false);
    expect(holdTick(late.state, 5250, 250).hit).toBe(true);
  });

  it('stops on release and on pan', () => {
    const s = holdTick(holdStart(), 0, 250).state;
    const released = holdStop();
    expect(holdTick(released, 1000, 250).hit).toBe(false);
    expect(holdMoved(s, TAP_MAX_MOVE_PX - 1)).toBe(s); // a small wobble keeps the hold
    const panned = holdMoved(s, TAP_MAX_MOVE_PX);
    expect(panned.active).toBe(false);
    expect(holdTick(panned, 1000, 250).hit).toBe(false);
  });

  it('a new press after a stop hits at once again', () => {
    const s = holdStop();
    expect(holdTick(holdStart(), 100, 250).hit).toBe(true);
    expect(s.active).toBe(false);
  });
});

describe('cellsBetween', () => {
  it('lists every cell from a to b with no gaps', () => {
    expect(cellsBetween({ c: 2, r: 2 }, { c: 2, r: 2 })).toEqual([{ c: 2, r: 2 }]);
    expect(cellsBetween({ c: 2, r: 2 }, { c: 5, r: 2 })).toEqual([
      { c: 2, r: 2 },
      { c: 3, r: 2 },
      { c: 4, r: 2 },
      { c: 5, r: 2 },
    ]);
    const diag = cellsBetween({ c: 0, r: 0 }, { c: 3, r: 2 });
    expect(diag[0]).toEqual({ c: 0, r: 0 });
    expect(diag[diag.length - 1]).toEqual({ c: 3, r: 2 });
    for (let i = 1; i < diag.length; i++) expect(Math.abs(diag[i]!.c - diag[i - 1]!.c) + Math.abs(diag[i]!.r - diag[i - 1]!.r)).toBe(1);
  });
});
