// Furniture, shop and room views (R1 split of main.ts: part 3 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { buildNavGrid, roomBlockers, standUpSpot, type FurnitureItem } from '@pixel-hotel/shared';
import { createCursorCross } from '../render/cursorCross.ts';
import { BlockersDebug } from '../debug/blockers.ts';
import { ItemViews } from '../render/itemViews.ts';
import { BlockViews } from '../render/blockViews.ts';
import { PlantViews } from '../farm/plantViews.ts';
import { CustomerViews } from '../render/customerViews.ts';
import { ItemHops } from '../render/itemHops.ts';
import type { G2 } from './ctx.ts';

export async function setupRoomItems(g: G2) {
  const { api, view, seating, sitOn, stop, walkTo, sprite, app, st } = g;

  // ---------- Furniture ----------
  /** The current room's items plus the inventory furniture (the GameAPI's view). */
  st.items = await api.getItems();
  st.inventory = await api.getInventory();
  const itemViews = new ItemViews(view, st.room.id);
  const blockViews = new BlockViews(view);
  const plantViews = new PlantViews(view);
  /** The shop (goods on the slots, prices, sale history, customers). */
  st.shop = await api.getShop();
  const customers = new CustomerViews(view);
  // Step 9d: items hopping from a slot to a customer's hands, onto the counter and back.
  const hops = new ItemHops(view.markerLayer);
  const roomItem = (uid: number | null): FurnitureItem | undefined =>
    uid === null ? undefined : st.items.find((i) => i.uid === uid && i.roomId === st.room.id);

  const blockers = new BlockersDebug(st.room, () => {
    api.debugSetBlockers(blockers.rects);
    roomChanged();
  });
  /** Furniture or debug blockers changed: redraw the debug overlay and re-path a walking avatar. */
  const roomChanged = (): void => {
    blockers.showGrid(buildNavGrid(st.room, [...blockers.rects, ...roomBlockers(st.room, st.items)]));
    // The seat was moved or picked up: stand up next to it on a free spot (as the GameAPI does).
    const seated = seating.seated;
    if (seated !== null && !seating.stillThere(roomItem(seated.uid))) {
      const grid = buildNavGrid(st.room, [...blockers.rects, ...roomBlockers(st.room, st.items)]);
      st.avatar = seating.standUp(st.avatar, standUpSpot(grid, seated.seat));
    }
    if (seating.goal !== null) {
      const { uid, tap } = seating.goal;
      void sitOn(uid, tap).then((ok) => ok || stop());
    } else if (st.path.length > 0 && st.goal) {
      void walkTo(st.goal).then((ok) => ok || stop());
    }
  };
  view.debugLayer.addChild(blockers.container);

  const cross = createCursorCross();
  // Only furniture takes part in hit testing: the cross and avatars never hide an item from a tap.
  cross.eventMode = 'none';
  sprite.container.eventMode = 'none';
  app.stage.addChild(cross);

  return { itemViews, blockViews, plantViews, customers, hops, roomItem, blockers, roomChanged, cross };
}
