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

# Plan after the UI polish (owner's wishes, 14 Nov)

New order: 9d (shop life) -> atmosphere step (light, shadows, sound; prompt at the end) -> 9e
(ranks and the collection book) -> 9f (lakeside: fishing and woodcutting) -> 9g (a livelier
hotel: hats, emotes, visitors) -> 9h (more dungeon types, with round 2) -> 9i (the questline)
-> step 6 (art) -> step 10 (online). One step per fresh Claude Code session. Every step that
changes a rule in CLAUDE.md updates the brief and notes it as the owner's decision. From 9i on,
every new feature also adds its quests.

## Step 9d - Shop life

```
Step 9d: shop life (owner's decisions; they change section 9 of CLAUDE.md: update the brief). Read CLAUDE.md and docs/UI-REFERENCE.md first. Only what is listed here.

1. NO AUTO-SELLING. Nothing is ever sold without the player at the till. Remove the offline simulation and the "while you were away" summary (simulateShop / catchUpShop sales). New rule: customers keep coming at the normal rate while the player is somewhere else or the game is closed, each takes an item and joins the queue, but the queue holds at most QUEUE_MAX = 3 (was 5). When 3 wait, no new customers come. Gold only comes in when the player stands behind the counter and serves. When the game opens after a break: fill the queue with what would have arrived (max 3, maths only, no walking), customers stand at their queue spots. Waiting customers never leave on their own (v1). The Map panel's Shop card and the Map button show "n waiting" (a small badge). Update the economy simulation tool to the new rule.
2. NATURAL CUSTOMERS. Each customer gets a random look from the free clothing and LOOK_COLORS (seeded by its id) and a type: 'hurried' (walks 20% faster, short browse), 'browser' (looks at 2-3 things, also at decorations), 'chatty' (talks more). They do not walk in straight to the shelf every time: sometimes they stop and look at a decoration (a plant, a rug, a banner) first, turn to face what they look at, shift their weight while waiting (small idle moves), and face the counter in the queue. If a free seat is next to the queue, a waiting customer may sit.
3. TALK. Speech bubbles with short lines from shared/data/npcLines.json, by moment: enter, browse, reaction (cheap / fair / a bit high / too high; shown with the face), queue ("Hello? Anyone here?" after a while), pay, leave, and remarks about the shop (high appeal: "What a lovely shop!", empty shelves: "Not much left..."). At least 6 lines per moment, picked with the rng passed in, never the same line twice in a row. Not every customer talks every time (chance per moment in config). Bubbles follow the reading-pace rule. All lines original, friendly, short (max 40 characters).
4. TAKE AND GIVE ANIMATIONS (client only). Taking: the customer reaches (a small arm move), the item hops from the slot into their hands in an arc (about 300 ms) and is then carried as the held-item layer (section 8). Paying: the customer puts the item on the counter (hop), coins hop to the till as now, the item hops back to the customer, who gives a small nod and leaves carrying it. The player's avatar makes a small "hand over" move while serving.
5. QUEST CARD: it must open and close smoothly (the same short pop as panels, about 120 ms, no jump in position or size; respect prefers-reduced-motion). Find why it stutters now and fix the cause.
Plan first (max 8 lines). Tests for the new shop rules (queue cap, no gold without serving, the catch-up fill, line picking). Bump SAVE_VERSION with a migration if the state changes. Run typecheck and tests, update CLAUDE.md, commit and push, tell me what to try on my phone.
```

## Step 9e - Ranks and the collection book

```
Step 9e: ranks and the collection book (owner's decision; update CLAUDE.md sections 7 and 10). Read CLAUDE.md and docs/UI-REFERENCE.md first.

1. RANKS. Four ranks for every item, material, crop, food, ore, gem and furniture type: common, rare, ultra_rare, legendary (replaces 'common' | 'uncommon' | 'rare' | 'epic'; migrate the data: uncommon -> rare, rare -> ultra_rare, epic -> legendary). Each rank has a colour (palette indices in config RANK_COLORS: grey-brown, blue, purple, gold) used as the slot border and the name colour everywhere an item is shown, and a short sparkle on the drop text for ultra_rare and legendary.
2. DROPS BY RANK. Loot tables get a rank per drop, and config RANK_WEIGHTS gives the base odds when a table rolls a rank: common 75%, rare 20%, ultra_rare 4.5%, legendary 0.5%. Golden chests, mimics and bosses shift these (data: a multiplier per table). Every enemy type gets its own small drop table in loot.json with one drop per rank (new materials, original names: for example slime: slime gel (common), sticky core (rare), royal jelly (ultra_rare), slime crown (legendary); do the same for bat, skeleton, mimic and the Bone King). Enemy drop chance per kill stays RARE_DROP_CHANCE for now but the table decides the rank. The new materials sell in the shop and at least one new craft recipe per enemy uses them (a trophy or a piece of furniture). Run the dungeon simulation and print how many kills each rank needs on average.
3. THE BOOK. A new panel "Book" (an icon in the More menu, key J): tabs Materials, Furniture, Food and crops, Enemies. One card per entry in a grid. Never seen: a grey silhouette and "???". Seen (dropped, bought, crafted, harvested, or for enemies: met): the icon in colour, name, rank colour, how many found in total, and where it comes from ("Drops from: Slime", "Catalog", "Crafted", "Farm"). Enemies show kills and their drop list, with drops never found yet as grey "???". A header shows "n / N found" per tab and a total percentage. A small "New!" mark on entries first seen since the book was last opened, and a dot on the Book button.
4. State: Player.seen (a set of ids with counts and firstSeenAt), updated through the one ledger function and the kill event, so it is always right. Old saves: everything the player owns now counts as seen.
5. Rewards for filling the book (data): 25%, 50%, 75%, 100% of a tab gives gold and later a hat (step 9g fills in the hats; leave the reward list ready).
Plan first (max 8 lines). Tests for rank rolls, the seen list and the migration. Run typecheck and tests, update CLAUDE.md and docs/UI-REFERENCE.md, commit and push, tell me what to try.
```

## Step 9f - Lakeside: fishing and woodcutting

```
Step 9f: the Lakeside (owner's decision; add section 10d to CLAUDE.md). A new outdoor place on the Map, open from the start: grass, a lake taking up about a third, a short wooden pier, 8 trees, bushes. Same top-down renderer as the farm (kind 'lakeside'), not buildable in v1. Read CLAUDE.md and docs/UI-REFERENCE.md first. Ranks and the Book from step 9e are used everywhere.

1. WOODCUTTING. Tap a tree: the avatar walks next to it and swings; each tap is one hit with a 400 ms axe cooldown (tapping is the game). A tree falls after 5 hits and gives 2 to 3 wood, plus by rank: resin (rare), amber (ultra_rare), golden acorn (legendary). A stump is left and the tree grows back after 5 minutes of real time (time passed in, also while the game is closed). Wood stays a dungeon drop too. Axe tiers at the forge: basic axe (start), steel axe (bars; each hit counts double).
2. FISHING. Tap the water (from the shore or the pier): the avatar walks to the nearest shore spot and casts. A bobber floats for 2 to 8 s (rng), then dips with a "!" for 700 ms: tap in time to hook. Then the reel: a bar fills by tapping fast and drains over time; fill it before the fish escapes. Rank sets the strength: common is easy, legendary needs fast tapping and has a short window. Missing loses nothing. All timing in a pure function step(session, inputs, dtMs, rng) in shared/, 100 ms ticks, like the dungeon.
3. CATCHES (shared/data/fish.json, original names): at least 12 fish over the four ranks (5 common, 4 rare, 2 ultra_rare, 1 legendary) with baseValue by rank, and fished-up things: old boot and driftwood (common), shell and glass bottle (rare), pearl (ultra_rare), sunken crown (legendary). Rank odds from RANK_WEIGHTS; a better rod shifts them. Rod tiers at the forge: basic rod (start), copper-reel rod, mithril rod.
4. FISH FURNITURE (recipes, not in the catalog, theme 'lake'): fish tank (surface item with a swimming fish), mounted fish (wall), fishing net (wall), shell lamp (a light), driftwood bench (2 seats), anchor, pearl chandelier (ultra_rare inputs), the sunken throne (needs the sunken crown). A lake floor style and a wall style too.
5. FOOD: fish are shop goods (category 'food') and 3 new cooking recipes use them (one heal, two buffs that exist already).
6. BOOK: a new Fish tab (fish and fished-up things, grey until caught, with the biggest count and the rank), and the trees' drops under Materials.
7. UI: a Lakeside card on the Map; a small bar while fishing (bobber state and the reel bar) following docs/UI-REFERENCE.md.
Plan first (max 8 lines). Tests for tree regrowth, the fishing session and the catch rolls. Save migration. Run typecheck and tests, update CLAUDE.md and docs, commit and push, tell me what to try.
```

## Step 9g - A livelier hotel: hats, emotes, visitors

```
Step 9g: a livelier hotel room (owner's decision; update CLAUDE.md sections 5, 7, 8). Ideas in the spirit of classic hotel games and tavern games, but everything original. Read CLAUDE.md and docs/UI-REFERENCE.md first.

1. HATS. The avatar's hat layer gets content: clothing.json slot 'hat' with about 12 hats, none free: 4 in the catalog (a new Clothes tab), the rest unlocked by play: Book rewards (step 9e), a legendary fish, a boss kill, a quest reward, a rare dungeon drop. Each hat has a rank. Locked hats show as grey silhouettes with a hint how to get them. Hats keep the approved avatar proportions (boxes on the head only).
2. EMOTES. A small emote button near the chat button: wave, dance, laugh, cheer, sleep (zzz). Short code-drawn poses or moves of the box avatar (no shape change). Name tag above the avatar's head (small plate, toggle in Settings).
3. USABLE FURNITURE. FurnitureType.use: 'toggle' (lamps and candles on/off, saved per item; works with the light data if the atmosphere step is done), 'music' (a music box that plays a short code-made tune, Web Audio, one at a time), 'fire' (a fireplace with a flicker), 'none'. In play mode a tap on such an item uses it. Add to the catalog: fireplace, music box, wall clock (shows the real time), mirror (opens the Avatar panel), a pet basket.
4. A PET. A cat (catalog: pet basket). It wanders the hotel room, sits, sleeps in the basket, follows the player now and then, and purrs with a heart when tapped. Pure wander rules in shared/ with rng passed in.
5. ROOM SCORE. roomScore = points from placed furniture (by baseValue and rank), variety (different types and themes), lights, rugs, wall items and a style that is not bare, capped; shown in the Room panel as 1 to 5 stars with tips ("add a light", "the walls are bare").
6. VISITORS. NPC visitors come into the hotel room now and then while the player is there (more often with more stars, at most 2 at once): they walk around, look at things, sit on free seats, say a line about the room (npcLines.json: by stars and by what they look at), and leave a small tip (gold by stars, collected by tapping the coin they leave on a table or the floor; nothing is collected automatically). They use the customer code for walking and talking.
7. A guestbook item (catalog): visitors sign it; tapping it shows the last 10 lines.
Plan first (max 8 lines). Tests for roomScore, the visitor timing, the pet rules and the hat unlocks. Save migration. Run typecheck and tests, update CLAUDE.md and docs, commit and push, tell me what to try.
```

## Step 9h - More dungeon types (with round 2)

```
Step 9h: more dungeon types (owner's decision; update CLAUDE.md section 10). Set DUNGEON_ROUND = 2 first, run the simulation and tune it, then add themes. Read CLAUDE.md first.

1. THEMES as data (shared/data/dungeons.json): { id, name, unlockLevel, keyCost, palette, enemies, boss, lootTables, floorGen options }. The Crypt stays the first. Add two, with original names and enemies:
   - Sunken Cave (unlock level 4): wet, blue-green, glowing moss as the warm accent. Enemies: a crab (slow, armoured: takes 1 less damage), a jelly (drifts, stings on touch, weak), a spitting fish that attacks from 3 blocks away (a slow projectile the player can sidestep). Boss: a giant crab. Shallow water blocks slow the player.
   - Overgrown Ruins (unlock level 6): green and stone, sun shafts. Enemies: a thorn bush that does not move but hits hard in reach, a spider (fast, short pauses), a spore cap that bursts into a slow cloud when it dies. Boss: an old stone guardian with a telegraphed slam (a marked area, 800 ms).
2. Each theme has its own materials by rank (step 9e), its own crafted furniture set (5 pieces + a floor and a wall style), and its own chest art colours. All in the Book (grey until found).
3. ROOM FEATURES for all themes (rng from the seed): a fountain that heals 30% once, a locked treasure room whose key drops from one enemy on the floor, spike traps that blink before they hit, a cursed chest (better rank odds, but spawns 2 enemies).
4. The Dungeon button opens a small picker: one card per theme (locked: "Opens at level n"), key cost, best depth reached.
5. Run the simulation for every theme and gear tier; print survival per tier and tune the numbers so a fitting tier survives about 60 to 75% of full runs.
Plan first (max 8 lines). Tests for the new enemy rules, the features and the generator per theme. Run typecheck and tests, update CLAUDE.md and docs, commit and push, tell me what to try.
```

## Step 9i - The questline

```
Step 9i: a real questline (owner's decision: the hints of step 7 are replaced; update CLAUDE.md). Read CLAUDE.md and docs/UI-REFERENCE.md first.

1. Quests are data (shared/data/quests.json): { id, chapter, title, text, goal: { event, target?, count }, reward: { gold?, items?, hat?, unlock? }, next }. Progress is counted from game events through one pure function (questProgress(state, event)), fed from the ledger and the run / fishing / farm events, so quests can never be out of date.
2. Chapters, in play order, covering EVERYTHING that exists now: 1 Opening the shop (buy, place, stock a slot, serve a customer, earn 100 gold), 2 The crypt (first run, open 3 chests, defeat 5 slimes, bring loot home, craft one piece), 3 The farm (plant, harvest, cook, eat food in a run), 4 The mine and forge (mine ore, smelt, forge a sword, forge armor), 5 The lakeside (chop a tree, catch a fish, catch a rare fish, build a lake piece), 6 A real home (reach 3 stars, get a visitor's tip, wear a hat, adopt the cat), 7 Deeper (reach floor 3, beat the Bone King, enter the Sunken Cave, enter the Ruins), 8 Collector (fill 25% / 50% of the Book, find a legendary). Skip chapters whose feature is not built yet and say so.
3. One main quest is active at a time, plus up to 3 side tasks that refresh daily (small: "sell 5 items", "catch 3 fish"; a real-time day passed in, no Date.now in shared/).
4. UI: the quest card shows the active quest with a progress count (2 / 5); a Quest log panel lists the chapters, done quests (ticked), the current one and the next ones as "???". A finished quest shows a short reward pop with a Claim button (rewards are claimed by tapping, never silently).
5. Old saves: quests already done by the state (owns a sword, has a farm plot planted...) are marked done without a reward spam: give one summary reward.
6. Add a line to CLAUDE.md section 14: every later step adds its quests to quests.json.
Plan first (max 8 lines). Tests for progress counting, the daily refresh and the migration. Run typecheck and tests, update CLAUDE.md and docs, commit and push, tell me what to try.
```

## Atmosphere step (after 9d)

```
Atmosphere step (owner's request: make the rooms feel warm and alive, like a cozy tavern; see section 12 ART). Only rendering, sound and data; no game-rule changes. No art tools: code-drawn, Endesga 32 palette (shared/palette.ts). Read docs/UI-REFERENCE.md and CLAUDE.md first.

1. Lighting (client/src/render): a dark warm ambient overlay on hotel, shop and farm rooms (adjustable in config), with light pools around light sources: soft warm circles drawn as stepped pixel rings (no blur, no smooth gradients), using Pixi blend modes or a light layer. Light sources are data: add an optional "light": { radius, color, flicker } to FurnitureType in furniture.json (candle stand, lamp, skull lamp, wall torch, the till glow, the cooking pot). A soft light patch at the door. Candles flicker (in the renderer, not in shared rules). The dungeon and the mine keep their own look.
2. Shadows: a small dark pixel shadow under every furniture item and avatar, drawn under the depth-sorted objects.
3. Outside the room: replace the flat dark blue void with a dark warm backdrop (dark wood or stone texture made in code, with a vignette toward the screen edges).
4. Small life: a few slow floating dust specks in light pools, a tiny dust puff at the avatar's feet when it starts walking.
5. Sound: simple sounds made in code with the Web Audio API (no files): soft footsteps, coins at a sale, a door bell when a customer enters, a pop when placing furniture, a click for UI buttons, hit / hurt sounds in the dungeon, a pickaxe and an axe sound. Sound on/off and a volume slider in Settings (saved). Sound starts only after the first tap. Quiet by default.
6. A setting "Lighting: on / off" (for slow phones); check that the frame rate on a phone stays smooth.
Plan first (max 8 lines), then build. Tests for any new pure helpers. Run typecheck and tests, update CLAUDE.md, commit and push, tell me what to try on my phone.
```

## After 9i

- Step 6 (art): the sprite list grows with everything above (fish, trees, hats, the cat, the new
  dungeon themes and their furniture).
- Step 10 (online): visitors become real players; emotes, name tags and the guestbook are ready
  for it.
