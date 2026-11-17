// VG-1: the one-time in-world hint chip. A small label that bobs on the thing to use, shown once per key (kept in prefs.hintsSeen, per device),
// for reading pace (shared/src/hints.ts), calm under Reduce effects. It never takes the pointer. Which hint is due is the pure hintDue.

import { AVATAR_H, HINT_REACH_PX, getFurnitureType, hintDue, hintMs, worldToScreen, type Point } from '@pixel-hotel/shared';
import { savePrefs } from '../api/prefs.ts';
import { surfaceHeight } from '../render/furnitureArt.ts';
import { el } from '../ui/dom.ts';
import '../ui/guide.css';
import type { G9 } from './ctx.ts';

/** Where the chip sits, in the UI layer's pixels (null = hide it). */
export type HintAnchor = () => Point | null;

export function startHintChip(g: G9, guideBusy: () => boolean) {
  const { st, uiRoot, prefs, storage, panels, dungeon } = g;
  const chip = el('div', 'hint-chip');
  chip.setAttribute('aria-hidden', 'true');
  uiRoot.appendChild(chip);
  let key: string | null = null;
  let until = 0;
  let anchor: HintAnchor = () => null;
  let raf = 0;
  const hide = (): void => {
    chip.classList.remove('on');
    key = null;
  };
  const frame = (): void => {
    raf = requestAnimationFrame(frame);
    if (key === null) return;
    const p = anchor();
    if (performance.now() > until || p === null || dungeon.isActive) return hide();
    chip.classList.toggle('calm', prefs.reduceEffects);
    chip.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  };
  raf = requestAnimationFrame(frame);
  void raf;
  const avatarAnchor: HintAnchor = () => worldToScreen({ x: st.avatar.x, y: st.avatar.y - AVATAR_H - 8 }, st.shown);

  /** Shows a hint once ever; false when it was seen already (or another chip is up). */
  const show = (k: string, text: string, at: HintAnchor = avatarAnchor): boolean => {
    if (prefs.hintsSeen.includes(k) || key !== null) return false;
    prefs.hintsSeen = [...prefs.hintsSeen, k];
    savePrefs(storage, prefs);
    key = k;
    chip.textContent = text;
    anchor = at;
    until = performance.now() + hintMs(text);
    chip.classList.add('on');
    return true;
  };

  // Things in reach in the tavern (about 4 times a second; never while the guide points at something or a panel is open).
  window.setInterval(() => {
    if (key !== null || guideBusy() || panels.open !== null || dungeon.isActive || st.room.id !== st.tavern.roomId) return;
    const near = st.items.filter((i) => Math.hypot(i.x - st.avatar.x, i.y - st.avatar.y) <= HINT_REACH_PX);
    const due = hintDue(near.map((i) => i.typeId), prefs.hintsSeen);
    const it = due && near.find((i) => i.typeId === due.typeId);
    if (!due || !it) return;
    show(due.key, due.text, () => {
      const bar = it.onItemUid === null ? undefined : st.items.find((i) => i.uid === it.onItemUid);
      const lift = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
      return worldToScreen({ x: it.x, y: it.y - lift - getFurnitureType(it.typeId).height }, st.shown);
    });
  }, 250);
  return { show };
}
