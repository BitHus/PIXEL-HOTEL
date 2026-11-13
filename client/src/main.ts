import { Application, TextureSource } from 'pixi.js';
import {
  AVATAR_START_FROM_BOTTOM,
  PALETTE,
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
  type Point,
} from '@pixel-hotel/shared';
import { RoomView } from './render/roomView.ts';
import { createCursorCross } from './render/cursorCross.ts';
import { attachCameraControl } from './input/cameraControl.ts';
import { createDebugLabel } from './ui/debugLabel.ts';
import { AvatarSprite } from './render/avatarSprite.ts';
import { BlockersDebug } from './debug/blockers.ts';
import { createBlockersButton } from './ui/blockersButton.ts';

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
    resolution: 1,
  });
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
  /** Points the avatar still has to walk to, and where it was sent (to re-path when blockers change). */
  let path: Point[] = [];
  let goal: Point | null = null;
  const sprite = new AvatarSprite(avatar.look);
  view.objects.add(sprite.container, { y: avatar.y, x: avatar.x, uid: avatar.id });

  let grid = buildNavGrid(room, []);
  /** Walks to a world point (the nearest free spot if it is blocked). False if unreachable. */
  const walkTo = (to: Point): boolean => {
    const found = findPath(grid, avatar, to);
    if (!found) return false;
    path = found.slice(1);
    goal = to;
    avatar = { ...avatar, state: path.length > 0 ? 'walk' : 'idle' };
    return true;
  };

  const blockers = new BlockersDebug(room, () => {
    grid = buildNavGrid(room, blockers.rects);
    blockers.showGrid(grid);
    if (path.length > 0 && goal && !walkTo(goal)) {
      path = [];
      avatar = { ...avatar, state: 'idle' };
    }
  });
  blockers.showGrid(grid);
  view.debugLayer.addChild(blockers.container);
  createBlockersButton(ui, { onToggle: (on) => blockers.setOn(on), onClear: () => blockers.clear() });

  const cross = createCursorCross();
  app.stage.addChild(cross);
  const label = createDebugLabel(ui);

  /** Camera state (unsnapped, so zooming never drifts). */
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole screen px. */
  let shown: Camera = camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  let marked: Point | null = null;

  const redraw = (): void => {
    shown = snapCamera(camera);
    view.world.scale.set(shown.zoom);
    view.world.position.set(-shown.x * shown.zoom, -shown.y * shown.zoom);
    let text = `zoom ${shown.zoom.toFixed(2)}x`;
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
    if (snap) camera = snapCamera(camera);
    redraw();
  };

  // Default view: the largest zoom where the whole room fits (ZOOM_MIN to ZOOM_MAX, any value), centered.
  const fit = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    setCamera(centerCamera(w, h, bounds, fitZoom(w, h, bounds)));
  };

  app.stage.hitArea = app.screen;
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => camera,
    setCamera,
    getOverviewZoom: () => fitZoom(app.screen.width, app.screen.height, bounds),
    onPoint: (screen, kind) => {
      marked = screenToWorld(screen, shown);
      if (kind === 'tap') walkTo(marked);
      redraw();
    },
    getDragMode: () => (blockers.on ? 'draw' : 'pan'),
    onDraw: (phase, screen) => blockers.draw(phase, screenToWorld(screen, shown)),
  });

  app.renderer.on('resize', fit);
  let clockMs = 0;
  app.ticker.add((ticker) => {
    control.update(ticker.deltaMS);
    clockMs += ticker.deltaMS;
    ({ avatar, path } = walkAvatar(avatar, path, ticker.deltaMS));
    sprite.update(avatar, clockMs);
    view.objects.setKey(sprite.container, { y: avatar.y, x: avatar.x, uid: avatar.id });
    view.objects.update();
  });
  fit();
}

void start();
