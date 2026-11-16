// The follow camera's pause (COD-1 a): a drag, pinch or wheel by the player pauses the glide for CAMERA_FOLLOW_PAUSE_MS.
import { CAMERA_FOLLOW_PAUSE_MS } from '@pixel-hotel/shared';

let pausedUntil = 0;

/** The player moved the camera by hand: leave it alone for a moment. */
export function pauseFollow(now = performance.now()): void {
  pausedUntil = now + CAMERA_FOLLOW_PAUSE_MS;
}

/** True while the player's own camera move is respected. */
export function followPaused(now = performance.now()): boolean {
  return now < pausedUntil;
}
