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
