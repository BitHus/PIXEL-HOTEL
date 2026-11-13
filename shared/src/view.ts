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
 * Rounds the camera so that camera * zoom is a whole number of screen px, so the world never
 * sits on half a screen pixel. Used only for drawing: keep the unsnapped camera as the state,
 * so repeated zooming does not drift.
 */
export function snapCamera(cam: Camera): Camera {
  return {
    x: Math.round(cam.x * cam.zoom) / cam.zoom,
    y: Math.round(cam.y * cam.zoom) / cam.zoom,
    zoom: cam.zoom,
  };
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
