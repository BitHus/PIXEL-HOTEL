// HUD declutter rules (docs/PLAN-UI-DECLUTTER.md), pure: the client feeds the clock and what it sees, these say what to show.
//  - The HUD (info, side buttons, hotbar) fades to HUD_FADE_ALPHA after HUD_FADE_AFTER_MS without a tap or a change (gold, toast).
//    Walking does NOT count as activity (the room should fill the screen while you move). It never fades while a panel is open,
//    a toast shows, a pour is going, a finger is down, or a menu or placing mode is open.
//  - The first-steps card shows only after GUIDE_IDLE_MS standing idle: no tap and no walking, no panel, no finger down.

import { GUIDE_IDLE_MS, HUD_FADE_AFTER_MS } from './config.ts';

export interface HudIdleInput {
  now: number;
  /** Last pointer press or key (ms clock). */
  lastTapAt: number;
  /** Last time the avatar was walking. */
  lastWalkAt: number;
  /** Last change the player should notice (gold or gems changed, a toast appeared). */
  lastChangeAt: number;
  panelOpen: boolean;
  toastShowing: boolean;
  pouring: boolean;
  /** A finger or button is down right now. */
  pressing: boolean;
  /** Build mode, placing or painting is on (the hotbar and buttons are needed). */
  editing: boolean;
}

/** True when the HUD should be dimmed. */
export function hudFaded(i: HudIdleInput): boolean {
  if (i.panelOpen || i.toastShowing || i.pouring || i.pressing || i.editing) return false;
  return i.now - Math.max(i.lastTapAt, i.lastChangeAt) >= HUD_FADE_AFTER_MS;
}

/** True when the first-steps card may show. */
export function guideShown(i: HudIdleInput, walking: boolean): boolean {
  if (walking || i.panelOpen || i.pressing) return false;
  return i.now - Math.max(i.lastTapAt, i.lastWalkAt) >= GUIDE_IDLE_MS;
}
