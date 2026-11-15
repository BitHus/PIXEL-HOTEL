# BRIEF (the full text)

The full project brief, sections 1 to 14, with every number and flow. CLAUDE.md holds the short
form that every session reads; this file is the long form. Read the section you need. Fixed
decisions: do not change them unless the owner says so, and when a decision changes, change it
here and in CLAUDE.md.

1. WHAT WE ARE BUILDING
A browser game with these parts:
- Hotel: top-down pixel-art rooms in the style of Travellers Rest (you look down at the room
  with a slight front angle, you see the top and front of things). Players walk around as an
  avatar, chat in bubbles, and build per cell on a 32 px grid (step BG1, owner's decision 15 Nov;
  wall items stay free along the back wall).
- Dungeon: a random real-time dungeon where clicking fast is the game. Loot comes from
  chests. Enemies are the danger: they give xp (the player levels up) and rarely a special
  drop.
- Shop: each player has a shop room. They put loot on shelves and set prices. NPC customers
  walk in and buy for gold. Gold buys furniture in the catalog.
- Farm (section 10b, steps 9b, BG6): a free-form outdoor room where the player plants seeds on soil,
  harvests by punching, and cooks crops into food that heals or buffs them in the dungeon.
- Mine (section 10c, step 9c): a short click-to-mine trip for ore. Ore is smelted into bars
  at the forge, and bars upgrade weapons, armor and the pickaxe.
- Lakeside (section 10d, step 9f): an outdoor place with a lake: chop trees for wood and fish
  in the lake. Fish are food for the shop and the pot; bars also make an axe and fishing rods.
The loop: dungeon (loot) -> shop (gold) -> furniture; farm (food) -> stronger dungeon runs;
mine (ore) -> better gear -> deeper dungeon runs.
Every player starts with two small, basic rooms: a hotel room and a shop. They sell loot in
the shop for gold, and use the gold to buy furniture for the hotel room or the shop, and to
upgrade the rooms.
Working title: Pixel Hotel (placeholder). Before any public release we pick a real, original
name.
Original names, art and assets only. Never copy Habbo, Travellers Rest or any other game.

2. STACK (do not change)
- TypeScript everywhere. npm workspaces: client/, server/, shared/.
- client: Vite + PixiJS (current stable version) for the game view. Plain HTML/CSS overlay
  for the UI.
- server (added in step 10): Node.js + ws (WebSockets) + better-sqlite3 + bcryptjs.
- tests: Vitest. Every pure rule in shared/ gets tests.
- Free and open-source libraries only.
- Target: browser first, playable on desktop and on a phone. The game is built and tested in
  the browser. A Windows desktop app comes later. Keep the UI usable by touch and keep client
  code free of desktop-only APIs. Saves go through one small storage interface, so where they
  are stored can change later.

3. ARCHITECTURE RULE
- All game rules live in shared/ as pure functions on plain data. No rendering, no network,
  and no Date.now or Math.random inside rules: time and rng are passed in.
- The client talks only to the GameAPI interface (shared/api.ts). Steps 2 to 9 use
  LocalGameAPI, which runs the shared rules inside the browser and saves to localStorage.
  Step 10 adds RemoteGameAPI, which sends the same actions to the server. The server is
  authoritative: the client only sends requests.
- Rendering code (client/src/render) never contains game rules.

4. WORLD AND SCREEN MATH
- Top-down view with a slight front angle. World coordinates are pixels: x to the right, y
  down. 1 world pixel = 1 art pixel. There is no isometric math.
- screenToWorld(p) = p / zoom + camera, worldToScreen(p) = (p - camera) * zoom. Camera
  position is in world pixels. Zoom is free: any number from 0.5 to 4 (ZOOM_MIN, ZOOM_MAX),
  set by pinch or the mouse wheel, like in most games. Zooming stays smooth
  while the gesture is active. When the gesture ends, the zoom eases over 0.15 s
  (ZOOM_SETTLE_MS) to the nearest zoom where zoom * window.devicePixelRatio is a whole
  number (so one art pixel always covers a whole number of real screen pixels: whole zooms
  on a normal monitor, steps of 1/3 on a phone with ratio 3), or to the overview zoom if
  that is closer, and the camera snaps to whole device pixels. The canvas renders at the
  full devicePixelRatio. The default (overview) zoom is the
  largest one where the whole room fits on screen, and at least 0.5. If the room does not
  fit at zoom 0.5, the camera follows the avatar and the player can pan.
- Camera intro: when a room opens, the camera starts at the overview zoom, waits 0.6 s
  (INTRO_WAIT_MS), then zooms in smoothly over 0.8 s (INTRO_ZOOM_MS) to the settled zoom
  (the zooms above where zoom * devicePixelRatio is whole) nearest to 3 real pixels per art
  pixel (INTRO_DEVICE_PX_PER_ART_PX), ending centered on the avatar. A tap, a drag, a pinch or
  the wheel during the intro skips it (the camera stays where it is).
- BUILD GRID (step BG1): rooms are cell maps of BUILD_CELL = 32 px. Floor furniture, floor
  paint and navigation use it (sections 5, 6, 7); wall items stay free. The grid is drawn faintly
  only while placing furniture or painting floors (a Settings toggle, pref cellGrid). Avatars
  still move in pixels between cell centres. The dungeon keeps its own grids (32 px blocks,
  16 px nav cells; section 10).
- Pixel-perfect: no texture smoothing, and sprites are drawn at whole world pixels. At a zoom
  that is not a whole number some art pixels are 1 screen px wider than others, and below
  zoom 1 some art pixels are skipped; that is accepted (owner's choice, step 2).
- Draw order: see section 7.

5. ROOMS
- A room is { id, kind: 'hotel' | 'shop' | 'farm' | 'lakeside', level, shape, w, h (the floor's bounding box in px),
  floorStyle, wallStyle }. Its floor is a union of rectangles (step 7b), from its shape and
  level. Shapes are data in shared/data/roomShapes.json: { id, name, kind: 'hotel'|'shop'|'both',
  levels: [ { rects: [{x, y, w, h}], door: {x} } x3 ] } (plus shopStart: where a new shop's
  counter and stall_table stand). Each level's floor fully contains the previous level's floor,
  so upgrades never cut off furniture. Shapes: square (the old rectangle; 'square' for the hotel,
  'square_shop' for the shop), long (narrow and long), l_shape, plus (a cross) and wide_hall
  (wide and shallow), each with 3 levels, all about the same area at level 1. The data is in whole CELLS (the old
  16 px numbers were rounded up to cells; each level still contains the previous one; the door
  is at a cell boundary).
- Walls: every floor edge that faces up gets the back wall band (WALL_BAND = 2 cells = 64 px) above it;
  all other outside edges get the thin 16 px border. Inner corners are drawn cleanly. The
  floor is a seamless repeating texture, not a tile map.
- The door is a 2-cell (64 px) wide opening in the border under a bottom edge, at the x from the
  shape data. The DOOR ZONE is the 2 x 2 cells of floor just inside it. Nothing can be
  placed on the door zone. Avatars enter and leave through it, walking up from the bottom of
  the screen.
- The player picks one shape for the hotel and one for the shop when a new game starts. Later
  a shape change could be a paid option; not now.
- Floors and walls are unlockables. Every room starts with the 'bare' floor and the 'bare'
  wall: plain, dull and a bit boring on purpose, so the first things you earn feel like
  yours. Styles are data in shared/data/styles.json: { id, kind: 'floor'|'wall', name,
  baseValue, inCatalog, appeal }. Buying (or crafting) a style unlocks it forever, and the
  player can then apply any unlocked style to any of their rooms for free, as often as they
  like. Styles: floors bare, wood_planks (baseValue 10), stone_tiles (15), red_carpet (20);
  walls bare, plaster (8), wood_panels (12), brick (15). All of those are in the catalog
  (price = baseValue * 3). Dungeon-only styles are crafted (section 10): crypt_flagstones
  (floor) and bone_wall (wall).
- Sizes: per shape and level in roomShapes.json. The squares keep the old sizes: hotel level 1
  is 576x384, level 2 is 704x480, level 3 is 832x576; shop level 1 is 576x320, level 2 is
  704x384, level 3 is 832x448.
- Every new player gets two basic rooms: a hotel room (level 1) and a shop room (level 1).
  The hotel room starts completely empty. The shop starts with a counter and one stall_table
  at fixed positions from the shop shape's data, nothing else.
- The counter (step 7): every shop has exactly one counter with a cash register (till) on top.
  It is placed at the start (near the back wall with room behind it, left of center) and can be
  moved and rotated in build mode, but never picked up or sold (FurnitureType.noPickup). The
  spot behind it (where the player serves) must stay reachable from the door: a placement that
  blocks it is refused (FurnitureType.servedFromBehind, canPlace).
- Room upgrade (costs gold): the room switches to the next level of its shape. Every item
  keeps its position. The door moves to the new level's door, and any item standing in the new
  door zone goes back to the inventory (blocks there go back to the bag too). Costs are in config.
- BLOCKS (step BG5, owner's decisions): every buildable room (hotel, shop/tavern, farm; the
  lakeside stays unbuildable) has a foreground layer Room.blocks: one block per cell
  ("col,row" -> { id, hits, hitAt }). Block types are data (shared/data/blocks.json: id, name,
  hardness = hits to break, rank, baseValue, inCatalog, drops, seedId (`<id>_seed`, BG6), placeIn,
  icon); 10 starter blocks (dirt, clay, thatch, glass, planks, lantern block, stone, brick, mossy
  stone, cinder block), hardness 1 to 8. Blocks are items: they stack in Player.materials (group
  'block'), sit in the bag and the hotbar, are found in the Book (Blocks tab) and may stand on
  shop slots. A block may never stand on the door zone, outside the floor, on a cell with floor
  furniture, on a plant or the cooking pot, on the cell of an avatar standing still, or on
  a cell that would shut the door off from the middle of the room or the shopkeeper's spot behind
  the counter (refused: 'door_blocked', 'counter_blocked'). Blocks block walking (roomBlockers);
  the grids are rebuilt and walkers and customers re-path. Only the room's owner places or breaks.
  Reach: BLOCK_REACH = 3 cells from the avatar (centre to centre); farther, the GameAPI answers
  with a walk to a spot near the cell and the client asks again on arrival. Punching: one hit
  per tap (or held: HOLD TO REPEAT, see section 6 INPUT), cooldown BLOCK_HIT_COOLDOWN_MS = 250; a block takes `hardness` hits; a half-broken
  block heals after BLOCK_HEAL_MS = 6000 without a hit; cracks are drawn per stage (rendering
  only). A broken block drops itself back to the bag (always), its seed (BLOCK_SEED_CHANCE, if it
  has a seedId), its extra drops (blocks.json drops) and sometimes gems (gemDrop('block', rank),
  config GEMS; gems in every room). Gains go through the gains list and ledger.applyChange
  ('block_place', 'block_break'). The Catalog sells dirt, planks, stone and glass (Blocks tab,
  baseValue * 3, 1 or a pack of BLOCK_PACK); the rest comes from punching and later splicing.
  Input: see CLAUDE.md INPUT (play mode places and punches; Build mode moves furniture).
  HOLD TO REPEAT (BG5b): pressing and holding on a block, a grown plant, a mine rock or a tree
  repeats the hit at that thing's cooldown (250 / 250 / 400 / 400 ms), first hit on press, until it
  breaks, the press ends, or the avatar is out of reach (it walks closer and goes on). A press that
  moves 8 px is a pan; two fingers never hit. Holding still 300 ms with a block selected places blocks;
  dragging then places a line (one per cell, HOLD_PLACE_MS = 150, only cells in reach, same rules). Not for the
  dungeon fight (one hit per tap, no auto-attack) and not for fishing.
- GEMS (BG5 started it, BG3b + BG4b finished it: sources chest, kill, mimic, boss, rock, chop, fish, harvest, block, quest, Book,
  all in config GEMS with gemDrop(source, rank, rng); in the dungeon and mine they are floor piles picked up by
  walking close (GEM_PICKUP_REACH) or by tapping; kept on Leave, half lost on death in the crypt (like gold),
  all kept in the mine): Player.wallet.gems (integer), ledger gemsDelta, shown in
  the info panel next to gold; never traded or sold. BALANCED IN BG9: blocks give few gems (common break 5% x 1 to 2, rare
  10% x 2 to 4, ultra rare 15% x 4 to 8, config BLOCK_DROPS), the seed ratio of every block seed is under 0.85, so
  place-and-punch cannot make gems or seeds for free; the cheapest gold to gems way (catalog blocks) costs about 32 gold per gem.
  Mixed play gives about 55 gems/h (new player), 70 (level 3), 100 (level 8) and no source is over 40% (NOTES BG9).
- Room ids are integers.

6. MOVEMENT
- Click the floor: the avatar walks there. Click an item with seats: it walks to the
  nearest free side of the item it can reach and sits or lies (step 5b).
- Navigation (step BG1) uses the build grid: cells of NAV_CELL = BUILD_CELL = 32 px, rebuilt when
  furniture changes. A cell is blocked if any part of it is outside the floor or a footprint of
  an item with blocks = true touches it. There is no avatar radius (AVATAR_RADIUS is gone):
  blockers are whole cells, so a gap of ONE free cell is walkable. Avatars still walk in pixels
  between cell centres at the same speed. A* with 8
  directions and no corner cutting finds a cell path. Then the path is smoothed: a waypoint
  is removed when a straight line between its neighbours does not touch a blocked cell. The
  result is a list of world points, so avatars walk in straight lines, not in grid zigzags.
- If the clicked point is blocked, walk to the nearest free cell. If nothing free is
  reachable, do nothing.
- Speed: 128 px per second in the hotel and the shop (HOTEL_WALK_SPEED), the same in every
  direction. Avatars never block each other. The facing is the dominant axis of the current
  movement: down, up, left or right.
- Paths are computed by the rules in shared/ and handled as lists of points. Clients animate
  them locally.

7. FURNITURE
FurnitureType: { id, name, category, theme, placeIn: 'hotel'|'shop'|'both', slots (shelves:
how many items it holds, else 0), appeal (shop decoration value, else 0), w, d (footprint on
the floor in px), height (px, for drawing only), blocks (blocks walking), sittable, surface
(true if small items can stand on top), onSurface (true if it can stand on a surface), wall
(hangs on the back wall), facings: ('down'|'right'|'up'|'left')[], standPoint: { dx, dy }
(where a customer stands, relative to the item's anchor, default 0, 24), baseValue, rank:
'common'|'rare'|'ultra_rare'|'legendary' (step 9e, see RANKS below), inCatalog: boolean, art: { boxes: [{ dx, dy, w, h,
color }] } or { sprite: string } }
FurnitureItem: { uid, typeId, ownerId, roomId (null = in inventory), x, y, facing, onItemUid
(null, or the uid of the surface item it stands on) }
- (x, y) is the anchor: the bottom center of the footprint, in world px. The footprint
  rectangle runs from (x - fw/2, y - fd) to (x + fw/2, y). fw and fd are w and d when the
  facing is down or up, and d and w when it is left or right.
- Placement is per cell (step BG1): a floor item's w and d are whole cells (type.w and type.d
  are multiples of 32); its footprint stands on cells and the ghost snaps to the nearest cell
  footprint. The anchor (x, y) is still the bottom centre of the footprint; the anchor CELL is
  the bottom-centre cell (even widths: the left of the two centre cells). Rotation swaps w and
  d and keeps the anchor cell. A placement is valid if: the footprint is fully on floor cells;
  it does not overlap the footprint of another item with blocks = true (items with blocks =
  false, like rugs and floor decor, are the background layer: they overlap anything and are
  drawn under everything); it does not overlap the 2 x 2 cell door zone; and the door can still
  reach the middle of the room. A WALL item stays free (owner, 15 Nov): it slides along a back
  wall band at any x, 4 px snap (SNAP; Shift = whole px), its anchor y is the band's foot (its
  art is drawn upward from there); not on the door. An onSurface item sits on a cell of a
  surface item, one level only, and moves and returns together with the item under it.
- Floors are painted per cell (BG1): Room.floorCells maps "col,row" to a floor style id; every
  other cell has Room.floorStyle. Pick an unlocked floor in the Room panel and tap Paint cells:
  tap a cell or drag a rectangle (free; the unlocked-forever rules stay). Wall styles stay one
  per room. The shop's appeal uses the floor style on most cells.
- Save migration 13 -> 14: every placed floor item moves to the nearest valid cell footprint,
  wall items stay, what no longer fits goes back to the bag, and a notice says how many.
- Draw order: floor, rugs, back wall, then ONE list of items and avatars sorted by y (the
  bottom of the footprint, or the avatar's feet), then x, then uid. An item on a surface is
  drawn right after the item under it.
- Rotation cycles through the type's facings. A left facing is the right sprite mirrored.
- Placeholder boxes: every box is drawn as a front face (w by h, darker) with a top face (w
  by d, lighter) above it, offset by dx and dy from the anchor.
- RANKS (owner's decision, step 9e): every item, material, crop, food, ore, gem and furniture
  type has one of four ranks: common, rare, ultra_rare, legendary (they replace common /
  uncommon / rare / epic). Each rank has a colour (config RANK_COLORS, palette indices:
  grey-brown, blue, purple, gold) used as the slot border and the name colour everywhere an item
  is shown; ultra_rare and legendary drops sparkle.
- Catalog: home items and shop items. Catalog price = baseValue * 3 gold. Items with
  inCatalog = false only come from the dungeon. An item can only be placed in a room that
  matches its placeIn. Step 4 builds 12 home items. Shop items arrive in step 7.

8. AVATARS
- Layers drawn in order: body, shoes, legs, torso, hair, hat, held item. Each layer is
  recolorable (palette index swap).
- Proportions like the classic hotel games: a slim figure with normal proportions, the head
  about one quarter of the height. Not chibi.
- 4 facings, three of them drawn: down, up and right. Left is right mirrored. Canvas 32x64
  px, feet at the bottom center. Animations: idle, sit (down, left and right only), and walk
  (4 frames). In pass 1 only the idle sprite is drawn, and the game bobs the sprite 2 px up
  and down while the avatar walks. Walk frames are added later and used when they exist.
- Placeholder avatar: drawn in code from boxes. The current box avatar (its look,
  proportions and colours, client/src/render/avatarParts.ts) is the approved base for the
  character: do not change its shape, and future avatar art (sprites, walk and sit frames)
  keeps these proportions.
- Clothing (step 7b) is data in shared/data/clothing.json: { id, slot: 'hair'|'top'|'bottoms',
  name, free }. Free at the start: hair short, long, ponytail, buzz; tops t_shirt, long_sleeve,
  vest (over a shirt); bottoms trousers, shorts, skirt. Items with free = false exist but stay
  hidden until unlocked later (catalog or dungeon; Player.unlockedClothing). Colours: short
  lists of palette indices per slot (config LOOK_COLORS). The styles only change the boxes for
  hair, top and bottoms; the body keeps the approved proportions (the old look is short hair,
  long sleeves and trousers, drawn exactly as before).
- Avatar: { id, name, look: { skin, hair (colour), hairStyle, top, shirt (top colour),
  bottoms, legs (bottoms colour), shoes }, roomId, x, y (the feet, in px), facing, state }
- Character creation (step 7b): once, at the very start of a new game, a full-screen panel
  shows the avatar large in the middle, turning slowly (down, right, up, left), with pickers for
  skin tone, hair style and colour, top and colour, bottoms and colour, shoes colour, and a
  display name (max 16 characters: letters, digits, spaces; no real names asked). The Avatar
  panel uses the same pickers later, with the same free/unlocked rule.
- The new-game intro (after character creation, once): pick the hotel shape, then the shop
  shape, from cards with a small top-down preview. Then the camera shows the empty shop at the
  overview zoom; after a short pause the counter pops in ("boing": scale 0, 1.2, 0.9, 1 in about
  0.5 s, with a small dust puff), then the stall_table. The avatar walks in through the door,
  coins fly from the till to the gold counter one by one while the number counts up from 0 to
  100, then the first hint appears. A tap anywhere skips the intro. A save that already has a
  player skips all of this.

9. ECONOMY (starting values, all kept in shared/config.ts)
- One currency: gold (integer). Every loot and furniture type has a baseValue (gold).
- A new player is created by one shared function, createNewPlayer. They get: level 1 with 0
  xp; 100 gold; only the bare floor and bare wall unlocked, used in both rooms; 4 wood and 2
  cloth to sell; an empty hotel room; a shop room (section 5) with a counter and one
  stall_table already placed at their fixed positions. No furniture in the inventory.
- The loop: sell loot in the shop -> gold -> buy furniture for the hotel room or the shop,
  or upgrade a room.
- Items for sale sit on slots. The starting stall_table has 3 slots (not in the catalog). A
  shelf has 3 slots (catalog price 30 gold) and a display case has 4. The player puts items
  on slots and sets a price per item.
- Shop appeal: every shop decoration has an appeal number. shopAppeal = min(100, sum of the
  appeal of placed items, each type counted at most 3 times, plus the appeal of the shop's
  floor style and wall style (bare gives 0, the others give 4 each)).
- Customers: every 60 s * 100 / (100 + shopAppeal), a shop with stock spawns one NPC
  customer (the first customer of a new game arrives after 10 s). Categories are: materials,
  home furniture, shop furniture, crypt furniture, food (step 9b) and lake furniture (step 9f). Each customer wants one category (80% of
  the time one that has stock in this shop, otherwise any) and has a tolerance, random in
  [0.8, 1.4]. The customer looks at the cheapest item in that category and buys it if price
  <= baseValue * tolerance. Otherwise the customer leaves. The reaction below is based on
  that cheapest item. There is no sales cap: sales are limited by the number of customers,
  by slots, and by the stock the player brings back from the dungeon.
- NO AUTO-SELLING (owner's decision, step 9d): nothing is ever sold without the player at the
  till. Customers keep coming at the normal rate while the player is elsewhere or the game is
  closed; each takes an item and joins the queue, but at most QUEUE_MAX (3) wait. While 3 wait,
  no new customers come. Gold only comes in when the player stands behind the counter and
  serves. When the game opens after a break, the queue is filled with what would have arrived
  (at most 3, maths only, no walking; the catch-up looks back at most 8 hours) and those
  customers stand at their queue spots. Waiting customers never leave on their own (v1). There
  is no "while you were away" summary. The Map button and the Map's Shop card show "n waiting".
- Customer flow (step 7, paced after 7b): customers walk calmer than the player (72 px/s, each
  one up to 10% faster or slower) and at most 5 NPCs are in the shop at once (at most 3 of them
  buyers; see NATURAL CUSTOMERS in the notes: no fixed route, window-shoppers, pairs, and the
  area behind the counter is staff only). A customer enters at
  the door and stops just inside it for a moment, walks to the table, shelf or case with stock,
  looks at it for 2 to 5 s (a "..." thought bubble; sometimes at a second item too), decides
  there (the reaction bubble below), and if buying takes the item (it
  leaves the slot at once), walks to the customer side of the counter, waits in a queue line
  if someone is already paying (queue spots in a row behind the first, each on a different
  free nav cell), and waits at the till until the player serves (owner's change after step 7):
  a coin marker shows above the till; the player taps the counter in play mode and, like
  sitting, the avatar walks behind the counter and faces the customers. While the player stands
  there, the waiting customers pay one by one (coins hop out of the till for CUSTOMER_PAY_MS, then
  a floating "+12 gold"; a coin sound later; gold goes up only now), wait 1 s, then leave through
  the door at the same calm pace.
  While QUEUE_MAX (3, step 9d) customers carry something to the till, no new customers come in. A
  customer who refuses just leaves. Offline catch-up (and a long gap) skips the walking and only
  fills the queue (see NO AUTO-SELLING).
- Natural customers (step 9d; reworked after 9d, see NATURAL CUSTOMERS in the notes): each customer gets a random look from the free clothing and
  LOOK_COLORS (seeded by its id) and a kind: 'hurried' (walks 20% faster, short browse),
  'browser' (looks at 2 to 3 things, decorations too), 'chatty' (talks more). Some stop at a
  decoration (a plant, a rug, a banner) first and face what they look at; standing customers
  shift their weight; in the queue they face the counter, and a waiting customer may sit on a
  free seat next to the queue (they stand up when it is their turn at the till).
- Talk (step 9d): speech bubbles with short original lines from shared/data/npcLines.json by
  moment: enter, browse, the reaction (cheap / fair / a bit high / too high, shown with the face),
  queue ("Hello? Anyone here?" after a while at the till), pay, leave, and remarks about the shop
  (high appeal: "What a lovely shop!", empty shelves: "Not much left..."). At least 6 lines per
  moment, at most 40 characters, picked with the rng passed in, never the same line twice in a
  row per moment. A chance per moment (config TALK_CHANCE; chatty more, hurried less). Bubbles
  follow the reading-pace rule.
- Take and give (step 9d, client only): taking, the customer reaches and the item hops from the
  slot into their hands in an arc (ITEM_HOP_MS) and is carried as the held-item layer (section 8).
  Paying, they put it on the counter (hop), the coins hop to the till, the item hops back, they
  nod and leave carrying it. The player's avatar makes a small hand-over move.
- Price feedback (this is how the player learns pricing): after each customer decision a
  bubble shows a reaction. Bought at price <= 0.7 * baseValue * tolerance: big smile (too
  cheap). Bought at a higher price: smile (fair). Refused at price <= 1.15 * baseValue *
  tolerance: shrug (a bit high). Refused above that: frown (too high). The shop panel shows
  the last 5 sale prices per item type.
- Gold sinks: catalog (baseValue * 3), room upgrades (level 2: 300 gold, level 3: 800 gold,
  for each room), dungeon gear and potions (section 10), dungeon key 10 gold, seeds and farm
  upgrades (section 10b), smelting fees (section 10c).
- Gem sink (step BG8, prices BG9): packs are bought with gems (config PACKS; the contents are shared/data/packs.json). Packs in
  v1: Random Blocks (5 blocks, 40 gems), Basic Seeds (5 seeds, 30), Common Clothes (3 pieces, 75) and Rare Clothes (3 pieces,
  225). Targets (config BALANCE_TARGETS): the first pack within 45 minutes of a new game (about 25), a Common Clothes Pack
  about an hour and a Rare Clothes Pack about 3 hours of mixed play at level 3. A
  roll picks a rank first (RANK_WEIGHTS times the pack's multiplier, as for loot), then an item of that rank in the
  pool (blocks.json; crop and block seeds; clothing.json pieces that are hidden until unlocked, each with a rank).
  The first copy of a piece of clothing unlocks it forever; every further copy is a spare (Player.clothingSpares,
  shown as "Spare x2"), which sells for gold (baseValue * config SPARE_SELL = 0.1, so a spare is always worth far less than a pack piece costs) until trading exists. Blocks and seeds
  stack as always. Pack finds count in the Book like everything else. The Packs tab of the Catalog shows, per
  pack: the price in gems, how many things it gives, every possible item with its rank odds in percent and, for
  clothes, how many pieces are still missing. Every buy asks first. Opening plays a short pop, then the items
  float above the head and land in the bag; a new piece says "New!" with a Wear it button.
- No trading between players in v1.
- Every change to gold, gems or items goes through one function and is written to a ledger.
- THE TAVERN (owner's decision, step 9t; part A = the shared rules is done, the client parts B and
  C are not, so the game does not show it yet): the shop room is a tavern (internal kind 'shop'
  and the room id stay; the counter is the bar). GUESTS come alone, as a pair or as three, sit on
  free seats at a table, order one drink or dish from the menu, and wait for the player to bring
  it from the bar (taps queue up, at most 3). They eat 20 to 40 s, leave coins and an empty mug or
  plate on the table and walk out; the player taps to collect the coins and to clear the dish
  (nothing is collected automatically; a table spot with coins or a dish takes no new guest). A
  guest who waits about 90 s leaves unhappy without paying. The menu price rule is the shop's
  (tolerance, the four faces); too high = something cheaper or nothing. Drinks are brewed in a
  brewing barrel from crops in real time. The market corner (stall table, shelves, cases, the
  queue of 3 at the bar) stays exactly as above. Away rule: at most 3 guests sit with an open
  order and they do not walk off. Details: STEP 9t in the notes.

10. DUNGEON
- Real-time and click-driven in the same top-down view: clicking fast is the game. A run is
  advanced by one pure function, step(run, inputs, dtMs, rng), in fixed 100 ms ticks, so it
  is deterministic and the server can run the same code later. There are no turns.
- Player inputs: click the floor to walk there. Click an enemy to walk next to it and
  attack: each click is one hit, with a 350 ms attack cooldown (clicks during the cooldown
  are ignored, and there is no auto-attack). Drink a potion with a button or the Q key.
  Walking into the exit pauses the run until the player chooses.
- Floor: the dungeon is built from 32x32 px blocks (a block is floor or wall), 40x40 blocks
  per floor, 5 to 8 rooms of 4 to 8 blocks, corridors 1 block wide, from an integer seed
  (same seed = same floor). A run = 3 floors. Floor 3 has a boss. Each floor has an exit
  (one block).
- Theme in v1: Crypt.
- DUNGEON_ROUND in config switches the size of the dungeon. Round 1 (the default):
  MAX_FLOORS = 1, 3 to 4 rooms, only slimes, no mimics, no boss, xp and levels on. Round 2:
  everything in this section (3 floors, 5 to 8 rooms, all enemies, mimics, the boss). Both
  rounds are implemented, and I switch between them in config after playtesting round 1.
- Player: 30 hp, attack 4-6, defense 0, moves 80 px per second (2.5 blocks per second) in
  every direction. Enemies: slime (hp 8, hit 2-3, attack every 1600 ms, moves 40 px per
  second), skeleton (hp 12, hit 3-5, attack every 1200 ms, moves 64 px per second), bat (hp
  6, hit 2-4, attack every 900 ms, moves 92 px per second but half of its moves are in a
  random direction), boss Bone King (hp 60, hit 5-8, attack every 1500 ms, moves 54 px per
  second). All speeds are in config.
- Enemies chase the player if within 192 px (6 blocks), using the navigation code of
  section 6 on the dungeon blocks (16 px cells, DUNGEON_NAV_CELL, no avatar radius), otherwise
  they idle. When within 40 px (ATTACK_REACH) of
  the player, an enemy starts an attack with a 300 ms wind-up (it flashes). If the player is
  more than 48 px away at the end of the wind-up, the attack misses. Then it waits for its
  attack cooldown. Moving away at the right moment is how a player dodges.
- Loot goes into a run bag with 12 slots. Each different furniture item takes 1 slot,
  materials stack up to 10 per slot, gold and potions take no slot. A full bag means leaving
  something behind.
- Every floor has an exit. At the exit the player chooses: Go deeper (the bag stays at risk)
  or Leave (the bag is banked and the run ends). In round 1 there is no deeper floor, so the
  exit only offers Leave. Killing the boss on floor 3 banks the bag. Dying loses all items
  in the bag and half the gold found in this run. Gold already in the wallet is never lost.
- A run costs 10 gold (the dungeon key). If the player has less than 10 gold the run is
  free, so nobody gets stuck.
- Going down the stairs heals 30% of max hp.
- Gear stays forever. (Until step 9c it was bought with gold in the Blacksmith panel: iron_sword
  150 gold, leather_armor 120 gold. Now see section 10c: the iron sword is 7-9.) Health
  potion: 20 gold, heals 15 hp instantly, 1 second cooldown between potions, carry max 3.
  From step 9c the forge (section 10c) takes over weapons and armor: the iron_sword and
  leather_armor are no longer sold for gold but made from bars. Potions stay for sale.
- From step 9b the player can also bring food from the farm (section 10b).
- Each room except the spawn room has 0 to 2 enemies. (The balance check was made with
  tile-based movement, so the simulation in step 8 must be run again.) Enemy hp on floor n
  is multiplied by (1 + 0.25 * (n - 1)), rounded up; not the Bone King's, which always has 60
  hp (owner's decision after step 8, config BOSS_HP_FLOOR_SCALING = false). Each floor has 3 to 5 wooden chests and
  a 40% chance of one golden chest. Surviving is the job: enemies are the danger, chests are
  the reward.
- Loot tables are data in shared/data/loot.json: { id, rolls, drops: [{ item, min, max,
  weight }] }. Rolls use an rng that is passed in.
- DROPS BY RANK (owner's decision, step 9e): every drop row in a loot table has a rank. A roll
  first picks a rank (config RANK_WEIGHTS: common 75%, rare 20%, ultra_rare 4.5%, legendary
  0.5%, times the table's rankMultiplier: golden chests, mimics and bosses shift the odds up),
  then one of the table's drops of that rank by weight. A rank a table does not have falls to
  the next lower one.
- Loot: wooden chests roll 2 drops each (mostly gold, then materials; rare: a bigger pile of
  gold or a crystal; ultra rare: a crypt furniture item, 5%). A golden chest rolls 3 drops with
  better odds (more crystal, about 11% crypt furniture). 1 in 8 wooden chests is a mimic: it looks like a normal chest, but when walked
  onto it turns into a skeleton, and when it dies it drops a golden chest's loot. The boss
  floor always ends with a golden chest next to the exit, and the Bone King also drops 1 to
  2 throne_piece. Each kill gives xp (slime 3, bat 4,
  skeleton 5, mimic 8, Bone King 40) and has a 10% chance (RARE_DROP_CHANCE) of one drop from
  the enemy's own table (step 9e; the Bone King always drops): one new material per rank.
  Slime: slime gel, sticky core, royal jelly, slime crown. Bat: bat wing, echo fang, moon
  membrane, night pearl. Skeleton: bone dust, rusty buckle, grave ring, ancient skull. Mimic:
  chest hinge, mimic tongue, gilded lock, greedy heart. Bone King: royal bone, king's seal,
  crown shard, king's heart. They sell in the shop, and each enemy has a trophy recipe: slime
  jar, bat wing fan, skull trophy, toothy chest, king's banner.
- THE BOOK (owner's decision, step 9e): a collection book of everything the player ever found
  (tabs Materials, Furniture, Food and crops, Enemies). Never seen = a grey silhouette and
  "???". Filling 25 / 50 / 75 / 100% of a tab gives gold (and later a hat, step 9g).
- XP and levels: levels 1 to 8, thresholds in shared/data/levels.json (total xp for level 2
  to 8: 15, 40, 80, 140, 220, 320, 450). Every level gives +3 max hp, and every even level
  gives +1 attack (added to both ends of the damage range). Xp counts the moment an enemy
  dies and is kept even if the player dies later, so a failed run is never wasted. Only the
  bag and half the run gold are lost on death. Level up shows a short flash and full heal.
- Materials (they exist from step 5): bone (4 gold), cloth (6), crystal (15), wood (3), plus
  throne_piece (10, boss only). Crypt furniture is not in the catalog. It is crafted from
  materials (recipes in shared/data/recipes.json): bone_chair (6 bone + 2 wood, baseValue
  20), skull_lamp (5 bone + 1 crystal, baseValue 25), coffin_table (12 bone + 4 wood + 2
  cloth, baseValue 40), wall_torch (3 wood + 1 crystal, baseValue 15), bone_throne (5
  throne_piece, baseValue 120). Two recipes make a style instead of an item:
  crypt_flagstones (a floor, 8 bone + 2 crystal) and bone_wall (a wall, 10 bone + 4 cloth).
  They unlock that style forever and are not in the catalog. Crafting costs more than the
  item sells for, so crafted pieces are for showing off. The one exception is bone_throne (5
  throne_piece are worth 50 gold, the throne 120): it is the boss reward (owner's decision
  after step 8).

10b. FARM (step 9b)
- A third place next to the hotel and the shop: an outdoor plot. Same top-down renderer and
  rules as a room (kind 'farm'), with a grass floor, a fence or hedge in place of the back
  wall, and the door at the bottom. Sizes: level 1 576x384, level 2 704x480, level 3 832x576
  (upgrade 200 / 600 gold). The farm is unlocked from the start.
- BG6 CHANGED THE FARM (owner's request): it is free-form. The fixed plots are gone; the only fixed thing
  is the cooking pot. SOIL is a floor style ('soil', styles.json, free): a new farm has a 6 x 2 patch
  (config FARM_START_SOIL); Room > Paint soil paints soil, painting grass over it removes it (a cell with a
  plant stays soil). Decorations, paths and fences (blocks) go anywhere else.
- SEEDS: every block (blocks.json seedId `<block>_seed`) and every crop (crops.json seed) has a seed item
  with a seed icon in its colours; they stack in the bag and the hotbar. Basic crop seeds are sold in the
  Catalog (Seeds tab, gold); block seeds drop from broken blocks (BLOCK_SEED_CHANCE), harvests (SEED_BACK_CHANCE)
  and splicing (BG7). The glowcap spore still only drops in the dungeon.
- PLANTING: select a seed in the hotbar and tap a free soil cell of a farm room within BLOCK_REACH cells (farther:
  the avatar walks closer first; holding still 300 ms and dragging plants a line). One plant per cell. A plant
  blocks its cell like a small block (nav grids rebuilt, never on the door zone, furniture, the pot, an avatar
  standing still, nor where it would shut the door off). Plants are Room.plants { seed, plantedAt, readyAt }.
- GROWTH: 3 stages in real time, also while the game is closed (times passed in, no Date.now in shared/): sprout
  (first half), small plant, full plant. Grow time by RANK of what grows (config SEED_GROW_MS): common 2 min,
  rare 20 min, ultra_rare 3 h, legendary 12 h. No watering. A full plant waits until punched, no rotting.
- HARVEST: punch the full plant (one hit, cooldown BLOCK_HIT_COOLDOWN_MS 250, hold to repeat): SEED_YIELD blocks
  or crops by rank (common 2-4, rare 2-3, ultra_rare 1-2, legendary 1), SEED_BACK_CHANCE (30%) for the seed, and
  gemDrop('harvest', rank) gems. The plant goes, the cell is free again. Punching an unripe plant does nothing
  (a shake and "ready in n min"), so a tap never destroys it. All results go through the gains list and ledger
  (reasons 'plant', 'harvest'). Pure functions: plantSeed, growthStage, harvestPlant, hitPlant (shared/src/farm.ts).
- SPLICING (BG7): select a seed and tap a planted, unripe, not yet spliced cell: the second seed is used up and
  the cell grows the NEW seed of the pair (shared/data/splice.json { a, b, result }, a + b = b + a, about 40
  recipes, chains of 2 to 3 steps, a result is never lower in rank than the lower input). The clock restarts:
  readyAt = now + max(grow time of both, SEED_GROW_MS by rank) + SPLICE_BONUS_MS (config, 1 min). No random
  failure: a pair not in the table, and a seed with itself, answer "nothing happens" and take nothing. A ripe
  spliced plant is harvested by punching: exactly the result seed (no seed back), a SPLICE_BONUS_CHANCE (25%)
  chance of one block or crop of either seed, gemDrop 'splice' (result rank). Splice seeds (spliceSeeds.json) grow
  a drink or good, a furniture item (to the inventory) or a clothing piece (unlocked forever; a repeat harvest
  gives the seed back). The Book's Splice tab: found recipes "[a] + [b] = [result]", the rest "???" with one
  ingredient shown once that seed has been seen; a recipe is found when its result is first harvested
  (Player.splicesFound); 25 / 50 / 75 / 100 % pay gold and gems (bookRewards.json). Quest hint 6 teaches it.
- Crops (shared/data/crops.json): turnip (seed 4 gold, worth 10), potato (seed 6, worth 16), carrot (seed 8,
  worth 22), pumpkin (seed 15, rare, worth 50), glowcap mushroom (no seed for sale; 1 glowcap spore drops from 5%
  of dungeon chests; ultra_rare, worth 40). crops.json growMinutes is LEGACY (only the save migration uses it).
- MIGRATION (save 15 -> 16): each old plot became a soil cell (snapped to the cell grid), each planted crop a plant
  with the same crop, planting time and time left; crops and seeds in the bag are unchanged (same ids); GameState.farm
  is gone; a toast explains the new farm once.
- Cooking: a cooking pot stands in the farm at a fixed spot (not furniture, cannot be moved).
  Tap it to open the Cooking panel. Recipes (shared/data/food.json): roasted turnip (1
  turnip; heals 8 hp), potato stew (2 potato + 1 turnip; heals 15 hp), carrot soup (2 carrot
  + 1 potato; +1 attack for the rest of the run), pumpkin pie (1 pumpkin + 1 carrot; +10 max
  hp for the run), glowcap broth (1 glowcap + 1 potato; attack cooldown 350 -> 300 ms for the
  run).
- In the dungeon: the player takes up to 3 food items in a lunch box (separate from the 3
  potions). A food button eats the next item. Healing food has the same 1 s cooldown as
  potions; each buff kind works once per run. Food in the lunch box is lost on death, like
  the bag.
- Crops and food are also goods for the shop (category 'food' for the customers).

10c. MINE (step 9c)
- A fourth place, unlocked at player level 3 (a hint tells the player when it opens). Built
  from the dungeon code: 32 px blocks, the same step() style in fixed 100 ms ticks, a new
  small layout from a seed every visit (2 to 3 rooms). Cooler, rocky look; lanterns as the
  warm accent.
- A visit is free and lasts as long as the lantern burns: 4 minutes (config), shown as a bar.
  When it runs out the player walks out with everything. Leaving early is always allowed.
- Rocks instead of chests: copper rocks (3 hits), iron rocks (5 hits), mithril rocks (8 hits,
  only from mine visit 5 on, or a deeper second room later). Mining: tap a rock to walk next
  to it and swing; each tap is one hit with a 400 ms pickaxe cooldown, so tapping fast is
  the game here too. A broken rock drops 1 to 2 ore; 5% chance of a gem (sells for 60).
- Pickaxe tiers: basic pickaxe (start; mines copper and iron), steel pickaxe (forge: 5 iron
  bars + 2 copper bars; mines mithril, each hit counts double).
- A few weak enemies (slimes and bats, 0 to 1 per room) keep it tense. If hp reaches 0, the
  player is carried out and loses half the ore of this visit; nothing else is lost.
- Forge (the Blacksmith panel gets a Forge tab): smelt 3 ore into 1 bar (copper bar, iron
  bar, mithril bar) for a small fee (2 / 4 / 8 gold).
- Weapons (attack range): starting sword 4-6; copper sword 5-7 (4 copper bars); iron sword
  7-9 (5 iron bars + the copper sword); mithril sword 9-12 (5 mithril bars + the iron sword).
- Armor (damage taken per hit, minimum 1): leather armor -1 (3 copper bars); iron armor -2
  (5 iron bars + leather); mithril armor -3 (5 mithril bars + iron armor).
- Each upgrade replaces the previous piece. Gear stays forever. All numbers in
  shared/data/forge.json and config. Ore, bars and gems are shop goods (category
  'materials').
- After step 9c the dungeon simulation is run again with the gear tiers and food, and the
  survival targets per tier are checked.

10d. LAKESIDE (step 9f)
- A fifth place on the Map, open from the start: an outdoor room (kind 'lakeside', 576x384, one
  level) with grass and a hedge like the farm, a lake taking up about a third, a short wooden pier
  (walkable) reaching into it, 8 trees and some bushes. Daylight (no shade, no light pools). Not
  buildable in v1 (no furniture, no upgrade, no styles).
- WOODCUTTING: tap a tree: the avatar walks next to it and swings; each tap is one swing, with a
  400 ms axe cooldown (tapping is the game; taps during the cooldown are ignored). A tree falls
  after 5 hits and gives 2 to 3 wood plus, by a rolled rank (RANK_WEIGHTS): resin (rare), amber
  (ultra_rare), golden acorn (legendary). A stump is left; the tree grows back after 5 minutes of
  real time (time passed in, also while the game is closed). Wood stays a dungeon drop too. Axe
  tiers at the forge: basic axe (start), steel axe (5 iron bars + 2 copper bars; each hit counts
  double).
- FISHING: tap the water (from the shore or the pier): the avatar walks to the nearest shore spot
  and casts. The bobber floats 2 to 8 s (rng), then dips with a "!" for 700 ms (shorter for rarer
  fish): tap in time to hook. THE REEL (owner's change after the first playtest, like Stardew
  Valley and Pixel Worlds): a bar with a fish swimming back and forth and a green catch box.
  HOLD (the button, the bar or Space) pushes the box to the right, a tap kicks it, and it falls
  back to the left by itself. While the fish is inside the box the catch bar fills; outside it
  drains. Full = caught, empty = it escapes. Rank sets the strength: a common fish is slow and
  forgiving, a legendary one swims fast, turns often and darts, and drains the bar faster. Missing
  loses nothing. All timing is in one pure function, step(session, inputs, dtMs, rng), in 50 ms
  ticks (shared/src/fishing.ts).
- RODS (forge): basic rod (start), copper-reel rod (4 copper bars), mithril rod (4 mithril bars,
  after the copper-reel rod). A better rod makes the catch box wider and lets it fall slower, and
  shifts the rank odds toward rare, ultra rare and legendary catches.
- CATCHES (shared/data/fish.json): 12 fish (5 common, 4 rare, 2 ultra_rare, 1 legendary) and 6
  fished-up things: old boot and driftwood (common), shell and glass bottle (rare), pearl
  (ultra_rare), sunken crown (legendary). Fish have a size in cm; the Book keeps the biggest.
- Fish are shop goods (category 'food'); three more recipes at the cooking pot use them: grilled
  perch (heals 12), carp stew (+1 attack), eel pie (+10 max hp).
- LAKE FURNITURE (crafted, not in the catalog, theme 'lake', category 'lake_furniture'): fish
  tank (stands on a surface, a fish swims in it), mounted fish and fishing net (wall), shell lamp
  (a light), driftwood bench (2 seats), anchor, pearl chandelier (a light), the sunken throne (needs
  the sunken crown), and a lake floor (lake_pebbles) and wall (reed_wall).
- The Book has a Fish tab (fish and fished-up things, grey until caught), and the trees' drops
  are under Materials.

11. NETWORK (step 10 onward)
- WebSocket, JSON messages { t: string, ... }.
- Client to server: auth, enter_room, walk, chat, place_item, move_item, pickup_item,
  set_price, shelf_put, shelf_take, buy_catalog, dungeon_start, dungeon_input, report, mute.
- Server to client: room_state, avatar_joined, avatar_left, avatar_path, chat, item_added,
  item_moved, item_removed, wallet, inventory, shop_update, dungeon_state, error.
- The server validates everything: ownership, coordinates, ranges, text length (chat max 120
  characters), rate limit (10 messages per second per connection).
- Movement: the server sends the full path once. Clients animate it.
- HTTP: POST /api/register, POST /api/login, GET /api/catalog.
- Database (SQLite): users, wallets, furniture_items, rooms, shops, shop_slots,
  dungeon_runs, reports, bans, ledger.

12. ART
- View: top-down with a slight front angle. Every object shows its top and its front. No
  isometric angle, no heavy perspective.
- Look: a cozy medieval tavern, like the mood reference in docs/mood.png. Warm wood browns,
  orange candlelight, deep red and green accents, many small props (candles, barrels, mugs,
  banners, antlers, plants), dark warm outlines instead of pure black. The hotel and the
  shop use these warm colours. The crypt dungeon is the opposite: cool and dark (blue,
  purple, grey) with a few warm lights like torches, so it feels like another place.
  Original art only: the mood reference is never something to copy or trace.
- Scale: like the classic hotel games, so characters and furniture have room for detail.
  Avatars are slim with normal proportions, not chibi.
- The full style sheet (outline, light, color rules, sizes) is in docs/STYLE.md, created in
  step 6. Placeholder art follows its sizes now.
- Palette: Endesga 32 (32 colors, by Endesga) from Lospec,
  lospec.com/palette-list/endesga-32. The hex list lives in shared/palette.ts and nowhere
  else, so switching to a bigger warm palette (for example Resurrect 64) later means
  changing one file. If you cannot download the list, ask me to paste it. Final sprites use
  only the palette.
- ITEM ICONS (step BG2): every item (materials, ore, bars, crops, seeds, food, drinks, fish and
  fished-up things, gear and forge pieces, clothing, furniture) has icon: { shape, colors[] } in
  its data file: a shape from the fixed ICON_SHAPES list (shared/src/icons.ts) and 1 to 3 Endesga
  palette NAMES (PALETTE_NAMES in shared/palette.ts; no hex in data). One function drawIcon
  (client/src/render/drawIcon.ts, pure pixels in iconPixels.ts) draws it on a 32x32 square: flat
  fills, light from the top-left, 1 px dark warm outline; the rank only adds a frame in RANK_COLORS.
  Within one group no two items share shape + colours (tested). These are rough placeholders: real
  pixel art replaces the drawing per item in phase 4.
- Light comes from the top-left: top faces lightest, left faces medium, right faces darkest.
  1 px dark outline. No anti-aliasing.
- Sizes (px): avatar 32x64. Chair 32x48, table 64x56, sofa 80x56, bed 64x80, bookshelf
  56x80, lamp 24x48, plant 32x48, rug 80x56, barrel 40x48, crate 40x40, bench 64x40, desk
  64x56. Chests 48x40. (Since BG1 the FOOTPRINTS are whole cells; these are art sizes.) The
  anchor of every sprite is the bottom center of its footprint.
  Floors are a seamless 64x64 texture. The wall band is 64 px tall and repeats sideways.
  Dungeon blocks are 32x32. Icons for loot and materials are 32x32.
- Until real sprites exist, art is drawn in code from boxes. Placeholder shading may compute
  its own shades.
- Sprite sheets: PNG + JSON (frame name -> x, y, w, h, anchor). Nearest-neighbour scaling
  only.
- UI: HTML/CSS over the canvas. Free open-license pixel font, hosted locally. The screen
  layout (info panel top-left, icon buttons on the right edge, hotbar bottom-center, debug
  tools in Settings), the frame style and the interaction patterns are in
  docs/UI-REFERENCE.md. Read it before any step that adds or changes UI, and put new buttons
  and panels where it says.

13. SAFETY AND PRIVACY
- Accounts need only a username and a password. No email, real name or birthday.
- Chat: word filter, report button, per-player mute, rate limits. Room owners can set a room
  to private.
- No private messages and no friend requests in v1. Chat is public inside the room you are
  in.
- No email is stored, so there is no password reset by email. An admin can set a new
  password.
- The game is for ages 13 and up. The register screen has a checkbox 'I am 13 or older' and
  collects no other age data. Rules differ by country, so check them before launch.
- No real-money purchases. Loot comes only from play. The one random thing that costs something is a pack
  (section 9, BG8), allowed only under these FAIRNESS RULES (owner's decision): (1) gems are earned in play
  only, never bought with money; (2) the contents and the rank odds are shown on the pack card before
  buying; (3) duplicates are allowed: extra copies are spares, sellable for gold (and later tradable); (4) no
  timers, limited-time offers, daily limits or streaks that push buying. Anything else random that costs
  something needs the owner's yes.
- The first release is a small private test.

14. WORKING RULES FOR YOU (the AI)
- Do one step at a time. Do not build things from later steps.
- Keep files small and named by purpose. Constants go in shared/config.ts, not in code.
- Before you finish a step: run the type check and the tests, then tell me how to run the
  game and what to try by hand.
- If a request conflicts with this brief, tell me and ask. Do not silently change the brief.
- If I paste an error, find the cause first, then fix it. Do not rewrite unrelated code.
- Before coding a step, write a short plan (the files you will touch and the order) in at
  most 8 lines. Write the tests for the rules first or together with them. Before you say a
  step is done, run the full test suite and the type check.
- Before writing a system yourself (hit testing, sprite sheet loading, a ticker, path
  helpers), check whether PixiJS or another library we already use does it. If it does, use
  it and tell me.
- At the end of each step, update the CURRENT STATE in CLAUDE.md (at most 15 lines) and any
  rule that changed (in CLAUDE.md and docs/BRIEF.md), and put new files, conventions and
  measurements in docs/NOTES.md under the right heading. Keep CLAUDE.md under 250 lines. Out of
  date notes confuse later sessions.
- The order of work is docs/ROADMAP.md. Step prompts are in docs/NEXT-STEPS.md. Details of
  earlier steps are in docs/NOTES.md: read the part you need, not the whole file. After each
  step, tick it in docs/ROADMAP.md.
- Do not generate art with any tool unless I ask for it in that step.
- I work with Claude Code on my phone or on my PC. The repo is on GitHub and every push to
  main is deployed by GitHub Pages (https://bithus.github.io/pixel-hotel/), so I can test the
  game on my phone through that link. Commit and push at the end of every step.


15. THE BLOCK WORLD (PLANNED, owner's decision 15 Nov; full design docs/BLOCKS-PLAN.md)
BG1 to BG3 A and BG5 are built (sections 4, 5, 9 above); the rest is not. When a BG step builds a part, it moves that part into the sections above and
changes them (4, 5, 6, 7, 9, 13). Until then sections 4 to 7 and 13 stay as written.
- Inspiration: Growtopia and Pixel Worlds (block grid, punching, seeds, splicing, gems, packs,
  locks and access, visit by name), next to Travellers Rest and Habbo. Never copy names or art.
- Building per cell: BUILD_CELL 32 px; rooms, floors, floor furniture and navigation on cells.
  Wall items stay freely placeable along the back wall band (4 px snap).
- Hold to repeat: hold the mouse or a finger on a block, plant, rock or tree to keep hitting at
  its cooldown (not in the dungeon fight, not in fishing); dragging pans the camera.
- Blocks: place and break by hits; drops, seeds, gems. Seeds grow in real time; two seeds splice
  into a new one (fixed table). Farming = plant and punch.
- Gems: second currency, dropped by everything, not tradable, never bought with real money.
  Gold stays the tavern money. Packs (random blocks, seeds, common clothes, rare clothes) cost gems;
  odds shown; clothes packs never repeat owned pieces.
- Items are coloured squares with a rough shape (drawn in code) until real art.
- Everything you gain floats above the avatar's head for about 1.2 s (icon + count, rank colour).
- Social (online, phase 6): room names and visit-by-name, a lobby, locks and access lists, signs,
  portals; friends, guilds and trading only later with new safety rules.
- Cooking happens in the TAVERN (owner, 15 Nov): a stove in the tavern cooks batches in real time from
  crops; dishes go on the menu, in the lunch box and on the stall. The garden has no pot. (Step K1.)
- Brewing and RIPENING (owner, 15 Nov): drinks brewed in the barrel can ripen in casks on a keg rack in real time:
  fresh -> aged -> vintage, worth more, ordered by taste guests; limited cask slots. (Step K2, after 9t C.)
