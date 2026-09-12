import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  NflFranchise,
  NflFranchiseSeason,
  NflPlayer,
  NflPlayerSeasonStats,
  NflRating,
} from '../domain';

export interface NflFixtureData {
  readonly franchises: readonly NflFranchise[];
  readonly franchiseSeasons: readonly NflFranchiseSeason[];
  readonly players: readonly NflPlayer[];
  readonly playerSeasonStats: readonly NflPlayerSeasonStats[];
  readonly ratings: readonly NflRating[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function defaultDataDirectory(): string {
  const configuredDirectory = process.env.PERFECT_SEASON_NFL_DATA_DIR;
  if (configuredDirectory !== undefined) {
    return configuredDirectory;
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
}

export function loadNflFixtureData(dataDirectory = defaultDataDirectory()): NflFixtureData {
  const seasonDirectory = resolve(dataDirectory, '2023');
  const legacyDirectory = resolve(dataDirectory, 'legacy');
  const legacyRatingsPath = resolve(legacyDirectory, 'legacy_ratings.json');
  return {
    franchises: loadJson<NflFranchise[]>(resolve(seasonDirectory, 'franchises.json')),
    franchiseSeasons: loadJson<NflFranchiseSeason[]>(
      resolve(dataDirectory, 'franchise_seasons', 'franchise_seasons.json'),
    ),
    players: loadJson<NflPlayer[]>(resolve(seasonDirectory, 'players.json')),
    playerSeasonStats: loadJson<NflPlayerSeasonStats[]>(
      resolve(seasonDirectory, 'player_season_stats.json'),
    ),
    ratings: [
      ...loadJson<NflRating[]>(resolve(seasonDirectory, 'ratings.json')),
      ...(existsSync(legacyRatingsPath) ? loadJson<NflRating[]>(legacyRatingsPath) : []),
    ],
  };
}

export type { NflPlayerSeasonStats };
