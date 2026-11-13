// The forge (brief section 10c, step 9c; the Workshop's Forge tab). Data in shared/data/forge.json.
// - Smelting: FORGE.orePerBar ore of a kind + a small gold fee -> 1 bar (ledger reason 'smelt').
// - Upgrades: a weapon, armor or pickaxe piece made from bars. Each needs the piece before it in its
//   slot (the first tier needs an empty slot) and replaces it; gear stays forever (ledger 'forge').
// Pure: the time is passed in.

import forgeData from '../data/forge.json';
import type { GameState } from './gameState.ts';
import { GEAR_PIECES, ownedPiece, type GearPiece } from './gear.ts';
import { applyChange } from './ledger.ts';
import type { BarId, GearId, MaterialId, OreId } from './types.ts';

export interface SmeltRecipe {
  bar: BarId;
  ore: OreId;
  fee: number;
}

export const FORGE = forgeData as { orePerBar: number; smelting: SmeltRecipe[] };

export function smeltRecipe(bar: BarId): SmeltRecipe {
  const r = FORGE.smelting.find((x) => x.bar === bar);
  if (!r) throw new Error(`unknown bar ${bar}`);
  return r;
}

/** Smelts one bar: ore and the fee go, the bar comes. Null without the ore or the gold. */
export function smelt(state: GameState, bar: BarId, at: number): GameState | null {
  const r = FORGE.smelting.find((x) => x.bar === bar);
  if (!r) return null;
  return applyChange(state, { reason: 'smelt', gold: -r.fee, materials: { [r.ore]: -FORGE.orePerBar, [r.bar]: 1 }, note: `smelted ${bar}` }, at);
}

/** The next piece the player can make in a slot of this piece's kind: needs = what they have now. */
export function nextPiece(gear: readonly GearId[], slot: GearPiece['slot']): GearPiece | null {
  const have = ownedPiece(gear, slot)?.id ?? null;
  return GEAR_PIECES.find((g) => g.slot === slot && g.needs === have) ?? null;
}

/** True if the piece is the next one in its slot and the player has the bars. */
export function canForge(state: GameState, id: GearId): boolean {
  const piece = nextPiece(state.player.gear, GEAR_PIECES.find((g) => g.id === id)?.slot ?? 'weapon');
  if (!piece || piece.id !== id) return false;
  return Object.entries(piece.bars).every(([b, n]) => (state.player.materials[b as MaterialId] ?? 0) >= (n ?? 0));
}

/** Makes a piece at the forge: the bars go, the piece replaces the one before it. Null if it cannot. */
export function forgePiece(state: GameState, id: GearId, at: number): GameState | null {
  if (!canForge(state, id)) return null;
  const piece = GEAR_PIECES.find((g) => g.id === id)!;
  const used = Object.fromEntries(Object.entries(piece.bars).map(([b, n]) => [b, -(n ?? 0)]));
  const paid = applyChange(state, { reason: 'forge', materials: used, note: `forged ${id}` }, at);
  if (!paid) return null;
  const gear = [...paid.player.gear.filter((g) => g !== piece.needs), id];
  return { ...paid, player: { ...paid.player, gear } };
}
