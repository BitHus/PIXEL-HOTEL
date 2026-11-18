// Hotbar and Bag (R1 split of main.ts: part 11 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  countInInventory, fitsRoomKind, isMaterialId, isBlockId, getBlockType, getFurnitureType, getMaterialType, isSeedId, PLANT_ROOMS, SEED_HINT,
  type SeedId, bonusesOf, roomScore, DUNGEON_KEY_COST, LEVEL_TOTAL_XP, xpForNextLevel, newEntries,
} from '@pixel-hotel/shared';
import { createHotbar } from '../ui/hotbar.ts';
import { createBagPanel } from '../ui/bagPanel.ts';
import { watchLayout } from '../ui/layoutVars.ts';
import { ROOM_NAMES } from '../ui/infoPanel.ts';
import type { G10 } from './ctx.ts';

/** Walking this long without a stop makes the quest card compact. */
const WALK_COMPACT_MS = 1500;

export async function setupHotbarBag(g: G10) {
  const {
    toast, menu, placer, viewCenter, build, blockViews, plantViews, syncGrid, ui, panels, api, side, info,
    runBar, newIntro, dungeon, workshop, cooking, brewing, book, refreshTravel, dungeonBadge, dungeonButton, paintBar,
    paint, paintableStyles, prefs, catalog, roomPanel, st, late, hint,
  } = g;
  late.refreshInventory = refreshInventory;

  // The quest and first-steps cards shrink to their seal while the avatar keeps walking (UI round 5); a tap opens them again.
  let walkedMs = 0;
  let stoodMs = 0;
  window.setInterval(() => {
    const walking = st.path.length > 0 || st.avatar.state === 'walk';
    walkedMs = walking ? walkedMs + 250 : 0;
    stoodMs = walking ? 0 : stoodMs + 250;
    if (walking && walkedMs === WALK_COMPACT_MS) {
      hint.setCompact(true);
      ui.classList.add('walk-compact'); // skin.css: the first-steps card drops its text too
    }
    if (stoodMs === WALK_COMPACT_MS * 2) ui.classList.remove('walk-compact');
  }, 250);

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
  st.pendingBarrel = null;
  st.pendingCask = null;
  st.pendingDoor = null;
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
      if (!typeId) {
        // An empty slot is selectable (G2): it shows the selected frame and puts away what was selected.
        selectBlock(null, null);
        selectedSlot = index;
        hotbar.setSelected(index);
        return;
      }
      // Seeds (step BG6): select one; a tap on a free soil cell of your farm plants it (hold to plant a line).
      if (isSeedId(typeId)) {
        const n = st.inventory.materials[typeId] ?? 0;
        const name = getMaterialType(typeId).name;
        if (st.selectedBlock === typeId) {
          selectBlock(null, null);
          toast('Seeds put away.');
        } else if (n === 0) {
          toast(`No ${name} left. Buy seeds in the Catalog (Seeds), or find them in drops and harvests.`);
        } else if (!(PLANT_ROOMS as readonly string[]).includes(st.room.kind)) {
          toast(`${name}: plant it in your hotel, tavern or farm (Map).`);
        } else {
          selectBlock(typeId, index);
          // SG4b: the first time a seed is selected, a chip says where it goes (later: the short toast only).
          if (!late.showHint(SEED_HINT.key, SEED_HINT.text)) toast(`${name}: tap soil or a block to plant it. Punch a grown plant to harvest it.`);
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

  /** What the bag holds, by id, for the catalog's "Own N" badge (unplaced furniture and materials). */
  const bagCounts = (): Record<string, number> => {
    const out: Record<string, number> = { ...st.inventory.materials } as Record<string, number>;
    for (const f of st.inventory.furniture) out[f.typeId] = (out[f.typeId] ?? 0) + 1;
    return out;
  };

  async function refreshInventory(): Promise<void> {
    st.inventory = await api.getInventory();
    const p = await api.getPlayer();
    st.tavern = { ...st.tavern, appeal: (await api.getTavern()).appeal };
    if (!newIntro.running) {
      info.setGold(p.wallet.gold);
      info.setGems(p.wallet.gems);
    }
    info.setInnName(p.innName);
    if (st.selectedBlock !== null && (st.inventory.materials[st.selectedBlock as keyof typeof st.inventory.materials] ?? 0) === 0) {
      toast(`Out of ${getMaterialType(st.selectedBlock as SeedId).name}.`);
      selectBlock(null, null);
    }
    if (!dungeon.isActive) info.setStats(p.level, p.xp, xpForNextLevel(p.level), LEVEL_TOTAL_XP[p.level - 1] ?? 0);
    workshop.refresh(p);
    cooking.refresh(p);
    brewing.refresh(p.materials);
    if (panels.open === 'book') book.refresh(p);
    else side.setBookDot(newEntries(p.seen, p.bookOpenedAt).length > 0);
    if (panels.open === 'travel') void refreshTravel();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    dungeonBadge.textContent = free ? 'free' : String(DUNGEON_KEY_COST);
    dungeonButton.title = free ? 'Dungeon: a free run (you have less than 10 gold)' : `Dungeon: the key costs ${DUNGEON_KEY_COST} gold`;
    st.walletGold = p.wallet.gold;
    st.skills = bonusesOf(p);
    st.unlockedStyles = p.unlockedStyles;
    paintBar.update(paint.brush, paintableStyles(), prefs.cellGrid);
    catalog.refresh(p.wallet.gold, p.unlockedStyles, st.room, { gems: p.wallet.gems, unlocked: p.unlockedClothing, spares: p.clothingSpares, owned: bagCounts() });
    roomPanel.refresh(st.room, p.wallet.gold, p.unlockedStyles, st.room.kind === 'shop' ? st.tavern.appeal : null, st.room.kind === 'hotel' ? roomScore(st.room, st.items) : null, { tavernId: p.shopRoomId, cellarId: p.cellarRoomId, playerLevel: p.level });
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
