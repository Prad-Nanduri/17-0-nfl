import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCfbFixtureData } from './index';

const write = (dir: string, name: string, value: unknown): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, name), JSON.stringify(value));
};

const conference = {
  conferenceKey: 'sun-belt',
  name: 'Sun Belt',
  shortName: 'Sun Belt',
  abbreviation: 'SBC',
  isActive: true,
  foundedYear: null,
  dissolvedYear: null,
};
const team = {
  cfbdTeamId: 1,
  school: 'Stable U',
  currentName: 'Stable U',
  abbreviation: 'STB',
  mascot: null,
  logoUrl: null,
  isBlueBlood: false,
};
const programSeason = {
  cfbdTeamId: 1,
  season: 2023,
  conferenceKey: 'sun-belt',
  membershipStatus: 'fbs',
  wins: 12,
  losses: 0,
  apPreseasonRank: null,
  apFinalRank: 4,
  peakRankThisSeason: 4,
  cfpResult: 'semifinal',
  bowlResult: null,
  recruitingRank: null,
  recruitingPoints: null,
  eraTier: 'full_feature',
};

describe('loadCfbFixtureData', () => {
  it('merges season directories and dedupes dimension tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfb-data-'));
    for (const season of ['2022', '2023']) {
      const seasonDir = join(dir, season);
      write(seasonDir, 'conferences.json', [conference]);
      write(seasonDir, 'teams.json', [team]);
      write(seasonDir, 'program_seasons.json', [{ ...programSeason, season: Number(season) }]);
      write(seasonDir, 'players.json', []);
    }
    write(join(dir, '2023'), 'ratings.json', [
      {
        cfbdPlayerId: 'p1',
        cfbdTeamId: 1,
        season: 2023,
        ratingMode: 'career_season',
        overallRating: 85,
        compositeScore: 0.8,
        percentile: 0.8,
        confidenceTier: 'full_feature',
        isTeamLevelProxy: false,
        badges: [],
        modelVersion: 'cfb-v0.1.0',
      },
    ]);
    const data = loadCfbFixtureData(dir);
    expect(data.conferences).toHaveLength(1);
    expect(data.teams).toHaveLength(1);
    expect(data.programSeasons).toHaveLength(2);
    expect(data.ratings).toHaveLength(1);
  });

  it('treats missing ratings.json as an empty rating set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfb-data-'));
    const seasonDir = join(dir, '2023');
    write(seasonDir, 'conferences.json', [conference]);
    write(seasonDir, 'teams.json', [team]);
    write(seasonDir, 'program_seasons.json', [programSeason]);
    write(seasonDir, 'players.json', []);
    expect(loadCfbFixtureData(dir).ratings).toEqual([]);
  });

  it('throws a clear error when no season data exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfb-data-'));
    expect(() => loadCfbFixtureData(dir)).toThrow(/No CFB season data found/);
  });
});
