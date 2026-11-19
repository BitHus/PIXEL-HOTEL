// Pointer input: camera control, taps, drags (R1 split of main.ts: part 16 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { playCameraLocked, blockInCell, plantInCell, cellOf, getFurnitureType, screenToWorld, hasSeats, cellsBetween, isUsable, tapTolerance, type FurnitureItem, type Point } from '@pixel-hotel/shared';
import { createItemUse } from './itemUse.ts';
import { attachCameraControl } from '../input/cameraControl.ts';
import type { G15 } from './ctx.ts';
import { doorGoalAt, doorWalkGoal, walkDoorGoal } from './doorGoal.ts';
import { createTapForgive, isTouchInput } from './tapForgive.ts';

export async function setupPointerInput(g: G15) {
  const {
    app, dungeon, setCamera, overviewZoom, dpr, intro, holdTargetAt, lakeside, hold, holdBusyElsewhere, menu,
    steerWalk, panels, cross, label, redraw, updateBlockGhost, placer, paint, roomItem, itemViews, build,
    openMenu, api, applyItems, sound, blockTap, tavernTap, barTap, serveAt, toast, sitOn, walkTo,
    blockers, st, pourControl, late, stackTapAt, prefs,
  } = g;
  /** True while a press belongs to the pour (the hold on the tap stand): it never walks, pans or hits. */
  let pourClaim = false;
  const { nearTap, buildPick } = createTapForgive({ st, itemViews, late });

  const useTap = createItemUse({ api, applyItems, toast, sound, panels });
  app.stage.hitArea = app.screen;
  /** The use of a tapped piece (tavern things, bar, usable decor, seats). True = the tap was used; false = it did nothing (the caller walks). */
  const useHit = (hit: FurnitureItem | undefined, world: Point): boolean => {
    // The tavern (step 9t): a guest with an order, coins or a dish on a table, a brewing barrel.
    if (tavernTap(world, hit)) return true;
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
      return true;
    }
    // A usable piece (lamp, fire, music box, clock, mirror, pet basket, darts, dice; step 9g-2): the tap uses it.
    if (hit && isUsable(getFurnitureType(hit.typeId)) && !hasSeats(getFurnitureType(hit.typeId))) {
      useTap(hit);
      return true;
    }
    // An item with seats: walk to its nearest free side, then sit or lie (it shakes if no seat
    // can be reached). Any other item is ignored: walk to the point (a blocked point walks to
    // the nearest free cell).
    if (hit && hasSeats(getFurnitureType(hit.typeId))) {
      void sitOn(hit.uid, world).then((ok) => ok || itemViews.shake(hit.uid));
      return true;
    }
    return false;
  };
  const control = attachCameraControl(app.stage, app.canvas, {
    getCamera: () => (dungeon.isActive ? dungeon.camera : st.camera),
    setCamera: (cam, snap) => (dungeon.isActive ? dungeon.setCamera(cam) : setCamera(cam, snap)),
    getOverviewZoom: overviewZoom,
    getDevicePixelRatio: dpr,
    // CAM-LOCK v2 (owner 19 Nov): always locked in play mode; only Look around (More) or build mode lets a drag pan.
    isCameraLocked: () => playCameraLocked({ dungeon: dungeon.isActive, build: build.on, paint: paint.active, placing: placer.active, lookAround: st.lookAround }),
    onGestureStart: () => {
      intro.cancel();
    },
    // First-steps guide: the player zoomed, or a press became a real hold-walk.
    onZoomGesture: () => late.guideEvent('zoom'),
    onHoldWalkConfirmed: () => {
      if (!dungeon.isActive) late.guideEvent('holdwalk');
    },
    onPress: (screen) => {
      // G2: while the avatar waits at the taps, a press on the stand (or near it) is the pour: hold = pour, release = done.
      if (!dungeon.isActive && !build.on && !paint.active && !placer.active && !lakeside.fishing && pourControl.claims(screen)) {
        pourClaim = true;
        st.pendingBlock = null;
        pourControl.down(screen);
        return 'repeat';
      }
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
      st.pendingBlock = null;
      // ST2: a tap on a block stacks the selected one; holding still on it punches it (the hold hits from now on).
      if (blockInCell(st.room, c, r) && !plantInCell(st.room, c, r)) {
        if (!stackTapAt(c, r)) return false;
        hold.start({ kind: 'block', c, r });
        return true;
      }
      if (plantInCell(st.room, c, r)) return false;
      hold.start({ kind: 'line', c, r });
      return true;
    },
    onWalkHold: (screen, target, early) => {
      // Dungeon: holding still walks toward the pointer and follows it (moves steer, never hit; the fight stays one hit per tap).
      if (dungeon.isActive) {
        if (panels.open !== null) return false;
        st.walkHold = true;
        dungeon.steer(null);
        dungeon.steer(screenToWorld(screen, dungeon.camera));
        return true;
      }
      if (st.selectedBlock !== null || holdBusyElsewhere() || lakeside.fishing || menu.uid !== null) return false;
      if (hold.active || st.lookAround) return false; // Look around: a drag never walks
      // A3: a press on the pond never hold-walks (it used to head for the nearest free cell by straight line, often the far shore): the tap casts.
      if (lakeside.waterUnder(screenToWorld(screen, st.shown))) return false;
      // OA-1: on press only free floor starts a walk at once (a press on an item or a build/placing state waits for its tap).
      if (early && (roomItem(itemViews.uidOf(target ?? null)) || placer.active)) return false;
      st.walkHold = true;
      st.walkHoldCell = "";
      st.pendingBlock = null;
      lakeside.cancel();
      steerWalk(screen);
      return true;
    },
    onWalkCancel: () => {
      // The early walk became a drag: in rooms it pans, so the walk stops (the dungeon drag steers instead).
      if (dungeon.isActive) return;
      st.walkHold = false;
      g.stop();
    },
    onHoldMove: (screen) => {
      if (pourClaim) return;
      if (st.walkHold) {
        if (dungeon.isActive) dungeon.steer(screenToWorld(screen, dungeon.camera));
        else steerWalk(screen);
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
      if (pourClaim) {
        pourClaim = false;
        pourControl.up();
        return;
      }
      st.walkHold = false;
      dungeon.steer(null);
      hold.stop();
    },
    onPoint: (screen, kind, target) => {
      if (dungeon.isActive) {
        if (kind !== 'tap') return;
        if (panels.open !== null) panels.close();
        else dungeon.tap(screenToWorld(screen, dungeon.camera), tapTolerance(isTouchInput()) / dungeon.camera.zoom);
        return;
      }
      st.marked = screenToWorld(screen, st.shown);
      cross.visible = label.visible;
      // A plain mouse hover only needs the redraw for the debug cross and label (the camera did not move).
      if (kind !== 'hover' || label.visible) redraw();
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
      // A2: in build mode a small piece (candle, lamp, wall item, anything on a surface) is found with a touch box, ahead of the big piece it sits on or in front of.
      const hit = build.on && panels.open === null ? (buildPick(screen) ?? roomItem(itemViews.uidOf(target))) : roomItem(itemViews.uidOf(target));
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
      if (late.catTap(st.marked)) return;
      if (blockTap(st.marked)) return;
      // The lakeside (step 9f): a tree (swing) or the water (cast).
      if (lakeside.tap(st.marked)) return;
      // Tap forgiveness (owner 18 Nov): what was hit exactly is used first; a tap that hit nothing uses the nearest usable thing within a small radius
      // (shared/src/tapPick.ts); a tap far from everything still walks.
      if (useHit(hit, st.marked)) return;
      // Owner bug 19 Nov ('all doors do nothing'): a tap on the door picture (wall band), beside it or just in front of it walks onto the spot and enters.
      // A door beats tap forgiveness (a stool or barrel near the door must not steal the tap); an exact hit on an item still wins.
      const doorMargin = tapTolerance(isTouchInput()) / st.shown.zoom;
      const onDoor = !hit && doorGoalAt(st.room, st.marked, doorMargin) !== null;
      if (!hit && !onDoor) {
        const near = nearTap(screen);
        if (near && (near.kind === 'item' ? useHit(near.item, st.marked) : tavernTap(near.world, undefined))) return;
      }
      const to = onDoor ? doorWalkGoal(st.room, st.marked, doorMargin) : st.marked;
      void walkTo(to).then((ok) => {
        const door = walkDoorGoal(st.room, to, ok, true);
        if (door !== null) st.pendingDoor = door;
      });
    },
    getDragMode: (target, start) => {
      if (dungeon.isActive || blockers.on || placer.active || paint.active) return 'draw';
      // Build mode: a drag that starts on an item moves that item (no Move button, no ✓).
      const hit = build.on && panels.open === null ? (buildPick(start) ?? roomItem(itemViews.uidOf(target))) : undefined;
      if (!hit) return 'pan';
      menu.close();
      placer.startMove(hit.uid);
      return placer.active ? 'draw' : 'pan';
    },
    onDraw: (phase, screen) => {
      // Dungeon: a quick drag never pans (the camera follows the avatar); it steers the walk like a hold.
      if (dungeon.isActive) {
        if (panels.open !== null) return;
        dungeon.steer(phase === 'end' ? null : screenToWorld(screen, dungeon.camera));
        return;
      }
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
