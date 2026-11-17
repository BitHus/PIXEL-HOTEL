// The tavern: guests, orders, coins on the tables (R1 split of main.ts: part 10 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  REACTION_BUBBLE_MS, getFurnitureType, type FurnitureItem, type Point, kitchenZone, SERVE_QUEUE_MAX, seatKey,
  tavernSeats, type Guest, STOVE_REACH_PX, BARREL_REACH_PX, CASK_REACH_PX, cookOf, cookReady, cookMs, getFoodType, footprintCenter,
  brewOf, brewReady, getDrinkType, type DrinkId, stepPrice, TAVERN_INTRO_OLD, type MenuRowView, type MaterialId, type SellRow, sellWarning,
  getMaterialType, isDrinkId, prepBonus, tapStands, registerPoint, worldToScreen, pourTip,
  guestsTrayCanServe, ordersStrip as ordersStripData, nothingOrderable,
} from '@pixel-hotel/shared';
import { createPourControl } from './pourControl.ts';
import { el, iconButton } from '../ui/dom.ts';
import { createBrewingPanel } from '../ui/brewingPanel.ts';
import { createMenuPanel } from '../ui/menuPanel.ts';
import { createCaskPanel } from '../ui/caskPanel.ts';
import { createTapsPanel, TAP_EMPTY_TEXT } from '../ui/tapsPanel.ts';
import { PourFx } from '../render/pourFx.ts';
import { TavernFx } from '../render/tavernFx.ts';
import { surfaceHeight } from '../render/furnitureArt.ts';
import { createFirstTenGuide } from '../ui/firstTenGuide.ts';
import { startGuideWorld, type GuideWorldApi } from './guideWorld.ts';
import { brewReady as brewIsReady, firstTenGoal, guideWaiting, machineStates, type FirstTenStep, type Point as P2 } from '@pixel-hotel/shared';
import { flyCoin } from '../ui/coinFly.ts';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { sellDetail, sellRowIcon } from '../ui/sellTab.ts';
import { createCookingPanel, cookTimeText } from '../ui/cookingPanel.ts';
import { GuestViews, type Walker } from '../render/guestViews.ts';
import { TableMess, type Meal } from '../render/tableMess.ts';
import { createOrderBubbles, type OrderMark } from '../ui/orderBubbles.ts';
import { createOrdersStrip } from '../ui/ordersStrip.ts';
import { createPourBar } from '../ui/pourBar.ts';
import { drawTray } from '../render/trayArt.ts';
import { pixelIcon } from '../ui/pixelIcons.ts';
import type { G9 } from './ctx.ts';

export async function setupTavernLife(g: G9) {
  const {
    api, view, ui, uiRoot, roomFloats, updateBadge, toast, sound, popups, sayBubble, bubbles, follow, sprite, st, late, panels, walkTo, prefs, storage,
  } = g;

  // ---------- The tavern (step 9t): guests, orders, coins on the tables ----------
  st.tavern = await api.getTavern();
  // FP-1: the first ten minutes (a skippable guide in a new game) and JU-1 juice; AU-1 sounds are played from the events below.
  // TUT-2: a new game ALWAYS starts the tutorial; Continue resumes the stored step; a finished or skipped one stays done (firstTenOpen).
  const guide = createFirstTenGuide(uiRoot, storage, toast, st.introPending);
  if (st.introPending) guide.begin();
  late.replayGuide = () => guide.replay();
  late.guideEvent = (step) => guide.event(step);
  // TUT-2: ONE guide at a time: the quest card and its glow wait while the tutorial shows a goal; hint chips too (guideWorld).
  const holdQuest = (): void => {
    const held = guide.goal() !== null;
    g.hint.setHeld(held);
    g.questButton.hidden = held; // TUT-2 part 3: the Quest button waits too while the tutorial runs
  };
  window.addEventListener('first-ten-layout', holdQuest);
  holdQuest();
  let guideWorld: GuideWorldApi | null = null;
  const fx = new TavernFx(view, () => prefs.reduceEffects);
  let readyNow = new Set<string>();
  /** Steam from ready machines, a "ding" when one becomes ready, the guide's waiting steps and the ambient bed. */
  let stoveSupplyAsked = false;
  const syncMachines = (): void => {
    // CEL-2: the machines also work (and glow) in the attached kitchen and cellar rooms.
    const on = st.tavern.workRooms.includes(st.room.id) && !fx.paused;
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
    // OA-5: cold / cooking / ready look of the stoves and barrels; a cold stove gives no light.
    const states = machineStates(st.tavern, now);
    g.itemViews.setMachineStates(states);
    g.atmosphere.setUnlit(new Set(st.items.filter((i) => getFurnitureType(i.typeId).cooks && states.get(i.uid) !== 'cooking').map((i) => i.uid)));
    const brewReady = [...ready].some((k) => k[0] === 'b');
    const waiting: FirstTenStep[] = guideWorld ? guideWaiting(guide.state, guideWorld.context(brewReady)) : [];
    // The tutorial card shows in every room (farm, mine, lakeside steps) except inside a dungeon run.
    guide.refresh(waiting, !g.dungeon.isActive);
    // The stove step needs something to cook: the first brew used the starter crops, so top up once when it becomes the goal.
    if (!stoveSupplyAsked && firstTenGoal(guide.state, waiting) === 'stove') {
      stoveSupplyAsked = true;
      void api.ensureTutorialCookSupplies();
    }
    sound.setAmbience(on ? 'tavern' : null, Math.min(1, st.seatedGuests / 6));
  };
  // G2: the hands-on pour. The avatar waits at the taps; the player presses and HOLDS THE TAP STAND itself (pointerInput asks pourControl.claims first).
  const pour = new PourFx(view, () => prefs.reduceEffects);
  /** The guest and drink the avatar waits to pour for (null = nothing to pour). */
  let pourFor: { standUid: number; item: MaterialId; guestId: number } | null = null;
  const standInfo = (uid: number): { stand: FurnitureItem; bar: FurnitureItem | undefined; floorY: number } | null => {
    const stand = st.items.find((i) => i.uid === uid);
    if (!stand) return null;
    const bar = st.items.find((i) => i.uid === stand.onItemUid);
    return { stand, bar, floorY: stand.y - (bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0) };
  };
  // The hint over the stand ("Hold the tap") until the first pour worked; a plain label that never takes the pointer.
  const HINT_KEY = 'ph_pour_hint_done';
  const hintDone = (): boolean => {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; }
  };
  const hint = document.createElement('div');
  hint.className = 'pour-hint';
  hint.textContent = 'Hold the tap';
  hint.style.cssText = 'position:absolute;z-index:30;display:none;transform:translate(-50%,-100%);pointer-events:none;user-select:none;padding:4px 10px;font-family:var(--font);font-size:14px;font-weight:700;background:#3e2731;color:#fee761;border:2px solid #f6ca9f;white-space:nowrap';
  uiRoot.appendChild(hint);
  // COD-1 (e): the pour bar over the mug (fills while the stand is held, green = the perfect window).
  const pourBar = createPourBar(uiRoot);
  let hintRaf = 0;
  const hintLoop = (): void => {
    // The bar sits right over the mug (mug top = floorY - 17, PourFx MUG_FRAME): 4 world px above it, not at the avatar head.
    const info = pourFor ? standInfo(pourFor.standUid) : null;
    if (info && pourBar.visible) pourBar.place(worldToScreen({ x: info.stand.x, y: info.floorY - 21 }, st.shown));
    if (!info || pourControl.pressing || hintDone()) {
      hint.style.display = 'none';
    } else {
      const p = worldToScreen({ x: info.stand.x, y: info.floorY - 64 }, st.shown);
      hint.style.display = 'block';
      hint.style.left = `${Math.round(p.x)}px`;
      hint.style.top = `${Math.round(p.y)}px`;
    }
    hintRaf = pourFor ? requestAnimationFrame(hintLoop) : 0;
  };
  const endWait = (stopFx: boolean): void => {
    pourControl.cancel();
    pourFor = null;
    pourBar.hide();
    hint.style.display = 'none';
    cancelAnimationFrame(hintRaf);
    hintRaf = 0;
    fx.stopPour();
    if (stopFx || pour.phase !== 'done') pour.stop();
  };
  const pourControl = createPourControl({
    stands: () => (pourFor ? tapStands(st.items, st.tavern.roomId).flatMap((s) => {
      const i = standInfo(s.uid);
      return i ? [{ standUid: s.uid, screen: worldToScreen({ x: s.x, y: i.floorY - 14 }, st.shown), zoom: st.shown.zoom }] : [];
    }) : []),
    taps: () => st.tavern.taps,
    drinkName: (id) => getMaterialType(id as MaterialId).name,
    blocked: () => panels.open !== null || !inTavern() || g.build?.on === true,
    onStart: (standUid) => {
      const i = standInfo(standUid);
      if (!i || !pourFor) return;
      pour.begin(i.stand, i.bar, pourFor.item);
      sprite.gesture('hand');
    },
    onFill: (f) => {
      const i = pourFor ? standInfo(pourFor.standUid) : null;
      if (!i || !pourFor) return;
      pour.setFill(f);
      pourBar.setFill(f);
      fx.pourSplash({ x: i.stand.x, y: i.floorY - 10 }, i.floorY, getDrinkType(pourFor.item as DrinkId).color, 160);
    },
    glug: (pitch) => sound.play('pourTick', 'common', pitch),
    toast,
    onEnd: (ms, pick) => {
      pour.release();
      fx.stopPour();
      pourControl.done();
      void api.pourHeld(ms, pick).then((ok) => {
        if (!ok) {
          endWait(true);
          toast('Nothing to pour.');
        } else guide.event('pour');
      });
    },
  });
  const guests = new GuestViews(view);
  const tableMess = new TableMess(view);
  /** A guest as a walker: they only sit once they have reached their seat, and look at the table. */
  const walkers = (list: readonly Guest[]): Walker[] =>
    list.map((g) => ({ id: g.id, look: g.look, x: g.x, y: g.y, facing: g.facing, path: g.path, speed: g.speed, seat: g.seated && g.seat ? { uid: g.seat.uid } : null, sitFacing: g.facing, eating: g.phase === 'eat' }));
  const inTavern = (): boolean => st.room.id === st.tavern.roomId;
  /** CEL-2: the tavern or its attached kitchen or cellar (machines, ready dots, the guide's door routing). */
  const inWork = (): boolean => st.tavern.workRooms.includes(st.room.id);
  // OA-14: the OPEN / CLOSED sign under the info panel (tavern only). Closed = no new guests (the ones inside finish).
  const signWord = el('span', 'open-sign-word', 'OPEN');
  const sign = iconButton('house', 'Tavern is open: tap to close', () => {
    void api.setTavernOpen(!st.tavern.open).then((open) => {
      st.tavern = { ...st.tavern, open };
      drawSign();
      toast(open ? 'Tavern open: guests will come.' : 'Tavern closed: no new guests.');
    });
  }, 'open-sign room-only');
  sign.append(signWord);
  sign.hidden = true;
  g.info.column.appendChild(sign);
  const drawSign = (): void => {
    sign.hidden = !inTavern();
    sign.classList.toggle('closed', !st.tavern.open);
    signWord.textContent = st.tavern.open ? 'OPEN' : 'CLOSED';
    sign.title = st.tavern.open ? 'Tavern is open: tap to close' : 'Tavern is closed: tap to open';
    sign.setAttribute('aria-label', sign.title);
  };
  // Nothing orderable (every drink or dish off or out of stock) while open: point at the sign once per session.
  let signHinted = false;
  window.setInterval(() => {
    if (signHinted || !inTavern() || !st.tavern.open || st.tavern.guests.length > 0) return;
    void api.getMenu().then((rows) => {
      if (signHinted || !inTavern() || !st.tavern.open || !nothingOrderable(rows)) return;
      signHinted = true;
      toast('Nothing to serve. Load the taps or cook something, or tap the sign to close the tavern.');
    });
  }, 5000);
  guideWorld = startGuideWorld(g, { guide, pouring: () => pourFor !== null, inTavern, inWork, ready: () => readyNow });
  const orders = createOrderBubbles(ui, (id) => void serveTap(id));
  // COD-1 (d): the orders strip at the top: one chip per open order (data from the pure shared/src/tray.ts ordersStrip).
  const strip = createOrdersStrip(uiRoot, {
    onChip: (id) => void serveTap(id),
    onPutBack: () => void api.returnTray().then(async (ok) => {
      if (ok) {
        sound.play('pop');
        toast('The tray is back in the bag.');
        await refreshTavern();
        await late.refreshInventory();
      }
    }),
  });
  /** The open orders for the order bubbles: queued ones are dimmed, a guest whose mug is ready on the tray pulses, little patience is urgent. */
  const orderMarks = (): OrderMark[] => {
    const chips = new Map(ordersStripData(st.tavern).map((c) => [c.guestId, c]));
    return st.tavern.guests.flatMap((g) => {
      const c = chips.get(g.id);
      return g.phase === 'order' && g.order ? [{ guestId: g.id, item: g.order.item, urgent: g.warned, taken: c?.state === 'queued', ready: c?.state === 'ready' }] : [];
    });
  };
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
    drawSign();
    if (!on && pourFor) endWait(true);
    guests.sync(on ? walkers(st.tavern.guests) : [], st.room.id, st.items);
    tableMess.sync(on ? st.tavern.mess : [], on ? meals() : [], st.items);
    orders.sync(on ? orderMarks() : []);
    // COD-1 (c, d): the strip, and the guests who wait for a mug that is on the tray pulse.
    if (on) strip.sync(ordersStripData(st.tavern), st.tavern.tray.map((m) => m.item));
    else strip.hide();
    guests.setPulse(on ? new Set(guestsTrayCanServe(st.tavern)) : new Set());
    updateBadge();
    syncMachines();
    const standList = tapStands(st.items, st.tavern.roomId).flatMap((s) => { const i = standInfo(s.uid); return i ? [{ stand: i.stand, bar: i.bar }] : []; });
    pour.syncRest(standList);
    pour.syncTapStates(standList, st.tavern.taps); // OA-5b: dry / wet per tap slot
  };
  st.onItemsSynced = syncTavern;
  /** What the avatar's hands show now (the tray), so a save that loads with mugs on the tray shows them too. */
  let heldKey = '';
  const showTray = (): void => {
    const key = st.tavern.tray.map((m) => m.item).join(',');
    if (key === heldKey) return;
    heldKey = key;
    sprite.setHeld(drawTray(st.tavern.tray.map((m) => m.item)));
  };
  async function refreshTavern(): Promise<void> {
    st.tavern = await api.getTavern();
    showTray();
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
        if (ok) guide.event('cellar'); // CEL-3: the cellar step ticks on filling a cask, never on waiting
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
  const refreshCasks = (): void => casks.update(st.tavern.casks, st.inventory.materials, st.tavern.caskCaps);
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
    // COD-1: a mug for this guest is on the tray: the avatar carries exactly that ONE mug over.
    if (guestsTrayCanServe(st.tavern).includes(guestId)) {
      if (await api.carryHeld(guestId)) sound.play('click');
      else toast('There is no way to that table.');
      return;
    }
    if (st.tavern.serveQueue.length >= SERVE_QUEUE_MAX) {
      toast(`${SERVE_QUEUE_MAX} orders are waiting to be carried already.`);
      return;
    }
    if (!(await api.serveGuest(guestId))) toast('There is no way to the bar.');
    else {
      sound.play('click'); // the 'serve' step ticks on the 'served' event, not on the request
    }
    await refreshTavern();
  }
  /** A tap on something of the tavern: a guest with an order, coins or a dish on a table, a brewing barrel. True when handled. */
  const tavernTap = (world: Point, hit: FurnitureItem | undefined): boolean => {
    if (!inWork()) return false;
    // Mugs wait on the tray: a tap on a guest who wants one, their seat or their table carries ONE mug over.
    if (inTavern() && st.tavern.tray.length > 0 && !pourControl.pressing) {
      const seats = tavernSeats(st.items, st.tavern.roomId, kitchenZone(st.room));
      const gAt = guests.at(world);
      const target = guestsTrayCanServe(st.tavern).find((id) => {
        if (id === gAt) return true;
        const hg = st.tavern.guests.find((x) => x.id === id);
        const seat = hg?.seat ? seats.find((k) => seatKey(k) === seatKey(hg.seat!)) : undefined;
        return !!seat && (hit?.uid === seat.uid || hit?.uid === seat.tableUid || Math.hypot(world.x - seat.spot.x, world.y - seat.spot.y) <= 36);
      });
      if (target !== undefined) {
        void serveTap(target);
        return true;
      }
    }
    // A machine under the pointer wins over a guest whose body box overlaps it.
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
    // The rest (taps, guests, tables) is the tavern's own.
    if (!inTavern()) return false;
    if (hit && getFurnitureType(hit.typeId).taps) {
      standTap();
      return true;
    }
    const gid = guests.at(world);
    const guest = gid === null ? undefined : st.tavern.guests.find((g) => g.id === gid);
    if (guest?.phase === 'order' && guest.order) {
      void serveTap(guest.id);
      return true;
    }
    const m = tableMess.at(world);
    if (m) {
      if (st.tavern.serveQueue.length > 0) toast('Serve the orders first.');
      else void api.tidyTable(m.messId, m.what).then((ok) => ok || toast('There is no way to that table.'));
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
      case 'tray': {
        // COD-1: the tray changed. A mug added = the full mug is lifted off the bar; the avatar holds the tray (code-art placeholder).
        const more = e.mugs.length > st.tavern.tray.length;
        if (more && isDrinkId(e.mugs[e.mugs.length - 1]!.item)) sound.play('clink');
        if (more && pourFor) {
          pourFor = null;
          pourBar.hide();
          pourControl.done();
        }
        st.tavern = { ...st.tavern, tray: e.mugs };
        showTray();
        syncTavern();
        void refreshTavern();
        break;
      }
      case 'pour_cancel':
        // The wait at the taps was dropped (the guest left, the player walked away or went to serve): nothing is taken.
        if (pourFor) {
          endWait(true);
          if (on) toast('The pour was cancelled. The order stays open.');
        }
        break;
      case 'served':
        sound.play('clink');
        guide.event('serve');
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
      case 'pour_ready': {
        if (!on) break;
        pourFor = { standUid: e.standUid, item: e.item, guestId: e.guestId };
        pourControl.wait(e.standUid, e.item);
        pourBar.show();
        const i = standInfo(e.standUid);
        if (i) {
          pour.wait(i.stand, i.bar, e.item);
          // The stand must be on screen to be pressed: when it is not (the camera is elsewhere), the camera glides there.
          const sp = worldToScreen({ x: i.stand.x, y: i.floorY - 14 }, st.shown);
          const w = g.app.screen.width;
          const hh = g.app.screen.height;
          if (sp.x < 70 || sp.x > w - 90 || sp.y < 110 || sp.y > hh - 110) {
            const z = st.camera.zoom;
            g.setCamera({ x: i.stand.x - w / (2 * z), y: i.floorY - 14 - hh / (2 * z), zoom: z }, true);
          }
        }
        if (!hintRaf) hintRaf = requestAnimationFrame(hintLoop);
        break;
      }
      case 'poured': {
        const perfect = e.grade === 'perfect';
        pour.finish(perfect);
        try { localStorage.setItem(HINT_KEY, '1'); } catch { /* no storage: the hint just shows again */ }
        if (on) {
          const guest = st.tavern.guests.find((x) => x.id === pourFor?.guestId);
          const tip = perfect && guest?.order ? pourTip(true, guest.order.price) : 0;
          const i = pourFor ? standInfo(pourFor.standUid) : null;
          if (perfect && i) {
            const at = { x: i.stand.x, y: i.floorY - 34 };
            roomFloats.add(at, tip > 0 ? `Perfect! +${tip}` : 'Perfect!', 'xp');
            fx.sparkle({ x: i.stand.x, y: i.floorY - 12 }, 8, 0xfee761);
            fx.sparkle({ x: i.stand.x, y: i.floorY - 14 }, 4, 0xffffff);
            sound.play('coin');
          }
          toast(perfect ? 'Perfect pour! Tap a guest who wants it.' : 'Poured. Tap a guest who wants it.');
        }
        break;
      }
      case 'tap_empty':
        endWait(true);
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

  // A test hook for the headless end-to-end check (only with ?e2e in the address).
  if (new URLSearchParams(location.search).has('e2e')) (window as unknown as { __ph: unknown }).__ph = { api, st, late, guestViews: guests, setCamera: g.setCamera, pourControl, pour, worldToScreen, tapStands, serveTap, standPoint: (uid: number) => { const i = standInfo(uid); return i ? worldToScreen({ x: i.stand.x, y: i.floorY - 14 }, st.shown) : null; } };
  return { fx, pour, pourControl, guests, tableMess, orders, syncTavern, tavernTap, barTap, cooking, brewing, stoveArrived, barrelArrived, caskArrived };
}
