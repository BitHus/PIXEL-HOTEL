# PLAN-REWORK-OUTDOORS: the dungeon, the mine and the lakeside stop looking ugly (lead, 16 Nov)

Why: the owner says the DUNGEON and the FISHING / LAKESIDE area look ugly and need rework from the artist AND the coder. The owner values vibes and fun.
Scope: LOOK and FEEL only. No rule in shared/ changes (step(), fishing.ts, loot, generator, LAKE_WATER, LAKE_PIER, LAKE_TREES stay as they are; isWater and
the walk grids keep working). No GameState change: SAVE_VERSION stays (see section 6). Builds on docs/PLAN-SPRITES.md, docs/PLAN-ART-UPGRADE.md, docs/ART-STYLE.md.
The mine uses the dungeon drawing (same files), so it gets the same upgrade for free; its tile set is a later round (A23).

## 1. What looks and feels bad now (read from the code)

### Dungeon (client/src/dungeon/dungeonArt.ts, dungeonView.ts, dungeonScreen.ts, fog.ts)
TILES AND WALLS
- Floor = one flat colour (PALETTE[24]) per 32 px block plus 1 to 2 tiny specks chosen by a hash. No stone pattern, no cracks, no variety, no puddles, no bones: it reads
  as a grey carpet. Walls = one flat top colour with 1 or 2 joint lines and a flat 14 px front band: no stone courses, no moss, no torches (only the mine has lanterns),
  no corner or edge treatment (a wall block next to floor looks the same on every side), no wall-top highlight on the lit side.
- Exit = four stacked rectangles. No door, no frame, no light spill.
ENEMIES AND CHESTS
- Every enemy is 3 to 6 boxes with no animation at all: no idle bob, no walk cycle, the bat does not flap, the slime does not squash. The only feedback is a
  white silhouette flash (HIT_FLASH_MS 120) and a red tint blink in the 300 ms wind-up. Death = the view is removed that same tick (no puff, no fall, no bone pile).
  A hit does not move the enemy (no knockback), there is no hit-stop, no spark, no slash mark. The Bone King is a taller skeleton box with a yellow crown.
- Chests = boxes with a band; the lid "opens" by REDRAWING the Graphics every frame for CHEST_OPEN_MS (allocates every frame) with a 4 px hop. Loot pops as HTML text, not
  as items flying out. A mimic only says "A mimic!" in text. Golden chest glow = two flat ellipses.
- Rocks (mine) = grey boxes with ore flecks; cracks are 6 fixed rectangles. Shake is 1 px left right. No debris when hit or broken.
LIGHT AND ATMOSPHERE
- The fog is a per-BLOCK black rectangle: lit blocks clear, seen blocks 60 percent black (DUNGEON_SEEN_DARK), the rest black. Hard square edges, no falloff, no warm light pool
  around the player, no torch light, no vignette, no flicker. The whole crypt is evenly grey-blue; "cool and dark with FEW WARM LIGHTS" (CLAUDE.md 12) is not there because
  there are no warm lights except the exit glow and the golden chest.
- No ambient life: no dust, no drips, no torch flames, no cobwebs, no fog.
FEEDBACK AND JUICE (what exists, what is missing)
- EXISTS: screen shake (HIT_SHAKE_PX 2, HURT_SHAKE_PX 5, 160 ms, but driven by sin(clock) so it drifts and is quantised by snapCamera), enemy white flash, player red tint,
  HTML float texts (damage, hurt, xp, loot with rank colour and sparkle), gem pile bob and fly, level-up screen flash, cooldown ring above the head.
- MISSING: hit-stop (a 40 to 60 ms freeze on a hit), enemy knockback and squash, hit sparks, a crit or big-hit style, a kill burst and a death animation, a loot pop (items
  jump out of a chest and fall), a "ding" on pickup, a screen edge flash when hurt, low-hp warning, enemy aggro cue (a "!" over the head), a telegraph for the wind-up that
  is more than a tint blink (a growing ring or a raised weapon), a clearer boss entrance, footstep puffs.
- SOUND: only 'hit', 'hurt', 'coin' are used in the dungeon (audio/sound.ts has step, coin, bell, pop, click, hit, hurt, clink, murmur, pour). No kill sound, no chest
  open sound, no wind-up cue, no level-up jingle, no stairs, no boss, no ambient drone. Every sound is a code tone: fine, but there are too few of them.

### Lakeside and fishing (client/src/lakeside/lakesideArt.ts, lakesideScreen.ts, ui/fishBar.ts)
SCENE
- The lake is 3 flat rectangles (LAKE_WATER + the strip under the pier) with a dark outline, a 3 px sand rim, a 6 px darker band at the bottom and a 2 px light band at the top,
  corners cut by 3 px squares. It reads as a blue box with a border. No shore shape, no shallows, no foam line, no reflection of the pier and trees, no depth.
- Water animation = up to 22 short white lines, REDRAWN every 500 ms (Graphics clear and rebuild). It is slow and sparse; nothing moves between steps.
- The pier = flat boards with 4 posts; no railing, no rope, no lantern, no shadow on the water, no wobble.
- Trees = ONE look for all 8 (a trunk and three round leaf blobs). They do not sway; a hit shakes 2 px for 180 ms; a felled tree rotates around its feet and fades; the
  stump and sapling are fine ideas but plain. Bushes = 9 near-copies. Nothing else on the ground: no reeds, flowers, stones, mushrooms, lily pads, logs.
- No life: no birds, no butterflies, no dragonflies, no fish shadows, no ducks, no falling leaves, no sun glints on the water. No light tint (the lakeside should be the
  brightest, most colourful room in the game; it is as dim as any room).
FISHING FEEL
- The bobber is destroyed and rebuilt as a new Graphics EVERY FRAME while a line is out. There is no cast animation (no rod swing, no arc of the line, no splash), the line is a
  row of 1 px dots with a fixed sag, the "!" is a static yellow block, a bite does not make rings, a catch has no jump out of the water and no splash.
- THE REEL is an HTML bar (fishBar.ts): a fish icon on a track, a green box, a fill meter. It is correct and smooth (tick interpolation) but it has no feedback: the box does
  not pulse while the fish is inside, the fill does not flash near full, no sound plays during the reel (only 'pop' at hook and 'bell' at the bite), no tension cue, no
  fish struggle in the world (the bobber shakes by sin only), no shake of the rod or the bar when the fish escapes, and the catch moment is a float text + a toast + one coin tone.
  A rare or legendary catch should be an EVENT (a bigger text, a flash, a held pose of the avatar with the fish above the head) and is not.
- The wait phase ("Waiting for a bite...") has nothing to look at: no rippling bobber, no nibble hints.

### Common to both
- All of it is Graphics boxes redrawn in code; no PNG kinds exist yet for these areas (spriteStore kinds today: furniture, icons, blocks, floors, walls, plants; H1/H3/H4).
- Effects are scattered: dungeonScreen.ts has shake, flash and floats inline; lakesideScreen.ts has its own shake and splash constants (SHAKE_MS, FALL_MS, SPLASH_MS inline).
  The numbers live in the screen files and shared config, not in one fx module.

## 2. Target look

### The crypt (cool and dark, few warm lights)
- Palette: Endesga 32 blues, purples and greys for stone (the crypt ramps in art-src/RAMPS.md: stone cool, dark stone, moss green accent, bone cream, rust), with warm orange
  ONLY in torches, candles, the exit light, chests and the boss crown. Warm light pools are what the eye follows. Light from the top-left.
- Floor: 4 to 6 flagstone variants (32 x 32) placed by hash, a few with cracks, puddles, moss, bones, a rune tile; seams dark. Walls: block courses with a lit top-left
  edge, a front face with a darker base, moss, cracks, chains, and wall torches / sconces (the warm light sources, about 1 in 8 wall fronts, with a 3 frame flame).
- Enemies: chunky and readable at 32 px: slime = squashy blob with highlights and two eyes (idle squash 2 frames, hop), skeleton = bone armour, rusty sword, a jaw clack
  idle, bat = 2 flap frames, mimic = a chest with a tongue and teeth, the Bone King = a big silhouette with a flame crown that is a light source.
- Light: a warm pool around the player (a lantern: dithered, pixel-stepped falloff instead of per-block rectangles), torches with flicker, seen-but-not-lit areas a cool
  dark blue (not black), unseen = black. A vignette on the screen edge. Doors and the exit leak warm light.
- Juice: every hit = flash + hit-stop + spark + squash + knockback + shake; kills = a burst of bone or goo bits and a fade; chests = lid up, a light shaft, items jump out and
  land with a bounce; each gain pops with a "ding" pitched by rank.

### The lakeside (bright, lush, alive)
- Palette: bright greens, warm sand, sky blues and teals, white foam, a few warm accents (red mushrooms, yellow flowers, orange fish). Light from the top-left with long soft tree shadows.
- Ground: lush grass floor (grass.png 64 x 64 with 3 detail variants for flowers, tufts and clover placed by hash), sandy and pebble shore edge.
- Water: a 4-frame animated water tile (about 250 ms per frame, a slow diagonal shimmer), a shore edge piece ring with foam that pulses, a darker deep middle, sun glints
  (white 1 to 2 px sparkles that twinkle), pier and tree reflections as a darker vertical smear under them, lily pads and reeds at the rim.
- Pier: a plank deck with lit tops, wobble-free railings on the sides (not at the casting end), two rope-wrapped posts, a lantern post at the end (warm light, the one warm
  spot), planks that bow 1 px when the avatar walks on them (optional).
- Trees: 3 variants (round oak, tall pine, a slim birch) in two leaf shades, sway in the wind (a 1 px sine on the crown rows only), a leaf puff when hit, a clear fall (tip, bounce, puff
  of leaves), a stump with rings, a sapling in two stages. Bushes in 3 variants with flowers; reeds, cattails, stones, a log, mushrooms, tall grass tufts that sway.
- Life: 3 to 5 birds that land on the pier posts and fly off when the avatar comes near, butterflies, a dragonfly over the water, 2 to 3 fish shadows that cruise (they flee
  when you cast: a nice hint that fishing is live), falling leaves, a gentle warm light tint.
- Fishing feel: a rod swing and a line arc on the cast, a splash and rings on landing, the bobber floats and nibbles (small dips) while you wait, the bite = a big ring + the "!"
  that pops and bounces + a bell, the reel = the fish thrashes visibly under the bobber (rings that grow with tension), the bar pulses green while the fish is in the box,
  a rising pitch tick as the catch bar fills, red edge pulse when the fish is about to escape, the catch = the fish jumps in an arc to the avatar's hands, a splash, a held
  pose with the fish icon above the head, rank-coloured burst; legendary = flash and a jingle.

## 3. Principles for the whole rework
- PNG over code where it counts (tiles, walls, enemies, chests, trees, water, pier), code for motion (bob, sway, squash, shake, flicker, particles). Code art stays as the fallback for
  anything without a PNG, exactly as in PLAN-ART-UPGRADE: the game never breaks mid-rework.
- Effects are driven by event hooks, never by editing rules: the dungeon already emits events (hit, enemy_hit, enemy_miss, kill, chest, loot, windup, stairs, level_up, died ...)
  and the lakeside has session events (bite, hooked, escaped, missed) plus the caught result. The client reacts to those.
- Every juice effect has a number in config and respects a "Reduce effects" pref (shake, flash, hit-stop, particles, flicker) and prefers-reduced-motion. Whole pixels only, no smoothing.
- Frame budget: pooled particles (one Container with pre-made Sprites or one Graphics batch), no per-frame texture or Graphics creation (the bobber and the chest redraws are fixed),
  good on a phone. A particle cap constant (FX_MAX_PARTICLES).
- One fx module: client/src/fx/ (pure helpers with tests next to the code; rendering classes use them). The dungeon and the lakeside both call it.

## 4. Sprite sizes and naming (per PLAN-SPRITES / PLAN-ART-UPGRADE; the H5 hook adds the kinds)
Rules as before: PNG name = id, no trim, Endesga 32 only, alpha 0 or 255, 1 px dark outline (crypt: cool dark outline PALETTE[25]; lakeside: warm dark outline), light top-left,
anchor = bottom centre of the footprint, the sprite canvas = the frame size. ANIMATION STRIPS: a horizontal strip `<id>_<tag>.png` whose width = frames x frame width (the coder
reads the count from the width; no JSON). Stage in art-src/staging/outdoors/, ramps in art-src/RAMPS.md (add crypt stone, moss, rust, water, grass, sand, foam, pine, birch).
New kinds (hook in H5, folder under client/src/assets/sprites/):
- dungeon/ (tiles, 32 x 32): crypt_floor_a..e, crypt_wall_top_a..c, crypt_wall_front_a..d (front art = the 32 x 32 block of a wall with floor below: top part + 14 px front band,
  matching today's geometry), crypt_wall_edge_* only if the coder asks, crypt_exit (32 x 32 stairs down), crypt_torch_<1..3> flame strip crypt_torch.png (3 frames, 16 x 24, anchor bottom
  centre, drawn on a wall front), decor crypt_bones, crypt_skull, crypt_web, crypt_puddle, crypt_rune (16 x 16 or 32 x 32 as noted per file).
- actors/ (enemies and chests, anchor bottom centre): slime_idle (2 frames 32 x 32), slime_move (3), bat_fly (3 frames 32 x 32; the body floats, the shadow is code), skeleton_idle (2 frames
  32 x 64, the art is about 46 px tall), skeleton_move (4), bone_king_idle (2 frames 64 x 96), bone_king_move (4), mimic_idle (2 frames 32 x 32), mimic_bite (3), and
  windup poses `<enemy>_windup.png` (1 frame, same size). chest_wooden and chest_golden: strips of 4 frames (shut, lid cracking, half, open) 32 x 32 each. The white hit flash is made by
  the coder from the alpha of the frames (no extra art). Death = code (fade + bits), or `<enemy>_die` strips later.
- mine/ (A23, later): mine_floor_a..c, mine_wall_*, rock_copper / rock_iron / rock_mithril (32 x 32, three crack stages stay code overlay), lantern.
- lake/ (32 x 32 unless noted): water.png = a 4 frame strip 128 x 32 (seamless, shimmer), water_deep.png (same), shore_<n> pieces for the edge ring INSIDE the water rect (edges N E S W,
  outer corners 4, inner corners 4 = 12 pieces, foam frames 2 per piece as a strip 64 x 32; the rect geometry in LAKE_WATER is unchanged), pier deck 32 x 32 tile + pier_post (16 x 32),
  pier_rail (32 x 16), pier_lantern (16 x 48 + light in code), tree_oak, tree_pine, tree_birch (64 x 96, anchor bottom centre of the trunk, the 8 anchors in LAKE_TREES keep working),
  tree_stump (32 x 32), tree_sapling_1/2 (32 x 48), bush_a..c (32 x 32), reed (16 x 32, 2 frame sway strip), flower_a..c, stone_a..c, log, lily_pad (16 x 16), grass tufts 16 x 16,
  bird_perch / bird_fly (16 x 16 frames, 2), butterfly (8 x 8, 2 frames), dragonfly, fish_shadow (24 x 12), leaf (8 x 8 particle). Floors: floors/grass.png 64 x 64 + 3 detail 32 x 32 tiles.
- fishing UI: the reel bar stays HTML/CSS (CODE-ART: ui.css and fishBar.ts markup go through the coder); fish icons already exist per fish.json.
Quality gate: PLAN-ART-UPGRADE section 6 (look 1x and 3x, validate, pixel-critic, in-game check zoom 3 and 1, contact sheet for the lead, rounds of about 5 assets).

## 5. Ordered tasks

Order logic: (1) hooks and fx foundation first so the artist's work shows up; (2) FEEL first because it is cheap and shows at once even with placeholder boxes; (3) then the look in
the order the player sees it most: dungeon floor and walls, enemies, chests, light; lake water and shore, trees, pier, life. Coder and artist alternate in rounds of about 5 assets
(PLAN-ART-UPGRADE section 5); a coder hook is always one round before the PNGs it loads, and the artist drafts into art-src/staging/outdoors/ before the hook exists.
`[coder]` = logic, hooks, effects, tests. `[artist]` = art, CSS, animation by design. CODE-ART = needs NO Aseprite plugin; PLUGIN = needs it (`preflight` first).

### Round 0 (start now, no dependencies)
- C11 [coder] H5 hooks and fx module: spriteStore kinds `dungeon`, `actors`, `lake` (strips by width rule, spriteFor + frame count helper, test of the naming and sizes, no PNG = no change);
  client/src/fx/ with pure helpers and tests: shake envelope (whole px, decaying, seeded not sin of the clock), hit-stop timer, particle pool, easing, `reduceEffects` pref. No save change.
- A15 [artist] CODE-ART crypt look v1 (no plugin): in dungeonArt.ts replace the flat floor and walls: 5 floor variants (flagstones, cracks, a puddle, bones, a rune), wall tops with
  courses and a lit top-left edge, wall fronts with a darker base, moss, torches on about 1 in 8 fronts (warm, 3 frame flame stepped by clock), the exit with a frame and warm glow; the mine keeps its
  colours. Enemies get a small code upgrade: slime squash highlights, skeleton with bone details, bat wings in two poses chosen by a `phase` argument (the coder passes it in A16), mimic teeth.
  Contact sheet at zoom 1 and 3 (tools/art-sheet.ts). Geometry (block 32, front band 14) unchanged.
- A16 [artist] CODE-ART lakeside look v1 (no plugin): in lakesideArt.ts a better lake (rounded shore with a foam line, a sand to wet-sand ramp, deeper middle, darker under the pier,
  pier with rails and lantern), 3 tree variants and 3 bush variants, reeds, flowers, stones, tall grass, lily pads as ground decor placed by hash; a bobber that does NOT redraw per frame
  (pre-built, the coder moves it). Contact sheet.

### Round 1: the feel (the biggest vibe win per hour)
- C12 [coder] Dungeon juice: in dungeonScreen/dungeonView, driven by the existing events: hit-stop 50 ms on 'hit' and 'enemy_hit' (rendering clock only, the run keeps its fixed ticks), squash and
  knockback of 2 to 4 px on the enemy view (decays), hit sparks (4 to 6 pooled particles, rank/colour by enemy kind), damage numbers with pop-in scale, a bigger style for big hits (at or above the
  attack's top roll) and a "CRIT" look, kill burst (goo bits, bone bits) plus a fade-out instead of removal, a chest lid animation without redraws plus loot items that pop and bounce out
  of the chest (the existing gain popups stay), an aggro "!" when an enemy starts chasing, a wind-up telegraph (a growing red ring on the floor), screen-edge red pulse on hurt and a low-hp
  heartbeat vignette under 30 percent, footstep dust. Replace the sin-of-clock shake by the fx envelope. Prefs: Reduce effects. TESTS: fx helpers (envelope ends at 0, pool never exceeds
  FX_MAX_PARTICLES, hit-stop does not change run.timeMs), event to effect mapping as a pure function (event -> list of effect specs) so it is testable without Pixi. No change to step(); no save.
- C13 [coder] Fishing and lake juice: pre-built bobber moved by position (no per-frame Graphics), cast animation (rod swing hook, an arc of the line, a splash with rings on landing), wait-phase nibbles
  (tiny dips on a hash schedule, cosmetic only), a bite = bobber dunks + growing rings + the "!" pops with a bounce, the reel: the bobber thrashes by tension (distance fish to box), the bar
  pulses green while catching (CSS class from fishBar.ts) and red when the fill drains close to empty, tick sounds with rising pitch as the fill rises, the catch = fish icon arc into the avatar's
  hands, splash, a held pose 600 ms, rank burst, legendary flash; escape = a visible slack line. Tree hits: leaf puff, trunk squash, a proper fall (tip, bounce, leaf burst). Wind sway of leaf
  rows via a clock hook (whole px). New sounds: reelTick, splash, cast, rustle, chestOpen, kill, windup, levelUp, stairs, found (rank ping): all code tones in audio/sound.ts, quiet, with MIN_GAP_MS.
  TESTS: reel feedback mapping as a pure function (ReelView -> feedback flags), sound names and gaps, particle pool; fishing.ts untouched.
- A17 [artist] CODE-ART UI and effects look (no plugin): ui.css for the fish bar (framed pixel look, a pulse class `.catching`, a danger class `.draining`, a bigger rank-coloured catch bar, a
  nicer Hold button with a pressed state), float text styles (crit, heal, xp, rank loot with outline), the low-hp vignette and hurt edge CSS, the "!" and "?" bubbles in code, spark and dust particle
  textures (4 small shapes), splash ring shapes. Hand the class names to the coder in the commit note. DONE WHEN: a screenshot description of each state at 420 x 760 and 1000 x 700.

### Round 2: dungeon art (PNG)
- C14 [coder] Dungeon light and fog rework: replace the hard per-block fog drawing with a light layer: a warm pixel-stepped (dithered) pool around the player, cool dim for seen blocks (blue-tinted
  not black), torch lights from the wall fronts (positions from a hash of the map seed so they are the same every time, cosmetic only), flicker (whole px radius steps), the exit and chests
  leak light, vignette; keep FogMemory untouched (rule-adjacent, has tests). Use a mask/RenderTexture or a Graphics of stepped rectangles; measure the frame cost on a phone (target 60 fps on a
  mid phone; fallback to the old fog when the pref "Reduce effects" is on). Then the PNG hooks for dungeon tiles and actors (frames from strips, white flash from alpha, idle/move/windup choice from
  e.vx/windupMs, bat flap, facing flip). TESTS: strip frame counts, flash texture from alpha, light stepping function pure, fallback with no PNG. DONE WHEN: with zero PNGs the new light shows with
  the code art; with the artist's first PNGs they appear.
- A18 [artist] PLUGIN crypt tiles round 1 (5 PNGs): crypt_floor_a, crypt_floor_b, crypt_floor_c, crypt_wall_top_a, crypt_wall_front_a. Then A19 round 2: crypt_wall_front_b, c, crypt_exit, crypt_torch strip, crypt_bones decor.
  ONE style lock check with the lead after the first 5 (the crypt should look cool and dark with the torch as the only warm thing).
- A20 [artist] PLUGIN enemies round (5 PNGs per round, 3 rounds): R1 slime_idle, slime_move, bat_fly, mimic_idle, mimic_bite; R2 skeleton_idle, skeleton_move, skeleton_windup, slime_windup, chest_wooden;
  R3 chest_golden, bone_king_idle, bone_king_move, bone_king_windup, bat_windup. In-game check at zoom 3 and 1 against the fog.

### Round 3: the lakeside art (PNG)
- C15 [coder] Lakeside ambient and PNG hooks: lake water as an animated tile strip (frame by clock, one shared texture, whole-pixel shimmer), shore ring pieces from the rect edges (pure helper
  `shoreCells(rects)` -> list of piece ids and positions, tested for the 3 rects of LAKE_WATER incl. the L-joins and the pier gap), tree variants chosen by index (deterministic), sway, decor
  placement by hash on grass cells outside water, trees, the pier and the walk paths (a pure `decorSpots(seed)` with a test that nothing lands on water, the pier, a tree anchor or the door
  zone), ambient life: birds (perch on the pier posts, fly off when the avatar is within 80 px, back later), butterflies, fish shadows that flee a cast, falling leaves, sun glints, a warm
  daylight tint pref-guarded. All with caps (FX_MAX_PARTICLES, AMBIENT_MAX) and OFF with Reduce effects. TESTS: shoreCells, decorSpots, bird state machine (pure, time and rng passed in).
- A21 [artist] PLUGIN lakeside round 1 (5 PNGs): water (4 frame strip), floors/grass (64 x 64), shore edge N, shore edge E, tree_oak.
  Round 2: tree_pine, tree_birch, tree_stump, bush_a, shore corners. Round 3: pier deck + post + rail + lantern. Round 4: reed, flowers, stones, lily pad, fish shadow. Round 5: bird, butterfly, leaf.
- A22 [artist] CODE-ART alternative while the plugin is away: everything of A21 can be drawn in code (the A16 look extended with the shore pieces and the animated water by code frames); it
  is the fallback, not the goal. Mark in the report which pieces are code only.
- A23 [artist] PLUGIN later: mine tiles and rocks (mine_floor, mine_wall, rock_copper/iron/mithril, lantern), after the crypt is signed off.

### Round 4: polish and sign-off
- C16 [coder] Tuning pass with the owner's eyes: all fx numbers in config (FX_* constants), a Settings -> Effects section (Reduce effects, Screen shake, Ambient life), a debug panel line
  for fps and particle count, `npm run simulate` unchanged (no balance numbers move), perf check on a 420 x 760 phone profile. TESTS: prefs, config sanity.
- T-OUT [tester] Smoke route: one dungeon run (fight 3 enemies, open 2 chests, die once, leave once), one mine visit, 5 trees, 3 fish incl. one escape, at 1000 x 700 and 420 x 760; report fps feel,
  anything unreadable (dark is not unreadable), console errors, 404s for sprites.

## 6. Save impact and risks
- Save: NONE. No new GameState field. Settings (reduce effects, shake, ambient) are device prefs (client/src/api/prefs.ts), like sound and lighting. SAVE_VERSION stays as the tree has it.
- Rules: NONE. If a task finds it needs a new field in an event (for example the enemy's velocity or a crit flag in the 'hit' event), STOP: tell the manager; it would be a shared/ change with
  a test and a determinism check (step.test.ts), not part of this plan. Derive crit from damage vs the attack range on the client first.
- Risk: hit-stop must be a rendering pause (freeze the view interpolation and the effects clock) and NEVER delay api.dungeonAdvance, or the run time drifts from real time. Risk: the new light layer
  on phones (test early, keep the old fog as a fallback). Risk: the white-flash from alpha needs a texture per frame (cache per sprite). Risk: file overlap: artist edits dungeonArt.ts and lakesideArt.ts
  (A15, A16), the coder edits dungeonView.ts, dungeonScreen.ts, lakesideScreen.ts, fishBar.ts markup; A15/A16 only change the draw functions, not their signatures (a new optional `phase`
  argument is the one exception and is agreed here). The artist does not edit render files named by a running H task.
- Plugin not attached: A15, A16, A17 and A22 (CODE-ART) run now; A18 to A21 and A23 wait for it; all C tasks are independent of the plugin.

## 7. Done when (the owner's test)
Open the dungeon: it feels dark and moody with warm torch pools, enemies wobble and squash, every hit has a bang, a chest bursts open with loot popping out. Open the lakeside: bright and
alive, water that moves and sparkles, trees that sway, birds on the pier, and a fishing catch that is an event. Both run at 60 fps on the phone profile and everything can be turned down in Settings.
