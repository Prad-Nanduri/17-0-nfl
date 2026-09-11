import type { Opponent } from '@perfect-season/sport-engine-core';
import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { ratingToElo, type SportSimulationConfig } from './config';
import { generateSchedule } from './schedule';

const config: SportSimulationConfig = {
  possessionsPerTeam: 1,
  scoringTable: [{ outcome: 'none', points: 0, probability: 1 }],
  strengthTilt: 0,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 0,
  varianceSigmaRating: 0,
  overtime: { maxPeriods: 1, tiesAllowed: true },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

const opponents: readonly Opponent[] = [
  { id: 'a', name: 'A', rating: ratingToElo(70, config.ratingScale), site: 'neutral', facts: {} },
  { id: 'b', name: 'B', rating: ratingToElo(75, config.ratingScale), site: 'neutral', facts: {} },
  { id: 'c', name: 'C', rating: ratingToElo(80, config.ratingScale), site: 'neutral', facts: {} },
];

describe('schedule generation', () => {
  it('uses counts, home/away split, and real opponents without replacement', () => {
    const schedule = generateSchedule({
      games: 3,
      difficulty: 'normal',
      opponents,
      config,
      rng: createRng('schedule'),
    });
    expect(schedule).toHaveLength(3);
    expect(schedule.filter((game) => game.site === 'home')).toHaveLength(2);
    expect(schedule.filter((game) => game.site === 'away')).toHaveLength(1);
    expect(new Set(schedule.map((game) => game.opponent.id)).size).toBe(3);
  });

  it('uses replacement, difficulty offsets, synthetic fallback, and deterministic replay', () => {
    const repeated = generateSchedule({
      games: 4,
      difficulty: 'hard',
      opponents: [opponents[0]!],
      config,
      rng: createRng('replacement'),
    });
    expect(repeated).toHaveLength(4);
    expect(new Set(repeated.map((game) => game.opponent.id)).size).toBe(1);
    expect(repeated[0]!.opponent.rating).toBe(opponents[0]!.rating + 80);
    const synthetic = generateSchedule({
      games: 4,
      difficulty: 'easy',
      opponents: [],
      config,
      rng: createRng('synthetic'),
    });
    expect(synthetic.every((game) => game.opponent.id.startsWith('synthetic-'))).toBe(true);
    expect(synthetic).toEqual(
      generateSchedule({
        games: 4,
        difficulty: 'easy',
        opponents: [],
        config,
        rng: createRng('synthetic'),
      }),
    );
  });
});
