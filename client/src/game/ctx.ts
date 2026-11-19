// The shared parts of start(): the mutable state, the late-bound functions, and the type each part sees (R1 split).
// st holds the variables that more than one part changes; late holds what an earlier part calls but a later part defines.

import {
  type Avatar, type Camera, type FurnitureItem, type Inventory, type Point, type Rect, type Room, type RoomKind, type RoomState,
  type TavernView, type EmoteKind, type Bonuses,
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
import type { setupPlaceLife } from './placeLife.ts';
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
  walletGold: number;
  /** MG-7: the stat bonuses of the bought skills (shared/src/skillRules.ts), refreshed with the player (hotbarBag refresh). Undefined = none. */
  skills?: Bonuses;
  unlockedStyles: readonly string[];
  camera: Camera;
  shown: Camera;
  marked: Point | null;
  onItemsSynced: () => void;
  tavern: TavernView;
  seatedGuests: number;
  selectedBlock: string | null;
  pendingBlock: { kind: 'place' | 'hit'; c: number; r: number; tries: number } | null;
  /** A stove the avatar is walking to (step K1): the tap is finished on arrival. */
  pendingStove: number | null;
  /** A brewing barrel the avatar is walking to (step 9t C): the tap is finished on arrival. */
  pendingBarrel: number | null;
  /** A keg rack the avatar is walking to (step K2b): the tap is finished on arrival. */
  pendingCask: number | null;
  /** An Inn door whose spot is the walk goal (step MB-3): the door is used on arrival. */
  pendingDoor: string | null;
  /** The emote being played (step 9g-1; performance.now() times), or none. Cancelled when the avatar moves or sits. */
  emote?: { kind: EmoteKind; startedAt: number; endsAt: number } | null;
  walkHold: boolean;
  /** CAM-LOCK v2 (owner 19 Nov): the 'Look around' toggle in More. While on, a one-finger drag pans the room and no drag walks; walking turns it off. */
  lookAround: boolean;
  walkHoldCell: string;
  shiftHeld: boolean;
}

export interface Late {
  placer: Placer;
  /** Shows or hides the build grid and the kitchen tint (defined in placing.ts). */
  syncGrid: () => void;
  paint: FloorPaint;
  menu: ReturnType<typeof createItemMenu>;
  roomLevel: (id: number) => number;
  travelTo: (place: Place) => Promise<void>;
  refreshHint: () => Promise<void>;
  startPlacing: (typeId: string) => boolean;
  hotbar: ReturnType<typeof createHotbar>;
  refreshInventory: () => Promise<void>;
  avatarPanel: ReturnType<typeof createAvatarPanel>;
  setDungeonMode: (on: boolean) => void;
  enterDungeonAsked: () => Promise<void>;
  enterMineAsked: () => Promise<void>;
  openRoom: (roomId: number, intro?: boolean, arrived?: RoomState) => Promise<void>;
  /** Steps through an Inn door with the room fade (step MB-3). */
  useDoor: (doorId: string) => Promise<boolean>;
  openRoomKind: (kind: RoomKind) => Promise<void>;
  /** ONBOARD-1: Settings > Replay the first steps (set by tavernLife). */
  replayGuide: () => void;
  /** TUT-2: a tutorial step happened that the world cannot prove by itself (plant, harvest, wall piece, fish); set by tavernLife. */
  guideEvent: (step: 'plant' | 'harvest' | 'wall' | 'fish' | 'zoom' | 'holdwalk') => void;
  /** VG-1: shows a one-time hint chip (once per key, per device); false when seen already (set by guideWorld). */
  showHint: (key: string, text: string, at?: () => Point | null) => boolean;
  /** TAP FORGIVENESS: where the shown guests stand (feet, world px); set by tavernLife. */
  guestFeet: () => { id: number; x: number; y: number }[];
  /** CAT HOOK: a tap at a world point; true when it hit the cat (set by gameLoop). */
  catTap: (p: Point) => boolean;
  /** CAM-LOCK v2: turns the Look around toggle on or off (set by uiShell; gameLoop turns it off when the avatar walks). */
  setLookAround: (on: boolean) => void;
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
export type G9 = G8 & Awaited<ReturnType<typeof setupPlaceLife>>;
export type G10 = G9 & Awaited<ReturnType<typeof setupTavernLife>>;
export type G11 = G10 & Awaited<ReturnType<typeof setupHotbarBag>>;
export type G12 = G11 & Awaited<ReturnType<typeof setupSettingsPanels>>;
export type G13 = G12 & Awaited<ReturnType<typeof setupDungeonMode>>;
export type G14 = G13 & Awaited<ReturnType<typeof setupRoomFlow>>;
export type G15 = G14 & Awaited<ReturnType<typeof setupBlockInput>>;
export type G16 = G15 & Awaited<ReturnType<typeof setupPointerInput>>;
export type G17 = G16 & Awaited<ReturnType<typeof setupGameLoop>>;
