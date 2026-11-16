// HTML debug label in the UI overlay: world x and y under the pointer, the zoom and the frame times
// (avg / max ms of the last 120 frames). Shown only while Debug is on (settings panel).

import { el } from './dom.ts';

export interface DebugLabel {
  set(text: string): void;
  /** The frame-time line under the text (updated a few times a second, not on every camera change). */
  setFrameLine(text: string): void;
  readonly visible: boolean;
  setVisible(visible: boolean): void;
}

export function createDebugLabel(parent: HTMLElement): DebugLabel {
  const label = el('div', 'debug-label');
  label.hidden = true;
  parent.appendChild(label);
  let main = '';
  let frame = '';
  const render = (): void => {
    if (!label.hidden) label.textContent = frame ? `${main}\n${frame}` : main;
  };
  return {
    set(text) {
      if (text === main) return;
      main = text;
      render();
    },
    setFrameLine(text) {
      if (text === frame) return;
      frame = text;
      render();
    },
    get visible() {
      return !label.hidden;
    },
    setVisible(visible) {
      label.hidden = !visible;
      render();
    },
  };
}
