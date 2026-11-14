// Items hopping in an arc (step 9d, client only): from a slot into a customer's hands, from the
// hands onto the counter and back. Each hop takes ITEM_HOP_MS; the target can move (a function).
// A hop with `stay` stays where it landed until it is removed (the item on the counter while the
// customer pays).

import { Container } from 'pixi.js';
import { ITEM_HOP_MS, type LootRef, type Point } from '@pixel-hotel/shared';
import { drawGood } from './slotGoods.ts';

/** How high the arc goes above the straight line, px. */
const ARC_PX = 14;

interface Hop {
  key: number;
  loot: LootRef;
  g: Container;
  from: Point;
  to: () => Point | null;
  age: number;
  stay: boolean;
  done?: () => void;
}

/** The point on the arc at k (0..1), whole px. */
export function hopPoint(from: Point, to: Point, k: number): Point {
  const t = Math.min(1, Math.max(0, k));
  return { x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t - ARC_PX * 4 * t * (1 - t)) };
}

export class ItemHops {
  private hops: Hop[] = [];

  constructor(private readonly layer: Container) {}

  /** Starts a hop for `key` (a customer id; an older hop with the same key is removed). */
  add(key: number, loot: LootRef, from: Point, to: () => Point | null, opts: { stay?: boolean; done?: () => void } = {}): void {
    this.remove(key);
    const g = drawGood(loot);
    g.position.set(Math.round(from.x), Math.round(from.y));
    this.layer.addChild(g);
    this.hops.push({ key, loot, g, from, to, age: 0, stay: opts.stay ?? false, done: opts.done });
  }

  /** The item of the hop for `key` (also one that stays on the counter), or null. */
  lootOf(key: number): LootRef | null {
    return this.hops.find((h) => h.key === key)?.loot ?? null;
  }

  remove(key: number): void {
    for (const h of this.hops.filter((x) => x.key === key)) h.g.destroy();
    this.hops = this.hops.filter((h) => h.key !== key);
  }

  clear(): void {
    for (const h of this.hops) h.g.destroy();
    this.hops = [];
  }

  update(dtMs: number): void {
    for (const h of [...this.hops]) {
      h.age += dtMs;
      const to = h.to();
      if (!to) {
        this.remove(h.key);
        continue;
      }
      const p = hopPoint(h.from, to, h.age / ITEM_HOP_MS);
      h.g.position.set(p.x, p.y);
      if (h.age < ITEM_HOP_MS) continue;
      const done = h.done;
      h.done = undefined;
      if (!h.stay) {
        h.g.destroy();
        this.hops = this.hops.filter((x) => x !== h);
      }
      done?.();
    }
  }
}
