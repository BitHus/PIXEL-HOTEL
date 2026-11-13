// Tap / long press / drag on an HTML element (bag and hotbar slots), with the same thresholds as
// the room (TAP_MAX_MOVE_PX, LONG_PRESS_MS). Touch: moving before the long press is a scroll
// (nothing happens); a long press starts a drag. Mouse: moving past the threshold starts a drag.

import { LONG_PRESS_MS, TAP_MAX_MOVE_PX, type Point } from '@pixel-hotel/shared';

export interface PressHooks {
  onTap(): void;
  /** A long press (touch or mouse) or a mouse drag started at this screen point. */
  onHold(at: Point): void;
}

export function attachPress(target: HTMLElement, hooks: PressHooks): void {
  target.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    const start = { x: down.clientX, y: down.clientY };
    let done = false;
    const timer = window.setTimeout(() => finish(() => hooks.onHold(start)), LONG_PRESS_MS);
    const finish = (then?: () => void): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      then?.();
    };
    const move = (e: PointerEvent): void => {
      if (e.pointerId !== down.pointerId) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_MAX_MOVE_PX) return;
      // Touch: the finger moved first, so it is a scroll. Mouse: a drag.
      finish(down.pointerType === 'touch' ? undefined : () => hooks.onHold({ x: e.clientX, y: e.clientY }));
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId === down.pointerId) finish(() => hooks.onTap());
    };
    const cancel = (e: PointerEvent): void => {
      if (e.pointerId === down.pointerId) finish();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
  // No browser menu or text selection on a long press.
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}
