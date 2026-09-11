import type {
  CompletedRoster,
  OpponentContext,
  SimulationMode,
} from '@perfect-season/sport-engine-core';
import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { simulateNFLSeason } from './simulate-season';
import type { SimulatedGame } from '@perfect-season/simulation';

const roster = {
  draftId: 'draft-1',
  sportId: 'nfl',
  schemeId: '4-3',
  ratingMode: 'career_season',
  picks: Array.from({ length: 24 }, (_, index) => ({
    slot: { code: `slot-${index}`, positionGroup: 'QB', eligiblePositions: ['QB'] },
    candidate: {
      playerId: `player-${index}`,
      fullName: `Player ${index}`,
      primaryPosition: 'QB',
      poolUnit: { sportId: 'nfl', franchiseId: 'NE', season: 2023 },
      seasons: [],
      traits: {},
    },
    rating: {
      positionGroup: 'QB',
      mode: 'career_season',
      overall: 90,
      sourceSeason: 2023,
      confidenceTier: 'full_feature',
      isTeamLevelProxy: false,
      modelVersion: 'test',
    },
    spinSeed: `seed-${index}`,
  })),
} as unknown as CompletedRoster;

const mode: SimulationMode = {
  modeId: 'core',
  difficulty: 'normal',
  seed: 'season-test',
  options: { fullGauntlet: true },
};

const context: OpponentContext = {
  season: 2023,
  modelVersion: 'test-model',
  dataVersion: 'test-data',
  opponents: [],
  facts: {},
};

function game(won: boolean, opponentId: string): SimulatedGame {
  return {
    opponentId,
    site: 'home',
    won,
    tied: false,
    pointsFor: won ? 24 : 10,
    pointsAgainst: won ? 10 : 24,
    overtimePeriods: 0,
    winProbability: won ? 0.8 : 0.2,
    effectiveRosterRating: 90,
    drives: { for: [], against: [] },
    facts: {},
  };
}

describe('NFL season simulation', () => {
  it('runs a 17-game regular season and a 17-0 seed-one gauntlet', () => {
    const result = simulateNFLSeason(roster, mode, context, {
      seed: 'all-wins',
      rng: createRng('all-wins'),
      simulateGame: (_rating, opponent) => game(true, opponent.id),
    });
    expect(result.record).toEqual({ wins: 17, losses: 0, ties: 0 });
    expect(result.stages[0]?.games).toHaveLength(17);
    expect(result.postseasonResult).toBe('won_super_bowl');
    expect(result.stages.slice(1).flatMap((stage) => stage.games)).toHaveLength(3);
  });

  it('records a first-round divisional loss after a 17-0 regular season', () => {
    let games = 0;
    const result = simulateNFLSeason(roster, mode, context, {
      seed: 'divisional-loss',
      rng: createRng('divisional-loss'),
      simulateGame: (_rating, opponent) => {
        games += 1;
        return game(games !== 18, opponent.id);
      },
    });
    expect(result.record).toEqual({ wins: 17, losses: 0, ties: 0 });
    expect(result.postseasonResult).toBe('lost_divisional');
    expect(result.stages.slice(1).flatMap((stage) => stage.games)).toHaveLength(1);
  });

  it('does not run a bracket unless Full Gauntlet is explicitly enabled', () => {
    const result = simulateNFLSeason(roster, { ...mode, options: {} }, context, {
      seed: 'no-gauntlet',
      rng: createRng('no-gauntlet'),
      simulateGame: (_r, opponent) => game(true, opponent.id),
    });
    expect(result.record.wins).toBe(17);
    expect(result.postseasonResult).toBeNull();
    expect(result.stages).toHaveLength(1);
  });

  it('is deterministic for the same seed', () => {
    const first = simulateNFLSeason(roster, mode, context, {
      seed: 'same',
      rng: createRng('same'),
    });
    const second = simulateNFLSeason(roster, mode, context, {
      seed: 'same',
      rng: createRng('same'),
    });
    expect(second).toEqual(first);
  });
});
