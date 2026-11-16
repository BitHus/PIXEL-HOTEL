# PLAN: DUNGEON LAYOUT REDO (part A) + GROWTOPIA SPLICING AND PLANTING (part B)

## NEXT ACTIONS (one page; read this first)
Four lanes, no shared files. FILE OWNERSHIP: (L1) coder-dungeon owns shared/src/dungeon/*, shared/data/dungeon*.json, config/dungeon.ts, client/src/dungeon/* logic. (L2) coder-rules owns shared/src/{spliceRule,seedCategory,splice,spliceData,seeds,farm,balance}*.ts, shared/data/{splice*,blocks,crops,drinks}.json, config/farm.ts, save.ts. (L3) coder-client owns client/src/{api,game,ui,farm logic}, text.ts, bookPanel. (L4) artist owns client/src/render/*, client/src/farm/{farmArt,plantSprite}.ts, ui.css, dungeon art files (propArt.ts new), icon data fields. If a task needs a file of another lane, it asks via a stub or hook, never edits it. Coder tasks that touch ONE shared file (config/farm.ts, save.ts, balance.ts) are serialized: SG4 then SG1 then SG2 then SG3.
FIRST PLAYABLE CORE (ship first): DG1 (new layout, existing art) in L1 || SG4 (plant on any block) in L2 then SG5-lite (plant tap + hint) in L3 || DA1 (props and landmarks, code-art) and SA1 (plant-on-block, preview dialog CSS) in L4. All four run in parallel from day 1.
THEN: SG1 + SG2 (general rule + balance gate) L2; DG2 L1/L3 (view hooks); SG5 (preview dialog) L3; SG3a..d content L2 (data) with SA2 icons L4; SG6 Book L3; DG3, DG4 L1.
POLISH LAST: DG5 traps and puzzle (owner OK), SA3 and DA2 PNG art, tuning.
Gates every task: npm test, typecheck, balance.test.ts green, simulate and simulate:dungeon recorded in NOTES; no push.

Lead, 16 Nov. Owner decisions (both lift the rules named in section 0). Vibes/fun: both rank high (see ROADMAP PRIORITY ORDER 1d).
Read first: CLAUDE.md 9, 10, 10b; docs/BLOCKS-PLAN.md 3.6 and 3.7; shared/src/dungeon/generate.ts; shared/src/farm.ts, splice.ts, spliceData.ts, seeds.ts, balance.ts; shared/data/splice.json, spliceSeeds.json, blocks.json.
No production code is written by the lead. Prompts: docs/QUEUE.md section "DUNGEON REDO + SPLICE".

## 0. RULES THAT CHANGE (exact CLAUDE.md wording; the coder applies these at the end of the matching task, in CLAUDE.md and docs/BRIEF.md, same numbers)

A. Section 10, after "Floors: 40x40 blocks of 32 px from an integer seed. Theme v1: Crypt." ADD:
   "LAYOUT (DG1, owner 16 Nov): rooms are templates (rectangle, cross, L, cut-corner, pillared hall, alcove hall, ring, arena; data in shared/data/dungeonRooms.json) of 4 to 8 blocks on a jittered 3x3 grid of zones, joined door to door by corridors of at most DUNGEON_CORRIDOR_MAX (5) blocks, with at least one loop when there are 4 or more rooms. Every floor has side nooks, 1 to 2 dead-end secrets, a vault nook, one landmark and set pieces (dungeonThemes.json); a BEAT (enemy, chest, prop or landmark) lies within PACE_GAP_BLOCKS (7) blocks of every point of the main route. Chest counts, enemy counts, loot tables and the 100 ms tick are unchanged. The mine keeps its old layout."
   Section 10, "round 1 (default) = 1 floor, 3-4 rooms, slimes only; round 2 = 3 floors, 5-8 rooms" stays; "rooms" means main rooms (nooks, secrets and vaults do not count).
B. Section 10b, the sentence "SOIL = floor cells painted 'soil' ... the player paints or removes soil for free, Room > Paint soil)." gets: "Soil is for FOOD crops. Every other seed (block, ore, drink, furniture, clothing, style) is planted on any BLOCK cell (the block stays, the plant sits on its top face) in hotel, tavern and farm; food crop seeds need a soil floor cell or a block marked soilHost (dirt, rich soil). PLANTS_ROOM_CAP limits plants per room (farm 80, hotel 16, tavern 8)."
   "Select a seed, tap a soil cell in reach (BLOCK_REACH): one plant per cell, it blocks the cell like a small block." becomes "Select a seed, tap a soil cell or a block cell in reach: one plant per cell (a plant on soil blocks the cell like a small block; a plant on a block adds nothing, the block already blocks). A block that carries a plant cannot be punched: a punch harvests a ripe plant, else the plant shakes."
C. Section 10b SPLICING paragraph: replace "(shared/data/splice.json, order free, no random failure; a wrong pair or the same seed = "nothing happens", nothing taken)" with "(any seed with almost any other: the GENERAL RULE in shared/src/spliceRule.ts, a pure hash of the sorted pair key into result pools by category and rank, plus the hand-authored SPECIAL recipes in shared/data/splice.json which win; order free, no random failure; only the same seed twice, a legendary seed, or a seed marked noSplice = "nothing happens", nothing taken; one splice per cell, 2 seeds in, 1 seed out)" and "results grow blocks, crops, drinks, furniture or clothes" becomes "results grow blocks, crops, drinks, furniture, clothes, ore or a floor/wall style". Add: "Tapping a young plant with a seed selected first shows the SPLICE PREVIEW (known mix: the result; new mix: its rank and grow time); the player confirms. The Book Splice tab lists every result seed (grey until made) and every special recipe."
D. Section 9 (economy), the closed-loop sentence "a splice result and its seed sold back <= the GOLD of its starter seeds (S3, strict)" gets "(for every pair of the general rule and every special recipe, tested over all pairs)". Section 9 GOLD BALANCE targets stay.
E. Section 10b "Harvest = PUNCH the full plant" stays. CURRENT STATE and the SAVE_VERSION mentions get the new number after SG4.
F. FILE MAP: shared/src add spliceRule.ts, seedCategory.ts, dungeon/layout.ts, dungeon/rooms.ts, dungeon/themes.ts, dungeon/pacing.ts; shared/data add spliceRules.json, dungeonRooms.json, dungeonThemes.json.

## 1. PART A: DUNGEON LAYOUT REDO

### 1.1 What is wrong now (generate.ts)
Rooms are random rectangles anywhere on 40x40; each room joins the NEAREST EARLIER room by an L-shaped 1-wide corridor centre to centre. Rooms scatter, so links run 15 to 30 blocks (6 to 12 s of empty walking at 80 px/s = 2.5 blocks/s). Every room is a plain rectangle, a tree (no loops), enemies and chests land on random room blocks, no decor, nothing to remember.

### 1.2 Target feel
- Walk time between two things to look at or hit: 3 s at most (PACE_GAP_BLOCKS 7). Corridors 5 blocks or less (2 s).
- A floor reads as a place: 1 landmark you can navigate by, 1 vault, 1 or 2 secrets, 2 to 3 set-piece rooms, a loop to choose a way.
- Same totals as today so the economy holds: 3-5 wooden chests, golden 40%, enemies 0-2 per room (mean unchanged), same loot tables, same gold per run (simulate:dungeon within +-10%).

### 1.3 Algorithm (new shared/src/dungeon/layout.ts; generate.ts calls it for kind 'crypt'; the mine keeps `legacyLayout` = the current code, moved unchanged)
All draws come from floorRng(seed, n) in ONE fixed order (documented at the top of layout.ts); no Math.random/Date.now; same (seed, n, round) = same floor. Order: 1 zones, 2 templates, 3 rooms, 4 links, 5 loops, 6 nooks and secrets, 7 themes, 8 things (enemies, chests), 9 pacing fill.
1. ZONES: split 40x40 into a 3x3 grid of zones (13 blocks each, 1 block margin). Grow a connected set of `roomCount` zones from a random start (4-neighbour growth, so chosen rooms are neighbours).
2. TEMPLATES (dungeonRooms.json: id, weight, size range, mask kind, flags): rect, cross, ell, cutcorner, pillars (2-block pitch), alcoves (1-deep bays on long sides), ring (2x2 central pillar), split (half wall with 2 gaps), hall (8x4 with pillar rows), arena (boss/exit, 8x8 with 4 pillars). Pick by weight, no template more than twice per floor, at least 3 different ones when rooms >= 4. Masks are pure functions returning a boolean grid inside the room's bounding rect; the mask is always 4-connected and its door-side edge cells are floor. map.rooms stays the bounding BlockRect (client fog, minimap and chestSpotOk keep working).
3. ROOM RECTS: each room is placed inside its zone with jitter, size 4..8; the gap between rooms of neighbouring zones is 1..3 blocks (clamp positions).
4. LINKS: spanning tree over zone adjacency (randomized DFS). A link joins a door cell on A's facing side to one on B's facing side (1-block-wide mouth; 20% of links are 2 wide "halls"). Straight when the ranges overlap, else one jog of at most 2. Max corridor run = DUNGEON_CORRIDOR_MAX 5 by construction (clamp in step 3). Record `map.links: { a, b, cells }[]` (optional field).
5. LOOPS: when rooms >= 4 add DUNGEON_LOOPS (1 for round 1 with 4 rooms, 1 to 2 for round 2) extra links between adjacent zones not yet joined.
6. NOOKS: a side nook = a 1x2 or 2x2 pocket off a room wall (mouth 1 block). VAULT: one nook 2x2 behind a 1-block mouth in a mid-distance room, holds the golden chest when one rolls (else a wooden chest). SECRETS: 1 or 2 dead-end stubs (2 to 3 blocks) off corridors or rooms, unlit (fog) and cosmetic-marked by a crack prop, holding a chest or a gem pile. Secrets and vaults may lie outside the bounding rect: they live in `map.extras: BlockRect[]` (optional).
7. THEMES (dungeonThemes.json; a theme = room template + prop list + enemy recipe + role): 'bone_hall' (pillars, skeleton props, ambush: enemies stand behind pillars), 'crossroads' (cross, 3 exits, brazier), 'sarcophagus' (alcoves, 1 mimic-capable chest in round 2), 'library' (split room, shelves, candles), 'guard_post' (hall, 2 enemies facing the door), 'campfire' (spawn room only: calm, warm light, no enemies), 'arena' (exit room on the boss floor), 'crypt_garden' (ring, roots, glowcaps, decor only). Assign: spawn = campfire, exit room = arena on the boss floor, else a random calm or guard theme, 2 other rooms get themes by weight. A theme never adds chests; it moves them (chests sit in alcoves, vault, nooks, away from the spawn room by the old CHEST_SPAWN_ROOM_GAP/CHEST_SPACING rules).
8. LANDMARK: one per floor from [fountain, giant statue, big brazier, broken pillar ring, sarcophagus pair], placed in the centre of a room that is not the spawn room; visible and lit from afar (artist). Decor: `FloorPlan.decor: { id, kind, c, r, solid }[]` (optional in DungeonRun; `solid` props are the existing 'wall' blocks, so step() needs no change).
9. PACING: BFS main route spawn -> exit (4-connected). Walk it; for every window of PACE_GAP_BLOCKS (7) blocks with no beat within 4 blocks, add a prop (cheap beat) at the nearest free block, and every 16 blocks with no enemy add one enemy from the room's own roll (move, do not add: totals stay). Exit = the floor block farthest by walking from the spawn inside a non-spawn room (as now). Route length spawn -> exit stays 25 to 70 blocks (test), so a floor is 1 to 2 minutes with fights.
10. Boss floor (round 2 floor 3): exit room = arena, Bone King in it, golden chest beside the exit (as now).
Round 1 (3-4 rooms): zones set to 3 or 4, no loops unless 4 rooms, themes limited to campfire, bone_hall (slimes only), crypt_garden, vault. Round 2 (5-8 rooms): everything.

### 1.4 Stretch (DG5, own save bump, last): traps and a light puzzle
- Spike plates: telegraphed hazard cells (`run.hazards`, 3 damage when the player stands on one at a tick, 1 s cycle in fixed ticks), only in 'guard_post' and corridors to the vault.
- Torch puzzle: 3 unlit braziers in a theme room; hit each once (tap, in reach, existing one-hit-per-tap rule); all lit opens a `gate` block to the vault. New DungeonBlock 'gate' open/closed state in run, handled in step() (deterministic, no rng). A gate must never close off the exit (test).
Needs SAVE bump (DungeonRun fields) with MIGRATIONS entry that sets run = null for an in-flight run (or adds empty arrays); test.

### 1.5 Save impact: none for DG1 to DG4. DungeonRun already stores its map; new map fields (links, extras, decor) are OPTIONAL, so a stored run without them still loads and plays (test). Next floors of a stored run use the new generator.

### 1.6 Tests (shared/src/dungeon/*.test.ts; existing generate.test.ts is updated, not deleted)
Determinism (same seed, floor, round equal; golden hash of seeds 1..20 x floors 1..3 so a reshuffle shows in review), 40x40, rooms 4..8 no overlap, round counts (1: 3-4, 2: 5-8), every floor block reachable from spawn (flood fill covers ALL floor blocks), exit reachable and farthest, max corridor run <= 5 over 300 seeds, link graph has a cycle when rooms >= 4, variety (over 100 seeds at least 7 templates and 5 themes occur, no floor with all rectangles), pillars never cut a room (mask connected), things only on floor blocks (fix `freeBlock`: it walks the bounding rect and must test isFloorBlock), chests 3-5 + golden ~40% and spaced (old tests), enemy mean per floor within 10% of the old mean over 200 seeds, none within 3 blocks of the spawn, pacing (no 7-block window of the main route without a beat nearby, enemy within 16), route length 25..70, secrets and vault reachable, boss floor arena + Bone King + golden chest, mimics round 2 only, mine tests unchanged and green, generation time < 20 ms per floor (worst of 300 seeds under 60 ms), `npm run simulate:dungeon` gold and gems per run within +-10% of before (record before/after in NOTES).

### 1.7 Tasks (order and owner)
- DG1 [coder] shared/src/dungeon/{layout,rooms,themes,pacing}.ts + data JSON, generate.ts wiring (crypt only), tests above except stretch. Config: DUNGEON_CORRIDOR_MAX 5, DUNGEON_LOOPS_*, PACE_GAP_BLOCKS 7, DUNGEON_ZONES 3, ROUTE_LEN_MIN/MAX. No save bump. Files: shared/src/dungeon/*, shared/data/dungeonRooms.json, dungeonThemes.json, shared/src/config/dungeon.ts, docs.
- DG2 [coder] client/src/dungeon/dungeonView.ts reads map.decor / extras / links: draws props and landmark through hooks `drawDecor(kind)` (code-art stubs until DA1 lands), fog and minimap use the bounding rects plus extras; light sources for braziers; no rule in render.
- DG3 [coder] set-piece details: ambush placement, vault chest, secrets (gem pile uses gems.ts rules, source 'chest'), landmark flavour text on first sight (one toast per floor, reading pace), Book entries for new enemy-free props are NOT added.
- DG4 [coder] tuning: `npm run simulate:dungeon` tables, feel numbers (route length, beats per minute), tester route on 20 seeds; fix list.
- DG5 [coder] stretch (section 1.4), after owner OK.
- DA1 [artist] CODE-ART: decor props in code (barrel, crate, bones, skull pile, candle stand, banner, cobweb, shelf, root, glowcap), landmarks (fountain, statue, brazier big, pillar ring, sarcophagus), pillar and alcove wall variants, crack decal, vault door arch. Palette Endesga 32, cool crypt with few warm lights (CLAUDE 12).
- DA2 [artist] PLUGIN: PNG versions (props 32x32, landmarks 64x64), pillar tiles; later spike plate and gate (DG5). Brazier lit/unlit states.

## 2. PART B: SPLICING AND PLANTING (the Growtopia part)

### 2.1 What exists
Plants only on painted soil in farm rooms (plantProblem: FARM_ONLY, 'no_soil'). 40 hand-written recipes (splice.json), 14 splice-only seeds, one splice per cell (Plant.with), harvest gives the NEW seed (never the ingredients back), Book Splice tab (entries = recipes, Player.splicesFound = pair keys), balance.ts chains()/spliceSellLoops() over SPLICE_RECIPES with the strict test "result + seed sold back <= GOLD of starter seeds".

### 2.2 The GENERAL SPLICE RULE (new shared/src/spliceRule.ts, pure, no rng argument: a hash)
spliceResult(a, b): SeedId | null.
1. null if a === b, or either seed is legendary or has `noSplice: true`.
2. If the sorted pair key is in splice.json (SPECIAL), that result wins (all 40 existing recipes keep their result: found keys stay valid).
3. Else: h = fnv1a32(`${SPLICE_SALT}:${pairKey(a,b)}`) (order free by pairKey).
   - RANK: ra, rb = rank indexes (common 0 .. legendary 3). rr = max(ra, rb); if ra === rb and (h % SPLICE_UP_ONE_IN) === 0, rr = ra + 1; rr = min(rr, SPLICE_RANK_CAP = ultra_rare). Legendary results only come from special recipes.
   - CATEGORY: from seedCategory(a), seedCategory(b) (new shared/src/seedCategory.ts, derived, no data: block | crop | drink | ore | furniture | clothing | style | material). Weights from shared/data/spliceRules.json, a symmetric table of category pair -> weights, e.g. block+block: block 55, furniture 25, style 10, ore 10; crop+crop: crop 45, drink 40, material 15; block+crop: drink 35, furniture 30, crop 20, block 15; ore+block: ore 35, furniture 30, block 35; clothing+any: clothing 45, style 20, same-as-other 35; furniture+any: furniture 50, clothing 20, style 15, other 15. Theme: related categories give related results, so players can guess. category = weighted pick using bits 8..23 of h.
   - POOL: all seeds with the result category and rank rr that are NOT starter seeds (packs 'seeds') and not a or b. If empty, step rr down until non-empty, then up. index = (h >>> 12) % pool.length (pool sorted by id, stable).
4. The result is the NEW seed. It is a seed, so planting it grows the product (as now).
Frozen forever after release: SPLICE_SALT, the weights file and pool order (ids sorted). A GOLDEN TEST pins results for 30 pairs; adding seeds to a pool reshuffles some general recipes, so new content ships in ONE batch before release (SG3) and later seeds join as SPECIAL recipes or `pool: false` seeds only.
allRecipes(): enumerates special + general over all splice-able seeds (about 120 seeds = 7000 pairs, built once, cached) for balance tests, the Book and the preview.

### 2.3 Results that exist (content, all in shared/data, original names)
Ranks and grow times by rank (config SEED_GROW_MS: common 2 min, rare 20 min, ultra 3 h, legendary 12 h); a splice cell grows max(grow a, grow b, grow of the RESULT rank) + SPLICE_BONUS_MS (fix: now a rank-up cannot skip time). Product quantity by rank is SEED_YIELD, except furniture, clothing, style and ore seeds: always 1.
- BLOCKS (seed id `<block>_seed`, blocks.json + icon): new ~12: sandstone, marble, rune_stone, frost_brick, lava_glass, hay_bale, moss_carpet?? (blocks are full cells), copper_plate, crystal, obsidian, wicker, rich_soil (soilHost), amber_block. Ranks 5 common, 4 rare, 3 ultra. Never in the catalog (inCatalog false), sell at block rate.
- CROPS (food, soil only): beet, leek, onion, pepper, berry, mushroom cap, sunmelon, honey_root (crops.json with seedPrice null; each used in 1 to 2 new food.json dishes). Ranks 3 common, 3 rare, 2 ultra.
- DRINKS: 6 spliced drink seeds (like hopvine -> root_ale): sweetmead, nettle_wine, frost_cider, ember_stout, ... grow mugs; need drinks.json entries (brew-free: harvest gives mugs, SEED_YIELD scaled by `mugs`? NO: give 2 mugs flat, test against brew loop in balance.ts brewSellLoops).
- FURNITURE: 14 medieval pieces (banner stand, anvil, weapon rack, hearth stool, trestle bench, candelabra, rug runner, barrel table, ...) inCatalog false, placeIn per type.
- CLOTHES: 10 pieces (hats, a cloak, boots; clothing.json hidden until unlocked; seed returns itself when already owned, as now).
- ORE (mine-safe): copper_ore, iron_ore seeds grow 1 ore per harvest (never mithril); test: ore per cell-minute * ore sell price < the mine's gold per minute and < bestCropGoldPerCellMinute.
- STYLES (rare cosmetic seeds): 8 floor and 8 wall styles that unlock forever (new SeedGrows kind 'style'; uses Player.unlockedStyles; a duplicate gives the seed back).
Total pool about 90 non-starter seeds: every category has at least 3 seeds per rank 0..2 (test).
Special recipes: keep the 40, add about 30 named ones (honey + hop = mead, ember + clay = hearthstone, ...) in splice.json with an optional `name` and `hint` string.

### 2.4 Planting on any block (shared/src/farm.ts plantProblem)
- Rooms: hotel, shop (tavern) and farm (every room kind that takes blocks: blocks.json placeIn); lakeside stays not_buildable.
- A target cell is valid when: (a) soil floor, no block (as now), or (b) it holds a block (the HOST). The host stays. Plant and block share the cell key; the plant is drawn on the block's top face.
- Food crops (grows crop via cropOfSeed) need (a) or a host with `soilHost: true` (dirt, rich_soil); else problem 'needs_soil' ("Food crops need soil or a dirt block.").
- A block with a plant: break/punch is refused with problem 'planted' (shake); a ripe plant is harvested by the punch (hitPlant first). The host can never vanish under a plant (also in the Pick up / replace paths, test).
- Furniture on the cell: cellProblem already refuses. Under an avatar standing still: same rule as blocks. Door zone and Inn door spots: refused as for blocks.
- PLANTS_ROOM_CAP (config): farm 80, hotel 16, tavern 8 ('too_many_plants'). Reason: no plant spam; income per cell is not a loop (seeds cost gold) but the cap keeps hotel and tavern rooms usable.
- Navigation: a plant on a block adds no blocker; a plant on soil still blocks as now (roomBlockers unchanged).
- Old saves: plants on soil are valid unchanged. No data conversion needed. Still bump SAVE_VERSION by one (SG4) with MIGRATIONS[old] = normalise (drops plants whose seed id no longer exists, keeps everything else) + a fixture test, so an old client cannot load a save that has plants on blocks.

### 2.5 Harvest and splice flow (existing rules, extended)
- Plain plant: unchanged (yield by rank, seed back 30%, gems 'harvest').
- Spliced plant: gives the NEW seed (1), 25% a bonus block or crop of either seed (only if material), gems 'splice' by the result rank. Pair key goes to Player.splicesFound. 2 seeds in, 1 out, always.
- API: GameAPI.previewSplice(roomId, c, r, seed) -> { status: 'known' | 'new' | 'nothing' | 'ripe' | 'no_plant', result?, rank?, growMs, uses: [a, b] } (pure helper `splicePreview` in shared/src/splice.ts); spliceSeed() unchanged name, now uses spliceResult; harvestPlant uses spliceResult. A pair that was never found shows rank and grow time only (the category and the name stay hidden: that is the discovery); a found pair shows the result, its icon and what it grows.
- Hold-to-repeat never splices (as before).

### 2.6 UI
- Select a seed (hotbar): first time shows a hint (HINTS, reading pace): "Tap soil or any block to plant. Tap a young plant with another seed to splice." Valid targets glow faintly while a seed is selected (faint tint on soil and block cells in reach; Settings grid toggle respected).
- Splice preview: a small dialog (ui/confirmBuy.ts style, panelShell) over the plant: two seed icons, "+", "?" or the result icon, rank colour border, grow time ("about 22 min"), "Uses up 1 [seed]. You get 1 new seed.", buttons Splice / Cancel (44 px). Known common mixes with common ingredients splice with one tap (no dialog); every rare+ ingredient or new mix asks.
- Result toast and gain popup show the new seed; the first time a pair is found the Book flashes (one toast "New splice found").
- Book Splice tab (ui/bookPanel.ts): section SPECIAL (name or ??? with the existing one-ingredient hint) and section SEEDS MADE (one card per result seed in the pool: grey with rank border and category icon until some pair made it, then the name, icon and the pairs found for it). Progress = found result seeds + found specials over the total, rewards 25/50/75/100% as now (totals change: claimed rewards stay claimed, test).
- Texts in shared/src/text.ts. All strings reading pace.

### 2.7 ECONOMY SAFETY (balance.ts + balance.test.ts are the gate: a task is not done while they are red)
Principles: two seeds in, one out; the result rank never exceeds max input rank + 1 and never legendary; selling is at the lowest rate; time and cell-minutes are charged at the best plain crop rate; gems are tied to rank and grow time.
Generalise balance.ts to `allRecipes()` (special + general): chains(), spliceSellLoops(), seedProductValue. Tests over ALL pairs:
1. Reachability: every non-starter splice seed has a finite chain from starter seeds (ms, gold, cellMs).
2. STRICT sell-back: for every result, sold(seed) + sold(one harvest of its product) <= chain.gold (gold of the starter seeds it takes). Also per single step: sold(result seed + product) <= min gold(a) + min gold(b).
3. Cell-minutes: productValue / (cellMs/60000) < bestCropGoldPerCellMinute for every result (existing test, now over all).
4. Seed ratio: for every block seed `seedRatio(block)` < 0.85 (existing, now over the ~12 new blocks); plain plants expected seeds back = SEED_BACK_CHANCE (0.3) < 1; a splice gives exactly 1 seed for 2 (assert in the rule test) so seed count falls every splice; the bonus item (25%) punched can return at most seedRatio < 0.85 of a seed (assert total seeds out of one splice < 2).
5. Gems: gems per cell-minute of the best splice chain <= the best plain-harvest gems per cell-minute * SPLICE_GEM_CAP (config) and gems paid out of any chain valued at cheapestGoldPerGem() <= the chain's gold + cell-time (no gold -> gems -> gold loop; gold per gem >= 30 stays). Gem source share stays under 40% (BALANCE_TARGETS).
6. Packs: a pack sold back < its price (existing); no pack item list contains a splice-only seed.
7. Cycles: build the graph of all recipes (ingredients -> result) and assert that value per cell-minute never rises along any path and that no result has itself as an ingredient anywhere on a 3-step cycle with more value out than in (bounded check, depth 4).
8. Ore: ore sold per cell-minute < the mine's gold per minute; drinks: 2 mugs sold < the brew's own value (brewSellLoops style); furniture and styles are not sellable above SELL_RATES.splice * baseValue (existing test over all seeds' furniture); clothing seed duplicates give no spares (unlock only).
9. Determinism and freeze: golden pins of 30 general results; hash distribution test (every pool seed is reachable by at least 2 pairs; no category share outside +-8 points of its weight over all pairs); every special result exists and is in the pool.
10. Plants: PLANTS_ROOM_CAP * best profit rate * 1 h (all rooms full) <= 25% of a mixed hour at level 8 (balance targets); crops cannot be planted on non-soilHost blocks (rule test).
Simulate: `npm run simulate` gets a splice section (chain ms/gold/cellMs of the 10 cheapest and 10 most expensive results, gem rate). Record in NOTES.

### 2.8 Save versions and migration (use the NEXT free number when the task runs; the tree is at 29 on 16 Nov, QUEUE planned 30 for 9i-1 and 31 for 9h-2, so these renumber)
- SG1, SG2, SG3, SG5, SG6: NO GameState change (Player.splicesFound already keeps pair keys; data only).
- SG4 (plant on blocks): SAVE_VERSION + 1, MIGRATIONS[old]: normalise plants (unknown seed ids dropped to the bag as nothing, keep progress), no structural change; fixture test from the previous version; "a plant and a block in one cell" must pass isValidState.
- If SG3 adds `unlockedStyles` entries: data only.
- DG5 only: SAVE + 1 with run hazards.

### 2.9 Tasks (order and owner)
- SG1 [coder] seedCategory.ts, spliceRule.ts, spliceRules.json, SALT/RANK_CAP/UP_ONE_IN in config/farm.ts, `allRecipes`, `splicePreview`; recipeFor/splice/harvestPlant/spliceSeed use it; spliceGrowMs takes the result rank. Pool = the existing seeds first (so it works before content). Tests: determinism, order free, special wins, rank rule, cap, golden pins, coverage.
- SG2 [coder] balance.ts generalised to allRecipes + the ten tests in 2.7 (those that can run on the current pool); `npm run simulate` splice section. Gate for SG3.
- SG4 [coder] plant on blocks: farm.ts plantProblem, blocks.ts (punch refused when planted), nav unchanged, API (blocksFarmApi), caps, hints, SAVE bump + migration + fixture test; tap rules in game/blockInput.ts (a tap with a seed selected plants on a block cell; without a seed a tap still punches). Can run before SG1.
- SG3a..d [coder] content batches (data only, one batch per category group: a blocks + soil host, b crops + dishes + drinks, c furniture + clothes, d ore + styles + 30 special recipes); each batch re-runs SG2 tests and `npm run simulate`; icons by shape/colour first (BG2 icons) so nothing waits for art. Ship before any release (freeze).
- SG5 [coder] GameAPI.previewSplice + client: splice preview dialog, hints, first-time toast, selected-seed tint hook (render by artist).
- SG6 [coder] Book Splice tab (SPECIAL + SEEDS MADE), bookProgress totals, reward test.
- SA1 [artist] CODE-ART: plant-on-block look (sprout, small, full drawn on the top face of any block, offset 6 px up so the block edge shows), seed category badges (block, crop, drink, ore, furniture, clothing, style) 12x12, splice preview dialog CSS, splice effect (two seed icons spiral into one, sparkle by rank, 600 ms, effects setting respected), seed-select target tint, Book Splice tab card layout (grey card with rank border + category badge, found card).
- SA2 [artist] CODE-ART: icons for every new item as icon { shape, colors } in the data files (blocks, crops, mugs, ore, clothes, styles) with per-category shapes; furniture drawn as box models (existing ART-REDO path).
- SA3 [artist] PLUGIN: PNG icons and furniture for the new items by priority (rarest first), plant stages on blocks.

## 3. ORDER (both lanes, interleaved so neither part waits; matches the ROADMAP line)
Coder: DG1 -> SG4 -> SG1 -> SG2 -> DG2 -> SG5 -> SG3a..d -> SG6 -> DG3 -> DG4 -> (DG5 after owner OK).
Artist: DA1 -> SA1 -> SA2 -> DA2 -> SA3. Artist CODE-ART first (no plugin); stubs come first: every coder task has a hook the artist fills (drawDecor, plant-on-block, splice dialog CSS), so no lane waits.
Tester: after DG2 (20 seeds, 3 floors, feel: corridors, beats, loops), after SG5 (plant on a block, splice a known and a new pair, Book tab).
Not in scope: trading, new currencies, multiplayer splicing, random failure, timers that push buying (CLAUDE 13).

## 4. Risks
- Pool growth reshuffles general results: freeze after SG3 (golden test).
- Pillars and nooks break old assumptions (freeBlock over rect, chestSpotOk by rect): covered by tests in 1.6.
- Enemy and gold totals drift: simulate:dungeon gate in DG1 and DG4.
- Plant cap and block host are the only new exploit surfaces: tested in 2.7 (10) and 2.4.
