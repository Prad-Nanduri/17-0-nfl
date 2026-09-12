import type { TrophyDefinition } from '@perfect-season/sport-engine-core';
import type { CfbTrophyRule } from './types';

export const BIOGRAPHY_TROPHY_RULES: readonly CfbTrophyRule[] = [
  {
    definition: {
      sportId: 'cfb',
      category: 'identity',
      code: 'legacy_era_lineup',
      name: 'Legacy Era Lineup',
      description: 'Fill every roster slot with a player from before the 2005 full-feature era.',
      isSecret: false,
      modeExclusiveTo: null,
      tiers: [],
    } satisfies TrophyDefinition,
    evaluate: (_result, ctx) =>
      ctx.roster.picks.length > 0 &&
      ctx.roster.picks.every((pick) => pick.candidate.poolUnit.season < 2005)
        ? true
        : null,
  },
];
