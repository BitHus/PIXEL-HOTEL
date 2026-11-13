// The inventory (step 5): furniture items with roomId null, stacked by type for the bag and the
// hotbar, plus the material stacks. Where each stack sits is in bag.ts. Pure functions.

import { FURNITURE_TYPES } from './furniture.ts';
import { MATERIAL_TYPES } from './materials.ts';
import type { FurnitureItem, MaterialId } from './types.ts';

export interface FurnitureStack {
  typeId: string;
  count: number;
}

export interface MaterialStack {
  id: MaterialId;
  qty: number;
}

/** Furniture in the inventory (not placed in any room). */
export function inventoryItems(items: readonly FurnitureItem[]): FurnitureItem[] {
  return items.filter((i) => i.roomId === null);
}

/** Inventory furniture stacked by type, in furniture.json order (a stable order for the bag). */
export function furnitureStacks(items: readonly FurnitureItem[]): FurnitureStack[] {
  const stacks = new Map<string, FurnitureStack>();
  for (const i of inventoryItems(items)) {
    const s = stacks.get(i.typeId);
    if (s) s.count++;
    else stacks.set(i.typeId, { typeId: i.typeId, count: 1 });
  }
  const order = (id: string): number => {
    const k = FURNITURE_TYPES.findIndex((t) => t.id === id);
    return k < 0 ? Infinity : k;
  };
  return [...stacks.values()].sort((a, b) => order(a.typeId) - order(b.typeId) || (a.typeId < b.typeId ? -1 : 1));
}

/** How many items of a type are in the inventory. */
export function countInInventory(items: readonly FurnitureItem[], typeId: string): number {
  return items.filter((i) => i.roomId === null && i.typeId === typeId).length;
}

/** The inventory item of this type that is placed next (the oldest), or null. */
export function nextInventoryUid(items: readonly FurnitureItem[], typeId: string): number | null {
  let best: number | null = null;
  for (const i of items) if (i.roomId === null && i.typeId === typeId && (best === null || i.uid < best)) best = i.uid;
  return best;
}

/** Material stacks with a count above 0, in materials.json order. */
export function materialStacks(materials: Partial<Record<MaterialId, number>>): MaterialStack[] {
  const ids = [...MATERIAL_TYPES.map((m) => m.id), ...(Object.keys(materials) as MaterialId[])];
  return [...new Set(ids)].map((id) => ({ id, qty: materials[id] ?? 0 })).filter((s) => s.qty > 0);
}

