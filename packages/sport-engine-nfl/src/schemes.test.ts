import { describe, expect, it } from 'vitest';
import { SCHEME_PRESETS } from './schemes';

describe('SCHEME_PRESETS', () => {
  it('defines three complete 24-slot presets', () => {
    expect(SCHEME_PRESETS).toHaveLength(3);
    for (const preset of SCHEME_PRESETS) expect(preset.slots).toHaveLength(24);
  });

  it.each([
    ['4-3', { DL: 4, LB: 3, CB: 2, S: 2 }],
    ['3-4', { DL: 3, LB: 4, CB: 2, S: 2 }],
    ['nickel', { DL: 4, LB: 2, CB: 3, S: 2 }],
  ] as const)('has the expected %s defensive groups', (id, expected) => {
    const preset = SCHEME_PRESETS.find((item) => item.id === id);
    expect(preset).toBeDefined();
    const groups = (preset?.slots ?? []).reduce<Partial<Record<string, number>>>((counts, item) => {
      counts[item.positionGroup] = (counts[item.positionGroup] ?? 0) + 1;
      return counts;
    }, {});
    expect({
      DL: groups.DL ?? 0,
      LB: groups.LB ?? 0,
      CB: groups.CB ?? 0,
      S: groups.S ?? 0,
    }).toEqual(expected);
  });

  it('shares offense and specialists across presets', () => {
    const first = SCHEME_PRESETS[0];
    expect(first).toBeDefined();
    for (const preset of SCHEME_PRESETS.slice(1)) {
      expect(preset.slots.slice(0, 11)).toEqual(first?.slots.slice(0, 11));
      expect(preset.slots.slice(-2)).toEqual(first?.slots.slice(-2));
    }
  });
});
