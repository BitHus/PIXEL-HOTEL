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
 * CAM-LOCK: where the LOCKED camera sits: the target exactly in the middle of the screen, everywhere, also at the walls and corners and in a room that
 * fits on screen: NO clamp (owner, 18 Nov: the avatar must never sit under the UI at a wall; the dark backdrop shows beyond the room). `rect` is kept
 * in the signature for the callers only.
 */
export function lockTarget(cam: Camera, target: Point, screenW: number, screenH: number, _rect: Rect): Camera {
  return cameraAt(target, cam.zoom, screenW, screenH);
}

/**
 * OA-13: the camera keeps the avatar centred at all times, no lag: it is exactly the follow target (never clamped). Returns the same camera
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

/** What can stop the play camera from being locked on the avatar. */
export interface CameraLockState {
  dungeon: boolean;
  build: boolean;
  paint: boolean;
  placing: boolean;
  /** The 'Look around' toggle (More menu): a one-finger drag pans the room. */
  lookAround: boolean;
}

/**
 * OWNER 19 Nov (CAM-LOCK v2): in play mode (every room, not build mode, not painting or placing, not the dungeon, which steers itself) the camera is ALWAYS
 * locked on the avatar: a one-finger drag never pans, it only steers the hold-walk or does nothing. Only the Look around toggle (or build mode) lets a drag pan.
 */
export function playCameraLocked(s: CameraLockState): boolean {
  return !s.dungeon && !s.build && !s.paint && !s.placing && !s.lookAround;
}

/**
 * The first view of a room (and the settle after the intro): the room kept inside the FREE area of the screen (left of the button column, above the
 * hotbar), focused on `focus` (the avatar). The area's top-left is the screen's top-left, so the returned camera is valid for the whole screen. Where the
 * room is smaller than the free area it is centred in it (never pushed into a corner with void around it).
 */
export function freeAreaCamera(zoom: number, focus: Point, freeW: number, freeH: number, rect: Rect): Camera {
  return containCamera(cameraAt(focus, zoom, freeW, freeH), freeW, freeH, rect);
}

/**
 * The first view for a room the player just entered (owner 19 Nov, phone bug): the zoomed-in camera shows the room's furniture cluster (the mean of `spots`:
 * bar, table, stove...) in the middle of the free area, clamped to the room, so the view is usable before the first step. The avatar must stay on screen
 * (inside `margin` px); if the cluster view would hide it, the avatar is the focus instead. No spots = the avatar.
 */
export function firstViewCamera(zoom: number, avatar: Point, spots: readonly Point[], freeW: number, freeH: number, rect: Rect, margin = 24): Camera {
  const onAvatar = freeAreaCamera(zoom, avatar, freeW, freeH, rect);
  if (spots.length === 0) return onAvatar;
  const mean = { x: spots.reduce((a, p) => a + p.x, 0) / spots.length, y: spots.reduce((a, p) => a + p.y, 0) / spots.length };
  const cam = freeAreaCamera(zoom, mean, freeW, freeH, rect);
  const sx = (avatar.x - cam.x) * zoom;
  const sy = (avatar.y - cam.y) * zoom;
  return sx >= margin && sy >= margin && sx <= freeW - margin && sy <= freeH - margin ? cam : onAvatar;
}
