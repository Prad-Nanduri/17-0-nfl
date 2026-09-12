import { describe, expect, it } from 'vitest';
import type { NflFixtureData } from '@perfect-season/sport-engine-nfl';
import { getNflData } from './nfl-engine';
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

  it('reuses candidates for equal units within the same fixture data', () => {
    const unit = { sportId: 'nfl' as const, franchiseId: 'KC', season: 2023 };
    const first = buildCandidates(unit);
    const second = buildCandidates({ ...unit });

    expect(second).toEqual(first);
    expect(second).toBe(first);
  });

  it('does not reuse candidates across different fixture data objects', () => {
    const data = getNflData();
    const otherData: NflFixtureData = {
      ...data,
      players: [...data.players],
      playerSeasonStats: [...data.playerSeasonStats],
    };
    const unit = { sportId: 'nfl' as const, franchiseId: 'KC', season: 2023 };

    expect(buildCandidates(unit, otherData)).not.toBe(buildCandidates(unit, data));
  });
});
