import type { DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import type { DriveOutcome, SportSimulationConfig } from './config';

export interface DriveSimulation {
  readonly won: boolean;
  readonly tied: boolean;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly overtimePeriods: number;
  readonly winProbability: number;
  readonly drives: {
    readonly for: readonly DriveOutcome[];
    readonly against: readonly DriveOutcome[];
  };
}

function sampleOutcome(
  outcomes: readonly DriveOutcome[],
  multiplier: number,
  rng: DeterministicRng,
): DriveOutcome {
  const weighted = outcomes.map((entry) => ({
    entry,
    probability: entry.outcome === 'none' ? entry.probability : entry.probability * multiplier,
  }));
  const scoringTotal = weighted
    .filter(({ entry }) => entry.outcome !== 'none')
    .reduce((total, item) => total + Math.max(0, item.probability), 0);
  const none = weighted.find(({ entry }) => entry.outcome === 'none');
  if (none === undefined) throw new RangeError('Scoring table must include none');
  const noneProbability = Math.max(0, 1 - scoringTotal);
  const total = scoringTotal + noneProbability;
  let target = rng.next() * total;
  for (const item of weighted) {
    const probability =
      item.entry.outcome === 'none'
        ? noneProbability / total
        : Math.max(0, item.probability) / total;
    target -= probability;
    if (target < 0) return item.entry;
  }
  return none.entry;
}

function sampleTeam(
  possessions: number,
  outcomes: readonly DriveOutcome[],
  multiplier: number,
  rng: DeterministicRng,
): { points: number; drives: readonly DriveOutcome[] } {
  const drives = Array.from({ length: possessions }, () =>
    sampleOutcome(outcomes, multiplier, rng),
  );
  return { points: drives.reduce((total, drive) => total + drive.points, 0), drives };
}

export function sampleDriveByDrive(
  winProbability: number,
  config: SportSimulationConfig,
  rng: DeterministicRng,
): DriveSimulation {
  if (!Number.isFinite(winProbability) || winProbability < 0 || winProbability > 1) {
    throw new RangeError('Win probability must be between 0 and 1');
  }
  const rosterWins = rng.next() < winProbability;
  const tilt = config.strengthTilt * Math.abs(2 * winProbability - 1);
  const rosterMultiplier = winProbability >= 0.5 ? 1 + tilt : 1 - tilt;
  const opponentMultiplier = winProbability >= 0.5 ? 1 - tilt : 1 + tilt;
  let roster = sampleTeam(config.possessionsPerTeam, config.scoringTable, rosterMultiplier, rng);
  let opponent = sampleTeam(
    config.possessionsPerTeam,
    config.scoringTable,
    opponentMultiplier,
    rng,
  );
  if (roster.points > opponent.points !== rosterWins && roster.points !== opponent.points) {
    [roster, opponent] = [opponent, roster];
  }

  let overtimePeriods = 0;
  while (roster.points === opponent.points) {
    if (
      config.overtime.maxPeriods !== null &&
      overtimePeriods >= config.overtime.maxPeriods &&
      config.overtime.tiesAllowed &&
      winProbability > 0 &&
      winProbability < 1
    ) {
      break;
    }
    overtimePeriods += 1;
    const rosterOvertime = sampleOutcome(config.scoringTable, rosterMultiplier, rng);
    const opponentOvertime = sampleOutcome(config.scoringTable, opponentMultiplier, rng);
    roster = {
      points: roster.points + rosterOvertime.points,
      drives: [...roster.drives, rosterOvertime],
    };
    opponent = {
      points: opponent.points + opponentOvertime.points,
      drives: [...opponent.drives, opponentOvertime],
    };
  }
  if (roster.points !== opponent.points && roster.points > opponent.points !== rosterWins) {
    [roster, opponent] = [opponent, roster];
  }
  return {
    won: roster.points > opponent.points,
    tied: roster.points === opponent.points,
    pointsFor: roster.points,
    pointsAgainst: opponent.points,
    overtimePeriods,
    winProbability,
    drives: { for: roster.drives, against: opponent.drives },
  };
}
