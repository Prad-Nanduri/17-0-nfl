// Vercel traces only files under the project dir (apps/web) into serverless
// functions, so the sport-engine data packages can't be read from
// ../../packages at runtime. Copy them into apps/web/data before dev/build;
// next.config.mjs points PERFECT_SEASON_*_DATA_DIR at the copy. Files are
// minified (the sources are pretty-printed) to keep every function bundle
// well under Vercel's 250MB unzipped limit across all seasons.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(appDir, '..', '..', '..');

// Files the loaders actually read at runtime (see
// packages/sport-engine-*/src/data/index.ts). ETL intermediates such as
// player_season_stats/team_line_stats/games/recruits stay out of the bundle.
const KEEP = {
  nfl: /^(franchises|players|player_season_stats|ratings|manifest|franchise_seasons|legacy_ratings|legacy_player_careers)\.json$/,
  cfb: /^(conferences|teams|program_seasons|players|ratings|manifest)\.json$/,
};

const minifyTree = (source, target, keep) => {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) {
      minifyTree(from, to, keep);
    } else if (entry.name.endsWith('.json') && keep.test(entry.name)) {
      writeFileSync(to, JSON.stringify(JSON.parse(readFileSync(from, 'utf8'))));
    }
  }
};

for (const sport of ['nfl', 'cfb']) {
  const source = join(repoRoot, 'packages', `sport-engine-${sport}`, 'data');
  const target = join(appDir, '..', 'data', sport);
  rmSync(target, { recursive: true, force: true });
  minifyTree(source, target, KEEP[sport]);
  process.stdout.write(`copied ${source} -> ${target}\n`);
}
