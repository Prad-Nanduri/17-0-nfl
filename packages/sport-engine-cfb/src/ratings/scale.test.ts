import { describe, expect, it } from 'vitest';
import { percentileRank, toRatingScale, zScores } from './scale';

describe('zScores', () => {
  it('centers the population and preserves nulls', () => {
    const [low, mid, high, missing] = zScores([1, 2, 3, null]);
    expect(low).toBeCloseTo(-1.2247);
    expect(mid).toBe(0);
    expect(high).toBeCloseTo(1.2247);
    expect(missing).toBeNull();
  });

  it('returns zeros for a zero-variance population', () => {
    expect(zScores([5, 5])).toEqual([0, 0]);
  });
});

describe('percentileRank', () => {
  it('ranks with midpoint ties', () => {
    expect(percentileRank([10, 20, 20, 30])).toEqual([0.125, 0.5, 0.5, 0.875]);
  });
});

describe('toRatingScale', () => {
  it('maps 0..1 onto 40..99 inclusive', () => {
    expect(toRatingScale(0)).toBe(40);
    expect(toRatingScale(1)).toBe(99);
  });

  it('clamps out-of-range input and rejects non-finite input', () => {
    expect(toRatingScale(-1)).toBe(40);
    expect(toRatingScale(2)).toBe(99);
    expect(() => toRatingScale(Number.NaN)).toThrow(RangeError);
  });
});
