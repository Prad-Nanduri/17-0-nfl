export type SportId = 'nfl' | 'cfb';

// Decimal strings preserve Postgres BIGINT identifiers through JSON without precision loss.
export type EntityId = string;
export type SpinSeed = string;
export type RatingMode = 'career_season' | 'prime';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type DraftOrder = 'squad_first' | 'position_first';
export type SchemeId = '4-3' | '3-4' | 'nickel';
export type RatingConfidenceTier = 'full_feature' | 'legacy';
export type Site = 'home' | 'away' | 'neutral';

// Metric/flag names belong to the engine; the platform can serialize, but not interpret, them.
export type EngineFacts = Readonly<
  Record<string, string | number | boolean | null | readonly string[] | readonly number[]>
>;

export type DraftPoolUnit =
  | {
      readonly sportId: 'nfl';
      readonly franchiseId: EntityId;
      readonly season: number;
    }
  | {
      readonly sportId: 'cfb';
      readonly programId: EntityId;
      readonly season: number;
      readonly conferenceId: EntityId | null; // Independent programs have no conference.
      readonly apFinalRank?: number;
      readonly cfpResult?: string; // Engine-owned outcome code, stored as TEXT in §5.2.
    };

export interface SpinFilters {
  readonly modeId: string;
  readonly seasonRange?: { readonly from: number; readonly through: number };
  readonly teamIds?: readonly EntityId[];
  readonly excludedUnits?: readonly DraftPoolUnit[];
  readonly criteria: EngineFacts;
}

export type PositionGroup = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'CB' | 'S' | 'K' | 'P';

export interface RosterSlot {
  readonly code: string;
  readonly positionGroup: PositionGroup;
  readonly eligiblePositions: readonly string[];
}

export type RosterLineup<T> = readonly [
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
  T,
];

export interface SchemePreset {
  readonly id: SchemeId;
  readonly name: string;
  readonly description: string;
  readonly slots: RosterLineup<RosterSlot>;
}

export interface PlayerSeason {
  readonly poolUnit: DraftPoolUnit;
  readonly position: string;
  readonly confidenceTier: RatingConfidenceTier;
  readonly stats: Readonly<Record<string, number | null>>;
}

export interface PlayerCandidate {
  readonly playerId: EntityId;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly poolUnit: DraftPoolUnit;
  // Includes the selected season and the history needed for Prime; engines enforce team scope.
  readonly seasons: readonly PlayerSeason[];
  readonly traits: EngineFacts;
}

export type EligibilityResult =
  | { readonly eligible: true; readonly warnings: readonly string[] }
  | { readonly eligible: false; readonly reason: string };

export interface PositionRating {
  readonly positionGroup: PositionGroup;
  readonly mode: RatingMode;
  readonly overall: number; // Finite, 0–99; engines own the rating formula and any rating floor.
  readonly sourceSeason: number;
  readonly confidenceTier: RatingConfidenceTier;
  readonly isTeamLevelProxy: boolean;
  readonly modelVersion: string;
}

export interface RosterPick {
  readonly slot: RosterSlot;
  readonly candidate: PlayerCandidate;
  readonly rating: PositionRating;
  readonly spinSeed: SpinSeed;
}

export interface CompletedRoster {
  readonly draftId: EntityId;
  readonly sportId: SportId;
  readonly schemeId: SchemeId;
  readonly ratingMode: RatingMode;
  readonly picks: RosterLineup<RosterPick>;
}

export interface SimulationMode {
  readonly modeId: string;
  readonly difficulty: Difficulty;
  readonly seed: SpinSeed;
  // Engine-owned toggles (e.g. campaign shape) avoid prescribing one sport's season structure.
  readonly options: EngineFacts;
}

export interface Opponent {
  readonly id: string; // May be synthetic rather than a database team.
  readonly name: string;
  readonly rating: number; // Elo-scale input, not a 0–99 player rating.
  readonly site: Site;
  readonly facts: EngineFacts;
}

export interface OpponentContext {
  readonly season: number;
  readonly modelVersion: string;
  readonly dataVersion: string;
  readonly opponents: readonly Opponent[];
  readonly facts: EngineFacts;
}

export interface SeasonRecord {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

export interface GameResult {
  readonly opponentId: string;
  readonly site: Site;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly outcome: 'win' | 'loss' | 'tie';
  readonly facts: EngineFacts;
}

// An ordered stage list represents a regular season, a bracket, or a consolation path.
export interface SeasonStageResult {
  readonly id: string;
  readonly name: string;
  readonly games: readonly GameResult[];
  readonly record: SeasonRecord;
  readonly outcome: string | null;
}

export interface SeasonResult {
  readonly draftId: EntityId;
  readonly sportId: SportId;
  readonly modeId: string;
  readonly seed: SpinSeed;
  readonly modelVersion: string;
  readonly dataVersion: string;
  readonly record: SeasonRecord; // Regular-season record; each additional stage has its own.
  readonly pointsFor: number; // Regular-season totals, matching record's scope.
  readonly pointsAgainst: number;
  readonly postseasonResult: string | null; // Stable engine-owned outcome code (§5.2).
  readonly stages: readonly SeasonStageResult[];
  readonly facts: EngineFacts;
}

export interface SportMode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface DifficultyRules {
  readonly rerolls: number;
  readonly ratingsVisible: boolean;
  readonly facts: EngineFacts;
}

export interface ModeConstraint {
  readonly code: string;
  readonly description: string;
  readonly parameters: EngineFacts;
}

export interface ModeRuleset {
  readonly modeId: string;
  readonly draftOrders: readonly DraftOrder[];
  readonly ratingModes: readonly RatingMode[];
  readonly schemeIds: readonly SchemeId[];
  readonly difficultyRules: Readonly<Record<Difficulty, DifficultyRules>>;
  readonly defaultSimulationOptions: EngineFacts;
  readonly constraints: readonly ModeConstraint[];
}

export type TrophyCategory =
  'result' | 'identity' | 'novelty' | 'playoff_draft' | 'joke' | 'ranking' | 'meta';
export type TrophyTier = 'bronze' | 'silver' | 'gold';

export interface TrophyDefinition {
  readonly code: string;
  readonly sportId: SportId | null;
  readonly name: string;
  readonly description: string;
  readonly category: TrophyCategory;
  readonly isSecret: boolean;
  readonly modeExclusiveTo: string | null;
  readonly tiers: readonly TrophyTier[]; // Empty for an un-tiered trophy.
}

export interface EarnedTrophy {
  readonly code: string;
  readonly sportId: SportId | null;
  readonly draftId: EntityId | null;
  readonly tier: TrophyTier | null;
  readonly earnedAt: string; // ISO-8601 UTC timestamp supplied by the caller, never by RNG.
}

export interface TrophyEvalContext {
  readonly userId: EntityId | null;
  readonly roster: CompletedRoster;
  readonly priorResults: readonly {
    readonly result: SeasonResult;
    readonly completedAt: string; // ISO-8601 UTC, for rolling-window achievements.
  }[];
  readonly earnedTrophies: readonly EarnedTrophy[];
  readonly evaluatedAt: string;
  readonly facts: EngineFacts;
}
