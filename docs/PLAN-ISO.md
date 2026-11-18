# PLAN-ISO: PocketBarrel goes isometric (owner decision 18 Nov)
Goal: a Habbo-Hotel-like isometric look, original art only. Test PixelLab (owner buys Tier 1) for art. main keeps shipping; the work happens on branch iso/. Written by the planner agent, not yet signed by the owner.
Owner's stack suggestion (Phaser, Colyseus, Postgres, Redis, R2) is NOT adopted: PixiJS handles iso, ws + SQLite is enough for PLAN-ONLINE, and a rewrite would throw away 100+ tested shared modules. Revisit only at thousands of concurrent players.

## 1. Reusable vs must change
KEY IDEA: shared/ keeps FLAT logical coordinates (x, y px, cell 32, y down). Iso is ONLY a projection in the view layer, so rules, nav, saves and GameAPI need no change.
REUSABLE (about 90% of shared/): economy, tavern, brewing, cooking, farm, quests, splice, ledger, save, api.ts; nav.ts, npcNav.ts, navHeights.ts (A* on cells is identical in iso); placing, seats, tableSpots, blocks, bar, kitchen, hold, tapPick, pour, tray; room.ts + roomShapes.json. The dungeon keeps its own top-down view (see decisions).
MUST CHANGE:
- Projection/camera: shared/src/view.ts (+test), cameraFollow.ts, config/world.ts; client input/cameraControl.ts, cameraIntro.ts, game/cameraSetup.ts, followCam.ts, pointerInput.ts, blockInput.ts, placing.ts, roomFlow.ts, tapForgive.ts, hintChip.ts, guideWorld.ts, tavernLife.ts, uiShell.ts (every screenToWorld/worldToScreen caller).
- Depth: render/depthOrder.ts (+test), depthLayer.ts.
- Rendering: roomView, bareStyles, styleArt, cellGrid, backdrop, innDoors, furnitureSprite, furnitureArt, seating, lieArt, avatarCompose/Bake/Sprite/Parts, guestViews, itemViews, blockViews, pourFx, tavernFx, propAnim, catView, cursorCross, atmosphere, fx.
- Walls and doors: shared/src/room.ts wall edges, door goes into a back wall; innDoors.json/ts, innDoorClear, doorGoal.
- Facing: types.ts Facing 4 -> 8 values; avatar.ts, avatarRig(.json), furniture JSON art/footprint metadata, seat offsets.
- Art: all of client/src/assets/sprites, art-src, tools/avatar-*. Everything is redrawn: the real cost.
- Saves: probably no bump (items keep x, y, facing); only a facing migration if 8 facings get stored.
- UI is HTML/CSS and stays.

## 2. Iso math
- Tile 64x32 screen px (2:1). One cell = 32 world units = one diamond. BUILD_CELL, NAV_CELL, speed unchanged.
- sx = x - y, sy = (x + y) / 2 minus z (height). Inverse for z=0: x = sy + sx/2, y = sy - sx/2. Only view.ts knows the projection. Tests: roundtrip, cell centre = diamond centre, camera snap to whole device px, zoom anchor. fitZoom/centerCamera use the projected room bounding box.
- Taps on tall items hit by footprint cell first (tapPick), then sprite alpha.
- Depth key = (x + y) of the front corner, tie x then uid; multi-cell items footprint-aware (a behind b if a.maxX < b.minX or a.maxY < b.minY); avatar uses continuous feet x + y; keep the onSurface / seated sub-keys.
- Walls: two back walls (north and west edges), 96 px high (3 cells), two shades, corner post for inner corners of L/plus. South/east edges: thin 8 px floor lip. Wall items hang free along the wall (needs a wall-axis flag).
- Door: 2-cell opening in a back wall; 2x2 door zone stays free; door side becomes room data; spawn next to it.
- Build grid drawn as diamonds; place preview = diamond footprint.
- Camera: CAM-LOCK, no edge clamp while walking, free look clamps to the iso bounds, zoom 0.5..4 and the dpr settle stay; the intro target (nearest 3 device px per art px) needs a re-check because tiles are 64 px wide.
- Pixel-perfect: sprites at whole screen px, no rotation.

## 3. Avatar and furniture
- 8 directions: S, SE, E, NE, N drawn; SW, W, NW mirrored. Canvas 48x80, feet bottom centre, cosy three-head figure about 56-64 px tall (owner look check). Layers and ramp recolour stay; head layers per direction with per-frame offsets (avatarRig.json, 8 entries). Walk: 6 frames, small bob (answers the janky-walk feedback); stand 1; sit 1 per diagonal; lie 1. Code outline stays; box avatar stays as fallback.
- Facing comes from the iso screen vector (8 directions).
- Furniture: footprint w, d in cells (exists), NEW h in px and per-facing sprite offset; 4 grid facings, mirror only for symmetric items; surface items get a surface height. Sprite width (w+d)*32, height (w+d)*16 + h; pivot = centre of the front-bottom footprint edge.

## 4. Art pipeline and PixelLab test pack
Style lock first: Endesga 32 (tools/check-palette.mjs is the gate), light top-left, 1 px dark warm outline, medieval cosy tavern. Never feed Habbo screenshots; use our own mood board.
TEST PACK (Tier 1, one afternoon): (1) avatar 8 directions 48x80 + 4-frame walk in 2 directions, (2) sofa 2x1, (3) chair 1x1 4 facings, (4) tall potted plant, (5) floor tile 64x32 wood, (6) wall segment 64x96 two faces.
PASS: exact size and 2:1 match, tiles tessellate in a 10x10 test room; palette snap changes under 5% of pixels, check-palette passes; consistent light and outline side by side; avatar directions read as one character (proportions within 2 px, feet within 1 px, no flicker); under 15 min cleanup per item; owner finds it original.
RISK: AI gives flat full characters, not our layered recolour rig. Use PixelLab for furniture, tiles, walls, plants, props and a base body; clothes as separate hand-cleaned layers or full outfit sprites at first. Decide after the test.
FALLBACK / MIX: Aseprite plugin (tiles and walls by hand, furniture as textured iso boxes, avatar hand-drawn 5-direction rig); AI draft + Aseprite cleanup + palette snap is the likely end state.

## 5. Stages (branch iso/; main keeps shipping fixes; merge only after S3 is signed)
- S0 (1-2 days): this plan signed, PixelLab test pack, go/no-go on art.
- S1 (~1 week): view.ts iso math + tests; one rectangle hotel room (floor diamonds, 2 walls, door); box avatar walking in 8 directions; depth sorting; 6 furniture pieces as iso boxes then test-pack art; camera lock + zoom. Success: walk and place furniture, depth right among 20 items.
- S2: build mode, wall items, sit/lie, surface items, all room shapes and corner walls, door cases.
- S3: tavern (bar, taps, pour, guests, kitchen annex), farm, lakeside, cellar; avatar layers and clothes; UI position fixes; save check.
- S4: full art pass (about 30 furniture first), dungeon decision, polish, merge.
RISKS: all art redone; depth of multi-cell and tall items; tap precision on diamonds on phone; pour/tap-stand press logic assumes flat geometry; wall items and doors on L/plus corners; camera bounds and intro zoom; phone performance with bigger sprites; main diverging (keep rendering out of shared, rebase often); tests asserting pixel coordinates (view, depthOrder, innDoors).

## 6. CLAUDE.md / BRIEF.md wording to change (LIST ONLY; not edited yet)
CLAUDE sec 1 (top-down Travellers Rest -> isometric Habbo-like, keep "never copy"); sec 4 (no isometric math, screenToWorld, camera lock, intro zoom, build grid as diamonds); sec 5 (walls, door under a bottom edge, kitchen annex "below its bottom edge"); sec 6 (facing = 8 directions); sec 7 (draw order key, wall items, anchor/pivot, rotation, placeholder boxes); sec 8 (avatar canvas, directions, walk frames, head layers); sec 2 (PixelLab allowed as an art tool, cleaned in Aseprite) and sec 12 art line. BRIEF.md matching sections 4-8, ART-STYLE.md, PLAN-ANIMATION.md, avatar-proportions.

## 7. Owner decisions (SETTLED 18 Nov)
1. EVERYTHING isometric, dungeon, mine, farm and lakeside too (order: hotel + tavern first, the rest after the first merge).
2. Door in the WEST (left) back wall like Habbo; no room rotation.
3. Avatar = separate layers (body, hair, clothes, shoes, hats), recoloured by ramps; this is how Habbo builds its figures (parts per direction and action, palette tinted). PixelLab/Aseprite make the parts once, 8 directions share 5 drawn views.
4. Top-down work is PAUSED on main (fixes only, owner OK).
5. PixelLab budget 2000 credits: spend as little as possible. Test pack first (about 6 items), then only what we need; reuse by recolouring and mirroring, Aseprite for cleanup; first library about 30 furniture.

## 8. Owner feedback independent of the switch (do on main now)
Tutorial step 2 shows no text and an ugly circle -> small soft aura, check the whole tutorial; pour/tap button much bigger on phone (moving cancels the timing); open/closed sign explained in the tutorial; portrait/landscape menu inconsistencies (keep what is good); walking animation subtler (frame timing and bob only); quest-done button highlight too much; haybale catalog icon is a chest; dungeon barrel and gate look weird, skip gates that do not work from all sides; seed splicing: owner leaves the choice to us (recommended: seeds plus a few block recipes, keep the loop simple).
