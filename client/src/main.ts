// Pixel Hotel: the entry point. start() only wires the game: each part in client/src/game/ runs once, in
// order, and hands what the later parts need on (the order and the shared types are in game/ctx.ts).
import { TextureSource } from 'pixi.js';
import './ui/ui.css';
import './ui/skin.css';
import './ui/fishingUi.css';
import './ui/sizes.css';
import './ui/layout.ts';
import type { G0, Late, State } from './game/ctx.ts';
import { setupCore } from './game/core.ts';
import { setupAvatarWalk } from './game/avatarWalk.ts';
import { setupRoomItems } from './game/roomItems.ts';
import { setupUiShell } from './game/uiShell.ts';
import { setupCameraSetup } from './game/cameraSetup.ts';
import { setupPlacing } from './game/placing.ts';
import { setupShopPanels } from './game/shopPanels.ts';
import { setupCraftPanels } from './game/craftPanels.ts';
import { setupPlaceLife } from './game/placeLife.ts';
import { setupTavernLife } from './game/tavernLife.ts';
import { setupHotbarBag } from './game/hotbarBag.ts';
import { setupSettingsPanels } from './game/settingsPanels.ts';
import { setupDungeonMode } from './game/dungeonMode.ts';
import { setupRoomFlow } from './game/roomFlow.ts';
import { setupBlockInput } from './game/blockInput.ts';
import { setupPointerInput } from './game/pointerInput.ts';
import { setupGameLoop } from './game/gameLoop.ts';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  const g0: G0 = { st: {} as State, late: {} as Late };
  const g1 = { ...g0, ...(await setupCore(g0)) };
  const g2 = { ...g1, ...(await setupAvatarWalk(g1)) };
  const g3 = { ...g2, ...(await setupRoomItems(g2)) };
  const g4 = { ...g3, ...(await setupUiShell(g3)) };
  const g5 = { ...g4, ...(await setupCameraSetup(g4)) };
  const g6 = { ...g5, ...(await setupPlacing(g5)) };
  const g7 = { ...g6, ...(await setupShopPanels(g6)) };
  const g8 = { ...g7, ...(await setupCraftPanels(g7)) };
  const g9 = { ...g8, ...(await setupPlaceLife(g8)) };
  const g10 = { ...g9, ...(await setupTavernLife(g9)) };
  const g11 = { ...g10, ...(await setupHotbarBag(g10)) };
  const g12 = { ...g11, ...(await setupSettingsPanels(g11)) };
  const g13 = { ...g12, ...(await setupDungeonMode(g12)) };
  const g14 = { ...g13, ...(await setupRoomFlow(g13)) };
  const g15 = { ...g14, ...(await setupBlockInput(g14)) };
  const g16 = { ...g15, ...(await setupPointerInput(g15)) };
  const g17 = { ...g16, ...(await setupGameLoop(g16)) };
}

void start();
