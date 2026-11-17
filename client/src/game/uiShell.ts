// The HTML shell: toast, popups, panels, buttons, run bar, dungeon screen (R1 split of main.ts: part 4 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { EMOTE_MS, GEMS_GAIN_ID, bagGains, worldToScreen, type Point, HINTS, DUNGEON_HINT, MINE_HINT } from '@pixel-hotel/shared';
import { createEmoteButton } from '../ui/emoteButton.ts';
import { createNameTag } from '../ui/nameTag.ts';
import { createDebugLabel } from '../ui/debugLabel.ts';
import { createBlockersButton } from '../ui/blockersButton.ts';
import { createPanels } from '../ui/panels.ts';
import { createSideButtons } from '../ui/sideButtons.ts';
import { createBuildMode } from '../ui/buildMode.ts';
import { createInfoPanel, ROOM_NAMES } from '../ui/infoPanel.ts';
import { createGainPopups } from '../ui/gainPopups.ts';
import { createGemFly } from '../ui/gemFly.ts';
import { createChatBubbles } from '../ui/chatBubbles.ts';
import { createToast } from '../ui/toast.ts';
import { iconButton } from '../ui/dom.ts';
import { createHintBox } from '../ui/hintBox.ts';
import { createRunBar } from '../ui/runBar.ts';
import { DungeonScreen } from '../dungeon/dungeonScreen.ts';
import type { G3 } from './ctx.ts';

export async function setupUiShell(g: G3) {
  const { ui, prefs, blockers, app, uiRoot, api, sound, dpr, st, late } = g;

  // ---------- HTML UI (layout rule in CLAUDE.md) ----------
  const toast = createToast(ui, () => {
    const feet = worldToScreen({ x: st.avatar.x, y: st.avatar.y }, st.shown);
    return { x: feet.x, top: feet.y - 64 * st.shown.zoom, bottom: feet.y };
  });
  // Gain popups above the avatar's head (step BG3 B) and the blocks (step BG5).
  const popups = createGainPopups(ui, prefs.popups);
  // Gems flying from a punched block, a harvest or a felled tree to the avatar (step BG4; the wallet has them already).
  const gemFly = createGemFly(ui);
  const flyGems = (gains: readonly { itemId: string; count: number }[], at: Point): void => {
    const n = gains.filter((g) => g.itemId === GEMS_GAIN_ID).reduce((a, g) => a + g.count, 0);
    if (n > 0) gemFly.launch(worldToScreen(at, st.shown), n);
  };
  const bubbles = createChatBubbles(ui);
  const label = createDebugLabel(ui);
  const blockerButtons = createBlockersButton(ui, { onToggle: (on) => blockers.setOn(on), onClear: () => blockers.clear() });
  const panels = createPanels();
  /** The player's gold as last read (for the "Buy this?" panels). */
  st.walletGold = 0;
  /** The floor and wall styles the player has unlocked (style keys), as last read. */
  st.unlockedStyles = [];
  const info = createInfoPanel(ui);
  const hint = createHintBox(ui, info.column);
  // Play mode (default: taps walk and sit) or build mode (taps open item menus, never walk).
  const build = createBuildMode(ui, {
    onChange: (on) => {
      late.syncGrid?.();
      if (on) return;
      late.menu.close();
      late.placer.cancel();
    },
    escapeTaken: () => panels.open !== null || late.placer.active || late.paint.active || dungeon.isActive,
  });
  build.button.classList.add('room-only');
  // The Dungeon button (step 9): shows the key cost, or "free" under 10 gold.
  const dungeonButton = iconButton('dungeon', 'Dungeon', () => void late.enterDungeonAsked(), 'room-only dungeon-btn');
  const dungeonBadge = document.createElement('span');
  dungeonBadge.className = 'btn-badge';
  dungeonButton.appendChild(dungeonBadge);
  // Emotes (step 9g-1): the menu asks the API (the avatar must stand still); the frame loop plays the pose.
  const emote = createEmoteButton(ui, (kind) => {
    void api.emote(kind).then((e) => {
      if (!e) {
        toast('Stand still to emote.');
        return;
      }
      const now = performance.now();
      st.emote = { kind, startedAt: now, endsAt: now + EMOTE_MS[kind] };
      emote.setActive(kind);
    });
  });
  const nameTag = createNameTag(ui, prefs.nameTags);
  const side = createSideButtons(ui, panels, [build.button, dungeonButton, emote.button]);
  const sideButtons = side.col;
  // The quest button, at the top of the column: shows the current quest again. Hidden without a
  // quest; selected while the quest shows; glowing while a quest is going but its box is closed.
  const questButton = iconButton('quest', 'Quest', () => hint.toggle(), 'quest-btn room-only');
  sideButtons.prepend(questButton);
  // The Map button (step 9b), under the quest button: the travel panel with every place.
  const mapButton = iconButton('worlds', 'Worlds: travel', () => panels.toggle('travel'), 'room-only');
  questButton.after(mapButton);
  panels.onChange(() => mapButton.classList.toggle('on', panels.open === 'travel'));
  panels.onChange(() => hint.setCovered(panels.open !== null));
  hint.onChange((quest, showing) => {
    questButton.hidden = quest === null;
    questButton.classList.toggle('on', showing);
    questButton.classList.toggle('glow', quest !== null && !showing);
    // The dungeon hint points at the Dungeon button.
    dungeonButton.classList.toggle('glow', quest === HINTS[DUNGEON_HINT]);
    // The mine hint (step 9c) points at the Map button.
    mapButton.classList.toggle('glow', quest === HINTS[MINE_HINT]);
  });

  // The dungeon screen (step 9); created early, before any shop event can ask for the HUD.
  const runBar = createRunBar(
    ui,
    () => dungeon.potion(),
    () => dungeon.eat(),
    () => dungeon.leave(),
  );
  const dungeon: DungeonScreen = new DungeonScreen(
    {
      app,
      ui: uiRoot,
      api,
      info,
      runBar,
      toast,
      sound: (name, rank) => sound.play(name, rank),
      reduceEffects: () => prefs.reduceEffects,
      dpr,
      backTo: () => ROOM_NAMES[st.room.kind].toLowerCase(),
      popups,
      onDone: async (result) => {
        late.setDungeonMode(false);
        st.items = await api.getItems();
        await late.openRoom(st.room.id);
        // Banking at the exit (step BG3b): what came home shows above the head in the room.
        popups.show(bagGains(result.banked));
      },
    },
    st.avatar.look,
  );

  return { toast, popups, gemFly, flyGems, bubbles, emote, nameTag, label, blockerButtons, panels, info, hint, build, dungeonButton, dungeonBadge, side, mapButton, runBar, dungeon };
}
