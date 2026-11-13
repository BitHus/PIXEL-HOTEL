// Step 9c: the mine and the forge through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { MINE_HINT, MINE_LANTERN_MS, applyChange, createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function player(level: number, extra: Partial<GameState> = {}): GameState {
  const s = applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 400 }, 0)!;
  return { ...s, playerCreated: true, player: { ...s.player, level, xp: level >= 3 ? 40 : 0 }, ...extra };
}

function open(state: GameState) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return LocalGameAPI.open(storage, clock, seededRng(3)).api;
}

describe('the mine through the GameAPI', () => {
  it('is locked below level 3; its hint shows from level 3 and goes when you go in', async () => {
    expect(await open(player(2)).mineStart()).toBeNull();
    expect(await open(player(2, { hintsDone: MINE_HINT })).currentHint()).toBeNull();
    const api = open(player(3, { hintsDone: MINE_HINT }));
    expect(await api.currentHint()).toMatch(/mine/);
    const run = await api.mineStart();
    expect(run?.place).toBe('mine');
    expect(await api.mineStart()).toBeNull(); // one at a time
    expect(await api.currentHint()).toBeNull();
    expect((await api.getPlayer()).wallet.gold).toBe(500); // free
  });

  it('mine a rock, walk out when the lantern goes out, smelt, forge, and the dungeon feels it', async () => {
    const api = open(player(3));
    const run = (await api.mineStart())!;
    // Swing at the nearest copper or iron rock until it breaks.
    const rock = [...run.rocks].filter((r) => r.kind !== 'mithril').sort((a, b) => Math.hypot(a.x - run.player.x, a.y - run.player.y) - Math.hypot(b.x - run.player.x, b.y - run.player.y))[0]!;
    for (let k = 0; k < 200; k++) {
      const u = await api.dungeonInput({ t: 'click_rock', id: rock.id });
      if (!u?.run.rocks.some((r) => r.id === rock.id)) break;
      await api.dungeonAdvance(400);
    }
    const now = (await api.getRun())!.run;
    expect(now.rocks.some((r) => r.id === rock.id)).toBe(false);
    const ore = `${rock.kind}_ore`;
    // The lantern runs out: everything comes home.
    const end = await api.dungeonAdvance(MINE_LANTERN_MS);
    expect(end?.result).toMatchObject({ status: 'left', place: 'mine', lanternOut: true });
    const got = (await api.getPlayer()).materials[ore as 'copper_ore'] ?? 0;
    expect(got).toBeGreaterThanOrEqual(1);
    // Smelt and forge (with enough ore given for the test).
    const s = api.snapshot();
    const rich = applyChange(s, { reason: 'debug', materials: { copper_ore: 12 } }, t)!;
    const forge = open(rich);
    for (let i = 0; i < 4; i++) expect(await forge.smelt('copper_bar')).toBe(true);
    expect(await forge.smelt('copper_bar')).toBe(false);
    expect(await forge.forge('iron_sword')).toBe(false); // needs the copper sword first
    expect(await forge.forge('copper_sword')).toBe(true);
    expect((await forge.getPlayer()).gear).toEqual(['copper_sword']);
    const dungeon = await forge.dungeonStart();
    expect(dungeon?.player).toMatchObject({ attackMin: 5 + 1, attackMax: 7 + 1 }); // level 3: +1 from level 2
    const end2 = forge.snapshot();
    expect(ledgerGold(end2)).toBe(end2.player.wallet.gold);
    expect(ledgerMaterials(end2)).toEqual(end2.player.materials);
  });
});
