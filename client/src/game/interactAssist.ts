// MISCLICK-PROOF INTERACTION (owner 19 Nov: 'I often misclick on NPCs, taps, the stove; button on PC, big hitbox on phone').
// The client side of shared/src/interact.ts: it feeds the picks of tapForgive.ts (same pick function as the click) to the overlay in ui/interactUi.ts.
// (1) PC hover: highlight + pointer cursor + name tag of what a click would use. (3) PC keys: E (or Space when no pour waits) uses the nearest usable
// thing to the avatar, or the one Tab / Shift+Tab highlighted. (4) Phone: the CONTEXT BUTTON above the hotbar names the action of the nearest usable
// thing (Pour is a hold). (5) Touch: the press highlights its target, sliding off cancels, a short slide released on it still uses it. (6) The confirm ring.

import { INTERACT_REACH_PX, cycleIndex, interactOrder, nearestInteract, pressStaysOn, type FurnitureItem, type Point } from '@pixel-hotel/shared';
import type { InteractUi } from '../ui/interactUi.ts';
import type { InteractPick, NearTap } from './tapForgive.ts';

/** Tab cycles through the usable things within this many world px of the avatar (6 cells). */
const KEY_CYCLE_REACH_PX = 192;
/** The context button re-picks at most this often, ms. */
const BUTTON_EVERY_MS = 120;

/** Which pick a tap uses: an urgent hit over the exact Pixi hit, else the exact useful hit, else (not on a door) the forgiven pick. */
export function chooseTap(exact: InteractPick | null, pick: InteractPick | null, onDoor: boolean): InteractPick | null {
  if (pick?.hit && pick.priority > (exact?.priority ?? -1)) return pick;
  if (exact) return exact;
  if (!onDoor && pick) return pick;
  return null;
}

/** True when two picks are the same thing (an item uid or a guest id). */
export function samePick(a: InteractPick | null, b: InteractPick | null): boolean {
  if (!a || !b || a.ref.kind !== b.ref.kind) return false;
  return a.ref.kind === 'item' ? a.ref.item.uid === (b.ref as { item: FurnitureItem }).item.uid : a.ref.id === (b.ref as { id: number }).id;
}

export interface InteractAssistDeps {
  ui: InteractUi;
  canvas: HTMLCanvasElement;
  forgive: {
    pickAt(screen: Point): InteractPick | null;
    pickOfItem(item: FurnitureItem): InteractPick | null;
    reachables(): { ref: InteractPick; area: { x: number; y: number; w: number; h: number }; priority: number }[];
    options(): { tolerance: number; minSize: number };
  };
  /** The exact Pixi hit at a screen point (a placed item), if any. */
  hitAt(screen: Point): FurnitureItem | undefined;
  /** True when a door tap would win at this screen point. */
  onDoor(screen: Point, hit: FurnitureItem | undefined): boolean;
  /** Uses a pick as a tap would ('at' = the world point for the side of a seat). True when it was used. */
  run(ref: NearTap, at: Point): boolean;
  /** The avatar's feet, world px. */
  avatar(): Point;
  /** True when the room is not in plain play mode (a panel, build, paint, placing, the dungeon, fishing, Look around). */
  blocked(): boolean;
  /** True when this is a touch device (the context button shows). */
  touch(): boolean;
  pour: { readonly waiting: unknown; readonly pressing: boolean; holdStart(): void; holdEnd(): void };
  /** World rect -> screen rect (the walk-target ring follows the camera). */
  toScreen(world: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number };
  /** True while the avatar still walks. */
  walking(): boolean;
}

export function createInteractAssist(d: InteractAssistDeps) {
  let hovered: InteractPick | null = null;
  let pressed: InteractPick | null = null;
  let keyed: InteractPick | null = null;
  let keyIndex = -1;
  let buttonPick: InteractPick | null = null;
  let buttonAt = 0;
  let keyPour = false;
  /** The walk-target ring: the tapped cell (world), and when it started fading (arrived). */
  let walkCell: { x: number; y: number; w: number; h: number } | null = null;
  let walkFadeAt = 0;
  let walkSince = 0;

  /** What a tap at this point would use (the click and the hover share it). */
  const resolve = (screen: Point, hit: FurnitureItem | undefined): InteractPick | null => {
    const exact = hit ? d.forgive.pickOfItem(hit) : null;
    return chooseTap(exact, d.forgive.pickAt(screen), d.onDoor(screen, hit));
  };
  const show = (): void => {
    const p = pressed ?? keyed ?? hovered;
    d.ui.highlight(p?.bounds ?? null, p?.label ?? '', pressed ? 'press' : keyed ? 'key' : 'hover');
    d.canvas.style.cursor = hovered && !pressed ? 'pointer' : '';
  };
  const confirm = (p: InteractPick | null): void => {
    if (p) d.ui.confirm(p.bounds);
  };
  /** Re-reads a pick by identity (the bounds move with the camera and the state changes). */
  const fresh = (p: InteractPick): InteractPick | null => d.forgive.reachables().map((r) => r.ref).find((r) => samePick(r, p)) ?? null;
  const useNear = (p: InteractPick): boolean => {
    const ok = d.run(p.ref, d.avatar());
    if (ok) confirm(p);
    return ok;
  };
  /** The nearest usable thing to the avatar for the E key and the context button. */
  const nearest = (): InteractPick | null => nearestInteract(d.avatar(), d.forgive.reachables(), INTERACT_REACH_PX);

  const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName));
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || d.blocked()) return;
    if (e.key === 'Tab') {
      const list = interactOrder(d.avatar(), d.forgive.reachables(), KEY_CYCLE_REACH_PX);
      if (list.length === 0) return;
      e.preventDefault();
      if (keyed) keyIndex = list.findIndex((p) => samePick(p, keyed));
      keyIndex = cycleIndex(keyIndex, list.length, e.shiftKey ? -1 : 1);
      keyed = list[keyIndex] ?? null;
      show();
      return;
    }
    const isE = e.key === 'e' || e.key === 'E';
    // Space is the pour key while a pour waits (pourControl); E pours too.
    if (!isE && !(e.key === ' ' && !d.pour.waiting)) return;
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (d.pour.waiting) {
      if (isE) {
        e.preventDefault();
        keyPour = true;
        d.pour.holdStart();
      }
      return;
    }
    const target = (keyed && fresh(keyed)) ?? nearest();
    if (!target) return;
    e.preventDefault();
    useNear(target);
    keyed = null;
    keyIndex = -1;
    show();
  });
  window.addEventListener('keyup', (e) => {
    if ((e.key === 'e' || e.key === 'E') && keyPour) {
      keyPour = false;
      d.pour.holdEnd();
    }
  });

  return {
    resolve,
    confirm,
    /** PC: the mouse moved (play mode). */
    hover(screen: Point): void {
      hovered = d.blocked() ? null : resolve(screen, d.hitAt(screen));
      show();
    },
    clearHover(): void {
      hovered = null;
      show();
    },
    /** A press went down in play mode: highlight what it would use (touch and mouse). */
    pressStart(screen: Point, hit: FurnitureItem | undefined): void {
      keyed = null;
      keyIndex = -1;
      pressed = d.blocked() ? null : resolve(screen, hit);
      show();
    },
    /** The press moved: sliding off the target cancels it. */
    pressMove(screen: Point): void {
      if (pressed && !pressStaysOn(screen, pressed.bounds, d.forgive.options())) {
        pressed = null;
        show();
      }
    },
    /** The press ended. A short slide released still on the target uses it (the tap path handled 'tap' already). True when used. */
    pressEnd(screen: Point, kind: 'tap' | 'slide' | 'other'): boolean {
      const p = pressed;
      pressed = null;
      show();
      if (kind !== 'slide' || !p || d.blocked() || !pressStaysOn(screen, p.bounds, d.forgive.options())) return false;
      const ok = d.run(p.ref, p.ref.kind === 'guest' ? p.ref.world : { x: p.ref.item.x, y: p.ref.item.y });
      if (ok) confirm(p);
      return ok;
    },
    /** A tap walks to this cell (world px): the ring shows until the avatar arrives, then fades. */
    markWalk(cell: { x: number; y: number; w: number; h: number }): void {
      walkCell = cell;
      walkFadeAt = 0;
      walkSince = performance.now();
    },
    /** Once per frame: the context button (touch) follows the nearest usable thing; the highlights and the walk ring follow the camera. */
    update(nowMs: number): void {
      if (walkCell) {
        if (!walkFadeAt && !d.walking() && nowMs - walkSince > 120) walkFadeAt = nowMs;
        if (walkFadeAt && nowMs - walkFadeAt > 300) walkCell = null;
        d.ui.walkMark(walkCell && !d.blocked() ? d.toScreen(walkCell) : null, walkFadeAt > 0);
      }
      if ((pressed || keyed || hovered) && d.blocked()) {
        pressed = keyed = hovered = null;
        show();
      }
      if (pressed || keyed || hovered) {
        if (pressed) pressed = fresh(pressed) ?? pressed;
        if (keyed) keyed = fresh(keyed);
        if (hovered) hovered = fresh(hovered);
        show();
      }
      if (!d.touch() || d.blocked()) {
        buttonPick = null;
        if (!d.pour.pressing) d.ui.button(null);
        return;
      }
      if (d.pour.waiting) {
        d.ui.button('Pour');
        return;
      }
      if (nowMs - buttonAt < BUTTON_EVERY_MS) return;
      buttonAt = nowMs;
      buttonPick = nearest();
      d.ui.button(buttonPick?.label ?? null);
    },
    /** The context button went down: Pour is a hold, everything else one tap. */
    buttonDown(): void {
      if (d.pour.waiting) {
        d.pour.holdStart();
        return;
      }
      const p = buttonPick ? fresh(buttonPick) : null;
      if (p) useNear(p);
      buttonAt = 0;
    },
    buttonUp(): void {
      d.pour.holdEnd();
    },
  };
}
