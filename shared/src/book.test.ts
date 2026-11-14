import { describe, expect, it } from 'vitest';
import { BOOK_REWARD_STEPS, RARE_DROP_CHANCE } from './config.ts';
import { BOOK_REWARDS, BOOK_TABS, bookEntries, bookProgress, bookRewards, bookTotal, claimBookReward, newEntries, openBook, sourceOf } from './book.ts';
import { craft, getRecipe } from './crafting.ts';
import { buyCatalog } from './economy.ts';
import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { MATERIAL_TYPES } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { addSeen, enemyKey, isSeen, ownedFinds, seenCount } from './seen.ts';
import { putOnShelf, takeFromShelf } from './shop.ts';
import { finishRun, startRun } from './dungeon/bank.ts';
import { step } from './dungeon/step.ts';
import { testRun } from './dungeon/testRun.ts';
import { makeEnemy } from './dungeon/generate.ts';
import { FURNITURE_TYPES } from './furniture.ts';

const fresh = (): GameState => createNewPlayer(undefined, 1000);

describe('the seen list (Player.seen, step 9e)', () => {
  it('a new player has seen what they start with', () => {
    const s = fresh();
    expect(Object.keys(s.player.seen).sort()).toEqual(['cloth', 'counter', 'stall_table', 'wood']);
    expect(s.player.seen.wood).toEqual({ count: 4, firstSeenAt: 1000 });
    expect(s.player.seen.counter).toEqual({ count: 1, firstSeenAt: 1000 });
    expect(s.player.bookRewards).toEqual([]);
  });

  it('every gain through the ledger counts, with the total and the first time', () => {
    let s = fresh();
    s = applyChange(s, { reason: 'debug', materials: { bone: 3 } }, 2000)!;
    s = applyChange(s, { reason: 'debug', materials: { bone: 2, wood: -1 } }, 3000)!;
    expect(s.player.seen.bone).toEqual({ count: 5, firstSeenAt: 2000 });
    // Using things up never lowers the count.
    expect(seenCount(s.player.seen, 'wood')).toBe(4);
    s = applyChange(s, { reason: 'debug', gold: 500 }, 3500)!;
    const bought = buyCatalog(s, 'chair', 4000)!;
    expect(bought.player.seen.chair).toEqual({ count: 1, firstSeenAt: 4000 });
  });

  it('crafting counts what is made; a shop slot does not count again', () => {
    let s = applyChange(fresh(), { reason: 'debug', materials: { bone: 6 } }, 2000)!;
    s = craft(getRecipe('bone_chair'), s, 5000)!;
    expect(s.player.seen.bone_chair).toEqual({ count: 1, firstSeenAt: 5000 });
    const table = s.items.find((i) => i.typeId === 'stall_table')!;
    const before = seenCount(s.player.seen, 'wood');
    s = putOnShelf(s, { shelfUid: table.uid, index: 0 }, { kind: 'material', id: 'wood' }, 3, 6000)!;
    s = takeFromShelf(s, { shelfUid: table.uid, index: 0 }, 7000)!;
    expect(seenCount(s.player.seen, 'wood')).toBe(before);
    s = putOnShelf(s, { shelfUid: table.uid, index: 1 }, { kind: 'furniture', typeId: 'bone_chair' }, 30, 8000)!;
    s = takeFromShelf(s, { shelfUid: table.uid, index: 1 }, 9000)!;
    expect(seenCount(s.player.seen, 'bone_chair')).toBe(1);
  });

  it('a run: banked loot counts, food brought back does not, kills and enemies met do (also after death)', () => {
    let s = applyChange(fresh(), { reason: 'debug', materials: { roasted_turnip: 2 } }, 1500)!;
    expect(seenCount(s.player.seen, 'roasted_turnip')).toBe(2);
    const started = startRun(s, 5, 2000, 1, ['roasted_turnip', 'roasted_turnip'])!;
    s = started.state;
    // A slime right next to the player, killed with one strong hit; another one far away, never met.
    let run = testRun({ at: { x: 80, y: 80 }, enemies: [{ ...makeEnemy(1, 'slime', 1, 100, 80), hp: 1 }] });
    run = { ...run, player: { ...run.player, food: ['roasted_turnip', 'roasted_turnip'] } };
    const rng = seededRng(3);
    run = step(run, [{ t: 'click_enemy', id: 1 }], 100, rng);
    for (let k = 0; k < 20 && run.enemies.length > 0; k++) run = step(run, [{ t: 'click_enemy', id: 1 }], 400, rng);
    expect(run.enemies).toHaveLength(0);
    expect(run.kills).toEqual({ slime: 1 });
    expect(run.met).toEqual(['slime']);
    run = { ...run, status: 'dead', banked: { slots: [{ kind: 'material', id: 'slime_gel', qty: 2 }], gold: 0 } };
    const done = finishRun(s, run, 9000)!;
    expect(done.player.seen[enemyKey('slime')]).toEqual({ count: 1, firstSeenAt: 9000 });
    expect(done.player.seen.slime_gel).toEqual({ count: 2, firstSeenAt: 9000 });
    expect(seenCount(done.player.seen, 'roasted_turnip')).toBe(2);
    expect(isSeen(done.player.seen, enemyKey('bat'))).toBe(false);
  });

  it('an enemy that notices the player is met, without a kill', () => {
    let run = testRun({ at: { x: 80, y: 80 }, enemies: [makeEnemy(1, 'bat', 1, 140, 80)] });
    run = step(run, [], 100, seededRng(1));
    expect(run.met).toEqual(['bat']);
    expect(run.kills).toEqual({});
    const s = fresh();
    const done = finishRun(s, { ...run, status: 'left' }, 5000)!;
    expect(done.player.seen[enemyKey('bat')]).toEqual({ count: 0, firstSeenAt: 5000 });
  });

  it('a mimic counts as its own enemy type', () => {
    let run = testRun({ at: { x: 80, y: 80 }, enemies: [{ ...makeEnemy(1001, 'skeleton', 1, 100, 80, true), hp: 1 }] });
    const rng = seededRng(4);
    for (let k = 0; k < 20 && run.enemies.length > 0; k++) run = step(run, [{ t: 'click_enemy', id: 1001 }], 400, rng);
    expect(run.kills).toEqual({ mimic: 1 });
    expect(run.events.length).toBeGreaterThanOrEqual(0);
  });

  it('ownedFinds counts materials, furniture and what is on the shop slots', () => {
    let s = fresh();
    const table = s.items.find((i) => i.typeId === 'stall_table')!;
    s = putOnShelf(s, { shelfUid: table.uid, index: 0 }, { kind: 'material', id: 'wood' }, 3, 0)!;
    expect(ownedFinds(s)).toEqual({ wood: 4, cloth: 2, counter: 1, stall_table: 1 });
  });

  it('addSeen keeps the first time', () => {
    const a = addSeen({}, 'bone', 0, 5);
    expect(a.bone).toEqual({ count: 0, firstSeenAt: 5 });
    expect(addSeen(a, 'bone', 3, 9).bone).toEqual({ count: 3, firstSeenAt: 5 });
  });
});

describe('the Book (step 9e)', () => {
  it('has four tabs; every material and furniture type is in exactly one', () => {
    expect(BOOK_TABS).toEqual(['materials', 'furniture', 'food', 'enemies']);
    const keys = BOOK_TABS.flatMap((t) => bookEntries(t).map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of MATERIAL_TYPES) expect(keys).toContain(m.id);
    for (const f of FURNITURE_TYPES) expect(keys).toContain(f.id);
    expect(bookEntries('food').every((e) => ['seed', 'crop', 'food'].includes(MATERIAL_TYPES.find((m) => m.id === e.id)!.group))).toBe(true);
    expect(bookEntries('enemies').map((e) => e.id)).toEqual(['slime', 'bat', 'skeleton', 'mimic', 'bone_king']);
    for (const e of bookEntries('enemies')) expect(e.drops).toHaveLength(4);
  });

  it('says where things come from, and nothing is "Unknown"', () => {
    expect(sourceOf('slime_gel')).toBe('Drops from: Slime');
    expect(sourceOf('kings_heart')).toBe('Drops from: Bone King');
    expect(sourceOf('chair')).toBe('Catalog');
    expect(sourceOf('bone_chair')).toBe('Dungeon chests, Crafted');
    expect(sourceOf('slime_jar')).toBe('Crafted');
    expect(sourceOf('turnip')).toBe('Farm');
    expect(sourceOf('turnip_seed')).toBe('Catalog');
    expect(sourceOf('glowcap_spore')).toBe('Dungeon chests');
    expect(sourceOf('potato_stew')).toBe('Cooked');
    expect(sourceOf('iron_ore')).toBe('Mine');
    expect(sourceOf('iron_bar')).toBe('Forge');
    expect(sourceOf('counter')).toBe('Your shop');
    for (const tab of BOOK_TABS) for (const e of bookEntries(tab)) expect(e.source, e.id).not.toBe('Unknown');
    expect(getFurnitureType('slime_jar').rank).toBe('rare');
  });

  it('counts found per tab and in total', () => {
    const s = fresh();
    expect(bookProgress(s.player.seen, 'materials')).toEqual({ found: 2, total: bookEntries('materials').length });
    expect(bookProgress(s.player.seen, 'furniture').found).toBe(2);
    expect(bookProgress(s.player.seen, 'enemies').found).toBe(0);
    const total = bookTotal(s.player.seen);
    expect(total.found).toBe(4);
    expect(total.percent).toBe(Math.floor(400 / total.total));
    let seen = s.player.seen;
    for (const tab of BOOK_TABS) for (const e of bookEntries(tab)) seen = addSeen(seen, e.key, 1, 5);
    expect(bookTotal(seen).percent).toBe(100);
  });

  it('marks what is new since the Book was last opened', () => {
    let s = fresh(); // opened at 1000, start items seen at 1000
    expect(newEntries(s.player.seen, s.player.bookOpenedAt)).toEqual([]);
    s = applyChange(s, { reason: 'debug', materials: { bone: 1, wood: 1 } }, 2000)!;
    expect(newEntries(s.player.seen, s.player.bookOpenedAt)).toEqual(['bone']);
    s = openBook(s, 3000);
    expect(newEntries(s.player.seen, s.player.bookOpenedAt)).toEqual([]);
  });

  it('rewards: 25, 50, 75 and 100% of a tab give gold once, through the ledger; the hat slot is ready for later', () => {
    for (const tab of BOOK_TABS) {
      expect(BOOK_REWARDS[tab].map((r) => r.percent)).toEqual([...BOOK_REWARD_STEPS]);
      for (const r of BOOK_REWARDS[tab]) {
        expect(r.gold).toBeGreaterThan(0);
        expect(r.hat).toBeNull();
      }
    }
    let s = fresh();
    expect(bookRewards(s.player, 'enemies').map((r) => r.state)).toEqual(['locked', 'locked', 'locked', 'locked']);
    expect(claimBookReward(s, 'enemies', 25, 5000)).toBeNull();
    // 2 of 5 enemies met = 40%: the 25% reward is ready, 50% is not.
    s = { ...s, player: { ...s.player, seen: addSeen(addSeen(s.player.seen, enemyKey('slime'), 1, 4000), enemyKey('bat'), 0, 4000) } };
    expect(bookRewards(s.player, 'enemies').map((r) => r.state)).toEqual(['ready', 'locked', 'locked', 'locked']);
    const gold = s.player.wallet.gold;
    const paid = claimBookReward(s, 'enemies', 25, 5000)!;
    expect(paid.player.wallet.gold).toBe(gold + BOOK_REWARDS.enemies[0]!.gold);
    expect(paid.ledger[paid.ledger.length - 1]).toMatchObject({ reason: 'book_reward', goldDelta: BOOK_REWARDS.enemies[0]!.gold });
    expect(bookRewards(paid.player, 'enemies')[0]!.state).toBe('taken');
    expect(claimBookReward(paid, 'enemies', 25, 6000)).toBeNull();
    expect(claimBookReward(paid, 'enemies', 50, 6000)).toBeNull();
    expect(RARE_DROP_CHANCE).toBe(0.1);
  });
});
