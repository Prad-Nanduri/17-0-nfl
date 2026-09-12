import { describe, expect, it } from 'vitest';
import type { CfbProgramSeason } from './domain';
import { filterSpinPool, resolveMembershipStatus } from './membership';

const SCHOOL = 'Reclass State';

// 'Reclass State' finishes its NCAA reclassification and joins FBS in 2018.
const fbsBySeason = new Map<number, ReadonlySet<string>>(
  Array.from({ length: 10 }, (_, index) => {
    const season = 2014 + index;
    return [season, new Set(season >= 2018 ? ['Stable U', SCHOOL] : ['Stable U'])] as const;
  }),
);

describe('resolveMembershipStatus (spec §2A.1)', () => {
  it('returns fbs when the school is on that season’s FBS list', () => {
    expect(resolveMembershipStatus(SCHOOL, 2018, fbsBySeason)).toBe('fbs');
    expect(resolveMembershipStatus(SCHOOL, 2023, fbsBySeason)).toBe('fbs');
  });

  it('returns reclassifying during the 2-year window before FBS entry', () => {
    expect(resolveMembershipStatus(SCHOOL, 2016, fbsBySeason)).toBe('reclassifying');
    expect(resolveMembershipStatus(SCHOOL, 2017, fbsBySeason)).toBe('reclassifying');
  });

  it('returns fcs before the reclassification window begins', () => {
    expect(resolveMembershipStatus(SCHOOL, 2014, fbsBySeason)).toBe('fcs');
    expect(resolveMembershipStatus(SCHOOL, 2015, fbsBySeason)).toBe('fcs');
  });

  it('keeps a stable FBS program at fbs every year', () => {
    for (let season = 2014; season <= 2023; season += 1) {
      expect(resolveMembershipStatus('Stable U', season, fbsBySeason)).toBe('fbs');
    }
  });

  it('throws when the season has no FBS list instead of falling back', () => {
    expect(() => resolveMembershipStatus('Stable U', 1990, fbsBySeason)).toThrow(RangeError);
  });
});

describe('filterSpinPool (spec §2A.1)', () => {
  const programSeasons: CfbProgramSeason[] = Array.from({ length: 10 }, (_, index) => {
    const season = 2014 + index;
    return {
      cfbdTeamId: 1,
      season,
      conferenceKey: 'sun-belt',
      membershipStatus: resolveMembershipStatus(SCHOOL, season, fbsBySeason),
      wins: null,
      losses: null,
      apPreseasonRank: null,
      apFinalRank: null,
      peakRankThisSeason: null,
      cfpResult: null,
      bowlResult: null,
      recruitingRank: null,
      recruitingPoints: null,
      eraTier: 'full_feature',
    };
  });

  it('excludes pre-reclassification seasons even though the program is FBS today', () => {
    const pool = filterSpinPool(programSeasons);
    expect(pool.map((row) => row.season)).toEqual([2018, 2019, 2020, 2021, 2022, 2023]);
  });
});
