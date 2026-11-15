// Placing, floor painting and the item menu (R1 split of main.ts: part 6 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  styleKey, getFurnitureType, kitchenRect, screenToWorld, type Camera, type FurnitureItem, type ItemsResult, type Point,
} from '@pixel-hotel/shared';
import { drawKitchenTint } from '../render/kitchenTint.ts';
import { Placer } from '../build/placer.ts';
import { createPlaceBar } from '../ui/placeBar.ts';
import { createItemMenu } from '../ui/itemMenu.ts';
import { FloorPaint } from '../build/floorPaint.ts';
import { createPaintBar } from '../ui/paintBar.ts';
import { savePrefs } from '../api/prefs.ts';
import type { G5 } from './ctx.ts';

export async function setupPlacing(g: G5) {
  const { itemViews, atmosphere, roomChanged, api, sound, view, cellGrid, kitchenLayer, prefs, ui, storage, app, st, late, panels } = g;

  // ---------- Placing and the item menu ----------
  /** The intro's state: while it runs, the gold and the hint wait, and some items are hidden. */
  const newIntro = { running: false, hidden: new Set<number>() };
  /** Items not drawn now: a moved item (and its riders) while placing, and the intro's items. */
  const hiddenUids = (): Set<number> => new Set([...placer.hiddenUids(), ...newIntro.hidden]);
  /** Draws the items, and their shadows and lights. */
  const syncItems = (): void => {
    const hidden = hiddenUids();
    itemViews.sync(st.items, hidden);
    atmosphere.setItems(st.items, hidden);
    st.onItemsSynced();
  };
  /** Set by the tavern block below: guests, orders and table coins follow the items. */
  st.onItemsSynced = () => {};
  /** What is on screen now (for the intro's coins). */
  const shown0 = (): Camera => st.shown;
  /** Applies items from the GameAPI (null = refused). */
  const applyItems = (next: ItemsResult): boolean => {
    if (!next) return false;
    st.items = next;
    syncItems();
    roomChanged();
    void late.refreshInventory().then(late.refreshHint);
    return true;
  };
  const placer: Placer = new Placer(
    {
      getRoom: () => st.room,
      getItems: () => st.items,
      commit: async (s, snap) => {
        if (s.uid === null) return false;
        const at = { center: s.center, facing: s.facing, snap };
        const ok = applyItems(s.origin ? await api.moveItem(s.uid, at) : await api.placeItem(s.uid, at));
        if (ok) sound.play('pop');
        return ok;
      },
      onChange: () => {
        syncItems();
        late.hotbar.setHidden(placer.active || paint.active);
        syncGrid();
      },
    },
    view.ghostLayer,
  );
late.placer = placer;
  // ---------- Painting floors per cell (step BG1) ----------
  /** The floors the paint bar offers: the farm paints soil and grass (free), other rooms the unlocked floors. */
  const paintableStyles = (): readonly string[] => (st.room.kind === 'farm' ? [styleKey('floor', 'soil'), styleKey('floor', 'grass')] : st.unlockedStyles);
  /** The grid shows while placing or painting (unless it is switched off in Settings). */
  let kitchenKey = '';
  const syncGrid = (): void => {
    cellGrid.visible = prefs.cellGrid && (placer.active || paint.active || st.selectedBlock !== null);
    // The kitchen tint (step T1b) shows with the grid, and while the Room panel is open; redrawn when the room or its level changes.
    const zone = kitchenRect(st.room);
    const key = zone ? `${st.room.id}:${st.room.shape}:${st.room.level}` : '';
    if (key !== kitchenKey) {
      kitchenKey = key;
      drawKitchenTint(kitchenLayer, zone ? [zone] : []);
    }
    kitchenLayer.visible = zone !== null && ((prefs.cellGrid && (placer.active || paint.active)) || panels.open === 'room');
    paintBar.update(paint.brush, paintableStyles(), prefs.cellGrid);
    ui.classList.toggle('painting', paint.active);
  };
  panels.onChange(syncGrid);
  const paint: FloorPaint = new FloorPaint({
    getRoom: () => st.room,
    paint: async (from, to, id) => {
      const next = await api.paintFloor(st.room.id, from, to, id);
      if (!next || next.id !== st.room.id) return false;
      st.room = next;
      view.setRoom(st.room);
      atmosphere.setRoom(st.room);
      sound.play('pop');
      return true;
    },
    onChange: () => {
      late.hotbar.setHidden(placer.active || paint.active);
      syncGrid();
    },
  });
late.paint = paint;
  view.gridLayer.addChild(paint.container);
  const paintBar = createPaintBar(ui, {
    onBrush: (id) => paint.setBrush(id),
    onGrid: () => {
      prefs.cellGrid = !prefs.cellGrid;
      savePrefs(storage, prefs);
      syncGrid();
    },
    onDone: () => paint.end(),
  });
  const viewCenter = (): Point => screenToWorld({ x: app.screen.width / 2, y: app.screen.height / 2 }, st.shown);
  const placeBar = createPlaceBar(ui, {
    onPlace: () => void placer.place(),
    onRotate: () => placer.rotate(),
    onCancel: () => placer.cancel(),
  });
  const menu = createItemMenu(ui, {
    onRotate: (uid) => {
      void api.rotateItem(uid).then((next) => applyItems(next) || itemViews.shake(uid));
    },
    onPickUp: (uid) => {
      menu.close();
      void api.pickUpItem(uid).then(applyItems);
    },
  });
late.menu = menu;
  const openMenu = (item: FurnitureItem): void => menu.open(item.uid, getFurnitureType(item.typeId));

  return { newIntro, syncItems, shown0, applyItems, placer, paintableStyles, syncGrid, paint, paintBar, viewCenter, placeBar, menu, openMenu };
}
