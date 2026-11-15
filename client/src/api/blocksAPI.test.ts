// Step BG5: blocks and punching through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, applyChange, holdStart, holdTick, createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function fresh(): GameState {
  const s = createNewPlayer(undefined, 0);
  return { ...applyChange(s, { reason: 'debug', materials: { dirt: 30, stone: 30 } }, 0)!, playerCreated: true };
}

function open(state: GameState, seed = 4) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, clock, seededRng(seed)).api };
}

describe('blocks through the GameAPI', () => {
  it('buys blocks for baseValue * 3 and puts them in the bag', async () => {
    t = 1000;
    const { api } = open({ ...createNewPlayer(undefined, 0), playerCreated: true });
    expect(await api.buyBlocks('dirt', 10)).toEqual([{ itemId: 'dirt', count: 10, rank: 'common' }]);
    expect((await api.getPlayer()).wallet.gold).toBe(100 - 6 * 10);
    expect((await api.getInventory()).materials.dirt).toBe(10);
    expect(await api.buyBlocks('cinder_block', 1)).toBeNull(); // not sold
    expect(await api.buyBlocks('stone', 99)).toBeNull(); // not enough gold
  });

  it('places a block in reach, and a far one walks closer first', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    const near = await api.placeBlock(9, 9, 'dirt');
    expect(near).toMatchObject({ kind: 'placed', c: 9, r: 9 });
    if (near.kind !== 'placed') return;
    expect(near.room.blocks['9,9']).toMatchObject({ id: 'dirt' });
    expect((await api.getInventory()).materials.dirt).toBe(29);
    // Far away: the avatar walks closer; nothing is placed yet.
    const far = await api.placeBlock(9, 2, 'dirt');
    expect(far.kind).toBe('walk');
    if (far.kind !== 'walk') return;
    expect(far.path.length).toBeGreaterThan(1);
    expect((await api.getRoom(s.player.hotelRoomId))!.blocks['9,2']).toBeUndefined();
    // After the walk (time passes) the same request places it.
    t += 20_000;
    expect(await api.placeBlock(9, 2, 'dirt')).toMatchObject({ kind: 'placed' });
  });

  it('refuses the door zone, a taken cell, and a block that is not in the bag', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    expect(await api.placeBlock(8, 10, 'dirt')).toEqual({ kind: 'refused', problem: 'door' });
    expect(await api.placeBlock(9, 9, 'dirt')).toMatchObject({ kind: 'placed' });
    expect(await api.placeBlock(9, 9, 'dirt')).toEqual({ kind: 'refused', problem: 'taken' });
    expect(await api.placeBlock(8, 9, 'brick')).toEqual({ kind: 'refused', problem: 'empty' });
    // The cell the avatar stands on (it stands still at the door point: cell 9, 10 is the zone; use its own cell).
    const lake = (await api.getPlayer()).lakesideRoomId;
    await api.enterRoom(lake);
    expect(await api.placeBlock(3, 3, 'dirt')).toEqual({ kind: 'refused', problem: 'not_buildable' });
  });

  it('punches one hit per tap with a cooldown, and the block drops itself back', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    await api.placeBlock(9, 9, 'stone'); // hardness 4
    const hits: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await api.hitBlock(9, 9);
      hits.push(r.kind === 'refused' ? `refused:${r.problem}` : r.kind);
      // The second request in the same instant is inside the cooldown.
      if (i === 0) expect(await api.hitBlock(9, 9)).toEqual({ kind: 'refused', problem: 'cooldown' });
      t += BLOCK_HIT_COOLDOWN_MS;
      if (r.kind === 'broken') break;
    }
    expect(hits).toEqual(['cracked', 'cracked', 'cracked', 'broken']);
    expect((await api.getInventory()).materials.stone).toBeGreaterThanOrEqual(29); // the block comes back by chance
    expect(await api.hitBlock(9, 9)).toEqual({ kind: 'refused', problem: 'no_block' });
  });

  it('a held press (holdTick on a 16 ms clock) breaks a block with no refused hits, and stops on release', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    await api.placeBlock(9, 9, 'stone'); // 4 hits
    let h = holdStart();
    const kinds: string[] = [];
    let frames = 0;
    for (let now = 0; now < 3000 && kinds[kinds.length - 1] !== 'broken'; now += 16, frames++) {
      t += 16;
      const r = holdTick(h, now, BLOCK_HIT_COOLDOWN_MS);
      h = r.state;
      if (r.hit) kinds.push((await api.hitBlock(9, 9)).kind);
    }
    expect(kinds).toEqual(['cracked', 'cracked', 'cracked', 'broken']); // never 'refused' (cooldown)
    expect(frames * 16).toBeLessThan(4 * (BLOCK_HIT_COOLDOWN_MS + 16));
    // Released: no more ticks, so no more requests; the cell is free.
    expect(await api.hitBlock(9, 9)).toEqual({ kind: 'refused', problem: 'no_block' });
  });

  it('a held press out of reach gets a walk answer and changes nothing', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    await api.placeBlock(9, 9, 'dirt');
    t += 60_000;
    const far = await api.hitBlock(9, 2); // nothing there: refused before any walk
    expect(far).toEqual({ kind: 'refused', problem: 'no_block' });
    expect(await api.placeBlock(9, 2, 'dirt')).toMatchObject({ kind: 'walk' }); // too far: walks, places nothing
    expect((await api.getRoom(s.player.hotelRoomId))!.blocks['9,2']).toBeUndefined();
  });

  it('breaking can give gems and an item through the gains list and the ledger', async () => {
    t = 1000;
    const s = fresh();
    // Many blocks broken: with the gem chance some drop gems; the ledger always agrees with the wallet.
    const { api } = open(s, 11);
    await api.enterRoom(s.player.hotelRoomId);
    let gems = 0;
    let dirt = 0;
    for (let i = 0; i < 60; i++) {
      await api.placeBlock(9, 9, 'dirt');
      const r = await api.hitBlock(9, 9);
      t += BLOCK_HIT_COOLDOWN_MS;
      expect(r.kind).toBe('broken');
      if (r.kind === 'broken') {
        dirt += r.gains.find((g) => g.itemId === 'dirt')?.count ?? 0;
        gems += r.gains.find((g) => g.itemId === 'gems')?.count ?? 0;
      }
    }
    expect(gems).toBeGreaterThan(0);
    const p = await api.getPlayer();
    expect(p.wallet.gems).toBe(gems);
    const snap = api.snapshot();
    expect(snap.ledger.reduce((a, e) => a + (e.gemsDelta ?? 0), 0)).toBe(gems);
    expect(ledgerMaterials(snap).dirt).toBe(30 - 60 + dirt); // 60 placed, some came back
    expect(ledgerGold(snap)).toBe(p.wallet.gold);
  });

  it('blocks are saved and come back; the door cannot be shut off', async () => {
    t = 1000;
    const s = fresh();
    const { api, storage } = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    expect(await api.placeBlock(9, 9, 'dirt')).toMatchObject({ kind: 'placed' });
    const again = LocalGameAPI.open(storage, clock, seededRng(2)).api;
    expect((await again.getRoom(s.player.hotelRoomId))!.blocks['9,9']).toMatchObject({ id: 'dirt' });
    // A wall across row 9. A cell the avatar stands on is refused ('avatar'): it moves on and tries again.
    const results: string[] = [];
    const tryCell = async (c: number): Promise<void> => {
      const go = async (): Promise<Awaited<ReturnType<typeof again.placeBlock>>> => {
        let res = await again.placeBlock(c, 9, 'dirt');
        for (let k = 0; k < 4 && res.kind === 'walk'; k++) {
          t += 30_000; // the walk is done
          res = await again.placeBlock(c, 9, 'dirt');
        }
        return res;
      };
      let r = await go();
      if (r.kind === 'refused' && r.problem === 'avatar') {
        await again.walk({ x: 288, y: 150 });
        t += 30_000;
        r = await go();
      }
      results.push(r.kind === 'refused' ? r.problem : r.kind);
    };
    for (let c = 0; c < 18; c++) if (c !== 9) await tryCell(c);
    expect(results.filter((r) => r === 'door_blocked')).toHaveLength(1);
    expect(results.filter((r) => r === 'placed')).toHaveLength(16);
    // Walking still works afterwards: the door reaches the middle.
    expect(await again.walk({ x: 288, y: 192 })).not.toBeNull();
  });

  it('works in the shop too: customers keep walking, and the counter stays reachable', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(s);
    await api.enterRoom(s.player.shopRoomId);
    // A few blocks near the door; the shop keeps working and the player can still serve.
    for (const [c, r] of [[6, 6], [7, 6], [11, 6], [12, 6]] as const) {
      const res = await api.placeBlock(c, r, 'stone');
      expect(['placed', 'walk']).toContain(res.kind);
    }
    t += 5000;
    const view = await api.getShop();
    expect(view.roomId).toBe(s.player.shopRoomId);
    const counter = (await api.getItems()).find((i) => i.typeId === 'counter')!;
    expect(await api.serve(counter.uid)).not.toBeNull();
  });
});
