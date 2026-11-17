// The cat in the world (CAT HOOK wiring): steps the pet brain every frame while a basket stands in the open room and the cat is adopted,
// keeps its catView in the depth-sorted object layer, and answers a tap on it (purr). Rules: shared/src/pet.ts + petWorld.ts.

import { buildNavGrid, petBasketPoint, petHit, petLivesHere, petTap, petWorldOf, roomBlockers, spawnPet, stepPet, type Point, type PetBrain } from '@pixel-hotel/shared';
import { createCatView, type CatView } from '../render/catView.ts';
import type { G16 } from './ctx.ts';

/** Cap on one step so a stalled frame never teleports the cat. */
const MAX_DT_MS = 100;
/** How often to ask the API whether the cat was adopted (only while a basket stands and no cat yet). */
const ADOPT_POLL_MS = 1000;

export function createCatLife(g: G16) {
  const { api, st, view, toast, sound } = g;
  let adopted = false;
  let name = '';
  let lastPoll = -Infinity;
  let polling = false;
  let roomId = -1;
  let cat: { brain: PetBrain; view: CatView } | null = null;
  let grid: ReturnType<typeof buildNavGrid> | null = null;
  let gridItems: unknown = null;
  let gridRoom: unknown = null;

  const drop = (): void => {
    if (!cat) return;
    view.objects.remove(cat.view.container);
    cat.view.destroy();
    cat = null;
  };

  /** Called each frame with the game clock (ms) and the frame time. */
  function update(dtMs: number, nowMs: number): void {
    if (st.room.id !== roomId) {
      roomId = st.room.id;
      drop(); // the cat stays in its own room: it is made again next to its basket on return
      lastPoll = -Infinity;
    }
    const basket = petBasketPoint(st.items, st.room.id);
    if (!basket) {
      drop();
      return;
    }
    if (!adopted && !polling && nowMs - lastPoll >= ADOPT_POLL_MS) {
      lastPoll = nowMs;
      polling = true;
      void api.getPlayer().then((p) => {
        adopted = p.pet !== null;
        name = p.pet?.name ?? '';
      }).finally(() => { polling = false; });
    }
    if (!petLivesHere(adopted, st.items, st.room.id)) {
      drop();
      return;
    }
    if (st.items !== gridItems || st.room !== gridRoom || !grid) {
      grid = buildNavGrid(st.room, roomBlockers(st.room, st.items));
      gridItems = st.items;
      gridRoom = st.room;
    }
    const w = petWorldOf(grid, { x: st.avatar.x, y: st.avatar.y }, basket);
    if (!cat) {
      const at = { x: basket.x, y: basket.y };
      const v = createCatView();
      cat = { brain: spawnPet(at, nowMs), view: v };
      v.update(cat.brain, nowMs);
      view.objects.add(v.container, { y: v.y, x: cat.brain.x, uid: -9999 });
    }
    cat.brain = stepPet(cat.brain, Math.min(dtMs, MAX_DT_MS), nowMs, Math.random, w);
    cat.view.update(cat.brain, nowMs);
    view.objects.setKey(cat.view.container, { y: cat.view.y, x: Math.round(cat.brain.x), uid: -9999 });
  }

  /** A tap at a world point: true when it hit the cat (it wakes, sits and purrs). */
  function tap(p: Point, nowMs: number): boolean {
    if (!cat || !petHit(cat.brain, p)) return false;
    cat.brain = petTap(cat.brain, nowMs, Math.random);
    toast(`${name || 'The cat'} purrs.`);
    sound.play('pop');
    return true;
  }

  return { update, tap };
}
