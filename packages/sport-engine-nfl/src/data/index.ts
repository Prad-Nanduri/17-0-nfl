import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
    return resolve(process.cwd(), configuredDirectory);
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
}

// Every numeric-named subdirectory is one season of ETL output; all are merged
// so the spin pool and draft candidates cover the full dataset, matching the
// CFB loader's convention.
export function loadNflFixtureData(dataDirectory = defaultDataDirectory()): NflFixtureData {
  const seasonDirectories = existsSync(dataDirectory)
    ? readdirSync(dataDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => resolve(dataDirectory, entry.name))
    : [resolve(dataDirectory, '2023')];
  const franchiseIndex = new Map<string, NflFranchise>();
  const playerIndex = new Map<string, NflPlayer>();
  const playerSeasonStats: NflPlayerSeasonStats[] = [];
  const ratings: NflRating[] = [];
  for (const seasonDirectory of seasonDirectories) {
    for (const franchise of loadJson<NflFranchise[]>(resolve(seasonDirectory, 'franchises.json'))) {
      franchiseIndex.set(franchise.franchiseKey, franchise);
    }
    for (const player of loadJson<NflPlayer[]>(resolve(seasonDirectory, 'players.json'))) {
      playerIndex.set(player.gsisId, player);
    }
    playerSeasonStats.push(
      ...loadJson<NflPlayerSeasonStats[]>(resolve(seasonDirectory, 'player_season_stats.json')),
    );
    const ratingsPath = resolve(seasonDirectory, 'ratings.json');
    if (existsSync(ratingsPath)) ratings.push(...loadJson<NflRating[]>(ratingsPath));
  }
  const legacyDirectory = resolve(dataDirectory, 'legacy');
  const legacyRatingsPath = resolve(legacyDirectory, 'legacy_ratings.json');
  if (existsSync(legacyRatingsPath)) {
    ratings.push(...loadJson<NflRating[]>(legacyRatingsPath));
  }
  return {
    franchises: [...franchiseIndex.values()],
    franchiseSeasons: loadJson<NflFranchiseSeason[]>(
      resolve(dataDirectory, 'franchise_seasons', 'franchise_seasons.json'),
    ),
    players: [...playerIndex.values()],
    playerSeasonStats,
    ratings,
  };
}

export type { NflPlayerSeasonStats };
