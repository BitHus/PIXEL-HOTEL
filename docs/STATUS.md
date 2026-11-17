# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first)

Updated 2026-11-17 night (account-2 manager). LIVE: https://pocketbarrel.com = main at the commit "Auto-collect coins..." (pushed and deployed after each green check; SAVE 34). Startup file: C:\Users\ajren\pixel-hotel-team\MANAGER-START.md. Owner list: docs/OWNER-AGENDA-17NOV.md.

## Right now (workers)
Nothing running. Tree clean.

## Done this session
REVIEW-17NOV findings 1-9 fixed (quest re-claim, level re-roll, abandon counts, ledger fold SAVE 34, ripe sparkle, server/ops scripts); tutorial stove supplies; guest walk smoothing while panning (not seen in a browser); auto-collect of coins, gem tip and mug after serving (owner OK: minor things may be automatic; CLAUDE.md updated); stove/barrel/counter_ext art (LOOK3); docs/PLAN-MINIGAMES.md (MG-1..MG-16).

## Next up
1. OWNER ANSWERS NEEDED for PLAN-MINIGAMES section 8 (mine replaces old mine, one point pool, level cap 12, gear rules, numbers, depth cap).
2. DUNGEON PROPS REWORK (owner words 17 Nov): only real chests look like chests; crates, barrels (ugly), statues, shelves, sarcophagi get distinct looks, barrels redrawn; gates must be real objects you walk through (now a floor picture); keep the small ground details and the pillars. One coder (props solid rules, layout goldens, pacing tests) + one artist.
2b. TAVERN FEEL BATCH (owner words 17 Nov, top priority after the dungeon coder): (a) smooth: "i cant tap when i want", stutter in Firefox+Chrome on PC and Android: measure then fix; (b) guests must trickle in one by one, not in batches (staggered arrivals, same average rate, balance holds); (c) money must never lie on the table (auto-collect is live: verify it in a browser, also piles from before, offline catch-up); (d) orders ONLY in the orders strip at the top of the screen, no big bubble above the head: only a tiny marker above the guest who wants a drink; when a drink of a tap with colour X is on the tray/loaded, a dot in that tap colour shows above the guests who want it (strip stays as normal; OWNER ANSWER: the marker shows ALWAYS for a guest who wants something, drink = dot in the drink's tap colour, food = the dish icon, both really small, as small as the little circle above the head); (e) follow camera centred in ALL rooms by default; (f) CELLAR (OA-7, docs/PLAN-CELLAR.md, owner says it must be in: use the proposed numbers, CEL-1..10, SAVE bump after 34).
3. Tester run 6 (auto-collect, e2e specs may still assume a coin tap, pan smoothness, quests, tutorial stove).
4. TF-1.. tavern flow, FUN tasks, OA-3 fishing, OA-7/8 cellar and upgrades (merge with MG plan), ONLINE P1 (deploy server with DEPLOY_SERVER=1; ops review items 10/11/16 open), bar-guest pose hooks.

## Owner decisions open
PLAN-MINIGAMES section 8, cellar/upgrade numbers, TF proposed numbers, off-box backup target, privacy text, avatar style lock, DG5 traps/gates, dungeon round 2.

## Vision check: loop GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW. Weakest links: moment-to-moment tavern fun, goals beyond the first hour, minigames (mine, dungeon, fishing) too thin, nobody can see your tavern yet (online).

## Hosting facts: VPS 149.245.246.67, nginx + certbot, SSH key ~/.ssh/id_ed25519. Deploy: POCKETBARREL_HOST=149.245.246.67 bash tools/deploy.sh [ref]. Owner permission (durable): merges, pushes and deploys after every green batch.
