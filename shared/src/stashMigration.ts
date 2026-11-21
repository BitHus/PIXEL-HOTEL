// 3e FOOD STASH, migration 43 -> 44 (SAVE 44). Decided (owner idea 19 Nov, coder 20 Nov; NOTES 3e FOOD STASH):
// 1. An open dish order of an old save took its plate out of the bag at order time; orders take nothing now, so that plate goes back to the
//    bag (else the guest's plate would be lost when the guest leaves or taken twice when served).
// 2. Every tavern gets ONE stash piece unless one already stands in it (a hatch in the bag is used, else a new one, ledger 'tavern_gift'): on the free spot in the
//    kitchen annex nearest to the stove (stashStart.ts stashSpot), else it waits in the bag (dishes are off the menu until it is placed).
// 3. The cooked dishes in the bag that are switched ON on the menu are loaded into the stash (as many as fit), so the menu keeps working at
//    once; other dishes stay in the bag (dungeon lunch food). Drinks, taps and everything else stay as they were.

import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { FOOD_TYPES, isFoodId } from './materials.ts';
import { arrangeState } from './newPlayer.ts';
import { footprintCenter } from './placing.ts';
import { addToStash, stashPieces } from './stash.ts';
import { STASH_PIECE, stashSpot } from './stashStart.ts';
import { menuEntry } from './tavern.ts';
import type { MaterialId } from './types.ts';

export function addFoodStash(state: GameState): GameState {
  const at = state.tavern.updatedAt ?? 0;
  let s: GameState = { ...state, tavern: { ...state.tavern, stash: Array.isArray(state.tavern.stash) ? state.tavern.stash : [] } };
  // 1. The plates open dish orders had taken go back to the bag.
  const back: Partial<Record<MaterialId, number>> = {};
  for (const g of s.tavern.guests ?? []) if (g.phase === 'order' && g.order && isFoodId(g.order.item)) back[g.order.item] = (back[g.order.item] ?? 0) + 1;
  // A dish already on the tray was taken for one of those orders and stays on the tray (it goes to a guest who wants it).
  for (const m of s.tavern.tray ?? []) if (back[m.item] !== undefined) back[m.item] = Math.max(0, back[m.item]! - 1);
  for (const id of Object.keys(back) as MaterialId[]) if (!back[id]) delete back[id];
  if (Object.keys(back).length > 0) s = applyChange(s, { reason: 'tavern_order', materials: back, notFound: { ...back }, note: 'open dish orders: the plates wait in the stash now' }, at) ?? s;
  // 2. A stash piece for the tavern.
  const room = s.rooms.find((r) => r.id === s.tavern.roomId);
  if (room && stashPieces(s.items, room.id).length === 0) {
    // A hatch the player bought before (as decor) and keeps in the bag is used; else the tavern gets one.
    const owned = s.items.find((i) => i.typeId === STASH_PIECE && i.roomId === null);
    const gift = owned ? s : applyChange(s, { reason: 'tavern_gift', addFurniture: [STASH_PIECE], note: 'dishes are served from the serving hatch now' }, at);
    if (gift) {
      const hatch = owned ?? gift.items.find((i) => i.typeId === STASH_PIECE && i.uid >= s.nextUid);
      const stove = gift.items.find((i) => i.roomId === room.id && i.onItemUid === null && getFurnitureType(i.typeId).cooks === true);
      const spot = hatch ? stashSpot(room, gift.items.filter((i) => i.uid !== hatch.uid), stove ? footprintCenter(stove, stove.typeId) : null) : null;
      s = (hatch && spot ? { ...gift, items: gift.items.map((i) => (i.uid === hatch.uid ? { ...i, roomId: room.id, x: spot.x, y: spot.y, facing: spot.facing, onItemUid: null } : i)) } : gift);
    }
  }
  // 3. The dishes on the menu go into the stash.
  for (const f of FOOD_TYPES) {
    const id = f.id as MaterialId;
    if ((s.player.materials[id] ?? 0) <= 0 || !menuEntry(s.tavern, id).on) continue;
    for (let r = addToStash(s, id, at); r; r = addToStash(s, id, at)) s = r.state;
  }
  return arrangeState(s);
}
