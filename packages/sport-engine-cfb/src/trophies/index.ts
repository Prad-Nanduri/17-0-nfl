import type {
  EarnedTrophy,
  SeasonResult,
  TrophyDefinition,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import { ENABLE_FULL_CAMPAIGN } from '../simulation/config';
import { BIOGRAPHY_TROPHY_RULES } from './biography';
import { RESULT_TROPHY_RULES } from './result-based';

export const CFB_MVP_TROPHY_CODES = [
  'undefeated_untied',
  'statement_win',
  'overtime_classic',
  'legacy_era_lineup',
] as const;

export const CFB_TROPHY_RULES = [...RESULT_TROPHY_RULES, ...BIOGRAPHY_TROPHY_RULES] as const;

export function getCfbTrophyDefinitions(): TrophyDefinition[] {
  return CFB_TROPHY_RULES.filter(
    (rule) =>
      ENABLE_FULL_CAMPAIGN ||
      CFB_MVP_TROPHY_CODES.includes(rule.definition.code as (typeof CFB_MVP_TROPHY_CODES)[number]),
  ).map((rule) => rule.definition);
}

export function evaluateCfbTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[] {
  const definitions = new Set(getCfbTrophyDefinitions().map((definition) => definition.code));
  return CFB_TROPHY_RULES.flatMap((rule) => {
    if (!definitions.has(rule.definition.code)) return [];
    const tier = rule.evaluate(result, ctx);
    if (tier === null) return [];
    return [
      {
        code: rule.definition.code,
        sportId: 'cfb' as const,
        draftId: result.draftId,
        tier: tier === true ? null : tier,
        earnedAt: ctx.evaluatedAt,
      },
    ];
  });
}

export { BIOGRAPHY_TROPHY_RULES, RESULT_TROPHY_RULES };
export type { CfbTrophyRule } from './types';
