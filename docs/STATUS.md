# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first, 40 lines max)

Updated 2026-11-17 (batch 1 pushed: icon audit 13 icons, register/lamp heights, hat fixes, ST1 stacked blocks SAVE 32; tester RUN 2 running). NEXT: ST2 (stack look; tap-to-place-on-top needs a design call), tester fix list, artist: shop_rug/mug_shelf/banner, ghost lever, hat PNGs, weak icons (window_curtains, throne_piece, register, cloth, pearl_chandelier).
RESEARCH-VG done (17 Nov): docs/RESEARCH-VISUAL-GAMEPLAY.md; its top 10 tasks (VG-1 to VG-10) are in ROADMAP.md PRIORITY ORDER under RESEARCH. Manager: slot them after the tester fix list.


## Vision check (rewrite each batch): the loop is GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW. Works in code: all steps. Weakest link now: nobody has played it in a browser yet (tester running), the tavern needs life (animation done v1), long-term goals (renown, questline) missing. Bugs and small events may jump the queue; return to this line afterwards.

## Roadmap position
- A CORE FEEL: in progress. Done: hands-on pour, tray, orders strip, first-ten-minutes, UI rounds 1-5, outdoors rework, art R1-R5 (furniture), avatar layers incl. outer pieces, idle/eat/wave/blink strips v1. Open: CH1 DONE (needs a look in the real game: head offsets of idle/eat/wave are guesses), smoothness pass (FIXLIST), first real browser playtest (tester RUNNING), remaining icons, furniture R6 kitchen set, cat drawn + tap lever wiring.
- B BLOCK WORLD DEEP: DG1 layout done, DG2 view done, SG1/SG2/SG4 done, SG3a done (12 blocks). Next: SG3b-d content (crops, drinks, furniture, clothes, styles, specials), SG4b plant tap wiring, SG5 splice preview dialog + Book tab, DG3/DG4 polish and tuning (700 ms bot +15% to look at), DG5 traps only after owner OK.
- C TAVERN DEEP: not started (RN-1 renown, RG-1 regulars, GT-1/NC-1 tastes and guest types, BD-1 board with 9i questline, cleaning, closing report).
- D IDENTITY: avatar style lock open (owner), wardrobe/NPC outfits next, suite showcase, room stars exist.
- E WORLD, F ONLINE: later (step 10 server is a placeholder; online only with owner go).

## Right now (workers)
tester (TESTER RUN 2 -> docs/FIXLIST.md). Animator and artist idle (one Aseprite worker at a time).

## Next up, in this order
1. Tester findings -> coder fix list (severity order).  2. Artist: R6 kitchen set, missing icons, props art (gem_pile, brazier, sarcophagus_small), better eat/wave hands (animator).  3. Coder: SG3b-d, SG4b, SG5.  4. UI worker: UI round 6 from tester findings, hat tab.  5. Coder: GT-1/NC-1/RN-1 tavern depth, 9i questline.  6. Mine/dungeon round 2 only after simulate shows no source over 50%.

## Owner decisions open
Avatar style lock; pushing (allowed for green batches today only, 16 Nov); big tools/plugins need a look first; ranked block values are low (balance floor) - owner may want a bigger rank gap; DG5 traps; dungeon round 2 on.

## Last push: SG3b/c content (8 crops, 10 dishes, 6 drinks, 14 furniture, seeds), R6 kitchen set and dungeon props, check-palette tool. Owner priorities open: starting furniture models and scale (round table, keg, stool, counter), hat not shown when equipped.

## STACKING PLAN (owner OK 17 Nov, tasks ST1-ST5 in docs/QUEUE.md): stacked blocks max 3 -> stack look + fade -> walkable heights -> conveyors (original) -> obstacle courses/showcase. Do ST1 first after the tester fix list.

## OWNER WISHES (17 Nov, from "what I liked in Growtopia"): trading, parkour, building, splicing, showing off, breaking
Have already (solo): building, breaking, splicing, farming. Missing: parkour (needs jumping = side view), showing off to OTHERS (needs visitors/online or NPC visitors), trading (CLAUDE.md says no trading in v1; needs the server, step 10, safety first).
DECISION (owner 17 Nov): NO side-view Block World; the game stays top-down 2D as it is. (Old proposal, parked:) a "Block World" room kind in 2D SIDE VIEW (Growtopia style: gravity, jump, parkour courses, build/break/plant on a grid, same blocks and seeds), reached from the Map; the tavern and hotel stay top-down. Showing off = suite/world showcase with NPC visitors first, real visitors with step 10. Trading = after step 10 with a safe design (no recycle exploits).
So the Growtopia likes are served top-down: building/breaking/splicing/planting (done, keep deepening: more blocks, splice discoveries, Book), SHOWING OFF = suite/room showcase, stars and One Inn score, NPC visitors that react to your build (D pillar, soon), real visitors and then SAFE TRADING with step 10 (online, owner go, safety first), PARKOUR-like fun = timed obstacle/jump-free challenge courses in the dungeon or a block "obstacle course" room kind (later idea, top-down, no jumping).

## NEXT FOR THE ARTIST AFTER THE RESET: ICON-AUDIT (docs/QUEUE.md): wall_clock icon is a sign, music_box icon is a chest, 3 more generic ones; audit all 65 shape icons against their models.

## Left open at the usage limit (17 Nov)
ARTIST: counter_up/right, register, tap_stand (arch with two levers), lamp, menu_board redrawn but NOT seen in the game; still to draw: shop_rug recolour, mug_shelf, banner; ghost lever (static right lever stays visible while the lever strip plays: hide it); coder must align furniture.json heights (register ~34, lamp ~28, menu_board z14-44). Aseprite sources of the last batches are UNSAVED documents in the open Aseprite window (save them to art-src/aseprite/ before closing; the PNGs are exported and committed).
TESTER: running a playtest (TESTER RUN 2 in docs/FIXLIST.md incl. the hat bug); read it first, fix list = next coder task. After it: ST1 stacking, then SG3d, SG4b, SG5.

## Helpers (free workers; test results)
Ollama local (qwen2.5-coder:7b, qwen3:8b): FAILED file-edit test (bad tool calls) 17 Nov, use only for plain text drafting. Gemini CLI: key set, scratch test running. Groq, OpenRouter: waiting for owner keys.
## Stopped by the owner 17 Nov (unfinished, files partly in the tree, NOT committed): ui catalog redesign, coder ONBOARD-1 (name only, guide.json started), artist hood_coif/hats. Resume when the owner says.
