// The read-only ROOM VIEW a visitor gets (PLAN-ONLINE P2). Pure: built from the host's stored GameState, field by field (a whitelist,
// never a spread), so nothing private can ride along: no wallet, inventory, bag, hotbar, ledger, tavern state, run, quests, other rooms,
// account or player ids. Only what is needed to DRAW the room: floor, walls, placed furniture, blocks, plants, the owner's look and display name.

import { cleanDisplayName, roomScore, type AvatarLook, type Facing, type GameState, type Room, type RoomKind } from '@pixel-hotel/shared';

/** Bump when the shape below changes. */
export const ROOM_VIEW_VERSION = 1;

/** The room kinds a visitor may see (PLAN-ONLINE decision 4: OWNER 19 Nov: hotel room only for now, garden and public spaces later, never the tavern). */
export const VISITABLE_KINDS: readonly RoomKind[] = ['hotel']; // owner 19 Nov: online = hotel room, garden (TBD), public spaces; never the tavern

export interface RoomViewItem {
  uid: number;
  typeId: string;
  x: number;
  y: number;
  facing: Facing;
  onItemUid: number | null;
  on?: boolean;
}

export interface RoomViewPlant {
  seed: string;
  plantedAt: number;
  readyAt: number;
  with?: string;
}

export interface RoomView {
  v: number;
  owner: { name: string; look: AvatarLook };
  room: {
    kind: RoomKind;
    level: number;
    shape: string;
    w: number;
    h: number;
    floorStyle: string;
    floorCells: Record<string, string>;
    wallStyle: string;
    /** Block ids per cell, bottom first (key "col,row"). */
    blocks: Record<string, string[]>;
    plants: Record<string, RoomViewPlant>;
  };
  items: RoomViewItem[];
  /** 1 to 5 (shared roomScore). */
  stars: number;
  /** The savedAt of the host's save this view was built from. */
  savedAt: number;
}

const CELL_KEY = /^-?\d{1,4},-?\d{1,4}$/;
const FACINGS: readonly string[] = ['down', 'right', 'up', 'left'];
const ID = /^[a-z0-9_]{1,48}$/i;

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const id = (v: unknown, d = ''): string => (typeof v === 'string' && ID.test(v) ? v : d);

/** Shown when the saved name is missing or has characters a display name may not have. */
export const FALLBACK_NAME = 'Traveller';

function viewLook(l: AvatarLook): AvatarLook {
  const out: AvatarLook = {
    skin: num(l.skin), hair: num(l.hair), hairStyle: id(l.hairStyle), top: id(l.top), shirt: num(l.shirt),
    bottoms: id(l.bottoms), legs: num(l.legs), shoes: num(l.shoes),
  };
  if (id(l.hat)) out.hat = id(l.hat);
  if (id(l.outer)) out.outer = id(l.outer);
  return out;
}

/** The view of one room of a state, or null when the room is not there or its kind cannot be visited. */
export function buildRoomView(state: GameState, roomId: number, savedAt: number): RoomView | null {
  const room: Room | undefined = state.rooms.find((r) => r.id === roomId);
  if (!room || !VISITABLE_KINDS.includes(room.kind)) return null;

  const floorCells: Record<string, string> = {};
  for (const [k, v] of Object.entries(room.floorCells ?? {})) if (CELL_KEY.test(k) && id(v)) floorCells[k] = v;
  const blocks: Record<string, string[]> = {};
  for (const [k, stack] of Object.entries(room.blocks ?? {})) {
    if (!CELL_KEY.test(k) || !Array.isArray(stack)) continue;
    const ids = stack.map((b) => id(b?.id)).filter(Boolean).slice(0, 8);
    if (ids.length) blocks[k] = ids;
  }
  const plants: Record<string, RoomViewPlant> = {};
  for (const [k, p] of Object.entries(room.plants ?? {})) {
    if (!CELL_KEY.test(k) || !p || !id(p.seed)) continue;
    const plant: RoomViewPlant = { seed: p.seed, plantedAt: num(p.plantedAt), readyAt: num(p.readyAt) };
    if (id(p.with)) plant.with = p.with;
    plants[k] = plant;
  }
  const items: RoomViewItem[] = [];
  for (const i of state.items) {
    if (i.roomId !== room.id || !id(i.typeId) || !FACINGS.includes(i.facing)) continue;
    const item: RoomViewItem = { uid: num(i.uid), typeId: i.typeId, x: num(i.x), y: num(i.y), facing: i.facing, onItemUid: typeof i.onItemUid === 'number' ? i.onItemUid : null };
    if (i.on === false) item.on = false;
    items.push(item);
  }
  let stars = 1;
  try {
    stars = Math.min(5, Math.max(1, Math.round(roomScore(room, state.items).stars)));
  } catch {
    // an unknown furniture type in an old save: the room still shows
  }
  return {
    v: ROOM_VIEW_VERSION,
    owner: { name: (typeof state.player.name === 'string' && cleanDisplayName(state.player.name)) || FALLBACK_NAME, look: viewLook(state.look) },
    room: {
      kind: room.kind, level: num(room.level, 1), shape: id(room.shape), w: num(room.w), h: num(room.h),
      floorStyle: id(room.floorStyle), floorCells, wallStyle: id(room.wallStyle), blocks, plants,
    },
    items,
    stars,
    savedAt,
  };
}
