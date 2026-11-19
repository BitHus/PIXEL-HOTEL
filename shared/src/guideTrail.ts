// R16 GUIDE TRAIL + CAMERA PEEK (19 Nov): pure helpers for the first-steps guide in the world. The trail is a row of footstep dots along the
// walk path (nav.ts findPath) from the avatar to the guide's target; the peek is where the camera eases to so an off-screen target comes into
// the free area while the avatar stays on screen. No rendering, no clock: time is passed in.

import {
  GUIDE_PEEK_MARGIN_PX,
  GUIDE_TRAIL_FADE_PX,
  GUIDE_TRAIL_MAX_DOTS,
  GUIDE_TRAIL_PULSE_MS,
  GUIDE_TRAIL_SKIP_PX,
  GUIDE_TRAIL_SPACING_PX,
} from './config.ts';
import { pathLength } from './avatar.ts';
import type { Point } from './types.ts';
import type { Camera } from './view.ts';

export interface TrailDot {
  /** Whole world px. */
  x: number;
  y: number;
  /** 0..1, stepped (quarters): fades in at the avatar, out near the target and as the walk arrives. */
  alpha: number;
  /** The one bright dot of the stepped pulse. */
  bright: boolean;
}

/** Rounds alpha down to quarter steps (a pixel look: no smooth gradient). */
const stepAlpha = (a: number): number => Math.max(0, Math.min(1, Math.floor(a * 4 + 1e-9) / 4));

/**
 * The footstep dots along `path` (from the avatar to the target): one every GUIDE_TRAIL_SPACING_PX, none within GUIDE_TRAIL_SKIP_PX of either end,
 * at whole world px. Dots fade out over the last GUIDE_TRAIL_FADE_PX, the whole trail fades when the path left is shorter than that (arrival), and
 * one dot is bright, moving one dot further every GUIDE_TRAIL_PULSE_MS (stepped, `timeMs` passed in). Empty for a missing or tiny path.
 */
export function trailDots(path: readonly Point[] | null, timeMs: number): TrailDot[] {
  if (!path || path.length < 2) return [];
  const total = pathLength(path);
  const usable = total - 2 * GUIDE_TRAIL_SKIP_PX;
  if (usable <= 0) return [];
  const arrive = Math.min(1, total / (GUIDE_TRAIL_FADE_PX + 2 * GUIDE_TRAIL_SKIP_PX));
  const out: Omit<TrailDot, 'bright'>[] = [];
  let seg = 1;
  let segStart = 0;
  for (let d = GUIDE_TRAIL_SKIP_PX; d <= total - GUIDE_TRAIL_SKIP_PX + 1e-6 && out.length < GUIDE_TRAIL_MAX_DOTS; d += GUIDE_TRAIL_SPACING_PX) {
    let a = path[seg - 1]!;
    let b = path[seg]!;
    let len = Math.hypot(b.x - a.x, b.y - a.y);
    while (d > segStart + len && seg < path.length - 1) {
      segStart += len;
      seg++;
      a = path[seg - 1]!;
      b = path[seg]!;
      len = Math.hypot(b.x - a.x, b.y - a.y);
    }
    const t = len > 0 ? (d - segStart) / len : 0;
    const left = total - d;
    const endFade = Math.min(1, (left - GUIDE_TRAIL_SKIP_PX) / GUIDE_TRAIL_FADE_PX + 0.25);
    const startFade = out.length === 0 ? 0.5 : 1;
    const alpha = stepAlpha(Math.min(endFade, startFade) * arrive);
    if (alpha <= 0) continue;
    out.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t), alpha });
  }
  if (out.length === 0) return [];
  const lit = Math.floor(Math.max(0, timeMs) / GUIDE_TRAIL_PULSE_MS) % (out.length + 3); // 3 dark steps between two runs
  return out.map((p, i) => ({ ...p, bright: i === lit }));
}

/**
 * Where the camera peeks so that `target` is inside the free area (the screen's top-left `freeW` x `freeH`, css px) with `margin`, moving as little
 * as possible from `lock` (the locked camera on the avatar) and never pushing the avatar out of that area. Returns `lock` itself when the target is
 * already in view (no peek). The zoom is never changed.
 */
export function guidePeekCamera(lock: Camera, avatar: Point, target: Point, freeW: number, freeH: number, margin: number = GUIDE_PEEK_MARGIN_PX): Camera {
  const z = lock.zoom;
  const inView = (t: number, cam: number, size: number): boolean => {
    const s = (t - cam) * z;
    return s >= Math.min(margin, size / 4) && s <= size - Math.min(margin, size / 4);
  };
  if (inView(target.x, lock.x, freeW) && inView(target.y, lock.y, freeH)) return lock;
  const axis = (cam: number, a: number, t: number, size: number): number => {
    const m = Math.min(margin, size / 4) / z;
    const span = size / z;
    // Smallest move that brings the target in, then kept within what still shows the avatar.
    const want = Math.min(Math.max(cam, t - span + m), t - m);
    if (want === cam) return cam;
    const keep = Math.min(Math.max(want, a - span + m), a - m);
    // RUN 14 #3: when target and avatar cannot both fit (the avatar already stands at the edge, the target is more than a screen away) the target wins:
    // the avatar may leave the free area, because tapping the target walks it there and the next walk locks the camera on it again.
    return t - m >= keep && t - span + m <= keep ? keep : want;
  };
  const x = axis(lock.x, avatar.x, target.x, freeW);
  const y = axis(lock.y, avatar.y, target.y, freeH);
  return x === lock.x && y === lock.y ? lock : { x, y, zoom: z };
}

/** One frame of an exponential ease of the camera toward `to` (frame-rate independent); snaps when within `epsPx` screen px. */
export function easeCamera(cam: Camera, to: Camera, dtMs: number, tauMs: number, epsPx = 0.25): Camera {
  const dx = to.x - cam.x;
  const dy = to.y - cam.y;
  if (Math.hypot(dx, dy) * cam.zoom <= epsPx) return dx === 0 && dy === 0 ? cam : { ...cam, x: to.x, y: to.y };
  const k = 1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, tauMs));
  return { x: cam.x + dx * k, y: cam.y + dy * k, zoom: cam.zoom };
}
