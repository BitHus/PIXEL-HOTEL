import { describe, expect, it } from 'vitest';
import { createNewPlayer } from '../newPlayer.ts';
import type { GameState } from '../gameState.ts';
import { finishRun, runIsFree, startRun } from './bank.ts';

function withGold(gold: number, extra: Partial<GameState['player']> = {}): GameState {
  const s = createNewPlayer();
  return { ...s, player: { ...s.player, wallet: { gold }, ...extra } };
}

describe('starting and banking a run (sections 9 and 10)', () => {
  it('a run costs the 10 gold key, through the ledger', () => {
    const { state, run } = startRun(withGold(100), 5, 1);
    expect(state.player.wallet.gold).toBe(90);
    expect(state.ledger.at(-1)).toMatchObject({ reason: 'dungeon_key', goldDelta: -10 });
    expect(run.floor).toBe(1);
    expect(run.player.hp).toBe(30);
  });

  it('a run is free when gold is under 10', () => {
    const s = withGold(9);
    expect(runIsFree(s)).toBe(true);
    const { state } = startRun(s, 5, 1);
    expect(state.player.wallet.gold).toBe(9);
    expect(state.ledger).toEqual(s.ledger);
    expect(runIsFree(withGold(10))).toBe(false);
  });

  it('takes the gear and potions along; level and xp come from the player', () => {
    const { state, run } = startRun(withGold(100, { gear: ['iron_sword'], potions: 3, xp: 45, level: 3 }), 5, 1, 2);
    expect(run.player).toMatchObject({ level: 3, attackMin: 7, attackMax: 9, maxHp: 36, potions: 3 });
    expect(run.round).toBe(2);
    expect(state.player.potions).toBe(0);
  });

  it('banks gold, materials and furniture, adds xp, returns potions', () => {
    const { state, run } = startRun(withGold(100, { potions: 2 }), 5, 1);
    const done = {
      ...run,
      status: 'left' as const,
      xpGained: 20,
      player: { ...run.player, potions: 1 },
      banked: { slots: [{ kind: 'material' as const, id: 'bone' as const, qty: 10 }, { kind: 'material' as const, id: 'bone' as const, qty: 3 }, { kind: 'furniture' as const, typeId: 'wall_torch' }], gold: 55 },
    };
    const s = finishRun(state, done, 2)!;
    expect(s.player.wallet.gold).toBe(90 + 55);
    expect(s.player.materials.bone).toBe(13);
    expect(s.items.filter((i) => i.typeId === 'wall_torch' && i.roomId === null)).toHaveLength(1);
    expect(s.player).toMatchObject({ xp: 20, level: 2, potions: 1 });
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'dungeon_bank', goldDelta: 55, materials: { bone: 13 } });
  });

  it('xp is kept after death; only the banked part (half the gold) comes home', () => {
    const { state, run } = startRun(withGold(100), 5, 1);
    const dead = { ...run, status: 'dead' as const, xpGained: 7, banked: { slots: [], gold: 12 } };
    const s = finishRun(state, dead, 2)!;
    expect(s.player).toMatchObject({ xp: 7, level: 1 });
    expect(s.player.wallet.gold).toBe(102);
    expect(finishRun(state, run, 2)).toBeNull();
  });
});
