# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first)

Updated 2026-11-19 (manager). LIVE site is still main at 4e781d4, older than the working tree (see Right now). Startup file: C:/Users/ajren/pixel-hotel-team/MANAGER-START.md (has a 19 Nov update). Owner list: docs/OWNER-AGENDA-17NOV.md.

## Right now (workers) - 19 Nov, after ship 7c3df8b
- SHIPPED 7c3df8b (pushed + deployed, check green 2239 tests): open annex, dig mine, Lantern Dark + declutter, PixelLab furniture/floors/walls/UI proof/close X/logo, cloud visits client + net protocol (flag off). Stray pourBar.test.ts parked in art-src/staging/unfinished.
- Old-session worker (UI declutter / Worlds) may still have written files after: check git status before the next commit.
- PIXELLAB: 925/2000 used; owner cap about 1000 (not exact), then the owner says go for the next 1000. Ledger in docs/PLAN-PIXELLAB-ART.md.
- Started next: tester RUN 10 (screenshot ship gate, desktop + phone, new art unseen in a browser) and coder on the FIXLIST open items.

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
