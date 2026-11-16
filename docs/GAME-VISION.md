# GAME VISION: one logical game from three inspirations (manager, 16 Nov; owner asked to combine Growtopia, Travellers Rest and Habbo)

Sources: docs/RESEARCH-GAMES.md and docs/RESEARCH-DEEP.md (inspiration only, nothing copied; original names, art and assets). This page is the glue: every system in the roadmap must fit one of the three pillars and feed the loop below. If a feature does not, it waits.

## The pitch in two lines
You run a cosy medieval INN. You grow, splice, brew, cook and craft what the inn needs, serve guests by hand, and build your inn, garden and private suite into a place that shows who you are.

## Three pillars (what we take from each game)
1. THE TAVERN IS THE HEART (Travellers Rest): guests with tastes, a menu you control, brewing, cooking, pouring and serving by hand, appeal from decor, Inn Renown ranks that unlock staff, guest rooms and menu tiers, regulars with names, orders on a board. Cosy, warm, medieval. Long goals so there is never "nothing to do after the unlocks".
2. THE BLOCK WORLD IS THE ENGINE (Growtopia / Pixel Worlds): a grid of blocks you place and punch, seeds that grow on blocks, SPLICING almost any two seeds into a new one (the discovery loop and the Book), gems from everything, packs for gems, hold-to-repeat and drag-to-steer controls that always feel smooth. Food crops grow on soil, everything else on any block.
3. IDENTITY AND HOME (Habbo): your avatar (layers, hats, medieval outfits), your suite as a showcase (furniture as status, room stars, pets, pastimes), the garden as your landscape. Later: visiting rooms by name with safety first. Never real money, never pay to win.

## The one loop (every system plugs into it)
GATHER (garden and splice, dungeon, mine, lakeside) -> MAKE (brew, cook, forge, carpentry, crafting) -> SERVE (tavern: pour, deliver, tips) -> EARN (gold, gems, renown, Book finds) -> BUILD (blocks, furniture, styles in tavern, garden, suite) -> SHOW (room stars, Inn Renown rank, Book completion, achievements, later visits) -> unlock deeper GATHER (deeper dungeon, rarer seeds and ore, new areas).

## How the pieces connect (the links that make it one game)
- Splice results feed everything: food crops raise the menu tier of the tavern, block seeds give decor and building material, ore and clothes and furniture seeds feed the forge, the wardrobe and the suite. Discovering combos fills the Book (and gives gold at 25/50/75/100%).
- The dungeon and the mine give what the garden cannot (rare seeds, ore, gems, loot for crafting); the garden and the lakeside give what the tavern sells (crops, fish); the tavern pays for everything (gold) and its renown opens the next steps.
- Furniture and styles are earned or crafted in medieval themes; the suite and the tavern both raise stars/appeal, which raise guest rate and renown.
- Gems come from play only; packs are the one random thing, with visible odds. Balance tests (`npm run simulate`, balance.test.ts) gate every content batch (Growtopia lost days to a recycle exploit; Pixel Worlds had to reset its economy).

## Always three goals on screen (so the player always knows what next)
NOW (seconds to minutes): the first-steps card, then the current order or quest. SESSION (about an hour): orders board, quest chapters, one new splice or dish to discover. LONG (days): Inn Renown rank, Book 100%, big projects (a hall, a brewery, a library), room stars 5/5, collections.

## Feel rules (owner: vibes and fun first)
Cosy medieval look (docs/ART-STYLE.md), smooth everything (hold/drag walking everywhere, eased motion, instant feedback), juice and sound on every satisfying moment (pour, coins, door, harvest, splice reveal), short skippable tutorials, no timers that punish, no daily-login pressure.

## Order of work (matches docs/ROADMAP.md PRIORITY ORDER)
1. CORE FEEL: serving works and feels great (hands-on pour, deliver), smoothness, first ten minutes, art pass (floors/walls, furniture, icons, avatar). Test every batch in headless Chrome.
2. THE BLOCK WORLD DEEP: planting on any block, open splicing, splice preview and Book tab, dungeon layout redo (no boring corridors), garden as landscape.
3. THE TAVERN DEEP (Travellers Rest): Inn Renown ranks, regulars, guests with tastes, orders board (no timers), menu tiers from splice foods, cleaning and closing report, staff and guest rooms, big projects.
4. IDENTITY AND HOME (Habbo): avatar and NPC redesign finish, hats and wardrobe, suite showcase, room stars and One Inn score, pets, pastimes, titles and badges.
5. WORLD: more areas, seasons, events, deeper dungeon and mine, potions and accessories.
6. ONLINE (later, owner's go): safety first (mute, report, filter, server limits), then visiting rooms by name, a shared lobby tavern, leaderboards; trading stays held.
