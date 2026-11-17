// Avatar, chat and settings panels (R1 split of main.ts: part 12 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { createAvatarPanel } from '../ui/avatarPanel.ts';
import { createChatPanel } from '../ui/chatPanel.ts';
import { createSettingsPanel } from '../ui/settingsPanel.ts';
import { typing } from '../ui/dom.ts';
import { savePrefs } from '../api/prefs.ts';
import { cloudConfig, createCloudSave } from '../api/cloudSave.ts';
import { saveKey } from '@pixel-hotel/shared';
import type { G11 } from './ctx.ts';

export async function setupSettingsPanels(g: G11) {
  const {
    ui, sprite, dungeon, api, panels, bubbles, placer, toast, prefs, sound, storage, syncGrid, popups, nameTag,
    atmosphere, backdrop, redraw, label, blockerButtons, cross, st, late,
  } = g;

  // ---------- Avatar, chat, settings ----------
  const avatarPanel = createAvatarPanel(ui, (next) => {
    st.avatar = { ...st.avatar, look: next };
    sprite.setLook(next);
    dungeon.setLook(next);
    void api.setLook(next);
  });
late.avatarPanel = avatarPanel;
  avatarPanel.setLook(st.avatar.look, (await api.getPlayer()).unlockedClothing);
  avatarPanel.setName(st.avatar.name);
  // Hats unlock from events (Book, fish, splice, boss): re-read what is owned each time the panel opens, else a new hat stays a locked silhouette.
  panels.add('avatar', avatarPanel.el, () => void api.getPlayer().then((p) => avatarPanel.setLook(st.avatar.look, p.unlockedClothing)));

  const chat = createChatPanel(ui, (text) => void api.chat(text));
  panels.add('chat', chat.el, () => chat.focus());
  api.onChat((line) => {
    chat.add(line);
    bubbles.add(line);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || typing(e) || placer.active || e.repeat) return;
    e.preventDefault();
    if (panels.open === 'chat') chat.focus();
    else panels.show('chat');
  });

  // ON-1: the cloud save Account section exists only when the build flag is on (VITE_CLOUD_SAVE=1 and VITE_SERVER_URL); default off = the game does not change.
  const cloudCfg = cloudConfig(import.meta.env as { VITE_CLOUD_SAVE?: string; VITE_SERVER_URL?: string });
  const importSaveText = (text: string): void => {
    const r = api.importSave(text);
    if (r.ok) window.location.reload();
    else toast(r.message);
  };
  const settings = createSettingsPanel(ui, {
    exportSave: () => api.exportSave(),
    importSave: importSaveText,
    account: cloudCfg ? { cloud: createCloudSave(cloudCfg, storage), localSaveText: () => storage.get(saveKey()), importCloudSave: importSaveText } : undefined,
    restoreBackup: () => {
      const r = api.restoreBackup();
      if (r.ok) window.location.reload();
      else toast(r.message);
    },
    newGame: () => {
      api.newGame();
      window.location.reload();
    },
    prefs,
    onSound: (on) => {
      prefs.sound = on;
      sound.setEnabled(on);
      savePrefs(storage, prefs);
    },
    onVolume: (v) => {
      prefs.volume = v;
      sound.setVolume(v);
      savePrefs(storage, prefs);
    },
    onCellGrid: (on) => {
      prefs.cellGrid = on;
      savePrefs(storage, prefs);
      syncGrid();
    },
    onPopups: (on) => {
      prefs.popups = on;
      popups.setEnabled(on);
      savePrefs(storage, prefs);
    },
    onReplayGuide: () => {
      late.replayGuide();
      panels.close();
    },
    onFollowCamera: (on) => {
      prefs.followCamera = on;
      savePrefs(storage, prefs);
    },
    onReduceEffects: (on) => {
      prefs.reduceEffects = on;
      savePrefs(storage, prefs);
    },
    onNameTags: (on) => {
      prefs.nameTags = on;
      nameTag.setEnabled(on);
      savePrefs(storage, prefs);
    },
    onLighting: (on) => {
      prefs.lighting = on;
      atmosphere.setLighting(on);
      st.lightingOn = on;
      backdrop.container.visible = on && !dungeon.isActive;
      backdrop.refresh();
      redraw();
      savePrefs(storage, prefs);
    },
    onDebug: (on) => {
      label.setVisible(on);
      blockerButtons.setVisible(on);
      cross.visible = on && st.marked !== null;
      redraw();
    },
  });
  panels.add('settings', settings.el);
  cross.visible = false;

  return { avatarPanel, chat };
}
