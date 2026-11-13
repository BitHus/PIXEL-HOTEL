// One side panel open at a time (Bag, Avatar, Chat, Settings). Panels open to the left of the
// right-edge button column, top aligned, and never cover the hotbar (ui.css).

export type PanelName = 'bag' | 'avatar' | 'chat' | 'settings';

export interface Panels {
  readonly open: PanelName | null;
  add(name: PanelName, panel: HTMLElement, onOpen?: () => void, onClose?: () => void): void;
  toggle(name: PanelName): void;
  show(name: PanelName): void;
  close(): void;
  /** Called after any panel opened or closed. */
  onChange(listener: () => void): void;
}

export function createPanels(): Panels {
  const panels = new Map<PanelName, { el: HTMLElement; onOpen?: () => void; onClose?: () => void }>();
  const listeners: (() => void)[] = [];
  let open: PanelName | null = null;
  const set = (next: PanelName | null): void => {
    if (next === open) return;
    const was = open !== null ? panels.get(open) : undefined;
    if (was) {
      was.el.hidden = true;
      was.onClose?.();
    }
    open = next;
    const now = next !== null ? panels.get(next) : undefined;
    if (now) {
      now.el.hidden = false;
      now.onOpen?.();
    }
    for (const l of listeners) l();
  };
  return {
    get open() {
      return open;
    },
    add(name, el, onOpen, onClose) {
      el.hidden = true;
      panels.set(name, { el, onOpen, onClose });
    },
    toggle: (name) => set(open === name ? null : name),
    show: (name) => set(name),
    close: () => set(null),
    onChange: (l) => void listeners.push(l),
  };
}
