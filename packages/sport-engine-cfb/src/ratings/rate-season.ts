import type { CfbPlayerSeasonStats, CfbRating, CfbTeamLineStats } from '../domain';
import { cfbConfidenceTier } from '../era';
import { lineProxyRating, teamLineEfficiencyPercentiles } from './line-proxy';
import { percentileRank, toRatingScale } from './scale';

export const CFB_RATING_MODEL_VERSION = 'cfb-v0.1.0';

function sumNumericStats(stats: Readonly<Record<string, number | null>>): number {
  let sum = 0;
  for (const value of Object.values(stats)) {
    sum += value ?? 0;
  }
  return sum;
}

// Interim placeholder for skill positions until the CFB skill-position
// composite PR lands: percentile of the raw sum of the row's numeric stats
// within (season, positionGroup). OL/DL use the §2A.6 team-level proxy.
export function rateSeason(
  stats: readonly CfbPlayerSeasonStats[],
  teamLines: readonly CfbTeamLineStats[],
  modelVersion: string = CFB_RATING_MODEL_VERSION,
): CfbRating[] {
  const olPercentiles = teamLineEfficiencyPercentiles(teamLines, 'OL');
  const dlPercentiles = teamLineEfficiencyPercentiles(teamLines, 'DL');

  const groups = new Map<string, CfbPlayerSeasonStats[]>();
  for (const row of stats) {
    const key = `${row.season}:${row.positionGroup}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const placeholderPercentiles = new Map<CfbPlayerSeasonStats, number>();
  for (const group of groups.values()) {
    const ranks = percentileRank(group.map((row) => sumNumericStats(row.stats)));
    group.forEach((row, index) => {
      placeholderPercentiles.set(row, ranks[index] ?? 0.5);
    });
  }

  return stats.map((row) => {
    const confidenceTier = cfbConfidenceTier(row.season);
    if (row.positionGroup === 'OL' || row.positionGroup === 'DL') {
      const teamLineEfficiencyPercentile =
        (row.positionGroup === 'OL' ? olPercentiles : dlPercentiles).get(row.cfbdTeamId) ?? 0.5;
      const gamesStartedShare =
        row.gamesStarted !== null && row.games !== null && row.games > 0
          ? row.gamesStarted / row.games
          : null;
      const proxy = lineProxyRating({
        positionGroup: row.positionGroup,
        teamLineEfficiencyPercentile,
        allAmerican: row.allAmerican,
        allConference: row.allConference,
        gamesStartedShare,
      });
      return {
        cfbdPlayerId: row.cfbdPlayerId,
        cfbdTeamId: row.cfbdTeamId,
        season: row.season,
        ratingMode: 'career_season',
        overallRating: proxy.overallRating,
        compositeScore: proxy.compositeScore,
        percentile: null,
        confidenceTier,
        isTeamLevelProxy: proxy.isTeamLevelProxy,
        badges: proxy.badges,
        modelVersion,
      };
    }
    const percentile = placeholderPercentiles.get(row) ?? 0.5;
    return {
      cfbdPlayerId: row.cfbdPlayerId,
      cfbdTeamId: row.cfbdTeamId,
      season: row.season,
      ratingMode: 'career_season',
      overallRating: toRatingScale(percentile),
      compositeScore: percentile,
      percentile,
      confidenceTier,
      isTeamLevelProxy: false,
      badges: [],
      modelVersion,
    };
  });
}
