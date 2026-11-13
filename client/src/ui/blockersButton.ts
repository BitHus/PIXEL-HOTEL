// HTML debug buttons for Blockers mode: "Blockers" toggles it (also the B key), "Clear"
// removes every drawn rectangle (only shown while the mode is on).

export interface BlockersButtonHooks {
  onToggle(on: boolean): void;
  onClear(): void;
}

export function createBlockersButton(parent: HTMLElement, hooks: BlockersButtonHooks): void {
  const bar = document.createElement('div');
  bar.className = 'debug-bar';
  const toggle = document.createElement('button');
  toggle.textContent = 'Blockers (B)';
  const clear = document.createElement('button');
  clear.textContent = 'Clear';
  clear.hidden = true;
  bar.append(toggle, clear);
  parent.appendChild(bar);

  let on = false;
  const set = (v: boolean): void => {
    on = v;
    toggle.classList.toggle('on', on);
    clear.hidden = !on;
    hooks.onToggle(on);
  };
  toggle.addEventListener('click', () => set(!on));
  clear.addEventListener('click', () => hooks.onClear());
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'b' || e.key === 'B') set(!on);
  });
}
