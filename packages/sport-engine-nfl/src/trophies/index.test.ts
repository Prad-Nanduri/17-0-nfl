import type {
  GameResult,
  SeasonResult,
  SeasonStageResult,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import { describe, expect, it } from 'vitest';
import { evaluateNflTrophies } from './index';

const context = {
  userId: null,
  roster: {} as TrophyEvalContext['roster'],
  priorResults: [],
  earnedTrophies: [],
  evaluatedAt: '2026-01-01T00:00:00.000Z',
  facts: {},
} satisfies TrophyEvalContext;

function seasonWith(
  outcomes: readonly ('win' | 'loss' | 'tie')[],
  postseasonResult: string | null = null,
): SeasonResult {
  const games: GameResult[] = outcomes.map((outcome, index) => ({
    opponentId: `opponent-${index}`,
    site: 'home',
    pointsFor: outcome === 'win' ? 24 : 10,
    pointsAgainst: outcome === 'win' ? 10 : 24,
    outcome,
    facts: {},
  }));
  const record = outcomes.reduce(
    (current, outcome) => ({
      wins: current.wins + (outcome === 'win' ? 1 : 0),
      losses: current.losses + (outcome === 'loss' ? 1 : 0),
      ties: current.ties + (outcome === 'tie' ? 1 : 0),
    }),
    { wins: 0, losses: 0, ties: 0 },
  );
  const stage: SeasonStageResult = {
    id: 'regular_season',
    name: 'Regular Season',
    games,
    record,
    outcome: 'complete',
  };
  return {
    draftId: 'trophy-draft',
    sportId: 'nfl',
    modeId: 'core',
    seed: 'seed',
    modelVersion: 'test',
    dataVersion: 'test',
    record,
    pointsFor: games.reduce((total, game) => total + game.pointsFor, 0),
    pointsAgainst: games.reduce((total, game) => total + game.pointsAgainst, 0),
    postseasonResult,
    stages: [stage],
    facts: {},
  };
}

function codes(result: SeasonResult): string[] {
  return evaluateNflTrophies(result, context).map((trophy) => trophy.code);
}

describe('NFL result trophies', () => {
  it('awards perfect season only for 17-0', () => {
    expect(codes(seasonWith(Array(17).fill('win')))).toContain('perfect_season');
    expect(codes(seasonWith([...Array(16).fill('win'), 'loss']))).not.toContain('perfect_season');
    expect(codes(seasonWith(Array(17).fill('win'), 'lost_super_bowl'))).toContain('perfect_season');
    expect(codes(seasonWith(Array(17).fill('win'), 'lost_super_bowl'))).not.toContain(
      'full_gauntlet',
    );
  });

  it('awards full gauntlet after a perfect season and Super Bowl win', () => {
    expect(codes(seasonWith(Array(17).fill('win'), 'won_super_bowl'))).toEqual([
      'perfect_season',
      'full_gauntlet',
    ]);
  });

  it('awards worst in show only for 0-17', () => {
    expect(codes(seasonWith(Array(17).fill('loss')))).toEqual(['worst_in_show']);
  });

  it('awards ice in the veins for a rough start and elite finish', () => {
    expect(codes(seasonWith(['loss', 'loss', 'loss', 'win', ...Array(13).fill('win')]))).toContain(
      'ice_in_the_veins',
    );
    expect(
      codes(seasonWith(['loss', 'loss', 'win', 'win', ...Array(13).fill('win')])),
    ).not.toContain('ice_in_the_veins');
    expect(
      codes(seasonWith(['loss', 'loss', 'loss', 'win', ...Array(12).fill('win'), 'loss'])),
    ).not.toContain('ice_in_the_veins');
  });
});
