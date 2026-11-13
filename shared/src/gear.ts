// Gear (brief sections 10 and 10c). Since step 9c weapons, armor and the pickaxe are made at the
// forge from bars (shared/data/forge.json, forge.ts) and kept forever in Player.gear, at most one
// piece per slot: an upgrade replaces the piece before it. The Blacksmith only sells health
// potions now (shared/data/gear.json): carried, at most carryMax. Buying goes through economy.ts
// buyGear. Old saves that bought the iron_sword or leather_armor keep them: those ids are the iron
// sword and leather armor tiers.

import gearData from '../data/gear.json';
import forgeData from '../data/forge.json';
import type { BarId, GearId } from './types.ts';

export type GearSlot = 'weapon' | 'armor' | 'pickaxe';

interface PieceBase {
  id: GearId;
  name: string;
  slot: GearSlot;
  /** The piece this one replaces (it must be owned), or null for the first tier. */
  needs: GearId | null;
  /** Bars it costs at the forge. */
  bars: Partial<Record<BarId, number>>;
}
export interface WeaponType extends PieceBase {
  slot: 'weapon';
  attackMin: number;
  attackMax: number;
}
export interface ArmorType extends PieceBase {
  slot: 'armor';
  /** Each enemy hit does this much less damage... */
  damageReduction: number;
  /** ...but at least this much. */
  minDamage: number;
}
export interface PickaxeType extends PieceBase {
  slot: 'pickaxe';
  /** Each swing counts this many hits on a rock. */
  hitsPerSwing: number;
  minesMithril: boolean;
}
export type GearPiece = WeaponType | ArmorType | PickaxeType;

export interface PotionType {
  id: 'health_potion';
  name: string;
  kind: 'potion';
  price: number;
  heal: number;
  cooldownMs: number;
  carryMax: number;
}
/** What the Blacksmith sells (potions only since step 9c). */
export type GearType = PotionType;
export type ShopGearId = 'health_potion';

export const GEAR_TYPES = gearData as GearType[];
export const GEAR_PIECES = forgeData.pieces as GearPiece[];

export function getGear(id: ShopGearId): GearType {
  const g = GEAR_TYPES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown gear ${id}`);
  return g;
}

export function getPiece(id: GearId): GearPiece {
  const g = GEAR_PIECES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown gear piece ${id}`);
  return g;
}

export const POTION = GEAR_TYPES.find((g): g is PotionType => g.kind === 'potion')!;

/** The piece the player has in a slot, or null (starting sword, no armor, basic pickaxe). */
export function ownedPiece(gear: readonly GearId[], slot: GearSlot): GearPiece | null {
  // An old save may hold more than one (it never should since step 9c): the last tier wins.
  const owned = GEAR_PIECES.filter((g) => g.slot === slot && gear.includes(g.id));
  return owned[owned.length - 1] ?? null;
}

/** The weapon the player owns, or null (the starting sword, attack 4-6). */
export function ownedWeapon(gear: readonly GearId[]): WeaponType | null {
  return ownedPiece(gear, 'weapon') as WeaponType | null;
}

/** The armor the player owns, or null. */
export function ownedArmor(gear: readonly GearId[]): ArmorType | null {
  return ownedPiece(gear, 'armor') as ArmorType | null;
}

/** The pickaxe the player owns, or null (the basic pickaxe: 1 hit per swing, no mithril). */
export function ownedPickaxe(gear: readonly GearId[]): PickaxeType | null {
  return ownedPiece(gear, 'pickaxe') as PickaxeType | null;
}
