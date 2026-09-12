// SportEngine contract per docs/spec.md §0.1 — every platform-core code path
// dispatches through this interface; it never imports sport-specific logic.

import type {
  SportId,
  SpinSeed,
  SpinFilters,
  DraftPoolUnit,
  SchemePreset,
  PlayerCandidate,
  RosterSlot,
  EligibilityResult,
  RatingMode,
  PositionRating,
  CompletedRoster,
  SimulationMode,
  OpponentContext,
  SeasonResult,
  SportMode,
  ModeRuleset,
  TrophyDefinition,
  TrophyEvalContext,
  EarnedTrophy,
} from './types';

export type * from './types';
export { createSportEngineRegistry, type SportEngineRegistry } from './registry';
export { SCHEME_PRESETS } from './schemes';

export interface SportEngine {
  readonly sportId: SportId;
  readonly displayName: string; // "NFL" / "College Football (FBS)"
  readonly rosterSlotCount: 24; // both sports standardize on this — see §0.4

  // (a) Resolve a wheel spin into a concrete, real draft-pool unit
  resolveSpinUnit(seed: SpinSeed, filters: SpinFilters): Promise<DraftPoolUnit>;
  // NFL  -> { franchiseId, season }
  // CFB  -> { programId, season, conferenceId, apFinalRank?, cfpResult? }

  // (b) Roster/scheme presets + slot eligibility validation
  getSchemePresets(): SchemePreset[];
  validateSlotEligibility(candidate: PlayerCandidate, slot: RosterSlot): EligibilityResult;

  // (c) Rating formula per position group
  computeRating(candidate: PlayerCandidate, mode: RatingMode): PositionRating;

  // (d) Turn a completed roster into a simulated season outcome
  simulateSeason(
    roster: CompletedRoster,
    mode: SimulationMode,
    opponentContext: OpponentContext,
  ): Promise<SeasonResult>;

  // (e) Sport's own mode list + mode-specific rules
  getAvailableModes(): SportMode[];
  getModeRuleset(modeId: string): ModeRuleset;

  // (f) Sport's own trophy/achievement definitions + evaluation
  getTrophyDefinitions(): TrophyDefinition[];
  evaluateTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[];
}
