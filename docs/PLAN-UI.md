# PLAN-UI: the medieval UI pass

Owner (16 Nov): the UI is very poor and boring: the character maker, icons, panels. Target: a warm medieval inn (docs/ART-STYLE.md MEDIEVAL DIRECTION), clear hierarchy, big touch targets. Layout rules stay (CLAUDE.md UI LAYOUT, INPUT, docs/UI-REFERENCE.md); this plan changes SKIN and content design, not placement.

## Target look (one language for every screen)
- FRAME: oak (outline, wood, lit top-left edge) around parchment, with IRON CORNER PLATES (5 px, one rivet pixel) and a candle-gold hairline just inside the wood. Done once on `.frame` (client/src/ui/skin.css), so every panel gets it.
- TITLES: a wood ribbon, butter-yellow text with a dark drop line and a candle underline (not a flat brown bar).
- BUTTONS: raised wood (existing); ONE primary per screen in candle gold (`.btn.primary`); danger in crimson (`.btn.danger`).
- TABS: icon tabs on the frame edge; the open one is candle orange with a butter cap and its name.
- SLOTS: cream recessed cells on a wood tray (existing), rank colour on the border.
- BARS: `.skin-bar` (+ `.hp`, `.xp`, `.lantern`): dark trough, wood rim, lit fill edge.
- PICK BY LOOKING: wherever the player chooses a look, a tile shows the result, not a word.
- ICONS: pixel icons are 12 x 12 maps in pixelIcons.ts; every tab and button has one; missing ones are drawn (the Hat tab had the hair icon).
- COLOURS: Endesga 32 only; text dark brown on parchment, cream or butter on wood; no modern grey or blue.
- MOTION: stepped (steps()) and short; prefers-reduced-motion switches it off.

## Audit per screen (before this pass)
1. CHARACTER CREATION: a flat orange box with a small avatar; styles chosen with two arrows and a text plate (no preview of the choice); swatches 44 px squares with a thin border; name and inn name as bare stacked inputs; Done is a plain button; the hat tab used the hair icon. Nothing says "your story starts here".
2. AVATAR PANEL: same arrow stepper, a small flat preview; hats browsed one by one by arrows with a silhouette; looks like a settings form.
3. HOTBAR: functional, but the frame is generic; no label of the selected item except tooltip; empty slots look identical to filled. Needs: the iron-corner frame, a selected-item name plate above the slot, a clearer empty slot.
4. BAG: a grid of slots; weak hierarchy between the hotbar row and the storage grid; Sort/Stack strip fine. Needs: section ribbons ("Hotbar", "Storage"), capacity counter, rank-sorted tint.
5. CATALOG: cards are plain parchment with a price; no category art, no "new" or affordability hierarchy beyond red text. Needs: tab icons per furniture class, a price tag shape (a wooden hang tag), a big preview in the confirm.
6. BOOK: a grey-silhouette grid is good; the header with percent and four rewards is text only. Needs: a ribbon progress bar (`.skin-bar`) with the four reward milestones as wax seals.
7. MAP / TRAVEL: cards with icon and text; no sense of place. Needs: a parchment map with painted place icons, locked ones with a padlock.
8. SETTINGS: a long list of toggles and sliders in plain rows. Needs: grouped sections with ribbons (Sound, Display, Debug), real toggle switches (peg and groove) and a slider with a rope look.
9. SIDE BUTTONS: icon column works; the icons are small, flat 12 px maps. Needs: redrawn, consistent icon set with a 1 px candle highlight, labels on wide screens, the hotspot badges as red wax dots.
10. TOASTS: a plain box. Needs: a small banner with an icon (coin, gem, level) and the rank colour edge.
11. PANELSHELL: structure fine (tabs, frame, title, body, strip). Close button is a plain orange square: needs the iron ring look.
12. CONFIRMBUY: centered, ok. Needs: the big item preview on a velvet slot, price on a hang tag, the primary Buy in candle gold, Cancel quiet.
13. MAIN MENU / SPLASH: the logo splash is good; there is no title screen (Continue / New game / Settings) with a proper look. Needs: a tavern-door title screen (logic: coder).

## Rounds
- ROUND 1 (done in this run): the shared skin (client/src/ui/skin.css) + character creation + Avatar panel (tiles, big stage, rug, turn arrows, "Surprise me", name card, primary Begin button, hat tab icon and hat tiles).
- ROUND 2: panelShell close button + title ribbons everywhere, hotbar (selected name plate, empty slots), bag section ribbons, toasts with icons, confirmBuy hang tag.
- ROUND 3: catalog cards and tabs, Book progress ribbon and wax seals, Map as a parchment map, Settings groups and toggle switches.
- ROUND 4: icon set redraw (side buttons, tabs, status icons) as 16 x 16 pixel maps or Aseprite UI sprites (preflight first), title screen markup.
- Every round: test at 1000 x 700 and 420 x 760, run npm test and npm run typecheck, no new font-family without var(--font), touch targets 44 px.

## Open needs for the coder
- Title / main menu screen (Continue, New game, Settings): a game/ flow and a save-exists check (round 4).
- Hotbar selected-item name: expose the selected item's display name to ui/hotbar.ts (round 2).
- Optional: a `GameAPI` call for "unlocked clothing" already exists (setLook gets `unlocked`); nothing else needed for round 1.
