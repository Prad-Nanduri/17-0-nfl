import { describe, expect, it } from 'vitest';
import { availableSeasons, buildCandidates } from './candidates';

describe('NFL draft candidates', () => {
  it('exposes only seasons represented by player stats', () => {
    expect(availableSeasons()).toEqual({ from: 2023, through: 2023 });
  });

  it('joins player season stats to player traits', () => {
    const candidates = buildCandidates({ sportId: 'nfl', franchiseId: 'KC', season: 2023 });
    expect(candidates.length).toBeGreaterThan(0);
    const candidate = candidates[0];
    expect(candidate?.poolUnit).toEqual({ sportId: 'nfl', franchiseId: 'KC', season: 2023 });
    expect(candidate?.seasons).toHaveLength(1);
    expect(candidate?.traits).toMatchObject({
      versatile: expect.any(Boolean),
    });
  });
});
