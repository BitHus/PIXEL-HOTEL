# GUIDE UPDATE CHECKLIST (ONBOARD-1)

The first-steps guide is data. When a feature in the first ten minutes changes, update its step in the same batch.

## Where things live
- `shared/data/guide.json`: one entry per step: `id`, `target` (what the animated pointer sits on), `text` (the card line).
- `shared/src/firstTen.ts`: pure logic (goal order, waiting steps, auto events, pointer kind, replay). Tests: `shared/src/firstTen.test.ts`.
- `client/src/game/guideWorld.ts`: fills the world context, sends the steps the world proves (walk, stove, farm, build, dungeon), moves the pointer and draws the ready dots.
- `client/src/ui/firstTenGuide.ts` (card), `client/src/ui/guidePointer.ts` + `guide.css` (pointer).
- Events from game code: `guide.event('<id>')` in `client/src/game/tavernLife.ts` (menu, pour, serve, coins, barrel, collect, load).

## Target kinds (guide.json `target`)
`furniture` (typeId: the first one in the tavern), `guest` (a seated guest with an open order; the one the tray can serve first), `stand` (the tap stand while the avatar waits to pour, else a waiting guest), `coins` (coins on a table), `ui` (a button whose aria-label starts with `label`), `floor` (a spot beside the avatar), `none`.

## Text
- Write `{Tap}`, `{tap}`, `{hold}`: they become Tap/Click, tap/click, "hold your finger on" / "hold the mouse button on". Never write click or finger by hand (a test checks it).
- At most 120 characters, tavern words only, never "inn".

## When you change...
| Change | Update |
|---|---|
| a furniture id (register, tap_stand, brewing_barrel, stove) | `target.typeId` of its steps |
| a button name in the side column (Worlds, Build, Dungeon) | `target.label` (must match the start of its aria-label) |
| pouring, serving or coin rules | texts of pour, serve, coins and the events in tavernLife.ts |
| a new first-ten step | add it to guide.json in order, an event or an auto event, a test line, this table |
| the first guest timing (FIRST_GUEST_DELAY_MS) | the "first coin within 90 s" test in firstTen.test.ts |

## Check
`npx vitest run shared/src/firstTen.test.ts`, then `npx playwright test e2e/guide.spec.ts` (card text, pointer on the register, no console errors). Settings > "Replay the first steps" starts the guide again.

## TUT-2
Steps now: walk, menu, pour, serve, coins, barrel, collect, load, stove, farm, plant, harvest, build, wall, dungeon, mine, lakeside, fish. Events plant/harvest/wall/fish come from late.guideEvent (blockInput, placing, lakesideScreen onCaught); farm, mine, lakeside, dungeon are proven by the world poll. A new game always starts (firstTenOpen); nothing stored = starts.

TUT-2 part 3: the Quest button and card never show while the tutorial runs (holdQuest in tavernLife.ts hides both); afterwards the button opens the Quest panel (daily, events, achievements). Pointers: outside the tavern a tavern step points at the Worlds button; harvest points at a ripe plant on the farm, fish at the lake water. No guide.json change.
