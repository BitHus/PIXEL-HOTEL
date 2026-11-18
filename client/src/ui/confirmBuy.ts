// "Are you sure?" before spending gold (after step 8, owner's request): buying in the Catalog
// (furniture, floors and walls) and upgrading a room. A small centered panel in the frame style
// with the thing's picture, its name and the price, and two buttons: Buy and Cancel. A tap
// outside the panel, ✗ or Escape cancels; Enter buys. Only one is open at a time.
// UI polish step: when the player's gold is given and the price is higher, the price is red and
// Buy is greyed out; `more` adds a second buy button (seeds: the pack of 5).

import { el, textButton } from './dom.ts';
import { iconBox, priceTag, gemImg } from './panelShell.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface BuyQuestion {
  /** e.g. "Red carpet". */
  name: string;
  /** e.g. "Floor: unlocked forever, goes on this room now." */
  detail: string;
  /** null = free (no price shown). */
  price: number | null;
  /** Hide the "Free" tag when price is null (a warning, not a purchase). */
  noPrice?: boolean;
  /** A picture (data URL), or none. */
  image?: string;
  /** The panel's title (default: the yes text + " this?"). */
  title?: string;
  /** The text on the yes button (default "Buy"). */
  yes?: string;
  /** More to show under the thing (the dungeon's lunch box picker, step 9b). */
  extra?: HTMLElement;
  /** What the player has (gold, or gems when `currency` is 'gems'): a higher price shows in red and cannot be bought. */
  gold?: number;
  /** What the price is paid in (default gold; packs cost gems, step BG8). */
  currency?: 'gold' | 'gems';
  /** A second way to buy (the seed pack): its own button; the answer is then 'more'. */
  more?: { label: string; price: number };
}

let open: ((ok: boolean | 'more') => void) | null = null;

/** Asks; resolves true when the player confirms ('more' for the second button), false otherwise. */
export function confirmBuy(parent: HTMLElement, q: BuyQuestion): Promise<boolean | 'more'> {
  open?.(false);
  return new Promise((resolve) => {
    const shade = el('div', 'confirm-shade');
    const box = el('div', 'frame ui-panel confirm-panel');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const finish = (ok: boolean | 'more'): void => {
      if (open !== finish) return;
      open = null;
      window.removeEventListener('keydown', onKey, true);
      shade.remove();
      resolve(ok);
    };
    const short = (price: number | null): boolean => price !== null && q.gold !== undefined && q.gold < price;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      // Ours only: no panel closing, no chat opening behind the question.
      e.preventDefault();
      e.stopImmediatePropagation();
      finish(e.key === 'Enter' && !short(q.price));
    };

    const close = el('button', 'btn panel-close', '✗');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cancel');
    close.addEventListener('click', () => finish(false));

    const what = el('div', 'confirm-what inset');
    box.classList.toggle('confirm-gems', q.currency === 'gems');
    if (q.image) what.appendChild(iconBox(q.image, 'confirm-icon'));
    const info = el('div', 'confirm-info');
    const price = q.price === null ? el('div', 'catalog-price', 'Free') : priceTag(q.price, q.gold, q.currency);
    price.classList.add('hang-tag');
    info.append(el('div', 'catalog-name', q.name), el('div', 'catalog-sub', q.detail));
    if (!q.noPrice) info.append(price);
    if (short(q.price)) info.append(el('div', 'confirm-short price-short', `Not enough ${q.currency ?? 'gold'}.`));
    what.appendChild(info);

    // The shop slip: your purse, the price, a dashed rule and what is left (only when we know what the player has).
    const slip = el('div', 'slip');
    if (q.price !== null && q.gold !== undefined) {
      const line = (label: string, n: number, cls = ''): HTMLElement => {
        const r = el('div', `slip-row ${cls}`.trim());
        const amount = el('span', 'slip-amount');
        amount.append(q.currency === 'gems' ? gemImg() : pixelIcon('coin'), el('span', '', String(n)));
        r.append(el('span', 'slip-label', label), el('span', 'slip-dots'), amount);
        return r;
      };
      slip.append(line('Your purse', q.gold), line('Price', q.price), el('div', 'slip-rule'), line('Left', Math.max(0, q.gold - q.price), short(q.price) ? 'price-short' : 'slip-total'));
    }

    const yes = textButton(q.price === null ? (q.yes ?? 'Buy') : `${q.yes ?? 'Buy'} for ${q.price}`, () => finish(true));
    yes.classList.add('confirm-yes', 'primary');
    yes.disabled = short(q.price);
    const no = textButton('Cancel', () => finish(false));
    no.classList.add('quiet');
    const buttons = el('div', 'confirm-buttons');
    buttons.append(no, yes);
    if (q.more) {
      const more = textButton(`${q.more.label} for ${q.more.price}`, () => finish('more'));
      more.classList.add('confirm-yes', 'primary');
      more.disabled = short(q.more.price);
      buttons.append(more);
    }

    box.append(close, el('h2', 'panel-title plate', q.title ?? `${q.yes ?? 'Buy'} this?`), what, ...(slip.childElementCount > 0 ? [slip] : []), ...(q.extra ? [q.extra] : []), buttons);
    shade.appendChild(box);
    // A tap on the dark area around the panel cancels.
    shade.addEventListener('pointerdown', (e) => {
      if (e.target === shade) finish(false);
    });
    parent.appendChild(shade);
    open = finish;
    window.addEventListener('keydown', onKey, true);
    yes.focus();
  });
}
