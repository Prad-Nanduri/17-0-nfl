import type { SeasonResult, TrophyDefinition } from '@perfect-season/sport-engine-core';
import { CFB_SIMULATION_CONFIG, CFB_REGULAR_SEASON_GAMES } from '../simulation/config';
import type { CfbTrophyRule } from './types';

const baseDefinition = {
  sportId: 'cfb' as const,
  category: 'result' as const,
  isSecret: false,
  modeExclusiveTo: null,
  tiers: [],
} satisfies Pick<
  TrophyDefinition,
  'sportId' | 'category' | 'isSecret' | 'modeExclusiveTo' | 'tiers'
>;

function isPerfectRegularSeason(result: SeasonResult): boolean {
  return (
    result.record.wins === CFB_REGULAR_SEASON_GAMES &&
    result.record.losses === 0 &&
    result.record.ties === 0
  );
}

export const RESULT_TROPHY_RULES: readonly CfbTrophyRule[] = [
  {
    definition: {
      ...baseDefinition,
      code: 'undefeated_untied',
      name: 'Undefeated & Untied',
      description: 'Finish the 12-game regular season 12-0-0.',
    },
    evaluate: (result) => (isPerfectRegularSeason(result) ? true : null),
  },
  {
    definition: {
      ...baseDefinition,
      code: 'the_natty',
      name: 'The Natty',
      description:
        'Finish undefeated, win the conference championship, and win the national title.',
    },
    evaluate: (result) =>
      isPerfectRegularSeason(result) &&
      result.postseasonResult === 'national_champion' &&
      result.facts.conferenceChampion === true
        ? true
        : null,
  },
  {
    definition: {
      ...baseDefinition,
      code: 'statement_win',
      name: 'Statement Win',
      description: 'Beat an opponent at least 1.75 standard deviations above the mean strength.',
    },
    evaluate: (result) => {
      const threshold =
        CFB_SIMULATION_CONFIG.opponentDistribution.meanRating +
        1.75 * CFB_SIMULATION_CONFIG.opponentDistribution.sdRating;
      return result.stages.some(
        (stage) =>
          stage.id === 'regular_season' &&
          stage.games.some(
            (game) =>
              game.outcome === 'win' &&
              typeof game.facts.strengthRating === 'number' &&
              game.facts.strengthRating >= threshold,
          ),
      )
        ? true
        : null;
    },
  },
  {
    definition: {
      ...baseDefinition,
      code: 'overtime_classic',
      name: 'Overtime Classic',
      description: 'Win at least two regular-season games that reached overtime.',
    },
    evaluate: (result) =>
      result.stages
        .filter((stage) => stage.id === 'regular_season')
        .flatMap((stage) => stage.games)
        .filter(
          (game) =>
            game.outcome === 'win' &&
            typeof game.facts.overtimePeriods === 'number' &&
            game.facts.overtimePeriods >= 1,
        ).length >= 2
        ? true
        : null,
  },
];
