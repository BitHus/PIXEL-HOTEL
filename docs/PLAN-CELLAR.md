# PLAN-CELLAR: attached KITCHEN room and CELLAR room (OA-7; planner, 17 Nov)

Status: DESIGN ONLY, no code, no data. Every number marked PROPOSAL needs the owner's OK and a green `npm run simulate` plus balance.test.ts before it is locked. Builds on docs/RESEARCH-OA.md section 2 (tiers, rooms) and K2 casks (shared/src/casks.ts, shared/src/config/ripen.ts). Fits docs/GAME-VISION.md: GATHER (farm) -> MAKE (brew in the kitchen, ripen in the cellar) -> SERVE (taps, pour) -> EARN (aged drinks pay more, pickier guests tip) -> BUILD (cellar racks, kitchen layout) -> SHOW (a cellar of vintages, room stars). No timers that push the player, nothing rots, no pay pressure (CLAUDE.md 13); waiting is a choice, never a requirement.

## 1. The idea
farm crops -> KITCHEN room (barrel brews fresh mugs, stove cooks) -> collect mugs -> CELLAR room (load a cask on a keg rack, it ripens in real time, also offline) -> a ripe dot on the rack -> collect at the tier reached -> TAP STAND in the tavern (load, pour) -> guests pay more for aged, vintage, reserve.
The player chooses what to age: a few vintages for profit, the rest fresh for volume. Racks are limited, so "longest" is never the only strategy.

## 2. Reuse (do not rebuild)
- K2 casks stay as they are: `TavernState.casks [{rackUid, slot, drink, mugs, startedAt}]`, casks.ts (fillCask, caskTier by exact ms, collectCask at the CURRENT tier, caskViews, returnOrphanCasks), ledger `cask_fill` / `cask_collect`, `CASK_SLOTS` 3 per rack, furniture flag `casks` on keg_rack, GameAPI getCasks / fillCask / collectCask, the Cask panel. A rack is found by uid, so it can live in ANY room: no new cask field.
- Brewing (TavernState.brews keyed by barrelUid) and cooking (TavernState.cooks) are keyed by furniture uid, so moving barrel or stove to another room changes only the "which room is this uid in" lookups (find every place that gates these on `room.kind === 'shop'`).
- OA-5 machine states (machineState.ts) and staged art (barrel_ready, stove_ready, ripe_sparkle) drive "ready" cues; the rack ripe dot uses ripe_sparkle (hook still missing).
- T1 kitchen ZONE and PREP_BONUS stay: in the kitchen room the whole room is the zone (maths unchanged). Taps and register stay in the tavern.
- Room machinery: roomShapes.json, styles, door zone, camera intro, the One Inn doorways between rooms (coder reads roomsApi.ts and the Inn door code first; reuse that link structure).

## 3. New rooms
### 3.1 Kinds, shapes, doors
- `Room.kind` gains `'kitchen' | 'cellar'` (types.ts, room.ts, roomShapes.json, styles, every guard that switches on kind). Same Room record. Reachable only by their door from the tavern.
- Shapes (PROPOSAL, whole cells, each level contains the previous): KITCHEN 6x5 (L1), 8x5 (L2), 8x7 (L3). CELLAR 8x5 (L1), 10x5 (L2), 10x7 (L3). Door: 2-cell opening under a bottom edge, 2x2 door zone free (CLAUDE.md 5).
- In the TAVERN: a fixed 2-cell kitchen doorway on the back wall and a stairs door (planner pick, back wall, same mechanism as Inn doorways) to the cellar. Items may never cover them.
- Guests never enter kitchen or cellar (npcGrid). The avatar walks through; the normal room-open camera intro plays (tap skips).
- Looks (artist): kitchen warm stone tile, hearth glow, hanging pots; cellar cool dark stone, torch light, barrels on racks (friendly, not the crypt). Styles `kitchen_tile`, `cellar_stone`, free and unlocked.
- placeIn: stove, prep_table, pantry, sink, serving_hatch, brewing_barrel become `['shop','kitchen']` (old layouts stay valid); keg_rack `['cellar','shop']`. Taps, register, bar, tables stay tavern only.

### 3.2 Getting the rooms (PROPOSAL)
- KITCHEN: FREE, present in a NEW game with the starter stove and barrel standing inside, so the tutorial brews there. Upgrades 300 / 800 gold (like other rooms).
- CELLAR: built with gold from the Room panel, available at player level 2, cost 300 gold (the first hour earns about 460), includes 1 free keg rack. Upgrades 400 / 900.
- Racks allowed per cellar level: 2 / 4 / 6 (CELLAR_RACK_MAX_BY_LEVEL). Each rack = 3 casks of up to TAP_CAP (12) mugs.
- Old saves: kitchen created automatically (stove, barrel, prep tables moved in); cellar built free only if the player owns a keg rack.

## 4. Tiers, ripening, value
### 4.1 Tier table (PROPOSALS; aged and vintage exist today)
| tier | after, common (min) | value mult | tip mult | gate |
| fresh | 0 | 1.0 | 1.0 | none |
| aged | 30 (exists) | 1.6 (exists) | 1.2 (exists) | any rack |
| vintage | 180 (exists) | 3.0, rank +1 (exists) | 1.0 (exists) | any rack |
| reserve (NEW) | 720 | 5.0 | 1.5 | cellar level 2 or more |
RIPEN_AFTER_MIN third number per rank (PROPOSAL): rare 120 / 480 / 1440, ultra_rare 240 / 960 / 2880, legendary 480 / 1920 / 5760 (common 30 / 180 / 720).
Collect gives the CURRENT tier (existing rule); in a level 1 cellar a cask stops at vintage. Tier items are DrinkIds (`root_ale_reserve`), own menu price and tap stock, rank colour on chips. Optional later: racks by a cool wall ripen 10% faster.
If the owner declines reserve, stop at vintage and drop CEL-5.

### 4.2 Guests
TASTE_AGED_CHANCE 0.25 stays. New TASTE_RESERVE_CHANCE PROPOSAL 0.10 (reserve, tip 1.5x). Menu rule unchanged (a drink is on the menu only while a tap holds a mug).

### 4.3 Balance and test expectations (group CEL in balance.ts / balance.test.ts, table in `npm run simulate` section CEL)
Keep true: guest share 10% to 55% cap, hour one about 460 gold, trader never lists drinks, ingredients sold < brew.
1. Gold per mug-minute of rack time per tier <= best fresh path x CEL_RACK_RATIO_MAX (PROPOSAL 1.6).
2. Rack-day value: reserve <= vintage x 1.5 (the choice stays real).
3. A full L3 cellar (6 racks, 18 casks) all reserve keeps the guest share <= 55% in the best-kitchen scenario (reserve flow capped by guest rate).
4. Tier items never in getSellRows; ledger: cask fill then collect returns exactly the mugs put in.
5. Cellar cost (300) <= 1/3 of the first hour's gold after level 2.
6. All-aged tavern earns about x1.6 on drinks (K2 note); with reserve the maximum drink multiplier is bounded by the tests above.

## 5. Save shape and SAVE bump
SAVE_VERSION 32 -> 33 (TUT-2 also mentions 33 for quests.claimed: first to land takes 33, the next takes the next free number; migrations are independent).
- `Player.kitchenRoomId?: number`, `Player.cellarRoomId?: number` (missing cellar = not built). `Room.kind` union extended. No cask field.
MIGRATIONS[32] (save.ts) with tests:
1. Create kitchen room (shape by tavern level), fresh integer id, style kitchen_tile.
2. MOVE stove, prep_table, pantry, sink, serving_hatch, brewing_barrel from the tavern into it at free cells; the rest to the inventory (ledger reason 'migrate'). Brews and cooks are keyed by uid so `readyAt` stays exact.
3. If the player owns a keg_rack: create cellar L1, move racks in (excess to bag); casks keep rackUid and startedAt. Else leave unset.
4. Old zone code path stays until the owner agrees to remove it.
Tests: stove + brew in progress; cask half way (tier by exact ms kept); nothing built; full tavern (nothing lost); idempotent; new game has kitchen with stove and barrel, no cellar.
Also update CLAUDE.md 5, 9, 10, docs/BRIEF.md, NOTES.md, the Room panel, roomsApi, and tests that assume brews live in the shop room.

## 6. Tutorial (shared/data/guide.json)
Existing ids: barrel, collect, load, stove. Changes:
- NEW step `kitchen` before `barrel`: target the kitchen door, text "{Tap} the kitchen door at the back of the tavern. This is where you brew and cook." Event when the kitchen room opens (coder adds a `door` target kind if needed).
- `barrel`: "Tap the barrel to start your first brew." (now inside the kitchen). `stove`: text says "in the kitchen". `collect`, `load` unchanged.
- NEW optional step `cellar` after `load`, offered only when the cellar is built or buildable, target the cellar door: "{Tap} the cellar door. Mugs left on a rack ripen and sell for more." Ticks on FILLING a cask, never on waiting. Skippable, never blocks.
Update docs/GUIDE-UPDATE.md and TEAM 1e.

## 7. UI
- Door tap = walk there, then room switch (existing flow).
- Cask panel: tier chips in RANK_COLORS (fresh, aged, vintage, reserve), per-cask text "ripe in 2 h" (no live countdown), Collect, a locked reserve chip with the reason.
- Ripe dot on the rack and on the side button (OA-5 style); one toast only when the player is in the cellar. No nagging.
- Room panel: Kitchen and Cellar cards (open, upgrade with cost, Build room with confirmBuy). One-time hint chip after the first brew is collected.

## 8. Tasks (one coder session each; gates: `npm test`, `npm run typecheck`, tests next to rules, CLAUDE.md/BRIEF/NOTES lines, NEWS entry, no ranked number without the owner)

### CEL-1 [coder] Room kinds, shapes, styles, SAVE 33
Prompt: Read docs/PLAN-CELLAR.md sections 2, 3, 5, docs/RESEARCH-OA.md section 2, shared/src/types.ts, room.ts, roomsApi.ts, shared/data/roomShapes.json, styles.json, shared/src/save.ts. Add Room.kind 'kitchen' | 'cellar', roomShapes entries (kitchen 6x5/8x5/8x7, cellar 8x5/10x5/10x7), styles kitchen_tile and cellar_stone (free, unlocked), Player.kitchenRoomId? and cellarRoomId?, SAVE 33 with MIGRATIONS[32] exactly as plan section 5 with tests (brew in progress, cask half way, nothing built, full tavern, idempotent). A new game creates the kitchen with starter stove and barrel inside; no cellar. Let placeIn accept the new kinds (furniture.ts canPlace). Guests never path into the new rooms (npcGrid). No UI or doors yet. Done when migration tests, room tests and typecheck pass.

### CEL-2 [coder] Doors and switching tavern <-> kitchen
Prompt: Read PLAN-CELLAR 3.1 and 7, how the One Inn doorways link rooms (roomsApi.ts, client/src/game/roomFlow.ts), furniture.ts doorway rules. Add a fixed kitchen doorway on the tavern back wall (chosen at room creation, never covered by items) and a matching door back; tap = walk there then open the room with the normal intro. Update every place that assumes brewing, cooking and prep bonus happen in the 'shop' room: in the kitchen room the whole room is the zone, the T1 zone still works in the tavern for old layouts. Tests for the zone rule in both. Box placeholder art.

### CEL-3 [coder] Kitchen panels and tutorial
Prompt: Read PLAN-CELLAR 6, shared/data/guide.json, docs/GUIDE-UPDATE.md, client/src/game/craftPanels.ts. Barrel and stove panels open from the kitchen, collected mugs go to the bag as before. Add the guide steps of section 6 (kitchen before barrel, updated barrel and stove texts), the door target kind if needed, tests for step order. A new game's first brew happens in the kitchen. Update GUIDE-UPDATE.md.

### CEL-4 [coder] Build the cellar, racks per level
Prompt: Read PLAN-CELLAR 3.2, roomsApi.ts, the Room panel code, ROOM_UPGRADE config. Add config CELLAR_BUILD_COST 300, CELLAR_UNLOCK_LEVEL 2, CELLAR_UPGRADE_COST [400, 900], CELLAR_RACK_MAX_BY_LEVEL [2,4,6], all marked PROPOSAL. GameAPI buildCellar() (level and gold checks, gold only via ledger applyChange, reason 'build', gives 1 free keg_rack), upgradeRoom for the cellar, canPlace refuses a rack above the cap with a reason, confirmBuy, Room panel cards, stairs door like CEL-2. Tests: cost, level gate, rack cap.

### CEL-5 [coder] Reserve tier (ONLY after the owner approves the numbers)
Prompt: Read PLAN-CELLAR 4, config/ripen.ts, casks.ts, materials.ts (DrinkId builder), balance.ts. Add tier `reserve` to RIPEN and a third time per rank to RIPEN_AFTER_MIN with the approved numbers, cellar level 2 gate (level 1 cellar caps at vintage), TASTE_RESERVE_CHANCE, tip scaling, price lookup for `<drink>_reserve`, menu and tap handling of the new DrinkId (every list that enumerates tiers). Tests: casks.test.ts (exact ms boundaries per rank, offline catch-up, early collect gives the lower tier) and balance group CEL items 1 to 6 plus simulate section CEL; paste the table into NOTES. If a test fails, report the table and stop; do not change numbers.

### CEL-6 [coder + ui] Cask panel chips, ripe dots, hint
Prompt: Read PLAN-CELLAR 7, the Cask panel, ui/panelShell.ts, docs/UI-REFERENCE.md, machineState.ts, RANK_COLORS. Tier chips, "ripe in 2 h" text, ripe dot on rack and side button, one-time hint, locked reserve chip with reason, touch size 44 px. Render only, no shared logic change. e2e smoke: open cellar, fill a cask, see the dot (unit-test the view data if no time warp exists).

### CEL-7 [coder] Guests with taste for reserve
Prompt: Read tavern.ts tasteOffers and tests. Add TASTE_RESERVE_CHANCE handling (rng used only when a reserve drink is on a tap, so existing seeds stay unchanged), tip scaling, tier on the orders strip chip, npcLines hook. Tests with seeded rng.

### CEL-8 [artist] Kitchen and cellar art (after CEL-2, CEL-4)
Prompt: Read docs/ART-STYLE.md, PIXEL-ART-GUIDE.md. Kitchen and cellar floor and wall styles, kitchen door, cellar stairs door (both sides), keg_rack states, torch, barrels. Aseprite only, Endesga 32, spriteAssets.test green.

### CEL-9 [coder] Cellar decor and room stars (optional, later)
Prompt: Add 3 cellar-only decor pieces (crates, wine shelf, hanging lantern; placeIn 'cellar'), count kitchen and cellar in roomScore.ts and tavern appeal (each type max 3). List all ranked numbers for the owner; do not lock them.

### CEL-10 [tester] Playtest the flow
Prompt: New game: tutorial, brew in the kitchen, load a tap, serve. Reach level 2, build the cellar, fill a cask, time-warp, collect aged, serve it. Load an old SAVE 32 with a stove, a barrel and a half-way cask. Report in docs/FIXLIST.md. No production code.

## 9. Owner decisions needed
1. Kitchen free in a new game; cellar 300 gold at level 2 with 1 free rack: OK?
2. Keep the 12 h reserve tier (needs a level 2 cellar) or stop at vintage?
3. Approve the numbers in 3.1, 3.2, 4.1 (room sizes, costs, rack caps 2/4/6, tier times, TASTE_RESERVE_CHANCE 0.10) as the starting set to simulate?
4. Door look: kitchen door + cellar stairs door (planner pick) or a floor hatch?
5. Old saves: auto-move stove and barrel into the kitchen (planner pick) or leave them?
6. Guests seeing into the kitchen (serving hatch window): not in v1.
7. Cask quality from crop rank: not in v1.
