import { eloWinProbability, type DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import type { Opponent, Site } from '@perfect-season/sport-engine-core';
import { eloToRating, ratingToElo, type SportSimulationConfig } from './config';
import { effectiveRosterRating, varianceInjection } from './guardrail';
import { sampleDriveByDrive, type DriveSimulation } from './drive-sampler';

export interface SimulatedGame extends DriveSimulation {
  readonly opponentId: string;
  readonly site: Site;
  readonly effectiveRosterRating: number;
  readonly facts: Readonly<Record<string, string | number | boolean | null>>;
}

export function simulateGame(
  rosterRating: number,
  opponent: Opponent,
  config: SportSimulationConfig,
  rng: DeterministicRng,
): SimulatedGame {
  const opponentRating = eloToRating(opponent.rating, config.ratingScale);
  const effectiveRating = effectiveRosterRating(
    rosterRating,
    varianceInjection(opponentRating, config.varianceSigmaRating, rng),
  );
  const winProbability = eloWinProbability(
    ratingToElo(effectiveRating, config.ratingScale),
    opponent.rating,
    opponent.site,
    config.homeAdvantageRating * config.ratingScale.eloPerRatingPoint,
  );
  const result = sampleDriveByDrive(winProbability, config, rng);
  return {
    ...result,
    opponentId: opponent.id,
    site: opponent.site,
    effectiveRosterRating: effectiveRating,
    facts: {
      effectiveRosterRating: effectiveRating,
      winProbability,
    },
  };
}
