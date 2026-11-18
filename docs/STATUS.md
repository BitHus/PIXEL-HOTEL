# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first)

Updated 2026-11-18 (account-2 manager). LIVE: https://pocketbarrel.com = main at 4e781d4 (pushed and deployed after a green check; SAVE 38). Startup file: C:\Users\ajren\pixel-hotel-team\MANAGER-START.md. Owner list: docs/OWNER-AGENDA-17NOV.md.

## Right now (workers)
- OWNER TOP PRIORITY (18 Nov, late): the walled-ring kitchen is WRONG. The kitchen must be an ATTACHED ANNEX of the tavern: the tavern floor is expanded outward (side or back) by a small rectangle with real walls, a partition wall with ONE doorway (art doors/door_kitchen.png), same room id and map (no room switch), staff only, stone/tile floor, grows with level, SAVE 39 migration (old ring removed, nothing lost). The CELLAR stays a separate room behind the tavern back-wall door. Owner also could not enter the cellar: tapping its door when it is not built (level 2 + 300 gold) must explain and offer the build confirm. Coder a735cde.. has this; if the session ended, redo it from this text. Ship after check green.
- Tester run 7 (own worktree, port 4195): full browser pass of the shipped batch, rewrites the kitchen e2e specs. Owns docs/FIXLIST.md + e2e/.
- Coder: kitchen wall look (door_kitchen art at the ring doorway, draw order), wall decor clearance next to sprite doors (16 px per side).

## Done this session (all live)
Camera locked without edge clamp; emote state fix; small NPC chat pills; kitchen = walled area inside the tavern (SAVE 37, cellar stays a room, racks 2/3/3); skills MG-1/2 (SAVE 38, level cap 12, Skills panel + stat hooks MG-7); TRADER REMOVED (gold = guests + dungeon run gold, ~76/24); tap forgiveness; tutorial starts at 0 (zoom, walk, hold-walk steps); orders rail bottom-left, hanging OPEN/CLOSED sign, aura on order markers, pour hint hides under panels, Serve closes the bar panel; Worlds badge hidden in the tavern; lakeside trees + farm ground/ambience + door art (cellar down/open/up, kitchen) wired; cobweb corner, stand flames; rock sprites.

## Next up
1. OWNER ANSWERS for docs/PLAN-UI-REWORK.md (direction A Lantern Dark recommended, cream insets, boxless HUD, buttons, translucency, 9-slice frame, title order, props info), then UIR-1..11 with the ui worker.
2. Fix list from tester run 7. Skills panel (UI) + MG-7 stat hooks, then the new dig mine without lantern (MG-3+), minigame gear, dungeon depth.
3. Owner check: level 12 total xp 1400 (coder choice), gold shares 76/24, BALANCE_TARGETS now 0.15..0.85.
4. PERF-2 rest (ticker pause, pooling, real phone measure), artist: scarecrow/hay/barrel, grass_b/c, pine/sapling fixes, kitchen wall art, more doors; TF-1.. tavern flow, FUN tasks, OA-3 fishing, ONLINE P1.

## Owner decisions open
(Settled 18 Nov: UI direction A Lantern Dark; level 12 = 1400 xp; trader removed; kitchen = attached annex, cellar = separate room.)
UI rework (above), PLAN-MINIGAMES leftovers, TF proposed numbers, off-box backup target, privacy text, avatar style lock, DG5 traps/gates, dungeon round 2, player trading design (later).

## Vision check: loop GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW. Weakest links: moment-to-moment tavern fun, goals beyond the first hour, minigames (mine, dungeon, fishing) too thin, nobody can see your tavern yet (online).

## Hosting facts: VPS 149.245.246.67, nginx + certbot, SSH key ~/.ssh/id_ed25519. Deploy: POCKETBARREL_HOST=149.245.246.67 bash tools/deploy.sh [ref]. Owner permission (durable): merges, pushes and deploys after every green batch.
