import { describe, expect, it } from 'vitest';
import { MINE_LANTERN_MS, PICKAXE_COOLDOWN_MS, ROCK_HITS, type RockKind } from '../config.ts';
import { createNewPlayer } from '../newPlayer.ts';
import { applyChange } from '../ledger.ts';
import { seededRng } from '../rng.ts';
import { ledgerGold, ledgerMaterials } from '../testState.ts';
import type { GameState } from '../gameState.ts';
import type { GearId } from '../types.ts';
import { finishRun, startMine } from './bank.ts';
import { generateMine, NO_EXIT } from './generate.ts';
import { blockCenter, isFloorBlock } from './grid.ts';
import type { DungeonRun, Rock } from './run.ts';
import { step } from './step.ts';
import { enemyAt, testRun } from './testRun.ts';

const start = blockCenter(5, 5);
const rockAt = (id: number, kind: RockKind, dx = 30): Rock => ({ id, kind, hitsLeft: ROCK_HITS[kind], x: start.x + dx, y: start.y });

function mineRun(rocks: Rock[], gear: GearId[] = []): DungeonRun {
  const r = testRun({ at: start, gear });
  const steel = gear.includes('steel_pickaxe');
  return { ...r, place: 'mine', rocks, lanternEndsAt: MINE_LANTERN_MS, player: { ...r.player, hitsPerSwing: steel ? 2 : 1, minesMithril: steel } };
}

/** Taps a rock until it breaks (one tap per cooldown); returns the run and the number of swings. */
function mineOut(r: DungeonRun, id: number): { run: DungeonRun; swings: number; tooHard: boolean } {
  const rng = seededRng(5);
  let swings = 0;
  let tooHard = false;
  for (let k = 0; k < 40 && r.rocks.some((x) => x.id === id); k++) {
    r = step(r, [{ t: 'click_rock', id }], PICKAXE_COOLDOWN_MS, rng);
    swings += r.events.filter((e) => e.t === 'swing').length;
    tooHard ||= r.events.some((e) => e.t === 'too_hard');
    if (tooHard) break;
  }
  return { run: r, swings, tooHard };
}

const level3 = (): GameState => {
  const s = createNewPlayer(undefined, 0);
  return { ...s, player: { ...s.player, level: 3, xp: 40 } };
};

describe('the mine layout (section 10c)', () => {
  it('the same seed gives the same mine; a small layout with rocks, weak enemies and no exit', () => {
    expect(generateMine(42, 1)).toEqual(generateMine(42, 1));
    expect(generateMine(42, 1)).not.toEqual(generateMine(43, 1));
    for (let seed = 1; seed <= 60; seed++) {
      const m = generateMine(seed, 1);
      expect(m.map.rooms.length).toBeGreaterThanOrEqual(2);
      expect(m.map.rooms.length).toBeLessThanOrEqual(3);
      expect(m.map.exit).toEqual(NO_EXIT);
      expect(m.chests).toEqual([]);
      expect(m.rocks.length).toBeGreaterThanOrEqual(4);
      for (const e of m.enemies) expect(['slime', 'bat']).toContain(e.kind);
      // 0 to 1 per room, never in the spawn room.
      expect(m.enemies.length).toBeLessThanOrEqual(m.map.rooms.length - 1);
      for (const rock of m.rocks) {
        expect(isFloorBlock(m.map, Math.floor(rock.x / 32), Math.floor(rock.y / 32))).toBe(true);
        expect(rock.kind).not.toBe('mithril');
      }
    }
  });

  it('mithril rocks only from visit 5 on', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const r of generateMine(seed, 5).rocks) kinds.add(r.kind);
    expect([...kinds].sort()).toEqual(['copper', 'iron', 'mithril']);
  });
});

describe('mining', () => {
  it('rocks need the right number of hits; the steel pickaxe counts double', () => {
    expect(mineOut(mineRun([rockAt(1, 'copper')]), 1).swings).toBe(3);
    expect(mineOut(mineRun([rockAt(1, 'iron')]), 1).swings).toBe(5);
    expect(mineOut(mineRun([rockAt(1, 'copper')], ['steel_pickaxe']), 1).swings).toBe(2);
    expect(mineOut(mineRun([rockAt(1, 'iron')], ['steel_pickaxe']), 1).swings).toBe(3);
    expect(mineOut(mineRun([rockAt(1, 'mithril')], ['steel_pickaxe']), 1).swings).toBe(4);
  });

  it('mithril rocks need the steel pickaxe', () => {
    const r = mineOut(mineRun([rockAt(1, 'mithril')]), 1);
    expect(r.tooHard).toBe(true);
    expect(r.run.rocks[0]?.hitsLeft).toBe(8);
  });

  it('a broken rock drops 1 to 2 of its ore (and sometimes a gem); the walk goes there first', () => {
    const qty = new Set<number>();
    let gems = 0;
    for (let seed = 1; seed <= 300; seed++) {
      let r = mineRun([rockAt(1, 'copper', 120)], ['steel_pickaxe']);
      const rng = seededRng(seed);
      for (let k = 0; k < 30 && r.rocks.length > 0; k++) r = step(r, [{ t: 'click_rock', id: 1 }], PICKAXE_COOLDOWN_MS, rng);
      expect(r.rocks).toEqual([]);
      const ore = r.bag.slots.find((s) => s.kind === 'material' && s.id === 'copper_ore');
      qty.add(ore && ore.kind === 'material' ? ore.qty : 0);
      if (r.bag.slots.some((s) => s.kind === 'material' && s.id === 'gem')) gems++;
    }
    expect([...qty].sort()).toEqual([1, 2]);
    expect(gems).toBeGreaterThan(3);
    expect(gems).toBeLessThan(35);
  });

  it('a tap during the 400 ms pickaxe cooldown is ignored', () => {
    let r = mineRun([rockAt(1, 'iron')]);
    const rng = seededRng(1);
    r = step(r, [{ t: 'click_rock', id: 1 }], 0, rng);
    r = step(r, [{ t: 'click_rock', id: 1 }], 0, rng);
    expect(r.rocks[0]?.hitsLeft).toBe(4);
    r = step(r, [], PICKAXE_COOLDOWN_MS, rng);
    r = step(r, [{ t: 'click_rock', id: 1 }], 0, rng);
    expect(r.rocks[0]?.hitsLeft).toBe(3);
  });
});

describe('ending a visit', () => {
  const withOre = (r: DungeonRun): DungeonRun => ({
    ...r,
    bag: { slots: [{ kind: 'material', id: 'copper_ore', qty: 7 }, { kind: 'material', id: 'iron_ore', qty: 3 }, { kind: 'material', id: 'gem', qty: 1 }], gold: 0 },
  });

  it('the lantern ends the visit and keeps all ore', () => {
    let r = withOre(mineRun([]));
    r = step(r, [], MINE_LANTERN_MS - 100, seededRng(1));
    expect(r.status).toBe('active');
    r = step(r, [], 100, seededRng(1));
    expect(r.status).toBe('left');
    expect(r.events.map((e) => e.t)).toEqual(['lantern_out', 'left']);
    expect(r.banked.slots).toEqual(withOre(mineRun([])).bag.slots);
    expect(r.lost.slots).toEqual([]);
  });

  it('leaving early is always allowed and keeps everything', () => {
    const r = step(withOre(mineRun([])), [{ t: 'leave' }], 0, seededRng(1));
    expect(r.status).toBe('left');
    expect(r.banked.slots).toHaveLength(3);
    // The crypt has no Leave button: there the exit is the way out.
    expect(step(testRun(), [{ t: 'leave' }], 0, seededRng(1)).status).toBe('active');
  });

  it('0 hp loses exactly half of each ore (rounded down) and nothing else', () => {
    let r = withOre(mineRun([]));
    r = { ...r, player: { ...r.player, hp: 1, potions: 2 }, enemies: [enemyAt(1, start.x + 20, start.y, 'bat', 99)] };
    r = step(r, [], 5000, seededRng(1));
    expect(r.status).toBe('dead');
    const mat = (bag: DungeonRun['bag'], id: string): number =>
      bag.slots.reduce((a, s) => a + (s.kind === 'material' && s.id === id ? s.qty : 0), 0);
    expect([mat(r.banked, 'copper_ore'), mat(r.banked, 'iron_ore'), mat(r.banked, 'gem')]).toEqual([4, 2, 1]);
    expect([mat(r.lost, 'copper_ore'), mat(r.lost, 'iron_ore'), mat(r.lost, 'gem')]).toEqual([3, 1, 0]);
    expect(r.player.potions).toBe(2);
  });

  it('a visit is free, opens at level 3, counts visits, and banks the ore through the ledger', () => {
    expect(startMine(createNewPlayer(undefined, 0), 1)).toBeNull();
    const s0 = applyChange(level3(), { reason: 'debug', gold: 0 }, 0)!;
    const started = startMine({ ...s0, player: { ...s0.player, potions: 2 } }, 9)!;
    expect(started.run.place).toBe('mine');
    expect(started.state.player).toMatchObject({ mineVisits: 1, potions: 0 });
    expect(started.state.player.wallet.gold).toBe(s0.player.wallet.gold);
    const left = step(withOre(started.run), [{ t: 'leave' }], 0, seededRng(1));
    const home = finishRun(started.state, left, 5)!;
    expect(home.player.materials).toMatchObject({ copper_ore: 7, iron_ore: 3, gem: 1 });
    expect(home.player.potions).toBe(2);
    expect(home.ledger.at(-1)).toMatchObject({ reason: 'mine_bank' });
    expect(ledgerGold(home)).toBe(home.player.wallet.gold);
    expect(ledgerMaterials(home)).toEqual(home.player.materials);
  });
});
