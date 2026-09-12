import type { SeasonResult, TrophyDefinition } from '@perfect-season/sport-engine-core';
import type { NflTrophyRule } from './types';

const baseDefinition = {
  sportId: 'nfl' as const,
  category: 'result' as const,
  isSecret: false,
  modeExclusiveTo: null,
  tiers: [],
} satisfies Pick<
  TrophyDefinition,
  'sportId' | 'category' | 'isSecret' | 'modeExclusiveTo' | 'tiers'
>;

function isPerfectSeason(result: SeasonResult): boolean {
  return result.record.wins === 17 && result.record.losses === 0 && result.record.ties === 0;
}

function regularSeasonGames(result: SeasonResult) {
  return result.stages.find((stage) => stage.id === 'regular_season')?.games ?? [];
}

export const RESULT_TROPHY_RULES: readonly NflTrophyRule[] = [
  {
    definition: {
      ...baseDefinition,
      code: 'perfect_season',
      name: 'Perfect Season',
      description: 'Finish the regular season 17-0.',
    },
    evaluate: (result) => (isPerfectSeason(result) ? true : null),
  },
  {
    definition: {
      ...baseDefinition,
      code: 'full_gauntlet',
      name: 'The Full Gauntlet',
      description: 'Finish 17-0 and win the Super Bowl in Full Gauntlet mode.',
    },
    evaluate: (result) =>
      isPerfectSeason(result) && result.postseasonResult === 'won_super_bowl' ? true : null,
  },
  {
    definition: {
      ...baseDefinition,
      code: 'worst_in_show',
      name: 'Worst in Show',
      description: 'Finish the regular season 0-17.',
    },
    evaluate: (result) =>
      result.record.wins === 0 && result.record.losses === 17 && result.record.ties === 0
        ? true
        : null,
  },
  {
    definition: {
      ...baseDefinition,
      code: 'ice_in_the_veins',
      name: 'Ice in the Veins',
      description: 'Lose at least three of the first four games, then finish 14-3 or better.',
    },
    evaluate: (result) => {
      const openingGames = regularSeasonGames(result).slice(0, 4);
      const openingLosses = openingGames.filter((game) => game.outcome === 'loss').length;
      return openingGames.length === 4 &&
        openingLosses >= 3 &&
        result.record.wins >= 14 &&
        result.record.losses <= 3
        ? true
        : null;
    },
  },
];
