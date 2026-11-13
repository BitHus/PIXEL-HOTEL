// "Are you sure?" before spending gold (after step 8, owner's request): buying in the Catalog
// (furniture, floors and walls) and upgrading a room. A small centered panel in the frame style
// with the thing's picture, its name and the price, and two buttons: Buy and Cancel. A tap
// outside the panel, ✗ or Escape cancels; Enter buys. Only one is open at a time.

import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface BuyQuestion {
  /** e.g. "Red carpet". */
  name: string;
  /** e.g. "Floor: unlocked forever, goes on this room now." */
  detail: string;
  price: number;
  /** A picture (data URL), or none. */
  image?: string;
  /** The text on the yes button (default "Buy"). */
  yes?: string;
}

let open: ((ok: boolean) => void) | null = null;

/** Asks; resolves true when the player confirms. */
export function confirmBuy(parent: HTMLElement, q: BuyQuestion): Promise<boolean> {
  open?.(false);
  return new Promise((resolve) => {
    const shade = el('div', 'confirm-shade');
    const box = el('div', 'frame confirm-panel');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const finish = (ok: boolean): void => {
      if (open !== finish) return;
      open = null;
      window.removeEventListener('keydown', onKey, true);
      shade.remove();
      resolve(ok);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      // Ours only: no panel closing, no chat opening behind the question.
      e.preventDefault();
      e.stopImmediatePropagation();
      finish(e.key === 'Enter');
    };

    const close = el('button', 'btn panel-close', '✗');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cancel');
    close.addEventListener('click', () => finish(false));

    const what = el('div', 'confirm-what');
    if (q.image) {
      const slot = el('div', 'slot');
      const img = el('img', 'slot-icon');
      img.src = q.image;
      img.alt = '';
      slot.appendChild(img);
      what.appendChild(slot);
    }
    const info = el('div', 'confirm-info');
    const price = el('div', 'catalog-price');
    price.append(pixelIcon('coin'), el('span', '', String(q.price)));
    info.append(el('div', 'catalog-name', q.name), el('div', 'catalog-sub', q.detail), price);
    what.appendChild(info);

    const yes = textButton(`${q.yes ?? 'Buy'} for ${q.price}`, () => finish(true));
    yes.classList.add('confirm-yes');
    const no = textButton('Cancel', () => finish(false));
    const buttons = el('div', 'confirm-buttons');
    buttons.append(no, yes);

    box.append(close, el('h2', 'panel-title', `${q.yes ?? 'Buy'} this?`), what, buttons);
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
