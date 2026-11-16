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
