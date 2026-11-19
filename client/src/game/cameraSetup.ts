// The camera and its intro (R1 split of main.ts: part 5 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  INTRO_DEVICE_PX_PER_ART_PX, centerCamera, clampCamera, firstViewCamera, fitZoom, getFurnitureType, introZoom, snapCamera,
  worldToScreen, type Camera,
} from '@pixel-hotel/shared';
import { CameraIntro } from '../input/cameraIntro.ts';
import { pixelStep } from '../render/pixelStep.ts';
import type { G4 } from './ctx.ts';

export async function setupCameraSetup(g: G4) {
  const { dpr, backdrop, app, view, cross, label, st } = g;

  /** Camera state (unsnapped, so zooming never drifts). */
  st.camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole device px. */
  st.shown = st.camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  st.marked = null;
  /** CAM-LOCK v2: Look around is off at the start of every session. */
  st.lookAround = false;
  const intro = new CameraIntro();

  const redraw = (): void => {
    st.shown = snapCamera(st.camera, dpr());
    pixelStep.v = 1 / (st.shown.zoom * dpr());
    backdrop.update(st.shown, app.screen.width, app.screen.height);
    view.world.scale.set(st.shown.zoom);
    view.world.position.set(-st.shown.x * st.shown.zoom, -st.shown.y * st.shown.zoom);
    let text = `zoom ${st.shown.zoom.toFixed(2)}x  dpr ${dpr()}`;
    if (st.marked) {
      const s = worldToScreen(st.marked, st.shown);
      cross.position.set(Math.floor(s.x), Math.floor(s.y));
      text = `x ${Math.floor(st.marked.x)}  y ${Math.floor(st.marked.y)}\n${text}`;
    }
    label.set(text);
  };

  const setCamera = (cam: Camera, snap = false): void => {
    st.camera = clampCamera(cam, app.screen.width, app.screen.height, st.bounds);
    if (snap) st.camera = snapCamera(st.camera, dpr());
    redraw();
  };

  // Default view: the largest zoom where the whole room fits (ZOOM_MIN to ZOOM_MAX, any value), centered.
  // RUN 6 bug 6: on a narrow screen the room is fitted and centred in the area LEFT of the right button column (--side-col), so a small room is not under the buttons.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:var(--side-col, 0px);height:0';
  document.body.appendChild(probe);
  const usableWidth = (): number => {
    const w = app.screen.width;
    return w < 700 ? Math.max(w / 2, w - probe.offsetWidth) : w;
  };
  /** The free height: above the hotbar (and its bag button), so the first view is centred where the player can see and tap. */
  const freeHeight = (): number => {
    const top = document.querySelector('.hotbar')?.getBoundingClientRect().top ?? 0;
    const h = app.screen.height;
    return top > h / 2 && top < h ? top : h;
  };
  const overviewZoom = (): number => fitZoom(usableWidth(), freeHeight(), st.bounds);
  const fit = (): void => {
    intro.cancel();
    setCamera(centerCamera(usableWidth(), freeHeight(), st.bounds, overviewZoom()));
  };
  /** The room intro: overview first, then a zoom in on the avatar (section 4). */
  const startIntro = (): void => {
    fit();
    const zoom = introZoom(overviewZoom(), dpr(), INTRO_DEVICE_PX_PER_ART_PX);
    if (zoom <= st.camera.zoom + 1e-6) return;
    // The settled view keeps the room's furniture (bar, table, stove) centred in the FREE area (left of the button column, above the hotbar) until the first walk.
    const spots = st.items.filter((i) => i.onItemUid === null && !getFurnitureType(i.typeId).wall).map((i) => ({ x: i.x, y: i.y - 16 }));
    const to = snapCamera(firstViewCamera(zoom, st.avatar, spots, usableWidth(), freeHeight(), st.bounds), dpr());
    intro.start(st.camera, to);
  };

  return { intro, redraw, setCamera, overviewZoom, fit, startIntro };
}
