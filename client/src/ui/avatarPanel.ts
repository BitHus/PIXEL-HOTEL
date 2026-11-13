// Avatar panel (step 5): pick the skin, hair, shirt, legs and shoes colours from the palette.
// The avatar in the room updates at once.

import { PALETTE, type AvatarLook } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';

type Part = 'skin' | 'hair' | 'shirt' | 'legs' | 'shoes';
const PARTS: [Part, string][] = [
  ['skin', 'Skin'],
  ['hair', 'Hair'],
  ['shirt', 'Shirt'],
  ['legs', 'Legs'],
  ['shoes', 'Shoes'],
];

export interface AvatarPanel {
  readonly el: HTMLElement;
  setLook(look: AvatarLook): void;
}

export function createAvatarPanel(parent: HTMLElement, onChange: (look: AvatarLook) => void): AvatarPanel {
  const panel = el('div', 'frame panel avatar-panel');
  const tabs = el('div', 'tabs');
  const grid = el('div', 'swatch-grid');
  panel.append(el('h2', 'panel-title', 'Avatar'), tabs, grid);
  parent.appendChild(panel);

  let look: AvatarLook | null = null;
  let part: Part = 'shirt';
  const tabButtons = PARTS.map(([p, label]) => {
    const b = textButton(label, () => {
      part = p;
      draw();
    }, 'tab');
    tabs.appendChild(b);
    return [p, b] as const;
  });
  const swatches = PALETTE.map((hex, i) => {
    const b = el('button', 'swatch');
    b.type = 'button';
    b.style.background = hex;
    b.title = `Colour ${i + 1}`;
    b.setAttribute('aria-label', `Colour ${i + 1}`);
    b.addEventListener('click', () => {
      if (!look) return;
      look = { ...look, [part]: i };
      draw();
      onChange(look);
    });
    grid.appendChild(b);
    return b;
  });

  function draw(): void {
    for (const [p, b] of tabButtons) b.classList.toggle('on', p === part);
    swatches.forEach((s, i) => s.classList.toggle('selected', look?.[part] === i));
  }
  draw();

  return {
    el: panel,
    setLook(next) {
      look = { ...next };
      draw();
    },
  };
}
