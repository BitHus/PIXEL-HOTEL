# PLAN-CHARACTERS: the real pixel avatar and the NPCs (U1) (lead, 16 Nov)

Owner (16 Nov): the avatar and the NPCs must look better; Travellers Rest is the example for characters, hats and clothes; the game is strongly MEDIEVAL (see ART-STYLE.md "MEDIEVAL DIRECTION"). This is the owner's GO for U1: it lifts "the box avatar is the approved base, do not change its shape" (CLAUDE.md section 8). Proportions are open. What stays: layers, palette-index recolour, canvas 32 x 64, feet bottom centre, down/up/right drawn and left mirrored, clothing as data, AvatarLook compatible, Endesga 32, light top-left, original art only (mood, never copies).
No production code is written by this plan. Hooks the code needs are named in section 7. Art needs the Aseprite plugin (`preflight` first), except the CODE-ART tasks marked so.

## 1. What the references teach (and how sure we are)
SOURCE QUALITY. Good: the Stardew modding wiki (community, sometimes old revisions) and the Soulbound devlog (a real studio write-up). Medium: the Habbo notation page (fan documentation). Weak: tutorial blogs and tool marketing pages (numbers disagree). I could NOT find any reliable written source for Travellers Rest, Growtopia, Pixel Worlds, Graveyard Keeper, Moonlighter, Eastward or Cozy Grove character art; the lines marked (memory) below are the lead's general knowledge and must be checked by looking at screenshots; they are design inspiration, not facts to quote. Never copy any of these designs.

VERIFIED (with source):
- Stardew Valley: the farmer is a 16 x 32 sprite on 16 px tiles (about 2 tiles tall). The base sheet is built from separately recoloured pieces: head/torso/boots, the arms in the middle columns, the pants on the right; clothes, accessories and hair are drawn on top in several layers; the walk is a 4 frame loop (frames 1, 2, 1, 3) per direction; and a shirt's height depends on the animation frame, so clothes are made PER FRAME of the base animation. Source: https://wiki.stardewvalley.net/Modding:Farmer_sprite (community wiki, partly old revisions). Lesson: a rigid base animation first, every garment drawn on the same frames, a small frame count.
- Soulbound (studio devlog, pixel cosmetics): lock the base run cycle first because all gear must match its skeleton, frame count and proportions; every gear set has the same number of frames per animation; all cosmetics share one palette; layer order changes by facing; combinations multiply fast, so keep the base fixed. Source: https://soulbound.game/news/how-we-built-a-pixel-art-character-and-cosmetic-system/ . Lesson: freeze the rig before drawing clothes; changing it later means redrawing everything.
- Habbo: a figure is a short string of PART TYPES (hd head, hr hair, ch chest, lg legs, sh shoes, ha hat, ...), each with a set id and colour ids from a palette. Source: https://habbianos.github.io/notations/avatar-figure/spec/HAFN-v2_0.html and https://dev.to/trickstival/habbo-avatar-rendering-basics-4cg6 (fan docs). Lesson: a figure as data (types + ids + colour ids) is exactly our AvatarLook, and one colour palette per part type scales to thousands of looks.
- Readability of small sprites: tutorial blogs agree that the head must be big enough for 2 to 3 px eyes and a clear hair shape, and recommend a solid-black silhouette test; they disagree on the ratio (2 heads for 32 x 32 chibi, others 3 to 4 heads at 32 px). Medium-to-weak sources (https://community.aseprite.org/t/advice-on-practicing-for-8x8-16x16-and-32x32-characters/7986 , tutorial pages). Lesson: test our own sprite with the silhouette check at zoom 1 and 3.
- Pixel palette swap: one base design, recolours from fixed ramps, an established palette such as Endesga 32 for consistency (guide pages). Weak source, matches our own design.

(memory, unverified, from the lead's knowledge; check by screenshot before relying on it):
- Travellers Rest: chunky, cosy people with a large head and a simple face, readable at small size, clothes and hats that read the role (cook, guard, villager) in the silhouette, warm colours, a dark outline. This is the target mood; ours must be original.
- Growtopia and Pixel Worlds: very chunky, big-headed avatars; wearable slots (hair, face, hat, shirt, pants, shoes, back item); recolour and rare wearables as status. Lesson: rare hats and back items are what players show off.
- Graveyard Keeper, Moonlighter, Eastward: about 3 heads, strong outlines, clothes with a clear shape (aprons, cloaks, hoods), idle breathing, 4 to 6 frame walks. Cozy Grove: soft hand-drawn, not pixel; take only the cosy colour mood.
Patterns that all of them share: (1) the silhouette reads the role (hat, apron, cloak) before the face does; (2) the head is big (about a third of the height or more); (3) faces are tiny: two eye pixels, no mouth most of the time, mood by 1 to 2 pixels; (4) a dark outline, flat 3 to 4 shade shading, a warm light; (5) a short walk loop (4 to 6 frames) and a 2 frame idle breath; (6) variety from a few parts: hair style x hair colour x skin x top x bottoms x hat, not from many bodies.

## 2. Proportions: slim or cosy chunky? RECOMMENDATION: "cosy three-head"
Options compared (canvas stays 32 x 64):
| Option | Figure | Head | Good | Bad |
|---|---|---|---|---|
| A. Slim (today's box) | 63 px tall, 14 px wide | 14 px of 63 (about 4.4 heads) | tall elegant, uses the canvas | the face and hair are small at zoom 3 (12 px head, 1 px eyes), hats and clothes are hard to read, looks like a Habbo figure, not a Travellers Rest one |
| B. Cosy three-head (RECOMMENDED) | 54 px tall + 10 px hat zone, 18 px wide | 17 px of 54 (about 3.2 heads) | big readable head with 2 px eyes and clear hair, broad shoulders for tunics, aprons and cloaks, hats fill the zone above, still not a baby | about 14 percent shorter than today (still 1.7 cells) |
| C. Chibi two-head | 40 to 44 px | 20 px | the strongest face, toy-like | breaks "not chibi", clothes shrink to patches, a cloak or knight armour looks silly; NPCs read as toys |
B keeps normal-ish adult build (short legs, wide shoulders) so medieval clothes have room. Check in the prototype (task A24): the silhouette test, zoom 1 and 3, next to the bar, a chair and a door (the avatar is still about two cells including a hat).

THE SPEC (all numbers are y from the FEET, negative is up, x from the centre column; the sprite is 32 x 64, so the feet pixel row is y -1 in file rows 63; the artist draws in file coordinates, the coder uses these in avatarRig.json):
- Shoes/boots: 0 to -6 (boot shaft to -8). Legs/hose visible: -6 to -19. Torso and belt: -19 to -34 (belt row -21/-22). Shoulders at -34, 14 px wide (x -7 to +6), arms 3 px each outside it (front view total 20). Head: -35 to -52 (17 px tall, 16 px wide front, 14 px side, no visible neck: the head sits on the shoulders). Hair adds up to 2 px above (-54) and 1 px to each side. HAT ZONE: up to -64 (tall cook cap and crowns may use it; nothing above -64).
- Face (down, right): eyes are 1 x 2 px dark (outline colour), 4 px apart front, one eye on the side view; cheeks a 1 px skin ramp-light dot optional; no mouth in idle (mood adds it, section 4). The face is its own layer so mood changes are free.
- Outline: ONE px, dark warm (palette `outline`), drawn BY CODE around the composed silhouette (section 6), so layers never double-outline. Inner lines (the hem of a tunic, the brim of a hat) are drawn by the artist in the layer's darkest ramp colour.
- Light top-left: highlights on the left/top of hair, shoulders, hat crowns; shadow side right and under chins, hems, brims.
- Chunky means: simple blocks, arms as 3 px bars with a 3 px skin hand, boots as a 6 x 6 block, nothing thinner than 2 px except eyes and straps.
Legacy impact: SIT_DROP, HAND_Y (-24) and the held item offset change; they become rig data (section 6), not code constants.

## 3. Layers (what is drawn, in order) and which move
Draw order for DOWN (front) and RIGHT; UP reverses where noted. Each layer is drawn on its own 32 x 64 canvas aligned to the same feet, so no per-layer offsets are needed.
1. shadow (code: the soft ellipse the room already draws; unchanged).
2. outer_back: the back part of a cloak, a tabard back, a long ponytail behind (UP view: drawn after the body, it covers it).
3. body: head, ears, hands, forearms and legs that show (skin ramp); includes neck/shoulder base, the part that is always there. Recolour: skin.
4. shoes: boots (leather, laced), shoes, sandals later. Recolour: shoes colour. (Boot shafts overlap legs.)
5. legs: the bottoms: hose, trousers, breeches, kilt, skirt, long robe skirt. Recolour: legs colour.
6. torso: the top with sleeves: peasant shirt, tunic, jerkin, vest, bodice, robe. Recolour: shirt colour (K1), secondary trim (K2), skin hands (KS).
7. outer: over the top (optional): apron, tabard, cloak front, belt and pouch, scarf. Recolour: K1 from the outer's own colour (data), K2 trim.
8. hair_back (long hair, ponytail, braids hanging behind the shoulders; also the back hair in UP view).
9. face: eyes (and mood marks). Fixed colours.
10. hair_front: the hair on top and the fringe. Recolour: hair colour. (UP view: hair covers the whole head; face is not drawn.)
11. hat: hats, hoods, helms. Fixed colours (as today). A hat can HIDE hair (data `hides`: none, front, all): hood and helm hide all except a fringe, a cap hides front; a flower crown hides none.
12. held item: code-drawn container at the hand anchor (as today: setHeld, handOffset). The mug/plate/tools stay code or icons.
MOVEMENT RULES (the rig; borrowed from the aseprite rig idea of rigid parts and pivots):
- BODY-ATTACHED layers (body, shoes, legs, torso, outer, outer_back) are FRAME STRIPS (walk 4 frames, sit 1 frame, emotes later). They are drawn per frame because legs and arms move.
- HEAD-ATTACHED layers (hair_back, face, hair_front, hat) are ONE picture per facing (plus mood variants of the face). The head in the body strip bobs by a few px per frame; the head layers follow it by a per-frame offset table in `shared/data/avatarRig.json` (headDx, headDy). The head in the body art must therefore NEVER move except by this table; the artist keeps to it, a test checks the table against the file frame counts.
- Why: 12 hats and 10+ hair styles stay one picture per facing, not one picture per animation frame. Art cost drops about four times. This is the same trade the box avatar already makes (head and hats are static boxes).
- Left is the mirror of right (code flips the baked sheet). Asymmetric parts (a belt pouch on the right hip, a sword side) are drawn on the viewer-right side only; accept the mirror.

## 4. Animations: frames and timing
| Pose | Facings | Frames | Timing | Notes |
|---|---|---|---|---|
| Stand (idle) | down, up, right | 1 (it is walk frame 1) + code breath | head layers bob 1 px for 600 ms every 2.4 s (rig table, not art) | no art cost |
| Walk | down, up, right | 4 (contact, pass, contact, pass; the pass frames bob the body 1 px) | frame chosen by DISTANCE walked, not by time: WALK_FRAME_PX = 12 px per frame (config), so guests at 72 px/s and the player at 128 px/s never skate | replaces WALK_BOB_MS/WALK_BOB_PX |
| Sit | down, up, right | 1 each (legs bent, upper body lowered; seat height 10 px as now) | + the same 1 px breath on the head | replaces SIT_DROP boxes |
| Lie | (code lieArt: head and shoulders on the pillow) | uses the same head layers | n/a | keep lieArt, feed it the head sprite later |
| Eat / drink (guest at a table) | down, up, right | 2 each (hand to mouth, hand down) | 1 frame per 700 ms while eating | torso strip `eat`; phase 2 |
| Wave, cheer | down, right | 2 each (arms up) | 360 ms per frame | uses emotePose armLift today (needs torso frames) |
| Dance, laugh, sleep | n/a | dance = walk frames in place + emote offsets, laugh = offsets, sleep = sit + closed eyes | existing emoteAnim offsets and overlays stay | no extra art |
| Face moods | down, right | neutral, blink (1 frame every 3 to 5 s, 120 ms), happy, sad/unhappy (guest unhappy), open mouth (eating, laugh), closed (sleep) | single frames | small art, big feel |
| Carry (staff with a tray) | not needed | held item is code | | |
Frame counts are deliberately small (Stardew and the Soulbound lesson). A longer walk (6 frames) is a later upgrade for the base strip only (every garment then needs 6): decide ONCE in the prototype, never later.
Files per body-attached item: `walk_down`, `walk_up`, `walk_right` (4 frames each, 128 x 64) and `sit_down`, `sit_up`, `sit_right` (1 frame, 32 x 64) = 6 files. Per head-attached item: 3 files (one frame each, up view hair covers the head).

## 5. Colour: ramps, keys and the Endesga 32 (names from shared/palette.ts)
Palette-index swap, done per LAYER, by key colours. A source PNG uses only: (a) KEY colours for the parts that recolour, (b) FIXED Endesga colours for everything else (leather belt, brass buckle, white of an apron when not recoloured, eyes, outline lines), (c) transparent.
- K1 = main colour ramp, 4 keys light to dark: silver, steel, slate, dusk.
- K2 = trim ramp (a second colour in the same layer, e.g. apron straps, a vest's shirt), 4 keys: cyan, sky, navy, pine.
- KS = skin ramp (hands and forearms inside torso/outer art), 4 keys: rose, orchid, plum, magenta.
- Keys only mean something inside their own layer file, so they never clash with real silver or blue in a hat (hats use fixed colours and no keys) or with armour (metal pieces use K1 with an identity ramp [silver, steel, slate, dusk] in the data).
- A test (coder) loads every layer PNG and fails if a pixel is not transparent, a key of that layer's allowed channels or an Endesga 32 colour.
The ramp table is DATA: `shared/data/ramps.json`, keyed by palette NAME, 4 entries light, base, shade, deep. Ramps for every value of LOOK_COLORS (a test demands one for each; unknown = derive with the client's shade helper). Proposed, hue-shifted (warm lights, cool shadows):
- SKIN (5): skin [cream, skin, tan, oak]; tan [skin, tan, oak, walnut]; sand [cream, sand, oak, walnut]; oak [sand, oak, walnut, outline]; walnut [oak, walnut, outline, ink].
- HAIR (8): walnut [oak, walnut, outline, ink]; outline [walnut, outline, ink, ink]; rust [clay, rust, crimson, walnut]; clay [sand, clay, rust, walnut]; gold [butter, gold, orange, oak]; cream [white, cream, sand, oak]; night [dusk, night, ink, ink]; silver [white, silver, steel, slate].
- TOPS (9): crimson [red, crimson, walnut, outline]; green [lime, green, forest, pine]; navy [sky, navy, dusk, night]; plum [orchid, plum, night, ink]; rust [clay, rust, crimson, walnut]; forest [green, forest, pine, night]; orange [gold, orange, rust, crimson]; slate [silver, slate, dusk, night]; cream [white, cream, sand, oak].
- BOTTOMS (8): dusk [slate, dusk, night, ink]; walnut [oak, walnut, outline, ink]; night [dusk, night, ink, ink]; pine [forest, pine, night, ink]; outline [walnut, outline, ink, ink]; forest [green, forest, pine, night]; plum [orchid, plum, night, ink]; crimson [red, crimson, walnut, outline].
- SHOES (5): outline, walnut, ink, oak, dusk: leather ramps like the hair ones.
Rule: shades stay inside Endesga 32, never a new hex. A wider medieval dye set (madder red, woad blue, weld yellow, undyed linen) is reached by adding names to LOOK_COLORS later; ramps come with them. NPC role outfits use the same ramps.

## 6. Render pipeline
Today: avatarParts.ts (boxes, `Part[]`), avatarSprite.ts (AvatarSprite: Graphics views, bob, gestures, held, emote, lying), hatParts.ts (hat boxes), lieArt.ts, guests via guestLook. spriteStore.ts loads PNG kinds from client/src/assets/sprites/<kind>/ and has `spriteFrames(kind, id, tag, frameW)` for strips.
PLAN:
1. spriteStore: add kind `avatar` (SPRITE_KINDS in spriteIndex.ts). File = `<layerslot>_<item>_<anim>_<facing>.png`: `id` = `<layerslot>_<item>` (for example `torso_tunic`, `hair_short`, `hat_straw_hat`, `body_base`), strip tag = `<anim>_<facing>` (`walk_down`, `sit_right`, `still_down` for the head layers). `spriteFrames('avatar', 'torso_tunic', 'walk_down', 32)` already gives the 4 frames (width 128). Naming tests like the furniture ones.
2. A pure layer plan (shared or client, pure): `avatarLayers(look, roleOutfit, facing, pose) -> LayerRef[]` in draw order (section 3), with `hides` and the UP-view order, tested without Pixi.
3. COMPOSE and BAKE (client/src/render/avatarCompose.ts, new): for a look, for (pose, facing, frame): draw the layer images onto one 32 x 64 OffscreenCanvas in order, recolouring each layer first by the key -> ramp lookup (a Map from packed RGBA to the ramp colour, built once per layer and look, applied on ImageData), then ONE outline pass (1 px `outline` colour around the alpha silhouette of the composite; no outline inside), then make a Pixi Texture (nearest). Result cached per (look key, pose, facing) as a frame array; lazily, the first time it is needed; an LRU of about 64 looks (guests and visitors use few). A look change (Avatar panel, a worn hat) rebakes only that look. A PNG's pixels come from spriteUrl() loaded once into a pixel cache.
   Why CPU bake and not a shader: about 10 avatars on screen, 6 to 12 frames each, 32 x 64 px: trivial cost, outline and recolour in one place, works in HTML previews (character creation and Avatar panel: drawAvatarOnCanvas reuses the same bake) and in Pixi, no custom filter, no per-frame work. A GPU LUT shader is possible later if the cost ever shows.
4. AvatarSprite keeps its public API (setLook, update, setHeld, handOffset, gesture, setEmote, setLying, setShift) and swaps the INSIDE: an AnimatedSprite-like frame choice by distance walked (add `distanceWalked` to what update() already gets from Avatar x, y; the sprite keeps the last position), sit/lie as now, the shadow unchanged, head offset table from avatarRig.json (breath, bob, sit), hand anchor per frame for the held item, mood faces from the guest state (unhappy after 90 s, eating), emote frames when they exist (emotePose offsets still apply).
5. FALLBACK TO THE BOX: `hasAvatarSprites(look, pose)` is true only when body_base and every layer the look needs exist for that pose and facing (as furniture needs every facing). Any layer missing = the whole avatar is drawn by the box code as today (no half-sprite avatars), except that a missing HAT falls back to the code hat boxes lowered by +8 px (new crown line -52 versus old -60) until the hat sprite exists. avatarParts.ts stays (and its tests) until the owner signs the new avatar off (then it is retired in one cleanup task, the code hats too).
6. Sizes for the world: `AVATAR_H_PX`, `HEAD_TOP`, `SIT_DROP`, `HAND_Y` become rig data. The emote symbol and name tag position use `headTop` from the rig (the tag floats higher than the tallest hat zone).
7. Tests (pure): frame chosen from distance; head offset tables match frame counts; ramps cover LOOK_COLORS; layer order and hides; key colour test on PNGs; the bake of a 4 x 4 fixture (recolour and the outline pass) compares exact pixels; zero PNGs = box avatar; a look with an unknown clothing id = the free default.
PERFORMANCE: bake at look change only; textures shared per look; no per-frame canvas work; avatars at zoom 3 stay whole pixels (sprites at whole world px, as now). Phone profile: at most 24 distinct looks baked at once.

## 7. Data and save impact (AvatarLook stays compatible)
- AvatarLook {skin, hair, hairStyle, top, shirt, bottoms, legs, shoes, hat?} DOES NOT CHANGE in the first tasks (C17 to C19). Every existing save, guest and clothing id keeps working. Save version: no bump.
- Phase 2 (C21) adds ONE optional field `outer?: string` (cloak, tabard, apron, belt over the top) like `hat?` was added (missing = none, lookAllowed checks ownership). Optional-with-missing-means-none needs no migration, but CLAUDE.md says every shape change bumps SAVE_VERSION: the coder follows the rule used for `hat?` (check shared/src/save.ts) and bumps with a test if in doubt; the manager picks the number (the queue holds 28 and up for other tasks, renumber the later ones).
- clothing.json: additive fields only: `sprite` (layer id if different from `id`), `hides` (hats: none, front, all), `trim` (a ramp NAME for K2, for example an apron's cream), `tags` (medieval, role, npc_only), `npc: true` (never in packs, never in the Avatar panel, only for role outfits). New medieval items are data rows (section 8). Display names change by edit only (an id never changes).
- NEW data: shared/data/avatarRig.json (head offsets and breath per frame, hand anchor per frame, sit drop, hat zone top, WALK_FRAME_PX in config), shared/data/ramps.json (section 5), shared/data/npcRoles.json (section 9).
- guestLook(id) stays seeded and deterministic (a guest keeps the same look after a reload); new free items only widen the pool, so an old id may map to a different look after the data grows: accept it or freeze with the pool size in the seed (coder decides, test it).
- The GameAPI is untouched. The tavern, hotel and visitor code asks AvatarSprite as before.

## 8. The medieval wardrobe (what to draw, in the order of value)
Mapping the current data to a medieval look (display names change, ids stay; the Avatar panel and the Book show the new names):
| id | slot | today | medieval name and look |
|---|---|---|---|
| t_shirt | top | T-shirt | Linen shirt: short rolled sleeves, a lace-up collar, cream/undyed colours first |
| long_sleeve | top | Long sleeve | Peasant shirt: loose sleeves tied at the wrists |
| vest | top | Vest over shirt | Laced vest over a shirt (K2 = the shirt) |
| tunic | top | Tunic | Tunic with a belt, to the knee, a trim band at the hem |
| jerkin | top | Leather jerkin | Leather jerkin with stitched seams and a buckle |
| apron | top | Cook's apron | Apron (K1 apron, K2 the shirt), strap, pocket |
| hoodie | top | Hooded jumper | Hooded cowl-tunic (hood down on the back) |
| wayfarer_cloak | top | Wayfarer's cloak | Travelling cloak with a brooch (outer_back + a shoulder cape front) |
| ember_robe | top | Ember robe | Embroidered robe with a flame hem (long, covers the legs) |
| trousers | bottoms | Trousers | Hose or trousers, boot tops visible |
| shorts | bottoms | Shorts | Knee breeches (bare shins, bare feet or boots) |
| skirt | bottoms | Skirt | Peasant skirt |
| baggy | bottoms | Baggy trousers | Loose farmer trousers tucked into boots |
| overalls | bottoms | Overalls | Work smock-trousers with a bib |
| kilt, breeches, moonweave | bottoms | | Kilt (tartan with a 2 colour check), riding breeches, silk skirt |
| hair: short, long, ponytail, buzz | hair | | Bowl cut, long loose, tied ponytail, shorn |
| hair: braids, bob, curly, mohawk, spiky, top_knot, crown_braid | hair | | Plaits, chin bob, curls, warrior crest, wild, top knot, crowned braid |
New items to add as data later (C21), medieval first: tops: bodice (laced, over a skirt: the "peasant dress"), tabard (a heraldic cloth over the chest, outer), monk robe, scale/quilted gambeson (guards), merchant's coat; outer: apron (move), tabard, cloak, belt with pouch, scarf; bottoms: long robe skirt, hose; hair: bun, tonsure (monk, NPC only), long braid, shaggy; hats: hood, coif, kettle helm (guard), feathered bard cap, merchant's hat, monk's cord is an outer item; shoes style (boots, shoes, sandals) as an optional `shoeStyle` later.
THE 12 HATS (migration). Today they are boxes (hatParts.ts, ids unchanged, `locked` silhouette stays). Redo as 32 x 64 PNGs per facing (down, up, right), same file names `hat_<id>_<facing>.png`; the old code boxes remain the fallback (lowered 8 px). Medieval read and notes:
- straw_hat: wide brim farmer hat (hides front hair). wool_cap: knitted/felt cap with a rolled brim (hides front). cook_cap: tall white cook's cap, uses the full hat zone (hides front). feather_cap: soft felt cap with a long feather (bard, hides front). tavern_keeper_hat: brown felt hat with a brass pin and a gold band. fisher_hat: waxed sailor/fisher hat with a hook. skull_cap: dark close skull cap with a bone charm (hides front). flower_crown: a ring of flowers, hides nothing. knight_helm: a closed kettle/great helm with a plume (hides all). gold_crown: a small gold circlet (hides nothing). sunken_crown_hat: a barnacled blue crown (hides nothing). miner_lamp_cap: a leather cap with a candle lantern clipped on (light stays data).
- Hat sprite rules: the hat's bottom edge is drawn (hat covers the hair line); a fringe or ear of the hair can stay visible when the hat `hides` front only; hats are not recoloured (fixed colours, as now); the crown top never above -64.
NEW HATS for NPC roles only (later): hood (hides all), coif, kettle helm (guard), beret with a feather (bard), merchant's big hat, cook cap (reuse), monk none (tonsure).

## 9. NPCs: guests, staff and roles (variety from few parts)
Guests today: guestLook(id) = a seeded random pick from the free clothing and LOOK_COLORS. After U1 the same function gives much better people with NO new art per guest:
- ONE body (the same as the player), variety by 5 skin x about 8 hair styles x 8 hair colours x 3 to 6 tops x 9 colours x 4 bottoms x 8 colours x 5 shoes = over 100,000 looks; add a rare chance (3 to 5 percent) of a hat (straw hat, wool cap, fisher hat) and a rare apron/cloak outer when it exists. Weighted so villagers look like a village (mostly linen, brown, green, red; rarely plum, orange).
- Small personality hooks by data: kinds (alone, pairs, groups: groups wear similar colours: a "party" colour; a regular (RG-1) has a signature hat). Mood faces: neutral, happy when served, sad when unhappy (the 90 s rule), open mouth while eating. No new rules, only look.
ROLE OUTFITS (fixed looks in `shared/data/npcRoles.json`: { id, name, look, hat?, outer?, tags }; used by staff, visitors, the trader, story NPCs; art is reuse of the same layers plus the few role items):
| Role | Look | Needs |
|---|---|---|
| Cook (kitchen staff, 7.1) | Linen shirt, apron (white K1), trousers, brown boots, cook cap | apron, cook_cap (exist) |
| Innkeeper / barkeep (default owner look suggestion) | tunic, apron or vest, rolled sleeves, tavern_keeper_hat optional | vest, apron, tavern_keeper_hat |
| Barmaid / waiter | bodice or tunic, apron, bun or plaits, plain cap | bodice, apron |
| Guard | gambeson or mail-grey tunic, red/blue tabard with a simple heraldic mark, belt, kettle helm, boots | tabard, kettle helm, belt |
| Knight | silver torso (K1 identity ramp), tabard, plume helm, cloak | knight_helm (exists), tabard, cloak |
| Bard | feathered cap, bright laced vest (plum or orange), hose, a lute as a held item | feather_cap (exists), lute held item (code) |
| Merchant / trader | long coat (plum or green), big hat, belt with pouch, a satchel | merchant hat, belt/pouch |
| Monk | brown robe with a rope belt, tonsure hair (no hat), sandals | robe, tonsure, rope belt |
| Farmer / villager | linen shirt, straw hat, baggy trousers, boots | exist |
| Miner / fisher | lamp cap / fisher hat, jerkin, boots | exist |
| Noble guest (rare) | silk tunic, gold circlet or hat, cloak | cloak, circlet |
Rule: roles reuse the player's clothing layers wherever possible; a role-only item costs 6 body files or 3 head files like any other. Tavern staff (7.1) later get the same bake and cache.
Sizes: all NPCs use the same body and canvas (children and big builds are NOT in v1: the second body doubles every garment).

## 10. Order of work (tasks), with dependencies
A single rule: freeze the rig FIRST (proportions, frame counts, head table, layer list), prototype second, produce third. A change to the base after clothes exist means redrawing them.
Phase P0, decision (no plugin): B7 [artist CODE-ART] silhouette sheet: slim (the current boxes), cosy three-head and chibi as boxes in tools/ (NOT in avatarParts.ts) at zoom 1 and 3 next to a chair, the bar and a door, plus the black silhouette test. The owner picks the proportions (the recommendation is B).
Phase P1, prototype (plugin): A24 body + hair + tunic + straw hat, DOWN facing, walk 4 frames, with the recolour test, beside the box avatar. C17 (rig data, ramps, naming, layer plan, bake with fixtures; no art needed) runs in parallel. The owner signs the CHARACTER STYLE LOCK on A24.
Phase P2, the player (needs the lock): A25 base body all facings (stand, walk 4, sit) + shoes; A26 hair x4 free + x4 medieval; A27 tops x3 free + tunic/jerkin/apron; A28 bottoms x3 free + 3; C18 renderer + fallback (needs A24 files to test, then A25 to ship); face moods A29a.
Phase P3, hats and outfits: A29 the 12 hats; C19 hat migration and name tag/emote anchors; A30 outer layers (cloak, tabard, apron, belt) + new tops; C20 clothing data medieval (rename, new items, `outer` optional, Avatar panel).
Phase P4, NPCs and life: C21 guestLook variety + role outfits + mood faces; A31 role items (kettle helm, monk robe, bard cap, merchant hat, tonsure) and eat/wave/cheer frames; C22 emote and eat frames wiring; later: retire the box avatar, optional 6 frame walk.
Dependencies: C17 first (no art); C18 needs C17; A25 needs the signed lock; C20 needs C18; C21 needs C20 and A30.
Art per round is about 5 PNG files (PLAN-ART-UPGRADE quality gate): the round count is about 12. The artist keeps ONE Aseprite file per layer item with tags `walk_down`, `walk_up`, `walk_right`, `sit_down`... and exports strips with the animate/export skills; the rig table (head offsets) is read from the body file's tags, reviewed by the coder.

## 11. Exact new wording for CLAUDE.md section 8 (the coordinator/owner edits CLAUDE.md; this plan does not)
Replace the whole of section 8 AVATARS with:
```
8. AVATARS
- Layers (U1, owner go 16 Nov): body (head, hands, skin), shoes, legs (bottoms), torso (top with sleeves), outer (cloak, tabard, apron, belt; optional), hair (back and front), face, hat, held item. Body layers are frame strips; head layers (hair, face, hat) are one picture per facing placed by a per-frame head offset (shared/data/avatarRig.json). Each recolourable layer uses key colours that are swapped for a ramp of the chosen colour (shared/data/ramps.json); hats keep fixed colours.
- Proportions: cosy three-head figure on a 32x64 canvas, feet at the bottom centre: about 54 px tall (head 17 px, shoulders 14 px wide) with the hat zone above it (nothing above 64). Down, up, right drawn, left mirrored. Stand = one walk frame; walk = 4 frames chosen by distance walked; sit = 1 frame per facing; eating, wave and cheer add 2 frames each later; face moods are single frames.
- Look: medieval (docs/ART-STYLE.md MEDIEVAL DIRECTION): tunics, jerkins, aprons, hoods, cloaks, tabards, boots, belts. Endesga 32 only; a 1 px dark warm outline is added by code around the composed figure; light top-left. The box avatar (client/src/render/avatarParts.ts) is the FALLBACK until every layer exists and is retired when the owner signs the new avatar off.
- Clothing is data (shared/data/clothing.json; free items, others hidden until unlocked); an id never changes, only its display name and sprite. AvatarLook stays compatible (a later optional `outer`). NPCs (guests, staff, roles) use the same body and layers; roles are data (shared/data/npcRoles.json).
- Character creation once at a new game (look pickers, display name max 16: letters, digits, spaces), then the hotel shape and the shop shape, then the new-game intro in the shop (a tap skips it). The Avatar panel uses the same pickers.
```
Also update: docs/BRIEF.md section 8 (same text), docs/PLAN-ART-UPGRADE.md section 3 (U1 decided yes: this plan), the CLAUDE.md CURRENT STATE line, and the note in docs/TEAM.md that U1 is decided.

## 12. Risks
- Rig changed late: mitigated by B7 + A24 gates and the Soulbound lesson.
- Art volume: 12 hats + 8 hair x 3 files, 15 tops x 6, 10 bottoms x 6: roughly 250 PNGs. Mitigated by head layers static, one body, per round of 5, and the box fallback keeping the game playable all the time.
- Hats and hair clipping: `hides` data and a contact sheet of every hat on every hair (4 x 12 per facing) before sign-off.
- Mirrored asymmetry and the UP view order bugs: tests for layer order; a debug contact sheet tool (tools/avatar-sheet.ts) in C18.
- Performance on phones: bake once, cache by look; checked at 420 x 760.
- Size drop (63 to 54 px): checked in B7/A24 against doors, chairs, the bar; the hat zone keeps the total at 64.
- Unverified references: the memory lines in section 1 are inspiration only; the owner confirms the look on the A24 prototype.
