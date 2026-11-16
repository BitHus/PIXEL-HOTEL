// The tavern: guests, orders, coins on the tables (R1 split of main.ts: part 10 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  REACTION_BUBBLE_MS, getFurnitureType, type FurnitureItem, type Point, kitchenZone, SERVE_QUEUE_MAX, seatKey,
  tavernSeats, type Guest, STOVE_REACH_PX, BARREL_REACH_PX, CASK_REACH_PX, cookOf, cookReady, cookMs, getFoodType, footprintCenter,
  brewOf, brewReady, getDrinkType, type DrinkId, stepPrice, TAVERN_INTRO_OLD, type MenuRowView, type MaterialId, type SellRow, sellWarning,
  getMaterialType, isDrinkId, prepBonus, tapStands, registerPoint, worldToScreen,
} from '@pixel-hotel/shared';
import { createPourControl } from './pourControl.ts';
import { createBrewingPanel } from '../ui/brewingPanel.ts';
import { createMenuPanel } from '../ui/menuPanel.ts';
import { createCaskPanel } from '../ui/caskPanel.ts';
import { createTapsPanel, TAP_EMPTY_TEXT } from '../ui/tapsPanel.ts';
import { PourFx } from '../render/pourFx.ts';
import { TavernFx } from '../render/tavernFx.ts';
import { surfaceHeight } from '../render/furnitureArt.ts';
import { createFirstTenGuide } from '../ui/firstTenGuide.ts';
import { brewReady as brewIsReady, type FirstTenStep, type Point as P2 } from '@pixel-hotel/shared';
import { flyCoin } from '../ui/coinFly.ts';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { sellDetail, sellRowIcon } from '../ui/sellTab.ts';
import { createCookingPanel, cookTimeText } from '../ui/cookingPanel.ts';
import { GuestViews, type Walker } from '../render/guestViews.ts';
import { TableMess, type Meal } from '../render/tableMess.ts';
import { createOrderBubbles, type OrderMark } from '../ui/orderBubbles.ts';
import { drawGood } from '../render/slotGoods.ts';
import { pixelIcon } from '../ui/pixelIcons.ts';
import type { G9 } from './ctx.ts';

export async function setupTavernLife(g: G9) {
  const {
    api, view, ui, uiRoot, updateBadge, toast, sound, popups, sayBubble, bubbles, follow, sprite, st, late, panels, walkTo, prefs, storage,
  } = g;

  // ---------- The tavern (step 9t): guests, orders, coins on the tables ----------
  st.tavern = await api.getTavern();
  // FP-1: the first ten minutes (a skippable guide in a new game) and JU-1 juice; AU-1 sounds are played from the events below.
  const guide = createFirstTenGuide(uiRoot, storage, toast);
  if (st.introPending) guide.begin();
  const fx = new TavernFx(view, () => prefs.reduceEffects);
  let readyNow = new Set<string>();
  /** Steam from ready machines, a "ding" when one becomes ready, the guide's waiting steps and the ambient bed. */
  const syncMachines = (): void => {
    const on = st.room.id === st.tavern.roomId && !fx.paused;
    const now = Date.now();
    const ready = new Set<string>();
    const steam: P2[] = [];
    if (on) {
      for (const c of st.tavern.cooks) if (cookReady(c, now)) ready.add(`s${c.stoveUid}`);
      for (const b of st.tavern.brews) if (brewIsReady(b, now)) ready.add(`b${b.barrelUid}`);
      for (const k of ready) {
        const it = st.items.find((i) => i.uid === Number(k.slice(1)));
        if (it) steam.push({ x: it.x, y: it.y - 26 });
      }
      for (const k of ready) if (!readyNow.has(k)) sound.play('ready');
    }
    readyNow = ready;
    fx.setSteam(steam);
    const waiting: FirstTenStep[] = guide.state.done.includes('collect') || [...ready].some((k) => k[0] === 'b') ? [] : ['collect', 'load'];
    guide.refresh(waiting, on);
    sound.setAmbience(on ? 'tavern' : null, Math.min(1, st.seatedGuests / 6));
  };
  // G2: the hands-on pour. The stand and the drink the avatar waits to pour for (null = nothing to pour).
  let pourFor: { standUid: number; item: MaterialId } | null = null;
  const standTop = (): { stand: FurnitureItem; bar: FurnitureItem | undefined; floorY: number } | null => {
    const stand = pourFor ? st.items.find((i) => i.uid === pourFor!.standUid) : undefined;
    if (!stand) return null;
    const bar = st.items.find((i) => i.uid === stand.onItemUid);
    return { stand, bar, floorY: stand.y - (bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0) };
  };
  const pourControl = createPourControl({
    root: uiRoot,
    screenPoint: () => {
      const s = standTop();
      return s ? worldToScreen({ x: s.stand.x, y: s.floorY - 24 }, st.shown) : null;
    },
    onStart: () => {
      const s = standTop();
      if (!s || !pourFor) return;
      pour.startHeld(s.stand, s.bar, pourFor.item);
      sprite.gesture('hand');
    },
    onFill: (f) => {
      const s = standTop();
      if (!s || !pourFor) return;
      pour.setFill(f, true);
      if (!prefs.reduceEffects) fx.pourSplash({ x: s.stand.x, y: s.floorY - 9 }, s.floorY, getDrinkType(pourFor.item as DrinkId).color, 200);
    },
    glug: (f) => sound.play('pourTick', 'common', f),
    onRelease: (ms) => {
      pour.stop();
      fx.stopPour();
      pourControl.hide();
      pourFor = null;
      void api.pourHeld(ms).then((ok) => ok || toast('Nothing to pour.'));
    },
  });
  const guests = new GuestViews(view);
  const tableMess = new TableMess(view);
  /** A guest as a walker: they only sit once they have reached their seat, and look at the table. */
  const walkers = (list: readonly Guest[]): Walker[] =>
    list.map((g) => ({ id: g.id, look: g.look, x: g.x, y: g.y, facing: g.facing, path: g.path, speed: g.speed, seat: g.seated && g.seat ? { uid: g.seat.uid } : null, sitFacing: g.facing }));
  const inTavern = (): boolean => st.room.id === st.tavern.roomId;
  const orders = createOrderBubbles(ui, (id) => void serveTap(id));
  /** The open orders for the order bubbles: queued or carried ones are dimmed, a guest with little patience is urgent. */
  const orderMarks = (): OrderMark[] =>
    st.tavern.guests.flatMap((g) =>
      g.phase === 'order' && g.order ? [{ guestId: g.id, item: g.order.item, urgent: g.warned, taken: st.tavern.serveQueue.includes(g.id) || st.tavern.holding?.guestId === g.id }] : [],
    );
  /** What guests eat or drink now, on their table spots (the served item stays there until they leave). */
  const meals = (): Meal[] => {
    const seats = tavernSeats(st.items, st.tavern.roomId, kitchenZone(st.room));
    return st.tavern.guests.flatMap((g) => {
      const seat = g.phase === 'eat' && g.order && g.seat ? seats.find((k) => seatKey(k) === seatKey(g.seat!)) : undefined;
      return seat && g.order ? [{ guestId: g.id, item: g.order.item, spot: seat.spot }] : [];
    });
  };
  /** Draws the tavern as it is now (guests, coins and dishes, order bubbles, the Map badge). */
  const syncTavern = (): void => {
    const on = inTavern();
    if (!on && pourFor) {
      pourControl.hide();
      pourFor = null;
    }
    guests.sync(on ? walkers(st.tavern.guests) : [], st.room.id, st.items);
    tableMess.sync(on ? st.tavern.mess : [], on ? meals() : [], st.items);
    orders.sync(on ? orderMarks() : []);
    updateBadge();
    syncMachines();
  };
  st.onItemsSynced = syncTavern;
  async function refreshTavern(): Promise<void> {
    st.tavern = await api.getTavern();
    syncTavern();
    refreshCooks();
    brewing.setBrews(st.tavern.brews);
    refreshTaps();
    refreshCasks();
    maybeIntro();
    if (panels.open === 'menu') void refreshMenu();
  }
  // ---------- The kitchen (step K1): stoves cook batches in real time; a tap collects or opens the Cooking panel ----------
  const cooking = createCookingPanel(ui, {
    start: (stoveUid, food, qty) => {
      void api.startCook(stoveUid, food.id, qty).then(async (ok) => {
        if (ok) sound.play('pop');
        toast(ok ? `Cooking ${qty} x ${food.name}: ready in ${cookTimeText(cookMs(food))}.` : 'You need more crops.');
        await refreshTavern();
        await late.refreshInventory();
      });
    },
    collect: (stoveUid) => void collectStove(stoveUid),
  });
  panels.add('cooking', cooking.el);
  const refreshCooks = (): void => cooking.setCooks(st.tavern.cooks);
  /** Collects a ready batch (dishes into the bag, a popup); false when nothing was ready. */
  async function collectStove(stoveUid: number): Promise<boolean> {
    const r = await api.collectCook(stoveUid);
    if (!r) return false;
    sound.play('collect');
    popups.show(r.gains);
    toast(`${r.qty} x ${getFoodType(r.food).name} are in your bag.`);
    await refreshTavern();
    await late.refreshInventory();
    panels.close();
    return true;
  }
  /** The avatar is next to the stove: a ready batch is collected, else the Cooking panel opens (progress or recipes). */
  async function stoveArrived(uid: number): Promise<void> {
    guide.tip('stove');
    await refreshTavern();
    const cook = cookOf(st.tavern.cooks, uid);
    if (cook && cookReady(cook, Date.now()) && (await collectStove(uid))) return;
    cooking.open(uid);
    cooking.setBonus(prepBonus(st.items, st.room, uid));
    cooking.setCooks(st.tavern.cooks);
    panels.show('cooking');
  }
  /** A tap on a stove: walk next to it (when farther than STOVE_REACH_PX), then collect or open the panel. */
  const stoveTap = (stove: FurnitureItem): void => {
    const c = footprintCenter(stove, stove.typeId);
    if (Math.hypot(st.avatar.x - c.x, st.avatar.y - c.y) <= STOVE_REACH_PX) {
      st.pendingStove = null;
      void stoveArrived(stove.uid);
      return;
    }
    void walkTo({ x: stove.x, y: stove.y + 16 }).then((ok) => {
      if (!ok) toast('There is no way to the stove.');
      else st.pendingStove = stove.uid;
    });
  };
  // The countdown in the panel, and the "ready" moment.
  setInterval(() => {
    if (panels.open === 'cooking') cooking.tick();
    if (panels.open === 'brewing') brewing.tick();
    if (panels.open === 'casks') casks.tick();
    syncMachines();
  }, 1000);
  let lastPanel = panels.open;
  panels.onChange(() => {
    if (panels.open !== null && lastPanel === null) sound.play('uiOpen');
    else if (panels.open === null && lastPanel !== null) sound.play('uiClose');
    lastPanel = panels.open;
  });
  // ---------- Brewing (step 9t C): barrels brew drinks in real time; a tap collects or opens the Brewing panel ----------
  const brewing = createBrewingPanel(ui, {
    start: (barrelUid, drink) => {
      void api.startBrew(barrelUid, drink).then(async (ok) => {
        if (ok) sound.play('pop');
        const d = getDrinkType(drink);
        toast(ok ? `Brewing ${d.mugs} mugs of ${d.name}: ready in ${cookTimeText(d.minutes * 60_000)}.` : 'You need more crops, and a free barrel.');
        await refreshTavern();
        await late.refreshInventory();
      });
    },
    collect: (barrelUid) => void collectBarrel(barrelUid),
  });
  panels.add('brewing', brewing.el);
  /** Collects a ready brew (mugs into the bag, a popup); false when nothing was ready. */
  async function collectBarrel(barrelUid: number): Promise<boolean> {
    const r = await api.collectBrew(barrelUid);
    if (!r) return false;
    sound.play('collect');
    guide.event('collect');
    popups.show(r.gains);
    toast(`${r.mugs} x ${getDrinkType(r.drink as DrinkId).name} are in your bag. Put them on the menu at the bar.`);
    await refreshTavern();
    await late.refreshInventory();
    panels.close();
    return true;
  }
  /** The avatar is next to the barrel: a ready brew is collected, else the Brewing panel opens (progress or recipes). */
  async function barrelArrived(uid: number): Promise<void> {
    guide.event('barrel');
    guide.tip('barrel');
    await refreshTavern();
    const brew = brewOf(st.tavern.brews, uid);
    if (brew && brewReady(brew, Date.now()) && (await collectBarrel(uid))) return;
    brewing.open(uid);
    brewing.refresh(st.inventory.materials);
    brewing.setBrews(st.tavern.brews);
    panels.show('brewing');
  }
  /** A tap on a brewing barrel: walk next to it (when farther than BARREL_REACH_PX), then collect or open the panel. */
  const barrelTap = (barrel: FurnitureItem): void => {
    const c = footprintCenter(barrel, barrel.typeId);
    if (Math.hypot(st.avatar.x - c.x, st.avatar.y - c.y) <= BARREL_REACH_PX) {
      st.pendingBarrel = null;
      void barrelArrived(barrel.uid);
      return;
    }
    void walkTo({ x: barrel.x, y: barrel.y + 16 }).then((ok) => {
      if (!ok) toast('There is no way to the barrel.');
      else st.pendingBarrel = barrel.uid;
    });
  };
  // ---------- The casks (step K2b): a keg rack holds CASK_SLOTS casks that ripen in real time; a tap opens the Cask panel ----------
  const casks = createCaskPanel(ui, {
    fill: (rackUid, slot, drink, qty) => {
      void api.fillCask(rackUid, slot, drink, qty).then(async (ok) => {
        sound.play(ok ? 'pop' : 'click');
        toast(ok ? `${qty} x ${getDrinkType(drink).name} are ripening in the cask.` : 'That did not fit in the cask.');
        await refreshTavern();
        await late.refreshInventory();
      });
    },
    collect: (rackUid, slot) => {
      void api.collectCask(rackUid, slot).then(async (r) => {
        if (!r) {
          toast('There is nothing to collect.');
          return;
        }
        sound.play('pop');
        popups.show(r.gains);
        toast(`${r.mugs} x ${getMaterialType(r.item).name} are in your bag. Load them on a tap.`);
        await refreshTavern();
        await late.refreshInventory();
      });
    },
  });
  panels.add('casks', casks.el);
  const refreshCasks = (): void => casks.update(st.tavern.casks, st.inventory.materials);
  /** The avatar is next to the keg rack: the Cask panel opens. */
  async function caskArrived(uid: number): Promise<void> {
    await refreshTavern();
    casks.open(uid);
    refreshCasks();
    panels.show('casks');
  }
  /** A tap on a keg rack: walk next to it (when farther than CASK_REACH_PX), then open the panel. */
  const caskTap = (rack: FurnitureItem): void => {
    const c = footprintCenter(rack, rack.typeId);
    if (Math.hypot(st.avatar.x - c.x, st.avatar.y - c.y) <= CASK_REACH_PX) {
      st.pendingCask = null;
      void caskArrived(rack.uid);
      return;
    }
    void walkTo({ x: rack.x, y: rack.y + 16 }).then((ok) => {
      if (!ok) toast('There is no way to the keg rack.');
      else st.pendingCask = rack.uid;
    });
  };
  // ---------- The taps (step T1): tap a tap stand on the bar; the register opens the bar's panel ----------
  const pour = new PourFx(view);
  const tapsPanel = createTapsPanel(ui, {
    load: (standUid, slot, drink, qty) => {
      void api.loadTap(standUid, slot, drink as DrinkId, qty).then(async (ok) => {
        sound.play(ok ? 'pop' : 'click');
        if (ok) {
          guide.event('load');
          toast(`${qty} x ${getMaterialType(drink).name} on the tap. Guests can order it now.`);
        }
        else toast('That did not fit on the tap.');
        await refreshTavern();
        await late.refreshInventory();
      });
    },
    unload: (standUid, slot, qty) => {
      void api.unloadTap(standUid, slot, qty).then(async (ok) => {
        sound.play(ok ? 'pop' : 'click');
        if (ok) toast('The mugs are back in your bag.');
        await refreshTavern();
        await late.refreshInventory();
      });
    },
  });
  panels.add('taps', tapsPanel.el);
  const refreshTaps = (): void => {
    tapsPanel.update(tapStands(st.items, st.tavern.roomId).map((i) => i.uid), st.tavern.taps, st.inventory.materials);
    if (panels.open === 'menu') void refreshMenu();
  };
  /** A tap on a tap stand: the Taps panel opens. */
  const standTap = (): void => {
    guide.tip('tap');
    refreshTaps();
    panels.show('taps');
  };
  // ---------- The Menu panel (step 9t C): tap the bar ----------
  let menuRowsNow: MenuRowView[] = [];
  const openOrdersNow = (): Guest[] => st.tavern.guests.filter((g) => g.phase === 'order' && g.order);
  async function refreshMenu(): Promise<void> {
    menuRowsNow = await api.getMenu();
    menuPanel.setSellRows(await api.getSellRows());
    menuPanel.update(openOrdersNow(), menuRowsNow, st.tavern.serveQueue, st.tavern.taps);
  }
  /** The trader (step S2): a tap on Sell 1 / Sell all. Asks first for many pieces, very rare things and hotbar items; nothing else sells itself. */
  const sellTap = async (row: SellRow, qty: number): Promise<void> => {
    if (sellWarning(row, qty) !== null) {
      const ok = await confirmBuy(ui, { name: `${row.name} x${qty}`, detail: sellDetail(row, qty), price: row.unit * qty, image: sellRowIcon(row), title: 'Sell this?', yes: 'Sell' });
      if (!ok) return;
    }
    const res = await api.sell(row.kind, row.id, qty);
    if (!res) {
      toast('That could not be sold.');
      await refreshMenu();
      return;
    }
    sound.play('coin');
    popups.show(res.gains);
    toast(`Sold ${qty} x ${row.name} for ${res.gold} gold.`);
    await late.refreshInventory();
    await refreshMenu();
  };
  const changeMenu = async (id: MaterialId, change: { on?: boolean; price?: number }): Promise<void> => {
    const rows = await api.setMenuEntry(id, change);
    if (!rows) {
      toast('That did not work.');
      return;
    }
    sound.play('click');
    menuRowsNow = rows;
    menuPanel.update(openOrdersNow(), rows, st.tavern.serveQueue, st.tavern.taps);
  };
  const menuPanel = createMenuPanel(ui, {
    serve: (guestId) => void serveTap(guestId).then(() => refreshMenu()),
    toggle: (id, on) => void changeMenu(id, { on }),
    step: (id, dir) => {
      const row = menuRowsNow.find((r) => r.id === id);
      if (row) void changeMenu(id, { price: stepPrice(row.price, row.baseValue, dir) });
    },
    sell: (row, qty) => void sellTap(row, qty),
    openTaps: () => standTap(),
  });
  panels.add('menu', menuPanel.el);
  /** A tap on the bar: the Menu panel opens (Serve tab when orders wait, else Menu). Only in the tavern. */
  const barTap = (): void => {
    if (!inTavern()) return;
    guide.event('menu');
    menuPanel.setTab(openOrdersNow().length > 0 ? 'serve' : 'menu');
    void refreshMenu().then(() => panels.show('menu'));
  };
  // ---------- The one-time intro toast (old saves: TavernState.introSeen was false) ----------
  let introShown = false;
  function maybeIntro(): void {
    if (introShown || st.tavern.introSeen || !inTavern()) return;
    introShown = true;
    toast(TAVERN_INTRO_OLD);
    st.tavern = { ...st.tavern, introSeen: true };
    void api.markTavernIntroSeen();
  }
  /** A tap on a guest or an order bubble: the order is carried (G2: a poured drink waits for a second tap on the guest). to the table (taps queue up, at most SERVE_QUEUE_MAX). */
  async function serveTap(guestId: number): Promise<void> {
    // G2: a poured mug waits in the hands: a tap on its guest (or bubble) carries it over.
    if (st.tavern.holding?.guestId === guestId) {
      if (await api.carryHeld()) sound.play('click');
      return;
    }
    if (st.tavern.serveQueue.length >= SERVE_QUEUE_MAX) {
      toast(`${SERVE_QUEUE_MAX} orders are waiting to be carried already.`);
      return;
    }
    if (!(await api.serveGuest(guestId))) toast('There is no way to the bar.');
    else {
      sound.play('click');
      guide.event('serve');
    }
    await refreshTavern();
  }
  /** A tap on something of the tavern: a guest with an order, coins or a dish on a table, a brewing barrel. True when handled. */
  const tavernTap = (world: Point, hit: FurnitureItem | undefined): boolean => {
    if (!inTavern()) return false;
    const gid = guests.at(world);
    const guest = gid === null ? undefined : st.tavern.guests.find((g) => g.id === gid);
    if (guest?.phase === 'order' && guest.order) {
      void serveTap(guest.id);
      return true;
    }
    const m = tableMess.at(world);
    if (m) {
      if (st.tavern.holding || st.tavern.serveQueue.length > 0) toast('Serve the orders first.');
      else void api.tidyTable(m.messId, m.what).then((ok) => ok || toast('There is no way to that table.'));
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).cooks) {
      stoveTap(hit);
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).brews) {
      barrelTap(hit);
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).casks) {
      caskTap(hit);
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).taps) {
      standTap();
      return true;
    }
    return false;
  };
  st.seatedGuests = 0;
  api.onTavern((e) => {
    const on = inTavern();
    switch (e.t) {
      case 'guests': {
        // The door bell for new arrivals; a soft murmur when three or more sit.
        if (on && e.guests.some((g) => !st.tavern.guests.some((o) => o.id === g.id))) sound.play('arrive');
        const sitting = e.guests.filter((g) => g.seated).length;
        if (on && sitting >= 3 && st.seatedGuests < 3) sound.play('murmur');
        st.seatedGuests = sitting;
        syncMachines();
        st.tavern = { ...st.tavern, guests: e.guests };
        syncTavern();
        void refreshTavern();
        break;
      }
      case 'say':
        if (on) sayBubble(e.guestId, e.text);
        break;
      case 'order':
        if (on) bubbles.addNode(e.guestId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        void late.refreshInventory(); // the unit leaves the bag when the guest orders
        break;
      case 'refuse':
        if (on) bubbles.addNode(e.guestId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        break;
      case 'sip':
        if (on) guests.gesture(e.guestId, 'nod');
        break;
      case 'unhappy':
        if (on) bubbles.addNode(e.guestId, pixelIcon('frown'), REACTION_BUBBLE_MS);
        void refreshTavern();
        void late.refreshInventory(); // the unserved order is back in the bag
        break;
      case 'coins':
        void refreshTavern();
        break;
      case 'walk':
        follow(e.path);
        st.goal = null;
        break;
      case 'holding':
        if (e.item) {
          pourControl.hide();
          pourFor = null;
          pour.stop();
          fx.stopPour();
          if (isDrinkId(e.item)) sound.play('clink'); // the full mug is lifted off the bar
        }
        sprite.setHeld(e.item ? drawGood({ kind: 'material', id: e.item, qty: 1 }) : null);
        void refreshTavern();
        break;
      case 'served':
        sound.play('clink');
        if (on) {
          bubbles.addNode(e.guestId, pixelIcon('smile'), REACTION_BUBBLE_MS);
          fx.sparkle(e.spot, 4);
        }
        sprite.gesture('hand');
        void refreshTavern();
        void late.refreshInventory();
        break;
      case 'pour': {
        // The avatar stands at the taps and pours: the stream, the mug filling, a hiss.
        const stand = st.items.find((i) => i.uid === e.standUid);
        if (on && stand) {
          const bar = st.items.find((i) => i.uid === stand.onItemUid);
          pour.start(stand, bar, e.item, e.ms);
          fx.pourSplash({ x: stand.x, y: stand.y - (bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0) - 9 }, stand.y - (bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0), getDrinkType(e.item as DrinkId).color, e.ms);
          sound.play('pour');
          sprite.gesture('hand');
        }
        break;
      }
      case 'pour_ready':
        if (on) {
          pourFor = { standUid: e.standUid, item: e.item };
          pourControl.show();
        }
        break;
      case 'poured':
        if (on) toast(e.grade === 'perfect' ? 'Perfect pour! Tap the guest to carry it over.' : 'Poured. Tap the guest to carry it over.');
        break;
      case 'tap_empty':
        pourControl.hide();
        pourFor = null;
        pour.stop();
        fx.stopPour();
        if (on) toast(`${TAP_EMPTY_TEXT}: ${getMaterialType(e.item).name} is not on a tap. The order waits.`);
        void refreshTavern();
        break;
      case 'collected': {
        sound.play('coin');
        guide.event('coins');
        // The coins fly into the register on the bar (up to three), then the gold count follows as before.
        const reg = on ? registerPoint(st.items, st.tavern.roomId) : null;
        if (reg) {
          const n = Math.min(3, Math.max(1, Math.ceil(e.coins / 10)));
          for (let k = 0; k < n; k++) window.setTimeout(() => flyCoin(uiRoot, worldToScreen(e.spot, st.shown), worldToScreen(reg, st.shown), 450, () => {
            sound.play('coin');
            fx.sparkle({ x: reg.x, y: reg.y - 8 }, 5);
          }), k * 90);
        }
        popups.show(e.gains);
        void refreshTavern();
        void late.refreshInventory(); // the gold shows in the info panel
        break;
      }
      case 'cleared':
        sound.play('pop');
        void refreshTavern();
        break;
      case 'queue':
        st.tavern = { ...st.tavern, serveQueue: e.queue };
        syncTavern();
        break;
    }
  });

  return { fx, pour, guests, tableMess, orders, syncTavern, tavernTap, barTap, cooking, brewing, stoveArrived, barrelArrived, caskArrived };
}
