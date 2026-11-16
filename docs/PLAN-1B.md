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
STATUS 15 Nov after T1a/T1b: the T1 items below are DONE (register item, 7 ale start, taps in shared/src/taps.ts, kitchen zone). They are now applied
in docs/QUEUE.md, which has the refreshed K2, MB-2, MB-3 and 9g-1 prompts (ready to paste). Use QUEUE.md, not the old NEXT-STEPS prompts, for those four.
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

PAUSE NOTE (artist, ART-T1)
- DONE: stubs, both fully working: client/src/render/kitchenTint.ts `drawKitchenTint(layer, rects)` (rects = world-px Rects, [] clears) and client/src/render/pourEffect.ts `playPour(itemViews, tapUid, durationMs=800, onSound?)` (wired through ItemViews.pourAt/update/setRoom in itemViews.ts; the stream/mug are drawn, spouts at TAP_SPOUTS dx +-8, dy -13: retune to dy -24 and MUG_DROP 13 once the tap_stand art exists). New icon shapes register, taps, sink, hatch, pantry added in shared/src/icons.ts and client/src/render/iconPixels.ts (pantry reuses nothing; prep_table can use 'table'). Tap glow = a `light` field on tap_stand, not done yet.
- NOT STARTED: art/icon/light fields of the six pieces (shared/data/furniture/tavern2.json was still `[]`, the coder's skeleton had not landed), counter art losing the baked till (boxes 4 and 5 of the counter in furniture.json, only after T1a's register exists), Taps panel CSS in ui.css (planned classes .taps-list, .tap-row, .tap-level, .tap-load; tell the coder), the visual check with npm run dev.
- Last run: client/src/render tests and `tsc -p client` were green after the last edit (full suite not run). Next step: when tavern2.json has the six ids, fill art/icon/light (tap_stand: two pipes at dx +-8, light radius ~40 color 10), then the ui.css Taps panel, then run npm test, typecheck and look at it.

## PAUSE NOTE (coder)
- traderAPI test fix: DONE (client/src/api/traderAPI.test.ts, path separators normalised in the test only). Not re-run yet.
- T1a: IN PROGRESS, design only plus data. Touched: shared/data/furniture/tavern2.json (skeleton for register, tap_stand, prep_table, pantry, sink, serving_hatch; register and tap_stand appeal 0 on purpose so old saves keep their guest rate), shared/data/furniture.json (counter now surface:true), shared/src/types.ts (FurnitureType.taps?). NOT started: taps.ts, TavernState.taps, config (TAP_SLOTS, TAP_CAP 12, POUR_MS), bar.ts register point, newPlayer start items and 7 ale on a tap (start barrel brew then empty), SAVE 25 migration, GameAPI getTaps/loadTap/unloadTap, tests (legacyStart/withAle must load a tap).
- T1b: NOT started.
- Tests and typecheck: NOT run since these edits (last known green state unknown; counter surface:true may break furniture/seat tests).
- Next step: run npm test and typecheck, fix fallout from the counter change, then build shared/src/taps.ts. Design: drinks are not reserved from the bag; available mugs = tap mugs minus open drink orders (not yet poured); the mug is taken at the pour step; a held mug goes back to the bag if the guest leaves or cancelServe runs.

## PAUSE NOTE (artist, 16 Nov): avatar prototype state and exact next steps
DONE (client/src/assets/sprites/avatar/, sources art-src/aseprite/): body_base, shoes_boots, legs_trousers, legs_hose (walk 4 frames: down, up, right), torso_tunic (down, up, right),
hair_front_short (down, up, right), hair_front_long (down, up), hair_back_long (down, up), face_default (down, right), hat_straw_hat and hat_felt_cap (down, up, right), outer_apron (down, up).
Down was reviewed by the critic (12/16, then fixed); UP and RIGHT facings and the new items were NOT yet reviewed by the critic and have no composed contact sheet. Hat doubling: the straw hat and the
felt cap were two visible layers in head_proto.aseprite; the felt cap now lives in its own file art-src/aseprite/hat_felt_cap.aseprite and every hat PNG holds only its own hat.
NEXT STEPS (in order):
1. Contact sheet: copy tools/avatar-prototype-sheet.ts to client/src/a24-sheet.ts (it reads the down files; extend its file list for up and right and the new items), run vite, screenshot; then run the pixel-critic on up and right.
2. A25 still missing: SIT frames per facing (body_base, torso_tunic, legs, shoes, one 32x64 frame each: body and torso shifted down 8 px, the head layers follow with a sit head offset of (0, 8) to be put in avatarRig.json),
   hair_front_long and hair_back_long for the right facing, face_default for the up view is not needed, outer_apron for the right facing and its sit frames, legs_hose right is trousers plus garter (not narrowed like down).
3. Checks to do: right-facing walk frames (arm swing, legs), the 1 px outline at bake, the key-colour test over the new PNGs (npx vitest run client/src/render), the gap between head and torso (row 29) now that the neck is gone.
4. Hat tweak: the straw hat reads summer or cowboy; the felt cap with a feather is the medieval option; a hood plus coif is still to draw (hat_hood_coif, down, up, right).
5. Owner decisions pending: the character style lock (proportions B were chosen provisionally), hair colour ramps, which hat is the default.
6. Do not edit shared/, api/, game/; the 50 save-migration test failures belong to the coder's save 28 work.

### PAUSE NOTE update (artist, A26, 16 Nov)
DONE (client/src/assets/sprites/avatar/, sources art-src/aseprite/avatar_sit.aseprite and avatar_r2.aseprite; avatarAssets.test.ts 53 green): sit_down/up/right for body_base, torso_tunic, legs_trousers, legs_hose and shoes_boots (down, right; shoes_boots_sit_up is NOT drawn on purpose: from behind the feet are hidden), hat_hood_coif_still_down/up/right (green hood, cream coif; the hat must HIDE all hair: data `hides: all`), hair_front_long_still_right, hair_back_long_still_right, outer_apron_walk_right (4 frames, frames 2 and 4 bob 1 px up like the torso). Contact sheet: tools/avatar-prototype-sheet.ts (copy to client/src/a26-sheet.ts + a26-sheet.html), image art-src/staging/a26-contact-sheet.png (walk, sit, hood, long hair, apron, zoom 3 and 1).
FOR THE CODER: the sit frames lower body, torso AND the head block by 8 px (hips at seat height 10, knees at row 54). shared/data/avatarRig.json has sit head [0,0] for all facings; it must be [0,8] (or the head layers drawn 8 px lower in sit), otherwise hair, face and hat float 8 px above the sit body. The sheet applies +8.
NOT DONE: outer_apron sit frames (down, up, right; an apron on a seated avatar currently stays standing-pose: hide the outer layer in sit until drawn), a sit_up shoes file, hood: the coif's right edge (sand, x21) may read as a stray column and the apron strap floats next to the bib (right view); polish after the owner's look at the sheet. The critic pass saw only a composite filmstrip without body and was not usable (4/10 on layers alone); the composed sheet looked right at zoom 1 and 3. Not started: the 19 catalog furniture icons (register, tap_stand, prep_table, pantry, sink, serving_hatch, keg_rack, display_case, dartboard, wall_clock, wall_mirror, music_box, pet_basket, dice_cup, bard_stool, barrel_table, tankard_rack, window_curtains, writing_desk). Plan: three sheets of 8 icons in art-src/aseprite/icons_t2/t3/t4 (copy an open icon sheet with save_as to keep the Endesga palette; save_as renames the open doc).

## PAUSE NOTE (coder, G2)
Done: (1) empty hotbar slots are selectable (client/src/game/hotbarBag.ts onTap: empty slot deselects the item and takes the selected frame; keys 1-6 use the same path). (2) Pour RULES done and tested: shared/src/pour.ts (pourFill, pourGrade, pourTip), config POUR_FULL_MS / POUR_PERFECT_RANGE / POUR_MAX_FILL / POUR_TIP_RATE, shared/src/pour.test.ts. typecheck and npm test green (1399).
Left for G2:
- API: new task stage 'pourwait' in client/src/api/tavernApi.ts runErrand (stage 'bar' arrives -> stop, emit 'pour_ready'; today it auto-pours POUR_MS); new GameAPI call pourHeld(heldMs) -> pourOrder + holding.perfect + 'holding' event; new carryHeld() that starts the 'table' errand when the player taps the guest, order bubble or table (no longer automatic for drinks; dishes stay automatic).
- Add `perfect?: boolean` to TavernState.holding (save version bump + migration + test), and deliverOrder adds pourTip(perfect, price) to the mess coins. Add a balance test that the tip rate stays small.
- Client: game/tavernLife.ts (pour button over the tap: pointerdown starts, pointerup calls pourHeld; tavernTap on the holding guest calls carryHeld), render/pourFx.ts + tavernFx.ts (fill follows the hold, lever, foam), audio/sound.ts (pour pitch rises). UI worker CSS: .pour-btn and a .pour-bar (fill bar with the perfect window mark) near the tap.
- Update CLAUDE.md section 9 (THE BAR AND THE TAPS) and docs/BRIEF.md for the new pour rule.
- Cat loop: client/src/render/catView.ts (drawCat box) plus a gameLoop call of stepPet when player.pet is set and a pet_basket is placed (shared/src/pet.ts is ready).

## PAUSE NOTE (artist, icons, 16 Nov)
Redrawn 32x32 icon PNGs (client/src/assets/sprites/icons, sources art-src/aseprite/icons_b1..b3.aseprite, 8 per sheet, 256x32; split with a tiny node script, cells left to right):
gold, gems, key, health_potion, root_ale, roasted_turnip, potato_stew, wood | copper_ore, iron_ore, copper_bar, iron_bar, copper_sword, iron_sword, steel_pickaxe, steel_axe | turnip, potato, carrot, pumpkin, glowcap, carrot_cider, pumpkin_stout, copper_reel_rod. Render tests pass. Critic on b2: 7/10, no blockers; to polish: steel_pickaxe head needs pointed tips, copper_ore rock reads cooler than iron_ore.
Method that worked: one Aseprite doc per 8 icons, draw ops (ellipse, rect, thick lines, polyline fill, grid) with Endesga 32, outline #3e2731.
REMAINING ids: materials mithril_ore mithril_bar crystal gem bone cloth resin amber golden_acorn slime_gel + dungeon drops (sticky_core royal_jelly slime_crown bat_wing echo_fang moon_membrane night_pearl bone_dust rusty_buckle grave_ring ancient_skull chest_hinge mimic_tongue gilded_lock greedy_heart royal_bone king_seal crown_shard kings_heart throne_piece); drinks glowcap_tonic; food potato_stew done, carrot_soup pumpkin_pie glowcap_broth grilled_perch carp_stew eel_pie; seeds turnip_seed potato_seed carrot_seed pumpkin_seed glowcap_spore (plan: cream sack, ribbon in crop colour, seeds in seedIcon colours); gear mithril_sword leather_armor iron_armor mithril_armor mithril_rod; fish (18 ids); packs random_blocks basic_seeds common_clothes rare_clothes; blocks (kind blocks, not icons); clothing (40); catalog furniture icons (lamps, fireplace, rugs, shelves, beds, wardrobe, chests, benches, plants); UI icons (pixelIcons.ts / iconPixels.ts: side buttons, toast icons, emotes, hat/shirt/hair) not started.

### PAUSE NOTE update (artist, icons, round 2)
Done since: critic points fixed (steel_pickaxe pointed tips; copper_ore warm brown with orange veins, iron_ore cool grey-blue with silver flecks). New 32x32 PNGs (sheets icons_b4, icons_f1, icons_f2 in art-src/aseprite): seeds turnip_seed potato_seed carrot_seed pumpkin_seed glowcap_spore (a pile of seeds per crop colour), mithril_ore mithril_bar mithril_sword; furniture lamp rug bookshelf bench sofa crate barrel potted_flowers shelf desk banner sign hanging_lantern shop_rug mug_shelf menu_board. Critic on f1/f2 fixed: lamp outline, rug dotted fringe removed, bench now has a backrest, sofa widened, barrel top, mug handles, lantern sparks. Open: shelf top tier is busy.
Still to draw (catalog furniture): wall_clock wall_mirror music_box pet_basket dice_cup bard_stool barrel_table tankard_rack dartboard window_curtains writing_desk display_case keg_rack register tap_stand prep_table pantry sink serving_hatch. Items still open: drinks glowcap_tonic, food (carrot_soup pumpkin_pie glowcap_broth grilled_perch carp_stew eel_pie), mithril_armor mithril_rod leather_armor iron_armor, fish (18), packs (4), dungeon drops and gems/materials listed above, UI icons (pixelIcons.ts) not started.

## PAUSE NOTE (artist, 16 Nov, DA1/MOBS/SA1)
DONE: DA1 client/src/dungeon/propArt.ts (drawProp/drawDecor(kind, variant, clockMs), PROP_INFO, propLight, drawPropSheet; 30 kinds; test propArt.test.ts). MOBS: actors/slime_idle, bat_idle, mimic_idle PNG strips (64x32, 2 frames of 32x32; sources art-src/aseprite/mob_*.aseprite) plus client/src/dungeon/enemySprites.ts enemyIdleFrame(kind, mimic, clockMs) for the dungeon coder to wire (null = code art). BLOCKS audit: all 10 blocks in blocks.json have a PNG, nothing missing. SA1: render/categoryBadges.ts (+test), skin.css block (splice dialog, .splice-card, .cat-badge, .seed-target, splice fx; names in the comment), farmArt.ts drawPlantOnBlock (6 px lift).
LEFT: skeleton (32x64) and Bone King (64x96) PNG strips; the two reskin mobs; new block tiles only after the coder adds blocks (SG3a); the coder must toggle `reduce-fx` on the UI root and wire the hooks; no visual check in the browser yet (prop sheet via drawPropSheet).

## PAUSE NOTE (coder, pour, 16 Nov): hands-on pour rework is WORKING
ROOT CAUSE of "nothing works": the old "Hold to pour" button was a child of #ui, which has pointer-events:none, and .pour-btn never set pointer-events:auto, so presses fell through to the canvas (walk). Also the camera could be elsewhere so the stand was off screen.
NEW (no button): hold the tap stand itself. client/src/game/pourControl.ts (state machine, claims/down/up, Space/Enter, blur/visibility/cap), render/pourFx.ts (world-drawn lever, stream, mug level, foam, green gauge window, shake), tavernLife.ts (wiring, hint "Hold the tap", camera glides to the stand, Perfect! float), pointerInput.ts (onPress claim), shared/src/pour.ts (POUR_FULL_MS 1400, POUR_HOLD_CAP_MS, pickPourTap, pourHeldClamp, tests), tavernApi.runErrand drops a stale pourwait. Delivery: tap guest, seat or table. Also hood_coif hat and apron hidden while sitting.
PROVEN headless (Chrome + ?e2e hook window.__ph, build + vite preview): guest order -> avatar at taps -> hold 1.4 s -> perfect, tap 7->6 -> tap guest -> served (eat) -> 10 coins on the table. NOT exercised: tapping the coins (old code), touch, keyboard, two stands, under/other-drink toasts.
NEXT: by-hand touch test; artist: tap lever frames + mug fill frames (boxes now); CSS for .pour-hint (inline default); optional: remove the ?e2e hook. Open, not mine: balance.test.ts "splice result sold back" fails and shared typecheck (guestLook GUEST_SPRITE_PIECES) from other WIP.

## PAUSE NOTE (UI round 5, 16 Nov)
DONE (code, not yet seen in a browser): panels.ts close slide-out (.panel-leaving, 130 ms, off for reduced motion); hotbar pressed state and just-selected pop (hotbar.ts, skin.css); toasts 40 px higher (clear of the name plate), gain popups clamped above the hotbar (gainPopups.ts); hotbarBag.ts interval compacts the quest card (hint.setCompact) after 1.5 s of walking and sets .walk-compact on the UI root (first-steps card keeps seal and pips); mug gauges (mugGauge in tapsPanel.ts: Taps rows and the Menu tab strip, drink rows); Menu rows (coin stepper, peg On/Off switch, candle edge); recipe cards with ingredient chips (needChip) and vessel bars (vesselBar pot/tankard) and a pulsing Collect in cookingPanel.ts and brewingPanel.ts; Room panel stars, appeal bar, tip note. CSS: end of skin.css "UI round 5". Client tests (ui) green, client tsc clean, vite build ok.
LEFT: ONE headless Chrome run (build + preview, bar panel, Book, Bag at 1000x700 and 420x760; driver draft in the session scratchpad cdp.cjs); check the 12-pip gauge and 52 px switch fit at 420 px; Cask tier ribbons, Book, Bag, Settings and the quest list were only audited (round 1 to 4 CSS already there), no new work. shared/ tsc is red from another WIP (dungeon/legacyLayout.ts, save.test.ts), not UI.

## PAUSE NOTE (coder L2, 16 Nov, SG4/SG1/SG2)
DONE SG4: plantProblem(room,items,c,r,ctx,types,seed?) in shared/src/farm.ts (soil or block host; food seeds need soil/soilHost; PLANT_ROOMS, PLANTS_ROOM_CAP in config/farm.ts; PLANT_REFUSALS texts there), cellProblem(..., allowBlock), hitBlock refuses 'planted', BlockProblem + needs_soil/planted/too_many_plants, soilHost on dirt, SAVE_VERSION 30 + MIGRATIONS[29] (normalise plants) + tests (plantsOnBlocks.test.ts, save.test.ts), keepSoilUnderPlants skips host cells.
DONE SG1: seedCategory.ts, spliceRule.ts (spliceResult, generalResult, allRecipes, fnv1a32, resultRankIndex, categoryWeights), data/spliceRules.json, SPLICE_SALT/RANK_CAP/UP_ONE_IN in config/farm.ts, splice.ts (recipeFor/splice use the rule, spliceGrowMs uses result rank, splicePreview), seeds.ts (isFoodSeed, isStarterSeed, isSpliceable, allSeedIds), optional flags spliceOnly/noSplice on crops/blocks/splice seeds (packs.ts skips spliceOnly), spliceRule.test.ts with 30 golden pairs.
SG2 STARTED: balance.ts chains()/spliceSellLoops() now use allRecipes(). balance.test.ts STRICT test is RED on purpose: flower_crown_seed (ultra clothing) comes from cheap common seeds (gold 8, spare sells 12) because the pool has no common/rare clothing, so the rank fallback steps UP. Fix (not the test): limit upward fallback to max input rank + 1 (then re-pin GOLDEN), or let SG3 content fill the pools; then add the 10 test groups of plan 2.7 (plants cap needs a net-of-seed-cost rate, not baseValue).
LEFT: SG2 test groups + simulate splice section; CLAUDE.md sections 9, 10b and SAVE_VERSION 30 wording, docs/BRIEF.md, NOTES; full suite, typecheck (dungeon files have errors from the dungeon coder), build, npm run simulate.
CLIENT NEEDS (SG4b/SG5): BLOCK_REFUSALS texts from PLANT_REFUSALS, plantSeed passes the seed (already via farm.plantSeed), tap on a planted block must call hitPlant first, GameAPI.previewSplice wraps splicePreview.

## DONE (coder L1, DG1, 16 Nov): layout wired, tests and docs done; the text below is the old pause note
State: typecheck green; generate.ts is STILL the old generator (nothing wired). Added, unused so far: shared/src/dungeon/{legacyLayout.ts (old layout moved, exports generateLegacyCrypt, generateLegacyLayout; freeBlock now tests isFloorBlock), layoutCommon.ts (shared helpers moved out of generate.ts), rooms.ts (templates + masks + maskConnected), themes.ts, pacing.ts (routeBetween, cheb, nearest, worstBeatDistance, longestStretchWithout)}, shared/data/{dungeonRooms,dungeonThemes}.json, config/dungeon.ts constants (DUNGEON_ZONES, CORRIDOR_MAX, LOOPS, PACE_*, ROUTE_LEN_*, LAYOUT_ATTEMPTS), optional map fields links/extras/decor/roomInfo in run.ts (types DecorProp, MapLink, RoomInfo). The sim baseline (simulate:dungeon before) did not finish; rerun it first.
Next steps: 1) write shared/src/dungeon/layout.ts (generateCryptLayout(seed,n,round): FloorPlan; the file was lost, a heredoc failed): zones growth, templates, rooms placed beside the parent in the zone direction with straight door-to-door corridors (gap 1..3, linkOptions on mask edge cells), loops (rooms>=4), retry attempts until loop + route 25..70, nooks/vault/secrets as extras, themes, enemies/chests (same totals; vault holds the golden or one wooden chest), props, landmark, pacing fill (prop within PACE_NEAR of every route point, move enemies for PACE_ENEMY_GAP). 2) generate.ts: re-export layoutCommon, generateFloor -> layout, generateMine -> generateLegacyLayout (mine rules). 3) tests (determinism, golden hash seeds 1..20, flood fill covers all floor, corridor <=5, loop, variety, beat coverage, totals vs generateLegacyCrypt, old map without new fields loads). 4) simulate:dungeon before/after within +-10%, NOTES, CLAUDE.md section 10 LAYOUT wording (plan section 0A) and BRIEF. DG2 not started.

SIM BASELINE (before DG1, simulate:dungeon, old generator, tail 40 lines):
350 ms                  12.3         11.2         14.6         14.1          0.0
500 ms                  14.7         12.6         11.5         11.9          0.0
700 ms                  11.8         13.7         16.6         12.4          0.0
500 ms + iron           14.8         13.0         12.9         12.8          0.0

=== Round 2: 1000 runs per row, level 1, no potions ===
bot            survive  value/run  value/banked  gold/banked  floors  minutes  timeouts  avg level after 10 runs
350 ms           91%      387        418          166     2.95     2.5        0      8.00
500 ms           65%      283        398          155     2.89     2.4        0      8.00
700 ms           40%      159        303          127     2.67     2.3        0      8.00
500 ms + iron   100%      427        427          167     3.00     2.6        0      8.00

Rare drops found (banked or lost) per 100 runs:
bot               bone_chair   skull_lamp coffin_table   wall_torch throne_piece
350 ms                  48.4         47.1         50.5         50.0        127.3
500 ms                  46.7         47.3         48.1         49.3         81.4
700 ms                  39.1         37.1         37.1         37.7         26.0
500 ms + iron           50.9         51.5         51.0         53.2        148.5

=== Round 1: survival per gear tier (sword + armor of the tier), level 1, no potions, 1000 runs per cell ===
tier          350 ms   500 ms   700 ms   |  with food:   350 ms   500 ms   700 ms
starting        100%     100%     100%   |                 100%     100%     100%
copper          100%     100%     100%   |                 100%     100%     100%
iron            100%     100%     100%   |                 100%     100%     100%
mithril         100%     100%     100%   |                 100%     100%     100%

=== Round 2: survival per gear tier (sword + armor of the tier), level 1, no potions, 1000 runs per cell ===
tier          350 ms   500 ms   700 ms   |  with food:   350 ms   500 ms   700 ms
starting         91%      65%      40%   |                 100%      99%      84%
copper          100%      95%      70%   |                 100%     100%      99%
iron            100%     100%      99%   |                 100%     100%     100%
mithril         100%     100%     100%   |                 100%     100%     100%

=== Step 9e: average kills for one drop of each rank (400000 kills rolled per enemy; drop chance 10% per kill, the Bone King always drops) ===
enemy             common        rare  ultra_rare   legendary   kills/run (500 ms + iron, round 2)
slime               13.3        50.5         222        1869   4.18
bat                 13.3        49.8         216        2010   4.38
skeleton            13.4        50.1         222        1961   4.48
mimic               22.3        25.3        74.9         474   1.56
bone_king            3.6         2.1         4.8        21.5   0.97

real	7m12.377s
user	0m0.200s
sys	0m0.310s

## PAUSE NOTE (artist, 16 Nov, Aseprite not attached)
Preflight: pluginConnected false, so no plugin work (avatar sit frames, clothes, furniture redo rounds NOT started; next time start at docs/PLAN-CHARACTERS.md). Did CSS only (skin.css): smooth radial glows for the title sign, creation backdrop and avatar stage (FIXLIST 7, no more stepped rings); pour bar window pulse and green glow, .pour-hint tail. FIXLIST 1, 4, 5 were already done by the UI pass. Not seen in a browser. Open: tap lever frames in render/pourFx.ts, dungeon vignette (8), hat tab (6) still open.

## PAUSE NOTE (artist, 16 Nov, Aseprite live)
DONE: outer_apron_sit_down/up/right.png (avatar_sit.aseprite got an outer_apron layer, apron sits over the lap, hem at row 56), so the apron no longer has to be hidden when seated (coder: the data may drop the hide). Furniture round R4 (sofa, bench, desk, bookshelf, rug, all facings + 5 icons, see docs/ART-REDO.md). npm test 1620 green, typecheck and client build green; not seen in the browser yet.
NOT DONE / NEXT: R5 (barrel, crate, stall_table, shelf, display_case), R6 (kitchen set redo), shoes_boots_sit_up stays undrawn on purpose, more hoods/clothes (hat_hood_coif exists; cloak, tabard, jerkin, belt layers not started), the sit head offset [0,8] in avatarRig.json is the coder's. Method that works: one big sheet doc per round, rect/line ops with Endesga hex, node split script (PNG decode with zlib, up sprites composed from the down sprite plus an overlay slot); the draw tool's blit op does nothing, do not use it.

## PAUSE NOTE (artist R9, 16 Nov)
DONE: counter_up/counter_right, register (32x37), tap_stand (32x48, two levers, central nozzle), lamp (32x32), menu_board (40x46). NOT DONE: shop_rug (recolour rug.png: e43b44->3e8948, a22633->265c42, 265c42->a22633), mug_shelf, banner, bed/chair/table/plant/stove already have PNGs (not re-audited). Not looked at in game (no Playwright run, no npm run check).
