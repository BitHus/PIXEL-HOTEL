// ONBOARD-1: the guide meets the world. Fills the pure GuideContext / GuideWorld (shared/src/firstTen.ts) from game state, sends the steps the world
// proves (walk, stove, farm, build, dungeon) and moves the animated pointer onto the exact thing to tap or hold. No rules here: the steps, texts and
// targets are shared/data/guide.json. Lives next to tavernLife (which owns the guide) and is started from there.

import {
  AVATAR_H, BUILD_CELL, waterRects, innDoorSpots, MINE_UNLOCK_LEVEL, growthStage, plantList, buildNavGrid, getFurnitureType, catalogTypes, guideFloorSpot, roomBlockers, guideAutoEvents, guideTargetOf, guidePointerKind, guideFixFor, guideStock, guestsTrayCanServe, worldToScreen,
  type FirstTenStep, type GuideContext, type GuideStock, type GuideTarget, type Point,
} from '@pixel-hotel/shared';
import { surfaceHeight } from '../render/furnitureArt.ts';
import { createGuidePointer } from '../ui/guidePointer.ts';
import '../ui/guide.css';
import { startHintChip } from './hintChip.ts';
import type { FirstTenGuide } from '../ui/firstTenGuide.ts';
import type { G9 } from './ctx.ts';

export interface GuideWorldHooks {
  guide: FirstTenGuide;
  /** True while the avatar waits at the taps to pour. */
  pouring: () => boolean;
  /** True while the tavern room is the one on screen. */
  inTavern: () => boolean;
  /** CEL-3: the tavern or its attached kitchen or cellar is on screen. */
  inWork: () => boolean;
  /** Keys of the machines that are ready ('s<uid>' stove, 'b<uid>' barrel), for the ready dots (VG-1). */
  ready: () => ReadonlySet<string>;
}

export interface GuideWorldApi {
  /** What the guide needs to know about the tavern now. */
  context(brewReady: boolean): GuideContext;
}

export function startGuideWorld(g: G9, h: GuideWorldHooks): GuideWorldApi {
  const { st, uiRoot, prefs, panels, dungeon } = g;
  const pointer = createGuidePointer(uiRoot, () => prefs.reduceEffects);
  g.late.showHint = startHintChip(g, () => h.guide.goal() !== null).show;
  let walked = false;
  let brewReady = false;
  let mineOpen = false;
  // A1e: what the player owns (refreshed by the poll below); the guide points at the real blocker instead of a step that cannot be done.
  let stock: GuideStock | undefined;

  const context = (ready: boolean): GuideContext => {
    brewReady = ready;
    const t = st.tavern;
    return {
      brewReady: ready,
      guestWaiting: t.guests.some((x) => (x.seated || x.kind2 === 'bar') && x.order !== null),
      pouring: h.pouring(),
      trayServes: guestsTrayCanServe(t).length > 0,
      coinsOnTable: t.mess.some((m) => m.coins > 0),
      mineOpen,
      cellarBuilt: t.cellarRoomId !== undefined,
      stock,
    };
  };

  /** R16: the floor point of this frame's world target (trail + camera peek), set by the helpers below and published as st.guideWorld. */
  let tw: Point | null = null;
  const itemScreen = (typeId: string): Point | null => {
    const it = st.items.find((i) => i.typeId === typeId && i.roomId === st.room.id) ?? st.items.find((i) => i.typeId === typeId);
    if (!it) return null;
    tw = { x: it.x, y: it.y };
    const bar = it.onItemUid === null ? undefined : st.items.find((i) => i.uid === it.onItemUid);
    const lift = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
    return worldToScreen({ x: it.x, y: it.y - lift - getFurnitureType(typeId).height / 2 }, st.shown);
  };
  const guestScreen = (serve: boolean): Point | null => {
    const t = st.tavern;
    const ids = new Set(guestsTrayCanServe(t));
    const pick = t.guests.find((x) => ids.has(x.id)) ?? (serve ? undefined : t.guests.find((x) => (x.seated || x.kind2 === 'bar') && x.order !== null));
    if (pick) tw = { x: pick.x, y: pick.y };
    return pick ? worldToScreen({ x: pick.x, y: pick.y - AVATAR_H / 2 }, st.shown) : null;
  };
  // The walk step points at a free, open cell a few cells away toward the middle of the room (cached per avatar cell and item count).
  let spotKey = '';
  let spotWorld: Point | null = null;
  const floorSpot = (): Point | null => {
    const key = `${st.room.id}:${Math.floor(st.avatar.x / BUILD_CELL)}:${Math.floor(st.avatar.y / BUILD_CELL)}:${st.items.length}`;
    if (key !== spotKey) {
      spotKey = key;
      const w = guideFloorSpot(buildNavGrid(st.room, roomBlockers(st.room, st.items)), st.avatar, { x: st.room.w / 2, y: st.room.h / 2 });
      spotWorld = w;
    }
    if (spotWorld) tw = spotWorld;
    return spotWorld && worldToScreen(spotWorld, st.shown);
  };
  const ripePlantScreen = (): Point | null => {
    const now = Date.now();
    const ripe = plantList(st.room).find((p) => growthStage(p.plant, now) === 'full');
    if (ripe) tw = { x: ripe.c * BUILD_CELL + BUILD_CELL / 2, y: ripe.r * BUILD_CELL + BUILD_CELL / 2 };
    return ripe ? worldToScreen({ x: ripe.c * BUILD_CELL + BUILD_CELL / 2, y: ripe.r * BUILD_CELL + BUILD_CELL / 2 }, st.shown) : null;
  };
  const waterScreen = (): Point | null => {
    const ws = waterRects();
    const w = ws[Math.floor(ws.length / 2)];
    if (w) tw = { x: w.x + w.w / 2, y: w.y + w.h / 2 };
    return w ? worldToScreen({ x: w.x + w.w / 2, y: w.y + w.h / 2 }, st.shown) : null;
  };
  /** CEL-3: the pointer on an Inn door of the room on screen (null when it has no such door). */
  const doorScreen = (id: string): Point | null => {
    const d = innDoorSpots(st.room).find((x) => x.id === id);
    if (d) tw = { x: d.spot.x + d.spot.w / 2, y: d.spot.y + d.spot.h / 2 };
    return d ? worldToScreen({ x: d.spot.x + d.spot.w / 2, y: d.spot.y + 12 }, st.shown) : null;
  };
  /** CEL-3: the door that leads to the thing the pointer wants, when it stands in another room of the tavern area (null = it is here or no routing). */
  const routeDoor = (t: GuideTarget): string | null => {
    const typeId = t.kind === 'furniture' ? t.typeId : t.kind === 'stand' ? 'tap_stand' : null;
    const home = typeId ? (getFurnitureType(typeId).casks ? 'cellar' : 'shop') : t.kind === 'guest' || t.kind === 'coins' ? 'shop' : null;
    if (home === null || home === st.room.kind) return null;
    if (typeId && st.items.some((i) => i.roomId === st.room.id && i.typeId === typeId)) return null;
    return st.room.kind === 'shop' ? `tavern_to_${home}` : `${st.room.kind}_to_tavern`;
  };
  const button = (label: string): HTMLElement | null => document.querySelector<HTMLElement>(`button[aria-label^="${label}"]`);
  const shown = (b: HTMLElement): boolean => b.offsetParent !== null && b.getClientRects().length > 0;
  /** A1a: a button of the side column; one that stands in the closed More grid (hidden) points at More instead, and at itself once the grid is open. */
  const uiButton = (label: string): HTMLElement | null => {
    const b = button(label);
    if (!b) return null;
    if (shown(b)) return b;
    return b.closest('.more-menu') ? button('More') : null;
  };
  const openPanel = (): HTMLElement | null => document.querySelector<HTMLElement>('.panel:not([hidden]):not(.panel-leaving)');
  const inPanel = (sel: string): HTMLElement | null => {
    const el = openPanel()?.querySelector<HTMLElement>(sel) ?? null;
    return el && shown(el) ? el : null;
  };
  /** A1a: the step's next tap INSIDE the panel that is open now (null = nothing to point at there, the pointer hides). */
  const panelTarget = (goal: FirstTenStep, fixId: string | null): HTMLElement | null => {
    const open = panels.open;
    if (open === 'travel') {
      const place = fixId === 'noCook' || fixId === 'noBrew' ? 'farm' : goal === 'farm' || goal === 'mine' || goal === 'lakeside' ? goal : null;
      return place ? inPanel(`.place-${place}:not([disabled])`) : null;
    }
    if (open === 'catalog') {
      if (goal === 'plant' && fixId === null) return inPanel('.card-grid button[aria-label^="Turnip seeds"]') ?? inPanel('.tab-btn[aria-label="Seeds"]');
      if (goal === 'wall' && fixId === null) {
        const names = catalogTypes().filter((t) => getFurnitureType(t.id).wall).map((t) => t.name);
        const cards = [...(openPanel()?.querySelectorAll<HTMLElement>('.card-grid button:not([disabled])') ?? [])];
        return cards.find((c) => names.some((n) => (c.getAttribute('aria-label') ?? '').startsWith(n))) ?? inPanel('.tab-btn[aria-label="Home"]');
      }
      return null;
    }
    if (open === 'brewing') return goal === 'collect' ? inPanel('.collect-btn') : goal === 'barrel' ? inPanel('.collect-btn') ?? inPanel('.btn.primary:not([disabled])') : null;
    if (open === 'cooking') return goal === 'stove' ? inPanel('.collect-btn') ?? inPanel('.btn.primary:not([disabled])') : null;
    if (open === 'taps') return goal === 'load' ? inPanel('.tap-load:not([disabled])') ?? inPanel('.btn.primary:not([disabled])') : null;
    return null;
  };

  const resolve = (t: GuideTarget): void => {
    switch (t.kind) {
      case 'furniture':
        pointer.place(itemScreen(t.typeId));
        break;
      case 'stand':
        pointer.place(itemScreen('tap_stand'));
        break;
      case 'guest':
        pointer.place(guestScreen(false));
        break;
      case 'coins': {
        const m = st.tavern.mess.find((x) => x.coins > 0);
        if (m) tw = { x: m.x, y: m.y };
        pointer.place(m ? worldToScreen({ x: m.x, y: m.y - 4 }, st.shown) : null);
        break;
      }
      case 'door':
        pointer.place(doorScreen(t.id));
        break;
      case 'ui':
        pointer.placeOn(uiButton(t.label));
        break;
      case 'floor':
        pointer.place(floorSpot());
        break;
      default:
        pointer.place(null);
    }
  };

  // VG-1: a small pulsing dot over every ready stove or barrel (always on, not only while the guide runs).
  const dots = new Map<string, HTMLElement>();
  const dotFrame = (): void => {
    const on = h.inWork() && dungeon.isActive === false;
    const want = on ? h.ready() : new Set<string>();
    for (const [k, d] of dots) {
      if (!want.has(k)) {
        d.remove();
        dots.delete(k);
      }
    }
    for (const k of want) {
      const it = st.items.find((i) => i.uid === Number(k.slice(1)));
      if (!it) continue;
      let d = dots.get(k);
      if (!d) {
        d = document.createElement('div');
        d.className = 'ready-dot';
        d.setAttribute('aria-hidden', 'true');
        uiRoot.appendChild(d);
        dots.set(k, d);
      }
      const p = worldToScreen({ x: it.x, y: it.y - getFurnitureType(it.typeId).height - 6 }, st.shown);
      d.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      d.classList.toggle('calm', prefs.reduceEffects);
    }
  };
  let raf = 0;
  const frame = (): void => {
    raf = requestAnimationFrame(frame);
    dotFrame();
    tw = null;
    worldFrame();
    st.guideWorld = tw; // R16: only a world target of the step on screen; a panel, a UI button or no step = null
  };
  const worldFrame = (): void => {
    const goal = h.guide.goal();
    const tavernTarget = (k: GuideTarget['kind']): boolean => k !== 'ui' && k !== 'none';
    if (goal === null || dungeon.isActive) return pointer.place(null);
    // A1a: with a panel open the pointer moves INTO it (the next card, tab or button of the step) instead of vanishing; nothing to point at there = hidden.
    if (panels.open !== null) return pointer.placeOn(panelTarget(goal, guideFixFor(goal, stock)?.id ?? null));
    const base = guideTargetOf(goal);
    const t = guidePointerKind(goal, context(brewReady));
    // World things show only in the tavern; elsewhere the pointer shows the way back (the Worlds button) instead of nothing.
    if (tavernTarget(base.kind) && !h.inWork()) return pointer.placeOn(uiButton('Worlds'));
    // CEL-3: the thing is in the kitchen, the cellar or the tavern but not in this room: point at the door that leads there.
    const via = routeDoor(t);
    if (via !== null) return pointer.place(doorScreen(via));
    // Steps with no tap target of their own: harvest points at a ripe plant on the farm, fish at the water of the lakeside.
    if (goal === 'harvest' && st.room.kind === 'farm') return pointer.place(ripePlantScreen());
    if (goal === 'fish' && st.room.kind === 'lakeside') return pointer.place(waterScreen());
    resolve(t);
  };
  raf = requestAnimationFrame(frame);

  // The world proves some steps (about 4 times a second, only while the guide runs).
  window.setInterval(() => {
    if (!h.guide.state.active) return;
    void Promise.all([g.api.getPlayer(), g.api.getInventory()]).then(([p, inv]) => {
      mineOpen = p.level >= MINE_UNLOCK_LEVEL;
      stock = guideStock({ gold: p.wallet.gold, materials: inv.materials, bagFurniture: inv.furniture, tavern: st.tavern });
    });
    // The intro walks the avatar in through the door: that is not the player's first step.
    if (st.avatar.state === 'walk' && !g.newIntro.running) walked = true;
    const w = {
      walked,
      cooking: st.tavern.cooks.length > 0,
      inFarm: st.room.kind === 'farm',
      buildOn: g.build.on,
      inDungeon: dungeon.isActive,
      inMine: dungeon.isActive && dungeon.place === 'mine',
      inLakeside: st.room.kind === 'lakeside',
    };
    for (const step of guideAutoEvents(w)) h.guide.event(step);
  }, 250);
  void raf;
  return { context };
}
