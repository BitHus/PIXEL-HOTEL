# PLAN-FUN: what is actually fun to DO (game designer, 17 Nov; owner: "someone needs to look at FUN and actual GAMEPLAY: events, fun things to do in-game")

Status: DESIGN ONLY, no code, no ranked number changed. Every number marked PROPOSAL goes through balance.ts and `npm run simulate` and the owner first. Fits docs/GAME-VISION.md (one loop, three pillars). Builds on PLAN-TAVERN-FLOW.md (bar guests, orders strip), OA-15 (daily quests, event quests, achievements), PLAN-ONLINE.md (later). Honesty note: this audit is from the docs, data and rules, not from a fresh hands-on session; section 3 says what the tester must measure to confirm or correct it. Inspiration only, nothing copied (CLAUDE.md 1).

## 0. What the research says (short)
- Cozy games are sticky through: tasks with clear completion and fair reward, no permanent punishment, and "always one more small goal" ([cozy genre piece](https://gamerempire.com/blog/cozy-games-rise), [Moonlighter review](https://www.gamesradar.com/moonlighter-review/)). Stardew players from 2016 still play: pace in the player's hands, varied activities.
- Travellers Rest is criticised as thin beyond open-earn-reinvest ([playing this week](https://playingthisweek.substack.com/p/playing-this-week-travellers-rest)); our own RESEARCH-VISUAL-GAMEPLAY.md says the same (nothing to do after unlocks). The cure is VARIETY of moments, not more numbers.
- Festivals work when they are a BREAK from routine with a small game and a show-off prize (the Stardew Fair: mini-games, tokens, a display), and fail when they are "one trick ponies" repeated unchanged ([Fair guide](https://www.exitlag.com/blog/stardew-valley-fair-guide/), Steam threads). So: few events, each with one NEW verb.
- Animal Crossing style events are low-pressure: not time-limited tasks, no clock ([accessibility report](https://www.familygamingdatabase.com/en-us/accessibility/Animal+Crossing)). Matches CLAUDE.md 13. A caveat from the same study: you need the right tool in hand to enjoy a random event, so events must TELL the player what to bring, early and kindly.
- Potion Craft: discovery through experiment ("fog of discovery", same result by different recipes, [review](https://www.thegeeklygrind.com/all-posts/potion-craft-review)) is the hook, and it fades when discovery runs out. Our splicing is this; it needs reveal juice and a visible "what is left" in the Book.
- Dave the Diver / Moonlighter: two modes feed each other (dive by day, serve by night). We have it (dungeon feeds tavern); what we lack is the dungeon being a varied, surprising place and the tavern having a "rush" rhythm.

## 1. Honest audit per loop
Scale: FUN = what the hands enjoy now; CHORE = what is a task; MISSING; BORED = where a player drifts away.

### 1.1 Tavern (heart)
- FUN: hold-pour with the green perfect window, coins tapped, the tray, guests pulsing when your mug fits. A real skill moment (about 1.4 s) with a tip reward.
- CHORE: every guest is the same shape (sit, order, eat, leave); the orders strip is "do the next chip". Menu panel (price steppers) is spreadsheet play. Collecting every mug and coin by tap with nothing varying.
- MISSING: guests as PEOPLE (names, tastes, stories), a rush rhythm (calm then crowd), a reason to look at the room (no reaction to decor except a number), a closing moment (a day has no end, no summary).
- BORED: first hour at minute 20 to 40: 3 seats, 7 root ale per 8-minute brew means long waits; the loop is "wait for the barrel". Day 1: the same 4 guest lines. Week 1: no new guest ever appears.

### 1.2 Brewing and cooking (barrel, taps, stove)
- FUN: loading taps (the room fills with drink), the stove cue, trying a new recipe.
- CHORE: timers (8 min brew, 20 s to 5 min dish) are WAITING, not play. Collect, load, repeat. Prep tables are a layout puzzle only for builders.
- MISSING: any hands-on input during brewing or cooking (a timing, a taste choice), a "signature drink" you name and that guests mention, accidents in a good sense (a lucky batch).
- BORED: while a brew runs and the player has nothing else near (waiting is the single biggest idle gap in the first hour).

### 1.3 Farm
- FUN: punch to harvest, sprouts growing in real time, plant-on-block, the splice moment.
- CHORE: re-planting the same 6x2 soil patch of turnips; real-time grow (2 min common) means leave and return.
- MISSING: a reason to plan a garden (no shapes, no orders for "a prize pumpkin"), pests or weather as small cosy surprises, a harvest showpiece.
- BORED: after the first splice rounds the player plants what is needed, not what is curious.

### 1.4 Dungeon (round 1: slimes, one floor)
- FUN: click-fast combat, chests, stairs, run bag risk (lose bag on death) = real tension.
- CHORE: floors are rooms and corridors with chests and slimes; DG1 added layout variety but content per room is the same loop (walk, hit, loot).
- MISSING: bosses (the Bone King is round 2 only), trap rooms, shrines (a choice), a mini-boss per theme, a reason to go deeper than "more loot", a run story ("I almost died at the vault").
- BORED: run 3 to 5 (slimes only, one floor). Round 2 is implemented but off.

### 1.5 Mine
- FUN: clicking rocks (hold repeats), the 4-minute lantern clock is a good soft timer, ore sparkle.
- CHORE: ore -> bar -> gear is a straight line; gear is a number upgrade (damage, armour).
- MISSING: veins to read (rich rock, gem rock, a cave-in surprise), a "deeper" feel, a rare find rumour.
- BORED: once the steel pickaxe and a sword are made; opens only at level 3.

### 1.6 Lakeside (fishing, wood)
- FUN: the "!" bite plus the REEL (hold to push the box) is the best small mini-game we have; 18 fish give a collection.
- CHORE: tree chopping (5 hits) is padding.
- MISSING: a reason to fish a particular fish (a guest asks for one, a contest), a big-fish moment (a record cm, shown on the Book), a calm "sit on the pier" mode with the cat.
- BORED: after the common fish are caught; no goal beyond Book %.

### 1.7 Building (blocks, furniture, styles, stars)
- FUN: stacking, painting, wall items free along the wall, the lighting look, room stars as a score. This is the longest-lived loop (players praise decorating).
- CHORE: gold for furniture comes only from the tavern; building has no external challenge.
- MISSING: a brief ("a cosy corner for a bard"), set bonuses (DS-1 planned), visitors who comment on your room, a screenshot or postcard moment, themed unlock drops.
- BORED: when the catalog is bought and nothing new unlocks.

### 1.8 Splicing and the Book
- FUN: the highest ceiling: any two seeds, a NEW seed, a Book tick, a gem find. Discovery is the Growtopia-liked hook (owner note).
- CHORE: waiting for the grow time of the splice (longer); no preview or hints makes it blind trial; results sometimes sell for little.
- MISSING: the reveal moment (animation, sound, name card), hints ("a recipe is rumoured with a berry"), a splice goal list ("find a seed that grows a lamp"), sharing a find (postcard).
- BORED: when discovery stalls: no hints = frustration, too many = no joy. The Book needs "N of M left" per tab and rare hint scraps from guests and events.

### 1.9 Time-to-boredom summary (to be CONFIRMED by playtests)
- First hour: minute 15 to 45 is a waiting gap (brew, grow, cook) with no second thing to do near the bar. Fix: mini-moments near the bar (section 2: darts, dice, bard) and a rumours board.
- First day: no new guest or event after the first 3 hours; the same 4 NPC lines.
- First week: no reason to log in "to see what happens"; no unlocking event; Book stalls. Fix: events, regulars, hints, boss.
- Everything must stay "never missable, no penalty" (CLAUDE.md 13).

## 2. TOP 15 FUN ADDITIONS (ranked by fun per effort)
Size S (about a day for one worker), M (2 to 4 days), L (a week+). Workers: C coder, U ui, A artist, N animator. Every item: "13 check" = CLAUDE.md 13 (no timers, limited offers or daily tricks that push buying; the only random paid thing is a pack; gems only earned). "Reuses" lists existing systems. Balance risk: low, med, high (touches gold or gem income).

1. NAMED REGULARS (RG-1 first slice). Player does: 6 named guests return, each with a taste (drink or dish), a one-line story that grows each visit (3 lines), and a small gift when you serve the favourite perfectly (a recipe hint, a seed, a decor piece). Fun: people to know; "oh, Marta is back, pour her the dark ale". Reuses: guests.ts, guestLook.ts, npcLines.json, orders strip (guest mark), Book tab, perfect pour. Size M. Workers C, A (6 looks), U (Book tab). Balance risk low (a tip bonus of PROPOSAL 5% already in plan RG-1; gifts are items from existing tables). 13 check: pass, no timer, a regular never leaves angry for good, no purchase.
2. RUMOURS BOARD. Player does: a board in the tavern fills with 2 to 3 short rumours (data text): "a copper vein glows past the third room", "a bard wants a smoked fish", "someone saw a glowing seed". Each is a tiny goal that hints at a real system (a rare chest, a fish, a splice pair) and a reward when done. Fun: a reason to go somewhere specific; curiosity; also the home of daily quests (OA-15) so one place. Reuses: quests.ts counters, daily-quest rule (seeded by date passed in), splice.json hints, fish.json, loot.json. Size M. Workers C, U (board panel), A (board sprite). Balance risk low to med (rewards inside balance.ts). 13 check: pass if never a countdown, never a streak; all rumours stay open until done.
3. DISCOVERY REVEAL + BOOK HINTS. Player does: a splice or new dish or fish opens a short reveal (the item rises, sparkle, name card, a line from a regular) and the Book tab shows "7 of 24 left" with a hint scrap after N tries. Fun: the moment players post about; keeps experiment going. Reuses: splice.json/spliceRules.json, book.ts, fx module, audio. Size S to M. Workers C, N/A (sparkle), U. Balance risk low (no numbers). 13 check: pass.
4. FESTIVAL DAYS (event periods set by DATA, cozy, never missable). Player does: a festival changes the room for a few real days: guest types (harvest folk who love stew), a decor twist (a banner, lanterns appear free on the walls), one event quest list (5 goals) and one new verb. Examples: Harvest Feast (biggest crop on the board; cook-off, see 5), Lantern Night (hang lanterns, guests tip in light-themed pieces), Brew Fair (compare mugs, a cask contest). Fun: the world changes, a reason to return that is not pressure; later yearly returns (SE-1). Reuses: OA-15 event quests, npcRoles.json (new guest roles), decor items, light layer. Size L for the first, S for each later (data only). Workers C, A (banners, lantern), U (event card). Balance risk med (an event reward table; no new income source above existing tables). 13 check: no limited buy offers, rewards are cosmetic or items also earnable later, no streak; an event that was missed returns next cycle (SE-1), nothing exclusive for money.
5. BARD NIGHT (stage piece plus a rhythm toy). Player does: place a small stage (decor) and a bard guest plays; while the bard plays guests stay longer and tip +PROPOSAL 10%; the player may tap notes in time (a 4-beat rhythm bar like the pour bar) for a "great show" bonus. Fun: a second hands-on skill moment in the tavern, music is cosy and gives the tavern atmosphere. Reuses: pourBar timing code (shared/src/pour.ts pattern), tunes.json, usable furniture (9g-2), npcRoles.json. Size M. Workers C, N (bard play loop), A (stage, bard), U (rhythm bar). Balance risk med (tip bonus; test with balance TF1 guest share under the 55% cap). 13 check: pass; the show is an optional bonus, never required.
6. PASTIMES: DARTS AND DICE (while you wait). Player does: a dart board on the wall and a dice table as usable furniture: tap to throw (timing ring), or play a 3-roll dice game with a seated guest for a small gold or item prize that is a pure coin-free novelty (PROPOSAL: tiny, capped per hour; no real gambling, no stakes risk: you cannot lose gold). Fun: fills the brewing wait gap in section 1.2; guests also use them (they play, stay longer). Reuses: PT-1 pastimes plan, usable furniture, wall items free along the band (OA-10), npcNav. Size M. Workers C, A (2 pieces), N (throw), U. Balance risk low (cap). 13 check: no loss mechanic, no gambling look (dice is a roll game with no stake), no buy hook.
7. FISHING TOURNAMENT (friendly, local). Player does: a tournament day at the lake: 3 NPC anglers also fish (a scoreboard of cm), you reel your best three, the biggest fish of the day wins a bronze/silver/gold ribbon item and a Book "record" line. Fun: the reel is already good; a goal and a rival; a big-fish moment. Reuses: fishing.ts, fish.json (minCm/maxCm exist), Book, festival framework (item 4). Size M. Workers C, U (scoreboard), A (ribbon), N (angler idle). Balance risk low. 13 check: pass; scheduled as an event period, never a loss.
8. COOKING TIMING PLATE (optional skill touch). Player does: when a batch is ready, an optional "stir" tap in a green window gives a "golden dish" (better ranks of the same dish: +1 dish or a small tip, never a loss, never burnt, K1 rule stays). Fun: hands on the stove; fills waiting with a 2 s action at the end. Reuses: pour.ts perfect window pattern, K1 cooks, food.json. Size S to M. Workers C, N (stir), U. Balance risk med (+1 dish max, test with SG2 closed loops). 13 check: pass; no burnt food.
9. TRAVELLING TRADER (rare seeds for GOLD only). Player does: a wandering trader sets a cart outside for a few days with 3 to 4 rare seeds and one decor piece at fixed, fair gold prices; the Book shows what the cart carries before you pay; every price asks first (confirmBuy). Fun: a surprise visit, a seed you cannot get otherwise, a reason to save gold. Reuses: S2 trader rule, crops.json seed ranks, catalog, innDoors (the door she arrives at), confirmBuy. Size M. Workers C, A (cart), U. Balance risk HIGH (rare seeds change splice and block economies; seed ratio tests and "gold per gem" floor must still pass; owner decision on seed ranks). 13 check: this is a gold shop on a rotating stock; allowed ONLY as: visible stock, no countdown text, stock never "limited-time exclusive" (everything also drops somewhere), no gems for money. Treat as the one item needing owner review.
10. DUNGEON SHRINES AND TRAP ROOMS. Player does: a shrine room offers a choice (heal 30% OR +1 attack for this run OR a lucky chest next floor); a trap room has visible floor spikes on a pattern you read (hit once = small damage); a "vault" with a switch puzzle (hit 3 torches in order shown on a wall). Fun: decisions and reading, not just clicking; stories ("I took the lucky shrine and found the legendary"). Reuses: DG1 layout (set pieces in dungeonThemes.json, vault nook), step.ts tick, loot.json rankMultiplier. Size M to L. Workers C, A (shrine, spikes), N (trap), U (choice card). Balance risk med (run bonuses; simulate-dungeon). 13 check: pass; no purchase.
11. BOSS FIGHTS WITH A PATTERN (Bone King first, slime king in round 1). Player does: a boss room at the last floor with a telegraphed attack (a wind-up ring), 3 phases, a guaranteed ranked drop and a Book "defeated" entry, then a trophy furniture piece for your room. Fun: the peak of the dungeon; trophy for showing off. Reuses: step.ts (wind-up exists), ENEMIES config, DUNGEON_ROUND 2 content, Book, furniture. Size L. Workers C, N (boss attack frames), A (boss, trophy). Balance risk med. 13 check: pass.
12. TAVERN DAY REPORT (closing moment). Player does: when you tap a "Close for today" lantern (or after N guests) a small card shows guests served, tips, perfect pours, best order, a new favourite, plus one "tomorrow tip" and the day's rumour ticks. Fun: a satisfying end of a session and a reason to say "one more day". Reuses: tavern stats counters, Ledger, quests counters (CR-1 closing report plan). Size S. Workers C, U. Balance risk none (display only). 13 check: pass; no daily-login reward, no streak.
13. TAVERN CUSTOMISATION: SIGN AND MENU BOARD. Player does: name the tavern sign (a short text, filtered, already derived name), choose a sign shape and a menu board that shows your top three dishes with chalk-style art; guests read it ("I came for the stew"). Fun: identity and show-off; the menu board gives your recipes a face. Reuses: innName, menu data, wall items (free band), npcLines. Size S to M. Workers C, U (name field with word filter), A (sign shapes, chalk). Balance risk low (appeal +1 like decor). 13 check: pass; text uses the existing word filter.
14. POSTCARD AND ROOM SHOWCASE. Player does: one tap frames the room at overview, hides the UI, adds a plain frame and a stamp "My tavern, day N", saves a PNG; stars and the tavern score show on it. Fun: showing off without online yet; groundwork for visits (PLAN-ONLINE). Reuses: room stars, overview zoom, canvas capture, cameraSetup. Size S. Workers C, U, A (frame). Balance risk none. 13 check: pass; no personal data on the image beyond the display name chosen.
15. SECRETS AND EASTER EGGS. Player does: hidden things: a loose brick in a hotel wall that opens a seed, a cat that follows you when you carry a fish, a fish that appears only during rain at dusk, a dungeon wall that sounds hollow, a guest who says a line only after 100 pours. A "Whispers" Book page lists found secrets as "???". Fun: delight and word of mouth; pairs with Growtopia-like discovery. Reuses: Book "???", fx module, light layer, npcLines, cat rules (9g-2). Size S per secret (data plus a hook). Workers C, A (a few sprites). Balance risk low. 13 check: pass.

### Ranking rationale (fun per effort)
1 regulars (people beat systems), 2 rumours board (one place for dailies, events and hints), 3 reveal (S, big joy), 4 festivals (the owner's explicit ask, L once then cheap), 5 bard (a second skill moment), then 6 to 8 (waiting-gap fillers), 9 trader (high balance risk, so mid-list), 10 to 11 (dungeon variety, L), 12 to 15 (polish and show-off, mostly S). If effort must stay tiny: 3, 12, 14, 15, 13, then 1.

### What stays out for now
Online visiting and trading (PLAN-ONLINE; trading held), real gambling (dice only as a no-stake toy), daily login rewards, streaks, countdown timers, limited-time exclusive items, seasons that remove items (SE-1 returns yearly, never missable).

## 3. NEXT 3 PLAYTESTS (tester, no production code)
Each run: a NEW game, a stopwatch, a short note per minute, screenshots at the marked moments. Record "smile" = the first moment the tester says or writes "nice", "ha" or a similar reaction (any such line is evidence; if there is none after 5 minutes that is a finding).
1. FIRST 20 MINUTES, PHONE AND DESKTOP. Measure: seconds to the first smile; to the first coin tapped; to the first perfect pour; count of moments with nothing to do (idle over 20 s with no visible next action); did the tutorial pointer lead to a smile or a question; first time a guest line repeats. Mark every "I am waiting" moment (brew, cook, grow) with its length. Pass: first smile under 90 s, no idle gap over 45 s without a pointer or a second thing to do.
2. ONE FULL HOUR, FREE PLAY (after the tutorial). Measure: gold per 10 minutes (compare with balance.ts: about 220 gold in 30 min, 460 in the first hour); which loops were visited (tavern, farm, dungeon, mine, lakeside, build) and the order; where the tester chose to stop and why (boredom point, tick with minute); count of dungeon runs and deaths; did anyone use splice without being told; one question to the tester at the end: "what would you do next and what makes you want to?". Pass: at least 3 loops visited, no idle gap over 3 minutes, the tester names a next goal.
3. DAY-2 RETURN AND SECOND SESSION (load the saved game after 4 to 8 real hours of offline time). Measure: the welcome back moment (title, Continue, offline catch-up: seats only), what the player sees to do in the first 60 s, whether any NEW thing happened since the last session (a new guest, a rumour, a finished brew/crop is not enough), whether the tester wants to continue. Also run a 30 minute block of the farm and splice loop only to see when discovery stalls (note a "hint wanted" moment). Pass: something new visible within 60 s, a stated reason to play on.
Extra measures in every run: touch feel (a hold-pour that failed), toasts that covered something, the number of times the tester opened a panel to find something (a chore indicator), moments where the tester laughed (list the cause).

## 4. BUILD ORDER FOR THE TOP 5 (small task prompts; gates for every task: `npm test`, `npm run typecheck`, tests next to new rules, NEWS entry, no ranked number without balance.test and the owner, SAVE bump + migration + test only if the GameState shape changes)
Order (shared dependencies first): 3 reveal -> 1 regulars -> 2 rumours board (with daily quests) -> 4 festival framework -> 5 bard. Each coder task is followed by the ui/artist task for that item.

### T-FUN-1 [coder] Discovery reveal and Book "left" counts (item 3)
1. Objective: when a splice result, dish, drink or fish is found for the first time, open a skippable reveal card (item, name, rank colour, a line) and show "N of M left" and a hint scrap after K tries in the Book tab.
2. Files: shared/src/book.ts (counts, hint rule, pure), shared/data/spliceRules.json (hint text), client/src/ui (reveal card, uses ui/panelShell.ts style), render fx hook, audio cue name.
3. Rules: hint rule is pure and seeded (time/rng passed in); the reveal never blocks play (a tap skips); texts at reading pace (readingMs).
4. Gates: book.test.ts for counts and hints; no GameState change (derive from Book); e2e smoke still green.
5. Art/anim follow-up [artist/animator]: sparkle on the reveal card, 4 frames, Endesga 32 only.

### T-FUN-2 [coder] Named regulars slice (item 1)
1. Objective: 6 regulars as data (id, look, favourite drink, favourite dish, 3 story lines) that come back at a rate from tavernAppeal; serving the favourite gives a small tip and unlocks the next story line and a gift from existing tables.
2. Files: new shared/data/regulars.json, shared/src/regulars.ts (+ test), guests.ts spawn hook, ordersStrip guest mark, Book "Regulars" tab (client/src/ui).
3. Rules: never leaves permanently; no timers; tip bonus PROPOSAL 5% gated by balance TF1 (guest share under the 55% cap); gifts only from current drop tables.
4. Gates: tests for seeded pick, story progress, gift; SAVE bump 33 with migration (Player.regulars) and a test; `npm run simulate` before and after pasted into the NEWS entry.
5. Follow-up [artist]: 6 guest looks from existing layers/ramps (no new layers); [ui] Book tab; owner decision: names and tone.

### T-FUN-3 [coder + ui] Rumours board with daily quests (item 2, OA-15)
1. Objective: a board furniture piece opens a panel with 3 daily rumours (a pure seeded pick from a pool by the date passed in) plus event quest rows when an event period is active; each rumour is a small goal tied to a system with a hint.
2. Files: shared/src/quests.ts (daily pick rule), shared/data/rumours.json, client/src/ui (board panel, ready dot on the board and the Quest button), shared/src/book.ts hook for hints.
3. Rules: no streaks, no penalty, no countdown text, nothing to buy; an undone rumour stays on the board; rewards inside balance.ts (ask the owner before any ranked number).
4. Gates: quests.test.ts (same date same picks, no repeat within 3 days, migration of old quests into achievements keeps all progress); SAVE bump if the shape changes; phone layout check at 360 px.
5. Follow-up [artist]: board sprite (wall item) and 6 rumour icons.

### T-FUN-4 [coder + artist] Festival framework and the first festival (item 4)
1. Objective: events are data (id, real-day range from the date passed in, guest role weights, decor pieces that appear free on the wall, 5 event quests, a one-time cosmetic reward); first festival "Harvest Feast" with the cook-off board (best dish of the day, ribbon).
2. Files: shared/data/events.json, shared/src/events.ts (pure `activeEvent(dateIso)`), npcRoles.json (festival guests), client/src/game/tavernLife.ts hook, event card ui.
3. Rules: an event ends softly (rewards stay claimable), returns yearly, never exclusive for money, no buy offer inside it; text states what to bring on the first day (the caveat in section 0).
4. Gates: events.test.ts (date boundaries, no event gap bug, time passed in), balance.test.ts entry for the event reward table, e2e with a mocked date.
5. Follow-up [artist] banners, lanterns, ribbon; [animator] lantern flicker; owner decision: event dates and names.

### T-FUN-5 [coder + animator] Bard night with a rhythm toy (item 5)
1. Objective: a stage decor piece lets a bard guest play; while playing, seated guests stay 20% longer (PROPOSAL) and tip +10% (PROPOSAL); an optional 4-beat tap bar (like ui/pourBar.ts) gives a "great show" cue.
2. Files: shared/src/rhythm.ts (pure, copies the pour.ts shape), shared/data/tunes.json (use existing tunes), furniture.json (stage), npcRoles.json (bard), client/src/ui/rhythmBar.ts, audio hook.
3. Rules: optional, never required; the bonus is capped; no ranked numbers without the owner.
4. Gates: rhythm.test.ts (window edges, hold and tap), balance TF1 guest-share cap with 30% bard time, `npm run simulate`.
5. Follow-up [animator] bard play 2 frames, [artist] stage piece and bard look.

## 5. Owner decisions needed
a) Festival dates and the first three names (Harvest Feast, Lantern Night, Brew Fair are only suggestions). b) Is the travelling trader (item 9) wanted at all, given its balance risk. c) Regular names and tone. d) Turn DUNGEON_ROUND 2 on earlier for bosses (item 11)? e) Dice as a no-stake toy: yes or no. f) Rhythm bar for the bard: yes or later.
