import { describe, expect, it } from 'vitest';
import { TEAM_LEVEL_RATING_BADGE } from '../domain';
import type { CfbTeamLineStats } from '../domain';
import { lineProxyComposite, lineProxyRating, teamLineEfficiencyPercentiles } from './line-proxy';

const baseInput = {
  positionGroup: 'OL' as const,
  teamLineEfficiencyPercentile: 0.5,
  allAmerican: false,
  allConference: false,
  gamesStartedShare: 0.5,
};

describe('lineProxyComposite (spec §2A.6)', () => {
  it('maxes out at 1.0 for a perfect line, All-American, full-time starter', () => {
    const composite = lineProxyComposite({
      positionGroup: 'OL',
      teamLineEfficiencyPercentile: 1,
      allAmerican: true,
      allConference: true,
      gamesStartedShare: 1,
    });
    expect(composite).toBeCloseTo(1);
    expect(
      lineProxyRating({
        positionGroup: 'OL',
        teamLineEfficiencyPercentile: 1,
        allAmerican: true,
        allConference: true,
        gamesStartedShare: 1,
      }).overallRating,
    ).toBe(99);
  });

  it('floors at 0 when every input is zero', () => {
    const rating = lineProxyRating({
      positionGroup: 'DL',
      teamLineEfficiencyPercentile: 0,
      allAmerican: false,
      allConference: false,
      gamesStartedShare: 0,
    });
    expect(rating.compositeScore).toBe(0);
    expect(rating.overallRating).toBe(40);
  });

  it('weights the three components per spec', () => {
    // 0.40*0.5 + 0.35*0.6 + 0.25*0.5 = 0.535 → round(40 + 0.535*59) = 72.
    const rating = lineProxyRating({ ...baseInput, allConference: true });
    expect(rating.compositeScore).toBeCloseTo(0.535);
    expect(rating.overallRating).toBe(72);
  });

  it('ranks All-American above All-Conference with everything else equal', () => {
    const aa = lineProxyComposite({ ...baseInput, allAmerican: true, allConference: true });
    const ac = lineProxyComposite({ ...baseInput, allConference: true });
    expect(aa).toBeGreaterThan(ac);
  });

  it('treats a null games-started share as 0', () => {
    const withNull = lineProxyComposite({ ...baseInput, gamesStartedShare: null });
    const withZero = lineProxyComposite({ ...baseInput, gamesStartedShare: 0 });
    expect(withNull).toBe(withZero);
  });

  it('marks the output as a team-level proxy with the badge', () => {
    const rating = lineProxyRating(baseInput);
    expect(rating.isTeamLevelProxy).toBe(true);
    expect(rating.badges).toContain(TEAM_LEVEL_RATING_BADGE);
  });

  it('rejects non-line position groups', () => {
    expect(() => lineProxyComposite({ ...baseInput, positionGroup: 'QB' as 'OL' })).toThrow(
      RangeError,
    );
  });
});

describe('teamLineEfficiencyPercentiles (spec §2A.6)', () => {
  const team = (overrides: Partial<CfbTeamLineStats>): CfbTeamLineStats => ({
    cfbdTeamId: 0,
    season: 2023,
    offenseSacksAllowed: null,
    offensePassAttempts: null,
    offenseStuffRateAllowed: null,
    defenseSacks: null,
    defenseOpponentPassAttempts: null,
    defenseStuffRate: null,
    ...overrides,
  });

  // Team A: best OL (lowest sack + stuff allowed), worst DL.
  // Team C: worst OL, best DL (highest sack + stuff produced).
  const teams = [
    team({
      cfbdTeamId: 1,
      offenseSacksAllowed: 10,
      offensePassAttempts: 400,
      offenseStuffRateAllowed: 0.12,
      defenseSacks: 20,
      defenseOpponentPassAttempts: 400,
      defenseStuffRate: 0.18,
    }),
    team({
      cfbdTeamId: 2,
      offenseSacksAllowed: 25,
      offensePassAttempts: 400,
      offenseStuffRateAllowed: 0.18,
      defenseSacks: 30,
      defenseOpponentPassAttempts: 400,
      defenseStuffRate: 0.2,
    }),
    team({
      cfbdTeamId: 3,
      offenseSacksAllowed: 40,
      offensePassAttempts: 400,
      offenseStuffRateAllowed: 0.25,
      defenseSacks: 45,
      defenseOpponentPassAttempts: 400,
      defenseStuffRate: 0.28,
    }),
    team({ cfbdTeamId: 4 }),
  ];

  it('gives the lowest sack/stuff-allowed team the highest OL percentile', () => {
    const percentiles = teamLineEfficiencyPercentiles(teams, 'OL');
    expect(percentiles.get(1)).toBeGreaterThan(percentiles.get(2) ?? 0);
    expect(percentiles.get(2)).toBeGreaterThan(percentiles.get(3) ?? 0);
  });

  it('gives the highest sack/stuff team the highest DL percentile', () => {
    const percentiles = teamLineEfficiencyPercentiles(teams, 'DL');
    expect(percentiles.get(3)).toBeGreaterThan(percentiles.get(2) ?? 0);
    expect(percentiles.get(2)).toBeGreaterThan(percentiles.get(1) ?? 0);
  });

  it('defaults a team with no data to the 0.5 midpoint', () => {
    expect(teamLineEfficiencyPercentiles(teams, 'OL').get(4)).toBe(0.5);
    expect(teamLineEfficiencyPercentiles(teams, 'DL').get(4)).toBe(0.5);
  });

  it('rejects non-line sides', () => {
    expect(() => teamLineEfficiencyPercentiles(teams, 'QB' as 'OL')).toThrow(RangeError);
  });
});
