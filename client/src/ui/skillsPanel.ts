// The Skills panel (MG-7; SK-1 keeps it working on the v2 graph until SK-6 draws the real tree): one tab per branch (7), ring headings show the ring gate
// (points on the inner rings of the branch), bridges show in both neighbour tabs on ring 3; a node card shows its rank pips, what the next rank gives, why it
// cannot be bought (Soon for nodes no rule reads yet) and Undo / Unlearn for a leaf rank; Learn asks first (confirmBuy).
// Respec (all ranks back) sits in the strip and shows its cost. All numbers come from shared/src/skills.ts through GameAPI; this file only draws.

import { SKILL_BRANCHES, type SkillBranch, type SkillNodeView, type SkillsView } from '@pixel-hotel/shared';
import { confirmBuy } from './confirmBuy.ts';
import { el, textButton } from './dom.ts';
import { iconBox, panelShell, tabBar } from './panelShell.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { skillIconUrl } from './skillIcons.ts';
import { BRANCH_NAMES, lockText, nodeSummary, notActiveYet, respecText, unlearnText } from './skillsText.ts';
import './skills.css';

export interface SkillsHooks {
  /** Buys one rank (null = refused). */
  buy(id: string): Promise<SkillsView | null>;
  /** Takes one rank of a leaf back (free undo, or gold; null = refused). */
  unlearn(id: string): Promise<SkillsView | null>;
  /** Takes every rank back (null = refused). */
  respec(): Promise<SkillsView | null>;
  /** The wallet gold, for the respec price. */
  gold(): number;
  /** Called after a buy or respec went through (the client refreshes its stats). */
  changed(view: SkillsView): void;
}

export interface SkillsPanel {
  readonly el: HTMLElement;
  /** Draws a fresh tree (call when the panel opens). */
  refresh(view: SkillsView): void;
}

const BRANCH_ICON: Record<SkillBranch, IconName> = { tavern: 'pot', kitchen: 'food', farm: 'sprout', fishing: 'fish', mining: 'hammer', dungeon: 'sword', home: 'house' };
/** One picture per skill node (existing pixel icons; a node not listed uses its branch icon). */
const NODE_ICON: Record<string, IconName> = {
  quick_feet: 'shoe', steady_hands: 'hammer', roomy_tavern: 'house', keen_eye: 'book', big_batch: 'food', wide_kegs: 'pot', cellar_racks: 'bricks',
  deep_pockets: 'purse', thick_skin: 'armor', satchel: 'bag', sharp_edge: 'sword', light_feet: 'trousers', second_wind: 'heart', parry: 'armor',
  treasure_sense: 'gem', last_stand: 'potion', patient: 'sprout', wide_box: 'stack', reel_master: 'rod', bait_saver: 'fish', sharp_eye: 'book',
  deep_cast: 'rod', trophy_hunter: 'gems', calm_hands: 'hammer', strong_arm: 'axe', lantern: 'lantern', ore_sense: 'gem', careful_step: 'shoe',
  double_strike: 'sword', pack_mule: 'bag', prospector: 'coins', gem_eye: 'gems',
};
const inTab = (n: SkillNodeView, tab: SkillBranch): boolean => n.branch === tab || (n.between?.includes(tab) ?? false);
const pips = (n: SkillNodeView): string => '●'.repeat(n.rank) + '○'.repeat(n.maxRank - n.rank);

export function createSkillsPanel(parent: HTMLElement, hooks: SkillsHooks): SkillsPanel {
  const shell = panelShell(parent, 'workshop-panel skills-panel', 'Skills');
  const head = el('div', 'skills-head');
  const list = el('div', 'skill-list');
  shell.body.append(head, list);
  let view: SkillsView | null = null;
  let tab: SkillBranch = 'tavern';
  let busy = false;
  const mark = tabBar(shell.tabs, SKILL_BRANCHES.map((b) => [b, BRANCH_ICON[b], BRANCH_NAMES[b]] as const), (b) => {
    tab = b;
    draw();
  });

  // Branch tabs: the staged emblem (32 x 32, whole pixels) replaces the code icon; a missing picture keeps the fallback.
  SKILL_BRANCHES.forEach((b, i) => {
    const url = skillIconUrl(`branch_${b}`);
    const btn = shell.tabs.children[i];
    if (!url || !btn) return;
    const img = el('img', 'skill-emblem');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    btn.firstElementChild?.replaceWith(img);
  });

  const apply = (next: SkillsView | null): void => {
    busy = false;
    if (next) {
      view = next;
      hooks.changed(next);
    }
    draw();
  };

  const learn = async (n: SkillNodeView): Promise<void> => {
    if (busy) return;
    const ok = await confirmBuy(parent, {
      name: n.name,
      detail: `${nodeSummary(n)} Costs ${n.nextCost} skill point${n.nextCost === 1 ? '' : 's'}; you have ${view?.free ?? 0}. A respec takes every point back.`,
      price: null,
      noPrice: true,
      yes: 'Learn',
      title: 'Learn this skill?',
    });
    if (!ok) return;
    busy = true;
    draw();
    apply(await hooks.buy(n.id));
  };

  const unlearn = async (n: SkillNodeView): Promise<void> => {
    if (busy) return;
    if (!n.undo) {
      const ok = await confirmBuy(parent, {
        name: n.name,
        detail: `Takes one rank of ${n.name} back; the point is free again.`,
        price: n.unlearnCost,
        yes: 'Unlearn',
        title: 'Unlearn this skill?',
        gold: hooks.gold(),
      });
      if (!ok) return;
    }
    busy = true;
    draw();
    apply(await hooks.unlearn(n.id));
  };

  const respec = async (): Promise<void> => {
    if (!view || busy) return;
    const cost = view.respecCost;
    const ok = await confirmBuy(parent, {
      name: 'Respec',
      detail: `Takes back all ${view.spent} spent skill points so you can spend them again. ${cost === 0 ? `Free (${view.respecFree} free respecs left).` : 'Costs gold.'}`,
      price: cost === 0 ? null : cost,
      noPrice: cost === 0,
      yes: 'Respec',
      title: 'Respec your skills?',
      gold: hooks.gold(),
    });
    if (!ok) return;
    busy = true;
    draw();
    apply(await hooks.respec());
  };

  const card = (v: SkillsView, n: SkillNodeView): HTMLElement => {
    const maxed = n.problem === 'maxed';
    const lock = lockText(v, n);
    const root = el('div', `skill-card${maxed ? ' maxed' : ''}${n.problem !== null && !maxed ? ' locked' : ''}`);
    const info = el('div', 'skill-info');
    const name = el('div', 'skill-title');
    name.append(el('span', 'skill-name', n.name), el('span', 'skill-pips', pips(n)));
    info.append(name, el('div', 'skill-text', nodeSummary(n)));
    if (lock) info.append(el('div', 'skill-lock', lock));
    const action = el('div', 'skill-action');
    if (maxed) action.append(el('span', 'skill-done', 'Max'));
    else if (notActiveYet(n)) action.append(el('span', 'skill-done', 'Soon'));
    else {
      const buy = textButton(`Learn (${n.nextCost})`, () => void learn(n), n.problem === null ? 'primary' : '');
      buy.disabled = n.problem !== null || busy;
      buy.title = lock || `Costs ${n.nextCost} skill point${n.nextCost === 1 ? '' : 's'}`;
      action.append(buy);
    }
    const back = unlearnText(n);
    if (back) {
      const b = textButton(back, () => void unlearn(n));
      b.disabled = busy || (!n.undo && hooks.gold() < n.unlearnCost);
      action.append(b);
    }
    const art = skillIconUrl(n.icon);
    root.append(iconBox(art ?? pixelIcon(NODE_ICON[n.id] ?? (n.branch === 'bridge' || n.branch === 'hub' ? BRANCH_ICON[tab] : BRANCH_ICON[n.branch]))), info, action);
    return root;
  };

  const draw = (): void => {
    mark(tab);
    shell.strip.replaceChildren();
    if (!view) {
      head.replaceChildren();
      list.replaceChildren();
      return;
    }
    const v = view;
    head.replaceChildren(
      el('span', 'skills-branch', BRANCH_NAMES[tab]),
      el('span', 'skills-points', `Skill points: ${v.free} free`),
      el('span', 'skills-spent', `${v.spent} spent of ${v.earned} earned (1 per level from 2, +1 per Book reward up to 4, +1 per 5 achievements up to 5)`),
    );
    const out: HTMLElement[] = [];
    for (let ring = 1; ring <= 5; ring++) {
      const nodes = v.nodes.filter((n) => n.ring === ring && inTab(n, tab));
      if (nodes.length === 0) continue;
      const own = nodes.find((n) => n.branch === tab);
      const need = own?.ringGate ?? 0;
      const have = own?.ringSpent ?? 0;
      const open = have >= need;
      out.push(el('div', `skills-tier${open ? '' : ' locked'}`, open ? `Ring ${ring}` : `Ring ${ring}: spend ${need} points on the inner rings of ${BRANCH_NAMES[tab]} (${have} so far)`));
      out.push(...nodes.map((n) => card(v, n)));
    }
    list.replaceChildren(...out);
    const strip = el('div', 'skills-strip');
    const reset = textButton(respecText(v), () => void respec());
    reset.disabled = v.spent === 0 || busy || (v.respecCost > 0 && hooks.gold() < v.respecCost);
    strip.append(reset);
    shell.strip.append(strip);
  };

  draw();
  return {
    el: shell.el,
    refresh(next) {
      view = next;
      draw();
    },
  };
}
