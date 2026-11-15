// The trader (step S2, docs/INN-PLAN.md section 5): surplus things for gold, at the bar's Sell tab. Pure rules.
// NEVER automatic: nothing here is called by a clock; only a player's tap sells (the API method sell).
// What sells: materials, blocks, seeds, crops, fish and fished-up things, ore, bars, spare clothes and furniture that is NOT placed.
// What never lists: food and drinks (they are the menu, the stall of the dungeon lunch box and the guests' orders), worn gear (it is not a
// stack at all), anything placed in a room, the one-of-a-kind counter (noPickup), clothes that are not spares.
// Price: baseValue * SELL_RATE (at least 1 gold); a spare piece of clothing keeps SPARE_SELL (BG8). Things in the hotbar WARN before selling.

import { GOLD_GAIN_ID, SELL_CONFIRM_QTY, SELL_HINT_STACKS, SELL_RATE, SELL_RATES, SPARE_SELL } from './config.ts';
import { SPLICE_SEEDS } from './spliceData.ts';
import { getFurnitureType, canPickUp } from './furniture.ts';
import { gain, type GainList } from './gains.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { getMaterialType, isMaterialId } from './materials.ts';
import { rankOf } from './ranks.ts';
import { getClothing } from './clothing.ts';
import type { MaterialId, Rank } from './types.ts';

/** The hint toast once the bag fills (reading pace: toast.ts uses readingMs). */
export const SELL_HINT_TEXT = 'Your bag is filling up. Sell what you do not need at the bar: tap the bar and open the Sell tab.';

export type SellKind = 'material' | 'furniture' | 'clothing';

/** One line of the Sell tab. */
export interface SellRow {
  kind: SellKind;
  id: string;
  name: string;
  rank: Rank;
  /** How many the player can sell. */
  count: number;
  /** Gold for ONE piece. */
  unit: number;
  /** True when the thing is in the hotbar: selling asks first. */
  inHotbar: boolean;
}

/** What one tap of Sell did: the gold paid and the popup list (a gold gain above the head). */
export interface SellResult {
  gold: number;
  gains: GainList;
}

/** Why a sale asks first; null = it sells at once. */
export type SellWarning = 'many' | 'rare' | 'hotbar';

/** Material groups the trader buys. Food and drinks are for the menu and the lunch box; they never list. */
const SELLABLE_GROUPS = new Set(['block', 'material', 'seed', 'crop', 'fish', 'thing']);

/** The gold for one piece at the trader: baseValue * the rate (SELL_RATE by default), at least 1. */
export function sellPrice(baseValue: number, rate: number = SELL_RATE): number {
  return Math.max(1, Math.round(baseValue * rate));
}

/** Seeds only splicing makes, and the furniture only those seeds grow: they sell at the low SELL_RATES.splice (step S3). */
const SPLICE_SEED_IDS: ReadonlySet<string> = new Set(SPLICE_SEEDS.map((x) => x.id));
const SPLICE_FURNITURE_IDS: ReadonlySet<string> = new Set(SPLICE_SEEDS.flatMap((x) => (x.grows.kind === 'furniture' ? [x.grows.id] : [])));
const ORE_IDS: ReadonlySet<string> = new Set(['copper_ore', 'iron_ore', 'mithril_ore']);
const BAR_IDS: ReadonlySet<string> = new Set(['copper_bar', 'iron_bar', 'mithril_bar']);

/** The rate the trader pays for a stackable thing, by its group (step S3): crops least, ore and fish more, splice results lowest. */
export function materialSellRate(id: string): number {
  if (SPLICE_SEED_IDS.has(id)) return SELL_RATES.splice;
  if (ORE_IDS.has(id)) return SELL_RATES.ore;
  if (BAR_IDS.has(id)) return SELL_RATES.bar;
  const g = getMaterialType(id as MaterialId).group;
  return g === 'block' ? SELL_RATES.block : g === 'seed' ? SELL_RATES.seed : g === 'crop' ? SELL_RATES.crop : g === 'fish' ? SELL_RATES.fish : g === 'thing' ? SELL_RATES.thing : SELL_RATES.material;
}

/** The trader's price of one material (0 = it is not bought). */
export function materialSellPrice(id: string): number {
  if (!isMaterialId(id) || !SELLABLE_GROUPS.has(getMaterialType(id).group)) return 0;
  return sellPrice(getMaterialType(id).baseValue, materialSellRate(id));
}

/** The trader's price of one furniture type (0 = never bought: the counter). Furniture that only splicing grows has the low splice rate. */
export function furnitureSellPrice(typeId: string): number {
  const t = getFurnitureType(typeId);
  return t.noPickup ? 0 : sellPrice(t.baseValue, SPLICE_FURNITURE_IDS.has(typeId) ? SELL_RATES.splice : SELL_RATE);
}

/** One spare piece of clothing sells for baseValue * SPARE_SELL (BG8; whole gold, rounded down). */
export function clothingSellPrice(id: string): number {
  const c = getClothing(id);
  return c && !c.free ? Math.floor(c.baseValue * SPARE_SELL) : 0;
}

function furnitureStock(state: GameState): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const i of state.items) {
    if (i.roomId !== null || !canPickUp(i)) continue;
    out.set(i.typeId, [...(out.get(i.typeId) ?? []), i.uid]);
  }
  return out;
}

/** Every row of the Sell tab, in the order: materials (by bag order), furniture, spare clothes. */
export function sellRows(state: GameState): SellRow[] {
  const hot = new Set(state.hotbar.filter((x): x is string => x !== null));
  const rows: SellRow[] = [];
  for (const [id, count] of Object.entries(state.player.materials) as [MaterialId, number][]) {
    const unit = materialSellPrice(id);
    if (count <= 0 || unit <= 0) continue;
    const t = getMaterialType(id);
    rows.push({ kind: 'material', id, name: t.name, rank: t.rank, count, unit, inHotbar: hot.has(id) });
  }
  for (const [typeId, uids] of furnitureStock(state)) {
    const t = getFurnitureType(typeId);
    rows.push({ kind: 'furniture', id: typeId, name: t.name, rank: t.rank, count: uids.length, unit: furnitureSellPrice(typeId), inHotbar: hot.has(typeId) });
  }
  for (const [id, count] of Object.entries(state.player.clothingSpares)) {
    const c = getClothing(id);
    if (!c || count <= 0 || clothingSellPrice(id) <= 0) continue;
    rows.push({ kind: 'clothing', id, name: c.name, rank: rankOf(id), count, unit: clothingSellPrice(id), inHotbar: false });
  }
  return rows;
}

/** Does the bag hold so many different sellable stacks that the hint "Sell what you do not need at the bar" should show? */
export function bagIsFilling(state: GameState): boolean {
  return sellRows(state).length >= SELL_HINT_STACKS;
}

/** Why selling `qty` of this row asks first, or null. More than SELL_CONFIRM_QTY pieces, an ultra rare or legendary thing, or a hotbar item. */
export function sellWarning(row: Pick<SellRow, 'rank' | 'inHotbar'>, qty: number): SellWarning | null {
  if (row.rank === 'ultra_rare' || row.rank === 'legendary') return 'rare';
  if (row.inHotbar) return 'hotbar';
  if (qty > SELL_CONFIRM_QTY) return 'many';
  return null;
}

/**
 * Sells `qty` pieces of one thing for gold (ledger reason 'sell', one entry). Null, nothing changes, if the thing is not bought, the player
 * has fewer, or qty is not a whole number above 0. The Book is not touched (a sale is no find). Furniture: the lowest uids in the bag go first.
 */
export function sell(state: GameState, kind: SellKind, id: string, qty: number, at: number): { state: GameState; result: SellResult } | null {
  if (!Number.isInteger(qty) || qty <= 0) return null;
  let gold = 0;
  let next: GameState | null = null;
  if (kind === 'material') {
    const unit = materialSellPrice(id);
    if (unit <= 0 || (state.player.materials[id as MaterialId] ?? 0) < qty) return null;
    gold = unit * qty;
    next = applyChange(state, { reason: 'sell', gold, materials: { [id]: -qty }, note: `sold ${qty} ${id}` }, at);
  } else if (kind === 'furniture') {
    const unit = isFurnitureKnown(id) ? furnitureSellPrice(id) : 0;
    const uids = furnitureStock(state).get(id) ?? [];
    if (unit <= 0 || uids.length < qty) return null;
    gold = unit * qty;
    next = applyChange(state, { reason: 'sell', gold, removeFurniture: [...uids].sort((a, b) => a - b).slice(0, qty), note: `sold ${qty} ${id}` }, at);
  } else {
    const unit = clothingSellPrice(id);
    if (unit <= 0) return null;
    gold = unit * qty;
    next = applyChange(state, { reason: 'sell', gold, sellSpares: { [id]: qty }, note: `sold ${qty} ${id}` }, at);
  }
  if (!next) return null;
  return { state: next, result: { gold, gains: [gain(GOLD_GAIN_ID, gold)] } };
}

function isFurnitureKnown(typeId: string): boolean {
  try {
    getFurnitureType(typeId);
    return true;
  } catch {
    return false;
  }
}
