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

const label = (path: string, query?: Record<string, string | number>): string =>
  `${path}?${new URLSearchParams(
    Object.entries(query ?? {}).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

// Endpoints are fetched sequentially: the free CFBD tier rate-limits parallel
// bursts (429s), and every miss used to degrade silently to an empty list.
const warn = (scope: string, error: unknown): void => {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[cfb-etl] ${scope} failed, defaulting to empty: ${detail}`);
};

async function optional<T>(scope: string, request: Promise<T[]>): Promise<T[]> {
  return request.catch((error: unknown) => {
    warn(scope, error);
    return [] as T[];
  });
}

export async function extractSeason(client: CfbdClient, season: number): Promise<CfbdRawSeason> {
  const get: CfbdClient['get'] = client.get.bind(client);
  const teams = await get<CfbdTeam[]>('/teams', { year: season });
  const conferences = await get<CfbdConference[]>('/conferences');

  const fbsEntries: [number, CfbdTeam[]][] = [];
  for (let offset = 0; offset <= FBS_LOOKAHEAD_SEASONS; offset += 1) {
    const year = season + offset;
    const rows = await optional(
      label('/teams/fbs', { year }),
      get<CfbdTeam[]>('/teams/fbs', { year }),
    );
    fbsEntries.push([year, rows]);
  }
  const fbsTeamsBySeason = new Map<number, readonly CfbdTeam[]>(fbsEntries);

  let roster = await optional(
    label('/roster', { year: season }),
    get<CfbdRosterPlayer[]>('/roster', { year: season }),
  );
  if (roster.length === 0) {
    // Fallback: pull roster per FBS program when the single call returns empty.
    const fbsSchools = (fbsTeamsBySeason.get(season) ?? [])
      .map((team) => team.school)
      .filter((school): school is string => typeof school === 'string');
    const perTeam: CfbdRosterPlayer[] = [];
    for (const school of fbsSchools) {
      const rows = await optional(
        label('/roster', { year: season, team: school }),
        get<CfbdRosterPlayer[]>('/roster', { year: season, team: school }),
      );
      perTeam.push(...rows);
    }
    roster = perTeam;
  }

  // /stats/player/season without a category filter already returns every
  // stat row; /stats/categories lists stat *type* names, not categories, and
  // must not be used to fan out per-category calls here.
  const playerSeasonStats = await get<CfbdPlayerStat[]>('/stats/player/season', { year: season });

  const teamSeasonStats = await optional(
    label('/stats/season', { year: season }),
    get<CfbdTeamStat[]>('/stats/season', { year: season }),
  );
  const advancedSeasonStats = await optional(
    label('/stats/season/advanced', { year: season }),
    get<CfbdAdvancedSeasonStat[]>('/stats/season/advanced', { year: season }),
  );
  const rankingsRegular = await optional(
    label('/rankings', { year: season, seasonType: 'regular' }),
    get<CfbdPollWeek[]>('/rankings', { year: season, seasonType: 'regular' }),
  );
  const rankingsPostseason = await optional(
    label('/rankings', { year: season, seasonType: 'postseason' }),
    get<CfbdPollWeek[]>('/rankings', { year: season, seasonType: 'postseason' }),
  );
  const recruits = await optional(
    label('/recruiting/players', { year: season }),
    get<CfbdRecruit[]>('/recruiting/players', { year: season }),
  );
  const teamRecruiting = await optional(
    label('/recruiting/teams', { year: season }),
    get<CfbdTeamRecruitingRanking[]>('/recruiting/teams', { year: season }),
  );
  const teamRushing = await optional(
    label('/rushing/teams/season', { year: season }),
    get<CfbdTeamRushingSeason[]>('/rushing/teams/season', { year: season }),
  );
  const gamesRegular = await optional(
    label('/games', { year: season, seasonType: 'regular' }),
    get<CfbdGame[]>('/games', { year: season, seasonType: 'regular' }),
  );
  const gamesPostseason = await optional(
    label('/games', { year: season, seasonType: 'postseason' }),
    get<CfbdGame[]>('/games', { year: season, seasonType: 'postseason' }),
  );

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
