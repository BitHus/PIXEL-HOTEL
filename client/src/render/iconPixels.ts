// Item icon pixels (step BG2): every shape of ICON_SHAPES drawn in code on a 32x32 square, as a
// plain array of hex colours (null = empty). Pure (no canvas), so it is tested and cached by
// drawIcon.ts. Each shape paints flat fills from its colours (a = main, b = accent, c = third);
// then ONE pass adds the light from the top-left (a lighter top-left edge, a darker bottom-right
// edge) and a 1 px dark warm outline around everything. A rank frame goes around the square.
//
// PLACEHOLDER ART: these shapes are rough on purpose. Real pixel art replaces drawIcon per item in
// phase 4 (docs/NOTES.md BG2); the data (shape + colours per item) stays as the fallback.

import { ICON_SHAPES, PALETTE, RANK_COLORS, paletteColor, type Icon, type IconShape, type Rank } from '@pixel-hotel/shared';
import { shade } from './colors.ts';

export const ICON_SIZE = 32;

export type IconPixels = (string | null)[];

const OUTLINE = paletteColor('outline');
const CREAM = PALETTE[2];
const WOOD = PALETTE[4];
const DARK = PALETTE[6];
const WHITE = PALETTE[19];

/** A tiny paint surface for one icon. Everything is clipped to the square. */
class Pen {
  readonly px: IconPixels = new Array<string | null>(ICON_SIZE * ICON_SIZE).fill(null);
  set(x: number, y: number, c: string | null): void {
    if (x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE) this.px[y * ICON_SIZE + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string | null): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Filled ellipse around a centre (pixel centres inside the ellipse). */
  oval(cx: number, cy: number, rx: number, ry: number, c: string | null): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  /** Filled polygon (even-odd on pixel centres). */
  poly(pts: [number, number][], c: string | null): void {
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]!;
          const [xj, yj] = pts[j]!;
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    }
  }
  /** A line `t` px thick (square brush). */
  line(x0: number, y0: number, x1: number, y1: number, c: string | null, t = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      this.rect(Math.round(x0 + ((x1 - x0) * i) / n - (t - 1) / 2), Math.round(y0 + ((y1 - y0) * i) / n - (t - 1) / 2), t, t, c);
    }
  }
}

type Draw = (p: Pen, a: string, b: string, c: string) => void;

const dk = (c: string): string => shade(c, 0.74);

const DRAW: Record<IconShape, Draw> = {
  // ---- goods ----
  ore: (p, a, b) => {
    p.poly([[6, 22], [8, 12], [14, 7], [22, 9], [26, 16], [25, 24], [18, 26]], a);
    p.rect(11, 13, 3, 3, b); p.rect(19, 17, 3, 3, b); p.rect(14, 20, 2, 2, b); p.rect(20, 11, 2, 2, b);
  },
  bar: (p, a, b) => {
    p.poly([[9, 11], [23, 11], [27, 17], [5, 17]], b);
    p.rect(5, 17, 22, 8, a);
    p.rect(9, 13, 8, 1, WHITE);
  },
  fish: (p, a, b) => {
    p.oval(14, 16, 10, 6, a); p.poly([[22, 16], [29, 9], [29, 23]], b); p.poly([[9, 11], [16, 6], [18, 11]], b);
    p.rect(13, 18, 9, 2, b); p.rect(7, 14, 2, 2, DARK);
  },
  leaf: (p, a, b) => {
    p.poly([[6, 25], [8, 12], [16, 6], [26, 6], [25, 17], [18, 24]], a);
    p.line(7, 24, 22, 9, b);
  },
  mushroom: (p, a, b) => {
    p.rect(13, 15, 7, 12, CREAM); p.oval(16, 13, 11, 8, a);
    p.rect(9, 9, 3, 3, b); p.rect(17, 11, 4, 4, b); p.rect(22, 14, 2, 2, b);
  },
  log: (p, a, b) => {
    p.rect(4, 11, 20, 13, a); p.oval(24, 17, 4, 7, b); p.oval(24, 17, 2, 3, a);
    p.rect(8, 14, 10, 1, dk(a)); p.rect(6, 19, 12, 1, dk(a));
  },
  potion: (p, a, b) => {
    p.oval(16, 20, 9, 8, a); p.rect(13, 8, 6, 8, b); p.rect(13, 4, 6, 4, WOOD); p.rect(11, 17, 3, 3, WHITE);
  },
  bread: (p, a, b) => {
    p.oval(16, 18, 12, 8, a); p.line(9, 14, 12, 19, b, 2); p.line(15, 12, 18, 18, b, 2); p.line(21, 13, 24, 18, b, 2);
  },
  mug: (p, a, b) => {
    p.rect(8, 11, 14, 15, a); p.rect(8, 8, 14, 4, b);
    p.rect(22, 13, 6, 2, a); p.rect(26, 13, 2, 9, a); p.rect(22, 20, 6, 2, a);
  },
  gem: (p, a, b) => {
    p.poly([[6, 12], [11, 5], [21, 5], [26, 12], [16, 27]], a); p.poly([[11, 5], [21, 5], [26, 12], [6, 12]], b); p.rect(10, 8, 2, 2, WHITE);
  },
  seed: (p, a, b) => {
    p.oval(16, 17, 6, 9, a); p.line(16, 11, 16, 23, b); p.rect(14, 12, 2, 2, WHITE);
  },
  block: (p, a, b) => {
    p.rect(5, 10, 22, 17, a); p.rect(5, 5, 22, 6, b); p.rect(9, 15, 3, 3, dk(a)); p.rect(18, 19, 4, 3, dk(a));
  },
  cloth: (p, a, b) => {
    p.rect(6, 9, 20, 17, a); p.rect(6, 15, 20, 2, b); p.poly([[20, 9], [26, 9], [26, 15]], b); p.rect(9, 20, 6, 1, b);
  },
  bone: (p, a, b) => {
    p.rect(9, 13, 14, 6, a); for (const [x, y] of [[8, 12], [8, 19], [23, 12], [23, 19]] as const) p.oval(x + 1.5, y + 1.5, 3, 3, a);
    p.rect(11, 14, 6, 1, b);
  },
  boot: (p, a, b) => {
    p.poly([[10, 5], [19, 5], [19, 17], [27, 20], [27, 26], [10, 26]], a); p.rect(10, 24, 17, 3, b); p.rect(10, 5, 9, 3, b);
  },
  key: (p, a, b) => {
    p.oval(10, 16, 6, 6, a); p.oval(10, 16, 2.5, 2.5, null); p.rect(15, 15, 13, 3, a); p.rect(23, 18, 2, 4, b); p.rect(26, 18, 2, 3, b);
  },
  ring: (p, a, b) => {
    p.oval(16, 19, 9, 9, a); p.oval(16, 19, 5, 5, null); p.rect(13, 7, 6, 5, b); p.rect(14, 8, 2, 2, WHITE);
  },
  plate: (p, a, b) => {
    p.oval(16, 21, 13, 6, CREAM); p.oval(16, 17, 9, 6, a); p.rect(11, 15, 2, 2, b); p.rect(17, 13, 3, 2, b); p.rect(20, 18, 2, 2, b);
  },
  bowl: (p, a, b) => {
    p.poly([[4, 14], [28, 14], [24, 24], [20, 27], [12, 27], [8, 24]], CREAM); p.oval(16, 14, 12, 4, a);
    p.rect(11, 13, 2, 2, b); p.rect(17, 12, 3, 2, b); p.rect(21, 14, 2, 2, b);
  },
  bottle: (p, a, b) => {
    p.rect(11, 12, 10, 15, a); p.rect(14, 5, 4, 8, a); p.rect(14, 3, 4, 3, WOOD); p.rect(11, 18, 10, 5, b);
  },
  shell: (p, a, b) => {
    p.poly([[16, 26], [4, 14], [8, 8], [16, 6], [24, 8], [28, 14]], a);
    p.line(16, 25, 8, 10, b); p.line(16, 25, 16, 7, b); p.line(16, 25, 24, 10, b);
  },
  blob: (p, a, b) => {
    p.oval(16, 20, 12, 7, a); p.oval(16, 14, 8, 8, a); p.rect(12, 12, 3, 3, b); p.rect(17, 17, 2, 2, b);
  },
  wing: (p, a, b) => {
    p.poly([[3, 10], [10, 6], [16, 12], [22, 6], [29, 10], [26, 22], [20, 18], [16, 26], [12, 18], [6, 22]], a);
    p.line(16, 13, 5, 11, b); p.line(16, 13, 12, 22, b); p.line(16, 13, 20, 22, b); p.line(16, 13, 27, 11, b);
  },
  fang: (p, a, b) => {
    p.poly([[10, 5], [22, 5], [17, 27], [15, 27]], a); p.rect(10, 5, 12, 4, b);
  },
  skull: (p, a, b) => {
    p.oval(16, 13, 10, 9, a); p.rect(11, 19, 10, 7, a); p.rect(10, 12, 4, 5, DARK); p.rect(18, 12, 4, 5, DARK);
    p.rect(15, 17, 2, 2, DARK); p.rect(13, 22, 1, 4, b); p.rect(16, 22, 1, 4, b); p.rect(19, 22, 1, 4, b);
  },
  crown: (p, a, b) => {
    p.poly([[5, 24], [5, 10], [11, 16], [16, 6], [21, 16], [27, 10], [27, 24]], a); p.rect(5, 21, 22, 4, b);
    p.rect(15, 15, 3, 3, b); p.rect(5, 9, 2, 2, b); p.rect(26, 9, 2, 2, b);
  },
  heart: (p, a, b) => {
    p.oval(11, 12, 6, 6, a); p.oval(21, 12, 6, 6, a); p.poly([[5, 14], [27, 14], [16, 27]], a); p.rect(9, 9, 3, 3, b);
  },
  orb: (p, a, b) => {
    p.oval(16, 16, 11, 11, a); p.oval(12, 12, 3, 3, b); p.rect(20, 20, 3, 2, dk(a));
  },
  root: (p, a, b) => {
    p.poly([[6, 10], [26, 10], [18, 27], [14, 27]], a); p.rect(11, 3, 3, 8, b); p.rect(15, 2, 3, 9, b); p.rect(19, 3, 3, 8, b);
  },
  pumpkin: (p, a, b) => {
    p.oval(16, 18, 12, 9, a); for (const x of [10, 16, 22]) p.line(x, 11, x, 26, dk(a)); p.rect(15, 6, 3, 5, b);
  },
  hinge: (p, a, b) => {
    p.rect(5, 10, 22, 12, a); p.rect(8, 14, 3, 3, b); p.rect(21, 14, 3, 3, b); p.rect(14, 8, 4, 16, b);
  },
  tongue: (p, a, b) => {
    p.rect(9, 5, 14, 15, a); p.oval(16, 20, 7, 7, a); p.line(16, 8, 16, 24, b);
  },
  dust: (p, a, b) => {
    p.oval(16, 23, 11, 4, a); p.rect(10, 15, 2, 2, b); p.rect(16, 12, 2, 2, a); p.rect(21, 16, 2, 2, b); p.rect(13, 19, 2, 2, a); p.rect(19, 10, 2, 2, b);
  },
  acorn: (p, a, b) => {
    p.oval(16, 19, 7, 9, a); p.oval(16, 11, 9, 6, b); p.rect(15, 4, 3, 4, b);
  },
  driftwood: (p, a, b) => {
    p.line(5, 24, 26, 8, a, 5); p.line(14, 16, 10, 8, a, 3); p.rect(18, 14, 3, 3, b);
  },
  // ---- gear and clothing ----
  sword: (p, a, b) => {
    p.line(9, 23, 25, 7, a, 4); p.line(6, 15, 15, 24, b, 3); p.line(10, 22, 5, 27, WOOD, 3); p.rect(3, 26, 4, 4, b);
  },
  armor: (p, a, b) => {
    p.poly([[6, 8], [12, 5], [20, 5], [26, 8], [24, 15], [24, 26], [8, 26], [8, 15]], a); p.rect(8, 18, 16, 3, b); p.oval(16, 6, 3, 2, null); p.rect(15, 8, 2, 18, dk(a));
  },
  pickaxe: (p, a, b) => {
    p.line(8, 27, 22, 10, b, 3); p.poly([[4, 12], [12, 5], [22, 4], [29, 10], [25, 11], [20, 8], [13, 9], [8, 15]], a);
  },
  axe: (p, a, b) => {
    p.line(8, 27, 20, 8, b, 3); p.poly([[16, 5], [27, 6], [27, 16], [20, 14], [16, 12]], a);
  },
  rod: (p, a, b) => {
    p.line(5, 27, 26, 6, b, 2); p.line(27, 7, 27, 20, a); p.rect(26, 20, 3, 3, a); p.oval(10, 22, 4, 4, a);
  },
  helmet: (p, a, b) => {
    p.oval(16, 15, 11, 10, a); p.rect(5, 15, 22, 9, a); p.rect(9, 17, 14, 3, DARK); p.rect(15, 3, 3, 6, b);
  },
  shirt: (p, a, b) => {
    p.poly([[4, 10], [11, 5], [14, 7], [18, 7], [21, 5], [28, 10], [25, 15], [22, 13], [22, 27], [10, 27], [10, 13], [7, 15]], a); p.rect(14, 5, 5, 3, b);
  },
  hat: (p, a, b) => {
    p.oval(16, 20, 13, 4, a); p.rect(9, 9, 14, 11, a); p.rect(9, 16, 14, 3, b);
  },
  trousers: (p, a, b) => {
    p.poly([[8, 5], [24, 5], [26, 27], [18, 27], [16, 13], [14, 27], [6, 27]], a); p.rect(8, 5, 16, 3, b);
  },
  skirt: (p, a, b) => {
    p.poly([[10, 5], [22, 5], [28, 26], [4, 26]], a); p.rect(10, 5, 12, 3, b); p.rect(4, 23, 24, 3, b);
  },
  hair: (p, a, b) => {
    p.oval(16, 14, 11, 10, a); p.rect(5, 14, 5, 12, a); p.rect(22, 14, 5, 12, a); p.rect(11, 8, 6, 2, b);
  },
  // ---- furniture silhouettes ----
  chair: (p, a, b) => {
    p.rect(9, 4, 14, 13, a); p.rect(8, 16, 16, 5, b); p.rect(9, 21, 3, 7, a); p.rect(20, 21, 3, 7, a);
  },
  sofa: (p, a, b) => {
    p.rect(3, 8, 26, 10, a); p.rect(5, 16, 22, 8, b); p.rect(3, 12, 5, 14, a); p.rect(24, 12, 5, 14, a);
  },
  table: (p, a, b) => {
    p.rect(3, 9, 26, 7, b); p.rect(3, 16, 26, 3, a); p.rect(5, 19, 3, 9, a); p.rect(24, 19, 3, 9, a);
  },
  lamp: (p, a, b) => {
    p.poly([[10, 5], [22, 5], [26, 16], [6, 16]], a); p.rect(15, 16, 3, 9, b); p.rect(10, 25, 12, 3, b);
  },
  shelf: (p, a, b) => {
    p.rect(4, 4, 24, 24, a); p.rect(4, 12, 24, 3, b); p.rect(4, 21, 24, 3, b); p.rect(7, 7, 3, 5, b); p.rect(13, 8, 3, 4, b); p.rect(19, 16, 4, 5, b);
  },
  bed: (p, a, b) => {
    p.rect(4, 4, 24, 6, a); p.rect(4, 10, 24, 16, b); p.rect(6, 11, 9, 5, CREAM); p.rect(4, 26, 3, 2, a); p.rect(25, 26, 3, 2, a);
  },
  rug: (p, a, b) => {
    p.rect(3, 8, 26, 16, a); p.rect(6, 11, 20, 10, b); p.rect(12, 14, 8, 4, a);
  },
  plant: (p, a, b) => {
    p.poly([[10, 19], [22, 19], [20, 27], [12, 27]], b); p.oval(12, 12, 5, 7, a); p.oval(20, 12, 5, 7, a); p.oval(16, 9, 4, 7, a);
  },
  box: (p, a, b) => {
    p.rect(4, 8, 24, 19, a); p.rect(4, 8, 24, 5, b); p.rect(4, 17, 24, 2, b); p.rect(14, 12, 4, 5, b);
  },
  barrel: (p, a, b) => {
    p.oval(16, 16, 10, 11, a); p.rect(7, 8, 18, 17, a); p.rect(6, 10, 20, 2, b); p.rect(6, 21, 20, 2, b); p.oval(16, 7, 8, 3, b);
  },
  bench: (p, a, b) => {
    p.rect(3, 12, 26, 6, b); p.rect(3, 18, 26, 3, a); p.rect(5, 21, 3, 7, a); p.rect(24, 21, 3, 7, a);
  },
  sign: (p, a, b) => {
    p.rect(4, 6, 24, 13, a); p.rect(15, 19, 3, 9, b); p.rect(8, 10, 16, 2, b); p.rect(8, 14, 12, 2, b);
  },
  banner: (p, a, b) => {
    p.rect(3, 4, 26, 2, b); p.poly([[6, 6], [26, 6], [26, 24], [16, 28], [6, 24]], a); p.rect(14, 11, 5, 8, b);
  },
  torch: (p, a, b) => {
    p.rect(14, 16, 5, 12, b); p.poly([[16, 3], [22, 10], [20, 16], [12, 16], [10, 10]], a); p.rect(14, 10, 4, 5, WHITE);
  },
  throne: (p, a, b) => {
    p.rect(7, 3, 18, 16, a); p.rect(6, 19, 20, 6, b); p.rect(4, 13, 4, 12, a); p.rect(24, 13, 4, 12, a); p.rect(13, 2, 6, 4, b);
  },
  jar: (p, a, b) => {
    p.oval(16, 17, 9, 10, a); p.rect(11, 5, 10, 4, b); p.rect(11, 12, 3, 3, WHITE);
  },
  anchor: (p, a, b) => {
    p.oval(16, 6, 3, 3, a); p.oval(16, 6, 1.5, 1.5, null); p.rect(15, 8, 3, 17, a); p.rect(10, 10, 13, 3, a);
    p.poly([[5, 18], [8, 18], [12, 24], [16, 26], [20, 24], [24, 18], [27, 18], [24, 26], [16, 29], [8, 26]], a); p.rect(15, 9, 1, 8, b);
  },
  net: (p, a, b) => {
    p.rect(4, 5, 24, 20, a); for (let y = 8; y < 24; y += 4) for (let x = 7; x < 27; x += 4) p.rect(x, y, 2, 2, null); p.rect(4, 4, 24, 2, b);
  },
  chandelier: (p, a, b) => {
    p.rect(15, 2, 3, 7, a); p.oval(16, 15, 11, 4, a); for (const x of [6, 15, 24]) { p.rect(x, 8, 3, 6, WHITE); p.rect(x, 5, 3, 3, b); }
  },
  counter: (p, a, b) => {
    p.rect(2, 8, 28, 7, b); p.rect(2, 15, 28, 12, a); p.rect(6, 18, 8, 6, dk(a)); p.rect(18, 18, 8, 6, dk(a));
  },
  stool: (p, a, b) => {
    p.rect(9, 14, 3, 13, a); p.rect(20, 14, 3, 13, a); p.rect(15, 14, 3, 13, a); p.oval(16, 12, 9, 4, b);
  },
  tank: (p, a, b) => {
    p.rect(3, 5, 26, 22, a); p.rect(5, 8, 22, 17, b); p.oval(14, 17, 4, 3, PALETTE[9]); p.poly([[18, 17], [22, 14], [22, 20]], PALETTE[9]);
  },
};

/** Shapes with a shiny surface: they get a small glint near the top-left. */
const GLOSSY = new Set<IconShape>(['gem', 'potion', 'orb', 'ring', 'jar', 'bottle', 'mug', 'bar', 'ore', 'helmet', 'armor', 'sword', 'crown', 'heart', 'key', 'tank', 'lamp', 'pumpkin', 'plate', 'bowl']);

/** The outline on the light side: a very dark version of the colour it borders (a warm, coloured outline). */
function mixDark(c: string): string {
  const n = parseInt(OUTLINE.slice(1), 16);
  const m = parseInt(shade(c, 0.4).slice(1), 16);
  const ch = (sh: number): number => (((n >> sh) & 255) + ((m >> sh) & 255)) >> 1;
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
}

/** Steps (up to 3) toward an empty pixel, counting how deep this pixel sits inside the shape. */
function backRun(at: (x: number, y: number) => string | null, x: number, y: number, dx: number, dy: number): number {
  let n = 0;
  while (n < 3 && at(x + dx * (n + 1), y + dy * (n + 1))) n++;
  return n;
}

/**
 * The pixels of an icon: the shape's flat fills, then light from the top-left (a lighter edge where
 * the pixel above or to the left is empty, a darker one where below or to the right is), then a
 * 1 px dark warm outline. `rank` adds a 1 px frame in the rank colour around the whole square.
 */
export function iconPixels(icon: Icon, rank?: Rank): IconPixels {
  const a = paletteColor(icon.colors[0]!);
  const b = paletteColor(icon.colors[1] ?? icon.colors[0]!);
  const c = paletteColor(icon.colors[2] ?? icon.colors[1] ?? icon.colors[0]!);
  const pen = new Pen();
  DRAW[icon.shape](pen, a, b, c);
  const flat = pen.px;
  const at = (x: number, y: number): string | null => (x < 0 || y < 0 || x >= ICON_SIZE || y >= ICON_SIZE ? null : flat[y * ICON_SIZE + x]!);
  const out: IconPixels = new Array<string | null>(ICON_SIZE * ICON_SIZE).fill(null);
  let glint: [number, number] | null = null;
  for (let y = 0; y < ICON_SIZE && !glint; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (at(x, y) && at(x + 1, y) && at(x + 2, y) && at(x, y + 1) && at(x + 1, y + 1) && at(x, y + 2) && at(x, y + 3)) {
        glint = [x + 1, y + 2];
        break;
      }
    }
  }
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const here = at(x, y);
      if (here) {
        // Distance to the nearest empty pixel above / left (light side) and below / right (dark side).
        const up = backRun(at, x, y, 0, -1);
        const left = backRun(at, x, y, -1, 0);
        const down = backRun(at, x, y, 0, 1);
        const right = backRun(at, x, y, 1, 0);
        const lightD = Math.min(up, left);
        const darkD = Math.min(down, right);
        let f = 1;
        if (darkD === 0) f = 0.7;
        else if (lightD === 0) f = 1.3;
        else if (darkD === 1) f = 0.86;
        else if (lightD === 1) f = 1.12;
        out[y * ICON_SIZE + x] = f === 1 ? here : shade(here, f);
      } else {
        const nb = at(x, y - 1) ?? at(x - 1, y);
        const far = at(x, y + 1) ?? at(x + 1, y);
        if (far) out[y * ICON_SIZE + x] = OUTLINE;
        else if (nb) out[y * ICON_SIZE + x] = mixDark(nb);
      }
    }
  }
  if (glint && GLOSSY.has(icon.shape)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]] as const) {
      const i = (glint[1] + dy) * ICON_SIZE + glint[0] + dx;
      if (out[i]) out[i] = shade(out[i]!, 1.6);
    }
  }
  if (rank) {
    const frame = PALETTE[RANK_COLORS[rank]]!;
    for (let i = 0; i < ICON_SIZE; i++) {
      for (const [x, y] of [[i, 0], [i, ICON_SIZE - 1], [0, i], [ICON_SIZE - 1, i]] as const) out[y * ICON_SIZE + x] = frame;
    }
  }
  return out;
}

/** True if every shape in the shared list has a drawing (tested). */
export function drawnShapes(): IconShape[] {
  return ICON_SHAPES.filter((s) => s in DRAW);
}
