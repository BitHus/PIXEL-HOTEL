// CH1: the clothing pieces that have layer PNGs (client/src/assets/sprites/avatar), so the player is always the layered little guy like the guests.
// The pickers offer only these; an old look with another piece is mapped to the nearest drawn one on load (arrangeState) and in setLook.
// client/src/render/avatarAssets.test.ts checks that every piece listed here has its files. Add a piece here when its PNGs exist. Pure.

import type { AvatarLook } from './avatar.ts';
import { selectableClothing, type ClothingSlot, type ClothingType } from './clothing.ts';

/** Per picker slot, the pieces with layer PNGs (hats and outer pieces are not limited: a hat without a PNG is drawn by code over the sprite). */
export const DRAWN_PIECES = {
  hair: ['short', 'long'],
  top: ['tunic', 'jerkin'],
  bottoms: ['trousers'],
} as const;

type Limited = keyof typeof DRAWN_PIECES;

/** The nearest drawn piece for a piece that has no PNG: short and cropped hair to short, long and tied hair to long; every top to the tunic (the starter piece, always owned); every bottom to trousers. */
const NEAREST: Record<Limited, Record<string, string>> = {
  hair: { buzz: 'short', mohawk: 'short', spiky: 'short', top_knot: 'short', bob: 'short', curly: 'short', ponytail: 'long', braids: 'long', crown_braid: 'long' },
  top: {},
  bottoms: {},
};

const isLimited = (slot: ClothingSlot): slot is Limited => slot in DRAWN_PIECES;

/** True when a piece of this slot has layer PNGs (slots that are not limited: always). */
export function isDrawn(slot: ClothingSlot, id: string): boolean {
  return !isLimited(slot) || (DRAWN_PIECES[slot] as readonly string[]).includes(id);
}

/** What the player may pick in a slot: the free and unlocked pieces that are drawn. */
export function pickableClothing(slot: ClothingSlot, unlocked: readonly string[] = []): ClothingType[] {
  return selectableClothing(slot, unlocked).filter((c) => isDrawn(slot, c.id));
}

function mapPiece(slot: Limited, id: string): string {
  return isDrawn(slot, id) ? id : (NEAREST[slot][id] ?? DRAWN_PIECES[slot][0]);
}

/** The look with every piece that has no PNG replaced by the nearest drawn piece (the same object when nothing changes). */
export function drawnLook(look: AvatarLook): AvatarLook {
  const hairStyle = mapPiece('hair', look.hairStyle);
  const top = mapPiece('top', look.top);
  const bottoms = mapPiece('bottoms', look.bottoms);
  return hairStyle === look.hairStyle && top === look.top && bottoms === look.bottoms ? look : { ...look, hairStyle, top, bottoms };
}
