# PLAN-ANIMATION (artist, 16 Nov): animated props, one page

Rules: whole world px, built once (textures drawn to a canvas on first use, shared), per frame only a texture swap or a moved pooled square (no Graphics redraw).
Flames are children of the item container (depth order and hiding follow the item); particles are one pooled sprite layer (render/propAnim.ts, pure numbers in
propAnimSpecs.ts, tests in propAnimSpecs.test.ts). Hooks: ItemViews (attach in sync, update in update, `props`), TavernFx.onSparkle (register ding),
TableMess.steamSpots (meal steam, fed in gameLoop). Table of what animates: PROP_ANIMS in propAnimSpecs.ts.

| Prop | Animation | Kind | Timing |
|---|---|---|---|
| lamp, ember_lamp, glass_lamp, lantern_post, hanging_lantern, iron_chandelier (5 candles) | tiny flame, 4 frames | code frame loop | 100-150 ms per step, own pace per flame, short frame when the light dips |
| skull_lamp | cold ghost flame | code frame loop | same |
| wall_torch | torch flame + sparks + thin smoke | loop + particles | sparks 0.9 s, smoke 1.5 s |
| stove | fire window 14x9 (4 frames) + chimney smoke | loop + particles | smoke 1.1 s; strip `stove_fire.png` (4 x 14x9, 120 ms) replaces the frames if present |
| stone_fireplace, brick_oven | big/medium fire, embers (+ oven chimney smoke) | loop + particles | embers 0.4-0.8 s |
| brewing_barrel | bubbles from the bung | particles | 0.6 s, 650-1000 ms life |
| tap_stand | drip at both nozzles | pooled state loop | 3.4 s: hang 0.9 s (1 to 2 px), fall 0.22 s, splash 0.14 s |
| register | drawer pops 0/2/4/5 px, coins show, 5-frame glint | event (TavernFx sparkle at the register) | 650 ms |
| table dishes and drinks (full, being eaten) | steam wisps, swaying, 3-4 alpha steps | particles | hot 0.45 s, drinks 1.1 s, max 8 spots |
| window_curtains | dust motes drifting in front (the light-pool dust stays in atmosphere.ts) | particles | 0.9 s, 4.5-7.5 s life |
| pearl_chandelier, shell_lamp | pearl twinkle (5-frame glint) | frame loop | every 3.3-4.1 s |

Reduce effects: particles, drips and motes off; flames, glints and the register keep running. OS prefers-reduced-motion: flames hold on frame 0, no glints.
Strips: a furniture strip is `<typeId>_<tag>.png` (horizontal equal frames), loaded by spriteStore (isFurnitureStrip), read by spriteFrames('furniture', id, tag, frameW).
Not drawn yet: Aseprite strips (stove_fire first; the code frames are the fallback). Gentle plant sway skipped (1 px sway reads as jitter at this size).
