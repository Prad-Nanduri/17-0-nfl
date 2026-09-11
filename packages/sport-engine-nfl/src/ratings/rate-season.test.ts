import { describe, expect, it } from 'vitest';
import type { NflPlayerSeasonStats } from '../domain';
import { rateSeason } from './rate-season';

const makeRow = (
  gsisId: string,
  positionGroup: NflPlayerSeasonStats['positionGroup'],
  stats: Record<string, number | null>,
): NflPlayerSeasonStats => ({
  gsisId,
  franchiseKey: 'TST',
  season: 2023,
  position: positionGroup,
  positionGroup,
  eraTier: 'full_feature',
  games: 17,
  stats,
  isTeamLevelProxy: positionGroup === 'OL',
});

describe('rateSeason', () => {
  it('rates qualified rows by position population and preserves model metadata', () => {
    const rows = [
      makeRow('a', 'QB', {
        passAttempts: 200,
        anyPerAttempt: 8,
        tdRate: 0.1,
        intRate: 0.01,
        completionPct: 0.7,
        rushingEpa: 10,
      }),
      makeRow('b', 'QB', {
        passAttempts: 100,
        anyPerAttempt: 4,
        tdRate: 0.03,
        intRate: 0.04,
        completionPct: 0.55,
        rushingEpa: -10,
      }),
      makeRow('c', 'QB', {
        passAttempts: 10,
        anyPerAttempt: 9,
        tdRate: 0.2,
        intRate: 0,
        completionPct: 0.8,
        rushingEpa: 20,
      }),
    ];
    const ratings = rateSeason(rows, 'test-model');
    expect(ratings[0]?.qualified).toBe(true);
    expect(ratings[0]?.overall).toBeGreaterThan(ratings[1]?.overall ?? 0);
    expect(ratings[0]?.percentile).toBe(0.75);
    expect(ratings[0]?.modelVersion).toBe('test-model');
    expect(ratings[1]?.qualified).toBe(true);
    expect(ratings[2]).toMatchObject({
      overall: 40,
      percentile: null,
      compositeScore: null,
      qualified: false,
    });
  });

  it('treats missing components as mean and marks OL as team-level proxy', () => {
    const rows = [
      makeRow('a', 'OL', {
        offenseSnaps: 300,
        teamPressureRateAllowed: null,
        teamYardsBeforeContactPerAtt: 1,
        penalties: 2,
      }),
      makeRow('b', 'OL', {
        offenseSnaps: 400,
        teamPressureRateAllowed: 0.1,
        teamYardsBeforeContactPerAtt: 2,
        penalties: 4,
      }),
    ];
    expect(rateSeason(rows)[0]?.isTeamLevelProxy).toBe(true);
  });
});
