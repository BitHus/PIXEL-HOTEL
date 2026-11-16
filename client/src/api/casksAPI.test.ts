// Step K2 through the GameAPI: fill a cask, close and reopen the game, collect the aged mugs, load them on a tap.
import { describe, expect, it } from 'vitest';
import { applyChange, createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const MIN = 60_000;
let t = 1000;

function start(): GameState {
  const s = { ...createNewPlayer(undefined, 0), playerCreated: true };
  const rack = { uid: 70, typeId: 'keg_rack', ownerId: 1, roomId: s.tavern.roomId, x: 96, y: 288, facing: 'down' as const, onItemUid: null };
  return applyChange({ ...s, items: [...s.items, rack], nextUid: 71 }, { reason: 'debug', materials: { root_ale: 7 } }, 0)!;
}

describe('casks through the GameAPI (step K2)', () => {
  it('fill, close the game, collect aged mugs after 30 minutes, load them on a tap', async () => {
    t = 1000;
    const storage = memoryStorage({ [saveKey()]: toSaveText(start(), 0) });
    const first = LocalGameAPI.open(storage, () => t, seededRng(4)).api;
    await first.enterRoom((await first.getPlayer()).shopRoomId);
    expect(await first.fillCask(70, 0, 'root_ale', 7)).toBe(true);
    expect(await first.fillCask(70, 0, 'root_ale', 1)).toBe(false); // taken
    expect((await first.getCasks()).find((c) => c.slot === 0)).toMatchObject({ drink: 'root_ale', mugs: 7, tier: 'fresh' });
    // The game is closed for 31 minutes and opened again.
    t += 31 * MIN;
    const second = LocalGameAPI.open(storage, () => t, seededRng(4)).api;
    await second.enterRoom((await second.getPlayer()).shopRoomId);
    expect((await second.getCasks()).find((c) => c.slot === 0)).toMatchObject({ tier: 'aged' });
    const got = (await second.collectCask(70, 0))!;
    expect(got).toMatchObject({ item: 'root_ale_aged', mugs: 7, tier: 'aged' });
    expect(got.gains.some((g) => g.itemId === 'root_ale_aged' && g.count === 7)).toBe(true);
    expect(await second.collectCask(70, 0)).toBeNull();
    const stand = second.snapshot().items.find((i) => i.typeId === 'tap_stand')!;
    expect(await second.loadTap(stand.uid, 1, 'root_ale_aged', 7)).toBe(true);
    expect((await second.getTavern()).taps.find((x) => x.drink === 'root_ale_aged')).toMatchObject({ slot: 1, mugs: 7 });
    const end = second.snapshot();
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
    // Not in the tavern: refused.
    const away = LocalGameAPI.open(memoryStorage({ [saveKey()]: toSaveText(start(), 0) }), () => t, seededRng(4)).api;
    expect(await away.fillCask(70, 0, 'root_ale', 7)).toBe(false);
  });

  it('G1 offline catch-up: closed for 2 minutes, seats fill only; taps, cask and the ledger keep every mug', async () => {
    t = 1000;
    const storage = memoryStorage({ [saveKey()]: toSaveText(start(), 0) });
    const first = LocalGameAPI.open(storage, () => t, seededRng(4)).api;
    await first.enterRoom((await first.getPlayer()).shopRoomId);
    expect(await first.fillCask(70, 0, 'root_ale', 7)).toBe(true);
    const tapMugs = async (api: typeof first) => (await api.getTavern()).taps.reduce((n, x) => n + x.mugs, 0);
    const before = await tapMugs(first);
    expect(before).toBe(7);
    t += 2 * MIN;
    const second = LocalGameAPI.open(storage, () => t, seededRng(4)).api;
    await second.enterRoom((await second.getPlayer()).shopRoomId);
    const view = await second.getTavern();
    expect(view.guests.length).toBeGreaterThan(0);
    expect(view.guests.every((g) => g.phase === 'order' || g.phase === 'eat' || g.phase === 'leave')).toBe(true);
    expect(await tapMugs(second)).toBe(before); // no serving while away
    expect(view.serveQueue).toEqual([]);
    expect(view.tray).toEqual([]);
    expect((await second.getCasks()).find((c) => c.slot === 0)).toMatchObject({ drink: 'root_ale', mugs: 7, tier: 'fresh' });
    const end = second.snapshot();
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
  });
});
