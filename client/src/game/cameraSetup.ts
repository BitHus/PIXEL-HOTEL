// The camera and its intro (R1 split of main.ts: part 5 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  INTRO_DEVICE_PX_PER_ART_PX, cameraAt, centerCamera, clampCamera, containCamera, fitZoom, introZoom, snapCamera,
  worldToScreen, type Camera,
} from '@pixel-hotel/shared';
import { CameraIntro } from '../input/cameraIntro.ts';
import type { G4 } from './ctx.ts';

export async function setupCameraSetup(g: G4) {
  const { dpr, backdrop, app, view, cross, label, st } = g;

  /** Camera state (unsnapped, so zooming never drifts). */
  st.camera = { x: 0, y: 0, zoom: 1 };
  /** What is on screen: the camera snapped to whole device px. */
  st.shown = st.camera;
  /** World point marked by the cross (under the mouse, or the last tap). */
  st.marked = null;
  const intro = new CameraIntro();

  const redraw = (): void => {
    st.shown = snapCamera(st.camera, dpr());
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
  const overviewZoom = (): number => fitZoom(app.screen.width, app.screen.height, st.bounds);
  const fit = (): void => {
    intro.cancel();
    const w = app.screen.width;
    const h = app.screen.height;
    setCamera(centerCamera(w, h, st.bounds, overviewZoom()));
  };
  /** The room intro: overview first, then a zoom in on the avatar (section 4). */
  const startIntro = (): void => {
    fit();
    const w = app.screen.width;
    const h = app.screen.height;
    const zoom = introZoom(overviewZoom(), dpr(), INTRO_DEVICE_PX_PER_ART_PX);
    if (zoom <= st.camera.zoom + 1e-6) return;
    const to = snapCamera(containCamera(cameraAt(st.avatar, zoom, w, h), w, h, st.bounds), dpr());
    intro.start(st.camera, to);
  };

  return { intro, redraw, setCamera, overviewZoom, fit, startIntro };
}
