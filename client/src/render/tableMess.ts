// What guests leave on the tavern's table spots (step 9t): a small pile of coins and the empty mug
// or plate. They are drawn right after the table they lie on (depth order, brief section 7), on the
// table top like the goods. The player taps them to take the coins or clear the dish: `at` finds
// what lies under a tap. Rendering only; the rules (and what lies where) are shared/src/tavern.ts.

import { Container, Sprite } from 'pixi.js';
import { COIN_ICON, GEM_ICON, footprintRect, getFurnitureType, getMaterialType, isTable, materialGroup, type FurnitureItem, type Icon, type MaterialId, type Mess, type Point } from '@pixel-hotel/shared';
import { itemDepthKey } from './depthOrder.ts';
import { iconSpriteFor, iconTexture } from './drawIcon.ts';
import { surfaceHeight } from './furnitureArt.ts';
import type { RoomView } from './roomView.ts';

/** Coins and dishes are drawn in squares this wide, px. */
const COIN_PX = 12;
const DISH_PX = 14;
/** A tap within this many px of a drawn thing hits it. */
const HIT_PX = 14;

/** The empty mug or plate (the full item's own icon would look full). */
export function emptyDishIcon(id: MaterialId): Icon {
  return materialGroup(id) === 'drink' ? { shape: 'mug', colors: ['clay', 'sand'] } : { shape: 'plate', colors: ['cream', 'sand'] };
}

/** OA-2: coins a guest leaves drop onto the table over this many ms (a short hop in whole px), they never fly across the room. */
export const LAND_MS = 240;
const LAND_FROM_PX = 14;

/** How many px above its place a landing pile is, `ageMs` after it appeared: a fall, a small bounce, then 0. Whole px, pure. */
export function landOffsetPx(ageMs: number): number {
  if (ageMs <= 0) return LAND_FROM_PX;
  if (ageMs >= LAND_MS) return 0;
  const k = ageMs / LAND_MS;
  if (k < 0.6) return Math.round(LAND_FROM_PX * (1 - (k / 0.6) ** 2));
  return Math.round(3 * Math.sin(((k - 0.6) / 0.4) * Math.PI));
}

/** A drink or dish being eaten at a table spot (not a Mess yet): drawn full, not tappable. */
export interface Meal {
  guestId: number;
  item: MaterialId;
  spot: Point;
}

interface Entry {
  key: string;
  /** Depth tie-break among things on one table. */
  uid: number;
  /** The Mess id, or null for a meal. */
  messId: number | null;
  spot: Point;
  coins: number;
  /** Gems a happy guest tipped (drawn next to the coins, taken with them). */
  gems: number;
  dish: MaterialId | null;
  full: boolean;
}

interface Shown {
  container: Container;
  messId: number | null;
  key: string;
  /** Where the coins and the dish are drawn (world px), for taps. */
  coinsAt: Point | null;
  dishAt: Point | null;
  /** Where steam rises (a full dish or drink being eaten), or null. */
  steamAt: { x: number; y: number; hot: boolean } | null;
  /** Ms since a fresh pile of coins appeared (it hops onto the table), or null when it rests. */
  landAge: number | null;
  baseY: number;
}

export class TableMess {
  private readonly shown = new Map<string, Shown>();
  /** False until the first sync: what lies on the tables when a room opens just rests, only new piles hop. */
  private primed = false;

  constructor(private readonly view: RoomView) {}

  /** Shows these table spots: what guests left, and what is being eaten now (call when either or the items change). */
  sync(list: readonly Mess[], meals: readonly Meal[], items: readonly FurnitureItem[]): void {
    const entries: Entry[] = [
      ...list.map((m): Entry => ({ key: `m${m.id}`, uid: 1_000_000 + m.id, messId: m.id, spot: { x: m.x, y: m.y }, coins: m.coins, gems: m.gems ?? 0, dish: m.dish, full: false })),
      ...meals.map((e): Entry => ({ key: `e${e.guestId}`, uid: 2_000_000 + Math.abs(e.guestId), messId: null, spot: e.spot, coins: 0, gems: 0, dish: e.item, full: true })),
    ];
    const ids = new Set(entries.map((e) => e.key));
    for (const [id, s] of this.shown) {
      if (ids.has(id)) continue;
      this.view.objects.remove(s.container);
      s.container.destroy({ children: true });
      this.shown.delete(id);
    }
    for (const m of entries) {
      const mx = m.spot.x;
      const my = m.spot.y;
      const table = items.find((i) => {
        if (i.onItemUid !== null || !isTable(getFurnitureType(i.typeId))) return false;
        const r = footprintRect(i, getFurnitureType(i.typeId));
        return mx >= r.x - 1 && mx <= r.x + r.w + 1 && my >= r.y - 1 && my <= r.y + r.h + 1;
      });
      const top = table ? surfaceHeight(getFurnitureType(table.typeId)) : 0;
      const key = `${mx},${my},${top},${m.coins > 0 ? coinPile(m.coins) : 0},${m.gems},${m.dish ?? ''},${table?.uid ?? 0},${m.full}`;
      let s = this.shown.get(m.key);
      if (s?.key === key) continue;
      if (s) {
        this.view.objects.remove(s.container);
        s.container.destroy({ children: true });
      }
      const container = new Container({ eventMode: 'none' });
      container.position.set(mx, my - top);
      const both = m.coins > 0 && m.dish !== null;
      let coinsAt: Point | null = null;
      let dishAt: Point | null = null;
      if (m.coins > 0) {
        const x = both ? -6 : 0;
        for (let k = 0; k < coinPile(m.coins); k++) {
          const c = new Sprite(iconTexture(COIN_ICON, undefined, COIN_PX));
          c.position.set(x - COIN_PX / 2 + (k % 2) * 3, -COIN_PX - k * 3);
          container.addChild(c);
        }
        coinsAt = { x: mx + x, y: my - top - COIN_PX / 2 };
        if (m.gems > 0) {
          // The tipped gem lies beside the coins and is taken with them (one tap).
          const g = new Sprite(iconTexture(GEM_ICON, undefined, COIN_PX));
          g.position.set(x + COIN_PX / 2 + 1, -COIN_PX);
          container.addChild(g);
        }
      }
      if (m.dish !== null) {
        const x = both ? 6 : 0;
        const d = m.full ? iconSpriteFor(m.dish, getMaterialType(m.dish).icon, undefined, DISH_PX) : new Sprite(iconTexture(emptyDishIcon(m.dish), undefined, DISH_PX));
        d.position.set(x - DISH_PX / 2, -DISH_PX);
        container.addChild(d);
        dishAt = { x: mx + x, y: my - top - DISH_PX / 2 };
      }
      const probe = { ...(table ?? { typeId: '', ownerId: 0, roomId: 0, facing: 'down' as const, onItemUid: null }), uid: m.uid, x: mx, y: my } as FurnitureItem;
      this.view.objects.add(container, table ? itemDepthKey(probe, table) : { y: my, x: mx, uid: probe.uid });
      const steamAt = m.full && m.dish !== null && dishAt ? { x: dishAt.x, y: dishAt.y - DISH_PX / 2, hot: materialGroup(m.dish) !== 'drink' } : null;
      const fresh = this.primed && !s && m.coins > 0 && m.messId !== null;
      s = { container, key, coinsAt, dishAt, steamAt, messId: m.messId, landAge: fresh ? 0 : null, baseY: container.y };
      if (fresh) container.y = s.baseY - landOffsetPx(0);
      this.shown.set(m.key, s);
    }
    this.primed = true;
  }

  /** Runs the hop of new coin piles (call every frame). */
  update(dtMs: number): void {
    for (const s of this.shown.values()) {
      if (s.landAge === null) continue;
      s.landAge += dtMs;
      s.container.y = s.baseY - landOffsetPx(s.landAge);
      if (s.landAge >= LAND_MS) s.landAge = null;
    }
  }

  /** The spots where a full dish or drink stands (steam rises from them). */
  steamSpots(): { x: number; y: number; hot: boolean }[] {
    const out: { x: number; y: number; hot: boolean }[] = [];
    for (const s of this.shown.values()) if (s.steamAt) out.push(s.steamAt);
    return out;
  }

  /** What lies under a tap (world px): the nearest coins or dish within HIT_PX, or null. */
  at(world: Point): { messId: number; what: 'coins' | 'dish' } | null {
    let best: { messId: number; what: 'coins' | 'dish' } | null = null;
    let bestD = HIT_PX;
    for (const s of this.shown.values()) {
      if (s.messId === null) continue;
      for (const [what, p] of [['coins', s.coinsAt], ['dish', s.dishAt]] as const) {
        if (!p) continue;
        const d = Math.hypot(world.x - p.x, world.y - p.y);
        if (d <= bestD) {
          bestD = d;
          best = { messId: s.messId, what };
        }
      }
    }
    return best;
  }

  clear(): void {
    this.primed = false;
    for (const s of this.shown.values()) {
      this.view.objects.remove(s.container);
      s.container.destroy({ children: true });
    }
    this.shown.clear();
  }
}

/** How many coins the pile shows: 1 up to 9 gold, 2 up to 24, else 3. */
export function coinPile(coins: number): number {
  return coins <= 9 ? 1 : coins <= 24 ? 2 : 3;
}
