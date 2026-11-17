# OWNER AGENDA 17 Nov (from Desktop/INSTRUCTIE4manager.txt, owner words; translated). Order: PB first, then OA tasks, then back to the roadmap.

## PB (FIRST): rename + hosting
- New name: **PocketBarrel**. Domain pocketbarrel.com and a VPS (server.pocketbarrel.com, active until 17-02-2027), both bought at mijn.host. Goal: connect them and run the game there; multiplayer is near (step 10), easier when people can play.
- PB-1 [coder]: rename everywhere player-facing (title, HTML title, texts, docs, CLAUDE.md working-title line, package display name). Keep ids, save keys and the repo name (no save loss). The owner has OK'd the CLAUDE.md change.
- PB-2 [manager + owner]: hosting plan: static client served from the VPS (nginx + TLS) at pocketbarrel.com, Node server (step 10: ws + better-sqlite3) at server.pocketbarrel.com. NEEDS from owner: SSH access (user, key or password, how to log in), OS of the VPS, DNS panel access at mijn.host (A records for the apex and `server`). Never put secrets in the repo; deploy script reads them from env. Do NOT push or deploy without the owner saying so.

## OA tasks (each = one coder/ui/artist prompt; no two coders at once)
1. OA-1 FEEL hold-to-walk delay: holding on a point takes too long before the avatar moves (hold 300 ms threshold feels laggy). Start walking at once on press on free floor (keep tap/drag rules: cancel pan if it is a drag). [coder, bug, high]
2. OA-2 Mugs/dishes on the table while guests drink and eat (beer visible on the table), and coins must not "fly everywhere" on a new save when serving: coins land/stack at the table. [coder+artist]
3. OA-3 Fishing is boring to look at and to play: RESEARCH first (docs/RESEARCH-FISHING.md: Stardew, Travellers Rest, Dave the Diver, Moonlighter etc.), then redesign. [researcher then coder+artist]
4. OA-4 Quests and the tutorial run at the same time (confusing): one guide at a time; the quest card waits until the first-steps guide is done. [coder+ui]
5. OA-5 Stove animation is always on and there is no "ready" indication, even when not cooking: idle stove = no fire; cooking = fire; ready = clear sign (art change + animation, plus ready dot). Same check for barrel, taps, crops. [coder+artist+animator]
6. OA-6 Extended bar: longer bar for the taps and the register (kassa), more room for stands. [coder+artist]
7. OA-7 CELLAR + KITCHEN ROOM (big, design first, docs/PLAN-CELLAR.md; RESEARCH Travellers Rest tiers, make it realistic): a separate attached KITCHEN room (new block that spawns next to or above the starter tavern; the first brewing happens there, also in the tutorial) and a separate CELLAR room at the tavern: farm -> brew in the kitchen -> put in the cellar to RIPEN (the longer/better, the higher tier and worth) -> to the taps. Tiers like Travellers Rest. Touches save (SAVE bump), balance (ask owner for ranked numbers), guide.json. [lead plan, then coder]
8. OA-8 UPGRADE SYSTEM: points from levels buy upgrades (walk speed, tavern capacity, inventory slots, etc.), like other games. Design doc then coder; balance numbers go to the owner. [plan, coder, ui]
9. OA-9 Dungeon art/bugs: campfires spawn inside walls; corner cobwebs spawn in the middle; fountain is not animated; walk-through gate is one big picture between walls; torch spawns inside a loot chest. [coder (placement) + artist/animator]
10. OA-10 WALL ITEMS free in 2D along ALL walls like Habbo: candles, torches etc. placed anywhere on a wall, up or down (now only left/right); not on top of doors or other items. Extends FS1/wall rule (CLAUDE.md 7 change: needs owner OK = given here). [coder+artist]
11. OA-11 UI is too many big boxes (e.g. the big "tray [beer]" box): make it subtle; study how other games solve UI (research doc). Compact UI that adapts to screen size, less on screen at once, less overlap, less important things into submenus. [ui + research]
12. OA-12 Round table 4x4 never works (food always floats): study how Travellers Rest and other pixel games draw eating (plates on the table edge, per seat anchor); redo table size/seat plate anchors. [artist+coder, research]
13. OA-13 CAMERA: the player should stay in the middle of the screen always (replace the glide-follow "weird camera follow"); changes CLAUDE.md COD-1 camera rule (OK given). [coder]
14. OA-14 OPEN/CLOSED sign in the top-left icons: guests only come when open; closed when you have no food/drinks. [coder+ui]

After these: continue the roadmap and what we were doing (ST3, ST4, SG3d, RN-1, VG tasks, tester run 3 fix list).
