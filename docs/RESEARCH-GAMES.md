# RESEARCH: what four related games teach us (lead, 16 Nov)

Purpose: find ideas worth adapting. INSPIRATION ONLY: CLAUDE.md says original names, art and assets, never copy
another game. Nothing here is a spec to clone; each idea is restated in our own terms and checked against the fixed
decisions in CLAUDE.md. No screenshots or assets of these games go in the repo.

Method and honesty note: web search (16 Nov 2026) plus general knowledge of the games. Search snippets were thin for
Pixel Worlds and several pages were aggregators or fan blogs; claims from those are marked "indicative". Verify before
building anything that depends on a number.

## 1. Short summary per game

### Growtopia (Ubisoft/Robtop, 2D sandbox MMO, worlds of blocks)
- Core loop: punch blocks, collect seeds and gems, plant and harvest trees, splice seeds into new items, sell or
  trade, buy a "world" to build in. Every item is a block or a wearable.
- Fun and sticky: very low skill floor, instant feedback (every punch drops something), a huge catalogue to
  complete, rare items as status, splicing as discovery, worlds as a personal canvas, events that return.
- Social: visit any world by typing its name, public chat, trading, shops in worlds, guilds, mini-games built by players.
- Progression and economy: no hard level wall; progress = collection and wealth. Gems are the soft currency; a
  player-to-player economy with "locks" as the big currency. Gems can be bought with real money.
- Building: place per cell, lock a world to own it, doors and signs, vending machines, display blocks.
- Art/UI: chunky simple pixel blocks, bright colours, simple chat-first UI, big touch buttons on phone.
- Complaints (sources are uneven, indicative): grind and a hard economy for newcomers; bots and macros/auto-clickers
  distorting the economy; scams; some items locked behind the paid gem currency (pay-to-win feel); lag and server
  problems. The original developers' 2013 postmortem noted an economy bug could wreck prices in hours.
- Sources: [Game Developer postmortem](https://www.gamedeveloper.com/business/two-guys-made-an-mmo-the-growtopia-postmortem),
  [Pocket Gamer review](https://www.pocketgamer.com/growtopia/review),
  [Well-Played review](https://www.well-played.com.au/growtopia-review/),
  [Game Brain summary](https://gamebrain.co/game/growtopia).

### Travellers Rest (Isolated Games, tavern management sim, early access)
- Core loop: brew drinks, cook, serve guests, decorate and expand the tavern, farm a small plot, go on quests.
  Money buys supplies and decor; REPUTATION unlocks features (room rentals, staff, quests).
- Fun and sticky: cosy atmosphere, steady small upgrades, a visibly growing busy tavern, decorating that matters
  (seating and decor raise reputation), many small chores that feel productive.
- Social: single player (guests are the "social" part).
- Progression: reputation tiers gate content; recipes and brewing depth; staff to automate chores later.
- Art/UI: warm pixel art with a slight front angle, readable busy rooms, simple build menus.
- Complaints: repetition and slow progression; bugs and performance; some find the loop very simple (yet "addicting").
- Sources: [Bonus Stage preview](https://www.bonusstage.co.uk/archives/172354),
  [Super Jump review](https://superjumpmagazine.com/travellers-rest-review-cat-webling),
  [Steam review summary](https://vaporlens.app/app/1139980/travellers_rest).
- Note: our tavern (taps, kitchen, appeal) already covers the basic loop; the gap is the long middle: reputation
  gating, regulars, staff and variety.

### Habbo Hotel (Sulake, social virtual world, rooms in a hotel)
- Core loop: chat, walk around rooms, decorate your own room with furniture, trade rare furniture, play room games.
  It is a social space first, a game second.
- Fun and sticky: identity (your avatar, your room), a place to hang out, rare furniture as status, badges, events.
- Social: public rooms and player rooms, chat bubbles, trading and a marketplace, groups, friend lists, moderators.
- Economy: credits bought with real money; furniture as the value store; trading centrally important, later a
  marketplace. Scams were a recurring problem (Habbo's own help centre has a scam page).
- Safety lessons: chat filters are always bypassed by players; the game once disabled chat for all users after
  safety allegations (2012, reported); heavy moderation staff needed; ignore/block per player.
- Art/UI: isometric (we are NOT isometric), small room windows, bubble chat, simple catalogue and inventory.
- Complaints: scams and trading abuse, safety worries about minors, pay-to-keep-up furniture costs; the "Origins"
  re-release is criticised for little content (aggregator, indicative).
- Sources: [Habbo help: scamming](https://help.habbo.com/hc/en-us/articles/360011619259),
  [Wikipedia: Habbo](https://www.wikipedia.org/wiki/Habbo),
  [Canadian Encyclopedia](https://thecanadianencyclopedia.ca/en/article/cyber-hotel-for-teens-is-a-hit),
  [Origins review summary](https://vaporlens.app/app/3809900/habbo_hotel_origins).

### Pixel Worlds (Kukouri, 2D sandbox MMO, similar family to Growtopia)
- Core loop: mine and farm blocks, build in a world, enter dungeons and PvP worlds, trade, level up.
- Fun and sticky: sandbox freedom, dungeons and quests on top of the building, levels and a world-owner status.
- Social: public worlds, chat, player-driven trade; PvP worlds.
- Economy: player-driven prices; the current Steam relaunch reset progression and economy "for a stable foundation"
  (implies earlier economy problems).
- Art/UI: bright pixel art, phone-first controls.
- Complaints (thin sources): a good world can cost money; reviewers compare it unfavourably to Growtopia or Terraria
  ("works, looks nice, not a must-have"); mixed ratings.
- Sources: [Pocket Gamer review](https://www.pocketgamer.com/pixel-worlds/review/),
  [Thumb Culture review](https://www.thumbculture.co.uk/?p=2351),
  [Steam page](https://store.steampowered.com/app/636040/Pixel_Worlds/).

### What the four have in common (the pattern)
1. Every action gives a small visible reward at once (we have this: popups, gems, hold-to-repeat).
2. A long collection goal with rarity (we have the Book, ranks, splicing).
3. A personal space that shows achievement (hotel, tavern).
4. Social reach (visit by name, chat), which is where the risk is (scams, safety, bots).
5. Economies break through duplication bugs, bots and real-money shortcuts. Our closed-loop balance tests are a
   strength; keep them.

## 2. Ideas worth adapting

Fit key: OK = no conflict; CHECK = needs a small decision or a safeguard; CONFLICT = clashes with CLAUDE.md, do not
build without the owner's decision. Size: S under a day, M a few days, L a week or more.

| # | Idea (our words) | Inspiration | Fit with CLAUDE.md | Size | Recommendation |
|---|---|---|---|---|---|
| 1 | Inn Renown: named ranks that unlock features (guest rooms, staff, new menu tiers) instead of only appeal | Travellers Rest reputation | OK. Builds on tavernAppeal and MC "One Inn score"; no new currency. Must keep S3 gold shares inside BALANCE_TARGETS | M | Yes, after MC. Gives the long middle a spine |
| 2 | Regulars: a few named repeat guests with a favourite drink or dish, who tip more when served it, shown in the Book | Travellers Rest guests; Habbo identity | OK. Guests stay local NPCs; save field needed (bump); reuses npcLines | M | Yes. Cheap stickiness, no online needed |
| 3 | Order board: optional non-timed commissions (serve 3 aged ales, grow 5 pumpkins) with a gold or item reward | Travellers Rest quests; Pixel Worlds quests | CHECK: must have no daily reset, no streak, no expiry pressure (section 13). Overlaps 9i questline | M | Fold into 9i as "board orders"; no timers |
| 4 | Slow makers: passive producers (hen coop, beehive, cheese press) that fill in real time, tap to collect | Growtopia farmables and trees | OK. Same pattern as casks and stove (TavernState time passed in). Overlaps 5.3 | M | Yes, as the first slice of 5.3 |
| 5 | Recipe journal: discovering recipes by trying inputs, a Book tab with silhouettes | Travellers Rest recipes; Growtopia splice discovery | OK. Data-driven, pure rule; no randomness | S to M | Yes, as part of 9i or a Book step |
| 6 | Titles and badges earned by play, shown on the name plate and profile | Habbo badges; Growtopia titles | OK. Cosmetic only; derived from event counters (3.2) | S | Yes, bring forward inside 3.2 |
| 7 | Cosmetic-only wearable perks (a hat that leaves sparkles, a lantern trail) | Growtopia wearables; Pixel Worlds | CHECK: cosmetic only, never a stat edge, never for money (no pay-to-win) | S | Later; fits after hats (C6) and U1 avatar |
| 8 | Tavern pastimes: darts board, dice table, a bard stool; guests use them and stay longer or tip | Habbo room games; Travellers Rest events | OK. Decor with `use`; guest behaviour is a pure rule | M | Maybe; after 9g-2 usable furniture |
| 9 | Item showcase pieces: a display case or hat stand that shows chosen items to visitors | Growtopia display blocks; Habbo furni status | OK. ME suite showcase already planned | S | Already planned (ME); no change |
| 10 | Visit a room by name, read-only first | Growtopia world names | CHECK: online only (6.2). Chat OFF by default for visitors, mute and report first | L | Keep in phase 6; ship moderation tools BEFORE public chat (Habbo lesson) |
| 11 | Room ratings, a visitor count and a guestbook | Habbo room ratings | OK for ratings and guestbook (9g-4 has the guestbook); ratings need online | M | Keep in 6.4; guestbook now |
| 12 | Player trading and a marketplace | Habbo, Growtopia, Pixel Worlds | CONFLICT: CLAUDE.md sections 9 and 13: no trading in v1. Scams and dupes are the top complaint of all three games | L | Do not build. After 6.6 only, with a two-sided safe window, price floors from SELL_RATES, gems untradable |
| 13 | Real-money gems or paid cosmetics | Growtopia, Habbo, Pixel Worlds | CONFLICT: section 13 forbids real-money purchases; gems earned in play only | n/a | Reject. It is also the biggest complaint (pay-to-win) |
| 14 | Daily login rewards, streaks, limited-time offers, lucky wheel | Pixel Worlds, mobile standard | CONFLICT: section 13 fairness rules ban timers, limited offers and daily tricks that push buying | n/a | Reject. Returning events can exist, but never pay-gated or time-pressured |
| 15 | Player vs player fights | Pixel Worlds PvP worlds | CHECK: not in the brief; server authority and safety cost is large | L | Reject for v1; revisit only after phase 6 if wanted |
| 16 | Seasonal events that return every year, earned by play only | Growtopia events | OK with care: no FOMO (items stay obtainable next year). Matches 7.3 | M | Yes, later in 7.3; design "returns yearly" rule |
| 17 | Anti-macro guardrails: server rate limits on hits, harvests and pours, sanity checks on speed | Growtopia bots and auto-clickers | OK. Server is authoritative anyway (section 11); our hold-to-repeat already gives the fast clicker a legit path | S | Yes inside step 10; add a test with a simulated clicker |
| 18 | Economy health checks: a "no loop" test for every new producer and sink | Growtopia 2013 postmortem; Pixel Worlds reset | OK. Already our method (balance.ts) | S per item | Keep as a rule: every new producer ships with a balance test |
| 19 | Staff to hire (barkeep, waiter) that automate chores | Travellers Rest staff | OK. Already 7.1; must not make play passive | M | Keep in 7.1; staff speed up, never replace, the click loop |
| 20 | Guest rooms to rent in the Inn, tied to Renown | Travellers Rest | OK. Already 7.1; natural fit for Inn doors (MB) | M to L | Keep in 7.1 |
| 21 | Tutorial through play: a small first-hour path that shows each part once | Growtopia tutorial world | OK. Matches 2.3 first-hour pass | S to M | Already planned (2.3) |
| 22 | Tracked goal pin: pick one Book entry or order to show on the info panel | Growtopia/Habbo collections | OK. UI only | S | Yes, cheap; with 9i-2 quest UI |
| 23 | Chat safety package: word filter, report, per-player mute, 120 characters, 10 msg/s | Habbo | OK. Already section 13 | M | Mandatory before any public room; accept that filters are bypassed, so also rate limit and room-private default |

## 3. Proposed new roadmap items (original names)

Ordered. These are IDEAS, not commitments; the owner confirms. Each stays inside the fixed decisions.
1. RN-1 "Inn Renown" ranks (idea 1): a named rank track from the One Inn score, unlocking guest rooms, a bigger menu, staff. [coder; artist: rank badge]
2. RG-1 "Regulars" (idea 2): 6 to 8 named repeat guests with tastes, a Book tab, a small tip bonus. Save bump. [coder; artist: guest looks]
3. BD-1 "Board orders" (idea 3): optional commissions without timers, inside 9i. [coder; artist: board prop and UI]
4. SM-1 "Slow makers" (idea 4): hen coop, beehive, cheese press as casks-like producers; a balance test each. [coder; artist: three props]
5. JR-1 "Recipe journal" (idea 5): discover and track recipes in the Book. [coder; artist: silhouettes]
6. TB-1 "Titles and badges" (idea 6, in 3.2): cosmetic, from counters. [coder; artist: badge icons]
7. PT-1 "Pastimes" (idea 8): darts, dice, bard stool as usable decor. [coder; artist: three pieces]
8. SE-1 "Seasons that return" (idea 16, in 7.3). [coder; artist: seasonal decor]
9. AM-1 "Anti-macro guardrails" (idea 17): rate limits in the server, with step 10. [coder]
10. SF-1 "Safe visits first" (ideas 10, 11, 23): moderation tools and chat-off visits before public chat, in phase 6. [coder; artist: report and mute UI]
Held for the owner: marketplace and trading (12), PvP (15). Rejected under CLAUDE.md: real-money gems (13), daily tricks (14).

## 4. Lessons to keep in mind
- Do not copy: no block-world "world lock" currency, no isometric rooms, no Habbo-style credit selling.
- Our edge over all four: the tavern service loop (taps, pour, kitchen), closed-loop balance tests, and a single
  Inn that joins them. Protect it; add depth around it rather than clones of their systems.
- The most common complaint across the four is a grindy, scam-prone, pay-shortcut economy. Our rules already
  avoid that; every new idea above is checked against it.
