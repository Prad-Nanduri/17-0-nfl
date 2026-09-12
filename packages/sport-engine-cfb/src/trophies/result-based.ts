import type { SeasonResult, TrophyDefinition } from '@perfect-season/sport-engine-core';
import { CFB_REGULAR_SEASON_GAMES } from '../simulation/config';
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
      code: 'perfect_regular_season',
      name: 'Perfect Regular Season',
      description: 'Finish the regular season 12-0.',
    },
    evaluate: (result) => (isPerfectRegularSeason(result) ? true : null),
  },
  {
    // §2A.5: the CFB true north — undefeated + conference title + CFP title.
    definition: {
      ...baseDefinition,
      code: 'undefeated_untied',
      name: 'Undefeated & Untied',
      description:
        'Finish 12-0, win the conference championship, and win the national championship in Full Campaign mode.',
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
      code: 'drafted_national_champions',
      name: 'Drafted National Champions',
      description: 'Win the national championship with a Blue-Blood Bracket roster.',
      modeExclusiveTo: 'blue_blood_bracket',
    },
    evaluate: (result) =>
      result.modeId === 'blue_blood_bracket' && result.postseasonResult === 'national_champion'
        ? true
        : null,
  },
  {
    definition: {
      ...baseDefinition,
      code: 'bowl_bound',
      name: 'Bowl Bound',
      description: 'Win your bowl game in Full Campaign mode.',
    },
    evaluate: (result) => (result.postseasonResult === 'bowl_won' ? true : null),
  },
  {
    definition: {
      ...baseDefinition,
      code: 'worst_in_show',
      name: 'Worst in Show',
      description: 'Finish the regular season 0-12.',
      category: 'joke',
    },
    evaluate: (result) =>
      result.record.wins === 0 &&
      result.record.losses === CFB_REGULAR_SEASON_GAMES &&
      result.record.ties === 0
        ? true
        : null,
  },
];
