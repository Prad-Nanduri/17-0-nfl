import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  readonly ratings: readonly NflRating[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadNflFixtureData(
  dataDirectory = resolve(import.meta.dirname, '..', '..', 'data'),
): NflFixtureData {
  const seasonDirectory = resolve(dataDirectory, '2023');
  const legacyDirectory = resolve(dataDirectory, 'legacy');
  const legacyRatingsPath = resolve(legacyDirectory, 'legacy_ratings.json');
  return {
    franchises: loadJson<NflFranchise[]>(resolve(seasonDirectory, 'franchises.json')),
    franchiseSeasons: loadJson<NflFranchiseSeason[]>(
      resolve(dataDirectory, 'franchise_seasons', 'franchise_seasons.json'),
    ),
    players: loadJson<NflPlayer[]>(resolve(seasonDirectory, 'players.json')),
    ratings: [
      ...loadJson<NflRating[]>(resolve(seasonDirectory, 'ratings.json')),
      ...(existsSync(legacyRatingsPath) ? loadJson<NflRating[]>(legacyRatingsPath) : []),
    ],
  };
}

export type { NflPlayerSeasonStats };
