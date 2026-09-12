import { describe, expect, it } from 'vitest';
import { CFB_ERA_CUTOFF, cfbConfidenceTier } from './era';

describe('cfbConfidenceTier (spec §4.1)', () => {
  it('marks pre-2005 seasons as legacy', () => {
    expect(cfbConfidenceTier(2004)).toBe('legacy');
    expect(cfbConfidenceTier(1995)).toBe('legacy');
  });

  it('marks 2005 onward as full_feature', () => {
    expect(cfbConfidenceTier(2005)).toBe('full_feature');
    expect(cfbConfidenceTier(2023)).toBe('full_feature');
  });

  it('throws on non-integer seasons', () => {
    expect(() => cfbConfidenceTier(2005.5)).toThrow(RangeError);
  });

  it('exposes the 2005 cutoff', () => {
    expect(CFB_ERA_CUTOFF.fullFeatureFromSeason).toBe(2005);
  });
});
