# NOTES

Details of earlier steps, moved out of CLAUDE.md (roadmap item 1.0). Grouped per topic: read the
part you need, not the whole file. The text is as it was written at the end of each step, so a
later part can overrule an earlier one (the order inside a topic is oldest first). The rules
themselves are in CLAUDE.md (short) and docs/BRIEF.md (the full brief). When a step adds files,
conventions or measurements, add them here under the right heading, not in CLAUDE.md.

Contents:
- History (the old CURRENT STATE and plan notes)
- Project setup and deploy
- File lists: shared/ (steps 1 to 5b)
- File lists: client/ (steps 1 to 5b)
- World, camera and screen
- Input rule and build mode (full text)
- Navigation
- Furniture and placing (steps 4, 4b)
- Sitting and lying (step 5b)
- Game API, saving and save migrations
- Inventory, chat and texts (step 5)
- UI: layout rule, UI polish, logo splash
- Shop, catalog, styles, hints (step 7)
- Room shapes, character creation, new-game intro (step 7b)
- Shop life (step 9d; REMOVED in S1: only the guests' look, talk and the staff zone live on, see S1)
- Fix list after 9d (nav, natural customers [removed in S1], staff only, chests)
- Dungeon logic (step 8)
- The dungeon in the game (step 9)
- Farm and cooking (step 9b)
- Mine and forge (step 9c)
- Ranks and the Book (step 9e)
- Lakeside: woodcutting and fishing (step 9f)
- Atmosphere: light, shadows, backdrop, dust, sound
- BG5: blocks and punching, gems core, gain popups (step BG5)

## History (the old CURRENT STATE and plan notes)

Steps 1 (project skeleton), 2 (room view), 3 (avatar and walking), 4 (furniture), 4b (placing
and the item menu), 5 (inventory, UI, chat, local saving, camera intro; the bag reworked to the
docs/UI-REFERENCE.md layout with parchment panels), 5b (sitting and lying; lying reworked after
5b: drawn inside the bed only), 7 (shop, gold and upgrades; serving at the counter added after
it), 7b (room shapes, character creation, the new-game intro), 8 (dungeon logic) and 9 (the
dungeon in the game: view, HUD, screens, crafting, the Blacksmith), 9b (farm and cooking) and 9c
(mine and forge) are done, and so is the UI polish step (after 9c, see UI POLISH). The atmosphere
step (lighting, shadows, backdrop, dust, sound; see ATMOSPHERE), the logo splash and step 9d (shop
life, see STEP 9d) are done too, and so are the fix list after 9d (see FIX LIST AFTER 9d), step 9e
(ranks and the Book, see STEP 9e) and step 9f (the lakeside, see STEP 9f). Step 6 (docs/STYLE.md) has not been done yet. Next (docs/NEXT-STEPS.md):
9g (livelier hotel), 9h (dungeon
types, with round 2), 9i (questline), then step 6 (art), then step 10.
- Plan after step 9 (owner's decision): playtest, then step 9b (farm, section 10b), step 9c
  (mine and forge, section 10c), then dungeon round 2, then step 6 (art), then step 10. The
  step prompts are in docs/NEXT-STEPS.md.

## Project setup and deploy

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
- server/ (ONLINE P1 + read-only visits, stage A of docs/PLAN-ONLINE.md; run `npm run server`, ops in docs/OPS.md): src/index.ts (start,
  refuses an unsafe env via config.ts configProblems), config.ts (PB_* env only), db.ts (better-sqlite3, numbered MIGRATIONS: 1 accounts/sessions/
  saves/backups, 2 room_shares/visit_blocks/reports, 3 banned_until/ban_reason), http.ts (node:http router, CORS one origin, body caps, rate limits,
  30 s request / 10 s header timeouts, 500 sockets), accounts.ts (shared usernameProblem/passwordProblem, bcrypt, sha256 session tokens, max 10
  sessions per account, bans: right password + banned = 403 'banned', a wrong one never tells), saves.ts (readSave from shared, newest savedAt
  wins, backups), rooms.ts + roomView.ts (share codes, public board, RoomView without wallet/bag/ledger), admin.ts + adminCli.ts (set-password,
  ban, unban, delete-user). Tests: server.test.ts, visits.test.ts, admin.test.ts, hardening.test.ts (all :memory: SQLite, server on port 0).
  The `ws` dependency is not used yet (P2 ws hub ON-9: walk, chat).

## File lists: shared/ (steps 1 to 5b)

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
- Avatar types moved from types.ts to avatar.ts (still exported from the shared index).

## BG1: the cell grid (step BG1)

- DATA: shared/data/roomShapes.json is in CELLS (x, y, w, h; door.x is a cell boundary): the old
  px numbers were rounded up to whole cells, overlaps re-cut, so wide_hall level 1 is 26 x 8 cells
  (was 7.5 high), plus has 8-wide arms (was 6.5), long and L doors moved to a boundary. shopStart
  spots were re-placed with nearestValidPlacement. shared/data/furniture.json: floor types have
  w and d in whole cells (px, multiples of 32; rounded to nearest, at least 1): sofa 3x1,
  counter 3x1, stall_table 3x2, round_table 2x2, bed 2x3, long_table 4x1, small things 1x1; art
  boxes, seats and slotSpots were scaled to the new footprint (bed seat dy -48). Wall items are
  unchanged (px). The farm plots are 2 cells apart on cells (64, 128, ... ; level 3 row at y 192)
  and the pot is one cell; the lakeside's water, pier and tree anchors are on cells.
- RULES: furniture.ts (footprintCells, poseAtCell, topLeftCell, anchorCell, poseForAnchorCell,
  isOnGrid, snapToCells, nearestValidPlacement; canPlace needs isOnGrid for floor items; wall items
  skip it; riders snap to the cells of their surface), placing.ts (planGhost snaps floor items to
  cells, wall items keep snapCoord; rotateInPlace keeps the anchor cell and is refused, not
  shifted, when it does not fit), room.ts (levelRects, cellOf, cellRectOf, cellOnFloor,
  floorCellList, floorStyleAt, dominantFloorStyle, paintFloorCells, paintWholeFloor; Room.floorCells
  is optional), economy.ts (paintFloor; applyStyle floor clears the paint; upgrade uses overlap with
  the door zone), config (BUILD_CELL, DOOR_ZONE 64 x 64, NAV_CELL, CASHIER_BEHIND_PX, STAFF_ZONE_*).
  The door zone now only forbids OVERLAP (an item next to it is fine). doorPoint is the middle of the
  zone's bottom row. SNAP (4 px) is for wall items only.
- WALL ITEMS: they keep x free (4 px, Shift = whole px) and their anchor y is the band's foot,
  because their art is drawn upward from there (z 12 to 52 in a 64 px band): moving y inside the
  band would push the art off the wall. The owner's text said "any x and y inside the band"; this
  keeps the old behaviour and is flagged for the owner.
- MIGRATION 13 -> 14: shared/gridMigration.ts snapItemsToGrid: recomputes room sizes, floor items
  (counter first, then back to front) go to nearestValidPlacement (rings of up to 40 cells), wall
  items stay when canPlace holds (else the nearest band spot, else the bag), riders go to the
  nearest free cell of their surface (else the bag), what has no spot goes back to the bag.
  readSave reports returnedToBag; LocalGameAPI.open adds it to the "save was updated" notice.
- CLIENT: render/cellGrid.ts (faint grid, view.gridLayer), build/floorPaint.ts (the paint session
  and rectangle preview), ui/paintBar.ts (brush swatches, # grid toggle, Done), roomPanel "Paint
  cells", roomView draws painted cells as runs of tiling sprites, prefs.cellGrid + Settings "Build
  grid". main.ts: paint mode takes taps and one-finger drags before placing and build mode.
- TESTS: furniture.test.ts (footprints, rotation and anchor cell, validity, door zone, a path
  through a 1-cell gap, wall items free), nav.test.ts, seats.test.ts, placing.test.ts,
  room.test.ts (cells, paint), economy.test.ts (paintFloor), save.test.ts (13 -> 14),
  localGameAPI.test.ts (paintFloor).

## BG2: item icons (step BG2)

- DATA: every item has `icon: { shape, colors }` in its data file: materials.json (ore, bars, wood,
  cloth, drops), crops.json (`icon` for the crop, `seedIcon` for its seed), food.json, drinks.json,
  fish.json (fish and fished-up things), forge.json pieces, gear.json (the potion), clothing.json,
  furniture.json (inventory icon) and extraIcons.json (the dungeon key). `color` fields stay (the
  farm art and the old placeholders still read them); the icon is what items show.
- SHAPES: ICON_SHAPES in shared/src/icons.ts (type IconShape, isValidIcon, iconKey). It has the
  goods shapes (ore, bar, fish, leaf, mushroom, log, potion, bread, mug, gem, seed, block, cloth,
  bone, boot, key, ring, plate, bottle, shell, ...), gear and clothing (sword, armor, pickaxe, axe,
  rod, helmet, shirt, hat, trousers, skirt, hair) and furniture silhouettes (chair, table, lamp,
  shelf, bed, rug, plant, box, ...). seed, block and gem are there for BG4 to BG8: a new item picks
  an existing shape or adds one (to ICON_SHAPES and to DRAW in iconPixels.ts; a test fails if not).
- COLOURS: PALETTE_NAMES / PaletteName / paletteColor in shared/src/palette.ts (our own names for
  the 32 colours; `outline` = the dark warm one). colors[0] main, [1] accent, [2] third (missing
  ones follow the one before). No hex anywhere else.
- LOOKUP: shared/src/itemIcons.ts iconGroups() lists every icon by group (material, seed, crop,
  food, drink, fish, thing, furniture, clothing, gear, extra); shared/src/icons.test.ts checks every
  one is valid and that no two items of a group share shape + colours.
- DRAWING: client/src/render/iconPixels.ts iconPixels(icon, rank?) is pure: a 32x32 array of hex
  (null = empty). Each shape paints flat fills with a small Pen (rect, oval, poly, line); then ONE
  pass adds light from the top-left (lighter edge where the pixel above or left is empty, darker
  where below or right is) and the 1 px outline; a rank adds a 1 px frame in RANK_COLORS (the art
  keeps the outer ring free). client/src/render/drawIcon.ts drawIcon(shape, colors, rank?, size?)
  paints it on a canvas, iconDataUrl(icon, rank?) for <img> slots, iconTexture(icon, rank?, size?)
  for PixiJS (nearest), lootIcon(loot); all cached per (shape, colors, rank, size).
- USED BY: ui/itemIcon.ts (materialIconUrl, furnitureIconUrl, clothingIconUrl, gearIconUrl,
  potionIconUrl, keyIconUrl) for the bag, hotbar, run bag, catalog, seeds, shelf picker, Book,
  recipes, cooking, lunch box, the forge (every tier and bar now shows its icon) and the confirm
  dialog; render/slotGoods.ts for goods on stalls, shelves and in customers' hands (the 32 px icon
  sampled down to 12 px). The slot border already shows the rank, so HTML slots pass no rank.
- NOT DONE ON PURPOSE: chest and kill drops in the dungeon are still floating TEXT (BG3 makes them
  icon popups); no gems or blocks yet; styles keep their own previews (they are not items).
- PLACEHOLDER: the shapes are rough on purpose. Real pixel art replaces drawIcon per item in
  phase 4 (a sprite per item id wins over the shape); the data stays as the fallback.
- CHECK BY EYE: render all icons on one sheet (a vite-node script over iconGroups() + iconPixels()).

- ART PASS (furniture look): furnitureArt.ts `detail()` adds plank seams, a lit top edge, vertical boards, a
  foot line and a knot to every box, and a woven border plus fringe to flat things (rugs); the shape and
  outline do not change. iconPixels.ts: 21 furniture icons redrawn bigger (slatted chair, cushioned sofa,
  filled bookshelf, bed with pillows, patterned rug, potted plant, crate, barrel, throne, counter, tank...).
  Keep the outer 1 px ring free (a test checks it). ui.css .slot: wooden inner frame line, bottom shade,
  rank corner studs (::after). CHECK BY EYE: `npx tsx tools/art-sheet.ts out.ppm 2` (a contact sheet of
  every furniture icon and room sprite; tools/icon-sheet.ts does the same for the other shapes; convert the PPM to PNG).

## File lists: client/ (steps 1 to 5b)

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

## World, camera and screen

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

## Input rule and build mode (full text)

- CHANGED IN BG5: PLAY MODE also places and punches blocks (see the BG5 section at the end). Build mode is for furniture only; everything below about play mode walking still holds for taps that are not on a block and not a block placement.

- INPUT RULE (touch and mouse):
  - A press is a TAP only if it moved less than TAP_MAX_MOVE_PX (8 screen px) and was held
    less than TAP_MAX_MS (300 ms). Anything else is a DRAG (or a LONG PRESS), and neither ever
    makes the avatar walk. What a tap does depends on the mode (client/src/ui/buildMode.ts):
  - PLAY MODE (the default): a tap on the floor, a rug or any item without seats walks
    there (the item is ignored; a blocked point walks to the nearest free cell). A tap on an
    item with seats walks to its nearest free side and sits or lies (step 5b; the item shakes if
    no seat can be reached). A long press does nothing. No item menu.
  - BUILD MODE: the Build button (hammer, right-edge column, right after Bag) or the B key
    toggles it; placing from the hotbar or the bag turns it on. Taps never walk. Building is
    fast (owner's decision after 9e; like other building games): a DRAG that starts on an item
    moves it (the ghost follows the finger; letting go puts it down, or back where it was with a
    shake when it does not fit); a drag on the floor pans. A tap or long press on an item
    selects it and opens its menu (Rotate, Pick up; no Move button); with an item selected a tap
    on a free spot moves it there at once (a shake when it does not fit), a tap on the item again
    lets it go. The
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
- Build mode came back as a play / build mode switch (a change to step 4b, made after step 5):
  see INPUT RULE. The old "Build (F)" toggle and item strip of step 4 are gone for good.
- cameraControl reports long presses as onPoint(start, 'longpress', target at press start).

## Navigation

- NAVIGATION (shared/nav.ts, rewritten in BG1): NAV_CELL = BUILD_CELL = 32 px, no avatar radius
  (AVATAR_RADIUS is gone; before BG1 it was 4 px with 8 px cells). A cell is blocked if ANY part of it
  is outside the floor or a blocker touches it. A gap of one free cell is walkable (tested at every
  row); a gap that is not a whole free cell never is. The biggest room is 34 x 18 cells at most.
  Customers: queue spots and the paying spot are cell centres (QUEUE_SPACING_PX = one cell); the
  staff zone is the cells behind the counter (STAFF_ZONE_DEPTH_PX one cell, side 0). The
  shopkeeper's spot is CASHIER_BEHIND_PX = half a cell behind the counter. Seat approach points are
  half a cell outside the footprint, level with the seat: a side whose neighbouring cell is blocked
  does not count. The rest of this paragraph is the pre-BG1 text and still holds for the dungeon and
  for how paths, line of sight and re-pathing work:
- NAVIGATION (shared/nav.ts): NAV_CELL 8 px, AVATAR_RADIUS 4 px (owner's decision after 9d; it
  was 16 and 12). A cell is blocked if ANY part of it is outside the floor or overlaps a blocker
  grown by AVATAR_RADIUS, so every point in a free cell is at least the radius away from every
  blocker. A gap between two items of 24 px or more is always walkable (it keeps 16 px, so a
  whole free cell at every 4 px alignment), 16 to 24 px depends on the alignment, under 16 px
  never (tested). The owner asked for a radius of about 6; with 8 px cells that would need 28 px
  for a gap, so it is 4. The avatar may overlap furniture edges a little. The biggest room is
  104 x 72 cells; a path takes a few ms (tested). The dungeon keeps its own cells
  (DUNGEON_NAV_CELL 16, no radius). Line of sight fails if the
  segment touches a blocked cell (edges count). findPath returns points starting with the
  avatar's position; the client walks path.slice(1). A free but unreachable target gives
  null; a blocked target walks to the nearest reachable free cell center. If the avatar
  stands on a blocked cell (a blocker drawn on it), it leaves via the nearest free cell.
- When blockers change, the grid is rebuilt and a walking avatar re-paths to its goal.
- Debug blockers (step 3) are sent to LocalGameAPI with debugSetBlockers (not saved, cleared
  when the room changes).

## Furniture and placing (steps 4, 4b)

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
  - Placing (step 4b; faster after 9e): tapping a hotbar or bag slot starts a placing session
    for a NEW item (the ghost starts in the middle of the screen; build mode turns on). A tap on
    the room puts it there at once when it fits (else the ghost goes there, red); a one-finger /
    left drag anywhere moves the ghost by the drag distance and letting go places it when it
    fits (getDragMode returns 'draw'); ✓ / Enter also places, ↻ / R rotates, ✗ / Escape cancels
    (the item stays in the inventory). Moving a PLACED item: a drag that starts on it in build
    mode (cameraControl passes the press target to getDragMode; main.ts calls placer.startMove;
    the item and its riders are hidden while the ghost shows; no ✓ bar: Placer.moving), or a tap
    on a free spot while it is selected (api.moveItem directly). Two fingers and right-drag still
    pan/zoom. No hover-follow. After placing the session ends, and a moved item stays selected. Shift
    (held) turns the 4 px snap off. Items picked up go to the inventory (roomId null).
  - Item menu (build mode only, see INPUT RULE): a tap or long press (LONG_PRESS_MS, without
    moving) on a placed item opens its menu (Rotate, Pick up); a tap on another item opens that
    one's, a tap on the same item closes it, a tap on a free spot moves the item there. Sitting is play mode only (no Sit button). Rotate turns in place (rotateInPlace) or shakes the item when it does not fit. The menu and
    the place bar follow their target every frame.
  - Hit testing: cameraControl passes the Pixi event target to onPoint; item containers are
    eventMode 'static' and ItemViews.uidOf maps a target to an item. The cursor cross, the
    avatar and the ghost layer have eventMode 'none' so they never hide an item from a tap.
  - Sitting and lying: see SITTING AND LYING (step 5b) in the notes below.

## Sitting and lying (step 5b)

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
    APPROACH_REACH_PX (16) of it. A side next to other furniture counts exactly when the gap has a
    free nav cell for the avatar (tested at every 4 px alignment; depending on alignment a gap
    needs 16 to 24 px). If that seat cannot be reached the next free seat is tried; nothing
    reachable = the item shakes.
  - On arrival the client slides the avatar onto a sit seat in SEAT_SLIDE_MS (150 ms, straight
    line, may cross the footprint) and shows the pose. Sitting faces the item's facing. Lying
    (fix after 5b): no slide and no separate blanket box; the avatar is drawn inside the bed only
    (lieArt.ts): bed frame, then the head on the pillow, then the bed's blanket on top. The
    GameAPI puts the avatar on the seat at once (it only tracks time for walking).
  - Depth: a sitting avatar sorts right after its seat (right before it when the seat faces
    up); a lying avatar always right after its bed, with the blanket inside the avatar sprite.
  - Tapping the floor stands up and walks (the path leaves via the nearest free cell). Out of
    bed (fix after 9e): LocalGameAPI.standingAvatar puts a lying avatar next to the bed at once
    (standUpSpot, leaning to the side it is going to) before the path is made; before, the walk
    started in the middle of the bed and the avatar was hidden behind the bed's drawing for about
    a second. The client jumps to the path's first point as usual (more than 8 px off). Moving or
    picking up the item: the avatar stands at standUpSpot (where it is if that cell is free, else
    the nearest free cell center); LocalGameAPI and main.ts both do this with the same rule.
  - The bone chair (crypt furniture) does not exist yet; give it one 'sit' seat when it is added.

## Game API, saving and save migrations

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
- SAVE_VERSION is 21 (K1): MIGRATIONS[20] adds TavernState.cooks [] and one stove in the tavern (or the bag). Versions 14 to 20: see the BG sections and K1 below. (Older notes follow.)
- SAVE_VERSION is 13: MIGRATIONS[12] (step 9t) adds GameState.tavern (introSeen false) and puts a
  round table, 2 bar stools and a brewing barrel with root ale ready in the bag (newPlayer.ts
  addTavern, ledger 'tavern_gift').
- (Before 13:) SAVE_VERSION 12: MIGRATIONS[11] (step 9f) adds a level 1 lakeside room (the next free room id)
  with 8 whole trees (GameState.lakeside), Player.lakesideRoomId and Player.biggest {}.
- (Before 12:) SAVE_VERSION 11: MIGRATIONS[10] (step 9e) adds Player.seen (everything owned now counts as
  seen, first seen at 0), bookOpenedAt 0, bookRewards [], and kills {} / met [] on a saved run.
- (Before 11:) SAVE_VERSION 10: MIGRATIONS[9] (fix list after 9d) gives the customers in the line the new
  fields (buys, plan, step, doing, followId, talk, holdMs) and drops looks / looksMax / decorLeft.
- (Before 10:) SAVE_VERSION 9: MIGRATIONS[8] (step 9d) adds ShopState.lastLines {} and keeps only the
  customers carrying an item (with the new Customer fields; the catch-up puts them on their spots).
- (Before 9:) SAVE_VERSION 8: MIGRATIONS[7] (step 9c) adds Player.mineVisits 0 and turns a saved run into
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

## Gains: what a call gave (step BG3, part A: shared rules and the API)

- shared/src/gains.ts: Gain { itemId, count, rank }, GainList, gain(), mergeGains() (same item +
  rank add up; empty counts drop), gainsSince(before, after) (the ledger entries written between two
  states: materials and furniture that came IN; reasons dungeon_bank, lunch_box, shelf, tavern_order
  are not gains), gainsFromRunEvents(events) (the run's 'loot' events with their rolled rank, minus
  'left_behind'; gold is never a gain). Gold is not a gain anywhere (the wallet shows it).
- GameAPI: RunUpdate.gains (chest, kill drop, mimic, boss, rock/ore, gem), ChopUpdate.gains,
  FishUpdate.gains (the fish or fished-up thing), HarvestResult.gains, BuyResult.gains (catalog).
  craft, smelt, forge, cook, buyGear, buySeeds now return GainList | null (null = refused, an empty
  list = done but no item, e.g. a style recipe); forge and buyGear give the gear piece / potion id
  itself (gear is not in the ledger). Banking a run at the exit gives no gains (shown at the find).
- NOT DONE YET (BG3 part B): the popups above the head (queue helper, rendering, Settings
  "Popups"), claimBookReward and quest claims (gold only today, no items), packs (BG8), gems (BG4).

## Inventory, chat and texts (step 5)

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
- TEXTS (after 7b): every text on screen stays at reading pace: shared/src/text.ts readingMs
  (at least TEXT_MIN_MS 4 s + TEXT_MS_PER_WORD 0.35 s per word), then fades over TEXT_FADE_MS.
  Toasts (toast.ts; a tap hides them) and chat bubbles use it. docs/UI-REFERENCE.md has the rule.

## UI: layout rule, UI polish, logo splash

- UI LAYOUT RULE (step 5). The room fills the whole screen; all UI sits on top of it at the
  edges, never in solid bars. Every frame, button, slot and panel uses the one frame style in
  client/src/ui/ui.css, as described in docs/UI-REFERENCE.md section 3 (reworked in the UI
  polish step, see UI POLISH below): a layered wooden frame around speckled parchment, darker
  inset sections, dense slots, raised buttons, dark name plates, dark brown text, square corners,
  pixel font, at least 44 px touch size, no default browser buttons. Places:
  - Top-left: the info panel, two short lines: coin + gold, then room name, level and a thin xp
    bar (hp and lantern bars under it in the dungeon and the mine).
  - Right edge: one column of square icon buttons: Quest, Map, Catalog, Build, Dungeon, then More
    (a small grid with labels: Workshop, Room, Avatar, Chat, Settings). The Bag button is not in
    the column (owner's decision after 9d): it sits at the right end of the hotbar, inside its
    frame, as tall as a slot (sideButtons.ts makes it, main.ts appends it to hotbar.el). From 900 px wide
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
- STEP 9t, PART A (the tavern: shared rules and tests only; the prompt is in docs/NEXT-STEPS.md):
  - Data: shared/data/drinks.json (root_ale, carrot_cider, pumpkin_stout, glowcap_tonic: inputs,
    minutes, mugs, baseValue per mug, tip (a share of the price; only the tonic), rank; values
    chosen by the AI, the owner may tune them). furniture.json: bar_stool (1 seat), round_table and
    long_table (surfaces), mug_shelf and menu_board (wall, appeal), keg_rack (appeal),
    brewing_barrel (FurnitureType.brews); all category 'shop_furniture', in the catalog.
    roomShapes.json shopStart gained round_table, stool_left, stool_right, brewing_barrel for every
    shop shape. npcLines.json gained no_seat, no_menu, table_talk, toast, drink_talk, order_wait,
    unhappy, thanks.
  - Types: DrinkId in MaterialId, MaterialGroup 'drink' (materials.ts DRINK_TYPES, getDrinkType,
    isDrinkId; shop category 'food'; the Book's Food tab, source "Brewed"), LedgerReason 'brew',
    'tavern_order', 'tavern', 'tavern_gift'. GameState.tavern (TavernState: menu, guests,
    nextGuestInMs, mess, brews, serveQueue, holding, history, lastLines, updatedAt, introSeen).
  - brewing.ts: Brew { barrelUid, drink, readyAt }, startBrew (the barrel must stand in the tavern
    and be empty; crops out, ledger 'brew'), brewReady / brewReadyInMs, collectBrew (mugs in),
    barrels, returnOrphanBrews (a barrel sold at the stall gives its crops back; a barrel in the
    bag keeps its brew; run it when items change).
  - tavern.ts: the menu (isServable = drinks and food; defaultMenuEntry: drinks on at baseValue,
    dishes off; setMenu, menuRows, menuOffers = on and in stock, chooseOrder (the price rule),
    coinsFor (price + tip), recordOrder). Seats (tavernSeats: a 'sit' seat with a table (a surface
    item or the bar) within GUEST_TABLE_NEAR_PX, never in the staff zone; each has a spot on the
    table; cached per items list; freeTavernSeats; pickSeats: a group together at one table when it
    fits, else spread). The player: requestServe (at most SERVE_QUEUE_MAX), pickUpOrder (at the
    bar: the next order into TavernState.holding), serveStops (behind the bar, then the table
    spot), cancelServe, collectCoins (ledger 'tavern'), clearDish, tavernCounts.
  - guests.ts: Guest (phases enter, to_seat, settle, order, eat, no_seat, no_menu, leave),
    stepTavern(state, world, dtMs, rng, at) -> { state, events } (TavernEvent: guests, say, order,
    refuse, sip, coins, unhappy, to_stall), deliverOrder (the guest starts eating), repathGuests,
    catchUpTavern (maths only), guestAvatar, rollGroupSize. TavernWorld.playerHere: the patience
    only runs while the player is in the tavern; while away guests only come while fewer than
    AWAY_ORDERS_MAX are there. An order takes the unit out of the bag at once (ledger
    'tavern_order', never a Book find) and gives it back when the guest leaves unserved. Guest ids
    come from ShopState.nextCustomerId, so a guest who looks at the stall on the way out
    (GUEST_BROWSE_STALL_CHANCE; customers.ts stallVisitor) is the same person as a shop customer.
    Never more guests than tavern seats, at most GUEST_MAX. Shop customers no longer sit on tavern
    seats (customers.ts freeSeats). Config section "The tavern (step 9t)".
  - A new game: createNewPlayer places the bar, the stall table, the round table, 2 stools and the
    barrel (uids 1 to 6; config TAVERN_START_ITEMS) and the barrel holds root ale that is ready.
  - Part B must: call stepTavern next to stepShop in LocalGameAPI (and catchUpTavern where
    catchUpShop runs, repathGuests and returnOrphanBrews when items change), walk the avatar along
    serveStops, draw guests, orders, coins and dishes. Part C: the brewing and Menu panels, the
    toast for TavernState.introSeen false, the tavern texts, tools/simulate-economy.ts.
  - Tests: tavern.test.ts (menu, price rule, seats, coins and dishes, the serve queue),
    guests.test.ts (seating and groups, the serve chain, patience, the away rule, the ledger),
    brewing.test.ts (real time, reload, orphan brews), save.test.ts (migration 12),
    customers.test.ts (tavern seats), tavernTest.ts (helpers, not exported).
- STEP 9t, PART B (the tavern in the client, on the 32 px cell grid and the block world):
  - Seats are cells: GUEST_TABLE_NEAR_PX is 16 (half a cell), so a stool counts when its cell is side by
    side with a table cell (the bar counts as a table); a diagonal or a one-cell gap is no seat. A guest
    on a seat looks toward the table spot (TavernSeat.facing = dominant axis to the spot), whichever way
    the stool is turned. Wall items (menu board, mug shelf) stay free along the back wall.
  - Blocks: guests walk on the shop grid that includes the blocks (LocalGameAPI.shopGrid), repathGuests
    runs when blocks or items change. New refusal 'seat_blocked' (blocks.ts, reachableSeatKeys): a block that
    would cut a tavern seat guests can reach now off from the door is refused (like door_blocked and
    counter_blocked); toast "Guests could not get to a seat then."
  - GameAPI (shared/src/api.ts): getTavern (TavernView: guests, mess, serveQueue, holding, brews, at),
    onTavern (TavernClientEvent = the guests' TavernEvent + own-avatar events walk, holding, served,
    collected, cleared, queue), serveGuest(guestId), tidyTable(messId, 'coins' | 'dish'), collectBrew(barrelUid).
    LocalGameAPI.update() steps stepTavern next to stepShop (same 100 ms clock, same catch-up gap, then
    catchUpTavern), returnOrphanBrews and repathGuests run when items or blocks change.
  - The player's errand (LocalGameAPI.runErrand, WalkState.task): serveGuest queues the order (requestServe,
    at most SERVE_QUEUE_MAX) and the avatar walks to the bar's staff spot (stage 'bar'), picks the order up
    (pickUpOrder), walks to the guest's table spot (stage 'table'), puts it down (deliverOrder), then the next
    queued order. tidyTable walks to a table spot (stage 'mess') and takes the coins or clears the dish.
    A walk of any other kind (floor tap, sit, other room) drops the errand: the queue and the hands are empty,
    the orders stay open. tidyTable is refused while orders are queued or carried. Taps, never hold.
  - Gold taken from a table is a gain with the id 'gold' (GOLD_GAIN_ID, new icon shape 'coin', COIN_ICON in
    extraIcons.json): one popup per collection. Collected mugs are a normal gains list. No new gem source.
  - Client: render/tableMess.ts (coins, the empty mug or plate, and the meal being eaten, drawn right after the
    table they lie on, tap hit test `at`), ui/orderBubbles.ts (an HTML bubble with the item's icon beside the
    guest's head, 44 px, dimmed when queued or carried, red border when the guest called for the order),
    render/customerViews.ts now takes any Walker (shop customers and guests; `sitFacing` for guests, `at` for
    taps). main.ts: the tavern block (tavernTap: guest with an order, coins or dish, brewing barrel),
    sounds 'clink' (an order lands) and 'murmur' (3 or more guests sit), the Map badge says "n waiting, n orders,
    n coin piles". A tap on a brewing barrel collects a ready brew (the brewing panel is part C).
  - Not changed in B: the GameState shape (SAVE_VERSION stays 20; the 12 -> 13 migration of part A already
    gives old saves the table, 2 stools and the barrel in the bag).
  - Checked with a headless browser (1000 x 700): a guest sits, orders, the avatar fetches the mug at the bar
    (it shows in the hands), puts it on the table, the guest drinks, leaves coins and the mug, a tap takes
    the coins (+gold, popup) and another clears the mug.
  - Tests: client/src/api/tavernAPI.test.ts (the chain through the API), tavern.test.ts (cell seats, facing),
    blocks.test.ts (seat_blocked).
- LOGO SPLASH (small step after the atmosphere step): client/src/assets/logo.gif is the owner's
  logo (256 x 256, animated GIF; never change or redraw it). The splash markup is in
  client/index.html (#splash, styled in style.css) so it shows before any JS; ui/splash.ts
  runSplash() pops, holds and fades it (config SPLASH_POP_MS 400, SPLASH_POP_FROM, SPLASH_HOLD_MS
  1500, SPLASH_FADE_MS 500, SPLASH_LOGO_PX, SPLASH_MARGIN_PX; reduced motion = fade only), a tap or
  key skips it (the event is swallowed), then the element is removed. splashBox (tested) picks x1 /
  x2 and whole device px. main.ts awaits it before character creation and before the first
  openRoom (so the camera intro starts after it). The logo is also the favicon (index.html) and the
  128 px picture at the top of Settings (settingsPanel.ts, .settings-logo).
- The pixel font draws a small "2" much like an "8" (for example the hotbar numbers and the
  gold). Worth checking when the art pass (step 6) happens.

## Shop, catalog, styles, hints (step 7)

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
    cheapestIn, decide, visit, recordSale, fillQueueMath (step 9d; was simulateShop), lootTypeId,
    lootCategory, lootBaseValue, typeName, typeBaseValue, validPrice), customers.ts (Customer,
    ShopEvent, stepShop (the live customers: timer, walk, decide, queue, pay), queueSpots,
    findCounter, tillPoint, repathCustomers, catchUpShop (step 9d), customerLook), economy.ts
    (catalogPrice, catalogTypes, buyCatalog, unlockStyle, applyStyle, isStyleUnlocked,
    upgradeCost, upgradeRoom), testState.ts (test helpers: ledgerGold,
    ledgerMaterials; not exported). furniture.ts gained canPickUp. newPlayer.ts gained
    addShopStartItems (save migration 2 -> 3).
  - client/src/render: styleArt.ts (floorTexture, wallTexture, stylePreviewUrl: code-drawn
    style art), slotGoods.ts (goods drawn small: at FurnitureType.slotSpots when facing down (the
    shelf's three boards, inside the display case), else spread along the top),
    customerViews.ts (CustomerViews: customers animated along their paths), lieArt.ts.
    ItemViews.setGoods draws the goods; wall items are in the objects layer.
  - client/src/ui: shelfPanel.ts, catalogPanel.ts, roomPanel.ts, shopFeedback.ts (sale floats,
    the hint box; the away summary is gone since step 9d). pixelIcons gained book, house and the reaction faces
    (big_smile, smile, shrug, frown). chatBubbles.addNode shows a reaction bubble.
  - tools/simulate-economy.ts (npm run simulate, uses tsx): cheap / fair / greedy prices, appeal
    0 and 60, 6 items, 1 h and 8 h; prints gold, items sold, time on the slot, blocked slot time.
    tools/tsconfig.json is part of npm run typecheck.
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
    SHOP_CATCH_UP_GAP_MS (10 s; also always when the game opens) uses catchUpShop (step 9d):
    nothing is sold; customers carrying an item stay, the others are gone, the queue fills up with
    fillQueueMath (at most QUEUE_MAX), and everyone in the line stands at their queue spot.
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
- HINTS (step 7): config HINTS, GameState.hintsDone counts the finished ones, shown one at a
  time in the hint box under the info panel. The hint stays until the player taps it ("tap
  to continue ▸"); a tapped hint stays away until the next one comes or the player taps the
  quest button (after step 8): the scroll icon at the TOP of the right-edge column, hidden when
  there is no quest, selected ('on') while the quest card shows, and blinking warm ('glow') while
  a quest is still going but its card is closed (HintBox.toggle / onChange in shopFeedback.ts).
  The quest card (.quest-card) says "Quest n of N" (N = HINTS.length, 5 since step 9b: the farm quest "plant your first turnip" is number 5), the task and "tap to hide". It opens to the
  left of the quest button with a small tail pointing at it; when that would overlap the
  top-left info column (phones) it goes under that column instead, without the tail. It steps
  aside while a side panel is open (setCovered). It pops in and out smoothly like the panels
  (.opening / .closing: scale 0.95 <-> 1 with a fade, QUEST_CARD_POP_MS 120 ms, off with
  prefers-reduced-motion; step 9d fixed the stutter: it grew from scale 0.6 in 4 big steps over
  350 ms, about 30 px per frame, and faded out over 900 ms). 1 is done by the first buy (a style as the first
  buy also skips 2), 2 by placing an inventory item, 3 by putting an item on a slot.
- AFTER 7b (playtest fixes): customers.ts phases enter, browse, decide, queue, pay, paid,
  leave; Customer gains speed, shelfUid, browsing, looks; ShopEvent 'thinking' (the "..." bubble
  for ms). Config: CUSTOMER_WALK_SPEED, CUSTOMER_SPEED_VARIATION, CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_BROWSE_MIN_MS / MAX_MS, CUSTOMER_SECOND_LOOK_CHANCE, CUSTOMER_AFTER_PAY_MS,
  CUSTOMER_MAX_IN_SHOP. CustomerViews walks each customer at its own speed. Character creation
  (newGame.ts makeCharacter, .charmaker CSS) and lookPickers.ts use tabs (Body, Hair, Top,
  Bottoms, Shoes); the preview stays in view. Customers in an old save are settled when the game
  opens, so no save migration was needed.

## Room shapes, character creation, new-game intro (step 7b)

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
- The start look (config START_LOOK): skin 30, hair 5, short hair, long sleeves (shirt 7),
  trousers (legs 23), shoes 6. The box avatar lives in render/avatarParts.ts now.

## Shop life (step 9d)
- STEP S1 REMOVED the loot customers described here (customers.ts, the plans, the till, the queue, slots and prices). Read the S1 section at the end first.

- STEP 9d (shop life; owner's decisions in section 9: NO AUTO-SELLING, natural customers, talk,
  take and give):
  - Data: shared/data/npcLines.json (moments enter, browse, cheap, fair, high, too_high, queue,
    pay, leave, lovely, empty; 6+ original lines each, <= NPC_LINE_MAX 40 characters; tested).
  - shared/src/npcTalk.ts: NPC_LINES, NpcMoment, CustomerKind, reactionMoment, pickLine (never the
    last index), talkChance (TALK_CHANCE x CHATTY_TALK / HURRIED_TALK), maybeSay. ShopState.lastLines.
  - shop.ts: fillQueueMath(shop, appeal, waiting, elapsedMs, rng) -> { shop, arrivals } replaces
    simulateShop (no gold; at most QUEUE_MAX wait). economy.ts lost catchUpShop; customers.ts has
    catchUpShop(state, world, at, rng) (no settleCustomers any more: nobody pays without the player).
  - customers.ts: Customer gained kind, looksMax, decorLeft, decorUid, seat, sitChecked, callInMs;
    phase 'admire' (looking at a decoration: shopDecorations = shop items with appeal, no slots,
    not the counter); customerLook(id) (seeded, free clothing + LOOK_COLORS; CUSTOMER_LOOKS is gone),
    rollKind, waitingCount, customerAvatar state 'sit'. In the line customers face the counter;
    from spot 1 on one may sit (CUSTOMER_SIT_CHANCE, a free 'sit' seat within CUSTOMER_SEAT_NEAR_PX,
    not the player's: ShopWorld.seatsTaken; LocalGameAPI.sit counts customer seats as taken) and
    stands up for spot 0. The payer waits forever and calls out (CUSTOMER_CALL_AFTER_MS, then every
    CUSTOMER_CALL_EVERY_MS). After paying `carrying` is null (the client keeps the item in their
    hands). Events: 'say' { customerId, text }; 'reaction' gained line? and took? { shelfUid, index,
    loot }. Config section "Shop life (step 9d)".
  - client: render/itemHops.ts (ItemHops in RoomView.markerLayer: arc hops, `stay` for the item on
    the counter, hopPoint), render/avatarSprite.ts (held-item layer: setHeld, handOffset; gestures
    reach / nod / hand: gesture(), gestureOffset), render/customerViews.ts (sitting on seats with the
    seat's depth, held items, hold(), gesture(), handPoint(), heldOf()), render/slotGoods.ts drawGood.
    main.ts: 'say' and reaction lines as bubbles (.npc-line), the take / pay / give hops, the
    player's hand-over at a sale, the "n waiting" badge on the Map button (.map-badge) and the
    Shop card (PlaceCard.badge). The "while you were away" summary is gone (GameAPI
    takeAwaySummary, AwaySummary, showAwaySummary, .away-panel removed).
  - tools/simulate-economy.ts: the new rule (the player serves the line every 5 / 30 / 120 / 480
    min over 8 h; gold, sold, minutes lost to a full line).
  - Tests: npcTalk.test.ts, customers.test.ts (catch-up, full line, looks, talk, decorations,
    sitting), shop.test.ts (fillQueueMath), save.test.ts (migration 8), localGameAPI.test.ts.

## Fix list after 9d (nav, natural customers, staff only, chests)

- FIX LIST AFTER 9d (owner's playtest):
  - Nav: NAV_CELL 8, AVATAR_RADIUS 4 (see NAVIGATION). queueSpots keeps spots QUEUE_MIN_GAP_PX
    apart (cells are small now) and is cached per grid.
  - NATURAL CUSTOMERS (shared/src/customerPlan.ts + customers.ts): no fixed route. Every visitor
    gets a plan (Customer.plan, step, doing) from planVisit(rng, kind, buys, lastPlan): small
    behaviours picked by weight (config ACT_WEIGHTS x ACT_KIND_BONUS per kind; how many:
    BUYER_ACTS / WINDOW_ACTS): wander (a random free spot, stand a moment), decor (a random
    decoration, never the one before), goods (a look at a stocked table / shelf / case), talk (walk
    next to another standing customer; they face each other, 2 to 3 bubbles in turns: lines
    smalltalk, smalltalk_reply, smalltalk_end; the other one is held with holdMs), remark (a
    'remark' line to nobody), sit (a free seat for 3 to 6 s). Never the same behaviour twice in a
    row, and never the same plan as the visitor before (ShopState.lastPlan). A buyer's plan ends
    with 'goods' = the look they decide at (phase 'browse' -> 'decide' as before); what cannot be
    done now becomes a remark or a wander. Phases: enter, act, follow, browse, decide, queue, pay,
    paid, leave ('admire' and looks / looksMax / decorLeft are gone).
  - Window-shoppers (Customer.buys false; WINDOW_SHOPPER_CHANCE): only small behaviours, maybe a
    'window' line, then out; no decision, no reaction face, nothing counted. Pairs (PAIR_CHANCE):
    a friend (followId, phase 'follow', buys false) comes in behind the other, stays PAIR_NEAR_PX
    beside where they go, and their plan gets a 'talk' (with the friend first). Limits:
    CUSTOMER_MAX_IN_SHOP 5 NPCs; a buyer only comes while buyerCount (buyers not yet paid) <
    QUEUE_MAX, so at most 3 wait at the till; with a full line only window-shoppers come
    (WINDOW_SHOPPER_WHEN_FULL_CHANCE). The first visitor of a game is always a buyer.
  - STAFF ONLY: furniture.ts staffZone (the strip behind the counter, STAFF_ZONE_DEPTH_PX deep,
    STAFF_ZONE_SIDE_PX wider on each side). customerPlan.ts npcGrid = the room's grid with those
    cells blocked (cached); EVERY customer path, wander spot, queue spot and seat uses it
    (npcPath: a blocked or unreachable goal ends at the nearest free cell they can reach, so a
    decoration behind the counter is looked at from the customer side). The player's grid is
    unchanged.
  - npcLines.json gained smalltalk, smalltalk_reply, smalltalk_end, remark, window.
  - Lighting: the indoor look stays as it was (owner: "keep it"); outdoors has daylight (see
    ATMOSPHERE). Backdrop: grass and trees outdoors, calmer planks indoors.
  - UI: Catalog in the column, Bag at the hotbar (see UI LAYOUT RULE; docs/UI-REFERENCE.md).
  - Dungeon chests are spread (generate.ts chestSpotOk, blocksFromRect; config CHEST_SPACING 3,
    CHEST_SPAWN_ROOM_GAP 3, diagonals count as 1): at least 3 blocks from the spawn room and from
    each other; a floor too small for that relaxes it by 1 or 2 blocks (never under 2).
  - Tests: nav.test.ts (24 px gap, 12 px gap, speed), customerPlan.test.ts (the picker, the staff
    grid), customers.test.ts (staff only, natural customers, window-shoppers, talk and pairs),
    generate.test.ts (chest spread), save.test.ts (migration 9).

## Dungeon logic (step 8)

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
    cells (DUNGEON_NAV_CELL, its own number), a cell is blocked on a wall block, NO avatar radius because corridors are 1 block wide;
    cached per map), generate.ts (floorRng(seed, n), enemyHp, makeEnemy, blockDistances,
    generateFloor(seed, n, round) -> { map, enemies, chests }), loot.ts (LOOT_TABLES, getLootTable,
    rollDrop, rollLoot), runBag.ts (addToBag (12 slots, materials stack to 10, gold no slot, the
    rest is left behind), bagLoot), step.ts (step, isPaused, exitChoices, distance), bank.ts
    (runIsFree, startRun (pays the key unless gold < 10, takes the potions along), finishRun
    (ledger 'dungeon_bank', addXp, potions back)). testRun.ts holds test helpers (not exported).
  - tools/simulate-dungeon.ts (npm run simulate:dungeon [runs] [round]): the bot of step 8 at
    350 / 500 / 700 ms and 500 ms with sword and armor, both rounds.
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
- Loot values in loot.json stay as they are until the owner tunes them after playing step 9.
- Step 8 balance (npm run simulate:dungeon): round 1 (the current DUNGEON_ROUND) is easy (about
  100% survival); the survival targets are for round 2.

## The dungeon in the game (step 9)

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
- The debug "Give random loot" button is gone (step 9: the shop sells real loot).
  LocalGameAPI.debugGiveFurniture is for tests only.

## Farm and cooking (step 9b)

- CHANGED IN K1 (see the K1 section at the end): the cooking POT is gone; you cook on a STOVE in the tavern, in real time (cook() is replaced by startCook / collectCook). Read the K1 section first.
- CHANGED IN BG6 (see the BG6 section at the end): the fixed plots, Plot / FarmState, plantPlot / harvestPlot and GameState.farm are GONE (seeds are planted on soil cells and punched, Room.plants). The cooking pot, crops, food, cooking and the lunch box below still hold. Read the BG6 section first.

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

## Mine and forge (step 9c)

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

## Ranks and the Book (step 9e)

- STEP 9e (ranks and the collection book; owner's decisions in sections 7 and 10):
  - Ranks: types.ts Rank ('common' | 'rare' | 'ultra_rare' | 'legendary'; Rarity is gone).
    FurnitureType.rank and MaterialType.rank; the data files carry `rank` (furniture.json,
    materials.json, crops.json (crop and seed share it), food.json). The crypt furniture is
    ultra_rare (it comes from the ultra rare chest rows), the bone throne legendary; the ranks of
    materials, ores, bars, crops and food were chosen by the AI (the owner may tune them).
    shared/src/ranks.ts: RANKS, RANK_NAMES, rankOf(id), sparkles, rankWeights, rollRank (a rank
    that cannot come falls to the next lower one). Config: RANK_COLORS, RANK_WEIGHTS, SPARKLE_MS,
    BOOK_REWARD_STEPS.
  - Loot (dungeon/loot.ts, loot.json): LootDrop.rank, LootTable.rankMultiplier, tableRanks,
    rankChances, rollDrop (rank first, then a weighted pick in that rank; returns the rank).
    Tables: wooden_chest, golden_chest, boss, and one per enemy type (ENEMY_TABLES: slime, bat,
    skeleton, mimic, bone_king; the old enemy_rare table is gone). step.ts enemyTypeOf (the kind,
    or 'mimic'); a kill rolls RARE_DROP_CHANCE for the enemy's table (the Bone King always; not
    in the mine). The 'loot' event carries `rank` when above common; the 'kill' event `mimic`.
    20 new materials (types.ts EnemyDropId) and 5 new crypt furniture types with recipes
    (slime_jar, bat_wing_fan, skull_trophy, mimic_chest "Toothy chest", kings_banner).
  - The seen list: Player.seen (SeenMap: id -> { count, firstSeenAt }), kept right in two places
    only: ledger.ts applyChange (every material or furniture gained; not reason 'shelf', and not
    Change.notFound = food brought home from a run) and bank.ts finishRun (DungeonRun.kills and
    .met, keys 'enemy:<type>', count = kills; kept after death like xp). An enemy is met when it
    notices the player (chase range) or is killed. shared/src/seen.ts: enemyKey, addSeen,
    addSeenAll, isSeen, seenCount, ownedFinds. createNewPlayer marks the start items.
  - The Book: shared/src/book.ts (BOOK_TABS, bookEntries(tab), sourceOf(id) ("Drops from: Slime",
    "Dungeon chests", "Catalog", "Crafted", "Farm", "Cooked", "Mine", "Forge", "Your shop"),
    bookProgress, bookTotal, newEntries, BOOK_REWARDS (shared/data/bookRewards.json: per tab
    { percent, gold, hat: null }; step 9g fills in the hats), bookRewards (locked / ready /
    taken), claimBookReward (ledger reason 'book_reward'; Player.bookRewards '<tab>:<percent>'),
    openBook (Player.bookOpenedAt)). GameAPI: bookOpened, claimBookReward; the panel reads
    Player from getPlayer.
  - client: ui/bookPanel.ts (the panel; enemy pictures are small pixel maps in code), ui/rank.ts
    (applyRankColors puts --rank-* on the UI root; setRank, rankName), the rank classes in ui.css
    (.rank-<rank>, .rank-name, .slot.rank-*), used by the hotbar, bag, run bag, catalog cards,
    shelf panel, crafting, cooking and the run result lists. floatTexts.add(..., rank): rank
    colour and the sparkle. pixelIcons 'journal'; PanelName 'book'; sideButtons: Book in the More
    grid, key J, setBookDot (the red .new-dot on Book and More).
  - tools/simulate-dungeon.ts prints the average kills per drop of each rank per enemy (step 9e):
    slime / bat / skeleton about 13 (common), 50 (rare), 220 (ultra rare), 1900 to 2000
    (legendary); mimic 22 / 25 / 75 / 470; Bone King 3.6 / 2.1 / 4.8 / 21.5. The 500 ms bot with
    iron gear kills about 4 to 5 of each normal enemy per round 2 run.
  - Chat bubbles (fix found while testing): a bubble's age is real time, nothing is added while
    the page is hidden, and one avatar shows at most CHAT_BUBBLES_PER_AVATAR (3). Before, bubbles
    aged per drawn frame and piled up above a waiting customer while the page was in the
    background.
  - Tests: ranks.test.ts, book.test.ts (the seen list and the Book), dungeon/loot.test.ts (rank
    rolls), save.test.ts (migration 10).

## Lakeside: woodcutting and fishing (step 9f)

- STEP 9f (the lakeside: woodcutting and fishing; section 10d):
  - Data: shared/data/fish.json (CATCH_TYPES: id, name, kind 'fish' | 'thing', rank, baseValue,
    colour, minCm / maxCm, weight 3 for fish and 1 for things), forge.json gained steel_axe (slot
    'axe', hitsPerSwing 2), copper_reel_rod and mithril_rod (slot 'rod': rankMultiplier, boxBonus,
    gravityScale), materials.json gained resin, amber, golden_acorn, food.json grilled_perch,
    carp_stew, eel_pie, furniture.json the 8 lake pieces (theme 'lake'; FurnitureType.swim for the
    fish tank), recipes.json their recipes plus lake_pebbles and reed_wall, styles.json the two
    styles, roomShapes.json the 'lakeside' shape, bookRewards.json the 'fish' rewards. The
    catches and tree drops were valued and ranked by the AI (the owner may tune them).
  - Types: RoomKind 'lakeside', FishId / ThingId / TreeDropId in MaterialId, MaterialGroup 'fish'
    | 'thing' (fish are shop category 'food', things 'materials'), ShopCategory 'lake_furniture'
    (customers want it too), GearSlot 'axe' | 'rod' (gear.ts ownedAxe, ownedRod), LedgerReason
    'chop' and 'fish', Player.lakesideRoomId and Player.biggest, GameState.lakeside.
  - shared/src: lakeLayout.ts (config LAKE_WATER, LAKE_PIER, LAKE_TREES, LAKE_BUSHES: waterRects,
    pierRect, treeAnchor / treeRect / treeStand / treeAt, isWater, lakeBlockers (the water and
    the trunks block walking; farmLayout fixedBlockers uses them), castSpots, nearestCastSpot,
    nearestWaterPoint, bobberPoint (at least CAST_MIN_PX from the avatar)), woodcut.ts (TreeState
    { hits, felledAt }, LakesideState { roomId, trees, axeReadyAt }, chop(state, index, now, rng),
    fellLoot, isStump, regrowInMs, growTrees), fish.ts (the data only), fishing.ts (FishSession,
    newFishSession(rng, gear), step (exported from the index as fishStep, the dungeon has its own
    step), FishInput press / release / tap / cancel, fishInBox, rollCatch, bankCatch). furniture.ts
    fitsRoomKind refuses everything on the lakeside; economy upgradeCost / applyStyle refuse it.
  - The reel numbers are in config (FISH_BAR, FISH_THRUST, FISH_GRAVITY, FISH_TAP_KICK,
    FISH_BOX_*, FISH_REEL per rank, FISH_BITE_MS per rank). Calibrated with a bot that reacts
    every 0.1 / 0.25 / 0.4 s: a common fish is landed by everyone, a legendary one with the basic
    rod by about 40% of sharp players and almost nobody slow; the mithril rod makes a legendary
    about as easy as an ultra rare one with the basic rod (tested).
  - GameAPI: getLakeside, chopTree (the avatar must stand within CHOP_REACH_PX), castAt (the cast
    plan: path, spot, bobber), fishStart, fishStep(inputs, dtMs) (a catch is banked at once),
    fishStop. A cast line is not saved (a reload loses it, nothing is lost with it).
  - client: lakeside/lakesideScreen.ts (the screen: trees, bushes, water, pier, bobber, the taps,
    the fishing loop; walks first and acts in arrived()), lakeside/lakesideArt.ts (placeholder art
    in code), ui/fishBar.ts (the bar above the hotbar: text, the reel track with the fish and the
    catch box, the catch bar, the Hold button; Space holds, Escape stops), FurnitureSprite swim
    (the fish tank), styleArt lake_pebbles / reed_wall, pixel icons fish / axe / rod, the Map's
    Lakeside card, the Workshop's Forge gets Axe and Fishing rod, the Book's Fish tab (with the
    biggest catch), room panel text, main.ts (roomFloats = a FloatTexts for what a tree or a fish
    gave, in its rank colour; OUTDOOR_KINDS in shared config: farm and lakeside get the grass
    backdrop and no shade). While the line is out every tap on the room is a fishing tap.
  - Tests: woodcut.test.ts, fishing.test.ts, lakeLayout.test.ts, save.test.ts (migration 11),
    book.test.ts (Fish tab), client/src/api/lakesideAPI.test.ts (the loop through the API).

## Atmosphere: light, shadows, backdrop, dust, sound

- ATMOSPHERE (owner's request after the UI polish; rendering, sound and data only, no rules):
  - Light sources are data: FurnitureType.light = { radius (world px), color (palette index),
    flicker (0 steady .. 1 candle) } (types.ts LightSource). furniture.json: lamp (candle stand),
    counter (the till glow), skull_lamp, wall_torch. The cooking pot uses config COOKING_POT_LIGHT.
  - Config (end of shared/config.ts): AMBIENT_LIGHT per room kind { color, strength } (a palette
    colour laid over the room with that alpha; kept low, the owner tunes the darkness here; the farm has 0), OUTDOOR_KINDS (the farm: daylight, no
    shade and no light pools from furniture, only the small glow of the pot's fire),
    LIGHT_PIXEL 2, LIGHT_CUT (the part of the shade a light takes away at the flame), LIGHT_GLOW
    (how much of its colour a light adds at the flame), LIGHT_STEP_MS, FLICKER_RADIUS /
    FLICKER_BRIGHTNESS, DUST_PER_LIGHT, DUST_MAX, WALK_PUFF_MS, IDLE_SHIFT_EVERY_MS / HOLD_MS,
    SOUND_DEFAULT_VOLUME, PREFS_KEY.
  - client/src/render/atmosphere.ts (pure, tested): hash01, lightFalloff (1 at the flame, smooth
    to 0 at the radius), flickerAt (steps with LIGHT_STEP_MS, from a seed and the time),
    lightPoint, itemLights, ellipseRows (pixel ellipse), shadowSize, idleShift, dustLightCount,
    dustSpeck.
  - client/src/render/roomAtmosphere.ts (RoomAtmosphere; main.ts calls setRoom after every
    view.setRoom, setItems from syncItems (use syncItems, never itemViews.sync alone), update every
    frame with the feet of standing / walking avatars, puff, setLighting). Lighting (reworked twice
    after the owner's playtests; now: a bright warm room with small soft halos, no ringed pools, no
    door daylight patch; the owner approved this indoor look after 9d: KEEP IT, do not rework it; general traits of cozy tavern games only) = a light map RenderTexture
    (1 texel = LIGHT_PIXEL art px) shown as ONE normal layer (RoomView.lightLayer): empty outside
    the room, the mild ambient shade on it; every light takes the shade away with a halo sprite
    (one 64 px white texture with lightFalloff alpha, blend 'erase'). Above the map every light has
    a second halo sprite, tinted with its colour, blend 'add' (the warm glow). Both are updated
    only every LIGHT_STEP_MS or when something changed. Shadows: two-shade pixel ellipses in
    RoomView.shadowLayer (under the objects) for blocking floor items, the pot and avatars
    (AvatarSprite(look, false) = no built-in shadow; the dungeon keeps the built-in one). Dust:
    1 px specks in RoomView.airLayer, the walk puff in shadowLayer.
  - client/src/render/backdrop.ts (Backdrop): the VOID (old-Habbo feel), same in every room: flat
    deep night colour (PALETTE[25]) with a sprinkle of 1 texel specks (SPECKS per 192 px tile,
    drawn 2 screen px wide, mostly dim), drifting at PARALLAX 0.15 of the camera, whole screen px.
    Replaced the old planks (indoors) and grass with trees (outdoors). A mild stepped vignette,
    baked with it into ONE opaque screen picture that is redrawn only when the camera moves. Under
    view.world on the stage; hidden in the dungeon / mine (they keep their own look).
  - CustomerViews: standing customers shift 1 px sideways now and then (AvatarSprite.setShift).
  - Sound: client/src/audio/sound.ts (Sound; Web Audio, no files): step, coin, bell (a soft
    two-note door chime, at most once per 6 s; the owner found the first bell irritating), pop, click,
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

## BG5: blocks and punching (step BG5; also the gems core and the gain popups)

- OWNER'S DECISIONS: (b) play mode places and punches directly, furniture is still moved in Build
  mode; (c) breaking blocks can drop gems in every room; (d) blocks in every room the player may
  build in (hotel, shop/tavern, farm), the lakeside stays unbuildable.
- DATA: shared/data/blocks.json (BlockType in shared/src/blockTypes.ts): dirt 1, clay 2, thatch 2,
  glass 2 (rare), planks 3, lantern_block 3 (rare), stone 4, brick 5, mossy_stone 6 (rare),
  cinder_block 8 (ultra_rare). `drops` = extra items besides the block (planks: wood 10%, mossy stone:
  cloth 5%), `seedId` null until BG6, `inCatalog` true for dirt, planks, stone, glass. Blocks are
  materials with group 'block' (materials.ts adds BLOCK_TYPES), so bag, hotbar, ledger, Book, shop
  slots and gains work unchanged. Block ids are in types.ts (BlockId). hotbar: bag.ts hotbarMaterial()
  lets seeds AND blocks into the hotbar; a block type met for the first time lands in a free
  hotbar slot like a seed. Book: new tab 'blocks' (bookRewards.json has its 25/50/75/100% gold).
- ROOM: Room.blocks: Record<"col,row", { id, hits, hitAt }> (room.ts: blockKey, blockInCell,
  blockList, blockRects). roomBlockers() now includes the blocks, so canPlace for furniture, the door
  checks and every grid see them. (blockInCell, not blockAt: the dungeon already exports blockAt.)
- RULES (shared/src/blocks.ts, all pure): blockProblem(room, items, type, c, r, { standing, from })
  returns null or why: not_buildable (lakeside), wrong_room (placeIn), floor, door, taken, furniture
  (any floor item, rugs too), fixed (farm plots, pot), avatar (a point in `standing`), door_blocked
  (doorReachesMiddle with the block added), counter_blocked (behindReachable for every counter),
  reach (from != null and farther than BLOCK_REACH cells, checked LAST so a walk is only offered for
  an otherwise valid cell). placeBlock / hitBlock return a result with the new state (ledger reasons
  block_place, block_break, block_return). hitBlock(state, roomId, c, r, at, lastHitAt, rng, from):
  cooldown is passed in as lastHitAt (the API keeps it, not saved); hitsNow() heals after
  BLOCK_HEAL_MS; crackStage() is for drawing. blockDrops(type, rng) rolls in the order: seed, extra
  drops (data order), gems. approachSpot(grid, from, c, r): the free reachable cell nearest the
  avatar within BLOCK_REACH - 1 cells of the target, where the avatar walks when it is too far.
  Tests: blocks.test.ts (28), client/src/api/blocksAPI.test.ts (7), save.test.ts (14 -> 15),
  bag.test.ts, book.test.ts.
- GEMS CORE (BG4 not done, only what BG5 needs): Wallet.gems, applyChange({ gems }) and the ledger's
  gemsDelta, gems.ts gemDrop(source, rank, rng) with config GEMS (only 'block': 15% chance, 1 to 2,
  times GEM_RANK_MULT 1/2/4/8 by rank), GEMS_GAIN_ID 'gems' (a gain entry with itemId 'gems' in the
  gains list; gainsSince reads gemsDelta), GEM_ICON in extraIcons.json, info panel shows gems next to
  gold. The existing material 'gem' (a mine find) is a different thing. KNOWN LOOP: place + punch
  the same block forever yields gems (gems have no use before BG8; BG9 balances it).
- ROOM UPGRADE: economy.upgradeRoom sends blocks on the new door zone and the new farm plots back
  to the bag (reason block_return, not a gain); if the door then cannot reach the middle, all of the
  room's blocks go back. economy.ts also has buyBlocks / blockPrice / catalogBlocks (price =
  baseValue * CATALOG_PRICE_MULT).
- GAMEAPI (api.ts): placeBlock(c, r, blockId), hitBlock(c, r) -> BlockResult { placed | cracked |
  broken (with room + gains) | walk (path) | refused (problem) }, buyBlocks(id, qty). LocalGameAPI:
  standingPoints() = own avatar (if still) + idle customers and guests; walkCloser() answers 'walk';
  commitBlocks() saves, rebuilds this.grid, resets shopGrid and re-paths the shop's customers.
- SAVE: SAVE_VERSION 15; MIGRATIONS[14] gives every room blocks: {} and wallet.gems 0; isGameState
  checks both.
- CLIENT: render/blockViews.ts (BlockViews: one Container per block in view.objects with depth key
  (foot of the cell, x of the cell middle, negative uid), drawBlockArt = a cube from the icon's two
  colours with a top face of 11 px and a front face, special faces for brick, planks, glass,
  lantern, stone; cracks per stage (3 pictures), a 140 ms shake on a punch, a puff of bits on a
  break, the ghost cell (green/red) in view.ghostLayer; sync(room, now) runs every frame so the
  heal shows). main.ts: selectedBlock, selectBlock(), blockTap(), doBlock() (a 'walk' answer sets
  pendingBlock, done on arrival, at most 2 tries), updateBlockGhost(), Escape puts the block away.
  Hotbar tap on a block selects it (tap again = put away). ui/gainPopups.ts: chips above the
  avatar's head (POPUP_MS 1200, POPUP_MAX 5 at once, the rest queue, sparkle for ultra_rare and
  legendary, Settings -> Popups, prefs.popups). Catalog has a Blocks tab (confirm panel: Buy 1 or
  BLOCK_PACK = 10).
- CONVENTION CHOICES TO CHECK (owner): a tap on an existing block ALWAYS punches it, also with a
  block selected; a tap on a cell where a block does not fit falls through to walking or sitting
  (only door, door_blocked and counter_blocked say why in a toast); rugs count as floor furniture
  (no block on them); no quest hint for blocks (hints are indexed with their own done-triggers, so
  it was not a one-line change).
- NOT DONE: popups for chest, kill, fish, harvest, craft, cook, quest claims (BG3 B rest);
  gem sources other than blocks, gem shop and packs (BG4, BG8); seeds from blocks (BG6); lantern
  blocks do not light the room yet; blocks cast no shadows.
- CHECKED BY EYE (headless Chromium, 900 x 640): place 5 dirt blocks, punch one (it breaks, a chip
  floats up), stone cracks after 2 hits, glass and lantern art. A bug found that way: the hotbar
  did not accept blocks (fitsArea) and the popup chip was stretched by a CSS order clash; both fixed.

## BG5b: hold to repeat (step BG5b)

- CHANGES THE INPUT RULE (CLAUDE.md INPUT, BRIEF section 6a): a press on a block, grown plant (BG6), mine
  rock or standing tree is a HOLD: it hits at once and repeats at that thing's cooldown until it breaks
  (the API answers 'broken' / 'felled' / the rock is gone), the press ends, or it moves past
  TAP_MAX_MOVE_PX (then it is a pan and never hits). A second finger cancels the hold. The press never
  taps afterwards, so a short tap is exactly one hit (made on press, not on release). A tap on a far block
  still walks closer and hits once on arrival (pendingBlock, only when no hold is running).
  NOT for the dungeon fight (click_enemy stays one hit per tap) and NOT for fishing (the reel has its own taps).
- PURE: shared/src/hold.ts: HoldState { active, lastHitAt }, holdStart, holdStop, holdMoved (pan check),
  holdTick(state, nowMs, cooldownMs) -> { state, hit } (first tick hits; one hit per call; next hit a full
  cooldown after the last one, never earlier, so the API cooldown never refuses it; a long stall gives one
  hit, no burst), cellsBetween(a, b) (cells a fast drag passed over, no gaps). Config HOLD_PLACE_START_MS
  (= TAP_MAX_MS), HOLD_PLACE_MS 150. Tests: shared/src/hold.test.ts (8), client/src/input/holdControl.test.ts (6),
  blocksAPI.test.ts (held punching with no refused hits, out of reach = walk).
- CLIENT: input/cameraControl.ts has new hooks onPress (returns 'repeat' to claim the press), onHoldStill
  (after HOLD_PLACE_START_MS still: true = a 'line' hold, moves then do not pan), onHoldMove, onHoldEnd.
  input/holdControl.ts HoldControl keeps the HoldState and sends ONE request per hit via deps.hit (-> GameAPI);
  answers: 'go', 'stop', 'walk' (waits until the avatar stopped walking, then goes on), 'retry' (too early:
  the cooldown is not used up, asked again next frame; used for the API's 'cooldown' refusal and the mine's own
  clock). main.ts: holdTargetAt (block / tree / rock under a press), doBlock returns a HoldResult, the ticker
  calls hold.tick() (also in the dungeon). Rooms: hold is off while a panel, build, paint, placing, blockers or
  fishing is on. Mine: DungeonScreen.rockUnder / holdRock send click_rock again (the step function keeps its
  400 ms cooldown; the screen waits while run.timeMs < pickReadyAt). Trees: LakesideScreen.treeUnder /
  holdSwing (walks next to the tree when too far, then the hold goes on); a felled tree ends the hold.
- PLACING: with a block selected, a short tap places one block as before. Holding still 300 ms on a free
  cell starts a line: the first block goes down, and the cells the pointer crosses are queued (cellsBetween)
  and placed one per 150 ms; cells out of reach, taken or refused are skipped quietly (no walking, no toast).
  Why 300 ms and not "on press": a press on free floor with a block selected must still be able to start a
  pan, or every pan would drop a stray block.
- CHECK BY HAND (owner): PC: hold the mouse on a stone block (it cracks and breaks, no clicking), hold on a
  tree, hold on a mine rock, hold on far blocks (walks, then hits), hold with dirt selected and drag along the
  floor (a line). Phone: finger hold on a block, a drag that starts on a block pans (one hit may land first), two-finger
  pinch never keeps punching.
- KNOWN: the first hit happens on press, so a pan that starts on a block or a tree gives one hit before the pan
  (the owner asked for hit-on-press). Not run on a real phone by the AI.

## BG6: seeds and the free-form farm (step BG6)

- OWNER'S REQUEST (changes CLAUDE.md 10b and 9, BRIEF 10b). The farm is free-form: no fixed plots, soil = a floor style.
- DATA: types.ts SeedId = CropSeedId | BlockSeedId (`${BlockId}_seed`). blocks.json seedId is now `<id>_seed` for all 10
  blocks. materials.ts adds a 'seed' material per block (name "Dirt seed", icon { shape 'seed', colors = the block's two
  colours }, baseValue = half the block's, rank = the block's). styles.json: floor 'soil' (not in the catalog; the farm paints
  soil and grass for free, economy.paintFloor: FARM_FLOORS). crops.json growMinutes is LEGACY (migration only).
  Config: SEED_GROW_MS (rank: common 2 min, rare 20 min, ultra_rare 3 h, legendary 12 h), SEED_YIELD, SEED_BACK_CHANCE 0.3,
  PLANT_SPROUT_SHARE 0.5, GEMS.harvest, FARM_START_SOIL { c 2, r 2, w 6, h 2 }, SOIL_STYLE; the old FARM_PLOTS became
  LEGACY_FARM_PLOTS (+ _PER_LEVEL), read only by migration 15 -> 16.
- SHARED (all pure): room.ts Plant { seed, plantedAt, readyAt }, Room.plants (key "col,row", like blocks), plantInCell,
  plantList, blockRects now includes plants (so roomBlockers, every nav grid and the door checks see them). blocks.ts:
  blockProblem is now cellProblem(room, items, placeIn, c, r, ctx) (taken = a block OR a plant) + the BlockProblem
  values 'no_soil', 'no_plant', 'unripe'. farm.ts (rewritten): seedProduct / seedRank / seedGrowMs, isSoil / soilCells,
  growthStage (sprout, small, full), isRipe, readyInMs, plantProblem, plantSeed (ledger 'plant'), harvestPlant(plant, rng)
  (rolls: amount, seed back, gems), hitPlant(state, roomId, c, r, at, lastHitAt, rng, from) (order: owner, plant, reach,
  unripe, cooldown), plantsOverlapping, seedsForSale / buySeeds, farmCounts(room, now), keepSoilUnderPlants.
  farmLayout.ts: only the pot is fixed (potRect, fixedBlockers, noPlaceRects = [pot]). legacyFarm.ts: the old farm
  shape and convertLegacyFarm, ONLY for migrations. economy.upgradeRoom: no plot logic; plants on the new door zone
  give their seed back (reason 'block_return').
- MIGRATION 15 -> 16 (SAVE_VERSION 16, tests in save.test.ts): GameState.farm removed; each old plot -> a soil cell
  (floorCells, snapped); planted crop -> plant { seed: the crop's seed, plantedAt: same, readyAt: plantedAt + the crop's OLD
  growMinutes } so the stage and the time left stay exactly the same (new plants use the rank times); every room gets
  plants {}; LoadResult.farmChanged (version < 16) -> LocalGameAPI shows the one-time toast. A migrated plant keeps
  its old time, so a migrated carrot still needs 30 min.
- GAMEAPI: plantSeed(c, r, seed) and hitPlant(c, r) return BlockResult (new kinds 'planted', 'harvested', 'unripe' with
  leftMs; 'walk' and 'refused' as for blocks; the cooldown is the same lastBlockHitAt). getFarm() = FarmView { ripe, growing,
  free } for the Map card. plant / harvest are gone. Planting finishes the farm hint (FARM_HINT).
- CLIENT: farm/farmScreen.ts is only the pot now; farm/plantViews.ts (PlantViews: a node per plant in view.objects, stage art
  farmArt.drawPlantArt, bobbing ripe marker, shake for an unripe punch, harvest puff, seed ghost); styleArt 'soil'. main.ts:
  selectedBlock may be a seed (selectedProblem picks plantProblem or blockProblem), doBlock plants / punches (a plant in
  the cell -> api.hitPlant; 'unripe' -> shake + toast + the hold stops), hold target kind 'plant', line hold plants seeds
  too, paintableStyles() (the farm paints soil and grass). Room panel on the farm: Soil cells N, Paint soil.
- LOOPS: block seeds drop from breaking blocks (20%) and come back from harvests (30%): per cycle (1 seed -> 2 to 4 blocks
  -> 0.2 seeds each + 0.3 back) a loop decays, not grows (about 0.9 to 1.2 seeds per cycle, so dirt can be farmed
  slowly; BG9 balances it).
- TESTS: farm.test.ts (20), save.test.ts (4 new), farmAPI.test.ts, blocks.test.ts adjusted. By hand in headless Chromium
  (900 x 640): an old v15 save (toast, 6 soil cells, a ripe turnip with its marker, a young pumpkin), plant by tap (walks,
  plants), a hold on an unripe plant (nothing happens), a hold on ripe plants (harvest), a stone line by hold + drag, hold
  on stone (breaks by itself, drops a stone seed), hold on a tree (walks, 5 swings, +3 wood). NOT checked: mine rocks, a real phone.

## BG3b + BG4b: popups from every source and gems from every source (step BG3b+4b)

- POPUPS (BG3 B finished; rendering only, numbers from the API): main.ts shows `popups.show(gains)` for catalog buys, seed
  buys (buySeeds), blocks (BG5), plants and harvests (doBlock), craft, buyGear, smelt, forge, cook, Book rewards, quests,
  and the banked bag at the exit (`bagGains(result.banked)`, shown in the room after the result screen; pure, in gains.ts).
  The lakeside gets a hook `gains(list, at?)` (chop and catch). The dungeon gets `ctx.popups`: DungeonScreen.handle shows
  `u.gains`, render() calls `popups.update(head)`, finish() clears them. In the dungeon the floating TEXT for items is gone
  while popups are on (gold keeps its text; with popups off the old texts come back); the lakeside keeps its floating texts
  (they show the fish size and sit at the tree). `GainPopups.enabled()` was added. NOT yet: pack opening (BG8).
- QUESTS: the first-run hints are the quests. `shared/src/quests.ts` completeQuest(state, index, at, rng) pays GEMS.quest
  through the ledger (reason 'quest') and moves hintsDone on; LocalGameAPI.hintDone uses it. The call that finished the quest
  has its own result, so the gems wait in `GameAPI.takeGains()` (returns them once); main.ts refreshHint() takes them.
- BOOK: claimBookReward(state, tab, percent, at, rng) adds gems by the tier (BOOK_GEM_RANK 25/50/75/100 = common..legendary,
  so 2-3 / 4-6 / 8-12 / 16-24); the API returns `BookClaim { gold, gems, gains }` (it was a number). bankCatch and
  claimBookReward now REQUIRE an rng (no silent default).
- GEMS (config GEMS, all small; BG9 tunes): block, harvest, chest, kill, mimic, boss (chance 1), rock, chop, fish, quest (1),
  book (1). Ranks: chest wooden common / golden rare; kill ENEMY_GEM_RANK (slime, bat common; skeleton rare); mimic rare; boss
  ultra_rare; rock ROCK_GEM_RANK (copper common, iron rare, mithril ultra_rare); chop = the rank the tree rolled for its extra
  drop (woodcut.fellRoll returns it; fellLoot is a wrapper); fish = the catch's rank. Rolls come AFTER the existing rolls of
  that event, so older rng sequences only shift after the event.
- DUNGEON RULES (shared/src/dungeon): RunBag.gems (bag, banked, lost) and DungeonRun.pickups { id, x, y, qty }. step.ts dropGems
  lays a pile at the chest / enemy / rock (event 'gem_drop'); collectGems (every tick, before chests) picks piles within
  GEM_PICKUP_REACH = 28 px into bag.gems (event 'gem_pickup'; a tap on a pile is a click_point onto it). The boss's gems go
  straight into the bag (the bag is banked in the same step). Leave and the boss bank the bag gems; death keeps
  floor(gems x 0.5) and loses the rest (the DEATH_GOLD_LOSS share, like gold); the mine carries the player out with ALL gems
  (only ore is halved). Piles left on a floor are gone when going deeper or leaving. finishRun passes banked.gems to
  applyChange (reason dungeon_bank / mine_bank). gainsFromRunEvents counts 'gem_pickup' as a gain with id 'gems'.
- SAVE: SAVE_VERSION 17; MIGRATIONS[16] gives a saved run gems 0 in its three bags and pickups []. Tests in save.test.ts.
- ROOMS: gems from blocks, harvests, chopping and fishing are paid at once (ledger, wallet): there are NO floor piles in rooms
  (a pile there could be lost on a reload and would need saved state). ui/gemFly.ts only draws up to 3 gems flying from the spot
  (cell centre, tree, bobber) to the head; "near or tapped" applies to the dungeon and the mine piles.
- CLIENT: dungeonView draws the piles (a bobbing gem square from GEM_ICON, only on seen blocks, flies to the player in 180 ms
  when picked up) and DungeonView.pickupAt() finds one for a tap; runBar shows the run's gems under the gold (also in the
  mine); the result screen lists gems; dungeon pickups sound 'coin'.
- TOOLS: `npm run simulate` now also prints gems per hour per source. The activity per hour is an assumption written in the
  tool; a full active hour of everything is about 167 gems, and breaking blocks is half of it (the known loop). BG9 balances.
- TESTS: shared/src/gems.test.ts (gemDrop per source and rank, fixed rng), dungeon/gems.test.ts (sources, piles, Leave, death,
  mine, ledger), quests.test.ts, woodcut / fishing / book / gains / save tests, client/src/api/gemsAPI.test.ts (every source
  returns its gems in the gains and the ledger adds up to the wallet).
- CHECKED BY EYE (headless Chromium 420 x 760 @2x): a v17 save with two piles: the run bar shows gems, a tap walks onto a pile,
  the pile is gone, a gem chip floats above the head, the run's gems go from 2 to 3. NOT checked on a real phone, nor the
  lakeside / room gem fly.

## BG7: splicing (step BG7)

- DATA: shared/data/splice.json (40 recipes { a, b, result }, seed ids), spliceSeeds.json (13 new seeds { id, name, rank,
  baseValue, icon (seed shape), grows { kind material | furniture | clothing, id } }: flaxbloom (cloth), hopvine (root_ale),
  honeybloom (carrot_cider), amberbud (amber), spiritbrew (glowcap_broth), vine_bench / gilded_chair / honey_table /
  ember_lamp / heartwood_throne (new furniture, cloned art, inCatalog false, in furniture.json), mohawk / baggy / tunic
  (the three hidden clothes of clothing.json). Many results are the existing seeds (clay, thatch, brick, glass, lantern,
  mossy, cinder, pumpkin, glowcap). bookRewards.json got `splice` (60 / 150 / 300 / 700 gold, gems by BOOK_GEM_RANK).
  The recipe names and pairs are original (not copied from any game).
- SHARED (pure): spliceData.ts (data, pairKey; no other imports so materials.ts can read it), seeds.ts (seedGrows,
  seedProduct, seedRank, seedGrowMs, moved out of farm.ts, which re-exports them), splice.ts (splice(a, b), recipeFor,
  spliceGrowMs, isSpliceResult, recipesWith, recipeHint). farm.ts: spliceSeed (ledger 'splice'), harvestPlant(plant, rng,
  unlockedClothing) and hitPlant (spliced plants: the result seed + bonus + gems, found recipe, furniture, clothes).
  Plant.with = the second seed; Player.splicesFound = pair keys. HarvestRoll gained furniture, clothing, result, recipe
  (item is null for furniture and clothes). BlockProblem: nothing_happens, already_spliced, ripe.
- BOOK: BookTab 'splice'; entries are recipes (kind 'recipe', key = pairKey, id = the result, recipe { a, b }); bookProgress /
  bookTotal take the found list as a last argument; bookRewards reads player.splicesFound; no "New!" marks for recipes.
  sourceOf: 'Splicing' for results (seeds, furniture, clothes); block seeds say 'Punching blocks' (they said 'Catalog').
- SAVE: SAVE_VERSION 18, MIGRATIONS[17] adds splicesFound [] (tests in splice.test.ts).
- API: GameAPI.spliceSeed(c, r, seed) -> 'spliced' | 'walk' | refused; 'harvested' may carry clothing and recipe.
  Client (main.ts hitOrSplice): with a seed selected, a tap or hold on a young plant splices; a ripe or spliced plant is
  punched as before. Toasts: spliced, recipe found, clothes unlocked, nothing happens. A spliced plant's accent colour is
  the second seed's (farmArt). bookPanel recipeCard + ui.css .book-recipe. Quest hint index SPLICE_HINT = 6 (last).
- TESTS: shared/src/splice.test.ts (the table: symmetric, one result per pair, ranks, reachable from the starters, value
  cap, items and icons; spliceSeed; harvests; furniture and clothes seeds; Book; migration), client/src/api/spliceAPI.test.ts.
  Older tests adjusted: home furniture tests now filter inCatalog, atmosphere lights, seats list, mine hint.
- NOT CHECKED: the screen by eye (a headless screenshot was blocked), a real phone. Balance numbers (seed values, SPLICE_*
  config, GEMS.splice) are first guesses for BG9.

## BG4c: block drops like Growtopia (owner's request, 15 Nov)

- A broken block no longer always returns itself: every part is its own roll (config BLOCK_DROPS by the block's rank):
  the block, its seed, extra drops, gems. So a break gives nothing, the block, the seed, both, and/or gems.
  common 60% block / 15% seed / 25% gems (1-2); rare 50 / 12 / 35% (2-5); ultra_rare 45 / 10 / 50% (4-8);
  legendary 40 / 8 / 60% (7-12). Pure `blockDrops`, `blockGemDrop`, `gemPieces` (shared/src/gems.ts, blocks.ts).
- Gem colours (GEM_TIERS): pieces of 1 (green), 5 (blue), 10 (red); the amount is split biggest first (7 = 5+1+1).
  ui/gemFly.ts flies one picture per piece (at most 5) from the broken cell to the head. BLOCK_SEED_CHANCE is gone.
- BG9 still tunes these numbers (blocks now cost gold to replace: a sink).

## BG8: packs bought with gems (step BG8)

- RULES (CLAUDE.md section 13 and BRIEF 13 hold the fairness rules): gems earned in play only; contents and rank odds shown on the card
  before buying; duplicates allowed (spares); no timers or limited offers. Owner's change to BLOCKS-PLAN 3.8: no "never repeat owned
  clothes", no "gems back at completion".
- DATA: shared/data/packs.json { id, name, pool: blocks | seeds | clothing, rankWeights (multipliers of RANK_WEIGHTS, 0 = never), icon }.
  The numbers an owner tunes live in config PACKS { gemPrice, rolls } and SPARE_SELL (the resolved PackType in packs.ts has all fields).
  Starter prices: Random Blocks 30 gems / 5 rolls, Basic Seeds 25 / 5, Common Clothes 80 / 3, Rare Clothes 240 / 3 (BG9 tunes).
  Pools: blocks = all 10; seeds = crop seeds + block seeds (13); clothing = the hidden pieces of clothing.json (18: 7 common, 6 rare,
  3 ultra_rare, 2 legendary). Common Clothes = common x1, rare x0.5; Rare Clothes = rare, ultra_rare, legendary at the base weights.
- CLOTHING: clothing.json got `rank` and `baseValue` on every piece and 15 new hidden pieces (ids braids, bob, curly, hoodie, apron,
  overalls, spiky, jerkin, kilt, breeches, top_knot, wayfarer_cloak, moonweave, crown_braid, ember_robe; mohawk, tunic, baggy keep their
  ids and are still the splice results). The avatar art (render/avatarParts.ts) only knows the old styles: a new id draws like the
  default (short hair / plain top / plain trousers), only the icon differs. Real looks come with art (step 6). rankOf() knows clothing ids.
- SHARED (shared/src/packs.ts, pure): getPack, packPool, packOdds (rank rows in percent, passes the chance of a rank with no item to
  the next lower rank like rollRank does; also what the card shows), copiesOwned, piecesMissing, openPack(state, id, rng, at) ->
  { state, finds[], gains } | null, spareValue, sellSpare(state, id, qty, at) | null. ranks.ts got rankFallback (used by rollRank).
- LEDGER: Change.addClothing (ids, repeats allowed: the first copy unlocks, later ones raise Player.clothingSpares) and
  Change.sellSpares; LedgerEntry.clothing { id: +copies | -sold }; reasons 'pack' and 'spare_sale'. Finds go into Player.seen under the
  clothing id (the Book counts them; there is NO Clothes tab yet: add one with the clothes art, remember the splice-harvested
  pieces do not go through applyChange). gainsSince reports clothing copies. Player.packsOpened { packId: n } is only a counter (quests later).
- SAVE: SAVE_VERSION 19, MIGRATIONS[18] adds clothingSpares {} and packsOpened {}; isGameState checks both.
- API: GameAPI.openPack(packId) -> PackOpenResult { packId, finds, gains } | null (unknown pack, too few gems: nothing changes) and
  sellSpare(id, qty) -> gold paid | null.
- CLIENT: Catalog > Packs tab (ui/packsView.ts; one card per pack: picture, gem price, "Gives N things", every possible item as a
  chip in its rank colour with the rank odds, "You still miss X of Y pieces" for clothes, an Open button that greys with "Need N more
  gems"), "Your spares" with one Sell button per piece. ui/packOpening.ts: confirmBuy in gems (new BuyQuestion.currency), then
  ui/packPop.ts (CSS shake + burst, PACK_POP_MS 700, none with reduced motion), BG3 popups, then a toast: "New! <pieces>." with a
  "Wear it" button (toast.ts takes an optional action) or "Spare x2: <piece>.". The Avatar panel's unlocked list is refreshed after
  an opening (and now also after a splice unlock, which only updated on reload before).
- TESTS: shared/src/packs.test.ts (data, odds table, odds over 3000 packs per pack with a seeded rng, duplicates and spares, spare
  sale, refused buys change nothing, ledger adds up, Book, migration), client/src/api/packsAPI.test.ts, client/src/ui/packOpening.test.ts.
- TOOLS: `npm run simulate` prints gems per pack and hours of play per pack at the ceiling income and at the richest single activity
  (blocks). The first Common Clothes Pack is about 0.9 h of focused block punching.
- CHECKED BY EYE (headless Chromium 420 x 760): the Packs tab, the confirm panel, the pop, the toast, gems 150 -> 70. NOT checked on
  a real phone; Sell button not clicked in the browser (tested through the API).

## BG9: balancing the block world (step BG9)

- WHAT IT IS: numbers only (config + one data-free hint change), plus the maths and the tests that keep them. No new feature.
  shared/src/balance.ts = closed-form EXPECTED values from the real rules and data (gems per event and per hour, block lineage,
  seed ratio, pack sell value / duplicates / gem return, splice chains: time, gold and cell-minutes of the fastest / cheapest way,
  the till cap). The activity rates (events per hour per stage: new, level 3, level 8) are ASSUMPTIONS in balance.ts `activities`;
  a "mixed hour" = equal time in every open activity (blocks, farm, crypt, [mine from level 3], lakeside). Targets are in config
  BALANCE_TARGETS. shared/src/balance.test.ts (33 tests) fails when a loop reopens. `npm run simulate` prints the six tables below
  (tools/simulate-economy.ts, after the old shop tables). Only block gems of the old tool used the wrong rule (gemDrop('block')); fixed.
- LOOPS FOUND (before): (1) every COMMON block seed had a seed ratio of 1.43 (2 to 4 blocks x 2.5 breaks x 15% seed + 30% back):
  free seeds and free gems forever in the free farm; (2) punching blocks was 82% of mixed gem income (276 gems/h focused vs 16 to
  27 for every other activity), so no one needed the dungeon, mine or lake; (3) a bought dirt block gave 0.94 gems for 6 gold (6 gold
  per gem); (4) Rare Clothes sold as spares for 288 gold > 240 gems (a legendary spare 600 > 80 per piece) and Random Blocks sold for
  31.6 > 30; (5) the other gem sources were too thin (mixed 84/h of which blocks 69) to carry the pack targets once blocks shrank.
- CHANGES: BLOCK_DROPS seed chance common .15 -> .05, rare .12 -> .08, ultra .10 -> .08, legendary .08 -> .06; gem chance common .25 -> .05
  (1 to 2), rare .35 -> .10 (2 to 4), ultra .50 -> .15 (4 to 8); legendary unchanged. GEMS: harvest .12 -> .25, chest .25 -> .8,
  kill .10 -> .35, mimic .5 -> .9, rock .10 -> .6, chop .15 -> .45, fish .20 -> .6 (block, splice, boss, quest, book unchanged).
  PACKS: Random Blocks 30 -> 40, Basic Seeds 25 -> 30, Common Clothes 80 -> 75, Rare Clothes 240 -> 225. SPARE_SELL 1 -> 0.1.
  NEW QUEST (HINTS, PACK_HINT = 5, before the mine quest so a level 1 player sees it): "Gems buy packs. With 30 gems open the Catalog,
  the Packs tab, and open a Basic Seeds Pack"; done by opening any pack (LocalGameAPI.openPack). MINE_HINT 6, SPLICE_HINT 7. The farm
  quest now says a plant takes about 2 minutes and that blocks, plants, chests and fish drop gems. SAVE_VERSION 20, MIGRATIONS[19]:
  hintsDone >= 5 moves up by one (the pack quest counts as done for old saves).
- THE TABLES (after; gems per hour of a MIXED hour; the first-run quests pay 12 gems before the mine, 16 in all):
  new player 54.9 (block 27%, harvest 26%, chest 17%, fish 17%, chop 7%, kill 6%); level 3 73.0 (block 30%, harvest 27%, fish 14%,
  chest 13%, rock 8%); level 8 101.5 (block 33%, harvest 28%, chest 11%, fish 10%, rock 8%). Focused hour at level 3: blocks 110,
  farm 98, lakeside 68, crypt 62, mine 28 (blocks under 2.2x the mean of the others, tested).
  Hours of mixed play: Random Blocks (40) 31 / 33 / 24 min, Basic Seeds (30) 20 / 25 / 18 min, Common Clothes (75) 1.1 h / 1.0 h / 44
  min, Rare Clothes (225) 3.9 h / 3.1 h / 2.2 h (new / level 3 / level 8).
  Packs: sold value vs price: 31.6 / 40, 20.4 / 30, 7.4 / 75, 28.8 / 225 gold; duplicates in 1 / 5 / 10 packs: blocks 1.0 / 16 / 40,
  clothes 0.3 / 7.5 / 21 (a clothes pack gives about 9 to 10 different pieces in 10 packs; every piece takes about 41 / 50 packs); gems
  back by planting a pack's contents: blocks 1.7, seeds 12.7 of 30, clothes 0.
  Blocks: dirt / planks / stone 0.19 gems per block bought (6 / 12 / 15 gold: 32 to 79 gold per gem), glass 0.60 (27 gold, 45 per gem);
  seed ratio 0.68 common, 0.70 rare, 0.52 ultra; gems from ONE planted seed over all its generations 2.9 / 7.5 / 8.2.
  Crops (one plant, no limit but the till): turnip 13.6, potato 21.9, carrot 30.2 gold per cell-minute, pumpkin 5.7; 60 to 120 customers
  an hour (each buys ONE item and only while the player serves) cap crops at about 2600 gold/h, and 2 cells already feed that.
  Splicing (from starter seeds, branches in parallel): common results 3 min, rare 3 to 24 min, ultra rare 21 to 24 min, the legendary
  throne 3.0 h (not the 12 h of its own rank: a splice cell takes the longer INGREDIENT time + SPLICE_BONUS_MS). Every spliced thing
  is worth under its seeds' gold plus its cell-minutes at the best plain crop rate (tested), all under a plain crop cell per minute (the Crest seed is the closest, about two thirds of it).
- NOT CLOSED, ONLY PRICED (owner, please look): (a) gold from crops: a 2-minute carrot cell gives 30 gold per minute and the till is the
  only cap (about 2600 gold/h); this is gold, not gems, and untouched here. (b) The farm gem source is time-gated per cell, not per
  hour: a very big, fully attended farm (300 harvests/h assumed at level 8) is about 140 gems/h focused, the richest activity after blocks.
  (c) The activity rates are assumptions; a real phone session should be timed (first pack, common clothes) and the numbers moved in
  balance.ts / config. (d) The block rates assume 600 hand-fed breaks an hour; blocks come back 40 to 60% of the time, so a fast
  hold-to-punch player eats supply, not gems: 1800 breaks an hour on unlimited common blocks would be 675 gems/h but needs a seed ratio
  of 1 or more or about 250 blocks (1500 gold) an hour, both now closed.

## R1: file split (step R1: no change in behaviour; main.ts 2 076 -> 48 lines, localGameAPI.ts 1 364 -> 432, config.ts 939 -> 82)
- shared/src/config/{world,economy,dungeon,farm,lakeside,mine,clientInput,player,atmosphere,blocks,packs}.ts: the constants by topic; config.ts re-exports all and keeps the tavern (9t) numbers.
- client/src/api/localGameAPI.ts: the class (state, clock, open, chat, saves entry); every GameAPI method delegates to `<area>Api.method(this, ...)`. Members the helpers use are public (no `private`).
- api/walkApi.ts (walk, sit, serve, avatar position), roomsApi.ts (rooms, furniture, bag, styles, painting), shopApi.ts, blocksFarmApi.ts (blocks, plants, splice, seeds, cooking), dungeonApi.ts (dungeon, mine, forge), lakesideApi.ts, packsApi.ts, progressApi.ts (Book, hints, gains), tavernApi.ts (9t: calls and errands), savesApi.ts (export/import/backup); apiShared.ts (WalkState, TavernTask, SaveResult).
- client/src/main.ts: start() calls the parts in client/src/game/ in order: `const gN = { ...gN-1, ...(await setupX(gN-1)) }`. Each part is the old code, moved.
- game/ctx.ts: `State` = the 25 `let`s that more than one part changes (used as `st.room`), `Late` = the 16 functions/objects an earlier part calls but a later part defines (`late.openRoom`), `G0..G17` = what each part receives.
- game/core (boot, Pixi app), avatarWalk, roomItems, uiShell (toast, panels, buttons, run bar), cameraSetup, placing (build, paint, item menu), shopPanels, craftPanels (workshop, cooking, Book, farm, lakeside, travel), shopLife, tavernLife, hotbarBag.
- game/settingsPanels, dungeonMode, roomFlow (new-game intro, openRoom), blockInput (blocks, plants, hold), pointerInput (camera control, taps, drags), gameLoop (frame loop, first room).
- A new part: add the file, add it to main.ts and ctx.ts (a new `G` type). A name another part needs goes in the part's `return { ... }`; a name an EARLIER part needs goes in `Late` and is set with `late.x = x`.
- Proof: tests 934/934 unchanged; a scripted LocalGameAPI scenario (seeded rng, fixed clock; about 590 kB of results) hashes the same before and after; built main chunk 702.03 -> 713.95 kB (+1.7%, gzip 215.5 -> 219.4); old and new builds load a seeded save in headless Chromium and visit farm, lakeside, shop, mine, dungeon with no console errors.
- Left alone: the tavern files in shared/ (tavern.ts, guests.ts, brewing.ts). The tavern calls in LocalGameAPI moved to api/tavernApi.ts unchanged, so a branch that edits them in localGameAPI.ts will conflict: move its edit into tavernApi.ts.

## K1: the tavern kitchen (step K1, owner 15 Nov; docs/INN-PLAN.md M-D; changes CLAUDE.md 1, 5, 10b)
- COOKING MOVED to the tavern: the farm's pot is gone (config COOKING_POT, COOKING_POT_LIGHT, farmLayout potRect, farm/farmScreen.ts, farmArt.drawPot, the pot shadow and fire in render/roomAtmosphere.ts). The farm has no fixed blockers
  and no noPlaceRects (farmLayout.fixedBlockers / noPlaceRects stay as functions, the lakeside still has its fixed blockers); the old pot cell (c 14, r 3) takes soil, plants, blocks and furniture. The farm has no FarmScreen part any more
  (game/craftPanels.ts, game/roomFlow.ts, game/pointerInput.ts lost their farm calls).
- DATA: furniture.json 'stove' (shop_furniture, theme tavern, placeIn 'shop', 32 x 32, common, baseValue 40, inCatalog, `cooks: true` (FurnitureType.cooks), light { radius 64, color 9, flicker 1 }, icon { shape 'stove', colors steel, orange }). New icon shape
  'stove' (icons.ts ICON_SHAPES, drawn in render/iconPixels.ts). food.json: `cookMs` per recipe (turnip roast 20 s, potato stew 1 min, grilled perch 30 s, carrot soup and carp stew 2 min, pumpkin pie 3 min,
  glowcap broth 4 min, eel pie 5 min; FoodType.cookMs optional, default config COOK_MS by rank). The time is PER BATCH, not per dish (an owner's call to check: it is the reading of "turnip roast about 20 s"). Config (config/farm.ts): COOK_MS,
  STOVE_BATCH_MAX 4, STOVE_REACH_PX 64; config.ts TAVERN_START_ITEMS gained { key 'stove', x 240, y 96 }; roomShapes.json shopStart.stove for every shop shape (right of the counter: square_shop 240/96, long 176/96, l_shape 240/96, plus 400/96,
  wide_hall 304/96; a test places every start item on every shape).
- SHARED (cooking.ts, rewritten; the old instant cook() is gone): Cook { stoveUid, food, qty, readyAt }, cookMs(food), cookOf, cookReady, cookReadyInMs, stoves(items, roomId), batchInputs, canCook(food, state, qty), canCookWith / maxBatchWith(materials, food),
  startCook(state, stoveUid, food, qty, at) (stove must stand in the tavern, be empty, qty 1 to 4, crops short = null; ledger 'cook' once), collectCook(state, stoveUid, at) (null before readyAt; dishes in, ledger 'cook', stove free), returnOrphanCooks
  (a stove that no longer exists gives the batch's crops back; a stove in the bag keeps its batch, like the barrel). TavernState.cooks (emptyTavern gives []); save.ts isGameState requires it. LedgerReason stays 'cook'.
  No Date.now in shared/: the client passes the clock (LocalGameAPI.now = Date.now). Nothing steps the batches: readyAt is compared with `at`, so closed-game time just works.
- MIGRATION 20 -> 21 (SAVE_VERSION 21, tests in save.test.ts, newPlayer.ts addStove): tavern.cooks = []; ONE stove (ledger 'tavern_gift', note 'cooking moved to the tavern') on shopStart.stove when canPlace says yes, else in the bag (then arrangeState);
  a save that already has a stove keeps it. LoadResult.kitchenChanged (version < 21) -> LocalGameAPI adds a toast ("Cooking has moved: you cook on a stove in your tavern now (the farm has no pot any more)", plus "A stove is in your bag: place it in the tavern." when it
  went to the bag). addTavern (migration 12 -> 13) no longer gifts a stove (migration 20 does), so an old save gets exactly one. Planted crops, bag, gold and ledger are untouched (tested). The older tests that counted start items or seen entries gained the stove.
- GAMEAPI: cook(food) is gone; startCook(stoveUid, food, qty): Promise<boolean> and collectCook(stoveUid): Promise<{ food, qty, gains } | null> (both only while the player is in the tavern, api/tavernApi.ts); TavernView.cooks. roomsApi.setItems runs returnOrphanCooks next to returnOrphanBrews.
- CLIENT: ui/cookingPanel.ts rewritten (title "Stove": stepper - / + for the batch size, a card per recipe with its time, progress bar and countdown while cooking, Collect when ready; hooks start / collect). The panel and the stove tap live in game/tavernLife.ts
  (stoveTap: within STOVE_REACH_PX of the stove's footprint centre it acts at once, else walkTo the cell in front and set st.pendingStove; gameLoop.ts calls stoveArrived when the walk ends; stoveArrived collects a ready batch (popup, toast), else opens the panel;
  a 1 s interval ticks the countdown while the panel is open; any new tap drops a pending stove walk). The lunch box says "Cook on a stove in your tavern." Text of HINTS needed no change: the quest hints never mentioned the pot; the farm's Map card (craftPanels
  refreshTravel) only counts plants and soil.
- ECONOMY (tools/simulate-economy.ts, section K1; run npm run simulate): the stove is never the limit, crops are. A stove visited every 10 min makes 24 dishes/h; gold per dish through the menu (default price = baseValue) is only 4 to 15 gold ABOVE the crop value
  (roasted turnip 14 vs 10 crop gold, potato stew 48 vs 42, pumpkin pie 80 vs 72, eel pie 140 vs 125), so cooking is about as good as selling the crops, plus the dungeon buffs. Those food baseValues date from step 9b; 9t C and the economy re-balance (2.2) may raise them.
- CHECKED BY HAND in headless Chromium (1000 x 700) with a version 20 save (6 turnips, 4 potatoes): the toast, the stove placed right of the bar and lit, a tap on it (walks, opens the Stove panel), batch of 3 roasted turnips, the countdown, Ready, a tap collects them
  (toast, bag). No console errors. NOT checked: a real phone, a stove in the bag after migration, two stoves, the lunch box in a real run.
- Tests: shared/src/cooking.test.ts (recipes and times, the stove, start spots on every shape, inputs and batch limits, real time to the millisecond, nothing automatic, across a save and reload, two stoves, orphan and bag stoves, ledger), save.test.ts (20 -> 21: placed,
  bag, nothing lost, no second stove, v12), farm.test.ts / blocks.test.ts (no pot), client/src/api/farmAPI.test.ts and lakesideAPI.test.ts (cook through the API in the tavern, the old pot cell is walkable).

## 9t C: brewing panel, bar Menu panel, tavern texts (step 9t part C, the last part of 9t; changes CLAUDE.md 1, 5, 9)
- GAMEAPI (shared/src/api.ts, client/src/api/tavernApi.ts): startBrew(barrelUid, drink) (only in the tavern; inputs out through the ledger 'brew', one brew per barrel), getMenu() -> MenuRowView[] (id, on, price, baseValue, stock, history = the last prices guests paid),
  setMenuEntry(id, { on?, price? }) -> the new rows or null (not servable, price not whole gold 1..SHOP_PRICE_MAX), markTavernIntroSeen(). TavernView gained introSeen. collectBrew was part B. No GameState change: SAVE_VERSION stays 21.
- SHARED: shared/src/menuEdit.ts (pure; tests in menuEdit.test.ts): priceStep (10% of the baseValue, at least 1; config MENU_PRICE_STEP), priceCeiling (3 x the baseValue, MENU_PRICE_MAX_MULT), stepPrice, toggleMenu, stepMenuPrice, priceHint (the face of a guest with tolerance
  MENU_FACE_TOLERANCE 1.1 through decide(), and one line), menuIsEmpty, EMPTY_MENU_HELP. brewing.ts gained brewCards(materials) (one card per drink: inputs with have/need/short, minutes, mugs, value, can). Config: BARREL_REACH_PX 64, GUEST_ROOM_REMARK_CHANCE 0.3
  (guests.ts: with appeal >= REMARK_APPEAL_MIN the small talk at a table is sometimes "What a lovely tavern!"). TAVERN_INTRO_OLD and TAVERN_INTRO_NEW (config/player.ts).
- CLIENT: ui/brewingPanel.ts (panel 'brewing') and ui/menuPanel.ts (panel 'menu', tabs Serve and Menu); both are wired in game/tavernLife.ts (barrelTap -> walk next to it, st.pendingBarrel, gameLoop calls barrelArrived; barTap from pointerInput's counter branch: it opens the panel
  AND still starts the walk behind the bar, so the loot queue works as before; refreshMenu runs when the panel is open and the tavern changes). The old brewTap (collect at any distance) is gone: a ready brew is collected when the avatar stands next to the barrel.
  hotbarBag.ts refreshes the Brewing panel's crops with the bag. The one-time intro toast (maybeIntro in tavernLife) shows when TavernState.introSeen is false and the player is in the tavern (old saves from migration 12 -> 13), then markTavernIntroSeen; a new game starts with
  introSeen true and gets TAVERN_INTRO_NEW after the new-game intro (roomFlow.ts).
- TEXTS: Tavern replaces Shop in the Catalog tab, the Map card, the info panel / Room panel name (ROOM_NAMES), the "where" tags ("the tavern", "Tavern only"), new game card ("Pick your tavern"), hints 3 and 4 (market corner), the Book source "Your tavern", the furniture
  names Tavern sign and Tavern rug, npcLines (innkeeper, "What a lovely tavern!"), the stall sale toast ("at your market corner"), the Bag's materials line ("sold at the market stall"). client/src/texts.test.ts scans every string literal in client/src, shared/src and shared/data
  for the word "shop" (CSS classes, one error message, one ledger note and the old-save intro are allowed) and fails on a new one.
- CATALOG: the Tavern tab lists bar stool, round table, long table, mug shelf (wall), menu board (wall), keg rack, brewing barrel, stove, all at baseValue * 3 (tavern.test.ts). The keg rack is still decor (ripening is K2).
- ECONOMY (tools/simulate-economy.ts, section 9t C; npm run simulate): drinks per barrel (net gold per mug after the crops: root ale 3.0, cider 3.0, stout 4.8, tonic 12.0), guests per hour by appeal (138 at appeal 0 to 276 at 100), seats (a guest holds a seat about 55 s),
  gold per hour next to the old shop (customers/h x 22 gold, which is a CEILING: it assumes loot for every customer). BREWING is the limit in every row: a new game (2 stools, one barrel of root ale, 36 mugs/h x 9) earns about 324 gold/h at best = 0.12x to 0.25x of that ceiling;
  2 barrels 0.23x to 0.45x; 4 barrels 0.45x to 0.9x; seats and guests are never the limit. The stove adds up to 24 dishes/h (about 60 gold each) if the dishes are switched on. Target 0.5x to 2x: NOT met at the start; nothing retuned (BG9 numbers untouched). If the owner wants the start
  closer: more mugs per brew or a shorter root ale time (drinks.json). NOTE: crops cost 3 gold per mug of root ale, so the net is only 3 per mug; money comes from volume.
- NOT CHECKED: a real phone; the walk next to a barrel on every shape; a barrel placed in the farm or hotel (placeIn keeps it out); two Menu panels while many guests order (the Serve tab redraws on every tavern event).
- TESTS: shared/src/menuEdit.test.ts, brewing.test.ts (brewCards), tavern.test.ts (catalog tab), client/src/api/tavernBrewAPI.test.ts (brew through the API: inputs out, ready later, collect with gains, one per barrel, a second barrel, refusals, across a reload; the menu calls; a dish
  from the stove on the menu; introSeen), client/src/texts.test.ts. 966 tests in all now.

## S1: the shop is the tavern (step S1, owner 15 Nov; docs/INN-PLAN.md section 5; changes CLAUDE.md 1, 5, 9)
- REMOVED: shared/src/customers.ts (walking loot customers, plans, queue, till, catchUpShop, repathCustomers), customerPlan.ts (behaviour picker; the staff-zone and path helpers moved to npcNav.ts), shop.ts (slots, putOnShelf, prices, fillQueueMath,
  chooseCategory, saleHistory), GameState.shop (the whole ShopState), ShopView / ShopEvent / getShop / putOnShelf / takeFromShelf / setPrice / onShop / isServing in the GameAPI, types ShopSlot, ShopCategory, SaleRecord, FurnitureType.slots (and "slots" in furniture.json),
  the 'to_stall' guest event, config (SLOTS_*, QUEUE_*, CUSTOMER_* browsing, ACT_*, WINDOW_*, PAIR_*, TALK_GAP/NEAR, SALE_FLOAT_MS, ITEM_HOP_MS, CUSTOMER_PAY_MS, ...), npcLines moments enter, browse, queue, pay, leave, empty, smalltalk*, remark, window.
  Client: ui/shelfPanel.ts, render/itemHops.ts, the sale floats and till coins (ui/shopFeedback.ts is now ui/hintBox.ts: the quest card only), the goods drawn on slots (itemViews, slotGoods keeps drawGood = the order in the hand), the shelf panel, the "n waiting" badge, the customer sounds are unchanged (bell and coin still serve guests).
- KEPT / MOVED: shared/src/prices.ts (decide, validPrice: the menu price rule), appeal.ts (tavernAppeal, was shopAppeal), guestLook.ts (guestLook, outsidePoint, rollGuestKind, rollTolerance), npcNav.ts (staffZones, inStaffZone, npcGrid, npcPath, reachableFrom), bar.ts (barCoinPoint = tillPoint: the intro's coin start),
  client/src/api/catalogApi.ts (was shopApi: buyCatalog only; the tavern grid and world are in tavernApi.tavernWorld, LocalGameAPI.tavernGrid), client/src/game/placeLife.ts (was shopLife: travel, quest card, Map badge, guest bubbles), render/guestViews.ts (was customerViews: GuestViews, no held items).
  The config names CUSTOMER_WALK_SPEED, CUSTOMER_KIND_WEIGHTS, CUSTOMER_TOLERANCE_*, CUSTOMER_APPEAL_BASE, LOOK_COLORS, CUSTOMER_OUTSIDE_PX keep their names (guests use them); a rename is not worth the churn.
- STATE: TavernState.nextGuestId (the guest id counter, was ShopState.nextCustomerId) and TavernView.appeal (the Room panel's tavern appeal). SAVE_VERSION 22: MIGRATIONS[21] puts every slot good back in the bag (ledger 'shop_closed', same uids, no finds, no popup), drops GameState.shop, keeps the guest counter.
  readSave returns shopClosed (version < 22); the opening notice says goods are back in the bag and stalls are decor. Old migrations 8 and 9 still handle customers inside the chain (tested one step at a time: MIGRATIONS[8], MIGRATIONS[9]); migration 2 still builds a shop state that 21 removes.
- DECOR: stall_table (still in a new game, appeal 0), shelf (appeal 0, catalog 30), display_case (appeal 6, catalog 120) stay placeable in the tavern and count for appeal like any decor. The starting stall table could be swapped for something useful in S3 (not changed here).
- TEXTS: Map card "Tavern": "Tavern level n: k guests waiting / no guests yet", badge "orders, coin piles" (the Map button shows the same). Quest 3 (index 2): serve a guest and tap the coins (done when coins are collected); quest 4 (dungeon): find loot to use for cooking, brewing, crafting and building (shows while no run is going). Bag materials line: for cooking, brewing, crafting and building. The panels' quest indexes did not move, so hintsDone needs no migration.
- TESTS: removed with their rules: customers.test.ts (loot customers, queue, plans, decor looks, sitting), shop.test.ts (slots, fillQueueMath, cheapestIn, recordSale), customerPlan.test.ts (behaviour picker; the nav-grid tests moved to npcNav.test.ts), the lootCategory checks in gear/cooking/brewing tests, and the "guests walk past the stall" part of guests.test.ts.
  New or changed: save.test.ts (21 -> 22: goods back, uids, counter, decor stays, ledger adds up via ledgerGold / ledgerMaterials, nothing lost, no second migration; v8 and v9 steps), appeal.test.ts, prices.test.ts, bar.test.ts, npcNav.test.ts, furniture.test.ts (no slots), npcTalk.test.ts, localGameAPI.test.ts (no goods calls, gold only by serving,
  catch-up leaves gold alone, stall is decor, an old v21 save through LocalGameAPI.open). Guests and the menu end to end through the API: tavernAPI.test.ts and tavernBrewAPI.test.ts (unchanged). Typecheck proves no reference to the removed code is left. 939 tests now (966 before).
- BUNDLE (npm run build): index js 727.24 kB (gzip 223.43) before, 695.17 kB (gzip 212.52) after = -32.07 kB (-10.91 kB gzip).
- ECONOMY (npm run simulate, section 9t C and S1; NOTHING retuned): gold per hour by appeal 0 / 30 / 60 / 100: a new game (2 stools, one barrel of root ale) 324 gold/h at best (brewing-limited), 297 with a mixed menu; 2 barrels 595; 4 barrels 1190. The old shop's ceiling column stays only as a reference.
  The other gold: dungeon run gold (npm run simulate:dungeon, not rerun here: it takes minutes). Crops, ore, fish and loot can no longer be sold, so they pile up until the S2 trader; the BG9 seed table now prints crop value only. S3 retunes gold and gems.
- NOT CHECKED: a real phone; the old-save notice text on a small screen; the Map card text lengths.

## S2: the trader (step S2, owner 15 Nov; docs/INN-PLAN.md section 5; changes CLAUDE.md 9 and CURRENT STATE)
- BRANCH NOTE: S1 was not on main when S2 started; it lived on `origin/ccr-06c07646-6m34p8`. This branch was fast-forwarded onto that branch first (S1 commits are in this branch's history).
- RULE (shared/src/trader.ts, pure, tests in trader.test.ts): sellRows(state) -> SellRow { kind material | furniture | clothing, id, name, rank, count, unit, inHotbar }; sell(state, kind, id, qty, at) -> { state, result { gold, gains } } | null; sellWarning(row, qty) -> 'rare' | 'hotbar' | 'many' | null;
  sellPrice(baseValue) = max(1, round(baseValue * SELL_RATE)); materialSellPrice, furnitureSellPrice, clothingSellPrice (= floor(baseValue * SPARE_SELL), 0 for free starter pieces); bagIsFilling, SELL_HINT_TEXT.
  Config (config/economy.ts): SELL_RATE 0.3, SELL_CONFIRM_QTY 5 (MORE than 5 asks), SELL_HINT_STACKS 24 (of BAG_SLOTS 36).
- WHAT LISTS: material groups block, material, seed, crop, fish, thing (ore and bars are 'material'); furniture with roomId null that can be picked up (the counter, noPickup, never); clothing spares. NEVER: food and drinks (they are the menu and the lunch box, so the lunch box is protected by construction), worn gear (not a stack), placed items.
  A hotbar item still lists but asks first (inHotbar). Furniture sells the lowest uids first. Gold drops are not materials (nothing to sell).
- LEDGER: LedgerReason 'sell' (types.ts), ONE entry per tap through applyChange (materials negative, removeFurniture, or sellSpares; goldDelta positive). No GameState change: SAVE_VERSION stays 22, no migration. The Book counts finds only: a sale adds nothing to Player.seen (tested). Gains: gainsSince does not report gold, so sell() returns [gain('gold', n)] itself (same as the tavern coins).
  The old Catalog > Packs "Your spares" Sell button (BG8 sellSpare, reason 'spare_sale') is unchanged; the Sell tab sells spares as 'sell' at the same price.
- API: GameAPI.getSellRows() and sell(kind, id, qty) (api/traderApi.ts, delegated by LocalGameAPI). traderApi is the ONLY caller of the sell rule: client/src/api/traderAPI.test.ts scans shared/src and client/src for other callers and also runs 200 simulated minutes of clock ticks plus a reload with a full bag: nothing sells.
- CLIENT: ui/menuPanel.ts third tab 'sell' (icon: the bag), ui/sellTab.ts (rows: icon, name (count), "N gold each", Sell 1 / Sell all N; help text; sellDetail = the words of the question), ui.css .sell-buttons. game/tavernLife.ts sellTap: sellWarning -> confirmBuy ("Sell this?", the reasons, "Sell for N") -> api.sell -> coin sound, gold popup (popups.show), toast "Sold 1 x Wood for 1 gold.", refreshInventory, refreshMenu
  (which also loads the Sell rows; it runs whenever the panel is open and the tavern changes). game/hotbarBag.ts refreshInventory shows the hint toast once per visit when getSellRows().length >= SELL_HINT_STACKS.
- BALANCE (shared/src/balance.ts, tests in balance.test.ts 'the trader closes its loops'): dishSellLoops / brewSellLoops (ingredients sold <= the dish value / the brew's mugs), blockBuyBack (catalog price > sell price), packTraderBack (sold and the dearest piece x rolls < gemPrice * minGoldPerGem), spliceSellLoops.
  SPLICE: the plain GOLD reading ("results sold back <= the gold of the starter seeds") does NOT hold: 6 furniture results sell for more than their seeds cost in gold (vine bench 9 vs 6, gilded chair 21 vs 10, honey table 24 vs 9, ember lamp 23 vs 10, amberbud 25.5 vs 20, heartwood throne 90 vs 19). The test uses the BG9 measure instead:
  seeds' gold + cell-minutes at the best plain crop rate (what a plain crop cell would have earned). Passing. If the owner wants the strict gold reading, the furniture rate has to drop below about 0.06 (the throne) or a splice result needs its own lower rate: not done, left to S3.
- ECONOMY (npm run simulate, section S2; NOTHING retuned): gold per hour from SURPLUS in a mixed hour (a CEILING: it counts every crop, ore, fish and log as surplus; blocks excluded; gold drops excluded): new player 653, level 3 987, level 8 1267. Focused hours: farm 2250 / 4350 / 5675 (!), crypt 114 / 152 / 216, mine 114 / 138, lake 249 / 317 / 305.
  Guest gold for comparison: a new game 324 gold/h (brewing-limited), a bigger tavern (6 seats, 2 barrels, appeal 60) 595. So at SELL_RATE 0.3 surplus from the FARM alone would beat the tavern (a new player's mixed-hour surplus is 2.0x guest gold). That contradicts INN-PLAN "guests are the main gold": S3 must choose: a lower SELL_RATE (0.1 would put the new-player mixed hour near 220),
  a per-day or per-stack cap is NOT in the rules (it would be automatic-looking friction the owner has not asked for), or more guest gold. The farm number rests on the BG9 assumption of 150 to 300 harvests an hour and on crops being surplus, but crops also feed brewing and cooking, so the real figure is lower.
- CHECKED BY EYE (headless Chromium 420 x 760, seeded save): Map -> Tavern -> tap the bar -> Sell tab with rows, Sell 1 on wood (gold 100 -> 101, toast), Sell all on a hotbar block asks first ("It is in your hotbar. That is 8 pieces at once"). NOT checked on a real phone; the gold popup above the head was hidden behind the panel in the screenshot (the popup circle shows at the panel's edge); selling furniture and spare clothes only through the API tests.
- TESTS: shared/src/trader.test.ts (prices, lists, protected items, sell 1 / all, refusals, no find, deterministic, confirm rules), balance.test.ts (4 loops + the surplus report), client/src/api/traderAPI.test.ts (API, save, no auto selling, one caller), client/src/ui/sellTab.test.ts (texts). Full suite and typecheck pass.

## S3: rebalance gold and gems after the shop (step S3, owner 15 Nov; docs/INN-PLAN.md section 5; changes CLAUDE.md 1, 5, 9 and CURRENT STATE)
- BEFORE (S2, `npm run simulate`): SELL_RATE 0.3 for everything. Farm-only surplus per FOCUSED hour 2250 / 4350 / 5675 gold (new / level 3 / level 8) against crypt loot 114 / 152 / 216 and mine 114 / 138; the new player's mixed-hour surplus was 2.0x the guest gold. A new game's tavern: 324 gold/h at best (brewing-limited).
  Gems per hour (mixed): 54.9 / 73.0 / 101.5, no source over 33%. First pack 20 to 31 min.
- AFTER: gold per hour by source (focused / mixed): new: guests 462 / 185 (49%), dungeon run gold 234 / 58 (16%), trader 291 / 132 (35%), mixed total 375. Level 3: 603 / 211 (44%), 319 / 64 (13%), 374 / 205 (43%), total 480. Level 8: 962 / 289 (46%), 434 / 87 (14%), 363 / 257 (41%), total 632.
  The trader by activity (focused): farm 120 / 232 / 348, crypt loot 113 / 152 / 216, mine - / 264 / 357, lake 285 / 367 / 356. The farm is under guests, run gold and the mine at every stage. Gems per hour (mixed): 55.7 / 73.7 / 102.5 (the tavern tip adds 0.8 / 0.7 / 1.0, about 1%); the first pack is still 19 to 33 min; Common Clothes 1.1 h / 1.0 h, Rare Clothes 3.8 h / 3.1 h.
- CHANGES (a) SURPLUS: config SELL_RATES per group (economy.ts; trader.ts materialSellRate): crop 0.1, seed 0.2, wood and loot ('material') 0.3, block 0.3, fish and things 0.4, bar 0.5, ore 0.85, splice results 0.05 (the result seeds and the furniture only splicing grows). SELL_RATE 0.3 stays for blocks, other furniture and as the default of sellPrice(baseValue, rate).
  The farm line of balance.ts is now NET OF THE SEED (a seed comes back with SEED_BACK_CHANCE only). Common crops at 0.1 sell for 1 to 2 gold: a harvest sold is worth no more than the seed it cost (tested), so planting to sell never pays; crops are for brewing and cooking. Seed prices were NOT raised (tried 5/8/10/18: farm surplus went negative).
- (b) START: root ale 7 mugs per 8 minutes (was 6 per 10), the start barrel holds 7 (all tests that said 6 now say 7), the early dish roasted turnip is ON the new game's menu (TavernState.menu; it only sells while it is in stock), the stall table is replaced by a bar stool in front of the bar (config TAVERN_START_ITEMS key 'stool_bar', roomShapes.json shopStart.stool_bar at counter x, y + 32 for all 5 shapes: 3 seats, all reachable, tested). Dish baseValues lowered (potato stew 48 to 28, carrot soup 66 to 36, pumpkin pie 80 to 42, glowcap broth 62 to 34, carp stew 50 to 30, eel pie 140 to 70; roasted turnip 14 and grilled perch 24 stay) so guests do not dwarf every other source after level 3.
  Amber baseValue 55 to 40 (amberbud sold back was 25.5 vs 20 gold of seeds). The model (balance.ts firstHourGold): first visit at minute 2, the barrel is visited every 10 minutes, a batch of 2 roasted turnips every 20 minutes from minute 14: 30 min = 217 gold, 60 min = 462 gold (targets 150 to 280 and 300 to 500). It is a PERFECT-PLAY expectation; a real first hour is lower. START_GOLD stays 100.
- (c) SPLICE STRICT: results and their seeds sold back are now <= the GOLD of their starter seeds (tested in balance.test.ts, 'STRICT'): through the splice rate 0.05 on the furniture and seeds, and amber at 40.
- TAVERN GEM TIP: config GEMS.tavern { chance 0.05, min 1, max 1 } and TAVERN_GEM_CHANCE_MULT { common 1, rare 2.5, ultra_rare 5, legendary 10 } (blocks.ts); shared/src/gems.ts tavernGemChance, tavernTipGems (expected), tavernGemDrop(rank, rng) (a new function with the same two-roll shape as gemDrop, because the amount is not multiplied by the rank here); shared/src/guests.ts guestTip(guest, item, rng): none if the guest called out for the order (warned) or frowned.
  Rolled when the guest finishes eating (leaveMess, also in the catch-up and when the seat is taken away). Mess.gems; collectCoins pays gold and gems in ONE ledger change (reason 'tavern', gemsDelta) and returns { coins, gems }; the 'collected' event's gains list has the gold and the gems. Client: render/tableMess.ts draws a gem next to the coins (GEM_ICON), the popup shows both.
  SAVE_VERSION 23: MIGRATIONS[22] gives every pile on a table gems 0 (tested: nothing else changes, no second migration). In the gem tables the tip is a source 'tavern' (balance.ts mixedBySource).
- BALANCE.TS / TESTS: goldBySource, goldShares, traderByActivity, runGoldPerHour (run gold minus keys: RUNS per hour 7, 4 at level 8, key 10), guestGoldPerHour (TavernSetup per stage: 3 seats 1 barrel 6 dishes/h; 4 seats 1 barrel 8 dishes/h; 6 seats 2 barrels 9 dishes/h; the player is at the bar 40% / 35% / 30% of a mixed hour, TAVERN_ATTENTION_BY_STAGE), firstHourGold, tavernTipGemsPerHour.
  BALANCE_TARGETS gained minGoldShare 0.1, maxGoldShare 0.5, firstHalfHourGold 150 to 280, firstHourGold 300 to 500, maxSellShare 0.9. Tests: balance.test.ts (each source 10% to 50% at every stage, crops under guests, run gold and the mine, no trader activity over the tavern, first 30 minutes and hour, selling never beats using, seed to plant to sell, strict splice), tavernTip.test.ts (fixed rng: chance by rank, tip rule, one tap takes both, ledger adds up, catch-up), tavernStart.test.ts (3 seats on every shape and reachable, menu, 7 mugs, the model's numbers), trader.test.ts (rates by group), save.test.ts (22 to 23). A mutation check: crops at 0.3 makes 10 balance tests fail.
  tavernTest.ts legacyStart() keeps the old start (2 stools, empty menu setting) for the older tavern rules tests; withAle() uses it and gives 6 mugs as before.
- HINTS: texts only (HINTS still has 8, indexes unchanged): the tavern hint (index 2) adds brewing root ale or cooking a roasted turnip; the dungeon hint (3) adds selling at the bar; the farm hint (4) says punching blocks and plants and fishing drop gems. The first 20 minutes thus say: serve a guest, brew or cook, go on a run, sell surplus at the bar, plant a seed, punch blocks.
- ASSUMPTIONS TO CONFIRM (all in balance.ts, one place): the visit cadence of 10 minutes, the attention per stage, the tavern setups per stage, 7 / 4 runs per hour, every surplus thing sold (a ceiling). The 'level 3 / level 8' guest gold is a ceiling (every mug and dish sold). The dungeon and pack prices were not touched.
- NOT CHECKED: a real phone; the gem drawn next to the coins on a crowded table; the popup showing gold and gem together.

## T1: the bar with taps, the register and the kitchen (step T1, owner 15 Nov; docs/INN-PLAN.md section 6; changes CLAUDE.md 1, 5, 7, 9 and CURRENT STATE)
- BEFORE (npm run simulate): first 30 min 217 gold, first hour 462 gold (S3 targets 150 to 280 and 300 to 500), guest gold per hour 462 / 602 / 962 (new / level 3 / level 8), mixed shares guests 45%, run gold 14%, trader 40% (rounded). AFTER: identical numbers
  (the diff of the simulate output is only the new T1 section). The pour adds POUR_MS to a guest's seat time (GUEST_STAY_S, balance.ts) and seats were never the limit.
- DATA / TYPES: furniture.json: counter is now `surface: true` and lost its two painted till boxes (the register is its own piece; height 64 now counts only the bar); new types register (onSurface, `till`), tap_stand (onSurface, `taps`),
  prep_table (surface, `preps`, 2 x 1 cells, facings down/right), pantry (crop colours on the shelves), sink, serving_hatch (`kitchen: true`), all placeIn 'shop', inCatalog, appeal 2 to 6; FurnitureType gained optional taps, till, preps, kitchen.
  Icons reuse existing shapes (box, barrel, table, shelf, tank, sign) in new colour pairs. roomShapes.json: `kitchen` = one cell rectangle per level for square_shop, long, l_shape, plus, wide_hall (square_shop {7,0,3,3} / {7,0,4,4} / {7,0,5,4};
  long {5,0,3,3...}; l_shape {7,2,3,3...} (below the stove, because the start barrel stands above it); plus {12,0,2,3} / {12,0,4,3} / {12,0,6,4}; wide_hall {9,0,3,3...}); each level contains the one before, holds the start stove and no other start item (tested).
  Config: TAP_SLOTS 2, TAP_CAP 12, POUR_MS 800, PREP_BONUS { perTable 1, max 2 }, TAVERN_START_RIDERS (register dx -32, tap_stand dx 0 on the bar's cells), BALANCE_TARGETS.maxGoldShareBestKitchen 0.55, texts TAVERN_BAR_NOTICE (old saves), TAVERN_INTRO_NEW, hint 3, EMPTY_MENU_HELP.
- SHARED: taps.ts (Tap { standUid, slot, drink, mugs }, tapStands, loadRoom, loadTap, unloadTap, returnOrphanTaps, mugsOnTaps, stockFor (mugs minus open orders), tapFor, pourPoint, pourStop, tapCards for the panel); kitchen.ts (kitchenZone(room), rectInZone, edgeAdjacent,
  prepTablesFor, prepBonus); tavern.ts: TavernState.taps, menuStock, menuRows (a drink is a row only while on a tap; its stock = mugs on taps), menuOffers(state, guests) (a drink offers mugs minus open orders, `guests` lets a step pass the orders it knows of so two guests in one step never order the last mug),
  nextOrder, pourOrder (a dish is picked up as before, a drink comes off the first tap that holds it; no mug = { empty: true }, the guest leaves the queue and the order stays open), serveStops (drinks: the pour point behind the bar level with the stand); guests.ts: reserve() and giveBack() do not touch the bag for drinks;
  npcNav.guestZones(items, room) = staff zones + kitchen zone (npcGrid, tavernSeats(items, roomId, kitchenZone) with the zone in the cache key, blocks.reachableSeatKeys); cooking.ts: Cook.bonus, cookYield, startCook fixes the bonus, collectCook gives qty + bonus (ledger 'cook'); bar.ts: registerPoint, barCoinPoint now above the bar's top.
  Ledger reason 'tap' (types.ts; no finds in ledger.ts NO_FIND_REASONS, no gain popups in gains.ts NOT_GAINS). newPlayer.ts: a new game puts the register and the tap stand on the bar (uids 8 and 9) and the 7 root ale on tap 1; the barrel starts idle (no ready brew; the model of firstHourGold is unchanged because the old first visit now only starts a brew);
  addBarFittings for old saves. api.ts: TavernView.taps, loadTap, unloadTap, TavernClientEvent 'pour' and 'tap_empty'.
- SAVE: SAVE_VERSION 24, MIGRATIONS[23] = addBarFittings (taps [], register and tap stand through the ledger 'tavern_gift' on the first free cells along the bar's long side via snapToSurface, else in the bag; a save that has one keeps it; LoadResult.barChanged -> the opening notice TAVERN_BAR_NOTICE,
  plus "the rest is in your bag" when a piece went to the bag). isGameState requires taps. Drink stock in the bag stays in the bag.
- API (client/src/api/tavernApi.ts): serveGuest refuses a drink with no mug on a tap (tap_empty event, nothing queued); the errand 'bar' stage starts a 'pour' task (walkState.task { stage 'pour', until }), runErrand waits POUR_MS, then pourOrder; a tap on the floor during the pour ends the errand (nothing taken); roomsApi.setItems runs returnOrphanTaps next to the brew and cook orphans.
- CLIENT: ui/tapsPanel.ts (panel 'taps'), menuPanel (tap levels, Taps button, "N on tap"), render/pourFx.ts (stream and filling mug from boxes, driven from the frame loop), audio 'pour', render/cellGrid.ts (kitchen tint under the grid), roomPanel (kitchen line), cookingPanel (bonus), game/tavernLife.ts (standTap, events pour / tap_empty / collected with up to three coins flying into the register),
  game/pointerInput.ts (a tap on the register acts like a tap on the bar).
- ECONOMY (tools/simulate-economy.ts section T1): pours per hour 42 / 20 / 39 (new / level 3 / level 8); a full tap (12 mugs) lasts 17 / 37 / 18 minutes, two taps twice that, so the player is not tied to the bar. Dishes per batch of 4: 4 / 5 / 6 with 0 / 1 / 2+ prep tables (x1.25, x1.5); guest gold per hour at the best kitchen 504 / 742 / 1118
  (from 462 / 602 / 962); the guest share of a mixed hour at the best kitchen 51% / 49% / 49% (S3 cap 50%, so a separate cap of 55% for a tavern with two prep tables, tested). TO CONFIRM: the start has no ready brew (a first drink needs no barrel visit); if the owner wants the old extra 7 mugs, give the barrel a ready brew again (tests: tavernTest.legacyStart).
- TESTS (1 069 in all, 83 files): shared/src/taps.test.ts (bar placement, load / unload / refusals / ledger / orphans, menu hiding, over-ordering, pour, empty tap, serve stops, tap cards), kitchen.test.ts (zone data on every shape and level, guests blocked in nav, stool in the zone is no seat, prep bonus adjacent and inside, cap, outside stove, fixed at start, appeal),
  save.test.ts (23 -> 24: pieces on the bar, ledger, bag when full, rotated bar, no second migration), balance.test.ts (T1 section), bar.test.ts, client/src/api/tapsAPI.test.ts (the pour chain with events and timing, empty tap, tap run empty on the way, tap on the floor, load / unload, menu, reload). Older tests that counted start items,
  bag drinks or a ready start brew were updated (tavernTest.withAle now loads 6 mugs on a tap; legacyStart keeps the old barrel).
- CHECKED BY EYE (headless Chromium 420 x 760, a new save and a v23 save with 5 root ale and 4 cider in the bag): both load without console errors; the register and the tap stand stand on the bar next to the stove; the notice for the old save is readable; a tap on the stand opens the Taps panel (Tap 1: Root ale 7 of 12, Tap 2 empty with the drink chips);
  a tap on an order bubble walks the avatar behind the bar to the stand. NOT SEEN: the pour stream itself (the order bubble covers the stand in my frames), the kitchen tint while placing, a real phone, a tap stand in a rotated bar by hand.

## STEP K2a (coder, 15 Nov): ripening rules
- Tier items: materials.ts builds `<drink>_aged` / `<drink>_vintage` from drinks.json with config/ripen.ts RIPEN (value x1.6 / x3, tipMult 1.2 / 1.0 so glowcap stays within the targets), vintage one rank up; DrinkId type includes them, BaseDrinkId and isBaseDrinkId are the brewable ones (a barrel refuses tiers). Taps, menu, ledger, Book (Food tab) work unchanged.
- Casks: furniture flag `casks` on keg_rack, TavernState.casks [{rackUid, slot, drink, mugs, startedAt}], shared/src/casks.ts (fillCask, caskTier exact ms, collectCask at the CURRENT tier, caskViews, returnOrphanCasks), ledger cask_fill / cask_collect, RIPEN_AFTER_MIN by the plain drink rank (common 30 / 180 min), CASK_SLOTS 3. GameAPI getCasks / fillCask / collectCask.
- Taste guests: tavern.ts tasteOffers (TASTE_AGED_CHANCE 0.25; the rng is used only when an aged drink is on a tap). SAVE 26: MIGRATIONS[25] adds casks []. Simulate section K2 prints gold per mug (aged x1.56 to x1.65, vintage x3.0). BALANCE: the S3/T1 tables assume fresh mugs; an all-aged tavern would earn x1.6 on drinks (a barrel-limited, wait-limited choice); origin's 55% guest-share cap was not changed.

## OUTDOORS C11 to C13: fx module, dungeon juice, fishing juice (coder, 16 Nov; look only, no save change, no rule change)
- client/src/fx/ (pure, tested): ease.ts (easings), shake.ts (Shake, seeded hash01, whole-px decaying offset), hitStop.ts (render-side freeze), particles.ts (ParticlePool, cap FX_MAX_PARTICLES, no allocation per spawn), fxSpec.ts (dungeon event -> effect list). Pref reduceEffects (prefs.ts, device pref) turns every effect off; floating numbers and sounds stay.
- C11: spriteStore kinds dungeon, actors, lake and strips: spriteFrames(kind, id, tag, frameW); no PNG = null = code art. C12: dungeon/dungeonFx.ts (particles), floatTexts pop-in, sounds kill, chestOpen, windup, levelUp, stairs, found (rank-pitched).
- C13 (fishing and trees): lakeside/lakeFeel.ts (pure: reelFeedback, nibbleDip, arcPoint, reelTickStep/Pitch, treeFall, swayPx, BobberSet = the two bobber drawings built once), lakeside/lakeFx.ts (leaves, water drops, rank bursts, pre-drawn pixel ring Graphics, the prize fish), tests next to them. lakesideScreen.ts: cast arc and splash, nibbles, bite dunk and "!" pop, thrashing reel, slack line on escape, catch flight and held fish, tree leaf puff, 1 px dip, fall with bounce, 1 px sway. FX_* numbers in shared/src/config/lakeside.ts. New sounds cast, splash, reelTick (pitch 0..1), rustle; hooks.sound(name, { rank, pitch }), hooks.reduceEffects(), hooks.flash(ms) (ultra rare and legendary catch; reuses .screen-flash). FishBar.set takes an optional reelFeedback and toggles .catching, .draining and --tension. fishing.ts untouched.
- Seat and surface heights (ART-REDO R1/R2): the code boxes in shared/data/furniture.json now match the sprites (round_table, table, long_table top 26, bar_stool seat 24, chair seat 18, bed mattress 22; type heights follow). render/furnitureArt.ts seatHeight and seatLiftFor; AvatarSprite.setSeatLift raises a seated avatar by seat height minus SIT_DROP (14), set in seating.ts and guestViews.ts.

## C14 + C15 (outdoors rework: crypt light, lakeside life)
- C14: client/src/dungeon/light.ts (pure: stepRadius, flickerRadius, lightRings, staticLights = wall torches / mine lanterns / exit, dynamicLights = closed chests, golden wider, living Bone King crown, vignetteAlpha, LightPerf frame guard), dungeonLight.ts (Pixi: additive stepped discs, player pool redrawn per frame, other pools when the 120 ms flicker steps, 64x64 stepped vignette sprite on the stage), wired in dungeonView.ts / dungeonScreen.ts. With the layer on, seen blocks tint cool dark blue (night, alpha 0.62) instead of black; unseen stays black. FogMemory untouched. Fallback to the old fog: Reduce effects, or LightPerf (average under LIGHT_MIN_FPS over LIGHT_PERF_FRAMES frames, latches off for the session). Numbers: LIGHT_* in config/dungeon.ts. NOT done: PNG hooks (dungeon tiles / actor strips), no phone profile measured (guard is the safety net).
- C15: lakeLife.ts (pure: decorSpots, bird state machine, butterflyAt, fish shadows + scareFish, leafAt) and lakeLifeView.ts (Pixi, built once, frames by visibility). tree variant = treeVariantOf(i) into drawTree. Decor (reeds, cattail, flower, stone, mushroom, tuft; lily pads in the water) by seed = room id, never on the pier, trees, bushes, door zone, start. Birds perch on the pier and fly off within 80 px, fish shadows dart from a cast, 4 leaves fall from standing trees, 3 butterflies near flowers. Ambient life off with Reduce effects (decor stays). Numbers: LAKE_* in config/lakeside.ts. Water shimmer is still the artist's drawRipples. NOT done: shoreCells / tile strips / pier pieces / PNG hooks / warm tint.

## FP-1 / JU-1 / AU-1 coder side (first ten minutes, tavern juice, tavern sound; 16 Nov)
FP-1: shared/src/firstTen.ts (pure, tested): steps barrel, collect, load, menu, serve, coins (any order; the goal is the first undone step that is not waiting; a brew that is not ready makes collect and load wait, so play is never blocked), texts at readingMs through the toast, skip = off for good, one-time machine tips (barrel, stove, tap). State is device storage (FIRST_TEN_KEY 'pixel-hotel.first-ten'), no save bump, no prefs change; started only in a new game (st.introPending). client/src/ui/firstTenGuide.ts = a small card (class .first-ten, inline placement, top centre; the artist may restyle) with "n/6", the goal and a Skip button. Events are fired in game/tavernLife.ts. FIXLIST suspect 4 (hint order) is not touched: the quest card (HINTS) and this guide run side by side.
JU-1: client/src/render/tavernFx.ts (TavernFx: fx ParticlePool in view.markerLayer, drawn as small squares): pour splash drops while the avatar pours, spark bursts when a coin lands in the register and when a mug is served, steam wisps from every ready stove or barrel (STEAM_EVERY_MS). A served guest shows a smile bubble (the unhappy frown was already there). Reduce effects: nothing spawns; bubbles and sounds stay. TavernFx.update runs in gameLoop; paused while the dungeon is open. Shake is not used (no screen shake in the tavern).
AU-1: sound.ts adds door, arrive, ready, collect, uiOpen, uiClose (all with MIN_GAP_MS) and setAmbience('tavern' | null, crowd 0..1): a synthesised rumble, a murmur that grows with seated guests, and a soft note every 3.5 to 8.5 s; starts on the first tap, follows the sound toggle and volume. Hooks: arrive on a new guest (replaces bell), ready when a stove or barrel finishes (checked every second), collect on collecting, door in useDoor, uiOpen/uiClose on panels.onChange. NOT done: music files, a cheer on a served round, per-room music outside the tavern.

## DG1: the crypt layout (coder, 16 Nov; plan docs/PLAN-SPLICE-DUNGEON.md section 1; changes CLAUDE.md 10; no save change)
Files: shared/src/dungeon/layout.ts (generateCryptLayout: zones, templates, rooms, corridors, loops, nooks, vault, secrets, themes, things, pacing; the ORDER OF DRAWS is at the top of the file), rooms.ts (templates and masks), themes.ts, pacing.ts, layoutCommon.ts (shared helpers), legacyLayout.ts (the old layout, used by the mine and by tests that compare totals), shared/data/dungeonRooms.json, dungeonThemes.json, config/dungeon.ts (DUNGEON_ZONES, CORRIDOR_MAX, LOOPS, PACE_*, ROUTE_LEN_*, DUNGEON_LAYOUT_ATTEMPTS = 300). generate.ts: generateFloor -> layout.ts, generateMine -> legacyLayout. Tests: layout.test.ts (golden hash of seeds 1..20 x floors 1..3; changing the draw order changes it on purpose), generate.test.ts (rooms are checked on floor blocks, masks have holes).
Rules as built: a floor with 4 or more rooms starts from a 2 x 2 square of zones (a loop needs a cycle of neighbours); a child room is placed beside its parent with a gap of 1 to 3 blocks and a straight corridor on a row where both door blocks are floor (20% 2 wide); loops are straight corridors of at most 5 blocks between zone neighbours; a draw that breaks a rule (no loop, route outside 25..70 steps, a template used 3 times, fewer than 3 templates) is drawn again from the same stream (300 attempts; none failed over 12000 floors, the old layout is the last resort). The boss floor's last room is the arena (8 x 8, 4 pillars) and holds the exit, the king and the golden chest. Calm (enemy-free) themes only on floors of 4 or more rooms, one per floor, and their enemy rolls move to other rooms (cap 2 per room): enemy mean per floor is -3% (round 1) and -1% (round 2) of the old layout over 3000 seeds. Props are non-solid (decor kinds are strings; vault_arch, crack, gem_pile, rubble are stubs for the artist); the pacing pass moves enemies toward long enemy-free stretches of the route (best effort: about 3% of floors still have a stretch over 16 because the roll was too low) and puts a prop wherever no beat lies within 4 blocks, so every route point has a beat within 7 (tested). Generation is about 0.6 ms per floor (worst 9 ms of 1200).
simulate:dungeon (1000 runs per row, before -> after): round 1 value/run 97/96/97 -> 93/95/94 (350/500/700 ms), gold per banked run 46/47/45 -> 45/44/45; round 2 value/run 387/283/159/427 (350/500/700/500+iron) -> 393/297/183/422, gold per banked run 166/155/127/167 -> 163/157/135/167, survival 91/65/40/100% -> 93/70/45/100%, minutes per run 2.5/2.4/2.3/2.6 -> 1.9/2.0/1.9/2.0 (shorter routes). Gold and gems per banked run stay within 10%; only value/run of the slow 700 ms bot is 15% higher, because it survives more often. Rare drops per 100 runs are within noise. Next: DG2 (view hooks), then DG3 and DG4 tuning.

## SG2: the economy gate of the general splice rule (coder, 16 Nov; plan docs/PLAN-SPLICE-DUNGEON.md 2.7; no save change)
- shared/src/balance.ts: chains(), spliceSellLoops() run over allRecipes(). New: bestHarvestGemsPerCellMinute(), spliceGemRows(), plantsCapGoldPerHour(stage), cheapestSpliceCycle(depth) (dynamic programming over the recipes, no path walk). Config: SPLICE_GEM_CAP = 2 (config/farm.ts).
- shared/src/balance.test.ts: describe 'SG2 splice gate' = the ten groups of 2.7 (reachability, STRICT sell-back per chain and per step, cell-minutes, seeds 2 in 1 out, gems, packs without splice-only seeds, cycles depth 4, ore/furniture/brew caps, distribution, plants cap). `npm run simulate` has a section SG2 (10 cheapest and 10 dearest results, gem rate, cycles, plants cap).
- Numbers fixed, no test loosened: amber baseValue 40 -> 36 (amberbud_seed: its seed 1 + one harvest 7.5 sold was over the 8 gold of its starter seeds) and heartwood_throne_seed baseValue 90 -> 60 (sold 3 + 9 was over 11). The plants-cap test counts the trader's price net of the seed, limited by the farm's focused harvests per hour at level 8 and by the equal share a mixed hour gives the farm; base value is not the measure (it is only earned inside a dish, and that gold is the tavern's). 600 gold per focused hour, 120 in a mixed hour against 25% of 626 = 156.
- Distribution test (group 9): only categories that have a pool seed are counted (renormalised weights); the pool has no block, ore or style results yet. SG3 fills them: from then every category counts. Group 8 clothing duplicates giving no spare needs the SG3d style/clothing seed rule (not built): not tested yet.
- The 14 non-starter results of the current pool: all chains pass; best splice gems per cell-minute 0.150 (cap 0.375); cheapest loop of depth 4 costs 1270 gold-equivalent.
- CLAUDE.md 9 and 10b and docs/BRIEF.md now carry the SG1 (general rule), SG4 (plants on blocks) and SG2 wording.
- R4 boxes aligned with the new sprites (furniture.json, footprints unchanged): sofa seat 10 -> 16, back 22 -> 38 (height 70); bench seat 10 -> 18 (height 48); desk top 16 -> 28 (height 60, a surface: items on it stand higher); the rug box already fills its footprint. Test in client/src/render/furnitureArt.test.ts.

## SG3bc: crops, dishes, drinks, furniture and clothes seeds (coder, 16 Nov; no save change)
- Data: crops.json +8 (spliceOnly, seedPrice null: beet leek onion / pepper berry brown_cap / sunmelon honey_root), food.json +10 dishes, drinks.json +6 (they are brewable from the new crops; tiers auto), spliceSeeds.json +29 (6 drink seeds, 9 clothes seeds: belt apron braids tabard cloak kilt wayfarer_cloak moonweave top_knot, 14 furniture seeds), furniture/splice.json +14 (art boxes: dy = FRONT edge, height = max(-dy+z+h+d), tested by furnitureArt.test). types.ts unions extended. No clothing.json change (the pieces already existed).
- Per category and rank (non-starter seeds): drink common 3 rare 3 ultra 2 (one short), crop 3/3/3 (spiritbrew counts as crop), furniture 5/7/6, clothing 3/6/4, block 4/5/3. ore, style, material wait for SG3d.
- balance.ts: the gem-line harvest pool skips spliceOnly crops; guestGoldPerHour and poursPerHour average PLAIN_DRINKS/PLAIN_DISHES (no splice-crop input) so the S3/T1 tables stay 373/477/626. Loops over ALL drinks and dishes (brewSellLoops, dishSellLoops) still count the new ones.
- Ranked values changed to pass the STRICT sell-back: pepper 28, brown cap 24 (rare crops). top_knot and wayfarer_cloak seeds have 0 slack (13 of 13): SG3d reshuffles chains, re-run balance.test.ts.
- GOLDEN in spliceRule.test.ts repinned for the new pool; repin again after SG3d, then it is frozen.

## ST1 + R9 heights + hats (coder, 17 Nov; SAVE_VERSION 31 -> 32)
- Stacked blocks: Room.blocks is Record<"c,r", BlockCell[]> (bottom first), BLOCK_STACK_MAX 3 and BLOCK_STACK_RISE_PX 14 in config/blocks.ts. shared/src/blocks.ts: stackPush/stackPop/stackFull, placeBlock pushes, hitBlock hits and breaks the TOP only, blocksOverlapping lists every level (upgrade and Inn door clear return the whole stack). room.ts: blockStack, blockInCell = the TOP block, blockList gives {c, r, block, level}. New refusals 'stack_full' and 'stacked' (plant needs height 1). Migration 31 -> 32 wraps each block in an array (idempotent). Tests: shared/src/stackedBlocks.test.ts (+ fast-check), save.test.ts, blocksAPI.test.ts.
- Client stub: blockViews draws one view per level, each BLOCK_STACK_RISE_PX higher; punch shakes the top. NOT done (ST2): tapping a block with a block selected still PUNCHES (INPUT rule), so no stacking by tap yet; stack-aware hit testing, fade, ghost layer.
- R9 heights: register 34, lamp 28 (boxes rebuilt, footprints unchanged), menu_board z14-44 already matched; test in furnitureArt.test.ts.
- Hats: they DO render (wool cap code hat, straw hat PNG, seen in a browser). Fixes: (1) seen from behind a hat that hides 'front' dropped hair_front, which is the whole back hair there = bald head: now kept when facing up (avatarRig.ts); (2) the Avatar panel re-reads the owned clothes each time it opens (new hats stayed locked silhouettes). The Hat tab exists in the Avatar panel (not in character creation: no hat is owned at the start).

## FS1: free small decor on surfaces (coder, 17 Nov; no save change)
- FurnitureType.freeOnSurface (optional) on 13 onSurface pieces; register and tap_stand keep the cell rules. snapToSurface(..., types, snap): free pieces take any point on the top (snapCoord 4 px, whole px with Shift), clamped so the footprint stays inside the surface top; no overlap between free pieces; refused (null) only where a structural rider (register, tap stand) is. planGhost feeds the raw pointer (not the cell) for free types; moveItem keeps a free rider at its offset from the surface centre (turned with it), clamped inside the new top, not cell-snapped; pick up still returns riders. x,y stay the anchor, so no new field and no SAVE bump (old saves have lamps on cell spots, which are valid free spots).
- Draw order and lift already came from onItemUid (itemDepthKey sub order, surfaceHeight of the surface), so render/placer needed no code. Tests: furniture.test.ts (free decor group incl. fast-check), placing.test.ts.

## FIX-R2 (17 Nov, coder): TESTER RUN 2 fixes
- Farm: soil and plants render (e2e/farm.spec.ts); the tester planted through __ph.api, which bypasses the client room refresh, and the camera framed the avatar at the door.
- crops.json growMinutes now equals SEED_GROW_MS[rank] (2 / 20 / 180 min); only the legacy 15->16 migration reads it (save.test updated). Test in farm.test.ts.
- New game: createPlayer adds START_CROPS (turnip 2, potato 1) via ledger reason start, after createNewPlayer (so shared tests keep the old bag). Gold simulation does not model the bag; one extra brew is about 60 gold once.
- firstTenToastDue (shared/src/firstTen.ts): the done-toast only fires for the step on the card.
- Build mode (B) now shows the grid and the kitchen tint (late.syncGrid); the Settings grid toggle still hides both.
- Counter: top art box z36+h4, height 72; surfaceHeight 40 moves register, taps, mug and the pour bar with it (they derive from it, no SPOUT change needed).

## CAT HOOK + SG5 splice preview (coder, 17 Nov; no save change)
- CAT HOOK: client/src/render/catView.ts `createCatView()` -> { container, update(brain: PetBrain, nowMs), y, destroy }. Strips (artist draws, animator animates): client/src/assets/sprites/actors/cat_walk.png (4 frames), cat_sit.png (2), cat_sleep.png (2); a horizontal row of 32x32 frames, drawn FACING RIGHT (left = mirrored by code), feet at the bottom middle. Timing const CAT_STRIPS (walk 140 ms, sit 900, sleep 1400 per frame); 'follow' uses the walk strip. Missing strip = code-box cat. Purr heart = code heart while nowMs < brain.purrUntilMs. NOT wired into the game loop yet: nothing calls stepPet/createCatView in client/src/game (the cat is still not on screen); wiring = a later coder task (stepPet each frame, depth list by `y`).
- SG5: GameAPI.previewSplice(c, r, seed) -> SplicePreview (shared/src/splice.ts). shared/src/spliceAsk.ts: spliceNeedsAsk (new mix, or any rare+ ingredient/result, asks; a known common mix splices at once), spliceDialogText (result hidden unless found). Dialog client/src/game/spliceDialog.ts (on ui/confirmBuy). CSS classes for the artist: splice-extra, splice-row, splice-slot, splice-sign, splice-unknown, splice-rank. Retry after walking closer does not ask twice. Book Splice tab (cards per result seed) = SG6, not done.

## ST2 stack look + SG6 Book Splice tab (coder, 17 Nov; no save change)
- ST2 input decision: with a block selected, a TAP on a block cell with room on top stacks (shared/src/blockTap.ts blockTapAction: not for seeds, plants, stack_full or an avatar standing there = it punches then); a HOLD (300 ms) on a stack cell is not a hold-punch (holdTargetAt skips it) so it falls through to the place line; with nothing selected a tap or hold punches the top. Ghost: showGhost level = stack size, drawn one BLOCK_STACK_RISE_PX per level higher. Look: blockViews shadeOfLevel tints layers under the top (0xdd, 0xbb, floor 0x99); the top block stays full colour. Not done: fade of a stack over an avatar behind it, layer-by-layer punch fx beyond the shake of the top.
- SG6: bookEntries('splice') = SPLICE_RECIPES (kind 'recipe', key = pairKey, found via Player.splicesFound) then poolResultSeeds() minus special results (kind 'spliceSeed', key 'splice:<seedId>', found when Player.seen has the seed). bookPanel draws spliceSeed cards with card() plus the book-recipe class. bookRewards keep their claimed state in Player.bookRewards, so they never un-claim.

## ST3 walkable heights (coder, 17 Nov; no save change)
- Level of a cell = block stack size (0..BLOCK_STACK_MAX), derived from Room.blocks (navHeights.ts cellLevel / levelAtPoint). NavGrid.level? (row-major) makes nav.ts step-aware: canStep = level difference <= NAV_STEP_MAX (1, config/blocks.ts), diagonals need both side cells steppable, lineOfSight stays on ONE level (a stair is walked cell by cell, never smoothed across). The start cell may drop down any height (findPath dropFrom) so an avatar on a stack whose neighbours were broken is never stuck.
- The PLAYER grid (roomsApi.buildGrid) = buildWalkGrid: furniture, fixed things and PLANTS block, blocks do not (they are levels). GUESTS (tavernApi.tavernGrid, npcGrid, cat grid, placement refusals door/counter/seat_blocked via roomBlockers) still treat blocks as walls: guests never leave level 0; refusals stay on the safe side. A free but unreachable goal (a lone 2-stack from the floor) gives no path, as for any unreachable free cell.
- Client: gameLoop eases sprite.liftPx toward liftPxOfLevel(level) (LEVEL_LIFT_TAU_MS 70, easeLift), AvatarSprite.update draws at y - liftPx; on a stack the avatar depth key is the cell bottom + 1 (in front of its own blocks). Seated avatars use level 0. Not done: the dungeon/mine keep their own flat grid; no fade/occlusion; sounds/animation for the step; the avatar standing on a block can still be walked off only by stairs (or the one free drop from the start cell).

## OA-10: wall items free in x and y (coder, 17 Nov; no save change)
Item.y of a wall item is the sprite bottom inside the band (band top + min(height,64) .. foot); old items sit at the foot and stay valid, so no SAVE bump. shared/src/furniture.ts: wallItemRect, snapToWallSpot, canPlace (rect inside one band, no overlap with other wall items or an Inn doorway). planGhost: the ghost centre is the sprite middle (footprintCenter knows it). Ghost outline = wallItemRect. Rooms have no side walls (16 px border only): not built.

## OA-11 r2 run HUD (ui, 17 Nov)
client/src/ui/runBar.ts + runHud.css: bottom pill = bag pill (used/12, drawer with 12 slots + lunch hint on tap), run gold, gems, potion (Q), food (E), Leave (mine) / Abandon (crypt, needs onAbandon). Buttons 44 px; key hints hidden on touch (hover: none). Info panel in a run hides tavern name and wallet via :has(.hp-bar:not([hidden])). Checked 420x760 and 1000x700 screenshots; the open drawer was not captured.

## TUT-2 part 3: daily quests, events, achievements (coder, 17 Nov; SAVE 33)
- Rules: shared/src/questBoard.ts (pure; the date comes in as DayInfo from dayInfo(nowMs, tzOffsetMin)); data shared/data/quests.json (daily pool with area and minLevel, events as MM-DD ranges that may wrap New Year, achievements). GameState.quests = { claimed: string[] } only; progress = ledger entries with the quest reasons since the day / event start / ever (measure made = entries that put something in the bag, so a brew or cook counts when collected). Claim = applyChange reason quest, gold only. Dated daily claims of other days are dropped on the next claim.
- Daily pick: seeded hash shuffle of the pool by date, 3 from different areas, never the last two days (chained in 30-day blocks so it stays pure). Old hint quests (HINTS) stay on the first-run card (they pay gems as before) and show as first_* achievements, done when hintsDone passes them, never claimable (no save loss, nothing paid twice). Migration 32 adds quests.claimed.
- GameAPI getQuestBoard(tz) / claimQuest(id, tz); UI ui/questPanel.ts + ui/quests.css, panel name quests; the Quest button opens it and glows while a row is ready (craftPanels polls every 5 s), hidden while the tutorial runs. Event twist texts are data only (decor and guest changes belong to T-FUN-4).
- Hooks: PourFx.syncTapStates (tap_stand_dry / wet frames 32x48 per slot, wet tinted with the drink colour), PlantViews ripe sparkle (sprites/plants/ripe_sparkle.png, 2 frames, 450 ms; parseSpritePath accepts one strip file in plants), DungeonInput abandon (crypt only, like a defeat) wired to the run bar Abandon button, guideWorld pointers (Worlds button outside the tavern, ripe plant on the farm, the water at the lakeside).

## KITCHEN-WALL, CEL 3, TRADER OUT, MG-1/MG-2, TAP FORGIVENESS, tutorial from 0 (coder, 18 Nov; SAVE 37 and 38)
- KITCHEN INTO THE TAVERN (SAVE 37): shared/src/kitchenWall.ts (kitchenWall(room): inside = the roomShapes.json kitchen zone, walls = a one-cell ring on the floor around it, one doorway cell: south middle, then other south cells, west, east, north; needs floor on both sides). farmLayout.fixedBlockers / noPlaceRects return the ring (walking, placing and blocks refuse it), npcNav.guestZones adds the doorway, render/roomView.ts draws plank cells (box art: the artist may replace them). Removed: Room kind 'kitchen', shape kitchen_room, Player.kitchenRoomId, doors tavern_to_kitchen / kitchen_to_tavern, START_KITCHEN_ROOM_ID, KITCHEN_START_ITEMS, the guide step 'kitchen', GuideWorld.inKitchen. Data moved so the ring never covers other things: roomShapes.json shopStart (stove and barrel now INSIDE the zone on every shape; counters of long 112 -> 80, l_shape 176 -> 144, plus 336 -> 304, wide_hall 240 -> 208), long's kitchen zone x 5 -> 8 (L1..L3), innDoors.json: long tavern_to_cellar col 5 (all levels), square_shop L2 tavern_to_cellar col 13 (test kitchenWall.test.ts checks every shape and level: ring on floor, off the door zone and Inn doors, one doorway, inside reachable from the main door, start items outside the ring). Migration 36 -> 37 = cellarRooms.dissolveKitchenRoom (kitchen room items into the tavern inside via nearestValidPlacement, rider items come along, what stood on the ring goes to the nearest free cell or the bag, blocks on the ring go back to the bag (ledger block_place), the player in the kitchen room is moved to the tavern; 35 -> 36 now only builds the cellar for owned racks). Door hint: innDoorHint(room) names this room's destinations only (RUN 6 bug 2). Phone overview fit ends left of --side-col (cameraSetup.usableWidth, RUN 6 bug 6). Pour: Serve closes the bar panel at pour_ready. Worlds badge hidden in the tavern and cellar (placeLife.updateBadge). e2e: the tester's run6kc*.spec.ts test the removed kitchen room and must be rewritten by the tester; hints/run2..run5 find the stove in ph.st.items (any room) and need no change (not run here).
- CEL 3 (owner OK): racks per cellar level 2 / 3 / 3 (was 2 / 4 / 6). Old model share at level 8 best kitchen with 6 racks 58.9%, 5 racks 57.7%, 4 racks 56.3%, 3 racks 54.8% (cap 55%): 3 passed. it.fails removed.
- TRADER REMOVED (owner 18 Nov): deleted shared/src/trader.ts (+test), client/src/api/traderApi.ts (+test), client/src/ui/sellTab.ts (+test), GameAPI getSellRows / sell / sellSpare, packs.sellSpare / spareValue, config SELL_RATE(S), SELL_CONFIRM_QTY, SELL_HINT_STACKS, SPARE_SELL, BALANCE_TARGETS.maxSellShare, quest d_sell, the bag sell hint, the Sell tab and the spare Sell button. balance.ts lost the trader loops (ingredientsSellGold, dish / brew / block / pack / splice sell-back, plantsCapGoldPerHour, surplus gold, traderByActivity); the splice gates that do not sell (chains, cell-minutes, gems, cycles, distribution) stay. GoldSourceId = guests | dungeon. New bounds: minGoldShare 0.15, maxGoldShare 0.85, maxGoldShareBestKitchen 0.85 (CEL_GUEST_SHARE_MAX follows it). simulate: mixed hour 243 / 275 / 375 (new / level 3 / level 8), guests 76% / 77% / 77%, dungeon 24% / 23% / 23%; best kitchen guests 77% / 80% / 79%; level 8 with a full cellar of reserve 82.3%. First 30 min 217 gold, first hour 462 gold (unchanged). No gold number was changed. TODO (later, not built): player trading for spares, seeds, fish, crops and ore.
- MG-1 (owner delegated every section 8 decision to the plan's proposals): shared/src/stats.ts (StatId, effective(base, stat, bonuses): ...Pct scales, others add; mergeBonuses), shared/src/skills.ts, shared/data/skills.json (32 nodes: tavern, dungeon, fishing, mining, tiers 1..4, costs T1 1 each, T2 [1,2] or [2], T3 [2,2] or [2], T4 [2,3] or [3]; node effects and caps are the plan's 4.3 numbers), config SKILL_FIRST_LEVEL 2, SKILL_BOOK_MAX 4, SKILL_RESPEC_FREE 3, SKILL_RESPEC_GOLD 100, SKILL_TIER_STEP 2. Player.skills? (optional, SAVE 38 needs no data change: unspent points are derived). GameAPI: getSkills / buySkill / respecSkills (SkillsView: earned, spent, free, respec info, nodes with rank, nextCost, problem 'unknown' | 'maxed' | 'requires' | 'tier' | 'points'). Ledger reason 'respec'. No rule reads a bonus yet (MG-7). MG-2 level cap 12: levels.json maxLevel 12, total xp 620 / 830 / 1090 / 1400 for levels 9..12 (the plan listed "450, 620, 830, 1090"; 450 is level 8 already, so I added 1400 for level 12: ASK THE OWNER). Points at cap: 11 from levels + 4 Book = 15.
- TAP FORGIVENESS: shared/src/tapPick.ts (pickTap, atLeast, tapTolerance, tapMinSize; config TAP_TOLERANCE_PX touch 28 / mouse 20, TAP_MIN_SIZE_PX touch 44 / mouse 28), client/src/game/tapForgive.ts (candidates: furniture with a use by drawn sprite bounds, guests by body box), pointerInput.useHit (exact hit first, then the nearest near-miss, else walk), dungeon chests and rocks get the same slack in world px (enemies and gem piles were already generous), plain toasts are pointer-events none, guest markers above a head are inside the guest tolerance. NOT covered (exact as before): doors, plants, trees, the water, blocks, build mode.
- TUTORIAL: guide.json starts with zoom (Pinch two fingers / Scroll the wheel), walk, holdwalk; counter = steps done out of N from 0 (firstTenProgress), only up; events zoom (cameraControl onZoomGesture), holdwalk (onHoldWalkConfirmed after 300 ms), walk (avatar walked). 'Stand still to emote' says 'Stand up to emote' while sitting or lying. Device storage only: no save field.

## KITCHEN-ANNEX, fixed tavern shape, round table retired, farm art (coder, 18 Nov; SAVE 39)
- Geometry: roomShapes.json `kitchen` = per shape and level one rect (cells) OUTSIDE the main floor, added by room.ts (levelRects, annexRectOf, roomAnnex). kitchenWall.ts: top row = partition (walls + 2-cell door + doorOut cells kept free), the rest inside; upgradeRoom moves the annex contents down (cellarRooms.shiftAnnexContents, annexShift). Floor of annex cells is always KITCHEN_FLOOR_STYLE ('kitchen_tiles', config/world.ts; floorStyleAt, paint skips it).
- Migration 38 -> 39 (save.ts): moveKitchenToAnnex (old zones in LEGACY_KITCHEN_ZONES) then retireRoundTables (retireRoundTable.ts). Tests: kitchenAnnexMigration.test.ts, kitchenWallArt.test.ts.
- Render: kitchenWallArt.ts draws the partition (timber cells) and the doorway from sprites/doors/door_kitchen.png (code frame as fallback).
- Cellar door: roomFlow.useDoor -> offerCellar (level too low = toast; else confirmBuy 300 gold, then api.buildCellar; the player steps through again).
- NewPlayerChoice.shopShape is ignored (configForChoice); tests that need other shapes build createNewPlayer({...config, shopShape}). Start table = 'table' 2x1 at the old round table anchor, stools left/right in its row, front below its right cell (roomShapes shopStart key `table`).
- Furniture: placeIn 'farm' (PlaceIn type, canPlace, catalog WHERE), category farm_furniture: scarecrow (rare), straw_bale, farm_barrel. Sprite file for the artist's hay_bale is furniture/straw_bale.png because hay_bale is a block id (spriteAssets test: ids never meet).

## OPEN-KITCHEN (coder, 18 Nov; SAVE 40)
- Rules: roomShapes.json `kitchen` = per shape and level the annex rect in cells, hung under the main floor at x 0, touching other floor only along its top edge, never wider than door.x - 2 cells (a one-cell gap keeps the door's border and the door zone clear; kitchenAnnex.test.ts checks it). Areas: square_shop 35 / 54 / 66 cells (old 20 / 30 / 35), long 28 / 40 / 48, l_shape 40 / 60 / 66, plus 35 / 40 / 45 (5 wide: the central rect touches a wider annex), wide_hall 40 / 60 / 72. The annex is open: kitchen.ts kitchenZone(room) = roomAnnex(room) (the whole annex); no walls, no doorway, no no-place cells (farmLayout.noPlaceRects and shared/src/kitchenWall.ts are deleted; fixedBlockers is lakeside only). Guests still never enter (npcNav.guestZones adds the zone, tavernSeats gets it).
- Start layout (roomShapes.json shopStart, config TAVERN_START_ITEMS = the square tavern's): with A = the annex's top row, counter (80, (A-2)*32) facing down (register -32, tap stand 0 on it), table (192, (A-1)*32), stools 144 / 240 on its row and (208, A*32) in front, barrel (48, (A+2)*32), stove (144, (A+2)*32) = row A+1 inside the annex (long: stove 112, barrel 16, cluster one row up so the front stool clears the door zone). Everything stands in cols 1-8 above the annex; the camera needs no change: the avatar enters at the door (cols 8-9) right beside the cluster. config SHOP_START_ITEMS counter y 96 stays only as the migration 3 fallback. Test: kitchenAnnex.test.ts (placeable, inside, close, bar spot reachable, 9 x 7 frame). Old rules tests that hardcode the old spots use tavernTest.legacyStart (it moves the cluster back).
- Migration 39 -> 40: cellarRooms.growKitchenAnnex (roomAtLevel for every tavern; pieces off the floor go to the nearest free cell or the bag). dissolveKitchenRoom lost its wall-ring step (the ring is gone). Tests in kitchenAnnexMigration.test.ts.
- Render: roomView.ts draws no kitchen pieces; innDoors.ts no longer maps 'kitchen' door ids; sprites door_kitchen.png and kitchen_wall.png are deleted; tools/gen-door-art.mjs no longer makes door_kitchen.
- Open: roomPanel.ts text (ui) says 'annex behind the partition wall'; e2e run6kc2/run7 specs use the old doorway coordinates; not seen in a browser.

## MG-7 skill stats and the Skills panel (18 Nov)
- shared/src/skillRules.ts: one pure helper per stat (trayMaxOf, guestMaxOf, pourRangeOf, stoveBatchMaxOf, tapCapOf, caskSlotsOf, roomSpeedOf, runSpeedOf, potionHealOf, enemyWindupOf, pickCooldownOf, oreQtyOf, rockGemChanceOf, runBagSlotsOf) on top of stats.ts effective(); bonusesOf(player) = skillStats. No bonus = the config number exactly (tests). UNHOOKED_STATS lists what no rule reads yet (chestGlintBlocks, lightPlus, glintBlocks, hazardDmgPct, baitSavePct, deepCast, keepBaitOnLoss, bagSlotsPlus); the panel marks those nodes "Not active yet".
- Read in: tavern.ts nextOrder (tray), guests.ts (guest cap + away orders by seatsPlus), pour.ts pourGrade(ms, bonuses), cooking.ts startCook / maxBatchWith(max), taps.ts loadRoom / tapCards(cap), casks.ts fillCask / caskViews (a cask above the slots after a respec stays visible); dungeon: run.ts newRun/newMineRun take `skills` (a snapshot in RunPlayer.skill, bagSlots, lastStandUsed), bank.ts passes bonusesOf, step.ts reads speed, potion, windup (Parry = longer wind-up), Last stand, pick cooldown, double strike (rng only used with the stat), ore (share of base + chance of 1 more), gem chance, run bag limit; fishing.ts newFishSession(rng, gear, skill) (box, bite wait, rank odds, strikeBonusMs, drainScale). Client: st.skills (refreshed with the player in hotbarBag), walkApi and gameLoop use roomSpeedOf, tapsPanel/caskPanel/cookingPanel/runBar take the caps.
- Panel: ui/skillsPanel.ts (tabs per branch, tier headings with the lock, card = pips + now/next + reason, Learn(cost) asks first via confirmBuy, Respec in the strip with its cost; skillsText.ts is the pure text, tested). SkillsView got branchSpent + tierStep. Button: More grid, icon level (placeholder until MG-15).
- Balance: balance.ts and simulate do not read skills (a skilled player earns more through bigger batches / taps / trays, never directly); a max tavern branch is worth a few percent of guest throughput at most. Ask the owner if skills should enter BALANCE_TARGETS.
- Seat note: seatsPlus raises GUEST_MAX and AWAY_ORDERS_MAX, but guests still need a real seat, so it only matters in a tavern with 8 or more seats.

## UIR Lantern Dark (ui, 18 Nov)
- UIR-6..12 (ui): rows (.catalog-row, .menu-row, .recipe-card, .tap-row, .cask-card, .room-card, .quest-row) are flat 44 px lines with a divider in .panel-frame.ui-panel; catalog tiles have no Buy chip (price in candle text); .float-bar (place bar, item menu) is a dark pill; found Book cards are cream pages (tokens re-pointed inside .book-card); charmaker-panel, newgame-frame, run-drawer, fish-bar join the dark scope list; title board is .ui-panel; run bar is .ui-hud + a dark pill. Tabs: .panel-tabs .tab-btn are clip-path lantern tabs, open tab shows its label also on a phone. .frame, --frame-img2 and the Sell CSS (.sell-*, .pack-sell) are deleted; .sell-gain is now .pack-cost. Skills button icon is UI icon skills; sideButtons.setSkillsDot(on) exists, game/ must call it with pointsFree(p) > 0.
- client/src/ui/lantern.css holds the whole skin and is imported by ui/layout.ts (after ui.css and skin.css). Tokens --ui-* are in skin.css; classes are .ui-panel (dark panel) and .ui-hud (frameless text), because .panel is the panelShell placement class.
- Dark scope = `:is(.panel-frame, .confirm-panel, .paint-bar, .emote-menu).ui-panel`. Inside it the ui.css tokens are RE-POINTED (--text cream, --parch night, --slot-bg ink, --wood slate #4a5578 for plate backgrounds, --rank-common light slate), so all old inner pieces (.btn, .inset, .slot, .plate, cards) turn dark with no per-panel edits. Text that used --wood as colour is listed in one rule (light slate). A new panel: use panelShell and it is dark; add a new inner colour use of --wood as TEXT to that list.
- Parchment survives only as the confirm receipt (.slip) and chat bubbles. Not done: flat rows instead of cards (bar panel, catalog tiles), Book entry page, character maker and title (UIR-10), removing old .frame iron CSS (UIR-11), run bar and fish bar still .frame.

## MG-3 the dig mine (coder, 18 Nov)
- Rules: shared/src/dungeon/mineGen.ts generateDigMine(seed, depth) -> DigPlan {map, enemies, dig: DigState, route, pockets}; mineBlocks.ts (data shared/data/mineBlocks.json: hits, drop, filler / hard / rare / unbreakable, minDepth, weight + weightPerDepth, placeholder colours); mineStep.ts (digInput, digWalkTarget, digAfterWalk, digHazardTick, glintingCells, glintingChests), called from step.ts. A dig run is a DungeonRun with place 'mine', run.dig (kinds row-major, hits, hazards, rare, rev), maxFloors DIG_DEPTH_MAX, lanternEndsAt null. Digging makes a NEW map object (blocks copied, one cell floor) so dungeonNavGrid's cache rebuilds; the old run is untouched.
- Generation: bedrock border, dirt/clay band (DIG_DIRT_BAND), 4-7 rectangle pockets (cut corners) from the top spawn to the bottom exit (exit >= DIG_EXIT_MIN_DIST steps away), 28 + 3 * depth ore veins (random walks, kinds by weight at the depth), the cheapest dig route (Dijkstra, hard blocks cost +100) with hard blocks on it turned to stone (so bare hands always get through, hits <= DIG_ROUTE_HITS_MAX 160), rare blocks (0-2, from depth 2: crystal; from depth 3 also gold vein and diamond) at least 6 blocks off the route and 5 from the spawn, 0-2 slimes/bats and 0-2 cave-in tiles per pocket (not the spawn pocket, not within 5 blocks of the spawn). Plan said cellular automaton caves: pockets are rectangles instead (simple, counted exactly). Golden seed 1234 depth 1 pinned in mineGen.test.ts.
- Dig: click_dig {c, r} walks to the nearest open neighbour, one swing per tap at pickCooldownOf(skill), hits per swing from the pickaxe (steel = 2) and Double strike. Mithril needs minesMithril (event dig_too_hard). Drops: ore qty 1-2 (oreQtyOf = Prospector), a gem roll (gem material chance + gemDrop 'rock' at the block's gemRank, same ranks as the old rocks); stone, dirt, clay drop their block with DIG_FILLER_DROP_CHANCE (0.15) and are simply not picked up when the bag is full (they never push ore out; ore that does not fit is left behind as before).
- Cave-in tile: armed (a faint seam) -> stepping on it starts DIG_CAVEIN_TELL_MS (700) of cracking (event cave_crack, the tile flashes) -> fallen; DIG_CAVEIN_DAMAGE (4, hazardDamageOf: Careful step, never below 1) only if the player still stands on it; Last stand applies. lastHitBy 'cave-in'.
- Skill hooks now live: Lantern lightPlus -> digLightPxOf (fog radius, DIG_LIGHT_BLOCKS 7 + n), Ore sense glintBlocks -> glintBlocksOf (rare blocks glint within DIG_GLINT_BLOCKS 3 + n blocks, even in the dark), Careful step hazardDmgPct, Treasure sense chestGlintBlocks -> glintingChests (crypt chests show through the dark within n blocks), Strong arm/Double strike/Prospector/Gem eye/Pack mule as before. UNHOOKED_STATS = baitSavePct, deepCast, keepBaitOnLoss, bagSlotsPlus. The client light layer's player pool is NOT widened by lightPlus (only the fog radius).
- Materials: coal (common 4), gold_nugget (rare 24), diamond (ultra_rare 60) added to materials.json + BaseMaterialId; crystal reused ("Crystal"). No selling, so no SELL_RATES; owner may retune baseValue. Book: listed as 'Mine' sources.
- Save: DungeonRun.dig is optional and JSON-safe, so a run saved mid-way keeps it and an old run has none: SAVE_VERSION stays 39, no migration.
- Client: dungeon/digArt.ts (DigLayer: one Graphics per row, only dirty rows redrawn; placeholder code-art; glints), dungeonView (same floor keeps fog and views when the map object changes, digCellAt, glints, fog radius), dungeonScreen (tap on a seen block = click_dig; hold uses the HoldControl 'rock' target with the CELL index as id, holdDig; effects for dig, dig_broken, dig_too_hard, cave_crack, cave_in), light.ts (no wall lanterns in a dig map), game/dungeonMode.ts text. e2e/mg3dig.spec.ts.
- Not done (MG-4/5 leftovers): enemy variety/lava/gas hazards, depth-themed blocks, mine art PNGs (MG-15), "Depth" label and exit art in the info panel (ui: it still says "Crypt, floor 1 of 10"), a rock beetle, balance groups MG/SK (ore per hour, gems per hour of the dig mine are NOT in balance.ts; its mine block still models the old rocks), light layer pool for lightPlus.

## PixelLab furniture pipeline (artist, 18 Nov)
- tools/pixellab-fit.mjs <furnitureId> [suffixes]: reads art-src/pixellab/<id>.png, trims, box-downsamples (majority colour, dark outline preferred) or stretches wide pieces up to 1.5x so the width equals the furniture.json footprint (spriteAssets.test: width = footprint, height <= d + height + 8), snaps to shared/src/palette.ts, writes client/src/assets/sprites/furniture/<id>.png. Suffix list writes copies (bar_stool _up,_right: symmetric).
- PixelLab output is much smaller than the canvas (a barrel is about 31x38); no upscale for 1-cell pieces. Details and ledger: docs/PLAN-PIXELLAB-ART.md.

## RUN 8 UI fixes (coder, 18 Nov)
- panelShell.ts: .panel-strip is now the last child of .panel-frame (footer inside the Lantern Dark frame; lantern.css `.panel-frame > .panel-strip`). Bag Sort/Stack and Skills Respec use it.
- skillsPanel.ts NODE_ICON maps each skill node id to an existing pixelIcons name (branch icon fallback). Panels with class tabs-named show all tab names (Bar: Serve/Menu).
- 19 Nov: the OPEN sign board is in the top-left column under the info panel on every size (the phone fixed position is gone); its rope is `.top-left:has(> .open-sign:not([hidden]))::before` from the viewport top (safe-area aware), --sign-w/--sign-h on .top-left size the board and the rope. Worlds is a column button (sideButtons.ts COLUMN_LABELS).
- Phone: pour bar 110 px (skin.css), OPEN sign 30 px high without icon (lantern.css, now declutter.css 28 px), .first-ten pointer-events none except Skip, phone panel-tabs tighter with a right fade.

## Furniture thumbnails from sprites (RUN9-ICONS, 18 Nov)
ui/itemIcon.ts furnitureIconUrl: the furniture sprite (down) is drawn to a canvas, trimmed to its opaque box (render/iconTrim.ts trimBounds) and fitted in 32x32 (fitInSlot: whole-number growth up to 2x, nearest-neighbour shrink, centred), cached per type as a data URL; no complete sprite falls back to icons/<id>.png, then the code icon. Rank border is CSS, untouched.

## HUD declutter (ui, 18 Nov)
UID: ui/declutter.css loads last (layout.ts). Rules in shared/src/hudIdle.ts (HUD_FADE_AFTER_MS 3000, HUD_FADE_ALPHA 0.25, GUIDE_IDLE_MS 4000); client ui/hudIdle.ts sets class hud-faded on #ui and feeds firstTenGuide (idle param, wired in tavernLife). Never fades with a panel, toast, pour bar, finger down, build/placing/paint, More open or the dungeon. Walking is not activity for the fade. The active-drink button no longer exists (hands-on pour has only the world hint). Hotbar untouched by owner order.

## PIXELLAB-HOOKS: render coordinates for the new tavern sprites (coder, 19 Nov)
- propAnimSpecs: stove png [16,31] flames (strip stove_fire 3 x 14x9), smoke [21,1]; tap_stand drips at png [5,23] and [25,23] (the nozzle tips of tap_stand.png 32x44).
- pourFx: no sprite strips any more. The mug, stream and green gauge are code boxes at the nozzle of the tap that holds the ordered drink (found from the taps passed to syncTapStates; slot 0 = local x -11, slot 1 = +9, y -21 above the stand foot); the gauge sits on the outer side. LEVER (19 Nov): the world base is tap_stand_nolever.png (furnitureSprite.ts), syncRest draws 2 overlay sprites of tap_stand_lever.png (frames 12 x 11, 0-3 left knob, 4-7 right; at sprite x 0 / 20, y 0), pourFx.update sets the frame from pullT of the pouring slot (leverFrame.ts), stop() resets. Made by tools/gen-tap-lever.mjs from tap_stand.png (rerun after a new base). tap_stand_mug / mugfill deleted.
- furnitureArt.SPRITE_SURFACE_HEIGHT: counter 28, counter_ext 23 (sprites are flat: counter.png 39 px, front edge of the top at 25). Table sprites: table.png 48 / prep_table 52 / long_table 47 px are not re-measured here.

## LOGO (19 Nov)
logo.gif = PixelLab 256x256 still (barrel mug, candles, plank with PocketBarrel) animated with animate_image (candle flicker, foam drips, sparkle), frames in art-src/pixellab/logo_pl, tools/build-logo-gif.mjs snaps to Endesga 32 and writes a 16-frame ping-pong (10 cs). favicon.png = barrel crop (32x32) because the lettering is unreadable at 32.

## PixelLab UI proof set (artist, 19 Nov)
Art in art-src/pixellab/ui/ (38 PNGs, palette bad 0, NOT wired): panel_dark 112x110 (9-slice 16 px all sides), panel_parchment 234x234 (20 px), btn_round 61x61 (+_pressed, _disabled), btn_pill 101x33 (+_pressed, _disabled), tab_active / tab_inactive / tab_disabled 86x35, bar_frame 218x24, bar_fill 193x17 (sits at offset 12,4 inside bar_frame, clip its width to the percent; bar_full = frame with a full fill), sign_open / sign_closed 161x85 (_s = 81x43 half size), icon_* 61x61 on a round disc (_s = 31x31): coin gem book hammer swords more bag close plus minus. Pixel scale: PixelLab UI draws at about 1 art px per px of a 256 canvas, so native pieces are bigger than the old 60x28 sign; use the _s files or scale by whole numbers. Known weak spots: the bar frame is a bevelled gold bar (fill sits slightly high), the dark panel centre is transparent (put the Lantern night colour behind it), pill and disc normal state is the gold ACTIVE look, the dull brown PRESSED look doubles as the inactive tab. Tools: tools/pixellab-ui-fit.mjs <unzipped zips dir>, tools/pixellab-ui-sheet.mjs <out.png>. Owner sheet: Desktop/PocketBarrel-styletest/ui-art/ui-contact-sheet.png.

## PixelLab panel frame + title screen (ui, 19 Nov)
client/src/ui/panelArt.css (last panel skin, imported in layout.ts): `:is(.panel-frame, .confirm-panel, .charmaker-panel, .newgame-frame, .run-drawer).ui-panel.ui-panel` gets border 24 px + border-image of assets/ui/panel_dark.png (slice 24: the corner plates are 23 px, 16 left gaps), night colour behind (background-clip padding-box), close disc moved to -28 px. paint-bar, emote-menu, fish-bar, HUD cards keep the plain Lantern look (small). Title: ui/titleScreen.ts builds .title-head/.title-menu/.title-motes/.title-life/.title-version for title.css; savedAgo() is pure (tested). Unused proof art still: btn_round, tabs, bar, sign, parchment panel, icons.

## Panel close X (ui, 19 Nov)
.panel-close (panels.ts add(), confirmBuy.ts) is an empty button; all looks in client/src/ui/close.css (loaded last): PixelLab icon_close_s as client/src/assets/ui/close_x.png, 31 px art at 1x (pixelated), 45x45 box, top/right -4 px, hover brightness, :active sinks 2 px + darker, :focus-visible 2 px butter ring. Older rules in ui.css/skin.css/lantern.css are overridden, not deleted. Other proof-set art (btn_round, pills, panels) is still unwired.

## TF-1..5 tavern flow slice 1 (19 Nov, coder)
- Files: shared/src/barSpots.ts (BarSpot, barSpots(items, room, npcGrid), freeBarSpots, barSpotFor, barServePoint, barTopPoint, barSpotIndex, chooseSpot) + guestsBar.ts (handOver, speedTip, grabAll, serveRoute) + tests; guests.ts stepTavern runs bar guests; tray.ts ordersStrip(t, pouringId?) chips have where + state 'pouring'; client/src/api/tavernApi.ts grabAll, serveAll (h.serveTour), carryHeld/handOver, errand stage 'handover' (apiShared TavernTask).
- Guest optional fields kind2 ('bar'), barSpot {barUid,c,r}; no SAVE bump (guests are runtime; a loaded bar guest with an open order stays, others are dropped by catchUpTavern). Mess for a bar spot: seatUid = the bar piece, seatIndex = barSpotIndex(cell) = 1000 + r*1000 + c; x,y = half a cell toward the bar.
- Bar guests only when TavernWorld.barGuests (default config BAR_GUESTS_ENABLED = false). With the flag off the rng stream and every old test are unchanged. Spots: one per customer-side front cell of the counter and each counter_ext, max BAR_SPOTS_MAX 8, only cells free + reachable in npcGrid.
- Bar guests order DRINKS only (plan open decision 5); patience BAR_PATIENCE_MS; speed tip BAR_SPEED_TIP_RATE if handed over within BAR_SPEED_TIP_MS of ordering; drink time BAR_DRINK_MIN/MAX_MS.
- serveStops: a bar guest's 'table' point is where they stand (a drink is handed over from the staff side: barServePoint), so serveGuest on a bar guest pours first, then carryHeld/handOver does the hand-over walk.

## ON-5 Account panel (19 Nov, coder)
- Flag: build with VITE_CLOUD_SAVE=1 and VITE_SERVER_URL=https://server.pocketbarrel.com (cloudConfig; default off, then no button and no panel exist). More grid gets Account (uiShell.ts accountButton, panel added in game/settingsPanels.ts).
- Sync rule (shared/src/saveConflict.ts planSync + newestSide + restampSave): localAt / remoteAt / lastSyncAt (device storage key pixel-hotel-cloud-lastsync, written by cloudSave.ts after every upload, download, resolve; cleared on log out). One side changed = upload or download; both changed or no shared past = 'conflict' (dialog, newest highlighted, Decide later changes nothing). Keep this device = the local save is re-stamped savedAt above the cloud one (the server refuses older uploads, server/ unchanged), uploaded, then imported locally so both match (page reloads). Use the cloud save = fetch + import.
- Login and register run a sync at once. Texts in ui/accountText.ts (banned: 'This account is banned. You can keep playing offline on this device.'). Tests: saveConflict.test.ts, cloudSave.test.ts (fake fetch), accountText.test.ts, e2e/account.spec.ts + account.config.ts (mocked server, port 4250, one browser).

## TF-6/7/9 bar guests drawn, strip, balance (19 Nov, coder)
- Render: guestViews Walker.barPose ('lean' while to_bar done/bar_wait/order, 'drink' in bar_drink; avatarSprite.setBarPose, only UP has art, other facings idle); the drinker's mug is a Meal on the bar top (barTopPoint); bar Mess uses the existing tableMess (the counter is a surface). render/barSpotMarkers.ts: faint foot markers, shown only while a guest is in phase to_bar or placer.active (tavernLife syncBarMarkers, 300 ms poll). 'served' event: a bar guest gets the reach gesture + the usual sparkle.
- Strip (ui/ordersStrip.ts + ordersStripLogic.ts): chip badge B/T (text placeholder, data-where), 'pouring' state (pouringId = pourFor.guestId), Grab all (2+ idle orders of one item) and Serve all (2+ ready), tray icon tap = bestGuestForTrayItem; CSS hooks in ordersStrip.css (artist may restyle).
- Balance TF-9: guestGoldPerHour(stage, prep, barShare) uses BAR_STAY_S (shorter stay = seats turn over faster, a ceiling) + speed tip; BAR_SHARE_ASSUMED 0.3; test in balance.test.ts; `npm run simulate [-- --bar-share=0.4]` prints it. Result: guest share of the best-kitchen mixed hour stays 78-80% (cap 85%); supply (mugs) is the limit so gold barely moves (+1 to 1.2%).
- Tests of table guests: tavernTest.ts tavernWorld sets barGuests false; LocalGameAPI.barGuests = false in tapsAPI/tavernAPI tests.

## Stove range art and outline fix (19 Nov, artist)
- stove: PixelLab 96x80 (art-src/pixellab/stove.png) fitted to 64x69; windows left x 12-23 / right x 36-48, y 44-56; strips rebuilt by tools/gen-pixellab-states.mjs (WIN/WY constants at the STOVE block). Run outline-fix BEFORE gen-pixellab-states (states copy the body).
- Outline rule for PixelLab furniture: ring-1 outline colour 3e2731, 1 px; tools/outline-fix.mjs <ids> (idempotent: a fixed sprite has no 181425 ring left), tools/outline-audit.mjs prints black % and 2 px %. New PixelLab pieces: run outline-fix after pixellab-fit. Proportions: table 64x48, chair 32x48, bench 64x33 judged believable vs the 54 px avatar (not changed).

## Stove 2 x 1 (19 Nov, coder)
- furniture.json stove w 64 d 32 (facings down only; standPoint dy 24 unchanged). Anchor x sits on the cell line: start spots shopStart.stove x = 160 (square_shop, l_shape, wide_hall), 96 (long), 128 (plus), all inside the annex; config TAVERN_START_ITEMS stove x 160.
- SAVE 41 widenStoves (shared/src/stoveWide.ts, test stoveWide.test.ts): a valid pose is kept; else old cell grows right (+16), else left (-16), preferring the annex when it stood there; else nearest free cell; else bag. cellarRooms.moveKitchenToAnnex uses the old 1-cell footprint for stoves.
- Prep tables (64 wide) beside the stove: left at stove.x - 64. prepTablesFor/edgeAdjacent unchanged (shared edge works for any width).
- Render: propAnimSpecs STOVE_FLAME_PNG [[17,53],[42,53]] (two oven windows, strip frameW 14), STOVE_SMOKE_PNG [48,1]; code fallback boxes widened x2 in furniture.json.

## DOORS redo (19 Nov, artist)
Owner: 'the cellar door is nice but the other doors are like the wallpaper'. tools/gen-door-art.mjs (deterministic, Endesga 32) now also writes door_tavern, door_suite, door_garden (96x64, anchor bottom centre = foot of the wall band) and door_spill_garden (64x14). Same stone arch + 2 px outline as the cellar door; the picture shows the DESTINATION (tavern: barrel, table, mug, hearth glow, mug sign; suite: bed, bedside lamp, moon window, star sign; garden: green daylight, path, vines, leaf sign). innDoors.ts doorSpriteId maps the six ids; doorSpill gives warm spill (green for the garden); the code-drawn looks stay as the fallback. shared innDoorHasSprite = all six ids. Checked on bare, brick, plaster, wood_panels, hedge (sheets in Desktop/PocketBarrel-styletest/doors). Only the cellar down door has an open picture.

## CAM-LOCK v2 (19 Nov, coder)
- shared/src/cameraFollow.ts: playCameraLocked(state) (locked unless dungeon, build, paint, placing or lookAround), freeAreaCamera, firstViewCamera (furniture mean in the free area, avatar kept on screen). client/src/game/cameraSetup.ts freeHeight() = top of .hotbar; startIntro uses firstViewCamera over usableWidth() x freeHeight(). pointerInput isCameraLocked = playCameraLocked; onWalkHold is false in Look around. gameLoop: lockWas/lookReturn ease back (CAMERA_FOLLOW_EASE_MS) when Look around ends; it ends on walking or a room change. uiShell: lookButton (data-more-label 'Look around', icon 'look') + late.setLookAround.
- Cellar walking bug (owner 19 Nov): not reproduced. client/src/api/cellarWalkAPI.test.ts: new game, level 2, build cellar, door in, tap-walk and every free cell reachable at cellar levels 1 to 3, and enterRoom by map. e2e/cellarwalk.spec.ts: real browser (desktop mouse), walks fine, also after a reload inside the cellar. tavernLife 'walk' event is now ignored when the avatar is not in the tavern.

## MODULAR BAR ART (19 Nov, artist; staged, NOT wired: art-src/staging/bar/, no furniture.json ids yet)
Source: one PixelLab 96x48 straight bar run (art-src/pixellab/bar/straight_src.png, style anchor = counter.png; corner_src.png was tested and not used: AI diagonal view cannot tile). tools/gen-bar-art.mjs builds every piece from its pixels (no scaling; centre cell made mirror-symmetric so the straight tile repeats endlessly; Endesga snap); tools/bar-sheet.mjs makes the contact sheet (Desktop PocketBarrel-styletest/bar). All pieces 32 px wide, ANCHOR = bottom centre of the 32x32 cell, outline 402931, bar top = 25 px above the floor line (like counter, surface about 28).
- HORIZONTAL run (front faces down), 32x39: bar_straight (tiles), bar_end_left, bar_end_right (cap + foot), bar_straight_up (staff back: plain planks, no brass/feet).
- VERTICAL run, 32x58: bar_straight_right (middle cell; right side with brass rail visible; left = mirror), bar_end_up (north cap, row 0 outline), bar_end_down (south end: top rim + front panel at rows 32..57). The top plate is rows 0..31 and sits 25 px ABOVE the cell's floor: bottom 26 rows of a middle cell are transparent on purpose (the cell below draws its plate there). Sprite bottom = cell bottom, so draw as usual by y.
- CORNERS 32x58, named by the two cells they connect to: bar_corner_se (arms east+south), bar_corner_sw (west+south), bar_corner_ne (east+north), bar_corner_nw (west+north). Only these 4 are needed (a corner has one horizontal and one vertical neighbour). Left-facing pieces: mirror _right only for bar_straight_right; corners/ends are drawn in all orientations (no mirror, light stays top-left).
- Autotile rule for the coder: horizontal neighbours only -> straight (end_left/right when one side free); vertical only -> straight_right (end_up/end_down at the ends); one H + one V -> the matching corner; T and crosses: use the corner/straight of the main run (not drawn). An isolated cell: bar_end_left or the existing counter art. Register/tap_stand sit on the top at SPRITE_SURFACE_HEIGHT 28 for horizontal pieces (checked on the sheet).
- KNOWN: the vertical top plate is 21 px wide while the horizontal top face is 13 rows (foreshortened), so a corner looks like a chunky bend; 1 px notch at the se corner join; no T pieces; feet repeat once per cell (not per 3 cells).
