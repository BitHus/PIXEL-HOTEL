// "Are you sure?" before spending gold (after step 8, owner's request): buying in the Catalog
// (furniture, floors and walls) and upgrading a room. A small centered panel in the frame style
// with the thing's picture, its name and the price, and two buttons: Buy and Cancel. A tap
// outside the panel, ✗ or Escape cancels; Enter buys. Only one is open at a time.
// UI polish step: when the player's gold is given and the price is higher, the price is red and
// Buy is greyed out; `more` adds a second buy button (seeds: the pack of 5).

import { el, textButton } from './dom.ts';
import { iconBox, priceTag } from './panelShell.ts';

export interface BuyQuestion {
  /** e.g. "Red carpet". */
  name: string;
  /** e.g. "Floor: unlocked forever, goes on this room now." */
  detail: string;
  /** null = free (no price shown). */
  price: number | null;
  /** A picture (data URL), or none. */
  image?: string;
  /** The panel's title (default: the yes text + " this?"). */
  title?: string;
  /** The text on the yes button (default "Buy"). */
  yes?: string;
  /** More to show under the thing (the dungeon's lunch box picker, step 9b). */
  extra?: HTMLElement;
  /** What the player has: a higher price shows in red and cannot be bought. */
  gold?: number;
  /** A second way to buy (the seed pack): its own button; the answer is then 'more'. */
  more?: { label: string; price: number };
}

let open: ((ok: boolean | 'more') => void) | null = null;

/** Asks; resolves true when the player confirms ('more' for the second button), false otherwise. */
export function confirmBuy(parent: HTMLElement, q: BuyQuestion): Promise<boolean | 'more'> {
  open?.(false);
  return new Promise((resolve) => {
    const shade = el('div', 'confirm-shade');
    const box = el('div', 'frame confirm-panel');
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
    if (q.image) what.appendChild(iconBox(q.image, 'confirm-icon'));
    const info = el('div', 'confirm-info');
    const price = q.price === null ? el('div', 'catalog-price', 'Free') : priceTag(q.price, q.gold);
    info.append(el('div', 'catalog-name', q.name), el('div', 'catalog-sub', q.detail), price);
    if (short(q.price)) info.append(el('div', 'confirm-short price-short', 'Not enough gold.'));
    what.appendChild(info);

    const yes = textButton(q.price === null ? (q.yes ?? 'Buy') : `${q.yes ?? 'Buy'} for ${q.price}`, () => finish(true));
    yes.classList.add('confirm-yes');
    yes.disabled = short(q.price);
    const no = textButton('Cancel', () => finish(false));
    const buttons = el('div', 'confirm-buttons');
    buttons.append(no, yes);
    if (q.more) {
      const more = textButton(`${q.more.label} for ${q.more.price}`, () => finish('more'));
      more.classList.add('confirm-yes');
      more.disabled = short(q.more.price);
      buttons.append(more);
    }

    box.append(close, el('h2', 'panel-title plate', q.title ?? `${q.yes ?? 'Buy'} this?`), what, ...(q.extra ? [q.extra] : []), buttons);
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
