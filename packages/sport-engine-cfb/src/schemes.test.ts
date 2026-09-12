import { describe, expect, it } from 'vitest';
import { SCHEME_PRESETS as NFL_SCHEME_PRESETS } from '@perfect-season/sport-engine-nfl';
import { CFB_SCHEME_PRESETS } from './schemes';

describe('CFB_SCHEME_PRESETS (spec §2A.6)', () => {
  it('exposes the same three scheme ids as the NFL presets', () => {
    expect(CFB_SCHEME_PRESETS.map((preset) => preset.id)).toEqual(['4-3', '3-4', 'nickel']);
    expect(CFB_SCHEME_PRESETS).toHaveLength(3);
  });

  it('renames Nickel to Spread Defense without changing its slots', () => {
    const nickel = CFB_SCHEME_PRESETS.find((preset) => preset.id === 'nickel');
    expect(nickel?.name).toBe('Spread Defense');
  });

  it('keeps every preset’s 24-slot shape identical to the NFL slots', () => {
    for (const preset of CFB_SCHEME_PRESETS) {
      expect(preset.slots).toHaveLength(24);
      const nfl = NFL_SCHEME_PRESETS.find((item) => item.id === preset.id);
      expect(preset.slots).toEqual(nfl?.slots);
    }
  });
});
