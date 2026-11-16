// A number that counts to its new value (currency pass): the HUD gold and gem counters. Whole numbers only, eased out, a short time
// (longer for bigger jumps, never over COUNT_MAX_MS), and the plate gets a class for a stepped one-pixel bump (green-lit on a gain,
// red on a spend; skin.css). The first value is shown at once. With prefers-reduced-motion, or while the page is hidden, the number
// just changes and nothing bumps.

export const COUNT_MIN_MS = 220;
export const COUNT_MAX_MS = 650;

/** The value k (0..1) of the way from `from` to `to`: eased out, rounded to a whole number. */
export function countValue(from: number, to: number, k: number): number {
  if (k >= 1) return to;
  const eased = 1 - (1 - Math.max(0, k)) ** 3;
  return Math.round(from + (to - from) * eased);
}

/** How long a jump takes: bigger jumps take longer, within the limits. */
export function countMs(from: number, to: number): number {
  return Math.min(COUNT_MAX_MS, COUNT_MIN_MS + Math.round(Math.log2(1 + Math.abs(to - from)) * 55));
}

function calm(): boolean {
  try {
    return document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export interface CountTween {
  /** Shows `n`: counts there when it changed (not the first time). */
  set(n: number): void;
}

/** `text` shows the number; `plate` (the counter's box) gets `bump-up` or `bump-down` for a moment. */
export function countTween(text: HTMLElement, plate: HTMLElement): CountTween {
  let shown: number | null = null;
  let target = 0;
  let raf = 0;
  let bumpTimer = 0;

  const show = (n: number): void => {
    shown = n;
    text.textContent = String(n);
  };

  return {
    set(n) {
      if (n === target && shown !== null) return;
      const from = shown ?? n;
      target = n;
      cancelAnimationFrame(raf);
      if (shown === null || from === n || calm()) {
        show(n);
        return;
      }
      plate.classList.remove('bump-up', 'bump-down');
      void plate.offsetWidth;
      plate.classList.add(n > from ? 'bump-up' : 'bump-down');
      window.clearTimeout(bumpTimer);
      bumpTimer = window.setTimeout(() => plate.classList.remove('bump-up', 'bump-down'), 520);
      const ms = countMs(from, n);
      const t0 = performance.now();
      const tick = (now: number): void => {
        const k = (now - t0) / ms;
        show(countValue(from, n, k));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
  };
}
