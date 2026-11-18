// One side panel open at a time (Bag, Catalog, Room, Avatar, Chat, Settings). Panels open to the left of the
// right-edge button column and always end above the hotbar (ui.css). Panels are built with
// panelShell.ts; the ✗ goes on the corner of the panel's frame.

export type PanelName = 'bag' | 'catalog' | 'room' | 'avatar' | 'chat' | 'settings' | 'workshop' | 'travel' | 'cooking' | 'brewing' | 'menu' | 'taps' | 'casks' | 'book' | 'quests' | 'skills';

export interface Panels {
  readonly open: PanelName | null;
  /** Adds a panel; a close button (✗) goes on the top-right corner of `closeHost` (default: the panel's frame). */
  add(name: PanelName, panel: HTMLElement, onOpen?: () => void, onClose?: () => void, closeHost?: HTMLElement): void;
  toggle(name: PanelName): void;
  show(name: PanelName): void;
  close(): void;
  /** Called after any panel opened or closed. */
  onChange(listener: () => void): void;
}

/** How long the slide-out lasts (matches skin.css .panel-leaving). */
const LEAVE_MS = 130;
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createPanels(): Panels {
  const panels = new Map<PanelName, { el: HTMLElement; onOpen?: () => void; onClose?: () => void }>();
  const listeners: (() => void)[] = [];
  let open: PanelName | null = null;
  const set = (next: PanelName | null): void => {
    if (next === open) return;
    const was = open !== null ? panels.get(open) : undefined;
    if (was) {
      // Closing for good: a short stepped slide-out (skin.css .panel-leaving), then hidden. Switching panels hides at once.
      if (next === null && !reducedMotion()) {
        const leaving = was.el;
        leaving.classList.add('panel-leaving');
        window.setTimeout(() => {
          leaving.classList.remove('panel-leaving');
          // Opened again meanwhile: it stays.
          if (open === null || panels.get(open)?.el !== leaving) leaving.hidden = true;
        }, LEAVE_MS);
      } else was.el.hidden = true;
      was.onClose?.();
    }
    open = next;
    const now = next !== null ? panels.get(next) : undefined;
    if (now) {
      now.el.classList.remove('panel-leaving');
      now.el.hidden = false;
      now.onOpen?.();
    }
    for (const l of listeners) l();
  };
  return {
    get open() {
      return open;
    },
    add(name, el, onOpen, onClose, closeHost = el.querySelector<HTMLElement>('.panel-frame') ?? el) {
      el.hidden = true;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'btn panel-close';
      x.textContent = '✗';
      x.title = 'Close (Esc)';
      x.setAttribute('aria-label', 'Close');
      x.addEventListener('click', () => set(null));
      closeHost.appendChild(x);
      panels.set(name, { el, onOpen, onClose });
    },
    toggle: (name) => set(open === name ? null : name),
    show: (name) => set(name),
    close: () => set(null),
    onChange: (l) => void listeners.push(l),
  };
}
