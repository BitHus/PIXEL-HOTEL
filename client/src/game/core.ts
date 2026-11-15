// Boot: storage, API, new-game setup, the Pixi app, the room view (R1 split of main.ts: part 1 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { Application } from 'pixi.js';
import { PALETTE, roomBoundsRect } from '@pixel-hotel/shared';
import { LocalGameAPI } from '../api/localGameAPI.ts';
import { browserStorage } from '../api/saveStorage.ts';
import { RoomView } from '../render/roomView.ts';
import { runNewGameSetup } from '../ui/newGame.ts';
import { applyRankColors } from '../ui/rank.ts';
import { RoomAtmosphere } from '../render/roomAtmosphere.ts';
import { CellGrid } from '../render/cellGrid.ts';
import { Backdrop } from '../render/backdrop.ts';
import { Sound } from '../audio/sound.ts';
import { loadPrefs } from '../api/prefs.ts';
import { runSplash } from '../ui/splash.ts';
import type { G0 } from './ctx.ts';

export async function setupCore(g: G0) {
  const { st } = g;

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
  st.introPending = false;
  if (await api.needsNewPlayer()) {
    await splashGone;
    for (;;) {
      const choice = await runNewGameSetup(ui);
      if (await api.createPlayer(choice)) break;
    }
    st.introPending = true;
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
  const first = await api.enterRoom(st.introPending ? (await api.getPlayer()).shopRoomId : await api.currentRoomId());
  st.room = first.room;
  st.bounds = roomBoundsRect(st.room);
  const view = new RoomView();
  // The faint build grid (step BG1): shown while placing furniture or painting floors.
  const cellGrid = new CellGrid();
  view.gridLayer.addChild(cellGrid.container);
  cellGrid.setRoom(st.room);
  // Atmosphere step: the dark planks outside the room, then the room with its shadows and light.
  const backdrop = new Backdrop(app.renderer);
  app.stage.addChild(backdrop.container, view.world);
  const atmosphere = new RoomAtmosphere(view, app.renderer);
  atmosphere.setLighting(prefs.lighting);
  // Lighting off (slow phones): no backdrop either, so nothing extra is drawn.
  st.lightingOn = prefs.lighting;
  backdrop.container.visible = st.lightingOn;

  return { splashGone, ui, uiRoot, storage, api, notice, prefs, sound, app, dpr, first, view, cellGrid, backdrop, atmosphere };
}
