import type {
  GameResult,
  OpponentContext,
  SeasonStageResult,
  SeasonRecord,
  Site,
} from '@perfect-season/sport-engine-core';
import type { DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import {
  eloToRating,
  ratingToElo,
  simulateGame as defaultSimulateGame,
  type SimulatedGame,
} from '@perfect-season/simulation';
import { NFL_PLAYOFF_CONFIG } from './config';

export const NFL_PLAYOFF_WIN_THRESHOLD = 10;

export interface NflPlayoffSeed {
  readonly seed: number;
  readonly bye: boolean;
  readonly rounds: readonly string[];
}

export function qualifiesForPlayoffs(record: SeasonRecord): boolean {
  return record.wins + 0.5 * record.ties >= NFL_PLAYOFF_WIN_THRESHOLD;
}

export function seedFrom(record: SeasonRecord): NflPlayoffSeed {
  const performance = record.wins + 0.5 * record.ties;
  if (performance >= 14) {
    return { seed: 1, bye: true, rounds: ['divisional', 'conference', 'super_bowl'] };
  }
  if (performance >= 12) {
    return {
      seed: Math.min(4, Math.max(2, 16 - Math.floor(performance))),
      bye: false,
      rounds: ['wild_card', 'divisional', 'conference', 'super_bowl'],
    };
  }
  return {
    seed: Math.min(7, Math.max(5, 15 - Math.floor(performance))),
    bye: false,
    rounds: ['wild_card', 'divisional', 'conference', 'super_bowl'],
  };
}

export interface PlayoffDependencies {
  readonly simulateGame?: typeof defaultSimulateGame;
  readonly rng: DeterministicRng;
}

export interface NflPlayoffResult {
  readonly outcome:
    'lost_wild_card' | 'lost_divisional' | 'lost_conference' | 'lost_super_bowl' | 'won_super_bowl';
  readonly stages: readonly SeasonStageResult[];
}

const ROUND_RATINGS: Readonly<Record<string, number>> = {
  wild_card: 74,
  divisional: 78,
  conference: 82,
  super_bowl: 85,
};

function stageName(round: string): string {
  return round
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function toGameResult(game: SimulatedGame, round: string): GameResult {
  return {
    opponentId: game.opponentId,
    site: game.site,
    pointsFor: game.pointsFor,
    pointsAgainst: game.pointsAgainst,
    outcome: game.tied ? 'tie' : game.won ? 'win' : 'loss',
    facts: {
      ...game.facts,
      round,
      overtimePeriods: game.overtimePeriods,
    },
  };
}

function stageFor(round: string, game: GameResult): SeasonStageResult {
  const record =
    game.outcome === 'win'
      ? { wins: 1, losses: 0, ties: 0 }
      : game.outcome === 'loss'
        ? { wins: 0, losses: 1, ties: 0 }
        : { wins: 0, losses: 0, ties: 1 };
  return {
    id: round,
    name: stageName(round),
    games: [game],
    record,
    outcome: game.outcome === 'win' ? 'advanced' : `lost_${round}`,
  };
}

export function simulatePlayoffBracket(
  rosterRating: number,
  seed: NflPlayoffSeed,
  opponentContext: OpponentContext,
  deps: PlayoffDependencies,
): NflPlayoffResult {
  const simulateGame = deps.simulateGame ?? defaultSimulateGame;
  const availableOpponents = [...opponentContext.opponents]
    .sort((left, right) => right.rating - left.rating)
    .slice(0, seed.rounds.length)
    .sort((left, right) => left.rating - right.rating);
  const stages: SeasonStageResult[] = [];
  for (const [index, round] of seed.rounds.entries()) {
    const contextOpponent = availableOpponents[index];
    const rating = contextOpponent
      ? eloToRating(contextOpponent.rating, NFL_PLAYOFF_CONFIG.ratingScale)
      : ROUND_RATINGS[round];
    if (rating === undefined) throw new Error(`Missing playoff rating for ${round}`);
    const site: Site = round === 'super_bowl' ? 'neutral' : seed.seed <= 4 ? 'home' : 'away';
    const opponent = contextOpponent
      ? { ...contextOpponent, rating: contextOpponent.rating, site }
      : {
          id: `playoff-${round}`,
          name: `${stageName(round)} opponent`,
          rating: ratingToElo(rating, NFL_PLAYOFF_CONFIG.ratingScale),
          site,
          facts: { playoffRound: round },
        };
    const result = toGameResult(
      simulateGame(rosterRating, opponent, NFL_PLAYOFF_CONFIG, deps.rng),
      round,
    );
    stages.push(stageFor(round, result));
    if (result.outcome !== 'win') {
      return {
        outcome: `lost_${round}` as NflPlayoffResult['outcome'],
        stages,
      };
    }
  }
  return { outcome: 'won_super_bowl', stages };
}
