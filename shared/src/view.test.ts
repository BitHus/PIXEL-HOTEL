import { describe, expect, it } from 'vitest';
import { ZOOM_MAX, ZOOM_MIN } from './config.ts';
import {
  containCamera,
  cameraAt,
  cameraCenter,
  introCamera,
  introZoom,
  centerCamera,
  clampCamera,
  easeZoom,
  fitZoom,
  settleZoom,
  panBy,
  screenToWorld,
  snapCamera,
  worldToScreen,
  zoomAt,
} from './view.ts';

const cameras = [
  { x: 0, y: 0 },
  { x: -16, y: -64 },
  { x: 123.5, y: -7.25 },
  { x: 900, y: 450 },
];
const points = [
  { x: 0, y: 0 },
  { x: 576, y: 384 },
  { x: -16, y: -64 },
  { x: 37.25, y: 211 },
];

const zooms = [ZOOM_MIN, 1.005, 1.5, 2, 2.37, 3, 3.999, ZOOM_MAX];

describe('screen <-> world', () => {
  for (const zoom of zooms) {
    it(`screenToWorld(worldToScreen(p)) = p at zoom ${zoom}`, () => {
      for (const c of cameras) {
        const cam = { ...c, zoom };
        for (const p of points) {
          const back = screenToWorld(worldToScreen(p, cam), cam);
          expect(back.x).toBeCloseTo(p.x, 9);
          expect(back.y).toBeCloseTo(p.y, 9);
        }
      }
    });
  }

  it('follows the formulas in the brief', () => {
    const cam = { x: 10, y: 20, zoom: 3 };
    expect(worldToScreen({ x: 15, y: 30 }, cam)).toEqual({ x: 15, y: 30 });
    expect(screenToWorld({ x: 15, y: 30 }, cam)).toEqual({ x: 15, y: 30 });
  });
});

describe('camera helpers', () => {
  const room = { x: -16, y: -64, w: 608, h: 464 };

  it('fitZoom picks the largest zoom that fits (free, not rounded), at least 0.5, at most 4', () => {
    expect(fitZoom(1920, 1080, room)).toBeCloseTo(1080 / 464, 9);
    expect(fitZoom(1280, 1000, room)).toBeCloseTo(1280 / 608, 9);
    expect(fitZoom(700, 500, room)).toBeCloseTo(500 / 464, 9);
    expect(fitZoom(390, 844, room)).toBeCloseTo(390 / 608, 9);
    expect(fitZoom(200, 200, room)).toBe(0.5);
    expect(fitZoom(10000, 10000, room)).toBe(4);
  });

  it('centerCamera puts the rect center at the screen center', () => {
    const cam = centerCamera(1920, 1080, room, 2);
    const c = worldToScreen({ x: room.x + room.w / 2, y: room.y + room.h / 2 }, cam);
    expect(c).toEqual({ x: 960, y: 540 });
  });

  it('zoomAt keeps the point under the cursor fixed, at any zoom', () => {
    let cam = { x: 3, y: -40, zoom: 1 };
    const s = { x: 400, y: 300 };
    const before = screenToWorld(s, cam);
    for (const z of [1.005, 2, 2.37, 3.5, 4, 1.2, 1]) {
      cam = zoomAt(cam, s, z);
      expect(cam.zoom).toBe(z);
      const after = screenToWorld(s, cam);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
  });

  it('zoomAt clamps to 0.5..4', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 4 }, { x: 11, y: 13 }, 9).zoom).toBe(4);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 0.2).zoom).toBe(0.5);
  });

  it('snapCamera puts the world offset on whole screen px', () => {
    for (const zoom of zooms) {
      const cam = snapCamera({ x: 12.3456, y: -7.891, zoom });
      expect(cam.x * zoom).toBeCloseTo(Math.round(cam.x * zoom), 9);
      expect(cam.y * zoom).toBeCloseTo(Math.round(cam.y * zoom), 9);
      expect(Math.abs(cam.x - 12.3456) * zoom).toBeLessThanOrEqual(0.5);
    }
  });

  it('snapCamera with a devicePixelRatio puts the offset on whole device px', () => {
    for (const zoom of zooms) {
      const cam = snapCamera({ x: 12.3456, y: -7.891, zoom }, 3);
      expect(cam.x * zoom * 3).toBeCloseTo(Math.round(cam.x * zoom * 3), 9);
      expect(cam.y * zoom * 3).toBeCloseTo(Math.round(cam.y * zoom * 3), 9);
    }
  });

  it('panBy moves the world with the drag', () => {
    const cam = { x: 0, y: 0, zoom: 2 };
    const p = { x: 10, y: 10 };
    const moved = panBy(cam, 20, -8);
    expect(worldToScreen(p, moved)).toEqual({ x: 40, y: 12 });
  });

  it('clampCamera keeps the screen center inside the room', () => {
    const cam = clampCamera({ x: 5000, y: -5000, zoom: 1 }, 800, 600, room);
    const center = screenToWorld({ x: 400, y: 300 }, cam);
    expect(center).toEqual({ x: room.x + room.w, y: room.y });
  });
});

describe('settleZoom', () => {
  it('goes to the nearest whole zoom', () => {
    expect(settleZoom(1.4, 0.6)).toBe(1);
    expect(settleZoom(1.6, 0.6)).toBe(2);
    expect(settleZoom(3.7, 0.6)).toBe(4);
    expect(settleZoom(4, 0.6)).toBe(4);
  });
  it('goes to the overview zoom if that is closer', () => {
    expect(settleZoom(0.7, 0.6)).toBe(0.6);
    expect(settleZoom(1.3, 1.25)).toBe(1.25);
    expect(settleZoom(2.2, 2.33)).toBe(2.33);
    expect(settleZoom(1.9, 2.33)).toBe(2);
  });
  it('steps by 1 / devicePixelRatio, so zoom * dpr is whole', () => {
    expect(settleZoom(1.4, 0.6, 3)).toBeCloseTo(4 / 3, 12);
    expect(settleZoom(1.55, 0.6, 3)).toBeCloseTo(5 / 3, 12);
    expect(settleZoom(1.2, 0.6, 2)).toBe(1);
    expect(settleZoom(1.3, 0.6, 2)).toBe(1.5);
    expect(settleZoom(0.55, 0.9, 2)).toBe(0.5);
    expect(settleZoom(1.13, 0.6, 1.5)).toBeCloseTo(4 / 3, 12);
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      for (let zoom = 0.5; zoom <= 4; zoom += 0.07) {
        const z = settleZoom(zoom, 0.5, dpr);
        // Whole device px, or the overview zoom (0.5 here) when that is closer.
        if (z !== 0.5) expect(Math.abs(z * dpr - Math.round(z * dpr))).toBeLessThan(1e-9);
        expect(z).toBeGreaterThanOrEqual(0.5);
        expect(z).toBeLessThanOrEqual(4);
      }
    }
  });
  it('never goes below ZOOM_MIN', () => {
    expect(settleZoom(0.5, 0.5)).toBe(0.5);
    expect(settleZoom(0.5, 0.2)).toBe(0.5);
  });
});

describe('easeZoom', () => {
  it('starts at from, ends exactly at to, and moves one way', () => {
    expect(easeZoom(1.4, 1, 0, 150)).toBe(1.4);
    expect(easeZoom(1.4, 1, 150, 150)).toBe(1);
    expect(easeZoom(1.4, 1, 999, 150)).toBe(1);
    let last = 1.4;
    for (let ms = 10; ms < 150; ms += 10) {
      const z = easeZoom(1.4, 1, ms, 150);
      expect(z).toBeLessThan(last);
      expect(z).toBeGreaterThan(1);
      last = z;
    }
  });
});

describe('camera intro', () => {
  it('ends on the settled zoom nearest to 3 device px per art px', () => {
    expect(introZoom(1, 1, 3)).toBe(3);
    expect(introZoom(0.6, 3, 3)).toBe(1);
    expect(introZoom(0.6, 2, 3)).toBe(1.5);
  });
  it('starts at `from`, ends exactly at `to`, and moves the center and zoom together', () => {
    const from = cameraAt({ x: 100, y: 100 }, 1, 400, 300);
    const to = cameraAt({ x: 200, y: 160 }, 3, 400, 300);
    expect(introCamera(from, to, 0, 400, 300)).toEqual(from);
    expect(introCamera(from, to, 1, 400, 300)).toBe(to);
    const mid = introCamera(from, to, 0.5, 400, 300);
    expect(mid.zoom).toBeCloseTo(2);
    expect(cameraCenter(mid, 400, 300).x).toBeCloseTo(150);
    expect(cameraCenter(mid, 400, 300).y).toBeCloseTo(130);
  });
});

describe('containCamera', () => {
  const rect = { x: -16, y: -64, w: 608, h: 464 };
  it('keeps the screen inside the room when the room is bigger', () => {
    // 390 x 844 at zoom 3: 130 x 281 world px are visible.
    const c = containCamera(cameraAt({ x: 288, y: 360 }, 3, 390, 844), 390, 844, rect);
    expect(c.x).toBeCloseTo(288 - 65);
    expect(c.y).toBeCloseTo(400 - 844 / 3);
  });
  it('centers the room on an axis where it is smaller than the screen', () => {
    const c = containCamera(cameraAt({ x: 0, y: 0 }, 1, 1000, 300), 1000, 300, rect);
    expect(c.x).toBeCloseTo(-16 + 304 - 500);
    expect(c.y).toBe(-64);
  });
});
