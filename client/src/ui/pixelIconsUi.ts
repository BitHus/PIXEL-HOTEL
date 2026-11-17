// UI-2 icons (docs/OWNER-PLAYTEST-2.md): the ones that did not match their meaning, redrawn on 16 x 16 in Endesga 32.
// worlds  = a small globe on a stand (the Worlds panel; replaces the unclear folded map)
// catalog = a wooden price tag with a coin (the Catalog was a red book, the same as the Book)
// build   = a brick wall with a gold plus (build mode; a hammer is the Workshop's)
// bricks  = a brick wall (the Blocks tab)
// more    = three dots on a plank (it was three gold lumps)
// Same map format as pixelIconsMedieval.ts; pixelIcons.ts merges this file last, so these names win.
import { PALETTE as P } from '@pixel-hotel/shared';
import type { PixelMap } from './pixelIconsMedieval.ts';

const BRICKS_ROWS = [
  '................',
  '................',
  '................',
  '.oooooooooooooo.',
  '.oKKKKKKKKKKKKo.',
  '.okkkkmkkkkmkko.',
  '.ommmmmmmmmmmmo.',
  '.oKKKKKKKKKKKKo.',
  '.okkkkkkmkkkkmo.',
  '.ommmmmmmmmmmmo.',
  '.oKKKKKKKKKKKKo.',
  '.okkkkmkkkkmkko.',
  '.oDDDDDDDDDDDDo.',
  '.oooooooooooooo.',
  '................',
  '................',
];

/** The globe: a round ocean (light top-left, shade bottom-right), two continents, a wooden stand. Rows are centred by width. */
function globeRows(): string[] {
  const inner = ['hbbb', 'hbGGbbbb', 'hGGggbbbGb', 'bGgggbbGGg', 'bbGgbbbGggbB', 'bbbbbbGggggB', 'bbbGGbbGgggB', 'bbGgggbbGFFB', 'bbGgbbbbBB', 'bbbbbbBBBB', 'bbbbBBBB', 'bbBB'];
  const pad = (row: string): string => '.'.repeat((16 - row.length) / 2) + row + '.'.repeat((16 - row.length) / 2);
  return ['......oooo......', ...inner.map((r) => pad('o' + r + 'o')), '......oWWo......', '...oWWWWWWWWo...', '.....oooooo.....'];
}

const GLOBE: PixelMap = {
  rows: globeRows(),
  colors: { o: P[6], b: P[17], B: P[16], h: P[18], g: P[13], G: P[12], F: P[14], W: P[4] },
};

export const UI_ICONS = {
  worlds: GLOBE,
  catalog: {
    rows: [
      '.......oc.......',
      '.......oc.......',
      '.......oc.......',
      '.oooooooooooooo.',
      '.oHHHHHHHHHHHWo.',
      '.oHWWWWooWWWWWo.',
      '.oHWWWWooWWWWWo.',
      '.oHWWWWWWWWWWWo.',
      '.oHWWWooooWWWWo.',
      '.oHWWoyggggoWWo.',
      '.oHWWoygnnnoWWo.',
      '.oHWWogggnnoWWo.',
      '.oHWWognnnnoWWo.',
      '.oHWWWooooWWWWo.',
      '.oDDDDDDDDDDDDo.',
      '..oooooooooooo..',
    ],
    colors: { o: P[6], W: P[4], H: P[3], D: P[5], c: P[2], g: P[10], y: P[11], n: P[9] },
  },
  build: {
    rows: [
      '.........ooooooo',
      '.........oyyuyyo',
      '.........oyyuyyo',
      '.oooooooooouwuuo',
      '.oKKKKKKKoyyuyyo',
      '.okkkkmkkoyyuyyo',
      '.ommmmmmmooooooo',
      '.oKKKKKKKKKKKKo.',
      '.okkkkkkmkkkkmo.',
      '.ommmmmmmmmmmmo.',
      '.oKKKKKKKKKKKKo.',
      '.okkkkmkkkkmkko.',
      '.oDDDDDDDDDDDDo.',
      '.oooooooooooooo.',
      '................',
      '................',
    ],
    colors: { o: P[6], k: P[0], K: P[1], m: P[2], D: P[7], y: P[10], u: P[6], w: P[11] },
  },
  bricks: {
    rows: BRICKS_ROWS,
    colors: { o: P[6], k: P[0], K: P[1], m: P[2], D: P[7] },
  },
  // help = a round tan badge with a dark question mark (the folded help in the Stove, Brewing and Taps panels)
  help: {
    rows: [
      '.....oooooo.....',
      '...oooHHHHHooo..',
      '..oHHHWWWWWWWDo.',
      '.oHWWWWWWWWWWWDo',
      '.oHWWWooooWWWDo.',
      '.oHWWooWWooWWDo.',
      '.oHWWWWWWooWWDo.',
      '.oHWWWWWooWWWDo.',
      '.oHWWWWooWWWWDo.',
      '.oHWWWWWWWWWWDo.',
      '.oHWWWWWWWWWWDo.',
      '.oHWWWWooWWWWDo.',
      '.oHWWWWooWWWWDo.',
      '.oDWWWWWWWWWDDo.',
      '..oDDDDDDDDDDo..',
      '....oooooooo....',
    ],
    colors: { o: P[6], W: P[4], H: P[3], D: P[5] },
  },
  more: {
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      'oooooooooooooooo',
      'oHHHHHHHHHHHHHHo',
      'oWWccWWccWWccWWo',
      'oWWcyWWcyWWcyWWo',
      'oWWWWWWWWWWWWWWo',
      'oDDDDDDDDDDDDDDo',
      'oooooooooooooooo',
      '................',
      '................',
      '................',
      '................',
    ],
    colors: { o: P[6], W: P[4], H: P[3], D: P[5], c: P[2], y: P[10] },
  },
} satisfies Record<string, PixelMap>;
