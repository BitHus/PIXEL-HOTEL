# ART WORKFLOW: from a PNG to a finished sprite (artist, coder tools)

Rules for drawing: docs/PIXEL-ART-GUIDE.md and docs/ART-STYLE.md. This file is the loop around them.

## A sprite is finished only after all three
1. PALETTE CHECK: `node tools/check-palette.mjs <png files>` must say `bad 0` (Endesga 32, no semi-alpha).
2. VIEWER SCREENSHOT LOOKED AT: run the viewer (below), open the PNG with Read and judge it in context
   (floor colour, neighbours, avatar scale, shadow, light from the top-left). A sprite that is fine alone can fail here.
3. PIXEL-CRITIC PASS: run the `aseprite:pixel-critic` agent on the sprite (and the viewer PNG) and write its SCORE in
   your report. Fix what it names, re-run 1 and 2. No score in the report = not finished.

## The viewer: tools/view-sprite.mjs
It builds a private copy of the client (tools/out/dist-view, own dist, never your dev server or `dist`), plays a throw-away
new game in headless Chromium and crops around the sprite in the REAL renderer. Output: art px scaled up with nearest neighbour.
```
node tools/view-sprite.mjs furniture <typeId> [--facing right|up] [--zoom 3] [--out file.png]   # in the tavern
node tools/view-sprite.mjs dungeon <propKind> --dungeon-seed 5 [--size 160x128] [--zoom 3]      # a floor with that prop
node tools/view-sprite.mjs prop <propKind>                                                      # scans seeds 1..40 for it
```
- Default output: tools/out/view-<kind>-<id>.png (gitignored). `--size WxH` = crop in art px. `--rebuild` forces a rebuild.
- It rebuilds when a source file is newer (about 30 s); the first run after a PNG change always rebuilds.
- Furniture goes on the first free floor cell near the tavern middle. Surface pieces (register, taps, mugs) and wall pieces
  need a host and are refused: look at them in the game by hand. Dungeon props: the avatar stands 3 blocks away.
- Exit code 2 = the seed or prop was not found (it prints the kinds that exist), 3 = the build failed (someone is mid-edit).
- If the build fails because of another worker's edit, retry in a minute; do not fix their files.

## Wiring a sprite (no code change needed for furniture)
- Furniture: `client/src/assets/sprites/furniture/<typeId>.png`, facings `<typeId>_right.png` and `<typeId>_up.png`
  (left is the right mirrored). Size = footprint in cells * 32 wide, as tall as the art needs; anchor = BOTTOM CENTRE of the footprint.
- Dungeon props: `client/src/assets/sprites/dungeon/<id>.png`, then one line in `PROP_SPRITE` in client/src/dungeon/propArt.ts
  (`kind: 'id'`). The PNG has NO shadow: add the kind to `SPRITE_SHADOW` (oval width in px) if it should stand on the floor.
  Flames are code on top: `PROP_FLAMES` ([x, base y, size] in PNG px). Typical size 32x32 (tall pieces 32x48, gates 64x64);
  anchor bottom centre. Cool, dark crypt colours (docs/ART-STYLE.md).
- Avatar, icons, floors, walls, plants: their own folders under client/src/assets/sprites; see PLAN-SPRITES.md.

## Approved reference sprites (copy their outline, lighting and ramps)
Furniture (client/src/assets/sprites/furniture):
- `bookshelf.png`, `bed.png`, `sofa.png` (big multi-cell pieces, top plane plus front, clean shading)
- `brewing_barrel.png`, `stove.png`, `prep_table.png`, `register.png` (small machines, readable details at 32 px)
- `round_table.png`, `counter.png`, `plant.png`, `rug.png` (warm wood and fabric ramps)
Dungeon (client/src/assets/sprites/dungeon):
- `fountain.png`, `library_shelf.png`, `dungeon_gate.png`, `vault_door.png` (large pieces, cool stone ramps)
- `sarcophagus.png`, `statue.png`, `brazier_big.png`, `candle_stand.png` (upright, dark outline, one warm accent)
Not yet good references: the rock_* PNGs (blobby, not wired), the 32x32 floor-decal piles (bones, rubble, root).
