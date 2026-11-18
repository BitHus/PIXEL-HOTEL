import { describe, expect, it } from 'vitest';
import { pickNearest, placeBubbles, snapToDevice, type BubbleIn } from './bubbleLayout.ts';

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('placeBubbles (RUN 5 pile-up)', () => {
  it('one avatar: newest right above the head, older ones stacked up with the gap', () => {
    const out = placeBubbles([{ avatarId: 1, headX: 200, headY: 300, w: 80, h: 20 }, { avatarId: 1, headX: 200, headY: 300, w: 80, h: 20 }], 1000, 4);
    expect(out[0]).toEqual({ x: 160, y: 280, tail: true });
    expect(out[1]).toEqual({ x: 160, y: 256, tail: false });
  });
  it('guests side by side at one table never overlap their bubbles', () => {
    const list: BubbleIn[] = [];
    for (let i = 0; i < 4; i++) list.push({ avatarId: i, headX: 200 + i * 24, headY: 300 + (i % 2) * 6, w: 120, h: 22 });
    const out = placeBubbles(list, 1000, 4);
    const boxes = out.map((o, i) => ({ x: o.x, y: o.y, w: list[i]!.w, h: list[i]!.h }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
    for (const o of out) expect(o.tail).toBe(true);
  });
  it('far apart avatars keep their bubbles at their own heads', () => {
    const out = placeBubbles([{ avatarId: 1, headX: 100, headY: 300, w: 60, h: 20 }, { avatarId: 2, headX: 600, headY: 300, w: 60, h: 20 }], 1000, 4);
    expect(out[0]!.y).toBe(280);
    expect(out[1]!.y).toBe(280);
  });
  it('stays on screen and moves above an order icon', () => {
    const [a] = placeBubbles([{ avatarId: 1, headX: 5, headY: 300, w: 60, h: 20 }], 1000, 4, [{ left: 0, right: 100, top: 270, bottom: 310 }]);
    expect(a!.x).toBe(4);
    expect(a!.y + 20).toBeLessThanOrEqual(268);
  });
});

describe('pickNearest (hysteresis)', () => {
  const a = { key: 1, x: 100, y: 0 };
  const b = { key: 2, x: 98, y: 0 };
  it('keeps the shown one when a rival is only slightly nearer', () => {
    expect([...pickNearest([a, b], 0, 0, 1, new Set([1]))]).toEqual([1]);
    expect([...pickNearest([a, b], 0, 0, 1, new Set([2]))]).toEqual([2]);
  });
  it('switches when the newcomer is clearly nearer', () => {
    expect([...pickNearest([a, { key: 2, x: 40, y: 0 }], 0, 0, 1, new Set([1]))]).toEqual([2]);
  });
  it('is stable over a sweep of tiny camera moves (no flipping)', () => {
    let prev: ReadonlySet<number> = new Set();
    let flips = 0;
    for (let i = 0; i < 100; i++) {
      const next = pickNearest([{ key: 1, x: 100 + Math.sin(i) , y: 0 }, { key: 2, x: 100 - Math.sin(i), y: 0 }], 0, 0, 1, prev);
      if (prev.size && [...next][0] !== [...prev][0]) flips++;
      prev = next;
    }
    expect(flips).toBe(0);
  });
});

describe('snapToDevice', () => {
  it('rounds to device pixels', () => {
    expect(snapToDevice(10.3, 2)).toBe(10.5);
    expect(snapToDevice(10.2, 2)).toBe(10);
    expect(snapToDevice(10.4, 1)).toBe(10);
  });
});
