// The dig mine's part of step() (MG-3, docs/PLAN-MINIGAMES.md 1.4): digging a block (one swing per tap, pickaxe cooldown), what a
// broken block drops, cave-in tiles (a crack for DIG_CAVEIN_TELL_MS, then damage if the player still stands there), and the
// glints the skills show. Called from step.ts (which keeps the loot bag and gem helpers); pure, rng and time passed in.

import {
  DIG_CAVEIN_DAMAGE,
  DIG_CAVEIN_TELL_MS,
  DIG_COLS,
  DIG_FILLER_DROP_CHANCE,
  DIG_REACH_PX,
  DUNGEON_BLOCK,
  DUNGEON_TICK_MS,
} from '../config.ts';
import { findPath, type NavGrid } from '../nav.ts';
import { rngInt } from '../rng.ts';
import { xpFor } from '../xp.ts';
import { blastNow, caveTellMsOf, glintBlocksOf, hazardDamageOf, oreQtyOf, pickCooldownOf, rockGemChanceOf, chestGlintBlocksOf } from '../skillRules.ts';
import type { Rank, Rng } from '../types.ts';
import { blockAt, blockCenter, isFloorBlock } from './grid.ts';
import type { Loot } from './loot.ts';
import { getMineBlock, type MineBlockId } from './mineBlocks.ts';
import type { DungeonBlock, DungeonRun } from './run.ts';

/** What step.ts gives the dig code: the run's loot bag (with its popups and left-behind events) and the gem piles. */
export interface DigHooks {
  addLoot(loot: readonly (Loot & { rank?: Rank })[]): void;
  /** Loot for a filler block: goes in only if it fits, never "left behind". */
  addFiller(loot: Loot): void;
  dropGems(rank: Rank, at: { x: number; y: number }): void;
  /** SK-2: run xp (ore dug, a rare block broken). */
  gainXp(xp: number): void;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

export const digCellCenter = (cell: number): { x: number; y: number } => blockCenter(cell % DIG_COLS, Math.floor(cell / DIG_COLS));

/** A tap on a block of the dig mine: aim at it, and dig now if close enough and the pickaxe is ready (else the swing waits for the walk). */
export function digInput(r: DungeonRun, c: number, row: number, now: number, rng: Rng, hooks: DigHooks): void {
  const d = r.dig;
  const p = r.player;
  if (!d || c < 0 || row < 0 || c >= r.map.cols || row >= r.map.rows) return;
  const cell = row * r.map.cols + c;
  const kind = d.kinds[cell];
  if (!kind || getMineBlock(kind).unbreakable) return;
  p.targetDig = cell;
  p.targetEnemyId = null;
  p.pendingHit = false;
  p.targetRockId = null;
  p.pendingSwing = false;
  p.path = [];
  if (now < p.pickReadyAt) {
    p.pendingDig = false; // a tap during the cooldown is ignored (it only keeps walking there)
    return;
  }
  if (dist(p, digCellCenter(cell)) <= DIG_REACH_PX) swing(r, cell, now, rng, hooks);
  else p.pendingDig = true;
}

/** Before the player walks: when the target block is out of reach, find the way to its nearest open neighbour. */
export function digWalkTarget(r: DungeonRun, grid: NavGrid): void {
  const d = r.dig;
  const p = r.player;
  if (!d || p.targetDig == null) return;
  const cell = p.targetDig;
  if (!d.kinds[cell]) {
    p.targetDig = null;
    p.pendingDig = false;
    return;
  }
  const at = digCellCenter(cell);
  if (dist(p, at) <= DIG_REACH_PX || p.path.length > 0) return;
  const c = cell % r.map.cols;
  const row = Math.floor(cell / r.map.cols);
  const options = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    .filter(([dc, dr]) => isFloorBlock(r.map, c + dc, row + dr))
    .map(([dc, dr]) => blockCenter(c + dc, row + dr))
    .sort((a, b) => dist(p, a) - dist(p, b));
  for (const goal of options) {
    const path = findPath(grid, p, goal);
    if (path) {
      p.path = path.slice(1);
      return;
    }
  }
  p.targetDig = null; // no way there
  p.pendingDig = false;
}

/** After the player walked: in reach and a swing waiting = swing. */
export function digAfterWalk(r: DungeonRun, now: number, rng: Rng, hooks: DigHooks): void {
  const d = r.dig;
  const p = r.player;
  if (!d || p.targetDig == null || !d.kinds[p.targetDig]) return;
  if (dist(p, digCellCenter(p.targetDig)) > DIG_REACH_PX) return;
  p.path = [];
  if (p.pendingDig && now >= p.pickReadyAt) swing(r, p.targetDig, now, rng, hooks);
}

/** Blaster: the stone and dirt blocks around a cell turn to floor at once (nothing drops). */
function blast(r: DungeonRun, cell: number): void {
  const d = r.dig!;
  const c0 = cell % DIG_COLS;
  const r0 = Math.floor(cell / DIG_COLS);
  const blocks: DungeonBlock[] = r.map.blocks.slice();
  const kinds = d.kinds.slice();
  let any = false;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc;
      const rr = r0 + dr;
      if ((dc === 0 && dr === 0) || c < 0 || c >= DIG_COLS || rr < 0) continue;
      const i = rr * DIG_COLS + c;
      const k = kinds[i];
      if (k !== 'stone' && k !== 'dirt') continue;
      kinds[i] = '';
      blocks[i] = 'floor';
      delete d.hits[i];
      any = true;
      r.events.push({ t: 'dig_broken', cell: i, kind: k });
    }
  }
  if (!any) return;
  d.kinds = kinds;
  r.map = { ...r.map, blocks };
  d.rev += 1;
}

function swing(r: DungeonRun, cell: number, now: number, rng: Rng, hooks: DigHooks): void {
  const d = r.dig!;
  const p = r.player;
  const kind = d.kinds[cell] as MineBlockId;
  const b = getMineBlock(kind);
  p.pickReadyAt = now + pickCooldownOf(p.skill);
  p.pendingDig = false;
  if (b.hard && !p.minesMithril) {
    r.events.push({ t: 'dig_too_hard', cell });
    p.targetDig = null;
    return;
  }
  // Blaster: every Nth swing also breaks the loose stone and dirt in the 3 x 3 around (no ore from those).
  d.swings = (d.swings ?? 0) + 1;
  if (blastNow(d.swings, p.skill)) blast(r, cell);
  const strong = (p.skill?.doubleStrikePct ?? 0) > 0 && rng() < (p.skill?.doubleStrikePct ?? 0) / 100; // Double strike
  const total = (d.hits[cell] ?? 0) + p.hitsPerSwing * (strong ? 2 : 1);
  d.rev += 1;
  if (total < b.hits) {
    d.hits[cell] = total;
    r.events.push({ t: 'dig', cell, hits: total });
    return;
  }
  // Broken: the block becomes floor (a new kinds array and a new map: the old ones stay as they were).
  delete d.hits[cell];
  d.kinds = d.kinds.map((k, i) => (i === cell ? '' : k));
  const blocks: DungeonBlock[] = r.map.blocks.slice();
  blocks[cell] = 'floor';
  r.map = { ...r.map, blocks };
  d.rare = d.rare.filter((i) => i !== cell);
  p.targetDig = null;
  r.events.push({ t: 'dig_broken', cell, kind });
  if (!b.drop) return;
  const at = digCellCenter(cell);
  if (b.filler) {
    if (rng() < DIG_FILLER_DROP_CHANCE) hooks.addFiller({ item: b.drop.item, qty: 1 });
    return;
  }
  const qty = oreQtyOf(rngInt(rng, b.drop.min, b.drop.max), p.skill, rng);
  const loot: (Loot & { rank?: Rank })[] = [{ item: b.drop.item, qty, ...(b.rank !== 'common' ? { rank: b.rank } : {}) }];
  if (rng() < rockGemChanceOf(p.skill)) loot.push({ item: 'gem', qty: 1 });
  hooks.addLoot(loot);
  hooks.gainXp(b.rank === 'common' ? xpFor({ t: 'ore', qty }) : xpFor({ t: 'rare_block' }));
  if (b.gemRank) hooks.dropGems(b.gemRank, at);
}

/** One tick of the cave-in tiles. Returns true when the player was hurt (step.ts checks hp). */
export function digHazardTick(r: DungeonRun): void {
  const d = r.dig;
  const p = r.player;
  if (!d || d.hazards.length === 0) return;
  const here = blockAt(p);
  for (const h of d.hazards) {
    const on = here.c === h.c && here.r === h.r;
    if (h.state === 'armed' && on) {
      h.state = 'cracking';
      h.crackMs = caveTellMsOf(p.skill); // Sure footing
      d.rev += 1;
      r.events.push({ t: 'cave_crack', cell: h.r * DIG_COLS + h.c });
    } else if (h.state === 'cracking') {
      h.crackMs = Math.max(0, h.crackMs - DUNGEON_TICK_MS);
      if (h.crackMs > 0) continue;
      h.state = 'fallen';
      d.rev += 1;
      if (on) {
        const damage = hazardDamageOf(DIG_CAVEIN_DAMAGE, p.skill);
        p.hp -= damage;
        if (p.hp <= 0 && (p.skill?.lastStand ?? 0) > 0 && !p.lastStandUsed) {
          p.hp = 1;
          p.lastStandUsed = true;
        }
        r.lastHitBy = 'cave-in';
        r.events.push({ t: 'cave_in', cell: h.r * DIG_COLS + h.c, damage });
      }
    }
  }
}

/** The rare blocks that glint now: unbroken rare cells within the glint radius (blocks) of the player. */
export function glintingCells(r: DungeonRun): number[] {
  const d = r.dig;
  if (!d) return [];
  const reach = glintBlocksOf(r.player.skill) * DUNGEON_BLOCK;
  return d.rare.filter((cell) => dist(r.player, digCellCenter(cell)) <= reach);
}

/** Treasure sense (crypt): closed chests within the chest glint radius shine through the dark (none without the skill). */
export function glintingChests(r: DungeonRun): number[] {
  const reach = chestGlintBlocksOf(r.player.skill) * DUNGEON_BLOCK;
  if (reach <= 0) return [];
  return r.chests.filter((c) => !c.opened && dist(r.player, c) <= reach).map((c) => c.id);
}
