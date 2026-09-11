import { createRng } from '@perfect-season/sport-engine-core/utils';
import type { DraftPoolUnit, SpinFilters } from '@perfect-season/sport-engine-core';
import type { NflFranchise, NflFranchiseSeason } from './domain';
import { getModeRuleset } from './modes';

export const ELITE_FRANCHISE_KEYS = ['PIT', 'NE', 'SF', 'DAL', 'GB', 'NYG'] as const;
const ELITE_FRANCHISES = new Set<string>(ELITE_FRANCHISE_KEYS);

export class NflSpinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NflSpinError';
  }
}

export type NflDraftPoolUnit = Extract<DraftPoolUnit, { readonly sportId: 'nfl' }>;

function criterionString(filters: SpinFilters, key: string): string | null {
  const value = filters.criteria[key];
  return typeof value === 'string' ? value : null;
}

function isExcluded(
  row: NflFranchiseSeason,
  excludedUnits: readonly DraftPoolUnit[] | undefined,
): boolean {
  return (
    excludedUnits?.some(
      (unit) =>
        unit.sportId === 'nfl' &&
        unit.franchiseId === row.franchiseKey &&
        unit.season === row.season,
    ) ?? false
  );
}

export function resolveSpinUnit(
  seed: string,
  filters: SpinFilters,
  franchiseSeasons: readonly NflFranchiseSeason[],
  franchises: readonly NflFranchise[],
): NflDraftPoolUnit {
  getModeRuleset(filters.modeId);
  if (filters.modeId === 'one_franchise' && filters.teamIds?.length !== 1) {
    throw new NflSpinError('one_franchise mode requires exactly one teamId');
  }
  const conference = criterionString(filters, 'conference');
  if (filters.modeId === 'conference_trophy' && conference === null) {
    throw new NflSpinError('conference_trophy mode requires criteria.conference');
  }

  const franchiseIndex = new Map(
    franchises.map((franchise) => [franchise.franchiseKey, franchise]),
  );
  const seasonRange = filters.seasonRange;
  const eraTier = criterionString(filters, 'eraTier');
  const franchisePool =
    filters.modeId === 'playoff_draft' ? 'elite' : criterionString(filters, 'franchisePool');
  const survivors = franchiseSeasons
    .filter(
      (row) =>
        seasonRange === undefined ||
        (row.season >= seasonRange.from && row.season <= seasonRange.through),
    )
    .filter((row) => filters.teamIds === undefined || filters.teamIds.includes(row.franchiseKey))
    .filter((row) => !isExcluded(row, filters.excludedUnits))
    .filter((row) => eraTier === null || row.eraTier === eraTier)
    .filter((row) => franchisePool !== 'elite' || ELITE_FRANCHISES.has(row.franchiseKey))
    .filter(
      (row) =>
        conference === null || franchiseIndex.get(row.franchiseKey)?.conference === conference,
    );

  survivors.sort(
    (left, right) =>
      left.season - right.season || left.franchiseKey.localeCompare(right.franchiseKey),
  );
  if (survivors.length === 0) {
    throw new NflSpinError('No franchise-season matches the spin filters');
  }
  const index = createRng(seed).integer(0, survivors.length);
  const selected = survivors[index];
  if (selected === undefined) {
    throw new NflSpinError('No franchise-season matches the spin filters');
  }
  return {
    sportId: 'nfl',
    franchiseId: selected.franchiseKey,
    season: selected.season,
  };
}
