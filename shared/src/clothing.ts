// Clothing and the avatar look (step 7b, brief section 8). Clothing is data in
// shared/data/clothing.json: { id, slot: 'hair' | 'top' | 'bottoms', name, free }. Free items can be
// picked from the start; the others exist but stay hidden until unlocked (later, from the catalog
// or the dungeon: Player.unlockedClothing). Colours come from short lists of palette indices per
// slot (config LOOK_COLORS). The styles only change the hair, top and bottoms boxes of the avatar.

import clothingData from '../data/clothing.json';
import { DISPLAY_NAME_MAX, LOOK_COLORS } from './config.ts';
import type { AvatarLook } from './avatar.ts';

export type ClothingSlot = 'hair' | 'top' | 'bottoms';

export interface ClothingType {
  id: string;
  slot: ClothingSlot;
  name: string;
  free: boolean;
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
export const SLOT_FIELD = { hair: 'hairStyle', top: 'top', bottoms: 'bottoms' } as const;

/** True if every style is selectable and every colour is in its list. */
export function lookAllowed(look: AvatarLook, unlocked: readonly string[] = []): boolean {
  const styleOk = (slot: ClothingSlot): boolean => selectableClothing(slot, unlocked).some((c) => c.id === look[SLOT_FIELD[slot]]);
  const colorOk = (list: readonly number[], v: number): boolean => list.includes(v);
  return (
    styleOk('hair') &&
    styleOk('top') &&
    styleOk('bottoms') &&
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
