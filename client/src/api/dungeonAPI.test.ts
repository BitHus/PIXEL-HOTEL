// Step 9: the dungeon through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { createNewPlayer, newRun, saveKey, seededRng, toSaveText, type DungeonRun, type GameState } from '@pixel-hotel/shared';
import { blockCenter } from '../../../shared/src/dungeon/grid.ts';
import { enemyAt, openMap } from '../../../shared/src/dungeon/testRun.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function stateWith(gold: number, extra: Partial<GameState> = {}): GameState {
  const s = createNewPlayer(undefined, 0);
  return { ...s, playerCreated: true, player: { ...s.player, wallet: { gold } }, ...extra };
}

function open(state: GameState, seed = 1) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, clock, seededRng(seed)).api };
}

/** A run on a small open map with the player at block (3, 3). */
function handRun(patch: Partial<DungeonRun> = {}): DungeonRun {
  const run = newRun({ seed: 3, round: 1, xp: 0, gear: [], potions: 0 });
  const map = openMap();
  const at = blockCenter(3, 3);
  return { ...run, map, enemies: [], chests: [], player: { ...run.player, x: at.x, y: at.y }, ...patch };
}

const totalMaterials = (m: Record<string, number | undefined>): number => Object.values(m).reduce<number>((a, n) => a + (n ?? 0), 0);

describe('dungeonStart', () => {
  it('takes exactly 10 gold with 10 or more, through the ledger', async () => {
    const { api } = open(stateWith(10));
    const run = await api.dungeonStart();
    expect(run?.status).toBe('active');
    expect((await api.getPlayer()).wallet.gold).toBe(0);
    expect(await api.dungeonStart()).toBeNull(); // one run at a time
    const { api: rich } = open(stateWith(250));
    await rich.dungeonStart();
    expect((await rich.getPlayer()).wallet.gold).toBe(240);
  });

  it('is free with less than 10 gold', async () => {
    const { api } = open(stateWith(9));
    expect(await api.dungeonStart()).not.toBeNull();
    expect((await api.getPlayer()).wallet.gold).toBe(9);
  });

  it('takes the potions along and gives the unused ones back', async () => {
    const s = stateWith(100);
    const { api } = open({ ...s, player: { ...s.player, potions: 2 } });
    const run = await api.dungeonStart();
    expect(run?.player.potions).toBe(2);
    expect((await api.getPlayer()).potions).toBe(0);
    await api.dungeonInput({ t: 'choose_exit', choice: 'leave' }); // not at the exit: nothing
    const view = (await api.getRun())!;
    expect(view.run.status).toBe('active');
  });
});

describe('the Blacksmith and crafting', () => {
  it('buying gear fails without enough gold', async () => {
    const { api } = open(stateWith(149));
    expect(await api.buyGear('iron_sword')).toBe(false);
    expect((await api.getPlayer()).gear).toEqual([]);
    expect(await api.buyGear('leather_armor')).toBe(true);
    expect((await api.getPlayer()).wallet.gold).toBe(29);
    expect(await api.buyGear('health_potion')).toBe(true);
    expect(await api.buyGear('health_potion')).toBe(false); // 9 gold left
  });

  it('crafts into the bag and fails without the materials', async () => {
    const s = stateWith(0);
    const { api } = open({ ...s, player: { ...s.player, materials: { bone: 6, wood: 2 } } });
    expect(await api.craft('skull_lamp')).toBe(false);
    expect(await api.craft('bone_chair')).toBe(true);
    const inv = await api.getInventory();
    expect(inv.materials).toEqual({});
    expect(inv.furniture.map((i) => i.typeId)).toEqual(['bone_chair']);
  });
});

describe('a run in the game', () => {
  it('a full bag blocks pickups: the drops are left behind', async () => {
    const full = Array.from({ length: 12 }, () => ({ kind: 'furniture' as const, typeId: 'wall_torch' }));
    let tested = false;
    for (let seed = 1; seed < 30 && !tested; seed++) {
      const chest = { id: 1, kind: 'golden' as const, mimic: false, opened: false, ...blockCenter(5, 3) };
      const { api } = open(stateWith(0, { run: handRun({ chests: [chest], bag: { slots: full, gold: 0 } }) }), seed);
      await api.dungeonResume();
      await api.dungeonInput({ t: 'click_point', x: chest.x, y: chest.y });
      const r = (await api.dungeonAdvance(2000))!.run;
      expect(r.chests[0]!.opened).toBe(true);
      expect(r.bag.slots).toEqual(full);
      if (r.lost.slots.length > 0) tested = true;
    }
    expect(tested).toBe(true);
  });

  it('banked loot appears in the bag exactly once', async () => {
    const bag = { slots: [{ kind: 'material' as const, id: 'bone' as const, qty: 7 }, { kind: 'furniture' as const, typeId: 'skull_lamp' }], gold: 33 };
    const { api, storage } = open(stateWith(50, { run: handRun({ status: 'exit_choice', bag }) }));
    await api.dungeonResume();
    const u = (await api.dungeonInput({ t: 'choose_exit', choice: 'leave' }))!;
    expect(u.result).toMatchObject({ status: 'left', banked: bag });
    const check = async (a: LocalGameAPI) => {
      const inv = await a.getInventory();
      expect(inv.materials.bone).toBe(7);
      expect(inv.furniture.filter((i) => i.typeId === 'skull_lamp')).toHaveLength(1);
      expect((await a.getPlayer()).wallet.gold).toBe(83);
      expect(await a.getRun()).toBeNull();
    };
    await check(api);
    // Nothing more comes from more inputs, steps or a reload.
    expect(await api.dungeonInput({ t: 'choose_exit', choice: 'leave' })).toBeNull();
    expect(await api.dungeonAdvance(1000)).toBeNull();
    await check(LocalGameAPI.open(storage, clock).api);
    expect(api.snapshot().ledger.filter((e) => e.reason === 'dungeon_bank')).toHaveLength(1);
  });

  it('death never banks anything (only half the bag gold is kept); xp is kept', async () => {
    const s = stateWith(40);
    const bag = { slots: [{ kind: 'material' as const, id: 'crystal' as const, qty: 3 }], gold: 21 };
    const at = blockCenter(3, 3);
    const run = handRun({ bag, xpGained: 6, enemies: [enemyAt(1, at.x + 30, at.y, 'skeleton', 99)] });
    const { api } = open({ ...s, run: { ...run, player: { ...run.player, hp: 1, xp: 6 } } });
    await api.dungeonResume();
    const u = (await api.dungeonAdvance(2000))!;
    expect(u.result).toMatchObject({ status: 'dead', lastHitBy: 'skeleton', xpGained: 6 });
    const inv = await api.getInventory();
    expect(totalMaterials(inv.materials)).toBe(totalMaterials(s.player.materials));
    expect(inv.furniture).toEqual([]);
    const p = await api.getPlayer();
    expect(p.wallet.gold).toBe(40 + 10);
    expect(p.xp).toBe(6);
    expect(await api.getRun()).toBeNull();
  });

  it('saving mid-run and reloading resumes the run, paused until Resume', async () => {
    const { api, storage } = open(stateWith(100));
    await api.dungeonStart();
    const walked = (await api.dungeonInput({ t: 'click_point', x: 0, y: 0 }))!.run;
    const moved = (await api.dungeonAdvance(2500))!.run;
    expect(moved.timeMs).toBeGreaterThan(walked.timeMs);
    // Reload (the save was written at the latest every 2 s of run time and on every change).
    const again = LocalGameAPI.open(storage, clock).api;
    const view = (await again.getRun())!;
    expect(view.paused).toBe(true);
    expect(view.run.seed).toBe(moved.seed);
    expect(view.run.timeMs).toBeGreaterThanOrEqual(2000);
    // Paused: time does not move and inputs are ignored.
    expect((await again.dungeonAdvance(5000))!.run.timeMs).toBe(view.run.timeMs);
    expect(await again.dungeonInput({ t: 'drink_potion' })).toBeNull();
    await again.dungeonResume();
    expect((await again.dungeonAdvance(500))!.run.timeMs).toBe(view.run.timeMs + 500);
    expect((await again.getRun())!.paused).toBe(false);
  });

  it('the dungeon hint shows when the shop has nothing to sell, and goes once you go in', async () => {
    const { api } = open(stateWith(100, { hintsDone: 3 }));
    expect(await api.currentHint()).toMatch(/Dungeon/);
    await api.dungeonStart();
    // The next quest (step 9b) is the farm.
    expect(await api.currentHint()).toMatch(/farm/);
    expect(api.snapshot().hintsDone).toBe(4);
  });
});
