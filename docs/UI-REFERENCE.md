# UI and feel reference

Read this before any step that adds or changes UI, menus, buttons, panels or the HUD.
It describes the look and feel we want. It is a description, not a template: never copy
another game's art, icons, frames, fonts or layout pixel for pixel. Our UI is original and
uses our palette (shared/palette.ts) and our pixel font.

The owner's reference games are Travellers Rest (cozy top-down tavern game, the main
reference for look and HUD) and Habbo Hotel (rooms, furniture and the item info panel).

**UI polish step (owner's decision, after step 9c).** The UI was dull, not compact enough on a
phone and had bugs. The rules below marked "(polish)" are the owner's decisions from that step
and replace what stood here before. The owner's style reference for it is a commercial pixel
game: we only take general traits from it (layered frames, dense slots, tabs on the panel edge,
name plates, small ornaments). Never copy it, its art or its exact layout, and never put
screenshots of it in the repo.

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
|                                                     [Build]  |
|                                                    [Avatar]  |
|                    the room (full screen)            [Chat]  |
|                                                  [Settings]  |
|                                                              |
|          (popups appear next to their item)                  |
|                                                              |
|              [ hotbar: 6 slots, centered ]                   |
+--------------------------------------------------------------+
```

- **Top-left: info panel (polish).** One compact panel of two short lines, about half its old
  height: the coin and the gold on line 1; the room name, the level and a thin xp bar on line 2
  (the xp numbers are in the tooltip). In the dungeon and the mine the hp bar and the lantern
  bar come under it. Everything general about the game state goes here, not in separate labels.
- **Top-right: messages.** Short notices (a sale, a level up, "not enough gold") appear here
  and fade after a few seconds. In Travellers Rest the top of the screen also shows what
  customers want; our shop can use the same spot for customer requests later.
- **Right edge, stacked vertically: icon buttons (polish).** Square buttons, icons only, about
  48 px on a phone. Always visible: Quest (while a quest is going), Map, Bag, Build and Dungeon.
  Everything else (Catalog, Workshop, Room, Avatar, Chat, Settings) sits behind one "More"
  button that opens a small grid of icons with labels; a tap elsewhere closes it. On a wide
  screen (900 px and up) all buttons stand in the column and there is no More button. New
  screens get a button here (in the More grid unless they are needed all the time).
- **Quest button** (after step 8): at the top of the right-edge column, a scroll icon. It is
  there only while a quest (first-run hint) is going. It is selected while the quest shows and
  blinks warm when the quest card is closed, so the player always knows where to find it. A tap
  shows or hides the quest card: "Quest n of 3", the task, "tap to hide". On a wide screen the
  card opens to the left of the button with a small tail; on a phone it sits under the info
  panel, so it never covers the gold or the room switcher. It hides while a panel is open.
- **Dungeon** (step 9): a Dungeon button (an arched door) right after Build, with a small badge
  for the key cost (10) or 'free'. In the dungeon the right column keeps only Chat and Settings;
  the info panel shows the floor, an hp bar and the level with its xp bar (the level and xp bar
  show in the rooms too); the run bag (12 slots, 6 per row on a phone, the run gold, the potion
  button) takes the hotbar's place. The exit choice, the death and leave summaries and the
  Resume panel are centered panels like "Buy this?".
- **Workshop** (step 9): one button (an anvil) with two tabs, Crafting and Blacksmith, so the
  column stays short.
- **Travel / Map** (step 9b): with four places (Hotel, Shop, Farm, Mine) plus the Dungeon,
  the Hotel/Shop switcher under the info panel is replaced by one Map button (a small folded
  map icon) at the top of the right column, under the quest button. It opens a travel panel
  with a card per place (icon, name, and a short status: "3 crops ripe", "2 items for sale",
  "Mine opens at level 3", "Dungeon: 10 gold"). Tap a card to go there. The Dungeon button can
  stay in the column as a shortcut. Locked places show greyed out with the reason.
- **Farm** (step 9b): in play mode the hotbar holds seeds too. A ripe plot shows a small
  bouncing marker so the player sees it from far away. The cooking pot opens the Cooking
  panel (same style as Crafting). In the dungeon the run HUD gets a food button next to the
  potion button, with a count.
- **Mine** (step 9c): the lantern bar sits in the info panel where the dungeon shows the floor;
  the run bag shows ore stacks. The Workshop gets a third tab, Forge, with smelting on the left
  and the gear upgrade tree (sword, armor, pickaxe; current tier highlighted, next tier with
  its cost) on the right.
- **Spending gold asks first** (after step 8): buying in the Catalog and upgrading a room open a
  small centered "Buy this?" panel (picture, name, price, Cancel / Buy for N).
- **Bottom-center: the hotbar.** One row of 44 px slots in a frame, centered, 2 px apart (polish:
  a bit smaller than before). Icons only, no text. The selected slot is warm orange. Every stack
  shows its count, small, in the slot's bottom-right corner (light digits with a dark outline);
  seeds show it from 1. On desktop the slots are numbered
  and the number keys 1 to 9 and 0 select them.
- **Debug tools** (x/y/zoom label, Blockers) live in Settings behind a "Debug" toggle, off by
  default. They are never visible to a normal player.

On a phone (checked at 360 x 740): the hotbar stays one row, the right column stays, the info
panel stays small. Nothing overlaps the hotbar or leaves the screen.

**Where panels go (polish).** A panel always ends above the hotbar (or the run bag) and scrolls
inside; its last row is never cut off by the hotbar. A panel never half-covers the info panel:
on a wide screen it sits at the right, fully clear of it; on a phone it starts under the info
panel and spans from the left edge to the button column, so the gold stays readable while
shopping. The bag is a bottom sheet just above the hotbar on a phone.

## 3. Visual style of UI elements

Rewritten in the UI polish step (owner's decision). Still pixel art: square corners, no
gradients, no blur, palette colours only (Endesga 32), all drawn in CSS / code.

- **Layered frames, one style for everything.** A dark wooden outer frame (1 px darkest-brown
  outline, wood with a light top-left edge and a dark bottom-right edge, small nails in the
  corners, a lighter inner bevel), a parchment panel inside it with a subtle texture (a few
  palette-colour specks), and inside that darker inset sections for each part (the bag: the
  hotbar row section, the grid section). Never one flat area. A 2 px hard pixel shadow sits
  under panels and buttons. Big panels have a small wedge in every corner. Defined once in CSS
  (`.frame`, `.inset`) and reused everywhere.
- **Dense slots.** 2 px between slots, a darker inset edge, the icon filling most of the slot
  (about 36 px in a 44 px slot), a small count bottom-right. Slots stay 44 px or more wherever
  they are tapped.
- **Buttons.** Small raised wooden buttons. Pressed: 2 px down and the shadow gone. The open /
  selected button stays pressed and turns warm orange. A disabled button is flat and darker with
  dark text. A button always fits its text (at 360 px too) and never shrinks under it.
- **Tabs** sit on top of the panel's edge as small icon tabs; the open tab is raised, warm
  orange and shows its label.
- **Name plates.** Small dark-brown bars with light text for titles, names and labels (the
  panel title, the avatar's name, "Hair 2  Ponytail"). Pickers have a small square arrow button
  left and right of the plate.
- **Ornaments.** A divider line with small diamonds between sections; the corner wedges and
  nails of the frames. Nothing bigger.
- **Strip below a panel.** Secondary actions (the bag's Sort and Stack) sit in a slim strip
  just below the panel, not inside it. Gold is shown once, in the info panel.
- **Close button.** About 36 px to look at, 44 px to hit, on the panel's top-right corner.
- **Contrast.** Text is dark brown on parchment or tan, or cream on a dark plate. No light
  orange (or other pale) text on beige, also not for disabled or secondary text. Red only for
  "you cannot afford this" and missing ingredients.
- **Numbers.** The letter font's 5 and 2 looked like S and 8, so every digit uses a second
  pixel font with clear digits (Jersey 15, SIL OFL, hosted locally). Check every new number.
- **Things you cannot afford** are dimmed with the price in red; the confirm panel shows the
  same and its Buy button is greyed out.
- **Warm colours from the palette.** Parchment and tan for panels, wood browns for frames, warm
  orange for what is selected, red-brown and green as accents. No pure white, no pure black, no
  modern blue or grey UI.
- **Icons instead of words** wherever possible (hotbar, side buttons, tabs). Words in panels,
  tooltips and the More grid.
- **Pixel font everywhere**, hosted locally. No rounded modern corners, no default browser
  buttons or inputs. Inputs (chat, price) use the same inset look.
- **Motion.** Panels open with a short pop (scale 0.95 to 1, about 120 ms). Nothing moves when
  the device asks for reduced motion.
- **Speech bubbles:** light cream fill, 1 px dark outline, a small tail pointing at the
  speaker, pixel font. Short, and they fade after a few seconds.
- **Sizes:** every touch target is at least 44 px. Overall the UI is smaller, denser and
  crisper than before the polish step.

## 4. Interaction patterns

- **Two modes: play and build.** Play mode is the default: a tap on the floor, a rug or any
  item that is not sittable walks there (the item is ignored), and a tap on a sittable item
  walks there and sits. There is no item menu in play mode. Build mode is switched on with the
  Build button (hammer) or the B key on desktop, and automatically when placing starts from the
  hotbar or the bag. In build mode taps never walk; a tap or long press on an item opens its
  menu. While build mode is on, the Build button is highlighted and a thin warm border runs
  around the screen edge, so the mode is always clear. Tapping Build again, or Escape, returns
  to play mode and closes any menu.

- **Hotbar + Bag (inventory).** The hotbar shows a few chosen items. The Bag button opens the
  full inventory panel, laid out like this (polish):

  ```
     [tab Furniture][tab]                 <- icon tabs on the top edge; the open one shows its name
  +-------------------------------------+
  | [[1][2][3][4][5][6]]  hotbar section |
  |  ------------ <> -----------------   <- divider with diamonds
  | [[ ][ ][ ][ ][ ][ ][ ][ ][ ]]        |
  | [[ ][ ][ ][ ][ ][ ][ ][ ][ ]]  grid section
  +-------------------------------------+
                      [Sort][Stack]       <- slim strip below the panel
  ```

  - The hotbar is repeated as the top section of the panel, so items move between hotbar and
    bag by dragging (or tap one, then tap the target slot on a phone).
  - Every item is an icon with a count in the bottom-right corner. The grid shows the filled
    rows plus one empty row, not all 36 slots, so the panel stays small.
  - No gold in the bag: the info panel already shows it.
  - Sort and Stack (merge equal items) sit in the strip below the panel.
  - The panel covers only part of the screen; the room stays visible around it. On a phone it
    is a bottom sheet with 6 columns and the same parts.
  - Tap a furniture item to start placing it (the panel closes). Materials cannot be placed.
- **Catalog (polish).** A grid of item cards (2 columns on a phone, 3 on a wide screen): a big
  icon, the name and the price. A tap on a card opens "Buy this?", which has the details. No
  repeated "Hotel or shop" line: a small tag shows only when the item cannot go in the room
  the player is in. Seeds are the same cards; Buy 1 and Buy 5 are in the confirm panel.
- **List panels (polish).** Workshop, Cooking, the shelf panel and the Map use the Map's card as
  the model: an icon, a title, one short line, and one action on the right.
- **Placing furniture** (our own pattern, built in step 4b): the item appears as a ghost,
  green if it fits and red if not. Drag the ghost. A small bar above it: ✓ Place, ↻ Rotate,
  ✗ Cancel. Nothing is placed until ✓. Placed furniture comes out of the inventory; Pick up
  puts it back.
- **Item info, Habbo style (build mode):** tap a placed item and a small menu appears next to
  it (Move, Rotate, Pick up), with a small card showing the item's name. Later the card can also show its value or rarity. A tap elsewhere closes it.
- **Panels** (Bag, Catalog, Workshop, Settings and the rest) open as one panel at a time in the
  same frame style, with a close button (✗) on the top-right corner. Opening one closes the
  other. Where they sit: section 2.
- **Reading pace for every text** (after step 7b): toasts, messages and chat bubbles stay on
  screen for at least 4 s plus 0.35 s per word (TEXT_MIN_MS, TEXT_MS_PER_WORD, shared readingMs)
  and then fade out slowly (TEXT_FADE_MS). A tap on a toast hides it. Important first-run hints
  never time out: they stay until the player taps them, with a small "tap to continue ▸" arrow.
- **Character creation** (after step 7b): the avatar preview is always in view while choosing.
  Phone: fixed at the top, about 35% of the screen height, turning slowly and updating the moment
  a choice is tapped. Under it one compact panel: the name, tabs Body (skin), Hair (style +
  colour), Top (style + colour), Bottoms (style + colour), Shoes, only one tab open at a time,
  and a Done button always visible at the bottom. Desktop: the same, with the preview on the
  left and the panel on the right. The Avatar panel uses the same tabs. Polish: the tabs are
  icon tabs on the panel's edge, a style picker is a name plate between two small arrow
  buttons, and the avatar's name sits on a name plate.
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
