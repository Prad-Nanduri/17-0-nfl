import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CfbConference, CfbPlayer, CfbProgramSeason, CfbRating, CfbTeam } from '../domain';
import { loadFixtureRawSeason } from '../../etl/fixtures';
import { transformSeason } from '../../etl/transform';
import { rateSeason } from '../ratings/rate-season';

export interface CfbFixtureData {
  readonly conferences: readonly CfbConference[];
  readonly teams: readonly CfbTeam[];
  readonly programSeasons: readonly CfbProgramSeason[];
  readonly players: readonly CfbPlayer[];
  readonly ratings: readonly CfbRating[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function defaultDataDirectory(): string {
  const configuredDirectory = process.env.PERFECT_SEASON_CFB_DATA_DIR;
  if (configuredDirectory !== undefined) {
    return resolve(process.cwd(), configuredDirectory);
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
}

// Every numeric-named subdirectory is one season of ETL output (see
// packages/sport-engine-cfb/README.md for the extract/rate commands).
export function loadCfbFixtureData(dataDirectory = defaultDataDirectory()): CfbFixtureData {
  const seasonDirectories = existsSync(dataDirectory)
    ? readdirSync(dataDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => resolve(dataDirectory, entry.name))
    : [];
  if (seasonDirectories.length === 0) {
    const fixture = transformSeason(loadFixtureRawSeason(2023), 2023);
    return {
      conferences: fixture.conferences,
      teams: fixture.teams,
      programSeasons: fixture.programSeasons,
      players: fixture.players,
      ratings: rateSeason(fixture.playerSeasonStats, fixture.teamLineStats),
    };
  }

  const conferenceByKey = new Map<string, CfbConference>();
  const teamById = new Map<number, CfbTeam>();
  const programSeasons: CfbProgramSeason[] = [];
  const players: CfbPlayer[] = [];
  const ratings: CfbRating[] = [];

  for (const directory of seasonDirectories) {
    for (const conference of loadJson<CfbConference[]>(resolve(directory, 'conferences.json'))) {
      conferenceByKey.set(conference.conferenceKey, conference);
    }
    for (const team of loadJson<CfbTeam[]>(resolve(directory, 'teams.json'))) {
      teamById.set(team.cfbdTeamId, team);
    }
    programSeasons.push(
      ...loadJson<CfbProgramSeason[]>(resolve(directory, 'program_seasons.json')),
    );
    players.push(...loadJson<CfbPlayer[]>(resolve(directory, 'players.json')));
    const ratingsPath = resolve(directory, 'ratings.json');
    if (existsSync(ratingsPath)) {
      ratings.push(...loadJson<CfbRating[]>(ratingsPath));
    }
  }

  return {
    conferences: [...conferenceByKey.values()],
    teams: [...teamById.values()],
    programSeasons,
    players,
    ratings,
  };
}
