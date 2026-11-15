// The frame loop and the start of play (R1 split of main.ts: part 17 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { AVATAR_H, WALK_BOB_MS, tillPoint, getFurnitureType, walkAvatar, worldToScreen, type Point } from '@pixel-hotel/shared';
import { avatarDepthKey } from '../render/depthOrder.ts';
import type { G16 } from './ctx.ts';

export async function setupGameLoop(g: G16) {
  const {
    app, fit, dungeon, control, hold, panels, build, intro, setCamera, seating, roomItem, itemViews, customers,
    guests, hops, lakeside, roomFloats, placer, sprite, sound, atmosphere, view, blockViews, plantViews,
    doBlock, placeBar, menu, orders, bubbles, popups, gemFly, floats, tillCoins, splashGone, openRoom,
    playNewGameIntro, stoveArrived, barrelArrived, api, setDungeonMode, notice, toast, st,
  } = g;

  app.renderer.on('resize', fit);
  // Browser zoom or moving to another monitor changes the device pixel ratio: render at the new one.
  window.addEventListener('resize', () => {
    const next = window.devicePixelRatio || 1;
    if (next !== app.renderer.resolution) app.renderer.resize(window.innerWidth, window.innerHeight, next);
  });
  let clockMs = 0;
  const heads = new Map<number, Point>();
  /** The avatars that stand or walk on the floor (their shadows). */
  const feet: Point[] = [];
  let lastStepBeat = 0;
  app.ticker.add((ticker) => {
    if (dungeon.isActive) {
      control.update(ticker.deltaMS);
      hold.tick();
      dungeon.frame(ticker.deltaMS);
      return;
    }
    if (hold.active && (panels.open !== null || build.on)) hold.stop();
    hold.tick();
    const step = intro.update(ticker.deltaMS, app.screen.width, app.screen.height);
    if (step) setCamera(step.camera, step.done);
    control.update(ticker.deltaMS);
    clockMs += ticker.deltaMS;
    if (!seating.busy) ({ avatar: st.avatar, path: st.path } = walkAvatar(st.avatar, st.path, ticker.deltaMS));
    // Arrived at the seat's approach point: take the pose and slide onto the seat.
    if (st.path.length === 0 && seating.goal !== null) st.avatar = seating.arrive(st.avatar, roomItem(seating.goal.uid));
    st.avatar = seating.update(st.avatar, ticker.deltaMS);
    itemViews.update(ticker.deltaMS);
    customers.update(ticker.deltaMS, clockMs);
    guests.update(ticker.deltaMS, clockMs);
    hops.update(ticker.deltaMS);
    lakeside.update(ticker.deltaMS, clockMs);
    if (st.path.length === 0 && st.avatar.state !== 'walk') lakeside.arrived();
    roomFloats.update(ticker.deltaMS, (p) => worldToScreen(p, st.shown));
    placer.tick(ticker.deltaMS);
    sprite.update(st.avatar, clockMs);
    // Soft footsteps, one per bob of the walk.
    const beat = Math.floor(clockMs / (WALK_BOB_MS * 2));
    if (st.avatar.state === 'walk' && beat !== lastStepBeat && sprite.container.visible) sound.play('step');
    lastStepBeat = beat;
    feet.length = 0;
    if (sprite.container.visible && (st.avatar.state === 'walk' || st.avatar.state === 'idle')) feet.push(st.avatar);
    customers.feet(feet);
    guests.feet(feet);
    atmosphere.update(ticker.deltaMS, clockMs, feet);
    view.objects.setKey(sprite.container, avatarDepthKey(st.avatar, roomItem(seating.seated?.uid ?? null)));
    blockViews.sync(st.room, Date.now());
    blockViews.update(ticker.deltaMS);
    plantViews.sync(st.room, Date.now());
    plantViews.update(ticker.deltaMS, clockMs);
    if (st.pendingStove !== null && st.path.length === 0 && st.avatar.state !== 'walk') {
      const uid = st.pendingStove;
      st.pendingStove = null;
      void stoveArrived(uid);
    }
    if (st.pendingBarrel !== null && st.path.length === 0 && st.avatar.state !== 'walk') {
      const uid = st.pendingBarrel;
      st.pendingBarrel = null;
      void barrelArrived(uid);
    }
    if (st.pendingBlock && st.path.length === 0 && st.avatar.state !== 'walk') {
      const p = st.pendingBlock;
      st.pendingBlock = null;
      // A press still held goes on hitting by itself; only a released tap needs this one hit.
      if (!hold.active) void doBlock(p.kind, p.c, p.r, st.selectedBlock, p.tries);
    }
    view.update();
    // The floating bars and bubbles follow the ghost, the item and the avatar (the camera may move).
    // The ✓ ↻ ✗ bar is only for a new item; an item being dragged is put down by letting go.
    placeBar.update(placer.moving ? null : placer.screenBounds(), placer.valid);
    menu.follow(menu.uid === null ? null : itemViews.screenBounds(menu.uid));
    heads.clear();
    heads.set(st.avatar.id, worldToScreen({ x: st.avatar.x, y: st.avatar.y - AVATAR_H }, st.shown));
    customers.heads(heads, AVATAR_H);
    guests.heads(heads, AVATAR_H);
    for (const [id, p] of heads) if (id < 0) heads.set(id, worldToScreen(p, st.shown));
    orders.update(heads);
    bubbles.update(ticker.deltaMS, heads);
    popups.update(heads.get(st.avatar.id) ?? null);
    gemFly.update(heads.get(st.avatar.id) ?? null);
    floats.update(ticker.deltaMS, (p) => worldToScreen(p, st.shown));
    // Behind the counter: face the customers.
    if (st.serving?.state === 'walking' && st.path.length === 0) {
      st.serving = { ...st.serving, state: 'there' };
      st.avatar = { ...st.avatar, facing: st.serving.facing };
    }
    // Someone waits at the till and nobody serves: a coin marker above the till.
    const counterItem = st.room.id === st.shop.roomId ? st.items.find((i) => i.roomId === st.room.id && getFurnitureType(i.typeId).servedFromBehind) : undefined;
    const waiting = counterItem !== undefined && st.serving?.state !== 'there' && st.shopCustomers.some((c) => c.phase === 'pay');
    tillCoins.update(ticker.deltaMS, (p) => worldToScreen(p, st.shown), waiting && counterItem ? tillPoint(counterItem) : null);
  });

  await splashGone;
  await openRoom(st.room.id, !st.introPending);
  if (st.introPending) await playNewGameIntro();
  // A run in the save (step 9): back into the dungeon, paused until Resume.
  const saved = await api.getRun();
  if (saved) {
    setDungeonMode(true);
    void dungeon.enter(saved.run, saved.paused);
  }
  if (notice) toast(notice);

  return {};
}
