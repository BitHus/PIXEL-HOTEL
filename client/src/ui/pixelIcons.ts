// Small pixel-art UI icons drawn in code (placeholders, original). Each icon is a pixel map:
// one string per row, one character per pixel, '.' = empty. Rendered as a crisp inline SVG.

import { PALETTE } from '@pixel-hotel/shared';

type PixelMap = { rows: string[]; colors: Record<string, string> };

const O = PALETTE[6]; // dark warm outline

const ICONS = {
  bag: {
    rows: [
      '....oooo....',
      '...occcco...',
      '...o....o...',
      '..oooooooo..',
      '.obbbbbbbbo.',
      'oabbbbbbbbao',
      'oaaaaddaaaao',
      'oaaaaddaaaao',
      'oaaaaaaaaaao',
      'oaaaaaaaaaao',
      '.occcccccco.',
      '..oooooooo..',
    ],
    colors: { o: O, a: PALETTE[4], b: PALETTE[3], c: PALETTE[5], d: PALETTE[10] },
  },
  avatar: {
    rows: [
      '....oooo....',
      '...occcco...',
      '..occcccco..',
      '..obbbbbbo..',
      '..obbbbbbo..',
      '...obbbbo...',
      '....oooo....',
      '..oooooooo..',
      '.oaaaaaaaao.',
      'oaaaaaaaaaao',
      'oaaaaaaaaaao',
      'oooooooooooo',
    ],
    colors: { o: O, a: PALETTE[7], b: PALETTE[30], c: PALETTE[5] },
  },
  chat: {
    rows: [
      '............',
      '.oooooooooo.',
      'obbbbbbbbbbo',
      'obbbbbbbbbbo',
      'obbcbbcbbcbo',
      'obbbbbbbbbbo',
      'obbbbbbbbbbo',
      '.ooobbooooo.',
      '...obo......',
      '...oo.......',
      '............',
      '............',
    ],
    colors: { o: O, b: PALETTE[2], c: O },
  },
  gear: {
    rows: [
      '....oooo....',
      '..o.oaao.o..',
      '.oaooaaooao.',
      '..oaaaaaao..',
      '.ooaaooaaoo.',
      'oaaaobboaaao',
      'oaaaobboaaao',
      '.ooaaooaaoo.',
      '..oaaaaaao..',
      '.oaooaaooao.',
      '..o.oaao.o..',
      '....oooo....',
    ],
    colors: { o: O, a: PALETTE[20], b: PALETTE[22] },
  },
  coin: {
    rows: [
      '..oooooo..',
      '.obbbbbao.',
      'obbaaaabao',
      'obaabbaaao',
      'obaabbaaao',
      'obaabbaaao',
      'obaabbaaao',
      'obbaaaaaao',
      '.oaaaaaao.',
      '..oooooo..',
    ],
    colors: { o: O, a: PALETTE[10], b: PALETTE[11] },
  },
  chair: {
    rows: [
      '..oooooo....',
      '..obbbbo....',
      '..oaaaao....',
      '..oaaaao....',
      '..oaaaao....',
      '..oaaaao....',
      '..oooooooo..',
      '..obbbbbbo..',
      '..oaaaaaao..',
      '..oooooooo..',
      '..oa....ao..',
      '..oo....oo..',
    ],
    colors: { o: O, a: PALETTE[4], b: PALETTE[3] },
  },
  wood: {
    rows: [
      '............',
      '............',
      '..ooooooooo.',
      '.obaaaaaaaco',
      '.obaaaaaaaco',
      '..ooooooooo.',
      '.ooooooooo..',
      'obaaaaaaaco.',
      'obaaaaaaaco.',
      '.ooooooooo..',
      '............',
      '............',
    ],
    colors: { o: O, a: PALETTE[4], b: PALETTE[3], c: PALETTE[2] },
  },
  sort: {
    rows: [
      '..o.........',
      '.oao..oooooo',
      'oaaao.oaaaao',
      '..a...oooooo',
      '..a.........',
      '..a...oooo..',
      '..a...oaao..',
      '..a...oooo..',
      'oaaao.......',
      '.oao..oo....',
      '..o...oo....',
      '............',
    ],
    colors: { o: O, a: PALETTE[2] },
  },
  stack: {
    rows: [
      '............',
      '...oooooo...',
      '...oaaaao...',
      '...oooooo...',
      '..oooooooo..',
      '..oaaaaaao..',
      '..oooooooo..',
      '.oooooooooo.',
      '.oaaaaaaaao.',
      '.oooooooooo.',
      '............',
      '............',
    ],
    colors: { o: O, a: PALETTE[2] },
  },
} satisfies Record<string, PixelMap>;

export type IconName = keyof typeof ICONS;

/** An inline SVG element for the icon (crisp edges, scaled by CSS). */
export function pixelIcon(name: IconName): SVGSVGElement {
  const { rows, colors } = ICONS[name] as PixelMap;
  const w = Math.max(...rows.map((r) => [...r].length));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('pixel-icon');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = colors[ch];
      if (!fill) return;
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', fill);
      svg.appendChild(r);
    });
  });
  return svg;
}
