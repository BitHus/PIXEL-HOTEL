import { describe, expect, it } from 'vitest';
import { ZOOM_MAX, ZOOM_MIN } from './config.ts';
import {
  centerCamera,
  clampCamera,
  fitZoom,
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

  it('fitZoom picks the largest zoom that fits (free, not rounded), at least 1, at most 4', () => {
    expect(fitZoom(1920, 1080, room)).toBeCloseTo(1080 / 464, 9);
    expect(fitZoom(1280, 1000, room)).toBeCloseTo(1280 / 608, 9);
    expect(fitZoom(700, 500, room)).toBeCloseTo(500 / 464, 9);
    expect(fitZoom(390, 844, room)).toBe(1);
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

  it('zoomAt clamps to 1..4', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 4 }, { x: 11, y: 13 }, 9).zoom).toBe(4);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 0.2).zoom).toBe(1);
  });

  it('snapCamera puts the world offset on whole screen px', () => {
    for (const zoom of zooms) {
      const cam = snapCamera({ x: 12.3456, y: -7.891, zoom });
      expect(cam.x * zoom).toBeCloseTo(Math.round(cam.x * zoom), 9);
      expect(cam.y * zoom).toBeCloseTo(Math.round(cam.y * zoom), 9);
      expect(Math.abs(cam.x - 12.3456) * zoom).toBeLessThanOrEqual(0.5);
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
