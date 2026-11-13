// Build mode UI (step 4b): a "Build (F)" toggle and the temporary item list as a compact strip
// along the bottom that scrolls sideways (all starter types; the number shows how many are in
// the inventory). The strip is hidden while an item is being placed.

import { FURNITURE_TYPES } from '@pixel-hotel/shared';

export interface BuildPanelHooks {
  onToggle(on: boolean): void;
  onSelect(typeId: string): void;
}

export interface BuildPanelState {
  on: boolean;
  /** True while an item is being placed (the strip is hidden). */
  placing: boolean;
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
  let on = false;
  const toggle = button('Build (F)', () => hooks.onToggle(!on));
  toggle.className = 'build-toggle';
  const strip = document.createElement('div');
  strip.className = 'build-strip';

  const items = new Map<string, HTMLButtonElement>();
  for (const t of FURNITURE_TYPES) {
    const b = button(t.name, () => hooks.onSelect(t.id));
    items.set(t.id, b);
    strip.appendChild(b);
  }
  const bar = document.createElement('div');
  bar.className = 'build-bar';
  bar.append(toggle, strip);
  parent.appendChild(bar);

  // A vertical mouse wheel scrolls the strip sideways.
  strip.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      strip.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key.toLowerCase() === 'f') hooks.onToggle(!on);
  });

  return {
    refresh(state) {
      on = state.on;
      toggle.classList.toggle('on', state.on);
      strip.hidden = !state.on || state.placing;
      for (const t of FURNITURE_TYPES) {
        const n = state.inventory.get(t.id) ?? 0;
        items.get(t.id)!.textContent = n > 0 ? `${t.name} (${n})` : t.name;
      }
    },
  };
}
