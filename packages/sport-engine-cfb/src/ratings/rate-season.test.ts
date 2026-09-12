import { describe, expect, it } from 'vitest';
import type { CfbPlayerSeasonStats, CfbTeamLineStats } from '../domain';
import { CFB_RATING_MODEL_VERSION, rateSeason } from './rate-season';
import { TEAM_LEVEL_RATING_BADGE } from '../domain';

const statRow = (overrides: Partial<CfbPlayerSeasonStats>): CfbPlayerSeasonStats => ({
  cfbdPlayerId: 'p1',
  cfbdTeamId: 1,
  season: 2023,
  position: 'QB',
  positionGroup: 'QB',
  eraTier: 'full_feature',
  games: 12,
  gamesStarted: 12,
  allConference: false,
  allAmerican: false,
  isTransferThisSeason: false,
  stats: {},
  isTeamLevelProxy: false,
  ...overrides,
});

const teamLine: CfbTeamLineStats = {
  cfbdTeamId: 1,
  season: 2023,
  offenseSacksAllowed: 15,
  offensePassAttempts: 400,
  offenseStuffRateAllowed: 0.15,
  defenseSacks: 35,
  defenseOpponentPassAttempts: 420,
  defenseStuffRate: 0.24,
};

describe('rateSeason (spec §2A.6)', () => {
  it('rates OL rows with the team-level proxy and badge', () => {
    const rows = [
      statRow({
        cfbdPlayerId: 'ol1',
        position: 'OG',
        positionGroup: 'OL',
        stats: {},
        isTeamLevelProxy: true,
      }),
    ];
    const [rating] = rateSeason(rows, [teamLine]);
    expect(rating?.isTeamLevelProxy).toBe(true);
    expect(rating?.badges).toContain(TEAM_LEVEL_RATING_BADGE);
    expect(rating?.overallRating).toBeGreaterThanOrEqual(40);
    expect(rating?.modelVersion).toBe(CFB_RATING_MODEL_VERSION);
  });

  it('does not badge skill-position rows', () => {
    const rows = [
      statRow({ cfbdPlayerId: 'qb1', stats: { 'passing.yds': 3000 } }),
      statRow({ cfbdPlayerId: 'qb2', stats: { 'passing.yds': 2000 } }),
    ];
    const ratings = rateSeason(rows, [teamLine]);
    expect(ratings.every((rating) => !rating.isTeamLevelProxy)).toBe(true);
    expect(ratings.every((rating) => rating.badges.length === 0)).toBe(true);
    const qb1 = ratings.find((rating) => rating.cfbdPlayerId === 'qb1');
    expect(qb1?.overallRating).toBeGreaterThanOrEqual(
      ratings.find((rating) => rating.cfbdPlayerId === 'qb2')?.overallRating ?? 0,
    );
  });

  it('assigns confidence tiers by season', () => {
    const rows = [
      statRow({ cfbdPlayerId: 'old', season: 2004, stats: { 'passing.yds': 1 } }),
      statRow({ cfbdPlayerId: 'new', season: 2023, stats: { 'passing.yds': 1 } }),
    ];
    const ratings = rateSeason(rows, []);
    expect(ratings.find((rating) => rating.cfbdPlayerId === 'old')?.confidenceTier).toBe('legacy');
    expect(ratings.find((rating) => rating.cfbdPlayerId === 'new')?.confidenceTier).toBe(
      'full_feature',
    );
  });
});
