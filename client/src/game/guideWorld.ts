// ONBOARD-1: the guide meets the world. Fills the pure GuideContext / GuideWorld (shared/src/firstTen.ts) from game state, sends the steps the world
// proves (walk, stove, farm, build, dungeon) and moves the animated pointer onto the exact thing to tap or hold. No rules here: the steps, texts and
// targets are shared/data/guide.json. Lives next to tavernLife (which owns the guide) and is started from there.

import {
  AVATAR_H, BUILD_CELL, buildNavGrid, getFurnitureType, guideFloorSpot, roomBlockers, guideAutoEvents, guideTargetOf, guidePointerKind, guestsTrayCanServe, worldToScreen,
  type GuideContext, type GuideTarget, type Point,
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

  const context = (ready: boolean): GuideContext => {
    brewReady = ready;
    const t = st.tavern;
    return {
      brewReady: ready,
      guestWaiting: t.guests.some((x) => x.seated && x.order !== null),
      pouring: h.pouring(),
      trayServes: guestsTrayCanServe(t).length > 0,
      coinsOnTable: t.mess.some((m) => m.coins > 0),
    };
  };

  const itemScreen = (typeId: string): Point | null => {
    const it = st.items.find((i) => i.typeId === typeId);
    if (!it) return null;
    const bar = it.onItemUid === null ? undefined : st.items.find((i) => i.uid === it.onItemUid);
    const lift = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
    return worldToScreen({ x: it.x, y: it.y - lift - getFurnitureType(typeId).height / 2 }, st.shown);
  };
  const guestScreen = (serve: boolean): Point | null => {
    const t = st.tavern;
    const ids = new Set(guestsTrayCanServe(t));
    const pick = t.guests.find((x) => ids.has(x.id)) ?? (serve ? undefined : t.guests.find((x) => x.seated && x.order !== null));
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
    return spotWorld && worldToScreen(spotWorld, st.shown);
  };
  const button = (label: string): HTMLElement | null => document.querySelector<HTMLElement>(`button[aria-label^="${label}"]`);

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
        pointer.place(m ? worldToScreen({ x: m.x, y: m.y - 4 }, st.shown) : null);
        break;
      }
      case 'ui':
        pointer.placeOn(button(t.label));
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
    const on = h.inTavern() && dungeon.isActive === false;
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
    const goal = h.guide.goal();
    const tavernTarget = (k: GuideTarget['kind']): boolean => k !== 'ui' && k !== 'none';
    if (goal === null || panels.open !== null || dungeon.isActive) return pointer.place(null);
    const base = guideTargetOf(goal);
    const t = guidePointerKind(goal, context(brewReady));
    // World things show only in the tavern; the buttons show in any room that has them.
    if (tavernTarget(base.kind) && (!h.inTavern() || st.room.id !== st.tavern.roomId)) return pointer.place(null);
    resolve(t);
  };
  raf = requestAnimationFrame(frame);

  // The world proves some steps (about 4 times a second, only while the guide runs).
  window.setInterval(() => {
    if (!h.guide.state.active) return;
    // The intro walks the avatar in through the door: that is not the player's first step.
    if (st.avatar.state === 'walk' && !g.newIntro.running) walked = true;
    const w = {
      walked,
      cooking: st.tavern.cooks.length > 0,
      inFarm: st.room.kind === 'farm',
      buildOn: g.build.on,
      inDungeon: dungeon.isActive,
    };
    for (const step of guideAutoEvents(w)) h.guide.event(step);
  }, 250);
  void raf;
  return { context };
}
