// Owner bug 19 Nov: "I can't walk in the cellar." Walking works in the cellar at every level, through the door and on an old save.

import { describe, expect, it } from 'vitest';
import { createNewPlayer, saveKey, toSaveText, type Point } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const T0 = 1_000_000;

function open(level: 1 | 2 | 3) {
  const storage = memoryStorage();
  const base = createNewPlayer(undefined, T0);
  const state = { ...base, playerCreated: true, player: { ...base.player, level: 2, wallet: { ...base.player.wallet, gold: 5000 } } };
  storage.set(saveKey(), toSaveText(state, T0));
  const api = LocalGameAPI.open(storage, () => T0, () => 0.5).api;
  return { api, level };
}

describe('walking in the cellar', () => {
  for (const level of [1, 2, 3] as const) {
    it(`level ${level}: enter by the tavern door, then tap-walk to several free spots`, async () => {
      const { api } = open(level);
      const p0 = await api.getPlayer();
      await api.enterRoom(p0.shopRoomId);
      const room = await api.buildCellar();
      expect(room).not.toBeNull();
      for (let l = 2; l <= level; l++) expect(await api.upgradeRoom(room!.id)).not.toBeNull();
      await api.enterRoom(p0.shopRoomId);
      const rs = await api.useDoor('tavern_to_cellar');
      expect(rs?.room.kind).toBe('cellar');
      const me = rs!.avatars[0]!;
      const goals: Point[] = [{ x: 96, y: 96 }, { x: 160, y: 100 }, { x: rs!.room.w / 2, y: rs!.room.h / 2 }];
      for (const g of goals) {
        const path = await api.walk(g);
        expect(path, `walk to ${g.x},${g.y} from ${me.x},${me.y}`).not.toBeNull();
        expect(path!.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('cellar real time', () => {
  it('the avatar actually moves over time', async () => {
    let now = T0;
    const storage = memoryStorage();
    const base = createNewPlayer(undefined, T0);
    storage.set(saveKey(), toSaveText({ ...base, playerCreated: true, player: { ...base.player, level: 2, wallet: { ...base.player.wallet, gold: 5000 } } }, T0));
    const api = LocalGameAPI.open(storage, () => now, () => 0.5).api;
    await api.enterRoom((await api.getPlayer()).shopRoomId);
    await api.buildCellar();
    const rs = await api.useDoor('tavern_to_cellar');
    now += 3000;
    const p = await api.walk({ x: 200, y: 120 });
        now += 3000;
    const a = (api as unknown as { avatarNow(): { x: number; y: number } }).avatarNow();
    expect(p).not.toBeNull();
    expect(Math.hypot(a.x - rs!.avatars[0]!.x, a.y - rs!.avatars[0]!.y)).toBeGreaterThan(20);
      });
});

describe('cellar enterRoom', () => {
  it('map travel: the avatar starts on a free cell and every cell is reachable', async () => {
    const { api } = open(1);
    const p0 = await api.getPlayer();
    await api.enterRoom(p0.shopRoomId);
    const room = (await api.buildCellar())!;
    const rs = await api.enterRoom(room.id);
    const me = rs.avatars[0]!;
        const grid = (api as unknown as { grid: { cols: number; rows: number; blocked: boolean[] } }).grid;
    let free = 0;
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      if (grid.blocked[r * grid.cols + c]) continue;
      free++;
      const path = await api.walk({ x: c * 32 + 16, y: r * 32 + 16 });
      expect(path, `cell ${c},${r}`).not.toBeNull();
      const end = path![path!.length - 1]!;
      expect(Math.hypot(end.x - (c * 32 + 16), end.y - (r * 32 + 16))).toBeLessThan(2);
    }
    expect(free).toBeGreaterThan(30);
  });
});
