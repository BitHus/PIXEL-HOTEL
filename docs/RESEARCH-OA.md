# RESEARCH-OA: fishing, cellar tiers, compact UI, eating (researcher, 17 Nov; for OA-3, OA-7, OA-11, OA-12)

Inspiration only. Nothing is copied; all names, art and numbers below are ours. All numbers are PROPOSALS for the owner unless the text says "exists".
Source note: standard web search gave solid facts for Stardew and Dave the Diver, and nothing usable for Travellers Rest (no wiki hit) or Moonlighter fishing (Moonlighter has no real fishing minigame; its fun is the shop and dungeon loop). The Travellers Rest and cellar parts therefore rest on general genre knowledge plus what our game already has (K2 casks); the owner or a tester should check Travellers Rest by hand before numbers are locked.
Web facts used: Stardew's creator said the fishing minigame is fun but "starts too hard", partly fixed by a cheap training rod; a skip-minigame mod has about 2.5 million downloads (source: PC Gamer / GamesRadar articles on ConcernedApe). Dave the Diver reviews praise the loop aim, fire, struggle, repeat, with fights as quick button sequences that wear the fish down, and difficulty that scales with depth (CGMagazine, Push Square reviews).

## 0. What the game already has (so proposals build on it)
- Fishing: shared/src/fishing.ts. Phases wait -> bite -> reel -> done, 50 ms ticks (FISH_TICK_MS), Stardew-like bar with a catch box and a swimming fish, nibbles before the bite (FISH-1), rank sets bite window and difficulty, rods enlarge the box. Missing loses nothing.
- Casks (K2) EXIST: shared/src/config/ripen.ts. Keg rack with CASK_SLOTS = 3 casks; tiers fresh / aged (value x1.6, tip x1.2) / vintage (value x3, one rank higher); RIPEN_AFTER_MIN by rank of the plain drink (common 30 / 180 min, rare 120 / 480, ultra 240 / 960, legendary 480 / 1920); TASTE_AGED_CHANCE 0.25. Types: DrinkTier, DrinkId `<base>_<tier>`.
- So OA-7 is mostly a ROOM and FLOW change (where it happens, what you see), plus a small tier extension. Do not rebuild K2.

## 1. FISHING

### 1.1 What makes it fun (and where ours is dull)
1. Anticipation beats action. Stardew's best moment is the wait, the nibble, the dip, the "!" (we have this). Dave the Diver's best moment is the aim before the shot. The tension is the 2 seconds before the input, not the input.
2. Reading the fish. Players enjoy it when different fish behave differently (darting, sinking, circling) and the player can name them ("the zig-zag one"). Our reel has one pattern (swim, occasional dart) for all fish: it feels the same every time, which is the boredom the owner reports.
3. Fair onboarding. Stardew's known flaw: it starts too hard. Ours must feel kind at common rank (wide box, slow fish) and only get tricky with rank and depth.
4. Reward reveal. Catch = a small ceremony (name, size in cm, record, rank colour, sparkle for ultra rare). Dave: the catch feeds the restaurant, so a catch matters. Ours feeds the tavern menu (fish dishes), so show that.
5. Variety of the SPOT, not just the fish. Stardew has biomes/seasons/time; Dave has depth and species behaviours. We have one lake: add variety through time of day, pier vs shore, bait, and a "hot spot" that moves.
6. Optional depth, never a gate. Many players mod the minigame out. Keep a gentle mode: Settings "Easy fishing" (wider box) and a bait item that auto-hooks the first bite.
7. Juice: line tension sound, splash rings, camera nudge, rod bend, bobber that reacts, line colour (green safe, red danger).

### 1.2 Redesign proposal (keeps the pure step function and 50 ms ticks)
Keep wait -> bite -> reel. Add these, all data driven:

A) FISH BEHAVIOURS (the main fix). A catch type gets `behaviour` in shared/data/fish.json: one of
 - `drifter` (slow sine drift, easy; common small fish),
 - `darter` (rests, then a fast dart to a far point, tells with a 300 ms shiver first; the player can pre-move),
 - `diver` (drops hard to the bottom, slowly rises; box must fall with it, so the player releases),
 - `circler` (steady ping-pong between two edges, speed rises as the catch bar fills),
 - `sulker` (stands still, then drains the bar if the box is not exactly on it; rare fish).
 Implement as `swimStep` switching on behaviour; same rng, still deterministic. Each behaviour has a 300 ms telegraph event `{ t: 'tell', kind }` so art and sound can warn (readable = fair).
B) TENSION LINE. Replace the single catch bar by catch bar (progress) PLUS line tension 0..100: tension rises while the box is off the fish, falls when on it; at 100 the line snaps (outcome 'escaped'). Gives a clear "danger" meter and rod `lineStrength` a role. New config FISH_TENSION_RISE, FISH_TENSION_FALL (proposed: rise 45/s off, fall 30/s on, start 20).
C) THE STRIKE WINDOW gets a skill grade: tap within the first 35% of the "!" window = "Sharp" (starts the reel with the catch bar at 25% instead of FISH_REEL_START). Cheap reward for attention.
D) BAIT (uses existing materials/crops): one bait slot; bait shifts the rank odds (like the rod) or picks a fish family. Gives the farm a link (crops -> bait). Data: `bait` in fish.json per fish (`likes: ['turnip', 'worm_thing']`). Bait is spent on cast; no bait still works.
E) SPOT AND TIME: the lake has 3 spots (pier end, pier side, shore). Spot and time of day (light layer exists) change the table through `spots` and `hours` filters in fish.json. A rippling "hot spot" circle on the water moves every 3 min of real time and gives +1 rank weight when you cast into it. Pure: hot spot index = hash(floor(now / 180000)).
F) COMBO FEEL: a streak counter of clean catches (no tension above 70) gives a small shared gold/sell bonus? Not proposed (economy risk); show it only as pride text and a Book stat.
G) ESCAPE SOFTENING: a lost fish says "it got away, nice fish!" and keeps the bait; no punishment (matches "no timers that punish").

Tuning targets (proposals): common reel 8 to 12 s, rare 12 to 18 s, ultra 18 to 25 s, legendary 25 to 35 s; first-ever catch must succeed at 90% with a new player holding badly. Add a unit test: a scripted "perfect hold" bot and an "idle" bot; the idle bot must lose every fish of rank rare and up, and catch at most 20% of common (so holding matters but common stays kind).

### 1.3 Visuals (artist, animator)
- Side-on reel panel (a small framed strip, not a big box; see section 3): left = a short water column showing the fish sprite in its pose (darting streak, diving bubble trail), right = vertical tension gauge. The fish in the strip is the SAME sprite as the catch, silhouetted until caught (mystery, Book hook).
- World view: rod bends in 3 frames by tension; line is a 1 px polyline with gravity sag; bobber has 4 states (float, nibble dip, bite plunge, reel taut); splash ring and ripple on cast and on strike; "!" pops with a 2 frame bounce.
- Water: 3 layer parallax shimmer, fish shadows swimming slowly under the surface at the hot spot, dragonflies and reeds (lakeside life exists).
- Catch ceremony: fish jumps in an arc to the avatar (0.6 s), name plate, cm, rank colour border, sparkle for ultra_rare/legendary, held up over the head for 1 s (avatar frame "cheer" exists later).
- Audio cues: nibble tick, bite sting, reel creak that rises in pitch with tension, snap, splash.
- Mobile: hold anywhere on the strip; no tiny button.

Coder order: fish.json behaviours + tell events + tests, tension line, strike grade, then bait, then spots; art can run in parallel from the event list above.

## 2. CELLAR AND BREW TIERS

### 2.1 How games do it (genre pattern, not a copy)
- Tavern/farm sims use the same shape: raw goods -> a PRODUCTION station (brew barrel, press, stove) -> a MATURING station (cellar, cask, keg) -> a SERVING point (taps). Value grows with time spent maturing, usually in 3 to 4 named quality steps (plain, good, great, best; often shown as stars or a colour), and the higher steps unlock higher menu prices and pickier guests.
- Good versions add one real decision: a limited number of cellar slots, so the player picks WHAT to age (a few vintages for profit, the rest fresh for volume). Bad versions make the longest tier always best, so waiting is the only strategy.
- Realism hooks that read well: a cellar is cool and dark, kegs lie on racks, you tap a keg to taste; ripening goes at its own pace even while the game is closed (we already do real time).
- Risks: idle-only tiers feel like chores; fix with a visible "ripe" indicator and a single tap to collect (our rule: nothing is collected by itself, but nothing rots).

### 2.2 What we change (OA-7)
Rooms (owner request): the starter tavern stays kind 'shop'. Add two attached rooms, built from the same room machinery, not separate maps for the player to walk to by default:
- KITCHEN room (new Room kind 'kitchen'): holds stove(s), prep tables, the brewing barrel; first brew in the tutorial happens here (guide.json steps move there). Door to the tavern.
- CELLAR room (new kind 'cellar'): holds keg racks (casks), cool dark lighting, a hatch/stairs to the tavern. Cellar levels 1..3 give more racks.
Both open by a "Build rooms" action in the Room panel (gold cost proposal: kitchen 150, cellar 300; kitchen is FREE in a new game so the tutorial works). The existing kitchen ZONE rule (T1) keeps working inside the kitchen room: the whole kitchen room counts as the zone, so prep bonus logic is unchanged (zone = the room).
Compatibility: tavern id stays; new rooms get new integer ids; old saves get a kitchen room created and the existing stove, prep tables and barrel MOVED into it (or into the bag if no space), keg racks into a new cellar. Mirrors how SAVE 24 added things.
Walking: guests never enter kitchen or cellar (npcGrid, like the staff zone). Owner walks through the door; camera uses the same room-open intro.

### 2.3 Tiers (extends K2, proposals)
Keep the two existing steps and add a third top tier and a quality dimension:
| tier | name | after (common rank) | value mult | tip mult | note |
| 0 | fresh | 0 | 1.0 | 1.0 | exists |
| 1 | aged | 30 min (exists) | 1.6 (exists) | 1.2 | exists |
| 2 | vintage | 180 min (exists) | 3.0 (exists) | 1.0 | exists, rank +1 |
| 3 | reserve (NEW) | 720 min (12 h) | 5.0 | 1.5 | rank +1, needs a Cellar level 2 rack |
Ripening times by plain rank (extending ripen.ts): common 30 / 180 / 720; rare 120 / 480 / 1440; ultra_rare 240 / 960 / 2880; legendary 480 / 1920 / 5760 (minutes). All proposals; the first two columns per rank already exist.
Reason for the cap: balance.ts closed loops. A reserve mug at 5x must still sell to the trader below its ingredient+brew value (SELL_RATES keep drinks unlisted for the trader today, so the loop stays closed) and guest gold must stay inside the 10% to 55% share; run `npm run simulate` before locking. Value mult 5.0 at 12 h wait with 3 racks x slots gives about 1 reserve batch per rack per day, so guest income from reserve is capped by cellar size, not by waiting alone.
Decision hooks (keep it a choice): CASK_SLOTS per rack stays 3; Cellar level adds racks (L1: 1, L2: 2, L3: 3 racks = 9 casks); a cask holds ONE drink at a time up to TAP_CAP-sized batches (12 mugs); a rack cannot be sped up. Guests with taste (TASTE_AGED_CHANCE 0.25 exists) split: 25% want aged or better, 10% (new, proposed TASTE_RESERVE_CHANCE) want reserve and tip 1.5x. Fresh stays the volume product.
Cellar temperature variant (optional, later): racks near a cool wall ripen 10% faster (RIPEN_COOL_MULT 0.9) = a small furniture-placement reward; not needed for v1.

### 2.4 Flow
farm (crops) -> KITCHEN room: barrel brews fresh (existing brewing.ts, real time, tap to collect) -> collect mugs to the bag -> CELLAR: Load into a cask on a rack (existing K2 flow; ledger 'cask') -> a "ripe" dot on the rack when a tier is reached (OA-5 style) -> tap to Collect (choose how many mugs, tier shown) -> TAP STAND in the tavern: Load (existing T1; ledger 'tap'). Menu stock rule unchanged (a drink is on the menu only while a tap holds a mug; tier items are distinct DrinkIds with their own price).
Order panel / UI: the Load list groups by drink with tier chips (fresh / aged / vintage / reserve) in the rank colours (RANK_COLORS), never a wall of boxes (see section 3).

### 2.5 Data shapes (proposal)
- shared/data/drinks.json: unchanged per drink; tier table moves to config: `RIPEN` gains `{ tier: 'reserve', valueMult: 5, tipMult: 1.5, minCellarLevel: 2 }`; `RIPEN_AFTER_MIN[rank]` gets a third number `reserve`.
- types.ts: `DrinkTier = 'aged' | 'vintage' | 'reserve'`; DrinkId template unchanged, so `root_ale_reserve` appears automatically via materials.ts (check that function builds from RIPEN).
- Room.kind adds `'kitchen' | 'cellar'`; roomShapes.json gets entries (small rooms, e.g. kitchen 6x5 cells L1; cellar 8x6 L1 growing); styles: cellar gets stone floor/wall defaults ('cellar_stone'), kitchen tile.
- Furniture: keg_rack and barrel/stove/prep_table get `placeIn: ['kitchen']` or `['cellar']` (today 'shop'); old saves migrate.
- GameState: `TavernState.casks` stays; each cask gains `roomId` OR is found by rack uid (rack lives in a room), no extra field needed if racks stay furniture items keyed by uid. Add `Player.unlockedRooms?: ('kitchen' | 'cellar')[]` or derive from the room list (derive: simpler, no new field).
- guide.json: tutorial brew step targets the kitchen door and barrel; the first-steps copy must say "kitchen".
- Door linking: `Room.links: { door, toRoomId }[]` (hotel already has One Inn doors; reuse that structure and `roomsApi`).

### 2.6 Save impact
SAVE_VERSION 32 -> 33 (or next free). MIGRATIONS[32]: create kitchen room (shape by tavern level), move stove, prep tables, barrel there (skip cells that fail, bag the rest, ledger reason 'migrate'), create cellar room only if the player owns a keg rack, else leave locked; set tavern kitchen-zone logic to "room is the zone" while keeping the old zone for saves that keep furniture in the tavern (keep both code paths until owner agrees to remove the zone). Test: old save with a stove in the zone, with a cask in progress (time preserved), with nothing built. Also update CLAUDE.md sections 5 and 9t (new room kinds), docs/BRIEF.md, balance tests (new tier).

### 2.7 Open questions for the owner
1. Room costs: free kitchen, gold cellar? 2. Is the 12 h reserve tier wanted, or stop at vintage (less to balance)? 3. Should guests ever see into the kitchen (a serving hatch window)? 4. Cask quality from the ingredients (a "good crop" gives a faster ripen)? Not proposed for v1.

## 3. COMPACT UI (OA-11)

### 3.1 Patterns that work in good pixel and cozy games
- One thing, one small badge. State is shown as an icon with a number or a tiny bar next to the object or on the screen edge, not as a panel. A tray with 2 mugs is two small icons in a pill, not a titled box.
- Hide until relevant (progressive disclosure): order chips only exist while there is an order; the tray pill only while something is on it; the quest card only when the guide is done (OA-4).
- Anchor to the world first. A ready dot above the stove, a speech bubble with the dish icon over the guest: the world is the UI. Edge UI only for global things (gold, time, menu).
- Collapse into submenus: rare actions (Settings, Book, Packs, Gear) live behind one "More" button. Hotbar = what you use every few seconds, nothing else.
- Responsive: layout by container size (narrow phones, wide desktops), not fixed boxes; touch targets stay 44 px but the visible art can be smaller (padding is invisible).
- Alpha and timing: idle HUD fades to 60% opacity and returns on touch; toasts last at reading pace and stack at most 2.
- Frames: ONE frame style; thin 1 px border and dark translucent fill for pills; big parchment frames only for real panels the player opened.
- No overlap rule: every HUD zone has an owner (top-left info, top-centre orders strip, right icon column, bottom hotbar, bottom-left chat). Anything new must claim a free spot or live in a panel.

### 3.2 Concrete rules for our HUD (proposal; client/src/ui/*)
1. SIZE BUDGET: at most 5% of the screen area covered by always-visible HUD at idle on a 390x844 phone; measure in an e2e screenshot (Playwright) with a test that sums bounding boxes of `.hud` elements.
2. Tray: a pill of icons (24 px each, max 3) with no title and no frame fill beyond 70% dark; shown near the avatar/hotbar only while the tray is non-empty; press-and-hold shows the word "Put back". The big "Tray [beer]" box is removed. (OA-11 example.)
3. Orders strip: chips shrink to icon + 2 px patience bar (state by border colour: waiting grey, queued yellow, ready green); on narrow screens show max 4 chips and a "+N" chip that opens the list.
4. Info panel top-left: gold and gems always; level/xp collapse to a small bar; quest card and guide card never at the same time (one-guide rule).
5. Right icon column: at most 6 buttons; extra ones go under More; each button is icon-only with a label on long-press/hover.
6. Panels: one open at a time (exists), at most 60% of the screen width on desktop and bottom sheets on phones (slide up, drag handle, max 70% height, the world stays visible above).
7. Lists use rows not cards: icon, name, number, one action. Tabs for groups (Serve / Menu / Sell exist). Quantity steppers appear after a tap on the row, not on every row.
8. Notifications: toast at most one line, 2 stacked, 3.0 s at reading pace; counters ("+3 gold") float from the world point and never block taps.
9. Scale: UI scale follows `min(width, height)` buckets (small <= 480, medium <= 900, large) via CSS variables (--ui-s), plus a Settings "UI size" (small / normal / large).
10. Contextual action button: when the avatar is near a usable thing, one small button near the thumb zone appears (tap shortcut for use/collect), not a row of buttons.
11. Fade rule: HUD elements not touched for 8 s go to 60% opacity; a new event brings the relevant one back.
12. Every new HUD element needs: owner zone, collapse state, phone screenshot in docs/NOTES.md.

## 4. EATING AND TABLES (OA-12)

### 4.1 How pixel tavern games do it (pattern)
- The table is drawn as one tall-ish sprite seen from the slight front angle; dishes are SEPARATE small sprites placed on the top face at fixed slots (one per seat), drawn right after the table in the sort order, with a 1 px shadow so they read as sitting, not floating.
- Seat anchors sit on the table EDGE in the seat's direction (north seat: back edge, south seat: front edge, side seats: left/right edges), about 6 to 8 art px inside the rim, not at the centre; this keeps plates in front of each diner and avoids the "floating food" look.
- The diner sprite is drawn partly BEHIND the table edge for the north seat (they are above it in y) and in front for the south seat; side diners sit beside the table with their torso overlapping the edge by 2 to 4 px. Chair and stool art fills the gap.
- Eating is a 2 frame loop on the diner (hand to mouth / lowered, 400 ms per frame) plus the item shrinking in 3 steps (full, half, crumbs) over the eating time; a mug has "tilt, sip, lower" with foam level dropping. When done the empty plate stays until cleared (we use coins and an empty mug the player taps).
- Round tables in cozy games are usually 3 to 4 cells across (a 2-cell table looks like a stool, a 4-cell table is a banquet) and seat 3 to 4 with seats at 90 or 120 degree spacing.

### 4.2 Why our round 4x4 table fails (hypothesis to verify in code)
Items sit at a seat's `plate` anchor; for a 128 x 128 round table the anchor is probably computed at the table CENTRE or at the footprint edge in cell terms, so the plate lands off the visible rim (the round art is smaller than the square footprint, so the corners of the footprint are empty air). Check in shared/src/tavernSeats.ts and the item draw order in client/src/render/items.ts for the plate y offset and the surface height. Fix by giving each table type explicit art-space slots, not derived ones.

### 4.3 Proposal: data
In shared/data/furniture.json (tables) add `seatPlates` next to seats, in px relative to the table anchor (bottom centre), measured on the art:
```
"seats": [ { "dx": 0, "dy": -72, "facing": "down" }, ... ],
"plates": [ { "dx": 0, "dy": -44 }, ... ]   // one per seat, same order, on the top face
"mugSpots": [ { "dx": 10, "dy": -42 }, ... ] // optional second slot per seat
"topHeight": 26                               // px the top face is above the floor (the prep bonus and surface items already use a height)
```
Rules: plate slot = seat position moved toward the table centre by 22 px (art px), then up by topHeight in screen space; mug slot = plate slot offset 10 px toward the seat's right hand; plate sort key = table y + 1 so it draws right after the table; a diner behind the table (facing down) draws BEFORE the table, in front diners after.
Rotation: slots rotate with the facing set; round tables have no rotation (symmetric) except that seat order is fixed.

### 4.4 Recommended sizes (cells of 32 px)
- Round table small: 3x3 cells (96 px): 3 seats at 120 degree spacing (N, SE, SW) or 4 seats at 90 degrees (N, E, S, W) with the stool on each side occupying the cell outside the footprint. Plates 2 cells apart from the centre is too far on a 3x3; use plate radius 26 art px from the centre.
- Round table large: 4x4 only as a "feast table" with 6 seats (60 degree spacing) and plate radius 40 px; the owner reports the 4x4 does not work, so either fix it with the slots above or drop it from the catalog until it does.
- Square table: 2x2 (2 seats, opposite), 3x2 (4 seats: two long sides), 4x2 (6 seats, long banquet). Plates at the long-edge midpoints, 8 px inside the rim.
- Bar stools: 1 cell; seat anchor at the cell centre, plate on the bar surface in front (bar height 28 px).
Keep the existing seat count rule (guests never exceed seats) and the staff-zone rule.

### 4.5 Eating animation proposal (animator)
- Diner frames: `eat` 2 frames (hand up with fork/mug, hand down), 400 ms each, plus head bob of 1 px (rig data avatarRig.json already supports a head offset per frame). Add `drink` frames for mugs (tilted arm, foam). 
- Dish states on the plate: full -> half -> crumbs at 0%, 40%, 80% of the eating time (20 to 40 s exists), then crumbs with an empty mug/plate; coins pop onto the table top (OA-2: coins land and stack at the table, never fly: a coin lands within 14 px of the plate slot, stack up to 5 with a 2 px offset each).
- Steam: 3 frame wisp on hot dishes for the first 8 s; foam top on a fresh mug.
- Order bubble pops when seated, switches to a heart/smile on served and a frown after 60 s (existing patience states).
- Table clutter cleans when the player taps the coins/mug (existing flow).

### 4.6 Test checklist for the coder
1. A pure function `plateSlots(tableType, facing)` in shared/ with tests: every slot lies inside the table's top polygon (a point-in-ellipse/rect check) and within 8 art px of the seat's side. 2. Visual tester shot: 3x3 round with 3 seats, 4x4 round with 4 and 6 seats, 3x2 square with 4 seats. 3. A save with an old table keeps working (defaults derived from old seats when `plates` is missing).

## Summary for the manager
1. OA-3: new fish behaviours with telegraphs, a tension line, spots/bait, a readable reel strip and a catch ceremony; all fits the pure step function.
2. OA-7: K2 casks already exist; the work is two attached rooms (kitchen, cellar), a 4th "reserve" tier (proposal), a clear flow with ripe dots, and a SAVE bump with a migration that moves furniture. Numbers marked proposal go to the owner.
3. OA-11: a small set of HUD rules (area budget, tray pill, orders chips, bottom sheets, scale buckets) testable with a Playwright bounding box sum.
4. OA-12: explicit `plates` slots per seat in furniture data, a 3x3 round table with 3 to 4 seats as the default, a 2-frame eat loop with shrinking dishes.
