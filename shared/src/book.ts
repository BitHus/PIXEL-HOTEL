// The collection book (step 9e). Pure: what is in it, where each thing comes from, how far each
// tab is filled and the rewards for that (shared/data/bookRewards.json). What the player has seen
// is Player.seen (seen.ts).

import rewardData from '../data/bookRewards.json';
import { applyChange } from './ledger.ts';
import { RECIPES } from './crafting.ts';
import { isCatchId, CATCH_TYPES } from './fish.ts';
import { ENEMY_TABLES, LOOT_TABLES, getLootTable, type EnemyTableId } from './dungeon/loot.ts';
import { BLOCK_TYPES } from './blockTypes.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { CROP_TYPES, MATERIAL_TYPES } from './materials.ts';
import { enemyKey } from './seen.ts';
import { SPLICE_RECIPES, SPLICE_SEEDS, isSpliceResult, pairKey } from './splice.ts';
import { BOOK_GEM_RANK } from './config.ts';
import { gemDrop } from './gems.ts';
import type { Rank, Rng, SeenMap } from './types.ts';

export type BookTab = 'materials' | 'blocks' | 'furniture' | 'food' | 'fish' | 'enemies' | 'splice';
export const BOOK_TABS: readonly BookTab[] = ['materials', 'blocks', 'furniture', 'food', 'fish', 'enemies', 'splice'];
export const BOOK_TAB_NAMES: Record<BookTab, string> = { materials: 'Materials', blocks: 'Blocks', furniture: 'Furniture', food: 'Food and crops', fish: 'Fish', enemies: 'Enemies', splice: 'Splice' };

export const ENEMY_NAMES: Record<EnemyTableId, string> = { slime: 'Slime', bat: 'Bat', skeleton: 'Skeleton', mimic: 'Mimic', bone_king: 'Bone King' };
/** The Book's rank for an enemy type (how hard it is to meet). */
const ENEMY_RANKS: Record<EnemyTableId, Rank> = { slime: 'common', bat: 'common', skeleton: 'rare', mimic: 'ultra_rare', bone_king: 'legendary' };

export interface BookEntry {
  /** The key in Player.seen: a material id, a furniture type id or 'enemy:<type>'. */
  key: string;
  /** The material id, furniture type id or enemy type (for the icon). */
  id: string;
  kind: 'material' | 'furniture' | 'enemy' | 'recipe';
  name: string;
  rank: Rank;
  /** Where it comes from: "Drops from: Slime", "Catalog", "Crafted", "Farm", ... */
  source: string;
  /** Enemies: the ids of their drops, lowest rank first. */
  drops?: string[];
  /** Fish: the size range of a catch in cm (the Book shows the biggest caught). */
  cm?: { min: number; max: number };
  /** Splice recipes: the two ingredients (seed ids); `id` is the result. */
  recipe?: { a: string; b: string };
}

/** The enemy types whose table drops this item. */
function droppedBy(id: string): EnemyTableId[] {
  return ENEMY_TABLES.filter((t) => getLootTable(t).drops.some((d) => d.item === id));
}

const ORES = ['copper_ore', 'iron_ore', 'mithril_ore', 'gem'];
const TREE_DROPS = ['wood', 'resin', 'amber', 'golden_acorn'];
const BARS = ['copper_bar', 'iron_bar', 'mithril_bar'];
const START_FURNITURE = ['counter', 'stall_table'];
/** Furniture and clothes only a splice seed grows (their source is "Splicing"). */
const FURNITURE_GROWN = new Set(SPLICE_SEEDS.flatMap((s) => (s.grows.kind === 'furniture' ? [s.grows.id] : [])));
const CLOTHING_GROWN = new Set(SPLICE_SEEDS.flatMap((s) => (s.grows.kind === 'clothing' ? [s.grows.id] : [])));

/** Where a material or furniture type comes from, as one short line. */
export function sourceOf(id: string): string {
  const parts: string[] = [];
  const enemies = droppedBy(id);
  if (enemies.length > 0) parts.push(`Drops from: ${enemies.map((e) => ENEMY_NAMES[e]).join(', ')}`);
  if (id === 'throne_piece') parts.push(`Drops from: ${ENEMY_NAMES.bone_king}`);
  if (id === 'glowcap_spore' || LOOT_TABLES.some((t) => (t.id === 'wooden_chest' || t.id === 'golden_chest') && t.drops.some((d) => d.item === id))) parts.push('Dungeon chests');
  if (ORES.includes(id)) parts.push('Mine');
  if (TREE_DROPS.includes(id)) parts.push('Woodcutting');
  if (isCatchId(id)) parts.push('Fishing');
  if (BARS.includes(id)) parts.push('Forge');
  const material = MATERIAL_TYPES.find((m) => m.id === id);
  if (material?.group === 'seed' && id !== 'glowcap_spore' && !isSpliceResult(id) && CROP_TYPES.some((c) => c.seed === id && c.seedPrice !== null)) parts.push('Catalog');
  if (material?.group === 'seed' && BLOCK_TYPES.some((b) => b.seedId === id)) parts.push('Punching blocks');
  if (isSpliceResult(id) || FURNITURE_GROWN.has(id) || CLOTHING_GROWN.has(id) || (material?.group === 'seed' && (SPLICE_SEEDS.some((s) => s.id === id) || CROP_TYPES.some((c) => c.seed === id && c.spliceOnly)))) parts.push('Splicing');
  if (material?.group === 'crop') parts.push('Farm');
  if (material?.group === 'food') parts.push('Cooked');
  if (material?.group === 'drink') parts.push(/_(aged|vintage)$/.test(id) ? 'Ripened in a cask' : 'Brewed');
  if (material?.group === 'block') {
    if (BLOCK_TYPES.find((b) => b.id === id)?.inCatalog) parts.push('Catalog');
    parts.push('Punching blocks');
  }
  const furniture = FURNITURE_TYPES.find((f) => f.id === id);
  if (furniture?.inCatalog) parts.push('Catalog');
  if (RECIPES.some((r) => r.makesKind === 'furniture' && r.makes === id)) parts.push('Crafted');
  if (START_FURNITURE.includes(id)) parts.push('Your tavern');
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
}

/** The entries of a tab, in data order. */
export function bookEntries(tab: BookTab): BookEntry[] {
  if (tab === 'splice') {
    return SPLICE_RECIPES.map((r) => {
      const m = MATERIAL_TYPES.find((x) => x.id === r.result)!;
      return { key: pairKey(r.a, r.b), id: r.result, kind: 'recipe' as const, name: m.name, rank: m.rank, source: 'Splicing', recipe: { a: r.a, b: r.b } };
    });
  }
  if (tab === 'enemies') {
    return ENEMY_TABLES.map((t) => ({ key: enemyKey(t), id: t, kind: 'enemy' as const, name: ENEMY_NAMES[t], rank: ENEMY_RANKS[t], source: t === 'mimic' ? 'Dungeon chests' : 'Dungeon', drops: getLootTable(t).drops.map((d) => d.item) }));
  }
  if (tab === 'furniture') return FURNITURE_TYPES.map((f) => ({ key: f.id, id: f.id, kind: 'furniture' as const, name: f.name, rank: f.rank, source: sourceOf(f.id) }));
  if (tab === 'fish') {
    return CATCH_TYPES.map((c) => ({ key: c.id, id: c.id, kind: 'material' as const, name: c.name, rank: c.rank, source: sourceOf(c.id), ...(c.kind === 'fish' ? { cm: { min: c.minCm ?? 0, max: c.maxCm ?? 0 } } : {}) }));
  }
  return MATERIAL_TYPES.filter((m) => (tab === 'materials' ? m.group === 'material' : tab === 'blocks' ? m.group === 'block' : tab === 'food' && ['seed', 'crop', 'food', 'drink'].includes(m.group))).map((m) => ({ key: m.id, id: m.id, kind: 'material' as const, name: m.name, rank: m.rank, source: sourceOf(m.id) }));
}

export interface BookProgress {
  found: number;
  total: number;
}

/** `splices` = Player.splicesFound: the Splice tab counts those (its entries are recipes, not finds). */
export function bookProgress(seen: SeenMap, tab: BookTab, splices: readonly string[] = []): BookProgress {
  const entries = bookEntries(tab);
  return { found: entries.filter((e) => (tab === 'splice' ? splices.includes(e.key) : seen[e.key] !== undefined)).length, total: entries.length };
}

/** All tabs together, and the whole book in percent (rounded down, 100 only when complete). */
export function bookTotal(seen: SeenMap, splices: readonly string[] = []): BookProgress & { percent: number } {
  const all = BOOK_TABS.map((t) => bookProgress(seen, t, splices));
  const found = all.reduce((a, p) => a + p.found, 0);
  const total = all.reduce((a, p) => a + p.total, 0);
  return { found, total, percent: total > 0 ? Math.floor((found * 100) / total) : 0 };
}

/** The entries first seen after the Book was last opened (the "New!" marks and the button's dot). */
export function newEntries(seen: SeenMap, openedAt: number): string[] {
  return BOOK_TABS.filter((t) => t !== 'splice').flatMap((t) => bookEntries(t)).filter((e) => (seen[e.key]?.firstSeenAt ?? -Infinity) > openedAt).map((e) => e.key);
}

/** A reward for filling a tab: gold now, and a hat later (step 9g fills the hats in; null until then). */
export interface BookReward {
  percent: number;
  gold: number;
  hat: string | null;
}

export const BOOK_REWARDS = rewardData as Record<BookTab, BookReward[]>;

export function rewardKey(tab: BookTab, percent: number): string {
  return `${tab}:${percent}`;
}

export type RewardState = 'locked' | 'ready' | 'taken';

/** Every reward of a tab with its state: locked (not far enough), ready to claim, or taken. */
export function bookRewards(player: { seen: SeenMap; bookRewards: readonly string[]; splicesFound?: readonly string[] }, tab: BookTab): (BookReward & { state: RewardState })[] {
  const p = bookProgress(player.seen, tab, player.splicesFound ?? []);
  return BOOK_REWARDS[tab].map((r) => ({
    ...r,
    state: player.bookRewards.includes(rewardKey(tab, r.percent)) ? 'taken' : p.total > 0 && p.found * 100 >= r.percent * p.total ? 'ready' : 'locked',
  }));
}

/** Takes a reward that is ready: the gold through the ledger (reason 'book_reward'). Null if it is not ready. */
export function claimBookReward(state: GameState, tab: BookTab, percent: number, at: number, rng: Rng): GameState | null {
  const reward = bookRewards(state.player, tab).find((r) => r.percent === percent);
  if (!reward || reward.state !== 'ready') return null;
  // Gems (step BG4): the tier's rank (25 common ... 100 legendary) sets the amount.
  const gems = gemDrop('book', BOOK_GEM_RANK[percent as keyof typeof BOOK_GEM_RANK] ?? 'common', rng);
  const next = applyChange(state, { reason: 'book_reward', gold: reward.gold, ...(gems > 0 ? { gems } : {}), ...(reward.hat ? { addClothing: [reward.hat] } : {}), note: `book ${rewardKey(tab, percent)}` }, at);
  if (!next) return null;
  return { ...next, player: { ...next.player, bookRewards: [...next.player.bookRewards, rewardKey(tab, percent)] } };
}

/** The Book was opened: nothing is "New!" any more. */
export function openBook(state: GameState, at: number): GameState {
  return { ...state, player: { ...state.player, bookOpenedAt: at } };
}
