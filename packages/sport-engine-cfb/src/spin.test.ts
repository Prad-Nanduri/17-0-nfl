import { describe, expect, it } from 'vitest';
import type { SpinFilters } from '@perfect-season/sport-engine-core';
import type { CfbProgramSeason, CfbTeam } from './domain';
import { cfbConfidenceTier } from './era';
import { BLUE_BLOOD_SCHOOLS, CfbSpinError, resolveSpinUnit } from './spin';

const teams: CfbTeam[] = [
  'Alabama',
  'Ohio State',
  'Boise State',
  'Reclass State',
  'G5 U',
  'Old Guard',
  'FCS U',
  'Independent U',
].map((school, index) => ({
  cfbdTeamId: index + 1,
  school,
  currentName: school,
  abbreviation: school.slice(0, 3).toUpperCase(),
  mascot: null,
  logoUrl: null,
  isBlueBlood: school === 'Alabama',
}));

const SCHOOL_ID = new Map(teams.map((team) => [team.school, team.cfbdTeamId]));
const idOf = (school: string) => SCHOOL_ID.get(school) ?? 0;

const row = (
  school: string,
  season: number,
  overrides: Partial<CfbProgramSeason> = {},
): CfbProgramSeason => ({
  cfbdTeamId: idOf(school),
  season,
  conferenceKey: school === 'Independent U' ? null : 'sun-belt',
  membershipStatus: 'fbs',
  wins: null,
  losses: null,
  apPreseasonRank: null,
  apFinalRank: null,
  peakRankThisSeason: null,
  cfpResult: null,
  bowlResult: null,
  recruitingRank: null,
  recruitingPoints: null,
  eraTier: cfbConfidenceTier(season),
  ...overrides,
});

const SEASONS = [1995, 2010, 2016, 2018, 2023];
const programSeasons: CfbProgramSeason[] = teams.flatMap((team) =>
  SEASONS.map((season) => {
    // Reclass State was reclassifying in 2016, FBS from 2018.
    if (team.school === 'Reclass State' && season <= 2016) {
      return row(team.school, season, { membershipStatus: 'reclassifying' });
    }
    const overrides: Partial<CfbProgramSeason> =
      team.school === 'Alabama' && season >= 2014
        ? { apFinalRank: 1, peakRankThisSeason: 1, cfpResult: 'champion' }
        : team.school === 'Ohio State' && season >= 2014
          ? { apFinalRank: 5, peakRankThisSeason: 3 }
          : {};
    return row(team.school, season, overrides);
  }),
);

const filters = (overrides: Partial<SpinFilters> = {}): SpinFilters => ({
  modeId: 'core',
  criteria: {},
  ...overrides,
});

describe('resolveSpinUnit (spec §2A.1, §2A.3, §2A.7)', () => {
  it('is deterministic for a given seed', () => {
    const first = resolveSpinUnit('seed-1', filters(), programSeasons, teams);
    const second = resolveSpinUnit('seed-1', filters(), programSeasons, teams);
    expect(first).toEqual(second);
    expect(first.sportId).toBe('cfb');
  });

  it('honors seasonRange', () => {
    const unit = resolveSpinUnit(
      's',
      filters({ seasonRange: { from: 2010, through: 2010 } }),
      programSeasons,
      teams,
    );
    expect(unit.season).toBe(2010);
  });

  it('honors teamIds', () => {
    const unit = resolveSpinUnit(
      's',
      filters({ teamIds: [String(idOf('Boise State'))] }),
      programSeasons,
      teams,
    );
    expect(unit.programId).toBe(String(idOf('Boise State')));
  });

  it('honors excludedUnits', () => {
    const excluded = programSeasons.map((programSeason) => ({
      sportId: 'cfb' as const,
      programId: String(programSeason.cfbdTeamId),
      season: programSeason.season,
      conferenceId: programSeason.conferenceKey,
    }));
    expect(() =>
      resolveSpinUnit('s', filters({ excludedUnits: excluded }), programSeasons, teams),
    ).toThrow(CfbSpinError);
  });

  it('filters legacy era to pre-2005 seasons', () => {
    const unit = resolveSpinUnit(
      's',
      filters({ criteria: { eraTier: 'legacy' } }),
      programSeasons,
      teams,
    );
    expect(unit.season).toBe(1995);
  });

  it('never spins a reclassifying season even for a program that is FBS today', () => {
    expect(() =>
      resolveSpinUnit(
        's',
        filters({
          teamIds: [String(idOf('Reclass State'))],
          seasonRange: { from: 2016, through: 2016 },
        }),
        programSeasons,
        teams,
      ),
    ).toThrow('No program-season matches the spin filters');
    const unit = resolveSpinUnit(
      's',
      filters({
        teamIds: [String(idOf('Reclass State'))],
        seasonRange: { from: 2018, through: 2023 },
      }),
      programSeasons,
      teams,
    );
    expect(unit.season).toBe(2018);
  });

  it('applies the conference filter against conferenceKey', () => {
    const unit = resolveSpinUnit(
      's',
      filters({ criteria: { conference: 'sun-belt' } }),
      programSeasons,
      teams,
    );
    expect(unit.conferenceId).toBe('sun-belt');
  });

  it('ranked_only excludes unranked program-seasons (§2A.3)', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const unit = resolveSpinUnit(seed, filters({ modeId: 'ranked_only' }), programSeasons, teams);
      const rowForUnit = programSeasons.find(
        (item) => item.cfbdTeamId === Number(unit.programId) && item.season === unit.season,
      );
      expect(
        rowForUnit !== undefined &&
          (rowForUnit.apFinalRank !== null || rowForUnit.peakRankThisSeason !== null),
      ).toBe(true);
    }
  });

  it('blue_blood_bracket only yields blue-blood programs (§2A.7)', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const unit = resolveSpinUnit(
        seed,
        filters({ modeId: 'blue_blood_bracket' }),
        programSeasons,
        teams,
      );
      const team = teams.find((item) => item.cfbdTeamId === Number(unit.programId));
      expect(
        team !== undefined && (team.isBlueBlood || BLUE_BLOOD_SCHOOLS.includes(team.school)),
      ).toBe(true);
    }
  });

  it('throws for one_program without exactly one teamId', () => {
    expect(() =>
      resolveSpinUnit('s', filters({ modeId: 'one_program' }), programSeasons, teams),
    ).toThrow('one_program mode requires exactly one teamId');
    expect(() =>
      resolveSpinUnit(
        's',
        filters({ modeId: 'one_program', teamIds: ['1', '2'] }),
        programSeasons,
        teams,
      ),
    ).toThrow(CfbSpinError);
  });

  it('throws for conference_trophy without criteria.conference', () => {
    expect(() =>
      resolveSpinUnit('s', filters({ modeId: 'conference_trophy' }), programSeasons, teams),
    ).toThrow('conference_trophy mode requires criteria.conference');
  });

  it('throws on an unknown mode', () => {
    expect(() => resolveSpinUnit('s', filters({ modeId: 'nope' }), programSeasons, teams)).toThrow(
      'Unknown CFB mode: nope',
    );
  });

  it('omits apFinalRank/cfpResult keys when null and includes them when present', () => {
    const ranked = resolveSpinUnit(
      's',
      filters({
        teamIds: [String(idOf('Alabama'))],
        seasonRange: { from: 2023, through: 2023 },
      }),
      programSeasons,
      teams,
    );
    expect(ranked.apFinalRank).toBe(1);
    expect(ranked.cfpResult).toBe('champion');
    const unranked = resolveSpinUnit(
      's',
      filters({
        teamIds: [String(idOf('Boise State'))],
        seasonRange: { from: 1995, through: 1995 },
      }),
      programSeasons,
      teams,
    );
    expect(unranked).toStrictEqual({
      sportId: 'cfb',
      programId: String(idOf('Boise State')),
      season: 1995,
      conferenceId: 'sun-belt',
    });
  });
});
