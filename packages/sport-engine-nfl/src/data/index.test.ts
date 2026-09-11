import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadNflFixtureData } from './index';

describe('loadNflFixtureData', () => {
  it('loads typed current, spin-pool, and legacy rating fixtures synchronously', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'nfl-fixtures-'));
    await mkdir(resolve(root, '2023'));
    await mkdir(resolve(root, 'franchise_seasons'));
    await mkdir(resolve(root, 'legacy'));
    const franchise = {
      franchiseKey: 'KC',
      name: 'Kansas City Chiefs',
      currentName: 'Kansas City Chiefs',
      abbreviation: 'KC',
      nflverseTeamId: 12,
      logoUrl: null,
      conference: 'AFC',
    };
    await writeFile(resolve(root, '2023', 'franchises.json'), JSON.stringify([franchise]));
    await writeFile(resolve(root, '2023', 'players.json'), JSON.stringify([]));
    await writeFile(
      resolve(root, 'franchise_seasons', 'franchise_seasons.json'),
      JSON.stringify([
        { franchiseKey: 'KC', season: 2023, wins: 11, losses: 6, ties: 0, eraTier: 'full_feature' },
      ]),
    );
    await writeFile(resolve(root, '2023', 'ratings.json'), JSON.stringify([]));
    await writeFile(
      resolve(root, 'legacy', 'legacy_ratings.json'),
      JSON.stringify([
        {
          gsisId: 'p',
          franchiseKey: 'KC',
          season: 1985,
          positionGroup: 'QB',
          ratingMode: 'career_season',
          overall: 90,
          percentile: 0.9,
          compositeScore: 1,
          qualified: true,
          confidenceTier: 'legacy',
          isTeamLevelProxy: false,
          modelVersion: 'legacy',
        },
      ]),
    );
    const data = loadNflFixtureData(root);
    expect(data.franchises).toEqual([franchise]);
    expect(data.franchiseSeasons[0]?.wins).toBe(11);
    expect(data.ratings).toHaveLength(1);
  });
});
