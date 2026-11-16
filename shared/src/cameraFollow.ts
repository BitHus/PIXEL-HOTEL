// The follow camera (COD-1 a): a smooth glide that keeps the avatar in the middle of the screen. Pure; time is passed in.
// The zoom never changes here. The camera stays clamped to the room (containCamera) and the client still snaps what it SHOWS to whole
// device pixels (snapCamera), so the pixel-perfect rules of section 4 stay.

import { CAMERA_FOLLOW_EPS_PX, CAMERA_FOLLOW_TAU_MS } from './config.ts';
import type { Point, Rect } from './types.ts';
import { cameraAt, containCamera, type Camera } from './view.ts';

/** Where the follow camera wants to be: centred on `target`, kept inside the room. */
export function followTarget(cam: Camera, target: Point, screenW: number, screenH: number, rect: Rect): Camera {
  return containCamera(cameraAt(target, cam.zoom, screenW, screenH), screenW, screenH, rect);
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
