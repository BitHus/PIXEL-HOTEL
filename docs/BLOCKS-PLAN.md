# BLOCKS-PLAN: the block world change (owner's request, 15 Nov)

Status: PLANNED, not built. Written by the planner session. Code is done by later sessions, one
step at a time (steps BG1 to BG9, prompts in docs/NEXT-STEPS.md, order in docs/ROADMAP.md).
Nothing here changes CLAUDE.md until the step that builds it says so.

## 1. What the owner asked for

1. Study Growtopia and Pixel Worlds next to Travellers Rest and Habbo. Good examples, also for the
   social side.
2. Seeds and packs like Growtopia: seeds can be combined (spliced) into new items.
3. Gems: a second currency you get from everything you do.
4. Farming by placing and punching blocks.
5. Packs you buy with gems: random blocks pack, rare clothes pack, common clothes pack.
6. Building goes PER CELL (grid): easier for floors, placing, pathfinding, walls.
7. Food, ores, fish and all other items are squares: rough shapes and colours per item.
8. When you open a chest, kill an enemy or catch a fish, the items you get float above the avatar's
   head for a moment, so you see what you got without reading.

## 2. What the games do (research, 15 Nov; fan wikis and store pages, numbers unchecked)

Growtopia (Ubisoft): a 2D block world. Everyone has worlds with a name; you visit by typing it.
- Punch a block, it breaks after N hits. Breaking drops blocks, SEEDS (about 1 in 5), and GEMS.
- Plant a seed in a cell: the tree grows in real time (rarer = longer), punch it to harvest
  blocks, seeds and gems. Farming is the main loop.
- SPLICING: plant two different seeds in the same cell, a new seed comes out (a fixed table).
- Gems: the soft currency, dropped by nearly everything, NOT tradable. The tradable currency is the
  World Lock (a rare item), so players trade with it.
- World Lock: claims a world; owner decides who may build or break (access list), public or not.
- Social: chat bubbles, signs, doors and portals to other worlds, vending machines (player
  shops), friends, guilds, trading, broadcasts, events. Known problem: scams around trading
  and access to worlds.
Pixel Worlds (Kukouri): the same idea. Free "newbie" lock at the start, a lock needs a level,
small / medium / large locks cover areas, quests give xp + gems + items, fishing tournaments give
gems, almost everything can be crossbred. Player-run economy, worlds can be traded.
Travellers Rest / Habbo: rooms, avatars, furniture, a social place (already our base).

TAKE: block grid, break by hits, seeds + real-time growth, splicing, gems from everything,
packs bought with gems, locks and access lists, visit-by-name, signs, a small lobby.
LEAVE OUT: real-money gems, tradable gems, gambling-like odds that are hidden, free-for-all
building in other people's rooms, player-to-player trading in v1 (see section 13 of the brief).
Our own twist stays: a TAVERN to run, a DUNGEON, a MINE, a LAKE. Gems and blocks plug into those.
Everything stays original (names, art); no Growtopia item names or splice recipes copied.

## 3. The design

### 3.1 The cell grid (BG1)
- BUILD_CELL = 32 px (config). Why 32: dungeon blocks are 32 already, icons are 32x32, the avatar
  is 32 wide (1 cell wide, 2 cells high), the 64 px wall band = 2 cells, the 64 px door = 2 cells,
  floor texture 64x64 = 2x2 cells. The old 16 px and 4 px snapping go away.
- Rooms are cell maps. Room shapes in roomShapes.json become cell rectangles (the 16 px aligned
  numbers are converted: round up to whole cells; the owner checks the shapes on screen).
- Furniture: footprint in whole cells (w x d), anchor = the cell at the bottom centre
  (even widths: the left of the two centre cells). Rotation swaps w and d. WALL ITEMS STAY FREE
  (owner, 15 Nov: walls are freely placeable in every game): they slide along the back wall
  band at any x and y inside the band, snapped to 4 px (Shift = no snap), never to cells; they only
  must stay inside the band and not overlap the door. Only floor things go per cell. onSurface items stay (one level, on a surface item). Rugs and floor decor live on the
  BACKGROUND layer (can overlap, never block). Draw order stays: floor, rugs, back wall, items and
  avatars sorted by y, x, uid.
- Floor styles per cell: paint one cell or a rectangle (drag). Wall styles stay per wall segment. A style is still
  unlocked forever once owned.
- Navigation: the nav grid IS the build grid (one cell = 32 px, 8 directions, no corner cutting,
  smoothing stays). Blockers are whole cells, so no AVATAR_RADIUS growing. Avatars still move in
  pixels between cell centres, speed unchanged. The dungeon keeps its own 16 px grid.
- Door zone: 2 x 2 cells under the door stay free. "The door still reaches the middle" stays.
- Migration: every placed item is moved to the nearest valid cell footprint; items that no longer
  fit go back to the bag (a toast says so). SAVE_VERSION bump with a test.

### 3.2 Items are squares (BG2)
- Every item in materials, food, fish, ore, bars, crops, seeds, blocks gets an `icon` in its data:
  { shape, colors[] } with a SHAPE from a small fixed list drawn in code on a 32x32 square
  (ore chunk, bar, fish, leaf, mushroom, log, potion bottle, bread, mug, gem, seed, block, cloth,
  bone, boot, key, ...). Colours from the Endesga 32 palette (shared/palette.ts). Rank colour
  frame as now. One function drawIcon(shape, colors) in client/src/render, used by every panel,
  slot, drop and popup. A test checks that every item id has an icon.
- These are the rough placeholders. Real pixel art comes in phase 4 and replaces drawIcon per item.

### 3.3 Gain popups above the head (BG3)
- Every GameAPI call that gives items or gems returns a list `gains: { itemId, count, rank }[]`
  (and gems). The client shows them as small icons with "x3" floating above the avatar's head for
  about 1.2 s, stacked in a row (max 5 at once, the rest queue), rank-coloured, a sparkle for
  ultra_rare and legendary. Works for: chest, kill, fish catch, harvest, block break, pack
  opening, quest claim, crafting, buying. Works in the dungeon and in rooms.
- Rendering only; the numbers come from the API result. Never read a text to know what you got.
  Setting "Popups: on / off" in Settings.

### 3.4 Gems (BG4)
- A second currency, `gems` (integer). Gold stays: it is the tavern money (guests pay gold, rooms
  upgrade for gold, catalog furniture costs gold). Gems are the "play" money: you get them from
  everything, you spend them on packs and seeds. Gems cannot be traded and are never sold.
- Faucets (all in config GEMS): breaking a block, harvesting a tree, killing an enemy, opening a
  chest, mining a rock, chopping a tree, catching a fish, finishing a quest, Book rewards. Rank
  raises the amount. Pure function gemDrop(source, rank, rng).
- Gem drops appear as small gems on the floor next to the thing; they fly to the avatar when it
  is near (walk over or tap), no menu. Everything goes through ledger.applyChange (gems added as
  a new ledger currency). Info panel shows gems next to gold.
- No real money, ever. No gem shop for money. (Brief section 13 stays.)

### 3.5 Blocks and punching (BG5)
- A block is an item you place in one cell of the foreground layer: dirt, stone, wood plank,
  glass, lantern block... from data (shared/data/blocks.json: id, hardness = hits to break, rank,
  drops, seedId, placeIn). Placing: select in the hotbar, tap a free cell next to you (reach
  limit of 3 cells, config). Breaking: tap a block, one hit per tap (cooldown 250 ms), N hits,
  it drops itself back, a seed sometimes, gems sometimes.
- Build mode is replaced: PLAY MODE places and punches blocks directly (the Growtopia feel);
  furniture is still moved in a Furniture mode (Build button) because furniture is bigger
  than one cell. Details are decided in BG5 with the owner on a phone.
- Locks: a room always belongs to its owner; only the owner builds or breaks. The "access list"
  and visitors building come with online (phase 6).

### 3.6 Seeds and farming (BG6)
- Every block and crop item can have a seed. A seed is planted in a free cell of a farm room
  (any cell with soil style, not only the fixed plots). It grows in real time in 3 stages
  (also while the game is closed; time is passed in, as now). Growth time by rank
  (config SEED_GROW_MS). Harvest = punch the grown tree: 1-4 blocks or crops, a chance for a new
  seed, a chance for gems. An unharvested tree stays ready. No watering (stays).
- The old farm (12 fixed plots, crops.json, the cooking pot) migrates: crops become seeds in the
  new system, existing plots become soil cells, planted crops keep their progress. Food and
  cooking stay as they are (crops are still the cooking and brewing ingredients).
- The farm room is now free-form: the player builds paths and fences with blocks.

### 3.7 Splicing (BG7)
- Plant two different seeds in the same cell (one after the other, or the "Splice" action on
  a planted seed): after the growth time a NEW seed grows from a fixed table (shared/data/splice.json:
  { a, b, result }, order does not matter). No random failure; a wrong pair says "nothing
  happens" and returns the seeds (no loss, no frustration). Roughly 40 recipes in the first
  version, original item names, chains of 2 to 3 steps to rarer items (a common + a common = a
  rare, and so on).
- Discovered recipes appear in a Splice tab of the Book (grey until found, hints for 1 of 2
  ingredients). Splice results can be furniture seeds (a tree that grows a table), clothes
  seeds, tavern goods, so farming feeds everything else.

### 3.8 Packs (BG8)
- A Packs panel (button in the right column, or a tab in the Catalog): each pack costs gems
  (config PACKS) and has VISIBLE contents and odds on its card. Packs in v1:
  Random Blocks Pack, Basic Seeds Pack, Common Clothes Pack, Rare Clothes Pack, and later a
  Furniture Pack and a Dye Pack. Data: shared/data/packs.json: { id, name, gemPrice, rolls,
  pool, rankWeights }. Pure function openPack(state, packId, rng).
- Opening: confirm first (ui/confirmBuy.ts), then the pack opens with a short pop and the
  items float above the head (3.3) and land in the bag.
- Fairness rules (this is why it is not a loot box in the brief's sense, see section 5):
  gems are earned in play only, odds are shown, clothes packs only roll pieces you do NOT own yet
  until the category is complete (then gems back), no daily limit tricks, no timers that push.
- Clothes are unlocked forever (as now); packs are one of several ways to get them.

### 3.9 Social (phase 6 additions)
From Growtopia and Pixel Worlds, to build when the server exists (docs/ROADMAP.md phase 6):
- Rooms have a NAME and an address: type a name to visit it; a lobby (town square) lists
  public rooms, new rooms, the most liked.
- Room lock states: open, friends only, private; an access list per room (visitor, builder,
  admin); a builder can place and break there (that is the Growtopia world-lock idea, but
  our rooms always belong to one owner).
- Signs and a notice board; doors and portals between your rooms; the tavern bar can serve real
  players (guests become players); like / rate a room; emotes and name tags (9g).
- Later and only with new safety rules: friends list, guilds, trading, a player market, vending
  machines. Gems stay untradable; the safe trade window must show both sides and need two
  confirmations (the scam problem in the research).

## 4. Conflicts with CLAUDE.md (the owner decides; the planner's advice in brackets)

| # | Brief rule | Change | Advice |
|---|-----------|--------|--------|
| 1 | Sec 4, 7: "No tile grid in rooms", free placement snapped to 4 px | Cell grid of 32 px | DECIDED by the owner (15 Nov). Update 4, 5, 6, 7 in BG1. |
| 2 | Sec 9: one currency, gold | Add gems (second currency) | Accepted as asked. Keep gold for the tavern (3.4). |
| 3 | Sec 13: no loot boxes | Random packs for gems | Accept ONLY with the fairness rules in 3.8 (earned gems, odds shown, no repeats of owned clothes). Owner confirms before BG8. |
| 4 | Sec 7/12: items are art drawn later | Icons from code shapes | No conflict (placeholders in code). |
| 5 | Sec 9: "No trading in v1" | Not changed | Gems stay untradable; trading stays phase 6+. |
| 6 | Tavern step 9t, hotel step 9g | They use free placement and seat adjacency | PAUSE 9t B/C and 9g until BG1 is done, then build them on the grid (cheaper than building twice). |

## 5. Open questions for the owner (answer when a step starts)
a. Is 32 px the right cell? (Advice: yes. Smaller = more fiddly on a phone.)
b. Does PLAY MODE place and punch blocks directly (Growtopia), or stay a Build mode toggle?
   (Advice: direct in the farm and block rooms; the hotel keeps a Furniture mode.)
c. Do gems also drop in the hotel room, or only in farm, dungeon, mine, lake? (Advice: also from
   punching blocks anywhere you may build.)
d. Which rooms may have blocks: all, or only a new "Workshop" and the farm? (Advice: all rooms
   have the cell grid; blocks are placed in all of them; the hotel keeps its furniture focus.)

## 6. Step list (the order is in docs/ROADMAP.md)
BG1 cell grid and per-cell floors and walls and nav. BG2 item icons. BG3 gain popups. BG4 gems.
BG5 blocks and punching. BG6 seeds and the free-form farm. BG7 splicing and the Splice book.
BG8 packs. BG9 balance and the economy tool (gems in, gems out, packs). Then 9t B/C and 9g on the
grid. Social is phase 6.
Each step: plan max 8 lines, tests first, SAVE_VERSION migration, typecheck + tests, update
CLAUDE.md, BRIEF.md, NOTES.md, ROADMAP, commit and push.
