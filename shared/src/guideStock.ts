// A1e (owner 19 Nov): what the player HAS, so the first-steps guide never asks for a thing that cannot be done yet (cook with no crops, load with no mugs,
// plant with no seeds or gold). Pure: reads plain data, returns the GuideStock that firstTen.ts guideBlocker reads.

import { brewCards } from './brewing.ts';
import { canCookWith } from './cooking.ts';
import { catalogPrice, catalogTypes } from './economy.ts';
import { seedsForSale } from './farm.ts';
import type { GuideStock } from './firstTen.ts';
import { getFurnitureType } from './furniture.ts';
import { FOOD_TYPES, isDrinkId } from './materials.ts';
import type { TavernState } from './tavern.ts';
import type { FurnitureItem, MaterialId } from './types.ts';

/** The plain input: the client reads it from getPlayer + getInventory + the tavern; shared callers from a GameState. */
export interface GuideStockInput {
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  /** Furniture in the bag (roomId null). */
  bagFurniture: readonly FurnitureItem[];
  tavern: Pick<TavernState, 'taps' | 'tray'>;
}

export function guideStock(i: GuideStockInput): GuideStock {
  const mats = i.materials;
  let bagMugs = 0;
  for (const [id, n] of Object.entries(mats)) if (isDrinkId(id)) bagMugs += n ?? 0;
  const tapMugs = i.tavern.taps.reduce((s, t) => s + t.mugs, 0);
  const seeds = seedsForSale();
  const seedPrice = seeds.length ? Math.min(...seeds.map((c) => c.seedPrice ?? 0)) : 0;
  const wallTypes = catalogTypes().filter((t) => getFurnitureType(t.id).wall);
  const wallPrice = wallTypes.length ? Math.min(...wallTypes.map((t) => catalogPrice(t.id))) : 0;
  return {
    canCook: FOOD_TYPES.some((f) => canCookWith(mats, f)),
    canBrew: brewCards(mats).some((c) => c.can),
    mugs: bagMugs + tapMugs + (i.tavern.tray?.length ?? 0),
    gold: i.gold,
    hasSeeds: seeds.some((c) => (mats[c.seed] ?? 0) > 0),
    seedPrice,
    hasWallPiece: i.bagFurniture.some((f) => getFurnitureType(f.typeId).wall),
    wallPrice,
  };
}
