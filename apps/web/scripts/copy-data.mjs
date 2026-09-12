// Vercel traces only files under the project dir (apps/web) into serverless
// functions, so the sport-engine data packages can't be read from
// ../../packages at runtime. Copy them into apps/web/data before dev/build;
// next.config.mjs points PERFECT_SEASON_*_DATA_DIR at the copy.
import { cpSync, rmSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(appDir, '..', '..', '..');

for (const sport of ['nfl', 'cfb']) {
  const source = join(repoRoot, 'packages', `sport-engine-${sport}`, 'data');
  const target = join(appDir, '..', 'data', sport);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  process.stdout.write(`copied ${source} -> ${target}\n`);
}
