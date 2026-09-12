export interface DriveOutcome {
  readonly outcome: string;
  readonly points: number;
  readonly probability: number;
}

export interface SportSimulationConfig {
  readonly possessionsPerTeam: number;
  readonly scoringTable: readonly DriveOutcome[];
  readonly strengthTilt: number;
  readonly ratingScale: {
    readonly baseElo: number;
    readonly eloPerRatingPoint: number;
  };
  readonly homeAdvantageRating: number;
  readonly varianceSigmaRating: number;
  readonly overtime: {
    readonly maxPeriods: number | null;
    readonly tiesAllowed: boolean;
  };
  readonly opponentDistribution: {
    readonly meanRating: number;
    readonly sdRating: number;
  };
  readonly difficultyOffsets: Readonly<Record<'easy' | 'normal' | 'hard', number>>;
}

export function validateSportSimulationConfig(config: SportSimulationConfig): void {
  if (!Number.isSafeInteger(config.possessionsPerTeam) || config.possessionsPerTeam <= 0) {
    throw new RangeError('Possessions per team must be a positive integer');
  }
  if (config.scoringTable.length === 0) {
    throw new RangeError('Scoring table must not be empty');
  }
  let probabilityTotal = 0;
  let noneEntries = 0;
  for (const entry of config.scoringTable) {
    if (
      entry.outcome.length === 0 ||
      !Number.isFinite(entry.points) ||
      entry.points < 0 ||
      !Number.isFinite(entry.probability) ||
      entry.probability < 0
    ) {
      throw new RangeError('Scoring outcomes must have valid names, points, and probabilities');
    }
    if (entry.outcome === 'none') {
      noneEntries += 1;
      if (entry.points !== 0) {
        throw new RangeError('The none scoring outcome must have zero points');
      }
    }
    probabilityTotal += entry.probability;
  }
  if (noneEntries !== 1 || Math.abs(probabilityTotal - 1) > 1e-9) {
    throw new RangeError('Scoring probabilities must sum to 1 with exactly one none outcome');
  }
  if (!Number.isFinite(config.strengthTilt) || config.strengthTilt < 0 || config.strengthTilt > 1) {
    throw new RangeError('Strength tilt must be between 0 and 1');
  }
  if (
    !Number.isFinite(config.ratingScale.baseElo) ||
    !Number.isFinite(config.ratingScale.eloPerRatingPoint) ||
    config.ratingScale.eloPerRatingPoint <= 0
  ) {
    throw new RangeError('Rating scale must have finite values and a positive Elo slope');
  }
  if (!Number.isFinite(config.homeAdvantageRating) || config.homeAdvantageRating < 0) {
    throw new RangeError('Home advantage must be finite and non-negative');
  }
  if (!Number.isFinite(config.varianceSigmaRating) || config.varianceSigmaRating < 0) {
    throw new RangeError('Variance sigma must be finite and non-negative');
  }
  if (
    config.overtime.maxPeriods !== null &&
    (!Number.isSafeInteger(config.overtime.maxPeriods) || config.overtime.maxPeriods <= 0)
  ) {
    throw new RangeError('Overtime max periods must be null or a positive integer');
  }
  if (typeof config.overtime.tiesAllowed !== 'boolean') {
    throw new RangeError('Overtime tiesAllowed must be boolean');
  }
  if (
    !Number.isFinite(config.opponentDistribution.meanRating) ||
    config.opponentDistribution.meanRating < 0 ||
    config.opponentDistribution.meanRating > 99 ||
    !Number.isFinite(config.opponentDistribution.sdRating) ||
    config.opponentDistribution.sdRating < 0
  ) {
    throw new RangeError('Opponent distribution must use a rating mean between 0 and 99');
  }
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    if (!Number.isFinite(config.difficultyOffsets[difficulty])) {
      throw new RangeError('Difficulty offsets must be finite');
    }
  }
}

export const ratingToElo = (rating: number, scale: SportSimulationConfig['ratingScale']): number =>
  scale.baseElo + (rating - 50) * scale.eloPerRatingPoint;

export const eloToRating = (elo: number, scale: SportSimulationConfig['ratingScale']): number =>
  50 + (elo - scale.baseElo) / scale.eloPerRatingPoint;
