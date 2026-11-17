import { describe, expect, it } from 'vitest';
import { followLock, followStep, followTarget } from './cameraFollow.ts';
import { cameraAt, cameraCenter } from './view.ts';

const ROOM = { x: 0, y: 0, w: 800, h: 600 };
const W = 400;
const H = 300;

describe('the follow camera (COD-1 a)', () => {
  it('the target centres the avatar and keeps the camera inside the room', () => {
    const t = followTarget({ x: 0, y: 0, zoom: 2 }, { x: 400, y: 300 }, W, H, ROOM);
    expect(cameraCenter(t, W, H)).toEqual({ x: 400, y: 300 });
    const corner = followTarget({ x: 0, y: 0, zoom: 2 }, { x: 5, y: 5 }, W, H, ROOM);
    expect(corner.x).toBeGreaterThanOrEqual(-1e-9);
    expect(corner.y).toBeGreaterThanOrEqual(-1e-9);
  });

  it('glides: each step moves part of the way, never past the target, and the zoom is untouched', () => {
    let cam = cameraAt({ x: 200, y: 200 }, 2, W, H);
    const goal = followTarget(cam, { x: 500, y: 350 }, W, H, ROOM);
    let last = Math.hypot(goal.x - cam.x, goal.y - cam.y);
    for (let i = 0; i < 20; i++) {
      cam = followStep(cam, { x: 500, y: 350 }, 16, W, H, ROOM);
      const d = Math.hypot(goal.x - cam.x, goal.y - cam.y);
      expect(d).toBeLessThanOrEqual(last + 1e-9);
      expect(cam.zoom).toBe(2);
      last = d;
    }
    expect(last).toBeGreaterThan(0);
  });

  it('is frame-rate independent: one 100 ms step equals ten 10 ms steps', () => {
    const start = cameraAt({ x: 200, y: 200 }, 2, W, H);
    const one = followStep(start, { x: 500, y: 350 }, 100, W, H, ROOM);
    let ten = start;
    for (let i = 0; i < 10; i++) ten = followStep(ten, { x: 500, y: 350 }, 10, W, H, ROOM);
    expect(ten.x).toBeCloseTo(one.x, 6);
    expect(ten.y).toBeCloseTo(one.y, 6);
  });

  it('settles exactly on the target and then returns the same object (no redraw needed)', () => {
    let cam = cameraAt({ x: 200, y: 200 }, 2, W, H);
    for (let i = 0; i < 400; i++) cam = followStep(cam, { x: 500, y: 350 }, 16, W, H, ROOM);
    expect(cam).toEqual(followTarget(cam, { x: 500, y: 350 }, W, H, ROOM));
    expect(followStep(cam, { x: 500, y: 350 }, 16, W, H, ROOM)).toBe(cam);
  });

  it('a room smaller than the screen stays centred whatever the avatar does', () => {
    const small = { x: 0, y: 0, w: 100, h: 80 };
    const a = followTarget({ x: 0, y: 0, zoom: 2 }, { x: 10, y: 10 }, W, H, small);
    const b = followTarget({ x: 0, y: 0, zoom: 2 }, { x: 90, y: 70 }, W, H, small);
    expect(a).toEqual(b);
  });
});

describe('followLock (OA-13)', () => {
  it('is exactly the target in one frame, and the same object when already there', () => {
    const start = { x: 0, y: 0, zoom: 3 };
    const target = { x: 500, y: 350 };
    const one = followLock(start, target, W, H, ROOM);
    expect(one).toEqual(followTarget(start, target, W, H, ROOM));
    expect(followLock(one, target, W, H, ROOM)).toBe(one);
  });
});
