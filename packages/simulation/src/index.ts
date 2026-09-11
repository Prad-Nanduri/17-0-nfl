import type { SportId } from '@perfect-season/sport-engine-core';

export type SimulateRequest = { sportId: SportId };

export {
  eloToRating,
  ratingToElo,
  validateSportSimulationConfig,
  type DriveOutcome,
  type SportSimulationConfig,
} from './config';
export { GUARDRAIL_WEIGHTS, effectiveRosterRating, normal, varianceInjection } from './guardrail';
export { sampleDriveByDrive, type DriveSimulation } from './drive-sampler';
export { simulateGame, type SimulatedGame } from './simulate-game';
export { generateSchedule, type ScheduleRequest, type ScheduledGame } from './schedule';
export { aggregateRosterRating, POSITION_WEIGHTS } from '@perfect-season/sport-engine-core/utils';
