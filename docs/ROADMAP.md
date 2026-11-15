# ROADMAP

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

## PRIORITY ORDER (manager decision 16 Nov; the owner said: look at the whole roadmap and decide; this order wins over the phase order below)
Rule: the game must be fun and good-looking in a browser BEFORE it gets bigger or online. Depth that feeds the existing loops beats new areas.
VIBES FIRST (owner 16 Nov, updated): the game must look and feel like a cozy MEDIEVAL pixel game (Travellers Rest is the reference; see docs/ART-STYLE.md MEDIEVAL DIRECTION). Four art/feel tracks run in parallel with the features and rank above 2 onward: (A) furniture and item redo with matching icons (docs/ART-REDO.md); (B) CHARACTERS: a real pixel avatar and NPCs, medieval outfits and hats (docs/PLAN-CHARACTERS.md; U1 approved); (C) the OUTDOORS REWORK (1b below); (D) medieval content: new furniture, clothes, recipes and decor in medieval style (anvil, weapon rack, banners, chandelier, hearth, trestle tables).
NOW (in progress): C6 done; N1 done; art redo round 2; C11 outdoors hooks; character plan being written.
1. Playtest 2.1 + first-hour pass 2.3 (a real hour in a browser, one fix list; the owner or a browser-capable tester). Nothing else beats finding what is broken.
1b. OUTDOORS REWORK (owner 16 Nov: the dungeon and the fishing/lakeside look ugly; art and vibes, runs in parallel with 1): docs/PLAN-REWORK-OUTDOORS.md, tasks C11 to C16 (hooks + fx, dungeon juice, fishing/lake juice, crypt light, lakeside ambient, effects settings) and A15 to A23 (code-art crypt and lake now, PNG tiles/enemies/water/trees when the plugin is back), prompts in docs/QUEUE.md. Look and feel only: no rule and no save change. It goes before 2 (9g-2 and the rest) in both lanes.
2. 9g-2 usable furniture and the cat (save 28), with PT-1 pastimes folded in; 9g-3 room stars; M-C One Inn score. These make the hotel and tavern feel alive.
3. 9i questline with BD-1 board orders (no timers): gives the player direction; fixes the first hour.
4. Art rounds continue every cycle (4.2 to 4.6): floors, walls, crops, food, tools, plants, avatar clothing. Art is always one lane busy.
5. 9h dungeon round 2 (after `npm run simulate` shows no source over 50%) and 5.5/5.4 deeper dungeon and mine.
6. RG-1 Regulars and RN-1 Inn Renown (the best research ideas: they make the tavern sticky). Then 5.1 pets, 5.2 potions and accessories, SM-1 slow makers (first slice of 5.3).
7. Phase 3 goals: skills 3.1, achievements and titles 3.2 (with TB-1), collections 3.3; 5.7 hotel 2 furniture sets; 5.8 world life (day/night, weather).
LATER (only after all of the above feels good): 9g-4 visitors, 5.6, 7.1 Tavern 2 (staff), JR-1 recipe journal, SE-1 seasons, 7.2 new areas, 7.3 random events, 7.4 buildings.
ONLINE (phase 6, step 10): after depth and a clean playtest. Order inside: AM-1 and SF-1 safety first, 6.1 server, 6.2 visits, then the rest. Needs the owner's go.
NOT NOW: phase 8 release (name, legal, Windows app) until the game is playable end to end; trading and marketplace and PvP stay held; real money, daily rewards, limited offers and lucky wheels stay rejected.

## DONE
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
5.3 Farm 2: more crops, crop quality (normal, good, excellent, golden), scarecrow, greenhouse,
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

## IDEA POOL (not planned yet)
Item descriptions and comparison, favourites, search in the bag, a pet that sits on your head,
candles that burn down, a rare rainbow, shooting stars, footprints in snow, hidden passages, a
hidden NPC, mine carts, mining companions, fishing tournaments, a radio with music.
