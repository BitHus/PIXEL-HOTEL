// Clothing and the avatar look (step 7b, brief section 8). Clothing is data in
// shared/data/clothing.json: { id, slot: 'hair' | 'top' | 'bottoms', name, free }. Free items can be
// picked from the start; the others exist but stay hidden until unlocked (later, from the catalog
// or the dungeon: Player.unlockedClothing). Colours come from short lists of palette indices per
// slot (config LOOK_COLORS). The styles only change the hair, top and bottoms boxes of the avatar.

import clothingData from '../data/clothing.json';
import { DEFAULT_INN_NAME, DISPLAY_NAME_MAX, LOOK_COLORS } from './config.ts';
import type { Icon } from './icons.ts';
import type { AvatarLook } from './avatar.ts';
import type { Rank } from './types.ts';

export type ClothingSlot = 'hair' | 'top' | 'bottoms' | 'hat';

/** Where a hat comes from (step 9g-1); the unlock events grant it through the ledger (addClothing). */
export type HatSource = 'catalog' | 'book' | 'fish' | 'loot' | 'splice' | 'boss' | 'sunken' | 'mine';

export interface ClothingType {
  id: string;
  slot: ClothingSlot;
  name: string;
  free: boolean;
  /** How hard it is to find (step BG8; the clothes packs roll the rank first). */
  rank: Rank;
  /** Gold a spare copy sells for (times config SPARE_SELL). */
  baseValue: number;
  /** The inventory icon (step BG2). */
  icon: Icon;
  /** False = never in a clothes pack (hats, step 9g-1). Missing = in the pool when not free. */
  pack?: boolean;
  /** Hats: where it comes from, and the hint shown while it is locked. */
  source?: HatSource;
  unlock?: string;
}

export const CLOTHING = clothingData as ClothingType[];

export function getClothing(id: string): ClothingType | undefined {
  return CLOTHING.find((c) => c.id === id);
}

/** The clothing of a slot the player may pick: free ones and unlocked ones, in data order. */
export function selectableClothing(slot: ClothingSlot, unlocked: readonly string[] = []): ClothingType[] {
  return CLOTHING.filter((c) => c.slot === slot && (c.free || unlocked.includes(c.id)));
}

/** The look's field for a clothing slot. */
export const SLOT_FIELD = { hair: 'hairStyle', top: 'top', bottoms: 'bottoms', hat: 'hat' } as const;

/** The hats (step 9g-1), in data order. */
export const HATS = CLOTHING.filter((c) => c.slot === 'hat');

/** Gold price of a catalog hat: baseValue * 3 (brief section 7). Null for a hat that is not sold. */
export function hatCatalogPrice(id: string): number | null {
  const c = getClothing(id);
  return c && c.slot === 'hat' && c.source === 'catalog' ? c.baseValue * 3 : null;
}

/** True if the player may wear this hat id (owned). */
export function hatWearable(id: string, unlocked: readonly string[]): boolean {
  return selectableClothing('hat', unlocked).some((c) => c.id === id);
}

/** True if every style is selectable and every colour is in its list. */
export function lookAllowed(look: AvatarLook, unlocked: readonly string[] = []): boolean {
  const styleOk = (slot: ClothingSlot): boolean => selectableClothing(slot, unlocked).some((c) => c.id === look[SLOT_FIELD[slot]]);
  const hatOk = !look.hat || hatWearable(look.hat, unlocked);
  const colorOk = (list: readonly number[], v: number): boolean => list.includes(v);
  return (
    styleOk('hair') &&
    styleOk('top') &&
    styleOk('bottoms') &&
    hatOk &&
    colorOk(LOOK_COLORS.skin, look.skin) &&
    colorOk(LOOK_COLORS.hair, look.hair) &&
    colorOk(LOOK_COLORS.top, look.shirt) &&
    colorOk(LOOK_COLORS.bottoms, look.legs) &&
    colorOk(LOOK_COLORS.shoes, look.shoes)
  );
}

/**
 * A display name: letters, digits and spaces only, at most DISPLAY_NAME_MAX characters, spaces
 * trimmed and joined. Null when nothing is left or a character is not allowed.
 */
export function cleanDisplayName(name: string): string | null {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s.length === 0 || s.length > DISPLAY_NAME_MAX) return null;
  return /^[\p{L}\p{N} ]+$/u.test(s) ? s : null;
}

/** The Inn name (MB-1): the same rules as a display name; nothing typed = the default; null when not allowed. */
export function cleanInnName(name: string | undefined): string | null {
  if (name === undefined || name.trim() === '') return DEFAULT_INN_NAME;
  return cleanDisplayName(name);
}
