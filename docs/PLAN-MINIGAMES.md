# PLAN-MINIGAMES: the mine as a digging place, deeper dungeon, minigame gear, skill tree (planner, 17 Nov)

Status: DESIGN ONLY, no code, no data. Every number is a PROPOSAL: the owner checks ranked and balance numbers, then balance.ts tests and `npm run simulate` gate them (closed loops must hold). Fits docs/GAME-VISION.md (GATHER feeds MAKE; the player gets a say in HOW). Reuses docs/PLAN-UPGRADES.md (the rule shape), docs/RESEARCH-OA.md section 1 (fishing), docs/PLAN-FUN.md items 10 and 11 (shrines, boss).
Owner asks (17 Nov): (1) the mine = a random generated place with an exit, many block kinds, rare blocks (diamond...), you dig your way to the exit without dying; (2) the dungeon needs much more work; (3) minigame gear unlocked with found items (5 iron + 3 coal = a faster-mining helmet); (4) a SEPARATE point system, points per experience level, spent in a big skill tree (tavern, dungeon, fishing, mining).

## 0. Brief conflicts (CLAUDE.md must change, owner OK first)
- Section 10c says the mine "reuses the dungeon, rocks in place of chests, 4 min lantern". Point 1 replaces that with a DIG MINE (section 1). Lantern timer, rocks and the dungeon-style layout go away for the mine only; the dungeon keeps its layout.
- Section 10c forge slots weapon/armor/pickaxe/axe/rod: minigame gear adds new slot groups (section 3).
- PLAN-UPGRADES (OA-8, 1 point per level, 11 upgrades) is SUPERSEDED by the skill tree (section 4). Its pure shape is reused; its UI/balance/art tasks become MG tasks. Owner decides: merge (planner pick) or keep both point pools.
- Level cap 8 gives few points. PROPOSAL: extend levels.json to 12 (totalXp 450, 620, 830, 1090 added; hp and attack rules unchanged). If refused: 2 points per level at cap 8 = 14.

## 1. THE DIG MINE (owner point 1)
### 1.1 Player view
You enter by the Map (level 3, free). You arrive at the top of a block cave: a field of blocks (stone, dirt, clay, coal, copper, iron, mithril, sometimes crystal, gold, diamond) with a few open pockets. You PICKAXE your way: hold to repeat on the block under the finger (reuse BG5b hold-to-repeat, 400 ms pickaxe cooldown). A broken block leaves floor. Somewhere is the EXIT (a stair block with a lantern). Find it, then Leave (banks the bag) or Go deeper (depth +1: richer, harder). Death (0 hp) = carried out, half the visit's ore lost (existing MINE_DEATH_ORE_LOSS), wallet never lost.
Dangers (PROPOSAL): weak enemies in pockets (slime, bat, new rock beetle); cave-in tiles that crumble after you step off (700 ms visible crack tell, 4 dmg, never invisible); lava seams (a hint: place a block on them); gas pockets (cough slow). The 4 min lantern timer is dropped (no timer that punishes); light radius comes from gear and skills.
### 1.2 Generation (pure, seeded)
shared/src/dungeon/mineGen.ts: `generateDigMine(seed, depth, visit) -> MineMap { w, h (PROPOSAL 48x64 blocks), blocks, spawn, exit, pockets, rareSpots, enemies, hazards }`. Steps from the seeded rng: (a) fill with stone, a dirt band at the top; (b) cellular-automaton caves give 4 to 7 pockets; (c) the exit sits at least EXIT_MIN_DIST (40 path-blocks) from spawn; (d) a solvable route always exists (BFS over open or breakable cells, bedrock border never breakable) and costs under MINE_ROUTE_HITS_MAX; (e) ore veins by noise with weights per depth; (f) RARE blocks 0 to 2 per floor, 6+ blocks off the main route (a reason to detour); (g) enemies and hazards in pockets, none within 5 blocks of spawn. Same seed = same map (golden test).
### 1.3 Block kinds (data shared/data/mineBlocks.json, PROPOSALS)
| id | hits | drop | where | rank |
|---|---|---|---|---|
| stone | 2 | stone block | filler | common |
| dirt, clay | 1 | dirt, clay | top band | common |
| coal | 3 | 1-2 coal (new; forge and gear recipes) | all depths | common |
| copper | 3 | 1-2 copper ore | depth 1+ | common |
| iron | 5 | 1-2 iron ore | depth 1+ | common |
| mithril | 8 | 1-2 mithril ore | depth 2+ | rare |
| crystal | 6 | 1 crystal shard (gear, glow decor) | depth 2+ | rare |
| gold_vein | 7 | gold nugget | depth 3+ | rare |
| diamond | 12 | 1 diamond (gear, 3-5 gems) | 0-2 per floor, depth 3+ | ultra_rare |
| bedrock | none | none | border | - |
New materials get baseValue and SELL_RATES entries; closed loop (test group MG1): a block dug for free then sold never beats guest income per hour. A rare block glints faintly 3 blocks away (art only). RANK_COLORS and the ultra_rare sparkle are reused.
### 1.4 Reuse and what changes
Reuse: the 100 ms tick, run bag (12 slots, stack 10), bank.ts startMine/finishRun, gems and ledger, Book entries. New: a pure `mineStep` (dig progress per cell, hazards, exit) and a `DigMine` run state; the old rocks and legacyLayout stay until MG-5 lands, then leave the mine path. Runs are not saved mid-way (confirm in code), so no run SAVE bump.

## 2. DUNGEON WORK (owner point 2; ordered by value)
Today: DG1 layout done, DUNGEON_ROUND 1 (slimes, one floor). Proposals, each a task:
1. Turn round 2 on in stages: floors 1 to 3, enemy mix (skeleton, bat, ghost, mimic), depth scaling in data (dungeonThemes.json), simulate-dungeon as the gate.
2. Enemy behaviours (data `behaviour`): charger (tell, then a rush line), archer (range 6 blocks, 600 ms wind-up arrow, dodgeable), swarm (3 small at once), shielded (hit from the side or back). Each has a visible tell like the fishing `tell` events (readable = fair).
3. Shrines: heal 30%, OR +1 attack this run, OR a lucky chest next floor (PLAN-FUN 10).
4. Boss: Bone King, 3 phases, ring wind-up, guaranteed ranked drop, trophy furniture, Book line (PLAN-FUN 11).
5. Elite modifier: a marked enemy (+50% hp) drops a second roll: risk and reward without a timer.
6. Dungeon stats come from gear and skills through the ONE `effective` helper: max hp, damage reduction, attack cooldown, dodge window, run bag, potion heal.
Numbers stay in config/dungeon.ts and data; golden layout tests are repinned only when generation changes.

## 3. MINIGAME GEAR (owner point 3)
### 3.1 Model
New equip slots `helmet`, `gloves`, `harness`, `boots`, each piece tagged `minigame: mining | fishing | dungeon` and active ONLY inside that minigame (so swapping has a reason). They stack with forge weapon/armor/pickaxe. Pieces are CRAFTED at the Workshop (crafting.ts, recipes.json pattern, `station: 'workshop'`), never bought. Unlock = owning the found materials: a "blueprint" is just a recipe whose inputs include a rare find (diamond, fish part, crest), so no extra unlock flag; `requires.level` or `requires.skill` shows greyed with the reason.
Data shared/data/minigameGear.json: `{ id, name, minigame, slot, rank, recipe: {itemId: n}, requires?: { level?, skill? }, stats: { statId: value }, icon }`. Pure shared/src/minigameGear.ts: craft (through the ledger), equip, `gearStats(player, minigame)`. Player.minigameGear?: { owned: GearId[]; worn: Partial<Record<slot+minigame, GearId>> }. Stats are additive and go through the same `effective(base, stat, bonuses)` as skills (PLAN-UPGRADES 3): one bonuses object merges skills + gear, so a rule never knows the source.
### 3.2 First set (PROPOSALS)
MINING (stats digSpeedPct, oreBonusPct, lanternRadiusPlus, hazardDmgPct, mineBagPlus):
- Miner helmet (common): 5 iron ore + 3 coal -> dig +8%, light +1 (the owner's example).
- Copper grip gloves (common): 4 copper bar + 2 cloth -> dig +6%.
- Sturdy harness (common): 6 iron bar + 2 coal -> hazard damage -25%, bag +2.
- Crystal lamp helmet (rare): 3 crystal + 4 iron bar -> dig +14%, light +2, rare glints from 6 blocks.
- Diamond-tip gloves (ultra_rare): 2 diamond + 3 mithril bar -> dig +22%, ore bonus +10%.
FISHING (stats boxSizePct, tensionRisePct, biteWaitPct, rankOddsPct):
- Angler hat (common): 4 cloth + 2 fish scale -> bite wait -10%.
- Waders (common): 3 leather + 2 wood -> box +6%.
- Reel gloves (rare): 3 copper bar + 2 rare fish -> tension rise -12%.
- Lucky lure belt (ultra_rare): 1 legendary fish part + 2 gold nugget -> rank odds +4% (small: feeds BG9 loops).
DUNGEON (stats maxHpPlus, damageReduction, attackCooldownPct, runSpeedPct, runBagPlus):
- Reinforced cap (common): 3 iron bar + 2 cloth -> max hp +4.
- Scout boots (common): 3 leather + 1 iron bar -> run speed +6%.
- Quick-hand gloves (rare): 4 mithril bar + 2 coal -> attack cooldown -8% (350 ms base, floor 300).
- Bone harness (rare, Bone King crest): damage taken -1.
Caps in config (PROPOSAL: dig +40%, box +25%, attack cooldown -20%, rank odds total +6%). No stat raises gold directly. The bare-handed minigame stays winnable (never required).
New materials: coal, crystal shard, diamond, gold nugget, fish scale, leather, bone crest (baseValue, SELL_RATES, Book entries, balance test).

## 4. SKILL TREE (owner point 4)
### 4.1 Points
A separate pool, "Skill points": 1 per experience level from 2 (11 at cap 12; 2 per level if the cap stays 8) plus 1 per Book milestone (max 4). Earned by playing only, never bought, never lost, DERIVED (earned minus spent, never stored). Respec: 3 free, then 100 gold (ledger 'respec').
### 4.2 Shape
Four branches (TAVERN, DUNGEON, FISHING, MINING) around a hub, nodes in tiers 1 to 4, about 32 nodes in v1. A node has maxRank (1-3), cost per rank, `requires: nodeId[]` (same branch, previous tier); a tier-N node also needs (N-1)*2 points spent in its branch (depth over breadth). Panel = a pannable canvas of cards.
```
shared/data/skills.json  SkillNode { id; branch; tier 1..4; pos {x,y}; name; icon; maxRank; costs: number[];
                                      requires: string[]; effects: { stat: StatId; perRank: number; cap?: number }[] }
Player.skills?: { ranks: Record<string, number>; respecs: number }
```
Pure shared/src/skills.ts: pointsEarned(level, bookMilestones), pointsSpent, canBuySkill, buySkill, respec, skillStats(player). shared/src/stats.ts: `effective(base, stat, bonuses)` and `mergeBonuses` (this is PLAN-UPGRADES UPG-1; build it once). StatId grows with mining, fishing, dungeon and tavern ids.
### 4.3 First node set (PROPOSALS; tier: name (ranks): effect per rank)
TAVERN (the 10 PLAN-UPGRADES upgrades move here): T1 Quick feet (3): +6% room walk; T1 Steady hands (1): tray 4; T2 Roomy tavern (2): +1 seat; T2 Keen eye (2): pour window +0.03; T3 Big batch (2): +1 batch; T3 Wide kegs (1): tap cap 16; T4 Cellar racks (1): +1 cask (after OA-7); T4 Deep pockets (2): +6 bag slots.
DUNGEON: T1 Thick skin (3): +3 max hp; T1 Satchel (2): +2 run bag; T2 Sharp edge (2): +1 attack; T2 Light feet (2): +4% run speed; T3 Second wind (2): potion heal +20%; T3 Parry (1): enemy miss window +40 ms; T4 Treasure sense (2): chest glint +4 blocks; T4 Last stand (1): survive one lethal hit per run at 1 hp.
FISHING: T1 Patient (2): bite wait -8%; T1 Wide box (3): box +4%; T2 Reel master (2): tension rise -8%; T2 Bait saver (1): bait kept on 25% of casts; T3 Sharp eye (2): strike window +60 ms; T3 Deep cast (1): reeds spot in the lake table; T4 Trophy hunter (2): rank odds +2%; T4 Calm hands (1): a lost fish keeps the bait.
MINING: T1 Strong arm (3): dig +6%; T1 Lantern (2): light +1; T2 Ore sense (2): glints +3 blocks; T2 Careful step (2): hazard damage -20%; T3 Double strike (2): 8% a break counts double; T3 Pack mule (2): +2 mine bag; T4 Prospector (2): ore bonus +8%; T4 Gem eye (1): gem chance +3 points.
Sum of ranks far exceeds points: players pick a build. No node adds gold directly (CLAUDE.md 13, balance).
### 4.4 UI
Side button "Skills" with a dot while points are unspent (reuse the UPG-4 logic), panel via ui/panelShell.ts, branch tabs plus the pannable tree (drag, pinch), card (icon, pips, next cost, preview "Now 128 -> 136 px/s", Buy, locked reason), Respec asks first. Phone: bottom sheet, 44 px touch.

## 5. Save and rule notes
- SAVE_VERSION is 33; the next number is taken by whichever of OA-7, UPG-1 or MG lands first, so code uses current `SAVE_VERSION + 1` at that time. Bumps: MG-1 (Player.skills, optional; MIGRATIONS sets `{ranks:{},respecs:0}`; if UPG-1 landed, move `upgrades.ranks` into matching nodes), MG-6 (Player.minigameGear, optional, empty). Each migration test: nothing lost, idempotent, derived points never negative.
- No Date.now or Math.random in rules; generation takes a seed; the server can run the same pure functions later.
- Every gold change goes through applyChange (respec, crafting fees, sells).
- Gear and skill stats are folded into a `RunStats` snapshot passed at run start to step/mineStep, so tests stay deterministic and the server can verify.

## 6. Balance gates (tests the coder writes; numbers need the owner)
- MG1 mine: ore per hour with best gear and skills <= +60% over bare hands; a new player's first visit yields 3 to 6 ore (as now); dug blocks sold < guest income; diamond finds per hour reported.
- A bare-handed bot reaches the depth 1 exit on at least 80% of seeds; death loss stays half the ore.
- Fishing: the idle bot loses rare and up even at max gear; rank odds bonus total <= +6%.
- Dungeon: simulate-dungeon clear rate at level 3, bare vs full gear, inside bands (PROPOSAL 35% vs 70%).
- Skills: total points < sum of all ranks; each branch has at least 4 useful picks for 5 points.
- balance.ts: new materials keep every closed loop (sold < the value of what made it).
- `npm run simulate` gets tables MG and SK with the hourly gold share per source (guest cap 55% stays).

## 7. Tasks (one sonnet coder each; gates: `npm test`, `npm run typecheck`, tests next to the rules, CLAUDE.md/BRIEF/NOTES lines, NEWS entry, no ranked number without the owner)
- MG-1 Skill rules, data, stat helper, save. Files: shared/data/skills.json, shared/src/skills.ts, shared/src/stats.ts, types.ts, save.ts + SAVE bump, config/player.ts. Read PLAN-UPGRADES 1-4, levels.ts. Tests: rank 0 = base, caps, point supply, tier gate, respec (3 free, then 100 gold ledger 'respec'), migration (level 5 save = 4 unspent). No UI, no rule uses bonuses yet.
- MG-2 Level cap 12 (only after owner OK). Files: shared/data/levels.json, levels.ts, levels.test.ts, config/player.ts hint texts. Tests: hp/attack tables, xp never lost, level 8 saves stay valid.
- MG-3 Dig mine generator (pure). Files: shared/data/mineBlocks.json, shared/src/dungeon/mineGen.ts + mineGen.test.ts, config/mine.ts (new consts; old rocks stay). Tests: golden seed, exit reachable (BFS), rare blocks off route, nothing near spawn, rare count 0-2, weights per depth, determinism.
- MG-4 Dig mine step and run state. Files: shared/src/dungeon/mineStep.ts + test, run.ts (DigMine), bank.ts (startMine/finishRun for depth). Tests: dig per cell with cooldown, drops into the run bag (full = refused), hazards tell then hurt, death halves ore, exit = Leave or Deeper, RunStats hook at zero.
- MG-5 GameAPI and client mine view. Files: shared/src/api.ts, client/src/api/dungeonApi.ts, client/src/dungeon/ (block renderer, hold-to-dig, light layer), game/dungeonMode.ts, ui/runBar.ts. Placeholder code-art for new blocks. Tests: API round trip, e2e (enter, dig, find the exit). Update CLAUDE.md 10c and remove the old mine path.
- MG-6 Materials, recipes, minigame gear rules. Files: shared/data/minigameGear.json, shared/src/minigameGear.ts + test, materials.json, recipes.json, Player.minigameGear + SAVE bump + migration, balance.ts SELL_RATES. Tests: craft consumes inputs via ledger, one piece per slot per minigame, stats summed and capped, requires checked.
- MG-7 Hook stats into the minigames (depends MG-1, MG-4, MG-6). Files: dungeon/step.ts (RunStats input), fishing.ts (box, tension, bite wait), mineStep.ts, tavern rules by the UPG-2 pattern. One stat per commit, each tested: rank 0 unchanged, golden tests green, cap respected.
- MG-8 GameAPI skills and gear. Files: api.ts, progressApi.ts, localGameAPI.ts: getSkills, buySkill, respecSkills, getMinigameGear, craftGear, equipGear (null on bad input). Tests through the API.
- MG-9 Skill tree UI [ui]. Files: client/src/ui/skillTree.ts + css, sideButtons.ts, one hint chip. Pannable tree, cards, Buy, Respec confirm, dot, phone sheet. e2e desktop and phone.
- MG-10 Gear panel UI [ui]. Files: client/src/ui/gearPanel.ts (Bag > Gear tab, three minigame columns, equip, recipes with "need 5 iron ore, 3 coal" lines and locked reasons).
- MG-11 Dungeon round 2 content. Files: dungeon/step.ts, config/dungeon.ts, data enemies and dungeonThemes.json. Behaviours charger, archer, swarm, shielded with tells; DUNGEON_ROUND 2 gated by simulate-dungeon. Tests: deterministic, tell before damage, layout goldens only repinned if generation changes.
- MG-12 Shrines, elites, Bone King boss. Files: dungeon/placement.ts, step.ts, loot.json, rooms.ts. Tests: shrine choice applies once, elite second roll, boss phases, guaranteed ranked drop, trophy and Book line.
- MG-13 Fishing hooks (from RESEARCH-OA 1.2; skip what OA-3 already did). Files: fishing.ts, fish.json behaviours, tension, bait. Tests: idle bot loses rare+, perfect bot wins, a clumsy new player wins the first catch 90%.
- MG-14 Balance groups MG and SK. Files: balance.ts, balance.test.ts, tools/simulate-economy.ts, tools/simulate-dungeon.ts. Do not change numbers; if a bound fails, paste the table in NOTES and stop for the owner.
- MG-15 Art [artist]: 12 mine block tiles with 3 crack frames, glints, hazards, rock beetle, 13 gear icons, about 32 skill icons, Skills button icon. Endesga 32, spriteAssets.test green.
- MG-16 Tutorial, docs, playtest. Files: guide.json optional steps (first dig, first craft, first skill), CLAUDE.md 9/10/10c/10d, BRIEF, NOTES; [tester] plays levels 3 to 8 per path, reports in docs/FIXLIST.md.
Build order: MG-1, MG-3, MG-4, MG-6, MG-8, MG-7, MG-5, MG-9, MG-10, MG-11, MG-12, MG-13, MG-14; MG-15 in parallel from MG-5; MG-16 last; MG-2 whenever the owner agrees.

## 8. Owner decisions needed
1. Dig mine replaces the rock mine, lantern timer dropped, hazards (cave-in, gas) allowed?
2. Merge PLAN-UPGRADES into the skill tree (planner pick) or keep two pools?
3. Level cap 12 (planner pick) or cap 8 with 2 points per level?
4. Minigame gear works only inside its own minigame and is crafted only (planner pick)?
5. Stat caps and node numbers (dig +40%, box +25%, rank odds +6% total).
6. New rare materials (diamond, crystal, gold nugget) and their sell rates.
7. Depth unlimited or capped (PROPOSAL 10)?

## OWNER DECISIONS (17 Nov, answers to section 8)
1. Dig mine replaces the old mine, WITHOUT the lantern timer ("boring and annoying"): just enemies and loot, maybe a trap or something fun. Mine has an exit, random blocks, rare ores.
2. One merged point pool: PLAN-UPGRADES is folded into MG-1 (skill tree).
3. Level cap raised from 8 to 12 (MG-2).
4. Minigame gear works only inside its own minigame, crafted only, never bought.
5. "Yes on all": the proposed node numbers, rare materials and depth cap 10 are accepted as a first build; the manager shows the owner a short table after the first build; balance tests must hold.
Also (owner 17 Nov): minor actions may be automatic (coins after serving: done).
