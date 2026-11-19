// SK-1 (docs/PLAN-SKILLTREE.md 4.1): first-pass radial layout of the skill tree. Reads shared/data/skills.json, writes every node's pos (tree units,
// 1 = 48 css px) and writes the file back (one node per line). The hub sits at 0,0; branch b points at its `angle` (0 = up, clockwise); ring r sits at
// radius r * RING_UNITS; siblings on one ring spread along the arc SPREAD_UNITS apart; a bridge sits on ring 3 halfway between its two branches.
// Positions are data: run this once, then hand-tune in the JSON (a rerun overwrites the tweaks). Usage: node tools/layout-skilltree.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RING_UNITS = 3;
const SPREAD_UNITS = 1.6;
const file = fileURLToPath(new URL('../shared/data/skills.json', import.meta.url));
const data = JSON.parse(readFileSync(file, 'utf8'));
const angleOf = Object.fromEntries(data.branches.map((b) => [b.id, (b.angle * Math.PI) / 180]));
const round = (v) => Math.round(v * 10) / 10 + 0; // + 0: no -0
const place = (angle, radius) => ({ x: round(Math.sin(angle) * radius), y: round(-Math.cos(angle) * radius) });

for (const node of data.nodes) {
  if (node.kind === 'hub') node.pos = { x: 0, y: 0 };
  else if (node.kind === 'bridge') {
    const [a, b] = node.between.map((id) => angleOf[id]);
    let mid = (a + b) / 2;
    if (Math.abs(a - b) > Math.PI) mid += Math.PI; // the pair that wraps round (home - tavern)
    node.pos = place(mid, node.ring * RING_UNITS);
  } else {
    const sib = data.nodes.filter((n) => n.branch === node.branch && n.ring === node.ring);
    const i = sib.indexOf(node);
    const radius = node.ring * RING_UNITS;
    const step = SPREAD_UNITS / radius;
    node.pos = place(angleOf[node.branch] + (i - (sib.length - 1) / 2) * step, radius);
  }
}
const lines = data.nodes.map((n) => `    ${JSON.stringify(n)}`);
const branches = data.branches.map((b) => `    ${JSON.stringify(b)}`);
const text = `{\n  "_help": ${JSON.stringify(data._help)},\n  "version": ${data.version},\n  "branches": [\n${branches.join(',\n')}\n  ],\n  "nodes": [\n${lines.join(',\n')}\n  ]\n}\n`;
writeFileSync(file, text);
console.log(`laid out ${data.nodes.length} nodes`);
