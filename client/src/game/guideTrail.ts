// R16 GUIDE TRAIL (19 Nov): footstep dots on the floor from the avatar to the first-steps guide's world target (st.guideWorld, set by guideWorld.ts).
// The path is the avatar's own walk path (shared findPath on the room grid), re-made only when the avatar's cell, the target cell or the furniture
// change; the dots (shared trailDots: spacing, fade, stepped pulse) are drawn as crisp whole-pixel squares in the floor's grid layer (under items).

import { BUILD_CELL, buildNavGrid, findPath, paletteColor, roomBlockers, trailDots, type Point } from '@pixel-hotel/shared';
import { Graphics } from 'pixi.js';
import type { G16 } from './ctx.ts';

const DOT = paletteColor('cream');
const BRIGHT = paletteColor('butter');
const SHADE = paletteColor('outline');

export function createGuideTrail(g: G16): { update(nowMs: number): void } {
  const { view, st, panels, build, dungeon, prefs } = g;
  const gfx = new Graphics({ eventMode: 'none' });
  view.gridLayer.addChild(gfx);
  let key = '';
  let path: Point[] | null = null;
  let drawnKey = '';

  const cell = (p: Point): string => `${Math.floor(p.x / BUILD_CELL)},${Math.floor(p.y / BUILD_CELL)}`;

  return {
    update(nowMs: number): void {
      const target = st.guideWorld ?? null;
      const show = target !== null && !dungeon.isActive && panels.open === null && !build.on;
      if (!show) {
        if (drawnKey !== '') {
          gfx.clear();
          drawnKey = '';
        }
        return;
      }
      const k = `${st.room.id}|${cell(st.avatar)}|${cell(target)}|${st.items.length}`;
      if (k !== key) {
        key = k;
        path = findPath(buildNavGrid(st.room, roomBlockers(st.room, st.items)), st.avatar, target);
      }
      // Live start: the path's first point is the avatar's feet now (smooth while walking).
      const live = path && path.length > 1 ? [{ x: st.avatar.x, y: st.avatar.y }, ...path.slice(1)] : null;
      const dots = trailDots(live, prefs.reduceEffects ? 0 : nowMs);
      const dk = dots.map((d) => `${d.x},${d.y},${d.alpha},${d.bright ? 1 : 0}`).join(';');
      if (dk === drawnKey) return;
      drawnKey = dk;
      gfx.clear();
      for (const d of dots) {
        const w = d.bright ? 3 : 2;
        const x = d.x - 1;
        const y = d.y - 1;
        gfx.rect(x + 1, y + 1, w, w).fill({ color: SHADE, alpha: d.alpha * 0.6 }); // a 1 px drop shadow down-right (light top-left)
        gfx.rect(x, y, w, w).fill({ color: d.bright ? BRIGHT : DOT, alpha: d.alpha });
      }
    },
  };
}
