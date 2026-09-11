import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_ID = 'nfl' as const satisfies SportId;

// NflSportEngine implementing SportEngine (docs/spec.md §0.1) lands in a later PR.
export type * from './domain';
export { toPositionGroup } from './positions';
export { NFL_ERA_CUTOFF, nflConfidenceTier } from './era';
export { COMPOSITES, type CompositeComponent } from './ratings/composites';
export { zScores, percentileRank, toRatingScale } from './ratings/scale';
export { MIN_VOLUME, isQualified } from './ratings/qualification';
export { RATING_MODEL_VERSION, rateSeason } from './ratings/rate-season';
export { rateLegacyCareers } from './ratings/legacy';
