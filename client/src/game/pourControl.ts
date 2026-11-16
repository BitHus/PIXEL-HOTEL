// G2: the hands-on pour, as one small state machine. No button: when the avatar waits at the taps (event 'pour_ready') the player PRESSES AND HOLDS THE
// TAP STAND in the world (pointerInput asks claims(screen) first, so a press on the stand belongs to the pour and never walks or pans). While the press lasts
// the mug fills (rules in shared/src/pour.ts), releasing calls onEnd(heldMs, pick). Keyboard fallback: Space or Enter held (not while typing).
// Robust: release always ends it (pointer up/cancel from cameraControl, window pointerup, blur, visibility change, a panel opening, a hold past POUR_HOLD_CAP_MS,
// the guest leaving or the tap emptying: cancel()). The mug is never lost: the API call happens once, on the release.

import { POUR_HOLD_CAP_MS, POUR_MAX_FILL, POUR_PERFECT_RANGE, pickPourTap, pourFill, pourHeldClamp, type PourPick, type Point } from '@pixel-hotel/shared';

const GLUG_EVERY_MS = 110;
/** A press this close to a stand's centre (CSS px, at least) belongs to it; scaled up with the zoom. */
export const POUR_TOUCH_MIN_PX = 44;

export interface StandSpot {
  standUid: number;
  /** The stand's centre on the screen (CSS px). */
  screen: Point;
  /** Its size scale (the camera zoom): the touch radius grows with it. */
  zoom: number;
}

export interface PourControlHooks {
  /** The stands on the bar, on screen. */
  stands: () => StandSpot[];
  /** The live taps (for choosing the tap). */
  taps: () => readonly { standUid: number; slot: number; drink: string; mugs: number }[];
  drinkName: (id: string) => string;
  /** True when something else owns the pointer (a panel, build, paint, dungeon). */
  blocked: () => boolean;
  onStart: (standUid: number, slot: number) => void;
  onFill: (fill: number, heldMs: number) => void;
  /** Released (or capped): the API call. */
  onEnd: (heldMs: number, pick: { standUid: number; slot: number }) => void;
  glug: (pitch: number) => void;
  toast: (text: string) => void;
  now?: () => number;
}

export function createPourControl(h: PourControlHooks) {
  const now = h.now ?? (() => performance.now());
  let waiting: { standUid: number; item: string } | null = null;
  let press: { startedAt: number; pick: { standUid: number; slot: number }; source: 'pointer' | 'key'; lastGlug: number } | null = null;
  let raf = 0;

  const nearest = (screen: Point): { spot: StandSpot; side: 0 | 1 } | null => {
    let best: { spot: StandSpot; d: number } | null = null;
    for (const s of h.stands()) {
      const d = Math.hypot(screen.x - s.screen.x, screen.y - s.screen.y);
      if (d <= Math.max(POUR_TOUCH_MIN_PX, 22 * s.zoom) && (!best || d < best.d)) best = { spot: s, d };
    }
    return best ? { spot: best.spot, side: screen.x < best.spot.screen.x ? 0 : 1 } : null;
  };

  const loop = (): void => {
    if (!press) return;
    raf = requestAnimationFrame(loop);
    const ms = now() - press.startedAt;
    h.onFill(pourFill(ms), ms);
    if (now() - press.lastGlug >= GLUG_EVERY_MS && pourFill(ms) < POUR_MAX_FILL) {
      press.lastGlug = now();
      h.glug(Math.min(1, pourFill(ms) / POUR_PERFECT_RANGE[1]));
    }
    if (ms >= POUR_HOLD_CAP_MS) end(); // the safety cap: a stuck press ends by itself
  };

  const end = (): void => {
    const p = press;
    if (!p) return;
    press = null;
    cancelAnimationFrame(raf);
    h.onEnd(pourHeldClamp(now() - p.startedAt), p.pick);
  };

  const begin = (standUid: number, side: number, source: 'pointer' | 'key'): void => {
    if (!waiting || press) return;
    const pick: PourPick = pickPourTap(h.taps(), standUid, waiting.item, side);
    if (!pick.ok) {
      h.toast(pick.why === 'other' ? `That tap pours ${h.drinkName(pick.drink)}, not ${h.drinkName(waiting.item)}.` : 'That tap is empty.');
      return;
    }
    press = { startedAt: now(), pick: { standUid, slot: pick.slot }, source, lastGlug: 0 };
    h.onStart(standUid, pick.slot);
    raf = requestAnimationFrame(loop);
  };

  // Backups: a release anywhere, losing focus, hiding the page, all end the press (the camera control also sends pointer up/cancel).
  const stopPointer = (): void => {
    if (press?.source === 'pointer') end();
  };
  window.addEventListener('pointerup', stopPointer);
  window.addEventListener('pointercancel', stopPointer);
  window.addEventListener('blur', () => end());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) end();
  });
  const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName));
  window.addEventListener('keydown', (e) => {
    if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || !waiting || press || typing(e.target) || h.blocked()) return;
    e.preventDefault();
    begin(waiting.standUid, 0, 'key');
  });
  window.addEventListener('keyup', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && press?.source === 'key') end();
  });

  return {
    /** The avatar waits at the taps for this order. */
    wait(standUid: number, item: string): void {
      waiting = { standUid, item };
    },
    /** True while a pour is waited for. */
    get waiting(): { standUid: number; item: string } | null {
      return waiting;
    },
    get pressing(): boolean {
      return press !== null;
    },
    /** Does a press at this screen point belong to the pour (it waits, nothing else owns the pointer, a stand is near)? */
    claims(screen: Point): boolean {
      return waiting !== null && !h.blocked() && nearest(screen) !== null;
    },
    /** The press went down at this point (call after claims() said yes). */
    down(screen: Point): void {
      const n = nearest(screen);
      if (n) begin(n.spot.standUid, n.side, 'pointer');
    },
    /** The pointer ended (camera control: pointer up, cancel or a second finger). */
    up(): void {
      end();
    },
    /** Nothing to pour any more (the guest left, the tap emptied, a panel opened, another room): no API call, nothing is taken. */
    cancel(): void {
      const was = press !== null || waiting !== null;
      press = null;
      waiting = null;
      cancelAnimationFrame(raf);
      void was;
    },
    /** The waiting is over because the pour ran (keeps nothing). */
    done(): void {
      waiting = null;
    },
  };
}
