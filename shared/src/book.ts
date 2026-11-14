// The collection book (step 9e). Pure: what is in it, where each thing comes from, how far each
// tab is filled and the rewards for that (shared/data/bookRewards.json). What the player has seen
// is Player.seen (seen.ts).

import rewardData from '../data/bookRewards.json';
import { applyChange } from './ledger.ts';
import { RECIPES } from './crafting.ts';
import { ENEMY_TABLES, LOOT_TABLES, getLootTable, type EnemyTableId } from './dungeon/loot.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { MATERIAL_TYPES } from './materials.ts';
import { enemyKey } from './seen.ts';
import type { Rank, SeenMap } from './types.ts';

export type BookTab = 'materials' | 'furniture' | 'food' | 'enemies';
export const BOOK_TABS: readonly BookTab[] = ['materials', 'furniture', 'food', 'enemies'];
export const BOOK_TAB_NAMES: Record<BookTab, string> = { materials: 'Materials', furniture: 'Furniture', food: 'Food and crops', enemies: 'Enemies' };

export const ENEMY_NAMES: Record<EnemyTableId, string> = { slime: 'Slime', bat: 'Bat', skeleton: 'Skeleton', mimic: 'Mimic', bone_king: 'Bone King' };
/** The Book's rank for an enemy type (how hard it is to meet). */
const ENEMY_RANKS: Record<EnemyTableId, Rank> = { slime: 'common', bat: 'common', skeleton: 'rare', mimic: 'ultra_rare', bone_king: 'legendary' };

export interface BookEntry {
  /** The key in Player.seen: a material id, a furniture type id or 'enemy:<type>'. */
  key: string;
  /** The material id, furniture type id or enemy type (for the icon). */
  id: string;
  kind: 'material' | 'furniture' | 'enemy';
  name: string;
  rank: Rank;
  /** Where it comes from: "Drops from: Slime", "Catalog", "Crafted", "Farm", ... */
  source: string;
  /** Enemies: the ids of their drops, lowest rank first. */
  drops?: string[];
}

/** The enemy types whose table drops this item. */
function droppedBy(id: string): EnemyTableId[] {
  return ENEMY_TABLES.filter((t) => getLootTable(t).drops.some((d) => d.item === id));
}

const ORES = ['copper_ore', 'iron_ore', 'mithril_ore', 'gem'];
const BARS = ['copper_bar', 'iron_bar', 'mithril_bar'];
const START_FURNITURE = ['counter', 'stall_table'];

/** Where a material or furniture type comes from, as one short line. */
export function sourceOf(id: string): string {
  const parts: string[] = [];
  const enemies = droppedBy(id);
  if (enemies.length > 0) parts.push(`Drops from: ${enemies.map((e) => ENEMY_NAMES[e]).join(', ')}`);
  if (id === 'throne_piece') parts.push(`Drops from: ${ENEMY_NAMES.bone_king}`);
  if (id === 'glowcap_spore' || LOOT_TABLES.some((t) => (t.id === 'wooden_chest' || t.id === 'golden_chest') && t.drops.some((d) => d.item === id))) parts.push('Dungeon chests');
  if (ORES.includes(id)) parts.push('Mine');
  if (BARS.includes(id)) parts.push('Forge');
  const material = MATERIAL_TYPES.find((m) => m.id === id);
  if (material?.group === 'seed' && id !== 'glowcap_spore') parts.push('Catalog');
  if (material?.group === 'crop') parts.push('Farm');
  if (material?.group === 'food') parts.push('Cooked');
  const furniture = FURNITURE_TYPES.find((f) => f.id === id);
  if (furniture?.inCatalog) parts.push('Catalog');
  if (RECIPES.some((r) => r.makesKind === 'furniture' && r.makes === id)) parts.push('Crafted');
  if (START_FURNITURE.includes(id)) parts.push('Your shop');
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
}

/** The entries of a tab, in data order. */
export function bookEntries(tab: BookTab): BookEntry[] {
  if (tab === 'enemies') {
    return ENEMY_TABLES.map((t) => ({ key: enemyKey(t), id: t, kind: 'enemy' as const, name: ENEMY_NAMES[t], rank: ENEMY_RANKS[t], source: t === 'mimic' ? 'Dungeon chests' : 'Dungeon', drops: getLootTable(t).drops.map((d) => d.item) }));
  }
  if (tab === 'furniture') return FURNITURE_TYPES.map((f) => ({ key: f.id, id: f.id, kind: 'furniture' as const, name: f.name, rank: f.rank, source: sourceOf(f.id) }));
  return MATERIAL_TYPES.filter((m) => (tab === 'materials' ? m.group === 'material' : m.group !== 'material')).map((m) => ({ key: m.id, id: m.id, kind: 'material' as const, name: m.name, rank: m.rank, source: sourceOf(m.id) }));
}

export interface BookProgress {
  found: number;
  total: number;
}

export function bookProgress(seen: SeenMap, tab: BookTab): BookProgress {
  const entries = bookEntries(tab);
  return { found: entries.filter((e) => seen[e.key] !== undefined).length, total: entries.length };
}

/** All tabs together, and the whole book in percent (rounded down, 100 only when complete). */
export function bookTotal(seen: SeenMap): BookProgress & { percent: number } {
  const all = BOOK_TABS.map((t) => bookProgress(seen, t));
  const found = all.reduce((a, p) => a + p.found, 0);
  const total = all.reduce((a, p) => a + p.total, 0);
  return { found, total, percent: total > 0 ? Math.floor((found * 100) / total) : 0 };
}

/** The entries first seen after the Book was last opened (the "New!" marks and the button's dot). */
export function newEntries(seen: SeenMap, openedAt: number): string[] {
  return BOOK_TABS.flatMap((t) => bookEntries(t)).filter((e) => (seen[e.key]?.firstSeenAt ?? -Infinity) > openedAt).map((e) => e.key);
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
export function bookRewards(player: { seen: SeenMap; bookRewards: readonly string[] }, tab: BookTab): (BookReward & { state: RewardState })[] {
  const p = bookProgress(player.seen, tab);
  return BOOK_REWARDS[tab].map((r) => ({
    ...r,
    state: player.bookRewards.includes(rewardKey(tab, r.percent)) ? 'taken' : p.total > 0 && p.found * 100 >= r.percent * p.total ? 'ready' : 'locked',
  }));
}

/** Takes a reward that is ready: the gold through the ledger (reason 'book_reward'). Null if it is not ready. */
export function claimBookReward(state: GameState, tab: BookTab, percent: number, at: number): GameState | null {
  const reward = bookRewards(state.player, tab).find((r) => r.percent === percent);
  if (!reward || reward.state !== 'ready') return null;
  const next = applyChange(state, { reason: 'book_reward', gold: reward.gold, note: `book ${rewardKey(tab, percent)}` }, at);
  if (!next) return null;
  return { ...next, player: { ...next.player, bookRewards: [...next.player.bookRewards, rewardKey(tab, percent)] } };
}

/** The Book was opened: nothing is "New!" any more. */
export function openBook(state: GameState, at: number): GameState {
  return { ...state, player: { ...state.player, bookOpenedAt: at } };
}
