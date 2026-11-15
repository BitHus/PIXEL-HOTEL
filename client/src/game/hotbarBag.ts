// Hotbar and Bag (R1 split of main.ts: part 11 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  countInInventory, fitsRoomKind, isMaterialId, isBlockId, getBlockType, getFurnitureType, getMaterialType, isSeedId,
  type SeedId, DUNGEON_KEY_COST, LEVEL_TOTAL_XP, xpForNextLevel, newEntries,
} from '@pixel-hotel/shared';
import { createHotbar } from '../ui/hotbar.ts';
import { createBagPanel } from '../ui/bagPanel.ts';
import { watchLayout } from '../ui/layoutVars.ts';
import { ROOM_NAMES } from '../ui/infoPanel.ts';
import type { G10 } from './ctx.ts';

export async function setupHotbarBag(g: G10) {
  const {
    toast, menu, placer, viewCenter, build, blockViews, plantViews, syncGrid, ui, panels, api, side, info,
    runBar, newIntro, dungeon, workshop, cooking, book, refreshTravel, dungeonBadge, dungeonButton, paintBar,
    paint, paintableStyles, prefs, catalog, roomPanel, shelfPanel, st, late,
  } = g;
  late.refreshInventory = refreshInventory;

  /** Starts placing an inventory item of this type in the middle of the screen. */
  const startPlacing = (typeId: string): boolean => {
    if (!fitsRoomKind(getFurnitureType(typeId), st.room)) {
      toast(`${getFurnitureType(typeId).name} cannot go in the ${ROOM_NAMES[st.room.kind].toLowerCase()}.`);
      return false;
    }
    menu.close();
    if (!placer.startNew(typeId, viewCenter())) return false;
    build.set(true);
    return true;
  };
late.startPlacing = startPlacing;

  // ---------- Hotbar and Bag ----------
  let selectedSlot: number | null = null;
  /** The block picked in the hotbar (step BG5), or null: then taps on blocks punch them. */
  st.selectedBlock = null;
  /** A block action waiting for the avatar to arrive (the cell was out of reach). */
  st.pendingBlock = null;
  st.pendingStove = null;
  const selectBlock = (id: string | null, slot: number | null): void => {
    st.selectedBlock = id;
    selectedSlot = id === null ? null : slot;
    hotbar.setSelected(selectedSlot);
    if (id === null) {
      blockViews.showGhost(null);
      plantViews.showGhost(null);
    }
    syncGrid();
  };
  const hotbar = createHotbar(ui, {
    onTap: (index) => {
      if (bag.carrying) {
        bag.dropOn({ area: 'hotbar', index });
        return;
      }
      const typeId = st.inventory.hotbar[index];
      if (!typeId) return;
      // Seeds (step BG6): select one; a tap on a free soil cell of your farm plants it (hold to plant a line).
      if (isSeedId(typeId)) {
        const n = st.inventory.materials[typeId] ?? 0;
        const name = getMaterialType(typeId).name;
        if (st.selectedBlock === typeId) {
          selectBlock(null, null);
          toast('Seeds put away.');
        } else if (n === 0) {
          toast(`No ${name} left. Buy seeds in the Catalog (Seeds), or find them in drops and harvests.`);
        } else if (st.room.kind !== 'farm') {
          toast(`${name}: plant it on your farm (Map). Seeds only grow on soil.`);
        } else {
          selectBlock(typeId, index);
          toast(`${name}: tap a soil cell to plant it. Punch a grown plant to harvest it.`);
        }
        return;
      }
      // Blocks (step BG5): select one; a tap on a free cell places it, a tap on a block punches it.
      if (isBlockId(typeId)) {
        const n = st.inventory.materials[typeId] ?? 0;
        const type = getBlockType(typeId);
        if (st.selectedBlock === typeId) {
          selectBlock(null, null);
          toast('Block put away.');
        } else if (n === 0) {
          toast(`No ${type.name} left. Punch blocks to get some back, or buy more in the Catalog (Blocks).`);
        } else if (!type.placeIn.includes(st.room.kind)) {
          toast(`${type.name} cannot go in the ${ROOM_NAMES[st.room.kind].toLowerCase()}.`);
        } else {
          selectBlock(typeId, index);
          toast(`${type.name}: tap a free cell to place it. Tap a block to punch it.`);
        }
        return;
      }
      selectBlock(null, null);
      if (countInInventory(st.inventory.furniture, typeId) === 0) {
        toast(`No ${getFurnitureType(typeId).name} left in the bag.`);
        return;
      }
      selectedSlot = index;
      hotbar.setSelected(index);
      if (startPlacing(typeId)) panels.close();
    },
    onHold: (index) => {
      if (!st.inventory.hotbar[index]) return;
      void api.hotbarToBag(index).then(() => refreshInventory());
      toast('Moved to the bag.');
    },
  });
late.hotbar = hotbar;
  const bag = createBagPanel(ui, {
    onPlace: (typeId) => {
      if (countInInventory(st.inventory.furniture, typeId) === 0) {
        toast(`No ${getFurnitureType(typeId).name} left in the bag.`);
        return;
      }
      const index = st.inventory.hotbar.indexOf(typeId);
      selectedSlot = index >= 0 ? index : selectedSlot;
      hotbar.setSelected(selectedSlot);
      if (startPlacing(typeId)) panels.close();
    },
    onMove: (from, to) => {
      void api.moveSlot(from, to).then((l) => {
        if (!l) toast('That cannot go there.');
        return refreshInventory();
      });
    },
    onTidy: (tab, how) => void api.tidyBag(tab, how).then(() => refreshInventory()),
    onCarry: (on) => hotbar.setChoosing(on),
  });
  panels.add('bag', bag.el, undefined, () => bag.endCarry(), bag.frame);
  // The Bag button sits at the right end of the hotbar (owner, after 9d).
  hotbar.el.appendChild(side.bag);
  // Panels start under the info panel (phone) and end above the hotbar or the run bag.
  watchLayout(ui, info.panel, [hotbar.el, runBar.el]);

  async function refreshInventory(): Promise<void> {
    st.inventory = await api.getInventory();
    const p = await api.getPlayer();
    if (!newIntro.running) {
      info.setGold(p.wallet.gold);
      info.setGems(p.wallet.gems);
    }
    if (st.selectedBlock !== null && (st.inventory.materials[st.selectedBlock as keyof typeof st.inventory.materials] ?? 0) === 0) {
      toast(`Out of ${getMaterialType(st.selectedBlock as SeedId).name}.`);
      selectBlock(null, null);
    }
    if (!dungeon.isActive) info.setStats(p.level, p.xp, xpForNextLevel(p.level), LEVEL_TOTAL_XP[p.level - 1] ?? 0);
    workshop.refresh(p);
    cooking.refresh(p);
    if (panels.open === 'book') book.refresh(p);
    else side.setBookDot(newEntries(p.seen, p.bookOpenedAt).length > 0);
    if (panels.open === 'travel') void refreshTravel();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    dungeonBadge.textContent = free ? 'free' : String(DUNGEON_KEY_COST);
    dungeonButton.title = free ? 'Dungeon: a free run (you have less than 10 gold)' : `Dungeon: the key costs ${DUNGEON_KEY_COST} gold`;
    st.walletGold = p.wallet.gold;
    st.unlockedStyles = p.unlockedStyles;
    paintBar.update(paint.brush, paintableStyles(), prefs.cellGrid);
    catalog.refresh(p.wallet.gold, p.unlockedStyles, st.room, { gems: p.wallet.gems, unlocked: p.unlockedClothing, spares: p.clothingSpares });
    roomPanel.refresh(st.room, p.wallet.gold, p.unlockedStyles, st.room.kind === 'shop' ? st.shop.appeal : null);
    shelfPanel.refresh(st.shop, st.inventory);
    const materials = st.inventory.materials;
    const usable = (typeId: string): boolean =>
      countInInventory(st.inventory.furniture, typeId) > 0 && fitsRoomKind(getFurnitureType(typeId), st.room);
    bag.refresh({
      layout: { hotbar: st.inventory.hotbar, bag: st.inventory.bag },
      count: (id) => (isMaterialId(id) ? (materials[id] ?? 0) : countInInventory(st.inventory.furniture, id)),
      usable,
    });
    hotbar.refresh(
      st.inventory.hotbar.map((typeId) => {
        if (typeId === null) return { typeId, count: 0, usable: false, name: '' };
        if (isSeedId(typeId)) {
          const n = materials[typeId] ?? 0;
          return { typeId, count: n, usable: n > 0 && st.room.kind === 'farm', name: getMaterialType(typeId).name };
        }
        if (isBlockId(typeId)) {
          const n = materials[typeId] ?? 0;
          const type = getBlockType(typeId);
          return { typeId, count: n, usable: n > 0 && type.placeIn.includes(st.room.kind), name: type.name };
        }
        const type = getFurnitureType(typeId);
        const count = countInInventory(st.inventory.furniture, typeId);
        return { typeId, count, usable: count > 0 && fitsRoomKind(type, st.room), name: type.name };
      }),
    );
  }

  return { selectBlock, hotbar, refreshInventory };
}
