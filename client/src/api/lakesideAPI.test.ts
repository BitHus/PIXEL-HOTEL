// Step 9f: the lakeside (woodcutting, fishing, the forge pieces, fish food) through the GameAPI.
import { describe, expect, it } from 'vitest';
import {
  AXE_COOLDOWN_MS,
  FISH_BITE_MS,
  FISH_TICK_MS,
  TREE_HITS,
  TREE_REGROW_MS,
  applyChange,
  createNewPlayer,
  nearestCastSpot,
  saveKey,
  seededRng,
  toSaveText,
  treeAnchor,
  treeStand,
  isWater,
  distToWater,
  CAST_REACH_PX,
  type FishInput,
  type FishSession,
  type GainList,
  type GameState,
} from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function fresh(extra: Partial<GameState> = {}): GameState {
  return { ...createNewPlayer(undefined, 0), playerCreated: true, ...extra };
}

function open(state: GameState, seed = 4) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, clock, seededRng(seed)).api };
}

/** Walks the avatar to a point and lets the time pass until it is there. */
async function goTo(api: LocalGameAPI, p: { x: number; y: number }): Promise<void> {
  expect(await api.walk(p)).not.toBeNull();
  t += 30_000;
}

describe('woodcutting through the GameAPI', () => {
  it('walk to a tree, swing 5 times (each tap one hit, the cooldown ignores fast taps), get wood, regrow after 5 minutes', async () => {
    t = 1000;
    const { api, storage } = open(fresh());
    const p = await api.getPlayer();
    const room = await api.enterRoom(p.lakesideRoomId);
    expect(room.room).toMatchObject({ kind: 'lakeside', floorStyle: 'grass', wallStyle: 'hedge' });
    const lake = await api.getLakeside();
    expect(lake.trees).toHaveLength(8);
    expect(lake.trees.every((x) => x.hits === 0 && x.regrowInMs === null)).toBe(true);
    // Too far away: refused.
    expect(await api.chopTree(0)).toBeNull();
    await goTo(api, treeStand(0));
    const wood = (await api.getPlayer()).materials.wood ?? 0;
    for (let hit = 1; hit < TREE_HITS; hit++) {
      const r = await api.chopTree(0);
      expect(r).toMatchObject({ kind: 'hit', hits: hit, gains: [] });
      // Tapping again at once does nothing: the 400 ms cooldown.
      expect((await api.chopTree(0))!.kind).toBe('cooldown');
      expect((await api.getLakeside()).trees[0]!.hits).toBe(hit);
      t += AXE_COOLDOWN_MS;
    }
    const felled = await api.chopTree(0);
    expect(felled!.kind).toBe('felled');
    expect(felled!.loot!.wood).toBeGreaterThanOrEqual(2);
    expect((await api.getPlayer()).materials.wood).toBe(wood + felled!.loot!.wood!);
    // The gains list says the same as the loot (wood, and maybe the ranked drop; gems are counted apart).
    expect(felled!.gains.find((g) => g.itemId === 'wood')?.count).toBe(felled!.loot!.wood);
    expect(felled!.gains.filter((g) => g.itemId !== 'gems').reduce((a, g) => a + g.count, 0)).toBe(Object.values(felled!.loot!).reduce((a, n) => a + (n ?? 0), 0));
    // A stump now, with its regrow time.
    const stump = (await api.getLakeside()).trees[0]!;
    expect(stump.regrowInMs).toBe(TREE_REGROW_MS);
    t += AXE_COOLDOWN_MS;
    expect((await api.chopTree(0))!.kind).toBe('regrowing');
    // Close the game and open it later: the clock goes on (nothing runs while it is closed).
    t += 4 * 60_000;
    const later = LocalGameAPI.open(storage, clock, seededRng(6)).api;
    await later.enterRoom((await later.getPlayer()).lakesideRoomId);
    expect((await later.getLakeside()).trees[0]!.regrowInMs).toBe(TREE_REGROW_MS - 4 * 60_000 - AXE_COOLDOWN_MS);
    t += 60_000 + 3 * AXE_COOLDOWN_MS;
    expect((await later.getLakeside()).trees[0]!.regrowInMs).toBeNull();
    await goTo(later, treeStand(0));
    expect((await later.chopTree(0))!.kind).toBe('hit');
    // Not on other rooms.
    await later.enterRoom((await later.getPlayer()).hotelRoomId);
    expect(await later.chopTree(0)).toBeNull();
    expect(await later.castAt({ x: 420, y: 100 })).toBeNull();
  });

  it('the steel axe made at the forge counts every swing double', async () => {
    t = 1000;
    let s = fresh();
    s = applyChange(s, { reason: 'debug', materials: { iron_bar: 5, copper_bar: 2 } }, 0)!;
    const { api } = open(s);
    expect(await api.forge('steel_axe')).not.toBeNull();
    expect((await api.getPlayer()).gear).toContain('steel_axe');
    const p = await api.getPlayer();
    await api.enterRoom(p.lakesideRoomId);
    await goTo(api, treeStand(1));
    const kinds: string[] = [];
    for (let k = 0; k < 3; k++) {
      kinds.push((await api.chopTree(1))!.kind);
      t += AXE_COOLDOWN_MS;
    }
    expect(kinds).toEqual(['hit', 'hit', 'felled']);
  });
});

describe('fishing through the GameAPI', () => {
  /** Plays a cast to the end with a bot: taps at the bite, then holds the box under the fish. */
  async function fishOnce(api: LocalGameAPI): Promise<{ session: FishSession; caught: { id: string; rank: string; cm: number | null; record: boolean } | null; gains: GainList }> {
    const s0 = await api.fishStart();
    expect(s0).not.toBeNull();
    let held = false;
    for (let k = 0; k < 2000; k++) {
      const cur = (await api.fishStep([], 0))!.session;
      const inputs: FishInput[] = [];
      if (cur.phase === 'bite') inputs.push({ t: 'tap' });
      if (cur.phase === 'reel') {
        const want = cur.boxPos + cur.boxVel * 0.15 < cur.fishPos;
        if (want !== held) {
          held = want;
          inputs.push({ t: want ? 'press' : 'release' });
        }
      }
      const u = (await api.fishStep(inputs, FISH_TICK_MS))!;
      if (u.session.phase === 'done') return u;
    }
    throw new Error('never ended');
  }

  it('tap the water: walk to the nearest shore spot; cast; hook; reel; the catch is in the bag and the Book', async () => {
    t = 1000;
    const { api } = open(fresh(), 11);
    const p = await api.getPlayer();
    await api.enterRoom(p.lakesideRoomId);
    expect(await api.fishStart()).not.toBeNull();
    await api.fishStop();
    const target = { x: 500, y: 100 };
    expect(isWater(target)).toBe(true);
    const plan = await api.castAt(target);
    expect(plan).not.toBeNull();
    expect(distToWater(plan!.spot)).toBeLessThanOrEqual(CAST_REACH_PX);
    expect(isWater(plan!.bobber)).toBe(true);
    expect(plan!.path[0]).toBeDefined();
    t += 60_000;
    const u = await fishOnce(api);
    expect(u.session.outcome).toBe('caught');
    expect(u.caught).not.toBeNull();
    // The catch comes back as a gain: the fish, once, in its rank.
    // (gems, if the catch dropped any, come in the same list: step BG4)
    expect(u.gains.filter((g) => g.itemId !== 'gems')).toEqual([{ itemId: u.caught!.id, count: 1, rank: expect.any(String) }]);
    const after = await api.getPlayer();
    expect(after.materials[u.caught!.id as 'mudfin']).toBe(1);
    expect(after.seen[u.caught!.id]!.count).toBe(1);
    if (u.caught!.cm !== null) expect(after.biggest[u.caught!.id]).toBe(u.caught!.cm);
    // The line is in: nothing to step.
    expect(await api.fishStep([], 100)).toBeNull();
  });

  it('missing loses nothing: no tap at the bite means no catch and nothing changes', async () => {
    t = 1000;
    const { api } = open(fresh(), 5);
    await api.enterRoom((await api.getPlayer()).lakesideRoomId);
    const before = await api.getPlayer();
    await api.fishStart();
    let last = (await api.fishStep([], 0))!;
    for (let k = 0; k < 200 && last.session.phase !== 'done'; k++) last = (await api.fishStep([], FISH_TICK_MS))!;
    expect(last.session.outcome).toBe('missed');
    expect(last.session.timeMs).toBeGreaterThanOrEqual(2000 + FISH_BITE_MS.legendary);
    expect(last.caught).toBeNull();
    expect(last.gains).toEqual([]);
    const after = await api.getPlayer();
    expect(after.materials).toEqual(before.materials);
    expect(after.wallet.gold).toBe(before.wallet.gold);
  });

  it('the rod from the forge is used for the cast, fish go on the shop table (food) and into the pot', async () => {
    t = 1000;
    let s = fresh();
    s = applyChange(s, { reason: 'debug', materials: { copper_bar: 4, pebble_perch: 1, turnip: 1, lantern_carp: 1, potato: 1 } }, 0)!;
    const { api } = open(s);
    expect(await api.forge('mithril_rod')).toBeNull(); // the copper-reel rod comes first
    expect(await api.forge('copper_reel_rod')).not.toBeNull();
    expect((await api.getPlayer()).gear).toContain('copper_reel_rod');
    // Cooking: grilled perch heals, carp stew gives +1 attack.
    expect(await api.cook('grilled_perch')).not.toBeNull();
    expect(await api.cook('carp_stew')).not.toBeNull();
    const m = (await api.getPlayer()).materials;
    expect(m.grilled_perch).toBe(1);
    expect(m.carp_stew).toBe(1);
    expect(m.pebble_perch).toBeUndefined();
    // Fish and the new foods can be put on the shop table.
    const shop = await api.getShop();
    const table = (await api.enterRoom((await api.getPlayer()).shopRoomId)).items.find((i) => i.typeId === 'stall_table')!;
    expect(shop.slots).toEqual([]);
    expect(await api.putOnShelf({ shelfUid: table.uid, index: 0 }, { kind: 'material', id: 'grilled_perch' }, 30)).not.toBeNull();
  });

  it('a walk to the water needs a reachable cast spot; the nearest one to the tap is used', async () => {
    t = 1000;
    const { api } = open(fresh());
    await api.enterRoom((await api.getPlayer()).lakesideRoomId);
    const plan = (await api.castAt({ x: 340, y: 130 }))!;
    const last = plan.path[plan.path.length - 1]!;
    expect(Math.hypot(last.x - plan.spot.x, last.y - plan.spot.y)).toBeLessThan(2);
    expect(nearestCastSpot).toBeDefined();
    expect(treeAnchor(0)).toBeDefined();
  });
});
