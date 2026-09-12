import type { CfbdClient } from './cfbd-client';
import type {
  CfbdAdvancedSeasonStat,
  CfbdConference,
  CfbdGame,
  CfbdPlayerStat,
  CfbdPollWeek,
  CfbdRawSeason,
  CfbdRecruit,
  CfbdRosterPlayer,
  CfbdTeam,
  CfbdTeamRecruitingRanking,
  CfbdTeamRushingSeason,
  CfbdTeamStat,
} from './cfbd-types';

// Number of lookahead seasons needed to detect the 2-year NCAA
// reclassification window (spec §2A.1). Empty future payloads are fine for the
// current season and are simply recorded as empty lists.
const FBS_LOOKAHEAD_SEASONS = 2;

export async function extractSeason(client: CfbdClient, season: number): Promise<CfbdRawSeason> {
  const [teams, conferences] = await Promise.all([
    client.get<CfbdTeam[]>('/teams', { year: season }),
    client.get<CfbdConference[]>('/conferences'),
  ]);

  const fbsEntries = await Promise.all(
    Array.from({ length: FBS_LOOKAHEAD_SEASONS + 1 }, (_, offset) => season + offset).map(
      async (year) =>
        [
          year,
          await client.get<CfbdTeam[]>('/teams/fbs', { year }).catch(() => [] as CfbdTeam[]),
        ] as const,
    ),
  );
  const fbsTeamsBySeason = new Map<number, readonly CfbdTeam[]>(fbsEntries);

  let roster = await client
    .get<CfbdRosterPlayer[]>('/roster', { year: season })
    .catch(() => [] as CfbdRosterPlayer[]);
  if (roster.length === 0) {
    // Fallback: pull roster per FBS program when the single call returns empty.
    const fbsSchools = (fbsTeamsBySeason.get(season) ?? [])
      .map((team) => team.school)
      .filter((school): school is string => typeof school === 'string');
    const perTeam = await Promise.all(
      fbsSchools.map((school) =>
        client
          .get<CfbdRosterPlayer[]>('/roster', { year: season, team: school })
          .catch(() => [] as CfbdRosterPlayer[]),
      ),
    );
    roster = perTeam.flat();
  }

  const categories = await client.get<string[]>('/stats/categories').catch(() => [] as string[]);
  const playerSeasonStats =
    categories.length > 0
      ? (
          await Promise.all(
            categories.map((category) =>
              client
                .get<CfbdPlayerStat[]>('/stats/player/season', { year: season, category })
                .catch(() => [] as CfbdPlayerStat[]),
            ),
          )
        ).flat()
      : await client
          .get<CfbdPlayerStat[]>('/stats/player/season', { year: season })
          .catch(() => [] as CfbdPlayerStat[]);

  const [
    teamSeasonStats,
    advancedSeasonStats,
    rankingsRegular,
    rankingsPostseason,
    recruits,
    teamRecruiting,
    teamRushing,
    gamesRegular,
    gamesPostseason,
  ] = await Promise.all([
    client.get<CfbdTeamStat[]>('/stats/season', { year: season }).catch(() => [] as CfbdTeamStat[]),
    client
      .get<CfbdAdvancedSeasonStat[]>('/stats/season/advanced', { year: season })
      .catch(() => [] as CfbdAdvancedSeasonStat[]),
    client
      .get<CfbdPollWeek[]>('/rankings', { year: season, seasonType: 'regular' })
      .catch(() => [] as CfbdPollWeek[]),
    client
      .get<CfbdPollWeek[]>('/rankings', { year: season, seasonType: 'postseason' })
      .catch(() => [] as CfbdPollWeek[]),
    client
      .get<CfbdRecruit[]>('/recruiting/players', { year: season })
      .catch(() => [] as CfbdRecruit[]),
    client
      .get<CfbdTeamRecruitingRanking[]>('/recruiting/teams', { year: season })
      .catch(() => [] as CfbdTeamRecruitingRanking[]),
    client
      .get<CfbdTeamRushingSeason[]>('/rushing/teams/season', { year: season })
      .catch(() => [] as CfbdTeamRushingSeason[]),
    client
      .get<CfbdGame[]>('/games', { year: season, seasonType: 'regular' })
      .catch(() => [] as CfbdGame[]),
    client
      .get<CfbdGame[]>('/games', { year: season, seasonType: 'postseason' })
      .catch(() => [] as CfbdGame[]),
  ]);

  return {
    season,
    teams,
    fbsTeamsBySeason,
    conferences,
    roster,
    playerSeasonStats,
    teamSeasonStats,
    advancedSeasonStats,
    rankingsRegular,
    rankingsPostseason,
    recruits,
    teamRecruiting,
    teamRushing,
    gamesRegular,
    gamesPostseason,
  };
}
