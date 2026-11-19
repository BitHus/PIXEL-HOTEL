# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first)

Updated 2026-11-19 (manager). LIVE site = main at 85c9ab9 (see Right now). Startup file: C:/Users/ajren/pixel-hotel-team/MANAGER-START.md (has a 19 Nov update). Owner list: docs/OWNER-AGENDA-17NOV.md.

## Right now (workers) - 19 Nov late, wrap-up at 93% usage
- LIVE: 85c9ab9 (pond rework, new floor/wall/icons, tutorial card, bigger markers, stool, emote menu, bar rider lift, audio engine NOT wired, calmer glows). Server still SAVE 41 vs client 42 (cloud flag off; ask owner before DEPLOY_SERVER).
- WRAPPING UP (finish, check, commit, push, deploy): coder a4180397 DOOR BUG (doors do nothing, owner: door too small, avatar glitched in it once, walking against the wall next to the door should enter it); artist a55eabe1 FLOOR/WALL/BAR/STOOL/REGISTER redo (owner: bright wood floor and its repeating pattern are very ugly; wanted: DARK calm non-repeating standard floor with a big 192-256 px tile, 5-6 other floor styles to choose, new bar art, stool, register facing the guests, research notes); UI a96f17c1 right-column icons +20% on desktop only.
- OWNER FEEDBACK this session: new bar ugly, register wrong way, doors too small/0 depth, order dots calmer (done), tray beer bigger (done), bar guests OFF (done, BAR_GUESTS_ENABLED=false), NPC chat lines low priority ('does not have to be spoken'), use better models when needed (memory updated).
- OPEN owner questions: brewing into the cellar?, SFX default volume 0.35 -> 0.7?, 'door to the block placing' (unclear), avatar try keeper (art-src/avatar-try, 6/10, walk too subtle from the front): keep / stronger walk / drop.
- NEXT (in order): misclick-proof interaction (hover, E key, phone context button, priority; see WORKERS-RESUME), audio hookup (hooks list in WORKERS-RESUME), door depth art, floor variants render hook (per-cell variants), SK-1/2 skill tree, 3f fishing, 3e food stash + tap panel, tester RUN 13 (cellar, pond, new floor, doors, tutorial pointer), camera ease to guide target, build grid contrast, long-shape bar 3 pieces, 3g NPC hooks (low).
- PIXELLAB: about 1570-1750 of 2000 used (check get_balance).

## PLAN after this batch (manager opinion, owner OK 19 Nov)
1. Hold new features until tester RUN 10 (first browser look at floors, walls, panel frame, spacing, hitbox) is fixed.
2. Check the 24 px panel frame on narrow panels (Bar, Skills, Bag, phone); thinner frame variant if cramped.
3. Bar guests (TF-6/7/9) are IN (owner: fun); switch on only if the simulate passes.
4. Online: account panel ON-5 now, then visiting (P2) so others can see a tavern.
5. NEXT ROUND: depth for the mine, dungeon and fishing (the weak links), then avatar style lock.

## OWNER DECISION 19 Nov: ONLINE SCOPE
Online (visiting, sharing, later live avatars) is only for the HOTEL ROOM (suite), the GARDEN and PUBLIC spaces. The TAVERN (and its kitchen/cellar), farm, mine and dungeon stay private/solo. Server share/visit must refuse any other room kind; the Rooms board lists only these. OPEN: what exactly are the public spaces (shared lobby with live avatars? a plaza?) and is the garden the farm or a separate room.

## QUEUED OWNER FIXES (19 Nov)
- OPEN/CLOSED sign: should HANG from the top edge on its chains; now it floats under a button (ui worker, desktop + phone, skin.css sign). Owner idea: or LONGER ropes that run up behind the top HUD, so it clearly hangs from the top; the sign hangs BELOW the info panel, ropes behind it (owner clarification).
- Seating/eating positions (half table in front when sitting): tester RUN 10 reports, then a coder fixes sit offsets.
- Outline rule: one consistent 1 px warm-dark outline on all furniture (artist running).

## NEXT ART ROUND (owner 19 Nov): PixelLab icons everywhere + UI pieces
1) Audit every icon still code-drawn (side buttons, More grid, quests, skills, materials, crops, drinks, food, fish, ores, tools, gear, emotes). 2) Generate one consistent set in the couch/statue style, inside the cap (about 1500 used total), one PixelLab worker at a time. 3) ui worker wires them plus tabs, round buttons, bar frame, parchment panel, sign. Starts after the stove/outline artist finishes and the owner saw the contact sheets.

## QUEUED (owner 19 Nov): UI polish for FISHING and TAP POURING
Owner: these UIs are important. Fishing: cast, bite !, reel bar + catch box + fish, result. Pouring: pour bar/gauge, green perfect window, tip feedback, tray. Clearer, juicier, phone sizes; PixelLab art as part of the icon round. After the sign fix. Tester RUN 10 shots first.

## QUEUED (owner 19 Nov): redo RUG (rug + shop_rug copy) and POTTED FLOWER (plant) in the couch style, outline-fix after fit (artist, PixelLab, when a slot frees). Ask/learn what the owner dislikes.

## QUEUED (owner 19 Nov): SEAT SCALE. bone_chair is 32x39 and sunken_throne 32x42, smaller than chair 32x48: makes no sense when you sit. Artist: redo them taller/chunkier (chair >= 48 tall, thrones taller than chairs), audit all sittable sprites vs the avatar (54 px), fix the fit step (tools/pixellab-fit.mjs shrinks wide art to the 32 px footprint width). Plus the rug + plant redo above.

## QUEUED (owner 19 Nov): AUDIO round. Retro chiptune music in code (tavern, title, dungeon, mine, lake, farm), more SFX, volume sliders; free CC0 packs only if licence checked. PixelLab music needs Tier 2 (owner has Tier 1): not used.

## QUEUED HIGH (owner 19 Nov): no drag-to-pan in play mode; camera always locked on the avatar; free look only via a Look around toggle in More (build mode keeps panning). Removes walking/camera bugs. Changes the CAM-LOCK rule in CLAUDE.md (owner decision).

## QUEUED (owner 19 Nov): REWORK the CHARACTER MAKER screen (ugly): title-screen look, big live preview, clean pickers, phone + desktop.

## QUEUED (owner 19 Nov): ORDERS STRIP rework: move from the left edge to BOTTOM CENTER above the hotbar for thumb reach (compact horizontal row), see WORKERS-RESUME item 4.

## QUEUED (owner 19 Nov): KITCHEN ABOVE the tavern (behind the bar/back wall), not below. Owner confirmed. Opus coder after the camera lock.

## QUEUED (owner 19 Nov): DOORS: redo suite/garden/tavern doors like the cellar door (they look like the wallpaper). Cellar walking bug: coder fixing first.

## QUEUED (owner 19 Nov): TAVERN START LAYOUT + REAL BAR: MODULAR BAR (2 tileable pieces bar_straight + bar_corner, owner idea) = longer real bar with checkout (register at one end, taps middle), tables + chairs placed away from the taps like a real tavern; with the kitchen-above job; then bar art (artist).

## OWNER BATCH 19 Nov late: see C:/Users/ajren/pixel-hotel-team/WORKERS-RESUME.md (A bugs: tutorial highlight bugs, Quests button gone from More, cook-with-nothing guide logic, small items missing on the build grid, pond tap/shape; B skill tree + level cap; C NPC jokes; D icons + packs page + catalog icon; E art audit (desk, flowerpot); F tester). SHIPPED 313eb90 (live). Usage limit hit 03:20 reset: workers died, relaunch from the resume file.

## Done this session (all live)
Camera locked without edge clamp; emote state fix; small NPC chat pills; kitchen = walled area inside the tavern (SAVE 37, cellar stays a room, racks 2/3/3); skills MG-1/2 (SAVE 38, level cap 12, Skills panel + stat hooks MG-7); TRADER REMOVED (gold = guests + dungeon run gold, ~76/24); tap forgiveness; tutorial starts at 0 (zoom, walk, hold-walk steps); orders rail bottom-left, hanging OPEN/CLOSED sign, aura on order markers, pour hint hides under panels, Serve closes the bar panel; Worlds badge hidden in the tavern; lakeside trees + farm ground/ambience + door art (cellar down/open/up, kitchen) wired; cobweb corner, stand flames; rock sprites.

## Next up
1. OWNER ANSWERS for docs/PLAN-UI-REWORK.md (direction A Lantern Dark recommended, cream insets, boxless HUD, buttons, translucency, 9-slice frame, title order, props info), then UIR-1..11 with the ui worker.
2. Fix list from tester run 7. Skills panel (UI) + MG-7 stat hooks, then the new dig mine without lantern (MG-3+), minigame gear, dungeon depth.
3. Owner check: level 12 total xp 1400 (coder choice), gold shares 76/24, BALANCE_TARGETS now 0.15..0.85.
4. PERF-2 rest (ticker pause, pooling, real phone measure), artist: scarecrow/hay/barrel, grass_b/c, pine/sapling fixes, kitchen wall art, more doors; TF-1.. tavern flow, FUN tasks, OA-3 fishing, ONLINE P1.

## Manager proposals (18 Nov, owner said: add all, good ideas), in this order
MP-1 SHIP GATE: the tester takes a screenshot round (desktop + phone) before every deploy that touches UI, art or tavern layout; the annex and cellar dialog are live but unseen.
MP-2 FEWER SCREENS: prefer in-world taps (tap, stove, bar) over panels; merge or drop panels where possible; skills panel stays small; no square-tab look (UI worker restyling tabs).
MP-3 FIRST 2 MINUTES: a new player serves the first guest within 2 minutes; test with a cold reader (tester plays without docs).
MP-4 ONLINE EARLIER: P1 (accounts, cloud save, visit a tavern read-only) before more mine detail (SHOW part of the loop). Use opus for P1.
MP-5 VARIETY: repetitive dungeon, fishing, cooking need events, rare guests, goals (after TF tavern flow).
MP-6 BALANCE + SKILLS: put skills into balance.ts/simulate; owner decision: Roomy tavern needs real extra seats.
MP-7 HOUSEKEEPING: shrink CLAUDE.md (320 lines, cap 250) by moving detail to docs/BRIEF.md.
MP-8 LATER: a lantern in the dig mine as an optional tool.

## Owner decisions open
(Settled 18 Nov: UI direction A Lantern Dark; level 12 = 1400 xp; trader removed; kitchen = attached annex, cellar = separate room.)
UI rework (above), PLAN-MINIGAMES leftovers, TF proposed numbers, off-box backup target, privacy text, avatar style lock, DG5 traps/gates, dungeon round 2, player trading design (later).

## Vision check: loop GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW. Weakest links: moment-to-moment tavern fun, goals beyond the first hour, minigames (mine, dungeon, fishing) too thin, nobody can see your tavern yet (online).

## Hosting facts: VPS 149.245.246.67, nginx + certbot, SSH key ~/.ssh/id_ed25519. Deploy: POCKETBARREL_HOST=149.245.246.67 bash tools/deploy.sh [ref]. Owner permission (durable): merges, pushes and deploys after every green batch.
