import type { CfbRatingBadge, CfbTeamLineStats } from '../domain';
import { TEAM_LEVEL_RATING_BADGE } from '../domain';
import { percentileRank, toRatingScale, zScores } from './scale';

// Exact §2A.6 weights: team line efficiency + selection bonus + durability.
export const LINE_PROXY_WEIGHTS = {
  teamLineEfficiency: 0.4,
  selectionBonus: 0.35,
  gamesStartedShare: 0.25,
} as const;

export const SELECTION_BONUS = { allAmerican: 1, allConference: 0.6, none: 0 } as const;

export interface LineProxyInput {
  readonly positionGroup: 'OL' | 'DL';
  readonly teamLineEfficiencyPercentile: number;
  readonly allAmerican: boolean;
  readonly allConference: boolean;
  readonly gamesStartedShare: number | null;
}

function assertValidInput(input: LineProxyInput): void {
  if (input.positionGroup !== 'OL' && input.positionGroup !== 'DL') {
    throw new RangeError('line proxy only applies to OL/DL position groups (spec §2A.6)');
  }
  if (
    !Number.isFinite(input.teamLineEfficiencyPercentile) ||
    input.teamLineEfficiencyPercentile < 0 ||
    input.teamLineEfficiencyPercentile > 1
  ) {
    throw new RangeError('teamLineEfficiencyPercentile must be within [0, 1]');
  }
}

export function lineProxyComposite(input: LineProxyInput): number {
  assertValidInput(input);
  const bonus = input.allAmerican
    ? SELECTION_BONUS.allAmerican
    : input.allConference
      ? SELECTION_BONUS.allConference
      : SELECTION_BONUS.none;
  return (
    LINE_PROXY_WEIGHTS.teamLineEfficiency * input.teamLineEfficiencyPercentile +
    LINE_PROXY_WEIGHTS.selectionBonus * bonus +
    LINE_PROXY_WEIGHTS.gamesStartedShare * (input.gamesStartedShare ?? 0)
  );
}

export interface LineProxyRating {
  readonly overallRating: number;
  readonly compositeScore: number;
  readonly isTeamLevelProxy: true;
  readonly badges: readonly [CfbRatingBadge];
}

export function lineProxyRating(input: LineProxyInput): LineProxyRating {
  const composite = lineProxyComposite(input);
  return {
    overallRating: toRatingScale(composite),
    compositeScore: composite,
    isTeamLevelProxy: true,
    badges: [TEAM_LEVEL_RATING_BADGE],
  };
}

function averageAvailable(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

// Per-team line-efficiency percentile within the season population (§2A.6).
// OL: sack rate allowed + stuff rate allowed, lower is better (negate z-scores).
// DL: sack rate + stuff rate produced, higher is better.
export function teamLineEfficiencyPercentiles(
  teams: readonly CfbTeamLineStats[],
  side: 'OL' | 'DL',
): Map<number, number> {
  if (side !== 'OL' && side !== 'DL') {
    throw new RangeError('line proxy only applies to OL/DL position groups (spec §2A.6)');
  }
  const rates = teams.map((team): readonly [number | null, number | null] =>
    side === 'OL'
      ? [
          team.offenseSacksAllowed !== null &&
          team.offensePassAttempts !== null &&
          team.offensePassAttempts + team.offenseSacksAllowed > 0
            ? team.offenseSacksAllowed / (team.offensePassAttempts + team.offenseSacksAllowed)
            : null,
          team.offenseStuffRateAllowed,
        ]
      : [
          team.defenseSacks !== null &&
          team.defenseOpponentPassAttempts !== null &&
          team.defenseOpponentPassAttempts + team.defenseSacks > 0
            ? team.defenseSacks / (team.defenseOpponentPassAttempts + team.defenseSacks)
            : null,
          team.defenseStuffRate,
        ],
  );
  const sackZ = zScores(rates.map((pair) => pair[0]));
  const stuffZ = zScores(rates.map((pair) => pair[1]));
  const direction = side === 'OL' ? -1 : 1;
  const composites = teams.map((team, index) => {
    const combined = averageAvailable([sackZ[index] ?? null, stuffZ[index] ?? null]);
    return { teamId: team.cfbdTeamId, composite: combined === null ? null : combined * direction };
  });
  const numeric = composites.map((entry) => entry.composite ?? Number.NaN);
  const finiteValues = numeric.filter(Number.isFinite);
  const percentiles = percentileRank(finiteValues);
  let cursor = 0;
  const result = new Map<number, number>();
  for (let index = 0; index < composites.length; index += 1) {
    if (Number.isFinite(numeric[index])) {
      result.set(composites[index]?.teamId ?? 0, percentiles[cursor] ?? 0.5);
      cursor += 1;
    } else {
      result.set(composites[index]?.teamId ?? 0, 0.5);
    }
  }
  return result;
}
