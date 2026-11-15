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
