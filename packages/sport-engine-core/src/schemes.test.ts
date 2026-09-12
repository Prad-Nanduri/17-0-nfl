import { describe, expect, it } from 'vitest';
import { SCHEME_PRESETS } from './schemes';

describe('SCHEME_PRESETS (spec §2A.6, §0.1)', () => {
  it('exposes the shared 4-3, 3-4, and nickel presets', () => {
    expect(SCHEME_PRESETS.map((preset) => preset.id)).toEqual(['4-3', '3-4', 'nickel']);
    expect(SCHEME_PRESETS).toHaveLength(3);
  });

  it('uses the shared display names', () => {
    expect(SCHEME_PRESETS.map((preset) => preset.name)).toEqual(['Base 4-3', 'Base 3-4', 'Nickel']);
  });

  it('gives every preset 24 uniquely coded slots', () => {
    for (const preset of SCHEME_PRESETS) {
      expect(preset.slots).toHaveLength(24);
      const codes = preset.slots.map((slot) => slot.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});
