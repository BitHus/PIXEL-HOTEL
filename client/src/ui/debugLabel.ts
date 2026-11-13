// HTML debug label in the UI overlay: world x and y under the pointer, and the zoom.

export interface DebugLabel {
  set(text: string): void;
}

export function createDebugLabel(parent: HTMLElement): DebugLabel {
  const el = document.createElement('div');
  el.className = 'debug-label';
  parent.appendChild(el);
  return {
    set(text) {
      el.textContent = text;
    },
  };
}
