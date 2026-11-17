import { describe, expect, it } from 'vitest';
import { placeBubbles, type BubbleIn } from './bubbleLayout.ts';

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
