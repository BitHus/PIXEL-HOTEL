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
- A room is a rectangle: { id, kind: 'hotel' | 'shop', level, w, h (floor size in px),
  floorStyle, wallStyle }. The back wall is a 64 px band along the top (WALL_BAND), drawn
  above the floor. The sides and the bottom have only a thin 16 px border. The floor is a
  seamless repeating texture, not a tile map.
- The door is in the bottom wall, centered, a 64 px wide opening. The DOOR ZONE is a 64 x 48
  px rectangle on the floor just inside it. Nothing can be placed on the door zone. Avatars
  enter and leave through it, walking up from the bottom of the screen.
- Floors and walls are unlockables. Every room starts with the 'bare' floor and the 'bare'
  wall: plain, dull and a bit boring on purpose, so the first things you earn feel like
  yours. Styles are data in shared/data/styles.json: { id, kind: 'floor'|'wall', name,
  baseValue, inCatalog, appeal }. Buying (or crafting) a style unlocks it forever, and the
  player can then apply any unlocked style to any of their rooms for free, as often as they
  like. Styles: floors bare, wood_planks (baseValue 10), stone_tiles (15), red_carpet (20);
  walls bare, plaster (8), wood_panels (12), brick (15). All of those are in the catalog
  (price = baseValue * 3). Dungeon-only styles are crafted (section 10): crypt_flagstones
  (floor) and bone_wall (wall).
- Sizes (floor area in px, kept in config): hotel level 1 is 576x384, level 2 is 704x480,
  level 3 is 832x576. Shop level 1 is 576x320, level 2 is 704x384, level 3 is 832x448.
- Every new player gets two basic rooms: a hotel room (level 1) and a shop room (level 1).
  The hotel room starts completely empty. The shop starts with a counter and one stall_table
  at fixed positions from config, nothing else.
- Room upgrade (costs gold): level 2 and level 3 use the sizes above. The room grows to the
  right and down. Every item keeps its position. The door moves to the new bottom center,
  and any item standing in the new door zone goes back to the inventory. Costs are in
  config.
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
- Placeholder avatar: drawn in code from boxes.
- Avatar: { id, name, look: { skin, hair, hairStyle, shirt, legs, shoes }, roomId, x, y (the
  feet, in px), facing, state }

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
- UI: HTML/CSS over the canvas. Free open-license pixel font, hosted locally.

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
and the item menu) and 5 (inventory, UI, chat, local saving, camera intro) are done.

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
  avatar.ts (Avatar, AvatarLook, AvatarState, walkAvatar, facingFor, pathLength), view.ts (Camera, screenToWorld, worldToScreen, fitZoom, centerCamera,
  zoomAt, panBy, clampCamera, snapCamera, settleZoom, easeZoom, cameraCenter, cameraAt,
  introZoom, introCamera, containCamera), api.ts (GameAPI interface, RoomState, Inventory,
  PlaceAt, SitResult, ItemsResult), palette.ts (Endesga
  32 hex list, the only place it lives), furniture.ts (FURNITURE_TYPES, getFurnitureType,
  footprintSize, footprintRect, snapCoord, nextFacing, fitsRoomKind, ridersOf, itemBlockers,
  doorPoint, doorReachesMiddle, canPlace, snapToSurface, planPlacement, rotateQuarter,
  moveItem, pickUpItem, standPointFor, seatFor), placing.ts (step 4b: PlacingSession,
  startNewPlacing, startMovePlacing, moveGhost, rotateGhost, planGhost, confirmPlacing (null =
  refused while invalid), cancelPlacing (exact restore), rotateInPlace (null = does not fit),
  footprintCenter), index.ts (re-exports).
  nav.ts also exports reachableCells and nearestFreeCell.
  Step 5: materials.ts (MATERIAL_TYPES, getMaterialType, isMaterialId), gameState.ts
  (GameState: player, look, rooms, items (ALL furniture; roomId null = inventory), hotbar,
  currentRoomId, nextUid, ledger; ChatLine), ledger.ts (applyChange: the ONE function for gold,
  material and new-furniture changes; writes a LedgerEntry; null if something would go below
  0), newPlayer.ts (createNewPlayer(config, at), DEFAULT_NEW_PLAYER, styleKey), inventory.ts
  (inventoryItems, furnitureStacks (stacked by type, furniture.json order), countInInventory,
  nextInventoryUid, materialStacks, setHotbarSlot (a type is in the hotbar once; swaps)),
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
  mirrored, 1 px dark warm outline, 2 px bob every WALK_BOB_MS while walking).
  RoomView has a debugLayer (above rugs, below the wall) for debug drawings.
- client/src/debug/blockers.ts: BlockersDebug (debug only, not a game feature): drawn
  rectangles that block navigation, a drag preview, and the faint blocked-cell overlay.
- client/src/input/cameraControl.ts: the input rule below (pan, zoom, tap, draw hook). Uses
  Pixi federated events on the stage.
- client/src/input/cameraIntro.ts: CameraIntro (the room intro; cancelled by onGestureStart).
- client/src/ui/debugLabel.ts: HTML label with world x, y and zoom (only while Debug is on).
- client/src/ui/blockersButton.ts: "Blockers (B)" toggle and "Clear" (left, only while Debug
  is on), plus the B key.
- client/src/ui (step 5): ui.css (THE frame style and all UI CSS; the pixel font Pixelify Sans,
  SIL OFL, is hosted in client/src/fonts with its license), dom.ts (el, textButton,
  iconButton, typing), pixelIcons.ts (pixel-map SVG icons: bag, avatar, chat, gear, coin),
  itemIcon.ts (inventory icons: a small version of the boxes / a material box; fitRects tested),
  press.ts (tap / long press / drag on HTML slots), panels.ts (one side panel open at a time),
  sideButtons.ts (right-edge column), infoPanel.ts (gold, room name, Hotel / Shop), hotbar.ts,
  bagPanel.ts (tabs, grid, carry to the hotbar), avatarPanel.ts, chatPanel.ts (log + input),
  chatBubbles.ts, settingsPanel.ts, toast.ts.
- client/src/build/placer.ts: Placer (one placing session + the ghost drawing; startNew takes
  an inventory item of the type (false if none), place() asks hooks.commit (the GameAPI),
  rotate, cancel, drag, screenBounds). client/src/ui/placeBar.ts: floating ✓ ↻ ✗ bar above the ghost (Enter,
  R, Escape). client/src/ui/itemMenu.ts: item menu (Move, Rotate, Pick up, Sit) + name card.
  client/src/ui/anchorAbove.ts: puts a floating element above a screen rect, inside the screen.
- server/src/index.ts: placeholder only (step 10).

Conventions:
- UI LAYOUT RULE (step 5). The room fills the whole screen; all UI sits on top of it at the
  edges, never in solid bars. Every frame, button, slot and panel uses the one frame style in
  client/src/ui/ui.css (dark wood, 2 px dark warm outline, lighter top edge, square corners,
  pixel font, at least 44 px touch size, no default browser buttons). Places:
  - Top-left: the info panel (gold with a coin icon, room name) with the room switcher under it.
    New player stats (xp, level) go into this panel.
  - Right edge: one column of square icon buttons (Bag, Avatar, Chat, Settings), tooltips via
    title. New screens add an icon button to this column (sideButtons.ts) and a panel.
  - Panels: open to the left of that column, top aligned, never covering the hotbar; one at a
    time (panels.ts). A tap on the room closes the open panel. Escape closes it.
  - Bottom center: the hotbar (6 slots, icons only, a count for stacks, the last used slot has a
    bright warm border). Hidden while placing.
  - Floating bars (✓ ↻ ✗, the item menu) sit above their target (anchorAbove). Toasts appear
    just above the hotbar. Speech bubbles are cream with a dark outline and a small tail.
  - Debug things (x/y/zoom label, Blockers buttons) show on the left only while Settings ->
    Debug is on (off by default). Keys: I bag, Enter chat, 1-6 hotbar, Escape closes.
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
  GameState shape changes: bump SAVE_VERSION and add MIGRATIONS[old].
- INVENTORY (step 5): the inventory is the player's furniture with roomId null plus
  player.materials. The bag and the hotbar stack furniture by type; the hotbar stores type ids
  and places the oldest inventory item of that type. A hotbar slot is dimmed when none are left
  or the type cannot go in this room. Long-press (or mouse-drag) a bag slot onto a hotbar slot
  to put it there (dropped elsewhere: the next hotbar tap takes it); long-press a hotbar slot to
  empty it. Player.unlockedStyles holds 'floor:<id>' / 'wall:<id>' (styleKey).
- CHAT (step 5): cleanChatText (one line, max 120 characters). Bubbles are HTML above the
  head, the newest lowest, fade over the last CHAT_BUBBLE_FADE_MS of CHAT_BUBBLE_MS. The chat log
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
    less than TAP_MAX_MS (300 ms). A tap / left click means "walk there". Anything else is a
    DRAG, and a drag never makes the avatar walk.
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
  - Blockers mode (debug, step 3): while it is on, a one-finger / left drag draws a blocking
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
    screen) or Move in the item menu (the ghost starts where the item is; the item and its
    riders are hidden until done) starts a placing session. A one-finger / left drag anywhere
    moves the ghost by the drag distance (getDragMode returns 'draw'); two fingers and
    right-drag still pan/zoom. No hover-follow. Taps and long presses do nothing while placing.
    Only ✓ / Enter places (disabled while red); ✗ / Escape cancels (a moved item goes back
    exactly; an inventory item stays in the inventory). After placing the session ends. Shift
    (held) turns the 4 px snap off. Items picked up go to the inventory (roomId null).
  - Item menu (step 4b): a tap on a placed item opens its menu, except a sittable item, which
    walks there and sits (if it cannot be reached, the menu opens). A long press (LONG_PRESS_MS, without
    moving) on any item opens the menu. With the menu open, a tap elsewhere only closes it.
    Rotate turns in place (rotateInPlace) or shakes the item when it does not fit. The menu and
    the place bar follow their target every frame.
  - Hit testing: cameraControl passes the Pixi event target to onPoint; item containers are
    eventMode 'static' and ItemViews.uidOf maps a target to an item. The cursor cross, the
    avatar and the ghost layer have eventMode 'none' so they never hide an item from a tap.
  - Sitting: a tap on a sittable item walks to standPointFor (only if the walk ends within
    SIT_REACH_PX of it), then the avatar is put on seatFor (footprint center), state 'sit',
    facing the item. A sitting avatar sorts right after its seat (right before it when the
    seat faces up). Moving or picking up the seat makes the avatar stand where it is. No sit
    sprite yet: the idle sprite is shown.

Notes:
- SHOP_START_ITEMS positions in config.ts are placeholders; adjust when the counter and
  stall_table types exist.
- cameraControl reports long presses as onPoint(start, 'longpress', target at press start).
- "Give test furniture" (Settings) is a debug button: one of each of the 12 home items, free,
  written to the ledger as reason 'debug'. Remove it in step 7 when the catalog exists.
- Step 5 removed build mode (the "Build (F)" toggle and the item strip). A tap on a seat sits
  (if it cannot be reached, its menu opens); a long press opens any item's menu.
- Debug blockers (step 3) are sent to LocalGameAPI with debugSetBlockers (not saved, cleared
  when the room changes).
- Avatar types moved from types.ts to avatar.ts (still exported from the shared index).
- The avatar look uses palette indices (skin 30, hair 5, shirt 7, legs 23, shoes 6).
