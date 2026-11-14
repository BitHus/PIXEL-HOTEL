// The logo splash on every page load: the owner's logo (assets/logo.gif) over a dark warm
// background while the game loads behind it. Pop in, hold, fade out (plain fade with
// prefers-reduced-motion); a tap or a key skips it at once. The element is removed when done,
// so it never blocks input afterwards. The markup is in index.html, so it shows before any JS.

import { SPLASH_FADE_MS, SPLASH_HOLD_MS, SPLASH_LOGO_PX, SPLASH_MARGIN_PX, SPLASH_POP_FROM, SPLASH_POP_MS } from '@pixel-hotel/shared';

export interface SplashBox {
  /** Size and top-left corner in CSS px; every art pixel covers a whole number of device px. */
  size: number;
  left: number;
  top: number;
}

/**
 * Where the logo goes: x2 (in CSS px) when it fits with the margin, else x1. On a screen with a
 * fractional devicePixelRatio the size is rounded down to whole device px per art pixel, and the
 * corner sits on a whole device px, so the art is never blurry.
 */
export function splashBox(viewW: number, viewH: number, dpr: number): SplashBox {
  const ratio = dpr > 0 ? dpr : 1;
  const room = Math.min(viewW, viewH) - 2 * SPLASH_MARGIN_PX;
  const cssScale = room >= SPLASH_LOGO_PX * 2 ? 2 : 1;
  const devicePerArt = Math.max(1, Math.floor(cssScale * ratio + 1e-6));
  const size = (SPLASH_LOGO_PX * devicePerArt) / ratio;
  const snap = (v: number): number => Math.round(v * ratio) / ratio;
  return { size, left: snap((viewW - size) / 2), top: snap((viewH - size) / 2) };
}

/** Runs the splash in #splash (if present). Resolves when it is gone. */
export function runSplash(): Promise<void> {
  const root = document.getElementById('splash');
  const img = root?.querySelector('img');
  if (!root || !img) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const timers: number[] = [];
    const place = (): void => {
      const box = splashBox(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
      img.style.width = img.style.height = `${box.size}px`;
      img.style.left = `${box.left}px`;
      img.style.top = `${box.top}px`;
    };
    const finish = (): void => {
      if (done) return;
      done = true;
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', skip, true);
      root.removeEventListener('pointerdown', skip);
      root.remove();
      resolve();
    };
    // A tap or a key skips at once; the event goes no further (no walk, no shortcut).
    function skip(e: Event): void {
      e.preventDefault();
      e.stopPropagation();
      finish();
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('keydown', skip, true);
    root.addEventListener('pointerdown', skip);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const begin = (): void => {
      if (done) return;
      img.style.visibility = 'visible';
      const pop = reduced ? 0 : SPLASH_POP_MS;
      if (!reduced) {
        img.animate(
          [
            { transform: `scale(${SPLASH_POP_FROM})`, opacity: 0, offset: 0 },
            { transform: 'scale(1.05)', opacity: 1, offset: 0.6 },
            { transform: 'scale(0.98)', offset: 0.8 },
            { transform: 'scale(1)', offset: 1 },
          ],
          { duration: SPLASH_POP_MS, easing: 'ease-out' },
        );
      }
      timers.push(
        window.setTimeout(() => {
          root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SPLASH_FADE_MS, easing: 'ease-in', fill: 'forwards' });
          timers.push(window.setTimeout(finish, SPLASH_FADE_MS));
        }, pop + SPLASH_HOLD_MS),
      );
    };
    // Start when the picture is ready (it is small; a failed load just runs the timing).
    if (img.complete) begin();
    else {
      img.addEventListener('load', begin, { once: true });
      img.addEventListener('error', begin, { once: true });
    }
  });
}
