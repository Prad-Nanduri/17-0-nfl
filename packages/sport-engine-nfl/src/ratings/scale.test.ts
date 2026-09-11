import { describe, expect, it } from 'vitest';
import { percentileRank, toRatingScale, zScores } from './scale';

describe('rating scale', () => {
  it('calculates population z-scores and maps constant populations to zero', () => {
    expect(zScores([1, 2, 3])).toEqual([-1.224744871391589, 0, 1.224744871391589]);
    expect(zScores([2, 2])).toEqual([0, 0]);
    expect(zScores([null, 2])).toEqual([null, 0]);
    expect(zScores([null])).toEqual([null]);
  });

  it('calculates midpoint ties and single-element percentiles', () => {
    expect(percentileRank([1, 2, 2, 4])).toEqual([0.125, 0.5, 0.5, 0.875]);
    expect(percentileRank([7])).toEqual([0.5]);
  });

  it('clamps the percentile mapping to the 40 through 99 scale', () => {
    expect(toRatingScale(0)).toBe(40);
    expect(toRatingScale(0.5)).toBe(70);
    expect(toRatingScale(1)).toBe(99);
    expect(toRatingScale(-1)).toBe(40);
    expect(toRatingScale(2)).toBe(99);
    expect(() => toRatingScale(NaN)).toThrow(RangeError);
  });
});
