// The floating button bar shown while placing (step 4b): ✓ Place, ↻ Rotate, ✗ Cancel, just above
// the ghost. ✓ is disabled while the ghost is red. Keys: Enter, R, Escape.

import type { Rect } from '@pixel-hotel/shared';
import { anchorAbove } from './anchorAbove.ts';

export interface PlaceBarHooks {
  onPlace(): void;
  onRotate(): void;
  onCancel(): void;
}

export interface PlaceBar {
  /** Shows the bar above `ghost` (screen rect), or hides it when null. */
  update(ghost: Rect | null, valid: boolean): void;
}

function button(text: string, title: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

export function createPlaceBar(parent: HTMLElement, hooks: PlaceBarHooks): PlaceBar {
  const bar = document.createElement('div');
  bar.className = 'float-bar place-bar';
  const place = button('✓', 'Place (Enter)', 'ok', () => hooks.onPlace());
  const rotate = button('↻', 'Rotate (R)', '', () => hooks.onRotate());
  const cancel = button('✗', 'Cancel (Esc)', 'no', () => hooks.onCancel());
  bar.append(place, rotate, cancel);
  bar.hidden = true;
  parent.appendChild(bar);

  window.addEventListener('keydown', (e) => {
    if (bar.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'enter') hooks.onPlace();
    else if (k === 'r') hooks.onRotate();
    else if (k === 'escape') hooks.onCancel();
    else return;
    e.preventDefault();
  });

  return {
    update(ghost, valid) {
      bar.hidden = ghost === null;
      if (!ghost) return;
      place.disabled = !valid;
      anchorAbove(bar, ghost);
    },
  };
}
