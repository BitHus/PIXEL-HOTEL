# TOOLS AND NEW DECISIONS (every manager and worker reads this at startup; the manager keeps it current)
Updated 19 Nov 2026.

## Art tools (CLAUDE.md section 14 'Art tools')
- ASEPRITE plugin (owner 15 Nov): one instance only, preflight first, docs/ART-WORKFLOW.md.
- PIXELLAB MCP (owner 18 Nov, NEW): AI pixel art, the owner LOVES the style of art-src/pixellab/refs/couch.png + statue.png (chunky, glossy, bold dark outline, bright flat shading, top-down with slight front angle). Perspective stays top-down: isometric was tested (create_isometric_tile) and rejected as ugly, do not retry.
  Load tools with ToolSearch (select:mcp__pixellab__create_object_pro_flash,...get_object,wait_for_jobs,get_balance,expand_object_to_8_directions,create_ui_asset,create_ui_states). Plan, pipeline and LEDGER: docs/PLAN-PIXELLAB-ART.md.
  Pipeline: generate (64x64 object = 5 generations; the 8-direction expand is cheaper than new creates, 10 per 64x64) -> tools/pixellab-fit.mjs (trim, fit footprint, Endesga 32 snap, ROT=_right|_up) -> client/src/assets/sprites/furniture/<id>.png (only ids in furniture.json) -> node tools/check-palette.mjs (bad 0) -> npm run check. States by pixel edit: tools/gen-pixellab-states.mjs.
  RULES: original designs only (never name Habbo or another game in a prompt); ONE PixelLab worker at a time; budget is shared: check get_balance before and after, stop at the cap in docs/PLAN-PIXELLAB-ART.md (owner cap 19 Nov: about 1500 generations used (+500 on 19 Nov); 200 reserved for the new UI art), update the LEDGER. Contact sheets for the owner go to C:\Users\ajren\Desktop\PocketBarrel-styletest\<batch>\ (4x or 6x nearest neighbour).
- Playwright (browser testing), pixel-critic (aseprite QA), tools/view-sprite.mjs, tools/profile-tavern.ts, `npm run check` (tests + typecheck + build, read the exit code).

## Owner decisions (18-19 Nov) every worker must know
- Look: PixelLab chunky glossy style, top-down. New pixel-art UI is coming (proof set in art-src/pixellab/ui, wiring by the ui worker).
- UI must be CALM (docs/PLAN-UI-DECLUTTER.md): 4 side buttons (Catalog, Build, Dungeon, More); the HOTBAR and Bag stay full size and NEVER fade or hide (gameplay); everything the player uses mid-play stays in view.
- Kitchen = open annex of the tavern; cellar = separate room; dig mine without lantern; trader removed; level cap 12.
- Model rule: workers are sonnet or opus only. Fewest tokens, quality kept.
- Owner permission (durable): merge, push and deploy after every green batch.

## Startup checklist for any session
1) docs/STATUS.md, top of docs/NEWS.md, this file, docs/PLAN-PIXELLAB-ART.md ledger. 2) git status. 3) Aseprite preflight and PixelLab get_balance only if you do art. 4) Do not start overlapping workers on the same files.

## PixelLab credits (owner 19 Nov)
The artist (and any art worker) MAY spend PixelLab generations within the cap in docs/PLAN-PIXELLAB-ART.md for furniture, UI, logo, icons, props, tiles. No permission needed inside the cap; check get_balance, update the LEDGER. The manager raises the cap only when the owner says so.

## Fonts (owner 19 Nov): better fonts allowed
The owner OKs downloading better fonts. Rules (CLAUDE.md section 12): local open-license (OFL) pixel fonts only, shipped inside the repo (client/src/fonts or @fontsource npm packages, no CDN at runtime), never set font-family without var(--font). Now: Pixelify Sans + Jersey 15. Candidates to try: Silkscreen, Press Start 2P (too wide), m6x11, Pixel Operator, Tiny5, VT323, Bitcount, Jacquard/Pixelify variants; judge readability at 12-16 px on phone 420x760 and the medieval mood (headings may use a more characterful font, body stays very readable). Check ligatures stay off (Pixelify 'fi' bug). PixelLab has create_font (costs generations: ask first).

## ART RULE (owner 19 Nov): NEVER squeeze or stretch sprites
No squeezing, no stretching, no non-uniform or fractional scaling of any sprite to fit a footprint (it ruins proportions: tiny chairs, flat tables). If art does not fit, REGENERATE it at the right size/proportion (PixelLab width/height in multiples of 4), or change the footprint in data. tools/pixellab-fit.mjs must only trim, pad and snap colours (no downscale, no row stretching); a sprite may be taller or wider than its footprint (anchor bottom centre, overlap is fine). Seats must be at least as tall as the plain chair (48) next to the 54 px avatar.
