import { Application, TextureSource } from 'pixi.js';
import {
  AVATAR_H,
  WALK_BOB_MS,
  INTRO_DEVICE_PX_PER_ART_PX,
  REACTION_BUBBLE_MS,
  INTRO_COINS,
  doorY,
  INTRO_COIN_EVERY_MS,
  INTRO_COIN_FLY_MS,
  INTRO_FIRST_POP_MS,
  INTRO_STEP_MS,
  tillPoint,
  PALETTE,
  buildNavGrid,
  cameraAt,
  centerCamera,
  clampCamera,
  containCamera,
  countInInventory,
  fitZoom,
  fitsRoomKind,
  isMaterialId,
  getFurnitureType,
  catalogPrice,
  getStyle,
  stylePrice,
  upgradeCost,
  introZoom,
  roomBlockers,
  roomBoundsRect,
  farmCounts,
  getMaterialType,
  CROP_TYPES,
  MINE_UNLOCK_LEVEL,
  MINE_LANTERN_MS,
  isSeedId,
  type FoodId,
  type SeedId,
  screenToWorld,
  hasSeats,
  standUpSpot,
  snapCamera,
  walkAvatar,
  worldToScreen,
  type Avatar,
  type Camera,
  type FurnitureItem,
  type Inventory,
  type ItemsResult,
  type Point,
  type Rect,
  type Room,
  type RoomKind,
  type ShopEvent,
  type ShopView,
  type StyleKind,
  DUNGEON_KEY_COST,
  LEVEL_TOTAL_XP,
  HINTS,
  DUNGEON_HINT,
  MINE_HINT,
  xpForNextLevel,
} from '@pixel-hotel/shared';
import './ui/ui.css';
import { LocalGameAPI } from './api/localGameAPI.ts';
import { browserStorage } from './api/saveStorage.ts';
import { RoomView } from './render/roomView.ts';
import { createCursorCross } from './render/cursorCross.ts';
import { attachCameraControl } from './input/cameraControl.ts';
import { CameraIntro } from './input/cameraIntro.ts';
import { createDebugLabel } from './ui/debugLabel.ts';
import { AvatarSprite } from './render/avatarSprite.ts';
import { BlockersDebug } from './debug/blockers.ts';
import { createBlockersButton } from './ui/blockersButton.ts';
import { ItemViews } from './render/itemViews.ts';
import { avatarDepthKey } from './render/depthOrder.ts';
import { Seating } from './render/seating.ts';
import { Placer } from './build/placer.ts';
import { createPlaceBar } from './ui/placeBar.ts';
import { createItemMenu } from './ui/itemMenu.ts';
import { createPanels } from './ui/panels.ts';
import { createSideButtons } from './ui/sideButtons.ts';
import { createBuildMode } from './ui/buildMode.ts';
import { createInfoPanel } from './ui/infoPanel.ts';
import { createHotbar } from './ui/hotbar.ts';
import { createBagPanel } from './ui/bagPanel.ts';
import { createAvatarPanel } from './ui/avatarPanel.ts';
import { createChatPanel } from './ui/chatPanel.ts';
import { createChatBubbles } from './ui/chatBubbles.ts';
import { createSettingsPanel } from './ui/settingsPanel.ts';
import { createToast } from './ui/toast.ts';
import { iconButton, typing } from './ui/dom.ts';
import { confirmBuy } from './ui/confirmBuy.ts';
import { furnitureIconUrl, materialIconUrl } from './ui/itemIcon.ts';
import { stylePreviewUrl } from './render/styleArt.ts';
import { CustomerViews } from './render/customerViews.ts';
import { createShelfPanel } from './ui/shelfPanel.ts';
import { WHERE, createCatalogPanel, growText } from './ui/catalogPanel.ts';
import { SEED_PACK } from '@pixel-hotel/shared';
import { watchLayout } from './ui/layoutVars.ts';
import { createRoomPanel } from './ui/roomPanel.ts';
import { flyCoin } from './ui/coinFly.ts';
import { runNewGameSetup } from './ui/newGame.ts';
import { createHintBox, createSaleFloats, createTillCoins, showAwaySummary } from './ui/shopFeedback.ts';
import { pixelIcon } from './ui/pixelIcons.ts';
import { createRunBar } from './ui/runBar.ts';
import { createWorkshopPanel, gearEffect, pieceEffect, recipeName } from './ui/workshopPanel.ts';
import { DungeonScreen } from './dungeon/dungeonScreen.ts';
import { FarmScreen } from './farm/farmScreen.ts';
import { createCookingPanel } from './ui/cookingPanel.ts';
import { createTravelPanel, type PlaceCard, type Place } from './ui/travelPanel.ts';
import { createLunchPicker } from './ui/lunchPicker.ts';
import { ROOM_NAMES } from './ui/infoPanel.ts';
import { RoomAtmosphere } from './render/roomAtmosphere.ts';
import { Backdrop } from './render/backdrop.ts';
import { Sound } from './audio/sound.ts';
import { loadPrefs, savePrefs } from './api/prefs.ts';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  const host = document.getElementById('game');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('#game or #ui element missing');
  const uiRoot: HTMLElement = ui;

  // Step 5: the game runs on LocalGameAPI (shared rules in the browser, saved in localStorage).
  const storage = browserStorage();
  const { api, notice } = LocalGameAPI.open(storage);
  // Atmosphere step: the device settings, and sound (it wakes on the first tap; every UI button clicks).
  const prefs = loadPrefs(storage);
  const sound = new Sound(prefs.sound, prefs.volume);
  sound.listenForFirstTap();
  uiRoot.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) sound.play('click');
  });
  // Step 7b: a brand new game first makes the character and picks the room shapes, then plays
  // the intro in the shop. A save that already has a player skips all of this.
  let introPending = false;
  if (await api.needsNewPlayer()) {
    for (;;) {
      const choice = await runNewGameSetup(ui);
      if (await api.createPlayer(choice)) break;
    }
    introPending = true;
  }
  // Step 7: the shop's customers walk while the game is open.
  api.startClock();

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: PALETTE[25],
    antialias: false,
    roundPixels: true,
    // Render at the full device pixel ratio (CSS size stays the window; app.screen is CSS px).
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  /** Real screen px per CSS px. Zoom settles where zoom * dpr is whole. */
  const dpr = (): number => app.renderer.resolution;
  host.appendChild(app.canvas);

  // Open the room the player was in last (saved); the intro starts in the shop.
  const first = await api.enterRoom(introPending ? (await api.getPlayer()).shopRoomId : await api.currentRoomId());
  let room: Room = first.room;
  let bounds: Rect = roomBoundsRect(room);
  const view = new RoomView();
  // Atmosphere step: the dark planks outside the room, then the room with its shadows and light.
  const backdrop = new Backdrop(app.renderer);
  app.stage.addChild(backdrop.container, view.world);
  const atmosphere = new RoomAtmosphere(view, app.renderer);
  atmosphere.setLighting(prefs.lighting);
  // Lighting off (slow phones): no backdrop either, so nothing extra is drawn.
  let lightingOn = prefs.lighting;
  backdrop.container.visible = lightingOn;

  // ---------- The own avatar (paths come from the GameAPI; the client animates them) ----------
  const me = first.avatars[0];
  if (!me) throw new Error('no avatar');
  let avatar: Avatar = me;
  /** Points the avatar still has to walk to, and where it was sent (to re-path when the room changes). */
  let path: Point[] = [];
  let goal: Point | null = null;
  const sprite = new AvatarSprite(avatar.look, false);
  /** The seat the avatar walks to, slides onto, and sits or lies on. */
  const seating = new Seating(sprite);
  view.objects.add(sprite.container, avatarDepthKey(avatar));

  /** Starts walking along a path from the API (it starts where the API thinks the avatar is). */
  const follow = (p: Point[]): void => {
    const first = p[0];
    // Only jump when the API's start point is clearly elsewhere (tiny timing differences are walked off).
    if (first && Math.hypot(first.x - avatar.x, first.y - avatar.y) > 8) avatar = { ...avatar, x: first.x, y: first.y };
    path = p.slice(1);
    seating.clear();
    serving = null;
    // A first step kicks up a little dust.
    if (path.length > 0 && avatar.state !== 'walk') atmosphere.puff(avatar);
    avatar = { ...avatar, state: path.length > 0 ? 'walk' : 'idle' };
  };
  /** Walks to a world point (the nearest free spot if it is blocked). False if unreachable. */
  const walkTo = async (to: Point): Promise<boolean> => {
    const p = await api.walk(to);
    if (!p) return false;
    follow(p);
    goal = to;
    return true;
  };
  /** Walks to the nearest reachable side of an item's free seat (nearest the tap) and sits or lies on arrival. */
  const sitOn = async (uid: number, tap: Point | null): Promise<boolean> => {
    const r = await api.sit(uid, tap ?? undefined);
    if (!r) return false;
    follow(r.path);
    goal = null;
    seating.goal = { uid, seat: r.seat, tap };
    return true;
  };
  /** Walking behind the counter ('walking') or standing there taking payments ('there'), with the facing. */
  let serving: { state: 'walking' | 'there'; facing: Avatar['facing'] } | null = null;
  /** Walks behind the shop's counter (like sitting: tap it in play mode). False if there is no way. */
  const serveAt = async (uid: number): Promise<boolean> => {
    const r = await api.serve(uid);
    if (!r) return false;
    follow(r.path);
    goal = null;
    serving = { state: 'walking', facing: r.facing };
    return true;
  };
  const stop = (): void => {
    path = [];
    seating.goal = null;
    if (avatar.state === 'walk') avatar = { ...avatar, state: 'idle' };
  };

  // ---------- Furniture ----------
  /** The current room's items plus the inventory furniture (the GameAPI's view). */
  let items: FurnitureItem[] = await api.getItems();
  let inventory: Inventory = await api.getInventory();
  const itemViews = new ItemViews(view, room.id);
  /** The shop (goods on the slots, prices, sale history, customers). */
  let shop: ShopView = await api.getShop();
  const customers = new CustomerViews(view);
  const roomItem = (uid: number | null): FurnitureItem | undefined =>
    uid === null ? undefined : items.find((i) => i.uid === uid && i.roomId === room.id);

  const blockers = new BlockersDebug(room, () => {
    api.debugSetBlockers(blockers.rects);
    roomChanged();
  });
  /** Furniture or debug blockers changed: redraw the debug overlay and re-path a walking avatar. */
  const roomChanged = (): void => {
    blockers.showGrid(buildNavGrid(room, [...blockers.rects, ...roomBlockers(room, items)]));
    // The seat was moved or picked up: stand up next to it on a free spot (as the GameAPI does).
    const seated = seating.seated;
    if (seated !== null && !seating.stillThere(roomItem(seated.uid))) {
      const grid = buildNavGrid(room, [...blockers.rects, ...roomBlockers(room, items)]);
      avatar = seating.standUp(avatar, standUpSpot(grid, seated.seat));
    }
    if (seating.goal !== null) {
      const { uid, tap } = seating.goal;
      void sitOn(uid, tap).then((ok) => ok || stop());
    } else if (path.length > 0 && goal) {
      void walkTo(goal).then((ok) => ok || stop());
    }
  };
  view.debugLayer.addChild(blockers.container);

  const cross = createCursorCross();
  // Only furniture takes part in hit testing: the cross and avatars never hide an item from a tap.
  cross.eventMode = 'none';
  sprite.container.eventMode = 'none';
  app.stage.addChild(cross);

  // ---------- HTML UI (layout rule in CLAUDE.md) ----------
  const toast = createToast(ui);
  const bubbles = createChatBubbles(ui);
  const label = createDebugLabel(ui);
  const blockerButtons = createBlockersButton(ui, { onToggle: (on) => blockers.setOn(on), onClear: () => blockers.clear() });
  const panels = createPanels();
  /** The player's gold as last read (for the "Buy this?" panels). */
  let walletGold = 0;
  const info = createInfoPanel(ui);
  const hint = createHintBox(ui, info.column);
  const floats = createSaleFloats(ui);
  const tillCoins = createTillCoins(ui);
  // Play mode (default: taps walk and sit) or build mode (taps open item menus, never walk).
  const build = createBuildMode(ui, {
    onChange: (on) => {
      if (on) return;
      menu.close();
      placer.cancel();
    },
    escapeTaken: () => panels.open !== null || placer.active || dungeon.isActive,
  });
  build.button.classList.add('room-only');
  // The Dungeon button (step 9): shows the key cost, or "free" under 10 gold.
  const dungeonButton = iconButton('dungeon', 'Dungeon', () => void enterDungeonAsked(), 'room-only dungeon-btn');
  const dungeonBadge = document.createElement('span');
  dungeonBadge.className = 'btn-badge';
  dungeonButton.appendChild(dungeonBadge);
  const sideButtons = createSideButtons(ui, panels, [build.button, dungeonButton]);
  // The quest button, at the top of the column: shows the current quest again. Hidden without a
  // quest; selected while the quest shows; glowing while a quest is going but its box is closed.
  const questButton = iconButton('quest', 'Quest', () => hint.toggle(), 'quest-btn room-only');
  sideButtons.prepend(questButton);
  // The Map button (step 9b), under the quest button: the travel panel with every place.
  const mapButton = iconButton('map', 'Map: travel', () => panels.toggle('travel'), 'room-only');
  questButton.after(mapButton);
  panels.onChange(() => mapButton.classList.toggle('on', panels.open === 'travel'));
  panels.onChange(() => hint.setCovered(panels.open !== null));
  hint.onChange((quest, showing) => {
    questButton.hidden = quest === null;
    questButton.classList.toggle('on', showing);
    questButton.classList.toggle('glow', quest !== null && !showing);
    // The dungeon hint points at the Dungeon button.
    dungeonButton.classList.toggle('glow', quest === HINTS[DUNGEON_HINT]);
    // The mine hint (step 9c) points at the Map button.
    mapButton.classList.toggle('glow', quest === HINTS[MINE_HINT]);
  });

  // The dungeon screen (step 9); created early, before any shop event can ask for the HUD.
  const runBar = createRunBar(
    ui,
    () => dungeon.potion(),
    () => dungeon.eat(),
    () => dungeon.leave(),
  );
  const dungeon: DungeonScreen = new DungeonScreen(
    {
      app,
      ui: uiRoot,
      api,
      info,
      runBar,
      toast,
      sound: (name) => sound.play(name),
      dpr,
      backTo: () => ROOM_NAMES[room.kind].toLowerCase(),
      onDone: async () => {
        setDungeonMode(false);
        items = await api.getItems();
        await openRoom(room.id);
      },
    },
    avatar.look,
  );

  /** Camera state (unsnapped, so zooming never drifts). */
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole device px. */
  let shown: Camera = camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  let marked: Point | null = null;
  const intro = new CameraIntro();

  const redraw = (): void => {
    shown = snapCamera(camera, dpr());
    backdrop.update(shown, app.screen.width, app.screen.height);
    view.world.scale.set(shown.zoom);
    view.world.position.set(-shown.x * shown.zoom, -shown.y * shown.zoom);
    let text = `zoom ${shown.zoom.toFixed(2)}x  dpr ${dpr()}`;
    if (marked) {
      const s = worldToScreen(marked, shown);
      cross.position.set(Math.floor(s.x), Math.floor(s.y));
      text = `x ${Math.floor(marked.x)}  y ${Math.floor(marked.y)}\n${text}`;
    }
    label.set(text);
  };

  const setCamera = (cam: Camera, snap = false): void => {
    camera = clampCamera(cam, app.screen.width, app.screen.height, bounds);
    if (snap) camera = snapCamera(camera, dpr());
    redraw();
  };

  // Default view: the largest zoom where the whole room fits (ZOOM_MIN to ZOOM_MAX, any value), centered.
  const overviewZoom = (): number => fitZoom(app.screen.width, app.screen.height, bounds);
  const fit = (): void => {
    intro.cancel();
    const w = app.screen.width;
    const h = app.screen.height;
    setCamera(centerCamera(w, h, bounds, overviewZoom()));
  };
  /** The room intro: overview first, then a zoom in on the avatar (section 4). */
  const startIntro = (): void => {
    fit();
    const w = app.screen.width;
    const h = app.screen.height;
    const zoom = introZoom(overviewZoom(), dpr(), INTRO_DEVICE_PX_PER_ART_PX);
    if (zoom <= camera.zoom + 1e-6) return;
    const to = snapCamera(containCamera(cameraAt(avatar, zoom, w, h), w, h, bounds), dpr());
    intro.start(camera, to);
  };

  // ---------- Placing and the item menu ----------
  /** The intro's state: while it runs, the gold and the hint wait, and some items are hidden. */
  const newIntro = { running: false, hidden: new Set<number>() };
  /** Items not drawn now: a moved item (and its riders) while placing, and the intro's items. */
  const hiddenUids = (): Set<number> => new Set([...placer.hiddenUids(), ...newIntro.hidden]);
  /** Draws the items, and their shadows and lights. */
  const syncItems = (): void => {
    const hidden = hiddenUids();
    itemViews.sync(items, hidden);
    atmosphere.setItems(items, hidden);
  };
  /** What is on screen now (for the intro's coins). */
  const shown0 = (): Camera => shown;
  /** Applies items from the GameAPI (null = refused). */
  const applyItems = (next: ItemsResult): boolean => {
    if (!next) return false;
    items = next;
    syncItems();
    roomChanged();
    void refreshInventory().then(refreshShop).then(refreshHint);
    return true;
  };
  const placer: Placer = new Placer(
    {
      getRoom: () => room,
      getItems: () => items,
      commit: async (s, snap) => {
        if (s.uid === null) return false;
        const at = { center: s.center, facing: s.facing, snap };
        const ok = applyItems(s.origin ? await api.moveItem(s.uid, at) : await api.placeItem(s.uid, at));
        if (ok) sound.play('pop');
        return ok;
      },
      onChange: () => {
        syncItems();
        hotbar.setHidden(placer.active);
      },
    },
    view.ghostLayer,
  );
  const viewCenter = (): Point => screenToWorld({ x: app.screen.width / 2, y: app.screen.height / 2 }, shown);
  const placeBar = createPlaceBar(ui, {
    onPlace: () => void placer.place(),
    onRotate: () => placer.rotate(),
    onCancel: () => placer.cancel(),
  });
  const menu = createItemMenu(ui, {
    onMove: (uid) => {
      menu.close();
      placer.startMove(uid);
    },
    onRotate: (uid) => {
      void api.rotateItem(uid).then((next) => applyItems(next) || itemViews.shake(uid));
    },
    onPickUp: (uid) => {
      menu.close();
      void api.pickUpItem(uid).then(applyItems);
    },
  });
  const openMenu = (item: FurnitureItem): void => menu.open(item.uid, getFurnitureType(item.typeId));

  // ---------- Shop, catalog and room panels (step 7) ----------
  const shelfPanel = createShelfPanel(ui, {
    put: (slot, pick, price) => void api.putOnShelf(slot, pick, price).then((r) => (r ? afterShopChange() : toast('That cannot go there.'))),
    take: (slot) => void api.takeFromShelf(slot).then(afterShopChange),
    setPrice: (slot, price) => void api.setPrice(slot, price).then((r) => (r ? afterShopChange() : toast('Prices are whole gold, 1 or more.'))),
  });
  panels.add('shelf', shelfPanel.el, undefined, () => shelfPanel.clear());
  const afterShopChange = async (): Promise<void> => {
    await refreshInventory();
    await refreshShop();
    await refreshHint();
  };
  const catalog = createCatalogPanel(ui, {
    buyItem: async (typeId) => {
      const t = getFurnitureType(typeId);
      const sure = await confirmBuy(ui, { name: t.name, detail: `Goes into your bag. For ${WHERE[t.placeIn]}.`, price: catalogPrice(typeId), image: furnitureIconUrl(typeId), gold: walletGold });
      if (!sure) return;
      void api.buyCatalog(typeId).then(async (r) => {
        if (!r) {
          toast('Not enough gold.');
          return;
        }
        items = await api.getItems();
        await refreshInventory();
        await refreshHint();
        const type = getFurnitureType(typeId);
        // The first purchase of a new game goes straight into placing, with a pop.
        if (r.first && fitsRoomKind(type, room)) {
          panels.close();
          if (startPlacing(typeId)) placer.pop();
          return;
        }
        toast(`${type.name} is in your bag.`);
      });
    },
    buySeeds: async (seed) => {
      const m = getMaterialType(seed);
      const crop = CROP_TYPES.find((c) => c.seed === seed);
      const price = crop?.seedPrice ?? 0;
      const detail = crop ? `Plant on your farm: ripe in ${growText(crop)}, the crop is worth ${crop.baseValue}.` : 'Plant on your farm.';
      const sure = await confirmBuy(ui, {
        name: m.name,
        detail,
        price,
        image: materialIconUrl(seed),
        gold: walletGold,
        title: 'Buy this?',
        yes: 'Buy 1',
        more: { label: `Buy ${SEED_PACK}`, price: price * SEED_PACK },
      });
      if (!sure) return;
      const qty = sure === 'more' ? SEED_PACK : 1;
      const ok = await api.buySeeds(seed, qty);
      toast(ok ? `${m.name}: ${qty} in your ${inventory.hotbar.includes(seed) || !inventory.bag.materials.includes(seed) ? 'hotbar' : 'bag'}. Tap an empty plot on your farm.` : 'Not enough gold.');
      await refreshInventory();
    },
    buyStyle: async (kind, id) => {
      const s = getStyle(kind, id);
      const detail = `${kind === 'floor' ? 'Floor' : 'Wall'}: yours forever, put on this room now.`;
      const sure = await confirmBuy(ui, { name: s.name, detail, price: stylePrice(s), image: stylePreviewUrl(kind, id), gold: walletGold });
      if (!sure) return;
      void api.buyStyle(kind, id).then(async (ok) => {
        if (!ok) {
          toast('Not enough gold.');
          return;
        }
        // A bought floor or wall goes straight onto the room you are in (free to change back in
        // the Room panel).
        const next = await api.applyStyle(room.id, kind, id);
        if (next && next.id === room.id) {
          room = next;
          view.setRoom(room);
          atmosphere.setRoom(room);
        }
        toast(`Your new ${kind} is on! Switch it any time in the Room panel.`);
        await refreshShop();
        await refreshInventory();
        await refreshHint();
      });
    },
  });
  panels.add('catalog', catalog.el);
  const roomPanel = createRoomPanel(ui, {
    upgrade: async (roomId) => {
      const r = roomId === room.id ? room : null;
      const cost = r ? upgradeCost(r) : null;
      if (r && cost !== null) {
        const detail = `${ROOM_NAMES[r.kind]} to level ${r.level + 1}: ${r.kind === 'farm' ? 'more room and more plots' : 'the room grows'}.`;
        if (!(await confirmBuy(ui, { name: 'Room upgrade', detail, price: cost, yes: 'Upgrade', gold: walletGold }))) return;
      }
      void api.upgradeRoom(roomId).then(async (next) => {
        if (!next) {
          toast('Not enough gold.');
          return;
        }
        toast(`Upgraded to level ${next.level}!`);
        await openRoom(next.id, false);
      });
    },
    applyStyle: (roomId, kind: StyleKind, id) => {
      void api.applyStyle(roomId, kind, id).then(async (next) => {
        if (!next) return;
        if (next.id === room.id) {
          room = next;
          view.setRoom(room);
          atmosphere.setRoom(room);
        }
        await refreshShop();
        await refreshInventory();
      });
    },
  });
  panels.add('room', roomPanel.el);

  // ---------- Workshop: crafting and the Blacksmith (step 9) ----------
  const workshop = createWorkshopPanel(ui, {
    craft: (recipe) => {
      void api.craft(recipe.id).then(async (ok) => {
        toast(ok ? `Made: ${recipeName(recipe)}.${recipe.makesKind === 'furniture' ? ' It is in your bag.' : ' Pick it in the Room panel.'}` : 'You need more materials.');
        items = await api.getItems();
        await refreshInventory();
      });
    },
    buy: async (gear) => {
      if (!(await confirmBuy(ui, { name: gear.name, detail: gearEffect(gear), price: gear.price }))) return;
      const ok = await api.buyGear(gear.id);
      toast(ok ? `${gear.name}: yours.` : 'Not enough gold.');
      await refreshInventory();
    },
    // The Forge (step 9c).
    smelt: (bar) => {
      void api.smelt(bar).then(async (ok) => {
        toast(ok ? `Smelted: ${getMaterialType(bar).name}.` : 'You need 3 ore and the fee.');
        await refreshInventory();
      });
    },
    forge: async (piece) => {
      const detail = `${pieceEffect(piece)} It replaces what you have now. Uses ${Object.entries(piece.bars)
        .map(([b, n]) => `${n} ${getMaterialType(b as never).name}`)
        .join(' and ')}.`;
      if (!(await confirmBuy(ui, { name: piece.name, detail, price: null, yes: 'Forge' }))) return;
      const ok = await api.forge(piece.id);
      toast(ok ? `${piece.name}: yours forever.` : 'You need more bars.');
      await refreshInventory();
    },
  });
  panels.add('workshop', workshop.el);

  // ---------- The farm, cooking and travel (step 9b) ----------
  const cooking = createCookingPanel(ui, (food) => {
    void api.cook(food.id).then(async (ok) => {
      toast(ok ? `Cooked: ${food.name}. It is in your bag.` : 'You need more crops.');
      await refreshInventory();
    });
  });
  panels.add('cooking', cooking.el);
  const farm = new FarmScreen(view, {
    api,
    toast,
    walkTo: (p) => walkTo(p),
    openCooking: () => panels.show('cooking'),
    pickSeed: () => {
      const count = (id: string): number => (isSeedId(id) ? (inventory.materials[id] ?? 0) : 0);
      const chosen = selectedSlot !== null ? inventory.hotbar[selectedSlot] : null;
      if (chosen && count(chosen) > 0) return chosen as SeedId;
      const any = [...inventory.hotbar, ...inventory.bag.materials].find((id) => id !== null && count(id) > 0);
      return (any as SeedId | undefined) ?? null;
    },
    afterChange: async () => {
      await refreshInventory();
      await refreshHint();
    },
  });
  const travel = createTravelPanel(ui, (place) => void travelTo(place));
  panels.add('travel', travel.el, () => void refreshTravel());
  async function refreshTravel(): Promise<void> {
    const p = await api.getPlayer();
    const f = await api.getFarm();
    const s = await api.getShop();
    const forSale = s.slots.filter((x) => x.loot).length;
    const c = farmCounts(f, f.at);
    const farmStatus =
      c.ripe > 0 ? `${c.ripe} ${c.ripe === 1 ? 'crop' : 'crops'} ripe` : c.growing > 0 ? `${c.growing} growing` : `${c.empty} empty plots`;
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    const cards: PlaceCard[] = [
      { place: 'hotel', status: `Your room, level ${roomLevel(p.hotelRoomId)}`, locked: null, here: room.id === p.hotelRoomId },
      { place: 'shop', status: forSale > 0 ? `${forSale} ${forSale === 1 ? 'item' : 'items'} for sale` : 'Nothing for sale', locked: null, here: room.id === p.shopRoomId },
      { place: 'farm', status: farmStatus, locked: null, here: room.id === p.farmRoomId },
      { place: 'mine', status: `Free. Lantern: ${MINE_LANTERN_MS / 60_000} minutes`, locked: p.level < MINE_UNLOCK_LEVEL ? `Opens at level ${MINE_UNLOCK_LEVEL}` : null, here: false },
      { place: 'dungeon', status: free ? 'A free run' : `Key: ${DUNGEON_KEY_COST} gold`, locked: null, here: false },
    ];
    travel.refresh(cards);
  }
  const roomLevels = new Map<number, number>();
  const roomLevel = (id: number): number => roomLevels.get(id) ?? 1;
  async function travelTo(place: Place): Promise<void> {
    panels.close();
    if (place === 'dungeon') return enterDungeonAsked();
    if (place === 'mine') return enterMineAsked();
    await openRoomKind(place);
  }

  async function refreshShop(): Promise<void> {
    shop = await api.getShop();
    itemViews.setGoods(shop.slots, items);
    shelfPanel.refresh(shop, inventory);
    const open = roomItem(shelfPanel.uid);
    if (panels.open === 'shelf' && !open) panels.close();
  }
  async function refreshHint(): Promise<void> {
    hint.set(newIntro.running ? null : await api.currentHint());
  }
  const showAway = async (): Promise<void> => {
    const away = await api.takeAwaySummary();
    if (away) showAwaySummary(ui, away);
  };
  /** The latest customers (to know when someone waits at the till). */
  let shopCustomers = shop.customers;
  api.onShop((e: ShopEvent) => {
    const here = room.id === shop.roomId;
    switch (e.t) {
      case 'thinking': {
        // Browsing: a "..." thought bubble while the customer looks at the item.
        if (here) bubbles.addNode(e.customerId, document.createTextNode('...'), e.ms);
        break;
      }
      case 'paying':
        if (here) tillCoins.add(e.till);
        break;
      case 'customers':
        // The door bell: someone new came in.
        if (here && e.customers.some((c) => !shopCustomers.some((o) => o.id === c.id))) sound.play('bell');
        shopCustomers = e.customers;
        customers.sync(here ? e.customers : [], room.id);
        break;
      case 'reaction':
        if (here) bubbles.addNode(e.customerId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        break;
      case 'sale':
        sound.play('coin');
        if (here) floats.add(e.till, e.price);
        else toast(`Sold for ${e.price} gold in your shop.`);
        void refreshInventory();
        void refreshShop();
        break;
      case 'slots':
        void refreshShop();
        void refreshInventory();
        void showAway();
        break;
    }
  });

  /** Starts placing an inventory item of this type in the middle of the screen. */
  const startPlacing = (typeId: string): boolean => {
    if (!fitsRoomKind(getFurnitureType(typeId), room)) {
      toast(`${getFurnitureType(typeId).name} cannot go in the ${ROOM_NAMES[room.kind].toLowerCase()}.`);
      return false;
    }
    menu.close();
    if (!placer.startNew(typeId, viewCenter())) return false;
    build.set(true);
    return true;
  };

  // ---------- Hotbar and Bag ----------
  let selectedSlot: number | null = null;
  const hotbar = createHotbar(ui, {
    onTap: (index) => {
      if (bag.carrying) {
        bag.dropOn({ area: 'hotbar', index });
        return;
      }
      const typeId = inventory.hotbar[index];
      if (!typeId) return;
      // Seeds (step 9b): pick them for planting; the next tap on an empty plot plants one.
      if (isSeedId(typeId)) {
        const n = inventory.materials[typeId] ?? 0;
        const name = getMaterialType(typeId).name;
        if (n === 0) {
          toast(`No ${name} left. Buy more in the Catalog (Seeds).`);
          return;
        }
        selectedSlot = index;
        hotbar.setSelected(index);
        toast(room.kind === 'farm' ? `${name}: tap an empty plot to plant.` : `${name}: plant them on your farm (Map).`);
        return;
      }
      if (countInInventory(inventory.furniture, typeId) === 0) {
        toast(`No ${getFurnitureType(typeId).name} left in the bag.`);
        return;
      }
      selectedSlot = index;
      hotbar.setSelected(index);
      if (startPlacing(typeId)) panels.close();
    },
    onHold: (index) => {
      if (!inventory.hotbar[index]) return;
      void api.hotbarToBag(index).then(() => refreshInventory());
      toast('Moved to the bag.');
    },
  });
  const bag = createBagPanel(ui, {
    onPlace: (typeId) => {
      if (countInInventory(inventory.furniture, typeId) === 0) {
        toast(`No ${getFurnitureType(typeId).name} left in the bag.`);
        return;
      }
      const index = inventory.hotbar.indexOf(typeId);
      selectedSlot = index >= 0 ? index : selectedSlot;
      hotbar.setSelected(selectedSlot);
      if (startPlacing(typeId)) panels.close();
    },
    onMove: (from, to) => {
      void api.moveSlot(from, to).then((l) => {
        if (!l) toast('That cannot go there.');
        return refreshInventory();
      });
    },
    onTidy: (tab, how) => void api.tidyBag(tab, how).then(() => refreshInventory()),
    onCarry: (on) => hotbar.setChoosing(on),
  });
  panels.add('bag', bag.el, undefined, () => bag.endCarry(), bag.frame);
  // Panels start under the info panel (phone) and end above the hotbar or the run bag.
  watchLayout(ui, info.panel, [hotbar.el, runBar.el]);

  async function refreshInventory(): Promise<void> {
    inventory = await api.getInventory();
    const p = await api.getPlayer();
    if (!newIntro.running) info.setGold(p.wallet.gold);
    if (!dungeon.isActive) info.setStats(p.level, p.xp, xpForNextLevel(p.level), LEVEL_TOTAL_XP[p.level - 1] ?? 0);
    workshop.refresh(p);
    cooking.refresh(p);
    if (panels.open === 'travel') void refreshTravel();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    dungeonBadge.textContent = free ? 'free' : String(DUNGEON_KEY_COST);
    dungeonButton.title = free ? 'Dungeon: a free run (you have less than 10 gold)' : `Dungeon: the key costs ${DUNGEON_KEY_COST} gold`;
    walletGold = p.wallet.gold;
    catalog.refresh(p.wallet.gold, p.unlockedStyles, room);
    roomPanel.refresh(room, p.wallet.gold, p.unlockedStyles, room.kind === 'shop' ? shop.appeal : null);
    shelfPanel.refresh(shop, inventory);
    const materials = inventory.materials;
    const usable = (typeId: string): boolean =>
      countInInventory(inventory.furniture, typeId) > 0 && fitsRoomKind(getFurnitureType(typeId), room);
    bag.refresh({
      layout: { hotbar: inventory.hotbar, bag: inventory.bag },
      count: (id) => (isMaterialId(id) ? (materials[id] ?? 0) : countInInventory(inventory.furniture, id)),
      usable,
    });
    hotbar.refresh(
      inventory.hotbar.map((typeId) => {
        if (typeId === null) return { typeId, count: 0, usable: false, name: '' };
        if (isSeedId(typeId)) {
          const n = materials[typeId] ?? 0;
          return { typeId, count: n, usable: n > 0 && room.kind === 'farm', name: getMaterialType(typeId).name };
        }
        const type = getFurnitureType(typeId);
        const count = countInInventory(inventory.furniture, typeId);
        return { typeId, count, usable: count > 0 && fitsRoomKind(type, room), name: type.name };
      }),
    );
  }

  // ---------- Avatar, chat, settings ----------
  const avatarPanel = createAvatarPanel(ui, (next) => {
    avatar = { ...avatar, look: next };
    sprite.setLook(next);
    dungeon.setLook(next);
    void api.setLook(next);
  });
  avatarPanel.setLook(avatar.look, (await api.getPlayer()).unlockedClothing);
  avatarPanel.setName(avatar.name);
  panels.add('avatar', avatarPanel.el);

  const chat = createChatPanel(ui, (text) => void api.chat(text));
  panels.add('chat', chat.el, () => chat.focus());
  api.onChat((line) => {
    chat.add(line);
    bubbles.add(line);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || typing(e) || placer.active || e.repeat) return;
    e.preventDefault();
    if (panels.open === 'chat') chat.focus();
    else panels.show('chat');
  });

  const settings = createSettingsPanel(ui, {
    exportSave: () => api.exportSave(),
    importSave: (text) => {
      const r = api.importSave(text);
      if (r.ok) window.location.reload();
      else toast(r.message);
    },
    restoreBackup: () => {
      const r = api.restoreBackup();
      if (r.ok) window.location.reload();
      else toast(r.message);
    },
    newGame: () => {
      api.newGame();
      window.location.reload();
    },
    prefs,
    onSound: (on) => {
      prefs.sound = on;
      sound.setEnabled(on);
      savePrefs(storage, prefs);
    },
    onVolume: (v) => {
      prefs.volume = v;
      sound.setVolume(v);
      savePrefs(storage, prefs);
    },
    onLighting: (on) => {
      prefs.lighting = on;
      atmosphere.setLighting(on);
      lightingOn = on;
      backdrop.container.visible = on && !dungeon.isActive;
      backdrop.refresh();
      redraw();
      savePrefs(storage, prefs);
    },
    onDebug: (on) => {
      label.setVisible(on);
      blockerButtons.setVisible(on);
      cross.visible = on && marked !== null;
      redraw();
    },
  });
  panels.add('settings', settings.el);
  cross.visible = false;

  // ---------- The dungeon (step 9) ----------
  /** Switches the screen between a room and the dungeon (the UI hides what does not belong). */
  function setDungeonMode(on: boolean): void {
    uiRoot.classList.toggle('in-dungeon', on);
    view.world.visible = !on;
    backdrop.container.visible = !on && lightingOn;
    backdrop.refresh();
    sprite.container.visible = !on;
    hotbar.setHidden(on);
    runBar.setHidden(!on);
    if (!on) info.setRun(null);
    if (on) {
      panels.close();
      placer.cancel();
      menu.close();
      build.set(false);
      bubbles.clear();
      floats.clear();
      cross.visible = false;
    }
  }
  /** The Dungeon button: asks first (the key costs 10 gold, free under 10), then goes in. */
  async function enterDungeonAsked(): Promise<void> {
    if (dungeon.isActive) return;
    const p = await api.getPlayer();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    const detail = free ? 'A free run, because you have less than 10 gold. Fight, open chests, bring the loot home.' : 'The key costs 10 gold. Fight, open chests, bring the loot home.';
    // Step 9b: pick up to 3 food items for the lunch box.
    const lunch = createLunchPicker(p.materials);
    if (!(await confirmBuy(uiRoot, { name: 'The crypt', detail, price: free ? null : DUNGEON_KEY_COST, yes: 'Enter', extra: lunch.el }))) return;
    const run = await api.dungeonStart(lunch.chosen() as FoodId[]);
    if (!run) return;
    await refreshInventory();
    await refreshHint();
    setDungeonMode(true);
    await dungeon.enter(run, false);
  }

  /** The mine (step 9c): free from level 3; asks first, then goes in (the same screen as the dungeon). */
  async function enterMineAsked(): Promise<void> {
    if (dungeon.isActive) return;
    const p = await api.getPlayer();
    if (p.level < MINE_UNLOCK_LEVEL) {
      toast(`The mine opens at level ${MINE_UNLOCK_LEVEL}.`);
      return;
    }
    const detail = `Free. Your lantern burns ${MINE_LANTERN_MS / 60_000} minutes. Tap rocks to mine ore; tap fast! Leave any time with everything.`;
    if (!(await confirmBuy(uiRoot, { name: 'The mine', detail, price: null, yes: 'Enter' }))) return;
    const run = await api.mineStart();
    if (!run) return;
    await refreshInventory();
    await refreshHint();
    setDungeonMode(true);
    await dungeon.enter(run, false);
  }

  // ---------- The new-game intro (step 7b) ----------
  /**
   * The shop at the overview: the counter and then the stall_table pop in, the avatar walks in
   * through the door, the start gold flies from the till to the gold counter coin by coin while the
   * number counts up, then the first hint shows. A tap anywhere skips to the end.
   */
  async function playNewGameIntro(): Promise<void> {
    const startItems = items.filter((i) => i.roomId === room.id);
    const gold = (await api.getPlayer()).wallet.gold;
    newIntro.running = true;
    newIntro.hidden = new Set(startItems.map((i) => i.uid));
    syncItems();
    hint.set(null);
    info.setGold(0);
    const home = { x: avatar.x, y: avatar.y };
    const outside = { x: avatar.x, y: doorY(room) + 40 };
    avatar = { ...avatar, ...outside };
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
      path = [home];
      avatar = { ...avatar, state: 'walk' };
      await wait(INTRO_STEP_MS * 2);
    }
    if (!skipped && counter) {
      // The start gold flies from the till to the gold counter, coin by coin.
      const till = tillPoint(counter);
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
      path = [];
      avatar = { ...avatar, ...home, state: 'idle' };
    }
    info.setGold(gold);
    await refreshHint();
  }

  // ---------- Rooms ----------
  /** Opens a room: draws it, puts the avatar in the door zone and plays the camera intro. */
  async function openRoom(roomId: number, intro = true): Promise<void> {
    placer.cancel();
    menu.close();
    bubbles.clear();
    chat.clear();
    const state = await api.enterRoom(roomId);
    room = state.room;
    bounds = roomBoundsRect(room);
    view.setRoom(room);
    atmosphere.setRoom(room);
    itemViews.setRoom(room.id);
    blockers.setRoom(room);
    items = await api.getItems();
    const mine = state.avatars[0];
    if (mine) avatar = { ...mine, look: avatar.look };
    path = [];
    goal = null;
    seating.clear();
    marked = null;
    syncItems();
    roomChanged();
    info.setRoom(room.kind);
    roomLevels.set(room.id, room.level);
    await farm.enter(room);
    floats.clear();
    shop = await api.getShop();
    customers.clear();
    shopCustomers = shop.customers;
    serving = null;
    customers.sync(room.id === shop.roomId ? shop.customers : [], room.id);
    await refreshShop();
    await refreshInventory();
    await refreshHint();
    if (intro) startIntro();
    else fit();
  }
  async function openRoomKind(kind: RoomKind): Promise<void> {
    if (kind === room.kind) return;
    const p = await api.getPlayer();
    await openRoom(kind === 'hotel' ? p.hotelRoomId : kind === 'shop' ? p.shopRoomId : p.farmRoomId);
  }

  // Shift turns snapping off (desktop).
  const onShift = (e: KeyboardEvent): void => placer.setShift(e.shiftKey);
  window.addEventListener('keydown', onShift);
  window.addEventListener('keyup', onShift);
  window.addEventListener('blur', () => placer.setShift(false));

  app.stage.hitArea = app.screen;
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => (dungeon.isActive ? dungeon.camera : camera),
    setCamera: (cam, snap) => (dungeon.isActive ? dungeon.setCamera(cam) : setCamera(cam, snap)),
    getOverviewZoom: overviewZoom,
    getDevicePixelRatio: dpr,
    onGestureStart: () => intro.cancel(),
    onPoint: (screen, kind, target) => {
      if (dungeon.isActive) {
        if (kind !== 'tap') return;
        if (panels.open !== null) panels.close();
        else dungeon.tap(screenToWorld(screen, dungeon.camera));
        return;
      }
      marked = screenToWorld(screen, shown);
      cross.visible = label.visible;
      redraw();
      // While placing, taps do nothing: only ✓ places (so nothing lands by accident).
      if (kind === 'hover' || placer.active) return;
      // The placed item under the pointer, found by Pixi's hit testing (item views are 'static').
      const hit = roomItem(itemViews.uidOf(target));
      if (build.on) {
        // Build mode: taps never walk. A tap or long press on an item opens its menu.
        if (kind === 'tap' && panels.open !== null) {
          panels.close();
          return;
        }
        if (hit) openMenu(hit);
        else menu.close();
        return;
      }
      // Play mode: a long press does nothing; a tap on the room first closes an open panel.
      if (kind === 'longpress') return;
      if (panels.open !== null) {
        panels.close();
        return;
      }
      // The farm (step 9b): plots (plant, harvest) and the cooking pot.
      farm.cancel();
      if (farm.tap(marked)) return;
      // The counter: walk behind it (like sitting); waiting customers pay while you stand there.
      if (hit && getFurnitureType(hit.typeId).servedFromBehind) {
        void serveAt(hit.uid).then((ok) => {
          if (ok) return;
          itemViews.shake(hit.uid);
          toast('There is no way to get behind the counter.');
        });
        return;
      }
      // A table, shelf or case in the shop: its panel (goods, prices, sale history).
      if (hit && getFurnitureType(hit.typeId).slots > 0 && room.id === shop.roomId) {
        shelfPanel.show(hit);
        shelfPanel.refresh(shop, inventory);
        panels.show('shelf');
        return;
      }
      // An item with seats: walk to its nearest free side, then sit or lie (it shakes if no seat
      // can be reached). Any other item is ignored: walk to the point (a blocked point walks to
      // the nearest free cell).
      if (hit && hasSeats(getFurnitureType(hit.typeId))) {
        void sitOn(hit.uid, marked).then((ok) => ok || itemViews.shake(hit.uid));
        return;
      }
      const to = marked;
      void walkTo(to);
    },
    getDragMode: () => (dungeon.isActive || blockers.on || placer.active ? 'draw' : 'pan'),
    onDraw: (phase, screen) => {
      const world = screenToWorld(screen, shown);
      if (placer.active) placer.drag(phase, world);
      else if (blockers.on) blockers.draw(phase, world);
    },
  });

  app.renderer.on('resize', fit);
  // Browser zoom or moving to another monitor changes the device pixel ratio: render at the new one.
  window.addEventListener('resize', () => {
    const next = window.devicePixelRatio || 1;
    if (next !== app.renderer.resolution) app.renderer.resize(window.innerWidth, window.innerHeight, next);
  });
  let clockMs = 0;
  const heads = new Map<number, Point>();
  /** The avatars that stand or walk on the floor (their shadows). */
  const feet: Point[] = [];
  let lastStepBeat = 0;
  app.ticker.add((ticker) => {
    if (dungeon.isActive) {
      control.update(ticker.deltaMS);
      dungeon.frame(ticker.deltaMS);
      return;
    }
    const step = intro.update(ticker.deltaMS, app.screen.width, app.screen.height);
    if (step) setCamera(step.camera, step.done);
    control.update(ticker.deltaMS);
    clockMs += ticker.deltaMS;
    if (!seating.busy) ({ avatar, path } = walkAvatar(avatar, path, ticker.deltaMS));
    // Arrived at the seat's approach point: take the pose and slide onto the seat.
    if (path.length === 0 && seating.goal !== null) avatar = seating.arrive(avatar, roomItem(seating.goal.uid));
    avatar = seating.update(avatar, ticker.deltaMS);
    itemViews.update(ticker.deltaMS);
    customers.update(ticker.deltaMS, clockMs);
    farm.update(clockMs);
    if (path.length === 0 && avatar.state !== 'walk') farm.arrived();
    placer.tick(ticker.deltaMS);
    sprite.update(avatar, clockMs);
    // Soft footsteps, one per bob of the walk.
    const beat = Math.floor(clockMs / (WALK_BOB_MS * 2));
    if (avatar.state === 'walk' && beat !== lastStepBeat && sprite.container.visible) sound.play('step');
    lastStepBeat = beat;
    feet.length = 0;
    if (sprite.container.visible && (avatar.state === 'walk' || avatar.state === 'idle')) feet.push(avatar);
    customers.feet(feet);
    atmosphere.update(ticker.deltaMS, clockMs, feet);
    view.objects.setKey(sprite.container, avatarDepthKey(avatar, roomItem(seating.seated?.uid ?? null)));
    view.update();
    // The floating bars and bubbles follow the ghost, the item and the avatar (the camera may move).
    placeBar.update(placer.screenBounds(), placer.valid);
    menu.follow(menu.uid === null ? null : itemViews.screenBounds(menu.uid));
    heads.clear();
    heads.set(avatar.id, worldToScreen({ x: avatar.x, y: avatar.y - AVATAR_H }, shown));
    customers.heads(heads, AVATAR_H);
    for (const [id, p] of heads) if (id < 0) heads.set(id, worldToScreen(p, shown));
    bubbles.update(ticker.deltaMS, heads);
    floats.update(ticker.deltaMS, (p) => worldToScreen(p, shown));
    // Behind the counter: face the customers.
    if (serving?.state === 'walking' && path.length === 0) {
      serving = { ...serving, state: 'there' };
      avatar = { ...avatar, facing: serving.facing };
    }
    // Someone waits at the till and nobody serves: a coin marker above the till.
    const counterItem = room.id === shop.roomId ? items.find((i) => i.roomId === room.id && getFurnitureType(i.typeId).servedFromBehind) : undefined;
    const waiting = counterItem !== undefined && serving?.state !== 'there' && shopCustomers.some((c) => c.phase === 'pay');
    tillCoins.update(ticker.deltaMS, (p) => worldToScreen(p, shown), waiting && counterItem ? tillPoint(counterItem) : null);
  });

  await openRoom(room.id, !introPending);
  if (introPending) await playNewGameIntro();
  // A run in the save (step 9): back into the dungeon, paused until Resume.
  const saved = await api.getRun();
  if (saved) {
    setDungeonMode(true);
    void dungeon.enter(saved.run, saved.paused);
  }
  if (notice) toast(notice);
  await showAway();
}

void start();
