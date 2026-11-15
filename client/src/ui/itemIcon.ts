// Small inventory icons (step 5, redone in step BG2): every item is a coloured square. An item's
// icon is data ({ shape, colors } in shared/data); render/drawIcon.ts draws it on a 32x32 canvas and
// caches it. These helpers give the data URL an <img> slot needs. Real pixel art replaces the drawing
// per item in phase 4.

import { COIN_ICON, GEM_ICON, type Icon, KEY_ICON, getClothing, getFurnitureType, getMaterialType, isMaterialId, getPiece, getGear, type GearId, type MaterialId, type Rank, type ShopGearId } from '@pixel-hotel/shared';
import { iconDataUrl } from '../render/drawIcon.ts';
import { spriteUrl } from '../render/spriteStore.ts';

// docs/PLAN-ART-UPGRADE.md section 0: every function that knows the item's ID first asks the sprite store for assets/sprites/icons/<id>.png (a block
// also for assets/sprites/blocks/<id>.png, one picture for the tile and the icon) and only then draws the code icon. Functions that only receive an
// Icon (packIconUrl, gemPieceIconUrl) keep drawing it.
function spriteIcon(id: string, ...kinds: ('icons' | 'blocks')[]): string | null {
  for (const k of kinds) {
    const u = spriteUrl(k, id);
    if (u) return u;
  }
  return null;
}

export function furnitureIconUrl(typeId: string, rank?: Rank): string {
  return spriteIcon(typeId, 'icons') ?? iconDataUrl(getFurnitureType(typeId).icon, rank);
}

export function materialIconUrl(id: MaterialId, rank?: Rank): string {
  return spriteIcon(id, 'icons', 'blocks') ?? iconDataUrl(getMaterialType(id).icon, rank);
}

/** A clothing item's inventory icon (hair, top or bottoms). */
export function clothingIconUrl(id: string): string {
  const c = getClothing(id);
  if (!c) throw new Error(`unknown clothing ${id}`);
  return spriteIcon(id, 'icons') ?? iconDataUrl(c.icon);
}

/** A forged piece (sword, armor, pickaxe, axe, rod). */
export function gearIconUrl(id: GearId): string {
  return spriteIcon(id, 'icons') ?? iconDataUrl(getPiece(id).icon);
}

/** A potion from the blacksmith. */
export function potionIconUrl(id: ShopGearId = 'health_potion'): string {
  return spriteIcon(id, 'icons') ?? iconDataUrl(getGear(id).icon);
}

/** The dungeon key. */
export function keyIconUrl(): string {
  return spriteIcon('key', 'icons') ?? iconDataUrl(KEY_ICON);
}

/** The gem (the second currency). */
export function gemIconUrl(): string {
  return spriteIcon('gems', 'icons') ?? iconDataUrl(GEM_ICON);
}

/** A gem piece of one tier (1 green, 5 blue, 10 red): the colours come from GEM_TIERS. */
export function gemPieceIconUrl(colors: readonly [string, string]): string {
  return iconDataUrl({ ...GEM_ICON, colors: [...colors] } as typeof GEM_ICON);
}

/** The picture of a gain: a gem for 'gems', else the item's own icon (material or furniture). */
export function gainIconUrl(itemId: string, rank?: Rank): string {
  if (itemId === 'gems') return gemIconUrl();
  if (itemId === 'gold') return spriteIcon('gold', 'icons') ?? iconDataUrl(COIN_ICON);
  // Clothing (a pack find, step BG8).
  if (getClothing(itemId)) return clothingIconUrl(itemId);
  return isMaterialId(itemId) ? materialIconUrl(itemId, rank) : furnitureIconUrl(itemId, rank);
}

/** A pack's picture (step BG8). */
export function packIconUrl(icon: Icon): string {
  return iconDataUrl(icon);
}

/** A plain drink's icon with the ripening band of its tier (step K2b; the band comes from the artist's `tier` option of iconDataUrl, A2). Fresh = the plain icon. */
export function caskIconUrl(drink: MaterialId, tier: 'fresh' | 'aged' | 'vintage'): string {
  if (tier === 'fresh') return materialIconUrl(drink);
  const type = getMaterialType(drink);
  return iconDataUrl(type.icon, type.rank, tier);
}
