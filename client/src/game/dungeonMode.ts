// Entering the dungeon and the mine (R1 split of main.ts: part 13 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { MINE_UNLOCK_LEVEL, type FoodId, DUNGEON_KEY_COST, bonusesOf, lunchBoxMaxOf } from '@pixel-hotel/shared';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { createLunchPicker } from '../ui/lunchPicker.ts';
import type { G12 } from './ctx.ts';

export async function setupDungeonMode(g: G12) {
  const {
    uiRoot, view, backdrop, sprite, paint, hotbar, runBar, info, lakeside, panels, placer, menu, build,
    bubbles, cross, dungeon, api, refreshInventory, refreshHint, toast, st, late,
  } = g;
  late.setDungeonMode = setDungeonMode;
  late.enterDungeonAsked = enterDungeonAsked;
  late.enterMineAsked = enterMineAsked;

  // ---------- The dungeon (step 9) ----------
  /** Switches the screen between a room and the dungeon (the UI hides what does not belong). */
  function setDungeonMode(on: boolean): void {
    uiRoot.classList.toggle('in-dungeon', on);
    view.world.visible = !on;
    backdrop.container.visible = !on && st.lightingOn;
    backdrop.refresh();
    sprite.container.visible = !on;
    if (on) paint.end();
    hotbar.setHidden(on);
    runBar.setHidden(!on);
    if (!on) info.setRun(null);
    if (on) {
      lakeside.stop();
      panels.close();
      placer.cancel();
      menu.close();
      build.set(false);
      bubbles.clear();
      cross.visible = false;
    }
  }
  /** The Dungeon button: asks first (the key costs 10 gold, free under 10), then goes in. */
  async function enterDungeonAsked(): Promise<void> {
    if (dungeon.isActive) return;
    const p = await api.getPlayer();
    const free = p.wallet.gold < DUNGEON_KEY_COST;
    const detail = free ? 'A free run, because you have less than 10 gold. Fight, open chests, bring the loot home.' : 'The key costs 10 gold. Fight, open chests, bring the loot home.';
    // Step 9b: pick up to 3 food items for the lunch box.
    const lunch = createLunchPicker(p.materials, lunchBoxMaxOf(bonusesOf(p)));
    if (!(await confirmBuy(uiRoot, { name: 'The crypt', detail, price: free ? null : DUNGEON_KEY_COST, yes: 'Enter', extra: lunch.el }))) return;
    const run = await api.dungeonStart(lunch.chosen() as FoodId[]);
    if (!run) return;
    await refreshInventory();
    await refreshHint();
    setDungeonMode(true);
    await dungeon.enter(run, false);
  }

  /** The mine (step 9c): free from level 3; asks first, then goes in (the same screen as the dungeon). */
  async function enterMineAsked(): Promise<void> {
    if (dungeon.isActive) return;
    const p = await api.getPlayer();
    if (p.level < MINE_UNLOCK_LEVEL) {
      toast(`The mine opens at level ${MINE_UNLOCK_LEVEL}.`);
      return;
    }
    const detail = 'Free. Dig through the rock with your pickaxe: tap a block, or hold to keep digging. Find the exit, mind the cracking floor, and leave any time with everything.';
    if (!(await confirmBuy(uiRoot, { name: 'The mine', detail, price: null, yes: 'Enter' }))) return;
    const run = await api.mineStart();
    if (!run) return;
    await refreshInventory();
    await refreshHint();
    setDungeonMode(true);
    await dungeon.enter(run, false);
  }

  return { setDungeonMode };
}
