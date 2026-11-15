// The new-game intro and opening rooms (R1 split of main.ts: part 14 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  INTRO_COINS, doorY, INTRO_COIN_EVERY_MS, INTRO_COIN_FLY_MS, INTRO_FIRST_POP_MS, INTRO_STEP_MS, barCoinPoint,
  roomBoundsRect, worldToScreen, TAVERN_INTRO_NEW, type RoomKind,
} from '@pixel-hotel/shared';
import { flyCoin } from '../ui/coinFly.ts';
import type { G13 } from './ctx.ts';

export async function setupRoomFlow(g: G13) {
  const {
    api, newIntro, syncItems, hint, info, sprite, uiRoot, itemViews, shown0, refreshHint, placer, paint, menu,
    bubbles, chat, view, cellGrid, syncGrid, atmosphere, blockers, seating, roomChanged, roomLevels, roomFloats,
    lakeside, guests, tableMess, orders, syncTavern,
    refreshInventory, startIntro, fit, st, late, toast,
  } = g;
  late.openRoom = openRoom;
  late.openRoomKind = openRoomKind;

  // ---------- The new-game intro (step 7b) ----------
  /**
   * The tavern at the overview: the bar and then the other start items pop in, the avatar walks in
   * through the door, the start gold flies from the bar to the gold counter coin by coin while the
   * number counts up, then the first hint shows. A tap anywhere skips to the end.
   */
  async function playNewGameIntro(): Promise<void> {
    const startItems = st.items.filter((i) => i.roomId === st.room.id);
    const gold = (await api.getPlayer()).wallet.gold;
    newIntro.running = true;
    newIntro.hidden = new Set(startItems.map((i) => i.uid));
    syncItems();
    hint.set(null);
    info.setGold(0);
    const home = { x: st.avatar.x, y: st.avatar.y };
    const outside = { x: st.avatar.x, y: doorY(st.room) + 40 };
    st.avatar = { ...st.avatar, ...outside };
    sprite.container.visible = false;

    const skip = document.createElement('div');
    skip.className = 'intro-skip';
    skip.title = 'Tap to skip';
    uiRoot.appendChild(skip);
    let skipped = false;
    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        if (skipped) return resolve();
        const t = window.setTimeout(resolve, ms);
        skip.addEventListener('pointerdown', () => (window.clearTimeout(t), resolve()), { once: true });
      });
    skip.addEventListener('pointerdown', () => (skipped = true), { once: true });

    const counter = startItems.find((i) => i.typeId === 'counter');
    await wait(INTRO_FIRST_POP_MS);
    for (const item of [counter, ...startItems.filter((i) => i !== counter)]) {
      if (skipped || !item) break;
      newIntro.hidden.delete(item.uid);
      syncItems();
      itemViews.pop(item.uid);
      await wait(INTRO_STEP_MS);
    }
    if (!skipped) {
      // The avatar walks in through the door.
      sprite.container.visible = true;
      st.path = [home];
      st.avatar = { ...st.avatar, state: 'walk' };
      await wait(INTRO_STEP_MS * 2);
    }
    if (!skipped && counter) {
      // The start gold flies from the bar to the gold counter, coin by coin.
      const till = barCoinPoint(counter, startItems);
      const target = info.coinTarget();
      let shown = 0;
      const per = Math.ceil(gold / INTRO_COINS);
      for (let k = 0; k < INTRO_COINS && !skipped; k++) {
        const from = till ? worldToScreen(till, shown0()) : { x: 0, y: 0 };
        flyCoin(uiRoot, from, target(), INTRO_COIN_FLY_MS, () => {
          if (skipped) return;
          shown = Math.min(gold, shown + per);
          info.setGold(shown);
        });
        await wait(INTRO_COIN_EVERY_MS);
      }
      await wait(INTRO_COIN_FLY_MS);
    }
    // The end (also after a skip): everything in place.
    skip.remove();
    newIntro.running = false;
    newIntro.hidden.clear();
    syncItems();
    sprite.container.visible = true;
    if (skipped) {
      st.path = [];
      st.avatar = { ...st.avatar, ...home, state: 'idle' };
    }
    info.setGold(gold);
    await refreshHint();
    toast(TAVERN_INTRO_NEW);
  }

  // ---------- Rooms ----------
  /** Opens a room: draws it, puts the avatar in the door zone and plays the camera intro. */
  async function openRoom(roomId: number, intro = true): Promise<void> {
    placer.cancel();
    paint.end();
    menu.close();
    bubbles.clear();
    chat.clear();
    const state = await api.enterRoom(roomId);
    st.room = state.room;
    st.bounds = roomBoundsRect(st.room);
    view.setRoom(st.room);
    cellGrid.setRoom(st.room);
    syncGrid();
    atmosphere.setRoom(st.room);
    itemViews.setRoom(st.room.id);
    blockers.setRoom(st.room);
    st.items = await api.getItems();
    const mine = state.avatars[0];
    if (mine) st.avatar = { ...mine, look: st.avatar.look };
    st.path = [];
    st.goal = null;
    seating.clear();
    st.marked = null;
    syncItems();
    roomChanged();
    info.setRoom(st.room.kind);
    roomLevels.set(st.room.id, st.room.level);
    roomFloats.clear();
    await lakeside.enter(st.room);
    st.serving = null;
    guests.clear();
    tableMess.clear();
    orders.clear();
    sprite.setHeld(null);
    st.seatedGuests = 0;
    st.tavern = await api.getTavern();
    syncTavern();
    await refreshInventory();
    await refreshHint();
    if (intro) startIntro();
    else fit();
  }
  async function openRoomKind(kind: RoomKind): Promise<void> {
    if (kind === st.room.kind) return;
    const p = await api.getPlayer();
    await openRoom(kind === 'hotel' ? p.hotelRoomId : kind === 'shop' ? p.shopRoomId : kind === 'lakeside' ? p.lakesideRoomId : p.farmRoomId);
  }

  return { playNewGameIntro, openRoom };
}
