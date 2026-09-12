import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createCfbdClient } from './cfbd-client';
import { extractSeason } from './extract';
import { transformSeason } from './transform';
import type { CfbEtlManifest } from '../src/domain';

const args = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const season = Number(argValue('--season') ?? new Date().getFullYear() - 1);
const outDir = resolve(
  argValue('--out') ?? resolve(import.meta.dirname, '..', 'data', String(season)),
);
const stagingArg = argValue('--staging');
const refresh = args.includes('--refresh');

const client = createCfbdClient({
  ...(stagingArg === undefined ? {} : { stagingDir: resolve(stagingArg) }),
  season,
});

const writeJson = (name: string, value: unknown): void => {
  const path = resolve(outDir, name);
  mkdirSync(dirname(path), { recursive: true });
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, stable(entry)]),
      );
    }
    return input;
  };
  writeFileSync(path, `${JSON.stringify(stable(value), null, 2)}\n`);
};

const get = client.get.bind(client);
const wrappedClient = {
  get: <T>(
    path: string,
    query?: Record<string, string | number>,
    options?: { refresh?: boolean },
  ): Promise<T> => get<T>(path, query, { refresh: refresh || options?.refresh === true }),
};

const raw = await extractSeason(wrappedClient, season);
const output = transformSeason(raw, season);

const sources = [
  `/teams?year=${season}`,
  `/teams/fbs?year=${season}..${season + 2}`,
  '/conferences',
  `/roster?year=${season}`,
  `/stats/player/season?year=${season}`,
  `/stats/season?year=${season}`,
  `/stats/season/advanced?year=${season}`,
  `/rankings?year=${season}&seasonType=regular|postseason`,
  `/recruiting/players?year=${season}`,
  `/recruiting/teams?year=${season}`,
  `/rushing/teams/season?year=${season}`,
  `/games?year=${season}&seasonType=regular|postseason`,
];

for (const [name, rows] of Object.entries({
  conferences: output.conferences,
  teams: output.teams,
  program_seasons: output.programSeasons,
  games: output.games,
  players: output.players,
  player_season_stats: output.playerSeasonStats,
  team_line_stats: output.teamLineStats,
  ap_rankings: output.apRankings,
  cfp_rankings: output.cfpRankings,
  recruits: output.recruits,
})) {
  writeJson(`${name}.json`, rows);
}

const manifest: CfbEtlManifest = {
  season,
  generatedAt: new Date().toISOString(),
  cfbdApiVersion: null,
  sources,
  rowCounts: output.rowCounts,
};
writeJson('manifest.json', manifest);
console.log(`CFB ETL season ${season} complete -> ${outDir}`);
