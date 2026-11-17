PROJECT BRIEF (short form)
Fixed decisions. Do not change them unless I say so. Short form; the full text of each section
(every number, flow, data shape) is docs/BRIEF.md, same numbers: read it before working on a topic.

1. WHAT WE ARE BUILDING
A browser game. Parts:
- Hotel: top-down pixel-art rooms in the style of Travellers Rest (slight front angle: you see the
  top and front of things). Walk as an avatar, chat in bubbles, build per cell (32 px build grid;
  wall items stay free along the back wall).
- Dungeon: random, real-time, clicking fast is the game. Chests give loot; enemies are the danger.
- Tavern (the shop room, step 9t; S1: nobody buys loot at a stall any more; T1: a real bar and kitchen): guests sit, order drinks and dishes from your menu, you
  serve them (their coins come in by themselves). The bar carries a REGISTER and TAP STANDS (drinks are poured from taps); a staff-only KITCHEN corner has the stove and prep tables. Brewing barrel (crops -> mugs, loaded on taps) and stove (crops -> dishes). Gold comes from guests and dungeon run
  gold and the trader (S2: tap-to-sell Sell tab on the bar) and buys furniture in the catalog. Items are for USE: cook, brew, craft, build, plant.
- Farm (10b): grow crops in real time. The tavern kitchen (K1): a stove cooks them into food that heals or buffs.
- Mine (10c): click-to-mine trips for ore; ore -> bars at the forge -> weapons, armor, tools.
- Lakeside (10d): chop trees for wood, fish in the lake.
The loop: dungeon (loot) -> tavern (gold) -> furniture; farm (food) -> stronger runs; mine (ore) ->
better gear -> deeper runs. Every player starts with two small basic rooms (hotel room, shop).
Name: PocketBarrel (renamed from the working title Pixel Hotel, 17 Nov; ids, save keys and repo name keep the old name).
Original names, art and assets only. Never copy Habbo, Travellers Rest or any other game.

2. STACK (do not change)
- TypeScript everywhere. npm workspaces: client/, server/, shared/.
- client: Vite + PixiJS (current stable) for the game view, plain HTML/CSS overlay for the UI.
  server (step 10): Node.js + ws + better-sqlite3 + bcryptjs.
- Tests: Vitest; every pure rule in shared/ gets tests. Free and open-source libraries only.
- Browser first, desktop and phone (touch-usable UI, no desktop-only APIs); a Windows app later.
  Saves go through one small storage interface.

3. ARCHITECTURE RULE
- All game rules live in shared/ as pure functions on plain data. No rendering, no network, no
  Date.now or Math.random inside rules: time and rng are passed in.
- The client talks only to the GameAPI interface (shared/api.ts). Until step 10: LocalGameAPI
  (shared rules in the browser, saves to localStorage). Step 10 adds RemoteGameAPI; the server is
  authoritative, the client only sends requests.
- Rendering code (client/src/render) never contains game rules.
- ONLINE STAGING (owner OK 17 Nov, docs/PLAN-ONLINE.md): solo play stays client-side (LocalGameAPI) until P5; until then the server (server/) only holds accounts and cloud saves (and later read-only visits), and the cloud client is behind a flag that defaults to off.

4. WORLD AND SCREEN MATH
- World coordinates are pixels, x right, y down, 1 world px = 1 art px. No isometric math.
- screenToWorld(p) = p / zoom + camera, worldToScreen(p) = (p - camera) * zoom. Zoom is free from
  0.5 to 4 (pinch, wheel), smooth during the gesture; after it, it eases (0.15 s) to the nearest
  zoom where zoom * devicePixelRatio is whole (or the overview zoom if closer) and the camera
  snaps to whole device px. The canvas renders at full devicePixelRatio. Overview zoom = the
  largest where the whole room fits (at least 0.5; else the camera follows the avatar). CAM-LOCK (hybrid, was OA-13 / COD-1): in EVERY room (not build mode, not the dungeon) the camera is LOCKED on the avatar while it MOVES (tap-walk, hold-walk, steer): the avatar sits exactly in the middle every frame, a drag never pans then (it steers the hold-walk or does nothing); standing still a one-finger drag pans to look around, and when walking starts again the camera EASES back over CAMERA_FOLLOW_EASE_MS (never a jump) and locks. Edge clamp is soft: the centre may leave the room by CAMERA_LOCK_MARGIN_PX (64 = 2 cells, dark backdrop shows); a room that fits on an axis at the zoom stays centred on that axis. Settings: Camera: Locked while walking (default, pref followCamera true) / Free look (false, old saves keep it); shared/src/cameraFollow.ts lockTarget/followLock. Pinch and wheel zoom always work; the shown camera snaps to whole device px.
- Camera intro when a room opens: overview, wait 0.6 s, zoom in over 0.8 s to the settled zoom
  nearest 3 device px per art px, centered on the avatar. Any tap, drag, pinch or wheel skips it.
- BUILD GRID (BG1): rooms are cell maps of BUILD_CELL = 32 px (config); the nav grid is the build
  grid (the dungeon keeps its own). Faint while placing or painting (Settings toggle).
- Pixel-perfect: no texture smoothing, sprites at whole world pixels.

5. ROOMS
- Room { id (integer), kind: 'hotel'|'shop'|'farm'|'lakeside'|'kitchen'|'cellar', level, shape, w, h, floorStyle,
  wallStyle }. The floor is a union of rectangles from shared/data/roomShapes.json (shape + level
  1..3; each level contains the previous one; data in whole CELLS). Shapes: square / square_shop, long,
  l_shape, plus, wide_hall. The player picks one for the hotel and one for the shop at the start.
- Walls: every up-facing floor edge gets the back wall band (2 cells = 64 px); other outside edges
  a 16 px border. Door: a 2-cell opening under a bottom edge; the DOOR ZONE (2 x 2 cells) stays free.
- Floors and walls are unlockable styles (shared/data/styles.json). Rooms start 'bare'. A bought
  or crafted style is unlocked forever and applied to any own room for free. Price = baseValue * 3.
  Floors are painted per cell (Room.floorCells; one cell or a rectangle); wall styles stay per room.
- New player: an empty level 1 hotel room and a level 1 TAVERN (internal kind 'shop') with the bar (the counter), a REGISTER and a TAP STAND standing on the bar (T1; the 7 root ale of a new game are loaded on the first tap), a round table with 3 stools (S3 had a bar stool in front of the bar for the 3rd seat; G2 removed it, the 3rd stool stands at the table; old saves keep their furniture), an idle brewing barrel and one stove (K1: you cook there, inside the kitchen zone); the early dish roasted turnip is on the menu.
- The counter (the bar): one per tavern, movable, never picked up; the spot behind it must stay reachable. T1: it is a SURFACE item (one level): the register and tap stands are onSurface pieces on its 3 cells.
- KITCHEN AND CELLAR ROOMS (OA-7, CEL-2..5, owner: use the plan's numbers, docs/PLAN-CELLAR.md): two attached rooms, reached only by a doorway in the tavern's back wall (innDoors.json: tavern_to_kitchen, tavern_to_cellar and the way back; guests never enter). The KITCHEN is free: a new game has it (Player.kitchenRoomId, 6 x 5 / 8 x 5 / 8 x 7 cells, upgrades 300 / 800) with the start stove and barrel inside; barrels, stoves, prep tables, pantry, sink and hatch work in the tavern (old layouts) and the kitchen (shared/src/workRooms.ts), and in the kitchen the whole room is the kitchen zone (prep bonus unchanged). The CELLAR (Player.cellarRoomId, 8 x 5 / 10 x 5 / 10 x 7) is built from the Room panel at player level 2 for 300 gold (ledger 'build', one free keg rack), upgrades 400 / 900, keg racks per level 2 / 4 / 6 (canPlace). Casks, taps and the register stay as before. RESERVE tier: a third ripening tier (x5 value, tip x1.5; after 720 / 1440 / 2880 / 5760 min by rank) only from a cellar of level 2 or more; level 1 cellars and tavern racks stop at vintage; TASTE_RESERVE_CHANCE 0.1. Tavern appeal counts the pieces of both rooms. Old saves (migration 35 -> 36) get the kitchen with their stove, barrel and prep tables moved in, and a free cellar with their keg racks.
- KITCHEN ZONE (T1): per tavern shape and level a cell rectangle (shared/data/roomShapes.json `kitchen`, level 1 a small corner next to the bar, levels 2 and 3 grow it). Staff only like behind the bar: guests never walk or sit there (npcGrid, tavernSeats); the owner's blocks and furniture are allowed. Shown as a faint tint while placing and in the Room panel.
- Room upgrade (gold): next level of the shape; items stay; items in the new door zone go back
  to the inventory.
- BLOCKS (BG5, ST1): Room.blocks = a foreground layer, a STACK of 1 to BLOCK_STACK_MAX (3, config) blocks per cell, bottom first (shared/data/blocks.json, items
  in the bag and hotbar). A block goes on top of the stack (cell problem 'stack_full' at the max); a punch hits and breaks only the TOP block; a plant needs a single
  bottom block ('stacked' otherwise). Never on the door zone, off the floor, on floor furniture, plants, or
  under an avatar standing still. A stack blocks walking like one block (walkable heights are ST3): a block that would shut the door
  off from the middle or the counter's staff spot is refused. In hotel, shop and farm only (owner).

6. MOVEMENT
- Tap the floor: walk there. Tap an item with seats: walk to its nearest reachable free side and
  sit or lie. A blocked target = the nearest free cell; nothing reachable = do nothing.
- Navigation: the nav grid is the build grid (NAV_CELL = BUILD_CELL 32 px); a cell with furniture
  on it is blocked, no avatar radius (a 1-cell gap is walkable). A* with 8 directions, no corner
  cutting, then smoothed to straight lines. Paths are lists of world points from shared/.
- Speed 128 px/s in rooms. Avatars never block each other. Facing = dominant movement axis.

7. FURNITURE
- Types: docs/BRIEF.md 7, shared/src/types.ts. (x, y) = the anchor, bottom center of the footprint.
- FLOOR items are whole cells (type w, d multiples of 32); the anchor CELL is the bottom-centre
  cell (even widths: the left of the two centre cells); rotation swaps w and d, keeps the anchor
  cell. Valid if: on floor cells, no overlap with another blocking item (rugs and floor decor
  overlap anything), not on the door zone, the door still reaches the middle. onSurface items sit
  on a cell of a surface item (one level): the bar and the prep table are surfaces; the register, tap stands, mugs and plates sit on them (T1). FS1 (owner 17 Nov): small decor with freeOnSurface (candles, small lamps, statuettes, pots) sits at ANY point on the top of a surface (4 px snap, Shift = none), not per cell; register and tap stands stay per cell. WALL items stay free (OA-10, owner 17 Nov): anywhere on a back wall band, free x AND y (like Habbo), the whole item inside the 64 px band,
  4 px snap (Shift = none), anchor y = the item bottom (stored in item.y; old items sit at the foot). Never over an Inn doorway or another wall item. Side walls: rooms have none (only a 16 px border), so none.
- Draw order: floor, rugs, back wall, then ONE list of items and avatars sorted by y, x, uid; an
  item on a surface right after the item under it.
- Rotation cycles the type's facings; left = right mirrored. Placeholder art = boxes.
- RANKS: everything has one of common, rare, ultra_rare, legendary, with a colour (RANK_COLORS)
  on the slot border and name; ultra_rare and legendary drops sparkle.
- Catalog price = baseValue * 3. inCatalog = false items come from the dungeon or crafting only.
  An item can only be placed in a room that matches its placeIn.

8. AVATARS
- Layers (U1, owner go 16 Nov): body (head, hands, skin), shoes, legs (bottoms), torso (top with sleeves), outer (cloak, tabard, apron, belt; optional), hair (back and front), face, hat, held item. Body layers are frame strips; head layers (hair, face, hat) are one picture per facing placed by a per-frame head offset (shared/data/avatarRig.json). Each recolourable layer uses key colours that are swapped for a ramp of the chosen colour (shared/data/ramps.json); hats keep fixed colours.
- Proportions (option B of docs/art-sheets/avatar-proportions.png, chosen 16 Nov by the manager; the owner can veto at the style lock after A24): cosy three-head figure on a 32x64 canvas, feet at the bottom centre: about 54 px tall (head 17 px, shoulders 14 px wide) with the hat zone above it (nothing above 64). Down, up, right drawn, left mirrored. Stand = one walk frame; walk = 4 frames chosen by distance walked; sit = 1 frame per facing; eating, wave and cheer add 2 frames each later; face moods are single frames.
- Look: medieval (docs/ART-STYLE.md MEDIEVAL DIRECTION): tunics, jerkins, aprons, hoods, cloaks, tabards, boots, belts. Endesga 32 only; a 1 px dark warm outline is added by code around the composed figure; light top-left. The box avatar (client/src/render/avatarParts.ts) is the FALLBACK until every layer exists and is retired when the owner signs the new avatar off.
- Clothing is data (shared/data/clothing.json; free items, others hidden until unlocked); an id never changes, only its display name and sprite. AvatarLook stays compatible (a later optional `outer`). NPCs (guests, staff, roles) use the same body and layers; roles are data (shared/data/npcRoles.json).
- Character creation once at a new game (look pickers, display name max 16: letters, digits, spaces; ONBOARD-1: NO tavern-name question, the saved player.innName is derived as "<Name>'s Tavern", shown as such; player-facing text says "tavern", never "inn"), then the hotel shape and the shop shape, then the new-game intro in the shop (a tap skips it). The Avatar panel uses the same pickers.

9. ECONOMY (all numbers in shared/config.ts)
- One currency: gold (integer). Everything has a baseValue. New player (createNewPlayer): level
  1, 100 gold, bare styles, 4 wood and 2 cloth (plus 2 turnip and 1 potato for the first brew, ledger reason start), no furniture in the inventory.
- TAVERN (9t, done; S1 retired the loot shop): the shop room is the tavern (kind 'shop', same room id; the counter is the bar). GUESTS (alone,
  pairs, groups of 3 (OWN-4: the members of a group walk in ONE BY ONE, GUEST_GROUP_STAGGER_MS apart; the rate is unchanged), every 45 s * 100 / (100 + appeal), never more than seats) sit at a table, order from the MENU (tap the bar: Serve and
  Menu tabs; each drink or dish On/Off with a price stepper; price rule = tolerance + the four faces; out of stock = off), you tap the guest:
  the avatar carries the order from the bar (queue of 3), the guest eats 20 to 40 s and leaves coins + an empty mug that are COLLECTED
  AUTOMATICALLY (owner 17 Nov: same ledger reason, coin fx and popups still play; old piles in saves stay tappable; pouring, serving, selling, buying stay manual; unserved after 90 s = unhappy). Drinks: BREWING BARREL (tap it: Brewing panel, one brew at a time, real time, tap to
  collect) and TAPS (T1, below). Dishes: the stove (K1). Away: at most 3 seated orders; offline catch-up only fills seats (looks back at most 8 h).
- THE BAR AND THE TAPS (T1, owner 15 Nov): the REGISTER (furniture 'register', onSurface, till) and TAP STANDS ('tap_stand', onSurface, TAP_SLOTS = 2 taps each; more stands
  in the catalog) stand ON the bar. OWN-4 (d): above a guest who wants something there is only a tiny marker (a dot in the drink's colour, or the tiny dish icon; always shown while they want it; no big bubble). Tap the register = the bar's panel (Serve / Menu / Sell); collected coins fly into it. Tap a stand = the Taps panel (ui/panelShell.ts): each tap
  shows its drink and mugs (max TAP_CAP = 12); Load moves mugs of ONE drink from the bag (a number or Fill; ledger 'tap'), Unload gives them back (TavernState.taps, shared/src/taps.ts).
  A DRINK is on the menu only while a tap holds at least one mug (menu stock = mugs on taps; an open order only reserves a mug); dishes still come from the bag and the stove. SERVING a
  drink (G2, hands-on): the avatar walks to the taps (stage 'bar') and WAITS (stage 'pourwait', event 'pour_ready'); the player PRESSES AND HOLDS THE TAP STAND in the world (no button; a press near the stand belongs to the pour and never walks or pans; mouse, touch, or Space/Enter held) and the mug fills (pourFill: POUR_FULL_MS = 1400 ms to full, a hold ends by itself at POUR_HOLD_CAP_MS; shared/src/pour.ts); the tap pressed is the one holding the ordered drink (one tap: a press anywhere on the stand; two: the nearest; another drink or empty: a toast, nothing poured; pickPourTap);
  releasing calls pourHeld(heldMs, pick): the tap drops by one, a release inside POUR_PERFECT_RANGE (0.85 to 1.15, the green window drawn at the mug) is a PERFECT pour = a tip of POUR_TIP_RATE (10%) of the price in the guest's coins (TrayMug.perfect); under or over only misses the tip, the drink is never lost. ONE POUR = ONE MUG, and the mug goes on the waiter's TRAY (COD-1: TavernState.tray, up to TRAY_MAX = 3 mugs or dishes, shared/src/tray.ts; the avatar holds a code-art tray). A mug is not tied to a guest: it goes to ANY guest whose open order is that item. While mugs are on the tray the guests who want one PULSE (guestsWaitingFor / guestsTrayCanServe), and tapping such a guest, its seat, its table, its order bubble or its chip in the ORDERS STRIP (top of the screen, the ONLY place for order details, one chip per open order: icon, patience bar, state waiting/queued/ready; ordersStrip()) calls carryHeld(guestId): exactly ONE mug walks to that table (not automatic; dishes stay automatic). After a pour the avatar stays at the taps while more pours are queued (queue max SERVE_QUEUE_MAX, never more pours than guests want that item). 'Put back' returns the tray to the bag (returnTray, ledger 'tap'). The pour bar (ui/pourBar.ts) floats over the mug and fills while the stand is held (green = the perfect window). An empty tap says "Tap is empty" and
  the order stays open. A stand that leaves the bar gives its mugs back. Old saves (version 24) get a register and a tap stand on the bar (else in the bag), drinks stay in the bag.
- KITCHEN EFFECT (T1): each prep table (surface; kitchen pieces prep_table, pantry, sink, serving_hatch, placeIn 'shop') inside the kitchen zone and cell-adjacent to a stove inside it adds
  +1 dish per batch (PREP_BONUS max +2; fixed when the batch starts, the inputs stay those of the batch). A stove outside the zone works without the bonus. Taps, register and kitchen
  pieces count for tavern appeal like other decor (each type at most 3 times).
- NO SELLING TO LOOT CUSTOMERS (S1, owner 15 Nov): window-shoppers, buyers, the till queue, prices on slots and the stall sales are gone.
  Stall table, shelf and display case are plain DECOR (no slots, no prices); goods that were on them went back to the bag (ledger reason
  'shop_closed'). GOLD sources: tavern guests (main), dungeon run gold, the trader (S2: tap-to-sell Sell tab on the bar; never automatic).
- THE TRADER (S2): the bar's panel has Serve, Menu, Sell. Sell lists materials, blocks, seeds, crops, fish, ore, bars, spare clothes and
  furniture NOT placed; each row: icon, count, gold per piece, Sell 1 / Sell all. Price = baseValue * the rate of its group (S3: SELL_RATES in
  config: crops 0.1, seeds 0.2, wood and loot 0.3, blocks 0.3, fish and things 0.5, bars 0.5, ore 0.85, splice results 0.03 (COD-1 retune: wood and loot 0.12 so a splice material never sells for more than its starter seeds' gold); at least 1
  gold); spare clothes keep SPARE_SELL. Food, drinks (menu, lunch box), worn gear, placed items and the counter never list. Selling
  more than 5 pieces (SELL_CONFIRM_QTY), any ultra_rare or legendary thing, or a hotbar item asks first (confirmBuy). Ledger reason
  'sell' (pure rule shared/src/trader.ts; GameAPI.getSellRows / sell), gold popup, no Book find. Nothing ever sells by itself. Closed
  loops in balance.ts: ingredients sold < the dish or brew; a bought catalog block sells back for less; a pack sold back < its gems at the
  gold-per-gem floor; a splice result and its seed sold back <= the GOLD of its starter seeds (S3, strict; SG2: tested over every pair of the general rule and every special recipe, balance.test.ts group SG2); selling crops never beats guests, run gold or the mine.
- GOLD BALANCE (S3, balance.ts, `npm run simulate`): a mixed hour is about 375 gold (new), 480 (level 3), 630 (level 8); tavern guests, dungeon run gold
  and the trader are each 10% to 50% of it (now about 45% / 14% / 40%). A new game earns about 220 gold in its first 30 minutes and 460 in its
  first hour at the tavern (7 root ale per 8-minute brew, roasted turnip on the menu, 3 seats), plus a few dozen per first run. T1 keeps these numbers (the start ale is on a tap; the pour adds 0.8 s; the best kitchen lifts the guest share to 51%, cap 55% with prep tables).
- TAVERN GEM TIP (S3): a guest who did not have to call out for the order sometimes leaves a gem with the coins (GEMS.tavern chance 5% x
  TAVERN_GEM_CHANCE_MULT by the rank of the order: rare 2.5, ultra rare 5, legendary 10). Mess.gems; one tap takes coins and gem; popup.
- tavernAppeal = min(100, appeal of placed items, decor too (each type at most 3 times) + floor and wall style). It sets the guest rate.
- Guests walk 72 px/s (+-10%), at most GUEST_MAX, talk lines from shared/data/npcLines.json; behind the bar is staff only.
- Gold sinks: catalog, room upgrades (300 / 800; farm 200 / 600), potions, key (10), basic crop seeds (block and rare seeds only drop), fees.
- GEM SINK (BG8, numbers BG9): packs cost gems (config PACKS; shared/data/packs.json; pure openPack in shared/src/packs.ts):
  Random Blocks 40, Basic Seeds 30 (5 rolls each), Common Clothes 75, Rare Clothes 225 (3 rolls). Rank first (RANK_WEIGHTS times
  the pack's multiplier), then an item. A clothes piece found again is a SPARE (Player.clothingSpares), sold for baseValue *
  SPARE_SELL (0.06, COD-1 retune) gold. GEM INCOME (BG9, config GEMS + BLOCK_DROPS, targets BALANCE_TARGETS): a mixed hour gives about 55 gems
  (new player), 70 (level 3), 100 (level 8); no source over 40%; first pack about 25 min, Common Clothes about 1 h, Rare Clothes
  about 3 h at level 3. Closed loops: seed ratio of every block seed under 0.85, gold per gem through catalog blocks at least 30,
  a pack sells for less than its price, playing a pack's contents gives back at most half its price. shared/src/balance.ts (maths)
  and balance.test.ts fail when a number reopens a loop; `npm run simulate` prints the tables (NOTES BG9).
- No trading in v1. Every change to gold, gems or items goes through ONE function (ledger.ts
  applyChange) and is written to the ledger.

10. DUNGEON
- Real-time, click-driven, same top-down view. One pure function step(run, inputs, dtMs, rng) in
  fixed 100 ms ticks (deterministic; the server runs it later). No turns.
- Tap the floor = walk; tap an enemy = walk next to it and hit: one hit per tap, 350 ms cooldown,
  no auto-attack. Potion: button or Q. Food: button or E.
- Floors: 40x40 blocks of 32 px from an integer seed. Theme v1: Crypt. LAYOUT (DG1, owner 16 Nov): rooms are templates (rectangle, cross, L, cut-corner, pillared hall, alcove hall, ring, arena; data in shared/data/dungeonRooms.json) of 4 to 8 blocks on a jittered 3x3 grid of zones, joined door to door by corridors of at most DUNGEON_CORRIDOR_MAX (5) blocks, with at least one loop when there are 4 or more rooms. Every floor has side nooks, 1 to 2 dead-end secrets, a vault nook, one landmark and set pieces (dungeonThemes.json); a BEAT (enemy, chest, prop or landmark) lies within PACE_GAP_BLOCKS (7) blocks of every point of the main route. DG-P (17 Nov): SOLID PROPS (data dungeonThemes.json solidProps: barrels, crates, shelves, statues, stands, braziers, sarcophagi, fountain) block walking and enemies on their one anchor block (DecorProp.solid, dungeonNavGrid), never on the main route or next to a door, and the floor stays one piece; other props (bones, rubble, webs, candles) stay walk-over decor. GATES (kind gate_arch + vault_arch): a passable upright arch on a door block with walls west and east, drawn in the depth-sorted list (lintel over the avatar going through), seeded hash, max 3 per floor. Chest counts, enemy counts, loot tables and the 100 ms tick are unchanged. The mine keeps its old layout. DUNGEON_ROUND in config:
  round 1 (default) = 1 floor, 3-4 rooms, slimes only; round 2 = 3 floors, 5-8 rooms, all
  enemies, mimics, the Bone King. Both are implemented. "Rooms" means main rooms (nooks, secrets and vaults do not count).
- Player 30 hp, attack 4-6, 80 px/s. Enemy stats are in config ENEMIES. Enemies chase within
  192 px, attack with a 300 ms wind-up, and miss if the player is over 48 px away at its end.
- Run bag: 12 slots (materials stack to 10). At the exit: Go deeper or Leave (banks the bag).
  Death loses the bag and half the run gold; wallet gold and xp are never lost. A run costs a 10
  gold key (free under 10 gold). Stairs heal 30%.
- Loot tables are data (shared/data/loot.json). A roll picks a rank first (RANK_WEIGHTS 75 / 20 /
  4.5 / 0.5 %, times the table's rankMultiplier), then a drop of that rank. Each kill gives xp
  and a 10% chance of a drop from the enemy's own table.
- Levels 1 to 8 (shared/data/levels.json): +3 max hp per level, +1 attack per even level. Crypt
  furniture and styles are crafted (shared/data/recipes.json), never in the catalog.
- THE BOOK: everything ever found (grey "???" until seen); 25 / 50 / 75 / 100% of a tab gives gold.

10b. FARM
- Outdoor room (kind 'farm', 3 levels, open from the start), FREE-FORM since BG6: no fixed plots and, since K1, nothing
  fixed at all (the cooking pot is gone). SOIL = floor cells painted 'soil' (new farm: a 6 x 2 patch; the player paints
  or removes soil for free, Room > Paint soil). Soil is for FOOD crops: every other seed (block, ore, drink, furniture, clothing, style) is planted on any BLOCK cell
  (the block stays, the plant sits on its top face) in hotel, tavern and farm; food crop seeds need a soil cell or a block with soilHost (dirt, rich soil); PLANTS_ROOM_CAP
  limits plants per room (farm 80, hotel 16, tavern 8) (SG4). Every block and every crop has a SEED item (`<block>_seed`,
  crops.json seeds, icon = the seed shape in its colours). Select a seed, tap a soil cell or a block cell in reach (BLOCK_REACH):
  one plant per cell (a plant on soil blocks the cell like a small block; on a block it adds nothing; a block with a plant cannot be punched: a punch harvests a ripe plant, else it shakes). It grows in 3 stages (sprout, small, full) in real
  time, also while the game is closed (SEED_GROW_MS by rank: common 2 min, rare 20 min, ultra_rare 3 h,
  legendary 12 h; no watering, no rotting). Harvest = PUNCH the full plant (one hit, hold works): SEED_YIELD
  blocks or crops by rank (1 to 4), SEED_BACK_CHANCE for the seed, gemDrop 'harvest'. An unripe plant only shakes
  and says when it is ready. Basic crop seeds are sold (gold); block seeds and rarer ones come from drops.
  SPLICING (BG7): with a seed selected, tap a young plant: the second seed goes in and the cell grows the pair's
  NEW seed (any seed with almost any other, SG1: the GENERAL RULE shared/src/spliceRule.ts, a pure hash of the sorted pair key into result pools by category and rank, plus the hand-authored
  SPECIAL recipes in shared/data/splice.json which win; order free, no random failure; the same seed twice, a legendary seed or a noSplice seed = "nothing happens", nothing taken; 2 seeds in, 1 out) for the longer grow time + SPLICE_BONUS_MS. Harvest gives the new seed (+ a small
  chance of a block or crop, gems 'splice'); results grow blocks, crops, drinks, furniture or clothes (ore and styles come with SG3).
  Paths and fences are blocks. Hold to repeat: see INPUT.
- COOKING (K1, owner 15 Nov) happens in the TAVERN, never in the farm: a STOVE (furniture 'stove', 1 cell, light, placeIn
  'shop', common, in the catalog; a new game starts with one a few cells from the bar, COD-1 f: bar, taps and kitchen are spaced apart in the starter tavern) cooks ONE batch at a time: 1 to STOVE_BATCH_MAX
  (4) dishes of one recipe (+ the T1 prep bonus up to +2 from prep tables in the kitchen zone next to it) (shared/data/food.json, cookMs per batch; config COOK_MS = the default by rank; turnip roast 20 s,
  stew 1 min, rarer up to 5 min; the first dish is ready within 30 s). Inputs go in (ledger 'cook'), the batch cooks in real
  time also while the game is closed (TavernState.cooks, time passed in), and the player TAPS the stove to collect (a popup).
  Nothing is collected by itself, no burnt food. More stoves = more batches in parallel. Tap a stove in play mode: the avatar
  walks next to it, then a ready batch is collected, else the Cooking panel opens. Dishes: the lunch box (up to 3 into the
  dungeon; lost on death), the tavern menu. Crops come from the bag.

10c. MINE
- Opens at player level 3. A dungeon-code visit (place 'mine'): free, 4 minutes of lantern,
  rocks (copper 3 hits, iron 5, mithril 8 from visit 5) in place of chests, 400 ms pickaxe
  cooldown, a few weak enemies; 0 hp = carried out, half the visit's ore lost.
- Forge: 3 ore -> 1 bar for a fee; bars make swords (copper 5-7, iron 7-9, mithril 9-12), armor
  (-1 / -2 / -3 damage), the steel pickaxe, the steel axe and fishing rods
  (shared/data/forge.json). Each piece replaces the one before. Gold only buys potions.

10d. LAKESIDE
- Outdoor room (kind 'lakeside', one level, open from the start, not buildable): lake, pier, 8
  trees. Woodcutting: tap a tree, 5 hits, 400 ms cooldown, 2-3 wood plus a ranked drop; it grows
  back in 5 minutes of real time.
- Fishing: tap the water to cast, tap in time at the "!", then THE REEL: hold to push the catch
  box right, it falls back left; keep the fish inside to fill the catch bar. Rank sets the
  difficulty; better rods help. All timing in one pure step function (50 ms ticks,
  shared/src/fishing.ts). Catches: shared/data/fish.json. Lake furniture is crafted.

11. NETWORK (step 10 onward)
- WebSocket, JSON messages { t: string, ... }; HTTP for register, login, catalog; SQLite (lists:
  docs/BRIEF.md 11). The server validates everything (ownership, coordinates, ranges, chat max
  120 characters, 10 messages per second) and sends a full path once; clients animate it.

12. ART
- Every object shows its top and its front. Look: a cozy medieval tavern (docs/mood.png is a mood
  reference, never something to copy): warm wood browns, orange candlelight, deep red and green,
  many small props, dark warm outlines. The crypt is the opposite: cool and dark, few warm lights.
- Palette: Endesga 32; the hex list lives only in shared/palette.ts. Light from the top-left. 1 px
  dark outline. No anti-aliasing. Nearest-neighbour scaling only.
- Sprite sizes: docs/BRIEF.md 12 (avatar 32x64, floor texture 64x64, blocks and icons 32x32).
  Anchor = bottom center of the footprint. Art is code-drawn boxes (the fallback) or Aseprite PNGs per piece (docs/PLAN-SPRITES.md, docs/ART-STYLE.md).
  ITEM ICONS: every item has data icon { shape, colors } (palette NAMES); render/drawIcon.ts draws it.
- UI: HTML/CSS over the canvas, local open-license pixel font. Layout, frame style and patterns
  are in docs/UI-REFERENCE.md: read it before any step that adds or changes UI.

13. SAFETY AND PRIVACY
- Accounts: username and password only. No email, real name or birthday (so no password reset by
  email; an admin can set a new one). Ages 13 and up: one checkbox, no other age data.
- Chat: public in the room only, word filter, report button, per-player mute, rate limits. No
  private messages, no friend requests in v1. Room owners can set a room to private. No real-money
  purchases. No loot boxes in the usual sense; the ONE random thing you pay for is a PACK (BG8), and only
  under these FAIRNESS RULES: gems are earned in play only, never bought with money; the contents and
  the rank odds are shown on the pack card before buying; duplicates are allowed (extra copies are spares,
  sellable); no timers, limited offers or daily tricks that push buying. The first release is a small private test.

14. WORKING RULES FOR YOU (the AI)
- NEWS: at the start read the top of docs/NEWS.md; at the end of every batch add a 1 to 3 line entry on top (format in the file).
- Do one step at a time. Do not build things from later steps. Keep files small and named by
  purpose. Constants go in shared/config.ts, not in code.
- The order of work is docs/ROADMAP.md. Step prompts are in docs/NEXT-STEPS.md. Details of
  earlier steps are in docs/NOTES.md: read the part you need, not the whole file. After each
  step, tick it in docs/ROADMAP.md.
- If a request conflicts with this brief, tell me and ask. Do not silently change the brief. If I
  paste an error, find the cause first, then fix it. Do not rewrite unrelated code.
- Before coding a step, write a short plan (files and order) in at most 8 lines. Write the tests
  for the rules first or together with them. Before you say a step is done: run the full test
  suite and the type check, then tell me how to run the game and what to try by hand.
- Before writing a system yourself (hit testing, sprite sheets, a ticker, path helpers), check
  whether PixiJS or another library we already use does it. If so, use it and tell me.
- At the end of each step: update CURRENT STATE below (at most 15 lines) and any rule that
  changed (here and in docs/BRIEF.md); put new files, conventions and measurements in
  docs/NOTES.md under the right heading. Keep this file under 250 lines.
- Art tools: only the Aseprite plugin (owner approved 15 Nov, docs/PLAN-SPRITES.md); no other art generation unless I ask.
- I work with Claude Code on my phone or PC. Every push to main is deployed by GitHub Pages
  (https://bithus.github.io/PIXEL-HOTEL/). Commit and push at the end of every step.

CURRENT STATE (at most 15 lines; updated by the AI at the end of each step; the live task list is docs/TEAM.md START HERE + docs/QUEUE.md)
- Done (17 Nov 2026): the game loops (hotel, tavern with taps/register/kitchen/casks, dungeon, farm, mine, lakeside), blocks and seeds, gems and packs, the One Inn doors (suite, tavern, garden),
  hats and emotes, usable furniture and the cat rules (cat not drawn yet), room stars, first-steps guide v2 (data shared/data/guide.json, animated pointer, ready dots, one-time hint chip, replay in Settings), stacked blocks (max 3), planting on a block with a tap (SG4b), hands-on tap pouring (hold, perfect-window tip, tap the guest), hold/drag walking in
  the dungeon, 70+ furniture (5 medieval pieces added), the outdoors rework (crypt and lakeside art, fx module, light layer, lakeside life), the UI skin (client/src/ui/skin.css), 63+ redrawn icons.
- Art direction (owner): cozy MEDIEVAL pixel look like Travellers Rest, original only: docs/ART-STYLE.md, PIXEL-ART-GUIDE.md, ART-REDO.md, PLAN-CHARACTERS.md (cosy three-head avatar, layers in
  client/src/assets/sprites/avatar, rig data shared/data/avatarRig.json and ramps.json), PLAN-UI.md, PLAN-REWORK-OUTDOORS.md; research: RESEARCH-GAMES.md and RESEARCH-DEEP.md.
- In progress: C18 layered avatar renderer (box avatar stays as fallback), avatar sit frames and more clothes, UI round 4 (title screen, pour bar, icons), furniture and item icon rounds, tester run 2 fixes
  (docs/FIXLIST.md), SG3d/SG5/SG6, ST2 stack look. Owner decisions open: the avatar style lock, pushing is done only when the owner says so.
- Not done: step 10 (server, a placeholder), cat art, renown/regulars (tavern deep). The game has been run in a browser (Playwright e2e and tester runs); the avatar style lock is still the owner's.
- DUNGEON_ROUND is 1. SAVE_VERSION is 36 (36 the attached kitchen and cellar rooms, 35 room kinds kitchen and cellar, 34 ledger folds into quests.folded counters past 2500 entries, 33 quests.claimed for daily quests and achievements, 24 taps+register, 25 Inn name, 26 casks, 27 Inn doors, 28 usable pieces and the cat, 29 held mug perfect pour, 30 plants on blocks, 31 the waiter tray replaces holding, 32 stacked blocks: Room.blocks per cell is an array). LocalGameAPI only. The indoor lighting look is approved: keep it.

FILE MAP (one line per folder; file-by-file lists are in docs/NOTES.md)
- Root: npm scripts dev, build, test, typecheck, e2e (Playwright smoke, e2e/), simulate, simulate:dungeon. Vite base stays './'.
- shared/src: all rules (pure), config.ts (re-exports config/*.ts: the constants by topic; tavern numbers stay in config.ts), types.ts, api.ts (GameAPI), spliceRule.ts + seedCategory.ts (general splice rule),
  palette.ts, save.ts (migrations); shared/src/dungeon: run, step, generate (crypt -> layout.ts; mine -> legacyLayout.ts), layout, rooms, themes, pacing, layoutCommon, loot, bank.
- shared/data: JSON data (furniture, materials, styles, roomShapes, clothing, loot, levels, gear,
  forge, recipes, crops, food, fish, npcLines, bookRewards, splice, spliceSeeds, spliceRules).
- client/src: main.ts (only wiring: start() runs the parts in game/ in order), game/ (one part per area:
  core, avatarWalk, roomItems, uiShell, cameraSetup, placing, shopPanels, craftPanels, placeLife, tavernLife,
  hotbarBag, settingsPanels, dungeonMode, roomFlow, blockInput, pointerInput, gameLoop; ctx.ts = shared state
  `st`, late-bound functions `late`, and the types), api/ (localGameAPI.ts = the class; walkApi, roomsApi, catalogApi,
  blocksFarmApi, dungeonApi, lakesideApi, packsApi, progressApi, tavernApi, savesApi = one area each; apiShared.ts;
  storage, prefs), render/ (room, items, avatars, atmosphere), input/ (camera control, intro), ui/ (HTML panels,
  ui.css), build/ (placer), dungeon/, farm/, lakeside/, audio/, debug/, fonts/, assets/.
- tools/: simulate-economy.ts, simulate-dungeon.ts. docs/: BRIEF, NOTES, ROADMAP, NEXT-STEPS,
  UI-REFERENCE. Tests are *.test.ts next to the code. Imports use the .ts extension.

CONVENTIONS EVERY SESSION NEEDS (full text and the reasons: docs/NOTES.md)
- UI LAYOUT: the room fills the screen; UI sits on top at the edges, never in solid bars. One
  frame style (client/src/ui/ui.css, docs/UI-REFERENCE.md section 3); touch size at least 44 px;
  never set a font-family without var(--font). Info panel top-left; right edge = one column of
  icon buttons (Quest, Map, Catalog, Build, Dungeon, More); hotbar bottom-center with the Bag
  button at its right end; side panels built with ui/panelShell.ts, one open at a time, ending
  above the hotbar; toasts above the hotbar; debug tools only while Settings -> Debug is on. A new
  screen = a button in ui/sideButtons.ts plus a panel. Every buy asks first (ui/confirmBuy.ts).
  Texts stay at reading pace (shared/src/text.ts readingMs).
- INPUT: a press is a TAP only if it moved under 8 px and lasted under 300 ms; else a drag or
  long press, which never walks or punches. PLAY MODE: with a block selected in the hotbar a tap on
  a free cell places it; a tap on a block punches it (with a block selected and room on the stack, a tap STACKS it on top and a hold punches; seeds on a block plant); any other tap
  walks, sits, or uses a thing. Farther than BLOCK_REACH: the avatar walks closer first. HOLD TO
  REPEAT (BG5b): a press on a block, a plant, a mine rock or a tree hits at once and keeps hitting at that
  thing's cooldown (blocks 250 ms, rock and tree 400 ms) until it breaks, the press ends or the avatar is out of
  reach (it walks closer, then goes on); sliding the finger while holding never pans: it moves on to the next block, plant, rock or tree under it (also after one broke) without lifting; two fingers never hit. With a block
  selected, holding still 300 ms on free floor places blocks, dragging then makes a line (one per cell, in reach,
  the usual rules). NOT for fishing. Dungeon fight: hits stay ONE per tap (no hold-to-hit, no auto-attack); only mine rocks repeat. HOLD TO WALK (OA-1): a press on free floor (no item under it, no block selected, no panel, not build/paint) starts walking to the pointer AT ONCE, no wait, and follows it while the press lasts (re-paths when the pointer changes cell); a quick drag (moved 8 px within 300 ms) still pans in rooms and cancels that walk (shared/src/hold.ts earlyWalkNext); after 300 ms moving steers and never pans; a tap works as before. DUNGEON: the camera follows the avatar, so a hold OR a drag steers the walk toward the pointer (re-path per 16 px cell, shared/src/hold.ts steerCellChange; on an enemy it only walks, never hits; two fingers do nothing). Pure helper
  shared/src/hold.ts holdTick; the client only feeds pointer events. BUILD MODE (Build
  button or B; furniture only): taps never walk; a drag on an item moves it, a tap selects it (menu: Rotate, Pick
  up), a tap on a free spot moves the selected item there. PAINT MODE (Room > Paint cells): tap =
  one cell, drag = rectangle. One finger pans, two fingers pinch-zoom, the wheel zooms. A tap on
  the room with a panel open only closes the panel. Escape closes a panel, then placing or
  painting, then build mode, then puts a selected block away.
- GAME API: the client changes nothing itself; every action goes through GameAPI and the client
  draws what comes back (null = refused). LocalGameAPI also runs the shop clock (stepShop every
  100 ms) and the dungeon run.
- SAVING: LocalGameAPI writes the whole GameState after every change to localStorage as
  { version, savedAt, state }, plus one automatic backup. When the GameState shape changes: bump
  SAVE_VERSION (now 36) and add MIGRATIONS[old] in shared/src/save.ts, with a test. Device
  settings (sound, lighting, grid) live in prefs, not in the GameState.
- NAVIGATION: shared/src/nav.ts; cells are BUILD_CELL (32 px); a cell is free only if all of it is
  on the floor and no blocker touches it. Use roomBlockers(room, items) for room grids. Guests
  use npcGrid (shared/src/npcNav.ts; staff zone blocked). The dungeon has its own grid
  (16 px cells, no radius). When blockers change, the grid is rebuilt and walkers re-path.
- Camera state is unsnapped and clamped; drawing and hit testing use snapCamera(camera, dpr). In
  main.ts use syncItems (not itemViews.sync alone), so lights and shadows follow.
