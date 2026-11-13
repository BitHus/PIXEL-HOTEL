// The camera intro (brief section 4): when a room opens the camera shows the overview, waits
// INTRO_WAIT_MS, then zooms in over INTRO_ZOOM_MS to a settled zoom centered on the avatar.
// main.ts cancels it when the player taps, drags, pinches or uses the wheel.

import { INTRO_WAIT_MS, INTRO_ZOOM_MS, introCamera, type Camera } from '@pixel-hotel/shared';

export class CameraIntro {
  private run: { from: Camera; to: Camera; elapsed: number } | null = null;

  get active(): boolean {
    return this.run !== null;
  }

  start(from: Camera, to: Camera): void {
    this.run = { from, to, elapsed: 0 };
  }

  cancel(): void {
    this.run = null;
  }

  /** Advances the intro. Returns the camera to show (done = last frame), or null while waiting / inactive. */
  update(dtMs: number, screenW: number, screenH: number): { camera: Camera; done: boolean } | null {
    const r = this.run;
    if (!r) return null;
    r.elapsed += dtMs;
    const t = (r.elapsed - INTRO_WAIT_MS) / INTRO_ZOOM_MS;
    if (t <= 0) return null;
    const done = t >= 1;
    if (done) this.run = null;
    return { camera: introCamera(r.from, r.to, t, screenW, screenH), done };
  }
}
