import type { PositionGroup } from '@perfect-season/sport-engine-core';
import type { NflLegacyPlayerCareer, NflRating } from '../domain';
import { percentileRank, toRatingScale, zScores } from './scale';

const primaryBoxScore: Readonly<Record<PositionGroup, string>> = {
  QB: 'passYards',
  RB: 'rushYards',
  WR: 'recYards',
  TE: 'recYards',
  OL: 'seasonsStarted',
  DL: 'defSoloTackles',
  LB: 'defSoloTackles',
  CB: 'defSoloTackles',
  S: 'defSoloTackles',
  K: 'seasonsStarted',
  P: 'seasonsStarted',
};

function value(row: NflLegacyPlayerCareer, key: string): number | null {
  const item = row.stats[key];
  return item !== undefined && item !== null && Number.isFinite(item) ? item : null;
}

function boxScoreTotal(row: NflLegacyPlayerCareer): number | null {
  if (['DL', 'LB', 'CB', 'S'].includes(row.positionGroup)) {
    const tackles = value(row, 'defSoloTackles');
    const sacks = value(row, 'defSacks');
    const interceptions = value(row, 'defInts');
    return tackles === null || sacks === null || interceptions === null
      ? null
      : tackles + 10 * sacks + 20 * interceptions;
  }
  return value(row, primaryBoxScore[row.positionGroup]);
}

export function rateLegacyCareers(rows: readonly NflLegacyPlayerCareer[]): NflRating[] {
  const populations = new Map<PositionGroup, NflLegacyPlayerCareer[]>();
  for (const row of rows) {
    const games = value(row, 'games');
    if (games === null || games < 16) continue;
    const population = populations.get(row.positionGroup) ?? [];
    population.push(row);
    populations.set(row.positionGroup, population);
  }

  const rated = new Map<
    string,
    { readonly overall: number; readonly percentile: number; readonly composite: number }
  >();
  for (const [positionGroup, population] of populations) {
    const metrics = population.map(
      (row) =>
        [
          value(row, 'carAv'),
          value(row, 'proBowls'),
          value(row, 'allPro'),
          boxScoreTotal(row),
        ] as const,
    );
    const zMetric = [0, 1, 2, 3].map((metric) =>
      zScores(metrics.map((values) => values[metric] ?? null)),
    );
    const composites = population.map((_, index) =>
      [0.45, 0.2, 0.15, 0.2].reduce(
        (sum, weight, metric) => sum + weight * (zMetric[metric]?.[index] ?? 0),
        0,
      ),
    );
    const percentiles = percentileRank(composites);
    population.forEach((row, index) => {
      const percentile = percentiles[index] ?? 0.5;
      rated.set(row.pfrId, {
        overall: toRatingScale(percentile),
        percentile,
        composite: composites[index] ?? 0,
      });
    });
    void positionGroup;
  }

  return rows.map((row) => {
    const rating = rated.get(row.pfrId);
    const qualified = value(row, 'games') !== null && (value(row, 'games') ?? 0) >= 16;
    return {
      gsisId: row.gsisId ?? null,
      franchiseKey: row.franchiseKey,
      season: row.careerFromSeason,
      positionGroup: row.positionGroup,
      ratingMode: 'career_season',
      overall: qualified && rating ? rating.overall : 40,
      percentile: qualified && rating ? rating.percentile : null,
      compositeScore: qualified && rating ? rating.composite : null,
      qualified,
      confidenceTier: 'legacy',
      isTeamLevelProxy: false,
      modelVersion: 'nfl-legacy-rating-v1',
    };
  });
}
