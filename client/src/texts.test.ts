// Step 9t C: the room the player sees is the tavern. No visible text may still call it "the shop" (internal ids such as the
// room kind 'shop', CSS classes and ledger notes are fine). The old-save intro is the one place that says "shop" on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
/** Strings that may say "shop": CSS classes, error messages, a ledger note, the old-save intro. */
const ALLOWED = [/^shop-card/, /shop room missing/, /the shop is a tavern now/, /^Your shop is a tavern now!/];

describe('texts: the tavern is not called the shop (step 9t C)', () => {
  it('no visible string in client/src, shared/src or shared/data says "shop" for the room', () => {
    const files = [...walk(join(root, 'client/src')), ...walk(join(root, 'shared/src')), ...walk(join(root, 'shared/data')), join(root, 'client/index.html')].filter(
      (f) => /\.(ts|json|html)$/.test(f) && !f.includes('.test.') && !f.includes('tavernTest'),
    );
    const bad: string[] = [];
    for (const f of files) {
      for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const m of line.matchAll(LITERAL)) {
          const text = (m[1] ?? m[2] ?? m[3] ?? '').trim();
          // A text has a space; a one-word "Shop" is a label. Single lowercase ids ('shop', 'shop_furniture') are internal.
          const visible = text.includes(' ') || /^Shop\b/.test(text);
          if (visible && /\bshop\b/i.test(text) && !ALLOWED.some((a) => a.test(text))) bad.push(`${f.slice(root.length + 1)}:${i + 1}: ${text.slice(0, 80)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('the catalog tab, the Map card and the info panel say Tavern', () => {
    const read = (p: string): string => readFileSync(join(root, p), 'utf8');
    expect(read('client/src/ui/catalogPanel.ts')).toContain("['shop', 'coin', 'Tavern']");
    expect(read('client/src/ui/travelPanel.ts')).toContain("shop: ['Tavern', 'coin']");
    expect(read('client/src/ui/infoPanel.ts')).toContain("shop: 'Tavern'");
  });
});
