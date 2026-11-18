// MG-1: the skill tree through the GameAPI (LocalGameAPI): buy, refuse, respec with the free uses and then gold, and the save.
import { describe, expect, it } from 'vitest';
import { createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const clock = (): number => 5000;

function open(level: number, gold = 300) {
  const s = createNewPlayer(undefined, 0);
  const state: GameState = { ...s, playerCreated: true, player: { ...s.player, level, wallet: { ...s.player.wallet, gold } } };
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, clock, seededRng(4)).api };
}

describe('skills through the GameAPI', () => {
  it('shows the tree with the free points, buys a rank, refuses what cannot be bought', async () => {
    const { api } = open(5);
    const v0 = await api.getSkills();
    expect(v0).toMatchObject({ earned: 4, spent: 0, free: 4 });
    const v1 = await api.buySkill('quick_feet');
    expect(v1).toMatchObject({ spent: 1, free: 3 });
    expect(v1!.nodes.find((n) => n.id === 'quick_feet')!.rank).toBe(1);
    expect(await api.buySkill('roomy_tavern')).toBeNull(); // locked
    expect(await api.buySkill('nope')).toBeNull();
    expect((await api.getSkills()).spent).toBe(1);
  });

  it('respec is free three times, then costs 100 gold; the points come back', async () => {
    const { api } = open(5, 150);
    for (let i = 0; i < 3; i++) {
      await api.buySkill('quick_feet');
      expect(await api.respecSkills()).toMatchObject({ spent: 0, free: 4 });
      expect((await api.getPlayer()).wallet.gold).toBe(150);
    }
    await api.buySkill('quick_feet');
    expect(await api.respecSkills()).toMatchObject({ spent: 0, respecs: 4 });
    expect((await api.getPlayer()).wallet.gold).toBe(50);
    await api.buySkill('quick_feet');
    expect(await api.respecSkills()).toBeNull(); // 50 gold is not enough
  });

  it('survives a reload', async () => {
    const { api, storage } = open(6);
    await api.buySkill('thick_skin');
    const reloaded = LocalGameAPI.open(storage, clock, seededRng(4)).api;
    expect(await reloaded.getSkills()).toMatchObject({ spent: 1 });
    expect((await reloaded.getSkills()).nodes.find((n) => n.id === 'thick_skin')!.rank).toBe(1);
  });
});
