// OA-6: the extended bar. Bar extension pieces (type.barExtension, one cell, surface) must touch the counter or another piece in a straight
// line with the same facing: along the bar's long side (left/right for a bar facing down or up, above/below for right or left).
// A piece that would be cut off from the counter is not allowed, so the counter cannot be moved and a middle piece cannot be picked up
// or moved while others hang on it. Pure, no rendering.

import { footprintRect, getFurnitureType } from './furniture.ts';
import type { Facing, FurnitureItem, FurnitureType, Rect } from './types.ts';

type Bar = Pick<FurnitureItem, 'typeId' | 'x' | 'y' | 'facing' | 'roomId' | 'onItemUid'>;
type Lookup = (typeId: string) => FurnitureType;

function touchesInLine(r: Rect, m: Rect, facing: Facing): boolean {
  if (facing === 'down' || facing === 'up') return r.y === m.y && r.h === m.h && (m.x + m.w === r.x || r.x + r.w === m.x);
  return r.x === m.x && r.w === m.w && (m.y + m.h === r.y || r.y + r.h === m.y);
}

/** True if every bar extension piece of the room is joined to a counter through pieces of the same facing in a straight line. */
export function barExtensionsConnected(items: readonly Bar[], roomId: number, types: Lookup = getFurnitureType): boolean {
  const floor = items.filter((i) => i.roomId === roomId && i.onItemUid === null);
  const connected: { rect: Rect; facing: Facing }[] = floor
    .filter((i) => types(i.typeId).servedFromBehind === true)
    .map((i) => ({ rect: footprintRect(i, types(i.typeId)), facing: i.facing }));
  let pending = floor.filter((i) => types(i.typeId).barExtension === true);
  let grew = true;
  while (grew && pending.length > 0) {
    grew = false;
    const next: Bar[] = [];
    for (const p of pending) {
      const r = footprintRect(p, types(p.typeId));
      if (connected.some((c) => c.facing === p.facing && touchesInLine(r, c.rect, p.facing))) {
        connected.push({ rect: r, facing: p.facing });
        grew = true;
      } else next.push(p);
    }
    pending = next;
  }
  return pending.length === 0;
}

/** The bar pieces of a room (counter and extensions) after `item` is added: used by canPlace for the counter and the pieces. */
export function isBarPiece(type: FurnitureType): boolean {
  return type.servedFromBehind === true || type.barExtension === true;
}

/** True if taking `uid` away (picked up) leaves every other piece joined. Non-bar items always pass. */
export function canRemoveBarPiece(items: readonly FurnitureItem[], uid: number, types: Lookup = getFurnitureType): boolean {
  const item = items.find((i) => i.uid === uid);
  if (!item || item.roomId === null || !isBarPiece(types(item.typeId))) return true;
  return barExtensionsConnected(items.filter((i) => i.uid !== uid), item.roomId, types);
}
