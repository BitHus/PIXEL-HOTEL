// OB-4: the PUNCH / BREAK toggle at the LEFT end of the hotbar (the Bag button is at the right end): a round 44 px+ button with a code-drawn
// pickaxe. On = taps and holds break blocks, plants and rocks (the old behaviour); off = "chilling": a tap on a block only walks or uses
// things and never breaks. This file is the VIEW only: the game keeps the state and decides what a tap does (HOOKS NEEDED in the OB-4 report).

import { el } from './dom.ts';

export interface PunchToggle {
  readonly el: HTMLButtonElement;
  /** Shows the state the game holds (true = break mode on). */
  setOn(on: boolean): void;
}

// 12 x 12 pixel pickaxe, one row per string: '#' = dark outline, 'm' = metal, 'h' = handle.
const ART = [
  '..#######...',
  '.#mmmmmmm#..',
  '#mm#####mm#.',
  '#m#.....#m#.',
  '....#h#.....',
  '....#h#.....',
  '....#h#.....',
  '....#h#.....',
  '....#h#.....',
  '....#h#.....',
  '....###.....',
  '............',
];
const COLORS: Record<string, string> = { '#': '#181425', m: '#c0cbdc', h: '#b86f50' };

function pickaxeSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.classList.add('punch-icon');
  ART.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = COLORS[row[x] ?? '.'];
      if (!c) continue;
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', c);
      svg.appendChild(r);
    }
  });
  return svg;
}

/** Puts the button first in `hotbarEl`. `onToggle(next)` is called with the wanted state; call setOn with what the game accepts. */
export function createPunchToggle(hotbarEl: HTMLElement, onToggle: (next: boolean) => void): PunchToggle {
  const b = el('button', 'hotbar-punch room-only') as HTMLButtonElement;
  b.type = 'button';
  b.appendChild(pickaxeSvg());
  let on = true;
  const apply = (): void => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Break mode: taps break blocks (tap to chill)' : 'Chill mode: taps never break (tap to break)';
    b.setAttribute('aria-label', b.title);
  };
  apply();
  b.addEventListener('click', () => onToggle(!on));
  hotbarEl.prepend(b);
  return {
    el: b,
    setOn(next) {
      on = next;
      apply();
    },
  };
}
