// Order bubbles (step 9t): above a seated guest who waits for an order, a small bubble with the
// item's icon (drawIcon, BG2). Tapping it (or the guest) sends the order to be served. A bubble
// whose order is queued or being carried is dimmed; with little patience left it turns urgent.
// HTML over the canvas, positioned from the head points like the chat bubbles. Rendering only.

import { PALETTE, getDrinkType, isDrinkId, type MaterialId, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';

/** The right-edge button column (icon buttons and their gap): bubbles stay left of it. */
const SIDE_COLUMN_PX = 72;

/** The marker's look: a drink is a dot in its colour, a dish the tiny icon. */
function paint(button: HTMLButtonElement, img: HTMLImageElement, item: MaterialId): void {
  const drink = isDrinkId(item);
  button.classList.toggle('dish', !drink);
  img.hidden = drink;
  if (drink) button.style.setProperty('--dot', PALETTE[getDrinkType(item).color] ?? '#ffffff');
  else img.src = materialIconUrl(item);
}

export interface OrderMark {
  guestId: number;
  item: MaterialId;
  /** Little patience left: the bubble shakes and shows red. */
  urgent: boolean;
  /** The order is in the serve queue or in the player's hands. */
  taken: boolean;
  /** COD-1: a mug for this guest is on the tray: the bubble pulses (tap = carry it over). */
  ready?: boolean;
}

export interface OrderBubbles {
  /** The open orders now (bubbles for guests who left go away). */
  sync(orders: readonly OrderMark[]): void;
  /** Moves the bubbles; heads: the screen point above each guest's head (CSS px). */
  update(heads: ReadonlyMap<number, Point>): void;
  clear(): void;
}

export function createOrderBubbles(parent: HTMLElement, onTap: (guestId: number) => void): OrderBubbles {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  const shown = new Map<number, { button: HTMLButtonElement; img: HTMLImageElement; item: MaterialId }>();
  return {
    sync(orders) {
      const ids = new Set(orders.map((o) => o.guestId));
      for (const [id, s] of shown) {
        if (ids.has(id)) continue;
        s.button.remove();
        shown.delete(id);
      }
      for (const o of orders) {
        let s = shown.get(o.guestId);
        if (!s) {
          const button = el('button', 'order-bubble');
          button.type = 'button';
          button.tabIndex = -1;
          const img = el('img');
          img.alt = '';
          img.draggable = false;
          button.appendChild(img);
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            onTap(o.guestId);
          });
          layer.appendChild(button);
          s = { button, img, item: o.item };
          shown.set(o.guestId, s);
          paint(s.button, s.img, o.item);
        }
        if (s.item !== o.item) {
          s.item = o.item;
          paint(s.button, s.img, o.item);
        }
        s.button.classList.toggle('taken', o.taken);
        s.button.classList.toggle('urgent', o.urgent && !o.taken);
        s.button.classList.toggle('ready', o.ready === true);
        s.button.title = o.ready ? 'Tap the guest to carry the mug over' : o.taken ? 'On its way' : 'Tap the guest to serve';
      }
    },
    update(heads) {
      for (const [id, s] of shown) {
        const head = heads.get(id);
        s.button.hidden = !head;
        if (!head) continue;
        // Fixed CSS size (10 px dot, 14 px dish): no layout read per frame (OWN-4 a).
        const w = s.button.classList.contains('dish') ? 14 : 10;
        const h = w;
        // Beside the head, so the guest's spoken lines (centred above it) stay readable: on the right, or on the left
        // near the right edge (where the button column is).
        const right = head.x + 8;
        const edge = window.innerWidth - SIDE_COLUMN_PX - w;
        const x = Math.max(4, right <= edge ? right : head.x - w - 6);
        s.button.style.transform = `translate(${Math.round(x)}px, ${Math.round(head.y - h - 2)}px)`;
      }
    },
    clear() {
      for (const s of shown.values()) s.button.remove();
      shown.clear();
    },
  };
}
