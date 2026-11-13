// The run bag (brief section 10): RUN_BAG_SLOTS slots. Each furniture item takes a slot,
// materials stack up to MATERIAL_STACK_MAX per slot, gold takes no slot. What does not fit is
// left behind.

import { MATERIAL_STACK_MAX, RUN_BAG_SLOTS } from '../config.ts';
import { isMaterialId } from '../materials.ts';
import type { BagItem, RunBag } from './run.ts';
import type { Loot } from './loot.ts';

export interface BagAdd {
  bag: RunBag;
  /** What did not fit. */
  leftBehind: BagItem[];
}

/** Adds loot to a bag (limit = slot count; Infinity for the banked bag). */
export function addToBag(bag: RunBag, loot: readonly Loot[], limit = RUN_BAG_SLOTS): BagAdd {
  const slots = bag.slots.map((s) => ({ ...s }));
  let gold = bag.gold;
  const leftBehind: BagItem[] = [];
  for (const l of loot) {
    if (l.item === 'gold') {
      gold += l.qty;
    } else if (isMaterialId(l.item)) {
      let left = l.qty;
      for (const s of slots) {
        if (left === 0) break;
        if (s.kind !== 'material' || s.id !== l.item || s.qty >= MATERIAL_STACK_MAX) continue;
        const put = Math.min(left, MATERIAL_STACK_MAX - s.qty);
        s.qty += put;
        left -= put;
      }
      while (left > 0) {
        const put = Math.min(left, MATERIAL_STACK_MAX);
        const item: BagItem = { kind: 'material', id: l.item, qty: put };
        if (slots.length < limit) slots.push(item);
        else leftBehind.push(item);
        left -= put;
      }
    } else {
      for (let k = 0; k < l.qty; k++) {
        const item: BagItem = { kind: 'furniture', typeId: l.item };
        if (slots.length < limit) slots.push(item);
        else leftBehind.push(item);
      }
    }
  }
  return { bag: { slots, gold }, leftBehind };
}

/** A bag's slots as loot (to move them into another bag). */
export function bagLoot(bag: RunBag): Loot[] {
  return bag.slots.map((s) => (s.kind === 'material' ? { item: s.id, qty: s.qty } : { item: s.typeId, qty: 1 }));
}
