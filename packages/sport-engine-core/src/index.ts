// SportEngine contract per docs/spec.md §0.1 — every platform-core code path
// dispatches through this interface; it never imports sport-specific logic.

export type SportId = 'nfl' | 'cfb';

// TODO(spec §0.1): flesh out
export type SpinSeed = unknown;
// TODO(spec §0.1): flesh out
export type SpinFilters = unknown;
// TODO(spec §0.1): flesh out
export type DraftPoolUnit = unknown;
// TODO(spec §0.1): flesh out
export type SchemePreset = unknown;
// TODO(spec §0.1): flesh out
export type PlayerCandidate = unknown;
// TODO(spec §0.1): flesh out
export type RosterSlot = unknown;
// TODO(spec §0.1): flesh out
export type EligibilityResult = unknown;

export type RatingMode = 'career_season' | 'prime';

// TODO(spec §0.1): flesh out
export type PositionRating = unknown;
// TODO(spec §0.1): flesh out
export type CompletedRoster = unknown;
// TODO(spec §0.1): flesh out
export type SimulationMode = unknown;
// TODO(spec §0.1): flesh out
export type OpponentContext = unknown;
// TODO(spec §0.1): flesh out
export type SeasonResult = unknown;
// TODO(spec §0.1): flesh out
export type SportMode = unknown;
// TODO(spec §0.1): flesh out
export type ModeRuleset = unknown;
// TODO(spec §0.1): flesh out
export type TrophyDefinition = unknown;
// TODO(spec §0.1): flesh out
export type TrophyEvalContext = unknown;
// TODO(spec §0.1): flesh out
export type EarnedTrophy = unknown;

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

// Single dispatch point: sportId -> engine (docs/spec.md §0.1)
export type SportEngineRegistry = Record<SportId, SportEngine>;
