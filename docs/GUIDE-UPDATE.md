# GUIDE UPDATE CHECKLIST (ONBOARD-1)

The first-steps guide is data. When a feature in the first ten minutes changes, update its step in the same batch.

## Where things live
- `shared/data/guide.json`: one entry per step: `id`, `target` (what the animated pointer sits on), `text` (the card line).
- `shared/src/firstTen.ts`: pure logic (goal order, waiting steps, auto events, pointer kind, replay). Tests: `shared/src/firstTen.test.ts`.
- `client/src/game/guideWorld.ts`: fills the world context, sends the steps the world proves (walk, stove, farm, build, dungeon), moves the pointer and draws the ready dots.
- `client/src/ui/firstTenGuide.ts` (card), `client/src/ui/guidePointer.ts` + `guide.css` (pointer).
- Events from game code: `guide.event('<id>')` in `client/src/game/tavernLife.ts` (menu, pour, serve, coins, barrel, collect, load).

## CEL-3 (kitchen and cellar steps)
- New steps `kitchen` (target `door` tavern_to_kitchen; ticks when the kitchen room opens, guideAutoEvents `inKitchen`) before `barrel`, and `cellar` after `load` (target `door` tavern_to_cellar; waits until the cellar is built, `GuideContext.cellarBuilt`; ticks on filling a cask, never on waiting). `barrel`, `collect` and `stove` texts say "in the kitchen"; `load` says "Back in the tavern".
- Target kind `door` = an Inn door of the room on screen by id. A `furniture` or `stand` target that stands in another room of the tavern area makes guideWorld.ts point at the door that leads there (routeDoor), in the tavern and back again from the kitchen or cellar.
- The stove step's supplies top-up (api.ensureTutorialCookSupplies) is room independent and unchanged.

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

## A1 (19 Nov): blockers and panel pointer
- guide.json `fixes`: a step that cannot be done because of what the player owns shows the fix text and points at the fix (guideBlocker in firstTen.ts; stock from shared/src/guideStock.ts, filled in guideWorld.ts every 250 ms). A new step with an ingredient, mug or gold need = a case in guideBlocker, a fix (or reuse one) and a test.
- The pointer moves INTO an open panel (guideWorld.panelTarget): add a selector there when a step gets a new panel action.
