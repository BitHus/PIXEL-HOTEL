# RESEARCH DEEP DIVE: Travellers Rest, Growtopia, Pixel Worlds, Habbo (lead, 16 Nov 2026)

Purpose: learn what makes these four games fun and sticky, and turn it into small, original changes for our game.
INSPIRATION ONLY (CLAUDE.md section 1): original names, art and assets. Nothing here is a spec to clone. Builds on
docs/RESEARCH-GAMES.md (first pass); this pass fetched real pages. No screenshots or assets of these games go in the repo.

## 0. Method and source quality (read this first)

About 25 pages were fetched with WebFetch (16 Nov 2026). Quality key: A = primary (developer, store page, official
press), B = reviewer or aggregator of many player reviews, C = fan/commercial guide (indicative only), G = general
knowledge of the lead, NOT verified in this pass (marked "(G)" in text; verify before building on it).

Fetch failures, so these gaps remain: the Travellers Rest fandom wiki (HTTP 402), a second review site (403), the
shapes.inc fan deep dive (404 on fetch; only the search snippet was seen, quality C). Therefore Travellers Rest
details on staff tasks, exact reputation levels, art palette, animation and music are thin; the sections say so.
For those, ask the owner to read the wiki by hand or provide notes before we copy any number.

| Source | Quality | What it gave |
|---|---|---|
| [Steam: Travellers Rest](https://store.steampowered.com/app/1139980/Travellers_Rest/) | A | Feature list, price, 88% of 8,477 reviews positive (recent 77%), co-op up to 4, soundtrack sold as DLC |
| [Vaporlens review summary: Travellers Rest](https://vaporlens.app/app/1139980/travellers_rest) | B (aggregates reviews, counts mentions) | Praise and complaint counts |
| [Stack Up early-access review](https://stackup.org/post/early-access-review-travellers-rest) | B | Loop, town shops replacing mailbox, holiday events, praise/complaints |
| [Super Jump review](https://superjumpmagazine.com/travellers-rest-review-cat-webling) | B | Customer satisfaction factors, staff at level 6, 30 seats, tutorial pain |
| [Playing This Week](https://playingthisweek.substack.com/p/playing-this-week-travellers-rest) | B (a critical, opinionated reviewer) | Repetition, "nothing else to work for", odd NPC designs |
| [Game Developer: Growtopia postmortem](https://www.gamedeveloper.com/business/two-guys-made-an-mmo-the-growtopia-postmortem) | A (developers' own words, 2013) | Economy mistakes, social hooks, exploits, validation |
| [Growtopia wiki: Tree/splicing](https://growtopiawiki.com/w/Tree) | A- (fan wiki, thin page) | Splice steps and rules |
| [BlueStacks Growtopia beginner guide](https://www.bluestacks.com/blog/game-guides/growtopia/gtp-beginners-guide-en.html) | C (commercial) | Onboarding, locks as currency, social economy |
| [Well-Played Growtopia review](https://www.well-played.com.au/growtopia-review/) | B | Console port, pay-to-win complaints, UI, grind |
| [Steam: Pixel Worlds](https://store.steampowered.com/app/636040/Pixel_Worlds/) | A | Features, 69% of 3,821 positive, player-driven economy, scam warning |
| [Press release: Pixel Worlds relaunch](https://www.gamespress.com/Social-Sandbox-Game-Pixel-Worlds-Returns-as-a-Clean-Reboot) | A (marketing) | Economy reset, moderation, exploit lessons |
| [Pocket Gamer: Pixel Worlds](https://www.pocketgamer.com/pixel-worlds/review/) | B | Tutorial minimal, social good, griefing and begging |
| [Wikipedia: Habbo](https://en.wikipedia.org/wiki/Habbo) | B+ | History, currencies, 2012 chat shutdown, Origins |
| [Canadian Encyclopedia: Habbo](https://thecanadianencyclopedia.ca/en/article/cyber-hotel-for-teens-is-a-hit) | B (early 2000s) | Why teens loved it: rooms, rituals, furni as status |
| [Steam: Habbo Hotel Origins](https://store.steampowered.com/app/3809900/Habbo_Hotel_Origins/) | A | 2025 relaunch features; 55% of 1,233 positive |
| [Vaporlens: Habbo Origins](https://vaporlens.app/app/3809900/habbo_hotel_origins) | B | Praise and complaints (39% positive on that site) |

## 1. Travellers Rest (Isolated Games, tavern management, Early Access since July 2020)

### 1.1 The loop, minute by minute (as far as sources allow)
- Start: one table and a few items; a rundown tavern; you restore it [Stack Up, Super Jump]. A story tutorial teaches the
  systems, but players call it long (up to about 2 hours), mandatory, unclear, with hidden menus and no on-screen prompts
  [Vaporlens, Super Jump]. This is the loudest "do not do this" for our first 10 minutes.
- Minute-to-minute rhythm (B): gather or farm inputs, grind or craft them (flour or wine mash can take a full in-game
  day or night; big items need a week of gathering [Super Jump]), brew and cook, open the tavern, serve, earn gold,
  reinvest in ingredients, machines, decor and seats, close, repeat. A fan page (C) says opening hours set the rhythm of
  play; Super Jump says nothing forces set hours and closing is not punished.
- Purchasing: first by mailbox, later town shops for seeds, meat, fish, crops, blueprints, machines and furniture;
  reviewers called the town shops a clear improvement [Stack Up]. Lesson: buying must feel like a place, not a menu.
- Updates that extended the loop: beekeeping and irrigation (efficiency for crop and bee products), a City and Story
  update, timed holiday events with exclusive decor [Stack Up]. A public Trello roadmap kept players engaged.

### 1.2 Guests, needs and reputation
- Guests leave satisfied or unhappy by food and drink VARIETY and QUANTITY, cleanliness, decor and temperature; there are
  "trends" and requests that steer which recipes to make; a rude guest can be hit with a mop [Super Jump].
- Reputation (the score) rises with satisfied guests; decor and more seating raise it and unlock items. A reviewer
  reached 30 seats with weapons, banners, rugs and candles [Super Jump]. Fan source (C): reputation gates which NPC
  types visit (local labourers up to high-status travellers), and expensive decor draws higher-paying, more demanding guests.
- Staff unlock at reputation level 6; before that the player does kitchen, dining and crafting alone and finds it
  overwhelming [Super Jump].
- NPC dialogue exists but there is no relationship-building; NPC interactions "lose appeal quickly"; some NPC designs are
  memorably odd ("truly unhinged") [Stack Up, Playing This Week].

### 1.3 Crafting chains and depth
- Four crafts: farming, brewing, cooking, carpentry; plus mining, foraging, fishing [Steam, Playing This Week].
- Ingredient qualities (for example Fruity, Spicy) give recipes depth; crafting stations let you favourite recipes
  [Super Jump]. Players praise the variety of dishes and beers (39 mentions) [Vaporlens].
- Tech trees, experience and room rentals exist in Early Access [Steam].

### 1.4 What players praise (counts from Vaporlens, B)
1. Tavern management and customisation: building, decorating, expanding (45 mentions).
2. Variety of dishes, drinks and activities (39).
3. A fun, engaging core loop once past the start (29 to 30).
4. Charming, whimsical, colourful art (21); story and soundtrack as potential (23).
5. Relaxing, "cute", satisfying decorating; autonomy ("you can build almost everything from seeds") [Super Jump].
6. Friendly community, receptive developer, steady patches [Stack Up, Super Jump].

### 1.5 What players complain about
1. Slow start and a long, unclear, unskippable tutorial (22 mentions).
2. Repetition, especially resource gathering (21); "nothing else to work for" after unlocks [Playing This Week].
3. Little guidance: items and mechanics not explained, quest guidance poor, players use the wiki (Vaporlens).
4. Long timers for grinding and crafting; scarce nearby resources for large items [Super Jump].
5. Bugs, performance and multiplayer issues; an incomplete story; NPCs that are only friction.

### 1.6 Art, sound, UI (thin; marked)
- Art is "vibrant, colourful, whimsical", "pixel-ish", more cartoony than Stardew [Playing This Week, Vaporlens]. Slight
  front angle with a readable busy room (G). Exact palette, outline, lighting and animation details were NOT found in
  fetched pages. Hats and clothes: character customisation is listed on Steam; no details found.
- Music: the soundtrack is sold separately as DLC [Steam], so players value it; no mood description was found.
- UI: build menus are simple (G); hidden menu access is a complaint [Super Jump].

### 1.7 What this means for us
We already have the loop (taps, pour, kitchen, appeal, away catch-up). Our gaps are exactly TR's strengths: guests who
want something specific, variety that matters, visible cleanliness and crowd life, decor themes, a mid-game reason to
keep going (staff, tiers), and sound. Our edge over TR: no multi-hour tutorial, click-fast dungeon, closed-loop balance.

## 2. Growtopia (Robtop/Ubisoft, 2013, 2D sandbox MMO)

### 2.1 Mechanics
- Punch blocks (reach about 2 blocks) to get seeds and gems; plant seeds, trees grow in real time; harvest gives blocks and
  gems [Well-Played, BlueStacks]. Two different seeds spliced on one tree make a new tree (eligibility limited: some
  combine with many, some with none; failed attempts show "can't be spliced") [Growtopia wiki]. Splicing low seeds up to
  valuable ones is "massing" (C).
- Small, procedurally generated worlds are cleared for materials; named worlds you own and lock [Well-Played, BlueStacks].
- Inventory bar of 4 slots felt small and clunky [Well-Played]. Tools: fist to punch, wrench to interact and manage.

### 2.2 Economy and monetisation (A: postmortem)
- Single soft currency (gems) earned in play. $10 max purchase and $30 daily spending cap protected players. Items are
  vanity with scarcity as value; broad base of small payers.
- Mistakes: a recycling exploit made an infinite gem loop and forced a rollback (about 24 hours lost, no backup);
  farming paid about $3 of value per hour, making monetisation hard; richest player had over 1 million gems and nothing
  to buy (no sink); drop trading caused scams so a secure trade window was needed; a login timing bug allowed duping;
  trusting the client got exploited (Tapjoy); a missing check let players eat blueberries they did not have.
- Current game (B, C): locks became the de facto currency because gems are untradable; VIP packs give daily gems, XP
  buffs and faster growth; one reviewer calls it "massively pay-to-win" and "very grindy"; locks are sold for world protection.

### 2.3 Onboarding
- A tutorial world teaches planting, growing and the inventory (C). The developers started with a stealth beta and let
  the social design spread the game; a teaser video to a few outlets gave the jump [A]. Weakness: starter character looks
  unappealing so costumes are wanted early; starter packs push purchase [Well-Played, BlueStacks].

### 2.4 Social hooks and what keeps people playing
- Visit any world by name; broadcasts that draw a crowd (a giveaway); vending machines that sell while you are offline;
  hangout, parkour and art worlds; events with free items [A, C]. Ownership locks make people invest.
- Retention: a huge collection with rare items as status, splice discovery, personal canvas, tiny instant rewards.
- Pitfalls: scams, begging, bots and auto-clickers, griefing, and the unintended goal: a "duct-taped mouth" mute became a
  status item, needing a rule against seeking it (A).

## 3. Pixel Worlds (Kukouri, 2017; relaunched by Social First, March 2026)

- Mechanics: same family as Growtopia: break blocks for gems and seeds, plant seeds in combinations for new items, build
  worlds (parkour, adventure, farms, social hubs), dungeons and enemies, "Online PvP", farming, crafting, weekly fishing
  tournaments, levels and (relaunch) item level requirements and Netherworld difficulty levels [Steam, Pocket Gamer].
- Social: leaderboards for top worlds, friend system, creators on Twitch and YouTube; community "is key"; begging and
  lava-griefing are downsides [Pocket Gamer].
- Onboarding: tutorial teaches only block breaking; newcomers feel lost [Pocket Gamer].
- Economy: "fully player-driven", trades items, gear and entire worlds; Steam itself warns of scammers. The relaunch RESET
  progression and economy for a "fair starting point", with a stated focus on a stable economy, preventing exploits and
  stronger moderation, plus published community standards before release [press release, Steam]. Reviews: mixed (69%),
  "works, looks nice, not a must-have" (Pocket Gamer 3 of 5).
- Lessons: an economy driven by players eventually breaks and the fix is a reset (very costly); minimal tutorial loses
  players; a clone of a bigger game with no unique hook gets "nothing stands out".

## 4. Habbo Hotel (Sulake, 2000, social virtual world)

- Room building: free guest rooms; furniture ("furni") bought with credits; furniture means online status; public rooms
  (lobbies, pool, terrace) designed by the company with bots; the Navigator menu to find rooms; pets, games, role-play
  groups [Wikipedia, Canadian Encyclopedia].
- Avatar looks: you create and name an animated character (gender, hair, clothes, skin); fashion contests in rooms judged
  by the owner or clique [Canadian Encyclopedia]. The look is identity.
- Social loops: hang out on the terrace, run nightclubs and game rooms, contests, an ignore button; the slogan "Everyone
  can play". Sponsors appeared in the hotel (A-). Rituals matter more than rules: people gather to DO something together.
- Trading: credits (money), later duckets (earned by achievements, 2013) and diamonds; the Exchange turns credits into
  tradable furni; marketplace; scams are a standing problem [Wikipedia, Habbo help via RESEARCH-GAMES].
- Why iconic (B): identity (avatar and room), public places with a hang-out purpose, furniture as visible status, rare
  items, cheap entry, a unique visual language (isometric, bubbles) and shared rituals.
- Why it declined or struggled: safety scandals (June 2012 Channel 4: chat muted globally, investors withdrew; Common
  Sense Media one star), several regional hotels closed for low numbers (China 2007, Russia 2009, Nordic 2015), pay-to-keep-up
  furniture, trading and real-money pressures; Habbo X (NFT) in 2022 and an 18+ Origins client in 2024/2025 with 55% positive
  on Steam; the top complaints are "dead or dying", real-money trading, paywalls and little content [Wikipedia, Steam, Vaporlens].
  Single clear cause not given (the sources say so); the pattern is moderation cost plus monetisation distrust plus content stagnation.

## 5. Cross-game: what makes it fun and vibey

1. A visible, growing place: the tavern fills with guests, decor and light; the world visibly changes because of you.
2. Tiny rewards on every action (a pop, a coin, a sound), with a bigger reward just ahead (a ripe plant, a finished brew).
3. Collections with rarity and discovery (splice, recipes, Book): "what is this? what does it make?"
4. Decorating that MATTERS mechanically (TR: seats and decor raise reputation) and personally (Habbo: furni = status).
5. Identity: your avatar and your room look like you (Habbo, Growtopia costumes).
6. Memorable characters: odd, funny guests beat generic ones (TR NPC designs).
7. A purpose for gathering: hang-outs, contests, showcases (Habbo terrace, Growtopia worlds); for us locally: the tavern night.
8. Sound and music carry mood (TR soundtrack sold as DLC).
9. Gentle structure: no hard timers on the player, open-ended pace (TR does not punish closing).
10. Clear guidance without a wall (the thing TR and Pixel Worlds got wrong in opposite directions).

Pitfalls to avoid (consistent across all four): grindy start and long timers; a long, unclear tutorial OR a tutorial that
teaches nothing; "nothing else to work for" after the unlocks; exploits and dupes in the economy; scams in trading; pay-to-win
and real-money shortcuts; no gem/gold sink for rich players; moderation cost and safety scandals once chat is public; a
player economy that needs a reset; content stagnation.

## 6. Apply to our game

Size: S under a day, M a few days, L a week or more. Fit: OK = no conflict; CHECK = needs a safeguard or small decision;
CONFLICT = clashes with CLAUDE.md, owner must decide. Priority: P1 do soon, P2 after the main order, P3 later, NO reject.
"Existing" = already in ROADMAP (no new item).

### 6.1 Tavern loop and guests
| # | Change (our words) | Inspired by | Size | Fit with CLAUDE.md | Prio |
|---|---|---|---|---|---|
| 1 | GT-1 Guest tastes: each guest has a favourite kind (drink, dish, rank) and leaves a bigger tip or a gem when served it; variety on the menu raises satisfaction. Pure rule in shared/, local only | TR variety and requests; Habbo identity | M | OK (section 9 gem tip stays; keep BALANCE_TARGETS, add a test; guests stay local NPCs; save bump) | P1 |
| 2 | CL-1 Cleanliness: spills and empty mugs show as mess; a broom or tap clears them; a troublemaker guest is shooed with a broom (no violence) | TR cleanliness, mop | M | OK; mess is already tapped for coins. Must not become a chore that blocks play (never required) | P2 |
| 3 | RG-1 Regulars and NC-1 odd guest archetypes (a drunk bard, a grumpy dwarf, a jittery clerk) with portraits and one-liners in npcLines.json | TR "unhinged" designs; Habbo identity | S to M | OK. Extends existing RG-1 | P1 |
| 4 | CR-1 Open/Closed sign and a closing report (guests, gold, tips, mood) shown at close; no forced hours | TR opening hours rhythm | S | OK; optional; no timers; away catch-up already exists | P2 |
| 5 | IQ-1 Ingredient qualities (flavour tags like fruity or spicy) that match guest tastes | TR qualities | M | OK; data in food.json; new balance test; extends GT-1 | P3 |
| 6 | Staff unlock tied to Inn Renown level (waiter, cook) that speeds, never replaces, the click loop | TR level 6 staff | M | OK (existing 7.1 and RN-1) | existing |
| 7 | Hang-out purpose: bard or darts that make guests stay and tip (a "tavern night" feel) | Habbo terrace and games | M | OK (existing PT-1) | existing |

### 6.2 Decorating, rooms and appeal
| # | Change | Inspired by | Size | Fit | Prio |
|---|---|---|---|---|---|
| 8 | DS-1 Decor style sets: matching pieces (banners, weapon rack, rugs, candles) add a small, capped appeal bonus and unlock a named "look" title | TR 30 seats with banners and weapons; Habbo furni status | M | OK: appeal rule already caps each type at 3 and the total at 100; keep the cap; art direction in docs/ART-STYLE.md | P1 |
| 9 | GP-1 Grand projects: long, visible builds (a hearth hall, a cellar, a stage) with stages and a progress bar; gold and crafted goods go in | TR "nothing else to work for"; Growtopia no sink | M to L | OK: gold sink; ledger reason; run the balance test | P2 |
| 10 | Showcase: display case or hat stand shows chosen items (local first) | Growtopia display; Habbo status | S | OK (existing ME showcase) | existing |
| 11 | Seasonal decor that returns every year (never missable) | TR holiday events | M | OK (existing SE-1) | existing |

### 6.3 UI and onboarding (first 10 minutes)
| # | Change | Inspired by | Size | Fit | Prio |
|---|---|---|---|---|---|
| 12 | FP-1 First 10 minutes script: a skippable 5-step nudge (tap a guest, pour, stove, collect coins, build one stool) with one on-screen hint at a time and a "what next" pin; ends by minute 10 | TR unclear 2-hour tutorial; Pixel Worlds minimal tutorial | S to M | OK. Texts at readingMs; no forced path; extends 2.3 and idea 22 | P1 |
| 13 | QL-1 Quality of life: favourites on recipes, "craft again", bag search, item descriptions (IDEA POOL) | TR favourites; Well-Played small inventory bar | S | OK; UI per docs/UI-REFERENCE.md | P2 |
| 14 | Guidance pin: show the next goal on the info panel (Book entry or order) | Growtopia/Habbo collections | S | OK (existing idea 22) | existing |
| 15 | Tooltips on first touch of each new machine (barrel, stove, tap) once, never again | TR "hidden menus" complaint | S | OK; one-time toast pattern already used (9t C intro) | P1 (inside FP-1) |

### 6.4 Art, juice and sound
| # | Change | Inspired by | Size | Fit | Prio |
|---|---|---|---|---|---|
| 16 | AU-1 Crowd soundscape: murmur and clinks that scale with the number of guests, a cheer on a served round, a soft music loop per room, a settings toggle | TR soundtrack value; mood | S to M | OK; audio in client/src/audio, device prefs | P1 |
| 17 | Juice on the loop: pour splash, foam on the mug, coin arc into the register, a "ding" when a guest is delighted, smoke from the stove | genre standard (G) | S | OK; render only, no rules | P1 |
| 18 | Guest look variety: hats and outfits from the clothing data so no two guests look alike (PLAN-CHARACTERS) | TR odd designs; Habbo looks | M | OK (existing track B) | existing |
| 19 | Warm medieval palette and candle light stay as in ART-STYLE; do not add cartoon proportions | TR "whimsical" reads cartoony | n/a | Keep: CLAUDE.md section 12 (Endesga 32, dark warm outline) | rule |

### 6.5 Progression, economy and safety
| # | Change | Inspired by | Size | Fit | Prio |
|---|---|---|---|---|---|
| 20 | RN-1 Inn Renown named ranks unlocking staff, bigger menu, guest types | TR reputation gates | M | OK (existing, now with a clear model: higher renown = new guest types with higher tolerance) | existing |
| 21 | Every new producer or sink ships with a balance test; never a free recycling loop | Growtopia gem loop, Pixel Worlds reset | S per item | OK (our method) | rule |
| 22 | Late-game sinks for gold and gems (grand projects, vanity rooms) so wealth does not pile up | Growtopia 1M-gem player | M | OK; see GP-1 | P2 |
| 23 | Server validates everything incl. counts ("eat items you do not have"), A* check on moves, rate limits | Growtopia postmortem | S | OK (existing AM-1, section 11) | existing |
| 24 | Backup before every migration; staged rollout of a new SAVE_VERSION | Growtopia 24 h rollback | S | OK (we already keep one backup) | rule |
| 25 | Safe visits: mute, report, chat off by default for visitors before public chat | Habbo 2012, Pixel Worlds moderation | M | OK (existing SF-1) | existing |
| 26 | Trading, marketplace, real-money gems, daily rewards, lucky wheel, PvP | Habbo, Growtopia, Pixel Worlds | L | CONFLICT with CLAUDE.md sections 9 and 13 (trading held; the rest rejected). Reason: every source lists scams, dupes, pay-to-win or resets | NO |
| 27 | Opening hours as a mandatory schedule or temperature as a full climate system | TR | M | CHECK: a mandatory schedule conflicts with the no-pressure rule; keep optional CR-1 only. Temperature: skip, cosy light and fire as decor appeal instead | NO (keep small) |

### 6.6 Recommended order (my view)
1. FP-1 first 10 minutes (with 15), then AU-1 and juice (16, 17): cheapest, biggest vibe gain, no save bump.
2. GT-1 guest tastes with RG-1 and NC-1 (3): gives each guest a reason to be served well; save bump.
3. DS-1 decor sets (8): links decorating to appeal and the title system.
4. CL-1, CR-1, QL-1 (2, 4, 13): polish.
5. GP-1 grand projects and late sinks (9, 22) before or with RN-1 staff: the answer to "nothing else to work for".
6. IQ-1 (5) last: depth, only after GT-1 proves the tastes idea.
Everything stays inside the fixed rules except the rows marked NO.

## 7. Honest limits
- Travellers Rest numbers (reputation levels beyond "level 6 for staff"), exact art techniques, animation and music
  were not found; do not copy values. Ask the owner for notes or play a session.
- Habbo decline has no single source-backed cause; the summary above is a pattern, not a fact.
- Pixel Worlds and Growtopia sources include commercial pages (C); use only for flavour.
