// Build mode UI (step 4): a "Build (F)" toggle, the temporary item list (all starter types; the
// number shows how many are in the inventory), and Rotate (R), Pick up (Del) and Cancel (Esc)
// while an item is held.

import { FURNITURE_TYPES } from '@pixel-hotel/shared';

export interface BuildPanelHooks {
  onToggle(on: boolean): void;
  onSelect(typeId: string): void;
  onRotate(): void;
  onPickUp(): void;
  onCancel(): void;
}

export interface BuildPanelState {
  on: boolean;
  /** Type id of the held item, or null. */
  held: string | null;
  canPickUp: boolean;
  /** Items in the inventory per type id. */
  inventory: ReadonlyMap<string, number>;
}

export interface BuildPanel {
  refresh(state: BuildPanelState): void;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

export function createBuildPanel(parent: HTMLElement, hooks: BuildPanelHooks): BuildPanel {
  const panel = document.createElement('div');
  panel.className = 'build-panel';
  const list = document.createElement('div');
  list.className = 'build-list';
  const actions = document.createElement('div');
  actions.className = 'build-actions';

  let on = false;
  const toggle = button('Build (F)', () => hooks.onToggle(!on));
  const rotate = button('Rotate (R)', () => hooks.onRotate());
  const pickUp = button('Pick up (Del)', () => hooks.onPickUp());
  const cancel = button('Cancel (Esc)', () => hooks.onCancel());
  actions.append(toggle, rotate, pickUp, cancel);

  const items = new Map<string, HTMLButtonElement>();
  for (const t of FURNITURE_TYPES) {
    const b = button(t.name, () => hooks.onSelect(t.id));
    items.set(t.id, b);
    list.appendChild(b);
  }
  panel.append(list, actions);
  parent.appendChild(panel);

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (k === 'f') hooks.onToggle(!on);
    else if (!on) return;
    else if (k === 'r') hooks.onRotate();
    else if (k === 'escape') hooks.onCancel();
    else if (k === 'delete' || k === 'backspace') hooks.onPickUp();
  });

  return {
    refresh(state) {
      on = state.on;
      toggle.classList.toggle('on', state.on);
      list.hidden = !state.on;
      rotate.hidden = !state.held;
      cancel.hidden = !state.held;
      pickUp.hidden = !state.canPickUp;
      for (const t of FURNITURE_TYPES) {
        const b = items.get(t.id)!;
        const n = state.inventory.get(t.id) ?? 0;
        b.textContent = n > 0 ? `${t.name} (${n})` : t.name;
        b.classList.toggle('on', state.held === t.id);
      }
    },
  };
}
