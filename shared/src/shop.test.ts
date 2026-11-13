import { describe, expect, it } from 'vitest';
import { FIRST_CUSTOMER_DELAY_MS, OFFLINE_MAX_MS } from './config.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { seededRng } from './rng.ts';
import {
  allSlots,
  cheapestIn,
  chooseCategory,
  customerIntervalMs,
  decide,
  emptyShop,
  lootBaseValue,
  putOnShelf,
  recordSale,
  returnOrphanLoot,
  rollTolerance,
  setPrice,
  shopAppeal,
  simulateShop,
  takeFromShelf,
  visit,
  type ShopState,
} from './shop.ts';
import { pickUpItem } from './furniture.ts';
import type { GameState } from './gameState.ts';
import type { FurnitureItem, ShopSlot } from './types.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';

const fresh = (): GameState => createNewPlayer(undefined, 0);
const table = (s: GameState): FurnitureItem => s.items.find((i) => i.typeId === 'stall_table')!;
const shopRoom = (s: GameState) => s.rooms.find((r) => r.id === s.player.shopRoomId)!;

describe('shop slots', () => {
  it('the stall_table has 3 slots and holds at most 3 items', () => {
    let s = fresh();
    const uid = table(s).uid;
    expect(allSlots(s.items, s.shop.roomId)).toEqual([0, 1, 2].map((index) => ({ shelfUid: uid, index })));
    s = putOnShelf(s, { shelfUid: uid, index: 0 }, { kind: 'material', id: 'wood' }, 5, 1)!;
    s = putOnShelf(s, { shelfUid: uid, index: 1 }, { kind: 'material', id: 'wood' }, 5, 1)!;
    s = putOnShelf(s, { shelfUid: uid, index: 2 }, { kind: 'material', id: 'cloth' }, 9, 1)!;
    expect(s.shop.slots).toHaveLength(3);
    expect(putOnShelf(s, { shelfUid: uid, index: 3 }, { kind: 'material', id: 'wood' }, 5, 1)).toBeNull();
    expect(putOnShelf(s, { shelfUid: uid, index: 0 }, { kind: 'material', id: 'wood' }, 5, 1)).toBeNull();
    expect(s.player.materials).toEqual({ wood: 2, cloth: 1 });
  });

  it('putting and taking back goes through the ledger and the bag', () => {
    let s = fresh();
    const ref = { shelfUid: table(s).uid, index: 0 };
    s = putOnShelf(s, ref, { kind: 'material', id: 'cloth' }, 8, 1)!;
    expect(s.player.materials.cloth).toBe(1);
    expect(ledgerMaterials(s)).toEqual(s.player.materials);
    s = setPrice(s, ref, 11)!;
    expect(s.shop.slots[0]?.price).toBe(11);
    expect(setPrice(s, ref, 0)).toBeNull();
    expect(setPrice(s, ref, 2.5)).toBeNull();
    s = takeFromShelf(s, ref, 2)!;
    expect(s.player.materials.cloth).toBe(2);
    expect(s.shop.slots).toEqual([]);
    expect(ledgerMaterials(s)).toEqual(s.player.materials);
  });

  it('a furniture item leaves the items while on a slot and comes back with its uid', () => {
    let s = applyChange(fresh(), { reason: 'debug', addFurniture: ['chair'] }, 0)!;
    const chair = s.items.find((i) => i.typeId === 'chair')!;
    const ref = { shelfUid: table(s).uid, index: 1 };
    s = putOnShelf(s, ref, { kind: 'furniture', typeId: 'chair' }, 15, 1)!;
    expect(s.items.some((i) => i.uid === chair.uid)).toBe(false);
    expect(s.shop.slots[0]?.loot).toEqual({ kind: 'furniture', uid: chair.uid, typeId: 'chair' });
    s = takeFromShelf(s, ref, 2)!;
    expect(s.items.find((i) => i.uid === chair.uid)).toMatchObject({ roomId: null, typeId: 'chair' });
  });

  it('nothing to put: refused', () => {
    const s = fresh();
    expect(putOnShelf(s, { shelfUid: table(s).uid, index: 0 }, { kind: 'material', id: 'bone' }, 5, 1)).toBeNull();
    expect(putOnShelf(s, { shelfUid: table(s).uid, index: 0 }, { kind: 'furniture', typeId: 'chair' }, 5, 1)).toBeNull();
  });

  it('picking up a table that holds items returns them to the bag', () => {
    let s = fresh();
    const uid = table(s).uid;
    s = putOnShelf(s, { shelfUid: uid, index: 0 }, { kind: 'material', id: 'wood' }, 5, 1)!;
    s = { ...s, items: pickUpItem(s.items, uid) };
    s = returnOrphanLoot(s, 2);
    expect(s.shop.slots).toEqual([]);
    expect(s.player.materials.wood).toBe(4);
  });
});

describe('appeal and customers (section 9)', () => {
  const room = { ...fresh().rooms[1]! };
  const item = (typeId: string, uid: number): FurnitureItem => ({ uid, typeId, ownerId: 1, roomId: room.id, x: 0, y: 0, facing: 'down', onItemUid: null });

  it('counts each type at most 3 times, adds the styles, and never exceeds 100', () => {
    expect(shopAppeal(room, [item('counter', 1)])).toBe(8);
    const banners = [1, 2, 3, 4, 5].map((u) => item('banner', u));
    expect(shopAppeal(room, banners)).toBe(18);
    expect(shopAppeal({ ...room, floorStyle: 'wood_planks', wallStyle: 'brick' }, banners)).toBe(26);
    const lots = ['sign', 'banner', 'display_case', 'shop_rug', 'counter', 'lamp', 'plant'].flatMap((t, k) =>
      [0, 1, 2, 3].map((n) => item(t, k * 10 + n)),
    );
    expect(shopAppeal({ ...room, floorStyle: 'red_carpet', wallStyle: 'plaster' }, lots)).toBe(100);
  });

  it('the spawn interval shrinks as appeal rises', () => {
    expect(customerIntervalMs(0)).toBe(60_000);
    expect(customerIntervalMs(100)).toBe(30_000);
    for (let a = 0; a < 100; a += 10) expect(customerIntervalMs(a + 10)).toBeLessThan(customerIntervalMs(a));
  });

  it('reactions match section 9', () => {
    // baseValue 10, tolerance 1: limit 10.
    expect(decide(7, 10, 1)).toEqual({ buy: true, reaction: 'big_smile' });
    expect(decide(8, 10, 1)).toEqual({ buy: true, reaction: 'smile' });
    expect(decide(10, 10, 1)).toEqual({ buy: true, reaction: 'smile' });
    expect(decide(11, 10, 1)).toEqual({ buy: false, reaction: 'shrug' });
    expect(decide(11.5, 10, 1)).toEqual({ buy: false, reaction: 'shrug' });
    expect(decide(12, 10, 1)).toEqual({ buy: false, reaction: 'frown' });
    expect(decide(13, 10, 1.3)).toEqual({ buy: true, reaction: 'smile' });
  });

  it('tolerance is in [0.8, 1.4] and the wanted category is mostly one with stock', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 500; i++) {
      const t = rollTolerance(rng);
      expect(t).toBeGreaterThanOrEqual(0.8);
      expect(t).toBeLessThanOrEqual(1.4);
    }
    const shop: ShopState = { ...emptyShop(2, 0), slots: [{ shelfUid: 1, index: 0, loot: { kind: 'material', id: 'wood', qty: 1 }, price: 3 }] };
    let materials = 0;
    for (let i = 0; i < 2000; i++) if (chooseCategory(shop, rng) === 'materials') materials++;
    // 80% + 20% * 1/4 = 85%.
    expect(materials / 2000).toBeGreaterThan(0.8);
    expect(materials / 2000).toBeLessThan(0.9);
  });

  it('looks at the cheapest item in the wanted category and never buys above baseValue * tolerance', () => {
    const slot = (index: number, id: 'wood' | 'crystal', price: number): ShopSlot => ({ shelfUid: 1, index, loot: { kind: 'material', id, qty: 1 }, price });
    const shop: ShopState = { ...emptyShop(2, 0), slots: [slot(0, 'crystal', 20), slot(1, 'wood', 4), slot(2, 'wood', 2)] };
    expect(cheapestIn(shop, 'materials')).toEqual(slot(2, 'wood', 2));
    expect(cheapestIn(shop, 'home_furniture')).toBeNull();
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) {
      const tol = rollTolerance(rng);
      const prices = [1, 2, 3, 4, 5, 20];
      for (const p of prices) {
        const v = visit({ ...shop, slots: [slot(0, 'crystal', 20), slot(1, 'wood', p)] }, 'materials', tol);
        expect(v.slot?.price).toBe(Math.min(p, 20));
        if (v.decision?.buy) expect(v.slot!.price).toBeLessThanOrEqual(lootBaseValue(v.slot!.loot!) * tol);
        else expect(v.slot!.price).toBeGreaterThan(lootBaseValue(v.slot!.loot!) * tol);
      }
    }
  });

  it('keeps the last 5 sale prices per type', () => {
    let h: Record<string, number[]> = {};
    for (let p = 1; p <= 7; p++) h = recordSale(h, 'wood', p);
    expect(h.wood).toEqual([3, 4, 5, 6, 7]);
  });
});

describe('simulateShop (offline, maths only)', () => {
  const stocked = (): ShopState => ({
    ...emptyShop(2, 1000),
    slots: Array.from({ length: 6 }, (_, index) => ({ shelfUid: 1, index, loot: { kind: 'material', id: 'wood', qty: 1 } as const, price: 3 })),
  });

  it('the first customer comes after 10 s, then one per interval, with no sales cap', () => {
    const r = simulateShop(stocked(), 0, 24 * 3600 * 1000, seededRng(1));
    expect(r.sales.length).toBeGreaterThan(0);
    expect(r.sales[0]!.at).toBeGreaterThanOrEqual(1000 + FIRST_CUSTOMER_DELAY_MS);
    for (const s of r.sales) expect((s.at - 1000 - FIRST_CUSTOMER_DELAY_MS) % 60_000).toBe(0);
  });

  it('never simulates more than 8 hours', () => {
    // Nothing sells (too expensive): the timer runs the whole span.
    const shop = { ...stocked(), slots: stocked().slots.map((s) => ({ ...s, price: 999 })) };
    const r = simulateShop(shop, 0, 30 * 3600 * 1000, seededRng(2));
    expect(r.sales).toEqual([]);
    const cheap = simulateShop({ ...stocked(), slots: Array.from({ length: 1000 }, (_, index) => ({ shelfUid: 1, index, loot: { kind: 'material' as const, id: 'wood' as const, qty: 1 }, price: 1 })) }, 100, 30 * 3600 * 1000, seededRng(4));
    for (const s of cheap.sales) expect(s.at - 1000).toBeLessThanOrEqual(OFFLINE_MAX_MS);
    expect(cheap.sales.length).toBeLessThanOrEqual(OFFLINE_MAX_MS / customerIntervalMs(100) + 1);
  });

  it('the timer pauses while the shop is empty', () => {
    const r = simulateShop(emptyShop(2, 0), 0, 3600_000, seededRng(1));
    expect(r.shop.nextCustomerInMs).toBe(FIRST_CUSTOMER_DELAY_MS);
  });
});

describe('the ledger', () => {
  it('always adds up to the wallet', () => {
    let s = fresh();
    s = putOnShelf(s, { shelfUid: table(s).uid, index: 0 }, { kind: 'material', id: 'wood' }, 5, 1)!;
    s = applyChange(s, { reason: 'sale', gold: 5 }, 2)!;
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
    expect(ledgerMaterials(s)).toEqual(s.player.materials);
    expect(shopRoom(s).kind).toBe('shop');
  });
});
