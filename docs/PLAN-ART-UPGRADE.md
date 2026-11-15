# PLAN-ART-UPGRADE: better models and icons (lead, 15 Nov)

Builds on docs/PLAN-SPRITES.md (loader, naming, Aseprite workflow; all six decisions D1 to D6 are YES) and docs/ART-STYLE.md.
Goal: replace the code-drawn look with real pixel art in the order the player SEES it most, a few sprites per round, never breaking
the game (the code art stays as the fallback for anything without a PNG). No rule in shared/ changes in this plan, except where a NEW
item needs data (section 4). Scale of the job today: furniture 50 base + 12 carpentry + 6 tavern2; materials 35, blocks 10, crops 5
(+ seeds, derived), food 8, drinks 4 (+ aged/vintage later), fish 18, clothing 28, gear and forge pieces, styles 15 (floors and walls).

## 0. One loader, several kinds (small decision, lead)
PLAN-SPRITES builds spriteStore for furniture. Round 1 generalises it ONCE to kinds, same rules (name = id, no trim, fallback):
- furniture: assets/sprites/furniture/<id>[_up|_right].png (anchor bottom centre, size by formula)
- icons: assets/sprites/icons/<id>.png, 32 x 32. Keep the 1 px outer ring transparent (the game composites the rank frame on top as
  today; a test already demands a free ring for code icons: same test for PNGs).
- blocks: assets/sprites/blocks/<id>.png, 32 x 32 (ONE picture is both the tile placed in the room and the item icon, Growtopia-style;
  crack stages stay code-drawn on top).
- floors: assets/sprites/floors/<styleId>.png 64 x 64, seamless (wrap test: left edge vs right edge is not required, the artist checks it by tiling in Aseprite).
- walls: assets/sprites/walls/<styleId>.png 64 x 64, repeats sideways (the band is 64 tall).
- plants: assets/sprites/plants/<cropOrSeedId>_<1|2|3>.png, 32 x 32 or 32 x 48, anchor bottom centre (three growth stages).
Data hook: NONE in the JSON. The id is the key. `icon { shape, colors }` stays in every data file as the fallback and for the tests
(icons.test.ts, balance, Book). Code hook for icons: client/src/ui/itemIcon.ts already has one function per item kind that receives the
ID (materialIconUrl, furnitureIconUrl, clothingIconUrl, gearIconUrl, gainIconUrl ...); each first asks spriteFor('icons', id) and only
then calls drawIcon(icon). iconTexture/iconDataUrl take an Icon without an id, so the same hook is added by the callers that know the id
(popups, Book, hotbar, pack cards): the coder lists them in round 1 (grep for iconTexture and iconDataUrl). Seeds (`<id>_seed`) and splice
seeds stay code-generated in their parent's colours until their own PNG exists; the same rule serves aged/vintage tiers (a code band over the base PNG).
More than about 60 PNGs in one kind: export ONE packed sheet + JSON atlas per kind instead (Aseprite sprite sheet), the spriteStore API does not change.

## 1. Icons (priority order = what is on screen most)
1. Hotbar and bag basics: the 10 blocks (also the world tiles), then tools and gear (pickaxes 2, axes 2, rods 3, swords 4, armor 3,
   health potion, key, gems).
2. Crops 5 (turnip, potato, carrot, pumpkin, glowcap) and their growth stages (section 2), then drinks 4 and food 8 (what guests order,
   the menu panel, the lunch box).
3. Ore 3 + bars 3, wood, cloth, bone, crystal, then the other materials by how often they drop (slime, bat, skeleton, mimic, king drops).
4. Fish 12 + fished-up things 6.
5. Clothing 28 (hats first once 9g adds them).
6. Furniture inventory icons: LOWEST. They stay code icons until the piece itself has a sprite; then a 32 x 32 icon is drawn only for
   catalog and hotbar pieces (about 40). Never auto-shrink a world sprite (nearest downscale looks broken).
Seeds, packs, splice seeds, the Book silhouettes: derived by code from the parent icon (the Book's grey silhouette is made from the PNG
alpha automatically; check it in round 2).

## 2. Models: world sprites in priority order
A. Tavern (already planned): register (proof), tap_stand, prep_table, pantry, sink, serving_hatch, then the counter (drops its baked till).
B. Tavern core that every guest and every screenshot shows: round_table, long_table, bar stool, stove, brewing_barrel, keg_rack, mug_shelf and
   menu_board (wall items: facing down only), the starting chairs/stools.
C. Floors and walls (biggest area on screen): floors bare, wood_planks, stone_tiles, red_carpet, soil, then crypt_flagstones and lake_pebbles;
   walls bare, plaster, wood_panels, brick, then bone_wall and reed_wall. RECOMMENDED right after blocks, before the hotel furniture:
   one floor and wall change every screenshot.
D. Farm look: plants stage 1 to 3 for the 5 crops (15 sprites), then trees (8 on the lakeside), the lake and pier later.
E. Hotel starter set (bed, sofa, chair, bookshelf, lamp, plant, rug, desk and the rest of the first 12 types in furniture.json).
F. Carpentry 12 (after CP-1; match the block colours so they read as made of that block).
G. Dungeon and lake furniture (crypt 5, lake 8), chests, then the 9h theme sets when they exist.
Not in this plan: UI skin and frames, animation frames (flicker and pour stay code effects), the dungeon enemies and rocks (phase 4.5), the avatar (section 3).

## 3. Avatar (conflict, decision for the user: U1)
CLAUDE.md section 8: "the box avatar is the approved base: do not change its shape". BRIEF section 8 adds that future avatar art (sprites, walk
and sit frames) KEEPS these proportions: canvas 32 x 64, feet bottom centre, down/up/right drawn and left mirrored, layers body, shoes, legs,
torso, hair, hat, held item, each recolourable by palette index swap, clothing as data. So a pixel avatar is allowed if it keeps proportions,
canvas, anchor and layers; what changes is the box LOOK. It is the largest and riskiest art job: recolouring needs ramp-based PNG layers (3 to 4
shades per layer remapped at load by a coder), 4 walk frames x 3 facings, sit and lie poses, 12 hats, 4 hair, 3 tops, 3 bottoms, shoes.
RECOMMENDATION: yes, but LAST. (1) finish sections 1 and 2 first; (2) then a feasibility prototype only: body + one hair + one top, down facing,
with the recolour remap, shown to the user next to the box avatar; (3) go on only if the user likes it. Until then the box avatar stays untouched.

## 4. New things (proposal; each is data + art, no new rule unless marked)
Sizes in cells (w x d). Source: C catalog, W carpentry recipe (M-A style, blocks), S splice result, D dungeon craft, Q quest/Book reward.
Appeal values stay on the existing scale and small, because decor feeds tavern appeal and the S3 gold tables (balance test after each batch).
TAVERN (data only):
- barrel_table 1x1 surface, common, C: a cheap high table from a barrel.
- hanging_lantern wall, light, common, C. tankard_rack wall, common, C. antler_mount wall, rare, D (mood: antlers).
- dartboard wall, rare, C: decor only. spice_bundle wall, common, W/S (herbs).
- cask_display 2x1 decor, rare, Q (Book reward / first vintage): a showpiece; the real casks are K2's keg rack.
- notice_board wall 2 cells, common, C: decor now; shows the quests when 9i-2 lands (NEEDS 9i).
SUITE (decor, except noted):
- window_curtains wall 2 cells, common, C (big atmosphere, may carry a daylight light patch: data only).
- four_poster_bed 2x3, ultra_rare, W (planks + cloth + thatch): a lie seat like the bed.
- writing_desk 2x1 surface, rare, C. potted_flowers 1x1 onSurface, common, harvest or S.
- hat_stand 1x1 and trophy_shelf 2x1: these ARE the M-E showcase pieces (NEEDS ME); build them there, draw them with that step.
GARDEN:
- scarecrow 1x1 tall, rare, W (thatch + planks). stone_birdbath 2x2 decor, rare, W (stone). lantern_string wall/fence decor, common, W.
- flower family: tulip, sunflower, lavender as new plants/blocks (common and rare, seeds, S/C): one color each, they count for garden beauty
  (M-C, NEEDS M-C to matter). New crops for cooking (berries, onions) wait for roadmap 5.3 (Farm 2).
Rule: nothing in this list may land before the step it names; the "data only" pieces can be added in any coder lane slot (one batch of about 5 per coder round, art right after).

## 5. Rounds of about 5 assets, coder and artist alternate
Pattern: the coder prepares the hook for kind K in round N; the artist draws kind K in round N+1 (it can draw earlier, only the in-game check needs the hook).
R1 coder: generalise spriteStore to kinds + the icon hook in itemIcon.ts and the id-aware callers + tests. Artist: tavern five (tap_stand, prep_table, pantry, sink, serving_hatch) + ramps sheet (below).
R2 coder: block tile hook (the room draws blocks from blocks/<id>.png, cracks stay code). Artist: blocks dirt, planks, stone, glass, clay. STYLE LOCK: user signs off the first block, the register and one icon.
R3 coder: floor and wall hook. Artist: blocks thatch, lantern, brick, mossy stone, cinder.
R4 coder: plant stage hook. Artist: floors bare, wood_planks, stone_tiles, red_carpet, soil.
R5 coder: new tavern decor batch 1 data (barrel_table, hanging_lantern, tankard_rack, dartboard, antler_mount) with fallback boxes. Artist: walls bare, plaster, wood_panels, brick + counter.
R6 coder: free slot for the feature queue (T1c, K2). Artist: crop icons (5).
R7 artist: drinks 4 + roasted turnip. R8 artist: tools 5. R9+ artist: tavern core B in groups of 5, plants D, hotel starter E, carpentry F (after CP-1), icons 3 to 5.
Feature work (PLAN-1B batches) keeps its order: one art round after each feature round, never two at the same time on the same files
(artist: assets/sprites, art-src, render/, ui.css; coder: shared, api, game, itemIcon.ts and hooks).
RAMPS SHEET (small decision, lead): art-src/aseprite/ramps.aseprite holds one 4-shade hue-shifted ramp per material (wood, dark wood, stone, brass, cloth red,
cloth green, leaf, glass, clay, thatch, metal, glow) from the Endesga 32 colours; every piece uses these ramps so the set stays consistent.

## 6. Quality gate per sprite (all must pass, else redo twice, then the code art stays)
1. Brief: id, kind, size per the formula, facings listed, ramps used, light top-left, 1 px dark warm outline, no anti-aliasing.
2. `look` preview at 1x and at 3x, and `look` ascii on the outline and the anchor row.
3. `validate` (palette = Endesga 32 only, alpha only 0 or 255, size).
4. Review with the plugin's review skill and its pixel-critic agent if installed; fix what it finds.
5. Export (no trim) and the vitest spriteAssets test (id, facing, size; icons: free ring).
6. In-game check at zoom 3 and zoom 1 (npm run dev): readable at game size, same depth order, no 1 px jump against neighbours, consistent
   next to the code-drawn pieces still around it, the Book silhouette and the rank frame look right (icons).
7. Round check by the lead: a contact sheet of the 5 sprites (tools/art-sheet.ts) before the round is accepted; the user signs the style lock in R2 only.

## 7. Decisions
SMALL (the lead decides, done above): file names and folders; icon 32 x 32 with a free ring and the game-drawn rank frame; blocks one picture for tile
and icon; furniture inventory icons separate and last; seeds and tiers derived by code; packed sheets after about 60 files per kind; rounds of 5;
the quality gate; the ramps sheet.
THE USER'S (recommendation in brackets):
- U1 Avatar: allow a pixel avatar with the SAME proportions, canvas and layers, as the last art step with a prototype first. (Yes, last, prototype first.)
- U2 Order: blocks, floors and walls before the hotel furniture, tavern core before carpentry. (Yes.)
- U3 New things: approve the list in section 4 as a backlog, built only in the step it names or as "data only" decor. (Yes; strike anything you dislike.)
- U4 Pace: one art round after every feature round, with the style lock after R2. (Yes.)
- U5 Name check: flower names and the new items stay original (no copying of another game's lists). (Yes.)
