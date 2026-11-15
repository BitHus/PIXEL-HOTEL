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

## DONE
Rooms, avatar, walking, furniture, placing, inventory, chat, saving (steps 1 to 5b). Shop with
customers and the till (7), room shapes and character creation (7b), dungeon (8, 9), farm and
cooking (9b), mine and forge (9c), UI polish, atmosphere (light, shadows, sound), logo splash,
shop life (9d), ranks and the Book (9e), the lakeside: fishing and woodcutting (9f), housekeeping
(1.0: CLAUDE.md shortened; the full brief is docs/BRIEF.md, earlier steps' details docs/NOTES.md).

## PHASE 1 - Finish the core game
The loops that are planned must all exist before anything else is added.
1.0 Housekeeping: shorten CLAUDE.md. [done]
1.1 Step 9f - Lakeside: fishing and woodcutting. [done]
1.2 Step 9t - The tavern: the shop becomes a tavern (owner's decision, 14 Nov). Guests sit, order
    drinks and dishes, the player serves and collects the coins; brewing; the loot stall stays as
    a market corner. [prompt ready; part A (shared rules) done, B and C to do]
1.3 Step 9g - Livelier hotel: hats, emotes, usable furniture, the cat, room stars, visitors.
    [prompt ready]
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
Now the feature set is stable enough to draw once.
4.1 docs/STYLE.md and a test set: the avatar, 5 pieces of furniture, one floor, one wall.
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
6.2 Visiting rooms: see other players walk, sit, emote; public room chat with the filter, report
    and mute (section 13).
6.3 A lobby / town square as the shared place to meet; a room list.
6.4 Room ratings, room contests, leaderboards, profiles with showcases, titles and badges.
6.5 A small private test with friends; fix list.

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
- Mystery boxes: section 13 says no loot boxes. Only as a free reward with visible odds, or not.
- Trading, a player marketplace, player shops, a friends list: section 9 and 13 say not in v1.
  Only after phase 6 (online), with new safety rules.

## IDEA POOL (not planned yet)
Item descriptions and comparison, favourites, search in the bag, a pet that sits on your head,
candles that burn down, a rare rainbow, shooting stars, footprints in snow, hidden passages, a
hidden NPC, mine carts, mining companions, fishing tournaments, a radio with music.
