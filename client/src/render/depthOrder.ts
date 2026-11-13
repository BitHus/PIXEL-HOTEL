// Draw order inside the object layer (brief section 7): sorted by y (the bottom of the
// footprint, or the avatar's feet), then x, then uid.

export interface DepthKey {
  y: number;
  x: number;
  uid: number;
}

export function compareDepth(a: DepthKey, b: DepthKey): number {
  return a.y - b.y || a.x - b.x || a.uid - b.uid;
}
