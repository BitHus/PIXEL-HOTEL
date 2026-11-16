// The CURRENCY icon family (UI currency pass): gold is warm yellow and amber (like the coin in pixelIconsMedieval.ts), gems are
// cool cyan with magenta for the rare cut. 16 x 16 maps, Endesga 32 only, a 1 px dark warm outline, light from the top-left.
// Names: coins (a stack), purse (small leather pouch), purseBig (a full sack), gem (one cut crystal), gems (a cluster).
// The single gold coin is `coin` (pixelIconsMedieval.ts). pixelIconUrl() in pixelIcons.ts turns any of them into a data URL.
import { PALETTE as P } from '@pixel-hotel/shared';

type PixelMap = { rows: string[]; colors: Record<string, string> };

const GOLD = { o: P[6], y: P[11], g: P[10], n: P[9] };
const CYAN = { o: P[6], w: P[19], c: P[18], m: P[17], d: P[16] };

/** Stamps a small template onto a 16 x 16 canvas (later stamps draw on top); `map` renames its letters. */
function stamp(canvas: string[][], tpl: readonly string[], ox: number, oy: number, map: Record<string, string> = {}): void {
  tpl.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') canvas[oy + y]![ox + x] = map[ch] ?? ch;
    });
  });
}

const SMALL_GEM = ['..oooo..', '.owccmo.', 'owccmmdo', 'ocmmmmdo', '.ocmmdo.', '..ocdo..', '...oo...'];
/** Magenta cut: the same shape with the rare colours (p light, q mid, r dark). */
const MAGENTA = { w: 'p', c: 'p', m: 'q', d: 'r' };

function cluster(): string[] {
  const canvas = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));
  stamp(canvas, SMALL_GEM, 0, 7, MAGENTA);
  stamp(canvas, SMALL_GEM, 8, 7);
  stamp(canvas, SMALL_GEM, 4, 2);
  canvas[1]![12] = 'w';
  canvas[0]![12] = 'w';
  canvas[1]![11] = 'w';
  canvas[1]![13] = 'w';
  canvas[2]![12] = 'w';
  return canvas.map((r) => r.join(''));
}

export const CURRENCY_ICONS = {
  coins: {
    rows: [
      '................',
      '................',
      '....oooooooo....',
      '...oyyyyyyyyo...',
      '..oyyggggggyno..',
      '..oyggyyyyggno..',
      '..oyggyyyyggno..',
      '..oyyggggggnno..',
      '...oonnnnnnoo...',
      '..oyyyyyyyyyno..',
      '..ogggggggggno..',
      '..oyyyyyyyyyno..',
      '..ogggggggggno..',
      '...onnnnnnnno...',
      '....oooooooo....',
      '................',
    ],
    colors: GOLD,
  },
  purse: {
    rows: [
      '................',
      '.....oo..oo.....',
      '....obboobbo....',
      '.....obbbbo.....',
      '....oyyyyyyo....',
      '.....obbbbo.....',
      '...oLLbbbbbddo..',
      '..oLLbbbbbbbddo.',
      '.oLLbbbbbbbbbddo',
      '.oLbbbbyybbbbddo',
      '.oLbbbyggybbbddo',
      '.oLbbbbyybbbbddo',
      '.oLbbbbbbbbbbddo',
      '..oLbbbbbbbbddo.',
      '...oodddddddoo..',
      '................',
    ],
    colors: { o: P[6], b: P[4], L: P[3], d: P[5], y: P[11], g: P[10] },
  },
  purseBig: {
    rows: [
      '...y.y.yy.y.....',
      '..oyyyyyyyyyo...',
      '...oggyyyggo....',
      '....obbbbbo.....',
      '...ottttttto....',
      '....obbbbbo.....',
      '..oLLbbbbbbddo..',
      '.oLLbbbbbbbbddo.',
      'oLLbbbbbbbbbbddo',
      'oLbbbbyyyybbbddo',
      'oLbbbyggggybbddo',
      'oLbbbygnngybbddo',
      'oLbbbyggggybbddo',
      '.oLbbbyyyybbddo.',
      '..oLbbbbbbbddo..',
      '...ooddddddoo...',
    ],
    colors: { o: P[6], b: P[4], L: P[3], d: P[5], y: P[11], g: P[10], n: P[9], t: P[10] },
  },
  gem: {
    rows: [
      '................',
      '................',
      '....oooooooo....',
      '...owwcccccmo...',
      '..owwccccccmmo..',
      '.owcccmmmmmmmdo.',
      'ocwcmmmmmmmmmddo',
      'ocmmmmmmmmmmmddo',
      '.ocmmmmmmmmmddo.',
      '..ommmmmmmdddo..',
      '...ommmmmddo....',
      '....ommmdddo....',
      '.....ommddo.....',
      '......omdo......',
      '.......oo.......',
      '................',
    ],
    colors: CYAN,
  },
  gems: {
    rows: cluster(),
    colors: { ...CYAN, p: P[29], q: P[28], r: P[27] },
  },
} satisfies Record<string, PixelMap>;

/** Which gold icon shows an amount: one coin, a stack, a small purse, a full sack. Used by gain popups and the Sell tab totals. */
export function goldIconName(amount: number): 'coin' | 'coins' | 'purse' | 'purseBig' {
  return amount < 10 ? 'coin' : amount < 50 ? 'coins' : amount < 200 ? 'purse' : 'purseBig';
}

/** One gem, or the cluster from five. */
export function gemIconName(amount: number): 'gem' | 'gems' {
  return amount < 5 ? 'gem' : 'gems';
}
