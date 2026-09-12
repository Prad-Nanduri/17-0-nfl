import type {
  CompletedRoster,
  EngineFacts,
  GameResult,
  OpponentContext,
  SeasonRecord,
  SeasonResult,
  SeasonStageResult,
  SimulationMode,
} from '@perfect-season/sport-engine-core';
import {
  aggregateRosterRating,
  createRng,
  createSeed,
  type DeterministicRng,
} from '@perfect-season/sport-engine-core/utils';
import {
  generateSchedule,
  simulateGame as defaultSimulateGame,
  type SimulatedGame,
} from '@perfect-season/simulation';
import { NFL_REGULAR_SEASON_GAMES, NFL_SIMULATION_CONFIG } from './config';
import {
  qualifiesForPlayoffs,
  seedFrom,
  simulatePlayoffBracket,
  type NflPlayoffResult,
} from './playoffs';

export interface NflSeasonDependencies {
  readonly simulateGame?: typeof defaultSimulateGame;
  readonly rng?: DeterministicRng;
  readonly seed?: string;
}

function recordFor(games: readonly GameResult[]): SeasonRecord {
  return games.reduce(
    (record, game) => ({
      wins: record.wins + (game.outcome === 'win' ? 1 : 0),
      losses: record.losses + (game.outcome === 'loss' ? 1 : 0),
      ties: record.ties + (game.outcome === 'tie' ? 1 : 0),
    }),
    { wins: 0, losses: 0, ties: 0 },
  );
}

function regularGameResult(game: SimulatedGame): GameResult {
  return {
    opponentId: game.opponentId,
    site: game.site,
    pointsFor: game.pointsFor,
    pointsAgainst: game.pointsAgainst,
    outcome: game.tied ? 'tie' : game.won ? 'win' : 'loss',
    facts: {
      ...game.facts,
      overtimePeriods: game.overtimePeriods,
    },
  };
}

function stageForRegularSeason(games: readonly GameResult[]): SeasonStageResult {
  const record = recordFor(games);
  return {
    id: 'regular_season',
    name: 'Regular Season',
    games,
    record,
    outcome: 'complete',
  };
}

function postseasonFacts(postseason: NflPlayoffResult | null): EngineFacts {
  return postseason === null ? { fullGauntlet: false } : { fullGauntlet: true };
}

export function simulateNFLSeason(
  roster: CompletedRoster,
  mode: SimulationMode,
  opponentContext: OpponentContext,
  deps: NflSeasonDependencies = {},
): SeasonResult {
  const seed =
    deps.seed ??
    createSeed('nfl-season', roster.draftId, mode.modeId, mode.seed, opponentContext.season);
  const rng = deps.rng ?? createRng(seed);
  const rosterRating = aggregateRosterRating(roster);
  const schedule = generateSchedule({
    games: NFL_REGULAR_SEASON_GAMES,
    difficulty: mode.difficulty,
    opponents: opponentContext.opponents,
    config: NFL_SIMULATION_CONFIG,
    rng,
  });
  const simulateGame = deps.simulateGame ?? defaultSimulateGame;
  const regularGames = schedule.map(({ opponent }) =>
    regularGameResult(simulateGame(rosterRating, opponent, NFL_SIMULATION_CONFIG, rng)),
  );
  const regularRecord = recordFor(regularGames);
  const fullGauntlet = mode.options.fullGauntlet === true;
  const postseason =
    fullGauntlet && qualifiesForPlayoffs(regularRecord)
      ? simulatePlayoffBracket(rosterRating, seedFrom(regularRecord), opponentContext, {
          simulateGame,
          rng,
        })
      : null;
  const pointsFor = regularGames.reduce((total, game) => total + game.pointsFor, 0);
  const pointsAgainst = regularGames.reduce((total, game) => total + game.pointsAgainst, 0);
  return {
    draftId: roster.draftId,
    sportId: 'nfl',
    modeId: mode.modeId,
    seed,
    modelVersion: opponentContext.modelVersion,
    dataVersion: opponentContext.dataVersion,
    record: regularRecord,
    pointsFor,
    pointsAgainst,
    postseasonResult: postseason?.outcome ?? null,
    stages: [stageForRegularSeason(regularGames), ...(postseason?.stages ?? [])],
    facts: {
      ...postseasonFacts(postseason),
      rosterRating,
    },
  };
}
