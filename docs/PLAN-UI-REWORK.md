# PLAN-UI-REWORK: fewer cream blocks (UIR)

Owner (18 Nov): "the whole UI also needs a rework, other games don't have those cream blocks everywhere." Today almost every panel, button, card and chip is a parchment block with an oak frame and iron corner plates (PLAN-UI.md rounds 1-4 made `.frame` heavier on purpose). Result: heavy, samey, no hierarchy. This plan changes SKIN and which things get a box at all. Placement rules (CLAUDE.md UI LAYOUT, INPUT, UI-REFERENCE.md sections 1-2) stay. Original design only; nothing below copies a game's art, layout or icons.

Research note: web search gave little game-specific text (Travellers Rest and Stardew devlogs are not indexed). Used: the Derby Creek devlog (diegetic wooden HUD: time as a porthole, day as a hanging tag, framed pieces as plaques), general HUD-minimalism guides (hierarchy, consistent style, fewer permanent elements, ~40% translucent panels so the world stays readable), plus the owner's reference games from our own docs (RESEARCH-GAMES.md, UI-REFERENCE.md). Claims about other games below are general design knowledge, marked (known), not verified quotes.

## 1. What the good ones do, and what applies to us

1. HUD = icons and numbers, no boxes (known: Stardew's clock/gold sit on one small plate, but its tool bar and meters are bare; Dave the Diver, Cozy Grove and Dreamlight put a coin or bar straight on the world with a dark outline or soft shadow). APPLY: gold, xp, hp, lantern, room name = icon + number + outline text on the world, no frame. Readability comes from a 1 px dark outline/shadow, not a block.
2. Frames only for MODAL or HEAVY content (known: inventory, crafting and shop screens are the only big framed things; a Potion Craft or Spiritfarer menu is a page you open, not a permanent strip). APPLY: the frame is rationed to panels that cover the room (Bag, Catalog, Room, Settings, Book, confirm). Anything permanent loses its frame.
3. Hierarchy by SIZE and POSITION, not by box (known: one big number, small labels). APPLY: gold 2x bigger than the room name; the one primary action per screen is big and candle gold, everything else is plain text or a ghost button.
4. ONE accent colour (known: most cosy UIs use a single warm accent for "this is selected / act here"). APPLY: candle #feae34 is the only accent; ember #f77622 only for warnings/badges, green #63c74d only for "ready". Rank colours stay on item borders/names only.
5. Dark translucent or wood-textured surfaces instead of cream (known: the cream page is rare in cosy games; night-coloured or wood panels let light-coloured art and text pop, and read as part of a lit tavern). APPLY: panels become dark warm wood/plum (#3e2731 / #262b44 family) with cream text; cream survives only as small inset "paper" for long reading text (Book entries, quest text).
6. Layered depth, not outlines (known). APPLY: three layers only: world, HUD (no box), panel (dark, 1 outline + 1 lit top edge, soft drop shadow). No iron corners, no double hairlines, no ribbons on every title.
7. Diegetic / world-anchored info (Derby Creek, Travellers Rest style order marks, we already did the hanging OPEN/CLOSED sign and the ticket rail). APPLY: more of that: tavern appeal as a small hanging plaque, taps and stove show their own status over themselves (ready steam, mug count), guests carry the order marker, doors show a label on hover/near. Prefer a prop to a panel when the info belongs to one thing.
8. Context-sensitive prompts instead of permanent buttons (known: "A: use" bubbles in Stardew-likes, Graveyard Keeper action wheel). APPLY: near-item prompt chip (icon + verb) next to the thing; the right column shrinks to what is always useful.
9. Icon-first buttons, labels only on wide screens or on long-press/hover (UI-REFERENCE already says this; keep) and round or plain-icon buttons with a dark disc, not a cream square.
10. Tabs and bag patterns: tabs as a row of icons on the panel top, no frame per tab; the bag as a grid of dark recessed cells; numbers bottom-right with outline. Cells keep a rank border.
11. Context-light dialogs: confirm is a small dark card over a dim scrim with a big item and ONE gold button.
12. Motion: stepped, short, off with prefers-reduced-motion (we already have this; keep).

Principle for every future screen: "Does this need a box? If it is info about the world or the player: no. If it hides the room: yes, dark panel."

## 2. Audit of our screens

Legend: KEEP, DEFRAME (drop the box, keep content), DARKEN (panel stays, cream to dark), WORLD (move info onto a prop/world prompt).

| Screen | Today | Verdict |
|---|---|---|
| Title / splash | Logo on dark plum; title screen is buttons | KEEP the logo splash. Title buttons: ghost/plain text on the dark screen, one gold Continue. |
| Info panel (top-left) | Framed plate: coin+gold, room, level, xp bar | DEFRAME. Gold icon + big number, room name small under it, xp as a thin 3 px bar, all outline text. Hp and lantern bars in runs likewise bare. |
| Right button column | Cream/wood square buttons 48 px | DEFRAME to icon on a small dark round disc (translucent), selected = candle ring. Badges stay as dots. More grid becomes a dark small panel. |
| Hotbar + Bag | Framed strip, cream slots | DARKEN cells (recessed dark, thin rank border), no outer frame, selected = candle outline + name label above. The Bag button is the last cell, a satchel icon. Count digits outlined. |
| Bar panel (Serve/Menu/Sell) | Large framed cream card, rows of cards | DARKEN. Rows become flat lines on one dark panel (icon, name, price stepper, toggle), no card per row; dividers 1 px. Primary only on Sell all/Serve. |
| Catalog | Cream cards with price | DARKEN. Grid of icon tiles (no frame), price as small gold-coin text under the icon; tap = confirm card. Tabs icon-only. |
| Build menu / place bar | Framed popups | WORLD/DEFRAME. Place bar: floating dark pill near the item (Rotate, Pick up, Done icons). Grid faint. |
| Room panel | Frame with cards (Open, Build cellar, Paint) | DARKEN; cards become list rows with an icon and a chevron. |
| Quests / first-steps card | Cream card, pointer | DEFRAME the card to a dark small chip with the one task line and a progress dot row; keep the animated pointer (that is the real guide). Quests list = DARKEN panel. |
| Settings | Long cream list | DARKEN, grouped with small caps headers, real switches, no ribbon titles. |
| Book | Cream grid, silhouettes | DARKEN panel, cream only inside a small "page" for the selected entry. |
| Run HUD (dungeon) | Framed bars, run bag, potion button | DEFRAME bars; run bag cells like hotbar; potion/food = round icon buttons with count. |
| confirmBuy and dialogs | Centered cream card | DARKEN: dim scrim, dark card, big item, one gold primary, Cancel as text. |
| Toasts | Plain box | DEFRAME: icon + text line with outline, slide from the left, rank colour on the icon only. |
| Orders strip (ticket rail), OPEN sign, order markers, pour bar | Already diegetic | KEEP as is; the model for the rest. |
| Chat bubbles | Cream pills | KEEP cream here (they are speech, inside the world, small). |
| Pickers (character maker, shapes) | Orange/cream pages | DARKEN last; tiles show the result, keep. |

Things that must NOT change: positions (edges, hotbar bottom-centre, panels end above the hotbar), 44 px touch targets, one panel at a time, `ui/panelShell.ts` structure, confirm-before-buy, texts at reading pace, no new font-family without var(--font).

## 3. Three style directions (choose one)

Shared tokens (all Endesga 32, hex list lives in shared/palette.ts; the CSS uses names):
- ink `#181425` (text outline, deepest), plum `#3e2731` (current --outline), night `#262b44`, slate `#3a4466`
- wood `#733e39`, wood-light `#b86f50`, parchment `#ead4aa` (inset paper only), butter `#fee761`, candle `#feae34`, ember `#f77622`, ok-green `#63c74d`, no-red `#a22633`

### A. "Lantern Dark" (translucent night panels) - RECOMMENDED
Feel: a tavern at night, UI like lit signs and a dark slate board. Lightest on the eye, makes the cosy world art the brightest thing, and the least work (most files only change tokens).
- HUD: no frame. Icon + number, text cream `#ead4aa`/butter with 1 px ink outline and 1 px drop. Buttons: 44 px dark disc `rgba(24,20,37,.62)`, 1 px ink ring, icon cream; selected: candle ring + candle icon.
- Panel: fill night `#262b44` at 92% (world faintly visible), 1 px ink outline, 1 px lit top edge `#3a4466`, drop shadow `0 3px 0 ink@55%`, corner radius 0 (pixel). Title: plain butter text 1.25x, a 1 px candle line under it. No ribbon, no iron.
- Rows: no per-row card; 44 px row, 1 px `#3a4466` divider. Cells: recessed ink `#181425` with a `#3a4466` inner top edge; rank colour border.
- Buttons: secondary = text + 1 px slate outline (ghost); primary = candle fill, ink text, one per screen; danger = no-red.
```
 HUD (no frame)                       Bar panel (dark, 92%)
  (o) 1,240   <- big, outline          +--------------------------+
  Anna's Tavern  Lv3 ======-- 3px      | Serve   Menu   Sell      |  <- icon tabs, candle cap on open
                                       |--------------------------|
   (o)=  (o)=  (o)=   dark discs       | [ale]  Root ale   12  - 8g +  (o)on |
                                       | [ale]  Dark ale    4  - 12g + (o)on |
 [slot][slot][slot][slot][bag]         |--------------------------|
   hotbar: dark cells, no frame        |          [ Sell all ]    |  <- one gold primary
                                       +--------------------------+
```
### B. "Oak Board" (wood, nailed, still warm)
Feel: Travellers-Rest-like carved wood, closer to today but with the cream removed. Panels are wood planks `#733e39` with a lighter top edge `#b86f50` and a dark ink outline, nails as 2 px dots only on modal panels (not iron plates). Text cream/butter. Slots: recessed dark wood. HUD: frameless as in A, but buttons are small wood discs. More tactile, more "game-y", heavier than A; more art work (plank texture tiles, 9-slice sprites).
```
 +==o=========================o==+   plank panel, wood-light top edge,
 | Menu  (wood title text, butter) |   nails only at 2 corners, no ribbon
 |  [ale] Root ale  12   - 8 +  (o)|   rows: darker wood inset strips
 |             [ Sell all ]        |
 +==============================---+
```
### C. "Paper Notes" (light but sparse)
Feel: keep a light parchment look but only for small notes: no outer frames or corner plates at all; a panel is a single flat parchment sheet with a 1 px plum outline and a torn/stepped bottom edge; HUD frameless; everything else dark discs. Lowest risk to the current identity, but still "cream blocks" for every panel, so it only half answers the owner. Not recommended.
```
 +--------------------------+   flat parchment, 1 px plum outline,
 | Menu                     |   shadow only; stepped lower edge
 | Root ale     12  8g      |
 | [ Sell all ]            ~~
```
RECOMMENDATION: A, with one B touch: the Catalog and Room panels may use a thin wood top "rail" (a 6 px plank strip with the title) so the shop feels crafted. Parchment only inside Book and Quest reading areas. Hotbar/info/buttons exactly as in A.

## 4. Build order (small tasks; each one ends with npm test, typecheck, a look at 1000x700 and 420x760, NEWS line)

General NOT-to-do for all: no layout/position changes, no new game rules, no change to ids/classes JS depends on (change CSS only where possible), no new font-family, no gradients except the existing stepped trick, no photo or copied art, no deleting `.frame` before every user is moved off it.

- UIR-0 (owner): pick the direction; take one screenshot set (title, room, Bag open, Bar panel, Catalog) before and after as the reference. Files: none.
- UIR-1 TOKENS: in client/src/ui/skin.css add `--ui-bg`, `--ui-bg-solid`, `--ui-line`, `--ui-lit`, `--ui-text`, `--ui-accent`, `--ui-ok`, `--ui-danger`, `--ui-hud-text-shadow` (value per chosen direction), and a new class pair `.panel` (dark panel) and `.hud` (frameless text) NEXT TO `.frame` (do not edit `.frame` yet). Gate: no visual change on screen; css lint ok; unused-token check. NOT: touching ui.css selectors, JS.
- UIR-2 HUD: infoPanel.ts + hp/lantern bars, ui.css/skin.css: drop the frame, big gold, outline text, thin xp bar; run HUD bars. Gate: gold readable on the lightest floors and in the dark crypt (contrast check, 4.5:1 vs worst sampled background using outline); e2e info panel selectors still match. NOT: moving it, hiding xp numbers tooltip.
- UIR-3 BUTTON COLUMN + HOTBAR: sideButtons.ts, hotbar styles: dark discs, candle selected ring, dark recessed slots, no outer hotbar frame, selected-item name. Gate: touch 44 px, badge dots visible, Bag button still attached to the hotbar, rank borders intact, 360x740 does not overlap. NOT: changing the More grid behaviour.
- UIR-4 TOASTS + FIRST-STEPS CHIP + CHIPS: toasts frameless icon lines; first-steps card as a dark chip (keep pointer and guide.json); quest card. Gate: toasts above hotbar, reading time unchanged, card off the back-wall doors (RUN 6 fix kept). NOT: touching the ticket rail, OPEN sign, order markers.
- UIR-5 PANEL SHELL: ui/panelShell.ts + `.frame` panels switch to `.panel` through one change in skin.css (override `.frame` inside panelShell to the new look, no per-panel edits yet); plain title, icon tabs with candle cap, round close disc. Gate: every panel still opens (e2e smoke), scroll area ends above the hotbar. NOT: changing panel content.
- UIR-6 BAR PANEL + CATALOG: menuPanel/serve/sell rows to flat 44 px rows with dividers; catalog icon tiles, price under icon. Gate: Sell confirm thresholds unchanged, all rows 44 px, long names ellipsize. NOT: changing any price, rule or GameAPI call.
- UIR-7 ROOM / BUILD / PLACE BAR: roomPanel cards to rows, floating place bar as a dark pill. Gate: place/rotate/pick up still work by touch; grid toggle. NOT: build rules.
- UIR-8 BAG, BOOK, QUESTS, SETTINGS: dark panels, parchment only as the Book entry page and Quest text inset, grouped settings with switches. Gate: readability of rank colours (gold name needs outline on dark: fine), Book New! plates. NOT: Book data.
- UIR-9 DIALOGS: confirmBuy and run summaries: scrim, dark card, big item, one gold primary, text Cancel. Gate: every buy still asks; Escape closes. NOT: skipping a confirm.
- UIR-10 PICKERS + TITLE: character maker, shape pickers, title screen buttons. Gate: tiles still show the result. NOT: logic.
- UIR-11 CLEANUP: remove dead `.frame` iron-plate CSS, update UI-REFERENCE.md and PLAN-UI.md (mark superseded), CLAUDE.md UI LAYOUT one line ("no frames on permanent HUD"), e2e screenshots refreshed. Gate: grep shows no remaining use of old classes.
Tasks 2-4 can run in parallel only on different files; 5 before 6-10.

## 5. Owner decisions

1. Direction: A Lantern Dark (recommended), B Oak Board, or C Paper Notes?
2. Is cream parchment still wanted anywhere (Book page, quest text, chat bubbles)? Recommended: yes, small insets only.
3. HUD with no box at all (outline text) OK, or keep one soft translucent plate behind gold only on very bright floors?
4. Buttons: round dark discs (A) or small wood squares (B)?
5. Panel translucency 92% (world faintly visible) or solid?
6. Allow a 9-slice sprite frame (Aseprite, docs/PLAN-SPRITES.md) for the modal panel later, or stay pure CSS?
7. Approve moving more info onto props (appeal plaque, stove/tap status) as UIR-12+ ideas, separate from this plan?
8. Character maker and title screen last (UIR-10), or earlier because they are the first impression?
