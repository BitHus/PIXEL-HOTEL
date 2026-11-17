// SG4b: a tap with a seed selected plants on a block cell (walks closer first); the client asks the same GameAPI calls.
import { describe, expect, it } from 'vitest';
import { applyChange, createNewPlayer, saveKey, seededRng, toSaveText, type BlockResult, type GameState } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
async function until(call: () => Promise<BlockResult>): Promise<BlockResult> {
  for (let i = 0; i < 6; i++) {
    const r = await call();
    if (r.kind !== 'walk') return r;
    t += 20_000;
  }
  throw new Error('never arrived');
}

describe('planting on a block with a tap (SG4b)', () => {
  it('walks closer, plants a seed on a block; a food seed needs a soil block', async () => {
    t = 1000;
    const s: GameState = { ...createNewPlayer(undefined, 0), playerCreated: true };
    const state = applyChange(s, { reason: 'debug', materials: { dirt: 1, stone: 1, dirt_seed: 2, turnip_seed: 2 } }, 0)!;
    const api = LocalGameAPI.open(memoryStorage({ [saveKey()]: toSaveText(state, 0) }), () => t, seededRng(4)).api;
    const p = await api.getPlayer();
    await api.enterRoom(p.farmRoomId);
    expect((await until(() => api.placeBlock(12, 8, 'dirt'))).kind).toBe('placed');
    expect((await until(() => api.placeBlock(13, 8, 'stone'))).kind).toBe('placed');
    // Food seeds only on a block that holds soil.
    expect(await until(() => api.plantSeed(13, 8, 'turnip_seed'))).toEqual({ kind: 'refused', problem: 'needs_soil' });
    expect((await until(() => api.plantSeed(12, 8, 'turnip_seed'))).kind).toBe('planted');
    expect((await until(() => api.plantSeed(13, 8, 'dirt_seed'))).kind).toBe('planted');
    // Nothing was taken for the refused tap.
    expect((await api.getPlayer()).materials.turnip_seed).toBe(1);
  });
});
