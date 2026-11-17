// The follow camera (COD-1 a): a smooth glide that keeps the avatar in the middle of the screen. Pure; time is passed in.
// The zoom never changes here. The camera stays clamped to the room (containCamera) and the client still snaps what it SHOWS to whole
// device pixels (snapCamera), so the pixel-perfect rules of section 4 stay.

import { CAMERA_LOCK_MARGIN_PX, CAMERA_FOLLOW_EPS_PX, CAMERA_FOLLOW_TAU_MS } from './config.ts';
import type { Point, Rect } from './types.ts';
import { cameraAt, containCamera, type Camera } from './view.ts';

/** Where the follow camera wants to be: centred on `target`, kept inside the room. */
export function followTarget(cam: Camera, target: Point, screenW: number, screenH: number, rect: Rect): Camera {
  return containCamera(cameraAt(target, cam.zoom, screenW, screenH), screenW, screenH, rect);
}

/**
 * CAM-LOCK: where the LOCKED camera sits: the target exactly in the middle of the screen, also near the walls: the centre may leave the room by at most
 * CAMERA_LOCK_MARGIN_PX (the backdrop shows beyond). An axis on which the whole room fits on screen stays centred on the room (the overview of a small room).
 */
export function lockTarget(cam: Camera, target: Point, screenW: number, screenH: number, rect: Rect): Camera {
  const m = CAMERA_LOCK_MARGIN_PX;
  const axis = (t: number, view: number, start: number, size: number): number =>
    view >= size ? start + size / 2 - view / 2 : Math.min(start + size + m, Math.max(start - m, t)) - view / 2;
  return { x: axis(target.x, screenW / cam.zoom, rect.x, rect.w), y: axis(target.y, screenH / cam.zoom, rect.y, rect.h), zoom: cam.zoom };
}

/**
 * OA-13: the camera keeps the avatar centred at all times, no lag: it is exactly the follow target (kept inside the room). Returns the same camera
 * object when it is already there, so the caller can skip a redraw. (followStep, the old glide, stays for tests and tuning.)
 */
export function followLock(cam: Camera, target: Point, screenW: number, screenH: number, rect: Rect): Camera {
  const to = lockTarget(cam, target, screenW, screenH, rect);
  return to.x === cam.x && to.y === cam.y ? cam : to;
}

/**
 * One frame of the glide: the camera moves a share 1 - exp(-dt / tau) of the way to its target (frame-rate independent). Returns
 * the same camera object when it is already there (within CAMERA_FOLLOW_EPS_PX), so the caller can skip a redraw.
 */
export function followStep(cam: Camera, target: Point, dtMs: number, screenW: number, screenH: number, rect: Rect, tauMs: number = CAMERA_FOLLOW_TAU_MS): Camera {
  const to = followTarget(cam, target, screenW, screenH, rect);
  const dx = to.x - cam.x;
  const dy = to.y - cam.y;
  if (Math.hypot(dx, dy) * cam.zoom <= CAMERA_FOLLOW_EPS_PX) return Math.hypot(dx, dy) === 0 ? cam : { ...cam, x: to.x, y: to.y };
  const k = 1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, tauMs));
  return { x: cam.x + dx * k, y: cam.y + dy * k, zoom: cam.zoom };
}
