// Camera and pointer input. The rule (also in CLAUDE.md):
// - Touch: one-finger drag pans; two fingers pan and pinch-zoom freely (follows the fingers).
// - Mouse: left click is a tap; left-drag and right-drag pan; the wheel zooms freely and
//   glides to its target (call update(dtMs) every frame).
// - A press counts as a tap only if it moved less than TAP_MAX_MOVE_PX screen px and was held
//   less than TAP_MAX_MS. Otherwise it is a drag, and a drag never taps (the avatar won't walk).
// - Zooming stays smooth while a pinch or wheel gesture is active. When it ends (the second
//   finger lifts, or no wheel event for WHEEL_GESTURE_END_MS), the zoom eases in
//   ZOOM_SETTLE_MS to settleZoom (nearest zoom where zoom * devicePixelRatio is whole, or the
//   overview zoom if closer), around the gesture's focus point, and then the camera snaps to
//   whole device pixels.
// - A press held for LONG_PRESS_MS without moving past TAP_MAX_MOVE_PX is a long press
//   (onPoint 'longpress', with what was under the pointer when it went down). It never taps.
// - When getDragMode() returns 'draw' (Blockers mode, later), a one-finger / left drag is
//   sent to onDraw instead of panning.
// - HOLD TO REPEAT (step BG5b): onPress may claim a press for a repeating action ('repeat': the
//   first hit already happened on press; the press never taps; moving past TAP_MAX_MOVE_PX ends the
//   hold and it becomes a pan). A press held still for HOLD_PLACE_START_MS may become a 'line' hold
//   (onHoldStill): from then on moving does not pan, onHoldMove follows the pointer. Release, a pan or a
//   second finger ends it (onHoldEnd). The actions themselves (and holdTick) live in the client.
// - HOLD TO WALK: a press held still for HOLD_PLACE_START_MS on free floor (onWalkHold) walks to the pointer
//   and keeps following it while it stays down (the app re-paths when the pointer changes cell).
// Uses Pixi's federated pointer and wheel events.

import type { Container, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import {
  HOLD_PLACE_START_MS,
  INTERACT_SLIDE_TAP_MS,
  earlyWalkNext,
  LONG_PRESS_MS,
  TAP_MAX_MOVE_PX,
  TAP_MAX_MS,
  WHEEL_GESTURE_END_MS,
  WHEEL_ZOOM_SPEED,
  ZOOM_EASE_MS,
  ZOOM_SETTLE_MS,
  clampZoom,
  easeZoom,
  panBy,
  settleZoom,
  zoomAt,
  type Camera,
  type Point,
} from '@pixel-hotel/shared';

export type DragMode = 'pan' | 'draw';
export type DrawPhase = 'start' | 'move' | 'end';

export interface CameraControlHooks {
  getCamera(): Camera;
  /** snap: also put the camera on whole pixels (end of a zoom settle). */
  setCamera(cam: Camera, snap?: boolean): void;
  /** The overview zoom (whole room fits), one of the zooms a gesture can settle on. */
  getOverviewZoom(): number;
  /** Real screen px per CSS px (the renderer resolution). */
  getDevicePixelRatio(): number;
  /** CAM-LOCK: true while the camera is locked on the moving avatar (a drag then never pans). */
  isCameraLocked?(): boolean;
  /**
   * Mouse/pen moved (hover), a press ended as a tap, or a press was held still (longpress). Screen px. `target` is what Pixi's
   * hit testing found under the pointer (the event target), if anything.
   */
  onPoint(screen: Point, kind: 'hover' | 'tap' | 'longpress', target: Container | null): void;
  /** What a one-finger / left drag does. Default 'pan'. `target`: what was under the pointer when it went down. */
  getDragMode?(target: Container | null, start: Point): DragMode;
  /** Called for drags while the drag mode is 'draw'. */
  onDraw?(phase: DrawPhase, screen: Point): void;
  /**
   * A one-finger / left press went down. Return 'repeat' when it starts a repeating hit (a block, plant,
   * rock or tree under the pointer): the hold's first hit is done by the app now, and the press never taps.
   */
  onPress?(screen: Point, target: Container | null): 'repeat' | null;
  /** The press was held still for HOLD_PLACE_START_MS. Return true to start a 'line' hold (moves then do not pan). */
  onHoldStill?(screen: Point, target: Container | null): boolean;
  /**
   * Nothing else claimed a press that is held still (no repeat, no block line): return true to WALK while
   * it stays down. The pointer then steers the walk (onHoldMove) and moving never pans.
   */
  onWalkHold?(screen: Point, target: Container | null, early?: boolean): boolean;
  /** OA-1: an early walk (started on press) became a quick drag in a room: it pans now, so stop the walk. */
  onWalkCancel?(): void;
  /** The player zoomed (pinch or wheel) or a press became a confirmed hold-walk (first-steps guide events). */
  onZoomGesture?(): void;
  onHoldWalkConfirmed?(): void;
  /** The pointer moved during a 'line' or 'walk' hold. */
  onHoldMove?(screen: Point): void;
  /** A hold ended: released, panned away, or cancelled. */
  onHoldEnd?(): void;
  /** Any press or wheel on the room started (the camera intro stops). */
  onGestureStart?(): void;
  /** MISCLICK-PROOF: the pointer of the current press moved (touch too; 'hover' is mouse only). */
  onPressMove?(screen: Point): void;
  /**
   * MISCLICK-PROOF: the current press ended. 'tap' = it tapped (onPoint 'tap' ran); 'slide' = it moved past TAP_MAX_MOVE_PX with no hold, under
   * INTERACT_SLIDE_TAP_MS, while the camera was locked (nothing panned): the app may still use what it was pressed on if the release is on it;
   * 'other' = anything else (a hold, a pan, a long press, a second finger).
   */
  onPressEnd?(screen: Point, kind: 'tap' | 'slide' | 'other'): void;
}

/** Wheel deltaMode 1 (lines) and 2 (pages) in px. */
const WHEEL_LINE_PX = 33;
const WHEEL_PAGE_PX = 400;

interface Press {
  id: number;
  start: Point;
  last: Point;
  downAt: number;
  /** null until the press moved past TAP_MAX_MOVE_PX. */
  drag: DragMode | null;
  /** What Pixi's hit testing found under the pointer when the press started. */
  target: Container | null;
  /** True once the press fired a long press (it no longer taps). */
  long: boolean;
  /** The hold this press started, if any. */
  hold: 'repeat' | 'line' | 'walk' | null;
  /** True once the hold-still check ran. */
  holdChecked: boolean;
  /** OA-1: the walk already started on press (before the hold time); a quick drag cancels it, a tap still taps. */
  early: boolean;
  /** CAM-LOCK: the camera was locked (avatar moving) when the press began: a drag steers or does nothing, it never pans. */
  lockedAtDown: boolean;
}

export interface CameraControl {
  /** Advances the smooth wheel zoom. Call once per frame. */
  update(dtMs: number): void;
}

export function attachCameraControl(
  stage: Container,
  canvas: HTMLCanvasElement,
  hooks: CameraControlHooks,
): CameraControl {
  const touches = new Map<number, Point>();
  /** One-finger touch or left mouse button press. */
  let press: Press | null = null;
  let rightDrag: Point | null = null;
  let pinch: { dist: number; mid: Point } | null = null;
  /** Where the wheel zoom is gliding to, and the screen point that stays fixed. */
  let wheel: { target: number; at: Point } | null = null;
  /** ms since the last wheel event while a wheel gesture is active, else null. */
  let wheelIdleMs: number | null = null;
  /** Easing to the settled zoom after a gesture ended. */
  let settle: { from: number; to: number; at: Point; elapsed: number } | null = null;

  const startSettle = (at: Point): void => {
    wheel = null;
    wheelIdleMs = null;
    const from = hooks.getCamera().zoom;
    settle = { from, to: settleZoom(from, hooks.getOverviewZoom(), hooks.getDevicePixelRatio()), at, elapsed: 0 };
  };

  /** A pinch ended if there was one and fewer than two fingers are left now. */
  const updatePinch = (): void => {
    const was = pinch;
    pinch = pinchState();
    if (was && !pinch) startSettle(was.mid);
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.eventMode = 'static';

  const pt = (e: FederatedPointerEvent): Point => ({ x: e.global.x, y: e.global.y });
  const targetOf = (e: FederatedPointerEvent): Container | null => (e.target as Container | null) ?? null;

  const pinchState = (): { dist: number; mid: Point } | null => {
    const [a, b] = [...touches.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  /** Ends the current press without a tap (a second finger came down, or it was cancelled). */
  const cancelPress = (): void => {
    if (press?.drag === 'draw') hooks.onDraw?.('end', press.last);
    if (press?.hold || press?.early) hooks.onHoldEnd?.();
    if (press) hooks.onPressEnd?.(press.last, 'other');
    press = null;
  };

  const movePress = (p: Point): void => {
    if (!press) return;
    hooks.onPressMove?.(p);
    if (press.hold) {
      // Sliding while holding never pans: a line follows the pointer, a repeating hit moves on to
      // whatever the finger slides over (the room stays put).
      hooks.onHoldMove?.(p);
      press.last = p;
      return;
    }
    if (!press.drag) {
      if (Math.hypot(p.x - press.start.x, p.y - press.start.y) < TAP_MAX_MOVE_PX) return;
      if (press.early) {
        // Held long enough already: the hold walk steers. A quick drag pans (rooms) and the walk is cancelled.
        if (press.lockedAtDown || earlyWalkNext(performance.now() - press.downAt, Math.hypot(p.x - press.start.x, p.y - press.start.y)) === 'steer') {
          press.hold = 'walk';
          hooks.onHoldMove?.(p);
          press.last = p;
          return;
        }
        press.early = false;
        hooks.onWalkCancel?.();
      }
      press.drag = hooks.getDragMode?.(press.target, press.start) ?? 'pan';
      if (press.drag === 'draw') hooks.onDraw?.('start', press.start);
    }
    if (press.drag === 'pan') {
      if (!press.lockedAtDown) hooks.setCamera(panBy(hooks.getCamera(), p.x - press.last.x, p.y - press.last.y));
    } else hooks.onDraw?.('move', p);
    press.last = p;
  };

  const endPress = (e: FederatedPointerEvent): void => {
    if (!press || press.id !== e.pointerId) return;
    const p = pt(e);
    movePress(p);
    if (press.hold || (press.early && !press.drag)) hooks.onHoldEnd?.();
    const ms = performance.now() - press.downAt;
    let kind: 'tap' | 'slide' | 'other' = 'other';
    if (press.drag === 'draw') hooks.onDraw?.('end', p);
    else if (!press.drag && !press.long && !press.hold && ms < TAP_MAX_MS) {
      hooks.onPoint(p, 'tap', targetOf(e));
      kind = 'tap';
    } else if (press.drag === 'pan' && press.lockedAtDown && !press.hold && !press.early && ms < INTERACT_SLIDE_TAP_MS) kind = 'slide';
    hooks.onPressEnd?.(p, kind);
    press = null;
  };

  stage.on('pointerdown', (e: FederatedPointerEvent) => {
    hooks.onGestureStart?.();
    const p = pt(e);
    const newPress = (): Press => ({
      id: e.pointerId,
      start: p,
      last: p,
      downAt: performance.now(),
      drag: null,
      target: targetOf(e),
      long: false,
      hold: null,
      holdChecked: false,
      early: false,
      lockedAtDown: hooks.isCameraLocked?.() ?? false,
    });
    /** OA-1: hold to walk starts at once on a press on free floor (no wait). */
    const startEarly = (): void => {
      if (press && !press.hold && hooks.onWalkHold?.(p, press.target, true)) press.early = true;
    };
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 1) {
        press = newPress();
        press.hold = hooks.onPress?.(p, press.target) ?? null;
        startEarly();
      } else cancelPress();
      wheel = null;
      wheelIdleMs = null;
      // A new pinch takes over from a running settle; one finger (a pan) runs alongside it.
      if (touches.size >= 2) settle = null;
      pinch = pinchState();
    } else if (e.button === 0) {
      press = newPress();
      press.hold = hooks.onPress?.(p, press.target) ?? null;
      startEarly();
    } else if (e.button === 2) {
      rightDrag = p;
    }
  });

  stage.on('globalpointermove', (e: FederatedPointerEvent) => {
    const p = pt(e);
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, p);
      if (press?.id === e.pointerId) movePress(p);
      const now = pinchState();
      if (pinch && now) {
        const cam = panBy(hooks.getCamera(), now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y);
        const ratio = pinch.dist > 0 ? now.dist / pinch.dist : 1;
        hooks.setCamera(zoomAt(cam, now.mid, cam.zoom * ratio));
        if (Math.abs(ratio - 1) > 0.002) hooks.onZoomGesture?.();
        pinch = now;
      }
      return;
    }
    if (press?.id === e.pointerId) movePress(p);
    if (rightDrag) {
      if (!hooks.isCameraLocked?.()) hooks.setCamera(panBy(hooks.getCamera(), p.x - rightDrag.x, p.y - rightDrag.y));
      rightDrag = p;
    }
    hooks.onPoint(p, 'hover', null);
  });

  const up = (e: FederatedPointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.delete(e.pointerId);
      endPress(e);
      updatePinch();
    } else if (e.button === 0) {
      endPress(e);
    } else if (e.button === 2) {
      rightDrag = null;
    }
  };
  stage.on('pointerup', up);
  stage.on('pointerupoutside', up);
  stage.on('pointercancel', (e: FederatedPointerEvent) => {
    touches.delete(e.pointerId);
    if (press?.id === e.pointerId) cancelPress();
    updatePinch();
    rightDrag = null;
  });

  stage.on('wheel', (e: FederatedWheelEvent) => {
    const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? WHEEL_PAGE_PX : 1;
    hooks.onGestureStart?.();
    hooks.onZoomGesture?.();
    settle = null;
    wheelIdleMs = 0;
    const from = wheel?.target ?? hooks.getCamera().zoom;
    wheel = { target: clampZoom(from * Math.exp(-e.deltaY * unit * WHEEL_ZOOM_SPEED)), at: { x: e.global.x, y: e.global.y } };
  });

  return {
    update(dtMs) {
      if (press && !press.drag && !press.hold && !press.holdChecked && performance.now() - press.downAt >= HOLD_PLACE_START_MS) {
        press.holdChecked = true;
        if (hooks.onHoldStill?.(press.last, press.target)) {
          press.hold = 'line';
          if (press.early) {
            press.early = false;
            hooks.onWalkCancel?.();
          }
        } else if (press.early) {
          press.hold = 'walk';
          hooks.onHoldWalkConfirmed?.();
        } else if (hooks.onWalkHold?.(press.last, press.target)) {
          press.hold = 'walk';
          hooks.onHoldWalkConfirmed?.();
        }
      }
      if (press && !press.drag && !press.long && !press.hold && performance.now() - press.downAt >= LONG_PRESS_MS) {
        press.long = true;
        hooks.onPoint(press.start, 'longpress', press.target);
      }
      if (settle) {
        settle.elapsed += dtMs;
        const zoom = easeZoom(settle.from, settle.to, settle.elapsed, ZOOM_SETTLE_MS);
        const done = zoom === settle.to;
        hooks.setCamera(zoomAt(hooks.getCamera(), settle.at, zoom), done);
        if (done) settle = null;
        return;
      }
      if (wheelIdleMs !== null) {
        wheelIdleMs += dtMs;
        if (wheelIdleMs >= WHEEL_GESTURE_END_MS && wheel) {
          startSettle(wheel.at);
          return;
        }
      }
      // The wheel target stays (for the settle point) until the gesture ends; glide only if needed.
      const cam = hooks.getCamera();
      if (!wheel || cam.zoom === wheel.target) return;
      const t = 1 - Math.exp(-dtMs / ZOOM_EASE_MS);
      let zoom = cam.zoom + (wheel.target - cam.zoom) * t;
      // Close enough: land exactly on the target and stop.
      if (Math.abs(wheel.target - zoom) < 0.001) zoom = wheel.target;
      hooks.setCamera(zoomAt(cam, wheel.at, zoom));
    },
  };
}
