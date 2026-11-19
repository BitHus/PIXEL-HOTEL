// Misclick-proof interaction: priority, labels, nearest to the avatar, the Tab cycle, slide-off cancel, the big-tap default.
import { describe, expect, it } from 'vitest';
import { INTERACT_PRIORITY, TAP_BIG_PX } from './config.ts';
import { bigTapsOn, cycleIndex, interactLabel, interactOrder, interactPriority, nearestInteract, pressStaysOn } from './interact.ts';
import { pickTap, tapOptions, type TapTarget } from './tapPick.ts';

describe('interactPriority', () => {
  it('ready/urgent first, then machines, then seats, then the rest', () => {
    expect(interactPriority({ kind: 'guest', ready: true })).toBe(INTERACT_PRIORITY.urgent);
    expect(interactPriority({ kind: 'stove', ready: true })).toBe(INTERACT_PRIORITY.urgent);
    expect(interactPriority({ kind: 'pour' })).toBe(INTERACT_PRIORITY.urgent);
    expect(interactPriority({ kind: 'stove' })).toBe(INTERACT_PRIORITY.machine);
    expect(interactPriority({ kind: 'taps' })).toBe(INTERACT_PRIORITY.machine);
    expect(interactPriority({ kind: 'seat' })).toBe(INTERACT_PRIORITY.seat);
    expect(interactPriority({ kind: 'use' })).toBe(INTERACT_PRIORITY.other);
    expect(INTERACT_PRIORITY.urgent > INTERACT_PRIORITY.machine && INTERACT_PRIORITY.machine > INTERACT_PRIORITY.seat && INTERACT_PRIORITY.seat > INTERACT_PRIORITY.other).toBe(true);
  });
});

describe('interactLabel', () => {
  it('names the action', () => {
    expect(interactLabel({ kind: 'pour' })).toBe('Pour');
    expect(interactLabel({ kind: 'guest', ready: true })).toBe('Serve');
    expect(interactLabel({ kind: 'stove', ready: true })).toBe('Collect');
    expect(interactLabel({ kind: 'stove' })).toBe('Cook');
    expect(interactLabel({ kind: 'barrel' })).toBe('Brew');
    expect(interactLabel({ kind: 'guest' })).toBe('Talk');
    expect(interactLabel({ kind: 'seat' })).toBe('Sit');
  });
});

describe('pickTap with priority (overlap)', () => {
  const t = (ref: string, priority: number, x = 0): TapTarget<string> => ({ ref, bounds: { x, y: 0, w: 60, h: 60 }, depth: 60, priority });
  it('when two are hit, the urgent guest beats the stool it sits on even if the stool centre is nearer', () => {
    const r = pickTap({ x: 30, y: 30 }, [t('stool', INTERACT_PRIORITY.seat, 0), t('guest', INTERACT_PRIORITY.urgent, 20)], { tolerance: 20, minSize: 28 })!;
    expect(r.target.ref).toBe('guest');
  });
  it('a real hit still beats an urgent near miss', () => {
    const r = pickTap({ x: 30, y: 30 }, [t('chair', INTERACT_PRIORITY.seat, 0), t('guest', INTERACT_PRIORITY.urgent, 75)], { tolerance: 20, minSize: 28 })!;
    expect(r.target.ref).toBe('chair');
  });
  it('without priorities the old order holds (nearest centre)', () => {
    const r = pickTap({ x: 30, y: 30 }, [{ ref: 'a', bounds: { x: 0, y: 0, w: 60, h: 60 }, depth: 60 }, { ref: 'b', bounds: { x: 20, y: 0, w: 60, h: 60 }, depth: 60 }], { tolerance: 20, minSize: 28 })!;
    expect(r.target.ref).toBe('a');
  });
  it('big tap targets: a 40 px finger radius and a 56 px box', () => {
    expect(tapOptions(true, true)).toEqual({ tolerance: TAP_BIG_PX.tolerance, minSize: TAP_BIG_PX.minSize });
    expect(tapOptions(true, false).tolerance).toBeLessThan(TAP_BIG_PX.tolerance);
    const far = pickTap({ x: 0, y: 0 }, [{ ref: 'stove', bounds: { x: 56, y: 0, w: 20, h: 20 }, depth: 1 }], tapOptions(true, true));
    expect(far?.target.ref).toBe('stove');
    expect(pickTap({ x: 0, y: 0 }, [{ ref: 'stove', bounds: { x: 56, y: 0, w: 20, h: 20 }, depth: 1 }], tapOptions(true, false))).toBeNull();
  });
});

describe('nearestInteract / interactOrder', () => {
  const area = (x: number) => ({ x, y: 0, w: 32, h: 32 });
  const list = [
    { ref: 'chair', area: area(10), priority: INTERACT_PRIORITY.seat },
    { ref: 'stove', area: area(60), priority: INTERACT_PRIORITY.machine },
    { ref: 'far', area: area(400), priority: INTERACT_PRIORITY.urgent },
  ];
  it('the higher priority within reach wins, things out of reach never', () => {
    expect(nearestInteract({ x: 0, y: 16 }, list, 80)).toBe('stove');
    expect(interactOrder({ x: 0, y: 16 }, list, 80)).toEqual(['stove', 'chair']);
    expect(nearestInteract({ x: 0, y: 16 }, list, 5)).toBeNull();
  });
  it('same priority: the nearer one', () => {
    expect(nearestInteract({ x: 100, y: 16 }, [{ ref: 'a', area: area(0), priority: 2 }, { ref: 'b', area: area(110), priority: 2 }], 80)).toBe('b');
  });
});

describe('cycleIndex', () => {
  it('Tab starts at the first, Shift+Tab at the last, both wrap', () => {
    expect(cycleIndex(-1, 3, 1)).toBe(0);
    expect(cycleIndex(-1, 3, -1)).toBe(2);
    expect(cycleIndex(2, 3, 1)).toBe(0);
    expect(cycleIndex(0, 3, -1)).toBe(2);
    expect(cycleIndex(0, 0, 1)).toBe(-1);
  });
});

describe('pressStaysOn', () => {
  it('a finger that slides a little stays on; sliding off cancels', () => {
    const b = { x: 100, y: 100, w: 20, h: 20 };
    expect(pressStaysOn({ x: 110, y: 110 }, b, { tolerance: 10, minSize: 56 })).toBe(true);
    expect(pressStaysOn({ x: 140, y: 110 }, b, { tolerance: 10, minSize: 56 })).toBe(true);
    expect(pressStaysOn({ x: 200, y: 110 }, b, { tolerance: 10, minSize: 56 })).toBe(false);
  });
});

describe('bigTapsOn', () => {
  it('on by default on touch, off for a mouse; a stored choice wins', () => {
    expect(bigTapsOn(null, true)).toBe(true);
    expect(bigTapsOn(undefined, false)).toBe(false);
    expect(bigTapsOn(false, true)).toBe(false);
    expect(bigTapsOn(true, false)).toBe(true);
  });
});
