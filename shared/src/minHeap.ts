// A small binary min-heap of integer ids ordered by a number. Ties go to the id pushed first,
// so results are deterministic. Used by A* in nav.ts.

export class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  private order: number[] = [];
  private pushed = 0;

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    this.ids.push(id);
    this.keys.push(key);
    this.order.push(this.pushed++);
    this.up(this.ids.length - 1);
  }

  /** Removes and returns the id with the smallest key, or undefined when empty. */
  pop(): number | undefined {
    const top = this.ids[0];
    const last = this.ids.length - 1;
    if (last < 0) return undefined;
    this.swap(0, last);
    this.ids.pop();
    this.keys.pop();
    this.order.pop();
    this.down(0);
    return top;
  }

  private less(i: number, j: number): boolean {
    const ki = this.keys[i]!;
    const kj = this.keys[j]!;
    return ki < kj || (ki === kj && this.order[i]! < this.order[j]!);
  }

  private swap(i: number, j: number): void {
    for (const arr of [this.ids, this.keys, this.order]) {
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
  }

  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) return;
      this.swap(i, p);
      i = p;
    }
  }

  private down(i: number): void {
    const n = this.ids.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) return;
      this.swap(i, m);
      i = m;
    }
  }
}
