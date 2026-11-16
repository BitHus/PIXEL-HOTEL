// G2: the hands-on pour. When the avatar waits at the taps (event 'pour_ready') a "Hold to pour" button shows over the stand with a fill bar. Pressing it
// (mouse or touch) starts the stream, the mug fills in POUR_FULL_MS and the glug sound rises; releasing calls api.pourHeld(heldMs). Rules live in
// shared/src/pour.ts; this file only feeds the press to them and draws. CSS needs for the artist: .pour-btn, .pour-bar, .pour-bar-fill, .pour-bar-mark (inline defaults here).

import { POUR_PERFECT_RANGE, POUR_MAX_FILL, pourFill, pourGrade, type Point } from '@pixel-hotel/shared';

const GLUG_EVERY_MS = 110;

export interface PourControlHooks {
  root: HTMLElement;
  /** Where the stand is on the screen (CSS px) or null when it is not visible. */
  screenPoint: () => Point | null;
  /** The press started or ended (the fx and the sound follow in tavernLife). */
  onStart: () => void;
  onFill: (fill: number) => void;
  /** Released: the API call. */
  onRelease: (heldMs: number) => void;
  glug: (fill: number) => void;
  now?: () => number;
}

export function createPourControl(h: PourControlHooks) {
  const now = h.now ?? (() => performance.now());
  const el = document.createElement('div');
  el.className = 'pour-btn';
  el.style.cssText = 'position:absolute;z-index:30;display:none;transform:translate(-50%,-100%);touch-action:none;user-select:none;padding:8px 12px;min-width:120px;min-height:44px;text-align:center;font-family:var(--font);background:#3e2731;color:#fff;border:2px solid #f6ca9f;cursor:pointer';
  const label = document.createElement('div');
  label.textContent = 'Hold to pour';
  const bar = document.createElement('div');
  bar.className = 'pour-bar';
  bar.style.cssText = 'position:relative;height:8px;margin-top:6px;background:#181425;border:1px solid #f6ca9f';
  const fill = document.createElement('div');
  fill.className = 'pour-bar-fill';
  fill.style.cssText = 'height:100%;width:0;background:#feae34';
  const mark = document.createElement('div');
  mark.className = 'pour-bar-mark';
  const lo = (POUR_PERFECT_RANGE[0] / POUR_MAX_FILL) * 100;
  const hi = (POUR_PERFECT_RANGE[1] / POUR_MAX_FILL) * 100;
  mark.style.cssText = `position:absolute;top:-2px;bottom:-2px;left:${lo}%;width:${hi - lo}%;border:1px solid #63c74d;box-sizing:border-box;pointer-events:none`;
  bar.append(fill, mark);
  el.append(label, bar);
  h.root.appendChild(el);

  let startedAt: number | null = null;
  let lastGlug = 0;
  let raf = 0;
  let visible = false;

  const place = (): void => {
    const p = h.screenPoint();
    if (!p) return;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y - 30}px`;
  };
  const frame = (): void => {
    raf = requestAnimationFrame(frame);
    place();
    if (startedAt === null) return;
    const ms = now() - startedAt;
    const f = pourFill(ms);
    fill.style.width = `${(f / POUR_MAX_FILL) * 100}%`;
    fill.style.background = pourGrade(ms) === 'perfect' ? '#63c74d' : f > 1 ? '#e43b44' : '#feae34';
    h.onFill(f);
    if (now() - lastGlug >= GLUG_EVERY_MS && f < POUR_MAX_FILL) {
      lastGlug = now();
      h.glug(Math.min(1, f / POUR_PERFECT_RANGE[1]));
    }
  };
  const end = (): void => {
    if (startedAt === null) return;
    const held = now() - startedAt;
    startedAt = null;
    fill.style.width = '0';
    h.onRelease(held);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (startedAt !== null) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* not needed */ }
    startedAt = now();
    lastGlug = 0;
    label.textContent = 'Release at the green mark';
    h.onStart();
  });
  el.addEventListener('pointerup', (e) => { e.stopPropagation(); end(); });
  el.addEventListener('pointercancel', end);

  return {
    show(): void {
      if (visible) return;
      visible = true;
      startedAt = null;
      label.textContent = 'Hold to pour';
      fill.style.width = '0';
      el.style.display = 'block';
      place();
      raf = requestAnimationFrame(frame);
    },
    hide(): void {
      if (!visible) return;
      visible = false;
      startedAt = null;
      el.style.display = 'none';
      cancelAnimationFrame(raf);
    },
    get active(): boolean {
      return visible;
    },
  };
}
