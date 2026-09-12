import { describe, expect, it } from 'vitest';
import { nextSlotIndex } from './keyboard-coordinates';

describe('keyboard slot coordinates', () => {
  it('starts at the first slot when there is no current over target', () => {
    expect(nextSlotIndex(-1, 'ArrowDown', 3)).toBe(0);
    expect(nextSlotIndex(-1, 'ArrowLeft', 3)).toBe(0);
  });

  it('increments with down and right', () => {
    expect(nextSlotIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(nextSlotIndex(1, 'ArrowRight', 3)).toBe(2);
  });

  it('decrements with up and left', () => {
    expect(nextSlotIndex(2, 'ArrowUp', 3)).toBe(1);
    expect(nextSlotIndex(1, 'ArrowLeft', 3)).toBe(0);
  });

  it('clamps movement at both ends', () => {
    expect(nextSlotIndex(0, 'ArrowUp', 3)).toBe(0);
    expect(nextSlotIndex(2, 'ArrowDown', 3)).toBe(2);
  });

  it('ignores other keys', () => {
    expect(nextSlotIndex(0, 'Enter', 3)).toBeUndefined();
  });
});
