# PLAN-SPRITES: real pixel art from Aseprite next to the art drawn in code (lead, 15 Nov)

Style rules: docs/ART-STYLE.md (Endesga 32, 1 px dark warm outline, light top-left, no anti-aliasing, top + front view).
DELIBERATE CHANGE (the user asked for it): CLAUDE.md section 12 says "Art is drawn in code from boxes until step 6" and section 14
says "Do not generate art with any tool unless I ask". From now on sprites made in Aseprite are allowed piece by piece, ahead of
step 6. The code-drawn art stays valid and is the fallback. The lead updates CLAUDE.md sections 12 and 14 and ROADMAP phase 4
(art becomes incremental) only after the user says yes (decision D1). No rule in shared/ changes.

## 1. How a PNG gets into the game

FOLDERS (Vite bundles files under client/src; base './' stays, so never absolute paths)
- Exports (shipped): client/src/assets/sprites/furniture/
- Sources (not shipped, kept in the repo): art-src/aseprite/<id>.aseprite (outside client/ and shared/).

NAMING (one file per facing, the filename is the whole contract)
- `<furnitureId>.png` = facing down. `<furnitureId>_up.png`, `<furnitureId>_right.png`. Left is never drawn: it is right mirrored
  (as today, FurnitureSprite scale.x = -1). Ids are the ids in shared/data/furniture*.json, lower case, underscores.
- Later, separate folder and same rule for item icons: sprites/icons/<id>.png (32x32). Not in this plan's first slice.

SIZE AND ANCHOR (convention, no sidecar file)
- The image's bottom-centre pixel line is the anchor, the same point as the item's (x, y): the bottom centre of the footprint.
  So NEVER trim or crop on export. Image width = footprint width in px for that facing (down/up: w; right: d, as rotation swaps
  them; always whole 32 px cells). Image height = footprint depth for that facing + the height of the piece (type.height), plus
  at most 8 px extra for overhang. Anything drawn must sit inside the image; outline included.
- Surface items (register, mugs) use the same rule; the lift onto the surface is added by the game as today (container position).

LOADER (coder; pure naming rules in shared-free client code, no change to shared/)
- client/src/render/spriteIndex.ts (pure): parseSpriteName(file) -> { id, facing } | null; spriteComplete(type, files) -> true only
  when every facing in type.facings (except left) has a file. A piece is "sprite-ready" only when complete, otherwise the WHOLE piece
  keeps its code art (no half and half looks when rotated).
- client/src/render/spriteStore.ts: `import.meta.glob('../assets/sprites/furniture/*.png', { eager: true, query: '?url', import: 'default' })`,
  `loadSprites(): Promise<void>` loads each url with PixiJS Assets, sets texture.source.scaleMode = 'nearest' (main.ts already sets the
  default), keeps a Map id -> facing -> Texture. A file that fails to load is skipped and logged once; the game never stops.
  `spriteFor(typeId, facing): Texture | null` (facing 'left' asks for 'right').
- Boot: game/core.ts awaits loadSprites() before the first room opens (the same place that boots the Pixi app), so the first frame
  already has them. With zero PNGs it resolves at once.
- client/src/render/furnitureSprite.ts (artist owns render/, coder makes THIS one small hook, then hands it over): in set(), if
  spriteFor(type.id, facing) returns a texture, add a Sprite (anchor 0.5, 1, position 0,0, mirrored for left) instead of
  drawFurniture(...); else the old path. Swim fish, lights, shadows, depth order, hit testing keep working because they use the type
  data and the container (check: the hit area of a Sprite child must still resolve to the item uid in itemViews.uidOf).
- Data stays: `art`, `icon`, `light` remain required in the JSON (fallback, type.height, lights, icons). A sprite never changes
  collision, footprint, appeal or any rule.
- Not in scope: avatar (box avatar approved), floors and walls, blocks, dungeon art, animation frames, icons.

TESTS (vitest, no browser needed)
- spriteIndex.test.ts: name parsing (good, bad, left rejected), completeness per facings list, unknown id.
- spriteAssets.test.ts: reads every PNG in the folder with fs (IHDR bytes 16 to 24 give width and height) and fails when: the id is not a
  furniture type, the facing is not allowed for that type, width != the facing's footprint width, height is outside [fd + 0, fd + height + 8].
  A missing sprite is never an error (fallback). (Palette and alpha are checked by Aseprite `validate`; a PNG decoder test would need a
  new dev dependency such as pngjs: ask first.)
- furnitureSprite: a render test only if the existing render tests can run without a canvas; otherwise a manual check (below).

## 2. Aseprite workflow for the artist
1. `preflight` first (live mode, the user's window). Read rules://index. Use the skills: brief (once per piece family), new, draw, review, export.
2. New sprite per piece: size from the formula above (for example register 32x40), RGB colour mode, palette = the 32 Endesga colours
   (hex list in shared/src/palette.ts; names in PALETTE_NAMES; load them through the palette tool, never widen it). Transparent background.
3. Layers: `base` (fills and shading), `outline` (1 px, dark warm = palette `outline`), `detail`. One frame per facing, each frame tagged
   `down`, `up`, `right`. Pieces with `facings: ["down"]` only need `down`. Left is never drawn.
4. Draw order: silhouette, top face lightest, left face medium, right face darkest (light top-left), 3 to 4 hue-shifted shades per material
   (warm lights, cool shadows), outline last. Match the block colours for carpentry pieces. `look` preview after drawing, `validate` before export.
5. Save the source as art-src/aseprite/<id>.aseprite.
6. EXPORT (the `export` tool): one PNG per tagged frame, scale 1x, NO trim, NO padding, NO border, RGBA, filename `<id>.png` for down and
   `<id>_<tag>.png` for the others, into client/src/assets/sprites/furniture/. Frame size must equal the sprite size (that is what keeps the anchor).
7. Check in the game (npm run dev) at zoom 3: the piece stands on its cell, the same depth order, no 1 px jumps against neighbours.

## 3. First proof: the tavern register (end to end)
Piece: id `register` (shared/data/furniture/tavern2.json: 32 x 32 footprint, height 22, onSurface, facing down only, sits on the bar).
Today's code art is three small boxes (about 22 wide, 14 deep, up to 19 high, 4 px behind the anchor). Sprite size: 32 x 40, so one file.

CODER (short, before T1a resumes; touches only client/src/render/spriteIndex.ts, spriteStore.ts, their tests, one hook in
furnitureSprite.ts, one await in game/core.ts, and creates the empty folder with a README line)
1. spriteIndex.ts + test (naming, completeness). 2. spriteStore.ts with glob, loadSprites, spriteFor. 3. await loadSprites() at boot.
4. The hook in furnitureSprite.ts with fallback. 5. spriteAssets.test.ts. 6. npm test, typecheck, `npm run build` (the PNG must end in dist
   with a relative url: open the built page, no 404). Done when: with no PNG nothing changes (full suite green), with a test PNG (any 32x40
   image named register.png) the register shows it.
ARTIST (after step 5 of the coder exists, or in parallel, only the export needs the folder)
1. Draw `register` as above: a small brass cash register with a drawer, a keypad block and a little bell, warm wood base, front face and top face visible.
2. Export `register.png` (32x40, no trim). 3. `validate`, then show the preview to the user.
VERIFY: vitest spriteAssets passes; tools/art-sheet.ts (artist) shows the sprite next to the code art; in the game the register must be
placed: until T1a puts it on the bar a local, uncommitted debug step (set inCatalog true or place it through the debug tools) is enough.
Do NOT commit that debug change. Acceptance by the user: looks right on the bar, nothing shifts, other furniture unchanged.

## 4. What waits, and the interaction with batch 2 (see the PAUSE NOTE sections in docs/PLAN-1B.md)
- The coder is mid T1a (touching shared/data/furniture/tavern2.json, furniture.json counter surface:true, shared/src/types.ts). The loader
  task touches none of those files, so it can be done as a short interlude without conflict; T1a then resumes (first run npm test, as the
  coder's note says). Do not let the loader task reformat tavern2.json.
- The artist's ART-T1 left: art/icon/light for six pieces in tavern2.json, counter art without the baked till, Taps panel CSS. Recommended:
  fill ONLY minimal fallback boxes and icons for the six pieces (enough for tests and the catalog), do the Taps panel CSS, and put the real
  effort into sprites in this order: register, tap_stand, prep_table, pantry, sink, serving_hatch, then the counter (its sprite replaces the
  baked till boxes; until T1a's register exists the counter keeps its code art). tap_stand: set the pourEffect spouts from the sprite once it exists (dy -24 as noted).
- WAIT for: T1a (register on the bar, counter surface) before the counter sprite; the CP-1 playtest before polishing anything; the carpentry
  12 and later 9g/9h pieces come after the tavern pieces. Item icons from sprites: a separate, later task using the same spriteStore.
- Sprite files do not change SAVE_VERSION or any shared/ rule, so they can land between any two batch tasks. Both sides keep the file-ownership
  rules of PLAN-1B section 1 (coder: loader hook; artist: PNGs, art-src, render/, ui.css).

## 5. Decisions (ALL SIX DECIDED: YES by the user, 15 Nov; CLAUDE.md sections 12 and 14 and ROADMAP phase 4 updated)
D1. Change CLAUDE.md 12/14 to allow Aseprite sprites ahead of step 6, code art stays as fallback. Recommended: yes.
D2. A piece uses sprites only when all its facings exist, else it keeps code art. Recommended: yes.
D3. Keep .aseprite sources in the repo (art-src/aseprite/). Recommended: yes (small files, needed for edits).
D4. First slice = world furniture sprites only; item icons, avatar, floors, blocks later. Recommended: yes.
D5. The proof piece is the register and it is checked with a local debug placement until T1a lands. Recommended: yes (do not wait for T1a).
D6. Run the playtest checkpoint CP-1 before spending art time on the carpentry 12. Recommended: yes.
