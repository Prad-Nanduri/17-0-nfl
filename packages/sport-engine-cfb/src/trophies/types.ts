import type {
  SeasonResult,
  TrophyDefinition,
  TrophyEvalContext,
  TrophyTier,
  EarnedTrophy,
} from '@perfect-season/sport-engine-core';

export interface CfbTrophyRule {
  readonly definition: TrophyDefinition;
  readonly evaluate: (result: SeasonResult, ctx: TrophyEvalContext) => TrophyTier | true | null;
}

export type { EarnedTrophy };
