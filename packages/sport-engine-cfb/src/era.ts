import { resolveConfidenceTier } from '@perfect-season/sport-engine-core/utils';
import type { RatingConfidenceTier } from '@perfect-season/sport-engine-core';
import type { EraCutoff } from '@perfect-season/sport-engine-core/utils';

// CFBD advanced/recruiting coverage solidifies ~2005 (spec §4.1).
export const CFB_ERA_CUTOFF: EraCutoff = { fullFeatureFromSeason: 2005 };

export function cfbConfidenceTier(season: number): RatingConfidenceTier {
  return resolveConfidenceTier(season, CFB_ERA_CUTOFF);
}
