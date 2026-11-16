// SA1: 12 x 12 category badges for seeds and splice results (block, crop, drink, ore, furniture, clothing, style), drawn in code from
// pixel rows (Endesga 32, 1 px dark outline, no anti-aliasing). categoryBadge(cat) returns a <span class="cat-badge cat-<cat>"> with the
// picture as a data URL background (nearest-neighbour via image-rendering in skin.css); categoryBadgeUrl(cat) is the bare URL.
import { PALETTE } from '@pixel-hotel/shared';

export const BADGE_CATEGORIES = ['block', 'crop', 'drink', 'ore', 'furniture', 'clothing', 'style'] as const;
export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];
export const BADGE_LABELS: Record<BadgeCategory, string> = { block: 'Block', crop: 'Crop', drink: 'Drink', ore: 'Ore', furniture: 'Furniture', clothing: 'Clothes', style: 'Style' };

const COLORS: Record<string, string> = {
  o: PALETTE[25]!, w: PALETTE[19]!, s: PALETTE[20]!, g: PALETTE[12]!, G: PALETTE[13]!, r: PALETTE[8]!, y: PALETTE[10]!, b: PALETTE[4]!, B: PALETTE[5]!,
  c: PALETTE[18]!, n: PALETTE[17]!, p: PALETTE[28]!, e: PALETTE[22]!, t: PALETTE[3]!, d: PALETTE[9]!,
};

export const BADGE_ROWS: Record<BadgeCategory, string[]> = {
  block: ['............', '..oooooooo..', '.owwwwwtto..', '.owtttttBo..', '.otttbbbBBo.', '.otttbbbbBo.', '.obbbbbbbBo.', '.obbbbbbBBo.', '.oBBBBBBBBo.', '..oooooooo..', '............', '............'],
  crop: ['............', '.....oo.....', '....ogGo....', '...ogGGGo...', '....oGGo....', '...oddddo...', '..oddydddo..', '..odddddDo..', '..oddddddo..', '...oddddo...', '....oooo....', '............'],
  drink: ['............', '.owwwwwwo...', '.oyyyyyyoo..', '.oyyyyyyo.o.', '.oyyyyyyo.o.', '.oyyyyyyoo..', '.oyyyyyyo...', '.oBBBBBBo...', '.oBBBBBBo...', '..oooooo....', '............', '............'],
  ore: ['............', '....oooo....', '...oswwso...', '..oswccsso..', '.osswcsssso.', '.osceesccso.', '.oseesseeso.', '.osseeesseo.', '..oeeeeeeo..', '...oooooo...', '............', '............'],
  furniture: ['............', '..oooooooo..', '..obbbbbBo..', '..obbbbbBo..', '.ooooooooBo.', '.obbbbbbbBo.', '.oBBBBBBBBo.', '.ob.oooo.Bo.', '.oB.o..o.Bo.', '.oo.o..o.oo.', '............', '............'],
  clothing: ['............', '.oo......oo.', '.orooooooro.', '.orrrrrrrro.', '..orrrrrro..', '..orrrrrro..', '..orrrrrro..', '..orrrrrro..', '..orrrrrro..', '..oooooooo..', '............', '............'],
  style: ['............', '...oooooo...', '..oyyyyyyo..', '.oyppppppyo.', '.oypccccpyo.', '.oypcddcpyo.', '.oypcddcpyo.', '.oypccccpyo.', '.oyppppppyo.', '..oyyyyyyo..', '...oooooo...', '............'],
};

const urls = new Map<BadgeCategory, string>();

/** The badge as a data URL (12 x 12 PNG), or '' where there is no canvas (tests). */
export function categoryBadgeUrl(cat: BadgeCategory): string {
  const hit = urls.get(cat);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const cv = document.createElement('canvas');
    cv.width = 12;
    cv.height = 12;
    const ctx = cv.getContext('2d');
    if (ctx) {
      BADGE_ROWS[cat].forEach((row, y) => {
        for (let x = 0; x < 12; x++) {
          const col = COLORS[row[x] ?? '.'];
          if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
        }
      });
      url = cv.toDataURL('image/png');
    }
  } catch { /* no canvas */ }
  urls.set(cat, url);
  return url;
}

export function categoryBadge(cat: BadgeCategory): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = `cat-badge cat-${cat}`;
  el.title = BADGE_LABELS[cat];
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', BADGE_LABELS[cat]);
  const u = categoryBadgeUrl(cat);
  if (u) el.style.backgroundImage = `url(${u})`;
  return el;
}
