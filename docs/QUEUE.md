# QUEUE: the next tasks as ready-to-paste prompts (lead, 15 Nov, after T1a/T1b)

How to use: each prompt is self-contained. Paste it to the coder or the artist. The two lanes never wait: the queue below alternates feature
tasks with art-upgrade hooks, and every artist task can start before its hook exists (it drafts in art-src/staging/ and exports to the final folder only
after the hook is merged). Common rules for EVERY prompt: read CLAUDE.md, docs/TEAM.md, docs/PLAN-1B.md, docs/PLAN-SPRITES.md, docs/PLAN-ART-UPGRADE.md;
small Edit replacements in shared JSON, never whole-file rewrites, keep CRLF; coder runs `npm test` and `npm run typecheck` before saying done, artist
runs the plugin `validate`; the manager commits locally, nobody pushes; end with a PAUSE NOTE in docs/PLAN-1B.md if stopped early.
State now: SAVE_VERSION 25; taps in shared/src/taps.ts (Tap, loadTap, unloadTap, pourMug, refundMug, drinkStock, tapViews);
kitchen zone and prep bonus done (T1b); tavern sprites committed; src/ui/tapsPanel.ts and menuPanel.ts exist; the coder is on T1c.
Save versions still reserved: K2a 26, MB-2 27, 9g-2 28, 9g-4 29, 9i-1 30, 9h-2 31.

## Order at a glance
Coder:  C1 T1c leftovers | H1 R1 loader kinds + icon hook | C2 K2a | H2 block tile hook | C3 K2b | C4 MB-2 | H3 floor/wall hook | C5 MB-3 | C6 9g-1
Artist: A1 blocks R2 | A2 ART-K2 | A3 blocks R3 | A4 ART-MB2 | A5 floors R4 | A6 ART-9g1
Tester: after every coder feature round (K2b, MB-3, 9g-1 at least): the 10-step smoke route at the end.
Hooks (H1 to H3) touch a few files in client/src/render/ (the artist's folder): while an H task runs, the artist does not edit the files it names.

## CODER QUEUE

### C1 T1c leftovers (IN PROGRESS: finish, do not restart)
GOAL: close T1 (docs/NEXT-STEPS "Step T1" items 2 to 6). FILES: client/src/ui/tapsPanel.ts, menuPanel.ts, game/tavernLife.ts, gameLoop.ts, texts, tools/simulate-economy.ts.
CHECKLIST (tick what exists, do the rest): tap_stand tap = walk next to it then the Taps panel (Load/Unload a stack or number); register tap opens Serve/Menu/Sell;
Menu panel shows tap levels and the "Load a tap" hint; the avatar's serve errand walks to the taps, calls the artist's `playPour(itemViews, tapUid)`
(client/src/render/pourEffect.ts) for POUR_MS, then carries the mug; "Tap is empty" keeps the order open; Room panel calls `drawKitchenTint(layer, rects)` (render/kitchenTint.ts) with the
tavern's kitchen zone rects; barCoinPoint (shared/src/bar.ts) follows the register; intro toast and hints; simulate-economy prints pours per hour, mugs per tap, dishes per batch with prep tables.
TESTS: client/src/api/tapsAPI.test.ts already exists: add the pour chain and the empty-tap case if missing. DONE WHEN: npm test + typecheck green; by hand: load a tap, a guest orders, the pour plays, the tap count drops.
SAVE: none. PARALLEL: artist A1 (blocks, staging only).

### H1 Art upgrade R1: one loader, several kinds (small, about 1 h)
GOAL: PLAN-ART-UPGRADE section 0. Generalise client/src/render/spriteStore.ts + spriteIndex.ts from furniture to kinds furniture | icons | blocks | floors | walls | plants
(folders client/src/assets/sprites/<kind>/, name = id, `spriteFor(kind, id, facing?)`). Fix the known bug: the regex in parseSpriteName lost a backslash (check it with a test for `register.png`, `counter_up.png`, `prep_table_right.png`, rejects `x_left.png`).
Icon hook: in client/src/ui/itemIcon.ts each id-level function (furnitureIconUrl, materialIconUrl, clothingIconUrl, gearIconUrl, gainIconUrl, potionIconUrl, keyIconUrl, gemIconUrl)
first asks spriteFor('icons', id) and otherwise calls drawIcon as today; list the callers that use iconTexture/iconDataUrl with an Icon but no id (popups, Book, hotbar, pack cards) in NOTES and hook those that know the id.
Tests: spriteIndex.test.ts (names per kind, completeness), spriteAssets.test.ts extended per kind (icons: 32x32 and a transparent 1 px ring; blocks 32x32; floors/walls 64x64; plants width 32; furniture: existing formula).
FILES: client/src/render/spriteStore.ts, spriteIndex.ts (+ tests), client/src/ui/itemIcon.ts. Not touched: furniture.ts, shared/. SAVE: none.
PARALLEL: artist A1 (staging). DONE WHEN: with zero icon PNGs nothing changes (full suite green); a dummy 32x32 `dirt.png` in sprites/icons shows in the bag (remove it after the check).

### C2 K2a Ripening: rules and API (SAVE 26)
GOAL: drinks can ripen in casks on a keg rack: fresh, aged, vintage (docs/NEXT-STEPS "Step K2" items 1, 2, 3, 5, 6; INN-PLAN M-D2). Do NOT start before C1 and H1 are merged.
STALE PARTS FIXED: casks interact with TAPS now. Aged/vintage mugs are plain drink ids, so `isDrinkId` (shared/src/materials.ts) must accept `<drink>_aged` and `<drink>_vintage`; then loadTap/unloadTap/pourMug/drinkStock in shared/src/taps.ts work unchanged (test it).
BUILD: config (shared/src/config.ts tavern block): RIPEN = [{ tier 'aged', valueMult 1.6, tipMult 1.5 }, { tier 'vintage', valueMult 3, tipMult 2.5 }], afterMin by the BASE drink's rank:
common 30 / 180, rare 120 / 480, ultra_rare 240 / 960, legendary 480 / 1920 (numbers are starting values; keep them in config); CASK_SLOTS 3; TASTE_AGED_CHANCE 0.25.
Tier items derived from drinks.json by a loader (not hand-copied): id `<id>_aged`, `<id>_vintage`, name "Aged root ale", baseValue = base * valueMult (rounded), rank = base rank (vintage one step up at most), icon = base icon (the tier band is drawn by the artist's option, A2).
Casks as data on the keg rack: FurnitureType flag `casks: true` on keg_rack (like `taps`/`cooks`; the type is in shared/data/furniture.json, id keg_rack, check its cells), TavernState.casks: { rackUid, slot, drink, mugs, startedAt }[] in shared/src/tavern.ts (emptyTavern gives []; save.ts isGameState requires it).
New shared/src/casks.ts (pure, like taps.ts): fillCask(state, rackUid, slot, drink, qty, at) (one FRESH drink, qty 1..that drink's brew mugs, ledger 'cask_fill'), caskTier(cask, at) (exact boundaries), collectCask(state, rackUid, slot, at) (the tier item at the CURRENT tier, fresh if too early, ledger 'cask_collect', gains list, slot free), caskViews(state), returnOrphanCasks (a rack that is gone gives mugs back, a rack in the bag keeps them).
Guests: shared/src/guests.ts taste trait: with TASTE_AGED_CHANCE a guest orders an aged/vintage drink if one is on a tap, accepts a price up to tolerance x valueMult; guestTip uses tipMult; the S3 gem tip uses the item's rank (already supported). Menu rule: tier items are menu rows like any drink and only sell while on a tap (T1a rule).
Book: tier items are finds (check where drinks show: shared/src/book.ts / client ui Book; add a Drinks tab if none).
GameAPI + api/tavernApi.ts: getCasks, fillCask, collectCask. SAVE 26: MIGRATIONS[25] adds casks: [] (test: nothing else changes, no second migration).
TESTS (shared/src/casks.test.ts + tavernApi tests): boundaries to the millisecond, across a save and reload, early collect gives fresh, slot limits, a full tavern flow cask -> tap -> pour -> taste guest pays more (fixed rng), the menu price rule for tiers, ledger adds up, migration, balance.test.ts still green.
ECONOMY: tools/simulate-economy.ts prints gold per mug for fresh / aged / vintage; target aged 1.4 to 1.7x and vintage 2.5 to 3x the gold of fresh for the same mugs including the wait; tune config only; if S3 targets (BALANCE_TARGETS) fail, report instead of retuning them.
FILES: shared/src/casks.ts (+test), tavern.ts, guests.ts, materials.ts, config.ts, save.ts, types.ts, newPlayer.ts, shared/src/api.ts, client/src/api/tavernApi.ts, localGameAPI.ts (delegation), shared/data/furniture.json (casks flag on keg_rack: ONE small Edit), tools/simulate-economy.ts.
PARALLEL: artist A2 (ART-K2: stubs and CSS first). DONE WHEN: suite + typecheck green and the economy table printed in the report.

### H2 Art upgrade R2 hook: blocks drawn from PNG (small)
GOAL: the room draws a block from sprites/blocks/<id>.png when it exists (same picture for the world tile and the item icon through the icon hook for kind 'blocks'); crack stages stay code-drawn on top; no PNG = today's code tile.
FILES: the client code that draws blocks in a room (find it: grep Room.blocks in client/src/render, probably roomView/blockViews), client/src/ui/itemIcon.ts (materialIconUrl for group 'block' asks kind 'blocks' first). Not touched: shared/.
TESTS: spriteAssets (blocks 32x32 exist and match a blocks.json id), a render-free test for the lookup. PARALLEL: artist A2/A3. DONE WHEN: a dummy dirt.png shows as tile and icon, removed afterwards.

### C3 K2b Cask panel (client)
GOAL: K2 item 4. Needs C2 merged and the artist's A2 stubs (`tier` option on drawIcon/iconTexture/iconDataUrl, CSS classes .cask-list .cask-card .cask-bar .cask-tier .cask-fill).
BUILD: client/src/ui/caskPanel.ts via ui/panelShell.ts: 3 slot cards (icon with tier band, drink, mugs, time bar, tier chip fresh/aged/vintage, Fill and Collect buttons; Fill picks a drink and a count from the bag), a 1 s interval ticking the bars while open (like the stove panel in game/tavernLife.ts), keg_rack tap routing: walk next to it (like STOVE_REACH_PX/BARREL_REACH_PX, add CASK_REACH_PX to config) then open the panel; Menu panel shows tiers; texts at reading pace; the old-save toast line.
TESTS: client/src/ui/*.test.ts for the pure text helpers (like sellTab.test.ts), a tavernApi cask round trip through LocalGameAPI. FILES: ui/caskPanel.ts, game/tavernLife.ts, gameLoop.ts (arrival), sideButtons none, texts.
PARALLEL: artist A3 (blocks). DONE WHEN: by hand brew -> fill -> close game -> collect aged -> load on a tap -> a taste guest orders it. Then TESTER route and the owner's CP-1 playtest (see decisions).

### C4 MB-2 Inn doors: rules and data (SAVE 27)
GOAL: one connected Inn (docs/NEXT-STEPS "Step M-B", INN-PLAN M-B). Walking order suite (kind 'hotel') - tavern (kind 'shop') - garden (kind 'farm'); lakeside, mine, dungeon stay Map only.
DESIGN (decided by the lead, small): an Inn door is a 2-cell wide doorway in the BACK WALL BAND at a cell column given by data; its SPOT is the 2 x 1 floor cells right in front of it (the room's first row under that wall). The spot is blocked for floor furniture, blocks and plants like the door zone, wall items may not overlap that x range, guests (npcGrid) never use it, and it never touches the main door zone or the kitchen zone (T1b), the bar's staff spot or the start items.
DATA: shared/data/innDoors.json: per room kind and shape/level (hotel/shop use roomShapes.json shapes x levels 1..3; the farm uses its own sizes, derive from room w/h): list of { id 'suite_to_tavern' | 'tavern_to_suite' | 'tavern_to_garden' | 'garden_to_tavern', col, row 0, w 2 }. The suite has one door (to the tavern), the tavern two, the garden one. Pick columns so every shape and level has an up-facing floor edge at that column (test).
RULES: shared/src/innDoors.ts (pure): innDoorSpots(room), doorAt(room, cell), innTravel(state, fromRoomId, doorId) -> { roomId, cell, facing } or null (null while a run/mine/lakeside session is active; the arrival cell is the matching door's spot, the avatar then steps one cell down); canPlace/blocks/plants/wall-item rules reject the spot (extend roomBlockers and the block/plant placement checks, reasons 'inn_door'); upgrade and migration move things off new spots.
SAVE 27: MIGRATIONS[26]: items, blocks and plants standing on door spots go back to the bag (ledger reason 'door_spot'; a plant gives its seed), a toast text; nothing else changes. Test it.
TESTS: spots valid on all 5 shapes x 3 levels for hotel and shop and the 3 farm levels (on floor, in front of a back wall, no overlap with door zone, kitchen zone, start items, staff spot), nothing placeable there, reachable from the main door, door_blocked/counter_blocked rules still hold, innTravel refuses during a run and keeps the avatar's state, migration, guests never path through spots, ledger.
FILES: shared/data/innDoors.json, shared/src/innDoors.ts (+test), furniture.ts/blocks placement checks, npcNav.ts, save.ts, types.ts, config.ts, shared/src/api.ts (GameAPI.useDoor(doorId)), client/src/api/roomsApi.ts or walkApi.ts. No UI.
PARALLEL: artist A4 (ART-MB2 stub first). DONE WHEN: tests + typecheck green.

### H3 Art upgrade R3 hook: floors and walls from PNG (small)
GOAL: the room view uses sprites/floors/<styleId>.png (64x64, seamless) and sprites/walls/<styleId>.png (64x64, repeats sideways) when present, else the code textures (render/bareStyles.ts etc.). Painted cells (Room.floorCells) already draw as runs of tiling sprites: reuse that path.
FILES: the room view code in client/src/render (roomView*.ts, bareStyles.ts), spriteStore kinds 'floors' and 'walls' (already generalised in H1). TESTS: asset sizes. PARALLEL: artist A5. DONE WHEN: a dummy 64x64 wood_planks.png tiles in the tavern with no seam gaps at zoom 1 and 3, removed afterwards.

### C5 MB-3 Inn doors: client (needs C4 + the artist's A4 stub `drawInnDoor`)
GOAL: stepping onto a door spot changes rooms with the existing short fade and arrives at the matching door; the Map stays as fast travel.
BUILD: game/roomFlow.ts and pointerInput.ts: a walk whose GOAL is a door spot (tap on the doorway, or hold-walk ending on it), or a path that ends on it, calls api.useDoor(doorId); never on a path that only crosses it; not during a run, the mine or fishing; arrival through the existing openRoom path and camera intro (skip the intro zoom on door travel: short eased camera); guests and the tavern clock keep running as for Map travel (check tavernApi catch-up still holds); door visuals via `drawInnDoor(layer, door)` (render/innDoors.ts); a tap on a doorway with a panel open only closes the panel; hint toast once ("Doors lead to the tavern and the garden"); Map cards unchanged.
TESTS: roomsApi/walkApi tests (useDoor moves the avatar and room, refused in a run, arrival cell right), a pointer helper test if one exists for goal detection. FILES: game/roomFlow.ts, pointerInput.ts, api/roomsApi.ts, texts.
PARALLEL: artist A5 (floors, staging). DONE WHEN: by hand suite -> tavern -> garden and back, a reload keeps the room, no console errors. TESTER route after it.

### C6 9g-1 Hats and emotes (no save bump if unlock uses Player.unlockedClothing)
GOAL: 9g items 1 and 2 (docs/NEXT-STEPS "Step 9g"), refreshed. Hats stay OUT of the clothes packs (decided): add a flag in clothing.json (`pack: false`) honoured by the pack pools in shared/src/packs.ts, with a test that Common/Rare pools do not change and balance.test.ts still passes.
DATA: shared/data/clothing.json slot 'hat', none free, with rank and unlock source (use only sources that already have an event hook): straw_hat common catalog; wool_cap common catalog; cook_cap common catalog; feather_cap rare catalog (a new Clothes tab in the Catalog; catalog price = baseValue x 3); tavern_keeper_hat rare, Book reward 25% (bookRewards.json); fisher_hat rare, first rare fish caught; skull_cap rare, skeleton drop (loot table); flower_crown ultra_rare, a splice clothing seed (splice.json + spliceSeeds.json); knight_helm ultra_rare, first Bone King kill; gold_crown legendary, Book reward 100%; sunken_crown_hat legendary, catching the sunken crown; miner_lamp_cap rare, 10th mine visit. A hat the player does not own shows as a grey silhouette with the hint text in the Avatar panel.
EMOTES: shared/src/emotes.ts (pure: kinds wave, dance, laugh, cheer, sleep; duration config EMOTE_MS; cancelled by walking), GameAPI.emote(kind) -> { kind, untilMs } (transient avatar field, NOT saved), client/src/ui/emoteButton.ts next to the chat button (a small menu), Settings pref nameTags (client/src/api/prefs.ts) and the name tag toggle; the client calls the artist's stubs `hatPart(id)` and `emotePose(kind, t)`.
TESTS: hat data valid (12 ids unique, slot hat, unlock source exists), unlock grants for each event path with a fixed state, locked hats not wearable, pack pools unchanged, emote cancel rule, prefs. FILES: shared/data/clothing.json, bookRewards.json, loot.json, splice*.json, shared/src/clothing.ts, packs.ts, emotes.ts, api, ui/emoteButton.ts, avatarPanel logic, prefs.
PARALLEL: artist A6 (stubs first). DONE WHEN: suite green, by hand: buy a hat, wear it, emote, toggle name tags.

## ARTIST QUEUE (each: Aseprite plugin, `preflight` first; quality gate of PLAN-ART-UPGRADE section 6; ramps in art-src/RAMPS.md)

### A1 R2 blocks (IN PROGRESS in art-src/staging/blocks)
IDS (blocks.json, 32 x 32 each, one cube showing top and front, fills the cell, 1 px dark outline, light top-left): dirt (walnut/oak), planks (oak/sand), stone (slate/steel), glass (cyan/white, see-through look with a bright highlight), clay (clay/rust).
Keep the colours of each block's icon.colors so old saves look related. EXPORT to client/src/assets/sprites/blocks/<id>.png (32x32, no trim) ONLY after H2 is merged; until then stay in staging (the sprites folder test would not know them). Sources: art-src/aseprite/<id>.aseprite.
DONE WHEN: five PNGs pass validate and pixel-critic, a contact sheet is shown, in-game at zoom 3 after H2. User signs the style lock on this round. Coder in parallel: C1, then H1.

### A2 ART-K2 (before C3 K2b)
STUBS FIRST in the first commit, signatures fixed: client/src/render/drawIcon.ts gets an optional trailing `tier?: 'aged' | 'vintage'` on drawIcon, iconDataUrl and iconTexture (a 3 px band across the middle of the mug, gold for aged and red for vintage, cached per tier); ui.css classes .cask-list .cask-card .cask-bar .cask-fill .cask-tier (+ .tier-aged .tier-vintage); tell the coder in the commit note.
THEN ART: keg_rack sprite (read its cells in shared/data/furniture.json; show three casks, id keg_rack, down/up/right as its facings list says), plus the code `art` fields for tier mugs not needed. Export sprites/furniture/keg_rack*.png. FILES: render/drawIcon.ts, iconPixels.ts if needed, ui.css, art-src/aseprite/keg_rack.aseprite, assets/sprites/furniture.
DONE WHEN: validate + pixel-critic + in-game check next to the stove and the barrel. Coder in parallel: C2 (K2a, shared only) then H2.

### A3 R3 blocks
IDS: thatch (butter/sand), lantern_block (orange/butter, glowing; it is a light block), brick (red/crimson), mossy_stone (forest/slate), cinder_block (ink/crimson). 32x32, same rules, export after H2. Coder in parallel: H2 then C3.

### A4 ART-MB2 (before C5)
STUB FIRST: client/src/render/innDoors.ts exports `drawInnDoor(layer: Container, door: { id: string; x: number; y: number; w: number })` (world px of the doorway in the back wall band, w = 64) with three code-drawn looks keyed by the door id prefix (suite wood door with a small star, tavern oak double door with a warm glow, garden arched gate with leaves) plus a warm arrival light; also `.room-fade` CSS in ui.css for the fade (respect prefers-reduced-motion).
THEN Aseprite drafts in art-src/staging/doors: three 64x64 doorway sprites (kept for a later hook; not exported yet). FILES: render/innDoors.ts, ui.css, art-src/staging/doors. Coder in parallel: C4 then H3.

### A5 R4 floors (before in-game check needs H3)
IDS (styles.json): bare, wood_planks, stone_tiles, red_carpet, soil. 64 x 64, SEAMLESS (check by tiling 3x3 in Aseprite tiled mode; no visible seam, no obvious repeat blotches), 3 to 4 shades per material, top-left light is irrelevant on flats but keep the same ramps; bare stays plain and dull on purpose. Stage in art-src/staging/floors; export to sprites/floors/<id>.png after H3. Coder in parallel: C5 (MB-3).

### A6 ART-9g1 (before C6)
STUBS FIRST: client/src/render/hatParts.ts `hatPart(id): Container | null` and client/src/render/emoteAnim.ts `emotePose(kind, tMs)` (returns small offsets/overlays; the box avatar shape is NOT changed, hats sit on the head layer only).
THEN ART (code-drawn on the box avatar for now, the avatar is still the approved box): the 12 hats of C6 (ids as listed there), a grey locked silhouette variant, the five emote poses with the zzz bubble, the name tag plate, ui.css for .emote-btn / .emote-menu / .nametag. Files: render/hatParts.ts, emoteAnim.ts, avatarSprite.ts (artist only), ui.css. Coder in parallel: C5 or C6.
DONE WHEN: a contact sheet of the 12 hats at game size and in the avatar panel.

## TESTER LANE (agent ~/.claude/agents/tester.md; no code changes; run after K2b, MB-3, 9g-1 and any large art round)
SMOKE ROUTE (10 steps; report each as PASS/FAIL with a screenshot, plus console errors and any 404 for a sprite):
1. `npm run dev`, open the page at 1000x700, then once at 420x760 (phone). Console must be clean; note load time.
2. New game: character creation (type an Inn name of 16 characters), pick shapes, watch the intro (a tap skips it).
3. Tavern look: the bar with register and tap stand, a bar stool, a round table with 2 stools, the stove, a barrel with 7 root ale; sprites show (no box placeholders where a PNG exists).
4. Tap the barrel (walks next to it) and collect; tap the tap stand: Taps panel; Load all root ale into a tap; reopen and check the mug count.
5. Tap the register: Menu tab: root ale and roasted turnip On; wait for a guest (guests come about every 45 s); tap the guest: the avatar goes to the tap, pours, carries the mug; tap the coins.
6. Stove: cook a roasted turnip (needs a turnip: do step 8 first if the bag has none); Collect when ready.
7. Build mode (B): move a stool, rotate, pick up and place again; Room panel shows the kitchen zone tint; place a prep table next to the stove in the zone and check the batch size grows.
8. Map -> Farm: paint nothing, plant a turnip seed on soil, punch a block, place a block; Map -> Dungeon: one run, fight one slime, Leave.
9. Doors (after MB-3): walk suite -> tavern -> garden and back; Map travel still works. Casks (after K2b): fill a cask, collect early.
10. Reload the page: the same room, gold, taps, casks, Inn name; close the tab for 2 minutes and reopen to check the offline catch-up (seats only); final console and layout check at 420x760 (panels end above the hotbar, 44 px buttons).
OUTPUT: a short list of crashes, missing sprites, layout problems and anything that felt wrong, ordered by severity, to the manager.

## DECISIONS FOR THE USER (recommendations)
1. CP-1 playtest: after C3 (K2b) the whole tavern loop exists. Recommended: yes, ask the user for the one-hour playtest then, before C6/9g (hats, avatar related).
2. K2 balance numbers (valueMult 1.6/3, wait times): the lead set them from the K2 prompt targets; recommended: accept, tune in config only after CP-1. Only ask if the economy table shows a source over 50%.
3. U1 pixel avatar: hats in C6/A6 are drawn on the CURRENT box avatar. Recommended: yes, do that now; if U1 is approved later the hats get redrawn with the avatar.
4. Push to GitHub: still the user's call (a push deploys). Recommended: ask after CP-1 passes.
Everything else in this queue is decided (door design, hat list, tier numbers, folders).
