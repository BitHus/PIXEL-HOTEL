import { Application, TextureSource } from 'pixi.js';
import {
  AVATAR_START_FROM_BOTTOM,
  PALETTE,
  SIT_REACH_PX,
  getFurnitureType,
  itemBlockers,
  seatFor,
  standPointFor,
  buildNavGrid,
  centerCamera,
  clampCamera,
  createRoom,
  findPath,
  fitZoom,
  roomBoundsRect,
  screenToWorld,
  snapCamera,
  walkAvatar,
  worldToScreen,
  type Avatar,
  type Camera,
  type FurnitureItem,
  type Point,
} from '@pixel-hotel/shared';
import { RoomView } from './render/roomView.ts';
import { createCursorCross } from './render/cursorCross.ts';
import { attachCameraControl } from './input/cameraControl.ts';
import { createDebugLabel } from './ui/debugLabel.ts';
import { AvatarSprite } from './render/avatarSprite.ts';
import { BlockersDebug } from './debug/blockers.ts';
import { createBlockersButton } from './ui/blockersButton.ts';
import { ItemViews } from './render/itemViews.ts';
import { avatarDepthKey } from './render/depthOrder.ts';
import { BuildMode } from './build/buildMode.ts';
import { createBuildPanel } from './ui/buildPanel.ts';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  const host = document.getElementById('game');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('#game or #ui element missing');

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

  // Step 2: a level 1 hotel room, drawn on its own. Later steps load it through GameAPI.
  const room = createRoom(1, 'hotel', 1, 1);
  const bounds = roomBoundsRect(room);
  const view = new RoomView();
  view.setRoom(room);
  app.stage.addChild(view.world);

  // Step 3: one local avatar. Paths come from the shared nav rules (LocalGameAPI arrives later).
  let avatar: Avatar = {
    id: 1,
    name: 'You',
    look: { skin: 30, hair: 5, hairStyle: 0, shirt: 7, legs: 23, shoes: 6 },
    roomId: room.id,
    x: room.w / 2,
    y: room.h - AVATAR_START_FROM_BOTTOM,
    facing: 'up',
    state: 'idle',
  };
  /** Points the avatar still has to walk to, and where it was sent (to re-path when the room changes). */
  let path: Point[] = [];
  let goal: Point | null = null;
  /** The seat the avatar is walking to (sits on arrival), and the one it sits on. */
  let seatGoal: number | null = null;
  let seatUid: number | null = null;
  const sprite = new AvatarSprite(avatar.look);
  view.objects.add(sprite.container, avatarDepthKey(avatar));

  // Step 4: furniture. Kept here until LocalGameAPI arrives; the rules are in shared/furniture.ts.
  let items: FurnitureItem[] = [];
  let lastUid = 0;
  const itemViews = new ItemViews(view, room.id);
  const roomItem = (uid: number | null): FurnitureItem | undefined =>
    uid === null ? undefined : items.find((i) => i.uid === uid && i.roomId === room.id);

  let grid = buildNavGrid(room, []);
  /** Walks to a world point (the nearest free spot if it is blocked). False if unreachable. */
  const walkTo = (to: Point): boolean => {
    const found = findPath(grid, avatar, to);
    if (!found) return false;
    path = found.slice(1);
    goal = to;
    seatUid = null;
    avatar = { ...avatar, state: path.length > 0 ? 'walk' : 'idle' };
    return true;
  };
  /** Walks to the front of a sittable item and sits down on arrival. */
  const sitOn = (item: FurnitureItem): boolean => {
    const front = standPointFor(item, getFurnitureType(item.typeId));
    const found = findPath(grid, avatar, front);
    const end = found?.[found.length - 1];
    if (!found || !end || Math.hypot(end.x - front.x, end.y - front.y) > SIT_REACH_PX) return false;
    walkTo(front);
    seatGoal = item.uid;
    return true;
  };
  const stop = (): void => {
    path = [];
    seatGoal = null;
    if (avatar.state === 'walk') avatar = { ...avatar, state: 'idle' };
  };

  const blockers = new BlockersDebug(room, () => roomChanged());
  /** Furniture or debug blockers changed: rebuild the nav grid and re-path a walking avatar. */
  const roomChanged = (): void => {
    grid = buildNavGrid(room, [...blockers.rects, ...itemBlockers(items, room.id)]);
    blockers.showGrid(grid);
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
      const target = roomItem(seatGoal);
      if (!target || !sitOn(target)) stop();
    } else if (path.length > 0 && goal && !walkTo(goal)) {
      stop();
    }
  };
  blockers.showGrid(grid);
  view.debugLayer.addChild(blockers.container);
  createBlockersButton(ui, { onToggle: (on) => blockers.setOn(on), onClear: () => blockers.clear() });

  const cross = createCursorCross();
  // Only furniture takes part in hit testing: the cross and avatars never hide an item from a tap.
  cross.eventMode = 'none';
  sprite.container.eventMode = 'none';
  app.stage.addChild(cross);
  const label = createDebugLabel(ui);

  /** Camera state (unsnapped, so zooming never drifts). */
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole device px. */
  let shown: Camera = camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  let marked: Point | null = null;

  const redraw = (): void => {
    shown = snapCamera(camera, dpr());
    view.world.scale.set(shown.zoom);
    view.world.position.set(-shown.x * shown.zoom, -shown.y * shown.zoom);
    let text = `zoom ${shown.zoom.toFixed(2)}x  dpr ${dpr()}`;
    if (marked) {
      const s = worldToScreen(marked, shown);
      cross.position.set(Math.floor(s.x), Math.floor(s.y));
      cross.visible = true;
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
  const fit = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    setCamera(centerCamera(w, h, bounds, fitZoom(w, h, bounds)));
  };

  const build: BuildMode = new BuildMode(
    {
      room,
      ownerId: 1,
      getItems: () => items,
      setItems: (next) => {
        items = next;
        itemViews.sync(items, build.hiddenUids());
        roomChanged();
        refreshPanel();
      },
      newUid: () => ++lastUid,
      viewCenter: () => screenToWorld({ x: app.screen.width / 2, y: app.screen.height / 2 }, shown),
      onChange: () => {
        itemViews.sync(items, build.hiddenUids());
        refreshPanel();
      },
    },
    view.ghostLayer,
  );
  const panel = createBuildPanel(ui, {
    onToggle: (on) => {
      build.setOn(on);
      refreshPanel();
    },
    onSelect: (typeId) => build.select(typeId),
    onRotate: () => build.rotate(),
    onPickUp: () => build.pickUp(),
    onCancel: () => build.cancel(),
  });
  function refreshPanel(): void {
    const inventory = new Map<string, number>();
    for (const i of items) if (i.roomId === null) inventory.set(i.typeId, (inventory.get(i.typeId) ?? 0) + 1);
    panel.refresh({ on: build.on, held: build.heldTypeId, canPickUp: build.canPickUp, inventory });
  }
  refreshPanel();
  // Shift turns snapping off (desktop).
  const onShift = (e: KeyboardEvent): void => build.setShift(e.shiftKey);
  window.addEventListener('keydown', onShift);
  window.addEventListener('keyup', onShift);
  window.addEventListener('blur', () => build.setShift(false));

  app.stage.hitArea = app.screen;
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => camera,
    setCamera,
    getOverviewZoom: () => fitZoom(app.screen.width, app.screen.height, bounds),
    getDevicePixelRatio: dpr,
    onPoint: (screen, kind, target) => {
      marked = screenToWorld(screen, shown);
      // The placed item under the pointer, found by Pixi's hit testing (item views are 'static').
      const hit = roomItem(itemViews.uidOf(target));
      if (build.on) {
        if (kind === 'hover') build.hover(marked);
        else build.tap(marked, build.ghostContains(screen), hit?.uid ?? null);
      } else if (kind === 'tap') {
        if (!(hit && getFurnitureType(hit.typeId).sittable && sitOn(hit))) {
          seatGoal = null;
          walkTo(marked);
        }
      }
      redraw();
    },
    getDragMode: () => (blockers.on || (build.on && build.holding) ? 'draw' : 'pan'),
    onDraw: (phase, screen) => {
      const world = screenToWorld(screen, shown);
      if (blockers.on) blockers.draw(phase, world);
      else build.drag(phase, world);
    },
  });

  app.renderer.on('resize', fit);
  // Browser zoom or moving to another monitor changes the device pixel ratio: render at the new one.
  window.addEventListener('resize', () => {
    const next = window.devicePixelRatio || 1;
    if (next !== app.renderer.resolution) app.renderer.resize(window.innerWidth, window.innerHeight, next);
  });
  let clockMs = 0;
  app.ticker.add((ticker) => {
    control.update(ticker.deltaMS);
    clockMs += ticker.deltaMS;
    if (avatar.state !== 'sit') ({ avatar, path } = walkAvatar(avatar, path, ticker.deltaMS));
    const target = roomItem(seatGoal);
    if (path.length === 0 && seatGoal !== null) {
      seatGoal = null;
      if (target) {
        // Arrived in front of the seat: sit on it, facing the way it faces.
        avatar = { ...avatar, ...seatFor(target, getFurnitureType(target.typeId)), state: 'sit' };
        seatUid = target.uid;
      }
    }
    sprite.update(avatar, clockMs);
    view.objects.setKey(sprite.container, avatarDepthKey(avatar, roomItem(seatUid)));
    view.update();
  });
  fit();
}

void start();
