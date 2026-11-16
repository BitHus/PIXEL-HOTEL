# STATUS: where we are in the roadmap (the manager rewrites this after EVERY batch; read it first, 40 lines max)

Updated 2026-11-16 late (SG3b/c content + R6 kitchen set pushed; artist redrawing the starting tavern set RUNNING; tester RUNNING incl. hat bug).

## Vision check (rewrite each batch): the loop is GATHER -> MAKE -> SERVE -> EARN -> BUILD -> SHOW. Works in code: all steps. Weakest link now: nobody has played it in a browser yet (tester running), the tavern needs life (animation done v1), long-term goals (renown, questline) missing. Bugs and small events may jump the queue; return to this line afterwards.

## Roadmap position
- A CORE FEEL: in progress. Done: hands-on pour, tray, orders strip, first-ten-minutes, UI rounds 1-5, outdoors rework, art R1-R5 (furniture), avatar layers incl. outer pieces, idle/eat/wave/blink strips v1. Open: CH1 DONE (needs a look in the real game: head offsets of idle/eat/wave are guesses), smoothness pass (FIXLIST), first real browser playtest (tester RUNNING), remaining icons, furniture R6 kitchen set, cat drawn + tap lever wiring.
- B BLOCK WORLD DEEP: DG1 layout done, DG2 view done, SG1/SG2/SG4 done, SG3a done (12 blocks). Next: SG3b-d content (crops, drinks, furniture, clothes, styles, specials), SG4b plant tap wiring, SG5 splice preview dialog + Book tab, DG3/DG4 polish and tuning (700 ms bot +15% to look at), DG5 traps only after owner OK.
- C TAVERN DEEP: not started (RN-1 renown, RG-1 regulars, GT-1/NC-1 tastes and guest types, BD-1 board with 9i questline, cleaning, closing report).
- D IDENTITY: avatar style lock open (owner), wardrobe/NPC outfits next, suite showcase, room stars exist.
- E WORLD, F ONLINE: later (step 10 server is a placeholder; online only with owner go).

## Right now (workers)
tester (TESTER RUN 2 -> docs/FIXLIST.md). Animator and artist idle (one Aseprite worker at a time).

## Next up, in this order
1. Tester findings -> coder fix list (severity order).  2. Artist: R6 kitchen set, missing icons, props art (gem_pile, brazier, sarcophagus_small), better eat/wave hands (animator).  3. Coder: SG3b-d, SG4b, SG5.  4. UI worker: UI round 6 from tester findings, hat tab.  5. Coder: GT-1/NC-1/RN-1 tavern depth, 9i questline.  6. Mine/dungeon round 2 only after simulate shows no source over 50%.

## Owner decisions open
Avatar style lock; pushing (allowed for green batches today only, 16 Nov); big tools/plugins need a look first; ranked block values are low (balance floor) - owner may want a bigger rank gap; DG5 traps; dungeon round 2 on.

## Last push: SG3b/c content (8 crops, 10 dishes, 6 drinks, 14 furniture, seeds), R6 kitchen set and dungeon props, check-palette tool. Owner priorities open: starting furniture models and scale (round table, keg, stool, counter), hat not shown when equipped.
