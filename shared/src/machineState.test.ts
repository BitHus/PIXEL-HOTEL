import { describe, expect, it } from 'vitest';
import { machineState, machineStates } from './machineState.ts';

const tavern = {
  cooks: [{ stoveUid: 5, food: 'roasted_turnip', qty: 2, readyAt: 1000 }],
  brews: [{ barrelUid: 9, drink: 'root_ale', readyAt: 2000 }],
} as never;

describe('machineState (OA-5)', () => {
  it('a stove or barrel with nothing on it is cold', () => {
    expect(machineState(tavern, 77, 0)).toBe('cold');
    expect(machineState({ cooks: [], brews: [] }, 5, 0)).toBe('cold');
  });
  it('cooking until readyAt, ready from readyAt on', () => {
    expect(machineState(tavern, 5, 999)).toBe('cooking');
    expect(machineState(tavern, 5, 1000)).toBe('ready');
    expect(machineState(tavern, 9, 1999)).toBe('cooking');
    expect(machineState(tavern, 9, 2000)).toBe('ready');
  });
  it('machineStates lists only busy machines', () => {
    expect([...machineStates(tavern, 1500)]).toEqual([[5, 'ready'], [9, 'cooking']]);
    expect(machineStates({ cooks: [], brews: [] }, 0).size).toBe(0);
  });
});
