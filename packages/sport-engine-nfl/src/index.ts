import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_ID = 'nfl' as const satisfies SportId;

export type * from './domain';
export { toPositionGroup, toRatingPositionGroup, type RatingPositionInput } from './positions';
export { NFL_ERA_CUTOFF, nflConfidenceTier } from './era';
export { COMPOSITES, type CompositeComponent } from './ratings/composites';
export { zScores, percentileRank, toRatingScale } from './ratings/scale';
export { MIN_VOLUME, isQualified } from './ratings/qualification';
export { RATING_MODEL_VERSION, rateSeason } from './ratings/rate-season';
export { rateLegacyCareers } from './ratings/legacy';
export { SCHEME_PRESETS } from './schemes';
export type {
  RosterSlot,
  SchemePreset,
  EligibilityResult,
  ModeConstraint,
  ModeRuleset,
  SportMode,
} from '@perfect-season/sport-engine-core';
export { validateSlotEligibility } from './eligibility';
export { resolveSpinUnit, NflSpinError, ELITE_FRANCHISE_KEYS, type NflDraftPoolUnit } from './spin';
export { getAvailableModes, getModeRuleset } from './modes';
export {
  createLogoResolver,
  type LogoCacheEntry,
  type LogoResolver,
  type LogoResolverOptions,
  type LogoResult,
} from './media/espn-logos';
export { loadNflFixtureData, type NflFixtureData } from './data';
export { NflSportEngine, createNflSportEngine, type NflSportEngineOptions } from './engine';
export {
  NFL_PLAYOFF_CONFIG,
  NFL_REGULAR_SEASON_GAMES,
  NFL_SIMULATION_CONFIG,
} from './simulation/config';
export {
  NFL_PLAYOFF_WIN_THRESHOLD,
  qualifiesForPlayoffs,
  seedFrom,
  simulatePlayoffBracket,
  type NflPlayoffResult,
  type NflPlayoffSeed,
  type PlayoffDependencies,
} from './simulation/playoffs';
export { simulateNFLSeason, type NflSeasonDependencies } from './simulation/simulate-season';
