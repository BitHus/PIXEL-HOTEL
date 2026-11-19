# PLAN-SKILLTREE: a real skill tree, level cap 30 (planner, 19 Nov)

Status: DESIGN ONLY, no code. Owner ask (19 Nov): "a nice skill tree, make it an actual skill tree like other games. It needs a higher level cap, more
possibilities and further possibilities. Be creative and make your opinion count on the technical side." Every number below is a PROPOSAL; numbers
marked [OWNER] are ranked/balance numbers the owner signs off before code, then balance.test.ts and `npm run simulate` gate them.
Builds on MG-1/MG-7 (shared/src/skills.ts, skillRules.ts, shared/data/skills.json, client/src/ui/skillsPanel.ts) and docs/PLAN-MINIGAMES.md 4.
Supersedes the MG-9 panel idea (tabs of cards) and ROADMAP 2.2 "cap about 20".

## 0. Brief conflicts (CLAUDE.md must change, owner OK first)
- Section 10: "Levels 1 to 12 ... 32 nodes in 4 branches, tier N needs (N-1)*2 points" -> levels 1 to 30, about 92 nodes in 7 branches on one linked graph,
  ring gates (section 2.3). docs/TOOLS.md "level cap 12" changes with it.
- Section 10: "+3 max hp per level, +1 attack per even level" -> unchanged up to 12; after 12 only +1 max hp per level, no attack (combat power
  past 12 comes from skills and gear, so the crypt does not become trivial) [OWNER].
- XP today comes ONLY from crypt/mine kills (dungeon/bank.ts addXp). A cap of 30 needs XP from every loop (section 2.1). This is the biggest change.
- "No node adds gold" stays, made exact: no node MULTIPLIES a gold amount (price, tip, run gold, rewards). Throughput nodes (seats, guest rate, second
  order) are allowed because they already exist (Roomy tavern) and are gated by balance tests (guest share <= 85%).

## 1. What good trees do (research, inspiration only, nothing copied)
- Path of Exile: one shared graph; small nodes are the road, NOTABLES are the reason to walk somewhere, KEYSTONES are big upsides with a drawback that
  close other directions; routing is the puzzle. Take: a linked graph, notables, keystones with a mild cost, route planning.
- Diablo 4 / Torchlight: clusters unlocked by points invested; the last cluster offers several round "key passives" and you may take ONE. Take:
  points-invested gates per ring, one-of-N capstone choice.
- Stardew Valley professions: at level 5 pick one of two, which sets the level-10 pair; respec is allowed but costs (a statue + gold). Take: cosy
  either/or choices that change how you play, not just numbers; respec possible but not free forever.
- Cozy rule for us: no node is a trap, no node punishes, a downside is a trade (slower but more), every branch has visible "this changes play" goals.
Sources: saschb2b game-mechanics PoE passive tree; maxroll PoE beginners and D4 skill trees; Stardew profession guides (carlsguides, thegamer).

## 2. Levels, XP and points
### 2.1 XP from every loop (new data shared/data/xp.json, pure shared/src/xp.ts xpFor(event))
One function `grantXp(state, event, at)` (levels.ts addXp under it) is called by the rules that finish a thing; xp is never lost. [OWNER] values:
| event | xp |
|---|---|
| order delivered (drink or dish) | 2, perfect pour +1 |
| brew collected / stove batch collected | 4 / 1 per dish |
| plant harvested | by rank 1 / 3 / 8 / 20 |
| first time a splice result is made | 15 |
| fish caught | by rank 2 / 5 / 12 / 30 |
| tree felled | 2 |
| mine: ore or rare block dug / exit reached | 1 per ore, 10 per rare / 5 |
| crypt kill / floor exit | as now (3 / 5 / 4 / 40) / 5 |
| new Book entry / quest or achievement claimed | 2 / 10 |
| punching or placing blocks | 0 (exploit ceiling is 1800 breaks/h, balance.ts) |
Gate tests (balance.ts xpBySource): mixed-hour xp about 110 (new), 210 (level 12), 300 (level 20+); no source over 40% of the mixed hour; focused
farming of 2-minute crops <= 1.5x the mixed hour.

### 2.2 Curve (levels.json totalXp, levels 1-12 UNCHANGED so no save moves) [OWNER]
Steps grow 11% per level after 12. Hours = mixed play at the rates above (about 110 / 160 / 210 / 260 / 300 / 330 xp/h by 5-level bracket).
| lvl | total xp | step | hours | | lvl | total xp | step | hours |
|---|---|---|---|---|---|---|---|---|
| 2 | 15 | 15 | 0.1 | | 17 | 3530 | 520 | 17.5 |
| 3 | 40 | 25 | 0.4 | | 18 | 4110 | 580 | 19.8 |
| 4 | 80 | 40 | 0.7 | | 19 | 4750 | 640 | 22 |
| 5 | 140 | 60 | 1.3 | | 20 | 5460 | 710 | 25 |
| 6 | 220 | 80 | 1.8 | | 21 | 6250 | 790 | 28 |
| 7 | 320 | 100 | 2.4 | | 22 | 7130 | 880 | 31 |
| 8 | 450 | 130 | 3.2 | | 23 | 8110 | 980 | 34 |
| 9 | 620 | 170 | 4.3 | | 24 | 9200 | 1090 | 37 |
| 10 | 830 | 210 | 5.6 | | 25 | 10410 | 1210 | 42 |
| 11 | 1090 | 260 | 6.8 | | 26 | 11750 | 1340 | 46 |
| 12 | 1400 | 310 | 8.3 | | 27 | 13240 | 1490 | 50 |
| 13 | 1740 | 340 | 9.9 | | 28 | 14890 | 1650 | 55 |
| 14 | 2120 | 380 | 11.7 | | 29 | 16720 | 1830 | 61 |
| 15 | 2540 | 420 | 13.7 | | 30 | 18750 | 2030 | 67 |
| 16 | 3010 | 470 | 15.5 | | | | | |
Pace checks: a new game reaches level 2 in about 8 minutes and level 3 (mine opens) in about 25 minutes, both faster than today (crypt-only xp):
the owner decides if the mine should open at level 4 instead [OWNER]. A level per session (about 1-2 h) up to 20, then a level per 3-6 h:
long goal, never a wall. Crypt round 2 is tuned for level 8 (simulate-dungeon); with the hp change in section 0 a level-30 player has
30 + 33 + 18 = 81 hp before skills: simulate-dungeon must show round 2 still dangerous at 30 (target clear rate <= 90% bare gear) [OWNER].

### 2.3 Skill points and gates [OWNER]
- Sources (still DERIVED, never stored): 1 per level from 2 (29 at cap) + 1 per Book reward taken (max 4, as now) + 1 per 5 achievements claimed
  (max 5, quests.claimed). Max 38 points. The whole tree costs about 250, so a level-30 player owns about 15% of it: one branch nearly full plus
  a second branch half, or three shallow. That is the "many possibilities": no one-size-fits-all build.
- Ring gates replace SKILL_TIER_STEP: config SKILL_RING_GATE = [0, 3, 7, 10, 14] points spent in that branch for rings 1..5. Capstones also need
  player level 20. Keystones sit on ring 4, capstones on ring 5.
- Respec: the SAVE migration gives everyone one free reset. Then: UNDO any rank bought since the panel opened (free); unlearn a LEAF node (nothing of
  yours depends on it) for 10 gold x its ring; full respec 3 free, then 25 gold x level (300 at 12, 750 at 30) [OWNER]. All through applyChange 'respec'.

## 3. Tree structure
### 3.1 Shape
ONE graph. A hub (the hearth) in the middle, 7 branches as spokes at 360/7 degrees, rings 1 to 5 outward. Neighbour order around the circle is chosen
so bridges make sense: TAVERN - KITCHEN (brewing/cooking) - FARM - FISHING - MINING - DUNGEON - HOME (hotel/social) - back to TAVERN.
Node kinds: minor (small round, 1-3 ranks), notable (square, 1-2 ranks, a real feature), keystone (diamond, ring 4, a CHOICE pair: owning one locks
the other), capstone (big crest, ring 5, one per branch, changes play), bridge (between two neighbour branches on ring 3, reachable from either side).
Buy rule (PoE-style): a node is reachable when it is on ring 1, or ANY node linked to it is owned. Plus ring gate, level gate, choice lock, points.
### 3.2 Nodes (existing ids KEPT; new ids marked +). Format: id (ranks, costs) effect per rank; ring.
TAVERN: quick_feet (3, 1/1/1) room walk +6%; r1 | steady_hands (1, 1) tray +1; r1 | keen_eye (2, 1/2) perfect window +0.03; r2 | roomy_tavern (2, 1/2)
guest cap +1; r2 | +patient_guests (2, 1/2) guest patience +15%; r2 | wide_kegs (1, 2) tap cap +4; r3 | +smooth_pour (1, 2) pour fills 15% faster; r3 |
+warm_welcome (2, 2/2) guest rate +5%; r3 | +regulars_gem (1, 2) gem tip chance x1.2; r3.
 Keystones r4 (3 pts, pick one): +bustling_hall guests +15% rate, patience -20% | +quiet_corner guests -10% rate, 25% chance a seated guest orders
 a second drink. Capstone r5 (4): +tavern_legend a PERFECT pour walks the mug to the oldest waiting guest by itself (owner: automate minor actions).
KITCHEN (brewing and cooking): big_batch (2, 2/2) stove batch +1; r2 (moved) | cellar_racks (1, 3) casks per rack +1; r3 (moved) | +quick_simmer (3, 1/1/1)
cook time -8%; r1 | +brew_sense (3, 1/1/1) brew time -8%; r1 | +extra_mug (2, 2/2) +1 mug per brew; r2 | +thrifty_cook (2, 1/2) 10% chance an input is kept;
r2 | +patient_cellar (2, 2/2) cask ripening -10%; r3 | +hearty_food (2, 1/2) lunch-box food heals +15%; r2 | +taste_sense (1, 2) reserve taste chance
+0.05; r3. Keystones: +twin_barrel a barrel runs 2 brews at once, each 30% slower | +hot_stove batches 40% faster, batch max -1.
Capstone: +master_kitchen the prep bonus works anywhere in the tavern and its max is +3.
FARM: +green_thumb (3, 1/1/1) grow time -6%; r1 | +seed_keeper (2, 1/2) seed-back chance +5 pts; r1 | +strong_fist (2, 1/1) block hit cooldown -10%; r1 |
+bountiful (2, 2/2) 10% chance of +1 harvest; r2 | +long_arms (1, 2) block reach +1; r2 | +quick_splice (2, 1/2) splice extra time -15%; r2 |
+lucky_sprout (2, 2/2) harvest gem chance +10%; r3 | +big_garden (2, 2/2) plant cap +10 (farm), +2 (hotel, tavern); r3 | +seed_lore (1, 2) a pair you
made before shows its result on the young plant; r3. Keystones: +orchard_keeper grow -15% | +wild_splicer splice grows 25% faster, splice harvest gives
the seed back 5% more often. Capstone: +harvest_moon one punch on a ripe plant harvests every ripe plant in a 3 x 3 around it.
FISHING (all 8 kept): patient r1, wide_box r1, reel_master r2, bait_saver r2, sharp_eye r3, deep_cast r3, trophy_hunter r3 (rank odds stays <= +6%
total), calm_hands r2, +long_line (1, 2) cast reach +2 blocks; r2. Keystones: +calm_waters catch box +15%, rank odds -1 pt | +big_game rank odds +3 pts,
box -10%. Capstone: +double_hook 10% chance a common or rare catch comes with a second fish.
MINING (all 8 kept): strong_arm r1, lantern r1, ore_sense r2, careful_step r2, double_strike r3, pack_mule r3, prospector r3, gem_eye r3,
+sure_footing (1, 2) cave-in tell +300 ms; r2. Keystones: +blaster every 10th hit breaks the 3 x 3 of stone/dirt around (no ore from the blasted ones)
| +gem_cutter rare blocks glint +2 blocks farther, gem chance +2 pts. Capstone: +deep_delver start a visit at (deepest depth reached - 2).
DUNGEON (all 8 kept): thick_skin r1, satchel r1, sharp_edge r2, light_feet r2, second_wind r3, parry r3, treasure_sense r3, last_stand r3,
+quick_strike (2, 2/2) attack cooldown -8%; r2. Keystones: +brawler attack +2, max hp -10% | +guardian max hp +15%, damage taken -1, attack -1.
Capstone: +bone_breaker every 5th hit in a row on one enemy deals double (still one hit per tap, no auto-attack).
HOME (hotel and social): deep_pockets (2, 2/3) bag +6; r2 (moved) | +house_pride (3, 1/1/1) tavern appeal +3; r1 | +pack_lunch (1, 1) lunch box +1; r1 |
+decorator (2, 2/2) each decor type counts 1 more time for appeal; r2 | +quest_hand (2, 1/2) quest gems +15%; r2 | +book_worm (1, 2) Book shows outlines
of unseen entries in found tabs; r3 | +long_nap (2, 2/2) offline catch-up +2 h; r3 | +cat_friend (1, 1) the cat visits more (cosmetic); r1 |
+wanderer_feet (2, 1/2) walk +4% in farm and lakeside, chop cooldown -5%; r2. Keystones: +homebody hotel-room stars count double for appeal |
+wanderer outdoor walk +10%, tree regrow -20%. Capstone: +renowned_host guests sometimes leave a small gift (a common seed or block, never gold).
BRIDGES (ring 3, cost 2, 1 rank): +fresh_tap (TAVERN-KITCHEN) collecting a brew loads it onto a free tap of that drink | +kitchen_garden (KITCHEN-FARM)
input keep +5%, grow -5% | +worm_digger (FARM-FISHING) harvests sometimes give bait | +steady_grip (FISHING-MINING) reel drain -5%, pick cooldown -5% |
+delver (MINING-DUNGEON) +1 run bag in mine and crypt | +war_stories (DUNGEON-HOME) +3 max hp, guest patience +10% | +hearth_home (HOME-TAVERN)
appeal +2, room walk +3%. Hub: +hearth (free, owned by all) only the root of the graph.
Count: 63 minor/notable + 14 keystones + 7 capstones + 7 bridges + hub = 92 nodes. Every branch has at least 4 useful picks for 5 points (MG gate).

## 4. Data, rules, save (technical)
### 4.1 skills.json v2 schema
```
{ "version": 2,
  "branches": [{ "id": "tavern", "name": "Tavern", "icon": "branch_tavern", "angle": 0 }, ...7],
  "nodes": [{ "id", "branch": SkillBranch | "bridge" | "hub", "kind": "minor"|"notable"|"keystone"|"capstone"|"bridge"|"hub",
              "ring": 0..5, "pos": { "x", "y" } (tree units, 1 = 48 css px, authored, stable), "name", "icon", "text"? (one line for flag nodes),
              "maxRank", "costs": number[], "links": string[] (undirected; listed on one side, the loader mirrors them),
              "choice"?: string (one owned node per group), "gate"?: { "level"?: number },
              "effects": [{ "stat": StatId, "perRank": number, "cap"?: number }], "live": boolean }] }
```
- `live: false` = its stat has no hook yet: the panel shows "Coming soon" and the node is NOT buyable (today's "not active yet" nodes can be bought
  and do nothing: that is a trust problem; v2 fixes it). Nodes go live one hook batch at a time.
- pos is authored once by tools/layout-skilltree.mjs (radial: angle per branch, radius = ring x 3 units, siblings spread +-12 deg), then hand-tuned
  in the JSON. Positions are data, never computed at runtime (stable for screenshots, tests and the tester).
### 4.2 Pure rules (shared/src/skills.ts grows; skillRules.ts stays the ONLY place rules read stats)
- loadTree() mirrors links, checks: ids unique, links exist, every node reachable from the hub, every choice group has >= 2 nodes on one ring,
  costs.length === maxRank, effects stats are StatIds (test fails on bad data).
- skillProblem adds 'unlinked' | 'ring' | 'level' | 'choice' | 'soon'. pointsEarned(level, bookRewards, achievements).
- validBuild(ranks): every owned node is reachable through owned nodes from the hub, gates hold, at most one per choice group. Used by buy, unlearn,
  the migration and (later) the server.
- unlearnProblem(id): only a leaf whose removal keeps validBuild. undo in the panel = unlearn of a rank bought this session at no cost.
- cheapestPath(ranks, targetId): Dijkstra over node costs from the owned set, for the panel's route preview ("4 nodes, 7 points").
- skillStats unchanged in shape (Bonuses); flag stats are 0/1. Keystone downsides are plain negative effects.
- Gold: only respec/unlearn through applyChange; no stat multiplies a gold amount (a test lists every StatId and fails on a new one that is not in
  an ALLOWED_STATS list with a one-line reason).
### 4.3 New stats and their hooks (one helper each in skillRules.ts; rank 0 = old number exactly, tested)
Tavern: guestPatiencePct (GUEST_PATIENCE_MS), guestRatePct (guest interval), pourFullPct (POUR_FULL_MS), gemTipPct (TAVERN_GEM_CHANCE_MULT),
secondOrderPct, autoCarryPerfect. Kitchen: cookMsPct, brewMsPct, brewYieldPlus, inputKeepPct, ripenMsPct, foodHealPct, tasteReservePts, twinBarrel,
prepAnywhere, prepBonusPlus. Farm: growMsPct (SEED_GROW_MS), seedBackPts (SEED_BACK_CHANCE), blockHitCdPct, harvestBonusPct, blockReachPlus
(BLOCK_REACH), spliceMsPct (SPLICE_BONUS_MS), harvestGemPct, plantCapPlus (PLANTS_ROOM_CAP), seedLore, areaHarvest, harvestBait. Fishing: castReachPlus,
doubleCatchPct (+ old baitSavePct, deepCast, keepBaitOnLoss: need the bait rework). Mining: caveTellMs, blastEvery, deepStart. Dungeon: attackCdPct,
maxHpPct, damageTakenPlus, heavyEvery. Home: appealPlus, decorTypeCapPlus, questGemsPct, bookOutlines, offlineHoursPlus (OFFLINE_MAX_HOURS),
lunchBoxPlus (LUNCH_BOX_MAX), catVisitPct, outdoorWalkPct, treeRegrowPct, homebodyStars, giftChancePct, autoLoadTap (+ old bagSlotsPlus).
About 45 hooks: they ship in 4 area batches; until then their nodes are `live: false`.
### 4.4 Save: SAVE 42 (now 41)
Player.skills stays { ranks, respecs } plus optional `tree: 2`. MIGRATIONS[41]: drop unknown ids, clamp ranks to maxRank, then if validBuild fails
clear ranks; in every case set `freeReset: true` (one free full respec, does not count toward respecs) and leave a one-time toast flag. Points are
derived, so nothing can be lost. Tests: an MG-1 save with each old node keeps its ranks where valid; an invalid build becomes 0 spent and full free
points; idempotent; earned >= spent always; level 12 save with 1400 xp stays level 12.
### 4.5 Balance gates (balance.ts + balance.test.ts + simulate table SK)
- A "best build" per stage (the points a player has at that level spent greedily on tavern throughput): guest share of the mixed hour <= 85% and
  gold per hour <= +35% over the bare build at levels 12, 20, 30.
- seedRatio of every block seed < 0.85 with seed_keeper + wild_splicer + kitchen_garden maxed; renowned_host gifts and double_hook included in the
  "playing a pack gives back at most half" and gem-source (no source over 40%) checks.
- Mine ore per hour, best gear + skills <= +60% over bare (MG1 gate); fishing idle bot still loses rare+ with big_game; crypt round 2 at level 30.
- Points: total tree cost > 4 x max points (no "own everything").

## 5. UI: a real tree you can pan and zoom (client/src/ui/skillTree/, replaces the card list in skillsPanel.ts)
Technical pick: DOM + SVG, NOT a second PixiJS app. 92 nodes as absolutely placed buttons and one SVG layer for the links, all inside one
container moved by `transform: translate3d() scale()`. Why: free hit testing, focus and screen-reader names, crisp pixel icons
(image-rendering: pixelated), 44 px touch boxes, Lantern Dark CSS reuse, and no second WebGL context on phones (memory). 92 nodes is tiny:
a pan only changes one transform (no layout, no redraw); state changes re-class only the touched nodes.
- Camera (pure helper ui/skillTree/treeCamera.ts + test, same formulas as CLAUDE.md 4: screen = (p - cam) * zoom): one-finger drag pans, pinch and
  wheel zoom 0.5..2 around the pointer, eases to a scale where scale x dpr is whole after the gesture, pan clamped to the tree bounds + margin,
  a tap = under 8 px and 300 ms (the game's tap rule), inertia 200 ms. Double-tap zooms in a step. Opens centred on the nearest AVAILABLE node
  (or the hub at a level-1 save) at the zoom where a ring is about 3 nodes across.
- States: locked (dark disc, grey icon, dim link), available (gold rim, slow 2 s glow, the only animated thing), bought (warm fill, lit pips),
  maxed (full gold frame), choice-locked (crossed rim, "You chose Quiet corner"), soon (dashed rim). Links light amber when both ends are owned,
  dashed gold toward available nodes. Kinds by frame shape: round minor, square notable, diamond keystone, crest capstone, bridge = two-tone.
- Detail card: tap a node = card with icon, name, kind, ranks pips, "Now 128 -> 136 px/s" preview (skillsText.ts), cost, why locked, and for a far
  node the ROUTE PREVIEW (cheapestPath highlighted on the tree, "4 nodes, 7 points"). Learn asks first (confirmBuy), Undo appears after a buy.
- Top strip: points free, branch chips (7, tap = fly to that branch over 300 ms), Respec. Search is not needed at 92 nodes.
- Per screen class (docs/TOOLS.md UI RULE): phone portrait = full sheet, tree on top, card as a bottom sheet with Learn in thumb reach, chips in one
  scroll row; phone landscape = tree left, card right column; desktop = wide panel, hover shows a small tooltip, wheel zoom, keyboard: arrows move
  focus along links, Enter learns, Esc closes card then panel. Safe-area insets, nothing under the hotbar.
- Performance budget: open < 50 ms on a mid phone, pan 60 fps (one transform), no box-shadow on 92 nodes (glow only on available ones, CSS
  opacity animation), icons from one sprite sheet (skill_icons.png + json), SVG links as one path per state (4 paths total, not 120 lines).
- Juice: buying = node pops (scale 1.15, 120 ms), the link toward it fills like a fuse (200 ms), a soft chime; a capstone gets a 1 s crest flash.

## 6. Art (PixelLab, owner cap rules in docs/TOOLS.md)
- Node icons 32 x 32, couch.png/statue.png style, original: 84 branch nodes + 7 bridges = 91 unique; the hub reuses the hearth. 7 branch emblems
  32 x 32 (tavern mug, kitchen pot, farm sprout, fishing hook, mining pick, dungeon sword, home key). Total 98.
- Frames (round, square, diamond, crest, bridge, 5 states) are CODE (CSS borders + 9-slice from art-src/pixellab/ui), 0 generations.
- Budget about 100 generations [OWNER, it is outside the 19 Nov cap]: first run `search_help(tool=...)` for the cheapest 32 x 32 object price.
  If a 32 x 32 costs more than 1, plan B: 48 icons (notables, keystones, capstones, bridges, emblems), minor nodes use their branch emblem tinted.
- Old 32 ids: today they show generic pixelIcons; they get their own icons in the same batch. Output client/src/assets/ui/skills/<icon>.png,
  packed by a tool into skill_icons.png; Endesga snap, palette bad 0, contact sheet to Desktop/PocketBarrel-styletest/skills.

## 7. Work breakdown (order; prompts ready to paste; each worker reads this file, CLAUDE.md 10, docs/NEWS.md top)
SK-0 [owner] Confirm the 5 decisions in section 9 and the [OWNER] numbers. Nothing below starts before that.
SK-1 [coder] Tree v2 rules + data + SAVE 42.
 "Implement docs/PLAN-SKILLTREE.md 4.1, 4.2, 4.4 and 2.3 (points, ring gates, respec/unlearn/undo). Rewrite shared/data/skills.json to v2 with all 92
 nodes of section 3.2 (pos from a new tools/layout-skilltree.mjs, live: true only where skillRules.ts already reads the stat). shared/src/skills.ts:
 loadTree, validBuild, unlearnProblem, cheapestPath, new problems; config SKILL_RING_GATE, SKILL_ACHIEVE_PER_POINT, SKILL_ACHIEVE_MAX, respec costs.
 SAVE 42 migration + tests (section 4.4). GameAPI getSkills/buySkill/unlearnSkill/respecSkills. Keep the old panel working (it may list v2 nodes
 by branch). Tests first. npm run check green. No ranked number other than those in the plan."
SK-2 [coder] XP from every loop + level cap 30.
 "Implement docs/PLAN-SKILLTREE.md 2.1 and 2.2: shared/data/xp.json, shared/src/xp.ts xpFor + grantXp, called where an order is delivered, a brew or
 batch collected, a plant harvested, a splice first made, a fish caught, a tree felled, mine ore/rare/exit, quest/achievement claimed, Book entry.
 levels.json to 30 (1-12 unchanged), maxHpAt/attackBonusAt rule after 12 (section 0). balance.ts xpBySource + tests (no source > 40%), simulate
 table XP. Run simulate:dungeon at level 30 and report. Info panel xp bar still fine."
SK-3 [coder] Hooks batch TAVERN + HOME (stats of 4.3), set those nodes live. SK-4 KITCHEN + FARM. SK-5 FISHING + MINING + DUNGEON + bridges.
 "Hook the stats of docs/PLAN-SKILLTREE.md 4.3 for <areas> through shared/src/skillRules.ts (one helper each; rank 0 = old number exactly, a test
 per helper), call them from the rules, flip `live` to true for their nodes, extend the balance gates of 4.5 for those stats. No gold multiplier."
SK-6 [ui] The tree canvas.
 "Build client/src/ui/skillTree/ per docs/PLAN-SKILLTREE.md 5 (DOM + SVG, treeCamera.ts pure + tests, states, detail card, route preview, undo,
 branch chips, per screen class). Replace the card list in skillsPanel.ts; keep the Skills button and its dot. Test 420x760, 360x640, phone landscape,
 1000x700; e2e/skilltree.spec.ts: pan, pinch (two touch points), learn, undo, choice lock, coming-soon refusal."
SK-7 [artist] 98 icons (section 6), sprite sheet + json, contact sheet, LEDGER in docs/PLAN-PIXELLAB-ART.md, get_balance before and after.
SK-8 [tester] Play a level-1 save to level 5 and a debug level-20 save: tree readability, phone pan/zoom feel, first point within 10 minutes.
SK-9 [coder] Docs: CLAUDE.md 10, BRIEF 10, NOTES SK, TOOLS level cap, ROADMAP ticks.

## 8. My technical opinion and risks
- XP from every loop is the real work, not the tree. Without it a cap of 30 is 200+ hours of crypt slimes. Ship SK-2 together with SK-1.
- Do not show buyable dead nodes. 45 hooks will take several batches; `live: false` keeps the tree honest and lets art and UI ship first.
- Keep derived points (never stored): it is the reason the migration is safe and the server can check builds later with validBuild.
- DOM + SVG over Pixi for the tree: simpler, accessible, cheaper on phones. Revisit only if the tree grows past about 300 nodes.
- Biggest balance risk: tavern throughput stacking (roomy_tavern + warm_welcome + quiet_corner + patient_guests + long_nap). The 85% guest cap
  test with a "best build" must exist BEFORE those nodes go live.
- Second risk: seed loops (seed_keeper, wild_splicer, worm_digger, renowned_host). seedRatio < 0.85 at max bonuses or the node changes.
- Third: hp scaling. Keep +1 hp per level after 12 and no attack, or round 2 becomes a walk at level 30.
- Fourth: authored pos for 92 nodes is tedious; the layout tool does the first pass, tweaks stay in data (no runtime layout = no surprises).
- Fifth: 7 keystone choices + capstones can confuse a new player. Rings 4-5 stay hidden behind a soft "?" silhouette until the branch has 7 points,
  so the first hours look like a small friendly tree that grows.

## 9. Owner decisions (top 5)
1. Level cap 30 with the xp table of 2.2 (levels 1-12 unchanged) and XP from every loop (2.1); mine at level 3 or 4.
2. 7 branches (Tavern, Kitchen, Farm, Fishing, Mining, Dungeon, Home) on one linked graph, about 92 nodes, keystone either/or and capstones.
3. Hp/attack after 12: +1 hp per level, no attack (combat power from skills and gear).
4. Points 29 + 4 Book + 5 achievements = 38 max; respec: one free reset now, undo free, leaf unlearn 10 x ring gold, full respec 3 free then 25 x level gold.
5. Throughput nodes allowed under the 85% guest-share gate; about 100 PixelLab generations for the icons outside the current cap.
