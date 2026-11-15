# QUEUE: the next tasks as ready-to-paste prompts (lead, 16 Nov, after K2b, H2, A1/A3)

How to use: each prompt is self-contained. Paste it to the coder or the artist. The two lanes never wait: every coder task has an artist task that can start before it (stubs first, drafts in art-src/staging/).
Common rules for EVERY prompt: read CLAUDE.md, docs/TEAM.md, docs/PLAN-1B.md, docs/PLAN-SPRITES.md, docs/PLAN-ART-UPGRADE.md; small Edit replacements in shared JSON, never whole-file rewrites, keep CRLF;
coder runs `npm test` and `npm run typecheck` before saying done (and `npm run simulate` when gold, gems or appeal move; balance.test.ts must stay green; retune config only); the manager commits locally, nobody pushes;
end with a PAUSE NOTE in docs/PLAN-1B.md if stopped early. Artist: sprite work needs the Aseprite plugin (`preflight` first); tasks marked CODE-ART need NO plugin (code-drawn art, CSS, UI) and are the only ones to run while the plugin is not attached.
No new rule in shared/ without a test. A new GameState field = bump SAVE_VERSION + MIGRATIONS entry + test.

## STATUS (16 Nov)
DONE: C1 T1c, H1 loader kinds + icon hook, C2 K2a (SAVE 26), H2 block tiles from PNG, C3 K2b (cask panel); artist A1 blocks R2, A2 ART-K2 (tier band, cask CSS, keg_rack), A3 blocks R3.
IN PROGRESS: C4 MB-2 Inn doors rules (SAVE_VERSION is 27 in the tree already).
CHECK BY THE MANAGER (one look, 5 minutes): the block PNGs of A1/A3 are on branch claude/inn-1b-rebased (none under client/src/assets/sprites/blocks/ in the rebased tree when this was written; the artist works in the old folder); the user has not yet signed the STYLE LOCK on R2.
Save versions: 27 MB-2 (in progress), 28 9g-2, 29 9g-4, 30 9i-1, 31 9h-2. Everything before 9g-2 has NO bump unless a task says so; if one needs a bump it renumbers the later ones.

## Order at a glance
Coder:  C4 MB-2 (now) | H3 floor/wall hook | C5 MB-3 | G1 gameplay fix pass (from the tester list) | N1 content batch 1 (data) + H4 plant hook | C6 9g-1 hats/emotes | C7 9h-1 dungeon round 2 | C8 9g-3 room stars | C9 9g-2 usable furniture + cat (SAVE 28) | C10 9g-4 visitors (SAVE 29) | then MC, ME, 9i, 9h-2.. (outlines at the end)
Artist (no plugin now): B1 doors stub + fade | B2 hat/emote stubs + code hats | B3 hotel starter set code models | B4 plant stages in code + trees | B5 icon shape upgrade (tools, crops, drinks) | B6 phone UI audit
Artist (plugin back): A5 floors | A7 walls | A8 crop icons | A9 drinks + food icons | A10 tools icons | A11 tavern core sprites | A12 hotel starter sprites | A13 plants | A14 hats
Tester: after G1-start (to produce the fix list), after C5, after C6, after C7: the 10-step smoke route at the end.
OUTDOORS REWORK (owner 16 Nov: dungeon and lakeside look ugly; plan docs/PLAN-REWORK-OUTDOORS.md; RANK 1b in the ROADMAP priority order, so these go BEFORE C8 and the later coder tasks, and the artist runs them before B3 to B6 once A15/A16 are free):
  Coder: C11 hooks + fx module | C12 dungeon juice | C13 fishing + lake juice and sounds | C14 dungeon light + PNG hooks | C15 lakeside ambient + PNG hooks | C16 tuning + Settings -> Effects
  Artist CODE-ART (no plugin, now): A15 crypt look in code | A16 lakeside look in code | A17 fish bar / float text / effect CSS | A22 lakeside code fallback pieces
  Artist PLUGIN: A18/A19 crypt tiles | A20 enemies + chests (3 rounds) | A21 lakeside (5 rounds) | A23 mine tiles (later)
  Tester: T-OUT after C13 and again after C15. No save bump in any of them.
Hooks (H3, H4) touch a few files in client/src/render/ (the artist's folder): while an H task runs, the artist does not edit the files it names.

## CODER QUEUE

### C4 MB-2 Inn doors: rules and data (IN PROGRESS, SAVE 27: finish, do not restart)
Spec: the previous queue text is kept in git history (docs/QUEUE.md at commit before 16 Nov) and in docs/PLAN-1B.md MB-2: shared/data/innDoors.json, shared/src/innDoors.ts (innDoorSpots, doorAt, innTravel), spots blocked like the door zone, npcNav keeps guests off them,
MIGRATIONS[26] moves things off door spots to the bag (ledger 'door_spot'), GameAPI.useDoor(doorId). DONE WHEN: tests + typecheck green, spots valid on 5 shapes x 3 levels. PARALLEL: artist B1.

### H3 Art upgrade R3 hook: floors and walls from PNG (small, do right after C4)
GOAL: the room view uses sprites/floors/<styleId>.png (64x64, seamless) and sprites/walls/<styleId>.png (64x64, repeats sideways) when present, else the code textures (render/bareStyles.ts etc.). Painted cells (Room.floorCells) already draw as runs of tiling sprites: reuse that path.
FILES: the room view code in client/src/render (roomView*.ts, bareStyles.ts), spriteStore kinds 'floors' and 'walls' (generalised in H1). TESTS: asset sizes (64x64) and the lookup without rendering. SAVE: none.
PARALLEL: artist B1, A5 (floors, staging). DONE WHEN: a dummy 64x64 wood_planks.png tiles in the tavern with no seam gaps at zoom 1 and 3, removed afterwards; with zero PNGs nothing changes.

### C5 MB-3 Inn doors: client (needs C4 and the artist's B1 stub `drawInnDoor`)
GOAL: stepping onto a door spot changes rooms with the existing short fade and arrives at the matching door; the Map stays as fast travel.
BUILD: game/roomFlow.ts and pointerInput.ts: a walk whose GOAL is a door spot (tap on the doorway, or hold-walk ending on it) calls api.useDoor(doorId); never on a path that only crosses it; not during a run, the mine or fishing;
arrival through the existing openRoom path (skip the intro zoom on door travel: short eased camera); guests and the tavern clock keep running as for Map travel (check tavernApi catch-up still holds); door visuals via `drawInnDoor(layer, door)` (render/innDoors.ts);
a tap on a doorway with a panel open only closes the panel; hint toast once ("Doors lead to the tavern and the garden"), reading pace; Map cards unchanged.
TESTS: roomsApi/walkApi tests (useDoor moves avatar and room, refused in a run, arrival cell right, tavern clock catch-up after a door trip), a pointer helper test for goal detection. FILES: game/roomFlow.ts, pointerInput.ts, api/roomsApi.ts, texts. SAVE: none.
DONE WHEN: by hand suite -> tavern -> garden and back, reload keeps the room, no console errors. TESTER route after it.

### G1 Gameplay fix pass (this is the owner's "fix gameplay"; CP-1 was never held)
GOAL: the first hour plays well. Input: the tester's report (docs/FIXLIST.md, written by the manager from the tester agent's output; if it does not exist yet, build it first by running the smoke route yourself at 1000x700 and 420x760 and writing the list, ordered by severity).
RULES: take the top 8 items, crashes and stuck states first; one commit per item with a test where it is a rule (shared/ or api/); client-only layout problems get a note for the artist instead.
CHECK THESE SUSPECTS even if the list lacks them (each: reproduce, fix or write "fine" in NOTES):
1. Offline catch-up with taps, casks and the stove: close 2 minutes, reopen: seats fill only, casks keep the exact tier, no mug is lost or duplicated (ledger adds up).
2. A guest whose drink runs out on the tap mid-order: the order stays open, no softlock, a clear toast; same for a stand picked up while an order is in flight.
3. Hold-to-walk and hold-to-punch near the bar, kitchen zone and door spots (C4): no accidental door travel (C5), no walking into the staff zone by guests.
4. The first 10 minutes of a NEW game: every hint exists and reads at reading pace, the 7 root ale are on a tap, the first guest arrives within about 45 s, nothing needs a menu you cannot find (roadmap 2.3). Write what is unclear; fix text and hint order only.
5. Panels at 420x760: all panels end above the hotbar, buttons at least 44 px, Escape/back works; list layout bugs for the artist (B6) instead of fixing CSS.
6. Save/load: a v1.. save from each earlier SAVE_VERSION still migrates (migration tests exist; add a fixture-based test for 24, 25, 26 if missing).
FILES: whatever the item names; no new feature. SAVE: none (if a fix needs one, stop and tell the manager). DONE WHEN: suite + typecheck green, the fix list is ticked in docs/FIXLIST.md, `npm run simulate` unchanged. PARALLEL: artist B3 or B6.

### N1 Content batch 1: tavern and suite decor (data only, no bump) + H4 plant stage hook
GOAL: new things to buy and place, from PLAN-ART-UPGRADE section 4 ("data only" items), with fallback box art so the artist can improve them later.
DATA: new file shared/data/furniture/tavern3.json (the loader merges every file in the folder; ids unique across files): barrel_table (1x1 surface, common, catalog), hanging_lantern (wall, light, common, catalog), tankard_rack (wall, common, catalog), dartboard (wall, rare, catalog, decor only),
spice_bundle (wall, common, craft recipe from wood/cloth + a crop), antler_mount (wall, rare, crafted: recipe from bone + wood; inCatalog false), window_curtains (wall, 2 cells, common, catalog), writing_desk (2x1 surface, rare, catalog), potted_flowers (1x1 onSurface, common, catalog).
Appeal small (1 to 3), placeIn per item (tavern ones 'shop', suite ones 'hotel'; curtains and potted_flowers both), icon { shape, colors } from existing shapes, art = simple boxes (copy the style of a neighbour), baseValue on the existing scale; catalog price = baseValue x 3.
Names original. Recipes in recipes.json (no gold). The Book picks them up automatically (check the furniture tab shows 9 new greyed entries).
H4 (small, same task): plants stage hook: the farm draws a plant from sprites/plants/<id>_<1|2|3>.png when present (spriteFor('plants', id, stage)), else today's code art; test for the naming, no PNG = no change.
TESTS: all 9 types valid (furniture tests), ids unique, wall items valid along a back wall, onSurface rules, recipes craftable from a fixed inventory, balance.test.ts green (appeal feeds guest rate: if a number moves BALANCE_TARGETS, lower the appeal values, do not retune S3).
FILES: shared/data/furniture/tavern3.json, recipes.json, client/src/render plant draw code (hook only), tests. SAVE: none. PARALLEL: artist B3/B4. DONE WHEN: suite green; by hand: buy a dartboard, hang it, place potted flowers on a table.

### C6 9g-1 Hats and emotes (no bump if unlock uses Player.unlockedClothing; do after the artist's B2 stubs)
GOAL: 9g items 1 and 2 (docs/NEXT-STEPS "Step 9g", refreshed). Hats stay OUT of the clothes packs (decided): add a flag in clothing.json (`pack: false`) honoured by the pack pools in shared/src/packs.ts, with a test that the Common/Rare pools do not change and balance.test.ts still passes.
DATA: shared/data/clothing.json slot 'hat', none free, with rank and unlock source (only sources that already have an event hook): straw_hat common catalog; wool_cap common catalog; cook_cap common catalog; feather_cap rare catalog (a new Clothes tab in the Catalog; catalog price = baseValue x 3);
tavern_keeper_hat rare, Book reward 25% (bookRewards.json); fisher_hat rare, first rare fish caught; skull_cap rare, skeleton drop (loot table); flower_crown ultra_rare, a splice clothing seed (splice.json + spliceSeeds.json); knight_helm ultra_rare, first Bone King kill;
gold_crown legendary, Book reward 100%; sunken_crown_hat legendary, catching the sunken crown; miner_lamp_cap rare, 10th mine visit. A hat the player does not own shows as a grey silhouette with the hint text in the Avatar panel.
EMOTES: shared/src/emotes.ts (pure: wave, dance, laugh, cheer, sleep; duration config EMOTE_MS; cancelled by walking), GameAPI.emote(kind) -> { kind, untilMs } (transient avatar field, NOT saved), client/src/ui/emoteButton.ts next to the chat button (a small menu),
Settings pref nameTags (client/src/api/prefs.ts) and the name tag toggle; the client calls the artist's `hatPart(id)` and `emotePose(kind, t)`.
TESTS: hat data valid (12 ids unique, slot hat, unlock source exists), unlock grants per event path with a fixed state, locked hats not wearable, pack pools unchanged, emote cancel rule, prefs.
FILES: shared/data/clothing.json, bookRewards.json, loot.json, splice*.json, shared/src/clothing.ts, packs.ts, emotes.ts, api, ui/emoteButton.ts, avatar panel logic, prefs. PARALLEL: artist B2 first, then A14.
DONE WHEN: suite green; by hand: buy a hat, wear it, emote, toggle name tags.

### C7 9h-1 Dungeon round 2 (new content; touches dungeon files only, no bump)
GOAL: DUNGEON_ROUND = 2: three floors, 5 to 8 rooms, all enemies, mimics, the Bone King as end boss (docs/NEXT-STEPS "Step 9h" item 1; PLAN-1B 9h-1). Config switch, the generator and step() already support it.
DO: run `npm run simulate:dungeon` (slow, minutes) per gear tier and tune ENEMIES/loot in config and data only to 60 to 75% survival; check the floor 3 end flow in the client (boss room, bank, exit, Go deeper / Leave texts, key cost);
run `npm run simulate` and keep balance.test.ts green: run gold per hour feeds the S3 gold shares (target 10% to 50% each). If the shares fail, tune run gold down and report the numbers instead of touching BALANCE_TARGETS.
TESTS: existing dungeon tests under round 2, a deterministic full-run test with a fixed seed (3 floors, boss reachable), death rule (half run gold lost) still holds. FILES: shared/src/config (DUNGEON_ROUND, ENEMIES), shared/data/loot.json, tools/simulate-dungeon.ts, client/src/dungeon only for end-flow fixes. SAVE: none.
PARALLEL: artist B3/B5. DONE WHEN: suite green, survival table in the report, by hand: a 3-floor run to the boss. Ask the owner before leaving round 2 switched on (decision 4).

### C8 9g-3 Room stars (no bump, derived)
GOAL: shared/src/roomScore.ts (pure): furniture value by rank, variety of types and themes, lights, rugs, wall items, style not bare, capped -> 1 to 5 stars with config thresholds and one tip ("add a light"); shown in the Room panel for the HOTEL room only. The 9g-3 prompt also lists N1's new suite pieces (curtains, desk, potted flowers) as part of variety.
TESTS: monotone, capped, empty room 1 star, each tip appears. FILES: shared/src/roomScore.ts (+test), config, client/src/ui Room panel logic. PARALLEL: artist B3. DONE WHEN: suite green; by hand: stars rise as you decorate.

### C9 9g-2 Usable furniture and the cat (SAVE 28)
GOAL: FurnitureType.use 'toggle' | 'music' | 'fire' | 'none' (item state on/off, saved: SAVE 28 with MIGRATIONS[27] adding the state, test), music box tune as data played by client audio, wall clock (real time passed in, no Date.now in shared), mirror opens the Avatar panel,
pet basket + cat (shared/src/pet.ts pure wander/sit/sleep/follow with rng and time passed in; the cat position is NOT saved, only adopted + name). stone_fireplace gets `use: fire`, glass_lamp and lantern_post `use: toggle` (M-A pieces). Catalog: clock, mirror, music box, pet basket.
TESTS: use state toggles and persists, migration, cat steps deterministic with fixed rng, clock uses passed time, mirror action. FILES: shared/src (furniture types, pet.ts, save, types), shared/data/furniture/suite.json, client/src/audio, ui. PARALLEL: artist stub `drawCat(view, state)` then the cat art (add as B-task when this starts).

### C10 9g-4 Visitors and the guestbook (SAVE 29, dep C8 and K2 merged)
Spec: PLAN-1B 9g-4: shared/src/visitors.ts (arrival by stars, at most 2, walk on the hotel nav grid, look at things, sit on free seats, lines in npcLines.json, leave a coin tip that must be tapped: hotel-side Mess state, SAVE 29 + MIGRATIONS[28]), reuse guestLook and npcNav, guestbook item (last 10 lines).

### Later coder tasks (write the prompt when reached; outlines in docs/PLAN-1B.md)
MC Inn score (no bump; weight the tavern part so S3 numbers stay inside BALANCE_TARGETS) | ME suite showcase (hat stand, splice shelf, Book plaque; derived) | CP-2 playtest | 9i-1 questline rules (SAVE 30, L) | 9i-2 quest UI | 9i-3 chapters | 9h-2 dungeon themes (SAVE 31) | 9h-3 Sunken Cave | 9h-4 Overgrown Ruins | 9h-5 room features | 9h-6 theme furniture sets | phase 2.2 economy pass.

## ARTIST QUEUE

### CODE-ART tasks (NO Aseprite plugin needed: run these now)

#### B1 ART-MB2 stub and fade (before C5; CODE-ART)
STUB FIRST: client/src/render/innDoors.ts exports `drawInnDoor(layer: Container, door: { id: string; x: number; y: number; w: number })` (world px of the doorway in the back wall band, w = 64) with three code-drawn looks keyed by the door id prefix (suite wood door with a small star, tavern oak double door with a warm glow, garden arched gate with leaves), plus a warm arrival light;
`.room-fade` CSS in ui.css for the fade (respect prefers-reduced-motion). Tell the coder in the commit note. FILES: render/innDoors.ts (+ a small render test if the folder has such tests), ui.css. Palette only from shared/palette.ts. DONE WHEN: a contact sheet of the three doors at zoom 1 and 3 (tools/art-sheet.ts) and `npm test` for client/src/render green.

#### B2 ART-9g1 stubs and code hats (before C6; CODE-ART)
STUBS FIRST in the first commit: client/src/render/hatParts.ts `hatPart(id): Container | null` and client/src/render/emoteAnim.ts `emotePose(kind, tMs)` (small offsets/overlays; the box avatar shape is NOT changed, hats sit on the head layer only).
THEN: the 12 hats of C6 drawn in code on the box avatar, a grey locked silhouette variant, the five emote poses with the zzz bubble, the name tag plate, ui.css for .emote-btn / .emote-menu / .nametag. Files: render/hatParts.ts, emoteAnim.ts, avatarSprite.ts (artist only), ui.css.
DONE WHEN: a contact sheet of the 12 hats at game size and in the Avatar panel; hats fit all 4 hair styles without clipping.

#### B3 Better models in code: the hotel starter set (CODE-ART, no coder dependency)
GOAL: the pieces a new player sees first stop looking like plain boxes. In render/furnitureArt.ts and the `art` fields of the first 12 types of shared/data/furniture.json (bed, sofa, chair, bookshelf, lamp, plant, rug, desk, table, wardrobe and the rest of that list):
add the details of the mood (docs/ART-STYLE.md, docs/mood.png as reference only): pillow and blanket folds, cushions, book spines in 3 colours, a lamp shade glow, leaf clusters, rug borders and tassels, wood grain stripes, a dark warm 1 px outline, light top-left, Endesga 32 only.
RULES: footprints, facings and anchors do not change (tests enforce them); only `art`, `icon`, `light` fields, small Edits, no reformatting. Do 6 pieces per commit; show a contact sheet (tools/art-sheet.ts) per commit.
Also the new N1 pieces (when tavern3.json lands): replace their fallback boxes with the same quality. DONE WHEN: all furniture tests green, contact sheet of before/after for the 12 pieces in the final report, in-game check at zoom 3 in the hotel room.

#### B4 Plants and trees in code (CODE-ART; prepares H4 and the lakeside)
GOAL: better looking farm and lake without PNGs. Three growth stages per crop (sprout, small, full) for the 5 crops with clearly different silhouettes (turnip top, potato leaves, carrot fronds, pumpkin vine with fruit, glowcap with a soft glow), block-seed plants keep their colour; ripe plants get a tiny sparkle for ultra_rare and legendary;
the 8 lakeside trees: 3 tree variants, trunk, layered leaf clusters, a stump stage for chopped trees; reeds, flowers and stones as ground decor on the lakeside and farm borders. Files: client/src/farm/*, client/src/lakeside/* draw code only (no rules), ui.css not needed.
DONE WHEN: contact sheet of the 15 stages, farm and lakeside screenshot-style sheet, `npm test` for client green.

#### B5 Icon shape upgrade (CODE-ART)
GOAL: better code icons for what is on screen most (PLAN-ART-UPGRADE section 1, priority 1 to 2): tools and gear (pickaxes, axes, rods, swords, armor), health potion, key, gems, the 5 crops, 4 drinks (mug with foam) and 8 food dishes. Change only render/iconPixels.ts DRAW functions (and shared/src/icons.ts if a new shape name is needed: the test demands both).
RULES: 32x32, free 1 px ring, rank frame is drawn by the game, Endesga 32, light top-left, each shape recolourable by the data colours (do not hardcode colours that data should set). Contact sheet with tools/icon-sheet.ts before/after. DONE WHEN: icons tests green, the sheet in the report; the Book silhouettes still read.

#### B6 Phone UI audit and polish (CODE-ART)
GOAL: docs/UI-REFERENCE.md compliance at 420x760 and 1000x700, from the list G1 produces (and a first own pass now): Taps panel, Cask panel, Menu/Sell tabs, Brewing, Cooking, Avatar panel with hats later, Catalog tabs.
CHECK AND FIX IN ui.css ONLY: buttons at least 44 px, panels end above the hotbar, no text clipped at the longest strings (Inn name of 16 characters, the longest drink name, 3 digit counts), focus and active states visible, the tier chips and bars readable, prefers-reduced-motion respected, no font-family outside var(--font). Class-name or markup changes = a note to the coder, not an edit.
DONE WHEN: a list of fixed items with before/after screenshots descriptions in the report.

### PLUGIN tasks (Aseprite plugin must be attached; `preflight` first; quality gate of PLAN-ART-UPGRADE section 6; ramps in art-src/RAMPS.md). NOT possible until it is attached.

#### A5 R4 floors (after H3 for the in-game check; stage first)
IDS (styles.json): bare, wood_planks, stone_tiles, red_carpet, soil. 64 x 64, SEAMLESS (tile 3x3 in Aseprite tiled mode), 3 to 4 shades per material; bare stays plain and dull on purpose. Stage in art-src/staging/floors; export to sprites/floors/<id>.png after H3.

#### A7 R5 walls
IDS: bare, plaster, wood_panels, brick; 64 x 64, repeats sideways, the band is 64 tall, a dark outline at the floor foot. Then the counter sprite polish (no baked till). Export after H3.

#### A8 R6 crop icons (5): turnip, potato, carrot, pumpkin, glowcap. 32x32 icons in sprites/icons/<id>.png (free ring). After the first export check the seed look (seeds stay code from the parent colours).
#### A9 R7 drinks 4 + roasted turnip and the other dishes (8): icons, plus the aged/vintage band stays a code overlay.
#### A10 R8 tools 5 (steel pickaxe, steel axe, three rods) then swords/armor/potion/key/gems.
#### A11 Tavern core sprites in groups of 5: round_table, long_table, bar stool, stove, brewing_barrel, then mug_shelf, menu_board (wall: facing down only), the start chairs/stools. Facings per their facings list; the sheet size formula of PLAN-SPRITES.
#### A12 Hotel starter set sprites (the 12 pieces B3 improved in code; match their shapes so the swap is not a jump), then A13 plants stages (15 PNGs, after H4), then A14 hats as sprites (only after the U1 avatar decision; until then hats stay code).
Each: validate + pixel-critic + in-game check at zoom 3 and 1, contact sheet shown to the lead. DONE WHEN per round: 5 PNGs pass, the spriteAssets test is green.

## OUTDOORS REWORK (16 Nov; read docs/PLAN-REWORK-OUTDOORS.md first: it lists what is wrong, the target look, sprite sizes and risks)
Common: look and feel only, NO rule change in shared/ (step(), fishing.ts, LAKE_* layout, generator), NO save change. Effects react to existing events. Every number in config (FX_*), every effect respects the
"Reduce effects" pref. Code art stays the fallback for anything without a PNG. Whole pixels only, Endesga 32, light top-left.

### C11 [coder] Hooks and the fx module (do first, small)
GOAL: the foundation the other outdoors tasks stand on.
BUILD: (1) spriteStore kinds `dungeon`, `actors`, `lake` (folders client/src/assets/sprites/<kind>/), plus ANIMATION STRIPS: `<id>_<tag>.png` is a horizontal strip, frame count = width / frame width (frame width given by the caller), helper `spriteFrames(kind, id, tag, frameW)`; no PNG = null = today's code art.
(2) client/src/fx/: pure helpers with tests: shake envelope (whole px, decays to 0, seeded noise not sin of the clock), hit-stop timer (render-side only), easing functions, a particle pool (cap FX_MAX_PARTICLES, no allocation per spawn), `fxSpec(event) -> effect list` mapping for dungeon events (pure: input event + context, output specs; no Pixi).
(3) pref `reduceEffects` in client/src/api/prefs.ts (device pref, not GameState) and `FX_*` constants in shared/src/config (dungeon.ts / lakeside.ts files).
TESTS: strip naming and frame count from width, no PNG = null, envelope ends at 0, pool cap, fxSpec for hit / kill / chest / enemy_hit / windup, prefs default. FILES: client/src/render/spriteStore.ts, client/src/fx/*, prefs.ts, config. SAVE: none.
PARALLEL: artist A15 / A16 (they edit only dungeonArt.ts and lakesideArt.ts draw functions). DONE WHEN: `npm test` and `npm run typecheck` green; nothing changes visibly.

### C12 [coder] Dungeon juice (after C11)
GOAL: every hit, kill and chest feels great. Files: client/src/dungeon/dungeonScreen.ts, dungeonView.ts, floatTexts.ts, fx/.
BUILD: from the existing run events (hit, enemy_hit, enemy_miss, windup, kill, chest, loot, mimic, stairs, level_up, died): hit-stop 50 ms on hit and enemy_hit (RENDER pause only: never delay api.dungeonAdvance, run time must stay real time), enemy squash and knockback 2 to 4 px that decays, 4 to 6 spark particles, damage numbers with pop-in scale (a bigger "CRIT" style for damage at the top of the attack range: derived on the client), kill burst (goo bits for slime, bone bits for skeleton and king, feathers for bat) + a 200 ms fade instead of instant removal, chest lid animation WITHOUT per-frame Graphics redraws and loot that pops out and bounces (the gain popups stay), aggro "!" when an enemy starts chasing (derive from distance crossing 192 px), a wind-up telegraph (growing red ring on the floor), hurt edge pulse and a low-hp (under 30 percent) heartbeat vignette (CSS class from A17), footstep dust, mine rock debris on swing and a bigger burst on rock_broken. Replace the sin(clock) shake by the fx envelope (keep HIT_SHAKE_PX / HURT_SHAKE_PX values).
SOUNDS (client/src/audio/sound.ts, code tones, quiet, MIN_GAP_MS each): kill, chestOpen, windup, levelUp, stairs, found (a rank-pitched ping, rarer = higher). Call them from the events.
TESTS: fxSpec outputs for each event, hit-stop does not change the run (api untouched: test with a fake api), crit rule derived from the attack range, particle cap, reduceEffects turns everything off except the damage numbers. SAVE: none. No change to step().
PARALLEL: artist A17. DONE WHEN: suite + typecheck green; by hand: fight a slime (squash, spark, burst), open a chest (loot bounces), get hurt (edge pulse), Settings reduce effects off/on.

### C13 [coder] Fishing and lake juice (after C11)
GOAL: fishing feels like an event. Files: client/src/lakeside/lakesideScreen.ts, ui/fishBar.ts (markup and class toggles only, CSS belongs to the artist A17), fx/, audio/sound.ts.
BUILD: the bobber is built once and moved (stop recreating Graphics every frame); cast animation (rod swing through hooks.swing, an arc of the line, splash with rings on landing); wait nibbles (tiny dips on a hash schedule, purely cosmetic: the real bite stays from fishing.ts); bite = dunk + growing rings + the "!" pops with a bounce; the reel = the bobber thrashes with tension (distance fish to box), `.catching` class on the track while the fish is inside the box (already toggled: add pulse) and `.draining` when fill is under 15 percent and falling, rising-pitch tick sounds as the fill rises (sound `reelTick`, rate limited), escape = a slack line + a short shake; the catch = the fish icon flies in an arc to the avatar, splash, the avatar holds a pose 600 ms with the fish icon above the head, rank-coloured burst (ultra rare / legendary: a screen flash and a jingle `found`); trees: leaf puff and trunk squash per hit, a proper fall (tip, bounce, leaf burst; the 420 ms FALL_MS stays), wind sway of the leaf rows (whole px, off with reduceEffects). New sounds: cast, splash, reelTick, rustle (+ found from C12).
TESTS: a pure `reelFeedback(ReelView, fillTrend)` -> { catching, draining, tension } with cases, the sound names and gaps, the bobber is not recreated per frame (count of Graphics created in a fake update loop), reduceEffects. fishing.ts and its tests untouched. SAVE: none.
PARALLEL: artist A17 / A16. DONE WHEN: suite + typecheck green; by hand: cast, wait, bite, lose one fish, catch one, chop a tree to the fall.

### C14 [coder] Dungeon light and PNG hooks (after C12 and A15)
GOAL: the crypt gets a real mood. BUILD: replace the per-block fog drawing (dungeonView.drawFog) with a light layer: a warm pixel-stepped dithered pool around the player, seen-not-lit blocks tinted cool dark blue (not black), unseen = black, torch lights from wall fronts (positions from a hash of map.seed and the block index so they are stable; cosmetic only; the mine keeps its lanterns as lights), flicker in whole px radius steps, exit and golden chests leak light, a screen vignette. FogMemory is NOT changed (it has tests). Measure the cost on a phone profile (420 x 760, dpr 3): if it drops under 50 fps keep the old fog as the fallback and when `reduceEffects` is on.
THEN the PNG hooks: dungeon tiles (floor variant by hash, wall top / front variants, exit, torch strip, decor by hash on floor blocks only and never on the exit or a chest block) and actors (enemy strips idle / move / windup chosen from the enemy state, bat flap, facing flip, white flash made from the frame alpha and cached per frame, chests with 4 frame strip driven by openMs). No PNG = the code art of A15.
TESTS: light stepping function pure, torch positions stable per seed and never on floor blocks, decor never on exit / chest blocks, strip frame selection (idle vs move vs windup), flash texture cache, fallback with zero PNGs. SAVE: none.
PARALLEL: artist A18 / A19 / A20. DONE WHEN: suite + typecheck green; by hand: a run looks lit by the player and the torches; with a dummy PNG a floor tile and an enemy strip appear and are removed again.

### C15 [coder] Lakeside ambient and PNG hooks (after C13 and A16)
GOAL: the lakeside lives. BUILD: water drawn from an animated tile strip (frame by clock, one shared texture; fallback = A16's code water), shore ring pieces along the LAKE_WATER rect edges (pure `shoreCells(rects)` -> [{ piece, x, y }]: edges, outer and inner corners incl. the L-join and the pier gap), tree variant by index (oak, pine, birch; stump and sapling pieces), pier pieces, decor on grass by a pure `decorSpots(seed)` (never on water, the pier, a tree anchor, the door zone or the avatar start), sway, ambient life with caps: birds (state machine: perch on a pier post, fly off when the avatar is within 80 px, return later; time and rng passed in), butterflies, fish shadows that flee a cast, falling leaves, sun glints on the water; a pref-guarded warm daylight tint. All OFF with reduceEffects.
TESTS: shoreCells for the three rects (counts, no piece inside the water interior, the pier gap), decorSpots rules over 50 seeds, the bird state machine, caps, fallback with zero PNGs. SAVE: none.
PARALLEL: artist A21 / A22. DONE WHEN: suite + typecheck green; by hand: the lake shimmers, a bird flies off when you walk the pier, fish shadows scatter on a cast.

### C16 [coder] Effects settings and tuning (last)
GOAL: the owner can tune the vibe. BUILD: Settings -> Effects section (Reduce effects, Screen shake, Ambient life, Light flicker), the debug panel line for fps and particle count, all FX_* values collected in config with comments, a perf pass at 420 x 760. `npm run simulate` must be unchanged. TESTS: prefs, config sanity (all FX numbers positive, caps respected). SAVE: none. DONE WHEN: suite + typecheck green and the owner's test in docs/PLAN-REWORK-OUTDOORS.md section 7.

### A15 [artist] CODE-ART crypt look v1 (NO plugin; start now)
Read docs/ART-STYLE.md and docs/PLAN-REWORK-OUTDOORS.md sections 1 and 2. In client/src/dungeon/dungeonArt.ts ONLY (draw functions and their art; keep every exported name and signature, the block size 32 and the 14 px wall front): floors with 5 variants chosen by the existing hash (flagstone seams, cracks, a puddle, bones, a rune), wall tops with stone courses and a lit top-left edge, wall fronts with a darker base, moss and cracks, a torch (warm, 3 flame frames stepped by a clockMs argument, an optional new argument) on about 1 in 8 wall fronts, an exit with a frame and a warm glow; enemies: slime squash highlight, skeleton bone details and a rusty sword, bat with two wing poses chosen by an optional `phase` argument, mimic with teeth and tongue, Bone King with a flame crown. The crypt stays cool and dark; warm only in torches, the exit, chests and the crown. The mine keeps its colours (BLOCK_COLORS) and lanterns. Palette from shared/palette.ts only.
DONE WHEN: a contact sheet at zoom 1 and 3 (tools/art-sheet.ts) in the report, `npm test` for client green, geometry tests unchanged.

### A16 [artist] CODE-ART lakeside look v1 (NO plugin; start now)
In client/src/lakeside/lakesideArt.ts ONLY (keep exports; add new ones for decor): the lake with a rounded shore, a sand to wet-sand ramp and a foam line, a deeper middle and a darker patch under the pier; the pier with rails (not at the casting end), a lantern post, rope posts; 3 tree variants (oak, pine, birch) in two leaf shades, 3 bush variants with flowers, a better stump and sapling; reeds, cattails, flowers, stones, mushrooms, tall grass tufts and lily pads as decor draw functions (the coder places them in C15); a bobber, rings and a splash as pre-built Graphics (no per-frame redraw: the coder moves them). Bright, lush, Growtopia-like chunky shapes, warm dark outline. Palette only from shared/palette.ts.
DONE WHEN: a contact sheet of the new pieces and a lakeside screenshot-style sheet, `npm test` for client green. Keep LAKE_WATER / LAKE_PIER / tree anchors as they are.

### A17 [artist] CODE-ART effects and fishing UI (NO plugin; start now)
ui.css and the draw-only helpers (client/src/render/ or a new client/src/fx/looks.ts; markup changes go to the coder as a note): the fish bar frame (pixel look, rank-coloured borders, bigger tap button with a pressed state), classes `.fish-track.catching` pulse and `.fish-bar.draining` red pulse (respect prefers-reduced-motion), the float text styles (`.float-crit`, heal, xp, rank loot with a dark outline), the hurt edge pulse (`.hurt-edge`) and the low-hp vignette (`.low-hp`), the "!" and "?" bubbles, 4 spark shapes, dust and goo and bone and leaf and feather bit shapes (tiny draw functions), splash and ring shapes, the heart / drop icons if needed. Hand the class names and function names to the coder in the commit note.
DONE WHEN: descriptions of each state at 420 x 760 and 1000 x 700 and a contact sheet of the particle shapes.

### A18 / A19 [artist] PLUGIN crypt tiles (after the plugin is attached; `preflight` first; stage in art-src/staging/outdoors/dungeon)
Sizes and names: docs/PLAN-REWORK-OUTDOORS.md section 4. A18 = crypt_floor_a, crypt_floor_b, crypt_floor_c, crypt_wall_top_a, crypt_wall_front_a (32 x 32, seamless where they tile, cool stone ramps, 1 px cool dark outline PALETTE[25], light top-left). Show the lead the contact sheet: the crypt must be cool and dark with ONE warm thing (the torch). A19 = crypt_wall_front_b, crypt_wall_front_c, crypt_exit, crypt_torch (3 frame strip 48 x 24), crypt_bones (decor). Export to client/src/assets/sprites/dungeon/ after C14 lands; check at zoom 3 and 1 against the new light.

### A20 [artist] PLUGIN enemies and chests (3 rounds of 5; after C14 hooks, draft before)
Round 1: slime_idle (2 frames 32 x 32), slime_move (3), bat_fly (3), mimic_idle (2), mimic_bite (3). Round 2: skeleton_idle (2 frames 32 x 64), skeleton_move (4), skeleton_windup (1), slime_windup (1), chest_wooden (4 frames 32 x 32: shut, cracking, half, open). Round 3: chest_golden, bone_king_idle (2 frames 64 x 96), bone_king_move (4), bone_king_windup (1), bat_windup (1). Anchor bottom centre, no trim, silhouette readable at 32 px, big eyes, the shadow is code. Gate: PLAN-ART-UPGRADE section 6 each round.

### A21 [artist] PLUGIN lakeside (5 rounds of 5; after C15 hooks, draft before)
R1 water (4 frame strip 128 x 32), floors/grass (64 x 64), shore edge N, shore edge E, tree_oak (64 x 96). R2 tree_pine, tree_birch, tree_stump, bush_a, the 4 outer shore corners. R3 pier deck tile, pier_post, pier_rail, pier_lantern, the 4 inner shore corners. R4 reed (2 frame sway strip), flower_a, stone_a, lily_pad, fish_shadow. R5 bird_perch, bird_fly (2 frames), butterfly (2 frames), leaf, dragonfly. Bright and lush, warm dark outline. Seamless water and grass checked in Aseprite tiled mode.

### A22 [artist] CODE-ART lakeside fallback (NO plugin; any time after A16)
Extend A16 with the shore ring pieces (edges and corners as code draw functions with the same ids as A21), 4 frames of animated water as code, birds, butterflies, fish shadows and leaves as small draw functions, so C15 has full art while the plugin is away. Mark in the report which pieces exist only in code.

### A23 [artist] PLUGIN later: mine tiles and rocks (after the crypt tiles are signed off)
mine_floor_a..c, mine_wall_top, mine_wall_front (with a lantern variant), rock_copper, rock_iron, rock_mithril (32 x 32, crack stages stay code), mine lantern strip. Same gate.

## TESTER LANE (agent ~/.claude/agents/tester.md; no code changes; run after G1-start, C5, C6, C7 and any large art round)
SMOKE ROUTE (10 steps; report each as PASS/FAIL with a screenshot, plus console errors and any 404 for a sprite):
1. `npm run dev`, open the page at 1000x700, then once at 420x760 (phone). Console must be clean; note load time.
2. New game: character creation (type an Inn name of 16 characters), pick shapes, watch the intro (a tap skips it).
3. Tavern look: the bar with register and tap stand, a bar stool, a round table with 2 stools, the stove, a barrel with 7 root ale; sprites show (no box placeholders where a PNG exists; the block PNGs in the bag and placed).
4. Tap the barrel (walks next to it) and collect; tap the tap stand: Taps panel; Load all root ale into a tap; reopen and check the mug count.
5. Tap the register: Menu tab: root ale and roasted turnip On; wait for a guest (about every 45 s); tap the guest: the avatar goes to the tap, pours, carries the mug; tap the coins.
6. Stove: cook a roasted turnip (needs a turnip: do step 8 first if the bag has none); Collect when ready.
7. Build mode (B): move a stool, rotate, pick up and place again; Room panel shows the kitchen zone tint; place a prep table next to the stove in the zone and check the batch size grows.
8. Map -> Farm: plant a turnip seed on soil, punch a block, place a block; Map -> Dungeon: one run, fight one slime, Leave.
9. Doors (after C5): walk suite -> tavern -> garden and back; Map travel still works. Casks: fill a cask, collect early (fresh), load an aged mug on a tap.
10. Reload the page: same room, gold, taps, casks, Inn name; close the tab for 2 minutes and reopen to check the offline catch-up (seats only); final console and layout check at 420x760 (panels end above the hotbar, 44 px buttons).
OUTPUT: a short list of crashes, missing sprites, layout problems and anything that felt wrong, ordered by severity, to the manager, who saves it as docs/FIXLIST.md for G1.

## DECISIONS FOR THE USER (recommendations)
1. STYLE LOCK on art round R2 (first blocks, the register, one icon): the user signs it once. Recommended: look at the contact sheet and sign; later rounds follow it.
2. CP-1 playtest: the whole tavern loop exists now (taps, casks, kitchen). Recommended: ask the user for the one-hour playtest right after G1, before C6/9g.
3. Dungeon round 2 on (C7): changes run gold and the gold shares. Recommended: yes after the simulation shows 60 to 75% survival and the shares inside targets.
4. U1 pixel avatar: hats in C6/B2 are drawn on the CURRENT box avatar. Recommended: yes, do that now; redraw hats if U1 is approved later (last art step, prototype first).
5. The plugin: the Aseprite plugin is not attached now. Recommended: run all CODE-ART tasks (B1 to B6) meanwhile; they improve the look without it and none is wasted (sprites replace code art piece by piece).
6. Push to GitHub: still the user's call (a push deploys). Recommended: ask after CP-1 passes and G1 is done.
Everything else in this queue is decided (door design, hat list, tier numbers, folders, content list).
