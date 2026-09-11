import { resolveConfidenceTier } from '@perfect-season/sport-engine-core/utils';
import type { RatingConfidenceTier } from '@perfect-season/sport-engine-core';
import type { EraCutoff } from '@perfect-season/sport-engine-core/utils';

export const NFL_ERA_CUTOFF: EraCutoff = { fullFeatureFromSeason: 1999 };

export function nflConfidenceTier(season: number): RatingConfidenceTier {
  return resolveConfidenceTier(season, NFL_ERA_CUTOFF);
}
