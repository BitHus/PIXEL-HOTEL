# PLAN-1B: phase 1B "One Inn" (lead, 15 Nov)

Scope: T1, K2, M-A, M-B, 9g (then M-C and M-E), 9i, 9h. Source of truth for the rules stays
CLAUDE.md and docs/BRIEF.md; the step prompts stay in docs/NEXT-STEPS.md (T1, K2, M-A, M-B are
[prompt ready]; they are REUSED as the spec, split into the tasks below). This file only holds order,
split, ownership and the fixes the old prompts need. Status of the code on 15 Nov: R1, 9t A/B/C, K1, S1,
S2, S3 done; SAVE_VERSION 23; DUNGEON_ROUND 1; ROADMAP 0.1 (owner playtest) NOT done.

## 1. Team and rules for working in parallel
Team: one coder, one artist, the lead (this file, merges, docs). Parallel = coder and artist at the same
time on DIFFERENT files. Two coder tasks never run at once.

FILE OWNERSHIP (default; a task may name exceptions)
- [coder]: shared/src/** (rules, config, save, api, types), shared/data/** (except art fields), client/src/api/**,
  client/src/game/**, client/src/ui/*.ts (panel logic, DOM structure with plain class names), tools/**, all tests.
- [artist]: client/src/render/** (iconPixels.ts, drawIcon.ts, furnitureArt.ts, avatar parts and poses, effects),
  shared/src/icons.ts (ICON_SHAPES only; a shape is added here AND in iconPixels.ts DRAW, a test enforces it),
  client/src/ui/ui.css, tools/art-sheet.ts, tools/icon-sheet.ts, and the FIELDS `art`, `icon`, `light` of
  furniture entries (never reformat a JSON file, never touch other fields).
- Never both: client/src/render/avatarParts.ts shape (approved, do not change); hats, emotes and name tags go in new
  render files. shared/src/config.ts: coder only; the artist asks for a constant in the task notes.
- Docs: each task writes its own NOTES.md section. The lead edits CLAUDE.md CURRENT STATE, ROADMAP ticks and
  BRIEF at merge time (stops three branches fighting over the same lines).

HANDSHAKES (how parallel work stays safe)
- Interface first: when the artist must be called by the coder (or the other way round) the first commit of the
  provider is a stub with the final signature. The plan names the stubs.
- Furniture data lands from the coder first (skeleton with placeholder icon from an existing shape and simple boxes),
  then the artist overwrites `art`/`icon`/`light`. Ids and footprints are fixed in this plan, so the artist can draw
  before the data exists and commit the art after the coder's skeleton lands.
- One SAVE_VERSION lane: only the task that owns the next number edits shared/src/save.ts, types.ts state types and
  newPlayer.ts. Reserved: MB-1 24, T1a 25, K2a 26, MB-2 27, 9g-2 28, 9g-4 29, 9i-1 30, 9h-2 31. If the order changes,
  renumber at merge (the later branch rebases). Every bump has a MIGRATIONS entry and a test.
- Branch per task `1b/<id>`, merge in plan order, typecheck + full tests green before merge. `npm run simulate`
  must keep balance.test.ts green (S3 numbers); a task that moves gold or gems says so and retunes config only.

## 2. P0: preflight
P0 [coder, S] Furniture data split. shared/data/furniture.json is about 3 200 lines and T1, M-A, 9g and 9h all add
types; the only importer is shared/src/furniture.ts (line 16). Make FURNITURE_TYPES = furniture.json + every
shared/data/furniture/*.json (new folder: carpentry.json, tavern2.json, suite.json, dungeon2.json), same shape, same
order rules; test: ids unique across files, bag sort order stable, every type valid (existing furniture tests).
No behaviour change. Files: shared/src/furniture.ts, furniture.test.ts, the empty extras files.
Also (no code): confirm main is green (npm test, typecheck) and note the test count in NOTES.

## 3. Task list

Size: S under 1 h, M 1 to 3 h, L split further. "Dep" = must be merged first.

### M-A Carpentry (lane C; no state change, no save bump)
MA-1 [coder, M] dep P0. Spec: NEXT-STEPS "Step M-A". 12 types in shared/data/furniture/carpentry.json
  (inCatalog false), ids and cells fixed here: plank_stool 1x1 seat; plank_bench 2x1 two seats; plank_table 2x2 surface;
  stone_fireplace 2x1 light; glass_lamp 1x1 light; brick_oven 2x1 (placeIn shop); thatch_rug 2x2 rug; clay_jug
  onSurface; stone_planter 1x1 decor; lantern_post 1x1 light; glass_cabinet 1x2 decor; brick_pillar 1x1 decor.
  Recipes in recipes.json from blocks + few materials, no gold; CHECK FIRST whether recipes accept block ids as
  inputs (blocks live in Player.materials group 'block'); if not, extend the craft rule in shared/src. Carpentry tab in
  the Workshop panel (grey when missing), gains list, Book furniture tab, baseValue and appeal on the existing scale.
  Tests per the prompt (recipes not cheaper than the catalog equivalent: compare per cell/appeal, document the rule).
  Files: shared/data/furniture/carpentry.json, recipes.json, the craft rule (shared/src/crafting*.ts), client/src/ui/workshopPanel.ts
  (find the real name), tests. First commit = skeleton data so the artist can start.
ART-MA [artist, M] dep: none to start (ids fixed above); lands art after MA-1 skeleton. 12 pieces drawn in the colours of
  their block (boxes, top + front, light top-left), icons (new shapes where needed: bench, fireplace, oven, jug,
  planter, post, cabinet, pillar), `light` for fireplace, lamp, post (warm, flicker), Carpentry tab styling in ui.css.
  Files: furniture/carpentry.json (art, icon, light only), render/iconPixels.ts, shared/src/icons.ts, render/furnitureArt.ts, ui.css.

### M-B Connected Inn (lane I)
MB-1 [coder, S] no dep. Inn name: GameState/Player.innName (max 16, same char rules as the display name, default
  "The Inn"), field in character creation, shown in the info panel, SAVE 24 with migration (default name) and test.
  Files: shared/src/newPlayer.ts, types.ts, save.ts, name validation (reuse), ui/characterCreation + infoPanel (logic), tests.
ART-MB1 [artist, S] dep MB-1 markup. Name field look in creation, plate for the Inn name in the info panel (ui.css only).
MB-2 [coder, M] dep MB-1, T1b (kitchen zone data must not overlap door spots). Rules: shared/data/innDoors.json (door
  spots in cells on the room edge for suite, tavern, garden; per shape and level), blocked for furniture, blocks and plants
  like the door zone, never covered; walking order suite - tavern - garden; pure innTravel(state, roomId, doorId) -> target room
  + arrival cell; refused during a run; npcNav keeps guests off door spots; the door_blocked reachability rules still hold.
  SAVE 27: items, blocks and plants on new door spots go to the bag (ledger, toast). Tests: valid on all 5 shapes x 3 levels,
  nothing on them, migration, travel keeps avatar and run rules, guests unaffected.
MB-3 [coder, M] dep MB-2. Client: stepping on a door spot (path end or crossing) switches room through the existing room
  switch with a short fade, arrives at the matching door; Map stays as fast travel; walking and hold-to-walk never trigger a
  door by accident (only a path whose goal is the door spot, or stepping on it). Files: game/roomFlow.ts, pointerInput.ts,
  api/roomsApi.ts, walkApi.ts, GameAPI method.
ART-MB2 [artist, M] dep: stub `drawInnDoor(layer, door)` in render/ (artist lands the stub first). Door frames in the wall
  and border where an inn door sits, a warm glow, the fade overlay polish (respect reduced motion), an arrival light.
  Files: render/innDoors.ts (new), render/roomView*.ts, ui.css.

### T1 Bar, taps, register, kitchen (lane T; prompt: NEXT-STEPS "Step T1", split in three)
T1a [coder, L-ish, run alone] dep P0, MB-1 merged (save order). Items 1 and 2 of the prompt, shared + API, no UI.
  tavern2.json: register (onSurface, 1x1), tap_stand (onSurface, TAP_SLOTS 2). The counter becomes a surface item
  (CHECK: it is already `servedFromBehind`/noPickup; the till box is drawn in its art and shared/src/bar.ts tillPoint
  reads it, so tillPoint must follow the register item, with a fallback for old saves). New shared/src/taps.ts:
  TavernState.taps, load/unload (ledger), menu rule (a drink is on the menu only while a tap holds >= 1 mug; dishes as K1),
  serve chain gets the pour step (stage 'bar', POUR_MS, count down, "tap is empty" keeps the order open) in guests.ts /
  tavern.ts. Config in config.ts (tavern numbers): TAP_SLOTS, TAP_CAP 12, POUR_MS. SAVE 25: a register and a tap_stand
  on the bar (else bag + toast), the new game's 7 root ale start loaded on a tap (old saves keep stock in the bag).
  GameAPI: getTaps, loadTap, unloadTap (api/tavernApi.ts). Tests per the prompt. Keep tavernTest.ts legacyStart() working.
T1b [coder, M] dep T1a. Item 3 and 4: kitchen zone per tavern shape and level as a cell rect in roomShapes.json (level 1 a
  corner that contains shopStart.stove; later levels grow it), npcNav staffZones includes it (guests never walk or sit
  there), prep_table (surface), pantry, sink, serving_hatch in tavern2.json, PREP_BONUS in cooking.ts (+1 dish per prep
  table next to a stove inside the zone, max +2), appeal check (each type counts at most 3, data only). No state change,
  no save bump. Tests: zone per shape/level, guest nav, bonus only adjacent and inside, a stove outside works without it.
T1c [coder, M] dep T1a, T1b, ART-T1 stubs. Client: ui/tapsPanel.ts (Load/Unload, stack or number), register tap opens
  Serve/Menu/Sell, tap_stand tap opens Taps (walk next to it first, like the stove: game/tavernLife.ts, gameLoop arrival),
  Menu panel shows tap levels and the hint, pour step in the avatar's errand (held mug shown after the pour), hints and old
  save intro toast (item 5, reading pace), Room panel shows the kitchen zone and calls the artist's tint, simulate-economy
  (pours/h, mugs per tap, dishes per batch with prep tables), BALANCE check. Files: ui/tapsPanel.ts, ui/menuPanel.ts,
  game/tavernLife.ts, gameLoop.ts, texts, tools/simulate-economy.ts.
ART-T1 [artist, M] dep: stubs in its first commit: render/kitchenTint.ts `drawKitchenTint(layer, rects)` and
  render/pourEffect.ts `playPour(view, tapUid)`; then the art. register, tap_stand (two taps, glow), prep_table, pantry
  (crop icons), sink, serving_hatch drawn into tavern2.json (art, icon, light); new icon shapes; counter art loses the
  baked till box once the register exists (coordinate in T1a's commit note); faint kitchen tint (like the grid); pour
  animation (a short stream and a mug fill, clink sound hook in audio only by name), tap level bars and panel look in ui.css.

### K2 Ripening (lane T; prompt: NEXT-STEPS "Step K2")
K2a [coder, M] dep T1 merged (taps; aged items are separate ids so a tap can hold them). Items 1, 2, 3, 5, 6: config
  RIPEN, <id>_aged / <id>_vintage derived from drinks.json (loader, not hand-copied), casks as data on the keg rack
  (TavernState.casks), fill / collect at current tier, taste guests (TASTE_AGED_CHANCE), menu and price rule for tiers,
  Book Drinks tab, SAVE 26. Gem tip multiplier already exists for high ranks (S3). Tests per the prompt. Simulate: aged
  1.4 to 1.7x, vintage 2.5 to 3x gold per mug; rerun balance.
K2b [coder, M] dep K2a, ART-K2 stub `tierBand` option in drawIcon. Client: ui/caskPanel.ts (4 slot cards, Fill/Collect, time
  bar via a 1 s interval like the stove), keg rack tap routing in game/tavernLife.ts, texts.
ART-K2 [artist, S] dep: stub first. drawIcon option `tier: 'aged' | 'vintage'` (gold band / red band), used everywhere icons
  show (render/drawIcon.ts, iconPixels.ts), cask panel look in ui.css, keg rack art shows filled casks (only if cheap).

### 9g Livelier suite (lane S; prompt NEXT-STEPS "Step 9g", split in four; prompt fixes in section 6)
9g-1 [coder, M] dep P0. Hats and emotes. clothing.json: 12 hats (slot hat, none free, ranks, unlock source text: catalog
  Clothes tab for 4, rest from Book rewards (bookRewards.json), quest, boss, legendary fish, rare drop); locked hats are
  grey silhouettes with a hint. Emote state (wave, dance, laugh, cheer, sleep) as a transient avatar field (not saved),
  GameAPI emote(kind), emote button near chat, name tag pref in Settings. CHECK balance.test.ts: hats are "hidden until
  unlocked" clothing, so they enter the clothes packs' pools and change the Common/Rare Clothes timing targets: keep hats
  out of the packs (pool flag) unless the owner wants them in. No save bump if unlock goes through Player.unlockedClothing.
ART-9g1 [artist, M] dep: stubs `hatPart(id)` and `emotePose(kind, t)` in new render files. 12 hats on the head only (the
  avatar shape stays approved), five emote poses and the zzz, the name tag plate, locked silhouettes, Emote button look.
  Files: render/hatParts.ts (new), render/emoteAnim.ts (new), render/avatarSprite.ts (integration, artist only), ui.css.
9g-3 [coder, M] dep P0 (parallel to 9g-1 in file terms, but still one coder at a time). roomScore: shared/src/roomScore.ts
  (pure: furniture value by rank, variety of types and themes, lights, rugs, wall items, style not bare, capped) -> 1 to 5
  stars with config thresholds and tips ("add a light"); shown in the Room panel for the HOTEL room. Derived, no save bump.
  Tests: monotone, capped, empty room 1 star, each tip appears. ART-9g3 [artist, S]: star row and tips look (ui.css, small icon).
9g-2 [coder, M] dep M-A (stone_fireplace, glass_lamp, lantern_post get `use`), 9g-1 not required. FurnitureType.use
  'toggle' | 'music' | 'fire' | 'none' (item state on/off, saved: SAVE 28), music box tune defined as data and played by the
  client audio, wall clock (real time passed in, no Date.now in shared), mirror opens the Avatar panel, pet basket + cat
  (shared/src/pet.ts pure wander/sit/sleep/follow with rng and time passed in; the cat position is NOT saved precisely, only
  adopted + name). Catalog: clock, mirror, music box, pet basket (the "fireplace" of the prompt is the M-A stone_fireplace;
  no second one). Guestbook is in 9g-4. ART-9g2 [artist, M]: cat sprite poses (walk, sit, sleep, purr heart), music box,
  clock face, mirror, pet basket, fire flicker, lamp on/off look; stub `drawCat(view, state)` first.
9g-4 [coder, M] dep 9g-3, K2 merged (guest and npc code stable), MB-2 not required. Visitors in the hotel room while the
  player is there: shared/src/visitors.ts (arrival timing by stars, at most 2, walk with the hotel nav grid, look at things,
  sit on free seats, lines by stars and by what they look at in npcLines.json, leave a coin tip by stars that must be tapped:
  hotel-side Mess state, SAVE 29), reuse guestLook and npcNav; guestbook item (last 10 lines). ART-9g4 [artist, S]: coin on
  floor/table (reuse render/tableMess.ts), guestbook art, visitor bubbles reuse guest bubbles.

### Inn score and showcase (after 9g)
MC [coder, M] dep 9g-3, T1, K2. shared/src/innAppeal.ts: 0 to 100 from tavern appeal (appeal.ts, as today), suite stars, garden
  beauty (flowers, lanterns, fences, plants and blocks by baseValue, capped per type like decor). It sets guest rate and tip size
  (visitor numbers later). RISK: the guest rate and all S3 gold tables use tavern appeal; weight the tavern part so a new
  game's gold numbers stay inside BALANCE_TARGETS, and test it. Info or Room panel shows the three parts. No save bump.
  ART-MC [artist, S]: three-part meter, garden score tips look.
ME [coder, M + artist, M] dep MC, 9g-1, 9g-2. Showcase in the suite, all DERIVED from existing state (no slots, no bump):
  hat stand (shows the worn or newest unlocked hat), splice shelf (a pot per recipe found, from Player.splicesFound), Book plaque
  (percent per tab). Three furniture types in furniture/suite.json (coder skeleton), art and the pot/plaque drawing (artist,
  render/showcase.ts). Real trophy slots and achievements stay phase 3.

### 9i Questline (lane Q; prompt NEXT-STEPS "Step 9i"; replaces the 8 HINTS in shared/src/quests.ts)
9i-1 [coder, L, run alone] dep 9g done (so chapters can cover the suite). quests.json schema, questProgress(state, event),
  event counters in state (SAVE 30), daily side tasks with the day passed in, claim through the ledger, migration marks
  already-done quests with ONE summary reward. Replace the hint indexes carefully (hintsDone is saved).
9i-2 [coder, M] dep 9i-1, ART-9i stub. Quest card, Quest log panel, Claim button; ART-9i [artist, M]: reward pop, log and
  card look.
9i-3 [coder, M, data] dep 9i-1. Chapters in the new flow order (see section 6): 1 Garden (plant, harvest, punch, splice,
  carpentry), 2 Tavern (serve, brew, cook, taps, cask, 100 gold), 3 Suite (stars, hat, cat, visitor tip, Inn score),
  4 Expeditions (crypt, mine and forge, lakeside), 5 Deeper (added after 9h), 6 Collector. From here every task adds its quests.

### 9h Dungeon round 2 and two themes (lane D; prompt NEXT-STEPS "Step 9h"; independent of the tavern lane)
9h-1 [coder, M] DUNGEON_ROUND = 2 (three floors, 5 to 8 rooms, all enemies, mimics, Bone King as end boss), run
  simulate:dungeon (slow, minutes) per gear tier, tune to 60 to 75% survival. RISK: run gold per hour feeds the S3 gold
  shares; rerun npm run simulate and keep balance.test.ts green. Check the floor 3 end flow in the client (boss, bank, exit).
9h-2 [coder, M] dep 9h-1. shared/data/dungeons.json theme schema, generator options, picker data, best depth per theme
  (SAVE 31), per theme materials by rank and loot tables, Book entries. ART-9h1 [artist, M]: theme picker cards, theme palettes
  and chest colours (render/dungeon palette files).
9h-3 [coder, L] dep 9h-2. Sunken Cave: crab (1 less damage), jelly, spitting fish (slow projectile), giant crab boss, shallow
  water slows. 9h-4 [coder, L] dep 9h-3. Overgrown Ruins: thorn bush, spider, spore cap cloud, stone guardian slam (800 ms
  telegraph). One pure step() stays deterministic; new rng uses the passed rng.
9h-5 [coder, M] dep 9h-2. Room features for all themes: fountain (30% once), locked treasure room with a key on one enemy,
  blinking spikes, cursed chest. 9h-6 [coder, M] dep 9h-3..5. Crafted furniture set (5 pieces, floor, wall) per theme in
  furniture/dungeon2.json + recipes, simulate per theme and tier.
ART-9h2 [artist, L, split per theme] dep stubs per enemy: code-drawn enemy placeholders (6 enemies, 2 bosses), projectile,
  slam marker, spore cloud, water, spikes, fountain, treasure room door; ART-9h3 [artist, M]: the 10 furniture pieces and 4 styles.

### Checkpoints (owner)
CP-1 after batch 3: owner plays one hour from a new game (ROADMAP 0.1 was never done); one fix list, fixed before 9g.
CP-2 after 9g and MC: same, then 9i content is written against what was found.

## 4. Order and batches
Coder queue (single lane, in this order): P0, MA-1, MB-1 | T1a, T1b | T1c, K2a | K2b, MB-2, MB-3 | 9g-1, 9g-3, 9g-2 | 9g-4, MC, ME |
9i-1, 9i-2, 9i-3 | 9h-1 .. 9h-6. Artist queue (follows the coder by one step): ART-MA, ART-MB1 | ART-T1 | ART-K2, ART-T1 polish |
ART-MB2 | ART-9g1, 9g3, 9g2 | ART-9g4, MC, ME | ART-9i | ART-9h1..3.

BATCH 1 (recommended first, small and parallel; roughly one day):
- [coder] P0 furniture split, then MA-1 carpentry, then MB-1 Inn name (SAVE 24).
- [artist] ART-MA (12 pieces, icons, tab styling), then ART-MB1 (name field and plate).
- Why this batch: no tavern files at all, so no conflict with the heavy T1; M-A and the Inn name are the two smallest [prompt ready]
  items; P0 removes the furniture.json conflict for everything after; the artist has a full, well-defined job from the first minute.
- Overlap check: the coder touches shared/**, api, ui/*.ts logic; the artist touches render/**, ui.css, icons.ts, art fields of
  carpentry.json (after the skeleton commit). The only shared surface is carpentry.json (handshake above).
BATCH 1 STATUS (lead review): built, NOT committed. Seen in the files: furniture split (4 extras files, furniture.ts merges them),
12 carpentry types in carpentry.json plus 12 recipes, SAVE_VERSION 24 with the innName migration and isGameState check, Inn name
in newGame.ts, hotbarBag.ts and ui.css. Tests, typecheck and git diff were NOT run by the lead (no shell in this session): the
coder's report of green tests is unverified here. Known: client/src/api/traderAPI.test.ts fails on Windows (path separator,
fails on a clean checkout too; fix = normalise the path in the test, a small coder fix). The artist's UI (Carpentry tab, name field,
plate) has no screenshot: check by eye before commit. To do before commit: npm test, npm run typecheck, one look at the creation
screen and the Workshop tab, commit as "1B batch 1".
BATCH 2: [coder] T1a then T1b; [artist] ART-T1 (stubs first). BATCH 3: [coder] T1c then K2a; [artist] ART-T1 polish, ART-K2. Then CP-1.
BATCH 4: [coder] K2b, MB-2, MB-3; [artist] ART-MB2. BATCH 5 to 7: 9g, MC, ME, then CP-2. BATCH 8 to 9: 9i. BATCH 10+: 9h.

## 5. Dependencies in one view
P0 -> MA-1 -> (9g-2 uses its pieces) | MB-1 -> T1a -> T1b -> T1c -> K2a -> K2b | T1b -> MB-2 -> MB-3 | K2 -> 9g-4 | 9g-3 + T1 + K2 -> MC |
MC + 9g-1 + 9g-2 -> ME | 9g -> 9i-1 -> 9i-2, 9i-3 | 9h-1 -> 9h-2 -> 9h-3 -> 9h-4, 9h-5 -> 9h-6 (9h could start earlier on a second
coder; it touches only dungeon files).
CAN RUN IN PARALLEL (coder with artist): any coder task with its ART task; MA-1 with ART-MA; MB-1 with ART-MA; T1a/T1b with ART-T1.
CANNOT: two coder tasks (save.ts and config.ts are shared hot files); T1 and K2 (same tavern files); 9g-4 before K2.

## 6. Fixes the old prompts need (the lead applies these when pasting a prompt)
- T1: the till is a box inside the counter's art and bar.ts tillPoint; the register as a separate item must replace it. The
  old-save migration in the prompt says "6 root ale"; S3 made it 7. Start items live in config TAVERN_START_ITEMS + roomShapes.json shopStart.
- K2: written before T1; casks feed taps now (aged and vintage ids are tap-loadable, nothing special). Slots are 3 casks per rack.
- M-A: "ui/workshopPanel.ts" name unverified; check that recipes can take block inputs.
- M-B: kitchen zone and door spots both live on the tavern edge: MB-2 depends on T1b.
- 9g: item 6 says "use the customer code": that is gone (S1); use guests.ts, guestLook.ts, npcNav.ts. Item 3 lists a catalog fireplace:
  M-A already has stone_fireplace, give it `use: fire`. Item 5 room score overlaps M-C: 9g-3 scores the suite only. Hats vs packs: see 9g-1.
  Item 7 guestbook goes with visitors.
- 9i: chapter 1 mentions selling at the stall (gone, S1) and old hints; use the order garden, tavern, suite, expeditions; chapters
  for 9h themes come after 9h; hintsDone is saved, so 9i-1 needs a migration for the old 8 hints.
- 9h: written before the tavern; it assumes round 2 is switched by config only (true) but run gold feeds the S3 shares (see 9h-1).
- Every prompt: add its quests to quests.json once 9i-1 exists (CLAUDE.md section 14 line comes with 9i-1).

## 7. Open questions for the owner
1. Taps: real (loaded, poured) or decoration? This plan assumes real, as the planner advised in INN-PLAN section 6.
2. Hats in clothes packs or not (changes pack timing targets).
3. Inn score weights: may M-C change the guest rate of existing saves, or must a new score start neutral?
4. Playtest checkpoints CP-1 and CP-2: ok to pause new features for them?
5. Should 9h-1 (round 2 on) move earlier, since it only touches dungeon files? It needs a rebalance either way.
