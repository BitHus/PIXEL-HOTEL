// LocalGameAPI helpers: shop and catalog. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  gainsSince,
  blockRects,
  buyCatalog,
  putOnShelf,
  setPrice,
  shopAppeal,
  takeFromShelf,
  validPrice,
  buildNavGrid,
  itemBlockers,
  type BuyResult,
  type ShelfSlotRef,
  type ShopEvent,
  type ShopView,
  type ShopWorld,
  type StockPick,
  type GameState,
} from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const shopApi = {
  async getShop(h: LocalGameAPI): Promise<ShopView> {
    return h.shopView();
  },

  async putOnShelf(h: LocalGameAPI, slot: ShelfSlotRef, pick: StockPick, price: number): Promise<ShopView | null> {
    const next = putOnShelf(h.state, slot, pick, price, h.now());
    if (!next) return null;
    h.commit(h.hintDone(next, 2));
    return h.shopView();
  },

  async takeFromShelf(h: LocalGameAPI, slot: ShelfSlotRef): Promise<ShopView | null> {
    const next = takeFromShelf(h.state, slot, h.now());
    if (!next) return null;
    h.commit(next);
    return h.shopView();
  },

  async setPrice(h: LocalGameAPI, slot: ShelfSlotRef, price: number): Promise<ShopView | null> {
    if (!validPrice(price)) return null;
    const next = setPrice(h.state, slot, price);
    if (!next) return null;
    h.commit(next);
    return h.shopView();
  },

  onShop(h: LocalGameAPI, listener: (e: ShopEvent) => void): () => void {
    h.shopListeners.add(listener);
    return () => h.shopListeners.delete(listener);
  },

  async buyCatalog(h: LocalGameAPI, typeId: string): Promise<BuyResult | null> {
    const first = !h.state.ledger.some((e) => e.reason === 'catalog' || e.reason === 'style');
    const next = buyCatalog(h.state, typeId, h.now());
    if (!next) return null;
    const uid = next.ledger.at(-1)?.furnitureUids?.[0];
    if (uid === undefined) return null;
    const gains = gainsSince(h.state, next);
    h.commit(h.hintDone(next, 0));
    return { uid, first, gains };
  },

  shopView(h: LocalGameAPI): ShopView {
    const shop = h.state.shop;
    const room = h.roomById(shop.roomId);
    return structuredClone({
      roomId: shop.roomId,
      slots: shop.slots,
      saleHistory: shop.saleHistory,
      appeal: room ? shopAppeal(room, h.state.items) : 0,
      customers: shop.customers,
    });
  },

  shopWorld(h: LocalGameAPI, state: GameState): ShopWorld {
    const room = state.rooms.find((r) => r.id === state.shop.roomId);
    if (!room) throw new Error('shop room missing');
    h.shopGrid ??= buildNavGrid(room, [...itemBlockers(state.items, room.id), ...blockRects(room)]);
    // The own avatar's seat in the shop (customers do not sit there).
    const seated = state.currentRoomId === room.id ? h.walkState.seated : null;
    return { room, items: state.items, grid: h.shopGrid, cashier: h.isServing(), seatsTaken: seated ? [seated] : [] };
  },
};
