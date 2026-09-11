import { describe, expect, it } from 'vitest';
import { resolveConfidenceTier, type EraCutoff } from './confidence-tier';

const cutoff: EraCutoff = { fullFeatureFromSeason: 1999 };

describe('resolveConfidenceTier', () => {
  it('assigns legacy immediately before the cutoff and full feature at the cutoff', () => {
    expect(resolveConfidenceTier(1998, cutoff)).toBe('legacy');
    expect(resolveConfidenceTier(1999, cutoff)).toBe('full_feature');
  });

  it.each([NaN, Infinity, -Infinity, 1998.5])('rejects invalid seasons', (season) => {
    expect(() => resolveConfidenceTier(season, cutoff)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -Infinity, 1998.5])(
    'rejects invalid cutoffs',
    (fullFeatureFromSeason) => {
      expect(() => resolveConfidenceTier(2023, { fullFeatureFromSeason })).toThrow(RangeError);
    },
  );
});
