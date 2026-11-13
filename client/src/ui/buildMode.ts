// Play mode and build mode (step 4b, changed in step 5). Play mode is the default: taps walk
// and sit. Build mode: taps never walk; a tap or long press on an item opens its menu. The Build
// button (hammer, right-edge column) and the B key toggle it; Escape leaves it (when no panel is
// open and nothing is being placed). While it is on, the button is highlighted and a thin warm
// border runs around the screen edge.

import { el, iconButton, typing } from './dom.ts';

export interface BuildMode {
  readonly on: boolean;
  set(on: boolean): void;
  /** The Build button, for the right-edge column. */
  readonly button: HTMLButtonElement;
}

export interface BuildModeHooks {
  onChange(on: boolean): void;
  /** True while Escape belongs to something else (an open panel, a placing session). */
  escapeTaken(): boolean;
}

export function createBuildMode(parent: HTMLElement, hooks: BuildModeHooks): BuildMode {
  const frame = el('div', 'build-frame');
  frame.hidden = true;
  parent.appendChild(frame);
  let on = false;
  const set = (next: boolean): void => {
    if (next === on) return;
    on = next;
    frame.hidden = !on;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
    hooks.onChange(on);
  };
  const button = iconButton('hammer', 'Build (B)', () => set(!on));
  button.setAttribute('aria-pressed', 'false');

  // Capture phase: runs before the panel and placing handlers see (and use up) Escape.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
      if (e.key === 'b' || e.key === 'B') {
        if (hooks.escapeTaken()) return;
        set(!on);
      } else if (e.key === 'Escape' && on && !hooks.escapeTaken()) {
        set(false);
      }
    },
    { capture: true },
  );
  return {
    get on() {
      return on;
    },
    set,
    button,
  };
}
