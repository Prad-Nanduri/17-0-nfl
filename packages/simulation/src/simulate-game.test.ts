import type { Opponent } from '@perfect-season/sport-engine-core';
import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { simulateGame } from './simulate-game';
import type { SportSimulationConfig } from './config';

const config: SportSimulationConfig = {
  possessionsPerTeam: 2,
  scoringTable: [
    { outcome: 'touchdown', points: 7, probability: 0.5 },
    { outcome: 'none', points: 0, probability: 0.5 },
  ],
  strengthTilt: 0.35,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 3,
  varianceSigmaRating: 0,
  overtime: { maxPeriods: null, tiesAllowed: false },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

const opponent: Opponent = {
  id: 'opponent',
  name: 'Opponent',
  rating: 1500,
  site: 'home',
  facts: {},
};

describe('simulateGame', () => {
  it('returns the site, opponent, effective rating, and win probability', () => {
    const game = simulateGame(80, opponent, config, createRng('game'));
    expect(game.opponentId).toBe('opponent');
    expect(game.site).toBe('home');
    expect(game.effectiveRosterRating).toBe(0.8 * 80 + 0.2 * 50);
    expect(game.winProbability).toBeGreaterThan(0.5);
    expect(game.facts).toMatchObject({
      effectiveRosterRating: game.effectiveRosterRating,
      winProbability: game.winProbability,
    });
  });
});
