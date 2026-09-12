import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { rateSeason } from '../src/index';
import type { CfbPlayerSeasonStats, CfbTeamLineStats } from '../src/domain';

const args = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const season = Number(argValue('--season') ?? args[0] ?? new Date().getFullYear() - 1);
const root = resolve(import.meta.dirname, '..');
const seasonDir = resolve(root, 'data', String(season));
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const stats = read<CfbPlayerSeasonStats[]>(resolve(seasonDir, 'player_season_stats.json'));
const teamLines = read<CfbTeamLineStats[]>(resolve(seasonDir, 'team_line_stats.json'));
write(resolve(seasonDir, 'ratings.json'), rateSeason(stats, teamLines));
