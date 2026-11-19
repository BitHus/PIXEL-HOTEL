import { describe, expect, it } from 'vitest';
import { followLock, followStep, followTarget, firstViewCamera, freeAreaCamera, lockTarget, playCameraLocked } from './cameraFollow.ts';
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
    expect(one).toEqual(lockTarget(start, target, W, H, ROOM));
    expect(followLock(one, target, W, H, ROOM)).toBe(one);
  });
});

describe('lockTarget (CAM-LOCK)', () => {
  it('keeps the avatar exactly in the middle at a wall corner', () => {
    const t = lockTarget({ x: 0, y: 0, zoom: 2 }, { x: 5, y: 5 }, W, H, ROOM);
    expect(cameraCenter(t, W, H)).toEqual({ x: 5, y: 5 });
  });
  it('is never clamped: the avatar stays centred far beyond the room edge', () => {
    const t = lockTarget({ x: 0, y: 0, zoom: 2 }, { x: -500, y: 300 }, W, H, ROOM);
    expect(cameraCenter(t, W, H)).toEqual({ x: -500, y: 300 });
  });
  it('a room that fits on screen does not stop the lock either', () => {
    const small = { x: 0, y: 0, w: 100, h: 100 };
    const t = lockTarget({ x: 0, y: 0, zoom: 2 }, { x: 10, y: 20 }, W, H, small);
    expect(cameraCenter(t, W, H)).toEqual({ x: 10, y: 20 });
  });
});

describe('CAM-LOCK v2 (owner 19 Nov): always locked in play, Look around unlocks', () => {
  const play = { dungeon: false, build: false, paint: false, placing: false, lookAround: false };
  it('is locked in play mode, also standing still', () => {
    expect(playCameraLocked(play)).toBe(true);
  });
  it('a drag may pan only with Look around on, or in build mode, painting, placing or the dungeon', () => {
    expect(playCameraLocked({ ...play, lookAround: true })).toBe(false);
    expect(playCameraLocked({ ...play, build: true })).toBe(false);
    expect(playCameraLocked({ ...play, paint: true })).toBe(false);
    expect(playCameraLocked({ ...play, placing: true })).toBe(false);
    expect(playCameraLocked({ ...play, dungeon: true })).toBe(false);
  });
});

describe('freeAreaCamera (first view)', () => {
  const rect = { x: 0, y: 0, w: 400, h: 300 };
  it('centres a room that fits the free area, not the whole screen', () => {
    // screen 390 x 800, free area 330 x 640 (button column and hotbar removed): zoom 0.5 shows the room (200 x 150) inside it
    const cam = freeAreaCamera(0.5, { x: 100, y: 100 }, 330, 640, rect);
    expect(cam.zoom).toBe(0.5);
    const shownW = 330 / 0.5;
    expect(cam.x + shownW / 2).toBeCloseTo(200); // the room's middle is the middle of the free area
  });
  it('keeps the focus inside a room bigger than the free area, clamped to its walls', () => {
    const cam = freeAreaCamera(2, { x: 20, y: 20 }, 300, 300, rect);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });
});

describe('firstViewCamera', () => {
  const rect = { x: 0, y: 0, w: 600, h: 400 };
  it('centres the furniture cluster in the free area when the avatar stays on screen', () => {
    const cam = firstViewCamera(2, { x: 300, y: 250 }, [{ x: 280, y: 200 }, { x: 320, y: 220 }], 300, 400, rect);
    expect(cam.x + 300 / 2 / 2).toBeCloseTo(300); // cluster mean x = 300 in the middle
  });
  it('falls back to the avatar when the cluster view would hide it', () => {
    const cam = firstViewCamera(3, { x: 300, y: 390 }, [{ x: 300, y: 60 }], 300, 300, rect);
    const sy = (390 - cam.y) * 3;
    expect(sy).toBeGreaterThanOrEqual(24);
    expect(sy).toBeLessThanOrEqual(300 - 24);
  });
  it('no spots = the avatar', () => {
    expect(firstViewCamera(2, { x: 300, y: 200 }, [], 300, 300, rect)).toEqual(freeAreaCamera(2, { x: 300, y: 200 }, 300, 300, rect));
  });
});
