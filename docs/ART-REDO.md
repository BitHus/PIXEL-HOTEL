# ART-REDO: audit and rounds for redoing furniture models and icons (artist, 16 Nov)

Owner: the current models and items look ugly and must be redone. Sources: docs/ART-STYLE.md, docs/PLAN-ART-UPGRADE.md (section 6 quality gate),
art-src/RAMPS.md, docs/QUEUE.md A11 and A12. Sprite sizes: width = footprint width of that facing, height = footprint depth + piece height (+ at most 8 px overhang),
anchor bottom centre, never trimmed (client/src/render/spriteAssets.test.ts checks it).

## Rules for every round (set by the owner, 16 Nov)
1. MODEL: cozy medieval look, Endesga 32 through the ramps of art-src/RAMPS.md, 1 px dark warm outline, light top-left, top AND front visible, no anti-aliasing,
   chunky silhouette first, a few small props (rivets, planks, hoops) for life. Facings exactly as the type's `facings` list (left is never drawn).
2. ICON (new rule): for EVERY furniture piece redrawn also redraw its inventory icon, 32x32, `client/src/assets/sprites/icons/<id>.png`, free 1 px outer ring.
   The icon is a clear MINIATURE of the model: same silhouette idea, same ramps and colours, same key details, drawn for 32 px (never an auto-shrink).
   Same quality gate (validate, pixel-critic, in-game check).
3. Gate per sprite: brief, look at 1x and 3x, validate (Endesga only, alpha 0/255, size), pixel-critic, export without trim, vitest spriteAssets green.
4. Artist touches only art-src/, client/src/assets/sprites, render art files and docs/ART-REDO.md. Not shared/, api/, game/, avatar files.

## Audit: 70 furniture ids (shared/data/furniture.json + furniture/*.json)
Legend: SPRITE = a complete PNG set exists; CODE = still drawn from boxes in code. Icons: every id has a code icon only (the first icon PNGs come with this plan).
Existing PNGs are 18 files for 8 ids; the owner calls the current look ugly, so those are re-checked after their round.

SPRITE (8): counter, register, tap_stand, prep_table, pantry, sink, serving_hatch, keg_rack.
CODE (62): chair, sofa, table, lamp, rug, plant, bookshelf, barrel, crate, bench, desk, bed, stall_table, shelf, display_case, sign, banner, shop_rug,
bone_chair, skull_lamp, coffin_table, wall_torch, bone_throne, slime_jar, bat_wing_fan, skull_trophy, mimic_chest, kings_banner, fish_tank, mounted_fish,
fishing_net, shell_lamp, driftwood_bench, anchor, pearl_chandelier, sunken_throne, bar_stool, round_table, long_table, mug_shelf, menu_board, brewing_barrel,
stove, vine_bench, gilded_chair, honey_table, ember_lamp, heartwood_throne, plank_stool, plank_bench, plank_table, stone_fireplace, glass_lamp, brick_oven,
thatch_rug, clay_jug, stone_planter, lantern_post, glass_cabinet, brick_pillar.

## Ugliest and most visible (ranking)
Visibility = on screen in the start game and every screenshot; ugliness = flat boxes with no top/front read.
1. counter (the bar; seen always; first sprite is a flat plank slab, redo), 2. bar_stool, 3. round_table, 4. stove, 5. brewing_barrel (all new-game tavern, code boxes),
6. tap_stand and register (on the bar, small sprites, redo with the new bar), 7. chair, 8. table, 9. long_table, 10. bed (hotel start, 64x96 huge box),
11. plant, 12. lamp, 13. bookshelf, 14. sofa, 15. rug, 16. desk, 17. bench, 18. barrel, crate, 19. mug_shelf, menu_board (wall, tavern), 20. stall_table, shelf, display_case, shop_rug,
then carpentry (12), dungeon/bone (crypt set), lake set, suite/garden (rare tiers, lowest).

## Rounds (about 5 assets each; each asset = model facings + its 32x32 icon)
- R1 (A11, tavern core): counter, bar_stool, round_table, stove, brewing_barrel.
- R2: tap_stand, register (redo to match the new counter), mug_shelf, menu_board, long_table.
- R3 (A12 hotel start): chair, table, bed, plant, lamp.
- R4: bookshelf, sofa, desk, bench, rug.
- R5: barrel, crate, stall_table, shelf, display_case.
- R6: prep_table, pantry, sink, serving_hatch, keg_rack (redo of the K1 kitchen set to match R1 ramps).
- R7+: carpentry (after the block colours are final), crypt, lake, suite and garden pieces, in groups of 5.

## Round log
- R1 (16 Nov, drawn): counter (down, up, right; 96x64 / 32x128, top 32 rows + front 32 rows, surface height 32 as before), bar_stool (32x56, all facings are the same
  picture: round red cushion, seat height about 24), round_table (64x84, top at height 26), stove (32x76, brick body, iron top, chimney, pot, fire), brewing_barrel (32x68, iron hoops, brass spigot),
  plus 5 icons (icons/counter, bar_stool, round_table, stove, brewing_barrel .png). Sources: art-src/aseprite/<id>.aseprite, icons_tavern_core.aseprite (5 frames).
  FOR THE CODER: code art gives round_table a surface height of 18 (surfaceHeight in render/furnitureArt.ts reads the code boxes), the sprite's top is at 26;
  bar_stool code seat is 15 high, the sprite seat is about 24. Raise those art boxes (or add a sprite override) so mugs and seated avatars line up.
