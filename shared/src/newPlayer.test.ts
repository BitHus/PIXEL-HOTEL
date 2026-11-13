import { describe, expect, it } from 'vitest';
import { createNewPlayer, styleKey } from './newPlayer.ts';
import { HOTBAR_SLOTS } from './config.ts';

describe('createNewPlayer (brief section 9)', () => {
  const s = createNewPlayer(undefined, 1234);

  it('gives level 1, 0 xp, 100 gold, 4 wood and 2 cloth, nothing else', () => {
    expect(s.player.level).toBe(1);
    expect(s.player.xp).toBe(0);
    expect(s.player.wallet).toEqual({ gold: 100 });
    expect(s.player.materials).toEqual({ wood: 4, cloth: 2 });
    expect(s.player.gear).toEqual([]);
    expect(s.player.potions).toBe(0);
  });

  it('unlocks only the bare floor and bare wall, used in both rooms', () => {
    expect(s.player.unlockedStyles).toEqual([styleKey('floor', 'bare'), styleKey('wall', 'bare')]);
    for (const r of s.rooms) expect([r.floorStyle, r.wallStyle]).toEqual(['bare', 'bare']);
  });

  it('has an empty level 1 hotel room (576x384) and a level 1 shop room (576x320)', () => {
    const hotel = s.rooms.find((r) => r.id === s.player.hotelRoomId);
    const shop = s.rooms.find((r) => r.id === s.player.shopRoomId);
    expect(hotel).toMatchObject({ kind: 'hotel', level: 1, w: 576, h: 384, ownerId: s.player.id });
    expect(shop).toMatchObject({ kind: 'shop', level: 1, w: 576, h: 320, ownerId: s.player.id });
    expect(s.rooms).toHaveLength(2);
    expect(s.currentRoomId).toBe(hotel?.id);
  });

  it('has no furniture in the rooms or the inventory, and an empty hotbar', () => {
    expect(s.items).toEqual([]);
    expect(s.hotbar).toEqual(Array(HOTBAR_SLOTS).fill(null));
  });

  it('writes the start gold and materials to the ledger', () => {
    expect(s.ledger).toEqual([
      { id: 1, at: 1234, playerId: s.player.id, reason: 'start', goldDelta: 100, materials: { wood: 4, cloth: 2 } },
    ]);
  });
});
