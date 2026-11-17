// The ORDERS STRIP (COD-1, owner playtest 2): at the top of the screen one chip per open order (drink or dish icon, a patience bar,
// a state: waiting, queued, ready). Tap a chip = the same as tapping that guest: the avatar goes to pour it, or carries the ready mug
// there. A small tray counter shows the mugs on the waiter's tray with a button to put them back in the bag.
// The data comes from the pure rule shared/src/tray.ts ordersStrip(); this file only draws it (minimal, the UI worker styles it).

import { TRAY_MAX, type MaterialId, type OrderChip } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import './ordersStrip.css';

export interface OrdersStrip {
  /** Draws these chips and the tray; an empty list with an empty tray hides the strip. */
  sync(chips: readonly OrderChip[], tray: readonly MaterialId[]): void;
  /** Hides the strip (not in the tavern). */
  hide(): void;
}

export function createOrdersStrip(parent: HTMLElement, h: { onChip: (guestId: number) => void; onPutBack: () => void }): OrdersStrip {
  const root = el('div', 'orders-strip');
  root.hidden = true;
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Open orders');
  parent.appendChild(root);
  // The top stack (UI-CAT): the strip is the top band; the first-steps card and the quest card start below it (skin.css reads --orders-h).
  const setH = (): void => parent.style.setProperty('--orders-h', root.hidden ? '0px' : `${root.offsetHeight + 6}px`);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(setH).observe(root);
  const chipsEl = el('div', 'orders-chips');
  const trayEl = el('div', 'orders-tray');
  const trayIcons = el('span', 'orders-tray-icons');
  const putBack = el('button', 'orders-putback', 'Put back');
  putBack.type = 'button';
  putBack.title = 'Put the mugs on the tray back in the bag';
  putBack.addEventListener('click', (e) => {
    e.stopPropagation();
    h.onPutBack();
  });
  // OA-11: the tray is a small pill of icons (no title); 'Put back' is a small button inside it.
  trayEl.append(trayIcons, putBack);
  const moreEl = el('span', 'orders-more');
  moreEl.hidden = true;
  root.append(chipsEl, moreEl, trayEl);
  const CHIP_CAP: Record<string, number> = { phone: 3, tablet: 5, desktop: 7 };
  const shown = new Map<number, { button: HTMLButtonElement; img: HTMLImageElement; bar: HTMLElement; item: MaterialId }>();
  let trayKey = '';
  return {
    sync(allChips, tray) {
      root.hidden = allChips.length === 0 && tray.length === 0;
      setH();
      // OA-11: the chips that fit (the least patient first); the rest is a +N badge.
      const cap = CHIP_CAP[document.documentElement.dataset.size ?? 'desktop'] ?? 7;
      const hidden = Math.max(0, allChips.length - cap);
      moreEl.hidden = hidden === 0;
      moreEl.textContent = `+${hidden}`;
      moreEl.title = `${hidden} more open orders`;
      const chips = allChips.slice(0, cap);
      const ids = new Set(chips.map((c) => c.guestId));
      for (const [id, s] of shown) {
        if (ids.has(id)) continue;
        s.button.remove();
        shown.delete(id);
      }
      chips.forEach((c, index) => {
        let s = shown.get(c.guestId);
        if (!s) {
          const button = el('button', 'orders-chip');
          button.type = 'button';
          button.setAttribute('role', 'listitem');
          const img = el('img');
          img.alt = '';
          img.draggable = false;
          const track = el('span', 'orders-patience');
          const bar = el('span', 'orders-patience-fill');
          track.appendChild(bar);
          button.append(img, track);
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            h.onChip(c.guestId);
          });
          s = { button, img, bar, item: c.item };
          img.src = materialIconUrl(c.item);
          shown.set(c.guestId, s);
        }
        if (s.item !== c.item) {
          s.item = c.item;
          s.img.src = materialIconUrl(c.item);
        }
        // Keep the DOM in chip order (least patience first) without rebuilding the buttons.
        if (chipsEl.children[index] !== s.button) chipsEl.insertBefore(s.button, chipsEl.children[index] ?? null);
        s.button.dataset.state = c.state;
        s.button.classList.toggle('urgent', c.urgent);
        s.bar.style.width = `${Math.round(c.patience * 100)}%`;
        s.button.title = c.state === 'ready' ? 'A mug is ready: tap to carry it over' : c.state === 'queued' ? 'Being poured' : 'Tap to pour this order';
      });
      const key = tray.join(',');
      if (key !== trayKey) {
        trayKey = key;
        trayIcons.replaceChildren();
        for (const item of tray) {
          const img = el('img');
          img.alt = '';
          img.draggable = false;
          img.src = materialIconUrl(item);
          trayIcons.appendChild(img);
        }
      }
      trayEl.hidden = tray.length === 0;
      trayEl.dataset.count = `${tray.length}/${TRAY_MAX}`;
    },
    hide() {
      root.hidden = true;
      setH();
    },
  };
}
