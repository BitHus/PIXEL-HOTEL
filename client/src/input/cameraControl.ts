// Camera input (step 2): right-drag or two-finger drag pans; wheel or pinch zooms in integer
// steps around the cursor or the fingers. Uses Pixi's federated pointer and wheel events.

import type { Container, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import {
  PINCH_ZOOM_STEP_RATIO,
  WHEEL_ZOOM_STEP_DELTA,
  panBy,
  zoomAt,
  type Camera,
  type Point,
} from '@pixel-hotel/shared';

export interface CameraControlHooks {
  getCamera(): Camera;
  setCamera(cam: Camera): void;
  /** The pointer moved (mouse/pen) or a tap ended (touch), in screen px. */
  onPoint(screen: Point, kind: 'hover' | 'tap'): void;
}

/** A touch that moves less than this (screen px) counts as a tap. */
const TAP_SLOP = 8;
/** Wheel deltaMode 1 (lines) and 2 (pages) in px. */
const WHEEL_LINE_PX = 33;
const WHEEL_PAGE_PX = 400;

export function attachCameraControl(stage: Container, canvas: HTMLCanvasElement, hooks: CameraControlHooks): void {
  const touches = new Map<number, Point>();
  let tapStart: Point | null = null;
  let rightDrag: Point | null = null;
  let pinch: { dist: number; mid: Point } | null = null;
  let wheelAcc = 0;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.eventMode = 'static';

  const pinchState = (): { dist: number; mid: Point } | null => {
    const [a, b] = [...touches.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  stage.on('pointerdown', (e: FederatedPointerEvent) => {
    const p = { x: e.global.x, y: e.global.y };
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      tapStart = touches.size === 1 ? p : null;
      pinch = pinchState();
    } else if (e.button === 2) {
      rightDrag = p;
    }
  });

  stage.on('globalpointermove', (e: FederatedPointerEvent) => {
    const p = { x: e.global.x, y: e.global.y };
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, p);
      if (tapStart && Math.hypot(p.x - tapStart.x, p.y - tapStart.y) > TAP_SLOP) tapStart = null;
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
    if (rightDrag) {
      hooks.setCamera(panBy(hooks.getCamera(), p.x - rightDrag.x, p.y - rightDrag.y));
      rightDrag = p;
    }
    hooks.onPoint(p, 'hover');
  });

  const end = (e: FederatedPointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.delete(e.pointerId);
      if (tapStart && touches.size === 0) hooks.onPoint({ x: e.global.x, y: e.global.y }, 'tap');
      tapStart = null;
      pinch = pinchState();
    } else if (e.button === 2 || e.buttons === 0) {
      rightDrag = null;
    }
  };
  stage.on('pointerup', end);
  stage.on('pointerupoutside', end);
  stage.on('pointercancel', (e: FederatedPointerEvent) => {
    touches.delete(e.pointerId);
    tapStart = null;
    pinch = pinchState();
    rightDrag = null;
  });

  stage.on('wheel', (e: FederatedWheelEvent) => {
    const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? WHEEL_PAGE_PX : 1;
    wheelAcc += e.deltaY * unit;
    const p = { x: e.global.x, y: e.global.y };
    if (Math.abs(wheelAcc) < WHEEL_ZOOM_STEP_DELTA) return;
    // One step per notch; the rest is dropped so a big delta never jumps several levels.
    const dir = wheelAcc < 0 ? 1 : -1;
    wheelAcc = 0;
    const cam = hooks.getCamera();
    hooks.setCamera(zoomAt(cam, p, cam.zoom + dir));
  });
}
