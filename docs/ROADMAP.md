# ROADMAP
18:19 NOV (artist ICONS-2): [x] 169 icons: crops, seeds, drinks, dishes, fish, 27 materials, hats/tops/bottoms/outer, hair, 24 code-only UI names (sheet method, 78 gens); [ ] skill node icons (PLAN-SKILLTREE), pack/gem tier icons, 16 px variants, ids with no art: sticky bits like furniture without PNG.
19 NOV (coder TF-6/7/9, owner go): [x] TF-6 bar guests drawn (lean/drink poses, mug on the bar, spot markers, hand-over reach), TF-7 strip (bar/table badge, pouring, Grab all, Serve all, tray tap), TF-9 balance (BAR_SHARE_ASSUMED 0.3, test + simulate), BAR_GUESTS_ENABLED = true. [ ] TF-8 art (facing right/down poses, chip icons, marker art), TF-10 variety.
19 NOV (coder TF-1..5): [x] TF-1 bar spots, TF-4 chips where/pouring + grabAll + serveRoute, TF-2 chooseSpot + bar guests in the step, TF-3 handOver, TF-5 GameAPI grabAll/serveAll/handOver (all behind BAR_GUESTS_ENABLED=false). [ ] TF-9 balance sim + owner OK of the BAR_* numbers, TF-6 render, TF-7 strip UI, TF-8 art, TF-10 variety.
19 NOV (coder RUN8-9-CODE): [x] pourBarShouldShow + test; RUN 8 items 8 and 10 confirmed fixed; UNHOOKED_STATS (bait, deep cast, bag slots) still open.
18 NOV (coder RUN8-FIX): [x] RUN 8 items 1-6, 8-11 fixed in client/src/ui (not seen in a browser).
18 NOV (tester RUN 8): [x] open kitchen, first serve, Lantern Dark and dig mine walked in a browser on desktop and phone (e2e/run8.spec.ts, docs/FIXLIST.md RUN 8): 0 errors; open: pour bar too big on phone, OPEN sign, Skills icons, mine HUD says Crypt.

17 NOV: [x] TUT-2 tutorial (18 steps, always starts in a new game, Continue resumes) and small fixes (bubble vs buttons, Continue fade). [x] TUT-2 part 3 (built 17 Nov, coder; owner check in a browser pending): Daily / Events / Achievements quest panel (ledger-counted, SAVE 33 quests.claimed).
18 NOV (coder, last): [x] OPEN KITCHEN: annex about 2x bigger, no partition/doorway/door art (kitchenWallArt retired), compact start layout (SAVE 40). [ ] seen in a browser.
18 NOV (coder, late): [x] KITCHEN ANNEX replaces the walled ring (SAVE 39), fixed tavern shape (no shop-shape pick), round table retired for the square table, cellar door offers the build, farm art (scarecrow, straw bale, farm barrel, grass_b/c, kitchen_tiles) wired. [ ] seen in a browser.

18 NOV (artist MG-15 part 1): [x] dig mine block tiles, cracks, glint, cave-in states, exit tile, rock beetle PNGs + digArt.ts wiring. Open: skill/gear icons, exit and beetle hooks.
18 NOV (coder MG-7): [x] skill stats hooked into the rules (skillRules.ts, tests) and the Skills panel (More > Skills, tabs, tier locks, Learn/Respec ask first). Open: unhooked stats (see NEWS), dot on the button, art for skill icons (MG-15).
19 NOV (coder): [x] CAM-LOCK v2: always locked in play mode, Look around toggle in More, Settings camera option removed, first view centred in the free area (phone bug RUN 10 item 5; not seen in a browser on a phone).
18 NOV (coder): [x] kitchen is a walled tavern area (SAVE 37), CEL 3 racks 2/3/3, trader removed (guests + dungeon only), MG-1 skill rules + API (SAVE 38) and MG-2 level cap 12 (UI and rule hooks MG-7/8/9 still open), tap forgiveness, tutorial from 0 with zoom/tap/hold steps. [x] RUN 6 UI fixes (keg rack text, first-steps card off doors, fi ligature, bubbles vs button column); open: kitchen barrel under the phone button column (camera/layout hook).
19 NOV (artist): [x] PixelLab UI proof set (panels, buttons, tab, sign, bar, 10 icons) in art-src/pixellab/ui, not wired; wiring = ui worker after owner OK.
19 NOV (artist ICONS-1): [x] 42 PixelLab icons (items + UI side/More icons, catalog, packs) wired through sprites/icons and ui/icons; [ ] part 2: crops, food, drinks, fish, remaining materials, skill node icons, pack/gem tier icons, 16 px small-spot variants.
19 NOV (ui): [x] title screen reworked (Continue pill, save line, still-life) + dark panel frame wired into panelShell panels (border-image); [ ] tabs, round buttons, bar, parchment still unwired.
19 NOV (ui): [x] Panel close button wired to PixelLab close X art (ui/close.css, assets/ui/close_x.png).

The one roadmap for the game (owner + AI, 14 Nov). It replaces the loose idea list. Work top to
bottom. A phase is finished before the next one starts, unless the owner says otherwise.
How it works:
- Each numbered item becomes one step: a prompt in docs/NEXT-STEPS.md, one fresh session, one PR.
- Items marked [prompt ready] already have their prompt in docs/NEXT-STEPS.md.
- After each step: tick it here (move it to DONE) and update CLAUDE.md (short) and docs/NOTES.md.
- New ideas go in the IDEA POOL at the bottom, not into a running step.

The identity: hotel management + dungeon loot + workshop + pets + collectibles. Every part feeds
another part (gather -> craft -> decorate / upgrade -> earn -> go further), the player always has
something to look forward to, and the hotel and shop show what the player has achieved.

## 17 NOV OWNER SESSION (manager; this block comes first; details in docs/STATUS.md and docs/OWNER-AGENDA-17NOV.md)
DONE 19 NOV: STOVE 2 x 1 cells (SAVE 41, widenStoves). REVIEW 17 NOV fixes 1-5 done (daily re-claim, dead runs, level-up re-roll, ripe sparkle, ledger fold SAVE 34), tutorial stove supplies, guest walk on real elapsed time; open: crates/barrels/statues in the crypt look solid but are walkable (design question).
Live: https://pocketbarrel.com (PB-2/PB-3 done: domain, VPS, HTTPS, tools/deploy.sh). Done today: CAM-LOCK (camera locked on the walking avatar), ST2, ST3 (walkable heights), SG5/SG6, PB-1 rename, OA-1 hold-walk, OA-4/13/14 (quest hold, centered camera, open sign), OA-5 stove/barrel states, OA-2/12 table plates, OA-6 bar extension, OA-9 dungeon placement, OA-10 free wall items, HUD round 1, ON-0/ON-1 server skeleton + cloud save (flag off), ON-6/ON-7 prep (tools/ops + docs/OPS.md written, NOT run on the VPS). 18 NOV: locked camera has no edge clamp; rock PNGs wired; PERF-2 useContextAlpha:false (ticker pause/pooling not done).
17 NOV PLANS: [~] OA-7 cellar + kitchen room: docs/PLAN-CELLAR.md, CEL-1..5 and CEL-7 done 18 Nov (SAVE 36, doors, kitchen free, cellar built from the Room panel, reserve tier, tutorial steps); open: CEL-6 cask chips/ripe dots (basic tier chips done), CEL-8 art, CEL-9 decor, CEL-10 playtest, balance CEL 3 fixed 18 Nov (racks 2/3/3); the KITCHEN ROOM was replaced by a walled tavern area (SAVE 37). [ ] OA-8 upgrade points: docs/PLAN-UPGRADES.md, tasks UPG-1..UPG-8 (numbers are PROPOSALS).
18 NOV (coder MG-3): [x] dig mine first slice: generator, dig step, cave-ins, exit/deeper, skill hooks (light, ore sense, careful step, treasure sense), client path with code-art. Open: MG-4 extras, MG-5 art/UI polish (see NEWS).
23:17 NOV PLANS: [ ] MG-1..MG-16 minigames (docs/PLAN-MINIGAMES.md): dig mine with exit and rare blocks, dungeon round 2 content, minigame gear, skill tree (supersedes UPG when the owner agrees). Numbers are PROPOSALS.
19 NOV (coder 3d): [x] KITCHEN ABOVE the tavern + MODULAR BAR + new start layout (SAVE 42, NOTES MODULAR BAR + KITCHEN ABOVE). [ ] Open: long shape bar is 3 pieces (annex 4 cells wide; widen it and move its suite/garden doors), browser check of the new start view, corner/T bar pieces in build mode by hand, tutorial pointer on the stove/barrel in the annex above.
Next in order: TUT-2 (one big tutorial + daily quests, event quests, achievements, OA-15) -> TF-1..TF-10 tavern flow (docs/PLAN-TAVERN-FLOW.md) -> FUN top 5 (docs/PLAN-FUN.md, events and things to do) -> OA-3 fishing redo (docs/RESEARCH-OA.md) -> OA-7 cellar + kitchen room (owner checks numbers) -> OA-8 upgrade points -> ON-2.. online P1/P2 (docs/PLAN-ONLINE.md) -> ST4 conveyors, SG3d, RN-1 renown, VG tasks. Art done 17 Nov: tap_stand_dry redo, wet tweak, bar-guest poses lean+drink (up, staging). Tap lever pull back (19 Nov, pixel edit, NOTES pourFx LEVER). Art pending: ripe sparkle hook, bar-guest poses facing right/down.
17 NOV: [x] OA-11 r2 run HUD (ui): dungeon/mine bottom pill with bag used/12 (tap = drawer), gold, gems, potion Q, food E, Leave/Abandon; slim info panel during a run. [ ] crypt Abandon needs the coder to pass onAbandon in game/uiShell.ts.
17 NOV: [x] UI audit round (ui): phone and desktop screens checked, chat lines no longer cover order icons.
DOC RULE (owner 17 Nov): every worker updates the docs and the roadmap: tick or add the roadmap item, NEWS entry, NOTES section, CLAUDE.md/BRIEF line when a rule changes; the manager rewrites docs/STATUS.md after every batch.

## PRIORITY ORDER (manager decision 16 Nov; the owner said: look at the whole roadmap and decide; this order wins over the phase order below)
THE GAME IN ONE PAGE: docs/GAME-VISION.md (owner 16 Nov: combine Growtopia + Travellers Rest + Habbo into one logical game). Three pillars: the TAVERN is the heart (Travellers Rest), the BLOCK WORLD is the engine (Growtopia/Pixel Worlds: blocks, seeds, open splicing, gems), IDENTITY AND HOME (Habbo: avatar, suite, stars). One loop: GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW -> deeper GATHER. Where the list below disagrees, this order wins:
 A. CORE FEEL now: hands-on pour + deliver, smoothness, first ten minutes, art pass (floors/walls, furniture, icons, avatar), headless-Chrome test after every batch.
 B. BLOCK WORLD DEEP: plant on any block, open splicing + preview + Book Splice tab, dungeon layout redo (docs/PLAN-SPLICE-DUNGEON.md).
 C. TAVERN DEEP: Inn Renown ranks (RN-1), regulars and guests with tastes (RG-1, GT-1, NC-1), orders board without timers (BD-1, with 9i questline), menu tiers from splice foods, cleaning + closing report, staff and guest rooms, big projects.
 D. IDENTITY AND HOME: finish avatar/NPC redesign and wardrobe, suite showcase, room stars and One Inn score, pets, pastimes, titles and badges.
 E. WORLD: new areas, seasons and events, deeper dungeon and mine, potions and accessories.
 F. ONLINE (owner go): safety first (mute/report/filter/server limits), then visits by name, lobby tavern, leaderboards; trading stays held.

Rule: the game must be fun and good-looking in a browser BEFORE it gets bigger or online. Depth that feeds the existing loops beats new areas.
VIBES FIRST (owner 16 Nov, updated): the game must look and feel like a cozy MEDIEVAL pixel game (Travellers Rest is the reference; see docs/ART-STYLE.md MEDIEVAL DIRECTION). Four art/feel tracks run in parallel with the features and rank above 2 onward: (A) furniture and item redo with matching icons (docs/ART-REDO.md); (B) CHARACTERS: a real pixel avatar and NPCs, medieval outfits and hats (docs/PLAN-CHARACTERS.md; U1 approved); (C) the OUTDOORS REWORK (1b below); (D) medieval content: new furniture, clothes, recipes and decor in medieval style (anvil, weapon rack, banners, chandelier, hearth, trestle tables).
NOW (in progress): outdoor tree/farm/door art hooks wired (NEWS OUTDOOR-HOOKS); C6 done; N1 done; art redo round 2; C11 outdoors hooks; character plan being written.
RESEARCH (17 Nov): docs/RESEARCH-VISUAL-GAMEPLAY.md (Habbo, Pixel Worlds, Travellers Rest: visuals + gameplay, original takeaways). Top 10 ranked tasks (details and sizes in that file, section 3):
   1. VG-1 ready dots + context hint chip (T, S-M, ui+coder). 2. VG-2 ONBOARD-1 first reward in 90 s + replayable guide (T, S, coder). 3. VG-3 RN-1 renown ladder with 3-unlock preview, first rank in 15 min (T, M-L, coder). 4. VG-4 JU-1 juice + ready idle fx (T, M, artist+coder). 5. VG-5 decor sets with set bonus (I, M, coder+artist).
   6. VG-6 share card + room postcard PNG (I, M, ui+coder). 7. VG-7 AU-1 sound bed (T/I, M, coder; owner OKs audio source). 8. VG-8 titles, emotes, held mug idle (I, M, coder+animator). 9. VG-9 next-small-thing line + away-report hook (T, S-M, coder). 10. VG-10 light as decor: glow + appeal tick (I, S-M, coder+artist).
1a. FROM THE DEEP DIVE (docs/RESEARCH-DEEP.md, 16 Nov; learned from Travellers Rest, Growtopia, Pixel Worlds, Habbo):
   - FP-1 first ten minutes: a skippable, short scripted opening with one-time tooltips (Travellers Rest players complain about a long, unclear, unskippable tutorial). Coder, no save change. Goes with the playtest.
   - JU-1 juice on the tavern loop (pour splash, coin arc, steam, guest reactions) and AU-1 sound and music (artist + coder): the vibes track; do these next to the outdoors rework.
   - GT-1 guests with tastes and NC-1 special guest types (with RG-1 Regulars), DS-1 decor sets, CL-1 cleaning, CR-1 closing report, GP-1 big projects, QL-1 small comforts: tavern depth, after 9g-2 (players praise decorating and variety, and complain of nothing to do after unlocks: keep long goals coming).
   - Safety lessons confirmed: Growtopia lost days to a recycle exploit and Pixel Worlds reset its economy, Habbo lost trust over chat and trading. Keep: no trading, no real money, balance tests as a gate, server authority later.

1. Playtest 2.1 + first-hour pass 2.3 (a real hour in a browser, one fix list; the owner or a browser-capable tester). Nothing else beats finding what is broken.
1b. OUTDOORS REWORK (owner 16 Nov: the dungeon and the fishing/lakeside look ugly; art and vibes, runs in parallel with 1): docs/PLAN-REWORK-OUTDOORS.md, tasks C11 to C16 (hooks + fx, dungeon juice, fishing/lake juice, crypt light, lakeside ambient, effects settings) and A15 to A23 (code-art crypt and lake now, PNG tiles/enemies/water/trees when the plugin is back), prompts in docs/QUEUE.md. Look and feel only: no rule and no save change. It goes before 2 (9g-2 and the rest) in both lanes.
1c. CHARACTERS U1 (owner 16 Nov, vibes: a real MEDIEVAL pixel avatar and better NPCs, Travellers Rest as the example; lifts the box avatar rule): docs/PLAN-CHARACTERS.md, tasks B7 (proportion sheet, no plugin, first), A24 prototype and style lock, C17 rig data, then A25 to A31 and C18 to C22, prompts in docs/QUEUE.md (CHARACTERS U1). The MEDIEVAL DIRECTION in docs/ART-STYLE.md applies to every art round. Runs in both lanes next to 1b; the box avatar stays as the fallback, no save change before C20.
1e. STACKING (owner 17 Nov): stacked blocks, walkable heights, conveyors, obstacle courses: docs/QUEUE.md ST1-ST5, after the tester fix list and the polish batch.
1d. DUNGEON REDO + GROWTOPIA SPLICING (owner 16 Nov, vibes/fun, rank high, runs in parallel with 1b and 1c; lifts the dungeon corridor/room rule and the soil-only, table-only splice rule): docs/PLAN-SPLICE-DUNGEON.md (exact CLAUDE.md wording in section 0), prompts in docs/QUEUE.md. Part A DG1 to DG5 (short corridors, varied rooms, nooks, secrets, landmark, pacing; traps/puzzle last, owner OK), part B SG1 to SG6 (general splice rule + specials, plant on any block, preview, Book tab, ~90 new seeds) with balance.test.ts as the gate, artist DA1/SA1/SA2 code-art first. Save bump only in SG4 (and DG5).
2. 9g-2 usable furniture and the cat (save 28), with PT-1 pastimes folded in; 9g-3 room stars; M-C One Inn score. These make the hotel and tavern feel alive.
3. 9i questline with BD-1 board orders (no timers): gives the player direction; fixes the first hour.
[x] 19 NOV furniture audit: plant, desk + 9 props redone (docs/NEWS.md FURN-AUDIT).
4. Art rounds continue every cycle (4.2 to 4.6): floors, walls, crops, food, tools, plants, avatar clothing. Art is always one lane busy.
5. 9h dungeon round 2 (after `npm run simulate` shows no source over 50%) and 5.5/5.4 deeper dungeon and mine.
6. RG-1 Regulars and RN-1 Inn Renown (the best research ideas: they make the tavern sticky). Then 5.1 pets, 5.2 potions and accessories, SM-1 slow makers (first slice of 5.3).
7. Phase 3 goals: skills 3.1, achievements and titles 3.2 (with TB-1), collections 3.3; 5.7 hotel 2 furniture sets; 5.8 world life (day/night, weather).
LATER (only after all of the above feels good): 9g-4 visitors, 5.6, 7.1 Tavern 2 (staff), JR-1 recipe journal, SE-1 seasons, 7.2 new areas, 7.3 random events, 7.4 buildings.
ONLINE (phase 6, step 10): after depth and a clean playtest. Order inside: AM-1 and SF-1 safety first, 6.1 server, 6.2 visits, then the rest. Needs the owner's go.
NOT NOW: phase 8 release (name, legal, Windows app) until the game is playable end to end; trading and marketplace and PvP stay held; real money, daily rewards, limited offers and lucky wheels stay rejected.

## LOGO (19 Nov): PocketBarrel animated logo done (logo.gif + favicon.png), see NEWS.

## DONE
Since 15 Nov (all merged and pushed 16 Nov): K2 casks and ripening, MB-2/MB-3 doors, hats and emotes (9g-1), usable furniture + cat rules + room stars (9g-2, 9g-3), first ten minutes (FP-1), tavern juice and sound (JU-1, AU-1), hands-on pouring, outdoors rework (crypt and lakeside art, effects, light, life), UI skin rounds 1 to 3, redrawn icons (63+), furniture redo R1 to R3, avatar layer art (down/up/right), medieval furniture, pixel art guide, research docs.
Rooms, avatar, walking, furniture, placing, inventory, chat, saving (steps 1 to 5b). Shop with
customers and the till (7), room shapes and character creation (7b), dungeon (8, 9), farm and
cooking (9b), mine and forge (9c), UI polish, atmosphere (light, shadows, sound), logo splash,
shop life (9d), ranks and the Book (9e), the lakeside: fishing and woodcutting (9f), housekeeping
(1.0: CLAUDE.md shortened; the full brief is docs/BRIEF.md, earlier steps' details docs/NOTES.md).

## PHASE 1A - The block world (owner's decision, 15 Nov; full design: docs/BLOCKS-PLAN.md)
Inspired by Growtopia and Pixel Worlds: a cell grid, blocks you place and punch, seeds that grow
and can be spliced, gems from everything, packs bought with gems, items as coloured squares,
and pickups that float above the head. It goes BEFORE the rest of phase 1, because the tavern
(9t B and C) and the livelier hotel (9g) are built on how things are placed. Pause them until BG1
is done. All prompts [prompt ready] in docs/NEXT-STEPS.md. Owner confirms the open questions
(BLOCKS-PLAN section 5) and the pack fairness rules (section 4, row 3) before BG1 and BG8.
BG1 Cell grid (32 px): rooms, furniture, floors per cell, navigation on cells, migration. [done]
BG2 Item icons: every item a rough shape and colour in a 32x32 square, drawn in code. [done]
BG3 Gain popups: items and gems float above the avatar's head (chest, kill, fish, harvest, pack). [done: BG3b wired every source, see NOTES BG3b + BG4b]
BG4 Gems: the second currency, dropped by everything, through the ledger. [done: every source, floor piles in the dungeon and mine, BG4b; numbers tuned in BG9]
BG5 Blocks and punching: place and break blocks by hits; drops, seeds, gems. [done]
BG5b Hold to repeat: hold a press to keep punching / chopping / mining and to place block lines. [done]
BG6 Seeds and the free-form farm: grow in real time, harvest by punching; old farm migrates. [done]
BG7 Splicing: two seeds make a new one; a Splice tab in the Book. [done, NOTES BG7]
BG8 Packs: Random Blocks, Basic Seeds, Common and Rare Clothes packs for gems, odds visible. [done, NOTES BG8]
BG9 Balance: gems in and out, pack prices, grow times, with the simulation tools. [done, NOTES BG9]

## PHASE 1B - One Inn (planner's proposal, 15 Nov; docs/INN-PLAN.md; owner confirms before it starts)
Merge the block world, the tavern and the personal room into one flow: a garden, a tavern and a
private suite connected by doors, with expeditions out of the inn. Proposed order:
0.1 PLAYTEST (phase 2.1 brought forward): one full hour from a new game, one fix list, fix it.
0.2 [x] R1 Refactor: split main.ts, localGameAPI.ts and config.ts; no behaviour change (NOTES R1).
0.3 [x] 9t B (guests and serving), [x] K1 Tavern kitchen: cooking moves from the farm to the tavern
    (NOTES K1), [x] 9t C (brewing, Menu; NOTES 9t C), [x] S1 Retire the shop (no loot customers; NOTES S1), [x] S2 trader (NOTES S2), [x] S3 rebalance gold and gems (NOTES S3),
    [x] T1 Bar taps, the register and the kitchen (zone, prep tables; NOTES T1),
    [x] K2 Ripening: aged and vintage
    drinks in casks, real time [prompt ready], then M-A Carpentry (blocks -> furniture) [prompt ready],
    M-B Connected Inn (doors, an Inn name): [x] MB-2 rules (save v27), [x] MB-3 client (doors, fade, hint); [x] H3 floors and walls from PNG hook.
0.4 9g livelier suite, then M-C One Inn score (tavern + suite stars + garden beauty), M-E suite
    showcase; 9i questline follows the flow. After that 9h and phase 2.2 rebalancing.

## PHASE 1 - Finish the core game
The loops that are planned must all exist before anything else is added.
1.0 Housekeeping: shorten CLAUDE.md. [done]
1.1 Step 9f - Lakeside: fishing and woodcutting. [done]
1.2 [x] Step 9t - The tavern (A, B, K1 and C all done): the shop becomes a tavern (owner's decision, 14 Nov). Guests sit, order
    drinks and dishes, the player serves and collects the coins; brewing; the loot stall stays as
    a market corner. [done: parts A, B, K1, C; NOTES STEP 9t, K1, 9t C]
1.3 Step 9g - Livelier hotel: hats, emotes, usable furniture, the cat, room stars, visitors.
    [prompt ready; BG1 is done, placement rules are cell based]
1.4 Step 9h - Dungeon round 2 (3 floors, boss) and two more dungeon types. [prompt ready]
1.5 Step 9i - The questline: chapters, progress, rewards, daily tasks. [prompt ready]

## PHASE 2 - Playtest and balance
No new features. Make what exists fun.
2.1 A full playthrough from a new game by the owner; one fix list; fix it.
2.2 Economy pass: prices, drop rates, xp curve, customer pace, craft costs (with the simulation
    tools). Raise the level cap from 8 to about 20 with a new curve.
2.3 First-hour pass: the first 60 minutes must explain themselves (quests, hints, pacing).

## PHASE 3 - Goals (small systems that give long-term reasons to play)
These reuse the quest event counters from 9i, so they are cheap.
3.1 Skills: own xp and levels for Mining, Farming, Fishing, Woodcutting, Cooking, Smithing and
    Dungeon, with small unlocks, shown in a Profile panel.
3.2 Achievements with titles, and unlocks through play: achievements, hotel level and shop level
    give furniture, decorations and trophies for the wall (open 100 chests -> a treasure chest to
    place; catch every fish -> a golden aquarium; beat every boss -> a boss trophy).
3.3 Collectibles in sets (for example crystals in 7 colours); a full set gives a special piece.
    Shown on a trophy shelf or display case in the hotel room; a tab in the Book.

## PHASE 4 - Art (step 6)
Changed 15 Nov (owner): art is now INCREMENTAL. Aseprite sprites (docs/PLAN-SPRITES.md, style in docs/ART-STYLE.md) replace
code-drawn art piece by piece, alongside the feature work; code art stays as the fallback. First proof: the tavern register.
The list below is the order for the rest, not a gate.
4.1 docs/ART-STYLE.md (done) and a test set: the register first, then the avatar, 5 pieces of furniture, one floor, one wall.
4.2 Avatar: clothing, hats, walk and sit frames.
4.3 Furniture and styles (home, shop, crypt, lake).
4.4 Outdoors: farm, lakeside, crops, trees, water.
4.4b [x] OUTDOOR-ART r1: new lakeside tree PNGs (6 variants, stump, 2 saplings), farm grass/soil/hedge redrawn (tools/gen-outdoor-art.mjs). [ ] hooks: drawTree PNG lookup, per-cell grass variants, farm decor (see NEWS). 4.4c [x] POND-ART staged (organic pond Wang set + decor, NOTES POND ART SET); [ ] coder: vertex-grid pond, cast cells, wiring.
4.5 Dungeon and mine: blocks, enemies, chests, rocks.
4.6 Icons (materials, food, fish, gear) and the UI skin.
The look and feel wanted: rooms packed with small props; warm, soft light close to its source;
many people doing different things; outdoor places that are full (trees, bushes, flowers, paths).
Never copy another game; no screenshots of other games in the repo.

## PHASE 5 - Depth (pick in this order; each is its own step)
5.1 Pets: companions that follow the player, found as rare drops or boss rewards, named and fed,
    with funny idle moves and a page in the Book.
5.2 Potions with timed effects (speed, luck, mining, fishing, xp, night vision) and accessories:
    equipment slots, lucky ring, mining helmet, boots, a backpack for more bag slots; gear that
    changes how the avatar looks.
5.3 Farm 2: more crops, crop quality (normal, good, excellent, golden), scarecrow, greenhouse, (18 Nov artist: scarecrow, hay_bale, farm_barrel, grass_b/c, kitchen_tiles PNGs drawn, not wired)
    fruit trees, beehive; then animals (chickens, cows, sheep).
5.4 Mine 2: floors that go deeper with rarer ore (silver, gold, crystal, obsidian, starstone),
    hidden rooms and treasure rooms.
5.5 Dungeon 2: mini-bosses, difficulty levels, more themes (spider cave, ice, lava, void), each
    with a boss and a special reward.
5.6 Tavern and market 2: more displays (potion display, rare item display), a longer bar, a travelling
    merchant with a small changing stock.
5.7 Hotel 2: more rooms (kitchen, bathroom, balcony, a cellar), more furniture sets (royal,
    crystal, mushroom, pumpkin, cloud, ghost), an aquarium, instruments.
5.8 World life: day and night, rain and snow, birds, a notice board, a calendar, small secrets.

## PHASE 6 - Online (step 10 and on; after depth, owner's decision)
The long-term goal: a real online hotel.
6.1 Server, accounts (username + password), saves on the server, RemoteGameAPI.
    [x] ONLINE P1 server side (19 Nov): accounts + 13+ check, sessions, cloud save, read-only visit/share endpoints, bans + admin CLI, safe-env start check
    (server/, tests green; NOT yet run on the VPS). [x] client account panel + conflict dialog (ON-5, flag off, 19 Nov), [ ] RemoteGameAPI (P5).
6.2 Visiting rooms (by room name, like typing a world name; see BLOCKS-PLAN 3.9): see other players walk, sit, emote; public room chat with the filter, report
    and mute (section 13).
6.3 A lobby / town square as the shared place to meet; a room list.
6.4 Room ratings, room contests, leaderboards, profiles with showcases, titles and badges.
6.5 Room locks and access lists (open / friends / private; visitor, builder, admin), signs, a
    notice board, doors and portals between rooms, the tavern bar serving real players.
6.6 A small private test with friends; fix list.
6.7 Only after 6.6 and with new safety rules: friends list, guilds, a safe two-sided trade
    window, a player market. Gems stay untradable.

## PHASE 7 - A bigger world
7.1 Tavern 2: guest rooms to rent, staff to hire (a barkeep, a waiter), a bigger menu, a
    bakery oven, tavern events (a bard, a feast night).
7.2 New areas on the Map, one per step, unlocked by level: Enchanted Forest, Crystal Cavern,
    Snow Mountain, Tropical Island, Haunted Graveyard, Desert Ruins.
7.3 Random events (gold rush, meteor shower, ghost night, lucky day, fishing frenzy, a mystery
    visitor) and seasons (Halloween, winter, spring, summer), earned by play only.
7.4 Extra buildings: bakery, pet shop, alchemy lab, treasure vault, boathouse, clock tower.

## PHASE 8 - Release
8.1 The real, original name; new logo if the name changes.
8.2 Legal and safety check (ages 13+, rules per country, privacy text).
8.3 Windows desktop app; Steam page; a public test; launch.

## NEEDS THE OWNER'S DECISION (conflicts with CLAUDE.md; do not build until decided)
- Packs with random contents (BG8): DECIDED and built with the fairness rules in CLAUDE.md section 13
  (duplicates are allowed, extra copies are spares).
- Gems as a second currency next to gold (section 9): asked for; gold stays the tavern money.
- The block world answers a to d in BLOCKS-PLAN section 5.
- Mystery boxes: section 13 says no loot boxes. Only as a free reward with visible odds, or not.
- Trading, a player marketplace, player shops, a friends list: section 9 and 13 say not in v1.
  Only after phase 6 (online), with new safety rules.

## IDEAS FROM RESEARCH (lead, 16 Nov; NOT planned, owner confirms; details and fit checks in docs/RESEARCH-GAMES.md)
Inspiration only from Growtopia, Travellers Rest, Habbo Hotel and Pixel Worlds; nothing is copied. Existing steps above are unchanged.
Proposed order (each is its own step if the owner approves):
1. RN-1 Inn Renown: named ranks from the One Inn score unlock guest rooms, menu tiers, staff (after M-C). [coder] + rank badge [artist]
2. RG-1 Regulars: 6 to 8 named repeat guests with tastes, a Book tab, a small tip bonus (save bump). [coder] + guest looks [artist]
3. BD-1 Board orders: optional commissions, no timers, no daily reset (inside 9i). [coder] + board prop and UI [artist]
4. SM-1 Slow makers: hen coop, beehive, cheese press, real-time producers like casks; a balance test each (first slice of 5.3). [coder] + props [artist]
5. JR-1 Recipe journal: discover and track recipes in the Book. [coder] + silhouettes [artist]
6. TB-1 Titles and badges: cosmetic, from event counters (inside 3.2). [coder] + badge icons [artist]
7. PT-1 Pastimes: darts, dice, bard stool as usable decor (after 9g-2). [coder] + three pieces [artist]
8. SE-1 Returning seasons: yearly events, earned by play, never missable (inside 7.3). [coder] + decor [artist]
9. AM-1 Anti-macro guardrails: server rate limits and speed checks, with step 10. [coder]
10. SF-1 Safe visits first: mute, report, filter and chat-off visits before any public chat (phase 6). [coder] + UI [artist]
HELD for the owner (conflicts with CLAUDE.md sections 9 and 13): trading and a marketplace, PvP.
REJECTED: real-money gems or items, daily login rewards, limited offers, lucky wheels.

### DEEP-DIVE IDEAS (lead, 16 Nov; NOT planned, owner confirms; sources, fit checks and sizes in docs/RESEARCH-DEEP.md)
New items only; the ten above (RN-1 to SF-1) are not repeated. Suggested order is the numbering. None conflicts with CLAUDE.md.
11. FP-1 First ten minutes: a skippable 5-step nudge with one on-screen hint at a time, one-time tooltips on each new machine, a "what next" pin. S to M. [coder] + hint UI [artist]. Extends 2.3; avoids the Travellers Rest tutorial complaints.
12. AU-1 Crowd soundscape and music: murmur and clinks that scale with guests, a cheer on a served round, a soft music loop, a toggle. S to M. [coder] + sound pass [artist]
13. JU-1 Loop juice: pour splash and foam, coin arc into the register, "delighted" ding, stove smoke. S. [artist] + hooks [coder]. Render only.
14. GT-1 Guest tastes: favourite drink, dish or rank per guest; served-to-taste means a bigger tip or gem; menu variety raises satisfaction. Needs balance test and save bump. M. [coder]
15. [x] NPC-TALK lines data (19 Nov, 428 lines; hooks in NOTES NPC LINES). NC-1 Odd guest archetypes: a few funny, memorable guest types with portraits and one-liners (pairs with RG-1). S to M. [artist] + npcLines [coder]
16. DS-1 Decor style sets: matching pieces add a small capped appeal bonus and a named look title (keeps the 3-per-type and 100 caps). M. [coder] + set art [artist]
17. CL-1 Cleanliness and troublemakers: spills show as mess, a broom clears them; a rude guest is shooed; never required. M. [coder] + props [artist]
18. CR-1 Open/Closed sign and closing report: guests, gold, tips, mood; optional, no forced hours. S. [coder] + sign and panel [artist]
19. GP-1 Grand projects: staged long builds (hearth hall, cellar, stage) as a gold and goods sink and the answer to "nothing else to work for"; balance test. M to L. [coder] + stage art [artist]
20. QL-1 Quality of life: recipe favourites, "craft again", bag search, item descriptions. S. [coder] + UI [artist]
Later: IQ-1 ingredient qualities (flavour tags) after GT-1 proves out. Rejected again after the deep dive: trading, real-money gems, daily rewards, PvP.

## IDEA POOL (not planned yet)
Item descriptions and comparison, favourites, search in the bag, a pet that sits on your head,
candles that burn down, a rare rainbow, shooting stars, footprints in snow, hidden passages, a
hidden NPC, mine carts, mining companions, fishing tournaments, a radio with music.

- [ ] TUT-3 (owner 17 Nov, NOT priority now): splicing becomes part of the ONE tutorial. The new game gives or places a few different seeds/blocks (varied, visible somewhere in the world or bag), and a tutorial step has the player splice two of them, so people understand splicing at once (guide.json step + event/world proof, firstTen tests, GUIDE-UPDATE checklist). Later splicing grows into a bigger feature.

- [~] UID-1..13 (ui, owner 18 Nov, docs/PLAN-UI-DECLUTTER.md): DONE 18 Nov: side column 5 buttons incl. Worlds (1; 19 Nov owner: Worlds back in the column, OPEN sign hangs from the top edge on a rope), one badge on More (9), info one line + 3 px xp bar (4), small OPEN sign (6), no phone labels (10), HUD fade info + side only (3), idle-only one-line guide (2), Bar rows 4 controls (5). SKIPPED by owner: hotbar changes (7); the hotbar never fades. Not done: panel tab icons (11; the listed panels already have max 3 tabs), welcome hint merge (12), world plaque (13).
- [x] UIR-1..12 (ui, 18 Nov, Lantern Dark): tokens, frameless HUD, round buttons + dark hotbar, toasts + chips, dark panel shell, flat 44 px rows, catalog tiles, floating place pill, Book cream pages, Quests/Settings regrouped, character maker + hotel shape + title dark, run HUD pill, lantern tabs and pill buttons, old .frame iron CSS and Sell CSS removed (client/src/ui/lantern.css). Open: Skills dot hook (game/), fish bar not seen.

- [~] PixelLab furniture redo (owner 18 Nov, docs/PLAN-PIXELLAB-ART.md): batch 3 done = 18 tavern pieces (down facing); next: right/up facings, hotel pieces, decor, farm, walls/floors (156 of 200 generations used); render hooks for stove, tap stand pour and bar surface height fitted 19 Nov (NOTES PIXELLAB-HOOKS).
- [ ] SK-0..9 (planner 19 Nov, docs/PLAN-SKILLTREE.md): real skill tree (7 branches, ~92 linked nodes, keystones, capstones), level cap 30 + XP from every loop, SAVE 42, pan/zoom tree UI, 98 icons. Waits for the owner's OK on the 5 decisions (section 9).
- (owner 19 Nov) SLOT PIECES: bigger tap stands (3-4 slots) as catalog upgrades, mixed drink+food slot pieces, menu variety attracting more guest kinds (ties to guests with tastes); build after the slot-panel redo + food stash.
- [x] RUN 12 UI items (19 Nov, ui): off-screen pointer edge arrow, wall-step card scrolled into view, Workshop chip text, side discs readable. [ ] Open hooks: camera ease to the guide target, grid at overview zoom + selected small piece outline (render side).
- [x] A1 guide pointer and stock fixes, A2 build pick and aids (19 Nov, coder; not seen in a browser; tester verifies, UI worker restyles the tutorial later)
- (owner 19 Nov) RECIPE ROOM (a PUBLIC SPACE, ties to online P2 and the Book): one room that shows every block, plant, furniture piece and tool placed on display, with its RECIPE / source on a sign or tap card on each (crafting, splice pair, drop table, brew/cook inputs), plus other useful things (stations, a bulletin board, quest board, notes); other players can JOIN that map live. The owner may build it himself by playing later: so the game needs (1) a way to mark an owned room as an official PUBLIC SPACE (admin/owner flag on the server, shown on the Worlds board), (2) enough building tools: place any block/item freely in that room (a creative/showcase mode for the owner account), recipe cards as placeable wall/surface items (data-driven from recipes.json, splice.json, loot.json, food.json), (3) live visiting with avatars (ON-9). Not planned yet: design after ON-9; keep the Book + recipe data ready for it.
- (owner 19 Nov) WRITABLE SIGNS (like Growtopia): a sign item (wall / floor / on a block) with player text (max ~60 chars, word filter, no 'inn'), stored on the item (optional FurnitureItem.text, SAVE bump + migration + test); when the avatar is within about 2 cells a small bubble pops up above the sign showing the text, hides when you walk away; edit by tapping the sign in build mode (text input, 44px, phone keyboard safe); visitors in online rooms (hotel, garden, public spaces) can read them (server view includes sign text, filtered); recipe-room cards can reuse the same item with auto text. Needs: shared rule (text clean/limit, near check), render bubble (reuse chat bubble style), build UI, server roomView/protocol field + leak tests.
- (owner 19 Nov) IDEA: a big STEAMPUNK JELLYFISH with arms (brass + glass dome, steam pipes, mechanical tentacle arms): original design as a legendary lake catch (hard without upgrades) and/or a deep dungeon/mine boss; art via PixelLab (large sprite + attack/idle frames). Owner saw something like it somewhere: ask for the reference.
