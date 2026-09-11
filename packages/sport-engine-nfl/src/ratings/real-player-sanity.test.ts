import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NflPlayer, NflPlayerSeasonStats, NflRating } from '../domain';

const dataDir = resolve(import.meta.dirname, '../../data/2023');
const players = JSON.parse(readFileSync(resolve(dataDir, 'players.json'), 'utf8')) as NflPlayer[];
const stats = JSON.parse(
  readFileSync(resolve(dataDir, 'player_season_stats.json'), 'utf8'),
) as NflPlayerSeasonStats[];
const ratings = JSON.parse(readFileSync(resolve(dataDir, 'ratings.json'), 'utf8')) as NflRating[];
const names = new Map(players.map((player) => [player.gsisId, player.fullName]));

function rating(name: string, positionGroup: NflRating['positionGroup']): NflRating {
  const matches = ratings.filter(
    (item) => names.get(item.gsisId ?? '') === name && item.positionGroup === positionGroup,
  );
  const row = matches.find((item) => item.qualified) ?? matches[0];
  if (!row) throw new Error(`Missing ${name} ${positionGroup} rating`);
  return row;
}

describe('2023 NFL rating sanity checks', () => {
  it('keeps representative ratings ordered and within the scale', () => {
    const purdy = rating('Brock Purdy', 'QB');
    const lamar = rating('Lamar Jackson', 'QB');
    const wilson = rating('Zach Wilson', 'QB');
    const young = rating('Bryce Young', 'QB');
    expect(purdy.overall).toBeGreaterThanOrEqual(88);
    expect(lamar.overall).toBeGreaterThanOrEqual(85);
    expect(purdy.overall).toBeGreaterThan(wilson.overall);
    expect(lamar.overall).toBeGreaterThan(wilson.overall);
    expect(wilson.overall).toBeLessThanOrEqual(55);
    expect(young.overall).toBeLessThanOrEqual(55);

    const mccaffrey = rating('Christian McCaffrey', 'RB');
    const elliott = rating('Ezekiel Elliott', 'RB');
    expect(mccaffrey.overall).toBeGreaterThanOrEqual(90);
    expect(mccaffrey.overall).toBeGreaterThan(elliott.overall);

    const hill = rating('Tyreek Hill', 'WR');
    const lamb = rating('CeeDee Lamb', 'WR');
    const dotson = rating('Jahan Dotson', 'WR');
    expect(hill.overall).toBeGreaterThanOrEqual(90);
    expect(lamb.overall).toBeGreaterThanOrEqual(88);
    expect(hill.overall).toBeGreaterThan(dotson.overall);
    expect(lamb.overall).toBeGreaterThan(dotson.overall);

    expect(rating('T.J. Watt', 'DL').overall).toBeGreaterThanOrEqual(88);
    expect(rating('Myles Garrett', 'DL').overall).toBeGreaterThanOrEqual(85);
    expect(rating('Micah Parsons', 'DL').overall).toBeGreaterThanOrEqual(88);
    expect(rating('Brandon Aubrey', 'K').overall).toBeGreaterThanOrEqual(88);
  });

  it('maintains rating invariants', () => {
    for (const row of ratings) {
      expect(row.overall).toBeGreaterThanOrEqual(40);
      expect(row.overall).toBeLessThanOrEqual(99);
      if (!row.qualified) expect(row.overall).toBe(40);
      expect(row.confidenceTier).toBe('full_feature');
      expect(row.isTeamLevelProxy).toBe(row.positionGroup === 'OL');
    }
  });

  it('rates punters and has a broad offensive-line population', () => {
    const qualifiedPunters = ratings.filter((row) => row.positionGroup === 'P' && row.qualified);
    expect(qualifiedPunters.length).toBeGreaterThan(0);
    expect(Math.max(...qualifiedPunters.map((row) => row.overall))).toBeGreaterThanOrEqual(85);
    expect(new Set(qualifiedPunters.map((row) => row.overall)).size).toBeGreaterThan(1);

    const qualifiedOl = ratings.filter((row) => row.positionGroup === 'OL' && row.qualified);
    expect(qualifiedOl.length).toBeGreaterThanOrEqual(100);
    expect(Math.min(...qualifiedOl.map((row) => row.overall))).toBe(40);
    expect(Math.max(...qualifiedOl.map((row) => row.overall))).toBeGreaterThanOrEqual(90);

    const topNetPunter = stats
      .filter(
        (row) =>
          row.positionGroup === 'P' &&
          row.stats.netAvg !== null &&
          row.stats.punts !== null &&
          (row.stats.punts ?? 0) >= 20,
      )
      .sort((left, right) => (right.stats.netAvg ?? 0) - (left.stats.netAvg ?? 0))[0];
    expect(topNetPunter).toBeDefined();
    const topNetPunterRating = ratings.find(
      (row) => row.gsisId === topNetPunter?.gsisId && row.positionGroup === 'P',
    );
    expect(topNetPunterRating?.overall ?? 0).toBeGreaterThanOrEqual(85);
  });
});
