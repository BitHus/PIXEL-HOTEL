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
- Shop life (step 9d)
- Fix list after 9d (nav, natural customers, staff only, chests)
- Dungeon logic (step 8)
- The dungeon in the game (step 9)
- Farm and cooking (step 9b)
- Mine and forge (step 9c)
- Ranks and the Book (step 9e)
- Lakeside: woodcutting and fishing (step 9f)
- Atmosphere: light, shadows, backdrop, dust, sound

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
- server/src/index.ts: placeholder only (step 10).

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
- SAVE_VERSION is 12: MIGRATIONS[11] (step 9f) adds a level 1 lakeside room (the next free room id)
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
  - client/src/render/backdrop.ts (Backdrop): indoors calm dark planks (low contrast), outdoors
    (setOutdoor(true), the farm: main.ts calls it after every atmosphere.setRoom) darker grass
    with code-drawn tree crowns and bushes on a seamless 256 px tile; it moves with the camera,
    plus a stepped vignette (lighter outdoors), baked into ONE opaque screen picture that is redrawn only when the camera moves. Under
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
