// Dungeon gear and potions (brief section 10), data in shared/data/gear.json. Gear is bought once
// in the Blacksmith and kept forever (Player.gear); potions are carried, at most carryMax.
// Buying goes through economy.ts buyGear.

import gearData from '../data/gear.json';
import type { GearId } from './types.ts';

export interface WeaponType {
  id: GearId;
  name: string;
  kind: 'weapon';
  price: number;
  attackMin: number;
  attackMax: number;
}
export interface ArmorType {
  id: GearId;
  name: string;
  kind: 'armor';
  price: number;
  /** Each enemy hit does this much less damage... */
  damageReduction: number;
  /** ...but at least this much. */
  minDamage: number;
}
export interface PotionType {
  id: 'health_potion';
  name: string;
  kind: 'potion';
  price: number;
  heal: number;
  cooldownMs: number;
  carryMax: number;
}
export type GearType = WeaponType | ArmorType | PotionType;
export type ShopGearId = GearId | 'health_potion';

export const GEAR_TYPES = gearData as GearType[];

export function getGear(id: ShopGearId): GearType {
  const g = GEAR_TYPES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown gear ${id}`);
  return g;
}

export const POTION = GEAR_TYPES.find((g): g is PotionType => g.kind === 'potion')!;

/** The best weapon the player owns, or null (bare starting attack). */
export function ownedWeapon(gear: readonly GearId[]): WeaponType | null {
  const ws = GEAR_TYPES.filter((g): g is WeaponType => g.kind === 'weapon' && gear.includes(g.id));
  return ws.sort((a, b) => b.attackMax - a.attackMax)[0] ?? null;
}

/** The armor the player owns, or null. */
export function ownedArmor(gear: readonly GearId[]): ArmorType | null {
  return GEAR_TYPES.find((g): g is ArmorType => g.kind === 'armor' && gear.includes(g.id)) ?? null;
}
