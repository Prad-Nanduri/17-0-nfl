import type {
  SeasonResult,
  TrophyDefinition,
  TrophyEvalContext,
  EarnedTrophy,
} from '@perfect-season/sport-engine-core';
import { RESULT_TROPHY_RULES } from './result-based';

export const NFL_TROPHY_RULES = [...RESULT_TROPHY_RULES] as const;

export function getNflTrophyDefinitions(): TrophyDefinition[] {
  return NFL_TROPHY_RULES.map((rule) => rule.definition);
}

export function evaluateNflTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[] {
  return NFL_TROPHY_RULES.flatMap((rule) => {
    const tier = rule.evaluate(result, ctx);
    if (tier === null) return [];
    return [
      {
        code: rule.definition.code,
        sportId: 'nfl' as const,
        draftId: result.draftId,
        tier: tier === true ? null : tier,
        earnedAt: ctx.evaluatedAt,
      },
    ];
  });
}

export { RESULT_TROPHY_RULES };
export type { NflTrophyRule } from './types';
