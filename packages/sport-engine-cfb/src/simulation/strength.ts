import type { SportSimulationConfig } from '@perfect-season/simulation';
import type { CfbProgramSeason } from '../domain';
import { CFB_SIMULATION_CONFIG } from './config';

export interface CfbStrengthDistribution {
  readonly meanRating: number;
  readonly sdRating: number;
  readonly sampleSize: number;
  readonly source: 'historical' | 'config_default';
}

const MIN_HISTORICAL_SAMPLE = 20;
const SD_FLOOR = 4;
// Historical FBS win% standard deviation is roughly 0.2, so a full z-scale
// swing across the distribution is about 5 sd.
const WIN_PCT_SD = 0.2;
const Z_CLAMP = 2.5;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

// Convert a program-season's record (+ final AP rank bonus) into a 0–99
// strength rating on the configured opponent distribution.
export function programStrengthRating(
  row: CfbProgramSeason,
  config: SportSimulationConfig = CFB_SIMULATION_CONFIG,
): number | null {
  const { wins, losses } = row;
  if (wins === null || losses === null || wins + losses === 0) {
    return null;
  }
  const winPct = wins / (wins + losses);
  let z = (winPct - 0.5) / WIN_PCT_SD;
  if (row.apFinalRank !== null) {
    z += ((26 - row.apFinalRank) / 25) * 1.0;
  }
  z = clamp(z, -Z_CLAMP, Z_CLAMP);
  const { meanRating, sdRating } = config.opponentDistribution;
  return clamp(meanRating + z * sdRating, 0, 99);
}

export function calibrateStrengthDistribution(
  programSeasons: readonly CfbProgramSeason[],
  season?: number,
  config: SportSimulationConfig = CFB_SIMULATION_CONFIG,
): CfbStrengthDistribution {
  const ratings = programSeasons
    .filter(
      (row) => row.membershipStatus === 'fbs' && (season === undefined || row.season === season),
    )
    .map((row) => programStrengthRating(row, config))
    .filter((rating): rating is number => rating !== null);

  if (ratings.length < MIN_HISTORICAL_SAMPLE) {
    const { meanRating, sdRating } = config.opponentDistribution;
    return {
      meanRating,
      sdRating,
      sampleSize: ratings.length,
      source: 'config_default',
    };
  }

  const mean = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  const variance =
    ratings.reduce((total, rating) => total + (rating - mean) ** 2, 0) / ratings.length;
  return {
    meanRating: mean,
    sdRating: Math.max(SD_FLOOR, Math.sqrt(variance)),
    sampleSize: ratings.length,
    source: 'historical',
  };
}
