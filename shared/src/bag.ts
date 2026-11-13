// The bag layout (step 5): where each inventory stack sits. There are three slot areas: the
// hotbar (HOTBAR_SLOTS furniture slots), the bag's Furniture tab and the bag's Materials tab
// (BAG_SLOTS each). A slot holds a type id; the count comes from the inventory itself
// (furniture items with roomId null, player.materials). Every type the player has sits in
// exactly one slot: in the hotbar or in the bag, never both. A hotbar slot keeps its type when
// the last one is placed (shown dimmed), so a picked-up item goes back there. Pure functions.

import { BAG_SLOTS, HOTBAR_SLOTS } from './config.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { furnitureStacks, materialStacks } from './inventory.ts';
import { MATERIAL_TYPES, isMaterialId, isSeedId } from './materials.ts';
import type { FurnitureItem, MaterialId } from './types.ts';

export type BagTab = 'furniture' | 'materials';
export type SlotArea = 'hotbar' | BagTab;

export interface SlotRef {
  area: SlotArea;
  index: number;
}

export interface BagLayout {
  furniture: (string | null)[];
  materials: (string | null)[];
}

export interface SlotLayout {
  /** HOTBAR_SLOTS furniture type ids (null = empty slot). */
  hotbar: (string | null)[];
  bag: BagLayout;
}

export function emptyBag(): BagLayout {
  return { furniture: Array(BAG_SLOTS).fill(null), materials: Array(BAG_SLOTS).fill(null) };
}

const isFurnitureType = (id: string): boolean => FURNITURE_TYPES.some((t) => t.id === id);

/** What may sit in a slot area: the hotbar takes furniture and seeds (step 9b: planting), the
 *  Furniture tab furniture, the Materials tab every stackable good (materials, seeds, crops, food). */
export function fitsArea(area: SlotArea, id: string): boolean {
  if (area === 'hotbar') return isFurnitureType(id) || isSeedId(id);
  if (area === 'furniture') return isFurnitureType(id);
  return isMaterialId(id);
}

/** Pads to BAG_SLOTS with empty slots, and drops empty slots at the end beyond BAG_SLOTS. */
function fit(slots: (string | null)[]): (string | null)[] {
  const out = [...slots];
  while (out.length < BAG_SLOTS) out.push(null);
  while (out.length > BAG_SLOTS && out[out.length - 1] === null) out.pop();
  return out;
}

/** Keeps the present types not in `taken` (once each), then puts missing ones in the first free slots. */
function arrangeTab(slots: readonly (string | null)[], present: readonly string[], taken: ReadonlySet<string>): (string | null)[] {
  const want = new Set(present);
  const seen = new Set<string>();
  const out = slots.map((id) => {
    if (id === null || !want.has(id) || taken.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  for (const id of present) {
    if (seen.has(id) || taken.has(id)) continue;
    const free = out.indexOf(null);
    if (free >= 0) out[free] = id;
    else out.push(id);
    seen.add(id);
  }
  return fit(out);
}

/**
 * Makes a layout match the inventory: every present type in exactly one slot, types that are
 * gone leave the bag (a hotbar slot keeps its type), new types go in the first free bag slot.
 * `furnitureIds` and `materialIds` are the types with a count above 0, in the order new ones
 * are added.
 */
export function arrangeSlots(layout: SlotLayout, furnitureIds: readonly string[], materialIds: readonly string[]): SlotLayout {
  const seen = new Set<string>();
  const hotbar = Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
    const id = layout.hotbar[i] ?? null;
    if (id === null || !fitsArea('hotbar', id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  // A seed type the player gets for the first time goes into a free hotbar slot (to plant it), if
  // there is one and it is not in the bag already.
  const inBag = new Set(layout.bag.materials);
  for (const id of materialIds) {
    if (!isSeedId(id) || seen.has(id) || inBag.has(id)) continue;
    const free = hotbar.indexOf(null);
    if (free < 0) break;
    hotbar[free] = id;
    seen.add(id);
  }
  return {
    hotbar,
    bag: {
      furniture: arrangeTab(layout.bag.furniture, furnitureIds, seen),
      materials: arrangeTab(layout.bag.materials, materialIds, seen),
    },
  };
}

/** arrangeSlots for the inventory of a game: its furniture items and materials. */
export function arrangeForInventory(
  layout: SlotLayout,
  items: readonly FurnitureItem[],
  materials: Partial<Record<MaterialId, number>>,
): SlotLayout {
  return arrangeSlots(
    layout,
    furnitureStacks(items).map((s) => s.typeId),
    materialStacks(materials).map((s) => s.id),
  );
}

function area(layout: SlotLayout, a: SlotArea): (string | null)[] {
  return a === 'hotbar' ? layout.hotbar : layout.bag[a];
}

function copy(layout: SlotLayout): SlotLayout {
  return { hotbar: [...layout.hotbar], bag: { furniture: [...layout.bag.furniture], materials: [...layout.bag.materials] } };
}

/** Furniture moves between the hotbar and the Furniture tab, seeds between the hotbar and the
 *  Materials tab; other materials stay in their tab. (moveSlot checks the ids with fitsArea.) */
export function canMoveBetween(from: SlotArea, to: SlotArea): boolean {
  return from === to || from === 'hotbar' || to === 'hotbar';
}

/**
 * Moves the stack in `from` to `to`; if `to` holds another stack, the two swap. Null when the
 * move is not allowed (a slot out of range, an empty source, or materials to or from the hotbar).
 */
export function moveSlot(layout: SlotLayout, from: SlotRef, to: SlotRef): SlotLayout | null {
  if (!canMoveBetween(from.area, to.area)) return null;
  const next = copy(layout);
  const a = area(next, from.area);
  const b = area(next, to.area);
  if (!Number.isInteger(from.index) || !Number.isInteger(to.index)) return null;
  if (from.index < 0 || from.index >= a.length || to.index < 0 || to.index >= b.length) return null;
  const moving = a[from.index] ?? null;
  if (moving === null) return null;
  const other = b[to.index] ?? null;
  if (!fitsArea(to.area, moving) || (other !== null && !fitsArea(from.area, other))) return null;
  a[from.index] = other;
  b[to.index] = moving;
  return next;
}

/** Moves a hotbar slot's stack to the first free slot of its bag tab (Furniture, or Materials for
 *  seeds; the tab grows if full). */
export function hotbarToBag(layout: SlotLayout, index: number): SlotLayout | null {
  const id = layout.hotbar[index];
  if (id === undefined || id === null) return null;
  const next = copy(layout);
  next.hotbar[index] = null;
  const tab = next.bag[isSeedId(id) ? 'materials' : 'furniture'];
  const free = tab.indexOf(null);
  if (free >= 0) tab[free] = id;
  else tab.push(id);
  return next;
}

const TYPE_ORDER: Record<BagTab, readonly string[]> = {
  furniture: FURNITURE_TYPES.map((t) => t.id),
  materials: MATERIAL_TYPES.map((m) => m.id),
};

/** Sort: the tab's stacks in catalog order (furniture.json / materials.json), packed to the front. */
export function sortBag(layout: SlotLayout, tab: BagTab): SlotLayout {
  const order = TYPE_ORDER[tab];
  const rank = (id: string): number => {
    const k = order.indexOf(id);
    return k < 0 ? order.length : k;
  };
  const ids = [...new Set(layout.bag[tab].filter((id): id is string => id !== null))];
  ids.sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : x > y ? 1 : 0));
  const next = copy(layout);
  next.bag[tab] = fit(ids);
  return next;
}

/** Stack: equal items merge into one slot and the gaps close up; the order stays as it is. */
export function stackBag(layout: SlotLayout, tab: BagTab): SlotLayout {
  const ids = [...new Set(layout.bag[tab].filter((id): id is string => id !== null))];
  const next = copy(layout);
  next.bag[tab] = fit(ids);
  return next;
}
