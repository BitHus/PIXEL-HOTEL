# RESEARCH: VISUAL AND GAMEPLAY (Habbo, Pixel Worlds, Travellers Rest) (research worker, 17 Nov 2026)

Deepens docs/RESEARCH-DEEP.md (thin on visuals, Habbo, Pixel Worlds). INSPIRATION ONLY: our own names, art, rules (CLAUDE.md 1). Fits docs/GAME-VISION.md (three pillars, one loop). Read RESEARCH-DEEP.md first for the review counts; this file adds what it lacked.

## 0. Sources and honesty
Quality: A = primary, B = reviewer/aggregator, C = fan or commercial guide, G = general knowledge of the worker, NOT verified (a guess; check before building on it).
Fetched 17 Nov 2026 (about 10 pages + 6 searches). Many searches returned thin results; this is stated per topic.

| Source | Q | Gave |
|---|---|---|
| [Engadget: Sulka Haro GDC 2008](https://www.engadget.com/2008/02/19/gdc08-sulka-haro-tells-us-how-to-habbo/) | A- (talk report) | Same height avatars, retro pixels aged well, stacking was a bug kept, decorating core, "social is hardcore", UI should show the core value |
| [What made Habbo successful (substack)](https://jgonzalezferrer.substack.com/p/what-made-habbo-successful-virtual) | B | Trading from day 1, items 1 to 15 credits, non-tradable earned Pixels for retention, functional furni, a themed campaign every month, safety tools (word filter, report, panic button) |
| [Habbo Origins reception (Vaporlens, Steam, PC Gamer search)](https://vaporlens.app/app/3809900/habbo_hotel_origins) | B (machine summary) | Praise: nostalgia, decorating, fishing/gardening. Complaints: trading/gambling scams, thin content, crashes |
| [Treyex: Pixel Worlds beginner guide](https://www.treyexgaming.com/pixel-worlds-beginner-guide/) | C | Tutorial then create world + free lock; Quest Menu with red mark; daily and weekly quests; daily login gems; Mines with depth; emote menu |
| [Pocket Gamer: Pixel Worlds](https://www.pocketgamer.com/pixel-worlds/review/) | B | Pixel art liked, social strongest, minimal tutorial, begging/griefing, nothing new |
| [Steam: Travellers Rest](https://store.steampowered.com/app/1139980/Travellers_Rest/) | A | Decorating raises reputation, hundreds of customers, farm/brew/cook/carpentry, 4-player co-op |
| [Super Jump: Travellers Rest](https://superjumpmagazine.com/travellers-rest-review-cat-webling) | B | Warm cosy pixel look; wall axes, shields, banners, rugs, candles on every table; machines show when ready; hidden menus; weak tutorial; staff at reputation 6; no closing penalty |

Gaps (searches failed or pages had no numbers): exact Habbo tile and sprite pixel sizes (no source gave them; habborator.org page had none), Travellers Rest palette, lighting, camera, sound and animation detail (no fetched page described them), Pixel Worlds avatar customisation and XP numbers. Everything on those is marked (G). Ask the owner (who has played) to correct the (G) lines.

## 1. VISUAL

### 1.1 Room and tile scale, camera
- WHAT THEY DO. Habbo: small fixed isometric rooms in a window, one camera that never moves (G), tile grid, furniture on tiles, avatars all the same height so nobody looks "bigger" than another [Engadget, A-]. Pixel Worlds: side-view world made of 32 px-style blocks (G), camera follows the avatar, zoom button in the UI [Treyex, C]. Travellers Rest: top-down with a slight front angle, the whole tavern readable, camera follows or pans (G).
- WHY IT WORKS. A small readable room is a stage: you see everything you own at once, so decorating gives instant reward. A fixed grid makes placing predictable.
- WHAT WE DO ORIGINALLY. We already have the 32 px build grid, overview zoom, intro zoom and a tavern follow camera. Keep. Add: a "room postcard" (one tap frames the room at overview zoom with UI hidden) used for screenshots and the later visit preview. No new camera rules.

### 1.2 Palette and lighting
- WHAT THEY DO. Travellers Rest: warm, colourful, cartoony pixel look, candles on tables [Super Jump, B]; day/night light is likely (G, not verified). Habbo: flat saturated pixels with a hard dark outline, deliberately simple; Haro says the retro look "looks as old now as eight years ago" [Engadget]. Pixel Worlds: bright block colours (G).
- WHY IT WORKS. A strong limited look ages well and lets thousands of items sit together without clashing; warm light makes a tavern feel safe.
- WHAT WE DO. Endesga 32, warm key light, the approved indoor lighting. Idea: "light as reward": every candle, brazier and lantern placed adds a small visible glow pool and a tiny appeal tick, so decorating with light is visibly better (data only, uses the existing light layer). Cool dark crypt contrast stays.

### 1.3 Avatar proportions and customisation
- WHAT THEY DO. Habbo: tiny same-height avatar, identity from clothes, hair, colours, badges, plus a carried item in the hand; paid club gave more looks [substack, B]. Pixel Worlds: emote menu is the personality tool [Treyex, C]; customisation detail unknown. Travellers Rest: customisation listed, details not found.
- WHY IT WORKS. Same-height bodies mean status comes only from what you wear and own, not from size; wardrobe is the cheapest "showing off".
- WHAT WE DO. Layered cosy three-head avatar (done). Add: TITLE under the name ("Pie Baron", from Book/renown), a visible held item in hand when idle in the tavern (mug, ladle) and 6 to 8 emotes with hotkeys. Originality: our titles come from our own play (served 500 mugs), never bought.

### 1.4 Furniture density and readability
- WHAT THEY DO. Habbo: 10,000+ furni types, many functional (a fridge that opens) so rooms become role-play sets (a hospital) [substack]; stacking floating objects was a bug kept because players loved it [Engadget]; limited themed batches. Travellers Rest: wall weapons, banners, rugs, candles; decorating raises reputation and is the most praised thing (45 mentions) [RESEARCH-DEEP, Vaporlens].
- WHY IT WORKS. Density must stay readable: every item has a clear silhouette, a use or a score. Functional pieces give a reason to place them, "bug" freedoms (stacking) become the signature toy.
- WHAT WE DO. We have stacking (ST1 to ST5), usable furniture, appeal per type max 3. Add: DECOR SETS (3 to 4 pieces of one medieval theme give a small named bonus and a visible "set complete" sparkle), and a "readability check" in the art guide (each new piece must be recognisable at 3 device px per art px in a 1-cell icon). Keep our own set names (Hearth, Hunter's Lodge, Brewer's Corner, Scholar's Nook).

### 1.5 UI layout and panels
- WHAT THEY DO. Pixel Worlds: Main Menu, Social, Quest menu with a RED MARK when a reward waits, gem counter, chat, emotes, zoom [Treyex]. Habbo: chat bar at the bottom, toolbar, catalogue and inventory windows (G). Travellers Rest: hidden menus (I key then tabs), no prompts for menus, the loudest UI complaint [Super Jump].
- WHY IT WORKS. A small mark on a button that says "something is ready" replaces tutorials; on-screen prompts at the object (clean, use) teach faster than menus.
- WHAT WE DO. We have right-edge icon buttons and panelShell. Add: READY DOTS (small pulsing dot on Quest, Book, Brewing/Cooking buttons and on the stove/barrel in the world when output waits); a CONTEXT HINT chip near the avatar when an interactable is in reach ("Hold: pour"); the ONBOARD-1 pointers. Reduce-effects respected.

### 1.6 Animation, feedback, juice
- WHAT THEY DO. Travellers Rest machines visibly signal when ready [Super Jump]; Habbo's hand/purse/console and walking-bubble chat gave cheap life (G). Pixel Worlds: every punch drops something, instant feedback (RESEARCH-GAMES).
- WHY IT WORKS. Every action answers within 100 ms with movement, a number or a sound; readiness shown in the world means no menu hunting.
- WHAT WE DO. JU-1 list: pour splash, coin arc, steam, guest reactions; plus "ready" idle animations (stove puff, barrel bubble) and a coin-counter tick. Sticky number popups with rank colour. All pure fx module, no rules.

### 1.7 Sound mood
- WHAT THEY DO. Travellers Rest sells its soundtrack as DLC, so music is a selling point [Steam via RESEARCH-DEEP]; mood description not found (G: lute/fiddle folk, warm). Habbo: lobby music and ambient crowd (G).
- WHY. Ambient sound is half of "cosy".
- WHAT WE DO. AU-1 with our own composed or CC0 tracks: tavern bed (crowd murmur that scales with guest count, fire crackle, tap pour hiss), garden birds, crypt drips; short stingers for splice reveal, coin, rank up. Music volume separate from sfx in Settings.

## 2. GAMEPLAY

### 2.1 Core loops minute by minute
- WHAT THEY DO. Travellers Rest: gather, craft (a day or night of in-game time for flour or mash), serve, earn, reinvest [Super Jump]; closing is not punished. Pixel Worlds: punch blocks, fish, mine deeper for better ore, quests give XP and gems [Treyex]. Habbo: chat, decorate, collect, trade, play room games (roller stacking, fishing and gardening in Origins) [Vaporlens].
- WHY IT WORKS. Three timescales: seconds (a punch, a pour), minutes (a brew, a dish), hours/days (a rank, a collection). Weak spot in all three: the middle game is repetition [RESEARCH-DEEP].
- WHAT WE DO. Already GATHER to SHOW. Add a "session beat": every 5 to 8 minutes something new surfaces (a regular arrives with a request, a splice finishes, a chest in reach). Concretely: a visible "NEXT SMALL THING" line in the info panel (one of: collect, restock, request, new splice), no timers that punish.

### 2.2 Progression and unlock pacing
- WHAT THEY DO. Travellers Rest: reputation gates staff (level 6), seats, decor; reviewers say staff arrives too late and play alone is overwhelming [Super Jump]. Pixel Worlds: levels unlock tools and gear, quests and daily/weekly tasks drive XP [Treyex]. Habbo: badges and achievements as progress, earned Pixels [substack].
- WHY. Early unlocks must come fast (first 10 minutes), mid unlocks need a visible next rung.
- WHAT WE DO. RN-1 renown ranks with the FIRST rank in about 15 minutes and a rank every 30 to 60 minutes up to 8 (our numbers, tuned in balance.ts). A rank shows its next three unlocks on the ladder (no surprise gates). Staff help (one helper pours/serves the second tap) earlier than TR (rank 3, G on their pace).

### 2.3 Economy and sinks
- WHAT THEY DO. Habbo: trading from day 1 drove time spent and revenue; tradable credits displaced player-invented currencies; marketplace in 2010; non-tradable Pixels for retention [substack]; Origins hurt by gambling and scams [Vaporlens]. Pixel Worlds: economy reset, locks cost real/premium currency, scammers [RESEARCH-DEEP, Treyex].
- WHY. Trade creates time spent but also scams and exploits; non-tradable earned currency is a safe retention lever.
- WHAT WE DO. Stay NO TRADING (CLAUDE.md 9). Take only Habbo's Pixels idea: renown and "Book stamps" are earned, non-tradable, never sold. Sinks we can still add: decor set upgrades, tavern events (a feast night costs ingredients), staff wages in goods, room cosmetics. Every sink goes through balance.test.ts.

### 2.4 Social and showing off
- WHAT THEY DO. Habbo: rooms as identity, role-play, parties, competitions with badge prizes, ambassadors, monthly themed campaigns [substack]. Pixel Worlds: leaderboards for top worlds, friend system, streams; begging and lava griefing [Pocket Gamer]. Haro: "social interaction is hardcore" and a casual wrapper becomes serious with it [Engadget].
- WHY. Players come back to be SEEN. Even single-player games benefit from showable proof.
- WHAT WE DO. Offline first: ROOM STARS and a SHARE CARD (an image of the room plus title, renown rank, Book %, drawn from our own data; saved as PNG, no network). Later (owner go): visit by room name with safety first. Never allow begging mechanics: no direct gift UI at launch.

### 2.5 Retention hooks
- WHAT THEY DO. Pixel Worlds: daily login gems, daily and weekly quests with red marks [Treyex]. Habbo: monthly themed campaigns, limited batches, badges [substack]. Travellers Rest: holiday events with exclusive decor, roadmap on Trello [Stack Up via RESEARCH-DEEP].
- WHY. Reasons to return without a punishment for leaving.
- WHAT WE DO (fits "no daily trick" rule, CLAUDE.md 13): no login streaks, no timers that expire rewards. Instead: seasonal "tavern weeks" (themed decor and recipe set, available all season, keep forever once earned), a "while you were away" report (offline catch-up already exists) that ends with one hook ("a splice is ready"), and a Book with slots that show silhouettes.

### 2.6 Onboarding
- WHAT THEY DO. Travellers Rest: long, unclear, mandatory tutorial, hidden menus (loudest complaint, 22 mentions) [Super Jump, Vaporlens]. Pixel Worlds: short tutorial, then create a world and place a free lock; "does not hold your hand after the tutorial" [Treyex, Pocket Gamer]. Habbo Origins: nostalgic and chaotic, little guidance (G).
- WHY. The first 10 minutes decide; pointers at the object beat text.
- WHAT WE DO. ONBOARD-1 (pulsing pointer on the exact thing, data steps in guide.json). Extra lessons: first reward in under 90 seconds (first coin tap), one free choice early (pick the starter decor), and the guide never blocks play and can be replayed from Settings.

### 2.7 What players love and hate (summary)
- LOVE: decorating that matters (TR 45 mentions), variety of dishes/drinks (39), cosy pixel art, collection (Habbo furni, Growtopia Book), instant feedback, social visits, autonomy.
- HATE: long unclear tutorial, grind and repetition, timers measured in days, hidden menus, scams/gambling/begging, thin content, crashes. Pixel Worlds and Habbo both lost trust through economy and moderation, not through art.

## 3. APPLY TO OUR ROADMAP (ranked; pillar T = tavern, B = block world, I = identity/home; size S under half a day, M about a day, L several days; worker sonnet unless noted)

1. VG-1 READY DOTS + CONTEXT HINT CHIP (T, S-M, ui + coder): a pulsing dot on buttons and in-world stove/barrel/bag when something is ready; a hint chip near the avatar for the usable thing in reach. Biggest fix for TR's hidden-menu complaint; joins ONBOARD-1. No save change.
2. VG-2 ONBOARD-1 first reward in 90 s + replayable guide (T, S, coder): the first coin tap is step 2; guide replay in Settings; first-hour quest card (stack order orders strip > hint > quest seal).
3. VG-3 RN-1 renown ladder with a visible 3-unlock preview and the first rank within 15 minutes (T, M-L, coder; balance tests first). Core of GAME-VISION pillar 1.
4. VG-4 JU-1 juice pass with "ready" idle fx (stove puff, barrel bubbles, coin arc, pour splash, rank-coloured number popups) (T, M, artist + coder).
5. VG-5 DECOR SETS: 4 original medieval sets, named bonus and "set complete" sparkle; data in a new JSON, appeal rule in shared/ with tests (I, M, coder + artist).
6. VG-6 SHARE CARD + ROOM POSTCARD: one tap hides the UI, frames the room, saves a PNG with title, rank, stars, Book % (I, M, ui + coder; no network).
7. VG-7 AU-1 sound bed: crowd murmur scaling with guests, fire, pour hiss, garden and crypt ambience, stingers; separate music/sfx sliders (T/I, M, coder with CC0/own audio; owner approves audio source).
8. VG-8 TITLES AND EMOTES: titles earned from play stats (served, brewed, spliced, Book %), 6 to 8 emotes with hotkeys, held mug/ladle idle (I, M, coder + animator).
9. VG-9 NEXT SMALL THING line and session beat: a rotating hint of collect / restock / request / new splice, plus "while you were away" ends with one hook (T, S-M, coder).
10. VG-10 LIGHT AS DECOR: lamps, candles and braziers add visible glow pools and a small appeal tick (data on top of the existing light layer and appeal rule) (I, S-M, coder + artist).

Held (not now): trading and marketplace (scams, CLAUDE.md 9), login streaks, begging/gift UI, paid anything. Online visits only after the owner's go.

## 4. Open questions for the owner
- Habbo and Travellers Rest exact pixel scales and palettes were not found; if you have played TR, a few screenshots of your own (kept out of the repo) with notes would replace the (G) lines.
- Is a share-card PNG OK as the first "showing off" step before online?
