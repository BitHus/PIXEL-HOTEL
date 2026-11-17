# FIXLIST (G1, coder pass 16 Nov; no browser run yet: the tester route still has to add its items)

Done (code or test, suite and typecheck green)
- [x] Stale walk goals: openRoom now clears pendingDoor/Stove/Barrel/Cask/Block (a walk to a door, stove or barrel of the old room could fire in the new one after Map travel).
- [x] Door goal logic is one pure helper (walkDoorGoal in game/doorGoal.ts): tap and hold-to-walk both use it; an older hold-walk answer or a refused walk never opens a door. Tests added.
- [x] Door trip through the API: arrival on the matching spot and the tavern clock keep running (innDoorsAPI.test.ts).
- [x] Suspect 1 offline catch-up (2 min): seats fill only, taps keep 7 mugs, cask stays fresh with 7 mugs, ledger adds up (casksAPI.test.ts): fine.
- [x] Suspect 2 empty tap mid-order: already covered (tap runs empty, floor tap while pouring); added: stand picked up in flight, mugs go back to the bag, order stays open: fine.
- [x] Suspect 6 migrations: added v25 (casks) and a v24 -> current chain test; v24 and v26 had tests.
- [x] Suspect 3: hold-punch never touches doors; hold-walk only travels when the walk was accepted, is the current one and ends ON the spot (finger held there counts as intent).

Open (not fixed, for the manager, tester or artist)
- Door hint toast ("Doors lead to...") shows once per session, not once ever: needs a prefs flag (touch prefs.ts together with C6 nameTags).
- Suspect 4 (first 10 minutes): HINTS[0..1] (catalog + place) come before the tavern hint [2], and [2] still says "load it on a tap" although a new game starts with 7 ale already on a tap. Text/order change is a design call: suggest the tavern hint first. Not changed.
- Suspect 5 (panels at 420x760, 44 px buttons): CSS, goes to the artist (B6). Not checked in a browser.
- No browser smoke route run in this pass.

## OWNER AGENDA (16 Nov, spoken by the owner; done by the coder as task G2, before 9i)
1. BUG: an EMPTY slot in the hotbar cannot be clicked/tapped. Fix: an empty slot is selectable (shows empty, selected frame, tooltip "empty"), tapping it deselects the current item; keyboard 1-6 too. Check hold, drag and touch. Test in client/src/ui/hotbar logic.
2. FEEL: pouring at the tap is boring. It must be PRESSED IN (hold): serving a drink becomes a small hands-on action:
   - tap a guest with an open drink order: the avatar walks to the tap stand (as now) and waits there; the player PRESSES AND HOLDS the tap (or the pour button over the tap) to pour: the stream runs, the mug fills (a fill bar over the mug, foam on top, glug/pour sound that rises in pitch, the tap lever visibly pulled down, small shake) while the press lasts; release at the full mark (a forgiving window around full) = a perfect pour (small tip bonus, config number, balance test must stay green; no failure that loses the drink: under/over just tastes the same, only the bonus is missed); the mug is taken from the tap's mugs as today (T1 rules, "Tap is empty" keeps the order open).
   - THEN the player must tap the guest's TABLE/seat to deliver: the avatar carries the mug to the table, sets it down with a clink (not automatic any more). A queue of up to 3 carried orders stays as is.
   - Offline/away serving and the first-ten-minutes guide must still work (guide step "serve" = pour + deliver); the pour must work with touch (hold) and mouse; keep POUR_MS as the minimum/default duration for the animation; Reduce effects keeps the sounds.
   - This changes the T1 rule "the avatar POURS (POUR_MS 800 ms) automatically": update CLAUDE.md section 9 (THE BAR AND THE TAPS) and docs/BRIEF.md after it lands (the owner asked for it).

## SMOOTHNESS PASS (owner 16 Nov: "everything must feel smooth", a standing requirement for every screen)
Check and fix, one coder + one UI/artist batch after the playtest: avatar and guest walking (no stop-start on re-path, steady speed, turn easing, draw interpolation between ticks), camera (zoom ease, follow ease, whole-pixel snap without jitter), dungeon (movement, hit feedback, enemy motion interpolation), fishing reel, panel open/close and toast animations (short stepped easing, no layout jumps), hotbar/bag tap response (instant feedback < 100 ms), room change fade, frame pacing on phones (reduce effects fallback), no input dropped on touch. Add a frame-time debug line in Settings -> Debug to measure.

## TESTER RUN 1 (headless) 16 Nov, commit e98624e, production build served by vite preview, Chrome headless, 1000x700 and 420x760 (dpr 2)
Clean: no console errors, no 404s, no JS exceptions in any route below. Dev-server note: `vite` dev with 2 instances/ports colliding caused full page reloads back to the title (environment, not a game bug); use build + preview for tests.
Route done: title, new game (name, 16-char Inn, shapes, intro), tavern look, bar/register/tap stand/stove/barrel/table with 3 stools (no bar stool: OK), first-ten card, guests arrive (2 within ~1.5 min), Map, build mode on, dungeon (light smooth, resume after reload OK), lakeside, fishing (cast, bite, reel panel), phone layout.
NOT tested: farm, stove cook, barrel panel (see 2), hold-to-pour end to end, taps Load, build move/rotate, kitchen tint, prep table, offline catch-up, hats (see 6), dungeon fight/Leave, zoom-1 lakeside.
Findings, severity order:
1. MEDIUM, phone 420x760: Quest card sits over the first-steps card; the first-steps card (and its Skip, 36 px) overlaps the Map panel header and its close X (36 px < 44). Same overlap at 1000x700: Map/Bar panels start under the first-steps card and cover its text. Area: ui/ui.css top-card stacking, panelShell top offset, first-ten card z-order.
2. MEDIUM, tavern zoom 1: one tap on the barrel (708,240 on the barrel) did not open the Brewing panel; the avatar went to the bar and started "Hold the tap" pour for the waiting guest, first-steps jumped to 2/6 ("one more done") although no brew was started. Maybe a stale tap target or the order bubble hit area; repeat at zoom 1 and 3. Area: game/pointerInput.ts, tavernLife.ts (barrel vs order-bubble hit), first-ten step condition.
3. MEDIUM, Bar panel "Serve" after a cancelled pour: toast "The pour was cancelled" appeared after my Escape/other tap, order stays open (fine) but the "Hold the tap" prompt needs press-and-hold which headless clicking did not reproduce; confirm by hand that a mouse hold works and a touch hold works.
4. LOW, the "N orders" badge on the Map side button is clipped ("1order", overlaps the Map icon) and in the Map panel the Tavern card's badge shows "2 order" cut off next to "Here". Area: ui/sideButtons.ts badge, map card CSS.
5. LOW, Gold on the info panel first shows 0 for about a second after the intro (count-up from 0), then 100. Looks like lost gold; start the count at the real value. Area: ui info panel.
6. LOW, Hats: the character creator has no Hat tab (tabs Body, Hair, Top, Bottoms, Shoes) and no hat was visible on any avatar; could not check hats (none unlocked). Unselected tabs are icon only (no text/aria label except title). Area: ui character maker, avatar hat layer.
7. LOW, look: floor and wall in tavern and glow rings behind the character preview and on the title screen are stepped concentric rings (the dungeon light is smooth, those two are not). Room floor is one flat brown (bare style), guests are plain red/blue boxes, the barrel PNG and bar/register/tap/stove sprites do show. Area: ui title/charmaker CSS gradients, render bare floor.
8. LOW, dungeon: no Leave/abandon button in the HUD (only chat and settings), the run bag bar is a wide beige panel unlike the rest, and a faint square-stepped dark patch appears at the lower left corner when the camera moves (stepped vignette). Area: dungeon HUD, dungeon light.
9. LOW, Quest card covers the pier at the top of the lakeside; avatar overlaps the bar counter when pouring (reads as standing on the counter). Area: ui quest card position, avatar draw order at the staff spot.

## UI currency and shop pass (ui, 16 Nov)
- Done from TESTER RUN 1: 1 (panels and quest card start below the first-steps card via --ft-bottom; close X and Skip 44 px), 4 (Map badge grows left, card badge no shrink), 5 (HUD counters: first value instant), 9 quest card (shrinks to its seal after reading; hintBox.setCompact(true) for the coder to call when the avatar walks or outside the tavern).
- Not mine, seen: client/src/dungeon/dungeonView.ts ~line 660 has type errors (map undefined) in the working tree (someone's WIP); typecheck is red there.

## ICON-AUDIT (artist, 17 Nov)
Code icons audited next to their models (146 shape icons without PNG, 69 PNG icons). Wrong read, now redrawn as PNG (art-src/aseprite/icons_audit_r1.aseprite): wall_clock (was a sign), wall_mirror (orb), music_box (chest), pet_basket (box), dartboard (sign), antler_mount (bone), tap_stand (candle stand), bat_wing_fan (banner), dice_cup (plain mug), coat_rack (lamp post), spice_bundle (single leaf), iron_brazier (torch), mimic_tongue (red tag).
Checked and left (read fine): all fish, food bowls/plates, drinks, ores, bars, blocks, chairs/benches/tables/thrones, lamps, rugs, banners, crowns, rings. Weak but acceptable, redraw if time: window_curtains (banner shape), throne_piece (plain block), register (till box), cloth (pink slab), pearl_chandelier.
Not checked in the game: only icons next to code icons in a contact sheet, not in the real bag or catalog.

## TESTER RUN 2 (headless) 17 Nov, production build via vite preview, Chromium 1000x700 (phone 420x760 NOT rerun, see NOT SEEN). Specs: e2e/run2.spec.ts, e2e/hats.spec.ts (+ route.spec.ts). Screenshots: C:\Users\ajren\scratch-r2\shots (desktop-r2-*.png, desktop-hat-8*.png), hat montages C:\Users\ajren\scratch-r2\hats-*.png
Console: no errors, no 404s, no exceptions in the whole run.
PROVEN WORKING (state checked): stove Cook -> batch ready in ~20 s -> tap collects (roasted_turnip in bag, popup); barrel Brew root ale (brew saved, 5 turnips used); taps Load (tap 2 got 4 mugs); hold-pour end to end (guest tapped, avatar waits, hold on stand, release gives tray mug with perfect:true, delivered to the guest); prep table placed in the save and moved in build mode; planting 3 turnip seeds (plantedAt/readyAt set, 2 min = SEED_GROW_MS common, seeds 6 -> 3); Avatar panel Hat tab: Wear puts the cook cap on the preview AND the world avatar (hat bug of run 1 is fixed); 3 h offline (updatedAt shifted): guests stay on 2 open orders, 1 coin pile appears, no crash.
Findings, severity order:
1. MEDIUM, hats from behind: for hats that hide the hair (cook cap, straw, knight helm, wool, skull cap, miner lamp, tavern keeper) the head shows plain skin from the back (no hair-back, no hat back): reads as a bald bag. Also felt_cap/hood coif in walk-up and idle-up draws a big dark-green oval from head to waist (reads as a cloak, not a cap). Front view is fine (face and hat show). Area: avatar hat layer up-facing strips, hair hide rule. Shots: hats-up.png, hats-idle.png, desktop-hat-83-after-wear.png.
2. MEDIUM, first-steps card and orders strip overlap at the top: the order chips (2 to 3 mug chips) sit on top of the first-steps text ("Tap the brewi...tart a brew.") and on the Bar panel tabs. Area: ui/ordersStrip position vs hint card and panelShell. Shots: desktop-r2-30-taps-before.png, desktop-hat-81-hat-tab.png.
3. MEDIUM, toasts cover panels: the persistent toast ("The barrel turns crops into mugs...", "Drinks are poured from the taps...") overlaps the lower part of the Stove, Brewing and Taps panels (cut-off recipe rows) and the same intro toast text is still shown after changing room to the farm (stale, not cleared on room change). Shots: desktop-22-brew-panel (run route), desktop-r2-60-farm.png.
4. MEDIUM, farm: in two farm shots no soil patch and no planted turnips are visible (plants exist in the save at cells 2,2 to 4,2, 6 x 2 soil patch in the data); the screen showed plain grass with the avatar low in the frame at zoom 3. Not verified whether the soil is not drawn or the camera was off (my test turned Follow camera off and set a camera): please check by hand that soil and plants are drawn and the camera frames the soil. Shots: desktop-r2-61-farm-planted.png. Harvest NOT verified (api answered "walk" after my reload; the plant needs a hit from reach).
5. MEDIUM, kitchen tint: build mode on shows an orange screen border but no visible build grid and no kitchen tint around stove / prep table in desktop-r2-50-build-tint.png (maybe Settings grid is off by default, then tint hidden too: tint should show while placing regardless). Check the kitchen hint exists at all. Area: render/cellGrid.ts.
6. LOW, pour bar: the pour bar and its green window float at the avatar head, about 30 px above the mug/stand and over the avatar, not at the mug as the brief says. Shot: desktop-r2-41-pouring.png.
7. LOW, stove panel layout: the "-" and "+" steppers wrap to two lines (the "+" under the number); the long prep-table help text pushes the recipe list far down; only 1 recipe is visible without scrolling. Area: ui cooking panel CSS.
8. LOW, counter art and scale: the avatar standing at the bar is taller than the counter plus register (counter about 40 px high, avatar 54 px), so staff reads as standing on top of the bar and the register is as wide as the counter's 1/3. The register and tap stand look aligned with the counter top (ok). Round table, stools, barrel and stove read well and are consistent in scale. A prep table 2 cells wide placed 1 cell right of the stove overlaps it (my seeding, not a game bug: placing is checked by the game).
9. LOW, dungeon HUD: still the wide beige run-bag bar (12 slots) plus "0 / 0" counters with no clear Leave button (stairs only); lunch box counter shows 0 while a roasted turnip was in the bag (not equipped, but the slot gives no hint how to take it). The dungeon look itself (crypt tiles, torches, campfire) is good. Fight NOT tested (no enemy near the start, headless clicks only).
10. LOW, balance data: crops.json says turnip growMinutes 5 but planted turnip is ready after 2 min (SEED_GROW_MS common); one of them is stale text. Check the Book / plant tooltip.
11. LOW, "Nice, that is one more done." first-steps toast repeats on every unrelated action (bar panel, pour) while the card still says step 1/8 or 2/8.
12. LOW, test note, quest card: Quest card (100 gold hint) still opens over the top right panel area and the Map side badge ("2 orders") overlaps the Quest button; the badge text runs into the next icon.

### A. THINGS TO IMPROVE (ranked, most valuable first)
- [ui] Top of the screen is crowded: first-steps card, orders strip, quest card, panels fight for the same band. One stack with a fixed order (orders strip always visible, hint card below it, quest card collapsed to its seal) and panels that start below it.
- [ui] Toasts: short, one at a time, never over an open panel (put them above the hotbar only when no panel is open, else inside the panel header); clear stale tutorial toasts on room change.
- [artist] Make the bar the hero: the counter is small next to the avatar. Raise the counter and shelf, add mugs/bottles on the back wall behind it, a visible lit tap handle so the pour reads from across the room.
- [coder] Pour bar should anchor on the mug at the stand (and be big on a phone); show the perfect window larger the first 3 pours, then smaller.
- [ui] Stove and Brewing panels: show the ingredient icons with 0/2 counts in one row, a big Cook/Brew button, the help text collapsed behind a small "?" (now 5 lines before the first recipe).
- [coder] Tell the player what is wrong when a button is greyed (Cook/Brew disabled: "need 2 turnip": the red chips do it, but the button should say it too).
- [ui] Hat tab: 14 hats in a plain grid, locked ones are all unlocked in my test; show name under the icon on hover/long press and a lock overlay with the unlock hint.
- [coder] First-steps pacing: step 1 asks for a brew that needs crops the new player has not got (6 turnips? none): either give 2 turnips and a potato at start or point the first step to the farm.
- [artist] Avatar back views for hat layers (see finding 1) and a visible hair-under-hat rule.

### B. MISSING OR TO PRODUCE
- [artist] Soil/plant art check on the farm (rows, sprout/small/full turnip) and a visible farm fence/hedge frame so the farm does not read as an empty meadow.
- [artist] Cat (rules exist, not drawn), mug_shelf, banner, wall decor around the bar so the tavern is not a plain brown floor (floor is one flat tile pattern with no rug, no wall shadow).
- [artist] Guest variety: two seated guests look similar boxes-with-hair; add hats/aprons per guest type and a coin/heart reaction icon set.
- [artist] Dungeon enemies and chest art seen in a real fight (not checked), a Leave/stairs marker visible from afar.
- [coder] Sound: no audio at all was audible to test; pour glug, coin, cook ding, brew bubble, UI click (AU-1 not started).
- [ui] A Leave dungeon button (confirm: lose half the gold) and a clear "Go deeper / Leave" at the exit.
- [coder] Settings: a visible Build grid + kitchen tint toggle in the build toolbar, not only Settings.
- [ui] Cook panel: when the stove is busy show a progress bar and "ready in 12 s" on the stove itself (world-space bar over the stove, like the pour bar).

### C. MORE FUN / GAMEPLAY IDEAS (small, fit GATHER-MAKE-SERVE-EARN-BUILD-SHOW)
- [coder] Combo tips: serving 3 guests in a row with perfect pours gives a "Streak" bonus and a small sparkle; adds skill to SERVE and makes holding the tap matter.
- [coder] Dish pairing: a guest who gets a drink AND a dish orders again or tips a gem; links MAKE (stove + barrel) to EARN and rewards using both machines.
- [coder] Regular guest names and a favourite order shown above the seat; serve it right = bigger tip. Gives guests identity and a reason to stock variety.
- [coder] A daily/session "special": the board picks one dish at +20% price when on the menu; simple SERVE/EARN decision without timers pushing purchase.
- [artist][coder] SHOW: a Tavern sign you can paint (name + 3 symbols) and a "Take a photo" button that saves the room view as an image to share. Cheap SHOW for the One Inn idea.
- [coder] Farm: a hot streak "golden turnip" 1 in 20 plants that grows in half time and sells for 5x; adds a tiny surprise to GATHER.
- [coder] Dungeon: a lunch box choice before the door (take roasted turnip: +heal, take ale: +attack for 1 floor); links MAKE to the dungeon.
- [ui] "Closing report" popup when you leave the tavern for a while (guests served, gold, tips, best pour): clarity plus a reason to come back (offline catch-up now only silently adds 1 coin pile).

NOT SEEN: phone 420x760 pass for run 2 (only the 1000x700 desktop run was done), dungeon fight and the Leave flow, farm harvest, the Pour on touch, build rotate of the stove (rotate button click ran, result not inspected), wall decor, the lakeside after the new art. Test notes: world taps need ?e2e (window.__ph.worldToScreen) and the camera reset (Follow camera off); the intro toasts and the camera follow make blind taps unreliable.

## RUN 5 (headless) 17 Nov, main 4df64b3 + working tree, production build (own copy of dist, port 4182), Chromium desktop 1000x700 and phone 420x760 dpr 2. Specs: e2e/run5.spec.ts, e2e/run5b.spec.ts (config playwright.r5.config.ts; run3, run3b, run4, run4b kept from the earlier tester). Screenshots: C:\Users\ajren\PIXEL-HOTEL\test-results\{desktop,phone}-r5-*.png and r5b-*.png. Final runs: 0 console errors, 0 404s.
Test note: a first run showed a 404 on assets/browserAll-*.js and a dead game: another worker rebuilt client/dist during the run (shared dist). Not a game bug; run5 config now serves its own build copy.
1. (MED) Tutorial card text and counter disagree on desktop: card says "2/18 Click the register..." after the count moved to 3/18 (r5-12-stove-ready.png, r5b-02-stairs.png), while the same route on phone shows 3/18 "Tap the brewing barrel" (phone-r5-05-continued.png). Same as run 4 finding 2: the text does not follow the step on mouse.
2. (MED) Touch size: the OPEN/CLOSED sign is 69x30 px (rule: 44 px), the tutorial Skip button 48x36 (phone and desktop). The sign works (click toggles tavern.closed, label OPEN/CLOSED, screenshot phone-r5-07-closed.png).
3. (MED) Catalog search is per tab: on the Chairs tab "extension" gives "Nothing matches" and "0 of 19" (phone-r5-20-catalog-search.png), though Bar extension (category shop_furniture) exists in the Tavern tab. Search should cover all tabs or the empty state should say "try the other tabs".
4. (LOW) Toast "Tap a soil cell or a block to plant" floats over the open Book panel on phone (phone-r5-51-book-splice.png); a toast should not cover a panel.
5. (LOW) Farm: a tap on soil cell (2,2) with turnip seeds selected did not plant in 4 s (getFarm growing 0, free 12; desktop-r5b-10-planted.png shows no soil visible near the avatar, plain grass with grid lines). Could be avatar still walking or my cell; the splice dialog therefore NOT SEEN. Please check by hand: plant, then tap with potato seeds.
6. (LOW) Settings panel on phone is 3 screens tall (Look/Save/Testing groups, y up to 1418 on a 760 screen): scroll works but the New game button sits at the very end next to Debug. Not clipped, only long.
7. (LOW) Book Splice tab: 91 cards, all "??? Not found yet" with three grey ovals (phone-r5-51-book-splice.png); reads fine, header "0 / 91 found, Whole book 2%" and reward badges OK. No hint how to find the first one.
8. (INFO) Stove ready (r5-12-stove-ready.png, 27 s after startCook) shows a faint dish glow on the stove top; barrel after startBrew shows no change within 3 s. Compared to idle the difference is small: owner to judge OA-5 on the screenshots r5-10, r5-11, r5-12 (desktop and phone).
9. (INFO) Tutorial works: new game starts it at "2/18" with one pointer (r5-01), walking advances it, Continue resumes at the same step (3/18 on phone) with a fade-in. Orders strip chips appear (data-state waiting/urgent), counter_ext: buy (3000 -> gold drops, item uid in bag), placement only valid touching the counter (placed at 144,96 next to the counter at 80,96; far spot refused null), wall item banner at (200,-40) placed, other y values refused (null) as the 64 px band allows.
OK / seen: phone HUD (r5-05, r5-20): no offscreen buttons, side column 48 px, orders pill and quest pill fit; camera follow keeps the avatar at the screen centre in 3 of 3 checks except after the avatar walks south (avatar screen y 548 / 580 vs centre 380 / 350: room clamp at the south wall, probably fine).
NOT SEEN: ST3 stairs (api placeBlock only returns a walk plan out of reach, so no stack was built; tap walk onto 1-2-3 steps and the 3-high wall refusal not verified), farm splice dialog and splice result, round-table plates while eating, pour bar over the avatar (covered in run4 only), phone pour by touch, phone farm.
