// Shop feedback in the HTML overlay (step 7): the floating "+12 gold" with a coin above the till
// when a customer pays (it rises and fades over SALE_FLOAT_MS), the "while you were away" summary,
// and the first-run hint under the info panel.

import { CUSTOMER_PAY_MS, SALE_FLOAT_MS, typeName, type AwaySummary, type Point } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

interface Float {
  el: HTMLElement;
  world: Point;
  age: number;
}

export interface SaleFloats {
  add(world: Point, gold: number): void;
  clear(): void;
  /** Moves the floats; toScreen maps a world point to CSS px. */
  update(dtMs: number, toScreen: (p: Point) => Point): void;
}

export function createSaleFloats(parent: HTMLElement): SaleFloats {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  let floats: Float[] = [];
  return {
    add(world, gold) {
      const f = el('div', 'sale-float');
      f.append(pixelIcon('coin'), el('span', '', `+${gold} gold`));
      layer.appendChild(f);
      floats.push({ el: f, world, age: 0 });
    },
    clear() {
      for (const f of floats) f.el.remove();
      floats = [];
    },
    update(dtMs, toScreen) {
      for (const f of floats) f.age += dtMs;
      for (const f of floats.filter((x) => x.age >= SALE_FLOAT_MS)) f.el.remove();
      floats = floats.filter((f) => f.age < SALE_FLOAT_MS);
      for (const f of floats) {
        const k = f.age / SALE_FLOAT_MS;
        const s = toScreen(f.world);
        // A quick pop, then it rises 40 px and fades in the second half.
        const scale = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
        f.el.style.transform = `translate(${Math.round(s.x - f.el.offsetWidth / 2)}px, ${Math.round(s.y - f.el.offsetHeight - 40 * k)}px) scale(${scale.toFixed(2)})`;
        f.el.style.opacity = String(k < 0.5 ? 1 : 1 - (k - 0.5) * 2);
      }
    },
  };
}

export interface TillCoins {
  /** The till animation while a customer pays (coins hop out of the till), CUSTOMER_PAY_MS long. */
  add(world: Point): void;
  /**
   * Moves the animations; `waiting` is the till's world point while a customer waits to pay and
   * nobody stands behind the counter (a bobbing coin marker shows there), else null.
   */
  update(dtMs: number, toScreen: (p: Point) => Point, waiting: Point | null): void;
}

export function createTillCoins(parent: HTMLElement): TillCoins {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  const marker = el('div', 'bubble till-marker tail');
  marker.append(pixelIcon('coin'), el('span', '', '!'));
  marker.title = 'A customer is waiting: tap the counter';
  marker.hidden = true;
  layer.appendChild(marker);
  let anims: Float[] = [];
  const place = (e: HTMLElement, s: Point): void => {
    e.style.transform = `translate(${Math.round(s.x - e.offsetWidth / 2)}px, ${Math.round(s.y - e.offsetHeight)}px)`;
  };
  return {
    add(world) {
      const a = el('div', 'till-coins');
      for (let i = 0; i < 3; i++) {
        const c = el('span', `till-coin c${i}`);
        c.appendChild(pixelIcon('coin'));
        a.appendChild(c);
      }
      a.style.setProperty('--pay-ms', `${CUSTOMER_PAY_MS}ms`);
      layer.appendChild(a);
      anims.push({ el: a, world, age: 0 });
    },
    update(dtMs, toScreen, waiting) {
      for (const a of anims) a.age += dtMs;
      for (const a of anims.filter((x) => x.age >= CUSTOMER_PAY_MS)) a.el.remove();
      anims = anims.filter((a) => a.age < CUSTOMER_PAY_MS);
      for (const a of anims) place(a.el, toScreen(a.world));
      marker.hidden = waiting === null;
      if (waiting) {
        const s = toScreen(waiting);
        place(marker, { x: s.x, y: s.y - 4 });
      }
    },
  };
}

/** The "while you were away" summary: a frame in the middle with what sold and the total. */
export function showAwaySummary(parent: HTMLElement, a: AwaySummary): void {
  const box = el('div', 'frame away-panel');
  box.setAttribute('role', 'dialog');
  const hours = Math.floor(a.simulatedMs / 3_600_000);
  const minutes = Math.round((a.simulatedMs % 3_600_000) / 60_000);
  const span = hours > 0 ? `${hours} h ${minutes} min` : `${Math.max(1, minutes)} min`;
  const byType = new Map<string, number[]>();
  for (const s of a.sales) byType.set(s.typeId, [...(byType.get(s.typeId) ?? []), s.price]);
  const list = el('div', 'away-list');
  for (const [typeId, prices] of byType) {
    const sum = prices.reduce((x, y) => x + y, 0);
    const r = el('div', 'away-row');
    r.append(el('span', '', `${prices.length} x ${typeName(typeId)}`), el('span', '', `${prices.join(', ')} = ${sum} gold`));
    list.appendChild(r);
  }
  const total = el('div', 'away-total');
  total.append(pixelIcon('coin'), el('span', '', `Total: ${a.total} gold`));
  const ok = textButton('Nice!', () => box.remove());
  box.append(el('h2', 'panel-title', 'While you were away'), el('div', 'panel-info', `Your shop was open for ${span}. Sold:`), list, total, ok);
  parent.appendChild(box);
  ok.focus();
}

export interface HintBox {
  set(text: string | null): void;
}

/** The first-run hint: one at a time, under the info panel (top-left column). */
export function createHintBox(topLeft: HTMLElement): HintBox {
  const box = el('div', 'frame hint-box');
  box.setAttribute('role', 'status');
  box.hidden = true;
  topLeft.appendChild(box);
  return {
    set(text) {
      box.hidden = text === null;
      box.textContent = text ?? '';
    },
  };
}
