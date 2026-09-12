import { describe, expect, it } from 'vitest';
import {
  eloToRating,
  ratingToElo,
  validateSportSimulationConfig,
  type SportSimulationConfig,
} from './config';

const validConfig: SportSimulationConfig = {
  possessionsPerTeam: 2,
  scoringTable: [
    { outcome: 'touchdown', points: 7, probability: 0.5 },
    { outcome: 'none', points: 0, probability: 0.5 },
  ],
  strengthTilt: 0.35,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 3,
  varianceSigmaRating: 6,
  overtime: { maxPeriods: 1, tiesAllowed: true },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

describe('simulation config', () => {
  it('accepts a valid config and round-trips ratings to Elo', () => {
    expect(() => validateSportSimulationConfig(validConfig)).not.toThrow();
    expect(eloToRating(ratingToElo(87, validConfig.ratingScale), validConfig.ratingScale)).toBe(87);
  });

  it.each([
    ['possessionsPerTeam', { possessionsPerTeam: 0 }],
    ['scoring total', { scoringTable: [{ outcome: 'none', points: 0, probability: 0.9 }] }],
    ['strength tilt', { strengthTilt: 1.1 }],
    ['Elo slope', { ratingScale: { baseElo: 1500, eloPerRatingPoint: 0 } }],
    ['overtime periods', { overtime: { maxPeriods: 0, tiesAllowed: true } }],
    ['opponent mean', { opponentDistribution: { meanRating: 100, sdRating: 1 } }],
  ])('rejects invalid %s', (_, change) => {
    expect(() =>
      validateSportSimulationConfig({
        ...validConfig,
        ...change,
      } as SportSimulationConfig),
    ).toThrow(RangeError);
  });
});
