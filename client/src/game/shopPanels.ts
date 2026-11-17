// Pack, catalog and room panels (R1 split of main.ts: part 7 of 17; the shelf panel went in step S1).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  STYLE_TYPES, styleKey, fitsRoomKind, getBlockType, blockPrice, getFurnitureType, catalogPrice, getStyle,
  stylePrice, upgradeCost, hatCatalogPrice, getMaterialType, CROP_TYPES, getClothing, SLOT_FIELD, type Room, type StyleKind,
  BLOCK_PACK, SEED_PACK, CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL,
} from '@pixel-hotel/shared';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { createPackFlow } from '../ui/packOpening.ts';
import { clothingIconUrl, furnitureIconUrl, materialIconUrl } from '../ui/itemIcon.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';
import { WHERE, createCatalogPanel, growText } from '../ui/catalogPanel.ts';
import { createRoomPanel } from '../ui/roomPanel.ts';
import { type Place } from '../ui/travelPanel.ts';
import { ROOM_NAMES } from '../ui/infoPanel.ts';
import type { G6 } from './ctx.ts';

export async function setupShopPanels(g: G6) {
  const {
    ui, api, toast, panels, popups, sprite, dungeon, placer, view, atmosphere, paintableStyles, build, paint,
    st, late,
  } = g;

  // ---------- Catalog and room panels (step 7) ----------
  // Packs (step BG8): ask, pop, popups, toast with "Wear it".
  const packFlow = createPackFlow({
    ui,
    api,
    popups,
    toast,
    wear: (id) => {
      const c = getClothing(id);
      if (!c) return;
      const look = { ...st.avatar.look, [SLOT_FIELD[c.slot]]: id };
      st.avatar = { ...st.avatar, look };
      sprite.setLook(look);
      dungeon.setLook(look);
      void api.setLook(look);
      void api.getPlayer().then((p) => late.avatarPanel.setLook(look, p.unlockedClothing));
    },
    refresh: async () => {
      await late.refreshInventory();
      late.avatarPanel.setLook(st.avatar.look, (await api.getPlayer()).unlockedClothing);
    },
  });
  const catalog = createCatalogPanel(ui, {
    buyItem: async (typeId) => {
      const t = getFurnitureType(typeId);
      const sure = await confirmBuy(ui, { name: t.name, detail: `Goes into your bag. For ${WHERE[t.placeIn]}.`, price: catalogPrice(typeId), image: furnitureIconUrl(typeId), gold: st.walletGold });
      if (!sure) return;
      void api.buyCatalog(typeId).then(async (r) => {
        if (!r) {
          toast('Not enough gold.');
          return;
        }
        popups.show(r.gains);
        st.items = await api.getItems();
        await late.refreshInventory();
        await late.refreshHint();
        const type = getFurnitureType(typeId);
        // The first purchase of a new game goes straight into placing, with a pop.
        if (r.first && fitsRoomKind(type, st.room)) {
          panels.close();
          if (late.startPlacing(typeId)) placer.pop();
          return;
        }
        toast(`${type.name} is in your bag.`);
      });
    },
    buySeeds: async (seed) => {
      const m = getMaterialType(seed);
      const crop = CROP_TYPES.find((c) => c.seed === seed);
      const price = crop?.seedPrice ?? 0;
      const detail = crop ? `Plant it in the soil of your farm: fully grown in ${growText(crop)}, then punch it. The crop is worth ${crop.baseValue}.` : 'Plant it in the soil of your farm.';
      const sure = await confirmBuy(ui, {
        name: m.name,
        detail,
        price,
        image: materialIconUrl(seed),
        gold: st.walletGold,
        title: 'Buy this?',
        yes: 'Buy 1',
        more: { label: `Buy ${SEED_PACK}`, price: price * SEED_PACK },
      });
      if (!sure) return;
      const qty = sure === 'more' ? SEED_PACK : 1;
      const ok = await api.buySeeds(seed, qty);
      if (ok) popups.show(ok);
      toast(ok ? `${m.name}: ${qty} in your ${st.inventory.hotbar.includes(seed) || !st.inventory.bag.materials.includes(seed) ? 'hotbar' : 'bag'}. Select it in the hotbar and tap soil on your farm.` : 'Not enough gold.');
      await late.refreshInventory();
    },
    buyBlock: async (id) => {
      const b = getBlockType(id);
      const price = blockPrice(id);
      const sure = await confirmBuy(ui, {
        name: b.name,
        detail: `Place it in a free cell of your rooms. ${b.hardness} punch${b.hardness === 1 ? '' : 'es'} to break; it comes back to your bag.`,
        price,
        image: materialIconUrl(b.id),
        gold: st.walletGold,
        title: 'Buy this?',
        yes: 'Buy 1',
        more: { label: `Buy ${BLOCK_PACK}`, price: price * BLOCK_PACK },
      });
      if (!sure) return;
      const qty = sure === 'more' ? BLOCK_PACK : 1;
      const got = await api.buyBlocks(id, qty);
      if (got) popups.show(got);
      toast(got ? `${b.name}: ${qty} in your bag. Put it in the hotbar, then tap a free cell.` : 'Not enough gold.');
      await late.refreshInventory();
    },
    buyHat: async (id) => {
      const h = getClothing(id);
      const price = hatCatalogPrice(id);
      if (!h || price === null) return;
      const sure = await confirmBuy(ui, { name: h.name, detail: 'A hat: yours forever. Wear it in the Avatar panel.', price, image: clothingIconUrl(id), gold: st.walletGold });
      if (!sure) return;
      const ok = await api.buyHat(id);
      toast(ok ? `${h.name}: wear it in the Avatar panel.` : 'Not enough gold.');
      await late.refreshInventory();
      late.avatarPanel.setLook(st.avatar.look, (await api.getPlayer()).unlockedClothing);
    },
    openPack: (pack) => void packFlow.open(pack),
    sellSpare: (id) => void packFlow.sell(id),
    buyStyle: async (kind, id) => {
      const s = getStyle(kind, id);
      const detail = `${kind === 'floor' ? 'Floor' : 'Wall'}: yours forever, put on this room now.`;
      const sure = await confirmBuy(ui, { name: s.name, detail, price: stylePrice(s), image: stylePreviewUrl(kind, id), gold: st.walletGold });
      if (!sure) return;
      void api.buyStyle(kind, id).then(async (ok) => {
        if (!ok) {
          toast('Not enough gold.');
          return;
        }
        // A bought floor or wall goes straight onto the room you are in (free to change back in
        // the Room panel).
        const next = await api.applyStyle(st.room.id, kind, id);
        if (next && next.id === st.room.id) {
          st.room = next;
          view.setRoom(st.room);
          atmosphere.setRoom(st.room);
        }
        toast(`Your new ${kind} is on! Switch it any time in the Room panel.`);
        await late.refreshInventory();
        await late.refreshHint();
      });
    },
  });
  panels.add('catalog', catalog.el);
  const roomPanel = createRoomPanel(ui, {
    upgrade: async (roomId) => {
      const r = roomId === st.room.id ? st.room : null;
      const cost = r ? upgradeCost(r) : null;
      if (r && cost !== null) {
        const detail = `${ROOM_NAMES[r.kind]} to level ${r.level + 1}: ${r.kind === 'farm' ? 'more room and more plots' : 'the room grows'}.`;
        if (!(await confirmBuy(ui, { name: 'Room upgrade', detail, price: cost, yes: 'Upgrade', gold: st.walletGold }))) return;
      }
      void api.upgradeRoom(roomId).then(async (next) => {
        if (!next) {
          toast('Not enough gold.');
          return;
        }
        toast(`Upgraded to level ${next.level}!`);
        await late.openRoom(next.id, false);
      });
    },
    openRoom: (roomId) => {
      panels.close();
      void late.openRoom(roomId, false);
    },
    buildCellar: async () => {
      if (!(await confirmBuy(ui, { name: 'The cellar', detail: `A cool room under the tavern. It comes with one keg rack: mugs you leave there ripen and sell for more. Up to ${CELLAR_RACK_MAX_BY_LEVEL[0]} racks at first.`, price: CELLAR_BUILD_COST, yes: 'Build', gold: st.walletGold }))) return;
      const room = await api.buildCellar();
      if (!room) {
        toast('The cellar cannot be built yet.');
        return;
      }
      toast('Your cellar is built. The door is in the back wall of the tavern.');
      await late.refreshInventory();
      await late.openRoom(room.id, false);
    },
    startPaint: () => {
      // The brush starts as the first unlocked floor that is not the room's own (painting the room's
      // own floor erases the paint).
      const own = st.room.floorStyle;
      const floors = STYLE_TYPES.filter((x) => x.kind === 'floor' && paintableStyles().includes(styleKey('floor', x.id))).map((x) => x.id);
      const brush = floors.find((id) => id !== own) ?? own;
      panels.close();
      build.set(false);
      paint.start(brush);
    },
    applyStyle: (roomId, kind: StyleKind, id) => {
      void api.applyStyle(roomId, kind, id).then(async (next) => {
        if (!next) return;
        if (next.id === st.room.id) {
          st.room = next;
          view.setRoom(st.room);
          atmosphere.setRoom(st.room);
        }
        await late.refreshInventory();
      });
    },
  });
  panels.add('room', roomPanel.el);

  return { catalog, roomPanel };
}
