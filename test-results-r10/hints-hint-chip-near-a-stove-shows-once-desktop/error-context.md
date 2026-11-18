# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hints.spec.ts >> hint chip near a stove shows once
- Location: e2e\hints.spec.ts:5:1

# Error details

```
TimeoutError: page.waitForFunction: Timeout 8000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic:
    - status:
      - generic: "Welcome to your tavern! Guests sit and order: tap them to serve. Tap the register for the menu and the tap stand to load drinks; tap the barrel to brew."
    - generic:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic "Gold" [ref=e6]: "100"
          - 'generic "Gems: you find them by playing" [ref=e173]': "0"
        - 'generic "Level 1: 0 of 15 xp for level 2" [ref=e307]'
      - 'button "Tavern is open: tap to close" [ref=e308] [cursor=pointer]':
        - generic [ref=e412]: OPEN
    - generic: Tester
    - generic:
      - button "Catalog (C)" [ref=e413] [cursor=pointer]
      - button "Build (B)" [ref=e601] [cursor=pointer]
      - button "Dungeon" [ref=e782] [cursor=pointer]
      - button "More" [ref=e1014] [cursor=pointer]
    - text: "?"
    - generic [ref=e1128]:
      - button "1" [ref=e1129] [cursor=pointer]
      - button "2" [ref=e1130] [cursor=pointer]
      - button "3" [ref=e1131] [cursor=pointer]
      - button "4" [ref=e1132] [cursor=pointer]
      - button "5" [ref=e1133] [cursor=pointer]
      - button "6" [ref=e1134] [cursor=pointer]
      - button "Bag (I)" [active] [ref=e1135] [cursor=pointer]
    - generic:
      - generic:
        - button "Furniture" [ref=e1245] [cursor=pointer]
        - button "Materials" [ref=e1324] [cursor=pointer]
      - generic [ref=e1406]:
        - generic [ref=e1407]:
          - generic [ref=e1408]:
            - generic [ref=e1409]: Hotbar
            - generic [ref=e1410]: keys 1 to 6
          - generic [ref=e1411]:
            - button "1" [ref=e1412]
            - button "2" [ref=e1413]
            - button "3" [ref=e1414]
            - button "4" [ref=e1415]
            - button "5" [ref=e1416]
            - button "6" [ref=e1417]
          - generic [ref=e1418]:
            - generic [ref=e1419]: Furniture
            - generic [ref=e1420]: 0 / 36
          - generic [ref=e1421]:
            - button "Empty slot" [ref=e1422]
            - button "Empty slot" [ref=e1423]
            - button "Empty slot" [ref=e1424]
            - button "Empty slot" [ref=e1425]
            - button "Empty slot" [ref=e1426]
            - button "Empty slot" [ref=e1427]
            - button "Empty slot" [ref=e1428]
            - button "Empty slot" [ref=e1429]
            - button "Empty slot" [ref=e1430]
          - generic [ref=e1431]: Tap to place. Drag (or hold) to move.
        - generic [ref=e1432]:
          - button "Sort" [ref=e1433] [cursor=pointer]
          - button "Stack" [ref=e1493] [cursor=pointer]
        - button "Close" [ref=e1568] [cursor=pointer]: ✗
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { shot, watchErrors } from './helpers';
  3  | 
  4  | // VG-1: the one-time hint chip bobs on a thing in reach (shown once), and SG4b: the seed hint chip.
  5  | test('hint chip near a stove shows once', async ({ page }) => {
  6  |   const errs = watchErrors(page);
  7  |   await page.goto('/?e2e');
  8  |   await page.getByText('New game').first().click();
  9  |   await page.getByLabel('Display name').fill('Tester');
  10 |   await page.getByText('Begin your story').click();
  11 |   await page.getByRole('button', { name: 'Open my tavern' }).click();
  12 |   await page.waitForTimeout(800);
  13 |   await page.mouse.click(5, 300);
  14 |   await page.waitForTimeout(500);
  15 |   await page.mouse.click(5, 300);
  16 |   await page.waitForTimeout(1500);
  17 |   // Skip the guide so its pointer does not hold the hints back.
  18 |   await page.locator('.first-ten button').first().click();
  19 |   const at = await page.evaluate(() => {
  20 |     const ph = (window as any).__ph;
  21 |     const stove = ph.st.items.find((i: any) => i.typeId === 'stove');
  22 |     return ph.worldToScreen({ x: stove.x, y: stove.y + 40 }, ph.st.shown);
  23 |   });
  24 |   await page.mouse.click(at.x, at.y);
> 25 |   await page.waitForFunction(() => document.querySelector('.hint-chip.on') !== null, null, { timeout: 8000 });
     |              ^ TimeoutError: page.waitForFunction: Timeout 8000ms exceeded.
  26 |   await page.waitForTimeout(700);
  27 |   await shot(page, '20-hint-chip');
  28 |   const seen = await page.evaluate(() => Object.values(localStorage).join('|'));
  29 |   expect(seen).toContain('hintsSeen');
  30 |   expect(errs.list.filter((e) => !/favicon/.test(e))).toEqual([]);
  31 | });
  32 | 
```