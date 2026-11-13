# UI and feel reference

Read this before any step that adds or changes UI, menus, buttons, panels or the HUD.
It describes the look and feel we want. It is a description, not a template: never copy
another game's art, icons, frames, fonts or layout pixel for pixel. Our UI is original and
uses our palette (shared/palette.ts) and our pixel font.

The owner's reference games are Travellers Rest (cozy top-down tavern game, the main
reference for look and HUD) and Habbo Hotel (rooms, furniture and the item info panel).

## 1. The one rule: the world first

- The room fills the whole screen. There are no solid bars or panels that permanently cover
  part of the room. All HUD elements float on top of the world, at the screen edges.
- The middle of the screen is for playing. Nothing permanent sits there. Popups (item menu,
  place bar) appear next to the thing they belong to and disappear when done.
- Few things on screen at once. If a button is not needed right now, it is hidden or lives
  in a panel.

## 2. Screen layout (fixed places, use them in every step)

```
+--------------------------------------------------------------+
| [INFO PANEL]                                    [quest/msg]  |
|  gold, room name                                             |
|                                                       [Bag]  |
|                                                    [Avatar]  |
|                    the room (full screen)            [Chat]  |
|                                                  [Settings]  |
|                                                              |
|          (popups appear next to their item)                  |
|                                                              |
|              [ hotbar: 6 slots, centered ]                   |
+--------------------------------------------------------------+
```

- **Top-left: info panel.** One compact panel: gold (coin icon + number), room name. Later
  also the shop status (Open / Closed) and the player level. Everything general about the
  game state goes here, not in separate labels.
- **Top-right: messages.** Short notices (a sale, a level up, "not enough gold") appear here
  and fade after a few seconds. In Travellers Rest the top of the screen also shows what
  customers want; our shop can use the same spot for customer requests later.
- **Right edge, stacked vertically: icon buttons.** Small square buttons, icons only:
  Bag (inventory), Avatar, Chat, Settings. New screens from later steps (Catalog, Crafting,
  Blacksmith, Room, Dungeon) get a button in this column too, not somewhere else.
- **Bottom-center: the hotbar.** One row of slots in a frame, centered. Icons only, no text.
  The selected slot has a bright warm border. Stack counts sit small in the slot's
  bottom-right corner (light digits with a dark outline). On desktop the slots are numbered
  and the number keys 1 to 9 and 0 select them.
- **Debug tools** (x/y/zoom label, Blockers) live in Settings behind a "Debug" toggle, off by
  default. They are never visible to a normal player.

On a 390 px wide phone: the hotbar stays one row (slots shrink to 44 px if needed), the right
column stays, the info panel stays small. Nothing overlaps the hotbar.

## 3. Visual style of UI elements

What makes the reference look clean, translated into rules:

- **One frame style for everything.** Panels are light: a warm parchment / light tan fill
  with a thick dark-brown wooden border (a 1 px darkest-brown outline outside, a 2 to 3 px
  mid-brown border, a 1 px lighter inner edge). Slots inside a panel are small squares a shade
  darker than the panel, with a 1 px darker inset edge. Small buttons and tabs use the same
  border. Square or very slightly cut corners. Defined once in CSS and reused everywhere.
- **Contrast:** the light panel sits clearly on top of the darker world, so it reads at a
  glance. Text on panels is dark brown, not black.
- **Warm colours from the palette.** Parchment and tan for panels, wood browns for borders,
  deep red and green as accents. No pure white, no pure black, no modern blue or grey UI.
- **Icons instead of words** wherever possible (hotbar, side buttons). Words only in panels
  and tooltips.
- **Pixel font everywhere**, hosted locally, at sizes that are whole multiples of the font's
  pixel size, so text stays sharp.
- **No rounded modern corners, no drop shadows with blur, no gradients, no default browser
  buttons or inputs.** Inputs (chat, price) are styled with the same frame.
- **Speech bubbles:** light cream fill, 1 px dark outline, a small tail pointing at the
  speaker, pixel font. Short, and they fade after a few seconds.
- **Sizes:** every touch target is at least 44 px. Panels scale in whole steps with the
  screen, not to odd sizes.

## 4. Interaction patterns

- **Hotbar + Bag (inventory).** The hotbar shows a few chosen items. The Bag button opens the
  full inventory panel, laid out like this:

  ```
     [tab][Inventory][tab][tab]          <- icon tabs on top; the open one shows its name
  +-------------------------------------+  [sort]
  |  [1][2][3][4][5][6]  (hotbar row)   |  [stack]  <- small square buttons beside the panel
  |  ---------------------------------  |
  |  [ ][ ][ ][ ][ ][ ][ ][ ][ ]        |
  |  [ ][ ][ ][ ][ ][ ][ ][ ][ ]        |  <- the bag: a grid of square slots
  |  [ ][ ][ ][ ][ ][ ][ ][ ][ ]        |
  +-------------------------------------+
                         [coin 1,2k]      <- currency strip under the panel
  ```

  - The hotbar is repeated as the top row of the panel, separated by a line, so items move
    between hotbar and bag by dragging (or tap one, then tap the target slot on a phone).
  - Every item is an icon with a count in the bottom-right corner. Empty slots stay visible
    as empty squares, so the bag's size is clear.
  - Tabs along the top edge are small icon tabs (Furniture, Materials, later Crafting and
    more); the open tab is wider and shows its name.
  - Small square buttons on the right side of the panel: Sort, and Stack (merge equal items).
  - Under the panel, a small strip shows the currencies (gold as a coin icon and a short
    number, 1.2k for 1,200).
  - The panel covers only part of the screen; the room stays visible around it. On a phone it
    becomes a bottom sheet with fewer columns (6) and the same parts.
  - Tap a furniture item to start placing it (the panel closes). Materials cannot be placed.
- **Placing furniture** (our own pattern, built in step 4b): the item appears as a ghost,
  green if it fits and red if not. Drag the ghost. A small bar above it: ✓ Place, ↻ Rotate,
  ✗ Cancel. Nothing is placed until ✓. Placed furniture comes out of the inventory; Pick up
  puts it back.
- **Item info, Habbo style:** tap a placed item and a small menu appears next to it (Move,
  Rotate, Pick up, and Use or Sit when it applies), with a small card showing the item's
  name. Later the card can also show its value or rarity. A tap elsewhere closes it.
- **Panels** (Bag, Catalog, Crafting, Settings) open as one panel at a time in the same
  frame style, centered or as a bottom sheet on a phone, with a clear close button (✗) in the
  top-right corner. Opening one closes the other.
- **Feedback for every action:** a small sound later, and now at least a visual: a pop when
  something is placed, a shake when something is refused, a floating "+12 gold" for a sale.

## 5. The world's look (for art and placeholders)

From the Travellers Rest reference screenshots the owner liked:
- Rooms feel full and lived-in: many small props (candles, bottles, books, plants, banners),
  rugs under tables, things on the walls.
- Floors have a clear but quiet pattern (planks, checkered stone) that never fights with
  the furniture.
- The back wall is tall and shows things hung on it (shelves, banners, windows, a clock).
  Our wall band is 64 px; wall items (step 7) should make that space feel used.
- Warm light: candles and lamps feel like the light source.
- Characters read clearly against the floor: a darker outline and a small shadow under the
  feet.

## 6. What to avoid

- Text-heavy buttons spread over the screen.
- Lists of every item type (that was a temporary debug tool).
- Panels that stay open and cover the room.
- Mixing styles (a modern rounded button next to a pixel frame).
- Copying another game's sprites, frames, icons or exact layout.
