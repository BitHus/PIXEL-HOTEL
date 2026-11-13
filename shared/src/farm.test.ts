import { describe, expect, it } from 'vitest';
import { COOKING_POT, FARM_PLOTS, FARM_PLOT_SIZE } from './config.ts';
import { buySeeds, emptyFarm, farmCounts, growMs, harvest, harvestPlot, plant, plantPlot, ripeInMs, stageOf, type Plot } from './farm.ts';
import { farmPlotCount, noPlaceRects, plotAt, plotRect, potRect } from './farmLayout.ts';
import { CROP_TYPES, getCropType } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { upgradeRoom } from './economy.ts';
import { readSave, toSaveText } from './save.ts';
import { canPlace, getFurnitureType, roomBlockers } from './furniture.ts';
import { rectInsideFloor, rectsOverlap, type Room } from './room.ts';
import { seededRng } from './rng.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';

const MIN = 60_000;
const rich = (gold = 1000): GameState => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold }, 0)!;
const farmRoom = (s: GameState): Room => s.rooms.find((r) => r.id === s.player.farmRoomId)!;
const ledgerAddsUp = (s: GameState): void => {
  expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  expect(ledgerMaterials(s)).toEqual(s.player.materials);
};

describe('crops.json (section 10b)', () => {
  it('has the five crops with their seed prices, times and values', () => {
    const row = (id: string) => {
      const c = CROP_TYPES.find((x) => x.id === id)!;
      return [c.seedPrice, c.growMinutes, c.baseValue];
    };
    expect(row('turnip')).toEqual([4, 5, 10]);
    expect(row('potato')).toEqual([6, 15, 16]);
    expect(row('carrot')).toEqual([8, 30, 22]);
    expect(row('pumpkin')).toEqual([15, 120, 50]);
    expect(row('glowcap')).toEqual([null, 60, 40]);
  });
});

describe('growing', () => {
  const t0 = 1_000_000;
  const turnip = plant({ crop: null, plantedAt: 0 }, 'turnip_seed', t0)!;

  it('follows the times in crops.json: sprout, half, ripe', () => {
    for (const c of CROP_TYPES) {
      const p = plant({ crop: null, plantedAt: 0 }, c.seed, t0)!;
      const total = c.growMinutes * MIN;
      expect(growMs(c.id)).toBe(total);
      expect(stageOf(p, t0)).toBe('sprout');
      expect(stageOf(p, t0 + total / 2 - 1)).toBe('sprout');
      expect(stageOf(p, t0 + total / 2)).toBe('half');
      expect(stageOf(p, t0 + total - 1)).toBe('half');
      expect(stageOf(p, t0 + total)).toBe('ripe');
      expect(stageOf(p, t0 + total * 100)).toBe('ripe');
    }
    expect(stageOf({ crop: null, plantedAt: 0 }, t0)).toBeNull();
    expect(ripeInMs(turnip, t0 + MIN)).toBe(4 * MIN);
  });

  it('keeps growing across a save and reload (only the planting time is saved)', () => {
    const s = plantPlot(buySeeds(rich(), 'turnip_seed', 1, t0)!, 0, 'turnip_seed', t0)!;
    const loaded = readSave(toSaveText(s, t0 + 1000));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const plot = loaded.state.farm.plots[0]!;
    expect(stageOf(plot, t0 + 2 * MIN)).toBe('sprout');
    expect(stageOf(plot, t0 + 3 * MIN)).toBe('half');
    expect(stageOf(plot, t0 + 5 * MIN)).toBe('ripe');
  });

  it('a plot cannot be planted twice', () => {
    expect(plant(turnip, 'potato_seed', t0 + 1)).toBeNull();
    let s = buySeeds(rich(), 'turnip_seed', 2, 0)!;
    s = plantPlot(s, 0, 'turnip_seed', 1)!;
    expect(plantPlot(s, 0, 'turnip_seed', 2)).toBeNull();
    expect(s.player.materials.turnip_seed).toBe(1);
  });

  it('planting needs a seed in the bag and a plot of this level', () => {
    const s = rich();
    expect(plantPlot(s, 0, 'turnip_seed', 1)).toBeNull();
    const seeded = buySeeds(s, 'turnip_seed', 1, 0)!;
    expect(plantPlot(seeded, 6, 'turnip_seed', 1)).toBeNull(); // level 1 has plots 0 to 5
    expect(plantPlot(seeded, 0, 'turnip' as never, 1)).toBeNull();
  });

  it('harvests only when ripe, 1 to 2 crops, and the plot is empty again', () => {
    expect(harvest(turnip, t0 + 5 * MIN - 1, seededRng(1))).toBeNull();
    expect(harvest({ crop: null, plantedAt: 0 }, t0, seededRng(1))).toBeNull();
    const seen = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      const h = harvest(turnip, t0 + 5 * MIN, seededRng(seed))!;
      expect(h.crop).toBe('turnip');
      expect(h.plot).toEqual({ crop: null, plantedAt: 0 });
      seen.add(h.qty);
    }
    expect([...seen].sort()).toEqual([1, 2]);
  });

  it('plant, wait, harvest: the crops go into the bag and the ledger adds up', () => {
    let s = buySeeds(rich(), 'turnip_seed', 3, 0)!;
    expect(s.player.wallet.gold).toBe(1100 - 12);
    s = plantPlot(s, 0, 'turnip_seed', t0)!;
    s = plantPlot(s, 1, 'turnip_seed', t0)!;
    expect(harvestPlot(s, 0, t0 + MIN, seededRng(1))).toBeNull();
    expect(farmCounts(s.farm, t0 + 5 * MIN)).toEqual({ ripe: 2, growing: 0, empty: 4 });
    const h = harvestPlot(s, 0, t0 + 5 * MIN, seededRng(3))!;
    expect(h.state.player.materials.turnip).toBe(h.harvest.qty);
    expect(h.state.farm.plots[0]).toEqual({ crop: null, plantedAt: 0 });
    expect(h.state.farm.plots[1]?.crop).toBe('turnip');
    expect(h.state.player.materials.turnip_seed).toBe(1);
    ledgerAddsUp(h.state);
  });

  it('seeds cost their price, the glowcap spore is not for sale', () => {
    expect(buySeeds(rich(0), 'pumpkin_seed', 7, 0)).toBeNull(); // 105 gold, 100 in the wallet
    expect(buySeeds(rich(), 'glowcap_spore', 1, 0)).toBeNull();
    expect(buySeeds(rich(), 'turnip_seed', 0, 0)).toBeNull();
    expect(buySeeds(rich(0), 'carrot_seed', 5, 0)?.player.wallet.gold).toBe(60);
  });
});

describe('the farm place', () => {
  it('has 6, 12 and 20 plots, each inside the level 1 farm and apart from the pot and the door', () => {
    expect([1, 2, 3].map((l) => farmPlotCount(l as 1 | 2 | 3))).toEqual([6, 12, 20]);
    const room = farmRoom(rich());
    expect(FARM_PLOTS).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      const r = plotRect(i);
      expect(r.w).toBe(FARM_PLOT_SIZE);
      expect(rectInsideFloor(room, r)).toBe(true);
      expect(rectsOverlap(r, potRect())).toBe(false);
      for (let j = 0; j < i; j++) expect(rectsOverlap(r, plotRect(j))).toBe(false);
    }
    expect(plotAt(1, { x: 50, y: 50 })).toBe(0);
    expect(plotAt(1, { x: 300, y: 50 })).toBeNull(); // a level 2 plot
    expect(plotAt(2, { x: 300, y: 50 })).not.toBeNull();
  });

  it('decorations go around the plots, never on them; the pot blocks walking', () => {
    const s = rich();
    const room = farmRoom(s);
    const plant = getFurnitureType('plant');
    const p0 = plotRect(0);
    expect(canPlace(room, s.items, plant, p0.x + 16, p0.y + 32, 'down')).toBe(false);
    expect(canPlace(room, s.items, getFurnitureType('rug'), p0.x + 16, p0.y + 40, 'down')).toBe(false);
    expect(canPlace(room, s.items, plant, 500, 300, 'down')).toBe(true);
    expect(canPlace(room, s.items, plant, COOKING_POT.x, COOKING_POT.y, 'down')).toBe(false);
    // Shop furniture does not go on the farm; home furniture does.
    expect(canPlace(room, s.items, getFurnitureType('shelf'), 500, 300, 'down')).toBe(false);
    expect(roomBlockers(room, s.items)).toEqual([potRect()]);
    expect(noPlaceRects(room)).toHaveLength(7);
  });

  it('upgrades through the ledger (200, then 600 gold), keep the plots and add new empty ones', () => {
    let s = buySeeds(rich(), 'turnip_seed', 1, 0)!;
    s = plantPlot(s, 2, 'turnip_seed', 5)!;
    const id = s.player.farmRoomId;
    const up = upgradeRoom(s, id, 6)!;
    expect(up.player.wallet.gold).toBe(s.player.wallet.gold - 200);
    expect(up.ledger.at(-1)).toMatchObject({ reason: 'room_upgrade', goldDelta: -200 });
    expect(farmRoom(up)).toMatchObject({ level: 2, w: 704, h: 480 });
    expect(up.farm.plots).toHaveLength(12);
    expect(up.farm.plots.slice(0, 6)).toEqual(s.farm.plots);
    expect(up.farm.plots.slice(6).every((p: Plot) => p.crop === null)).toBe(true);
    const top = upgradeRoom(up, id, 7)!;
    expect(top.player.wallet.gold).toBe(up.player.wallet.gold - 600);
    expect(top.farm.plots).toHaveLength(20);
    expect(top.farm.plots[2]).toEqual({ crop: 'turnip', plantedAt: 5 });
    expect(upgradeRoom(top, id, 8)).toBeNull();
    ledgerAddsUp(top);
  });

  it('an upgrade sends furniture standing on a new plot back to the bag', () => {
    let s = applyChange(rich(), { reason: 'debug', addFurniture: ['plant'] }, 0)!;
    const uid = s.items.find((i) => i.typeId === 'plant')!.uid;
    const p6 = plotRect(6); // a level 2 plot
    s = { ...s, items: s.items.map((i) => (i.uid === uid ? { ...i, roomId: s.player.farmRoomId, x: p6.x + 16, y: p6.y + 32 } : i)) };
    const up = upgradeRoom(s, s.player.farmRoomId, 1)!;
    expect(up.items.find((i) => i.uid === uid)?.roomId).toBeNull();
  });

  it('turnips are cheap and quick: a 4 gold seed gives 10 to 20 gold of crops in 5 minutes', () => {
    expect(getCropType('turnip').growMinutes).toBe(5);
  });
});
