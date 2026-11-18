// The Skills panel (MG-7, PLAN-MINIGAMES 4): the skill tree as four branch tabs (Tavern, Dungeon, Fishing, Mining). Tier headings show the lock
// (points to spend in the branch), a node card shows its rank pips, what the next rank gives and why it cannot be bought; Learn asks first (confirmBuy).
// Respec (all ranks back) sits in the strip and shows its cost. All numbers come from shared/src/skills.ts through GameAPI; this file only draws.

import { SKILL_BRANCHES, type SkillBranch, type SkillNodeView, type SkillsView } from '@pixel-hotel/shared';
import { confirmBuy } from './confirmBuy.ts';
import { el, textButton } from './dom.ts';
import { iconBox, panelShell, tabBar } from './panelShell.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { BRANCH_NAMES, lockText, nodeSummary, notActiveYet, respecText } from './skillsText.ts';
import './skills.css';

export interface SkillsHooks {
  /** Buys one rank (null = refused). */
  buy(id: string): Promise<SkillsView | null>;
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

const BRANCH_ICON: Record<SkillBranch, IconName> = { tavern: 'pot', dungeon: 'sword', fishing: 'fish', mining: 'hammer' };
/** One picture per skill node (existing pixel icons; a node not listed uses its branch icon). */
const NODE_ICON: Record<string, IconName> = {
  quick_feet: 'shoe', steady_hands: 'hammer', roomy_tavern: 'house', keen_eye: 'book', big_batch: 'food', wide_kegs: 'pot', cellar_racks: 'bricks',
  deep_pockets: 'purse', thick_skin: 'armor', satchel: 'bag', sharp_edge: 'sword', light_feet: 'trousers', second_wind: 'heart', parry: 'armor',
  treasure_sense: 'gem', last_stand: 'potion', patient: 'sprout', wide_box: 'stack', reel_master: 'rod', bait_saver: 'fish', sharp_eye: 'book',
  deep_cast: 'rod', trophy_hunter: 'gems', calm_hands: 'hammer', strong_arm: 'axe', lantern: 'lantern', ore_sense: 'gem', careful_step: 'shoe',
  double_strike: 'sword', pack_mule: 'bag', prospector: 'coins', gem_eye: 'gems',
};
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
    if (notActiveYet(n)) info.append(el('div', 'skill-note', 'Not active yet: the game part for it is still coming.'));
    const action = el('div', 'skill-action');
    if (maxed) action.append(el('span', 'skill-done', 'Max'));
    else {
      const buy = textButton(`Learn (${n.nextCost})`, () => void learn(n), n.problem === null ? 'primary' : '');
      buy.disabled = n.problem !== null || busy;
      buy.title = lock || `Costs ${n.nextCost} skill point${n.nextCost === 1 ? '' : 's'}`;
      action.append(buy);
    }
    root.append(iconBox(pixelIcon(NODE_ICON[n.id] ?? BRANCH_ICON[n.branch])), info, action);
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
      el('span', 'skills-points', `Skill points: ${v.free} free`),
      el('span', 'skills-spent', `${v.spent} spent of ${v.earned} earned (1 per level from 2, +1 per Book reward, max 4)`),
    );
    const out: HTMLElement[] = [];
    for (let tier = 1; tier <= 4; tier++) {
      const nodes = v.nodes.filter((n) => n.branch === tab && n.tier === tier).sort((a, b) => a.pos.x - b.pos.x);
      if (nodes.length === 0) continue;
      const need = (tier - 1) * v.tierStep;
      const open = v.branchSpent[tab] >= need;
      out.push(el('div', `skills-tier${open ? '' : ' locked'}`, open ? `Tier ${tier}` : `Tier ${tier}: spend ${need} points in ${BRANCH_NAMES[tab]} (${v.branchSpent[tab]} so far)`));
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
