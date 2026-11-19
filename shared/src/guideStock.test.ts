import { describe, expect, it } from 'vitest';
import { guideStock } from './guideStock.ts';
import { createNewPlayer } from './newPlayer.ts';

describe('guideStock', () => {
  it('a bare input can cook nothing, brew nothing and has no mugs', () => {
    const s = guideStock({ gold: 0, materials: {}, bagFurniture: [], tavern: { taps: [], tray: [] } });
    expect(s).toMatchObject({ canCook: false, canBrew: false, mugs: 0, hasSeeds: false, hasWallPiece: false });
  });
  it('crops make cooking and brewing possible, mugs count from bag, taps and tray', () => {
    const s = guideStock({ gold: 50, materials: { turnip: 4, potato: 4, ale: 2 } as never, bagFurniture: [], tavern: { taps: [{ standUid: 1, slot: 0, drink: 'ale' as never, mugs: 3 }], tray: [{ item: 'ale' as never }] } });
    expect(s.canCook).toBe(true);
    expect(s.mugs).toBeGreaterThanOrEqual(4);
    expect(s.gold).toBe(50);
  });
  it('a fresh state has the start mugs on the taps but no crops yet', () => {
    const g = createNewPlayer();
    const s = guideStock({ gold: g.player.wallet.gold, materials: g.player.materials, bagFurniture: g.items.filter((i) => i.roomId === null), tavern: g.tavern });
    expect(s.canBrew).toBe(false); // the starter crops are granted by the API at game start, not by createNewPlayer
    expect(s.mugs).toBeGreaterThan(0);
    expect(s.gold).toBe(100);
  });
});
