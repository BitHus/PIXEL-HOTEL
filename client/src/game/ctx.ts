// The shared parts of start(): the mutable state, the late-bound functions, and the type each part sees (R1 split).
// st holds the variables that more than one part changes; late holds what an earlier part calls but a later part defines.

import {
  type Avatar, type Camera, type FurnitureItem, type Inventory, type Point, type Rect, type Room, type RoomKind,
  type ShopView, type TavernView,
} from '@pixel-hotel/shared';
import type { Placer } from '../build/placer.ts';
import type { createItemMenu } from '../ui/itemMenu.ts';
import type { createHotbar } from '../ui/hotbar.ts';
import type { createAvatarPanel } from '../ui/avatarPanel.ts';
import type { Place } from '../ui/travelPanel.ts';
import type { FloorPaint } from '../build/floorPaint.ts';
import type { setupCore } from './core.ts';
import type { setupAvatarWalk } from './avatarWalk.ts';
import type { setupRoomItems } from './roomItems.ts';
import type { setupUiShell } from './uiShell.ts';
import type { setupCameraSetup } from './cameraSetup.ts';
import type { setupPlacing } from './placing.ts';
import type { setupShopPanels } from './shopPanels.ts';
import type { setupCraftPanels } from './craftPanels.ts';
import type { setupShopLife } from './shopLife.ts';
import type { setupTavernLife } from './tavernLife.ts';
import type { setupHotbarBag } from './hotbarBag.ts';
import type { setupSettingsPanels } from './settingsPanels.ts';
import type { setupDungeonMode } from './dungeonMode.ts';
import type { setupRoomFlow } from './roomFlow.ts';
import type { setupBlockInput } from './blockInput.ts';
import type { setupPointerInput } from './pointerInput.ts';
import type { setupGameLoop } from './gameLoop.ts';

export interface State {
  introPending: boolean;
  room: Room;
  bounds: Rect;
  lightingOn: boolean;
  avatar: Avatar;
  path: Point[];
  goal: Point | null;
  serving: { state: 'walking' | 'there'; facing: Avatar['facing'] } | null;
  items: FurnitureItem[];
  inventory: Inventory;
  shop: ShopView;
  walletGold: number;
  unlockedStyles: readonly string[];
  camera: Camera;
  shown: Camera;
  marked: Point | null;
  onItemsSynced: () => void;
  shopCustomers: ShopView['customers'];
  tavern: TavernView;
  seatedGuests: number;
  selectedBlock: string | null;
  pendingBlock: { kind: 'place' | 'hit'; c: number; r: number; tries: number } | null;
  walkHold: boolean;
  walkHoldCell: string;
  shiftHeld: boolean;
}

export interface Late {
  placer: Placer;
  paint: FloorPaint;
  menu: ReturnType<typeof createItemMenu>;
  roomLevel: (id: number) => number;
  travelTo: (place: Place) => Promise<void>;
  refreshShop: () => Promise<void>;
  refreshHint: () => Promise<void>;
  startPlacing: (typeId: string) => boolean;
  hotbar: ReturnType<typeof createHotbar>;
  refreshInventory: () => Promise<void>;
  avatarPanel: ReturnType<typeof createAvatarPanel>;
  setDungeonMode: (on: boolean) => void;
  enterDungeonAsked: () => Promise<void>;
  enterMineAsked: () => Promise<void>;
  openRoom: (roomId: number, intro?: boolean) => Promise<void>;
  openRoomKind: (kind: RoomKind) => Promise<void>;
}

/** What main.ts starts with. */
export interface G0 {
  st: State;
  late: Late;
}
export type G1 = G0 & Awaited<ReturnType<typeof setupCore>>;
export type G2 = G1 & Awaited<ReturnType<typeof setupAvatarWalk>>;
export type G3 = G2 & Awaited<ReturnType<typeof setupRoomItems>>;
export type G4 = G3 & Awaited<ReturnType<typeof setupUiShell>>;
export type G5 = G4 & Awaited<ReturnType<typeof setupCameraSetup>>;
export type G6 = G5 & Awaited<ReturnType<typeof setupPlacing>>;
export type G7 = G6 & Awaited<ReturnType<typeof setupShopPanels>>;
export type G8 = G7 & Awaited<ReturnType<typeof setupCraftPanels>>;
export type G9 = G8 & Awaited<ReturnType<typeof setupShopLife>>;
export type G10 = G9 & Awaited<ReturnType<typeof setupTavernLife>>;
export type G11 = G10 & Awaited<ReturnType<typeof setupHotbarBag>>;
export type G12 = G11 & Awaited<ReturnType<typeof setupSettingsPanels>>;
export type G13 = G12 & Awaited<ReturnType<typeof setupDungeonMode>>;
export type G14 = G13 & Awaited<ReturnType<typeof setupRoomFlow>>;
export type G15 = G14 & Awaited<ReturnType<typeof setupBlockInput>>;
export type G16 = G15 & Awaited<ReturnType<typeof setupPointerInput>>;
export type G17 = G16 & Awaited<ReturnType<typeof setupGameLoop>>;
