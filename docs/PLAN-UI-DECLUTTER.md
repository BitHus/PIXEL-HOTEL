# PLAN-UI-DECLUTTER: the UI is still too busy (owner, 18 Nov)

Docs only, no code. Based on r9-shots/desktop-04, r8-shots/desktop-D-barpanel, r8-shots/phone-C-02, client/src/ui/sideButtons.ts, PLAN-UI-REWORK.md (frames and cream are already gone: Lantern Dark is done) and MP-2 (docs/STATUS.md: fewer screens, in-world taps over panels). The skin is no longer the problem; the COUNT of things is.

## 1. Inventory of permanent elements (nothing open, a guest in the room)

| Element | Desktop 1000x700 | Phone 420x760 |
|---|---|---|
| Info panel (tavern name, gold, gems, room + Lv, xp bar) | 5 items | 4 items |
| OPEN sign (hanging) | 1 | 1 (about 170 px wide in the shot) |
| First-steps card (title, count badge, 4 text lines, Skip, dots) | 1 card, 6 parts | 1 chip |
| Side column (Worlds, Catalog, Build, Dungeon, Workshop, Book, Skills, Room, Avatar, Chat, Settings, Emote) | 12 buttons | 4 + More = 5, each with a text label |
| Badges (Dungeon key count 10, Book red dot) | 2 | 2 |
| Hotbar (6 slots + Bag) | 7 | 7 |
| Active-drink / pour button, bottom-left | 1 | 1 (about 64 px frame) |
| Orders rail (one chip per open order) | 0 to 3 | 0 to 3 |
| Name tag, chat pill, order markers | 2 to 4 | 2 to 4 |
| Transient: tavern welcome hint text, toasts | 1 to 2 | 1 to 2 |
| TOTAL visible | about 31 | about 24 |

Inside panels: the Bar panel (r8 desktop-D-barpanel) has 2 tabs, a title, an explanation paragraph and per row about 14 items (name, stock bar, 2 sentences, stepper with 3 controls, toggle, mood face, price verdict, "Nobody paid for it yet"). It is the busiest single screen.

## 2. Ranked changes (S small / M medium / L large effort)

| # | Change | Kind | Where | Owner-visible benefit | Effort |
|---|---|---|---|---|---|
| 1 | Side column 12 -> 4 buttons: keep Catalog, Build, Dungeon, More. Worlds, Workshop, Book, Skills, Room, Avatar, Chat, Settings, Emote go into the More grid (phone already does this) | MERGE | desktop | calm right edge, one layout on both sizes | S |
| 2 | First-steps card only after 4 s idle (no walk, no panel), ONE line + dots, no title or count badge; Skip by long-press or x; hidden while walking or a panel is open | HIDE | both | the guide stops sitting on the room, still there when needed | M |
| 3 | HUD auto-fade while walking or in the dungeon: info, side buttons, hotbar to 25% after 3 s without a tap; back on a tap or a change (gold, toast) | HIDE | both | the room fills the screen while you move; best "less busy" gain per cost | M |
| 4 | Info panel to one line: coin + gold, gem + gems; tavern name, level, xp only in Room/Settings (or a 3 px xp bar); room name as a 2 s toast on entering | SHRINK | both | 5 items -> 2 | S |
| 5 | Bar panel rows: icon, name, stepper, toggle (4 controls). Explanation, mood face and "Nobody paid" only for the focused row or on long-press; stock bar becomes a number | REMOVE/HIDE | both | the busiest panel reads at a glance | M |
| 6 | OPEN sign 60 x 28 px on phone, no house icon, hidden while a panel is open; desktop 80% scale | SHRINK | phone mostly | stops covering a fifth of the phone width | S |
| 7 | Hotbar shows only filled slots + Bag; empty dashed slots only while placing, in build mode, or with the bag open | HIDE | both | empty bottom edge most of the time (7 -> 1 to 3) | S/M |
| 8 | Active-drink button: 44 px, no frame, only while a pour is waiting (today always, 64 px on phone) | HIDE | both | one big brown block gone | S |
| 9 | Badges: one red dot on More for anything new (Book, Skills, quests); the Dungeon key count moves into the Dungeon confirm | MERGE | both | 2 -> 1 | S |
| 10 | Remove the text labels under the phone side icons; long-press shows the tooltip | REMOVE | phone | column shrinks to 4 x 44 px, stops reaching into the room | S |
| 11 | Panel tabs: max 3 per panel, icon-only (Bar Serve+Menu, Quests, Room, Settings groups) | MERGE | both | fewer control rows in panels | M |
| 12 | Tavern welcome hint (bottom-left) duplicates the first-steps card: keep one, the world pointer is the guide | REMOVE | both | one text block less | S |
| 13 | Appeal, room name, level as world props (hanging plaque by the door), MP-2 | WORLD | both | no HUD cost; later | L |

Proposed rule for CLAUDE.md UI LAYOUT after owner OK: at most 8 permanent elements with nothing open or selected; the rest fades, hides until needed, or lives in More.

TOP 5 (in this order): 1 side column to 4 buttons; 3 HUD fade while walking; 2 first-steps card idle-only and one line; 4 one-line info panel; 5 Bar panel rows with 4 controls. Then 6, 7, 8, 10.

## 3. Target layout

Desktop 1000x700, 8 permanent (gold, gems, OPEN, Catalog, Build, Dungeon, More, hotbar+Bag; the 3 px xp bar is passive):
```
+--------------------------------------------------------------+
| (c)100 (g)0                                 [OPEN]   (Cat)   |
|                                                      (Bld)   |
|            orders rail (only with guests)            (Dng)  |
|                                                      (...)   |
|                       the room                               |
|    guide ONE line (only when idle)                           |
| (drink, only while pouring)      [1][2][ ]  [Bag]            |
+--------------------------------------------------------------+
```
Phone 420x760, 7 permanent:
```
+------------------------------------+
| (c)100 (g)0     [OPEN]      (Cat)  |
|                             (Bld)  |   icons only, 44 px, no labels
|                             (Dng)  |
|                             (...)  |   red dot = something new
|      room, avatar centred          |
|  guide line (idle only)            |
|  (drink)   [1][2][3]    [Bag]      |   filled slots only
+------------------------------------+
```
Thumb zone = bottom row and right edge; the top-left holds only the one-line info.

## 4. Art: PixelLab or CSS only

CSS/TS only: every change in section 2 (counts, fades, hiding, sizes, rows, tabs, badges). Nothing here waits for art.
Worth PixelLab later, not blocking:
- 9-slice panel frame (create_ui_asset, 24 px corner, night plum, lit top edge): replaces CSS borders; looks better, no declutter effect.
- Round button disc with 3 states (normal, pressed, selected candle ring): create_ui_states.
- A small "More" dots icon that fits the disc (the 8 icons moving into More are already drawn).
- OPEN/CLOSED sign small variant 60 x 28, 2 states: CSS scaling blurs the pixel text, so a drawn small one is better.

## 5. Order of work and checks
1. S batch (1, 4, 6, 8, 9, 10, 12), then screenshots at 1000x700 and 420x760 (npm run e2e), compare with r8/r9 shots.
2. M batch (2, 3, 5, 7, 11). The fade must never hide an open panel, a toast or the pour bar; keep 44 px targets; respect prefers-reduced-motion.
3. Count check: an e2e assertion counting visible HUD nodes (data-hud) with nothing open stays at 8 or fewer.
Files (ui): sideButtons.ts, infoPanel.ts, firstTenGuide.ts + guide.css, hotbar.ts, menuPanel.ts, layout.ts, lantern.css. Coder hook: idle timer for the guide and the HUD fade (game/uiShell.ts); guide.json lines stay.
