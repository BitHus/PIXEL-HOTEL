// Debug buttons for Blockers mode: "Blockers (B)" toggles it (also the B key), "Clear" removes
// every drawn rectangle (only shown while the mode is on). Shown only while Debug is on
// (settings panel); turning Debug off also turns Blockers mode off.

import { el, textButton, typing } from './dom.ts';

export interface BlockersButtonHooks {
  onToggle(on: boolean): void;
  onClear(): void;
}

export interface BlockersButtons {
  setVisible(visible: boolean): void;
}

export function createBlockersButton(parent: HTMLElement, hooks: BlockersButtonHooks): BlockersButtons {
  const bar = el('div', 'debug-bar');
  let on = false;
  const set = (v: boolean): void => {
    on = v;
    toggle.classList.toggle('on', on);
    clear.hidden = !on;
    hooks.onToggle(on);
  };
  const toggle = textButton('Blockers (B)', () => set(!on));
  const clear = textButton('Clear', () => hooks.onClear());
  clear.hidden = true;
  bar.append(toggle, clear);
  bar.hidden = true;
  parent.appendChild(bar);

  window.addEventListener('keydown', (e) => {
    if (bar.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (e.key === 'b' || e.key === 'B') set(!on);
  });
  return {
    setVisible(visible) {
      bar.hidden = !visible;
      if (!visible && on) set(false);
    },
  };
}
