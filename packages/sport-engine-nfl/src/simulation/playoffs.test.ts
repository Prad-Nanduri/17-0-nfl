import type { OpponentContext } from '@perfect-season/sport-engine-core';
import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { qualifiesForPlayoffs, seedFrom, simulatePlayoffBracket } from './playoffs';

const context: OpponentContext = {
  season: 2023,
  modelVersion: 'test',
  dataVersion: 'test',
  opponents: [],
  facts: {},
};

describe('NFL playoff rules', () => {
  it('uses the ten-win-equivalent threshold', () => {
    expect(qualifiesForPlayoffs({ wins: 10, losses: 7, ties: 0 })).toBe(true);
    expect(qualifiesForPlayoffs({ wins: 9, losses: 8, ties: 0 })).toBe(false);
    expect(qualifiesForPlayoffs({ wins: 9, losses: 7, ties: 1 })).toBe(false);
    expect(qualifiesForPlayoffs({ wins: 10, losses: 6, ties: 1 })).toBe(true);
  });

  it('assigns the bye and round shape for a 17-0 record', () => {
    expect(seedFrom({ wins: 17, losses: 0, ties: 0 })).toEqual({
      seed: 1,
      bye: true,
      rounds: ['divisional', 'conference', 'super_bowl'],
    });
  });

  it('assigns a qualifying ten-win record to a lower seed', () => {
    expect(seedFrom({ wins: 10, losses: 7, ties: 0 })).toMatchObject({
      seed: 5,
      bye: false,
      rounds: ['wild_card', 'divisional', 'conference', 'super_bowl'],
    });
  });

  it('stops at the first loss and uses neutral Super Bowl hosting', () => {
    let call = 0;
    const result = simulatePlayoffBracket(90, seedFrom({ wins: 17, losses: 0, ties: 0 }), context, {
      rng: createRng('playoffs'),
      simulateGame: (rating, opponent, config, rng) => {
        call += 1;
        return {
          ...{
            won: call > 1,
            tied: false,
            pointsFor: call > 1 ? 21 : 10,
            pointsAgainst: call > 1 ? 7 : 14,
            overtimePeriods: 0,
            winProbability: 0.5,
            drives: { for: [], against: [] },
            opponentId: opponent.id,
            site: opponent.site,
            effectiveRosterRating: rating,
            facts: {},
          },
          ...(config.overtime.tiesAllowed ? {} : {}),
          ...(rng ? {} : {}),
        };
      },
    });
    expect(result.outcome).toBe('lost_divisional');
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]?.games[0]?.site).toBe('home');
  });
});
