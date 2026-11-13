// The parts every side panel is built from (UI polish step, docs/UI-REFERENCE.md section 3):
//   .panel            the place (left of the button column, ends above the hotbar)
//     .panel-tabs     small icon tabs sitting on the frame's top edge (empty = hidden)
//     .frame          the wooden frame: a title plate and the scrolling body
//     .panel-strip    a slim strip just below the frame for secondary actions (empty = hidden)
// tabBar fills .panel-tabs: the open tab is raised, warm orange and shows its name.

import { el } from './dom.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';

export interface PanelShell {
  /** The whole panel (give this to Panels.add). */
  readonly el: HTMLElement;
  readonly tabs: HTMLElement;
  readonly frame: HTMLElement;
  readonly title: HTMLElement;
  readonly body: HTMLElement;
  readonly strip: HTMLElement;
}

export function panelShell(parent: HTMLElement, cls: string, title = ''): PanelShell {
  const root = el('div', `panel ${cls}`.trim());
  const tabs = el('div', 'panel-tabs');
  const frame = el('div', 'frame panel-frame');
  const head = el('h2', 'panel-title plate', title);
  const body = el('div', 'panel-body');
  const strip = el('div', 'panel-strip');
  frame.append(head, body);
  root.append(tabs, frame, strip);
  parent.appendChild(root);
  return { el: root, tabs, frame, title: head, body, strip };
}

/** Puts icon tabs in `host`; returns the function that marks the open one. */
export function tabBar<T extends string>(host: HTMLElement, defs: readonly (readonly [T, IconName, string])[], onPick: (id: T) => void): (id: T) => void {
  const buttons = defs.map(([id, icon, label]) => {
    const b = el('button', 'btn tab-btn');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(pixelIcon(icon), el('span', 'tab-name', label));
    b.addEventListener('click', () => onPick(id));
    host.appendChild(b);
    return [id, b] as const;
  });
  return (open) => {
    for (const [id, b] of buttons) b.classList.toggle('on', id === open);
  };
}

/** A small framed icon box (a slot that is not a button) holding a picture or a pixel icon. */
export function iconBox(content: string | SVGSVGElement | HTMLElement, cls = ''): HTMLElement {
  const box = el('div', `slot ${cls}`.trim());
  if (typeof content === 'string') {
    const img = el('img', 'slot-icon');
    img.src = content;
    img.alt = '';
    img.draggable = false;
    box.appendChild(img);
  } else box.appendChild(content);
  return box;
}

/** A price with the coin icon; red when `gold` (what the player has) is too little. */
export function priceTag(price: number, gold?: number): HTMLElement {
  const p = el('span', `catalog-price${gold !== undefined && gold < price ? ' price-short' : ''}`);
  p.append(pixelIcon('coin'), el('span', '', String(price)));
  return p;
}
