import type { RatingConfidenceTier } from '../src/types';

export interface EraCutoff {
  readonly fullFeatureFromSeason: number;
}

export function resolveConfidenceTier(season: number, cutoff: EraCutoff): RatingConfidenceTier {
  if (!Number.isFinite(season) || !Number.isInteger(season)) {
    throw new RangeError('season must be a finite integer');
  }
  if (
    !Number.isFinite(cutoff.fullFeatureFromSeason) ||
    !Number.isInteger(cutoff.fullFeatureFromSeason)
  ) {
    throw new RangeError('fullFeatureFromSeason must be a finite integer');
  }
  return season >= cutoff.fullFeatureFromSeason ? 'full_feature' : 'legacy';
}
