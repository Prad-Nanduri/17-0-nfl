import type { NflPlayerSeasonStats, NflRating } from '../domain';
import { COMPOSITES } from './composites';
import { isQualified } from './qualification';
import { percentileRank, toRatingScale, zScores } from './scale';

export const RATING_MODEL_VERSION = 'nfl-rating-v1';

function groupKey(row: NflPlayerSeasonStats): string {
  return `${row.season}:${row.positionGroup}`;
}

function rowKey(row: NflPlayerSeasonStats): string {
  return `${row.gsisId}:${row.franchiseKey}:${groupKey(row)}`;
}

function finiteStat(row: NflPlayerSeasonStats, statKey: string): number | null {
  const value = row.stats[statKey];
  return value !== undefined && value !== null && Number.isFinite(value) ? value : null;
}

export function rateSeason(
  rows: readonly NflPlayerSeasonStats[],
  modelVersion = RATING_MODEL_VERSION,
): NflRating[] {
  const populations = new Map<string, NflPlayerSeasonStats[]>();
  for (const row of rows) {
    if (!isQualified(row)) continue;
    const population = populations.get(groupKey(row)) ?? [];
    population.push(row);
    populations.set(groupKey(row), population);
  }

  const rated = new Map<
    string,
    { readonly overall: number; readonly percentile: number; readonly composite: number }
  >();
  for (const population of populations.values()) {
    const positionGroup = population[0]?.positionGroup;
    if (!positionGroup) continue;
    const components = COMPOSITES[positionGroup];
    const componentZScores = components.map((component) =>
      zScores(population.map((row) => finiteStat(row, component.statKey))),
    );
    const composites = population.map((_, rowIndex) =>
      components.reduce((score, component, componentIndex) => {
        const z = componentZScores[componentIndex]?.[rowIndex] ?? 0;
        return score + component.weight * (component.invert ? -1 : 1) * (z ?? 0);
      }, 0),
    );
    const percentiles = percentileRank(composites);
    population.forEach((row, index) => {
      const percentile = percentiles[index] ?? 0.5;
      const composite = composites[index] ?? 0;
      rated.set(rowKey(row), {
        overall: toRatingScale(percentile),
        percentile,
        composite,
      });
    });
  }

  return rows.map((row) => {
    const rating = rated.get(rowKey(row));
    const qualified = isQualified(row);
    return {
      gsisId: row.gsisId,
      franchiseKey: row.franchiseKey,
      season: row.season,
      positionGroup: row.positionGroup,
      ratingMode: 'career_season',
      overall: qualified && rating ? rating.overall : 40,
      percentile: qualified && rating ? rating.percentile : null,
      compositeScore: qualified && rating ? rating.composite : null,
      qualified,
      confidenceTier: row.eraTier,
      isTeamLevelProxy: row.positionGroup === 'OL' || row.isTeamLevelProxy,
      modelVersion,
    };
  });
}
