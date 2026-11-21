// Blocks and plants: place, punch, hold to repeat (R1 split of main.ts: part 15 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  getBlockType, blockInCell, blockStack, blockProblem, plantProblem, plantInCell, BUILD_CELL, cellOf, type BlockResult,
  blockTapAction, blockCellTap, mayBreak, getClothing, isSeedId, screenToWorld, spliceNeedsAsk, type Avatar, type Point, type Room,
} from '@pixel-hotel/shared';
import { HoldControl, type HoldResult, type HoldTarget } from '../input/holdControl.ts';
import type { G14 } from './ctx.ts';
import { doorWalkGoal, walkDoorGoal } from './doorGoal.ts';
import { askSplice } from './spliceDialog.ts';

export async function setupBlockInput(g: G14) {
  const {
    api, plantViews, toast, follow, sound, refreshHint, avatarPanel, blockViews, popups, flyGems, roomChanged,
    refreshInventory, build, placer, paint, lakeside, blockers, panels, dungeon, walkTo, selectBlock, st, uiRoot, late, prefs,
  } = g;

  // ---------- Blocks: place and punch (step BG5) ----------
  const BLOCK_REFUSALS: Partial<Record<string, string>> = {
    door: 'Keep the door free.',
    door_blocked: 'That would block the way in.',
    inn_door: 'Keep the doorway free.',
    counter_blocked: 'The counter needs a way behind it.',
    seat_blocked: 'Guests could not get to a seat then.',
    wrong_room: 'That block cannot go here.',
    empty: 'None left.',
    not_buildable: 'You cannot build here.',
    no_soil: 'Seeds only grow on soil. Paint soil in the Room panel (Paint soil).',
    nothing_happens: 'Nothing happens. Both seeds are safe in your bag.',
    already_spliced: 'This cell already holds two seeds.',
    needs_soil: 'This seed needs soil or a block that holds soil (dirt, rich soil).',
    too_many_plants: 'This room cannot hold more plants.',
    stack_full: 'The stack is as high as it goes.',
    stacked: 'A plant needs a single block, not a stack.',
    taken: '',
  };
  /** Why the selected block or seed does not fit in this cell (null = it fits); `standing` = avatars standing still. */
  const selectedProblem = (c: number, r: number, standing: Point[]) =>
    st.selectedBlock !== null && isSeedId(st.selectedBlock)
      ? plantProblem(st.room, st.items, c, r, { standing, from: null }, undefined, st.selectedBlock)
      : blockProblem(st.room, st.items, getBlockType(st.selectedBlock!), c, r, { standing, from: null });
  /** A seed is selected and the cell is a block with no plant: a tap plants on its top (or says why not) and a press never punches it (SG4b). */
  const seedOnBlock = (c: number, r: number): boolean => {
    if (st.selectedBlock === null || !isSeedId(st.selectedBlock) || !blockInCell(st.room, c, r) || plantInCell(st.room, c, r)) return false;
    const problem = selectedProblem(c, r, []);
    return problem === null || problem === 'needs_soil' || problem === 'too_many_plants';
  };
  /** ST2: true when a tap on this block cell stacks the selected block on top (shared blockTapAction); a hold punches instead. */
  const stackTapAt = (c: number, r: number, standing: Point[] = []): boolean =>
    st.selectedBlock !== null &&
    blockTapAction({
      selectedId: st.selectedBlock,
      selectedIsSeed: isSeedId(st.selectedBlock),
      hasPlant: plantInCell(st.room, c, r) !== null,
      placeProblem: blockInCell(st.room, c, r) ? selectedProblem(c, r, standing) : 'taken',
    }) === 'stack';
  /**
   * Sends a place or punch to the GameAPI and draws what came back. `line` = a place hold along cells: out of
   * reach or refused cells are skipped quietly (no walking, no toasts). Returns what a hold should do next.
   */
  let spliceAsked: string | null = null;
  let spliceBusy: string | null = null;
  let spliceDeclined: string | null = null;
  // A new press on the room forgets a cancel.
  g.app.canvas.addEventListener('pointerdown', () => { spliceDeclined = null; });
  /** A punch at a plant: with a seed selected, a young plant gets the seed spliced in (step BG7); else it is harvested. */
  const hitOrSplice = async (c: number, r: number): Promise<BlockResult> => {
    if (st.selectedBlock !== null && isSeedId(st.selectedBlock)) {
      // SG5: a new mix or a rare+ seed asks first (the preview changes nothing); a retry after walking closer does not ask again.
      const key = `${c},${r},${st.selectedBlock}`;
      // Ask ONCE per press: a press hits at once and its release is a tap that hits again, a hold repeats; while the dialog is open or after a
      // cancel (until the next press on the room) the same plant + seed answers silently.
      if (spliceAsked !== key) {
        if (spliceBusy === key || spliceDeclined === key) return { kind: 'refused', problem: 'taken' };
        spliceBusy = key;
        const preview = await api.previewSplice(c, r, st.selectedBlock);
        if (spliceNeedsAsk(preview)) {
          const yes = await askSplice(uiRoot, preview);
          spliceBusy = null;
          if (!yes) {
            spliceDeclined = key;
            return { kind: 'refused', problem: 'taken' };
          }
          spliceAsked = key;
        } else spliceBusy = null;
      }
      const res = await api.spliceSeed(c, r, st.selectedBlock);
      if (res.kind !== 'walk') spliceAsked = null;
      // A ripe or already spliced plant is just punched (harvest, or "not grown yet"); anything else answers as it is.
      if (!(res.kind === 'refused' && (res.problem === 'ripe' || res.problem === 'already_spliced'))) return res;
    }
    return api.hitPlant(c, r);
  };
  const doBlock = async (kind: 'place' | 'hit', c: number, r: number, id: string | null, tries = 0, line = false): Promise<HoldResult> => {
    const was = blockInCell(st.room, c, r)?.id ?? null;
    const wasSeed = plantInCell(st.room, c, r)?.seed ?? null;
    // Seeds are planted (step BG6), a plant is harvested by punching it; blocks are placed and punched.
    const res: BlockResult =
      kind === 'place' && id
        ? isSeedId(id)
          ? await api.plantSeed(c, r, id)
          : await api.placeBlock(c, r, id)
        : wasSeed
          ? await hitOrSplice(c, r)
          : await api.hitBlock(c, r);
    if (res.kind === 'unripe') {
      // A punch never hurts a young plant: it shakes and says when it will be ready.
      plantViews.shake(c, r);
      const mins = Math.max(1, Math.ceil(res.leftMs / 60_000));
      toast(res.leftMs < 60_000 ? 'Not grown yet: ready in under a minute.' : `Not grown yet: ready in ${mins} min.`);
      return 'stop';
    }
    if (res.kind === 'walk') {
      if (line) return 'go';
      // Too far: walk closer first, then do it (once more at most).
      follow(res.path);
      st.goal = null;
      st.pendingBlock = tries < 2 ? { kind, c, r, tries: tries + 1 } : null;
      return 'walk';
    }
    if (res.kind === 'refused') {
      if (res.problem === 'cooldown') return 'retry';
      const text = BLOCK_REFUSALS[res.problem];
      if (text && !line) toast(text);
      return line ? 'go' : 'stop';
    }
    st.room = res.room;
    if (res.kind === 'planted' || res.kind === 'spliced') {
      sound.play('pop');
      late.guideEvent('plant');
      if (res.kind === 'spliced') toast('Two seeds in one cell. Wait for it to grow, then punch it.');
      void refreshHint();
    } else if (res.kind === 'harvested') {
      late.guideEvent('harvest');
      if (wasSeed) plantViews.harvestFx(c, r, wasSeed);
      sound.play('pop');
      if (res.clothing) {
        toast(`New clothes unlocked: ${getClothing(res.clothing)?.name ?? res.clothing} (Avatar panel).`);
        void api.getPlayer().then((p) => avatarPanel.setLook(st.avatar.look, p.unlockedClothing));
      }
      if (res.recipe) toast('New splice recipe found! See the Book, Splice tab.');
    } else if (res.kind === 'placed') sound.play('pop');
    else if (res.kind === 'cracked') {
      blockViews.punch(c, r, { x: st.avatar.x, y: st.avatar.y - 16 }, prefs.reduceEffects); // J4: flash, squash, chips away from the avatar
      sound.play('hit');
    } else {
      if (was) blockViews.breakFx(c, r, was);
      sound.play('pop');
    }
    popups.show(res.gains);
    flyGems(res.gains, { x: (c + 0.5) * BUILD_CELL, y: (r + 0.5) * BUILD_CELL });
    roomChanged();
    updateBlockGhost();
    void refreshInventory();
    return res.kind === 'broken' || res.kind === 'harvested' || res.kind === 'spliced' ? 'stop' : 'go';
  };
  /** A tap on cell p in play mode: punches a block there, or places the selected block. False = not for us. */
  const blockTap = (p: Point): boolean => {
    if (st.room.kind === 'lakeside') return false;
    const { c, r } = cellOf(p);
    if (seedOnBlock(c, r)) {
      const standing = st.path.length === 0 && st.avatar.state !== 'walk' ? [{ x: st.avatar.x, y: st.avatar.y }] : [];
      const why = selectedProblem(c, r, standing);
      if (why === null) void doBlock('place', c, r, st.selectedBlock);
      else toast(BLOCK_REFUSALS[why] ?? '');
      return true;
    }
    const standing = st.path.length === 0 && st.avatar.state !== 'walk' ? [{ x: st.avatar.x, y: st.avatar.y }] : [];
    if (blockInCell(st.room, c, r) || plantInCell(st.room, c, r)) {
      // ST2: a block selected and room on top = the tap stacks; else (and always for a plant) it punches. OB-4: chill mode never punches (the tap walks or uses).
      const stack = stackTapAt(c, r, standing);
      const act = blockCellTap({ punchMode: st.punchMode !== false, stackOrPlant: stack });
      if (act === null) return false;
      void doBlock(act, c, r, stack ? st.selectedBlock : null);
      return true;
    }
    if (st.selectedBlock === null) return false;
    const problem = selectedProblem(c, r, standing);
    if (problem === 'no_soil') {
      toast(BLOCK_REFUSALS.no_soil!);
      return false; // then the tap just walks there
    }
    if (problem === null) {
      void doBlock('place', c, r, st.selectedBlock);
      return true;
    }
    // Cells that are only wrong for a block fall through to walking and sitting; the rest say why.
    if (BLOCK_REFUSALS[problem] && problem !== 'wrong_room' && problem !== 'empty' && problem !== 'not_buildable' && problem !== 'taken') {
      toast(BLOCK_REFUSALS[problem]!);
      return true;
    }
    return false;
  };
  /** The ghost of the selected block follows the pointer (green = fits). */
  function updateBlockGhost(): void {
    const at = st.marked === null ? null : cellOf(st.marked);
    const stack = at !== null && st.selectedBlock !== null && !isSeedId(st.selectedBlock) && blockInCell(st.room, at.c, at.r) !== null && plantInCell(st.room, at.c, at.r) === null;
    if (st.selectedBlock === null || at === null || build.on || placer.active || paint.active || st.room.kind === 'lakeside' || (!stack && (blockInCell(st.room, at.c, at.r) || plantInCell(st.room, at.c, at.r)))) {
      blockViews.showGhost(null);
      plantViews.showGhost(null);
      return;
    }
    const valid = selectedProblem(at.c, at.r, []) === null;
    if (isSeedId(st.selectedBlock)) {
      blockViews.showGhost(null);
      plantViews.showGhost({ ...at, seed: st.selectedBlock, valid });
    } else {
      plantViews.showGhost(null);
      // ST2: over a stack the ghost shows the layer that would be added, one rise above the top.
      blockViews.showGhost({ ...at, id: st.selectedBlock, valid, level: stack ? blockStack(st.room, at.c, at.r).length : 0 });
    }
  }
  // ---------- Hold to repeat (step BG5b) ----------
  // A press on a block, a plant, a mine rock or a tree keeps hitting at that thing's cooldown until it
  // breaks, the press ends, or the avatar is out of reach (it then walks closer and goes on). The first hit
  // is on press. Holding still with a block selected places blocks (a drag along cells makes a line).
  // Not for the dungeon fight and not for fishing. The timing is the pure holdTick (shared/src/hold.ts).
  const holdBusyElsewhere = (): boolean =>
    lakeside.fishing || placer.active || paint.active || build.on || blockers.on || panels.open !== null;
  const hold = new HoldControl({
    now: () => performance.now(),
    walking: () => st.path.length > 0 || st.avatar.state === 'walk',
    hit: async (t: HoldTarget): Promise<HoldResult> => {
      if (t.kind === 'block' || t.kind === 'plant') return doBlock('hit', t.c, t.r, null, 0, false);
      if (t.kind === 'line') return st.selectedBlock === null ? 'stop' : doBlock('place', t.c, t.r, st.selectedBlock, 0, true);
      if (t.kind === 'tree') return lakeside.holdSwing(t.index);
      if (t.kind === 'rock') return dungeon.holdRock(t.id);
      return 'stop';
    },
  });
  // HOLD TO WALK: holding still on the floor walks to the pointer and follows it while the press lasts.
  st.walkHold = false;
  st.walkHoldCell = '';
  const steerWalk = (screen: Point): void => {
    st.marked = screenToWorld(screen, st.shown);
    const { c, r } = cellOf(st.marked);
    const key = `${c},${r}`;
    if (key === st.walkHoldCell && st.walkHold) return;
    st.walkHoldCell = key;
    // Owner bug 19 Nov: holding on the door picture (or against the wall beside it) walks onto the door spot and enters.
    const goal = doorWalkGoal(st.room, st.marked);
    st.pendingDoor = null;
    void walkTo(goal).then((ok) => {
      st.pendingDoor = walkDoorGoal(st.room, goal, ok, st.walkHoldCell === key) ?? st.pendingDoor;
    });
  };
  /** What a press on this screen point would hit (a held thing), or null. */
  const holdTargetAt = (screen: Point): HoldTarget | null => {
    if (dungeon.isActive) {
      const id = dungeon.rockUnder(screenToWorld(screen, dungeon.camera));
      return id === null ? null : { kind: 'rock', id };
    }
    if (holdBusyElsewhere()) return null;
    const world = screenToWorld(screen, st.shown);
    const { c, r } = cellOf(world);
    // OB-4: in chill mode a press on a block or plant never hits (trees on the lakeside still chop).
    const breaks = mayBreak(st.punchMode !== false, false);
    if (!breaks && st.room.kind !== 'lakeside' && (blockInCell(st.room, c, r) || plantInCell(st.room, c, r))) return null;
    if (st.room.kind !== 'lakeside' && blockInCell(st.room, c, r) && !seedOnBlock(c, r) && !stackTapAt(c, r)) return { kind: 'block', c, r };
    if (st.room.kind === 'farm' && plantInCell(st.room, c, r)) return { kind: 'plant', c, r };
    const tree = lakeside.treeUnder(world);
    return tree === null ? null : { kind: 'tree', index: tree };
  }

  // Escape puts the block away (after panels, placing and painting have had it).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && st.selectedBlock !== null && panels.open === null && !placer.active && !paint.active && !build.on) selectBlock(null, null);
  });

  // Shift turns snapping off (desktop).
  st.shiftHeld = false;
  const onShift = (e: KeyboardEvent): void => {
    st.shiftHeld = e.shiftKey;
    placer.setShift(e.shiftKey);
  };
  window.addEventListener('keydown', onShift);
  window.addEventListener('keyup', onShift);
  window.addEventListener('blur', () => placer.setShift(false));

  return { doBlock, blockTap, updateBlockGhost, holdBusyElsewhere, hold, steerWalk, holdTargetAt, stackTapAt };
}
