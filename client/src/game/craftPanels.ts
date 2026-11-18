// Workshop, Book, lakeside and the travel panel (R1 split of main.ts: part 8 of 17). The Cooking panel moved to the tavern part (step K1).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  getMaterialType, MINE_UNLOCK_LEVEL, MINE_LANTERN_MS, type Room, DUNGEON_KEY_COST,
} from '@pixel-hotel/shared';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { createWorkshopPanel, gearEffect, pieceEffect, recipeName } from '../ui/workshopPanel.ts';
import { LakesideScreen } from '../lakeside/lakesideScreen.ts';
import { createFishBar } from '../ui/fishBar.ts';
import { flashScreen } from '../ui/runScreens.ts';
import { FloatTexts } from '../dungeon/floatTexts.ts';
import { createBookPanel } from '../ui/bookPanel.ts';
import { createSkillsPanel } from '../ui/skillsPanel.ts';
import { createQuestPanel } from '../ui/questPanel.ts';
import '../ui/quests.css';
import { createTravelPanel, type PlaceCard } from '../ui/travelPanel.ts';
import type { G7 } from './ctx.ts';

export async function setupCraftPanels(g: G7) {
  const { ui, prefs, api, questButton, popups, toast, panels, sound, side, view, walkTo, follow, sprite, flyGems, st, late } = g;

  // ---------- Workshop: crafting and the Blacksmith (step 9) ----------
  const workshop = createWorkshopPanel(ui, {
    craft: (recipe) => {
      void api.craft(recipe.id).then(async (ok) => {
        if (ok) popups.show(ok);
        toast(ok ? `Made: ${recipeName(recipe)}.${recipe.makesKind === 'furniture' ? ' It is in your bag.' : ' Pick it in the Room panel.'}` : 'You need more materials.');
        st.items = await api.getItems();
        await late.refreshInventory();
      });
    },
    buy: async (gear) => {
      if (!(await confirmBuy(ui, { name: gear.name, detail: gearEffect(gear), price: gear.price }))) return;
      const ok = await api.buyGear(gear.id);
      if (ok) popups.show(ok);
      toast(ok ? `${gear.name}: yours.` : 'Not enough gold.');
      await late.refreshInventory();
    },
    // The Forge (step 9c).
    smelt: (bar) => {
      void api.smelt(bar).then(async (ok) => {
        if (ok) popups.show(ok);
        toast(ok ? `Smelted: ${getMaterialType(bar).name}.` : 'You need 3 ore and the fee.');
        await late.refreshInventory();
      });
    },
    forge: async (piece) => {
      const detail = `${pieceEffect(piece)} It replaces what you have now. Uses ${Object.entries(piece.bars)
        .map(([b, n]) => `${n} ${getMaterialType(b as never).name}`)
        .join(' and ')}.`;
      if (!(await confirmBuy(ui, { name: piece.name, detail, price: null, yes: 'Forge' }))) return;
      const ok = await api.forge(piece.id);
      if (ok) popups.show(ok);
      toast(ok ? `${piece.name}: yours forever.` : 'You need more bars.');
      await late.refreshInventory();
    },
  });
  panels.add('workshop', workshop.el);

  // ---------- The Book, the lakeside and travel ----------
  // ---------- The Book (step 9e) ----------
  const book = createBookPanel(ui, (tab, percent) => {
    void api.claimBookReward(tab, percent).then(async (claim) => {
      if (claim !== null) {
        sound.play('coin');
        popups.show(claim.gains);
        toast(`Book reward: +${claim.gold} gold${claim.gems > 0 ? ` and ${claim.gems} gems` : ''}.`);
      }
      await late.refreshInventory();
    });
  });
  panels.add('book', book.el, () => {
    // What is new stays marked while the Book is open; opening it clears the button's dot.
    void api.getPlayer().then(async (p) => {
      book.refresh(p, true);
      await api.bookOpened();
      side.setBookDot(false);
    });
  });
  // ---------- Quests: daily, events, achievements (TUT-2 part 3) ----------
  const tz = (): number => new Date().getTimezoneOffset();
  const quests = createQuestPanel(ui, (claimId) => {
    void api.claimQuest(claimId, tz()).then(async (r) => {
      if (r) {
        sound.play('coin');
        toast(r.gold > 0 ? `Quest done: +${r.gold} gold.` : 'Quest done.');
        await late.refreshInventory();
      }
      await refreshQuests();
    });
  });
  async function refreshQuests(): Promise<void> {
    const board = await api.getQuestBoard(tz());
    quests.refresh(board, panels.open === 'quests' ? await api.currentHint() : null);
    questButton.dataset.ready = board.ready > 0 ? '1' : '0';
    questButton.classList.toggle('glow', board.ready > 0);
  }
  panels.add('quests', quests.el, () => void refreshQuests());
  // MG-7: the skill tree (shared/src/skills.ts through GameAPI); a buy or respec refreshes the stat bonuses the client reads (st.skills).
  const skills = createSkillsPanel(ui, {
    buy: (id) => api.buySkill(id),
    respec: () => api.respecSkills(),
    gold: () => st.walletGold,
    changed: () => void late.refreshInventory(),
  });
  panels.add('skills', skills.el, () => void api.getSkills().then((v) => skills.refresh(v)));
  void refreshQuests();
  window.setInterval(() => void refreshQuests(), 5000);
  // ---------- The lakeside: woodcutting and fishing (step 9f) ----------
  /** Floating texts in the rooms (what a tree or a fish gave): the dungeon's FloatTexts, at world points. */
  const roomFloats = new FloatTexts(ui);
  const fishBar = createFishBar(ui, { onHold: (on) => lakeside.fishHold(on), onStop: () => lakeside.stopFishing() });
  const lakeside: LakesideScreen = new LakesideScreen(view, {
    api,
    bar: fishBar,
    toast,
    onCaught: () => late.guideEvent('fish'),
    walkTo: (p) => walkTo(p),
    follow: (p) => {
      follow(p);
      st.goal = null;
    },
    avatar: () => ({ x: st.avatar.x, y: st.avatar.y, facing: st.avatar.facing }),
    face: (f) => {
      st.avatar = { ...st.avatar, facing: f };
    },
    swing: () => sprite.gesture('reach'),
    float: (at, text, rank, delayMs = 0) => roomFloats.add(at, text, 'loot', delayMs, rank),
    sound: (name, opts) => sound.play(name, opts?.rank, opts?.pitch),
    reduceEffects: () => prefs.reduceEffects,
    flash: (ms) => flashScreen(ui, ms),
    gains: (g, at) => {
      popups.show(g);
      if (at) flyGems(g, at);
    },
    afterChange: async () => {
      await late.refreshInventory();
      await late.refreshHint();
    },
  });
  const travel = createTravelPanel(ui, (place) => void late.travelTo(place));
  panels.add('travel', travel.el, () => void refreshTravel());
  async function refreshTravel(): Promise<void> {
    const p = await api.getPlayer();
    const f = await api.getFarm();
    const t = await api.getTavern();
    const seated = t.guests.filter((g) => g.seated).length;
    const orders = t.guests.filter((g) => g.phase === 'order' && g.order).length;
    const coinPiles = t.mess.filter((m) => m.coins > 0).length;
    const badge = [orders > 0 ? `${orders} ${orders === 1 ? 'order' : 'orders'}` : '', coinPiles > 0 ? `${coinPiles} ${coinPiles === 1 ? 'coin pile' : 'coin piles'}` : ''].filter(Boolean).join(', ');
    const farmStatus =
      f.ripe > 0 ? `${f.ripe} ${f.ripe === 1 ? 'plant' : 'plants'} ready to harvest` : f.growing > 0 ? `${f.growing} growing` : `${f.free} free soil cells`;
    const lake = await api.getLakeside();
    const standing = lake.trees.filter((t) => t.regrowInMs === null).length;
    const lakeStatus = `Fish and chop wood: ${standing} of ${lake.trees.length} trees standing`;
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    const cards: PlaceCard[] = [
      { place: 'hotel', status: `Your room, level ${late.roomLevel(p.hotelRoomId)}`, locked: null, here: st.room.id === p.hotelRoomId },
      {
        place: 'shop',
        status: `Tavern level ${late.roomLevel(p.shopRoomId)}: ${seated > 0 ? `${seated} ${seated === 1 ? 'guest' : 'guests'} waiting` : 'no guests yet'}`,
        badge: badge || undefined,
        locked: null,
        here: st.room.id === p.shopRoomId,
      },
      { place: 'farm', status: farmStatus, locked: null, here: st.room.id === p.farmRoomId },
      { place: 'lakeside', status: lakeStatus, locked: null, here: st.room.id === p.lakesideRoomId },
      { place: 'mine', status: `Free. Lantern: ${MINE_LANTERN_MS / 60_000} minutes`, locked: p.level < MINE_UNLOCK_LEVEL ? `Opens at level ${MINE_UNLOCK_LEVEL}` : null, here: false },
      { place: 'dungeon', status: free ? 'A free run' : `Key: ${DUNGEON_KEY_COST} gold`, locked: null, here: false },
    ];
    travel.refresh(cards);
  }

  return { workshop, book, roomFloats, lakeside, refreshTravel };
}
