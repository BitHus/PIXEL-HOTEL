# ART STYLE (set by the user, 2026-11-15)

Style references: **Traveller's Rest** and **Growtopia**, "and such games".
These are mood and style references only. Do not copy their assets, characters or exact designs.

## What to take from each
- **Traveller's Rest:** a cozy tavern feel. Warm wood, amber lantern light, soft shadows, lived-in props (barrels, taps, mugs, shelves), a readable top-down/three-quarter view.
- **Growtopia:** chunky, blocky, cartoony tiles. Bright saturated colours, bold dark outlines, simple shapes that read at small sizes, a friendly toy-like look.

## Fixed rules from CLAUDE.md (do not change)
- Palette: Endesga 32 only (hex list lives in shared/palette.ts). Light from the top-left. 1 px dark outline. No anti-aliasing. Nearest-neighbour scaling only.
- Every object shows its top and its front (slight front angle). Cozy medieval tavern: warm wood browns, orange candlelight, deep red and green, many small props, dark warm outlines. The crypt is the opposite: cool, dark, few warm lights.
- Sizes: avatar 32x64 (the box avatar is the approved base, do not change its shape), floor texture 64x64, blocks and icons 32x32. Anchor = bottom centre of the footprint. Furniture is whole 32 px cells.
- Original art only. Never copy another game's assets.

## Working rules (proposal, adjust when the user decides otherwise)
- Chunky silhouettes first; details second. Every piece must read at its game size (cells are small).
- Dark, slightly warm outline on every piece; one consistent light direction (top-left, as the existing art uses).
- 3-4 shades per material, hue-shifted (warm lights, cool shadows), not just darker/lighter.
- Warm tavern palette (wood, amber, cream, brass) with a few saturated accents; keep the existing block colours consistent so carpentry pieces still match their source blocks.
- Reuse the game's existing palette and cell sizes. Pieces must match the fixed ids and sizes in docs/PLAN-1B.md.

## Tooling
- Pixel art is made in Aseprite through the Aseprite AI Artist plugin (installed 2026-11-15; extension 0.8.3).
- OPEN DECISION: the game currently draws art in code (`art`, `icon`, `light` fields in shared/data/furniture/*.json, plus render/). How exported Aseprite sprites get loaded is not decided yet; the lead should plan this before the artist ships any sprite.
