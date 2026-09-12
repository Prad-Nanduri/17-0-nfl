import { describe, expect, it } from 'vitest';
import type { CfbProgramSeason } from '../domain';
import { CFB_SIMULATION_CONFIG } from './config';
import { calibrateStrengthDistribution, programStrengthRating } from './strength';

const { meanRating, sdRating } = CFB_SIMULATION_CONFIG.opponentDistribution;

function row(overrides: Partial<CfbProgramSeason> = {}): CfbProgramSeason {
  return {
    cfbdTeamId: 1,
    season: 2023,
    conferenceKey: 'acc',
    membershipStatus: 'fbs',
    wins: 6,
    losses: 6,
    apPreseasonRank: null,
    apFinalRank: null,
    peakRankThisSeason: null,
    cfpResult: null,
    bowlResult: null,
    recruitingRank: null,
    recruitingPoints: null,
    eraTier: 'full_feature',
    ...overrides,
  };
}

describe('programStrengthRating (spec §2A.4, §5.3)', () => {
  it('returns null when the record is missing or empty', () => {
    expect(programStrengthRating(row({ wins: null }))).toBeNull();
    expect(programStrengthRating(row({ losses: null }))).toBeNull();
    expect(programStrengthRating(row({ wins: 0, losses: 0 }))).toBeNull();
  });

  it('is monotonic in win percentage', () => {
    const bad = programStrengthRating(row({ wins: 3, losses: 9 }));
    const middling = programStrengthRating(row({ wins: 6, losses: 6 }));
    const good = programStrengthRating(row({ wins: 11, losses: 1 }));
    expect(bad).not.toBeNull();
    expect(middling).not.toBeNull();
    expect(good).not.toBeNull();
    expect(bad).toBeLessThan(middling ?? 0);
    expect(middling).toBeLessThan(good ?? 0);
  });

  it('adds a rank bonus for top-25 finishes', () => {
    const unranked = programStrengthRating(row({ wins: 10, losses: 2 }));
    const ranked = programStrengthRating(row({ wins: 10, losses: 2, apFinalRank: 1 }));
    expect(ranked).toBeGreaterThan(unranked ?? 0);
  });

  it('clamps extreme records inside the z range', () => {
    const unbeaten = programStrengthRating(row({ wins: 13, losses: 0, apFinalRank: 1 }));
    const winless = programStrengthRating(row({ wins: 0, losses: 13 }));
    expect(unbeaten).toBeLessThanOrEqual(99);
    expect(winless).toBeGreaterThanOrEqual(0);
    expect(unbeaten).toBeLessThanOrEqual(meanRating + 2.5 * sdRating + sdRating);
  });
});

describe('calibrateStrengthDistribution (spec §5.3)', () => {
  it('falls back to the config default below 20 rated rows', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row({ cfbdTeamId: index, wins: 6, losses: 6 }),
    );
    const distribution = calibrateStrengthDistribution(rows);
    expect(distribution.source).toBe('config_default');
    expect(distribution.meanRating).toBe(meanRating);
    expect(distribution.sdRating).toBe(sdRating);
    expect(distribution.sampleSize).toBe(10);
  });

  it('derives mean/sd from ≥20 fbs rows', () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      row({ cfbdTeamId: index, wins: index % 13, losses: 12 - (index % 13) }),
    );
    const distribution = calibrateStrengthDistribution(rows, 2023);
    expect(distribution.source).toBe('historical');
    expect(distribution.sampleSize).toBe(40);
    expect(distribution.meanRating).toBeGreaterThan(0);
    expect(distribution.sdRating).toBeGreaterThanOrEqual(4);
  });

  it('ignores non-fbs and other-season rows', () => {
    const rows = [
      ...Array.from({ length: 25 }, (_, index) => row({ cfbdTeamId: index, wins: 6, losses: 6 })),
      row({ cfbdTeamId: 100, season: 2022, wins: 12, losses: 0 }),
      row({ cfbdTeamId: 101, membershipStatus: 'reclassifying', wins: 12, losses: 0 }),
    ];
    const distribution = calibrateStrengthDistribution(rows, 2023);
    expect(distribution.sampleSize).toBe(25);
  });
});
