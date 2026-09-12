import { describe, expect, it } from 'vitest';
import { SCHEME_PRESETS } from '@perfect-season/sport-engine-core';
import { CFB_SCHEME_DISPLAY_NAMES, CFB_SCHEME_PRESETS, cfbSchemeDisplayName } from './schemes';

describe('CFB_SCHEME_PRESETS (spec §2A.6)', () => {
  it('exposes the same three scheme ids as the shared presets', () => {
    expect(CFB_SCHEME_PRESETS.map((preset) => preset.id)).toEqual(['4-3', '3-4', 'nickel']);
    expect(CFB_SCHEME_PRESETS).toHaveLength(3);
  });

  it('renames Nickel to Spread Defense without changing its slots', () => {
    const nickel = CFB_SCHEME_PRESETS.find((preset) => preset.id === 'nickel');
    expect(nickel?.name).toBe('Spread Defense');
    const shared = SCHEME_PRESETS.find((preset) => preset.id === 'nickel');
    expect(nickel?.description).toBe(shared?.description);
  });

  it('keeps every preset’s 24-slot shape identical to the shared slots', () => {
    for (const preset of CFB_SCHEME_PRESETS) {
      expect(preset.slots).toHaveLength(24);
      const shared = SCHEME_PRESETS.find((item) => item.id === preset.id);
      expect(preset.slots).toEqual(shared?.slots);
    }
  });

  it('leaves non-nickel names untouched via cfbSchemeDisplayName', () => {
    expect(CFB_SCHEME_DISPLAY_NAMES['4-3']).toBeUndefined();
    for (const preset of SCHEME_PRESETS) {
      expect(cfbSchemeDisplayName(preset)).toBe(
        preset.id === 'nickel' ? 'Spread Defense' : preset.name,
      );
    }
  });
});
