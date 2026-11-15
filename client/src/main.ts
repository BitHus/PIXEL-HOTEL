import { Application, TextureSource } from 'pixi.js';
import {
  AVATAR_H,
  WALK_BOB_MS,
  INTRO_DEVICE_PX_PER_ART_PX,
  REACTION_BUBBLE_MS,
  CHAT_BUBBLE_FADE_MS,
  readingMs,
  waitingCount,
  type Customer,
  INTRO_COINS,
  doorY,
  INTRO_COIN_EVERY_MS,
  INTRO_COIN_FLY_MS,
  INTRO_FIRST_POP_MS,
  INTRO_STEP_MS,
  tillPoint,
  PALETTE,
  STYLE_TYPES,
  styleKey,
  buildNavGrid,
  cameraAt,
  centerCamera,
  clampCamera,
  containCamera,
  countInInventory,
  fitZoom,
  fitsRoomKind,
  isMaterialId,
  isBlockId,
  getBlockType,
  blockInCell,
  blockProblem,
  plantProblem,
  plantInCell,
  readyInMs,
  BUILD_CELL,
  GEMS_GAIN_ID,
  bagGains,
  blockPrice,
  cellOf,
  type BlockResult,
  getFurnitureType,
  catalogPrice,
  getStyle,
  stylePrice,
  upgradeCost,
  introZoom,
  roomBlockers,
  roomBoundsRect,
  getMaterialType,
  CROP_TYPES,
  MINE_UNLOCK_LEVEL,
  MINE_LANTERN_MS,
  getClothing,
  SLOT_FIELD,
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
  newEntries,
  cellsBetween,
} from '@pixel-hotel/shared';
import './ui/ui.css';
import { LocalGameAPI } from './api/localGameAPI.ts';
import { browserStorage } from './api/saveStorage.ts';
import { RoomView } from './render/roomView.ts';
import { createCursorCross } from './render/cursorCross.ts';
import { attachCameraControl } from './input/cameraControl.ts';
import { HoldControl, type HoldResult, type HoldTarget } from './input/holdControl.ts';
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
import { createGainPopups } from './ui/gainPopups.ts';
import { createGemFly } from './ui/gemFly.ts';
import { BlockViews } from './render/blockViews.ts';
import { PlantViews } from './farm/plantViews.ts';
import { createBagPanel } from './ui/bagPanel.ts';
import { createAvatarPanel } from './ui/avatarPanel.ts';
import { createChatPanel } from './ui/chatPanel.ts';
import { createChatBubbles } from './ui/chatBubbles.ts';
import { createSettingsPanel } from './ui/settingsPanel.ts';
import { createToast } from './ui/toast.ts';
import { iconButton, typing } from './ui/dom.ts';
import { confirmBuy } from './ui/confirmBuy.ts';
import { createPackFlow } from './ui/packOpening.ts';
import { furnitureIconUrl, materialIconUrl } from './ui/itemIcon.ts';
import { stylePreviewUrl } from './render/styleArt.ts';
import { CustomerViews, type Walker } from './render/customerViews.ts';
import { TableMess, type Meal } from './render/tableMess.ts';
import { createOrderBubbles, type OrderMark } from './ui/orderBubbles.ts';
import { SERVE_QUEUE_MAX, brewReadyInMs, seatKey, tavernSeats, type Guest, type TavernView } from '@pixel-hotel/shared';
import { drawGood } from './render/slotGoods.ts';
import { ItemHops } from './render/itemHops.ts';
import { goodSpot } from './render/slotGoods.ts';
import { createShelfPanel } from './ui/shelfPanel.ts';
import { WHERE, createCatalogPanel, growText } from './ui/catalogPanel.ts';
import { BLOCK_PACK, SEED_PACK } from '@pixel-hotel/shared';
import { watchLayout } from './ui/layoutVars.ts';
import { createRoomPanel } from './ui/roomPanel.ts';
import { flyCoin } from './ui/coinFly.ts';
import { runNewGameSetup } from './ui/newGame.ts';
import { createHintBox, createSaleFloats, createTillCoins } from './ui/shopFeedback.ts';
import { pixelIcon } from './ui/pixelIcons.ts';
import { createRunBar } from './ui/runBar.ts';
import { createWorkshopPanel, gearEffect, pieceEffect, recipeName } from './ui/workshopPanel.ts';
import { DungeonScreen } from './dungeon/dungeonScreen.ts';
import { FarmScreen } from './farm/farmScreen.ts';
import { LakesideScreen } from './lakeside/lakesideScreen.ts';
import { createFishBar } from './ui/fishBar.ts';
import { FloatTexts } from './dungeon/floatTexts.ts';
import { createCookingPanel } from './ui/cookingPanel.ts';
import { createBookPanel } from './ui/bookPanel.ts';
import { applyRankColors } from './ui/rank.ts';
import { createTravelPanel, type PlaceCard, type Place } from './ui/travelPanel.ts';
import { createLunchPicker } from './ui/lunchPicker.ts';
import { ROOM_NAMES } from './ui/infoPanel.ts';
import { RoomAtmosphere } from './render/roomAtmosphere.ts';
import { CellGrid } from './render/cellGrid.ts';
import { FloorPaint } from './build/floorPaint.ts';
import { createPaintBar } from './ui/paintBar.ts';
import { Backdrop } from './render/backdrop.ts';
import { Sound } from './audio/sound.ts';
import { loadPrefs, savePrefs } from './api/prefs.ts';
import { runSplash } from './ui/splash.ts';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  // The logo splash runs while the game loads; character creation and the camera intro wait for it.
  const splashGone = runSplash();
  const host = document.getElementById('game');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('#game or #ui element missing');
  const uiRoot: HTMLElement = ui;
  applyRankColors(uiRoot);

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
    await splashGone;
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
  // The faint build grid (step BG1): shown while placing furniture or painting floors.
  const cellGrid = new CellGrid();
  view.gridLayer.addChild(cellGrid.container);
  cellGrid.setRoom(room);
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
  const blockViews = new BlockViews(view);
  const plantViews = new PlantViews(view);
  /** The shop (goods on the slots, prices, sale history, customers). */
  let shop: ShopView = await api.getShop();
  const customers = new CustomerViews(view);
  // Step 9d: items hopping from a slot to a customer's hands, onto the counter and back.
  const hops = new ItemHops(view.markerLayer);
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
  // Gain popups above the avatar's head (step BG3 B) and the blocks (step BG5).
  const popups = createGainPopups(ui, prefs.popups);
  // Gems flying from a punched block, a harvest or a felled tree to the avatar (step BG4; the wallet has them already).
  const gemFly = createGemFly(ui);
  const flyGems = (gains: readonly { itemId: string; count: number }[], at: Point): void => {
    const n = gains.filter((g) => g.itemId === GEMS_GAIN_ID).reduce((a, g) => a + g.count, 0);
    if (n > 0) gemFly.launch(worldToScreen(at, shown), n);
  };
  const bubbles = createChatBubbles(ui);
  const label = createDebugLabel(ui);
  const blockerButtons = createBlockersButton(ui, { onToggle: (on) => blockers.setOn(on), onClear: () => blockers.clear() });
  const panels = createPanels();
  /** The player's gold as last read (for the "Buy this?" panels). */
  let walletGold = 0;
  /** The floor and wall styles the player has unlocked (style keys), as last read. */
  let unlockedStyles: readonly string[] = [];
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
    escapeTaken: () => panels.open !== null || placer.active || paint.active || dungeon.isActive,
  });
  build.button.classList.add('room-only');
  // The Dungeon button (step 9): shows the key cost, or "free" under 10 gold.
  const dungeonButton = iconButton('dungeon', 'Dungeon', () => void enterDungeonAsked(), 'room-only dungeon-btn');
  const dungeonBadge = document.createElement('span');
  dungeonBadge.className = 'btn-badge';
  dungeonButton.appendChild(dungeonBadge);
  const side = createSideButtons(ui, panels, [build.button, dungeonButton]);
  const sideButtons = side.col;
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
      popups,
      onDone: async (result) => {
        setDungeonMode(false);
        items = await api.getItems();
        await openRoom(room.id);
        // Banking at the exit (step BG3b): what came home shows above the head in the room.
        popups.show(bagGains(result.banked));
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
    onItemsSynced();
  };
  /** Set by the tavern block below: guests, orders and table coins follow the items. */
  let onItemsSynced: () => void = () => {};
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
        hotbar.setHidden(placer.active || paint.active);
        syncGrid();
      },
    },
    view.ghostLayer,
  );
  // ---------- Painting floors per cell (step BG1) ----------
  /** The floors the paint bar offers: the farm paints soil and grass (free), other rooms the unlocked floors. */
  const paintableStyles = (): readonly string[] => (room.kind === 'farm' ? [styleKey('floor', 'soil'), styleKey('floor', 'grass')] : unlockedStyles);
  /** The grid shows while placing or painting (unless it is switched off in Settings). */
  const syncGrid = (): void => {
    cellGrid.visible = prefs.cellGrid && (placer.active || paint.active || selectedBlock !== null);
    paintBar.update(paint.brush, paintableStyles(), prefs.cellGrid);
    ui.classList.toggle('painting', paint.active);
  };
  const paint: FloorPaint = new FloorPaint({
    getRoom: () => room,
    paint: async (from, to, id) => {
      const next = await api.paintFloor(room.id, from, to, id);
      if (!next || next.id !== room.id) return false;
      room = next;
      view.setRoom(room);
      atmosphere.setRoom(room);
      sound.play('pop');
      await refreshShop();
      return true;
    },
    onChange: () => {
      hotbar.setHidden(placer.active || paint.active);
      syncGrid();
    },
  });
  view.gridLayer.addChild(paint.container);
  const paintBar = createPaintBar(ui, {
    onBrush: (id) => paint.setBrush(id),
    onGrid: () => {
      prefs.cellGrid = !prefs.cellGrid;
      savePrefs(storage, prefs);
      syncGrid();
    },
    onDone: () => paint.end(),
  });
  const viewCenter = (): Point => screenToWorld({ x: app.screen.width / 2, y: app.screen.height / 2 }, shown);
  const placeBar = createPlaceBar(ui, {
    onPlace: () => void placer.place(),
    onRotate: () => placer.rotate(),
    onCancel: () => placer.cancel(),
  });
  const menu = createItemMenu(ui, {
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
  // Packs (step BG8): ask, pop, popups, toast with "Wear it".
  const packFlow = createPackFlow({
    ui,
    api,
    popups,
    toast,
    wear: (id) => {
      const c = getClothing(id);
      if (!c) return;
      const look = { ...avatar.look, [SLOT_FIELD[c.slot]]: id };
      avatar = { ...avatar, look };
      sprite.setLook(look);
      dungeon.setLook(look);
      void api.setLook(look);
      void api.getPlayer().then((p) => avatarPanel.setLook(look, p.unlockedClothing));
    },
    refresh: async () => {
      await refreshInventory();
      avatarPanel.setLook(avatar.look, (await api.getPlayer()).unlockedClothing);
    },
  });
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
        popups.show(r.gains);
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
      const detail = crop ? `Plant it in the soil of your farm: fully grown in ${growText(crop)}, then punch it. The crop is worth ${crop.baseValue}.` : 'Plant it in the soil of your farm.';
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
      if (ok) popups.show(ok);
      toast(ok ? `${m.name}: ${qty} in your ${inventory.hotbar.includes(seed) || !inventory.bag.materials.includes(seed) ? 'hotbar' : 'bag'}. Select it in the hotbar and tap soil on your farm.` : 'Not enough gold.');
      await refreshInventory();
    },
    buyBlock: async (id) => {
      const b = getBlockType(id);
      const price = blockPrice(id);
      const sure = await confirmBuy(ui, {
        name: b.name,
        detail: `Place it in a free cell of your rooms. ${b.hardness} punch${b.hardness === 1 ? '' : 'es'} to break; it comes back to your bag.`,
        price,
        image: materialIconUrl(b.id),
        gold: walletGold,
        title: 'Buy this?',
        yes: 'Buy 1',
        more: { label: `Buy ${BLOCK_PACK}`, price: price * BLOCK_PACK },
      });
      if (!sure) return;
      const qty = sure === 'more' ? BLOCK_PACK : 1;
      const got = await api.buyBlocks(id, qty);
      if (got) popups.show(got);
      toast(got ? `${b.name}: ${qty} in your bag. Put it in the hotbar, then tap a free cell.` : 'Not enough gold.');
      await refreshInventory();
    },
    openPack: (pack) => void packFlow.open(pack),
    sellSpare: (id) => void packFlow.sell(id),
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
    startPaint: () => {
      // The brush starts as the first unlocked floor that is not the room's own (painting the room's
      // own floor erases the paint).
      const own = room.floorStyle;
      const floors = STYLE_TYPES.filter((x) => x.kind === 'floor' && paintableStyles().includes(styleKey('floor', x.id))).map((x) => x.id);
      const brush = floors.find((id) => id !== own) ?? own;
      panels.close();
      build.set(false);
      paint.start(brush);
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
        if (ok) popups.show(ok);
        toast(ok ? `Made: ${recipeName(recipe)}.${recipe.makesKind === 'furniture' ? ' It is in your bag.' : ' Pick it in the Room panel.'}` : 'You need more materials.');
        items = await api.getItems();
        await refreshInventory();
      });
    },
    buy: async (gear) => {
      if (!(await confirmBuy(ui, { name: gear.name, detail: gearEffect(gear), price: gear.price }))) return;
      const ok = await api.buyGear(gear.id);
      if (ok) popups.show(ok);
      toast(ok ? `${gear.name}: yours.` : 'Not enough gold.');
      await refreshInventory();
    },
    // The Forge (step 9c).
    smelt: (bar) => {
      void api.smelt(bar).then(async (ok) => {
        if (ok) popups.show(ok);
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
      if (ok) popups.show(ok);
      toast(ok ? `${piece.name}: yours forever.` : 'You need more bars.');
      await refreshInventory();
    },
  });
  panels.add('workshop', workshop.el);

  // ---------- The farm, cooking and travel (step 9b) ----------
  const cooking = createCookingPanel(ui, (food) => {
    void api.cook(food.id).then(async (ok) => {
      if (ok) popups.show(ok);
      toast(ok ? `Cooked: ${food.name}. It is in your bag.` : 'You need more crops.');
      await refreshInventory();
    });
  });
  panels.add('cooking', cooking.el);
  // ---------- The Book (step 9e) ----------
  const book = createBookPanel(ui, (tab, percent) => {
    void api.claimBookReward(tab, percent).then(async (claim) => {
      if (claim !== null) {
        sound.play('coin');
        popups.show(claim.gains);
        toast(`Book reward: +${claim.gold} gold${claim.gems > 0 ? ` and ${claim.gems} gems` : ''}.`);
      }
      await refreshInventory();
    });
  });
  panels.add('book', book.el, () => {
    // What is new stays marked while the Book is open; opening it clears the button's dot.
    void api.getPlayer().then(async (p) => {
      book.refresh(p, true);
      await api.bookOpened();
      side.setBookDot(false);
    });
  });
  const farm = new FarmScreen(view, {
    openCooking: () => panels.show('cooking'),
  });
  // ---------- The lakeside: woodcutting and fishing (step 9f) ----------
  /** Floating texts in the rooms (what a tree or a fish gave): the dungeon's FloatTexts, at world points. */
  const roomFloats = new FloatTexts(ui);
  const fishBar = createFishBar(ui, { onHold: (on) => lakeside.fishHold(on), onStop: () => lakeside.stopFishing() });
  const lakeside: LakesideScreen = new LakesideScreen(view, {
    api,
    bar: fishBar,
    toast,
    walkTo: (p) => walkTo(p),
    follow: (p) => {
      follow(p);
      goal = null;
    },
    avatar: () => ({ x: avatar.x, y: avatar.y, facing: avatar.facing }),
    face: (f) => {
      avatar = { ...avatar, facing: f };
    },
    swing: () => sprite.gesture('reach'),
    float: (at, text, rank, delayMs = 0) => roomFloats.add(at, text, 'loot', delayMs, rank),
    sound: (name) => sound.play(name),
    gains: (g, at) => {
      popups.show(g);
      if (at) flyGems(g, at);
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
    const waiting = waitingCount(s.customers);
    const farmStatus =
      f.ripe > 0 ? `${f.ripe} ${f.ripe === 1 ? 'plant' : 'plants'} ready to harvest` : f.growing > 0 ? `${f.growing} growing` : `${f.free} free soil cells`;
    const lake = await api.getLakeside();
    const standing = lake.trees.filter((t) => t.regrowInMs === null).length;
    const lakeStatus = `Fish and chop wood: ${standing} of ${lake.trees.length} trees standing`;
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    const cards: PlaceCard[] = [
      { place: 'hotel', status: `Your room, level ${roomLevel(p.hotelRoomId)}`, locked: null, here: room.id === p.hotelRoomId },
      {
        place: 'shop',
        status: forSale > 0 ? `${forSale} ${forSale === 1 ? 'item' : 'items'} for sale` : 'Nothing for sale',
        badge: waiting > 0 ? `${waiting} waiting` : undefined,
        locked: null,
        here: room.id === p.shopRoomId,
      },
      { place: 'farm', status: farmStatus, locked: null, here: room.id === p.farmRoomId },
      { place: 'lakeside', status: lakeStatus, locked: null, here: room.id === p.lakesideRoomId },
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
    // A finished quest pays gems (step BG4): the popup shows them.
    popups.show(await api.takeGains());
  }
  /** Step 9d: "n waiting" on the Map button while customers wait at the till. */
  const mapBadge = document.createElement('span');
  mapBadge.className = 'btn-badge map-badge';
  mapButton.appendChild(mapBadge);
  /** Customers at the till, and (step 9t) orders to serve and coins on the tables, as one badge on the Map button. */
  let tillWaiting = 0;
  const updateBadge = (): void => {
    const orders = tavern.guests.filter((g) => g.phase === 'order' && g.order).length;
    const coins = tavern.mess.filter((m) => m.coins > 0).length;
    const parts = [tillWaiting > 0 ? `${tillWaiting} waiting` : '', orders > 0 ? `${orders} ${orders === 1 ? 'order' : 'orders'}` : '', coins > 0 ? `${coins} ${coins === 1 ? 'coin pile' : 'coin piles'}` : ''].filter(Boolean);
    mapBadge.hidden = parts.length === 0;
    mapBadge.textContent = parts.join(', ');
    mapButton.title = parts.length > 0 ? `Map: travel (${parts.join(', ')} in your tavern)` : 'Map: travel';
  };
  const showWaiting = (list: readonly Customer[]): void => {
    tillWaiting = waitingCount(list);
    updateBadge();
  };
  /** A world point on a placed item: slot `index` of its goods (bottom middle). */
  const slotPoint = (shelfUid: number, index: number): Point | null => {
    const item = items.find((i) => i.uid === shelfUid && i.roomId === room.id);
    if (!item) return null;
    const t = getFurnitureType(item.typeId);
    const at = goodSpot(t, item.facing, index, t.slots);
    return { x: item.x + at.x, y: item.y + at.y };
  };
  /** Where a customer puts the item down on the counter while paying (left of the till). */
  const counterTop = (): Point | null => {
    const c = items.find((i) => i.roomId === room.id && getFurnitureType(i.typeId).servedFromBehind);
    if (!c) return null;
    const at = goodSpot(getFurnitureType(c.typeId), c.facing, 0, 2);
    return { x: c.x + at.x, y: c.y + at.y };
  };
  /** A customer's line (and a reaction face with it) in a bubble at reading pace. */
  const sayBubble = (customerId: number, text: string, icon?: Node): void => {
    const node = document.createElement('span');
    node.className = 'npc-line';
    if (icon) node.appendChild(icon);
    node.appendChild(document.createTextNode(text));
    bubbles.addNode(customerId, node, readingMs(text, REACTION_BUBBLE_MS) + CHAT_BUBBLE_FADE_MS);
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
      case 'paying': {
        if (!here) break;
        tillCoins.add(e.till);
        // The customer puts the item on the counter (it hops there and waits).
        const loot = customers.heldOf(e.customerId);
        const from = customers.handPoint(e.customerId);
        const to = counterTop();
        if (loot && from && to) {
          customers.gesture(e.customerId, 'reach');
          customers.hold(e.customerId, null);
          hops.add(e.customerId, loot, from, () => to, { stay: true });
        }
        break;
      }
      case 'say':
        if (here) sayBubble(e.customerId, e.text);
        break;
      case 'customers':
        // The door bell: someone new came in.
        if (here && e.customers.some((c) => !shopCustomers.some((o) => o.id === c.id))) sound.play('bell');
        shopCustomers = e.customers;
        showWaiting(e.customers);
        customers.sync(here ? e.customers : [], room.id, items);
        break;
      case 'reaction': {
        if (!here) break;
        if (e.line) sayBubble(e.customerId, e.line, pixelIcon(e.reaction));
        else bubbles.addNode(e.customerId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        // Taking: a reach, and the item hops from the slot into their hands.
        const from = e.took ? slotPoint(e.took.shelfUid, e.took.index) : null;
        if (e.took && from) {
          const loot = e.took.loot;
          const id = e.customerId;
          customers.gesture(id, 'reach');
          customers.hold(id, null);
          hops.add(id, loot, from, () => customers.handPoint(id), { done: () => customers.hold(id, loot) });
        }
        break;
      }
      case 'sale': {
        sound.play('coin');
        if (here) {
          floats.add(e.till, e.price);
          // The shopkeeper hands it back: the item hops from the counter to the customer, who nods.
          sprite.gesture('hand');
          const id = e.customerId;
          const from = counterTop();
          const loot = hops.lootOf(id) ?? customers.heldOf(id);
          if (from && loot) {
            hops.add(id, loot, from, () => customers.handPoint(id), {
              done: () => {
                customers.hold(id, loot, true);
                customers.gesture(id, 'nod');
              },
            });
          }
        } else toast(`Sold for ${e.price} gold in your shop.`);
        void refreshInventory();
        void refreshShop();
        break;
      }
      case 'slots':
        void refreshShop();
        void refreshInventory();
        break;
    }
  });

  // ---------- The tavern (step 9t): guests, orders, coins on the tables ----------
  let tavern: TavernView = await api.getTavern();
  const guests = new CustomerViews(view);
  const tableMess = new TableMess(view);
  /** A guest as a walker: they only sit once they have reached their seat, and look at the table. */
  const walkers = (list: readonly Guest[]): Walker[] =>
    list.map((g) => ({ id: g.id, look: g.look, x: g.x, y: g.y, facing: g.facing, path: g.path, speed: g.speed, seat: g.seated && g.seat ? { uid: g.seat.uid } : null, sitFacing: g.facing }));
  const inTavern = (): boolean => room.id === tavern.roomId;
  const orders = createOrderBubbles(ui, (id) => void serveTap(id));
  /** The open orders for the order bubbles: queued or carried ones are dimmed, a guest with little patience is urgent. */
  const orderMarks = (): OrderMark[] =>
    tavern.guests.flatMap((g) =>
      g.phase === 'order' && g.order ? [{ guestId: g.id, item: g.order.item, urgent: g.warned, taken: tavern.serveQueue.includes(g.id) || tavern.holding?.guestId === g.id }] : [],
    );
  /** What guests eat or drink now, on their table spots (the served item stays there until they leave). */
  const meals = (): Meal[] => {
    const seats = tavernSeats(items, tavern.roomId);
    return tavern.guests.flatMap((g) => {
      const seat = g.phase === 'eat' && g.order && g.seat ? seats.find((k) => seatKey(k) === seatKey(g.seat!)) : undefined;
      return seat && g.order ? [{ guestId: g.id, item: g.order.item, spot: seat.spot }] : [];
    });
  };
  /** Draws the tavern as it is now (guests, coins and dishes, order bubbles, the Map badge). */
  const syncTavern = (): void => {
    const on = inTavern();
    guests.sync(on ? walkers(tavern.guests) : [], room.id, items);
    tableMess.sync(on ? tavern.mess : [], on ? meals() : [], items);
    orders.sync(on ? orderMarks() : []);
    updateBadge();
  };
  onItemsSynced = syncTavern;
  async function refreshTavern(): Promise<void> {
    tavern = await api.getTavern();
    syncTavern();
  }
  /** A tap on a guest or an order bubble: the order is carried to the table (taps queue up, at most SERVE_QUEUE_MAX). */
  async function serveTap(guestId: number): Promise<void> {
    if (tavern.serveQueue.length >= SERVE_QUEUE_MAX) {
      toast(`${SERVE_QUEUE_MAX} orders are waiting to be carried already.`);
      return;
    }
    if (!(await api.serveGuest(guestId))) toast('There is no way to the bar.');
    else sound.play('click');
    await refreshTavern();
  }
  /** A tap on something of the tavern: a guest with an order, coins or a dish on a table, a brewing barrel. True when handled. */
  const tavernTap = (world: Point, hit: FurnitureItem | undefined): boolean => {
    if (!inTavern()) return false;
    const gid = guests.at(world);
    const guest = gid === null ? undefined : tavern.guests.find((g) => g.id === gid);
    if (guest?.phase === 'order' && guest.order) {
      void serveTap(guest.id);
      return true;
    }
    const m = tableMess.at(world);
    if (m) {
      if (tavern.holding || tavern.serveQueue.length > 0) toast('Serve the orders first.');
      else void api.tidyTable(m.messId, m.what).then((ok) => ok || toast('There is no way to that table.'));
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).brews) {
      void brewTap(hit);
      return true;
    }
    return false;
  };
  /** A tap on a brewing barrel: a ready brew is collected (mugs in the bag); else it says how long is left. */
  async function brewTap(barrel: FurnitureItem): Promise<void> {
    const r = await api.collectBrew(barrel.uid);
    if (r) {
      sound.play('pop');
      popups.show(r.gains);
      return;
    }
    await refreshTavern();
    const brew = tavern.brews.find((b) => b.barrelUid === barrel.uid);
    if (!brew) toast('The barrel is empty.');
    else toast(`Brewing: ready in ${Math.max(1, Math.ceil(brewReadyInMs(brew, Date.now()) / 60_000))} min.`);
  }
  let seatedGuests = 0;
  api.onTavern((e) => {
    const on = inTavern();
    switch (e.t) {
      case 'guests': {
        // The door bell for new arrivals; a soft murmur when three or more sit.
        if (on && e.guests.some((g) => !tavern.guests.some((o) => o.id === g.id))) sound.play('bell');
        const sitting = e.guests.filter((g) => g.seated).length;
        if (on && sitting >= 3 && seatedGuests < 3) sound.play('murmur');
        seatedGuests = sitting;
        tavern = { ...tavern, guests: e.guests };
        syncTavern();
        void refreshTavern();
        break;
      }
      case 'say':
        if (on) sayBubble(e.guestId, e.text);
        break;
      case 'order':
        if (on) bubbles.addNode(e.guestId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        void refreshInventory(); // the unit leaves the bag when the guest orders
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
        void refreshInventory(); // the unserved order is back in the bag
        break;
      case 'coins':
        void refreshTavern();
        break;
      case 'to_stall':
        // They walk on past the market stall as a shop customer.
        void api.getShop().then((s) => {
          shop = s;
          shopCustomers = s.customers;
          customers.sync(room.id === shop.roomId ? s.customers : [], room.id, items);
        });
        break;
      case 'walk':
        follow(e.path);
        goal = null;
        break;
      case 'holding':
        sprite.setHeld(e.item ? drawGood({ kind: 'material', id: e.item, qty: 1 }) : null);
        void refreshTavern();
        break;
      case 'served':
        sound.play('clink');
        sprite.gesture('hand');
        void refreshTavern();
        void refreshInventory();
        break;
      case 'collected':
        sound.play('coin');
        popups.show(e.gains);
        void refreshTavern();
        void refreshInventory(); // the gold shows in the info panel
        break;
      case 'cleared':
        sound.play('pop');
        void refreshTavern();
        break;
      case 'queue':
        tavern = { ...tavern, serveQueue: e.queue };
        syncTavern();
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
  /** The block picked in the hotbar (step BG5), or null: then taps on blocks punch them. */
  let selectedBlock: string | null = null;
  /** A block action waiting for the avatar to arrive (the cell was out of reach). */
  let pendingBlock: { kind: 'place' | 'hit'; c: number; r: number; tries: number } | null = null;
  const selectBlock = (id: string | null, slot: number | null): void => {
    selectedBlock = id;
    selectedSlot = id === null ? null : slot;
    hotbar.setSelected(selectedSlot);
    if (id === null) {
      blockViews.showGhost(null);
      plantViews.showGhost(null);
    }
    syncGrid();
  };
  const hotbar = createHotbar(ui, {
    onTap: (index) => {
      if (bag.carrying) {
        bag.dropOn({ area: 'hotbar', index });
        return;
      }
      const typeId = inventory.hotbar[index];
      if (!typeId) return;
      // Seeds (step BG6): select one; a tap on a free soil cell of your farm plants it (hold to plant a line).
      if (isSeedId(typeId)) {
        const n = inventory.materials[typeId] ?? 0;
        const name = getMaterialType(typeId).name;
        if (selectedBlock === typeId) {
          selectBlock(null, null);
          toast('Seeds put away.');
        } else if (n === 0) {
          toast(`No ${name} left. Buy seeds in the Catalog (Seeds), or find them in drops and harvests.`);
        } else if (room.kind !== 'farm') {
          toast(`${name}: plant it on your farm (Map). Seeds only grow on soil.`);
        } else {
          selectBlock(typeId, index);
          toast(`${name}: tap a soil cell to plant it. Punch a grown plant to harvest it.`);
        }
        return;
      }
      // Blocks (step BG5): select one; a tap on a free cell places it, a tap on a block punches it.
      if (isBlockId(typeId)) {
        const n = inventory.materials[typeId] ?? 0;
        const type = getBlockType(typeId);
        if (selectedBlock === typeId) {
          selectBlock(null, null);
          toast('Block put away.');
        } else if (n === 0) {
          toast(`No ${type.name} left. Punch blocks to get some back, or buy more in the Catalog (Blocks).`);
        } else if (!type.placeIn.includes(room.kind)) {
          toast(`${type.name} cannot go in the ${ROOM_NAMES[room.kind].toLowerCase()}.`);
        } else {
          selectBlock(typeId, index);
          toast(`${type.name}: tap a free cell to place it. Tap a block to punch it.`);
        }
        return;
      }
      selectBlock(null, null);
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
  // The Bag button sits at the right end of the hotbar (owner, after 9d).
  hotbar.el.appendChild(side.bag);
  // Panels start under the info panel (phone) and end above the hotbar or the run bag.
  watchLayout(ui, info.panel, [hotbar.el, runBar.el]);

  async function refreshInventory(): Promise<void> {
    inventory = await api.getInventory();
    const p = await api.getPlayer();
    if (!newIntro.running) {
      info.setGold(p.wallet.gold);
      info.setGems(p.wallet.gems);
    }
    if (selectedBlock !== null && (inventory.materials[selectedBlock as keyof typeof inventory.materials] ?? 0) === 0) {
      toast(`Out of ${getMaterialType(selectedBlock as SeedId).name}.`);
      selectBlock(null, null);
    }
    if (!dungeon.isActive) info.setStats(p.level, p.xp, xpForNextLevel(p.level), LEVEL_TOTAL_XP[p.level - 1] ?? 0);
    workshop.refresh(p);
    cooking.refresh(p);
    if (panels.open === 'book') book.refresh(p);
    else side.setBookDot(newEntries(p.seen, p.bookOpenedAt).length > 0);
    if (panels.open === 'travel') void refreshTravel();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    dungeonBadge.textContent = free ? 'free' : String(DUNGEON_KEY_COST);
    dungeonButton.title = free ? 'Dungeon: a free run (you have less than 10 gold)' : `Dungeon: the key costs ${DUNGEON_KEY_COST} gold`;
    walletGold = p.wallet.gold;
    unlockedStyles = p.unlockedStyles;
    paintBar.update(paint.brush, paintableStyles(), prefs.cellGrid);
    catalog.refresh(p.wallet.gold, p.unlockedStyles, room, { gems: p.wallet.gems, unlocked: p.unlockedClothing, spares: p.clothingSpares });
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
        if (isBlockId(typeId)) {
          const n = materials[typeId] ?? 0;
          const type = getBlockType(typeId);
          return { typeId, count: n, usable: n > 0 && type.placeIn.includes(room.kind), name: type.name };
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
    onCellGrid: (on) => {
      prefs.cellGrid = on;
      savePrefs(storage, prefs);
      syncGrid();
    },
    onPopups: (on) => {
      prefs.popups = on;
      popups.setEnabled(on);
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
    if (on) paint.end();
    hotbar.setHidden(on);
    runBar.setHidden(!on);
    if (!on) info.setRun(null);
    if (on) {
      lakeside.stop();
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
    paint.end();
    menu.close();
    bubbles.clear();
    chat.clear();
    const state = await api.enterRoom(roomId);
    room = state.room;
    bounds = roomBoundsRect(room);
    view.setRoom(room);
    cellGrid.setRoom(room);
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
    roomFloats.clear();
    await lakeside.enter(room);
    floats.clear();
    shop = await api.getShop();
    customers.clear();
    hops.clear();
    shopCustomers = shop.customers;
    showWaiting(shop.customers);
    serving = null;
    customers.sync(room.id === shop.roomId ? shop.customers : [], room.id, items);
    guests.clear();
    tableMess.clear();
    orders.clear();
    sprite.setHeld(null);
    seatedGuests = 0;
    tavern = await api.getTavern();
    syncTavern();
    await refreshShop();
    await refreshInventory();
    await refreshHint();
    if (intro) startIntro();
    else fit();
  }
  async function openRoomKind(kind: RoomKind): Promise<void> {
    if (kind === room.kind) return;
    const p = await api.getPlayer();
    await openRoom(kind === 'hotel' ? p.hotelRoomId : kind === 'shop' ? p.shopRoomId : kind === 'lakeside' ? p.lakesideRoomId : p.farmRoomId);
  }

  // ---------- Blocks: place and punch (step BG5) ----------
  const BLOCK_REFUSALS: Partial<Record<string, string>> = {
    door: 'Keep the door free.',
    door_blocked: 'That would block the way in.',
    counter_blocked: 'The counter needs a way behind it.',
    seat_blocked: 'Guests could not get to a seat then.',
    wrong_room: 'That block cannot go here.',
    empty: 'None left.',
    not_buildable: 'You cannot build here.',
    no_soil: 'Seeds only grow on soil. Paint soil in the Room panel (Paint soil).',
    nothing_happens: 'Nothing happens. Both seeds are safe in your bag.',
    already_spliced: 'This cell already holds two seeds.',
    taken: '',
  };
  /** Why the selected block or seed does not fit in this cell (null = it fits); `standing` = avatars standing still. */
  const selectedProblem = (c: number, r: number, standing: Point[]) =>
    selectedBlock !== null && isSeedId(selectedBlock)
      ? plantProblem(room, items, c, r, { standing, from: null })
      : blockProblem(room, items, getBlockType(selectedBlock!), c, r, { standing, from: null });
  /**
   * Sends a place or punch to the GameAPI and draws what came back. `line` = a place hold along cells: out of
   * reach or refused cells are skipped quietly (no walking, no toasts). Returns what a hold should do next.
   */
  /** A punch at a plant: with a seed selected, a young plant gets the seed spliced in (step BG7); else it is harvested. */
  const hitOrSplice = async (c: number, r: number): Promise<BlockResult> => {
    if (selectedBlock !== null && isSeedId(selectedBlock)) {
      const res = await api.spliceSeed(c, r, selectedBlock);
      // A ripe or already spliced plant is just punched (harvest, or "not grown yet"); anything else answers as it is.
      if (!(res.kind === 'refused' && (res.problem === 'ripe' || res.problem === 'already_spliced'))) return res;
    }
    return api.hitPlant(c, r);
  };
  const doBlock = async (kind: 'place' | 'hit', c: number, r: number, id: string | null, tries = 0, line = false): Promise<HoldResult> => {
    const was = blockInCell(room, c, r)?.id ?? null;
    const wasSeed = plantInCell(room, c, r)?.seed ?? null;
    // Seeds are planted (step BG6), a plant is harvested by punching it; blocks are placed and punched.
    const res: BlockResult =
      kind === 'place' && id
        ? isSeedId(id)
          ? await api.plantSeed(c, r, id)
          : await api.placeBlock(c, r, id)
        : wasSeed
          ? await hitOrSplice(c, r)
          : await api.hitBlock(c, r);
    if (res.kind === 'unripe') {
      // A punch never hurts a young plant: it shakes and says when it will be ready.
      plantViews.shake(c, r);
      const mins = Math.max(1, Math.ceil(res.leftMs / 60_000));
      toast(res.leftMs < 60_000 ? 'Not grown yet: ready in under a minute.' : `Not grown yet: ready in ${mins} min.`);
      return 'stop';
    }
    if (res.kind === 'walk') {
      if (line) return 'go';
      // Too far: walk closer first, then do it (once more at most).
      follow(res.path);
      goal = null;
      pendingBlock = tries < 2 ? { kind, c, r, tries: tries + 1 } : null;
      return 'walk';
    }
    if (res.kind === 'refused') {
      if (res.problem === 'cooldown') return 'retry';
      const text = BLOCK_REFUSALS[res.problem];
      if (text && !line) toast(text);
      return line ? 'go' : 'stop';
    }
    room = res.room;
    if (res.kind === 'planted' || res.kind === 'spliced') {
      sound.play('pop');
      if (res.kind === 'spliced') toast('Two seeds in one cell. Wait for it to grow, then punch it.');
      void refreshHint();
    } else if (res.kind === 'harvested') {
      if (wasSeed) plantViews.harvestFx(c, r, wasSeed);
      sound.play('pop');
      if (res.clothing) {
        toast(`New clothes unlocked: ${getClothing(res.clothing)?.name ?? res.clothing} (Avatar panel).`);
        void api.getPlayer().then((p) => avatarPanel.setLook(avatar.look, p.unlockedClothing));
      }
      if (res.recipe) toast('New splice recipe found! See the Book, Splice tab.');
    } else if (res.kind === 'placed') sound.play('pop');
    else if (res.kind === 'cracked') {
      blockViews.punch(c, r);
      sound.play('hit');
    } else {
      if (was) blockViews.breakFx(c, r, was);
      sound.play('pop');
    }
    popups.show(res.gains);
    flyGems(res.gains, { x: (c + 0.5) * BUILD_CELL, y: (r + 0.5) * BUILD_CELL });
    roomChanged();
    updateBlockGhost();
    void refreshInventory();
    return res.kind === 'broken' || res.kind === 'harvested' || res.kind === 'spliced' ? 'stop' : 'go';
  };
  /** A tap on cell p in play mode: punches a block there, or places the selected block. False = not for us. */
  const blockTap = (p: Point): boolean => {
    if (room.kind === 'lakeside') return false;
    const { c, r } = cellOf(p);
    if (blockInCell(room, c, r) || plantInCell(room, c, r)) {
      void doBlock('hit', c, r, null);
      return true;
    }
    if (selectedBlock === null) return false;
    const standing = path.length === 0 && avatar.state !== 'walk' ? [{ x: avatar.x, y: avatar.y }] : [];
    const problem = selectedProblem(c, r, standing);
    if (problem === 'no_soil') {
      toast(BLOCK_REFUSALS.no_soil!);
      return false; // then the tap just walks there
    }
    if (problem === null) {
      void doBlock('place', c, r, selectedBlock);
      return true;
    }
    // Cells that are only wrong for a block fall through to walking and sitting; the rest say why.
    if (BLOCK_REFUSALS[problem] && problem !== 'wrong_room' && problem !== 'empty' && problem !== 'not_buildable' && problem !== 'taken') {
      toast(BLOCK_REFUSALS[problem]!);
      return true;
    }
    return false;
  };
  /** The ghost of the selected block follows the pointer (green = fits). */
  function updateBlockGhost(): void {
    const at = marked === null ? null : cellOf(marked);
    if (selectedBlock === null || at === null || build.on || placer.active || paint.active || room.kind === 'lakeside' || blockInCell(room, at.c, at.r) || plantInCell(room, at.c, at.r)) {
      blockViews.showGhost(null);
      plantViews.showGhost(null);
      return;
    }
    const valid = selectedProblem(at.c, at.r, []) === null;
    if (isSeedId(selectedBlock)) {
      blockViews.showGhost(null);
      plantViews.showGhost({ ...at, seed: selectedBlock, valid });
    } else {
      plantViews.showGhost(null);
      blockViews.showGhost({ ...at, id: selectedBlock, valid });
    }
  }
  // ---------- Hold to repeat (step BG5b) ----------
  // A press on a block, a plant, a mine rock or a tree keeps hitting at that thing's cooldown until it
  // breaks, the press ends, or the avatar is out of reach (it then walks closer and goes on). The first hit
  // is on press. Holding still with a block selected places blocks (a drag along cells makes a line).
  // Not for the dungeon fight and not for fishing. The timing is the pure holdTick (shared/src/hold.ts).
  const holdBusyElsewhere = (): boolean =>
    lakeside.fishing || placer.active || paint.active || build.on || blockers.on || panels.open !== null;
  const hold = new HoldControl({
    now: () => performance.now(),
    walking: () => path.length > 0 || avatar.state === 'walk',
    hit: async (t: HoldTarget): Promise<HoldResult> => {
      if (t.kind === 'block' || t.kind === 'plant') return doBlock('hit', t.c, t.r, null, 0, false);
      if (t.kind === 'line') return selectedBlock === null ? 'stop' : doBlock('place', t.c, t.r, selectedBlock, 0, true);
      if (t.kind === 'tree') return lakeside.holdSwing(t.index);
      if (t.kind === 'rock') return dungeon.holdRock(t.id);
      return 'stop';
    },
  });
  // HOLD TO WALK: holding still on the floor walks to the pointer and follows it while the press lasts.
  let walkHold = false;
  let walkHoldCell = '';
  const steerWalk = (screen: Point): void => {
    marked = screenToWorld(screen, shown);
    const { c, r } = cellOf(marked);
    const key = `${c},${r}`;
    if (key === walkHoldCell && walkHold) return;
    walkHoldCell = key;
    void walkTo(marked);
  };
  /** What a press on this screen point would hit (a held thing), or null. */
  const holdTargetAt = (screen: Point): HoldTarget | null => {
    if (dungeon.isActive) {
      const id = dungeon.rockUnder(screenToWorld(screen, dungeon.camera));
      return id === null ? null : { kind: 'rock', id };
    }
    if (holdBusyElsewhere()) return null;
    const world = screenToWorld(screen, shown);
    const { c, r } = cellOf(world);
    if (room.kind !== 'lakeside' && blockInCell(room, c, r)) return { kind: 'block', c, r };
    if (room.kind === 'farm' && plantInCell(room, c, r)) return { kind: 'plant', c, r };
    const tree = lakeside.treeUnder(world);
    return tree === null ? null : { kind: 'tree', index: tree };
  }

  // Escape puts the block away (after panels, placing and painting have had it).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedBlock !== null && panels.open === null && !placer.active && !paint.active && !build.on) selectBlock(null, null);
  });

  // Shift turns snapping off (desktop).
  let shiftHeld = false;
  const onShift = (e: KeyboardEvent): void => {
    shiftHeld = e.shiftKey;
    placer.setShift(e.shiftKey);
  };
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
    onPress: (screen) => {
      const t = holdTargetAt(screen);
      if (!t) return null;
      if (!dungeon.isActive) {
        marked = screenToWorld(screen, shown);
        pendingBlock = null;
        lakeside.cancel();
      }
      hold.start(t);
      return 'repeat';
    },
    onHoldStill: (screen) => {
      if (dungeon.isActive || selectedBlock === null || holdBusyElsewhere() || room.kind === 'lakeside') return false;
      const { c, r } = cellOf(screenToWorld(screen, shown));
      if (blockInCell(room, c, r) || plantInCell(room, c, r)) return false;
      pendingBlock = null;
      hold.start({ kind: 'line', c, r });
      return true;
    },
    onWalkHold: (screen) => {
      if (dungeon.isActive || selectedBlock !== null || holdBusyElsewhere() || lakeside.fishing || menu.uid !== null) return false;
      if (hold.active) return false;
      walkHold = true;
      walkHoldCell = "";
      pendingBlock = null;
      lakeside.cancel();
      steerWalk(screen);
      return true;
    },
    onHoldMove: (screen) => {
      if (walkHold) {
        steerWalk(screen);
        return;
      }
      if (hold.repeating) {
        const t = holdTargetAt(screen);
        if (t) {
          if (!dungeon.isActive) marked = screenToWorld(screen, shown);
          hold.retarget(t);
        }
        return;
      }
      const last = hold.lastCell;
      if (!last) return;
      const here = cellOf(screenToWorld(screen, shown));
      if (here.c !== last.c || here.r !== last.r) hold.push(cellsBetween(last, here).slice(1));
    },
    onHoldEnd: () => {
      walkHold = false;
      hold.stop();
    },
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
      updateBlockGhost();
      if (kind === 'hover') return;
      // While the line is out every tap on the room is a fishing tap (the bar's ✗ stops).
      if (lakeside.fishing && !placer.active) {
        if (kind === 'tap') {
          if (panels.open !== null) panels.close();
          else lakeside.fishTap();
        }
        return;
      }
      if (paint.active) {
        // Painting floors: a tap paints that cell (a drag paints a rectangle).
        if (kind !== 'tap') return;
        if (panels.open !== null) panels.close();
        else paint.tap(marked);
        return;
      }
      if (placer.active) {
        // Placing a new item: a tap on the room puts it there at once when it fits (else the ghost
        // just goes there, red). No extra ✓ needed.
        if (kind !== 'tap' || placer.moving) return;
        placer.moveTo(marked);
        if (placer.valid) void placer.place();
        return;
      }
      // The placed item under the pointer, found by Pixi's hit testing (item views are 'static').
      const hit = roomItem(itemViews.uidOf(target));
      if (build.on) {
        // Build mode: taps never walk. A tap or long press on an item opens its menu.
        if (kind === 'tap' && panels.open !== null) {
          panels.close();
          return;
        }
        // A tap on an item selects it (again: lets it go). With an item selected, a tap on a
        // free spot moves it there at once; it shakes when it does not fit there.
        if (hit) {
          if (kind === 'tap' && menu.uid === hit.uid) menu.close();
          else openMenu(hit);
          return;
        }
        const chosen = roomItem(menu.uid);
        if (kind !== 'tap' || !chosen) {
          menu.close();
          return;
        }
        void api.moveItem(chosen.uid, { center: marked, facing: chosen.facing, snap: !shiftHeld }).then((next) => {
          if (applyItems(next)) sound.play('pop');
          else itemViews.shake(chosen.uid);
        });
        return;
      }
      // Play mode: a long press does nothing; a tap on the room first closes an open panel.
      if (kind === 'longpress') return;
      if (panels.open !== null) {
        panels.close();
        return;
      }
      // The farm (step 9b): plots (plant, harvest) and the cooking pot.
      pendingBlock = null;
      lakeside.cancel();
      if (blockTap(marked)) return;
      if (farm.tap(marked)) return;
      // The lakeside (step 9f): a tree (swing) or the water (cast).
      if (lakeside.tap(marked)) return;
      // The tavern (step 9t): a guest with an order, coins or a dish on a table, a brewing barrel.
      if (tavernTap(marked, hit)) return;
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
    getDragMode: (target) => {
      if (dungeon.isActive || blockers.on || placer.active || paint.active) return 'draw';
      // Build mode: a drag that starts on an item moves that item (no Move button, no ✓).
      const hit = build.on && panels.open === null ? roomItem(itemViews.uidOf(target)) : undefined;
      if (!hit) return 'pan';
      menu.close();
      placer.startMove(hit.uid);
      return placer.active ? 'draw' : 'pan';
    },
    onDraw: (phase, screen) => {
      const world = screenToWorld(screen, shown);
      if (placer.active) {
        const moved = placer.moving ? placer.uid : null;
        placer.drag(phase, world);
        if (phase !== 'end') return;
        // Letting go puts it down. A moved item that does not fit goes back where it was (and
        // shakes); a new item that does not fit stays in the hand.
        if (placer.valid) {
          void placer.place().then(() => {
            // Refused after all (the room changed meanwhile): back where it was.
            if (placer.active && placer.moving) placer.cancel();
            const item = roomItem(moved);
            if (item) openMenu(item); // still selected: Rotate and Pick up are right there
          });
        } else if (moved !== null) {
          placer.cancel();
          itemViews.shake(moved);
        }
      } else if (paint.active) paint.drag(phase, world);
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
      hold.tick();
      dungeon.frame(ticker.deltaMS);
      return;
    }
    if (hold.active && (panels.open !== null || build.on)) hold.stop();
    hold.tick();
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
    guests.update(ticker.deltaMS, clockMs);
    hops.update(ticker.deltaMS);
    lakeside.update(ticker.deltaMS, clockMs);
    if (path.length === 0 && avatar.state !== 'walk') lakeside.arrived();
    roomFloats.update(ticker.deltaMS, (p) => worldToScreen(p, shown));
    placer.tick(ticker.deltaMS);
    sprite.update(avatar, clockMs);
    // Soft footsteps, one per bob of the walk.
    const beat = Math.floor(clockMs / (WALK_BOB_MS * 2));
    if (avatar.state === 'walk' && beat !== lastStepBeat && sprite.container.visible) sound.play('step');
    lastStepBeat = beat;
    feet.length = 0;
    if (sprite.container.visible && (avatar.state === 'walk' || avatar.state === 'idle')) feet.push(avatar);
    customers.feet(feet);
    guests.feet(feet);
    atmosphere.update(ticker.deltaMS, clockMs, feet);
    view.objects.setKey(sprite.container, avatarDepthKey(avatar, roomItem(seating.seated?.uid ?? null)));
    blockViews.sync(room, Date.now());
    blockViews.update(ticker.deltaMS);
    plantViews.sync(room, Date.now());
    plantViews.update(ticker.deltaMS, clockMs);
    if (pendingBlock && path.length === 0 && avatar.state !== 'walk') {
      const p = pendingBlock;
      pendingBlock = null;
      // A press still held goes on hitting by itself; only a released tap needs this one hit.
      if (!hold.active) void doBlock(p.kind, p.c, p.r, selectedBlock, p.tries);
    }
    view.update();
    // The floating bars and bubbles follow the ghost, the item and the avatar (the camera may move).
    // The ✓ ↻ ✗ bar is only for a new item; an item being dragged is put down by letting go.
    placeBar.update(placer.moving ? null : placer.screenBounds(), placer.valid);
    menu.follow(menu.uid === null ? null : itemViews.screenBounds(menu.uid));
    heads.clear();
    heads.set(avatar.id, worldToScreen({ x: avatar.x, y: avatar.y - AVATAR_H }, shown));
    customers.heads(heads, AVATAR_H);
    guests.heads(heads, AVATAR_H);
    for (const [id, p] of heads) if (id < 0) heads.set(id, worldToScreen(p, shown));
    orders.update(heads);
    bubbles.update(ticker.deltaMS, heads);
    popups.update(heads.get(avatar.id) ?? null);
    gemFly.update(heads.get(avatar.id) ?? null);
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

  await splashGone;
  await openRoom(room.id, !introPending);
  if (introPending) await playNewGameIntro();
  // A run in the save (step 9): back into the dungeon, paused until Resume.
  const saved = await api.getRun();
  if (saved) {
    setDungeonMode(true);
    void dungeon.enter(saved.run, saved.paused);
  }
  if (notice) toast(notice);
}

void start();
