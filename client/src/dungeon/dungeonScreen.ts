// The dungeon in the game (step 9): runs a DungeonRun through the GameAPI, draws it with the
// DungeonView, and drives the HUD and the screens. Rendering and input only: every rule is in
// shared/ (step()); the GameAPI moves the run.
//
// - Every frame the elapsed time is handed to api.dungeonAdvance (one call at a time; time that
//   passes while a call is out is added to the next one, so no tick is ever skipped).
// - Taps: an enemy (only lit ones) = click_enemy (one hit per tap, 350 ms cooldown); a chest = walk
//   onto it; anything else = walk there. The potion button or Q drinks.
// - The run stops (halted) while the Resume panel, the exit choice or the result screen shows. A
//   hidden tab pauses the run and asks for Resume.
// - The camera follows the player (2 device px per art px, or about 1.25 CSS px on a dense phone
//   screen); pinch and the wheel still zoom.

import type { Application } from 'pixi.js';
import {
  rankOf,
  CHEST_OPEN_MS,
  FX_SHAKE_STEP_MS,
  DUNGEON_CSS_PX_PER_ART_PX,
  DUNGEON_DEVICE_PX_PER_ART_PX,
  DUNGEON_NAV_CELL,
  steerCellChange,
  LEVEL_FLASH_MS,
  LEVEL_TOTAL_XP,
  MINE_LANTERN_MS,
  FLOAT_STAGGER_MS,
  ZOOM_MIN,
  cameraAt,
  getFurnitureType,
  getMaterialType,
  introZoom,
  isMaterialId,
  snapCamera,
  worldToScreen,
  xpForNextLevel,
  type AvatarLook,
  type Camera,
  type DungeonInput,
  type DungeonRun,
  type FoodBuff,
  type GameAPI,
  type Point,
  type Rank,
  type RunResult,
  type RunUpdate,
} from '@pixel-hotel/shared';
import type { InfoPanel } from '../ui/infoPanel.ts';
import type { RunBar } from '../ui/runBar.ts';
import type { Toast } from '../ui/toast.ts';
import { flashScreen, showExitChoice, showResume, showRunResult } from '../ui/runScreens.ts';
import { DungeonView } from './dungeonView.ts';
import { FloatTexts } from './floatTexts.ts';
import type { GainPopups } from '../ui/gainPopups.ts';
import type { SoundName } from '../audio/sound.ts';
import { easeOutQuad } from '../fx/ease.ts';
import { fxSpec, isLowHp, type FxContext, type FxSpec } from '../fx/fxSpec.ts';
import { HitStop, frameTimes } from '../fx/hitStop.ts';
import { Shake } from '../fx/shake.ts';

export interface DungeonContext {
  app: Application;
  ui: HTMLElement;
  api: GameAPI;
  info: InfoPanel;
  runBar: RunBar;
  toast: Toast;
  /** Plays a sound (atmosphere step). */
  sound(name: SoundName, rank?: Rank): void;
  /** The Reduce effects pref (outdoors rework C11): no hit-stop, shake, particles, squash, fades or overlays; damage numbers and sounds stay. */
  reduceEffects(): boolean;
  dpr(): number;
  /** The run ended and its screen was closed: back to the room the player came from. */
  onDone(result: RunResult): Promise<void>;
  /** The gain popups above the avatar's head (step BG3b): what the run's chests, kills and rocks gave. */
  popups: GainPopups;
  /** "hotel room" or "shop": where the result screen's button goes. */
  backTo(): string;
}

/** How many drops pop out of a chest or a kill, by the rank of the find. */
const LOOT_POP_COUNT: Record<Rank, number> = { common: 2, rare: 3, ultra_rare: 4, legendary: 5 };

/** The floating text when a food buff starts (step 9b). */
const BUFF_TEXT: Record<FoodBuff, string> = { attack: '+1 attack', max_hp: '+10 max hp', attack_cooldown: 'faster hits' };

export class DungeonScreen {
  private readonly view: DungeonView;
  private readonly floats: FloatTexts;
  private run: DungeonRun | null = null;
  /** The run one tick earlier (for smooth drawing), null right after a floor change. */
  private prev: DungeonRun | null = null;
  private active = false;
  /** True while a panel (Resume, exit, result) waits for the player: the run does not move. */
  private halted = false;
  private busy = false;
  private pendingMs = 0;
  private clockMs = 0;
  private zoom = 1;
  private readonly shake = new Shake(FX_SHAKE_STEP_MS);
  private readonly hitStop = new HitStop();
  /** The hurt edge pulse: ms left and its total (the overlay fades with it). */
  private edgeMs = 0;
  private edgeTotal = 1;
  private readonly hurtEdge: HTMLElement;
  private readonly lowHpEl: HTMLElement;
  private shown: Camera = { x: 0, y: 0, zoom: 1 };

  constructor(private readonly ctx: DungeonContext, look: AvatarLook) {
    this.view = new DungeonView(look);
    this.view.world.visible = false;
    ctx.app.stage.addChild(this.view.world, this.view.light.vignette);
    this.floats = new FloatTexts(ctx.ui);
    // One landmark line per floor, when it first comes into sight (toasts stay at reading pace).
    this.view.onLandmark = (text) => ctx.toast(text);
    // Screen overlays; shown and hidden here, drawn by CSS (.hurt-edge, .low-hp). Empty and invisible without that CSS.
    this.hurtEdge = document.createElement('div');
    this.hurtEdge.className = 'hurt-edge';
    this.lowHpEl = document.createElement('div');
    this.lowHpEl.className = 'low-hp';
    for (const o of [this.hurtEdge, this.lowHpEl]) {
      o.style.display = 'none';
      o.style.pointerEvents = 'none';
      ctx.ui.appendChild(o);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active && !this.halted && this.run?.status === 'active') void this.pauseForResume('The game was in the background.');
    });
  }

  private steerKey: string | null = null;

  get isActive(): boolean {
    return this.active;
  }

  /** Which place the run on screen is (the tutorial tells a mine visit from a dungeon run). */
  get place(): string | null {
    return this.run?.place ?? null;
  }

  /** The camera the gestures work on (only its zoom is kept: the camera follows the player). */
  get camera(): Camera {
    return this.shown;
  }

  setCamera(cam: Camera): void {
    this.zoom = cam.zoom;
  }

  setLook(look: AvatarLook): void {
    this.view.setLook(look);
  }

  /** Shows the dungeon with this run. `paused`: loaded from a save, waits for Resume first. */
  async enter(run: DungeonRun, paused: boolean): Promise<void> {
    this.active = true;
    this.run = run;
    this.prev = null;
    this.pendingMs = 0;
    this.view.world.visible = true;
    this.resetFx();
    const dpr = this.ctx.dpr();
    const devicePx = Math.max(DUNGEON_DEVICE_PX_PER_ART_PX, Math.round(DUNGEON_CSS_PX_PER_ART_PX * dpr));
    this.zoom = introZoom(ZOOM_MIN, dpr, devicePx);
    this.hud();
    this.render(0);
    if (paused) await this.pauseForResume('Your run was saved. Tap Resume to go on.');
    else this.checkStatus();
  }

  /** A tap on the dungeon (world px). */
  tap(p: Point, slack = 0): void {
    const run = this.run;
    if (!this.active || this.halted || !run || run.status !== 'active') return;
    const enemy = this.view.enemyAt(run, p);
    if (enemy) {
      this.input({ t: 'click_enemy', id: enemy.id });
      return;
    }
    // The mine (step 9c): a tap on a rock walks there and swings.
    const rock = this.view.rockAt(run, p, slack);
    if (rock) {
      this.input({ t: 'click_rock', id: rock.id });
      return;
    }
    // A gem pile (step BG4): walk onto it.
    const pile = this.view.pickupAt(run, p);
    if (pile) {
      this.input({ t: 'click_point', x: pile.x, y: pile.y });
      return;
    }
    const chest = this.view.chestAt(run, p, slack);
    this.input(chest ? { t: 'click_point', x: chest.x, y: chest.y } : { t: 'click_point', x: p.x, y: p.y });
  }

  /**
   * Hold to walk / steer: walks toward a world point while the pointer is down; re-paths only when the pointer
   * enters another 16 px cell. Never hits (on an enemy it only walks to its spot; a hit stays one per tap).
   * steer(null) resets the cell memory (call on release).
   */
  steer(p: Point | null): void {
    if (p === null) {
      this.steerKey = null;
      return;
    }
    const run = this.run;
    if (!this.active || this.halted || !run || run.status !== 'active') return;
    const key = steerCellChange(this.steerKey, p, DUNGEON_NAV_CELL);
    if (key === null) return;
    this.steerKey = key;
    this.input({ t: 'click_point', x: p.x, y: p.y });
  }

  /** Hold to repeat (BG5b): the mine rock under a point, or null. Only in the mine; fights stay one hit per tap. */
  rockUnder(p: Point): number | null {
    const run = this.run;
    if (!this.active || this.halted || !run || run.status !== 'active' || run.place !== 'mine') return null;
    if (this.view.enemyAt(run, p)) return null;
    return this.view.rockAt(run, p)?.id ?? null;
  }

  /** One held swing: asks again for the same rock (the step function keeps the 400 ms cooldown). 'stop' = it is gone. */
  holdRock(id: number): 'go' | 'stop' | 'retry' {
    const run = this.run;
    if (!this.active || this.halted || !run || run.status !== 'active' || !run.rocks.some((x) => x.id === id)) return 'stop';
    // Too early by the run's own clock: the click would be ignored, so wait (the hold keeps its place).
    if (run.timeMs + run.carryMs < run.player.pickReadyAt && run.player.targetRockId === id) return 'retry';
    this.input({ t: 'click_rock', id });
    return 'go';
  }

  potion(): void {
    const run = this.run;
    if (!run || this.halted) return;
    if (run.player.potions <= 0) {
      this.ctx.toast('No potions left. Buy them in the Workshop (Blacksmith).');
      return;
    }
    this.input({ t: 'drink_potion' });
  }

  /** The mine's Leave button (step 9c): walk out now with everything. */
  leave(): void {
    if (!this.run || this.halted || this.run.place !== 'mine') return;
    this.input({ t: 'leave' });
  }

  /** The crypt's Abandon button (after its own question): give up the run, like a defeat. */
  abandon(): void {
    if (!this.run || this.halted || this.run.place === 'mine') return;
    this.input({ t: 'abandon' });
  }

  /** The food button or E (step 9b): eats the first lunch box food that does something now. */
  eat(): void {
    const run = this.run;
    if (!run || this.halted) return;
    if (run.player.food.length === 0) {
      this.ctx.toast('Your lunch box is empty. Cook food at your farm and pick it when you enter.');
      return;
    }
    this.input({ t: 'eat' });
  }

  /** Called every frame. */
  frame(dtMs: number): void {
    if (!this.active || !this.run) return;
    // Hit-stop holds back the DRAWING only: the run gets the real dt (frameTimes keeps runMs = dt).
    const t = frameTimes(dtMs, this.hitStop);
    if (!this.halted) {
      this.pendingMs += t.runMs;
      if (!this.busy) {
        const take = this.pendingMs;
        this.pendingMs = 0;
        this.busy = true;
        void this.ctx.api.dungeonAdvance(take).then((u) => {
          this.busy = false;
          if (u) this.handle(u);
        });
      }
    }
    this.render(t.drawMs, t.skipDraw);
  }

  private input(input: DungeonInput): void {
    void this.ctx.api.dungeonInput(input).then((u) => u && this.handle(u));
  }

  private async pauseForResume(text: string): Promise<void> {
    this.halted = true;
    await this.ctx.api.dungeonPause();
    await showResume(this.ctx.ui, text);
    await this.ctx.api.dungeonResume();
    this.pendingMs = 0;
    this.halted = false;
    this.checkStatus();
  }

  /** Takes a run update: smooth drawing, effects for its events, the HUD, the end screens. */
  private handle(u: RunUpdate): void {
    const before = this.run;
    if (!before) return;
    if (u.run.map !== before.map) this.prev = null;
    else if (u.run.timeMs !== before.timeMs) this.prev = before;
    this.run = u.run;
    this.ctx.popups.show(u.gains);
    this.effects(u.run, before);
    this.hud();
    if (u.result) void this.finish(u.result);
    else this.checkStatus();
  }

  private checkStatus(): void {
    const run = this.run;
    if (!run || this.halted || run.status !== 'exit_choice') return;
    this.halted = true;
    void showExitChoice(this.ctx.ui, { floor: run.floor, maxFloors: run.maxFloors, slots: run.bag.slots.length, gold: run.bag.gold }).then((choice) => {
      this.halted = false;
      this.pendingMs = 0;
      this.input({ t: 'choose_exit', choice });
    });
  }

  private async finish(result: RunResult): Promise<void> {
    this.halted = true;
    this.hitStop.clear();
    this.render(0);
    await showRunResult(this.ctx.ui, result, this.ctx.backTo());
    this.active = false;
    this.halted = false;
    this.run = null;
    this.prev = null;
    this.view.world.visible = false;
    this.view.light.vignette.visible = false;
    this.resetFx();
    this.floats.clear();
    this.ctx.popups.clear();
    await this.ctx.onDone(result);
  }

  private hud(): void {
    const run = this.run;
    if (!run) return;
    const p = run.player;
    const lantern = run.lanternEndsAt !== null ? { leftMs: run.lanternEndsAt - run.timeMs, totalMs: MINE_LANTERN_MS } : undefined;
    this.ctx.info.setRun({ floor: run.floor, maxFloors: run.maxFloors, hp: p.hp, maxHp: p.maxHp, ...(lantern ? { lantern } : {}) });
    this.ctx.info.setStats(p.level, p.xp, xpForNextLevel(p.level), LEVEL_TOTAL_XP[p.level - 1] ?? 0);
    this.ctx.runBar.refresh(run);
  }

  private resetFx(): void {
    this.hitStop.clear();
    this.shake.clear();
    this.edgeMs = 0;
    this.view.particles.clear();
    this.hurtEdge.style.display = 'none';
    this.lowHpEl.style.display = 'none';
  }

  /** What the effects need to know about the world right now (positions are the ones drawn). */
  private fxContext(run: DungeonRun, before: DungeonRun): FxContext {
    const v = this.view;
    return {
      reduce: this.ctx.reduceEffects(),
      player: v.playerAt,
      attackMin: run.player.attackMin,
      attackMax: run.player.attackMax,
      enemy: (id) => {
        const e = run.enemies.find((x) => x.id === id) ?? before.enemies.find((x) => x.id === id);
        const feet = v.enemyFeet(id);
        return e ? { kind: e.kind, mimic: e.mimic, x: feet?.x ?? e.x, y: feet?.y ?? e.y } : null;
      },
      rock: (id) => run.rocks.find((x) => x.id === id) ?? before.rocks.find((x) => x.id === id) ?? null,
    };
  }

  /** Turns one effect spec (fx/fxSpec.ts) into a change in the view, a particle burst, a float text, a pulse or a sound. */
  private applySpec(s: FxSpec, lootAt: Point, head: Point, run: DungeonRun): void {
    const v = this.view;
    switch (s.t) {
      case 'hitStop':
        this.hitStop.trigger(s.ms);
        break;
      case 'shake':
        this.shake.kick(s.px, s.ms);
        break;
      case 'squash':
        v.squashEnemy(s.enemyId);
        break;
      case 'knockback':
        v.knockEnemy(s.enemyId, s.dx, s.dy, s.px);
        break;
      case 'sparks':
        v.particles.sparks(s.at, s.count);
        break;
      case 'floatText':
        this.floats.add(s.at ?? head, s.style === 'big' ? `${s.text}!` : s.text, s.style === 'big' ? 'crit' : s.style);
        break;
      case 'burst':
        v.particles.burst(s.at, s.bits, s.count);
        break;
      case 'fadeOut':
        v.fadeEnemy(s.enemyId, s.ms);
        break;
      case 'chestOpen': {
        v.openChest(s.chestId);
        const c = run.chests.find((x) => x.id === s.chestId);
        if (c) v.particles.sparks({ x: c.x, y: c.y - 14 }, 5);
        break;
      }
      case 'lootPop':
        v.particles.lootPop({ x: lootAt.x, y: lootAt.y + 12 }, lootAt.y + 28, s.rank, LOOT_POP_COUNT[s.rank]);
        break;
      case 'telegraph':
        v.telegraphEnemy(s.enemyId, s.ms);
        break;
      case 'edgePulse':
        this.edgeMs = s.ms;
        this.edgeTotal = s.ms;
        break;
      case 'sound':
        this.ctx.sound(s.name, s.rank);
        break;
    }
  }

  private effects(run: DungeonRun, before: DungeonRun): void {
    const v = this.view;
    const head = (): Point => ({ x: v.playerAt.x, y: v.playerAt.y - 64 });
    const fxCtx = this.fxContext(run, before);
    let lootAt: Point = head();
    let stagger = 0;
    const leftBehind: string[] = [];
    for (const e of run.events) {
      switch (e.t) {
        case 'hit':
          v.flashEnemy(e.enemyId);
          break;
        case 'enemy_hit':
          v.hurtPlayer();
          break;
        case 'kill': {
          lootAt = v.enemyPoint(e.enemyId) ?? head();
          stagger = 0;
          this.floats.add(lootAt, `+${e.xp} xp`, 'xp', FLOAT_STAGGER_MS * stagger++);
          break;
        }
        case 'chest': {
          const c = run.chests.find((x) => x.id === e.chestId);
          lootAt = c ? { x: c.x, y: c.y - 24 } : head();
          // The drops float up once the lid is open.
          stagger = Math.ceil(CHEST_OPEN_MS / FLOAT_STAGGER_MS);
          break;
        }
        case 'loot': {
          // Items show as popups above the head (step BG3b); gold keeps its floating text. With popups off, the text stays.
          if (e.item !== 'gold' && this.ctx.popups.enabled()) break;
          const name = e.item === 'gold' ? `+${e.qty} gold` : isMaterialId(e.item) ? `+${e.qty} ${getMaterialType(e.item).name}` : `${getFurnitureType(e.item).name}!`;
          // Its rank colour (a rare pile of gold too); common drops keep the plain loot colour.
          const rank = e.rank ?? (e.item === 'gold' ? 'common' : rankOf(e.item));
          this.floats.add(lootAt, name, 'loot', FLOAT_STAGGER_MS * stagger++, rank === 'common' ? null : rank);
          break;
        }
        case 'gem_pickup':
          this.ctx.sound('coin');
          if (!this.ctx.popups.enabled()) this.floats.add(head(), `+${e.qty} gems`, 'loot');
          break;
        case 'left_behind':
          leftBehind.push(e.item.kind === 'material' ? getMaterialType(e.item.id).name : getFurnitureType(e.item.typeId).name);
          break;
        case 'potion':
          this.floats.add(head(), `+${e.healed}`, 'heal');
          break;
        case 'eat':
          if (e.healed > 0) this.floats.add(head(), `+${e.healed}`, 'heal');
          if (e.buff) this.floats.add(head(), BUFF_TEXT[e.buff], 'xp');
          break;
        case 'level_up':
          flashScreen(this.ctx.ui, LEVEL_FLASH_MS);
          this.floats.add(head(), `Level ${e.level}!`, 'xp', 0);
          this.ctx.toast(`Level ${e.level}! Full health, and you are stronger.`);
          break;
        case 'stairs':
          this.prev = null;
          this.ctx.toast(`Floor ${e.floor}. The stairs gave you a rest: +${e.healed} hp.`);
          break;
        case 'swing':
          v.shakeRock(e.rockId);
          break;
        case 'too_hard': {
          const rk = run.rocks.find((x) => x.id === e.rockId);
          this.floats.add(rk ? { x: rk.x, y: rk.y - 30 } : head(), 'too hard!', 'info');
          this.ctx.toast('Mithril needs the steel pickaxe. Make it at the Forge (Workshop).');
          break;
        }
        case 'rock_broken': {
          const was = before.rocks.find((x) => x.id === e.rockId) ?? null;
          lootAt = was ? { x: was.x, y: was.y - 24 } : head();
          stagger = 0;
          break;
        }
        case 'lantern_out':
          this.ctx.toast('Your lantern went out. You walk out with everything.');
          break;
        case 'boss_banked':
          this.ctx.toast('The Bone King falls! Everything in your bag is safe now.');
          break;
        default:
          break;
      }
      // The look and sound of the event: hit-stop, shake, sparks, bursts, fades, pings (fx/fxSpec.ts, pure and tested).
      for (const s of fxSpec(e, fxCtx)) this.applySpec(s, lootAt, head(), run);
    }
    if (leftBehind.length > 0) this.ctx.toast(`Your bag is full: ${[...new Set(leftBehind)].join(', ')} left behind.`);
  }

  /** Draws one frame. `skip` = a hit-stop holds the picture (the caller worked out the times with frameTimes). */
  private render(dtMs: number, skip = false): void {
    const run = this.run;
    if (!run || skip) return;
    const reduce = this.ctx.reduceEffects();
    if (reduce && !this.view.reduce) this.resetFx();
    this.view.reduce = reduce;
    this.floats.pop = !reduce;
    const rdt = dtMs;
    this.clockMs += rdt;
    this.view.render(run, this.prev, rdt, this.clockMs);
    const { app } = this.ctx;
    const w = app.screen.width;
    const h = app.screen.height;
    let cam = cameraAt(this.view.playerAt, this.zoom, w, h);
    const off = this.shake.update(rdt);
    cam = { ...cam, x: cam.x + off.x / this.zoom, y: cam.y + off.y / this.zoom };
    this.shown = snapCamera(cam, this.ctx.dpr());
    this.view.world.scale.set(this.shown.zoom);
    this.view.world.position.set(-this.shown.x * this.shown.zoom, -this.shown.y * this.shown.zoom);
    this.view.light.layoutVignette(w, h);
    this.floats.update(rdt, (p) => worldToScreen(p, this.shown));
    this.ctx.popups.update(worldToScreen({ x: this.view.playerAt.x, y: this.view.playerAt.y - 64 }, this.shown));
    // Hurt edge pulse and the low hp heartbeat vignette (HTML overlays; their look is CSS: .hurt-edge and .low-hp).
    this.edgeMs = Math.max(0, this.edgeMs - rdt);
    this.hurtEdge.style.display = this.edgeMs > 0 ? '' : 'none';
    if (this.edgeMs > 0) this.hurtEdge.style.opacity = String(easeOutQuad(this.edgeMs / Math.max(1, this.edgeTotal)));
    this.lowHpEl.style.display = !reduce && run.status === 'active' && isLowHp(run.player.hp, run.player.maxHp) ? '' : 'none';
  }
}
