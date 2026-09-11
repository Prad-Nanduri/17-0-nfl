import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  rateLegacyCareers,
  rateSeason,
  type NflLegacyPlayerCareer,
  type NflPlayerSeasonStats,
} from '../src/index';

const season = Number(process.argv[2] ?? 2023);
const root = resolve(import.meta.dirname, '..');
const seasonDir = resolve(root, 'data', String(season));
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const stats = read<NflPlayerSeasonStats[]>(resolve(seasonDir, 'player_season_stats.json'));
write(resolve(seasonDir, 'ratings.json'), rateSeason(stats));
const legacyPath = resolve(root, 'data', 'legacy', 'legacy_player_careers.json');
try {
  const legacy = read<NflLegacyPlayerCareer[]>(legacyPath);
  write(resolve(root, 'data', 'legacy', 'legacy_ratings.json'), rateLegacyCareers(legacy));
} catch {
  // Legacy input is optional for a season-only fixture.
}
