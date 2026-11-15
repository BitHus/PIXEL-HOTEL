import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { arrivalLight, drawInnDoor, innDoorLook } from './innDoors.ts';

describe('inn doors (B1 stub)', () => {
  it('picks a look by id prefix, unknown = suite', () => {
    expect(innDoorLook('suite_1')).toBe('suite');
    expect(innDoorLook('tavern_door')).toBe('tavern');
    expect(innDoorLook('garden_gate')).toBe('garden');
    expect(innDoorLook('???')).toBe('suite');
  });
  it('adds a positioned container to the layer and drives the arrival light', () => {
    const layer = new Container();
    const c = drawInnDoor(layer, { id: 'garden_a', x: 100, y: 64, w: 64 });
    expect(layer.children).toContain(c);
    expect(c.position.x).toBe(100);
    arrivalLight(c, 0);
    expect(c.getChildByLabel('glow')!.alpha).toBe(0.5);
    arrivalLight(c, 1);
    expect(c.getChildByLabel('glow')!.alpha).toBe(0);
  });
});
