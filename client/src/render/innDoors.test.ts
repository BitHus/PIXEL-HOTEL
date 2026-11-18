import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { innDoorHasSprite } from '@pixel-hotel/shared';
import { arrivalLight, doorOpenNear, doorSpill, doorSpriteId, drawInnDoor, innDoorLook } from './innDoors.ts';

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
  it('doorSpriteId is id driven and matches the shared clearance rule', () => {
    expect(doorSpriteId('tavern_to_cellar')).toBe('door_cellar_down');
    expect(doorSpriteId('cellar_to_tavern')).toBe('door_cellar_up');
    expect(doorSpriteId('tavern_to_suite')).toBeNull();
    for (const id of ['tavern_to_cellar', 'cellar_to_tavern', 'tavern_to_suite', 'garden_gate']) expect(doorSpriteId(id) !== null).toBe(innDoorHasSprite(id));
  });
  it('doorOpenNear opens within 64 px in front of the door only', () => {
    expect(doorOpenNear(100, 64, null)).toBe(false);
    expect(doorOpenNear(100, 64, { x: 100, y: 96 })).toBe(true);
    expect(doorOpenNear(100, 64, { x: 170, y: 96 })).toBe(false);
    expect(doorOpenNear(100, 64, { x: 100, y: 140 })).toBe(false);
    expect(doorOpenNear(100, 64, { x: 100, y: 40 })).toBe(false);
  });
  it('doorSpill is null without a spill picture or for doors without one', () => {
    expect(doorSpill({ id: 'tavern_to_suite', x: 0, y: 0, w: 64 })).toBeNull();
  });
});
