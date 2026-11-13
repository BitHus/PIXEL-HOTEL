# Next steps (after step 9)

Order: playtest step 9 first (the fun test: 5 dungeon runs in a row), then 9b (farm), then 9c
(mine), then round 2 of the dungeon, then step 6 (art), then online (step 10 and later).
The rules for the farm and the mine are in CLAUDE.md sections 10b and 10c, and the UI in
docs/UI-REFERENCE.md. Each prompt below is pasted into a fresh Claude Code session.

## Step 9b - Farm

```
STEP 9b - Farm and cooking
Do only this step. Follow CLAUDE.md section 10b and docs/UI-REFERENCE.md (Travel / Map and
Farm). Keep everything that works as it is.
If this is too much for one session, do it in parts and stop after each: A) shared rules
(crops.json, food.json, plots, growth, planting, harvesting, cooking) with tests. B) the farm
place, the plots and the travel panel. C) the cooking pot, seeds in the catalog, food in the
dungeon, hints.

Build:
- shared/data/crops.json and shared/data/food.json with the numbers from section 10b.
- shared/farm.ts: plots (fixed positions per farm level from config), plant(plot, seed, now),
  stageOf(plot, now) (sprout, half, ripe), harvest(plot, now, rng) (1 to 2 crops), and the
  farm upgrade through the same economy function and ledger as rooms. No Date.now inside.
- The farm as a third place (kind 'farm'): grass floor, a fence or hedge band in place of the
  back wall, the door at the bottom, plots drawn as tilled soil with the crop stage on top
  (placeholder boxes in crop colours), a ripe marker. Decorations can be placed in build mode
  around the plots, never on them.
- Planting and harvesting by tapping, as in section 10b. Seeds in a new Seeds tab of the
  catalog. The glowcap spore as a 5% drop from dungeon chests.
- The cooking pot at a fixed spot; tapping it opens the Cooking panel (recipes, ingredients
  owned, Cook button). Food stacks in the bag.
- Dungeon: a lunch box of up to 3 food items chosen before the run (a small picker in the
  dungeon start panel), a food button in the run HUD, healing with the potion cooldown, buffs
  once per kind per run, food lost on death.
- Crops and food are shop goods (category 'food').
- The travel panel (Map button) from docs/UI-REFERENCE.md replaces the Hotel/Shop switcher:
  cards for Hotel, Shop, Farm, Mine (locked until level 3, greyed with the reason) and
  Dungeon, each with a short status line.
- A first-run hint for the farm: plant your first turnip.
- Save migration: old saves get a level 1 farm with empty plots.

Tests: growth stages follow the times in crops.json, also across a save and reload; a plot
cannot be planted twice; harvest only when ripe and gives 1 to 2 crops; cooking needs all
ingredients and removes them exactly once; the lunch box holds at most 3; each buff applies
once per run; food in the lunch box is lost on death; farm upgrades keep the plots and add
new ones; the ledger still adds up.

Done when: I can travel to my farm, plant turnips, come back later and harvest them, cook a
stew, take it into the dungeon and eat it to heal. Update CLAUDE.md (current state).
Commit "step 9b done" and push.
```

## Step 9c - Mine and forge

```
STEP 9c - Mine and forge
Do only this step. Follow CLAUDE.md sections 10 and 10c and docs/UI-REFERENCE.md (Mine).
Reuse the dungeon code (blocks, step() in 100 ms ticks, the view, fog, input) wherever you
can; do not copy it. Keep everything that works as it is.
If this is too much for one session, do it in parts and stop after each: A) shared rules
(mine layout, rocks, mining, lantern, ore, forge.json, smelting, upgrades) with tests. B) the
mine view and the visit flow. C) the Forge tab, gear changes in the dungeon, the travel card,
the simulation.

Build:
- shared/mine/: a small layout from a seed (2 to 3 rooms, 32 px blocks), rocks by type (copper,
  iron, mithril from visit 5), 0 to 1 slime or bat per room, the lantern timer (4 minutes in
  config), mining with a 400 ms pickaxe cooldown and hits per rock type, drops (1 to 2 ore,
  5% gem), losing half the visit's ore at 0 hp, leaving early or when the lantern runs out.
  All deterministic with time and rng passed in.
- shared/data/forge.json and shared/forge.ts: smelting (3 ore + fee -> 1 bar), the sword,
  armor and pickaxe tiers from section 10c (each upgrade needs the previous piece and
  replaces it), applied to the dungeon's attack range and damage taken. The Blacksmith stops
  selling the iron_sword and leather_armor; potions stay. Old saves that bought them keep
  them (map iron_sword to the iron sword tier, leather_armor to leather armor).
- The mine place: entered from the travel panel (unlocked at player level 3, with a hint
  when it opens). Same view style as the dungeon with a cooler rocky look, rocks as
  placeholder boxes in ore colours that crack per hit, the lantern bar in the info panel, the
  run bag with ore stacks, a Leave button. A summary when the visit ends.
- The Workshop gets a Forge tab (smelting and the upgrade tree, as in docs/UI-REFERENCE.md).
- Ore, bars and gems are shop goods (category 'materials').
- tools/simulate-dungeon.ts: add the gear tiers and food, and print survival for each tier
  (starting gear, copper, iron, mithril) at the three bot speeds.

Tests: the same seed gives the same mine; rocks need the right number of hits and the steel
pickaxe counts double; mithril rocks need the steel pickaxe; the lantern ends the visit and
keeps all ore; 0 hp loses exactly half the visit's ore (rounded down) and nothing else;
smelting needs 3 ore and the fee; upgrades need the previous tier and replace it; the
dungeon uses the new attack range and damage reduction; the ledger still adds up.

Done when: at level 3 I can go mining, tap rocks to break them, bring ore home, smelt bars,
upgrade my sword, and feel the difference in the dungeon. Show me the simulation output per
gear tier. Update CLAUDE.md (current state). Commit "step 9c done" and push.
```

## After 9c

- Turn on dungeon round 2 (DUNGEON_ROUND = 2) and play it. Tune with the simulation.
- Step 6 (art): the sprite list now also needs farm tiles, crops in 3 stages, the cooking pot,
  food icons, mine blocks, rocks (3 types, cracked states), ore, bars, gems, the lantern, and
  the gear tiers as icons.
- Then step 10 (online).
