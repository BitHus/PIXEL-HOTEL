# PLAN-TAVERN-FLOW: hands-on service, bar guests and table guests (planner, 17 Nov; owner: "the tavern gameplay could be better", "not just the same 3 boring buttons")

Status: PLAN ONLY, no code. Builds on COD-1 (tray, orders strip), G2 (hold-pour), OA-6 (extended bar), OA-11 (compact HUD). Read first: CLAUDE.md 9 (TAVERN, THE BAR AND THE TAPS), shared/src/tavern.ts, tray.ts, pour.ts, seats.ts, npcNav.ts, barExtension.ts, client/src/ui/ordersStrip.ts+css, docs/RESEARCH-OA.md 3.
Numbers marked PROPOSAL are for the owner; no ranked number (balance.ts, config tavern numbers) is changed by this plan.
Vision fit (GAME-VISION pillar 1): serving by hand is the heart. Today: 1 guest type, tap guest, pour, carry. It works but every guest is the same and the bar panel is Serve/Menu/Sell tabs.

## 0. What exists (so we change little)
- Guest phases enter, to_seat, settle, order, eat, no_seat, no_menu, leave. Every guest needs a seat (tavernSeats = seats.ts + tableSpots); no seat = "no_seat" shrug and leave.
- Order -> serveQueue (max 3) -> avatar walks to taps ("pourwait") -> hold the stand -> mug on tray (TRAY_MAX 3) -> tap guest/chip/table = ONE mug walks there. Dishes: stove batch, automatic carry.
- ordersStrip(t) gives chips {guestId, item, patience, urgent, state waiting|queued|ready}; a tap on a chip = same as tapping the guest.
- Staff zone behind the bar and the kitchen zone are blocked for guests (npcGrid). OA-6 pieces (counter_ext) lengthen the bar.

## 1. The new loop in plain words
Two guest types. The player's hands are the game; panels are for choosing the menu.
- TABLE GUEST (as now): walks in, sits, orders, waits, eats 20-40 s, leaves coins + mug on the table. You pour, put the mug on the tray, carry it to the table. Slow, relaxed, pays full price. Groups (2 or 3) sit together.
- BAR GUEST (new): walks in, goes to a standing spot in front of the bar (the customer side of the counter or an extension piece), turns to the bar and orders there (bubble with the item). You do NOT carry: pour the mug at the tap, step to the guest's spot side of the bar and tap the guest (or the chip) = the mug slides across the bar into their hands (hand-over, 0.4 s). They drink on the spot (6-10 s, a short drink loop), drop coins ON THE BAR in front of them (a small pile, tap to take, same Mess rule), leave. Quick, small tip, impatient (patience 60 s instead of 90 s), orders drinks mostly, a dish only a simple one ready on the tray.
- Bar guests make the room feel like a real tavern (people leaning on the bar) and fix the "all seats full = guest leaves" waste. A crowd at the bar is a rush you handle by tray stacking.
- Dishes: ready batch at the stove or serving hatch goes to the tray in ONE tap (tray holds up to TRAY_MAX mixed mugs and dishes); then tap guests as above. Table dishes stay as now (no per-guest walking needed when the tray is used).

## 2. The orders strip as the control centre (top of the screen)
One chip per open order, least patience first (exists). Each chip: item icon (24 px), guest mark (tiny head, hat/colour from the guest look, so you know WHO), a 2 px patience bar, small badge: bar (a counter icon) or table (a stool icon). State = border colour (waiting grey, working yellow, ready green, urgent red pulse). NEW states: 'pouring' (you are at the tap for it), 'tray' = on the tray (green; same as ready) and 'bar' vs 'table' delivery. What ONE TAP on a chip does:
| chip state | tap does |
| waiting, mug stock on taps | avatar walks to the tap and WAITS for the hold-pour (queue as now); the chip turns 'queued' |
| waiting, dish in the bag only | avatar walks to the stove/hatch if a batch is ready (collects it to the tray); else toast "Nothing ready, cook it" and the Cooking panel opens on long-press only |
| waiting, nothing in stock | toast "Out of X" and the chip shakes; no panel jumps open |
| queued / pouring | nothing new; second tap on the same chip cancels it from the queue (undo, mug stays on taps) |
| ready (mug on the tray) | table guest: that ONE mug is carried to the table (as COD-1). Bar guest: the avatar steps to the bar side and hands it over |
| tray full (3) | pour is refused with a toast "Tray full, serve one"; the chips that the tray can serve pulse |
- GRAB ALL button (a small button at the right end of the strip, shown only when 2+ open orders share an item): grabs one mug per open order of the MOST urgent item type, up to free tray slots (queue max SERVE_QUEUE_MAX stays; the avatar pours them back to back; each pour is still a hold, no auto-pour). Label "x3" with the item icon.
- The strip also holds the tray pill (icons, max 3) right after the chips; a tap on a tray icon = hand it to the best matching open order (the least patience). Long press = Put back.
- DELIVER ALL: when the tray holds N items and N open orders match, a "Serve all" chip (green) walks one route: bar guests first (nearest first), then tables by distance (a tiny tour planner, pure: serveRoute(tray, guests) in shared/src/serveRoute.ts). The player can still tap individual guests.
- Phone cap: 3 chips + "+N"; tap "+N" opens a drop-down list (rows, not cards). A chip is a 44 px hit box (visible 32 px).

## 3. Rules (pure, shared/src), data and tests
### 3.1 Bar standing spots
A bar spot is a cell on the customer side of a bar piece (counter or counter_ext), directly in front of its footprint. Capacity = one guest per front cell: counter 3 cells = 3 spots; each OA-6 piece adds 1 (a 6-cell bar = 6 spots). A spot is valid only if that cell is on the floor, free of blockers, reachable by npcGrid, outside guestZones (staff, kitchen, inn doors).
```
interface BarSpot { barUid: number; cell: {c:number;r:number}; x:number; y:number; /* stand point, bottom centre */ facing: Facing; /* toward the bar */ side: 'front'|'end'; }
function barSpots(items, room): BarSpot[]        // sorted left to right along the bar (queue order)
function freeBarSpots(spots, guests): BarSpot[]  // guests with guest.barSpot set count as taking it
function barSpotFor(spots, guests, from: Point): BarSpot | null  // the free spot nearest the door, then leftmost
```
- Queue order: guests take the nearest free spot to the door; a guest never takes a spot another guest walks to (reserved the moment they come in, like seat). The register/tap side is the head of the bar: spots nearest the taps are preferred when several are free (shorter hand-over reach).
- Guests never block staff: spots are on the customer side only; the staff zone is blocked for guests already. Avatars never block each other, so the player can stand beside a guest. The hand-over point is the staff-side cell behind the guest's spot (barServePoint(spot)), always reachable (staff cell exists, the bar rule keeps it reachable).
- Data on Guest (optional fields, no SAVE bump needed if optional; guests are not worth saving across versions anyway, see 3.4): `kind2?: 'bar'|'table'`, `barSpot?: {barUid:number; col:number}`. New phases: 'to_bar' (walks to the spot), 'bar_wait' (stands, ordered), 'bar_drink' (drinking). order/phase 'order' stays the open-order marker so ordersStrip needs only `where: 'bar'|'table'` added to OrderChip.
- Seeded rng and time are passed in as for everything in tavern.ts (no Math.random, no Date.now).
### 3.2 How the AI picks bar or table (pure: chooseSpot(rng, room, guests, menu, appeal))
1. No free seat and no free bar spot: as now ("no_seat" shrug).
2. Groups of 2 or 3 always look for a table first (a group at the bar is allowed only when no table seats are free for all of them).
3. A single guest: bar chance = clamp(BAR_BASE + 0.1 * (barSpotsFree - 1) - 0.05 * seatsFree, 0.1, 0.8), PROPOSAL BAR_BASE 0.35; more free bar spots raise it, plenty of free seats lower it. Appeal does not change the split (it only changes the guest RATE as now); it changes the kind: tavernAppeal >= 60 adds +0.1 to the group weight so busy, nicer taverns get more groups.
4. A guest's wish matches the spot: a guest who wants a dish (cooked food) prefers a table (+0.3 table); a drink-only guest prefers the bar.
5. The result is stored on the guest; a bar guest never changes his mind (simple, testable).
### 3.3 Timing and money (PROPOSALS, not applied)
- Bar guest: drink time 6-10 s (BAR_DRINK_MIN/MAX_MS), patience 60 s (BAR_PATIENCE_MS) with a warn mark at 25 s. Price = the menu price like any guest (the price rule stays). Tip on the bar: perfect pour = same POUR_TIP_RATE 10% (the player's skill is the same), plus a "speed tip" of +5% if served under 20 s after ordering (BAR_SPEED_TIP_RATE, PROPOSAL; it is the only extra). Gem tip chance: same as table guests (GEMS.tavern 5% x rank mult), it only applies when the guest did not call out.
- Rate: bar guests do NOT add guests: they replace table guests when a bar spot beats a seat. GUEST_MAX stays 8 (guests never exceed seats + bar spots). The interval stays 45 s * 100/(100+appeal).
- Balance: bar guests pay the same price but occupy the spot ~12 s instead of ~50 s, so income per hour can rise when the player keeps up. To keep guests at 45% of a mixed hour (balance.ts BALANCE_TARGETS: 10% to 50% each source; the best kitchen lifts it to 51%, cap 55%) the rate must not rise: the new guest creation is the same event, only the type differs, and the player's real limit is how fast they pour (0.8 s pour + walk), so income per guest stays about equal to today. If the simulator shows more than +8% guest income, cut the bar patience or add BAR_SPOT_COOLDOWN_MS 6 s per spot (the spot stays 6 s "wiping" after a guest). Test: simulate-economy gets a 'bar guest share' input; balance.test.ts group TF1 asserts guest share stays under the 55% cap with 30% bar guests.
### 3.4 Save impact
Guests are runtime state; an old save loads guests with kind2 undefined = table. The extra optional fields mean no SAVE_VERSION bump; if a coder wants a required field, bump to 33 with a migration that sets kind2 'table' and a test. Plan: optional, no bump.
### 3.5 Tests to write (shared)
barSpots (counter only, with 2 extensions, turned counter facing up/left/right), freeBarSpots with reserved spots, barSpotFor nearest door, spots never inside guestZones, never on a blocker, staff hand-over cell reachable; chooseSpot with seeded rng (same seed same result, no seats = bar, groups = table, dish wish = table); handOver(tray, guest) removes ONE mug, perfect tip, coins appear at the bar spot; ordersStrip where bar|table, 'pouring' state; serveRoute order (bar first, then by distance); grabAll(items, tray, guests) respects TRAY_MAX and SERVE_QUEUE_MAX; balance TF1.

## 4. UI layout (no overlap; zones from RESEARCH-OA 3.1)
Zones: top-left info, top-centre orders strip (one band), right icon column, bottom hotbar, bottom-left chat. The strip is the only new always-visible HUD; world-anchored UI does the rest.
- 420x760 (phone): strip band at top, y 8..52, between the info panel (left, ~120 px wide) and the right column (48 px buttons): free width about 420 - 120 - 56 - 16 = 220 px = 3 chips of 44 plus "+N" plus a 44 px "Grab all" (replaces the 3rd chip if needed; max 5 touchable items). The tray pill sits at the strip's end only while non-empty; when the strip is full the tray pill moves to just above the hotbar, centred (no title, 3 icons 24 px).
- 1280x720 (desktop): strip top-centre, up to 7 chips + "+N" + Grab all + tray pill, 44 px high, centred, max width 560 px; nothing else in the band. Hotkeys: 1-7 = the chip, G = grab all, Space = pour hold (exists).
- World-anchored: order bubble above the guest (icon) is the same icon as the chip; hovering/tapping the bubble = the chip; bar spots show faint markers only while a bar guest is walking there or while placing furniture; the pour bar floats at the mug (exists); the hand-over target glows green on the guest that the tray can serve (pulse exists).
- The bar panel (register tap) keeps Menu and Sell as quiet secondary screens (a small "Menu" and "Sell" button pair in the panel, no "Serve" tab: the strip IS Serve). The register itself gets a small badge "ring": see variety.
- Reading pace for toasts; at most 2 toasts; a tap on the room with a panel open only closes the panel (rule kept).
- Touch: every chip, Grab all, tray pill icon 44 px hit box. Screenshot checks: a Playwright shot at both sizes with 7 open orders, bounding boxes must not intersect the info panel or the right column.

## 5. Art needs (artist, animator)
- Guest at the bar: stand pose facing the bar (up) with an elbow on the counter (1 frame, per facing up/left/right), "drink at the bar" 2 frames (mug up/down, 400 ms), "wave for service" 2 frames (hand up) used while impatient. Uses the layered avatar rig (avatarRig.json head offsets); no new layers.
- Hand-over animation: the player avatar 'give' 2 frames (arm out, 300 ms); a mug slides along the bar top 3 steps (code-drawn, fx module) into the guest's hands; small "clink" particle.
- Bar spot markers: a faint boot-print or foot-rail glyph 28x14 px per cell (hint only while placing or when a bar guest walks in); optional brass foot rail under the counter (decor).
- Chip icons: guest head mark 12x12 (tinted by the guest's hair/hat), bar and table badges 10x10, "grab all" icon (three small mugs), "serve all" icon (tray with arrow), pouring state glyph (drop). All Endesga 32, 1 px dark outline.
- Tray: mugs stack visually on the avatar's tray (up to 3), dishes cloche small.
- Variety props (see section 7): bell on the bar 16x16 (2 frames), bar rag (wipe 3 frames), dirty mug crates, hatch with 2-state art (empty, plate ready).

## 6. Task list (small coder steps first; sizes S under half a day, M about a day)
| id | what | owner | size | gate |
| TF-1 | pure barSpots, freeBarSpots, barSpotFor, barServePoint + tests | coder (shared/src/barSpots.ts + test) | S | tests, tsc |
| TF-2 | chooseSpot + Guest optional fields + phases to_bar/bar_wait/bar_drink in tavern step; table guests unchanged; tests | coder (tavern.ts, guestsTf.ts split to keep files small) | M | tests; old tavern tests untouched; simulate prints guest share |
| TF-3 | handOver(): tray mug to bar guest, perfect tip, coins on the bar spot, Mess supports a bar spot (seatUid = barUid, seatIndex = col) | coder (tray.ts, tavern.ts) | M | tests |
| TF-4 | ordersStrip where bar|table, 'pouring', grabAll, serveRoute pure + tests | coder (tray.ts, serveRoute.ts) | S | tests |
| TF-5 | GameAPI: grabAll(item), serveAll(), handOver(guestId); LocalGameAPI wiring (tavernApi.ts) | coder | S | typecheck |
| TF-6 | client: guest walks to bar and stands/drinks (render guests), spot markers, hand-over fx, bar guest chip badge | coder + ui | M | e2e at 420x760 and 1280x720 |
| TF-7 | strip: states, Grab all, tray pill tap, phone layout, no-overlap bounding box e2e | ui | M | screenshot check, 44 px |
| TF-8 | art: guest bar poses, hand-over frames, chip icons, spot marker | artist + animator | M | spriteAssets.test, pixel-critic |
| TF-9 | balance: simulate bar share, TF1 tests, PROPOSAL numbers sent to owner; no config change until approved | coder | S | npm run simulate in targets |
| TF-10 | variety batch 1 (bell, wipe, rush) after the owner picks | coder + artist | M | tests, tester run |
Order: TF-1, TF-4, TF-2, TF-3, TF-5, TF-9 (numbers to owner), TF-6/TF-7/TF-8 in parallel (max 2 workers), TF-10. Each step ends with full tests + typecheck and a NEWS line; CLAUDE.md 9 is updated once TF-3 lands (owner changes a rule: say so, do not silently edit).

## 7. VARIETY: not 3 identical buttons (ranked by fun vs effort; the owner wants hands-on, varied, small actions with feel)
Principle: the player is in the world; panels only choose the menu (quiet screens). Every item is a small action with feedback (sound, particle, popup), and each guest type asks for a different move.
1. BAR RUSH (fun high, effort S, needs TF-2): "A crowd comes in!" 4 to 6 bar guests at once for 30 to 40 s with a short horn/bell stinger; the strip fills, Grab all and tray stacking matter; a "served 5 in a rush" tip stack on the register. Rare (once per 8 to 10 guests, only when bar spots >= 4).
2. REGULAR WITH A FAVOURITE (fun high, effort M): a named guest (npcLines + a small data list regulars.json) who orders the same drink; serve it perfect = a bigger tip and a line ("The usual!"); the chip shows a star. Fits the renown/regulars item of the tavern deep; keep it data only (name, drink id, tip bonus), no save needed until renown exists.
3. PICKY GUEST (fun medium-high, effort S): asks "cold, not foamy" = needs a perfect pour or the mug comes back; chip has a small glyph; a second chance is allowed (no loss, only a tip). Uses the existing pour grade.
4. RING THE BELL (fun medium, effort S): a service bell on the bar; tapping it when 2+ bar guests are waiting calms them (+15 s patience on the bar guests once per minute, cooldown shown); an easy "panic button" with feel (ding sound, 2-frame bell).
5. MUG STACK AND THE TRAY (fun medium, effort S, mostly exists): mugs visibly stack on the tray (up to 3); a wobble when you run with 3 (animation only, no loss); empty mugs on tables/bar are carried back by the tray in ONE tap (tap the empty mug pile = to the tray, drop at the sink/pantry for a tiny coin tip). Gives the second hands-on loop of clearing.
6. WIPE THE BAR (fun medium, effort S-M): a bar guest leaves a wet ring/crumbs on the spot; drag a rag across the spot (hold and drag, 0.6 s) = a clean bar; the next guest at a clean spot tips +1 coin (PROPOSAL). Optional, never blocks.
7. HATCH AND BIG GROUP (fun medium, effort M): the serving hatch (existing kitchen piece) shows a plate pile when a batch is ready; tap = all ready dishes on the tray at once; a group of 3 at a table orders 3 different things = the Serve all route delivers all in one trip with the group "cheering" when complete (bonus tip for the whole group served within 10 s of each other, PROPOSAL 5%).
8. GUEST MOODS AND CHATTER (fun low-medium, effort S): a short bar-side line from npcLines when served; a tipsy guest (3rd drink) sways; no gameplay effect. Cheap vibe.
Recommended first slice for the "no boring buttons" feeling: 1 (rush), 4 (bell), 5 (tray stack and clear), then 2 (regular), 3 (picky), 6, 7, 8.

## 8. Open decisions for the owner (with a recommendation)
1. Do bar guests tip? Recommend yes, small: the normal perfect-pour tip (10%) plus a +5% speed tip; no tip table-style coins on top. Cheaper per guest time, same per-hour income.
2. Bar spots per bar length (OA-6): recommend 1 spot per front cell (counter 3 = 3 spots, each extension piece +1); optionally the two end cells of the bar count too (+2) only if the room is wide. Cap 8 spots so GUEST_MAX 8 holds.
3. Does the bar fully replace tables? Recommend no: keep both; bar share about 35% of single guests (PROPOSAL BAR_BASE 0.35).
4. Bar guest patience 60 s vs table 90 s (PROPOSAL; the owner confirms; they leave unhappy after the patience, like tables).
5. Dishes for bar guests: recommend bar guests order drinks only in v1 (dishes need a plate and eating time at a table); a "bar snack" (cheese, bread) as a later small dish.
6. Hand-over tap target: tap the guest or the chip (recommend both, plus tray icon tap) and the avatar walks to the bar's staff side first (no teleporting).
7. Bar rush frequency and whether it ever hurts (recommend a rush never punishes: late guests only leave, no penalty beyond the lost sale).
8. Menu/Sell as secondary: recommend the register panel keeps two small buttons (Menu, Sell) and the strip replaces the Serve tab; the owner confirms before the tab is removed.
9. Art style of guest bar pose: recommend a simple elbow-on-counter, owner may veto at the avatar style lock.
10. Do any of these need numbers in config.ts? Yes: BAR_BASE, BAR_PATIENCE_MS, BAR_DRINK_MIN/MAX_MS, BAR_SPEED_TIP_RATE, BAR_SPOT_COOLDOWN_MS, RUSH numbers; all PROPOSALS, only added after the owner says go and after TF-9 shows the targets stay green.
