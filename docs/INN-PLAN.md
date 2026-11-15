# INN-PLAN: one game out of the block world, the tavern and the hotel room (planner, 15 Nov)

Status: ACCEPTED by the owner (15 Nov): one connected Inn, playtest + refactor first, and COOKING MOVES
TO THE TAVERN (M-D). No code yet.

## 1. Review: what the project is now (checked in the repo, 15 Nov)
Built and merged: cell grid, icons, popups, gems, blocks + hold-to-punch, free-form farm, seeds,
splicing (40 recipes), packs, balance (BG1 to BG9), plus dungeon, mine, forge, lakeside, shop
with customers, the Book. About 15 000 lines in client/, 17 000 in shared/, 21 data files.
Tavern: only part A (shared rules) exists. The Map still says "Shop" and the game shows no
tavern yet.

What makes sense:
- Pure rules in shared/ with tests, one ledger, one GameAPI: this is what keeps the project
  alive. Keep it.
- The block world gave the game a "doing" loop (punch, plant, splice, open) that the hotel lacked.
- Gems for play, gold for the tavern: two jobs, no overlap. Good.
- Splice results that are furniture or clothes seeds are the right bridge from farming to the hotel.

What does NOT make sense yet (honest list):
1. THREE GAMES SIDE BY SIDE. Hotel room, tavern, garden and the trips are separate rooms behind
   a Map list. Nothing physically connects them and almost nothing the player makes in one is
   NEEDED in another. Blocks are only walls and fences; the hotel room has no job except looking nice.
2. TWO BUILDING SYSTEMS with no relation: blocks (cells, punch) and furniture (cells, Build
   mode). A player can ask "why would I ever place a plank block when I can place a table?"
3. THE HOTEL ROOM HAS NO LOOP. Gold and gems end in packs, rooms and the catalog; the hotel
   only receives. No score, no visitors (9g), so nothing rewards making it pretty.
4. THE TAVERN IS NOT IN THE GAME, but the economy (BG9) was balanced on the old shop. Balance
   must be redone after 9t.
5. UNPLAYED. Nine big steps landed in a few days. Nobody has played a full hour from a new game.
   The risk is not missing features, it is unfun or confusing ones (phase 2.1 is overdue).
6. SIZE. client/src/main.ts is 1 893 lines, api/localGameAPI.ts 1 181, config.ts 931. New
   steps get slower and riskier. One refactor step now is cheaper than later.
7. UI WEIGHT. Right column plus hotbar plus panels for blocks, seeds, packs, Book tabs, forge,
   cooking, runs: it will crowd a phone screen. Needs one phone pass.

## 2. The idea that merges them: ONE INN, three zones, one flow
The player owns ONE INN with a name (the Growtopia "world name", later the visit address).
Zones, all connected by doors you can walk through (Map stays as fast travel):
- THE GARDEN (today's farm room): the blocks, seeds and splicing world. Produces crops, blocks,
  furniture seeds, clothes seeds. Beauty counts (flowers, fences, lanterns).
- THE TAVERN (today's shop): where gold is earned. Uses crops (brewing, cooking), shows
  goods on the stall (later a vending machine for real players), guests sit on furniture.
- THE PRIVATE SUITE (today's hotel room): the owner's home and showcase: grown furniture, hats,
  trophies, the Book wall. Visitors tip by its stars.
Trips (dungeon, mine, lakeside) are EXPEDITIONS out of the inn: they bring ore, loot, fish,
gems, rare seeds back. Packs (gems) are the shop in the corridor.
One flow: expedition -> garden/forge -> tavern (gold) -> suite (beauty) -> more appeal -> more
guests. Every zone needs another zone's output and gives one back.

## 3. The merge, as concrete rules (owner decides; advice in brackets)
M-A. CARPENTRY (blocks become furniture). A Workshop tab: planks, stone, glass, brick, clay,
     thatch + cloth/bars -> furniture, so garden blocks build the suite and the tavern. About 12
     recipes (a plank bench, stone fireplace, glass lamp, brick oven, thatch rug, planks bar
     stool...). Block furniture has its own look (the block's colours). [Do it: it gives blocks a
     reason beyond walls and makes farming matter to the hotel.]
M-B. CONNECTED INN. Doors between zones (walk to the door, short fade, arrive at the matching
     door). One Inn name set at the start, shown in the info panel. Map still travels. Expedition
     places (dungeon, mine, lake) keep the Map only. [Do it; small and makes it feel like one
     place.]
M-C. ONE INN SCORE. A single "Inn appeal" 0 to 100 from three parts: tavern furniture appeal
     (as shopAppeal today), suite stars (9g room score) and garden beauty (flowers, lanterns,
     fences, plants count by baseValue, capped). It sets guest rate, tip size and later visitor
     numbers. Blocks and plants now COUNT, so building with them pays. [Do it after 9t and 9g.]
M-D. THE TAVERN KITCHEN (owner, 15 Nov: you cook in the tavern). The cooking pot leaves the
     garden: the tavern gets a KITCHEN corner with a stove (furniture, one at the start, more in
     the catalog) and the brewing barrel. Cooking takes real time per batch (also while the game
     is closed, time passed in): put crops in, wait, tap to collect dishes. Dishes feed three
     things: the MENU (guests order them, 9t), the lunch box for the dungeon (heals and buffs as
     now), and the stall. So the garden grows, the kitchen turns crops into dishes, the bar sells
     them. The garden keeps no pot; the farm room is for planting only. Step K1.
M-D2. BREWING AND RIPENING (owner, 15 Nov). Brewing is 9t C (barrel, real time, drinks.json). RIPENING
     is new (step K2): a finished batch can go into a CASK on a keg rack and ripen in real time,
     also while the game is closed: fresh -> aged -> vintage, each tier worth more (value x1.6,
     x3) and some guests ask for them (a taste trait: they pay above tolerance for aged or
     vintage and tip more). Waiting is the cost: casks are limited (a keg rack holds a few), so
     the player chooses what to age. Aged and vintage drinks are separate item ids (root_ale_aged,
     root_ale_vintage) built from drinks.json, so stacks, the ledger, the Book, icons and the
     stall work unchanged. Vintage drinks are Book finds. A bigger cellar comes with hotel 2
     (roadmap 5.7). Later idea: the same for food (cheese, cured ham).
M-E. SHOWCASE. The suite gets trophy places: the Book rewards, splice discoveries (a plant
     in a pot for each recipe found), hats on a stand. Shows achievements (phase 3). [Later.]
M-F. LATER WITH ONLINE: the stall becomes a vending machine for real players, locks and
     access lists per zone (suite private, tavern and garden public), visit by Inn name.
Rule for blocks versus furniture: BLOCKS = structure and nature (walls, paths, fences, soil, light).
FURNITURE = things you use or admire (tables, beds, lamps). Carpentry connects them.

## 4. Order (proposal, replaces the loose ordering in the roadmap)
1. PLAYTEST + FIX (docs/ROADMAP phase 2.1, brought forward): the owner plays one full hour from
   a new game; one fix list. No new features first.
2. R1 REFACTOR: split main.ts and localGameAPI.ts by part (no behaviour change).
3. 9t B (guests and serving), then K1 (kitchen: cooking moves to the tavern), then 9t C (brewing, Menu), then K2 (ripening).
4. M-A carpentry, M-B connected inn.
5. 9g livelier suite (stars, visitors, hats, cat), then M-C one Inn score.
6. 9i questline, rewritten to follow the one flow (garden -> tavern -> suite -> expeditions).
7. 9h dungeon round 2 and themes; phase 2.2 economy re-balance; art.
Step prompts: docs/NEXT-STEPS.md "Inn steps".
