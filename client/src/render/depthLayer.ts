// The ONE depth-sorted list of items and avatars (brief section 7). Empty in step 2; later
// steps add furniture and avatars with add() and update their keys with setKey().
// Sorting uses Pixi's own zIndex sorting: we only compute each child's rank.

import { Container } from 'pixi.js';
import { compareDepth, type DepthKey } from './depthOrder.ts';

export class DepthLayer {
  readonly container = new Container({ sortableChildren: true });
  private readonly keys = new Map<Container, DepthKey>();
  private dirty = false;

  add(child: Container, key: DepthKey): void {
    this.keys.set(child, { ...key });
    this.container.addChild(child);
    this.dirty = true;
  }

  remove(child: Container): void {
    this.keys.delete(child);
    this.container.removeChild(child);
    this.dirty = true;
  }

  setKey(child: Container, key: DepthKey): void {
    const old = this.keys.get(child);
    if (old && compareDepth(old, key) === 0) return;
    this.keys.set(child, { ...key });
    this.dirty = true;
  }

  /** Call once per frame. Re-ranks the children only when something changed. */
  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const ordered = [...this.keys.entries()].sort((a, b) => compareDepth(a[1], b[1]));
    ordered.forEach(([child], i) => {
      child.zIndex = i;
    });
  }
}
