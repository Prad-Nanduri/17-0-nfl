import { createRng } from '@perfect-season/sport-engine-core/utils';
import type { DraftPoolUnit, SpinFilters } from '@perfect-season/sport-engine-core';
import type { CfbProgramSeason, CfbTeam } from './domain';
import { filterSpinPool, isPostseasonEligible } from './membership';
import { getModeRuleset } from './modes';

// Consensus-championship / AP Top-5 finish programs (spec §2A.7).
export const BLUE_BLOOD_SCHOOLS: readonly string[] = [
  'Alabama',
  'Ohio State',
  'Michigan',
  'Notre Dame',
  'Oklahoma',
  'USC',
  'Texas',
  'Nebraska',
  'Miami',
  'Florida',
  'LSU',
  'Florida State',
  'Penn State',
  'Georgia',
  'Clemson',
  'Tennessee',
];
const BLUE_BLOODS = new Set<string>(BLUE_BLOOD_SCHOOLS);

export class CfbSpinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CfbSpinError';
  }
}

export type CfbDraftPoolUnit = Extract<DraftPoolUnit, { readonly sportId: 'cfb' }>;

function criterionString(filters: SpinFilters, key: string): string | null {
  const value = filters.criteria[key];
  return typeof value === 'string' ? value : null;
}

function isExcluded(
  row: CfbProgramSeason,
  excludedUnits: readonly DraftPoolUnit[] | undefined,
): boolean {
  return (
    excludedUnits?.some(
      (unit) =>
        unit.sportId === 'cfb' &&
        unit.programId === String(row.cfbdTeamId) &&
        unit.season === row.season,
    ) ?? false
  );
}

export function resolveSpinUnit(
  seed: string,
  filters: SpinFilters,
  programSeasons: readonly CfbProgramSeason[],
  teams: readonly CfbTeam[],
): CfbDraftPoolUnit {
  getModeRuleset(filters.modeId);
  if (filters.modeId === 'one_program' && filters.teamIds?.length !== 1) {
    throw new CfbSpinError('one_program mode requires exactly one teamId');
  }
  const conference = criterionString(filters, 'conference');
  if (filters.modeId === 'conference_trophy' && conference === null) {
    throw new CfbSpinError('conference_trophy mode requires criteria.conference');
  }

  const eraTier = criterionString(filters, 'eraTier');
  const seasonRange = filters.seasonRange;
  const rankedOnly = filters.modeId === 'ranked_only' || filters.criteria.rankedOnly === true;
  const programPool =
    filters.modeId === 'blue_blood_bracket' ? 'elite' : criterionString(filters, 'programPool');
  const blueBloodIds = new Set(
    teams
      .filter((team) => team.isBlueBlood || BLUE_BLOODS.has(team.school))
      .map((team) => team.cfbdTeamId),
  );

  const survivors = filterSpinPool(programSeasons)
    .filter(
      (row) =>
        seasonRange === undefined ||
        (row.season >= seasonRange.from && row.season <= seasonRange.through),
    )
    .filter(
      (row) => filters.teamIds === undefined || filters.teamIds.includes(String(row.cfbdTeamId)),
    )
    .filter((row) => !isExcluded(row, filters.excludedUnits))
    .filter((row) => eraTier === null || row.eraTier === eraTier)
    .filter((row) => conference === null || row.conferenceKey === conference)
    .filter((row) => filters.criteria.postseasonEligible !== true || isPostseasonEligible(row))
    .filter((row) => !rankedOnly || row.apFinalRank !== null || row.peakRankThisSeason !== null)
    .filter((row) => programPool !== 'elite' || blueBloodIds.has(row.cfbdTeamId));

  survivors.sort((left, right) => left.season - right.season || left.cfbdTeamId - right.cfbdTeamId);
  if (survivors.length === 0) {
    throw new CfbSpinError('No program-season matches the spin filters');
  }
  const index = createRng(seed).integer(0, survivors.length);
  const selected = survivors[index];
  if (selected === undefined) {
    throw new CfbSpinError('No program-season matches the spin filters');
  }
  return {
    sportId: 'cfb',
    programId: String(selected.cfbdTeamId),
    season: selected.season,
    conferenceId: selected.conferenceKey,
    ...(selected.apFinalRank !== null ? { apFinalRank: selected.apFinalRank } : {}),
    ...(selected.cfpResult !== null ? { cfpResult: selected.cfpResult } : {}),
  };
}
