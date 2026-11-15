// Pointer input: camera control, taps, drags (R1 split of main.ts: part 16 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { blockInCell, plantInCell, cellOf, getFurnitureType, screenToWorld, hasSeats, cellsBetween } from '@pixel-hotel/shared';
import { attachCameraControl } from '../input/cameraControl.ts';
import type { G15 } from './ctx.ts';
import { doorGoalAt } from './doorGoal.ts';

export async function setupPointerInput(g: G15) {
  const {
    app, dungeon, setCamera, overviewZoom, dpr, intro, holdTargetAt, lakeside, hold, holdBusyElsewhere, menu,
    steerWalk, panels, cross, label, redraw, updateBlockGhost, placer, paint, roomItem, itemViews, build,
    openMenu, api, applyItems, sound, blockTap, tavernTap, barTap, serveAt, toast, sitOn, walkTo,
    blockers, st,
  } = g;

  app.stage.hitArea = app.screen;
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => (dungeon.isActive ? dungeon.camera : st.camera),
    setCamera: (cam, snap) => (dungeon.isActive ? dungeon.setCamera(cam) : setCamera(cam, snap)),
    getOverviewZoom: overviewZoom,
    getDevicePixelRatio: dpr,
    onGestureStart: () => intro.cancel(),
    onPress: (screen) => {
      const t = holdTargetAt(screen);
      if (!t) return null;
      if (!dungeon.isActive) {
        st.marked = screenToWorld(screen, st.shown);
        st.pendingBlock = null;
        lakeside.cancel();
      }
      hold.start(t);
      return 'repeat';
    },
    onHoldStill: (screen) => {
      if (dungeon.isActive || st.selectedBlock === null || holdBusyElsewhere() || st.room.kind === 'lakeside') return false;
      const { c, r } = cellOf(screenToWorld(screen, st.shown));
      if (blockInCell(st.room, c, r) || plantInCell(st.room, c, r)) return false;
      st.pendingBlock = null;
      hold.start({ kind: 'line', c, r });
      return true;
    },
    onWalkHold: (screen) => {
      if (dungeon.isActive || st.selectedBlock !== null || holdBusyElsewhere() || lakeside.fishing || menu.uid !== null) return false;
      if (hold.active) return false;
      st.walkHold = true;
      st.walkHoldCell = "";
      st.pendingBlock = null;
      lakeside.cancel();
      steerWalk(screen);
      return true;
    },
    onHoldMove: (screen) => {
      if (st.walkHold) {
        steerWalk(screen);
        return;
      }
      if (hold.repeating) {
        const t = holdTargetAt(screen);
        if (t) {
          if (!dungeon.isActive) st.marked = screenToWorld(screen, st.shown);
          hold.retarget(t);
        }
        return;
      }
      const last = hold.lastCell;
      if (!last) return;
      const here = cellOf(screenToWorld(screen, st.shown));
      if (here.c !== last.c || here.r !== last.r) hold.push(cellsBetween(last, here).slice(1));
    },
    onHoldEnd: () => {
      st.walkHold = false;
      hold.stop();
    },
    onPoint: (screen, kind, target) => {
      if (dungeon.isActive) {
        if (kind !== 'tap') return;
        if (panels.open !== null) panels.close();
        else dungeon.tap(screenToWorld(screen, dungeon.camera));
        return;
      }
      st.marked = screenToWorld(screen, st.shown);
      cross.visible = label.visible;
      redraw();
      updateBlockGhost();
      if (kind === 'hover') return;
      // While the line is out every tap on the room is a fishing tap (the bar's ✗ stops).
      if (lakeside.fishing && !placer.active) {
        if (kind === 'tap') {
          if (panels.open !== null) panels.close();
          else lakeside.fishTap();
        }
        return;
      }
      if (paint.active) {
        // Painting floors: a tap paints that cell (a drag paints a rectangle).
        if (kind !== 'tap') return;
        if (panels.open !== null) panels.close();
        else paint.tap(st.marked);
        return;
      }
      if (placer.active) {
        // Placing a new item: a tap on the room puts it there at once when it fits (else the ghost
        // just goes there, red). No extra ✓ needed.
        if (kind !== 'tap' || placer.moving) return;
        placer.moveTo(st.marked);
        if (placer.valid) void placer.place();
        return;
      }
      // The placed item under the pointer, found by Pixi's hit testing (item views are 'static').
      const hit = roomItem(itemViews.uidOf(target));
      if (build.on) {
        // Build mode: taps never walk. A tap or long press on an item opens its menu.
        if (kind === 'tap' && panels.open !== null) {
          panels.close();
          return;
        }
        // A tap on an item selects it (again: lets it go). With an item selected, a tap on a
        // free spot moves it there at once; it shakes when it does not fit there.
        if (hit) {
          if (kind === 'tap' && menu.uid === hit.uid) menu.close();
          else openMenu(hit);
          return;
        }
        const chosen = roomItem(menu.uid);
        if (kind !== 'tap' || !chosen) {
          menu.close();
          return;
        }
        void api.moveItem(chosen.uid, { center: st.marked, facing: chosen.facing, snap: !st.shiftHeld }).then((next) => {
          if (applyItems(next)) sound.play('pop');
          else itemViews.shake(chosen.uid);
        });
        return;
      }
      // Play mode: a long press does nothing; a tap on the room first closes an open panel.
      if (kind === 'longpress') return;
      if (panels.open !== null) {
        panels.close();
        return;
      }
      // Plants and blocks (hold to repeat) come first; the stove walk is dropped by any new tap.
      st.pendingBlock = null;
      st.pendingStove = null;
      st.pendingBarrel = null;
      st.pendingDoor = null;
      st.pendingCask = null;
      lakeside.cancel();
      if (blockTap(st.marked)) return;
      // The lakeside (step 9f): a tree (swing) or the water (cast).
      if (lakeside.tap(st.marked)) return;
      // The tavern (step 9t): a guest with an order, coins or a dish on a table, a brewing barrel.
      if (tavernTap(st.marked, hit)) return;
      // The bar: its Menu panel opens and the avatar walks behind it (the staff spot, like sitting).
      // The register on the bar (step T1) does the same as the bar itself.
      const barItem = hit && getFurnitureType(hit.typeId).till ? roomItem(hit.onItemUid) : hit;
      if (barItem && getFurnitureType(barItem.typeId).servedFromBehind) {
        barTap();
        void serveAt(barItem.uid).then((ok) => {
          if (ok) return;
          itemViews.shake(barItem.uid);
          toast('There is no way to get behind the bar.');
        });
        return;
      }
      // An item with seats: walk to its nearest free side, then sit or lie (it shakes if no seat
      // can be reached). Any other item is ignored: walk to the point (a blocked point walks to
      // the nearest free cell).
      if (hit && hasSeats(getFurnitureType(hit.typeId))) {
        void sitOn(hit.uid, st.marked).then((ok) => ok || itemViews.shake(hit.uid));
        return;
      }
      const to = st.marked;
      void walkTo(to).then((ok) => {
        if (ok) st.pendingDoor = doorGoalAt(st.room, to);
      });
    },
    getDragMode: (target) => {
      if (dungeon.isActive || blockers.on || placer.active || paint.active) return 'draw';
      // Build mode: a drag that starts on an item moves that item (no Move button, no ✓).
      const hit = build.on && panels.open === null ? roomItem(itemViews.uidOf(target)) : undefined;
      if (!hit) return 'pan';
      menu.close();
      placer.startMove(hit.uid);
      return placer.active ? 'draw' : 'pan';
    },
    onDraw: (phase, screen) => {
      const world = screenToWorld(screen, st.shown);
      if (placer.active) {
        const moved = placer.moving ? placer.uid : null;
        placer.drag(phase, world);
        if (phase !== 'end') return;
        // Letting go puts it down. A moved item that does not fit goes back where it was (and
        // shakes); a new item that does not fit stays in the hand.
        if (placer.valid) {
          void placer.place().then(() => {
            // Refused after all (the room changed meanwhile): back where it was.
            if (placer.active && placer.moving) placer.cancel();
            const item = roomItem(moved);
            if (item) openMenu(item); // still selected: Rotate and Pick up are right there
          });
        } else if (moved !== null) {
          placer.cancel();
          itemViews.shake(moved);
        }
      } else if (paint.active) paint.drag(phase, world);
      else if (blockers.on) blockers.draw(phase, world);
    },
  });

  return { control };
}
