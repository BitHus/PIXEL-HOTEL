// The idle watcher behind the declutter plan (docs/PLAN-UI-DECLUTTER.md). It only feeds the clock and what the screen shows into the
// pure rules in shared/src/hudIdle.ts and applies the answer:
//   - class `hud-faded` on the UI root (declutter.css dims the info panel, side buttons, hotbar and sign to HUD_FADE_ALPHA);
//   - `guideAllowed()` for the first-steps card (shows only after GUIDE_IDLE_MS standing idle), `onGuideChange` tells it to redraw.
// A tap, a key, or a change (gold, gems, a toast appearing or going) brings the HUD back at once.

import { guideShown, hudFaded, HUD_IDLE_TICK_MS, type HudIdleInput } from '@pixel-hotel/shared';

export interface HudIdleHooks {
  /** The avatar is walking now. */
  walking(): boolean;
  /** A panel is open (Panels.open !== null). */
  panelOpen(): boolean;
  /** Build mode, placing, painting or the dungeon: the HUD stays at full strength. */
  editing(): boolean;
  /** The tap stand is being poured. */
  pouring(): boolean;
}

export interface HudIdle {
  /** Something the player should notice changed: the HUD comes back. */
  bump(): void;
  /** May the first-steps card show now? */
  guideAllowed(): boolean;
  onGuideChange(listener: () => void): void;
}

export function createHudIdle(root: HTMLElement, hooks: HudIdleHooks): HudIdle {
  const t0 = performance.now();
  let lastTapAt = t0;
  let lastWalkAt = t0;
  let lastChangeAt = t0;
  let pressing = false;
  let toastWas = false;
  let guideOn = false;
  const listeners: (() => void)[] = [];
  const tap = (): void => {
    lastTapAt = performance.now();
    evaluate();
  };
  window.addEventListener('pointerdown', () => {
    pressing = true;
    tap();
  }, true);
  const up = (): void => {
    pressing = false;
    lastTapAt = performance.now();
  };
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('keydown', tap, true);

  function evaluate(): void {
    const now = performance.now();
    const walking = hooks.walking();
    if (walking) lastWalkAt = now;
    const toast = root.querySelector('.toast:not([hidden])') !== null;
    if (toast !== toastWas) lastChangeAt = now;
    toastWas = toast;
    const input: HudIdleInput = {
      now,
      lastTapAt,
      lastWalkAt,
      lastChangeAt,
      panelOpen: hooks.panelOpen(),
      toastShowing: toast,
      pouring: hooks.pouring() || root.querySelector('.pour-bar:not([hidden])') !== null,
      pressing,
      editing: hooks.editing() || root.querySelector('.more-menu.open') !== null,
    };
    root.classList.toggle('hud-faded', hudFaded(input));
    const g = guideShown(input, walking);
    if (g !== guideOn) {
      guideOn = g;
      for (const l of listeners) l();
    }
  }
  window.setInterval(evaluate, HUD_IDLE_TICK_MS);
  // Gold or gems changing wakes the HUD (the numbers tick while they count up).
  const purse = root.querySelector('.info-gold');
  if (purse) {
    new MutationObserver(() => {
      lastChangeAt = performance.now();
      root.classList.remove('hud-faded');
    }).observe(purse, { childList: true, characterData: true, subtree: true });
  }
  return {
    bump() {
      lastChangeAt = performance.now();
      root.classList.remove('hud-faded');
    },
    guideAllowed: () => guideOn,
    onGuideChange: (l) => void listeners.push(l),
  };
}
