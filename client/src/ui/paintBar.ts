// The floor paint bar (step BG1): a framed bar at the bottom while the player paints floor cells.
// It shows the unlocked floor styles as brushes (tap one to switch), the grid toggle (#) and Done.
// Tap a cell or drag a rectangle on the room to paint (build/floorPaint.ts). Escape also ends it.

import { STYLE_TYPES, styleKey } from '@pixel-hotel/shared';
import { el, textButton, typing } from './dom.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export interface PaintBarHooks {
  onBrush(styleId: string): void;
  onGrid(): void;
  onDone(): void;
}

export interface PaintBar {
  readonly el: HTMLElement;
  /** Shows the bar with these brushes (unlocked floor style keys) and the current one, or hides it when `brush` is null. */
  update(brush: string | null, unlocked: readonly string[], gridOn: boolean): void;
}

export function createPaintBar(parent: HTMLElement, hooks: PaintBarHooks): PaintBar {
  const root = el('div', 'frame ui-panel paint-bar');
  root.hidden = true;
  const swatches = el('div', 'paint-swatches');
  const hint = el('div', 'paint-hint', 'Tap a cell or drag a rectangle');
  const grid = textButton('#', hooks.onGrid, 'paint-grid');
  grid.title = 'Show the cell grid';
  grid.setAttribute('aria-label', 'Show the cell grid');
  const done = textButton('Done', hooks.onDone);
  root.append(hint, swatches, el('div', 'paint-buttons'));
  root.lastElementChild?.append(grid, done);
  parent.appendChild(root);

  window.addEventListener('keydown', (e) => {
    if (root.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (e.key === 'Escape') {
      hooks.onDone();
      e.preventDefault();
    }
  });

  return {
    el: root,
    update(brush, unlocked, gridOn) {
      root.hidden = brush === null;
      grid.classList.toggle('on', gridOn);
      if (brush === null) return;
      const buttons = STYLE_TYPES.filter((s) => s.kind === 'floor' && unlocked.includes(styleKey('floor', s.id))).map((s) => {
        const b = el('button', `style-swatch${s.id === brush ? ' selected' : ''}`);
        b.type = 'button';
        b.title = s.name;
        b.setAttribute('aria-label', s.name);
        b.style.backgroundImage = `url(${stylePreviewUrl('floor', s.id)})`;
        b.addEventListener('click', () => hooks.onBrush(s.id));
        return b;
      });
      swatches.replaceChildren(...buttons);
    },
  };
}
