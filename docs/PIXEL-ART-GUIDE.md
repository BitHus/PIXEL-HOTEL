# PIXEL ART GUIDE (artist, 16 Nov): rules and checklists for this project

Read this before drawing or reviewing any sprite, tile, icon or UI picture. It is short on purpose: the rules that matter at 32 x 32 and 32 x 64, in OUR setup
(Endesga 32, a 1 px dark warm outline, light from the top-left, top AND front visible, the Aseprite plugin tools). Style and mood: docs/ART-STYLE.md.
Quality gate and rounds: docs/PLAN-ART-UPGRADE.md section 6, docs/ART-REDO.md. Colour ramps: art-src/RAMPS.md.

## 0. Sources (and how much to trust them)
Good (tutorials by working pixel artists): Derek Yu "Pixel Art Tutorial" (https://derekyu.com/makegames/pixelart.html: big clusters, jaggies, selective outline, one light
from above and in front); Raymond Schlitter "Pixelblog" (Slynyrd, https://www.slynyrd.com/pixelblog-catalogue: 1 Color Palettes, 6 Light and Shadow, 20/43 Top Down Tiles,
21 Top Down Objects, 22/55 Top Down Characters, 50 Human Walk Cycle, 8 Intro to Animation); Lospec tutorial list (https://lospec.com/pixel-art-tutorials, tags dithering, outline,
anti-aliasing; includes Pixel Logic by Michael Azzi, Pixel Art Tutorial 2 shading and hue shifting by Royal Den Studios, Color Blending by mondayjoker); Saint11 (Pedro Medeiros,
saint11.art: animation and small sprite craft) and AdamCYounis (video lessons): named but not fetched, I did not read them here, so nothing below is quoted from them.
Medium (read as a forum, verify): Aseprite community forum answers on lines and jaggies, the "Pixel Grimoire" posts, pixelartnerds and similar SEO pages. Several pages I fetched
did not cover what I asked (Derek Yu has no section on hue shifting; the Slynyrd light-and-shadow post is mostly about light direction and cast shadows). The rest of this guide
is rules I use and checked against the critic findings of our own rounds, marked (our rule) where they are ours.

## 1. The ten rules
1. SILHOUETTE FIRST. Block the shape with 2 to 3 flat colours; if it does not read as a black shape at 1x, no detail will save it. Squint: a few big light and dark masses must show.
2. CLUSTERS, NOT NOISE. Shade with big unbroken clusters; a lone pixel inside a surface is noise (a "stray") unless it is a deliberate detail (rivet, glint, knot). (Derek Yu, Lospec).
3. CLEAN LINES. No jaggies (uneven steps) and no doubles (a line 2 px thick in one place): along a curve the step lengths must grow or shrink steadily (e.g. 6, 4, 3, 2, 1), never random. The
   Aseprite pixel-perfect pen removes doubles while drawing; fix corners afterwards. Straight lines at whole slopes (1:1, 2:1, 1:2).
4. HUE-SHIFTED RAMPS. 3 to 4 shades per material, shadows cooler (toward blue/purple) and lights warmer (toward yellow/orange); never only darker/lighter. A ramp moves about 20 degrees of
   hue per step at most; darker colours may carry more saturation, the lightest step less. Use art-src/RAMPS.md (wood, dark wood, stone, metal, brass, cloth, leaf, glass, clay, thatch).
5. ONE LIGHT: top-left (and a little in front). Top faces and the left edge are lightest, the front is mid, the right edge and the bottom darkest. Cast shadow: one short soft strip to the
   right/below, never longer than a tile.
6. OUTLINE (our rule): 1 px, dark warm (palette `outline`), around the whole silhouette. INSIDE a piece, separate parts with the darkest ramp colour of the material, not the outline colour, unless
   it is a real gap. Selective outline is allowed: lit top-left edges may use the ramp's light colour instead of the outline (Derek Yu "selout"); never leave a gap in the outline by painting a
   highlight over it (the validate tool reports this as "outline breaks").
7. NO BANDING. Two edges that follow the same contour one pixel apart (a lit rim and a shadow rim around a round object) make rings; break the second line, or give the shapes different outlines.
   No pillow shading (light in the middle, dark all round): the light has a direction.
8. NO ANTI-ALIASING, NO SEMI-TRANSPARENCY. Alpha 0 or 255 only. Colours only from Endesga 32; a colour that is "almost" is wrong, snap it (paletteLock stays on).
9. READ AT GAME SIZE. Check every piece at 1x and 3x. A detail smaller than 2 x 2 px is texture, not information: the thing must be recognisable without it. Contrast between neighbouring
   materials must be visible at 1x (wood on wood needs a value step).
10. THE BRIGHTEST, MOST SATURATED COLOUR IS A FLAME, A BANNER OR A TREASURE (docs/ART-STYLE.md). Gold on a piece of furniture is a stud or a rim, not a whole surface.

## 2. Our setup in practice
- Canvas sizes: furniture = footprint width x (footprint depth + piece height); anchor = bottom centre; never trim. Icons 32 x 32 with a free 1 px outer ring. Avatar 32 x 64. Blocks 32 x 32.
- TOP + FRONT view (our rule): a box is a top rectangle (w x d) above a front rectangle (w x h). For a piece with surface height z the top face starts z rows above the footprint:
  row = f + (H - d) - z for footprint row f. Round things (tables, stools, barrels): a stepped circle for the top, a darker offset circle one row lower for the thickness.
- Facings: down, right, up; left is right mirrored. The 'up' picture shows the BACK (a chair's back panel, no handles on the bar); 'right' shows the narrow end plus a long top.
- One frame per facing, tags down / up / right (validate wants tags when a file has several frames).
- ICON = a miniature of the model: same silhouette idea, same ramps, drawn for 32 px, never an auto-shrink.
- Medieval materials: timber (planks with a dark seam every 4 to 6 px, end grain rings), iron (cool dusk/steel/silver with a 1 px bright top-left edge and dark rivets), brass (orange/gold
  highlight), stone (mortar lines), thatch, linen and wool in dull dyes. Heavy timber, iron straps and studs, candles, rushes, banners.

## 3. Topic notes (short)
- CHARACTERS (docs/PLAN-CHARACTERS.md): a big head (about a third of the figure) with a 2 px eye pair carries more personality than detail; roles read by the silhouette (hat, apron, cloak)
  before the face; a hat adds 6 to 12 px above the head; keep the hat zone inside the canvas. Proportions are frozen before clothes are drawn (changing the base means redrawing everything).
- ANIMATION: walk = 4 frames: contact, passing, contact, passing (mirrored); on the passing frames the body is 1 px higher; move arms 1 to 2 px per frame, not more; 8 to 12 fps feels
  right; hold contact frames a little longer. Idle = 2 frames (a 1 px breath). Squash and stretch: keep the volume (a squashed slime gets wider as it gets lower); anticipation before an
  attack (a wind-up frame); a short ease-out. All frames share the same silhouette base and the same number of pixels of limb. (Slynyrd 8, 50, 55; Saint11.)
- TILES AND TEXTURES: the base texture must loop on all four sides (compare left edge with right, top with bottom; tile it 3 x 3 in Aseprite); hide repetition with a few variants placed by
  a hash, a rare detail tile (crack, flower, puddle), and no strong single feature on a tile that repeats. Edge and corner pieces are made by cutting the base tile. Keep drop shadows to one or
  two faces and shorter than a tile (Slynyrd 43). Water: a base tone, light 1 px lines that slide, a dark line 2 px below each light line.
- DITHERING: avoid it on characters and furniture at our sizes; allowed for large soft areas (light pools, fog, a gradient on a wall), pattern = checker or 2 x 2 Bayer, always in two colours
  that are neighbours in a ramp. Never dither to hide a bad colour choice.
- PROPS (top + front): lead with the big form (a barrel is a cylinder: two hoops, a lid, a bung), add 2 to 3 small props that tell what it is for (spigot, rivets, flame), keep one clear lit face.
- MIXED SCALE: a 1-cell chair next to a 3-cell bar: check the pieces together in a contact sheet (tools/art-sheet.ts or a headless Chrome sheet); the same plank width and seam spacing
  (4 to 6 px) on every wooden piece so they belong together.

## 4. Common mistakes (seen in our own rounds)
- Hollow ovals with a white blob (pillows read as fried eggs; an icon read as a face). Fill shapes; shade them on the lower right.
- A flat field: one colour over 60 x 30 px with only a few seams. Add a value step (a lighter top-left band, a darker right band) and 2 to 3 clusters of grain.
- A highlight painted over the outline (broken outline). Keep the highlight one pixel inside.
- Stray 2 x 2 blobs on the top of a post (finial knobs without an outline). Give every detail an outline or fold it into the piece.
- A saturated fill as a trim (a full-width neon brass rail). Use the dark ramp colour for the bar and a 1 px bright line for the highlight.
- Wrong facing: the 'up' view of a chair showing the front. The 'up' view has no seat top; the back panel hides it.
- A top face darker than the front (inverts the light). Tops are the lightest plane (exception: soil, fabric folds).
- Bottom row of a leg or a post clipped or a stray outline row where the object has no ground contact.
- Sprites that are mirrors of each other pixel for pixel (a perfectly symmetrical face or figure looks dead): break symmetry with 2 to 3 pixels.
- Colour sprawl (more than 6 colours in one small material). Re-use the ramp.
- Fixing a sprite by redrawing everything. Use `look` ascii to find the wrong pixels and fix only those.

## 5. BEFORE YOU EXPORT (checklist, every sprite)
1. Brief written (id, size by formula, facings, ramps, light top-left, outline) and the size matches the formula (the spriteAssets test will check).
2. Silhouette reads in black at 1x. A cold read (describe it in one sentence without looking at the id) names the right object.
3. `look` preview at 1x and 3x; `look` ascii on the outline and the anchor row (bottom row, bottom centre).
4. Outline: closed all round, 1 px, `outline` colour; no highlight over it; no doubles; no stray single pixels (except deliberate rivets and glints).
5. Light: top-left on every part; tops lightest; lit left edge; shade right and bottom; 3 to 4 hue-shifted shades per material from the ramps.
6. No banding, no pillow shading, no anti-aliasing, alpha 0/255, palette Endesga 32 only.
7. Details: 2 to 3 props that tell what it is; the brightest colour is on a flame, a banner, a treasure or a stud, not a whole surface.
8. Facings complete (down, right, up as the type's `facings` say; left is never drawn), tags named down / up / right; one doc per piece; icon 32 x 32 with a free ring and the same ramps.
9. `validate` clean: palette, antialiasing, strays, outline (a "straight boundary" banding note on the box edge of furniture is expected; ignore it).
10. pixel-critic read (agent `aseprite:pixel-critic`): no blocking item. Fix, then export (no trim, scale 1x), save the .aseprite in art-src/aseprite, run the vitest spriteAssets test.

## 6. CRITIC RUBRIC (score each 0 to 2; 12 or more of 16 passes, any 0 on silhouette, outline or palette blocks)
| Item | 0 | 1 | 2 |
|---|---|---|---|
| Silhouette and read | not recognisable | recognisable with the label | recognisable cold at 1x |
| Outline | broken or doubled | small breaks | closed, 1 px, clean |
| Palette and alpha | off palette / soft pixels | one stray colour | Endesga only, alpha 0/255 |
| Light and form | flat or inverted | partly lit | top-left, tops lightest, 3 to 4 shades |
| Clusters and noise | noisy, strays | a few strays | big clusters, deliberate details only |
| Material read | wood/iron/stone not told apart | partly | each material clear (seams, rivets, mortar) |
| Medieval mood and props | modern or empty | some props | heavy timber / iron / brass, 2 to 3 telling props |
| Fit to the set | clashes with neighbours | similar | same ramps, plank width and outline as the rest |
Report format: score, blocking issues with x,y, non-blocking notes. The artist fixes blocking issues and re-checks; two failed tries mean the code art stays.
