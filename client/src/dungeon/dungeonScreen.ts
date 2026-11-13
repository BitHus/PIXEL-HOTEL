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
  CHEST_OPEN_MS,
  HIT_SHAKE_PX,
  HURT_SHAKE_PX,
  DUNGEON_CSS_PX_PER_ART_PX,
  DUNGEON_DEVICE_PX_PER_ART_PX,
  LEVEL_FLASH_MS,
  LEVEL_TOTAL_XP,
  MINE_LANTERN_MS,
  FLOAT_STAGGER_MS,
  SCREEN_SHAKE_MS,
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
  type RunResult,
  type RunUpdate,
} from '@pixel-hotel/shared';
import type { InfoPanel } from '../ui/infoPanel.ts';
import type { RunBar } from '../ui/runBar.ts';
import type { Toast } from '../ui/toast.ts';
import { flashScreen, showExitChoice, showResume, showRunResult } from '../ui/runScreens.ts';
import { DungeonView } from './dungeonView.ts';
import { FloatTexts } from './floatTexts.ts';

export interface DungeonContext {
  app: Application;
  ui: HTMLElement;
  api: GameAPI;
  info: InfoPanel;
  runBar: RunBar;
  toast: Toast;
  dpr(): number;
  /** The run ended and its screen was closed: back to the room the player came from. */
  onDone(result: RunResult): Promise<void>;
  /** "hotel room" or "shop": where the result screen's button goes. */
  backTo(): string;
}

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
  private shake = { ms: 0, px: 0 };
  private shown: Camera = { x: 0, y: 0, zoom: 1 };

  constructor(private readonly ctx: DungeonContext, look: AvatarLook) {
    this.view = new DungeonView(look);
    this.view.world.visible = false;
    ctx.app.stage.addChild(this.view.world);
    this.floats = new FloatTexts(ctx.ui);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active && !this.halted && this.run?.status === 'active') void this.pauseForResume('The game was in the background.');
    });
  }

  get isActive(): boolean {
    return this.active;
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
    const dpr = this.ctx.dpr();
    const devicePx = Math.max(DUNGEON_DEVICE_PX_PER_ART_PX, Math.round(DUNGEON_CSS_PX_PER_ART_PX * dpr));
    this.zoom = introZoom(ZOOM_MIN, dpr, devicePx);
    this.hud();
    this.render(0);
    if (paused) await this.pauseForResume('Your run was saved. Tap Resume to go on.');
    else this.checkStatus();
  }

  /** A tap on the dungeon (world px). */
  tap(p: Point): void {
    const run = this.run;
    if (!this.active || this.halted || !run || run.status !== 'active') return;
    const enemy = this.view.enemyAt(run, p);
    if (enemy) {
      this.input({ t: 'click_enemy', id: enemy.id });
      return;
    }
    // The mine (step 9c): a tap on a rock walks there and swings.
    const rock = this.view.rockAt(run, p);
    if (rock) {
      this.input({ t: 'click_rock', id: rock.id });
      return;
    }
    const chest = this.view.chestAt(run, p);
    this.input(chest ? { t: 'click_point', x: chest.x, y: chest.y } : { t: 'click_point', x: p.x, y: p.y });
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
    this.clockMs += dtMs;
    if (!this.halted) {
      this.pendingMs += dtMs;
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
    this.render(dtMs);
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
    this.render(0);
    await showRunResult(this.ctx.ui, result, this.ctx.backTo());
    this.active = false;
    this.halted = false;
    this.run = null;
    this.prev = null;
    this.view.world.visible = false;
    this.floats.clear();
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

  private shakeBy(px: number): void {
    if (px >= this.shake.px || this.shake.ms <= 0) this.shake = { ms: SCREEN_SHAKE_MS, px };
  }

  private effects(run: DungeonRun, before: DungeonRun): void {
    const v = this.view;
    const head = (): Point => ({ x: v.playerAt.x, y: v.playerAt.y - 64 });
    let lootAt: Point = head();
    let stagger = 0;
    const leftBehind: string[] = [];
    for (const e of run.events) {
      switch (e.t) {
        case 'hit': {
          v.flashEnemy(e.enemyId);
          this.floats.add(v.enemyPoint(e.enemyId) ?? head(), `-${e.damage}`, 'damage');
          this.shakeBy(HIT_SHAKE_PX);
          break;
        }
        case 'enemy_hit':
          v.hurtPlayer();
          this.floats.add(head(), `-${e.damage}`, 'hurt');
          this.shakeBy(HURT_SHAKE_PX);
          break;
        case 'enemy_miss':
          this.floats.add(head(), 'dodged!', 'info');
          break;
        case 'kill': {
          lootAt = v.enemyPoint(e.enemyId) ?? head();
          stagger = 0;
          this.floats.add(lootAt, `+${e.xp} xp`, 'xp', FLOAT_STAGGER_MS * stagger++);
          break;
        }
        case 'chest': {
          v.openChest(e.chestId);
          const c = run.chests.find((x) => x.id === e.chestId);
          lootAt = c ? { x: c.x, y: c.y - 24 } : head();
          // The drops float up once the lid is open.
          stagger = Math.ceil(CHEST_OPEN_MS / FLOAT_STAGGER_MS);
          break;
        }
        case 'loot': {
          const name = e.item === 'gold' ? `+${e.qty} gold` : isMaterialId(e.item) ? `+${e.qty} ${getMaterialType(e.item).name}` : `${getFurnitureType(e.item).name}!`;
          this.floats.add(lootAt, name, 'loot', FLOAT_STAGGER_MS * stagger++);
          break;
        }
        case 'left_behind':
          leftBehind.push(e.item.kind === 'material' ? getMaterialType(e.item.id).name : getFurnitureType(e.item.typeId).name);
          break;
        case 'mimic':
          this.floats.add(v.enemyPoint(e.enemyId) ?? head(), 'A mimic!', 'hurt');
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
          this.shakeBy(HIT_SHAKE_PX / 2);
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
    }
    if (leftBehind.length > 0) this.ctx.toast(`Your bag is full: ${[...new Set(leftBehind)].join(', ')} left behind.`);
  }

  private render(dtMs: number): void {
    const run = this.run;
    if (!run) return;
    this.view.render(run, this.prev, dtMs, this.clockMs);
    const { app } = this.ctx;
    const w = app.screen.width;
    const h = app.screen.height;
    let cam = cameraAt(this.view.playerAt, this.zoom, w, h);
    this.shake.ms = Math.max(0, this.shake.ms - dtMs);
    if (this.shake.ms > 0) {
      const k = (this.shake.px * this.shake.ms) / SCREEN_SHAKE_MS / this.zoom;
      cam = { ...cam, x: cam.x + Math.sin(this.clockMs * 0.09) * k, y: cam.y + Math.cos(this.clockMs * 0.07) * k };
    }
    this.shown = snapCamera(cam, this.ctx.dpr());
    this.view.world.scale.set(this.shown.zoom);
    this.view.world.position.set(-this.shown.x * this.shown.zoom, -this.shown.y * this.shown.zoom);
    this.floats.update(dtMs, (p) => worldToScreen(p, this.shown));
  }
}
