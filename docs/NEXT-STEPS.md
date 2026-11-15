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

The order of ALL work is in docs/ROADMAP.md. This file only holds the step prompts.

New order (see docs/ROADMAP.md, it leads): 9d (shop life) -> atmosphere step (light, shadows, sound; prompt at the end) -> 9e
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
Owner's change during step 9f (after the first playtest): point 2's reel is NOT a bar that fills by tapping. It is a Stardew-style bar: a fish swims back and forth, the player holds to push a green catch box to the right and it falls left by itself; keep the box on the fish to fill the catch bar. Rod upgrades make the box wider and the fall slower. See CLAUDE.md section 10d.

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

## Step 9t - The tavern

```
Step 9t: the shop becomes a tavern (owner's decision, 14 Nov: a cosy tavern feels much better than a shop). This changes CLAUDE.md sections 1, 5 and 9: update the brief. Everything original: never copy another tavern game's names, art or layout. Read CLAUDE.md, docs/NOTES.md (shop and customers) and docs/UI-REFERENCE.md first. If this is too much for one session, do it in parts and stop after each: A) shared rules and tests, B) the room, guests and serving in the client, C) brewing, the menu panel, the migration and the texts.

1. THE ROOM. The shop room is now the Tavern everywhere the player sees it (Map card, info panel, catalog tab, quests, texts). Keep the internal kind 'shop' and the room id, so saves and code keep working. The counter is now the bar (same item, same till, same staff-only side).
2. GUESTS replace customers as the main visitors. They come in alone, in pairs or in a group of 3 (rate from the tavern's appeal, as now), look for free seats at a table (a seat counts when a surface item with a free spot is next to it), walk there and sit. No free seat: they stand around a moment, say so and leave. At most as many guests as seats, capped in config.
3. ORDERS. A seated guest orders one thing from the menu after a moment: an order bubble with the item's icon. The player taps the guest (or the bubble): the avatar walks to the bar, picks the item up (it shows in the hands), walks to the guest and puts it on the table, all from one tap (taps queue up, at most 3). The guest eats or drinks for 20 to 40 s (the item stays on the table, small sip / bite moves, they chat with table mates), then leaves coins on the table and walks out. The coins stay until the player taps them (walk there, collect, "+n gold"): nothing is ever collected automatically. An empty mug or plate stays too: tap to clear it; a table spot with dirt or coins on it cannot be used by a new guest. A guest who waits too long for the order (config, about 90 s) leaves unhappy without paying.
4. THE MENU. A Menu panel (tap the bar in play mode: tabs Serve and Menu): the player chooses which drinks and dishes are on the menu and sets a price for each. The price feedback rule of section 9 stays (tolerance, the four faces): a guest who finds the price too high orders something cheaper or leaves. Stock comes from the bag: dishes are the cooked food (food.json), drinks come from brewing. Out of stock = off the menu. An empty menu: guests still come in, sit, talk and leave ("Nothing to drink?").
5. BREWING. A brewing barrel (furniture, one at the start, more in the catalog): put in crops, wait in real time (also while the game is closed, time passed in), tap to collect mugs. Recipes in shared/data/drinks.json, original names, for example: root ale (2 turnip + 1 potato, 10 min, 6 mugs), carrot cider (3 carrot, 20 min, 6), pumpkin stout (1 pumpkin + 2 potato, 45 min, 8), glowcap tonic (1 glowcap + 1 carrot, 30 min, 4; guests tip extra). Drinks are a new group in MATERIAL_TYPES with baseValue; they can also go in the lunch box later (not now).
6. THE MARKET CORNER stays: the stall table, shelves and display cases keep selling loot exactly as now (browse, decide, pay at the bar while the player stands behind it, queue of 3). Guests who finished their drink sometimes browse the stall on the way out. Window-shoppers stay.
7. AWAY RULE: nothing happens without the player. While the player is elsewhere or the game is closed, at most 3 guests are seated with an open order (maths only), and the loot queue rule stays. Unserved guests there do not walk off while the player is away.
8. START AND MIGRATION. A new game starts with the bar, the stall table, one round table with 2 stools, and one brewing barrel holding 6 root ale ready to collect. Old saves get the table, 2 stools and the barrel in the bag, and a toast that explains the tavern. New furniture in the catalog (Tavern tab, replaces Shop): bar stool, round table, long table, mug shelf (wall), menu board (wall), keg rack, brewing barrel.
9. FEEL: guests talk at the table (npcLines.json: toasts, small talk, remarks about the drink and the room), a soft murmur sound when 3 or more guests sit, a clink when an order lands. The hint / quest texts about the shop are rewritten for the tavern.
Plan first (max 8 lines). Tests: seating and groups, the order and serve chain, coins and dirt blocking a spot, the patience timer, brewing over real time and across a reload, the menu price rule, the away rule, the migration, the ledger still adds up. Update tools/simulate-economy.ts for tavern income. Run typecheck and tests, update CLAUDE.md, docs/NOTES.md, docs/UI-REFERENCE.md and tick docs/ROADMAP.md, commit and push, tell me what to try on my phone.
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
2. Chapters, in play order, covering EVERYTHING that exists now: 1 Opening the tavern (buy and place a table, brew a drink, serve a guest, collect the coins, sell one thing at the stall, earn 100 gold), 2 The crypt (first run, open 3 chests, defeat 5 slimes, bring loot home, craft one piece), 3 The farm (plant, harvest, cook, eat food in a run), 4 The mine and forge (mine ore, smelt, forge a sword, forge armor), 5 The lakeside (chop a tree, catch a fish, catch a rare fish, build a lake piece), 6 A real home (reach 3 stars, get a visitor's tip, wear a hat, adopt the cat), 7 Deeper (reach floor 3, beat the Bone King, enter the Sunken Cave, enter the Ruins), 8 Collector (fill 25% / 50% of the Book, find a legendary). Skip chapters whose feature is not built yet and say so.
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

# Block world steps BG1 to BG9 (owner's request, 15 Nov; read docs/BLOCKS-PLAN.md first)

Every BG prompt: read CLAUDE.md, docs/BLOCKS-PLAN.md and docs/UI-REFERENCE.md; plan first (max 8
lines); tests first or together; SAVE_VERSION bump + migration with a test when the state shape
changes; no art tools (shapes drawn in code, Endesga 32); original names only (never copy Growtopia
or Pixel Worlds item names or recipes); typecheck + tests; update CLAUDE.md (sections that changed),
docs/BRIEF.md, docs/NOTES.md, tick docs/ROADMAP.md; commit and push; tell me what to try on my phone.

## Step BG1 - The cell grid

```
Step BG1: building goes per cell (owner's decision; this changes CLAUDE.md sections 4, 5, 6, 7: update them and docs/BRIEF.md). BUILD_CELL = 32 px in config.
1. shared: room shapes in cells (convert roomShapes.json; round up to whole cells; keep levels containing the previous one). Furniture footprints in whole cells (w x d), anchor = bottom-centre cell, rotation swaps w and d. Validity: fully on floor cells, no overlap with another blocking item (rugs and floor decor = background layer, overlap anything), not on the 2x2 door zone, door still reaches the middle, onSurface on a surface item. WALL ITEMS STAY FREE (owner 15 Nov): they keep sliding along the back wall band at any x and y inside it, 4 px snap, Shift = no snap, not on the door; only floor items go per cell, so keep the 4 px snap code for wall items.
2. Floors and wall styles per cell: paint a cell or a dragged rectangle (the Styles panel keeps unlocked-forever rules). Walls per segment. Back wall band = 2 cells.
3. Navigation: the nav grid is the build grid (32 px cells, 8 directions, no corner cutting, smoothing). Remove the AVATAR_RADIUS growing for rooms (blockers are whole cells). The dungeon keeps its own grid. Seats, the counter-behind rule and customer npcGrid keep working.
4. Client: draw a faint cell grid while placing or painting (toggle), ghost snaps to cells, tap-to-walk unchanged. Placer, picking and the hotbar keep their flow.
5. Migration: snap every placed item to the nearest valid footprint; what no longer fits goes to the bag with a toast.
6. Update the CLAUDE.md rule "no tile grid" and the camera/world maths if needed (zoom math stays).
Tests: footprints, rotation, validity, door zone, nav on cells (path through a 1-cell gap), seats, the migration. Check bundle and phone feel by hand.
```

## Step BG2 - Item icons

```
Step BG2: every item is a coloured square (owner's request). Data field icon: { shape, colors[] } on every item in materials, food, fish, crops, ore, bars, gear, clothing and furniture inventory icons. Small fixed shape list (ore chunk, bar, fish, leaf, mushroom, log, potion, bread, mug, gem, seed, block, cloth, bone, boot, key, ring, sword, helmet...). One drawIcon(shape, colors, rank) in client/src/render drawing a 32x32 square with a dark warm outline and top-left light, Endesga 32 colours from shared/palette.ts, used by the bag, hotbar, shop, Book, recipes, drops. Every item gets a distinct shape + colour pair (rough, but you can tell a copper ore from a carrot at a glance). Test: every item id has an icon; no two items of the same group share the same pair. Real art replaces drawIcon later (phase 4).
```

## Step BG3 - Gain popups above the head

```
Step BG3: show what you got (owner's request). GameAPI results that give items or gems carry gains: { itemId, count, rank }[] (+ gems). Client: small icons with "x3" float above the avatar's head for about 1.2 s (config), in a row, max 5 at once, the rest queue, rank colour, sparkle for ultra_rare and legendary. Sources: chest, kill, fish catch, fished-up things, tree chop, harvest, ore, crafting, buying, quest claim, pack opening, Book reward. Works in the dungeon and in rooms. Setting Popups on/off. Rendering only: numbers come from the API result; shared rules stay pure. Tests for the gains lists in each API path and the popup queue helper (pure).
```

## Step BG4 - Gems

```
Step BG4: gems, the second currency (owner's request; update CLAUDE.md section 9 and BRIEF). Integer, not tradable, no real money. Config GEMS: faucet amounts by source and rank (block break, harvest, kill, chest, ore, tree, fish, quest, Book reward). Pure gemDrop(source, rank, rng). Gem pickups: small gems on the floor that fly to the avatar when it is near or is tapped (no menu). All changes go through ledger.applyChange (add the gems currency). Info panel shows gems next to gold. Start with 0 gems. Save migration. Nothing to buy yet except through BG8: say so in a hint. Tests: drops by source and rank, ledger adds up. Add gem income to tools/simulate-economy.ts.
```

## Step BG5 - Blocks and punching

```
Step BG5: blocks (owner's request; read BLOCKS-PLAN 3.5 and ask me its open questions b, c, d before building). shared/data/blocks.json: { id, name, hardness (hits), rank, drops, seedId, placeIn, icon }. Foreground layer, one block per cell. Place: select in the hotbar, tap a free cell within reach (config, 3 cells). Break: tap a block, one hit per tap, 250 ms cooldown, hardness taps, then it drops itself, sometimes a seed, sometimes gems; hit cracks drawn in code. Only the owner changes a room. Blocks block navigation (rebuild the grid, re-path). A starter set of 10 blocks with original names (dirt, stone, planks, glass...). The catalog sells a few for gold, the rest come from drops and splicing. Tests: hits to break, drops with a fixed rng, placement rules, nav after change, migration. Build mode vs direct placing as I decide.
```

## Step BG5b - Hold to punch (owner's request, 15 Nov)

```
Step BG5b: hold to repeat instead of clicking all the time (docs/BLOCKS-PLAN.md section 3.5, HOLD TO REPEAT). This changes the INPUT convention in CLAUDE.md: update it and docs/BRIEF.md. Read CLAUDE.md, docs/NOTES.md (input, tap rules, mining, woodcutting) first. Plan first (max 8 lines); no art tools.
1. Press and hold on a block, a grown plant, a mine rock or a tree keeps hitting at that thing's cooldown rate (blocks 250 ms, rock 400 ms, tree 400 ms) until it breaks, the press ends, or the avatar is out of reach (then it walks closer and goes on). Works with mouse hold on PC and finger hold on a phone and the touch screen. The first hit happens on press, not after a delay.
2. Hold with a block selected on free cells places blocks; dragging along cells places a line (one per cell, within reach, same placement rules).
3. A press that moves over 8 px is a drag = camera pan; it never punches or places. A short tap still works as one hit as now. Two-finger pinch never punches.
4. NOT for the dungeon fight (one hit per tap, no auto-attack) and NOT for fishing: say so in the docs.
5. The hold logic is a pure helper (holdTick(state, nowMs, cooldownMs) -> hit or not) with tests: first hit on press, rate follows the cooldown, stops on release or pan, no double hits per tick. The client only feeds pointer events into it.
6. Hit feedback: crack stages and a small pop per hit as in BG5; popups and gems come through the same API calls as before (one request per hit).
Tests: the helper, plus API paths still refusing out-of-reach and non-owner. Run the full test suite and typecheck, update CLAUDE.md (CURRENT STATE, INPUT), docs/NOTES.md, tick BG5b in docs/ROADMAP.md, commit and push. Tell me what to try on PC (mouse hold) and phone (finger hold, drag to pan, hold on a rock and a tree).
```

## Step BG6 - Seeds and the free-form farm

```
Step BG6: seeds and farming by punching (owner's request; read BLOCKS-PLAN 3.6). Every block and crop can have a seed item. Plant a seed in a free soil cell of a farm room (not only fixed plots). 3 growth stages in real time, also while closed (time passed in); time by rank (config SEED_GROW_MS). Harvest = punch the grown tree: 1 to 4 blocks or crops, a chance for a seed, a chance for gems (BG4). Unharvested trees stay ready; no watering. The farm room becomes free-form (paths and fences from blocks). Migrate the old plots: crops.json become seeds, planted crops keep their progress, soil cells replace plots, the cooking pot stays. Food, cooking and brewing still use crops. Quests, hints and texts updated. Tests: growth over real time and a reload, harvest rolls with a fixed rng, the migration, ledger.
```

## Step BG7 - Splicing

```
Step BG7: splicing (owner's request; read BLOCKS-PLAN 3.7). Plant two different seeds in one cell; after the growth time a NEW seed grows from shared/data/splice.json ({ a, b, result }, order does not matter). No random failure; a wrong pair says "nothing happens" and returns both seeds. About 40 recipes with original names, chains of 2 to 3 steps to rarer items; results can be blocks, crops, furniture seeds (a tree that grows a table), clothes seeds and tavern goods. A Splice tab in the Book: found recipes shown, undiscovered ones "???" with a hint of one ingredient; 25/50/75/100% rewards in gems or gold. Pure splice(a, b) and tests: symmetry, every result reachable from starter seeds, no dead ends, the Book. Add a plant-and-splice hint to the quests.
```

## Step BG8 - Packs

```
Step BG8: packs bought with gems (owner's request; ASK me to confirm the fairness rules in BLOCKS-PLAN 3.8 and update CLAUDE.md section 13 in the same step). shared/data/packs.json: { id, name, gemPrice, rolls, pool, rankWeights }. Packs: Random Blocks Pack, Basic Seeds Pack, Common Clothes Pack, Rare Clothes Pack. Pure openPack(state, packId, rng): rank first (RANK_WEIGHTS times the pack's multiplier), then an item; clothes packs roll only pieces not owned yet until the category is complete, then they return gems. A Packs panel (a tab in the Catalog or a button in the right column per docs/UI-REFERENCE.md): each card shows price, possible contents and the odds. Every buy asks first (ui/confirmBuy.ts). Opening: a short pop, items float above the head (BG3), land in the bag. Ledger for everything. Tests: odds with a fixed rng across many rolls, no repeats of owned clothes, gems back at completion, ledger, a refused buy without enough gems.
```

## Step BG9 - Balance

```
Step BG9: balance the block world with tools/simulate-economy.ts (gems per hour from each source, pack prices, grow times, how fast the first clothes pack is reachable, no infinite loops like seed -> block -> seed with a net gain). Print a table; tune config only; keep the first hour feeling generous. Update the first-hour hints and the quests with the block world (planting, splicing, opening a pack). Tick everything in the ROADMAP.
```
