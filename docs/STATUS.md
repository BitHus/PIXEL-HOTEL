# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first)

Updated 2026-11-19 (manager). LIVE site is still main at 4e781d4, older than the working tree (see Right now). Startup file: C:/Users/ajren/pixel-hotel-team/MANAGER-START.md (has a 19 Nov update). Owner list: docs/OWNER-AGENDA-17NOV.md.

## Right now (workers) - 19 Nov, after ship a30c5e5
- SHIPPED a30c5e5: TF-1..5 bar-guest rules (BAR_GUESTS_ENABLED=false until TF-6 render), server hardening, title screen + PixelLab panel frame, taller stove (32x56).
- GAME SERVER LIVE on the VPS (owner OK 19 Nov): https://server.pocketbarrel.com/api/health ok, systemd pocketbarrel-server + backup timer, nginx + cert, Node 22 installed. NOT done: ufw/fail2ban (script not run: lockout risk, ssh port unchecked), off-box backup target. Cloud client flag still OFF; needs ON-5 account panel. nginx default site no longer lists server.pocketbarrel.com (backup /root/nginx-default.bak on the VPS).
- Worker cap: max 2-3 at once, one browser-heavy (owner 19 Nov, PC CPU). Tester RUN 10 was stopped: restart it ALONE.
- Next: TF-6/7 render + strip UI (bar guests, Grab all/Serve all), ON-5 account panel, TF-9 balance gate, bar/table spacing, hitbox check, unwired panel art (tabs, buttons, sign).
- PIXELLAB: ~925/2000 used, owner cap about 1000, then owner says go.

## PLAN after this batch (manager opinion, owner OK 19 Nov)
1. Hold new features until tester RUN 10 (first browser look at floors, walls, panel frame, spacing, hitbox) is fixed.
2. Check the 24 px panel frame on narrow panels (Bar, Skills, Bag, phone); thinner frame variant if cramped.
3. Bar guests (TF-6/7/9) are IN (owner: fun); switch on only if the simulate passes.
4. Online: account panel ON-5 now, then visiting (P2) so others can see a tavern.
5. NEXT ROUND: depth for the mine, dungeon and fishing (the weak links), then avatar style lock.

## OWNER DECISION 19 Nov: ONLINE SCOPE
Online (visiting, sharing, later live avatars) is only for the HOTEL ROOM (suite), the GARDEN and PUBLIC spaces. The TAVERN (and its kitchen/cellar), farm, mine and dungeon stay private/solo. Server share/visit must refuse any other room kind; the Rooms board lists only these. OPEN: what exactly are the public spaces (shared lobby with live avatars? a plaza?) and is the garden the farm or a separate room.

## QUEUED OWNER FIXES (19 Nov)
- OPEN/CLOSED sign: should HANG from the top edge on its chains; now it floats under a button (ui worker, desktop + phone, skin.css sign).
- Seating/eating positions (half table in front when sitting): tester RUN 10 reports, then a coder fixes sit offsets.
- Outline rule: one consistent 1 px warm-dark outline on all furniture (artist running).

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
