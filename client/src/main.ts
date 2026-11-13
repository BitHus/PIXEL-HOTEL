import { Application, TextureSource } from 'pixi.js';
import {
  PALETTE,
  centerCamera,
  clampCamera,
  createRoom,
  fitZoom,
  roomBoundsRect,
  screenToWorld,
  snapCamera,
  worldToScreen,
  type Camera,
  type Point,
} from '@pixel-hotel/shared';
import { RoomView } from './render/roomView.ts';
import { createCursorCross } from './render/cursorCross.ts';
import { attachCameraControl } from './input/cameraControl.ts';
import { createDebugLabel } from './ui/debugLabel.ts';

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

  const cross = createCursorCross();
  app.stage.addChild(cross);
  const label = createDebugLabel(ui);

  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  /** World point marked by the cross (under the mouse, or the last tap). */
  let marked: Point | null = null;

  const redraw = (): void => {
    view.world.scale.set(camera.zoom);
    view.world.position.set(-camera.x * camera.zoom, -camera.y * camera.zoom);
    let text = `zoom ${camera.zoom}x`;
    if (marked) {
      const s = worldToScreen(marked, camera);
      cross.position.set(Math.floor(s.x), Math.floor(s.y));
      cross.visible = true;
      text = `x ${Math.floor(marked.x)}  y ${Math.floor(marked.y)}\n${text}`;
    }
    label.set(text);
  };

  const setCamera = (cam: Camera): void => {
    camera = snapCamera(clampCamera(cam, app.screen.width, app.screen.height, bounds));
    redraw();
  };

  // Default view: the largest zoom where the whole room fits (at least 1), centered.
  const fit = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    setCamera(centerCamera(w, h, bounds, fitZoom(w, h, bounds)));
  };

  app.stage.hitArea = app.screen;
  attachCameraControl(app.stage, app.canvas, {
    getCamera: () => camera,
    setCamera,
    onPoint: (screen) => {
      marked = screenToWorld(screen, camera);
      redraw();
    },
  });

  app.renderer.on('resize', fit);
  app.ticker.add(() => view.objects.update());
  fit();
}

void start();
