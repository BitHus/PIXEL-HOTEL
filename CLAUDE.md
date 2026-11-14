PROJECT BRIEF
Fixed decisions. Do not change them unless I say so.

1. WHAT WE ARE BUILDING
A browser game with three parts:
- Hotel: top-down pixel-art rooms in the style of Travellers Rest (you look down at the room
  with a slight front angle, you see the top and front of things). Players walk around as an
  avatar, chat in bubbles, and place furniture anywhere they like in the room. There is no
  tile grid.
- Dungeon: a random real-time dungeon where clicking fast is the game. Loot comes from
  chests. Enemies are the danger: they give xp (the player levels up) and rarely a special
  drop.
- Shop: each player has a shop room. They put loot on shelves and set prices. NPC customers
  walk in and buy for gold. Gold buys furniture in the catalog.
- Farm (section 10b, step 9b): an outdoor plot where the player grows crops in real time and
  cooks them into food that heals or buffs them in the dungeon.
- Mine (section 10c, step 9c): a short click-to-mine trip for ore. Ore is smelted into bars
  at the forge, and bars upgrade weapons, armor and the pickaxe.
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
- The hotel and the shop have no tile grid. Furniture and avatars have pixel positions. Two
  grids exist only inside the code and are never shown: the navigation grid (16 px cells,
  section 6) and the dungeon's 32 px blocks (section 10).
- Pixel-perfect: no texture smoothing, and sprites are drawn at whole world pixels. At a zoom
  that is not a whole number some art pixels are 1 screen px wider than others, and below
  zoom 1 some art pixels are skipped; that is accepted (owner's choice, step 2).
- Draw order: see section 7.

5. ROOMS
- A room is { id, kind: 'hotel' | 'shop', level, shape, w, h (the floor's bounding box in px),
  floorStyle, wallStyle }. Its floor is a union of rectangles (step 7b), from its shape and
  level. Shapes are data in shared/data/roomShapes.json: { id, name, kind: 'hotel'|'shop'|'both',
  levels: [ { rects: [{x, y, w, h}], door: {x} } x3 ] } (plus shopStart: where a new shop's
  counter and stall_table stand). Each level's floor fully contains the previous level's floor,
  so upgrades never cut off furniture. Shapes: square (the old rectangle; 'square' for the hotel,
  'square_shop' for the shop), long (narrow and long), l_shape, plus (a cross) and wide_hall
  (wide and shallow), each with 3 levels, all about the same area at level 1, 16 px aligned.
- Walls: every floor edge that faces up gets the 64 px back wall band (WALL_BAND) above it;
  all other outside edges get the thin 16 px border. Inner corners are drawn cleanly. The
  floor is a seamless repeating texture, not a tile map.
- The door is a 64 px wide opening in the border under a bottom edge, at the x from the shape
  data. The DOOR ZONE is a 64 x 48 px rectangle on the floor just inside it. Nothing can be
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
  door zone goes back to the inventory. Costs are in config.
- Room ids are integers.

6. MOVEMENT
- Click the floor: the avatar walks there. Click a sittable item: it walks to the front of
  the item and sits.
- Navigation uses an internal grid of 16 px cells (NAV_CELL), rebuilt when furniture changes.
  A cell is blocked if it is outside the floor or inside the footprint of an item with
  blocks = true, with the footprint made bigger by the avatar radius (12 px). A* with 8
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
(where a customer stands, relative to the item's anchor, default 0, 24), baseValue, rarity:
'common'|'uncommon'|'rare'|'epic', inCatalog: boolean, art: { boxes: [{ dx, dy, w, h,
color }] } or { sprite: string } }
FurnitureItem: { uid, typeId, ownerId, roomId (null = in inventory), x, y, facing, onItemUid
(null, or the uid of the surface item it stands on) }
- (x, y) is the anchor: the bottom center of the footprint, in world px. The footprint
  rectangle runs from (x - fw/2, y - fd) to (x + fw/2, y). fw and fd are w and d when the
  facing is down or up, and d and w when it is left or right.
- Placement is free: any x and y, snapped to 4 px (SNAP). Holding Shift turns snapping off.
  A placement is valid if: the footprint is fully inside the floor; it does not overlap the
  footprint of another item with blocks = true (items with blocks = false, like rugs, can
  overlap anything and are drawn under everything); it does not touch the door zone; and the
  door can still reach the middle of the room (navigation check). A wall item only moves
  left and right and stays on the back wall band. An onSurface item can be put on a surface
  item: it snaps to the nearest free spot on top, one level only, and it moves and returns
  together with the item under it.
- Draw order: floor, rugs, back wall, then ONE list of items and avatars sorted by y (the
  bottom of the footprint, or the avatar's feet), then x, then uid. An item on a surface is
  drawn right after the item under it.
- Rotation cycles through the type's facings. A left facing is the right sprite mirrored.
- Placeholder boxes: every box is drawn as a front face (w by h, darker) with a top face (w
  by d, lighter) above it, offset by dx and dy from the anchor.
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
  home furniture, shop furniture, crypt furniture. Each customer wants one category (80% of
  the time one that has stock in this shop, otherwise any) and has a tolerance, random in
  [0.8, 1.4]. The customer looks at the cheapest item in that category and buys it if price
  <= baseValue * tolerance. Otherwise the customer leaves. The reaction below is based on
  that cheapest item. There is no sales cap: sales are limited by the number of customers,
  by slots, and by the stock the player brings back from the dungeon. Offline: when the
  player returns, simulate customers for up to 8 hours and show a summary of what sold.
- Customer flow (step 7, paced after 7b): customers walk calmer than the player (72 px/s, each
  one up to 10% faster or slower) and at most 3 are in the shop at once. A customer enters at
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
  While QUEUE_MAX (5) customers carry something to the till, no new customers come in. A
  customer who refuses just leaves. Offline catch-up (and a long gap) skips the walking and the
  serving and only does the maths.
- Price feedback (this is how the player learns pricing): after each customer decision a
  bubble shows a reaction. Bought at price <= 0.7 * baseValue * tolerance: big smile (too
  cheap). Bought at a higher price: smile (fair). Refused at price <= 1.15 * baseValue *
  tolerance: shrug (a bit high). Refused above that: frown (too high). The shop panel shows
  the last 5 sale prices per item type.
- Gold sinks: catalog (baseValue * 3), room upgrades (level 2: 300 gold, level 3: 800 gold,
  for each room), dungeon gear and potions (section 10), dungeon key 10 gold, seeds and farm
  upgrades (section 10b), smelting fees (section 10c).
- No trading between players in v1.
- Every change to gold or items goes through one function and is written to a ledger.

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
- Enemies chase the player if within 192 px (6 blocks), using the same navigation grid as
  section 6 on the dungeon blocks, otherwise they idle. When within 40 px (ATTACK_REACH) of
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
- Gear is bought with gold in a Blacksmith panel and stays forever: iron_sword (attack 6-8,
  150 gold), leather_armor (each hit does 1 less damage, minimum 1, 120 gold). Health
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
- Loot: wooden chests roll 2 drops each (mostly gold, then materials, a 3% chance of a crypt
  furniture item). A golden chest rolls 3 drops with better odds (more crystal, 10% crypt
  furniture). 1 in 8 wooden chests is a mimic: it looks like a normal chest, but when walked
  onto it turns into a skeleton, and when it dies it drops a golden chest's loot. The boss
  floor always ends with a golden chest next to the exit, and the Bone King also drops 1 to
  2 throne_piece. Normal enemies drop no materials. Each kill gives xp (slime 3, bat 4,
  skeleton 5, mimic 8, Bone King 40) and has a 10% chance of one rare drop: 70% a crystal,
  30% a random crypt furniture item (about 3% per kill).
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
- Soil plots: 32x32 tilled squares at fixed positions from config, in neat rows. Level 1 has 6
  plots, level 2 has 12, level 3 has 20. Plots are part of the farm, not furniture; the player
  can still place decorations (fences, plants, benches) around them in build mode.
- Seeds are bought in the catalog (a Seeds tab) and stack in the bag. Planting: in play mode,
  with a seed selected in the hotbar, tap an empty plot: the avatar walks there and plants.
  Tapping a ripe plot walks there and harvests into the bag (stacks).
- Crops grow in real time, also while the game is closed, in 3 visible stages (sprout, half,
  ripe). Growth uses times passed in (no Date.now in shared/). No watering in v1.
- Crops (all numbers in shared/data/crops.json): turnip (seed 4 gold, 5 min, worth 10),
  potato (seed 6, 15 min, worth 16), carrot (seed 8, 30 min, worth 22), pumpkin (seed 15,
  2 h, worth 50), glowcap mushroom (no seed for sale; 1 glowcap spore drops from 5% of
  dungeon chests; 1 h, worth 40). One harvest gives 1 to 2 crops.
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
- Light comes from the top-left: top faces lightest, left faces medium, right faces darkest.
  1 px dark outline. No anti-aliasing.
- Sizes (px): avatar 32x64. Chair 32x48, table 64x56, sofa 80x56, bed 64x80, bookshelf
  56x80, lamp 24x48, plant 32x48, rug 80x56, barrel 40x48, crate 40x40, bench 64x40, desk
  64x56. Chests 48x40. The anchor of every sprite is the bottom center of its footprint.
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
- No loot boxes and no real-money purchases. Loot comes only from play.
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
- At the end of each step, update CLAUDE.md with new files, conventions and the current
  state. Out of date notes confuse later sessions.
- Do not generate art with any tool unless I ask for it in that step.
- I work with Claude Code on my phone or on my PC. The repo is on GitHub and every push to
  main is deployed by GitHub Pages (https://bithus.github.io/pixel-hotel/), so I can test the
  game on my phone through that link. Commit and push at the end of every step.

CURRENT STATE (kept up to date by the AI at the end of each step)
Steps 1 (project skeleton), 2 (room view), 3 (avatar and walking), 4 (furniture), 4b (placing
and the item menu), 5 (inventory, UI, chat, local saving, camera intro; the bag reworked to the
docs/UI-REFERENCE.md layout with parchment panels), 5b (sitting and lying; lying reworked after
5b: drawn inside the bed only), 7 (shop, gold and upgrades; serving at the counter added after
it), 7b (room shapes, character creation, the new-game intro), 8 (dungeon logic) and 9 (the
dungeon in the game: view, HUD, screens, crafting, the Blacksmith), 9b (farm and cooking) and 9c
(mine and forge) are done, and so is the UI polish step (after 9c, see UI POLISH). The atmosphere
step (lighting, shadows, backdrop, dust, sound; see ATMOSPHERE) is done too. Step 6 (docs/STYLE.md) has not been done yet. Next (docs/NEXT-STEPS.md):
turn on dungeon round 2 and tune it with the simulation, then step 6 (art), then step 10.

Layout:
- package.json: npm workspaces (shared, client, server). Root scripts: dev (client Vite dev
  server), build (client), test (vitest run), typecheck (tsc in every workspace).
- tsconfig.base.json: strict, noUncheckedIndexedAccess, moduleResolution bundler, noEmit.
  Imports inside shared/ and client/ use the .ts extension (allowImportingTsExtensions).
- vitest.config.ts: tests are *.test.ts files next to the code (shared, client, server).
- .github/workflows/deploy.yml: the deploy. Every push to main: Node 22, npm ci, npm run build
  -w client, client/dist goes to GitHub Pages (https://bithus.github.io/pixel-hotel/; repo
  Settings -> Pages -> Source: GitHub Actions). The site lives under /pixel-hotel/, so the vite
  base stays './' (relative asset paths): never use absolute paths like '/assets/...'.
- netlify.toml: the old Netlify deploy (stopped: free plan credits used up). Kept for now.
- shared/src: config.ts (all constants), types.ts (data types, incl. Point and Rect),
  room.ts (Room, RoomKind, createRoom, floorRect, wallBandRect, left/rightBorderRect,
  bottomBorderRects, doorRect, doorZoneRect, roomBoundsRect, rectInside, rectInsideFloor,
  rectsTouch, rectsOverlap), nav.ts (NavGrid, buildNavGrid, findPath, smoothPath,
  lineOfSight, segmentTouchesRect, inflateRect, cell helpers), minHeap.ts (A* open list),
  avatar.ts (Avatar, AvatarLook, AvatarState ('idle' | 'walk' | 'sit' | 'lie'), walkAvatar,
  facingFor, pathLength, slidePoint), view.ts (Camera, screenToWorld, worldToScreen, fitZoom, centerCamera,
  zoomAt, panBy, clampCamera, snapCamera, settleZoom, easeZoom, cameraCenter, cameraAt,
  introZoom, introCamera, containCamera), api.ts (GameAPI interface, RoomState, Inventory,
  PlaceAt, SitResult, ItemsResult), palette.ts (Endesga
  32 hex list, the only place it lives), furniture.ts (FURNITURE_TYPES, getFurnitureType,
  footprintSize, footprintRect, snapCoord, nextFacing, fitsRoomKind, ridersOf, itemBlockers,
  doorPoint, doorReachesMiddle, canPlace, snapToSurface, planPlacement, rotateQuarter,
  moveItem, pickUpItem, standPointFor (shop customers only)), seats.ts (step 5b: SeatSpot,
  hasSeats, seatSpots, headDirection, headPoint, approachPoints, freeSeatsByTap, approaches,
  bestApproach, approachPath,
  planSit, SitPlan, onSeat, standUpSpot), placing.ts (step 4b: PlacingSession,
  startNewPlacing, startMovePlacing, moveGhost, rotateGhost, planGhost, confirmPlacing (null =
  refused while invalid), cancelPlacing (exact restore), rotateInPlace (null = does not fit),
  footprintCenter), index.ts (re-exports).
  nav.ts also exports reachableCells and nearestFreeCell.
  Step 5: materials.ts (MATERIAL_TYPES, getMaterialType, isMaterialId), gameState.ts
  (GameState: player, look, rooms, items (ALL furniture; roomId null = inventory), hotbar,
  bag (BagLayout), currentRoomId, nextUid, ledger; ChatLine), ledger.ts (applyChange: the ONE function for gold,
  material and new-furniture changes; writes a LedgerEntry; null if something would go below
  0), newPlayer.ts (createNewPlayer(config, at), DEFAULT_NEW_PLAYER, styleKey, arrangeState),
  inventory.ts (inventoryItems, furnitureStacks (stacked by type, furniture.json order),
  countInInventory, nextInventoryUid, materialStacks), bag.ts (BagTab, SlotArea, SlotRef,
  BagLayout, SlotLayout, emptyBag, arrangeSlots / arrangeForInventory, canMoveBetween,
  moveSlot (move or swap), hotbarToBag, sortBag, stackBag),
  chat.ts (cleanChatText), save.ts (SaveFile, saveKey, toSaveText, readSave, MIGRATIONS,
  isGameState).
- shared/data/materials.json: wood 3, cloth 6, bone 4, crystal 15 (+ a placeholder icon color).
- shared/data/furniture.json: the 12 starter furniture types (step 4), all box placeholders.
  Import it as '@pixel-hotel/shared' (TypeScript source, no build step).
- client/src/main.ts: Pixi app (resolution = devicePixelRatio, nearest scaling). Opens
  LocalGameAPI, enters the saved current room (openRoom: draw room, items, avatar in the door
  zone, camera intro), keeps the camera, wires the HTML UI. Taps call api.walk / api.sit; the
  ticker animates the returned path with walkAvatar. Refits the camera on window resize.
- client/src/api: localGameAPI.ts (LocalGameAPI implements GameAPI + LocalSaves (export,
  import, restore backup, new game); also debugSetBlockers), saveStorage.ts (SaveStorage
  interface, browserStorage (localStorage), memoryStorage (tests)). localGameAPI.test.ts covers
  new game, placing / pick up, rooms, save/load, export/import, damaged and old saves.
- client/src/render: roomView.ts (RoomView: world container with floorLayer, rugLayer (holds
  the `rugs` DepthLayer), debugLayer, wallLayer, objects, ghostLayer; call view.update() each
  frame), depthLayer.ts (DepthLayer: a y/x/uid-sorted list; uses Pixi zIndex sorting),
  depthOrder.ts (DepthKey with optional `sub`, compareDepth, itemDepthKey, avatarDepthKey,
  tested), furnitureArt.ts (boxesForFacing, surfaceHeight, drawFurniture, tested),
  furnitureSprite.ts (FurnitureSprite: one item's art at its anchor, lifted when on a
  surface), itemViews.ts (ItemViews: one sprite per placed item, sync(items, hidden), uidOf
  for hit testing, screenBounds(uid), shake(uid) + update(dtMs) for a refused rotate), bareStyles.ts (bare floor texture made in code, bare wall colors),
  colors.ts (shade/desaturate for placeholder art), cursorCross.ts (screen-space cross),
  avatarSprite.ts (AvatarSprite: box placeholder 32x64, down/up/right drawn, left = right
  mirrored, 1 px dark warm outline, 2 px bob every WALK_BOB_MS while walking; step 5b poses:
  sit (upper body lowered 14 px, bent legs; down/up/right, left mirrored) and lie (setLying:
  the lieArt.ts drawing, tied to the bed's anchor)), lieArt.ts (lyingRects: only the head and a
  little of the shoulders on the pillow, turned so the top of the head points to the pillow end,
  then the bed's own 'cover' boxes drawn over them, so the avatar looks tucked in; everything
  inside the bed's drawing in all 4 facings, tested), seating.ts (Seating: the seat goal, the
  SEAT_SLIDE_MS slide onto a sit seat (lying has no slide: the avatar is put on the seat at once
  and kept there), the pose and the lying drawing; stillThere / standUp).
  furnitureArt.ts also has drawFurniture(type, facing, role) and roleFloorRects (pillow, cover).
  RoomView has a debugLayer (above rugs, below the wall) for debug drawings.
- client/src/debug/blockers.ts: BlockersDebug (debug only, not a game feature): drawn
  rectangles that block navigation, a drag preview, and the faint blocked-cell overlay.
- client/src/input/cameraControl.ts: the input rule below (pan, zoom, tap, draw hook). Uses
  Pixi federated events on the stage.
- client/src/input/cameraIntro.ts: CameraIntro (the room intro; cancelled by onGestureStart).
- client/src/ui/debugLabel.ts: HTML label with world x, y and zoom (only while Debug is on).
- client/src/ui/blockersButton.ts: "Blockers (K)" toggle and "Clear" (left, only while Debug
  is on), plus the K key (B is Build).
- client/src/ui (step 5): ui.css (THE frame style and all UI CSS; the pixel fonts Pixelify Sans
  and Jersey 15 (digits), both SIL OFL, are hosted in client/src/fonts with their licenses),
  panelShell.ts and layoutVars.ts (UI polish step, see UI POLISH), dom.ts (el, textButton,
  iconButton, typing), pixelIcons.ts (pixel-map SVG icons: bag, avatar, chat, gear, coin,
  chair, wood, sort, stack, hammer), format.ts (shortNumber: 1.2k, tested),
  itemIcon.ts (inventory icons: a small version of the boxes / a material box; fitRects tested),
  press.ts (tap / long press / drag on HTML slots), panels.ts (one side panel open at a time;
  adds the ✗ close button),
  sideButtons.ts (right-edge column), buildMode.ts (play / build mode, Build button, screen-edge
  border, B and Escape), infoPanel.ts (gold, room name, Hotel / Shop), hotbar.ts,
  bagPanel.ts (the inventory panel of docs/UI-REFERENCE.md: icon tabs, hotbar row, 36-slot
  grid, Sort / Stack, gold strip; picking up and dropping stacks; slotRefOf), avatarPanel.ts,
  chatPanel.ts (log + input),
  chatBubbles.ts, settingsPanel.ts, toast.ts.
- client/src/build/placer.ts: Placer (one placing session + the ghost drawing; startNew takes
  an inventory item of the type (false if none), place() asks hooks.commit (the GameAPI),
  rotate, cancel, drag, screenBounds). client/src/ui/placeBar.ts: floating ✓ ↻ ✗ bar above the ghost (Enter,
  R, Escape). client/src/ui/itemMenu.ts: item menu (build mode: Move, Rotate, Pick up) + name card.
  client/src/ui/anchorAbove.ts: puts a floating element above a screen rect, inside the screen.
- server/src/index.ts: placeholder only (step 10).
- Step 7 (shop, gold, upgrades):
  - shared/data/styles.json (floor/wall styles: bare, wood_planks, stone_tiles, red_carpet;
    bare, plaster, wood_panels, brick; the crypt styles come in step 8). shared/data/furniture.json
    gained the shop types: counter (noPickup, not in the catalog), stall_table (3 slots, not in
    the catalog), shelf (3), display_case (4), sign and banner (wall items), shop_rug. All have
    category 'shop_furniture'. Lamp and plant are placeIn 'both' with appeal 4 and 3.
  - shared/src: styles.ts (STYLE_TYPES, findStyle, getStyle, stylePrice, styleAppeal), rng.ts
    (seededRng (mulberry32), rngInt, rngPick; for tests, tools and LocalGameAPI's debug loot),
    shop.ts (ShopState, emptyShop, slotItems, allSlots, slotAt, putOnShelf, takeFromShelf,
    setPrice, returnOrphanLoot, shopAppeal, customerIntervalMs, chooseCategory, rollTolerance,
    cheapestIn, decide, visit, recordSale, simulateShop (maths only, capped at 8 h), lootTypeId,
    lootCategory, lootBaseValue, typeName, typeBaseValue, validPrice), customers.ts (Customer,
    ShopEvent, stepShop (the live customers: timer, walk, decide, queue, pay), queueSpots,
    findCounter, tillPoint, repathCustomers, settleCustomers, customerLook), economy.ts
    (catalogPrice, catalogTypes, buyCatalog, unlockStyle, applyStyle, isStyleUnlocked,
    upgradeCost, upgradeRoom, catchUpShop), testState.ts (test helpers: ledgerGold,
    ledgerMaterials; not exported). furniture.ts gained canPickUp. newPlayer.ts gained
    addShopStartItems (save migration 2 -> 3).
  - client/src/render: styleArt.ts (floorTexture, wallTexture, stylePreviewUrl: code-drawn
    style art), slotGoods.ts (goods drawn small: at FurnitureType.slotSpots when facing down (the
    shelf's three boards, inside the display case), else spread along the top),
    customerViews.ts (CustomerViews: customers animated along their paths), lieArt.ts.
    ItemViews.setGoods draws the goods; wall items are in the objects layer.
  - client/src/ui: shelfPanel.ts, catalogPanel.ts, roomPanel.ts, shopFeedback.ts (sale floats,
    the away summary, the hint box). pixelIcons gained book, house and the reaction faces
    (big_smile, smile, shrug, frown). chatBubbles.addNode shows a reaction bubble.
  - tools/simulate-economy.ts (npm run simulate, uses tsx): cheap / fair / greedy prices, appeal
    0 and 60, 6 items, 1 h and 8 h; prints gold, items sold, time on the slot, blocked slot time.
    tools/tsconfig.json is part of npm run typecheck.
- Step 9c (mine and forge, section 10c):
  - Data: shared/data/forge.json (orePerBar 3; smelting copper/iron/mithril bar with fees 2/4/8;
    pieces: copper_sword, iron_sword, mithril_sword (weapon), leather_armor, iron_armor,
    mithril_armor (armor), steel_pickaxe (pickaxe), each with `needs` (the piece it replaces, null =
    first tier) and `bars`). gear.json now holds only the health potion. materials.json gained
    copper_ore 5, iron_ore 8, mithril_ore 15, copper_bar 18, iron_bar 30, mithril_bar 55, gem 60
    (group 'material', so shop category 'materials'; ore and bar values chosen by the AI, the
    owner may tune them). types.ts: OreId, BarId, GearId (the 7 pieces), Player.mineVisits, ledger
    reasons 'smelt', 'forge', 'mine_bank'.
  - gear.ts: GEAR_PIECES, getPiece, ownedPiece(gear, slot), ownedWeapon / ownedArmor /
    ownedPickaxe (Player.gear holds at most one piece per slot; old saves' iron_sword and
    leather_armor ARE the iron sword and leather armor tiers: no gear migration). The iron sword is
    7-9 now (was 6-8). forge.ts: FORGE, smeltRecipe, smelt (ledger 'smelt'), nextPiece, canForge,
    forgePiece (the next piece of its slot only; replaces `needs`; ledger 'forge'). economy.ts
    buyGear sells potions only.
  - The mine reuses the dungeon: a mine visit is a DungeonRun with place 'mine' (crypt runs have
    place 'crypt'). generate.ts: the layout code takes a rules object (generateLayout; crypt
    floors keep exactly the same rng order); generateMine(seed, visit): MINE_ROOMS_MIN..MAX rooms,
    0..MINE_ENEMIES_PER_ROOM_MAX slime or bat per room (not the spawn room), no chests, no exit
    (map.exit = NO_EXIT, off the map), MINE_ROCKS_PER_ROOM_MIN..MAX rocks per room (rollRockKind by
    ROCK_WEIGHTS; mithril from MITHRIL_FROM_VISIT). run.ts: Rock { id, kind, hitsLeft, x, y },
    DungeonRun.place / rocks / lanternEndsAt, RunPlayer.targetRockId / pendingSwing / pickReadyAt /
    hitsPerSwing / minesMithril, newMineRun, inputs click_rock and leave (mine only), events
    swing, too_hard, rock_broken, lantern_out. step.ts: click_rock works like click_enemy (walk
    within MINE_REACH, one swing per tap, PICKAXE_COOLDOWN_MS); mithril without the steel pickaxe =
    'too_hard'; a broken rock gives ROCK_ORE_MIN..MAX ore + GEM_CHANCE gem into the run bag; the
    lantern (MINE_LANTERN_MS of run time) ends the visit like leaving; mine kills give xp but no rare
    drop; 0 hp in the mine (carriedOut) loses floor(half) of each ore, keeps the rest, gems and
    potions. bank.ts startMine (free, level >= MINE_UNLOCK_LEVEL, potions along, mineVisits + 1);
    finishRun banks a mine visit with ledger 'mine_bank'.
  - Config: MINE_LANTERN_MS, MINE_ROOMS_*, MINE_ENEMIES, MINE_ENEMIES_PER_ROOM_MAX,
    MINE_ROCKS_PER_ROOM_*, RockKind, ROCK_HITS, ROCK_WEIGHTS, MITHRIL_FROM_VISIT, ROCK_ORE_*,
    GEM_CHANCE, PICKAXE_COOLDOWN_MS, MINE_REACH, MINE_DEATH_ORE_LOSS, MINE_HINT 5 (HINTS[5]: the
    mine opens; LocalGameAPI only shows it from MINE_UNLOCK_LEVEL; going in finishes it; the Map
    button glows while it shows). SAVE_VERSION 8.
  - GameAPI: mineStart, smelt, forge. RunResult gained place and lanternOut. A mine visit runs
    through getRun / dungeonInput / dungeonAdvance and the same DungeonScreen as the dungeon.
  - client: the Map's Mine card opens the visit (free; "Enter this?" first). dungeonArt.ts
    drawBlocks(map, place) (mine: grey rock walls, brown-grey floor, warm wall lanterns), drawRock
    (grey boulder with ore-coloured flecks, cracks per hit), ROCK_HEIGHT. DungeonView: rocks in the
    depth list (seen = drawn, shake when hit, rockAt for taps), no exit stairs in the mine, the ring
    shows the pickaxe cooldown too. DungeonScreen: taps on rocks, leave(), effects for the new
    events. infoPanel: "Mine" and the lantern bar (pixel icon 'lantern'). runBar: in the mine the
    food button and run gold hide and a Leave button shows. runScreens: mine titles (back, lantern
    out, carried out). workshopPanel: the Forge tab (smelting | the gear tree per slot: start
    piece, tiers, current highlighted, next with bars and Forge; .wide panel on desktop, stacked
    on a phone); the Blacksmith tab sells potions only.
  - tools/simulate-dungeon.ts: the bot also eats food; a table of survival per gear tier
    (starting, copper, iron, mithril sword + armor) at 350 / 500 / 700 ms, without and with a lunch
    box (carrot soup + 2 potato stews). Round 2, 300 runs (step 9c): starting 90 / 65 / 45%,
    copper 99 / 93 / 70%, iron 100 / 100 / 99%, mithril 100%; with food: starting 100 / 98 / 82%,
    copper 100 / 100 / 99%, iron and mithril 100%. Round 1 is 100% everywhere.
  - Tests: shared/src/dungeon/mine.test.ts, gear.test.ts (forge), save.test.ts (migration 7),
    client/src/api/mineAPI.test.ts.
- Step 9b (farm and cooking, section 10b):
  - Data: shared/data/crops.json (turnip, potato, carrot, pumpkin, glowcap: seed id and name,
    seedPrice (null = not sold: the glowcap spore), seedValue, growMinutes, baseValue, colours),
    shared/data/food.json (the 5 recipes: inputs, effect { kind: heal | attack | max_hp |
    attack_cooldown, amount }, baseValue). roomShapes.json gained the 'farm' shape (kind 'farm',
    576x384, 704x480, 832x576); styles.json gained grass (floor) and hedge (wall), not in the
    catalog. Owner may tune: the food baseValues (a bit above their ingredients), seedValue = the
    seed price (spore 12) were chosen by the AI; the brief gives none.
  - Stackable goods: MaterialId now covers the dungeon materials plus seeds, crops and food
    (types.ts BaseMaterialId, SeedId, CropId, FoodId; MaterialType.group 'material' | 'seed' |
    'crop' | 'food'). materials.ts builds MATERIAL_TYPES from materials.json + crops.json +
    food.json and has CROP_TYPES, FOOD_TYPES, materialGroup, isSeedId, isFoodId, cropOfSeed,
    getCropType, getFoodType. They all live in player.materials, stack in the bag's Materials tab,
    go on shop slots (shop.ts lootCategory: crops and food = new category 'food', seeds =
    'materials') and through the ledger.
  - shared/src: farmLayout.ts (farmPlotCount, plotRect, plotRects, plotCenter, potRect,
    fixedBlockers (the pot), noPlaceRects (plots + pot), plotAt), farm.ts (Plot { crop,
    plantedAt }, FarmState { roomId, plots }, emptyFarm, growPlots, growMs, plant, stageOf (sprout
    for the first half of the time, half, ripe), ripeInMs, harvest (HARVEST_MIN..MAX), plantPlot
    (ledger 'plant'), harvestPlot (ledger 'harvest'), seedsForSale, buySeeds (ledger 'seeds'),
    farmCounts), cooking.ts (canCook, cook: ledger 'cook'). Config: FARM_UPGRADE_COST (200, 600),
    FARM_PLOTS (20 top-left corners, all inside the level 1 farm), FARM_PLOTS_PER_LEVEL (6, 12,
    20), FARM_PLOT_SIZE 32, COOKING_POT (fixed spot), SEED_PACK 5, LUNCH_BOX_MAX 3,
    GLOWCAP_SPORE_CHANCE 0.05, MINE_UNLOCK_LEVEL 3, START_FARM_ROOM_ID 3, FARM_HINT 4.
  - The farm is a Room (kind 'farm') in GameState.rooms plus GameState.farm (the plots) and
    Player.farmRoomId. createNewPlayer makes it (level 1, 6 empty plots). upgradeRoom works for it
    (upgradeCost uses FARM_UPGRADE_COST; growPlots adds empty plots; furniture standing on a new
    plot goes back to the bag, like the door zone). fitsRoomKind: the farm takes home furniture
    (placeIn 'hotel' or 'both'). canPlace refuses any footprint (rugs too) over a plot or the
    pot. furniture.ts roomBlockers(room, items) = itemBlockers + the pot: use it for nav grids.
  - Dungeon: RunPlayer gained food (the lunch box), buffs (FoodBuff 'attack' | 'max_hp' |
    'attack_cooldown') and attackCooldownMs (350, or 300 with the broth). Input { t: 'eat' } eats
    the FIRST food in the box that does something now (healing food: when hurt and the potion
    cooldown is ready, and it starts that cooldown; a buff: when that kind is not taken yet);
    food that would do nothing stays in the box. Event 'eat'. A level up keeps the pie's +10 max
    hp. Death empties the box into run.lost. bank.ts packLunch / startRun(state, seed, at, round,
    lunch) (ledger 'lunch_box'); finishRun gives back the food not eaten. A chest that opens rolls
    GLOWCAP_SPORE_CHANCE for one glowcap_spore (also an extra rng call).
  - bag.ts: fitsArea(area, id): the hotbar takes furniture AND seeds. A seed type the player gets
    for the first time goes to a free hotbar slot (else the Materials tab). moveSlot checks both
    ids of a swap; hotbarToBag puts a seed back in the Materials tab.
  - GameAPI: getFarm (FarmView { roomId, level, plots, at }), plant, harvest (HarvestResult),
    buySeeds, cook, dungeonStart(lunch). Planting finishes the farm hint.
  - client: farm/farmScreen.ts (FarmScreen: plots on the rug layer, the pot in the depth-sorted
    objects, ripe markers in RoomView.markerLayer; play mode taps: empty plot = walk there and plant
    (pickSeed: the selected hotbar seed, else the first seed the player has), ripe plot = walk and
    harvest, growing plot = "ripe in n min", the pot = the Cooking panel; the action happens in
    arrived() when the walk ends), farm/farmArt.ts (drawPlot, drawCrop, drawPot, drawRipeMarker).
    ui/travelPanel.ts (the Map panel: cards Hotel, Shop, Farm, Mine (locked: "Opens at level 3",
    since step 9c it opens the mine), Dungeon), ui/cookingPanel.ts (foodEffectText),
    ui/lunchPicker.ts (in the dungeon's "Enter this?" panel: confirmBuy gained `extra`). Catalog
    gained the Seeds tab (Buy = 1, xN = SEED_PACK, both ask first). The run bar gained the food
    button (E key). The hotbar shows seeds (tap = pick that seed). styleArt draws grass and hedge.
    infoPanel: the Hotel / Shop switcher is gone (ROOM_NAMES); the Map button sits under the quest
    button. The Room panel on the farm shows level, plots and Upgrade (no style pickers).
  - Tests: shared/src/farm.test.ts, cooking.test.ts, dungeon/food.test.ts, bag.test.ts (seeds),
    save.test.ts (migration 6), client/src/api/farmAPI.test.ts (the whole loop through the API).
- Step 9 (the dungeon in the game):
  - shared: GameState.run, api.ts RunView / RunResult / RunUpdate and the dungeon methods,
    DungeonRun.lastHitBy, the 'mimic' event's chestId, config MIMIC_WAKE_MS, RUN_SAVE_EVERY_MS,
    DUNGEON_HINT, the dungeon view numbers (DUNGEON_LIGHT_PX ... LEVEL_FLASH_MS).
  - client/src/dungeon: dungeonScreen.ts (DungeonScreen: the run loop, taps, effects, HUD,
    screens), dungeonView.ts (DungeonView), dungeonArt.ts (drawBlocks, drawExit, drawEnemy,
    drawChest, ENEMY_HEIGHT), fog.ts (litBlocks, blockIndex, FogMemory; tested), floatTexts.ts.
  - client/src/ui: runBar.ts (the 12-slot run bag, run gold, potion button), runScreens.ts
    (showResume, showExitChoice, showRunResult, bagLines, flashScreen), workshopPanel.ts (tabs
    Crafting and Blacksmith). infoPanel.ts gained setStats (level + xp bar, always) and setRun
    (floor name and hp bar in the dungeon; the room switcher hides). pixelIcons gained dungeon,
    workshop, sword, armor, potion, heart. confirmBuy takes price null (free). PanelName gained
    'workshop'. Side column (since step 9b): Quest, Map, Bag, Build, Dungeon (badge: the key cost or 'free'), Catalog,
    Workshop, Room, Avatar, Chat, Settings.
  - client/src/api/dungeonAPI.test.ts: the step 9 API tests.
- Step 8 (dungeon logic; everything pure, in shared/):
  - Data: shared/data/loot.json (wooden_chest 2 rolls, golden_chest 3, enemy_rare (70% crystal,
    30% crypt furniture), boss (1-2 throne_piece)), levels.json (maxLevel 8, totalXp per level),
    gear.json (iron_sword, leather_armor, health_potion: prices, effects, potion heal / cooldown /
    carryMax 3), recipes.json (the 7 recipes; inputs as { material: qty }; makesKind furniture,
    floor or wall). furniture.json gained the crypt furniture (category 'crypt_furniture', theme
    'crypt', inCatalog false, placeIn both): bone_chair (1 seat), skull_lamp (onSurface),
    coffin_table (surface), wall_torch (wall), bone_throne (1 seat). styles.json gained
    crypt_flagstones and bone_wall (inCatalog false; the client draws them bare until step 6/9).
    materials.json gained throne_piece (10). The gear prices, potion numbers and level thresholds
    are no longer in config.ts (they live in the data files).
  - shared/src: levels.ts (MAX_LEVEL, LEVEL_TOTAL_XP, levelForXp, addXp (returns the player with
    the new level, max 8), xpForNextLevel, maxHpAt, attackBonusAt), gear.ts (GEAR_TYPES, getGear,
    POTION, ownedWeapon, ownedArmor), crafting.ts (RECIPES, getRecipe, canCraft, craft(recipe,
    state, at): ledger reason 'craft'; a style recipe unlocks the style), economy.ts buyGear (gear
    once, ledger 'blacksmith'; a potion while potions < 3, ledger 'potion').
  - shared/src/dungeon (exported from the shared index): run.ts (DungeonMap, Enemy, Chest,
    BagItem, RunBag, RunPlayer, RunEvent, DungeonRun, DungeonInput, combatStats, newRun), grid.ts
    (isFloorBlock, blockCenter, blockAt, onFloor, dungeonNavGrid: the shared NavGrid with 16 px
    cells, a cell is blocked on a wall block, NO avatar radius because corridors are 1 block wide;
    cached per map), generate.ts (floorRng(seed, n), enemyHp, makeEnemy, blockDistances,
    generateFloor(seed, n, round) -> { map, enemies, chests }), loot.ts (LOOT_TABLES, getLootTable,
    rollDrop, rollLoot), runBag.ts (addToBag (12 slots, materials stack to 10, gold no slot, the
    rest is left behind), bagLoot), step.ts (step, isPaused, exitChoices, distance), bank.ts
    (runIsFree, startRun (pays the key unless gold < 10, takes the potions along), finishRun
    (ledger 'dungeon_bank', addXp, potions back)). testRun.ts holds test helpers (not exported).
  - tools/simulate-dungeon.ts (npm run simulate:dungeon [runs] [round]): the bot of step 8 at
    350 / 500 / 700 ms and 500 ms with sword and armor, both rounds.

Conventions:
- UI LAYOUT RULE (step 5). The room fills the whole screen; all UI sits on top of it at the
  edges, never in solid bars. Every frame, button, slot and panel uses the one frame style in
  client/src/ui/ui.css, as described in docs/UI-REFERENCE.md section 3 (reworked in the UI
  polish step, see UI POLISH below): a layered wooden frame around speckled parchment, darker
  inset sections, dense slots, raised buttons, dark name plates, dark brown text, square corners,
  pixel font, at least 44 px touch size, no default browser buttons. Places:
  - Top-left: the info panel, two short lines: coin + gold, then room name, level and a thin xp
    bar (hp and lantern bars under it in the dungeon and the mine).
  - Right edge: one column of square icon buttons: Quest, Map, Bag, Build, Dungeon, then More
    (a small grid with labels: Catalog, Workshop, Room, Avatar, Chat, Settings). From 900 px wide
    every button stands in the column. New screens add a button in sideButtons.ts (with a label
    = in the More grid) and a panel.
  - Panels: built with panelShell.ts; left of that column, always ending above the hotbar and
    scrolling inside; one at a time (panels.ts), each with a 36 px ✗ on its top-right corner. On
    a phone (<= 680 px) they start under the info panel and span the width (never half over the
    info panel). A tap on the room closes the open panel. Escape closes it. The bag is a bottom
    sheet above the hotbar on a phone.
  - Bottom center: the hotbar (6 slots of 44 px, icons only, a count on every stack, the last
    used slot is warm orange). Hidden while placing.
  - Floating bars (✓ ↻ ✗, the item menu) sit above their target (anchorAbove). Toasts appear
    just above the hotbar. Speech bubbles are cream with a dark outline and a small tail.
  - Debug things (x/y/zoom label, Blockers buttons) show on the left only while Settings ->
    Debug is on (off by default). Keys: I bag, B build mode, Enter chat, 1-6 hotbar, Escape
    closes (a panel first, then the placing session, then build mode), K blockers (debug).
- UI POLISH (owner's request after step 9c; docs/UI-REFERENCE.md sections 2 to 4 hold the rules):
  - Fonts: Pixelify Sans for letters; every digit comes from Jersey 15 (SIL OFL, client/src/fonts,
    license next to it) through the @font-face 'Pixel Digits' with unicode-range 0-9, first in
    --font. Never set a font-family without var(--font), or digits become unreadable again.
  - ui.css parts: .frame (9-slice SVG border image: outline, wood with a light top-left edge,
    corner nails, inner bevel; speckled parchment; 2 px hard shadow), .inset (darker section),
    .slot, .btn (pressed = 2 px down without shadow; .on stays pressed and is warm orange;
    disabled = flat and darker; .small = 36 px with a 44 px touch area), .plate (dark name plate),
    .divider (line with diamonds), .price-short (red). All colours are Endesga 32; the frame
    images are SVG data URIs in :root.
  - After the owner's example screenshots (general traits only, never copied, never in the repo):
    slots are light cream on a darker .tray (bag sections, hotbar, run bag); the bag's hotbar row
    is a dark wooden bar with a small diamond at each end; picker values sit on a light plate
    (.plate.light), dark plates are for names and titles; inactive tabs are darker wood.
  - ui/panelShell.ts: panelShell(parent, cls, title) -> { el, tabs, frame, title, body, strip }
    (tabs on the top edge, a title plate, the scrolling body, a slim strip below), tabBar (icon
    tabs; the open one is raised, orange and shows its name), iconBox, priceTag(price, gold).
    Every side panel uses it. ui/layoutVars.ts watchLayout keeps --info-h and --bar-h (hotbar or
    run bag height) on the UI root; ui.css places panels and toasts with them.
  - Catalog: cards (2 columns on a phone, 3 from 681 px): big icon, name, price; a tap opens
    "Buy this?". Too expensive = dimmed with a red price (the confirm panel shows it red, says
    "Not enough gold." and greys out Buy). A tag only when it cannot go in the current room
    ("Shop only", "Not here"), plus Floor / Wall and Owned for styles. Seeds: the confirm panel
    has Buy 1 and Buy 5 (confirmBuy `more`, answer 'more'). confirmBuy takes `gold` and `title`.
  - Bag: bagPanel.ts shownSlots = the rows up to the last filled slot plus one empty row (tested);
    no gold in the bag; Sort and Stack sit in the strip below the panel.
  - Icons: itemIcon.ts iconCanvasSize makes the icon canvas as big as the art, so icons fill
    their slot. New pixel icons: more, hair, shirt, trousers, shoe.
  - Look pickers: icon tabs; a style is a name plate ("Hair 2  Ponytail") between two small
    square arrow buttons; the Avatar panel shows the display name on a plate.
  - Panels pop in (scale 0.95 -> 1, 120 ms), off with prefers-reduced-motion.
  - Checked with a headless browser at 360 x 740 and 1280 x 800 (all panels, confirm panels,
    character creation, shop, farm, mine, dungeon).
- ATMOSPHERE (owner's request after the UI polish; rendering, sound and data only, no rules):
  - Light sources are data: FurnitureType.light = { radius (world px), color (palette index),
    flicker (0 steady .. 1 candle) } (types.ts LightSource). furniture.json: lamp (candle stand),
    counter (the till glow), skull_lamp, wall_torch. The cooking pot uses config COOKING_POT_LIGHT.
  - Config (end of shared/config.ts): AMBIENT_LIGHT per room kind { color, strength } (a palette
    colour laid over the room with that alpha; the owner tunes the darkness here), LIGHT_PIXEL 2,
    LIGHT_RINGS 8, LIGHT_CUT (how much shade one ring takes away), LIGHT_GLOW (the alpha of the
    light's colour per ring), LIGHT_STEP_MS, FLICKER_RADIUS / FLICKER_BRIGHTNESS, DOOR_LIGHT,
    DUST_PER_LIGHT, DUST_MAX, WALK_PUFF_MS, IDLE_SHIFT_EVERY_MS / HOLD_MS, SOUND_DEFAULT_VOLUME,
    PREFS_KEY.
  - client/src/render/atmosphere.ts (pure, tested): hash01, lightRings,
    flickerAt (steps with LIGHT_STEP_MS, from a seed and the time), lightPoint, itemLights,
    ellipseRows (pixel ellipse), shadowSize, idleShift, dustLightCount, dustSpeck.
  - client/src/render/roomAtmosphere.ts (RoomAtmosphere; main.ts calls setRoom after every
    view.setRoom, setItems from syncItems (use syncItems, never itemViews.sync alone), update every
    frame with the feet of standing / walking avatars, puff, setLighting). Lighting (reworked after the owner's
    playtest: brighter and warmer, glowing pools; general traits of cozy tavern games only) = a
    light map RenderTexture (1 texel = LIGHT_PIXEL art px) shown as ONE normal layer
    (RoomView.lightLayer): empty outside the room, the ambient shade on it; every light takes the
    shade away in stepped rings (Graphics with blend 'erase') and then lays its own colour over the
    room in the same rings with a small alpha (the warm glow); the door's daylight patch (hotel and
    shop) works the same way. It is
    redrawn only every LIGHT_STEP_MS or when something changed. Shadows: two-shade pixel ellipses in
    RoomView.shadowLayer (under the objects) for blocking floor items, the pot and avatars
    (AvatarSprite(look, false) = no built-in shadow; the dungeon keeps the built-in one). Dust:
    1 px specks in RoomView.airLayer, the walk puff in shadowLayer.
  - client/src/render/backdrop.ts (Backdrop): dark planks that move with the camera plus a stepped
    vignette, baked into ONE opaque screen picture that is redrawn only when the camera moves. Under
    view.world on the stage; hidden in the dungeon / mine (they keep their own look).
  - CustomerViews: standing customers shift 1 px sideways now and then (AvatarSprite.setShift).
  - Sound: client/src/audio/sound.ts (Sound; Web Audio, no files): step, coin, bell, pop, click,
    hit, hurt. The context is made on the first tap or key. main.ts: a step per walk bob, coin at a
    'sale' event, bell when a new customer id appears, pop when a placement is accepted, click for
    every <button> inside the UI root, hit / hurt from DungeonContext.sound (mine swings use hit).
  - Device settings: client/src/api/prefs.ts (Prefs { sound, volume, lighting }, parsePrefs,
    loadPrefs, savePrefs; tested) in SaveStorage under PREFS_KEY, NOT in the GameState (no save
    version change). Settings panel: Sound on / off, Volume slider, Lighting on / off. Lighting off
    hides the light map, the dust and the backdrop (the void is the old flat colour), so the game
    draws exactly what it drew before this step.
  - Frame time, headless software renderer at 360 x 740, dpr 2 (not a real phone; only the
    relation counts): before 27 ms, lighting off 26 ms, lighting on 63 ms (two extra full-screen
    layers). Not measured on a real phone.
- GAME API (step 5): the client changes nothing itself. Walking, sitting, placing (only
  inventory items: placeItem), moving, rotating, picking up, the hotbar, the look and chat all
  go through GameAPI; item calls return the current room's items + the inventory furniture
  (null = refused). LocalGameAPI tracks the avatar by time (walkAvatar on the elapsed ms), so a
  new path starts where the avatar is by now; the client walks the path from where it shows the
  avatar (it only jumps when that is more than 8 px off).
- SAVING (step 5): LocalGameAPI writes the whole GameState after every change to localStorage
  key 'pixel-hotel.save.v<SAVE_VERSION>' as { version, savedAt, state } (the same text is the
  exported file). One automatic backup ('pixel-hotel.save.backup'): the save as it was when the
  game was opened, or before an import / restore / new game. On open: a damaged save loads the
  backup (the damaged text is kept under '<key>.damaged'); an older version is migrated with
  save.ts MIGRATIONS, or the game resets with a message (old save kept as the backup). When the
  GameState shape changes: bump SAVE_VERSION and add MIGRATIONS[old]. SAVE_VERSION is 2
  (MIGRATIONS[1] adds an empty bag layout; arrangeState fills it).
- INVENTORY (step 5): the inventory is the player's furniture with roomId null plus
  player.materials (the counts). WHERE each stack sits is GameState.hotbar + GameState.bag
  (bag.ts): three slot areas, 'hotbar' (6), 'furniture' and 'materials' (BAG_SLOTS = 36 each).
  A slot holds a type id; every type the player has is in exactly ONE slot (hotbar or bag).
  arrangeState runs on every LocalGameAPI commit: gone types leave the bag, new ones go in the
  first free slot (a full tab grows by one slot, nothing is lost). A hotbar slot keeps its type
  when the last one is placed (dimmed), so Pick up puts it back there. The hotbar places the
  oldest inventory item of its type. Materials never go in the hotbar and cannot be placed.
  Bag panel: tap a furniture stack = place it (the panel closes). Move = drag (mouse), or
  long-press + drag (touch); a drop on a slot moves there (full slots swap), a drop elsewhere
  keeps it picked up until you tap a slot. A tap on a material picks it up, then tap a slot.
  The main hotbar takes drops too. Long-press a main hotbar slot: back to the bag. Sort =
  catalog order, packed; Stack = merge equal stacks and close the gaps (with one slot per type
  it only closes gaps). Player.unlockedStyles holds 'floor:<id>' / 'wall:<id>' (styleKey).
- CHAT (step 5): cleanChatText (one line, max 120 characters). Bubbles are HTML above the
  head, the newest lowest; they stay readingMs (at least CHAT_BUBBLE_MS), then fade over
  CHAT_BUBBLE_FADE_MS. The chat log
  (CHAT_LOG_MAX lines) is not saved and is cleared when you change rooms.
- CAMERA INTRO (step 5): each time a room opens (also after a reload): overview, then the
  intro (section 4). It ends at containCamera(camera centered on the avatar), so the screen stays
  inside the room. Any press or wheel on the room cancels it (cameraControl onGestureStart).
- World: floor is (0,0)-(w,h). Wall band is y -64..0 over the floor width. Side borders run
  x -16..0 and w..w+16 from y -64 to h+16. Bottom border y h..h+16 with the door gap.
- The camera state is unsnapped and clamped with clampCamera (screen center stays inside
  roomBoundsRect). Drawing and hit testing use snapCamera(camera) (world offset on whole
  screen px). Keeping the state unsnapped stops zoom drift.
- Screen coordinates are CSS px. The canvas renders at the full devicePixelRatio
  (resolution = dpr, autoDensity), so app.screen stays in CSS px. main.ts re-sizes the
  renderer when the ratio changes (browser zoom, other monitor). snapCamera(cam, dpr) puts
  the world offset on whole device px.
- INPUT RULE (touch and mouse):
  - A press is a TAP only if it moved less than TAP_MAX_MOVE_PX (8 screen px) and was held
    less than TAP_MAX_MS (300 ms). Anything else is a DRAG (or a LONG PRESS), and neither ever
    makes the avatar walk. What a tap does depends on the mode (client/src/ui/buildMode.ts):
  - PLAY MODE (the default): a tap on the floor, a rug or any item without seats walks
    there (the item is ignored; a blocked point walks to the nearest free cell). A tap on an
    item with seats walks to its nearest free side and sits or lies (step 5b; the item shakes if
    no seat can be reached). A long press does nothing. No item menu.
  - BUILD MODE: the Build button (hammer, right-edge column, right after Bag) or the B key
    toggles it; placing from the hotbar or the bag turns it on. Taps never walk. A tap or long
    press on an item opens its menu (Move, Rotate, Pick up); a tap elsewhere closes it. The
    Build button is highlighted and a thin warm border (.build-frame) runs around the screen
    edge. Build again, or Escape (when no panel is open and nothing is being placed), returns
    to play mode, closes the menu and cancels a placing session.
  - In both modes a tap on the room with a panel open only closes the panel.
  - Touch: one-finger drag pans. Two fingers pan and pinch-zoom freely (the point between
    the fingers stays fixed).
  - Mouse: left click taps, left-drag and right-drag pan. The wheel zooms freely around the
    cursor and glides to its target (WHEEL_ZOOM_SPEED, ZOOM_EASE_MS; cameraControl.update
    runs every frame).
  - ZOOM SETTLE: a gesture ends when the second finger lifts (pinch) or after
    WHEEL_GESTURE_END_MS (200 ms) without a wheel event. Then the zoom eases (ease-out,
    ZOOM_SETTLE_MS) to settleZoom(zoom, overview, dpr) around the gesture's focus point,
    and the camera state is snapped with snapCamera (setCamera(cam, snap = true)). The
    overview zoom stays a settle target even when zoom * dpr is not whole there. A new pinch
    or wheel cancels a running settle; a one-finger pan runs alongside it.
  - Blockers mode (debug, step 3; key K, button "Blockers (K)"): while it is on, a one-finger / left drag draws a blocking
    rectangle instead of panning (getDragMode() returns 'draw', drags go to onDraw). Two
    fingers and right-drag still pan/zoom. Taps still walk.
- NAVIGATION (shared/nav.ts): a cell is blocked if ANY part of it is outside the floor or
  overlaps a blocker grown by AVATAR_RADIUS, so every point in a free cell is at least the
  radius away from every blocker, and gaps narrower than the avatar (24 px) are never
  passable (a gap needs about 24 + 16 px to open a free cell). Line of sight fails if the
  segment touches a blocked cell (edges count). findPath returns points starting with the
  avatar's position; the client walks path.slice(1). A free but unreachable target gives
  null; a blocked target walks to the nearest reachable free cell center. If the avatar
  stands on a blocked cell (a blocker drawn on it), it leaves via the nearest free cell.
- When blockers change, the grid is rebuilt and a walking avatar re-paths to its goal.
- FURNITURE (step 4):
  - ArtBox is { dx, dy, w, d, z, h, color } for the 'down' facing: (dx, dy) is the box's
    front-left corner on the floor relative to the anchor (dy <= 0 goes back), w x d its floor
    size, z its height above the floor, h its front face height, color a palette INDEX (hex
    lives only in palette.ts). 'right' and 'up' turn the boxes on the floor, 'left' mirrors
    'right'. Boxes draw sorted by z, then back edge, then front edge. type.height is the
    tallest box extent (tested). Barrel, crate and bed are taller than the section 12 art
    sizes because their footprints are as deep as those sizes.
  - Riders: an onSurface item on a surface has onItemUid set and is drawn surfaceHeight px
    higher, right after the surface (depth key `sub`). moveItem moves and turns riders with
    the surface (riders that no longer fit go to the inventory); pickUpItem takes them along.
  - canPlace's `items` are the OTHER items (leave out the one being moved). Items on surfaces
    never block the floor. doorReachesMiddle: the free cell nearest the room middle must be
    reachable from the door point.
  - Nav blockers = debug rects + itemBlockers(items, roomId) (blocking items on the floor).
  - Placing (step 4b): tapping a hotbar or bag slot (the ghost starts in the middle of the
    screen; build mode turns on) or Move in the item menu (the ghost starts where the item is; the item and its
    riders are hidden until done) starts a placing session. A one-finger / left drag anywhere
    moves the ghost by the drag distance (getDragMode returns 'draw'); two fingers and
    right-drag still pan/zoom. No hover-follow. Taps and long presses do nothing while placing.
    Only ✓ / Enter places (disabled while red); ✗ / Escape cancels (a moved item goes back
    exactly; an inventory item stays in the inventory). After placing the session ends. Shift
    (held) turns the 4 px snap off. Items picked up go to the inventory (roomId null).
  - Item menu (build mode only, see INPUT RULE): a tap or long press (LONG_PRESS_MS, without
    moving) on a placed item opens its menu; a tap on another item opens that one's, a tap
    elsewhere closes it. Sitting is play mode only (no Sit button). Rotate turns in place (rotateInPlace) or shakes the item when it does not fit. The menu and
    the place bar follow their target every frame.
  - Hit testing: cameraControl passes the Pixi event target to onPoint; item containers are
    eventMode 'static' and ItemViews.uidOf maps a target to an item. The cursor cross, the
    avatar and the ghost layer have eventMode 'none' so they never hide an item from a tap.
  - Sitting and lying: see SITTING AND LYING (step 5b) in the notes below.

- SHOP (step 7):
  - GameState.shop (ShopState) holds only the FILLED slots { shelfUid, index, loot, price }; the
    slots themselves come from the placed items with type.slots > 0 in the shop room. A slot
    holds one unit. Putting a material on a slot takes it out of player.materials, putting a
    furniture item takes the item out of GameState.items (the slot keeps its uid and typeId);
    both through applyChange (reason 'shelf'), and taking back reverses it. The ledger's
    materials always add up to the bag. A shelf that leaves the shop (picked up, door zone on an
    upgrade) gives its goods back (returnOrphanLoot, run on every item change).
  - The customer timer (shop.nextCustomerInMs) only counts down while the shop has stock. A
    customer on the paying spot waits (phase 'pay') until ShopWorld.cashier is true; LocalGameAPI
    sets it from isServing(): the own avatar reached the spot behind the counter (api.serve,
    behindPoint = CASHIER_BEHIND_PX behind the back edge) and the counter has not moved since. Any
    new walk or sit ends serving. The 'paying' event starts the till animation (shopFeedback.ts
    createTillCoins, which also draws the coin marker while someone waits and nobody serves).
    Customers have negative ids. Gold comes in only when a customer pays at the till (ledger
    reason 'sale'). The queue is numbered 0, 1, 2 (0 = paying spot) every step; spots come from
    queueSpots (each a different free cell reachable from the door).
  - LocalGameAPI runs the shop: startClock() calls update() every SHOP_TICK_MS (100 ms); update
    steps stepShop to now and sends ShopEvents (customers, reaction, sale, slots) to onShop
    listeners. It saves when an event happened (not every step). A gap over
    SHOP_CATCH_UP_GAP_MS (10 s; also always when the game opens) uses catchUpShop: customers in
    the shop pay at once (or leave), then simulateShop for at most 8 hours; the sales become the
    "while you were away" summary (takeAwaySummary, shown once).
  - The shop is simulated wherever the player is; customers are only drawn in the shop room. A
    sale while in the hotel shows a toast.
  - Play mode: a tap on a table, shelf or case in the shop opens the shelf panel (no walking).
    A tap on the counter walks behind it (it shakes with a toast when there is no way). The shelf
    panel shows one card per slot: icon, name, sale history, Take, and a price row (− coin +).
    Build mode: as before (item menu); the counter's menu has no Pick up.
- CATALOG, STYLES, ROOMS (step 7): the Catalog button (book, key C) opens tabs Home, Shop and
  Decor; prices are baseValue * 3. Buying puts furniture in the bag, or unlocks a style
  (ledger reason 'style') and puts it on the room the player is in at once (applyStyle, free;
  change it back in the Room panel). The first catalog purchase of a game (furniture or style) goes
  straight into placing with a pop (Placer.pop / tick) if it fits the current room. The Room
  button (house) shows level, size, appeal (shop), Upgrade, and the floor and wall pickers:
  picking applies the style at once (free; that is the live preview). Upgrading reopens the
  room without the camera intro.
- BUYING ASKS FIRST (after step 8): every Catalog buy (furniture, floors, walls) and every room
  upgrade opens ui/confirmBuy.ts first: a centered "Buy this?" panel over a dim shade with the
  picture, name, what it does and the price; Cancel / Buy for N. Enter buys; Escape, ✗ or a tap on
  the shade cancels (it takes those keys before the panels and the chat do).
- TEXTS (after 7b): every text on screen stays at reading pace: shared/src/text.ts readingMs
  (at least TEXT_MIN_MS 4 s + TEXT_MS_PER_WORD 0.35 s per word), then fades over TEXT_FADE_MS.
  Toasts (toast.ts; a tap hides them) and chat bubbles use it. docs/UI-REFERENCE.md has the rule.
- HINTS (step 7): config HINTS, GameState.hintsDone counts the finished ones, shown one at a
  time in the hint box under the info panel. The hint stays until the player taps it ("tap
  to continue ▸"); a tapped hint stays away until the next one comes or the player taps the
  quest button (after step 8): the scroll icon at the TOP of the right-edge column, hidden when
  there is no quest, selected ('on') while the quest card shows, and blinking warm ('glow') while
  a quest is still going but its card is closed (HintBox.toggle / onChange in shopFeedback.ts).
  The quest card (.quest-card) says "Quest n of N" (N = HINTS.length, 5 since step 9b: the farm quest "plant your first turnip" is number 5), the task and "tap to hide". It opens to the
  left of the quest button with a small tail pointing at it; when that would overlap the
  top-left info column (phones) it goes under that column instead, without the tail. It steps
  aside while a side panel is open (setCovered). 1 is done by the first buy (a style as the first
  buy also skips 2), 2 by placing an inventory item, 3 by putting an item on a slot.
- STEP 7b (room shapes, character creation, intro):
  - shared/data/roomShapes.json, shared/data/clothing.json. room.ts now: ROOM_SHAPES,
    getRoomShape, shapesFor, defaultShape, boundsOf, createRoom(..., shape), roomAtLevel,
    floorRects, floorRect (the bounding box), doorX, doorY, pointOnFloor, wallBands (every up
    edge), wallBandRect (the first band, old code), borderRects (a 16 px ring of cells around
    the floor and bands, not above bands, gap at the door), doorRect, doorZoneRect,
    roomBoundsRect, rectInsideFloor (fully inside the union; the shape's rectangles never
    overlap). The old left/right/bottomBorderRects and config ROOM_SIZES are gone; config
    ROOM_GRID = 16.
  - Rules that used one rectangle now use the union: the nav grid (a cell is free only if it is
    fully on the floor), canPlace, doorPoint, the customers' way in and out, wall items
    (snapToWallBand: a wall item's anchor y is the bottom of the nearest band, and it must fit on
    that band; any band, also an inner one), upgrades (roomAtLevel). The camera uses
    roomBoundsRect and fitZoom as before.
  - clothing.ts: CLOTHING, getClothing, selectableClothing(slot, unlocked), SLOT_FIELD,
    lookAllowed, cleanDisplayName. newPlayer.ts: NewPlayerConfig gains hotelShape and
    shopShape; NewPlayerChoice; configForChoice (checks the name, look and shapes). GameState
    gains playerCreated (false until character creation is done). GameAPI gains needsNewPlayer
    and createPlayer(choice); LocalGameAPI.setLook only takes allowed looks; newGame() leaves a
    default state with playerCreated false, so the reload starts character creation.
  - client: render/avatarParts.ts (avatarBoxes, avatarParts, sitParts, drawAvatarOnCanvas;
    pure, no Pixi; the clothing boxes), ui/lookPickers.ts (the shared pickers),
    ui/newGame.ts (runNewGameSetup: character, hotel shape, shop shape; createAvatarPreview,
    shapePreview), ui/coinFly.ts (flyCoin), avatarPanel.ts uses the pickers. ItemViews.pop(uid)
    (POP_MS boing + dust puff). main.ts playNewGameIntro (newIntro state hides the start items
    and holds the gold and the hint; a full-screen .intro-skip layer takes the skipping tap).
    roomView draws one floor sprite per rectangle (texture lined up with the world), a wall band
    sprite per band, and the border ring.
- AFTER 7b (playtest fixes): customers.ts phases enter, browse, decide, queue, pay, paid,
  leave; Customer gains speed, shelfUid, browsing, looks; ShopEvent 'thinking' (the "..." bubble
  for ms). Config: CUSTOMER_WALK_SPEED, CUSTOMER_SPEED_VARIATION, CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_BROWSE_MIN_MS / MAX_MS, CUSTOMER_SECOND_LOOK_CHANCE, CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_MAX_IN_SHOP. CustomerViews walks each customer at its own speed. Character creation
  (newGame.ts makeCharacter, .charmaker CSS) and lookPickers.ts use tabs (Body, Hair, Top,
  Bottoms, Shoes); the preview stays in view. Customers in an old save are settled when the game
  opens, so no save migration was needed.
- DUNGEON IN THE GAME (step 9):
  - GameState.run holds the run in progress (saved; a reload resumes it). GameAPI: getRun ({ run,
    paused }), dungeonStart (startRun: the key, the potions along; marks the dungeon hint done),
    dungeonInput (step with dt 0: applied at once, at the exact run time), dungeonAdvance(dtMs)
    (step; the rest of a tick stays in run.carryMs), dungeonPause / dungeonResume, craft, buyGear.
    A run loaded from a save is paused until dungeonResume. A run that ends ('left' / 'dead') is
    banked at once (finishRun) and removed from the state, so it is banked exactly once; the
    update carries a RunResult for the summary. LocalGameAPI saves the run when something happened
    (any event but a wind-up) and at least every RUN_SAVE_EVERY_MS of run time. The step rng is
    LocalGameAPI's rng (Math.random in the browser); the floor comes from the seed.
  - The client (dungeon/dungeonScreen.ts) hands every frame's time to dungeonAdvance, one call at
    a time (time that passes meanwhile goes into the next call: no tick is skipped). It stops the
    run (halted) while the Resume panel, the exit choice or the result screen shows; a hidden tab
    pauses the run and asks for Resume. main.ts setDungeonMode: the root gets .in-dungeon (CSS hides
    the .room-only side buttons, the quest card, the hotbar, the build frame and bubbles), the room
    world hides, the run bar shows. The camera control routes to the dungeon (camera follows the
    player; pinch / wheel only change the zoom; drags do nothing). After the result screen the
    player goes back to the room they came from (currentRoomId is unchanged by a run).
  - Drawing (dungeon/dungeonView.ts, dungeonArt.ts): floor blocks dark blue, wall blocks next to
    the floor with a stone top and, with floor below, a darker DUNGEON front face (14 px); deep wall
    is not drawn (black). One DepthLayer for the player, enemies and chests (feet y, then x, then
    id). Positions are drawn between the last two ticks (carryMs / 100). Fog (dungeon/fog.ts):
    lit within DUNGEON_LIGHT_PX, seen = dim (DUNGEON_SEEN_DARK), else black; enemies only on lit
    blocks, chests and the exit once seen. Enemies blink red during the wind-up, flash white when
    hit, show an hp bar once hurt. The golden chest has a pulsing warm glow. A mimic is drawn as
    an open chest with teeth; it waits MIMIC_WAKE_MS before its first wind-up. A cooldown ring
    shows above the player's head. Floating text (dungeon/floatTexts.ts): damage, drops, '+xp',
    'dodged!'. Screen shake on hits (HIT_SHAKE_PX) and when hurt (HURT_SHAKE_PX).
  - Taps: an enemy (lit, generous hit circle) = click_enemy; an unopened chest = walk onto it;
    else walk there. Q or the potion button drinks.
  - Zoom: max(DUNGEON_DEVICE_PX_PER_ART_PX, round(DUNGEON_CSS_PX_PER_ART_PX * dpr)) device px per
    art px, settled like the rooms.
  - The dungeon hint (HINTS[DUNGEON_HINT], "Quest 4 of 5") only shows while the shop has nothing
    for sale; the Dungeon button glows while it shows. Starting a run finishes it.
- DUNGEON (step 8):
  - The dungeon never uses room shapes: its own 40 x 40 grid of 32 px blocks (DungeonMap.blocks,
    row-major). Positions are world px. Room 0 is the spawn room (no enemies, no chests). Rooms keep
    one wall block between them; each is joined to the nearest earlier room by an L corridor. The
    exit is the room block farthest (walking) from the spawn. One thing per block. The boss floor
    (round 2, floor 3) has the Bone King in the exit room and a golden chest next to the exit (no
    random golden chest there).
  - step(run, inputs, dtMs, rng): inputs first (at time run.timeMs + run.carryMs, exact), then
    whole 100 ms ticks; the rest waits in carryMs. Tick order: player walks (re-paths to a target
    enemy), a pending hit lands, chests open / mimics wake (CHEST_OPEN_REACH), the exit check
    (pauses: status 'exit_choice', nothing moves until choose_exit), then each enemy, then death.
    The player's attack and potion cooldowns are absolute times (attackReadyAt, potionReadyAt), so
    350 ms is exact; enemy timers count down per tick. Hit reach PLAYER_ATTACK_REACH (40) center to
    center. A click on an enemy during the cooldown is ignored as a hit (the player still walks
    there). Enemies: wind-up 300 ms within ATTACK_REACH, the hit (or a miss beyond 48 px), then
    their full attack cooldown (attackEveryMs); they stop ENEMY_STOP_PX from the player; straight
    chase with line of sight, else a nav path every ENEMY_REPATH_MS; bats move in a random direction
    half the time. A mimic becomes a skeleton (id MIMIC_ID_BASE + chest id) with the floor's hp.
  - Banking: run.bag is at risk, run.banked is safe, run.lost keeps what died or was left behind.
    Leaving and killing the Bone King move the bag to banked (the run goes on after the boss, so the
    golden chest can still be opened). Death: the bag is lost, half of its gold (rounded down) is
    kept. Xp counts at the kill (run.player.xp, run.xpGained) and is kept after death. Level up:
    full heal, new max hp and attack. Stairs: +30% of max hp (rounded). Potions taken along at
    startRun come back at finishRun (unused ones; also after death).
  - Every kill rolls RARE_DROP_CHANCE for enemy_rare; the boss also rolls 'boss'; a mimic gives a
    golden chest's loot.
- SAVE_VERSION is 8: MIGRATIONS[7] (step 9c) adds Player.mineVisits 0 and turns a saved run into
  a crypt run (place 'crypt', no rocks, no lantern, basic pickaxe). Gear ids are unchanged.
- (Before 8:) MIGRATIONS[6] (step 9b) adds a level 1 farm room (the next free room id) with
  empty plots, Player.farmRoomId, and gives a saved run's player food [], buffs [] and
  attackCooldownMs 350.
- (Before 7:) MIGRATIONS[5] adds run: null (no run in progress).
- (Before 6:) MIGRATIONS[4] gives old rooms the square shapes, the old look clothing
  ids (short, long_sleeve, trousers), unlockedClothing [] and playerCreated true.
- (Before 5:) MIGRATIONS[2] adds the empty shop, hintsDone 0 and the counter and
  stall_table (addShopStartItems); MIGRATIONS[3] moves a counter still on the old spot against the
  back wall (176, 40) to the new start spot (176, 88), so the player fits behind it.

Notes:
- Plan after step 9 (owner's decision): playtest, then step 9b (farm, section 10b), step 9c
  (mine and forge, section 10c), then dungeon round 2, then step 6 (art), then step 10. The
  step prompts are in docs/NEXT-STEPS.md.
- cameraControl reports long presses as onPoint(start, 'longpress', target at press start).
- The debug "Give random loot" button is gone (step 9: the shop sells real loot).
  LocalGameAPI.debugGiveFurniture is for tests only.
- The pixel font draws a small "2" much like an "8" (for example the hotbar numbers and the
  gold). Worth checking when the art pass (step 6) happens.
- Build mode came back as a play / build mode switch (a change to step 4b, made after step 5):
  see INPUT RULE. The old "Build (F)" toggle and item strip of step 4 are gone for good.
- Debug blockers (step 3) are sent to LocalGameAPI with debugSetBlockers (not saved, cleared
  when the room changes).
- SITTING AND LYING (step 5b): FurnitureType.seats = [{ dx, dy, pose: 'sit' | 'lie' }] for the
  'down' facing, relative to the anchor, turned with the item (seatSpots). For 'lie' (dx, dy) is
  the middle of the body; the head is LIE_HEAD_PX toward the pillow (headDirection: up for a
  'down' bed, left for 'right', down for 'up', right for 'left'); the drawing centers the head
  on the pillow box. Seats: chair 1, settle (sofa)
  2, bench 2, bed 1 lie. `sittable` stays in the data (true = has 'sit' seats; tested); code uses
  hasSeats. standPoint is only for shop customers now. ArtBox.role: 'pillow' marks the pillow
  (tests), 'cover' the blanket that is drawn again over the lying avatar's head and shoulders.
  - A tap (play mode) on an item with seats: api.sit(uid, tap). planSit takes the free seat
    nearest to the tap (taken = seat indices other avatars use; [] until step 10), then the
    approach point with the shortest real route (fix after 5b): for every approach point,
    approaches() runs findPath from the avatar, and route = pathLength of the smoothed path plus
    the slide from its end onto the seat (without the slide a side whose walk ends in a free cell
    nearer the avatar looked shorter and the avatar went the long way round). No straight-line
    distance and no preference for the front. bestApproach: routes within APPROACH_TIE_PX (8) of
    the shortest are equal, and then the one ending nearest the tap wins. Approach points: below,
    left, right and above the footprint, AVATAR_RADIUS outside it, level with the seat; the
    point's own cell is usually blocked, so one counts as reached when the walk ends within
    APPROACH_REACH_PX (28) of it. A side next to other furniture counts exactly when the gap has a
    free nav cell for the avatar (tested at every 4 px alignment; depending on alignment a gap
    needs 40 to 56 px). If that seat cannot be reached the next free seat is tried; nothing
    reachable = the item shakes.
  - On arrival the client slides the avatar onto a sit seat in SEAT_SLIDE_MS (150 ms, straight
    line, may cross the footprint) and shows the pose. Sitting faces the item's facing. Lying
    (fix after 5b): no slide and no separate blanket box; the avatar is drawn inside the bed only
    (lieArt.ts): bed frame, then the head on the pillow, then the bed's blanket on top. The
    GameAPI puts the avatar on the seat at once (it only tracks time for walking).
  - Depth: a sitting avatar sorts right after its seat (right before it when the seat faces
    up); a lying avatar always right after its bed, with the blanket inside the avatar sprite.
  - Tapping the floor stands up and walks (the path leaves via the nearest free cell). Moving or
    picking up the item: the avatar stands at standUpSpot (where it is if that cell is free, else
    the nearest free cell center); LocalGameAPI and main.ts both do this with the same rule.
  - The bone chair (crypt furniture) does not exist yet; give it one 'sit' seat when it is added.
- Avatar types moved from types.ts to avatar.ts (still exported from the shared index).
- Loot values in loot.json stay as they are until the owner tunes them after playing step 9.
- Step 8 balance (npm run simulate:dungeon): round 1 (the current DUNGEON_ROUND) is easy (about
  100% survival); the survival targets are for round 2.
- The start look (config START_LOOK): skin 30, hair 5, short hair, long sleeves (shirt 7),
  trousers (legs 23), shoes 6. The box avatar lives in render/avatarParts.ts now.
