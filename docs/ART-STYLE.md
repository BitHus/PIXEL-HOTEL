# ART STYLE (set by the user, 2026-11-15)

Style references: **Traveller's Rest** and **Growtopia**, "and such games".
These are mood and style references only. Do not copy their assets, characters or exact designs.

## What to take from each
- **Traveller's Rest:** a cozy tavern feel. Warm wood, amber lantern light, soft shadows, lived-in props (barrels, taps, mugs, shelves), a readable top-down/three-quarter view.
- **Growtopia:** chunky, blocky, cartoony tiles. Bright saturated colours, bold dark outlines, simple shapes that read at small sizes, a friendly toy-like look.

## Fixed rules from CLAUDE.md (do not change)
- Palette: Endesga 32 only (hex list lives in shared/palette.ts). Light from the top-left. 1 px dark outline. No anti-aliasing. Nearest-neighbour scaling only.
- Every object shows its top and its front (slight front angle). Cozy medieval tavern: warm wood browns, orange candlelight, deep red and green, many small props, dark warm outlines. The crypt is the opposite: cool, dark, few warm lights.
- Sizes: avatar 32x64 (the box avatar is the fallback only; the real pixel avatar is U1, docs/PLAN-CHARACTERS.md), floor texture 64x64, blocks and icons 32x32. Anchor = bottom centre of the footprint. Furniture is whole 32 px cells.
- Original art only. Never copy another game's assets.

## Working rules (proposal, adjust when the user decides otherwise)
- Chunky silhouettes first; details second. Every piece must read at its game size (cells are small).
- Dark, slightly warm outline on every piece; one consistent light direction (top-left, as the existing art uses).
- 3-4 shades per material, hue-shifted (warm lights, cool shadows), not just darker/lighter.
- Warm tavern palette (wood, amber, cream, brass) with a few saturated accents; keep the existing block colours consistent so carpentry pieces still match their source blocks.
- Reuse the game's existing palette and cell sizes. Pieces must match the fixed ids and sizes in docs/PLAN-1B.md.

## MEDIEVAL DIRECTION (owner 16 Nov: they love medieval-style pixel games; every art round follows this)
The world is a small medieval inn and village: no modern shapes, no plastic, no neon, no zips, no logos, no T-shirt or jeans look. Original designs only (mood, never copies).
- MATERIALS (what things are made of, and how each reads in 3 to 4 shades): oak and pine WOOD (planks with a dark seam line every 4 to 6 px, end grain rings on cut ends); IRON (cool dusk/steel/silver, a 1 px bright edge top-left, dark rivets); COPPER and BRASS (orange/gold, warm highlight, green verdigris patches on old pieces); STONE (slate/steel blocks with mortar lines, moss in the shade); THATCH (sand/gold straw in rough rows); PLASTER (cream with brown timber frame, half-timber); LEATHER (walnut/oak with a gold stitch or buckle); LINEN and WOOL (cream, sand, undyed greys and dyed madder red, woad blue, weld yellow, forest green: dull dyes, never pure saturated ones); CANDLE WAX (cream with a butter flame).
- COLOURS: warm dark outline (outline/ink), warm browns for the world, deep red (crimson), forest and pine green, woad navy and plum as noble accents, gold only for rank and treasure. The brightest, most saturated colour on screen is a flame, a banner or a rare item. Lamps and candles are orange light with a cool shadow side.
- PROP VOCABULARY (use these, repeat them, add small ones): barrels and casks with iron hoops, kegs on racks, tankards and wooden mugs, jugs, bread, cheese wheels, hanging hams and herb bundles, sacks, crates, rushes and straw on the floor, candles in iron holders and wall sconces, chandelier rings, hearth with a cauldron, iron stove, benches and trestle tables, three-legged stools, chests with iron bands, shelves with bottles, rope, lanterns on hooks, banners and heraldic shields (simple shapes: a bend, a cross, a chevron, a lion or a stag as 3 to 5 blocks), antlers, tapestries, rugs with simple borders, arched doors with iron hinges, shuttered windows with small panes, signs on iron brackets, a well, a cart, hay, fences of split logs, stone walls with moss, thatched roofs, cobbles and dirt paths.
- CLOTHES AND PEOPLE: tunics, jerkins, laced vests, aprons, hoods, cloaks with a brooch, tabards, belts with pouches, leather boots, hose, peasant dresses, kirtles, coifs and caps; roles read by a few strong items (cook cap and apron, guard kettle helm and tabard, monk's robe and cord, bard's feathered cap and lute, merchant's pouch and big hat). Detail in docs/PLAN-CHARACTERS.md.
- SHAPES: chunky and slightly crooked (hand-made, not machine-straight): uneven plank heights, bent signs, a patched sleeve. Shapes read as a silhouette first. Heraldry and banners use 2 or 3 colours only.
- DO NOT: modern objects (plastic, glass bottles with labels, bright electric light), guns, modern fashion, real heraldry of real families, real-world logos. Fantasy touches (glowcap lamps, slimes, crypts) stay inside the same material language.
- CHECK before a round is signed off: could this sit in a medieval inn without anyone blinking? Is the material readable at game size? Is the colour in the allowed set?

## Tooling
- Pixel art is made in Aseprite through the Aseprite AI Artist plugin (installed 2026-11-15; extension 0.8.3).
- OPEN DECISION: the game currently draws art in code (`art`, `icon`, `light` fields in shared/data/furniture/*.json, plus render/). How exported Aseprite sprites get loaded is not decided yet; the lead should plan this before the artist ships any sprite.

## Read first
Artists and UI workers: read docs/PIXEL-ART-GUIDE.md (technique rules, the before-you-export checklist and the critic rubric) before any art task.
