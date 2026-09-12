import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_ID = 'cfb' as const satisfies SportId;

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
export { normalizeCfbPosition, toPositionGroup, cfbPositionGroup } from './positions';
export { CFB_SCHEME_DISPLAY_NAMES, CFB_SCHEME_PRESETS, cfbSchemeDisplayName } from './schemes';
export { validateSlotEligibility } from './eligibility';
export { resolveSpinUnit, CfbSpinError, BLUE_BLOOD_SCHOOLS, type CfbDraftPoolUnit } from './spin';
export { getAvailableModes, getModeRuleset } from './modes';
export {
  CFB_SIMULATION_CONFIG,
  CFB_REGULAR_SEASON_GAMES,
  CFB_CONFERENCE_TITLE_WIN_THRESHOLD,
} from './simulation/config';
export {
  simulateCfbSeason,
  type CfbPostseasonResult,
  type CfbSeasonDependencies,
} from './simulation/simulate-season';
export {
  CFB_TROPHY_RULES,
  getCfbTrophyDefinitions,
  evaluateCfbTrophies,
  type CfbTrophyRule,
} from './trophies';
export { loadCfbFixtureData, type CfbFixtureData } from './data';
export {
  CfbSportEngine,
  createCfbSportEngine,
  type CfbSportEngineOptions,
  type CfbSpinUnitDescriptor,
} from './engine';
export type {
  RosterSlot,
  SchemePreset,
  EligibilityResult,
  ModeConstraint,
  ModeRuleset,
  SportMode,
} from '@perfect-season/sport-engine-core';
