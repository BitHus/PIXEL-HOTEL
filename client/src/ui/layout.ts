// ONE place for the size class (UI-1, docs/OWNER-PLAYTEST-2.md). The viewport decides a class and the UI root gets
// data-size="phone" | "tablet" | "desktop" (also on <html>), so ui/sizes.css can set one set of tokens per class:
// font sizes (--fs-*), line height (--lh), padding (--pad) and gaps (--gap). Panels, menus, toasts, speech bubbles
// and the orders strip all read those tokens; nothing else decides "is this a phone".
//   phone   = the short side under 600 px, or a landscape phone (height under 500 px)
//   tablet  = under 1024 px wide
//   desktop = the rest
// Pure and tested (layout.test.ts); watchLayout (layoutVars.ts) calls watchSizeClass once.

import './lantern.css'; // the Lantern Dark skin loads after skin.css (main.ts imports skin.css and sizes.css first)

export type SizeClass = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX_SHORT_SIDE = 600;
export const PHONE_MAX_HEIGHT = 500;
export const TABLET_MAX_WIDTH = 1023;

/** The class for a viewport of w x h CSS px. */
export function sizeClassFor(w: number, h: number): SizeClass {
  if (Math.min(w, h) < PHONE_MAX_SHORT_SIDE || h < PHONE_MAX_HEIGHT) return 'phone';
  if (w <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

/** Puts the class on the roots and keeps it current while the window changes (rotate, resize). Returns the stop function. */
export function watchSizeClass(...roots: HTMLElement[]): () => void {
  const apply = (): void => {
    const cls = sizeClassFor(window.innerWidth, window.innerHeight);
    for (const r of roots) r.dataset.size = cls;
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  apply();
  return () => {
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
  };
}

// The title screen and the character maker run before the game parts, so the class is set as soon as this module loads.
if (typeof window !== 'undefined' && typeof document !== 'undefined') watchSizeClass(document.documentElement);
