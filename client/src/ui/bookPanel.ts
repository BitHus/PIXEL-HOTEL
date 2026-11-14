// The Book (step 9e): everything the player ever found. Tabs Materials, Furniture, Food and crops,
// Enemies; one card per entry in a grid. Never seen: a grey silhouette and "???". Seen: the icon
// in colour, the name in its rank colour, how many found, where it comes from. Enemies show kills
// and their drops (not found yet: grey "???"). The header shows "n / N found" for the tab, the
// whole book in percent, and the rewards for filling the tab (25 / 50 / 75 / 100%: gold, a hat
// later). "New!" marks what was first seen since the Book was last opened.

import {
  BOOK_TABS,
  BOOK_TAB_NAMES,
  PALETTE,
  RANK_NAMES,
  bookEntries,
  bookProgress,
  bookRewards,
  bookTotal,
  getFurnitureType,
  getMaterialType,
  isMaterialId,
  newEntries,
  type BookEntry,
  type BookTab,
  type MaterialId,
  type Player,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { panelShell, tabBar } from './panelShell.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { rankName, setRank } from './rank.ts';

export interface BookPanel {
  readonly el: HTMLElement;
  /** Draws the book for this player. `fresh` = just opened: remember what is new now. */
  refresh(player: Player, fresh?: boolean): void;
}

const TAB_ICONS: Record<BookTab, IconName> = { materials: 'wood', furniture: 'chair', food: 'food', enemies: 'sword' };

/** Enemy pictures, drawn in code (placeholders): rows of palette letters, '.' = empty. */
const ENEMY_ART: Record<string, { rows: string[]; colors: Record<string, number> }> = {
  slime: { rows: ['........', '..aaaa..', '.abbbba.', 'abobboba', 'abbbbbba', 'abbbbbba', '.aaaaaa.', '........'], colors: { a: 13, b: 12, o: 6 } },
  bat: { rows: ['a......a', 'aa.aa.aa', 'aaaaaaaa', 'abaooaba', '.aaaaaa.', '..abba..', '...aa...', '........'], colors: { a: 27, b: 28, o: 19 } },
  skeleton: { rows: ['..aaaa..', '.aoaaoa.', '.aaaaaa.', '..abba..', '.aaaaaa.', 'a.abba.a', '..a..a..', '.aa..aa.'], colors: { a: 2, b: 20, o: 6 } },
  mimic: { rows: ['........', '.aaaaaa.', 'abbbbbba', 'awowwowa', 'arrrrrra', 'awwwwwwa', 'abbbbbba', '.aaaaaa.'], colors: { a: 5, b: 4, w: 19, o: 6, r: 7 } },
  bone_king: { rows: ['.y.yy.y.', '.yyyyyy.', '.aaaaaa.', '.aoaaoa.', '.aaaaaa.', 'ppabbapp', 'pppaappp', '.pp..pp.'], colors: { a: 2, b: 20, o: 7, y: 10, p: 27 } },
};

const artCache = new Map<string, string>();

function enemyIconUrl(type: string): string {
  const hit = artCache.get(type);
  if (hit) return hit;
  const art = ENEMY_ART[type];
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext('2d');
  if (ctx && art) {
    art.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = art.colors[ch];
        if (color === undefined) return;
        ctx.fillStyle = PALETTE[color] ?? '#000000';
        ctx.fillRect(x, y, 1, 1);
      });
    });
  }
  const url = c.toDataURL();
  artCache.set(type, url);
  return url;
}

function iconUrl(e: Pick<BookEntry, 'kind' | 'id'>): string {
  return e.kind === 'enemy' ? enemyIconUrl(e.id) : e.kind === 'material' ? materialIconUrl(e.id as MaterialId) : furnitureIconUrl(e.id);
}

function nameOfItem(id: string): string {
  return isMaterialId(id) ? getMaterialType(id).name : getFurnitureType(id).name;
}

export function createBookPanel(parent: HTMLElement, claim: (tab: BookTab, percent: number) => void): BookPanel {
  const shell = panelShell(parent, 'book-panel', 'Book');
  const head = el('div', 'book-head inset');
  const grid = el('div', 'book-grid');
  shell.body.append(head, grid);
  let tab: BookTab = 'materials';
  let player: Player | null = null;
  /** The keys that were new when the Book was opened (they keep their mark while it stays open). */
  let fresh = new Set<string>();

  const icon = (url: string, seen: boolean): HTMLElement => {
    const box = el('div', `book-icon${seen ? '' : ' unseen'}`);
    const img = el('img', '');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    box.appendChild(img);
    return box;
  };

  const card = (e: BookEntry, p: Player): HTMLElement => {
    const seen = p.seen[e.key];
    const c = el('div', `book-card${seen ? '' : ' unseen'}`);
    c.appendChild(icon(iconUrl(e), seen !== undefined));
    if (!seen) {
      c.append(el('div', 'book-name', '???'), el('div', 'book-sub', 'Not found yet'));
      return c;
    }
    setRank(c, e.id, e.rank);
    const name = rankName('div', 'book-name', e.name, e.id);
    setRank(name, e.id, e.rank);
    c.append(name, el('div', 'book-sub', RANK_NAMES[e.rank]));
    c.append(el('div', 'book-count', e.kind === 'enemy' ? `Kills: ${seen.count}` : `Found: ${seen.count}`), el('div', 'book-sub', e.source));
    if (e.drops) {
      const drops = el('div', 'book-drops');
      for (const id of e.drops) {
        const found = p.seen[id] !== undefined;
        const d = el('div', `book-drop${found ? '' : ' unseen'}`);
        d.title = found ? nameOfItem(id) : '???';
        d.appendChild(icon(materialIconUrl(id as MaterialId), found));
        const label = found ? rankName('span', 'book-drop-name', nameOfItem(id), id) : el('span', 'book-drop-name', '???');
        d.appendChild(label);
        drops.appendChild(d);
      }
      c.appendChild(drops);
    }
    if (fresh.has(e.key)) c.appendChild(el('span', 'book-new plate', 'New!'));
    return c;
  };

  const draw = (): void => {
    const p = player;
    if (!p) return;
    const prog = bookProgress(p.seen, tab);
    const total = bookTotal(p.seen);
    const line = el('div', 'book-progress');
    line.append(el('span', 'book-found', `${prog.found} / ${prog.total} found`), el('span', 'book-total', `Whole book: ${total.percent}%`));
    const rewards = el('div', 'book-rewards');
    for (const r of bookRewards(p, tab)) {
      const box = el('div', `book-reward ${r.state}`);
      box.append(el('span', 'book-reward-step', `${r.percent}%`));
      if (r.state === 'ready') {
        const b = textButton(String(r.gold), () => claim(tab, r.percent));
        b.title = `Take ${r.gold} gold`;
        b.setAttribute('aria-label', b.title);
        b.prepend(pixelIcon('coin'));
        box.appendChild(b);
      } else {
        const g = el('span', 'book-reward-gold');
        g.append(pixelIcon('coin'), el('span', '', r.state === 'taken' ? 'Taken' : String(r.gold)));
        box.appendChild(g);
      }
      rewards.appendChild(box);
    }
    head.replaceChildren(el('div', 'catalog-name', BOOK_TAB_NAMES[tab]), line, rewards);
    grid.replaceChildren(...bookEntries(tab).map((e) => card(e, p)));
    mark(tab);
  };

  const mark = tabBar(
    shell.tabs,
    BOOK_TABS.map((t) => [t, TAB_ICONS[t], BOOK_TAB_NAMES[t]] as const),
    (t) => {
      tab = t;
      shell.body.scrollTop = 0;
      draw();
    },
  );

  return {
    el: shell.el,
    refresh(p, justOpened = false) {
      if (justOpened) fresh = new Set(newEntries(p.seen, p.bookOpenedAt));
      player = p;
      draw();
    },
  };
}
