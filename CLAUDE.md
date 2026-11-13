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
  for each room), dungeon gear and potions (section 10), dungeon key 10 gold.
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
- Each room except the spawn room has 0 to 2 enemies. (The balance check was made with
  tile-based movement, so the simulation in step 8 must be run again.) Enemy hp on floor n
  is multiplied by (1 + 0.25 * (n - 1)), rounded up. Each floor has 3 to 5 wooden chests and
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
  item sells for, so crafted pieces are for showing off.

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
- I work with Claude Code on my phone or on my PC. The repo is on GitHub and every push is
  deployed by Netlify, so I can test the game on my phone through that link. Commit and
  push at the end of every step.

CURRENT STATE (kept up to date by the AI at the end of each step)
Steps 1 (project skeleton), 2 (room view), 3 (avatar and walking), 4 (furniture), 4b (placing
and the item menu), 5 (inventory, UI, chat, local saving, camera intro; the bag reworked to the
docs/UI-REFERENCE.md layout with parchment panels), 5b (sitting and lying; lying reworked after
5b: drawn inside the bed only), 7 (shop, gold and upgrades; serving at the counter added after
it) and 7b (room shapes, character creation, the new-game intro) are done. Step 6 (docs/STYLE.md)
has not been done yet.

Layout:
- package.json: npm workspaces (shared, client, server). Root scripts: dev (client Vite dev
  server), build (client), test (vitest run), typecheck (tsc in every workspace).
- tsconfig.base.json: strict, noUncheckedIndexedAccess, moduleResolution bundler, noEmit.
  Imports inside shared/ and client/ use the .ts extension (allowImportingTsExtensions).
- vitest.config.ts: tests are *.test.ts files next to the code (shared, client, server).
- netlify.toml: builds the client workspace, publishes client/dist.
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
- client/src/ui (step 5): ui.css (THE frame style and all UI CSS; the pixel font Pixelify Sans,
  SIL OFL, is hosted in client/src/fonts with its license), dom.ts (el, textButton,
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

Conventions:
- UI LAYOUT RULE (step 5). The room fills the whole screen; all UI sits on top of it at the
  edges, never in solid bars. Every frame, button, slot and panel uses the one frame style in
  client/src/ui/ui.css, as described in docs/UI-REFERENCE.md section 3: light parchment fill,
  a 3 px mid-brown wooden border with a 1 px darkest-brown outline outside and a 1 px lighter
  inner edge, dark brown text, square corners, pixel font, at least 44 px touch size, no default
  browser buttons. Slots are a shade darker than the panel with a darker inset edge; the
  selected slot has a bright orange border. Places:
  - Top-left: the info panel (gold with a coin icon, room name) with the room switcher under it.
    New player stats (xp, level) go into this panel.
  - Right edge: one column of square icon buttons (Bag, Build, Avatar, Chat, Settings), tooltips via
    title. New screens add an icon button to this column (sideButtons.ts) and a panel.
  - Panels: open to the left of that column, top aligned, never covering the hotbar; one at a
    time (panels.ts), each with a ✗ in its top-right corner. A tap on the room closes the open
    panel. Escape closes it. Below 680 px wide the bag is a bottom sheet above the hotbar.
  - Bottom center: the hotbar (6 slots, icons only, a count for stacks, the last used slot has a
    bright warm border). Hidden while placing.
  - Floating bars (✓ ↻ ✗, the item menu) sit above their target (anchorAbove). Toasts appear
    just above the hotbar. Speech bubbles are cream with a dark outline and a small tail.
  - Debug things (x/y/zoom label, Blockers buttons) show on the left only while Settings ->
    Debug is on (off by default). Keys: I bag, B build mode, Enter chat, 1-6 hotbar, Escape
    closes (a panel first, then the placing session, then build mode), K blockers (debug).
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
- TEXTS (after 7b): every text on screen stays at reading pace: shared/src/text.ts readingMs
  (at least TEXT_MIN_MS 4 s + TEXT_MS_PER_WORD 0.35 s per word), then fades over TEXT_FADE_MS.
  Toasts (toast.ts; a tap hides them) and chat bubbles use it. docs/UI-REFERENCE.md has the rule.
- HINTS (step 7): config HINTS, GameState.hintsDone counts the finished ones, shown one at a
  time in the hint box under the room switcher. The hint stays until the player taps it ("tap
  to continue ▸"); a tapped hint stays away for the session until the next one comes. 1 is done by the first buy (a style as the first
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
- SAVE_VERSION is 5: MIGRATIONS[4] gives old rooms the square shapes, the old look clothing
  ids (short, long_sleeve, trousers), unlockedClothing [] and playerCreated true.
- (Before 5:) MIGRATIONS[2] adds the empty shop, hintsDone 0 and the counter and
  stall_table (addShopStartItems); MIGRATIONS[3] moves a counter still on the old spot against the
  back wall (176, 40) to the new start spot (176, 88), so the player fits behind it.

Notes:
- cameraControl reports long presses as onPoint(start, 'longpress', target at press start).
- "Give random loot" (Settings, step 7) is a debug button: a few random materials and maybe one
  catalog item, free, ledger reason 'debug'. Remove it in step 9. LocalGameAPI.debugGiveFurniture
  is for tests only.
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
- The start look (config START_LOOK): skin 30, hair 5, short hair, long sleeves (shirt 7),
  trousers (legs 23), shoes 6. The box avatar lives in render/avatarParts.ts now.
