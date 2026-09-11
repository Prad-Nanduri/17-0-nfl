import type { Site } from '../src/types';

export function eloWinProbability(
  rating: number,
  opponentRating: number,
  site: Site = 'neutral',
  homeAdvantage = 0,
): number {
  if (!Number.isFinite(rating) || !Number.isFinite(opponentRating)) {
    throw new RangeError('Elo ratings must be finite');
  }
  if (!Number.isFinite(homeAdvantage) || homeAdvantage < 0) {
    throw new RangeError('Home advantage must be finite and non-negative');
  }
  const adjustment = { home: homeAdvantage, away: -homeAdvantage, neutral: 0 }[site];
  return 1 / (1 + 10 ** ((opponentRating - rating - adjustment) / 400));
}

export function updateEloRating(
  rating: number,
  opponentRating: number,
  actualScore: 0 | 0.5 | 1,
  kFactor: number,
  site: Site = 'neutral',
  homeAdvantage = 0,
): number {
  if (!Number.isFinite(kFactor) || kFactor < 0) {
    throw new RangeError('K-factor must be finite and non-negative');
  }
  if (![0, 0.5, 1].includes(actualScore)) {
    throw new RangeError('Actual score must be 0, 0.5, or 1');
  }
  return (
    rating +
    kFactor * (actualScore - eloWinProbability(rating, opponentRating, site, homeAdvantage))
  );
}
