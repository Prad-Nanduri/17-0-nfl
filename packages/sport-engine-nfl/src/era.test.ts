import { describe, expect, it } from 'vitest';
import { nflConfidenceTier } from './era';

describe('NFL confidence tiers', () => {
  it('uses the full-feature cutoff at 1999', () => {
    expect(nflConfidenceTier(1998)).toBe('legacy');
    expect(nflConfidenceTier(1999)).toBe('full_feature');
  });
});
