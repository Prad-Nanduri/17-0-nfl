import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_ID = 'cfb' as const satisfies SportId;

// CfbSportEngine implementing SportEngine (docs/spec.md §0.1) lands in a later PR.
export type * from './domain';
export { TEAM_LEVEL_RATING_BADGE } from './domain';
export { CFB_ERA_CUTOFF, cfbConfidenceTier } from './era';
export {
  resolveMembershipStatus,
  isSpinPoolEligible,
  isPostseasonEligible,
  filterSpinPool,
} from './membership';
export {
  KNOWN_DEFUNCT_CONFERENCES,
  buildConferenceDimension,
  conferenceKey,
  describeConference,
  type ConferenceDescriptor,
  type CurrentConferenceInput,
} from './conferences';
export { zScores, percentileRank, toRatingScale } from './ratings/scale';
export {
  LINE_PROXY_WEIGHTS,
  SELECTION_BONUS,
  lineProxyComposite,
  lineProxyRating,
  teamLineEfficiencyPercentiles,
  type LineProxyInput,
  type LineProxyRating,
} from './ratings/line-proxy';
export { CFB_RATING_MODEL_VERSION, rateSeason } from './ratings/rate-season';
