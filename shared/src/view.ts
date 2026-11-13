// World <-> screen math (brief section 4). Camera position is in world px. Zoom is free
// (any number from ZOOM_MIN to ZOOM_MAX, also 1.005).

import { ZOOM_MAX, ZOOM_MIN } from './config.ts';
import type { Point, Rect } from './types.ts';

export interface Camera {
  /** World px at the top-left corner of the screen. */
  x: number;
  y: number;
  /** Any number from ZOOM_MIN to ZOOM_MAX. */
  zoom: number;
}

/** screenToWorld(p) = p / zoom + camera */
export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: p.x / cam.zoom + cam.x, y: p.y / cam.zoom + cam.y };
}

/** worldToScreen(p) = (p - camera) * zoom */
export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.zoom, y: (p.y - cam.y) * cam.zoom };
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** The largest zoom where the rect fits on a screen of this size, clamped to ZOOM_MIN..ZOOM_MAX. */
export function fitZoom(screenW: number, screenH: number, rect: Rect): number {
  return clampZoom(Math.min(screenW / rect.w, screenH / rect.h));
}

/**
 * Rounds the camera so that camera * zoom * dpr is a whole number of device px, so the world
 * never sits on part of a real screen pixel. dpr is the device pixel ratio (real screen px per
 * CSS px). Used for drawing, and for the state only at the end of a zoom settle, so repeated
 * zooming does not drift.
 */
export function snapCamera(cam: Camera, dpr = 1): Camera {
  const s = cam.zoom * dpr;
  return { x: Math.round(cam.x * s) / s, y: Math.round(cam.y * s) / s, zoom: cam.zoom };
}

/** A camera that centers the rect on the screen at the given zoom. */
export function centerCamera(screenW: number, screenH: number, rect: Rect, zoom: number): Camera {
  return {
    x: rect.x + rect.w / 2 - screenW / zoom / 2,
    y: rect.y + rect.h / 2 - screenH / zoom / 2,
    zoom,
  };
}

/** Changes the zoom while the world point under the screen point stays fixed. */
export function zoomAt(cam: Camera, screenPoint: Point, newZoom: number): Camera {
  const zoom = clampZoom(newZoom);
  const world = screenToWorld(screenPoint, cam);
  return { x: world.x - screenPoint.x / zoom, y: world.y - screenPoint.y / zoom, zoom };
}

/** Moves the camera so the world follows a drag of (dx, dy) screen px. */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom, zoom: cam.zoom };
}

/** Keeps the screen center inside the rect, so the room can never be panned out of sight. */
export function clampCamera(cam: Camera, screenW: number, screenH: number, rect: Rect): Camera {
  const halfW = screenW / cam.zoom / 2;
  const halfH = screenH / cam.zoom / 2;
  const cx = Math.min(rect.x + rect.w, Math.max(rect.x, cam.x + halfW));
  const cy = Math.min(rect.y + rect.h, Math.max(rect.y, cam.y + halfH));
  return { x: cx - halfW, y: cy - halfH, zoom: cam.zoom };
}

/**
 * Where the zoom settles when a zoom gesture ends: the nearest zoom in ZOOM_MIN..ZOOM_MAX where
 * zoom * dpr is a whole number (one art pixel covers whole real screen pixels; dpr 1 gives
 * 1, 2, 3, 4 and dpr 3 gives steps of 1/3), or the overview zoom if that is closer.
 * A tie goes to the whole-pixel zoom.
 */
export function settleZoom(zoom: number, overview: number, dpr = 1): number {
  let best = clampZoom(overview);
  let bestD = Math.abs(zoom - best);
  // Tiny slack so k / dpr that should equal ZOOM_MIN or ZOOM_MAX is not lost to rounding.
  for (let k = Math.ceil(ZOOM_MIN * dpr - 1e-9); k <= Math.floor(ZOOM_MAX * dpr + 1e-9); k++) {
    const z = k / dpr;
    const d = Math.abs(zoom - z);
    if (d <= bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}

/** Zoom part way through a settle: ease-out from `from` to `to`; returns `to` exactly at the end. */
export function easeZoom(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (elapsedMs >= durationMs) return to;
  const t = Math.max(0, elapsedMs) / durationMs;
  return from + (to - from) * (1 - (1 - t) ** 3);
}
