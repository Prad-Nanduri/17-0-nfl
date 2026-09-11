import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import { sampleDriveByDrive } from './drive-sampler';
import type { SportSimulationConfig } from './config';

const config: SportSimulationConfig = {
  possessionsPerTeam: 4,
  scoringTable: [
    { outcome: 'touchdown', points: 7, probability: 0.5 },
    { outcome: 'none', points: 0, probability: 0.5 },
  ],
  strengthTilt: 0.35,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 0,
  varianceSigmaRating: 0,
  overtime: { maxPeriods: null, tiesAllowed: false },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

describe('drive sampler', () => {
  it.each([0.3, 0.7, 0.9])('honors Elo win probability %s', (winProbability) => {
    let wins = 0;
    for (let index = 0; index < 10000; index += 1) {
      if (
        sampleDriveByDrive(
          winProbability,
          config,
          createRng(`probability-${winProbability}-${index}`),
        ).won
      ) {
        wins += 1;
      }
    }
    expect(wins / 10000).toBeCloseTo(winProbability, 1);
  });

  it('handles deterministic endpoints, scores, overtime, and replayability', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(sampleDriveByDrive(1, config, createRng(`one-${index}`)).won).toBe(true);
      expect(sampleDriveByDrive(1, config, createRng(`one-${index}`)).tied).toBe(false);
      expect(sampleDriveByDrive(0, config, createRng(`zero-${index}`)).won).toBe(false);
      expect(sampleDriveByDrive(0, config, createRng(`zero-${index}`)).tied).toBe(false);
    }
    const first = sampleDriveByDrive(0.6, config, createRng('replay'));
    const second = sampleDriveByDrive(0.6, config, createRng('replay'));
    expect(second).toEqual(first);
    expect(first.pointsFor).toBe(
      first.drives.for.reduce((total, drive) => total + drive.points, 0),
    );
    expect(first.pointsAgainst).toBe(
      first.drives.against.reduce((total, drive) => total + drive.points, 0),
    );
    expect(first.pointsFor).toBeGreaterThanOrEqual(0);
    expect(first.pointsAgainst).toBeGreaterThanOrEqual(0);
  });

  it('only permits ties when the config allows them', () => {
    const tieConfig = { ...config, overtime: { maxPeriods: 1, tiesAllowed: true } };
    const noTieConfig = { ...tieConfig, overtime: { maxPeriods: 1, tiesAllowed: false } };
    let seed = 'tie-0';
    let tie = sampleDriveByDrive(0.5, tieConfig, createRng('tie-0'));
    for (let index = 0; !tie.tied && index < 1000; index += 1) {
      seed = `tie-${index}`;
      tie = sampleDriveByDrive(0.5, tieConfig, createRng(seed));
    }
    expect(tie.tied).toBe(true);
    const noTie = sampleDriveByDrive(0.5, noTieConfig, createRng(seed));
    expect(noTie.tied).toBe(false);
  });

  it('increases favored scoring with strength tilt', () => {
    const noTilt = { ...config, strengthTilt: 0 };
    let tiltedPoints = 0;
    let flatPoints = 0;
    for (let index = 0; index < 1000; index += 1) {
      tiltedPoints += sampleDriveByDrive(1, config, createRng(`tilt-${index}`)).pointsFor;
      flatPoints += sampleDriveByDrive(1, noTilt, createRng(`tilt-${index}`)).pointsFor;
    }
    expect(tiltedPoints).toBeGreaterThan(flatPoints);
  });
});
