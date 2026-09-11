import { createRng, type DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { effectiveRosterRating, GUARDRAIL_WEIGHTS, varianceInjection } from './guardrail';
import { simulateGame } from './simulate-game';
import type { SportSimulationConfig } from './config';

const config: SportSimulationConfig = {
  possessionsPerTeam: 1,
  scoringTable: [
    { outcome: 'touchdown', points: 7, probability: 0.5 },
    { outcome: 'none', points: 0, probability: 0.5 },
  ],
  strengthTilt: 0,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 0,
  varianceSigmaRating: 0,
  overtime: { maxPeriods: null, tiesAllowed: false },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

describe('simulation guardrail', () => {
  it('uses the exact 80/20 weights', () => {
    expect(GUARDRAIL_WEIGHTS).toEqual({ roster: 0.8, opponent: 0.2 });
    expect(GUARDRAIL_WEIGHTS.roster + GUARDRAIL_WEIGHTS.opponent).toBe(1);
    for (const roster of [0, 25, 50, 75, 99]) {
      for (const opponent of [0, 33, 66, 99]) {
        expect(effectiveRosterRating(roster, opponent)).toBeCloseTo(
          0.8 * roster + 0.2 * opponent,
          12,
        );
      }
    }
    expect(effectiveRosterRating(50, 70) - effectiveRosterRating(50, 60)).toBeCloseTo(2, 12);
    expect(effectiveRosterRating(60, 50) - effectiveRosterRating(50, 50)).toBeCloseTo(8, 12);
  });

  it('injects deterministic bounded variance and preserves sigma zero', () => {
    expect(varianceInjection(72, 0, createRng('zero'))).toBe(72);
    const first = varianceInjection(72, 6, createRng('variance'));
    const second = varianceInjection(72, 6, createRng('variance'));
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(99);
  });

  it('exposes the effective rating used by the Elo calculation', () => {
    const values = [0.5, 0.5, 0.1, 0.9, 0.1];
    const rng: DeterministicRng = {
      nextUint32: () => 0,
      next: () => values.shift() ?? 0.1,
      integer: () => 0,
    };
    const game = simulateGame(
      80,
      { id: 'opponent', name: 'Opponent', rating: 1500, site: 'neutral', facts: {} },
      config,
      rng,
    );
    expect(game.effectiveRosterRating).toBe(0.8 * 80 + 0.2 * 50);
    expect(game.facts.effectiveRosterRating).toBe(game.effectiveRosterRating);
  });
});
