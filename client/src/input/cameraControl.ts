// Camera and pointer input. The rule (also in CLAUDE.md):
// - Touch: one-finger drag pans; two fingers pan and pinch-zoom in integer steps.
// - Mouse: left click is a tap; left-drag and right-drag pan; the wheel zooms one step per notch.
// - A press counts as a tap only if it moved less than TAP_MAX_MOVE_PX screen px and was held
//   less than TAP_MAX_MS. Otherwise it is a drag, and a drag never taps (the avatar won't walk).
// - When getDragMode() returns 'draw' (Blockers mode, later), a one-finger / left drag is
//   sent to onDraw instead of panning.
// Uses Pixi's federated pointer and wheel events.

import type { Container, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import {
  PINCH_ZOOM_STEP_RATIO,
  TAP_MAX_MOVE_PX,
  TAP_MAX_MS,
  WHEEL_ZOOM_STEP_DELTA,
  panBy,
  zoomAt,
  type Camera,
  type Point,
} from '@pixel-hotel/shared';

export type DragMode = 'pan' | 'draw';
export type DrawPhase = 'start' | 'move' | 'end';

export interface CameraControlHooks {
  getCamera(): Camera;
  setCamera(cam: Camera): void;
  /** Mouse/pen moved (hover), or a press ended as a tap. Screen px. */
  onPoint(screen: Point, kind: 'hover' | 'tap'): void;
  /** What a one-finger / left drag does. Default 'pan'. */
  getDragMode?(): DragMode;
  /** Called for drags while the drag mode is 'draw'. */
  onDraw?(phase: DrawPhase, screen: Point): void;
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
}

export function attachCameraControl(stage: Container, canvas: HTMLCanvasElement, hooks: CameraControlHooks): void {
  const touches = new Map<number, Point>();
  /** One-finger touch or left mouse button press. */
  let press: Press | null = null;
  let rightDrag: Point | null = null;
  let pinch: { dist: number; mid: Point } | null = null;
  let wheelAcc = 0;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.eventMode = 'static';

  const pt = (e: FederatedPointerEvent): Point => ({ x: e.global.x, y: e.global.y });

  const pinchState = (): { dist: number; mid: Point } | null => {
    const [a, b] = [...touches.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  /** Ends the current press without a tap (a second finger came down, or it was cancelled). */
  const cancelPress = (): void => {
    if (press?.drag === 'draw') hooks.onDraw?.('end', press.last);
    press = null;
  };

  const movePress = (p: Point): void => {
    if (!press) return;
    if (!press.drag) {
      if (Math.hypot(p.x - press.start.x, p.y - press.start.y) < TAP_MAX_MOVE_PX) return;
      press.drag = hooks.getDragMode?.() ?? 'pan';
      if (press.drag === 'draw') hooks.onDraw?.('start', press.start);
    }
    if (press.drag === 'pan') hooks.setCamera(panBy(hooks.getCamera(), p.x - press.last.x, p.y - press.last.y));
    else hooks.onDraw?.('move', p);
    press.last = p;
  };

  const endPress = (e: FederatedPointerEvent): void => {
    if (!press || press.id !== e.pointerId) return;
    const p = pt(e);
    movePress(p);
    if (press.drag === 'draw') hooks.onDraw?.('end', p);
    else if (!press.drag && performance.now() - press.downAt < TAP_MAX_MS) hooks.onPoint(p, 'tap');
    press = null;
  };

  stage.on('pointerdown', (e: FederatedPointerEvent) => {
    const p = pt(e);
    const newPress = (): Press => ({ id: e.pointerId, start: p, last: p, downAt: performance.now(), drag: null });
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 1) press = newPress();
      else cancelPress();
      pinch = pinchState();
    } else if (e.button === 0) {
      press = newPress();
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
        let cam = panBy(hooks.getCamera(), now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y);
        let dist = pinch.dist;
        const ratio = now.dist / dist;
        if (ratio >= PINCH_ZOOM_STEP_RATIO) {
          cam = zoomAt(cam, now.mid, cam.zoom + 1);
          dist = now.dist;
        } else if (ratio <= 1 / PINCH_ZOOM_STEP_RATIO) {
          cam = zoomAt(cam, now.mid, cam.zoom - 1);
          dist = now.dist;
        }
        hooks.setCamera(cam);
        pinch = { dist, mid: now.mid };
      }
      return;
    }
    if (press?.id === e.pointerId) movePress(p);
    if (rightDrag) {
      hooks.setCamera(panBy(hooks.getCamera(), p.x - rightDrag.x, p.y - rightDrag.y));
      rightDrag = p;
    }
    hooks.onPoint(p, 'hover');
  });

  const up = (e: FederatedPointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.delete(e.pointerId);
      endPress(e);
      pinch = pinchState();
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
    pinch = pinchState();
    rightDrag = null;
  });

  stage.on('wheel', (e: FederatedWheelEvent) => {
    const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? WHEEL_PAGE_PX : 1;
    wheelAcc += e.deltaY * unit;
    if (Math.abs(wheelAcc) < WHEEL_ZOOM_STEP_DELTA) return;
    // One step per notch; the rest is dropped so a big delta never jumps several levels.
    const dir = wheelAcc < 0 ? 1 : -1;
    wheelAcc = 0;
    const cam = hooks.getCamera();
    hooks.setCamera(zoomAt(cam, { x: e.global.x, y: e.global.y }, cam.zoom + dir));
  });
}
