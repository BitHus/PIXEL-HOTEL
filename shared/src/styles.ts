// Floor and wall styles (brief section 5). Data in shared/data/styles.json. A style is unlocked
// forever (economy.ts unlockStyle) and then applied to any of the player's rooms for free.

import styleData from '../data/styles.json';
import { CATALOG_PRICE_MULT } from './config.ts';
import type { StyleKind, StyleType } from './types.ts';

export const STYLE_TYPES = styleData as StyleType[];

export function findStyle(kind: StyleKind, id: string): StyleType | undefined {
  return STYLE_TYPES.find((s) => s.kind === kind && s.id === id);
}

export function getStyle(kind: StyleKind, id: string): StyleType {
  const s = findStyle(kind, id);
  if (!s) throw new Error(`unknown ${kind} style ${id}`);
  return s;
}

/** Catalog price of a style (baseValue * 3, like furniture). */
export function stylePrice(style: StyleType): number {
  return style.baseValue * CATALOG_PRICE_MULT;
}

/** Shop appeal of a style (0 for an unknown one). */
export function styleAppeal(kind: StyleKind, id: string): number {
  return findStyle(kind, id)?.appeal ?? 0;
}
