# PLAN-UPGRADES: upgrade points from levels (OA-8; planner, 17 Nov)

Status: DESIGN ONLY, no code, no data. All numbers are PROPOSALS: the owner approves them, then balance.ts tests and `npm run simulate` gate them. Fits docs/GAME-VISION.md: levels come from the dungeon and mine (GATHER) and give the player a say in how MAKE and SERVE feel and how roomy BUILD is. One-time, earned by playing: no timers, no points for gems or money, no daily pressure (CLAUDE.md 13). Upgrades are small and cosy, never required to progress.

## 1. Points
Today: levels 1..8 (levels.json totalXp 0, 15, 40, 80, 140, 220, 320, 450; xp never lost). PROPOSAL: 1 point per level from level 2 (7 points at level 8) plus 1 point per Book milestone (25/50/75/100% moments of bookRewards.json, at most 4 in v1) = 11. Points never expire and death never takes them. Respec: free the first 3 times, then 100 gold (a sink).

## 2. Upgrades (v1, PROPOSAL; numbers live in data/config only)
| id | name | ranks (point cost) | effect per rank | note |
| walk_speed | Quick feet | 3 (1,1,2) | +6% walk speed in rooms (HOTEL_WALK_SPEED 128), +4% in dungeon/mine (80 px/s); caps +18% / +12% | enemy speeds unchanged |
| tavern_seats | Roomy tavern | 2 (1,2) | +1 seat capacity each (GUEST_MAX 8) | still limited by tables |
| bag_slots | Deep pockets | 3 (1,1,1) | +6 slots per bag tab (BAG_SLOTS 36) | convenience, bag already grows |
| run_bag | Bigger satchel | 2 (1,2) | +2 dungeon run bag slots (RUN_BAG_SLOTS 12, cap 16) | dungeon balance test |
| tray | Steady hands | 1 (2) | TRAY_MAX 3 -> 4 | |
| pour_window | Keen eye | 2 (1,1) | perfect window +0.03 each side (POUR_PERFECT_RANGE 0.85..1.15) | tip size unchanged |
| brew_batch | Big batch | 2 (1,2) | barrel +1 mug, stove STOVE_BATCH_MAX +1 | profit per ingredient unchanged |
| tap_cap | Wide kegs | 1 (1) | TAP_CAP 12 -> 16 | |
| cask_slots | Cellar racks | 1 (2) | CASK_SLOTS 3 -> 4 | listed only once the cellar exists (OA-7) |
| hotbar | Quick belt | 1 (1) | HOTBAR_SLOTS 6 -> 8 | phone width check |
Sum of all ranks is about 26 points against 11 earned: the player chooses a build, never buys everything. Short v1 list if smaller wanted: walk_speed, tavern_seats, bag_slots, tray, brew_batch, tap_cap.
Rules: no upgrade raises a gold amount directly (no "+10% coins"); caps keep content from becoming trivial.

## 3. Data shape
shared/data/upgrades.json plus pure rules in shared/src/upgrades.ts:
```
UpgradeDef { id; name; icon; maxRank; costs: number[]; requires?: { cellar?: true; level?: number }; effect: { stat: StatId; perRank: number; cap?: number } }
StatId = walkSpeedRoomPct | walkSpeedRunPct | seatsPlus | bagSlotsPlus | runBagPlus | trayPlus | pourWindowPlus | batchPlus | tapCapPlus | caskSlotsPlus | hotbarPlus
Player.upgrades?: { ranks: Partial<Record<UpgradeId, number>>; respecs: number }
```
Pure functions (no rng, no time): pointsEarned(level, bookMilestones), upgradeStats(player) -> all-zero bonuses when missing, canBuyUpgrade, buyUpgrade, respec, and ONE helper `effective(base, stat, bonuses)` that every rule uses. Unspent points are DERIVED (earned minus spent), never stored, so they cannot desync. The server validates the same rules later.

## 4. Save
SAVE_VERSION +1 (next free; OA-7 and TUT-2 also bump). `Player.upgrades` optional; MIGRATIONS[n] sets `{ ranks: {}, respecs: 0 }`. Test: a level 5 save has 4 unspent points, level 8 has 7 plus Book points, nothing lost, idempotent. Respec fee through ledger applyChange, reason 'respec'.

## 5. UI
- New side button "Upgrades" (ui/sideButtons.ts) with a small dot while points are unspent (no toast spam; one hint chip at level 2).
- Panel via ui/panelShell.ts: header "Upgrade points: 3", cards (icon, name, rank pips, next cost, effect text, Buy, locked reason), preview "Now 128 -> 136 px/s". Respec button asks first. Phone: bottom sheet, 44 px touch.
- Tutorial: optional guide step `upgrades` after the first level-up, target the Upgrades button, ticks on opening the panel, never blocks.

## 6. Balance expectations (tests the coder writes; numbers need the owner)
- Walk: dungeon +12% max; enemy chase 192 px still gives a fair fight; hourly gold in `npm run simulate` moves under 5% with max walk, tray and tap upgrades.
- Seats: never above seats or GUEST_MAX; hourly gold with +2 seats at level 8 stays under the 55% guest-share cap; table in simulate section UPG.
- Bag and run bag: dungeon gold per hour rises at most 15% (PROPOSAL); gem and pack income targets (BG9, about 55 gems per hour new) hold.
- brew_batch: gold per brew-minute rises at most 25% at max; ingredient closed loops hold.
- Every upgrade: base at rank 0, base + perRank x rank below the cap, capped at the cap.
- Point supply: total possible points < sum of all ranks, and enough for the 4 cheapest useful picks.

## 7. Tasks (one coder session each; gates: `npm test`, `npm run typecheck`, tests next to rules, CLAUDE.md/BRIEF/NOTES lines, NEWS entry, no ranked number without the owner)

### UPG-1 [coder] Rules, data, stat helper, save
Prompt: Read docs/PLAN-UPGRADES.md sections 1 to 4, shared/src/levels.ts, bookRewards handling, config/player.ts, save.ts. Create shared/data/upgrades.json (all numbers PROPOSAL), shared/src/upgrades.ts (pointsEarned, upgradeStats, canBuyUpgrade, buyUpgrade, respec, effective) with tests (rank 0 = base, caps, point supply, respec 3 free then 100 gold via ledger reason 'respec', derived unspent never negative). Add optional Player.upgrades, SAVE bump + MIGRATIONS + test. No UI; no rule uses bonuses yet.

### UPG-2 [coder] Hook stats into the rules (one stat per commit, each tested)
Prompt: Read PLAN-UPGRADES 2 and 6. Route each effect through upgrades.effective: walk speed (avatarWalk; dungeon step gets bonuses through its input or run start state, no Date.now, golden tests stay green at rank 0), seats, bag tab size, run bag slots, tray.ts, pour.ts, brewing.ts and stove batch max, taps.ts, casks.ts, hotbar. Test base at rank 0, bonus at rank n, cap.

### UPG-3 [coder] GameAPI actions
Prompt: Add getUpgrades(), buyUpgrade(id), respecUpgrades() to shared/src/api.ts and LocalGameAPI (progressApi.ts); null on bad input, gold only via ledger. Level-up and Book milestones expose "points gained" for a toast. Tests through the API.

### UPG-4 [ui] Upgrades panel and button
Prompt: Read docs/UI-REFERENCE.md, ui/panelShell.ts, sideButtons.ts, skin.css. Build the panel of plan section 5 (cards, pips, preview, Buy, Respec with confirm, locked reasons, dot, one hint chip at level 2, phone sheet, 44 px). Placeholder icon. e2e smoke desktop and phone: level 3 save, buy a rank, see the text change.

### UPG-5 [coder] Balance group UPG and simulate section
Prompt: Read balance.ts, balance.test.ts, tools/simulate-economy.ts. Add the section 6 tests and a simulate table UPG (hourly gold at rank 0 and max for new, level 3, level 8). Do not change numbers; if a bound fails, paste the table into NOTES and stop for the owner.

### UPG-6 [artist] Icons
Prompt: 11 upgrade icons, the side-button icon and rank pips, Endesga 32, read docs/ART-STYLE.md, spriteAssets.test green.

### UPG-7 [coder] Tutorial and docs
Prompt: Add the optional `upgrades` step to shared/data/guide.json, update docs/GUIDE-UPDATE.md, CLAUDE.md 9 and 10, BRIEF.md, NOTES.md.

### UPG-8 [tester] Playtest
Prompt: Play levels 1 to 8 with each upgrade path; report feel and anything that trivialises dungeon or tavern in docs/FIXLIST.md. No production code.

## 8. Owner decisions needed
1. Point supply: 1 per level from 2 plus 4 Book points (11)? Raise the level cap beyond 8 later?
2. Which upgrades in v1: all 11 or the short list of 6?
3. Effect sizes and caps (walk +6% per rank, dungeon cap +12%, seats +1, bag +6, run bag +2, tray 4, tap cap 16)?
4. Respec: 3 free then 100 gold, or always free?
5. May upgrades touch the DUNGEON (walk, run bag) or only hotel and tavern?
6. cask_slots only after OA-7 lands (planner pick)?
