import { describe, expect, it } from 'vitest';
import { DIG_CAVEIN_DAMAGE, DIG_CAVEIN_TELL_MS, DIG_COLS, DIG_DEPTH_MAX, DIG_FILLER_DROP_CHANCE, DIG_GLINT_BLOCKS, DIG_LIGHT_BLOCKS, DIG_QUEUE_MS, DUNGEON_BLOCK, PICKAXE_COOLDOWN_MS } from '../config.ts';
import { seededRng } from '../rng.ts';
import { caveTellMsOf, chestGlintBlocksOf, digLightPxOf, glintBlocksOf, hazardDamageOf, HOOKED_STATS } from '../skillRules.ts';
import type { Bonuses } from '../stats.ts';
import { blockCenter } from './grid.ts';
import type { MineBlockId } from './mineBlocks.ts';
import { createNewPlayer } from '../newPlayer.ts';
import { applyChange } from '../ledger.ts';
import { finishRun, startMine } from './bank.ts';
import { digHitProgress, digHoldReady, glintingCells, glintingChests } from './mineStep.ts';
import { getMineBlock } from './mineBlocks.ts';
import { newDigRun, type DungeonRun } from './run.ts';
import { step } from './step.ts';

const idx = (c: number, r: number): number => r * DIG_COLS + c;

/** A dig run whose spawn pocket is mine to arrange: no enemies, no hazards, the player at (pc, pr), a 3-block open row to the east. */
function run(skills?: Bonuses, extra: Partial<DungeonRun['player']> = {}): DungeonRun {
  const r0 = newDigRun({ seed: 7, xp: 0, gear: [], potions: 0, ...(skills ? { skills } : {}) });
  const at = blockCenter(10, 10);
  const dig = { ...r0.dig!, hazards: [], rare: [], kinds: r0.dig!.kinds.map((k, i) => (k === '' ? 'stone' : k)) as (MineBlockId | '')[] };
  // A clean test floor: solid stone except one open corridor (10..12, 10); the exit is far away.
  for (const c of [10, 11, 12]) dig.kinds[idx(c, 10)] = '';
  const blocks = dig.kinds.map((k) => (k === '' ? 'floor' : 'wall')) as ('floor' | 'wall')[];
  return { ...r0, enemies: [], dig, map: { ...r0.map, blocks, exit: { c: 40, r: 60 }, spawn: at }, player: { ...r0.player, x: at.x, y: at.y, ...extra } };
}

/** Sets one block's kind (open = ''), as a new run. */
function withKind(r: DungeonRun, c: number, row: number, kind: MineBlockId | ''): DungeonRun {
  const kinds = r.dig!.kinds.slice();
  kinds[idx(c, row)] = kind;
  const blocks = r.map.blocks.slice();
  blocks[idx(c, row)] = kind === '' ? 'floor' : 'wall';
  return { ...r, dig: { ...r.dig!, kinds }, map: { ...r.map, blocks } };
}

const mat = (bag: DungeonRun['bag'], id: string): number => bag.slots.reduce((a, s) => a + (s.kind === 'material' && s.id === id ? s.qty : 0), 0);
const rng = (): number => 0; // the lowest roll: filler drops, gem rolls and strikes all hit
/** OB-8: the ore lands on the ground next to the player; a second and a half later the magnet has it in the bag. */
const settle = (r: DungeonRun): DungeonRun => step(r, [], 1500, seededRng(99));

describe('digging a block', () => {
  it('takes the block hits, one swing per tap and cooldown, and a tap during the cooldown is ignored', () => {
    let r = withKind(run(), 12, 11, '');
    r = withKind(r, 11, 10, 'stone'); // the corridor ends: stone at (11,10)... dig it from (10,10)
    const s = seededRng(1);
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, s);
    expect(r.events).toContainEqual({ t: 'dig', cell: idx(11, 10), hits: 1 });
    expect(r.dig!.kinds[idx(11, 10)]).toBe('stone');
    expect(r.dig!.hits[idx(11, 10)]).toBe(1);
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 100, s); // too early
    expect(r.events.some((e) => e.t === 'dig')).toBe(false);
    expect(r.dig!.hits[idx(11, 10)]).toBe(1);
    r = step(r, [], PICKAXE_COOLDOWN_MS, s); // the pickaxe is ready again
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, s);
    expect(r.events).toContainEqual({ t: 'dig_broken', cell: idx(11, 10), kind: 'stone' });
    expect(r.dig!.kinds[idx(11, 10)]).toBe('');
    expect(r.dig!.hits[idx(11, 10)]).toBeUndefined();
  });

  it('turns the block into floor in a NEW map (the old run is untouched) so walking and the nav grid see it', () => {
    let r = withKind(run(), 11, 10, 'dirt'); // dirt = 1 hit
    const before = r;
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1));
    expect(r.map).not.toBe(before.map);
    expect(r.map.blocks[idx(11, 10)]).toBe('floor');
    expect(before.map.blocks[idx(11, 10)]).toBe('wall');
    expect(before.dig!.kinds[idx(11, 10)]).toBe('dirt');
    expect(r.dig!.rev).toBeGreaterThan(before.dig!.rev);
  });

  it('walks to the block first when it is far, then digs it', () => {
    let r = run();
    r = withKind(r, 13, 10, 'dirt');
    r = withKind(r, 12, 10, '');
    // player at (10,10), corridor to (12,10), dirt at (13,10): out of reach at 3 blocks.
    r = step(r, [{ t: 'click_dig', c: 13, r: 10 }], 0, seededRng(1));
    expect(r.player.pendingDig).toBe(true);
    for (let k = 0; k < 40 && r.dig!.kinds[idx(13, 10)] !== ''; k++) r = step(r, [], 100, seededRng(1));
    expect(r.dig!.kinds[idx(13, 10)]).toBe('');
    expect(r.player.x).toBeGreaterThan(blockCenter(11, 10).x);
  });

  it('drops the ore on the ground (OB-8), the magnet puts it in the run bag; coal, copper, iron and the rare kinds drop their item', () => {
    for (const [kind, item] of [['coal', 'coal'], ['copper', 'copper_ore'], ['iron', 'iron_ore'], ['crystal', 'crystal'], ['gold_vein', 'gold_nugget'], ['diamond', 'diamond']] as const) {
      let r = withKind(run(), 11, 10, kind);
      for (let k = 0; k < 40 && r.dig!.kinds[idx(11, 10)] !== ''; k++) r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], PICKAXE_COOLDOWN_MS, seededRng(k + 1));
      expect(r.drops?.some((d) => d.item === item), kind).toBe(true);
      expect(r.events.some((e) => e.t === 'drop' && e.item === item), kind).toBe(true);
      r = settle(r);
      expect(r.drops ?? [], kind).toEqual([]);
      expect(mat(r.bag, item), kind).toBeGreaterThanOrEqual(1);
      expect(r.xpGained, kind).toBe(kind === 'coal' || kind === 'copper' || kind === 'iron' ? mat(r.bag, item) : 10); // SK-2: 1 per ore, 10 per rare block
    }
  });

  it('refuses mithril without the steel pickaxe (and stays in place), digs it with one', () => {
    let r = withKind(run(), 11, 10, 'mithril');
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1));
    expect(r.events).toContainEqual({ t: 'dig_too_hard', cell: idx(11, 10) });
    expect(r.dig!.kinds[idx(11, 10)]).toBe('mithril');
    let s = withKind(run(undefined, { hitsPerSwing: 2, minesMithril: true }), 11, 10, 'mithril');
    for (let k = 0; k < 10 && s.dig!.kinds[idx(11, 10)] !== ''; k++) s = step(s, [{ t: 'click_dig', c: 11, r: 10 }], PICKAXE_COOLDOWN_MS, seededRng(k + 1));
    expect(mat(settle(s).bag, 'mithril_ore')).toBeGreaterThanOrEqual(1);
  });

  it('never digs bedrock or an open cell', () => {
    let r = withKind(run(), 11, 10, 'bedrock');
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1));
    expect(r.events).toEqual([]);
    expect(r.player.targetDig ?? null).toBeNull();
    r = step(r, [{ t: 'click_dig', c: 10, r: 10 }], 0, seededRng(1)); // where the player stands
    expect(r.events).toEqual([]);
  });

  it('filler blocks drop only now and then and never push ore out of a full bag; ore in a full bag is left behind', () => {
    // A full bag of 12 different materials (no room for anything new).
    const ids = ['wood', 'cloth', 'bone', 'crystal', 'copper_ore', 'iron_ore', 'mithril_ore', 'coal', 'gold_nugget', 'diamond', 'copper_bar', 'iron_bar'] as const;
    const full: DungeonRun['bag'] = { slots: ids.map((id) => ({ kind: 'material' as const, id, qty: 10 })), gold: 0, gems: 0 };
    let r = { ...withKind(run(), 11, 10, 'stone'), bag: full };
    for (let k = 0; k < 6; k++) r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], PICKAXE_COOLDOWN_MS, rng);
    expect(r.dig!.kinds[idx(11, 10)]).toBe('');
    r = settle(r);
    expect(r.events.some((e) => e.t === 'left_behind' || e.t === 'drop_full')).toBe(false); // filler is just not picked up (no "Bag full")
    expect(r.bag.slots.length).toBe(12);
    // Leaving: filler that does not fit is just left, never counted as lost.
    const outR = step(r, [{ t: 'leave' }], 0, rng);
    expect(outR.lost.slots).toEqual([]);
    // Ore: it stays on the ground ("Bag full" once) and is left behind when the visit ends.
    let o = { ...withKind(run(), 11, 10, 'dirt'), bag: full };
    o = withKind(o, 11, 10, 'coal');
    for (let k = 0; k < 6; k++) o = step(o, [{ t: 'click_dig', c: 11, r: 10 }], PICKAXE_COOLDOWN_MS, seededRng(k + 1));
    o = step(o, [], 1500, seededRng(99));
    expect(o.drops?.some((d) => d.item === 'coal' && d.full)).toBe(true);
    expect(o.lost.slots).toEqual([]);
    o = step(o, [{ t: 'leave' }], 0, rng);
    expect(o.drops).toEqual([]);
    expect(o.lost.slots.length).toBeGreaterThan(0);
    // The chance is a config number.
    expect(DIG_FILLER_DROP_CHANCE).toBeGreaterThan(0);
    expect(DIG_FILLER_DROP_CHANCE).toBeLessThan(0.5);
  });

  it('Strong arm (digSpeedPct) shortens the pickaxe cooldown; no skills = the plain cooldown', () => {
    const swing = (skills?: Bonuses): number => {
      const r = step(withKind(run(skills), 11, 10, 'iron'), [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1));
      return r.player.pickReadyAt;
    };
    expect(swing()).toBe(PICKAXE_COOLDOWN_MS);
    expect(swing({ digSpeedPct: 18 })).toBeLessThan(PICKAXE_COOLDOWN_MS);
  });
});

describe('J4 hold rhythm and hit progress', () => {
  it('digHitProgress: 0 = whole, then crack stages 1..3 by the part of the hits done', () => {
    expect(digHitProgress(0, 4)).toEqual({ frac: 0, stage: 0 });
    expect(digHitProgress(1, 4).stage).toBe(1);
    expect(digHitProgress(2, 4).stage).toBe(2);
    expect(digHitProgress(3, 4).stage).toBe(3);
    expect(digHitProgress(9, 4)).toEqual({ frac: 1, stage: 3 });
    expect(digHitProgress(1, 0).stage).toBe(0);
  });

  it('a tap just before the pickaxe is ready is queued and lands on the ready tick; an earlier one is still ignored', () => {
    let r = withKind(run(), 11, 10, 'iron');
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1)); // swing 1 at 0, ready at 400
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 100, seededRng(1)); // at 0 + 0: far too early
    expect(r.player.pendingDig).toBe(false);
    r = step(r, [], PICKAXE_COOLDOWN_MS - DIG_QUEUE_MS - 100, seededRng(1)); // now 250 = ready - 150
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, seededRng(1));
    expect(r.player.pendingDig).toBe(true);
    expect(digHoldReady(r.timeMs + r.carryMs, r.player.pickReadyAt)).toBe(true);
    r = step(r, [], 200, seededRng(1)); // the tick at 400 lands it
    expect(r.player.pickReadyAt).toBe(2 * PICKAXE_COOLDOWN_MS);
  });

  it('holding gives an even beat of exactly one cooldown, also when the hold slides on to the next block (no missed beat)', () => {
    let r = withKind(withKind(run(), 11, 10, 'iron'), 10, 11, 'copper'); // east of the player, then the block below
    const targets: [number, number][] = [[11, 10], [10, 11]];
    const swings: number[] = [];
    let ready = r.player.pickReadyAt;
    for (let frame = 0; frame < 400 && targets.length > 0; frame++) {
      const [c, row] = targets[0]!;
      if (!r.dig!.kinds[idx(c, row)]) {
        targets.shift(); // broke: the finger slides to the next block without lifting
        continue;
      }
      const now = r.timeMs + r.carryMs;
      const inputs = digHoldReady(now, r.player.pickReadyAt) ? [{ t: 'click_dig' as const, c, r: row }] : [];
      r = step(r, inputs, 16, seededRng(frame + 1));
      if (r.player.pickReadyAt !== ready) {
        ready = r.player.pickReadyAt;
        swings.push(ready - PICKAXE_COOLDOWN_MS);
      }
    }
    expect(targets).toEqual([]);
    expect(swings.length).toBe(getMineBlock('iron').hits + getMineBlock('copper').hits);
    const gaps = swings.slice(1).map((t, i) => t - swings[i]!);
    expect(new Set(gaps)).toEqual(new Set([PICKAXE_COOLDOWN_MS]));
  });
});

describe('cave-in tiles', () => {
  const hazardRun = (skills?: Bonuses): DungeonRun => {
    const r = run(skills);
    return { ...r, dig: { ...r.dig!, hazards: [{ c: 11, r: 10, kind: 'cavein', state: 'armed', crackMs: 0 }] } };
  };
  const walkOn = (r: DungeonRun): DungeonRun => ({ ...r, player: { ...r.player, x: blockCenter(11, 10).x, y: blockCenter(11, 10).y } });

  it('cracks with a tell when stepped on, then hurts only if the player is still there', () => {
    let r = step(walkOn(hazardRun()), [], 100, seededRng(1));
    expect(r.dig!.hazards[0]!.state).toBe('cracking');
    expect(r.events).toContainEqual({ t: 'cave_crack', cell: idx(11, 10) });
    const hp = r.player.hp;
    r = step(r, [], DIG_CAVEIN_TELL_MS - 200, seededRng(1)); // still cracking: no damage yet
    expect(r.player.hp).toBe(hp);
    r = step(r, [], 200, seededRng(1));
    expect(r.dig!.hazards[0]!.state).toBe('fallen');
    expect(r.player.hp).toBe(hp - DIG_CAVEIN_DAMAGE);
    expect(r.events).toContainEqual({ t: 'cave_in', cell: idx(11, 10), damage: DIG_CAVEIN_DAMAGE });
    expect(r.lastHitBy).toBe('cave-in');
    const again = step(r, [], 2000, seededRng(1)); // fallen = done, never twice
    expect(again.player.hp).toBe(r.player.hp);
  });

  it('does no damage if the player stepped off during the tell', () => {
    let r = step(walkOn(hazardRun()), [], 100, seededRng(1));
    const hp = r.player.hp;
    r = { ...r, player: { ...r.player, x: blockCenter(10, 10).x, y: blockCenter(10, 10).y } };
    r = step(r, [], DIG_CAVEIN_TELL_MS + 100, seededRng(1));
    expect(r.dig!.hazards[0]!.state).toBe('fallen');
    expect(r.player.hp).toBe(hp);
  });

  it('Careful step (hazardDmgPct) cuts the damage, never below 1', () => {
    const hurt = (skills?: Bonuses): number => {
      const r = step(step(walkOn(hazardRun(skills)), [], 100, seededRng(1)), [], DIG_CAVEIN_TELL_MS, seededRng(1));
      return r.player.maxHp - r.player.hp;
    };
    expect(hurt()).toBe(DIG_CAVEIN_DAMAGE);
    expect(hurt({ hazardDmgPct: -40 })).toBe(Math.round(DIG_CAVEIN_DAMAGE * 0.6));
    expect(hazardDamageOf(1, { hazardDmgPct: -40 })).toBe(1);
    expect(hazardDamageOf(DIG_CAVEIN_DAMAGE)).toBe(DIG_CAVEIN_DAMAGE);
  });

  it('can carry the player out (half the ore lost); Last stand leaves 1 hp once', () => {
    const lethal = (skills?: Bonuses): DungeonRun => {
      let r = hazardRun(skills);
      r = { ...r, player: { ...r.player, hp: 2 }, bag: { slots: [{ kind: 'material', id: 'copper_ore', qty: 5 }], gold: 0, gems: 0 } };
      return step(step(walkOn(r), [], 100, seededRng(1)), [], DIG_CAVEIN_TELL_MS, seededRng(1));
    };
    const dead = lethal();
    expect(dead.status).toBe('dead');
    expect(mat(dead.banked, 'copper_ore')).toBe(3);
    expect(mat(dead.lost, 'copper_ore')).toBe(2);
    const saved = lethal({ lastStand: 1 });
    expect(saved.status).toBe('active');
    expect(saved.player.hp).toBe(1);
  });
});

describe('the exit, depth and leaving', () => {
  const atExit = (r: DungeonRun): DungeonRun => {
    const e = blockCenter(r.map.exit.c, r.map.exit.r);
    return { ...r, player: { ...r.player, x: e.x, y: e.y } };
  };

  it('standing on the exit asks Deeper / Leave; deeper makes a new, deeper cave (more depth, healed a bit) up to the depth cap', () => {
    let r = atExit({ ...newDigRun({ seed: 11, xp: 0, gear: [], potions: 0 }), enemies: [] });
    r = step(r, [], 100, seededRng(1));
    expect(r.status).toBe('exit_choice');
    expect(r.maxFloors).toBe(DIG_DEPTH_MAX);
    const first = r.dig!.kinds;
    r = step(r, [{ t: 'choose_exit', choice: 'deeper' }], 0, seededRng(1));
    expect(r.status).toBe('active');
    expect(r.floor).toBe(2);
    expect(r.dig!.depth).toBe(2);
    expect(r.dig!.kinds).not.toEqual(first);
    expect(r.map.dig).toBe(true);
    expect(r.map.n).toBe(2);
    // On the last depth only Leave and Stay are offered.
    let last = atExit({ ...newDigRun({ seed: 11, xp: 0, gear: [], potions: 0 }), enemies: [], floor: DIG_DEPTH_MAX });
    last = step(last, [], 100, seededRng(1));
    expect(last.status).toBe('exit_choice');
    last = step(last, [{ t: 'choose_exit', choice: 'deeper' }], 0, seededRng(1));
    expect(last.floor).toBe(DIG_DEPTH_MAX);
    expect(last.status).toBe('exit_choice');
  });

  it('Leave banks the bag at any time (no lantern, no timer): minutes pass and the run stays active', () => {
    let r = withKind(run(), 11, 10, 'coal');
    for (let k = 0; k < 20 && r.dig!.kinds[idx(11, 10)] !== ''; k++) r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], PICKAXE_COOLDOWN_MS, seededRng(k + 1));
    r = step(r, [], 10 * 60 * 1000, seededRng(1));
    expect(r.status).toBe('active');
    r = step(r, [{ t: 'leave' }], 0, seededRng(1));
    expect(r.status).toBe('left');
    expect(mat(r.banked, 'coal')).toBeGreaterThanOrEqual(1);
  });
});

describe('what the mining skills show', () => {
  it('Lantern (lightPlus) widens the light, Ore sense (glintBlocks) the rare glint; nothing = the config numbers', () => {
    expect(digLightPxOf()).toBe(DIG_LIGHT_BLOCKS * DUNGEON_BLOCK);
    expect(digLightPxOf({ lightPlus: 2 })).toBe((DIG_LIGHT_BLOCKS + 2) * DUNGEON_BLOCK);
    expect(glintBlocksOf()).toBe(DIG_GLINT_BLOCKS);
    expect(glintBlocksOf({ glintBlocks: 6 })).toBe(DIG_GLINT_BLOCKS + 6);
    expect(HOOKED_STATS).toContain('lightPlus');
    expect(HOOKED_STATS).toContain('glintBlocks');
    expect(HOOKED_STATS).toContain('hazardDmgPct');
    expect(HOOKED_STATS).toContain('chestGlintBlocks');
  });

  it('a rare block glints only inside the radius, and not once it is dug', () => {
    const base = run();
    const kinds = base.dig!.kinds.slice();
    const cell = idx(10 + DIG_GLINT_BLOCKS + 2, 10); // 5 blocks east of the player
    kinds[cell] = 'diamond';
    const r = { ...base, dig: { ...base.dig!, kinds, rare: [cell] } };
    expect(glintingCells(r)).toEqual([]);
    const sensed = { ...r, player: { ...r.player, skill: { glintBlocks: 3 } as Bonuses } };
    expect(glintingCells(sensed)).toEqual([cell]);
    const close = { ...r, player: { ...r.player, x: blockCenter(12, 10).x } };
    expect(glintingCells(close)).toEqual([cell]);
    const dug = { ...sensed, dig: { ...sensed.dig!, rare: [] } };
    expect(glintingCells(dug)).toEqual([]);
  });

  it('Treasure sense makes closed chests within the radius glint (crypt); no skill, none', () => {
    const r = run();
    const chest = { id: 1, kind: 'wooden' as const, mimic: false, opened: false, ...blockCenter(14, 10) };
    const withChest = { ...r, chests: [chest, { ...chest, id: 2, opened: true }] };
    expect(glintingChests(withChest)).toEqual([]);
    expect(glintingChests({ ...withChest, player: { ...withChest.player, skill: { chestGlintBlocks: 4 } } })).toEqual([1]);
    expect(chestGlintBlocksOf()).toBe(0);
    expect(chestGlintBlocksOf({ chestGlintBlocks: 8 })).toBe(8);
  });
});

describe('the dig mine as a visit', () => {
  it('startMine gives a dig run (free, no lantern), a saved run survives JSON, and Leave banks the ore through the ledger', () => {
    const s0 = createNewPlayer(undefined, 0);
    const lvl3 = applyChange({ ...s0, player: { ...s0.player, level: 3, xp: 40 } }, { reason: 'debug', gold: 0 }, 0)!;
    const started = startMine(lvl3, 9)!;
    expect(started.run.dig).toBeDefined();
    expect(started.run.lanternEndsAt).toBeNull();
    expect(started.run.place).toBe('mine');
    expect(started.state.player.wallet.gold).toBe(lvl3.player.wallet.gold);
    expect(started.state.player.mineVisits).toBe(1);
    const reloaded = JSON.parse(JSON.stringify(started.run)) as DungeonRun;
    let r: DungeonRun = { ...reloaded, enemies: [], bag: { slots: [{ kind: 'material', id: 'coal', qty: 4 }], gold: 0, gems: 0 } };
    r = step(r, [{ t: 'leave' }], 0, seededRng(1));
    const home = finishRun(started.state, r, 5)!;
    expect(home.player.materials.coal).toBe(4);
    expect(home.ledger.at(-1)).toMatchObject({ reason: 'mine_bank' });
  });
});

describe('SK-5 Blaster and Sure footing', () => {
  it('Blaster: the 3rd swing (blastEvery 3) also breaks the stone and dirt around, not ore, no drops', () => {
    let r = run({ blastEvery: 3 });
    r = withKind(r, 11, 10, 'coal'); // target: 4+ hits would be too slow, so use dirt as the target and keep the ore beside it
    r = withKind(r, 11, 10, 'dirt');
    r = withKind(r, 12, 9, 'stone');
    r = withKind(r, 12, 11, 'coal');
    const s = seededRng(1);
    for (let k = 0; k < 2; k++) {
      if (k > 0) r = step(r, [], PICKAXE_COOLDOWN_MS, s);
      r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, s);
      if (r.dig!.kinds[idx(11, 10)] === '') r = withKind(r, 11, 10, 'dirt'); // keep the target standing for the count
    }
    expect(r.dig!.swings).toBe(2);
    expect(r.dig!.kinds[idx(12, 9)]).toBe('stone'); // 2 swings: no blast yet
    r = step(r, [], PICKAXE_COOLDOWN_MS, s);
    r = step(r, [{ t: 'click_dig', c: 11, r: 10 }], 0, s);
    expect(r.dig!.kinds[idx(12, 9)]).toBe(''); // 3rd swing: the stone beside the target went
    expect(r.dig!.kinds[idx(12, 11)]).toBe('coal'); // ore stays
  });

  it('Sure footing: a cave-in tile cracks for longer before it hurts', () => {
    expect(DIG_CAVEIN_TELL_MS + 300).toBe(caveTellMsOf({ caveTellMs: 300 }));
    const r = run({ caveTellMs: 300 });
    const here = { c: 10, r: 10 };
    const hz = { c: here.c, r: here.r, state: 'armed' as const, crackMs: 0 };
    const withHazard: DungeonRun = { ...r, dig: { ...r.dig!, hazards: [hz as never] } };
    const out = step(withHazard, [], 100, seededRng(2));
    expect(out.dig!.hazards[0]!.state).toBe('cracking');
    expect(out.dig!.hazards[0]!.crackMs).toBe(DIG_CAVEIN_TELL_MS + 300);
  });
});
