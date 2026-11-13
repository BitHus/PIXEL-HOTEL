import { Application, TextureSource } from 'pixi.js';
import {
  AVATAR_H,
  INTRO_DEVICE_PX_PER_ART_PX,
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
  introZoom,
  itemBlockers,
  roomBoundsRect,
  screenToWorld,
  seatFor,
  snapCamera,
  walkAvatar,
  worldToScreen,
  type Avatar,
  type Camera,
  type FurnitureItem,
  type Inventory,
  type ItemsResult,
  type Point,
  type Pose,
  type Rect,
  type Room,
  type RoomKind,
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
import { typing } from './ui/dom.ts';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  const host = document.getElementById('game');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('#game or #ui element missing');

  // Step 5: the game runs on LocalGameAPI (shared rules in the browser, saved in localStorage).
  const { api, notice } = LocalGameAPI.open(browserStorage());

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

  // Open the room the player was in last (saved).
  const first = await api.enterRoom(await api.currentRoomId());
  let room: Room = first.room;
  let bounds: Rect = roomBoundsRect(room);
  const view = new RoomView();
  app.stage.addChild(view.world);

  // ---------- The own avatar (paths come from the GameAPI; the client animates them) ----------
  const me = first.avatars[0];
  if (!me) throw new Error('no avatar');
  let avatar: Avatar = me;
  /** Points the avatar still has to walk to, and where it was sent (to re-path when the room changes). */
  let path: Point[] = [];
  let goal: Point | null = null;
  /** The seat the avatar is walking to (sits on arrival), and the one it sits on. */
  let seatGoal: { uid: number; pose: Pose } | null = null;
  let seatUid: number | null = null;
  const sprite = new AvatarSprite(avatar.look);
  view.objects.add(sprite.container, avatarDepthKey(avatar));

  /** Starts walking along a path from the API (it starts where the API thinks the avatar is). */
  const follow = (p: Point[]): void => {
    const first = p[0];
    // Only jump when the API's start point is clearly elsewhere (tiny timing differences are walked off).
    if (first && Math.hypot(first.x - avatar.x, first.y - avatar.y) > 8) avatar = { ...avatar, x: first.x, y: first.y };
    path = p.slice(1);
    seatUid = null;
    avatar = { ...avatar, state: path.length > 0 ? 'walk' : 'idle' };
  };
  /** Walks to a world point (the nearest free spot if it is blocked). False if unreachable. */
  const walkTo = async (to: Point): Promise<boolean> => {
    const p = await api.walk(to);
    if (!p) return false;
    follow(p);
    goal = to;
    seatGoal = null;
    return true;
  };
  /** Walks to the front of a sittable item and sits down on arrival. */
  const sitOn = async (uid: number): Promise<boolean> => {
    const r = await api.sit(uid);
    if (!r) return false;
    follow(r.path);
    goal = null;
    seatGoal = { uid, pose: r.seat };
    return true;
  };
  const stop = (): void => {
    path = [];
    seatGoal = null;
    if (avatar.state === 'walk') avatar = { ...avatar, state: 'idle' };
  };

  // ---------- Furniture ----------
  /** The current room's items plus the inventory furniture (the GameAPI's view). */
  let items: FurnitureItem[] = await api.getItems();
  let inventory: Inventory = await api.getInventory();
  const itemViews = new ItemViews(view, room.id);
  const roomItem = (uid: number | null): FurnitureItem | undefined =>
    uid === null ? undefined : items.find((i) => i.uid === uid && i.roomId === room.id);

  const blockers = new BlockersDebug(room, () => {
    api.debugSetBlockers(blockers.rects);
    roomChanged();
  });
  /** Furniture or debug blockers changed: redraw the debug overlay and re-path a walking avatar. */
  const roomChanged = (): void => {
    blockers.showGrid(buildNavGrid(room, [...blockers.rects, ...itemBlockers(items, room.id)]));
    // The seat was moved or picked up: stand up where you are.
    if (seatUid !== null) {
      const seat = roomItem(seatUid);
      const pose = seat && seatFor(seat, getFurnitureType(seat.typeId));
      if (!pose || pose.x !== avatar.x || pose.y !== avatar.y || pose.facing !== avatar.facing) {
        seatUid = null;
        avatar = { ...avatar, state: 'idle' };
      }
    }
    if (seatGoal !== null) {
      const target = seatGoal.uid;
      void sitOn(target).then((ok) => ok || stop());
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
  const info = createInfoPanel(ui, (kind) => void openRoomKind(kind));
  // Play mode (default: taps walk and sit) or build mode (taps open item menus, never walk).
  const build = createBuildMode(ui, {
    onChange: (on) => {
      if (on) return;
      menu.close();
      placer.cancel();
    },
    escapeTaken: () => panels.open !== null || placer.active,
  });
  createSideButtons(ui, panels, [build.button]);

  /** Camera state (unsnapped, so zooming never drifts). */
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole device px. */
  let shown: Camera = camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  let marked: Point | null = null;
  const intro = new CameraIntro();

  const redraw = (): void => {
    shown = snapCamera(camera, dpr());
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
  /** Applies items from the GameAPI (null = refused). */
  const applyItems = (next: ItemsResult): boolean => {
    if (!next) return false;
    items = next;
    itemViews.sync(items, placer.hiddenUids());
    roomChanged();
    void refreshInventory();
    return true;
  };
  const placer: Placer = new Placer(
    {
      getRoom: () => room,
      getItems: () => items,
      commit: async (s, snap) => {
        if (s.uid === null) return false;
        const at = { center: s.center, facing: s.facing, snap };
        return applyItems(s.origin ? await api.moveItem(s.uid, at) : await api.placeItem(s.uid, at));
      },
      onChange: () => {
        itemViews.sync(items, placer.hiddenUids());
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

  /** Starts placing an inventory item of this type in the middle of the screen. */
  const startPlacing = (typeId: string): boolean => {
    if (!fitsRoomKind(getFurnitureType(typeId), room)) {
      toast(`${getFurnitureType(typeId).name} cannot go in the ${room.kind === 'shop' ? 'shop' : 'hotel room'}.`);
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

  async function refreshInventory(): Promise<void> {
    inventory = await api.getInventory();
    const p = await api.getPlayer();
    info.setGold(p.wallet.gold);
    const materials = inventory.materials;
    const usable = (typeId: string): boolean =>
      countInInventory(inventory.furniture, typeId) > 0 && fitsRoomKind(getFurnitureType(typeId), room);
    bag.refresh({
      layout: { hotbar: inventory.hotbar, bag: inventory.bag },
      count: (id) => (isMaterialId(id) ? (materials[id] ?? 0) : countInInventory(inventory.furniture, id)),
      usable,
      gold: p.wallet.gold,
    });
    hotbar.refresh(
      inventory.hotbar.map((typeId) => {
        if (typeId === null) return { typeId, count: 0, usable: false, name: '' };
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
    void api.setLook(next);
  });
  avatarPanel.setLook(avatar.look);
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
    giveTestFurniture: () => {
      void api.debugGiveTestFurniture().then(async () => {
        items = await api.getItems();
        await refreshInventory();
        toast('Test furniture added to the bag.');
      });
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

  // ---------- Rooms ----------
  /** Opens a room: draws it, puts the avatar in the door zone and plays the camera intro. */
  async function openRoom(roomId: number): Promise<void> {
    placer.cancel();
    menu.close();
    bubbles.clear();
    chat.clear();
    const state = await api.enterRoom(roomId);
    room = state.room;
    bounds = roomBoundsRect(room);
    view.setRoom(room);
    itemViews.setRoom(room.id);
    blockers.setRoom(room);
    items = await api.getItems();
    const mine = state.avatars[0];
    if (mine) avatar = { ...mine, look: avatar.look };
    path = [];
    goal = null;
    seatGoal = null;
    seatUid = null;
    marked = null;
    itemViews.sync(items, placer.hiddenUids());
    roomChanged();
    info.setRoom(room.kind);
    await refreshInventory();
    startIntro();
  }
  async function openRoomKind(kind: RoomKind): Promise<void> {
    if (kind === room.kind) return;
    const p = await api.getPlayer();
    await openRoom(kind === 'hotel' ? p.hotelRoomId : p.shopRoomId);
  }

  // Shift turns snapping off (desktop).
  const onShift = (e: KeyboardEvent): void => placer.setShift(e.shiftKey);
  window.addEventListener('keydown', onShift);
  window.addEventListener('keyup', onShift);
  window.addEventListener('blur', () => placer.setShift(false));

  app.stage.hitArea = app.screen;
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => camera,
    setCamera,
    getOverviewZoom: overviewZoom,
    getDevicePixelRatio: dpr,
    onGestureStart: () => intro.cancel(),
    onPoint: (screen, kind, target) => {
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
      // A sittable item: walk there and sit (it shakes if it cannot be reached). Any other item
      // is ignored: walk to the point (a blocked point walks to the nearest free cell).
      if (hit && getFurnitureType(hit.typeId).sittable) {
        void sitOn(hit.uid).then((ok) => ok || itemViews.shake(hit.uid));
        return;
      }
      const to = marked;
      void walkTo(to);
    },
    getDragMode: () => (blockers.on || placer.active ? 'draw' : 'pan'),
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
  app.ticker.add((ticker) => {
    const step = intro.update(ticker.deltaMS, app.screen.width, app.screen.height);
    if (step) setCamera(step.camera, step.done);
    control.update(ticker.deltaMS);
    clockMs += ticker.deltaMS;
    if (avatar.state !== 'sit') ({ avatar, path } = walkAvatar(avatar, path, ticker.deltaMS));
    if (path.length === 0 && seatGoal !== null) {
      const target = roomItem(seatGoal.uid);
      // Arrived in front of the seat: sit on it, facing the way it faces.
      if (target) {
        avatar = { ...avatar, ...seatGoal.pose, state: 'sit' };
        seatUid = target.uid;
      }
      seatGoal = null;
    }
    itemViews.update(ticker.deltaMS);
    sprite.update(avatar, clockMs);
    view.objects.setKey(sprite.container, avatarDepthKey(avatar, roomItem(seatUid)));
    view.update();
    // The floating bars and bubbles follow the ghost, the item and the avatar (the camera may move).
    placeBar.update(placer.screenBounds(), placer.valid);
    menu.follow(menu.uid === null ? null : itemViews.screenBounds(menu.uid));
    heads.set(avatar.id, worldToScreen({ x: avatar.x, y: avatar.y - AVATAR_H }, shown));
    bubbles.update(ticker.deltaMS, heads);
  });

  await openRoom(room.id);
  if (notice) toast(notice);
}

void start();
