// HTML debug label in the UI overlay: world x and y under the pointer, and the zoom. Shown only
// while Debug is on (settings panel).

import { el } from './dom.ts';

export interface DebugLabel {
  set(text: string): void;
  readonly visible: boolean;
  setVisible(visible: boolean): void;
}

export function createDebugLabel(parent: HTMLElement): DebugLabel {
  const label = el('div', 'debug-label');
  label.hidden = true;
  parent.appendChild(label);
  return {
    set(text) {
      if (!label.hidden) label.textContent = text;
    },
    get visible() {
      return !label.hidden;
    },
    setVisible(visible) {
      label.hidden = !visible;
    },
  };
}
